#!/bin/sh
set -eu

ROLE="${1:-web}"

run_migrations() {
  SHOULD_RUN="${RUN_MIGRATIONS:-}"
  if [ -z "$SHOULD_RUN" ]; then
    if [ "$ROLE" = "web" ]; then
      SHOULD_RUN="true"
    else
      SHOULD_RUN="false"
    fi
  fi

  if [ "$SHOULD_RUN" = "true" ]; then
    python manage.py migrate --noinput
  fi
}

case "$ROLE" in
  web)
    run_migrations
    exec supervisord -c /app/supervisord.conf
    ;;
  celery-worker)
    run_migrations
    exec celery -A config worker --loglevel="${CELERY_LOG_LEVEL:-info}" -Q "${CELERY_QUEUES:-default,transcription,voice,analysis}" --concurrency="${CELERY_CONCURRENCY:-2}"
    ;;
  celery-beat)
    run_migrations
    exec celery -A config beat --loglevel="${CELERY_LOG_LEVEL:-info}"
    ;;
  *)
    exec "$@"
    ;;
esac
