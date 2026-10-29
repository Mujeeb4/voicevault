"""Text and identity of the Qwen synthesis request, shared by chat and previews."""
import hashlib
import json
import re

from django.conf import settings


SPEECH_TEXT_VERSION = 'spoken-text-v1'
_END = re.compile(r'[,.!?…。！？۔؟:;—–][\"\'”’»\)\]]*$')


def prepare_speech_text(text):
    """Keep wording and punctuation; turn presentation markup into spoken phrases."""
    text = re.sub(r'\[([^\]]+)\]\([^\n)]+\)', r'\1', text)
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'(?m)^[ \t]{0,3}(?:#{1,6}[ \t]+|>[ \t]*|[-*+][ \t]+|\d+[.)][ \t]+)', '\n\n', text)
    text = re.sub(r'(\*\*|__)(.+?)\1', r'\2', text)
    text = re.sub(r'(?<!\w)(\*|_)([^\n]+?)\1(?!\w)', r'\2', text)
    text = text.replace('`', '')
    # Paragraph/list boundaries are phrase boundaries, without rewriting clauses
    # or adding pauses at arbitrary word counts. Preserve questions and ellipses.
    phrases = []
    for line in re.split(r'\n[ \t]*\n', text):
        line = ' '.join(line.split())
        if line:
            if not _END.search(line):
                line = re.sub(r'([\"\'”’»\)\]]*)$', r'.\1', line, count=1)
            phrases.append(line)
    speech = ' '.join(phrases)
    return speech if any(char.isalnum() for char in speech) else ''


def synthesis_profile():
    """Every setting that changes Qwen speech belongs in the cache identity."""
    return {
        'provider': 'replicate',
        'model': settings.REPLICATE_MODEL,
        'version': settings.REPLICATE_MODEL_VERSION,
        'language': settings.REPLICATE_LANGUAGE,
        'text_version': SPEECH_TEXT_VERSION,
    }


def synthesis_profile_id(profile=None):
    serialized = json.dumps(profile if profile is not None else synthesis_profile(), sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()[:24]


def voice_cache_identity(config):
    if not config or not config.has_cloned_voice:
        return ''
    if config.voice_provider == 'replicate':
        return f'{config.voice_clone_id}:{synthesis_profile_id()}'
    return config.voice_clone_id
