# VoiceVault backend

Django owns authentication, authorization, recordings, questions, chat, invitations, billing, storage and AI processing. Celery workers and beat use this same codebase; there is no Node.js or frontend dependency.

## Setup

From the repository root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
cp backend/.env.example backend/.env
```

Skip the copy when an environment file already exists. The previous root `.env` now lives here. Configure local PostgreSQL, Redis and storage as described in the [root README](../README.md).

```sh
cd backend
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py runserver
```

The environment file belongs to this backend only. Production credentials must come from your host's secret settings or a private `.env`. Use `FRONTEND_URL` for public invitation and payment return links and `ADMIN_EMAILS` for backend administrative authorization.

`requirements.txt` contains direct dependency requirements. `requirements.lock` pins the audited Python 3.12 Linux runtime graph and is used by Docker and CI. To deliberately update dependencies, edit the input then regenerate from this directory with `uv pip compile --python-version 3.12 --python-platform linux requirements.txt --output-file requirements.lock`, audit the result, and run the tests.

## Checks

```sh
../.venv/bin/python manage.py test --settings=config.settings_test --noinput
../.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.settings_test
```

Run `python manage.py check --deploy` with your production environment before launch.

## Services

- Web: `./start.sh web` — migrations (unless `RUN_MIGRATIONS=false`), then Gunicorn.
- Worker: `./start.sh worker` — consumes `celery,default,transcription,voice,analysis` queues.
- Scheduler: `./start.sh beat` — run exactly one instance.
- Release migration: `python manage.py migrate --noinput`.
- Liveness: `/api/health/`; dependency readiness: `/api/ready/`.

The container includes FFmpeg for recording conversion and runs as an unprivileged user. Local files need persistent storage; production should use configured Supabase storage. WhiteNoise serves collected Django static assets. See [deployment instructions](../docs/DEPLOYMENT.md).
