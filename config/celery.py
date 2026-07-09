"""
Celery configuration for VoiceVault project.
Optimized for Supabase free tier connection limits.
"""
import os
import logging
from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure
from decouple import config

logger = logging.getLogger(__name__)

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('voicevault')

# Load task modules from all registered Django app configs.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Task routing
app.conf.task_routes = {
    'apps.ai_processing.tasks.transcribe_*': {'queue': 'transcription'},
    'apps.ai_processing.tasks.clone_voice_*': {'queue': 'voice'},
    'apps.ai_processing.tasks.analyze_personality_*': {'queue': 'analysis'},
    'apps.ai_processing.tasks.finalize_ai_*': {'queue': 'default'},
    'apps.chat.tasks.generate_audio_async': {'queue': 'voice'},
}

# Retry policy
app.conf.task_annotations = {
    '*': {
        'max_retries': 3,
        'retry_backoff': True,
        'retry_backoff_max': 240,  # 4 minutes
        'retry_jitter': True,
    }
}

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()

# Broker transport options to prevent hangs
# For Upstash Redis (TLS/SSL required)
app.conf.broker_transport_options = {
    'visibility_timeout': 3600,
    'socket_timeout': 5,        # Wait only 5 seconds for connection
    'socket_connect_timeout': 5,
}

# SSL/TLS support for Upstash Redis
import ssl
redis_url = os.environ.get('REDIS_URL', '')
if redis_url.startswith('rediss://'):
    # Upstash requires SSL but we need to disable cert verification
    app.conf.broker_use_ssl = {
        'ssl_cert_reqs': ssl.CERT_NONE,
    }
    app.conf.redis_backend_use_ssl = {
        'ssl_cert_reqs': ssl.CERT_NONE,
    }

# Worker settings for Supabase free tier
app.conf.worker_max_tasks_per_child = 50  # Restart worker after 50 tasks to prevent connection leaks
app.conf.worker_prefetch_multiplier = 1   # Don't prefetch tasks, reduces concurrent DB load


# ============================================================================
# CRITICAL: Close database connections after each task
# This prevents connection exhaustion on Supabase free tier
# ============================================================================

@task_prerun.connect
def close_db_connections_before_task(**kwargs):
    """Close any stale connections before task execution."""
    try:
        from django.db import connections
        for conn in connections:
            connections[conn].close_if_unusable_or_obsolete()
    except Exception:
        pass


@task_postrun.connect
def close_db_connections_after_task(**kwargs):
    """Close all database connections after task completes."""
    try:
        from django.db import connections
        for conn in connections:
            connections[conn].close()
    except Exception:
        pass


@task_failure.connect
def close_db_connections_on_failure(**kwargs):
    """Close all database connections if task fails."""
    try:
        from django.db import connections
        for conn in connections:
            connections[conn].close()
    except Exception:
        pass


@app.task(bind=True)
def debug_task(self):
    logger.debug("Celery debug task request: %r", self.request)
