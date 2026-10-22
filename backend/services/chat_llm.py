"""Configuration for the text model used before cloned-voice synthesis."""
from dataclasses import dataclass, field

from django.conf import settings


@dataclass(frozen=True)
class ChatBackend:
    provider: str
    model: str
    api_key: str
    base_url: str | None = None
    extra_body: dict = field(default_factory=dict)


def get_chat_backend() -> ChatBackend:
    provider = settings.CHAT_PROVIDER
    if provider == 'qwen':
        backend = ChatBackend(
            provider='qwen',
            model=settings.QWEN_CHAT_MODEL,
            api_key=settings.QWEN_API_KEY,
            base_url=settings.QWEN_CHAT_BASE_URL,
            extra_body={'enable_thinking': False},
        )
    elif provider == 'openai':
        backend = ChatBackend(
            provider='openai',
            model=settings.OPENAI_CHAT_MODEL,
            api_key=settings.OPENAI_API_KEY,
        )
    else:
        raise ValueError('Unsupported chat provider configuration.')
    if not backend.api_key:
        raise ValueError(f'{provider.title()} chat API key is not configured.')
    return backend


def streamed_total_tokens(chunk) -> int | None:
    """Read usage from either OpenAI SDK objects or QwenCloud's raw dictionaries."""
    usage = getattr(chunk, 'usage', None)
    value = usage.get('total_tokens') if isinstance(usage, dict) else getattr(usage, 'total_tokens', None)
    try:
        tokens = int(value)
    except (TypeError, ValueError):
        return None
    return tokens if tokens >= 0 else None
