"""Server-side normalisation of uploaded audio.

Safari/iOS MediaRecorder produces AAC in an MP4 container (audio/mp4). Storage,
playback, transcription and voice cloning downstream are built around
webm/mp3/wav, so anything else is transcoded to MP3 with ffmpeg right after the
upload has been validated (extension, content type and magic bytes).
"""
import logging
import os
import subprocess
import tempfile

from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

NATIVE_EXTENSIONS = {"webm", "mp3", "wav"}
FFMPEG_TIMEOUT_SECONDS = 300


class AudioConversionError(Exception):
    pass


def audio_extension(audio_file) -> str:
    name = getattr(audio_file, "name", "") or ""
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def audio_duration_seconds(path: str) -> float | None:
    """
    Measure an audio file's length with ffprobe, or None if it can't be read as audio.

    Used instead of any duration the client reports, which can't be trusted for limits.
    Only the local file protocol is allowed, so a crafted file can't make ffprobe fetch URLs.
    """
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-protocol_whitelist", "file",
             "-select_streams", "a:0", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, timeout=60, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.warning("ffprobe unavailable or timed out: %s", exc.__class__.__name__)
        return None
    if result.returncode:
        return None
    try:
        duration = float(result.stdout.decode().strip().splitlines()[0])
    except (ValueError, IndexError):
        return None
    return duration if duration >= 0 else None


def trim_audio_file(path: str, max_seconds: int) -> str:
    """
    Cut an audio file to its first max_seconds, which caps what transcribing it can cost.

    Uses a stream copy (no re-encode, so it is quick) and returns a new path, or the
    original path if ffmpeg is unavailable or cannot cut this file.
    """
    root, extension = os.path.splitext(path)
    target = f"{root}-trimmed{extension}"
    try:
        result = subprocess.run(
            ["ffmpeg", "-v", "error", "-nostdin", "-y", "-protocol_whitelist", "file", "-i", path,
             "-t", str(max_seconds), "-vn", "-c", "copy", target],
            capture_output=True, timeout=FFMPEG_TIMEOUT_SECONDS, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.warning("ffmpeg trim unavailable or timed out: %s", exc.__class__.__name__)
        return path
    if result.returncode or not os.path.exists(target) or os.path.getsize(target) == 0:
        logger.warning("ffmpeg could not trim audio: %s", result.stderr[-300:].decode("utf-8", "replace"))
        if os.path.exists(target):
            os.unlink(target)
        return path
    return target


def normalize_audio_file(audio_file):
    """Return an uploadable file (with .name/.size) in webm/mp3/wav format."""
    extension = audio_extension(audio_file)
    if extension in NATIVE_EXTENSIONS:
        return audio_file

    with tempfile.TemporaryDirectory(prefix="voicevault-upload-") as directory:
        source = os.path.join(directory, f"source.{extension}")
        target = os.path.join(directory, "output.mp3")
        with open(source, "wb") as handle:
            for chunk in audio_file.chunks():
                handle.write(chunk)
        try:
            result = subprocess.run(
                ["ffmpeg", "-v", "error", "-nostdin", "-y", "-protocol_whitelist", "file", "-i", source,
                 "-vn", "-c:a", "libmp3lame", "-b:a", "128k", target],
                capture_output=True, timeout=FFMPEG_TIMEOUT_SECONDS, check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            logger.error("ffmpeg conversion unavailable or timed out: %s", exc.__class__.__name__)
            raise AudioConversionError("Audio conversion failed") from exc
        if result.returncode or not os.path.exists(target) or os.path.getsize(target) == 0:
            logger.warning("ffmpeg could not convert upload: %s", result.stderr[-300:].decode("utf-8", "replace"))
            raise AudioConversionError("Audio conversion failed")
        with open(target, "rb") as handle:
            content = handle.read()

    base = (getattr(audio_file, "name", "") or "recording").rsplit(".", 1)[0] or "recording"
    converted = ContentFile(content, name=f"{base}.mp3")
    converted.content_type = "audio/mpeg"
    return converted


def uploaded_audio_duration_seconds(audio_file) -> float | None:
    """
    Measure an uploaded audio file's length on the server (None if it isn't readable audio).

    Plan limits use this instead of the duration the browser reports, which a client can
    leave out or fake. The file is copied to a temporary path for ffprobe and rewound.
    """
    extension = audio_extension(audio_file) or "audio"
    with tempfile.NamedTemporaryFile(suffix=f".{extension}", delete=False) as temp:
        try:
            audio_file.seek(0)
        except (AttributeError, OSError):
            pass
        for chunk in audio_file.chunks():
            temp.write(chunk)
        temp_path = temp.name
    try:
        return audio_duration_seconds(temp_path)
    finally:
        os.unlink(temp_path)
        try:
            audio_file.seek(0)
        except (AttributeError, OSError):
            pass
