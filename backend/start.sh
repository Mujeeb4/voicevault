#!/bin/sh
set -eu
role="${1:-web}"
case "$role" in
  web)
    if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
      python manage.py migrate --noinput
    fi
    exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}" \
      --worker-class gthread --workers "${GUNICORN_WORKERS:-2}" \
      --threads "${GUNICORN_THREADS:-4}" --timeout "${GUNICORN_TIMEOUT:-120}" \
      --access-logfile - --error-logfile - --no-control-socket
    ;;
  worker)
    exec celery -A config worker --loglevel="${CELERY_LOG_LEVEL:-info}" \
      -Q "${CELERY_QUEUES:-celery,default,transcription,voice,analysis}" \
      --concurrency="${CELERY_CONCURRENCY:-2}"
    ;;
  beat)
    exec celery -A config beat --loglevel="${CELERY_LOG_LEVEL:-info}" \
      --schedule=/app/run/celerybeat-schedule --pidfile=/app/run/celerybeat.pid
    ;;
  *) exec "$@" ;;
esac
