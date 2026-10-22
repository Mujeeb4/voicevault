"""Voice identity checks shared by cloning, readiness, and speech generation."""

# Older workers silently persisted this preset when cloning raised an exception.
LEGACY_FALLBACK_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'


def is_cloned_voice_id(voice_id: str | None) -> bool:
    """Reject missing IDs and the known legacy preset substitution."""
    return bool(voice_id and voice_id.strip() and voice_id != LEGACY_FALLBACK_VOICE_ID)


def create_voice_clone(client, *, name: str, description: str, files) -> str:
    """Use the SDK's IVC endpoint and never substitute a stock voice."""
    # This SDK JSON-encodes labels even when omitted. Pass a dictionary explicitly.
    voice = client.voices.ivc.create(name=name, description=description, files=files, labels={})
    if not is_cloned_voice_id(voice.voice_id):
        raise ValueError('ElevenLabs did not return a valid cloned voice ID.')
    if voice.requires_verification:
        raise ValueError('ElevenLabs requires voice verification. Complete verification in ElevenLabs before retrying.')
    return voice.voice_id


def voice_cloning_failure_message(exc: Exception) -> str:
    """Expose actionable failures without echoing provider bodies or credentials."""
    if isinstance(exc, ValueError):
        return str(exc)
    status = getattr(exc, 'status_code', None)
    if status == 401:
        return 'ElevenLabs authentication failed. Check the API key used by the voice worker.'
    if status == 403:
        return 'ElevenLabs denied voice cloning. Check API key permissions and Instant Voice Cloning access.'
    if status == 429:
        return 'ElevenLabs rate limit or quota reached. Check account usage before retrying.'
    if status in (400, 422):
        return 'ElevenLabs rejected the clone request. Check audio samples and available voice slots.'
    return 'Voice cloning failed. Check the voice worker logs for the error type; no preset voice was substituted.'
