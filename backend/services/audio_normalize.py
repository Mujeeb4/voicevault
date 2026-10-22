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
                ["ffmpeg", "-v", "error", "-nostdin", "-y", "-i", source,
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
