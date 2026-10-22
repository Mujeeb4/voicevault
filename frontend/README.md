# VoiceVault frontend

The replacement VoiceVault UI is the only frontend in this repository. It uses Next.js App Router, React, TypeScript, Tailwind, React Query and Zustand.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Run Django separately on port 8000, or start the complete stack from the repository root with `docker compose up --build`.

## Structure

- `src/app/`: pages and layouts, including user and admin screens.
- `src/components/`: UI, recording, chat, family and administration components.
- `src/lib/api/`: backend contracts and authenticated HTTP/streaming requests.
- `src/lib/auth/`: session storage and token lifecycle.
- `src/store/`: application state.
- `src/types/`: shared frontend types.

## Backend connection

Browser requests go to `/api` on the frontend origin. Next.js forwards them to `BACKEND_API_URL`; use `http://127.0.0.1:8000/api` for local development or your hosted Django URL ending in `/api` for independent hosting. Docker Compose uses the internal backend service name instead.

Authentication and permissions are provided by Django. Do not put Django, database, Stripe, AI or storage service secrets in this application. Browser Supabase credentials are not required.

Set `NEXT_PUBLIC_SITE_URL` to the public frontend URL. If storage returns audio/image links on another origin, add that origin to `NEXT_PUBLIC_MEDIA_ORIGINS` (comma-separated) so the browser's content security policy permits it. Analytics is optional via `NEXT_PUBLIC_GA_TRACKING_ID`.

`BACKEND_API_URL` rewrites and `NEXT_PUBLIC_*` values are baked into the build. Set them before building and rebuild when they change. The frontend needs a Node server; static-only hosting cannot run the API proxy.

## Checks and production

```sh
npm run type-check
npm run lint
npm test
npm run build
npm start
```

With a disposable local stack running, `npm run test:e2e` checks real signup, reload persistence, login/logout and the admin guard. Install the browser once with `npx playwright install chromium`; set `PLAYWRIGHT_BASE_URL` if using a different local port.

For a container, build from this directory:

```sh
docker build --build-arg BACKEND_API_URL=https://api.example.com/api \
  --build-arg NEXT_PUBLIC_SITE_URL=https://voicevault.example.com \
  --build-arg NEXT_PUBLIC_MEDIA_ORIGINS=https://your-project.supabase.co \
  -t voicevault-frontend .
docker run --rm -p 3000:3000 voicevault-frontend
```

The image runs Next.js standalone output as an unprivileged user. See [deployment instructions](../docs/DEPLOYMENT.md) for HTTPS, workers, storage and provider setup.
