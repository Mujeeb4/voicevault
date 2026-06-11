"""
Security helpers for safe logging and lightweight input validation.
"""
from __future__ import annotations

import logging
import re
from typing import Any


SENSITIVE_KEYS = (
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "db_password",
    "email_host_password",
    "elevenlabs_api_key",
    "jwt",
    "openai_api_key",
    "password",
    "refresh",
    "secret",
    "secret_key",
    "session",
    "stripe_secret_key",
    "stripe_webhook_secret",
    "supabase_key",
    "supabase_service_key",
    "token",
)

SECRET_PATTERNS = (
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]+", re.IGNORECASE),
    re.compile(r"\b(sk|pk)_(?:test|live)_[A-Za-z0-9_=-]{8,}"),
    re.compile(r"\bwhsec_[A-Za-z0-9_=-]{8,}"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}"),
    re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"),
    re.compile(
        r"(?i)\b("
        + "|".join(re.escape(key) for key in SENSITIVE_KEYS)
        + r")\b\s*[:=]\s*['\"]?[^'\"\s,;)}]+"
    ),
)


def redact_sensitive(value: Any) -> str:
    """Return a log-safe string with common secret shapes removed."""
    text = str(value)
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    return text


def safe_exception_name(exc: BaseException) -> str:
    """Expose exception type without potentially sensitive provider details."""
    return exc.__class__.__name__


class SensitiveDataFilter(logging.Filter):
    """Redact secrets from every emitted log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact_sensitive(record.getMessage())
        record.args = ()
        if record.exc_info:
            record.exc_text = None
        return True


def validate_audio_magic(audio_file, extension: str) -> bool:
    """
    Verify common audio signatures after extension/MIME checks.

    This is intentionally small and dependency-free; unsupported or empty files
    fail closed.
    """
    position = None
    try:
        if hasattr(audio_file, "tell"):
            position = audio_file.tell()
        header = audio_file.read(16)
    finally:
        if position is not None and hasattr(audio_file, "seek"):
            audio_file.seek(position)

    if not header:
        return False

    extension = extension.lower()
    if extension == "webm":
        return header.startswith(b"\x1a\x45\xdf\xa3")
    if extension == "wav":
        return header.startswith(b"RIFF") and header[8:12] == b"WAVE"
    if extension == "mp3":
        return header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0)
    return False
