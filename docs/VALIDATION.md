# Separation and integration validation

Verified locally on October 22, 2026 using the final application sources and independent Docker images.

| Check | Result |
| --- | --- |
| Backend image, Python 3.12 and locked dependencies | Built successfully |
| Frontend image, Node.js 22 and Next.js standalone | Built successfully |
| Django tests inside the final backend image | 69 passed |
| Frontend TypeScript and ESLint | Passed |
| Frontend API/security contract tests | 9 passed |
| Connected Chromium flow | Passed signup, dashboard reload persistence, settings, admin denial, logout to home, private-route protection and login; no page errors |
| Real same-origin API smoke | Passed signup/login/profile/refresh, invalid-token rejection, questions and admin isolation |
| Large recording proxy/storage smoke | 12,800,044-byte WAV uploaded, signed playback matched byte-for-byte, deletion succeeded |
| Draft recording state | Upload and processing-status reads left completion false |
| PostgreSQL/Redis readiness | Passed |
| Celery worker | Responded to broker inspection with pong |
| Database migrations | Applied on fresh PostgreSQL; no pending migrations |
| Production Django deployment checks | No issues, including warnings |
| Runtime dependency checks | Frontend production audit: 0; backend resolved 72-package audit: 0; pip check passed |
| Image separation | Backend has no frontend/Node.js; frontend has no Django entry point; private environment files absent from both images |
| Compose configuration | Local, production and both Traefik combinations validated |

The disposable stack used local storage and blank provider credentials. It was removed after verification. Existing database files, local media and backend environment settings were preserved during repository restructuring.

Live AI transcription/voice generation, final upload processing, Stripe checkout/webhook delivery, SMTP delivery, DNS and TLS were not exercised. Those require the intended host, domains, provider credentials and test accounts. Follow [the deployment guide](DEPLOYMENT.md) before launch.

GitHub Actions workflows were added; their equivalent local checks passed. No remote deployment or GitHub Actions run was performed as part of this change.
