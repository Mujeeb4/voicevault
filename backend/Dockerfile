FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 PORT=8000
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app --home /app app
COPY requirements.txt requirements.lock ./
RUN --mount=type=cache,target=/root/.cache/pip \
    env -u PIP_NO_CACHE_DIR pip install --upgrade pip setuptools \
    && env -u PIP_NO_CACHE_DIR pip install -r requirements.lock
COPY --chown=app:app . .
RUN SECRET_KEY=build-only-secret-not-used-at-runtime DEBUG=True REDIS_URL= DATABASE_URL=sqlite:////tmp/build.sqlite3 \
    python manage.py collectstatic --noinput \
    && mkdir -p /app/media /app/run \
    && chown -R app:app /app/staticfiles /app/media /app/run \
    && chmod +x /app/start.sh
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:${PORT:-8000}/api/health/ || exit 1
ENTRYPOINT ["/app/start.sh"]
CMD ["web"]
