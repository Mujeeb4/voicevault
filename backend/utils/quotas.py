"""Per-account daily caps for actions that cost money (AI calls), kept in the shared cache."""
from datetime import date

from django.core.cache import cache

# Counters outlive the day they count by a little, then expire on their own
_TTL_SECONDS = 26 * 60 * 60


def consume_daily_quota(account_id, action: str, limit: int) -> bool:
    """Count one use of `action` today for this account; False once the daily limit is passed."""
    key = f'daily-quota:{action}:{account_id}:{date.today().isoformat()}'
    if cache.add(key, 1, _TTL_SECONDS):
        return limit >= 1
    try:
        return cache.incr(key) <= limit
    except ValueError:
        # The key expired between add() and incr()
        cache.set(key, 1, _TTL_SECONDS)
        return limit >= 1
