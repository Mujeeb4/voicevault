"""Public deployment probes, independent of API authentication and throttling."""
import logging
import uuid

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_safe

logger = logging.getLogger(__name__)


@require_safe
def health(request):
    """Liveness: the web process can serve requests."""
    return JsonResponse({'status': 'ok'})


@require_safe
def ready(request):
    """Readiness: database and configured shared cache are reachable."""
    checks = {}
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        checks['database'] = 'ok'
    except Exception:
        logger.exception('Database readiness check failed')
        checks['database'] = 'unavailable'
    if settings.REDIS_URL:
        key = f'readiness:{uuid.uuid4().hex}'
        try:
            cache.set(key, 'ok', timeout=10)
            if cache.get(key) != 'ok':
                raise RuntimeError('Cache round trip failed')
            cache.delete(key)
            checks['cache'] = 'ok'
        except Exception:
            logger.exception('Cache readiness check failed')
            checks['cache'] = 'unavailable'
    available = all(value == 'ok' for value in checks.values())
    return JsonResponse(
        {'status': 'ok' if available else 'unavailable', 'checks': checks},
        status=200 if available else 503,
    )
