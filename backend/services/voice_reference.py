"""Select complete phrases and retain their original timing for a Qwen reference."""
import math
import re
import subprocess
import wave
from pathlib import Path


REFERENCE_VERSION = b'complete-phrases-v1\0'
ANALYSIS_SECONDS = 60
MAX_REFERENCE_SECONDS = 20
_SENTENCE_END = re.compile(r'[.!?。！？۔؟][\"\'”’»\)\]]*$')
_ABBREVIATION = re.compile(r'^(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|[A-Z])\.$', re.I)
_NO_PHRASE = 'Record a clear, complete sentence of at least three seconds and retry voice cloning.'


def punctuate_timed_words(words, transcript):
    """Recover punctuation when the ASR word entries contain only spoken tokens.

    Align characters from the same response strictly; never guess a time for a
    missing/mismatched word. Apostrophes and other punctuation do not affect the
    alignment. Sentence markers are taken from the full punctuated transcript.
    """
    characters = [(folded, index) for index, char in enumerate(transcript) if char.isalnum()
                  for folded in char.casefold()]
    normalized = ''.join(char for char, _ in characters)
    cursor = 0
    result = []
    for item in words:
        word = item['word'].strip()
        token = ''.join(char.casefold() for char in word if char.isalnum())
        if not token:
            continue
        if normalized[cursor:cursor + len(token)] != token:
            raise ValueError('The speech transcript could not be matched to its timestamps.')
        cursor += len(token)
        last_character = characters[cursor - 1][1]
        next_character = characters[cursor][1] if cursor < len(characters) else len(transcript)
        suffix = transcript[last_character + 1:next_character]
        # A decimal point within a number is not a sentence boundary.
        decimal = (suffix == '.' and transcript[last_character].isdigit()
                   and next_character < len(transcript) and transcript[next_character].isdigit())
        marker = re.search(r'\.{3}|[.!?。！？۔؟]', suffix)
        if decimal:
            word = word.rstrip('.')
        if marker and not decimal:
            word = word.rstrip('.!?。！？۔؟') + marker.group()
        result.append({**item, 'word': word})
    if cursor != len(normalized):
        raise ValueError('The speech transcript could not be matched to its timestamps.')
    return result


def select_reference_window(words, duration):
    """Find a 3–20s run of complete sentences, preferring 8s+ and natural gaps.

    Whisper word timestamps locate phrase boundaries; no silence is removed
    inside the selected run. A trailing fragment at the analysis cut is ignored.
    """
    validated = []
    for item in words:
        try:
            start, end = float(item['start']), float(item['end'])
            word = item['word'].strip()
        except (KeyError, TypeError, ValueError, AttributeError) as exc:
            raise ValueError('The recording did not return usable speech timestamps.') from exc
        if (not word or not math.isfinite(start) or not math.isfinite(end)
                or start < 0 or end < start or end > duration + 0.05
                or (validated and start < validated[-1]['start'])):
            raise ValueError('The recording did not return usable speech timestamps.')
        validated.append({'start': start, 'end': min(end, duration), 'word': word})

    sentences = []
    first = 0
    for index, item in enumerate(validated):
        if (_SENTENCE_END.search(item['word'])
                and not item['word'].endswith('...')
                and not _ABBREVIATION.match(item['word'])):
            # ASR may invent punctuation at a hard 60-second analysis cut.
            if not (duration >= ANALYSIS_SECONDS - 0.05 and item['end'] > duration - 0.25):
                sentences.append((first, index))
            first = index + 1

    candidates = []
    for left in range(len(sentences)):
        for right in range(left, len(sentences)):
            begin, finish = sentences[left][0], sentences[right][1]
            previous_end = validated[begin - 1]['end'] if begin else 0
            next_start = validated[finish + 1]['start'] if finish + 1 < len(validated) else duration
            if previous_end > validated[begin]['start'] or next_start < validated[finish]['end']:
                continue
            start = max(previous_end, validated[begin]['start'] - 0.12)
            end = min(next_start, validated[finish]['end'] + 0.18, duration)
            length = end - start
            if length > MAX_REFERENCE_SECONDS:
                break
            if length < 3 or finish - begin + 1 < 3:
                continue
            gaps = [max(0, validated[i + 1]['start'] - validated[i]['end'])
                    for i in range(begin, finish)]
            if gaps and max(gaps) > 2.5:
                continue
            rank = (min(length, 8), min(right - left, 2),
                    min(sum(gap >= 0.15 for gap in gaps), 3), -abs(length - 15), -start)
            candidates.append((rank, start, end))
    if not candidates:
        raise ValueError(_NO_PHRASE)
    _, start, end = max(candidates)
    return start, end


def _convert(source, target, *, start=0, duration):
    try:
        process = subprocess.run(
            ['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', str(source),
             '-ss', str(start), '-t', str(duration), '-ac', '1', '-ar', '24000',
             '-c:a', 'pcm_s16le', str(target)],
            capture_output=True, timeout=90, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError('The voice recording could not be converted to a usable reference clip.') from exc
    if process.returncode or not target.exists() or target.stat().st_size < 10000:
        raise ValueError('The voice recording could not be converted to a usable reference clip.')


def build_reference(source, directory, transcriber):
    """Transcribe a bounded search window, then transcribe the exact final crop."""
    analysis = Path(directory) / 'analysis.wav'
    reference = Path(directory) / 'reference.wav'
    _convert(source, analysis, duration=ANALYSIS_SECONDS)
    with wave.open(str(analysis), 'rb') as audio:
        duration = audio.getnframes() / audio.getframerate()
    with analysis.open('rb') as audio:
        result = transcriber.create(
            model='whisper-1', file=audio, response_format='verbose_json',
            # openai 1.10 exposes newer transcription options through extra_body.
            extra_body={'timestamp_granularities': ['word']},
        )
    words = getattr(result, 'words', None)
    if not isinstance(words, list):
        raise ValueError('The recording did not return usable speech timestamps.')
    # SDK versions may expose timestamp entries as dictionaries or model objects.
    words = [item if isinstance(item, dict) else item.dict() for item in words]
    words = punctuate_timed_words(words, result.text)
    start, end = select_reference_window(words, duration)
    _convert(analysis, reference, start=start, duration=end - start)
    with reference.open('rb') as audio:
        transcript = transcriber.create(model='whisper-1', file=audio).text.strip()
    if len(transcript.split()) < 3 or not _SENTENCE_END.search(transcript):
        raise ValueError(_NO_PHRASE)
    content = reference.read_bytes()
    if len(content) > 1_000_000:
        raise ValueError('The selected voice reference exceeds the audio size limit.')
    return content, transcript
