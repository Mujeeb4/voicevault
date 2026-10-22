# Deploying VoiceVault

Deploy `frontend/` and `backend/` independently. The backend image also runs the worker and scheduler. The root Dockerfile and Supervisor setup have been removed.

Use Docker Compose v2.24 or newer for the provided stack.

## Independent hosting

| Service | Root / build | Start |
| --- | --- | --- |
| Frontend | `frontend/`, `npm ci && npm run build` | `npm start`, or the frontend Dockerfile |
| API | `backend/`, its Dockerfile | `web` container command |
| Worker | Same backend image | `worker` container command |
| Scheduler | Same backend image, one replica | `beat` container command |

Use a managed PostgreSQL database and Redis reachable by the API and worker. Run `python manage.py migrate --noinput` once as a release job before switching traffic. Set `RUN_MIGRATIONS=false` on API replicas when using a release job. Build static files with `collectstatic` (the Dockerfile already does this). Plain Python hosting also needs FFmpeg installed.

### Backend environment

Use `backend/.env.example` as the full reference. Required production values include:

- `DEBUG=False` and a strong randomly generated `SECRET_KEY`.
- `DATABASE_URL` for PostgreSQL, with `DB_SSL_REQUIRE=True` for a hosted database.
- `REDIS_URL` for the shared Redis service, preferably `rediss://` when remote.
- `ALLOWED_HOSTS` with the API hostname and `backend` when using Compose.
- `FRONTEND_URL` with the public HTTPS frontend origin, and that origin in `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.
- `STORAGE_BACKEND=supabase`, `SUPABASE_URL`, and a server-side service key, with recording/response buckets configured.
- Credentials for your selected chat and voice providers and SMTP email delivery.
- Live Stripe credentials, configured one-time price, and webhook signing secret if accepting payments.

Stripe webhooks should point directly to `https://api.example.com/api/payments/webhook/`. Configure the selected voice provider's callback URL/key when applicable. Invitation and checkout return URLs use `FRONTEND_URL`.

Terminate HTTPS at a trusted proxy that overwrites `X-Forwarded-Proto`. Keep secure cookies and HTTPS redirects enabled. The backend trusts that proxy header; do not expose an untrusted direct HTTP path in production. `/api/health/` is suitable for liveness, and `/api/ready/` verifies dependencies. Run `python manage.py check --deploy` against production settings.

Use Supabase for production media. Local media requires a persistent shared volume, a real public media-serving route, and `LOCAL_STORAGE_PUBLIC_URL`; Django's development media helper is not a production file server. Maintain database backups and persistent worker/scheduler state. Do not scale beat above one replica.

### Frontend environment

Set these before building:

```dotenv
BACKEND_API_URL=https://api.example.com/api
NEXT_PUBLIC_SITE_URL=https://voicevault.example.com
NEXT_PUBLIC_MEDIA_ORIGINS=https://your-project.supabase.co
```

No backend credentials belong in frontend settings. All browser HTTP and chat streams use the same-origin `/api` proxy. Add every origin that actually serves audio/images to `NEXT_PUBLIC_MEDIA_ORIGINS`. Rebuild after changing these variables. Do not use static export hosting: the proxy requires a Node server.

Configure the host or reverse proxy for large audio uploads and streaming responses. Preserve query strings, request bodies, authorization and content types. Disable response buffering for `/api/chat/` and allow long enough timeouts for SSE. The Next.js proxy is configured for 180 seconds and up to 110 MB of cloned request body; match or exceed the backend upload limits at your ingress. Avoid platform limits that cut off uploads or chat streams.

The frontend `/admin` pages are the app's admin UI; access Django administration directly on the backend `/admin/` URL.

## Production Docker Compose

This stack uses managed PostgreSQL and the bundled private Redis. Configure backend secrets first, then Compose interpolation:

```sh
cp backend/.env.example backend/.env  # skip if it exists
cp .env.example .env
```

Edit `backend/.env` for production. Set `SITE_URL=https://voicevault.example.com` in root `.env`, plus `MEDIA_ORIGINS` for your storage domain. Ensure `backend` is included in `ALLOWED_HOSTS` and the public frontend is in trusted origins.

```sh
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml exec backend python manage.py check --deploy
```

A one-shot `migrate` service must succeed before API traffic starts; workers wait for the API. The frontend and backend listen on loopback ports 3000 and 8000 by default. Connect an HTTPS reverse proxy to those ports, or attach its network. Redis is never published to the host. Secrets are read at runtime and excluded from build contexts. Each image can also be built independently with `docker build frontend/` and `docker build backend/`.

Optional Traefik overlays target the frontend service. For a bridge-network Traefik proxy:

```sh
TRAEFIK_HOST=voicevault.example.com TRAEFIK_NETWORK=traefik \
  docker compose -f docker-compose.production.yml -f docker-compose.traefik.yml \
  -f docker-compose.traefik-https.yml up -d
```

For a host-network proxy, use `docker-compose.traefik-host.yml` instead of `docker-compose.traefik.yml`. Route a separate API hostname to backend port 8000 for webhooks and Django administration. A domain, DNS records and a working certificate resolver must already exist.

## Release checks

1. Run both applications' checks and builds from the root README.
2. Build both images and verify `/login`, frontend `/api/health/`, and backend `/api/ready/`.
3. Run `python3 scripts/smoke.py --large-upload` and `npm run test:e2e` against a disposable local stack. With real test accounts, verify signup/login, recording upload, worker processing, streaming chat, audio playback, invitation acceptance and Stripe test checkout/webhooks before enabling live billing.
4. Verify HTTPS, public return links, storage access and email delivery on the chosen domain.

Provider calls, live payment completion, DNS, TLS and email delivery require the target host and credentials; local automated checks cannot confirm those external services.

References: [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying) and [Django deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/).

## Dependency maintenance

Backend containers and CI install `backend/requirements.lock`, whose Python 3.12 Linux ARM64 and x86_64 pins were checked together. Regenerate it after intentional dependency updates, then rerun the audit and tests. The frontend uses `npm ci` with its own lockfile.

The frontend production dependency audit is clean. Its complete development audit still reports Tailwind 3 transitive `braces` advisories for which no patched release is available; these packages are build tooling and excluded from the standalone runtime image. Revisit this when patched tooling becomes available.

## Existing installations

The old backend environment file moved from the root to `backend/.env`; local media files moved to `backend/media/`. The new containers use a named media volume. Before using an existing database whose recording rows refer to local files, import those preserved files into the volume:

```sh
docker compose cp backend/media/. backend:/app/media/
docker compose exec --user root backend chown -R app:app /app/media
```

Use `-f docker-compose.production.yml` with both commands for that stack. Supabase object storage needs no file move. Back up the database and media before replacing a running installation, and retain the existing PostgreSQL volume or managed database. Do not remove volumes when stopping a production stack.
