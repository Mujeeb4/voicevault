# VoiceVault

VoiceVault preserves recordings and lets invited family members talk with an AI built from them.

The repository has two independent applications:

| Directory | Responsibility | Runtime |
| --- | --- | --- |
| `frontend/` | New VoiceVault interface, browser recording, authentication UI, API client | Next.js / Node.js 22 |
| `backend/` | API, permissions, data, storage, billing, AI pipelines and background tasks | Django / Python 3.12 |
| `docs/` | Shared API and deployment documentation | — |

The previous frontend and combined Django/Next.js container have been removed. Frontend browser requests use the same-origin `/api` proxy. Django owns the API; Celery workers use the backend image and have no frontend dependencies. Each application has its own dependencies, environment template, Dockerfile and ignore file.

## Local development

```sh
cp backend/.env.example backend/.env   # skip if you already have this file
cp frontend/.env.example frontend/.env.local
```

The existing root backend `.env` has moved to `backend/.env`. Existing local media is preserved in `backend/media/`; import it into the Compose media volume before attaching an existing database (see the deployment guide). Review its values before using the environment file; it may point to an existing hosted database or paid services. For local work, set `DEBUG=True`, use a local `DATABASE_URL` and Redis, set `STORAGE_BACKEND=local`, and set `FRONTEND_URL=http://localhost:3000`.

Run the complete local stack:

```sh
docker compose up --build -d
```

Open <http://localhost:3000>. Django is available at <http://localhost:8000/api/health/>. Local Compose overrides database, Redis, storage and security settings for the local containers; optional provider credentials come from `backend/.env`. Default host ports are 3000/8000; use a root `.env` copied from `.env.example` to change them. PostgreSQL uses the persistent `postgres_data` volume, Redis uses `redis_data`, and recordings use `media_data`.

For development with live reload, start just the dependencies:

```sh
docker compose up -d postgres redis
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
```

In `backend/.env`, set `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:15432/voicevault`. Set `REDIS_URL=redis://127.0.0.1:16379/0` for the local Redis container. These dependency ports bind only to loopback.

```sh
cd backend
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py runserver
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Run a worker for asynchronous processing using the backend environment:

```sh
cd backend
../.venv/bin/celery -A config worker -l info -Q celery,default,transcription,voice,analysis
```

## Verification

```sh
cd backend
../.venv/bin/python manage.py test --settings=config.settings_test --noinput
```

```sh
cd frontend
npm ci
npm run type-check
npm run lint
npm test
npm run build
```

CI runs both applications' checks independently. Test settings use isolated SQLite and in-memory services.

For an end-to-end API smoke check on a disposable local stack with local storage and blank provider credentials:

```sh
python3 scripts/smoke.py --upload-draft
```

Run the connected browser flow against that same disposable stack:

```sh
cd frontend
npx playwright install chromium
npm run test:e2e
```

These checks create test accounts and verify real auth, API proxying, token refresh, upload, protected audio playback and deletion. It skips final upload processing and payments to avoid provider calls.

## Hosting

Use [the deployment guide](docs/DEPLOYMENT.md) for independent services or the production Compose stack. Configure real domains, secrets, PostgreSQL, Redis, storage and provider credentials before launch. No live service is deployed by this repository change.

- [Frontend setup](frontend/README.md)
- [Backend setup](backend/README.md)
- [API reference](docs/API_DOCUMENTATION.md)
- [Validation results](docs/VALIDATION.md)
