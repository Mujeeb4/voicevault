# VoiceVault API reference

Last reviewed: October 22, 2026.

## Base URL and conventions

The browser uses the frontend origin and the `/api` prefix, for example `http://localhost:3000/api`. Next.js forwards `/api/*` to Django using the server-side `BACKEND_API_URL`. Keep browser requests and returned playback paths on this origin. The frontend does not need a public backend URL.

Every path below includes `/api` and its required trailing slash. Send JSON unless an endpoint specifies multipart data or returns a file/stream. UUID placeholders identify database records. Most protected operations derive the current account from its Bearer token; supplying a `user_id` does not authenticate a request.

The authoritative routes live in `backend/config/urls.py` and `backend/apps/*/urls*.py`. Request/response handling lives in the corresponding views and serializers; frontend adapters live in `frontend/src/lib/api/`.

## Authentication and profiles

Accounts authenticate through Django's own endpoints. Include the returned **access** token in protected requests:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

| Method | Endpoint | Access | Request / result |
| --- | --- | --- | --- |
| POST | `/api/users/signup/` | Public | Creates an account; returns `201` with `{ user, tokens: { access, refresh } }`. |
| POST | `/api/users/login/` | Public | `{ email, password }`; returns `200` with the same envelope. |
| POST | `/api/users/refresh/` | Public, valid refresh token required | `{ "refresh": "<refresh-token>" }`; returns `{ access, refresh }`. |
| POST | `/api/users/logout/` | Public; send Bearer token when available | Returns `{ "message": "Logged out successfully" }`; the client discards its stored tokens. |
| GET | `/api/users/profile/` | Signed-in account | Returns the current user object. |
| PATCH | `/api/users/profile/` | Signed-in account | Updates writable profile fields, including `full_name` and `phone_number`; returns the user object. |
| POST | `/api/users/change-password/` | Signed-in account | `{ current_password, new_password }`; returns a success message. |
| POST | `/api/users/consent/` | Signed-in account | `{ consent_type, accepted }`; records explicit consent. |

Signup request:

```json
{
  "email": "person@example.com",
  "password": "a-long-unique-password",
  "full_name": "Example Person",
  "phone_number": "+1234567890"
}
```

`phone_number` is optional. Passwords must contain 8–128 characters. Access tokens expire after one hour; refresh tokens after seven days. Use a refresh token only with the refresh endpoint, save the returned pair, and retry the original authenticated request once. Logout is stateless and does not revoke previously issued JWTs server-side.

The user object includes `id`, `email`, `full_name`, `phone_number`, `plan_type`, `package_tier`, `is_premium`, `payment_completed`, `lifetime_access`, `recording_completed`, `ai_ready`, `is_admin`, `usage_quota`, and lifecycle timestamps. Entitlement, admin, email, and processing fields are read-only in profile updates. Refresh the profile after uploads, checkout confirmation, and processing completion before using these flags for navigation.

Consent types: `voice_cloning`, `ai_personality_generation`, `family_access`, `terms_of_service`, `privacy_policy`. Voice cloning requires Premium access and accepted voice-cloning consent. Consent returns `201` with `id`, `consent_type`, `accepted`, and `accepted_at`. Accepting voice consent can also queue voice processing and finalization when recordings already exist; this action can invoke a paid provider.

## Health probes

| Method | Endpoint | Result |
| --- | --- | --- |
| GET / HEAD | `/api/health/` | Public liveness: `{ "status": "ok" }`. |
| GET / HEAD | `/api/ready/` | Public readiness: `{ "status": "ok", "checks": { "database": "ok", "cache": "ok" } }`; cache is included when Redis is configured. Returns `503` if a checked dependency fails. |
| GET | `/api/users/health/` | Public legacy database health endpoint; returns service/database status. |

## Questions and audio recordings

| Method | Endpoint | Access / result |
| --- | --- | --- |
| GET | `/api/recordings/questions/` | Public active questions; optional `domain`, `search`, `page`, `per_page`, `is_active`. Returns `{ count, next, previous, results }`. Signed-in free accounts receive their guided-question allowance; admins can inspect inactive questions. |
| POST | `/api/recordings/upload/` | Signed-in account; multipart upload described below. |
| GET | `/api/recordings/` | Current account's recordings: `{ count, total_duration_seconds, recordings }`. Optional `domain` and `transcribed=true/false`. |
| DELETE | `/api/recordings/{recording_id}/` | Recording owner; removes storage and database record; `204`. |
| GET | `/api/recordings/{recording_id}/audio/?token=...` | Local-storage playback using the returned short-lived signed URL. |

Question entries include `id`, `question_text`, `domain`, `order`, `is_active`, `tip`, and `suggested_duration_seconds`.

### Combined upload used by the frontend

Send multipart fields `audio_file` (a named file), `duration_seconds`, and `recording_metadata` (a JSON string). Supported recording formats are **WebM, MP3, WAV**; extension, content type, and file signature must match. Plan storage/duration quotas and deployment request limits also apply.

Example `recording_metadata` for a single complete recording:

```json
{
  "questions_answered": 5,
  "recording_date": "2026-10-22T12:00:00Z",
  "file_format": "wav",
  "file_size_bytes": 320044,
  "chunk_index": 1,
  "total_chunks": 1,
  "is_final_chunk": true,
  "total_duration_seconds": 10
}
```

For multiple parts, upload sequentially with one-based `chunk_index`, the same `total_chunks`, each part's `duration_seconds`, and `is_final_chunk: true` only on the last part. Starting part 1 of a multipart upload replaces the account's previous combined recording set. A part is stored as its own recording; these are not resumable byte-range requests.

A non-final part stores audio without completing the recording or queuing AI processing. The final part marks `recording_completed`, resets AI readiness when starting a new pipeline, and automatically queues transcription, personality analysis, eligible voice cloning, and finalization. These tasks can invoke external providers. An active processing pipeline suppresses a duplicate automatic start. An upload response confirms file storage; it does not confirm successful AI processing or queue submission. Poll processing status separately.

Successful combined upload (`201`, or `200` in an existing-record recovery path):

```json
{
  "recording_id": "recording-uuid",
  "storage_path": "account-id/combined_timestamp.wav",
  "public_url": "/api/recordings/recording-uuid/audio/?token=...",
  "status": "complete",
  "created_at": "2026-10-22T12:00:00Z"
}
```

The `public_url` value is a signed playback path for local storage, despite its historical field name. Use returned URLs without constructing storage paths. Storage-backed deployments may return a storage URL instead.

The legacy individual-question upload accepts `audio_file`, `question_number` (1–30), `question_text`, `domain`, and optional `duration_seconds`; it returns a recording serializer with `id` and `upload_status`. Its allowed domains are `childhood`, `career`, `family`, `wisdom`, `challenges`, `personality`. It does not use the combined-upload automatic-finalization contract.

## AI processing

Despite their `/admin/` prefix, these endpoints allow the target account owner or a configured administrator. Use an empty JSON object for task triggers. Workers and the configured providers must be available.

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/admin/process/status/{user_id}/` | Processing status envelope described below. |
| POST | `/api/admin/process/full-pipeline/{user_id}/` | Queues the full eligible pipeline. |
| POST | `/api/admin/process/transcribe/{user_id}/` | Queues transcription. |
| POST | `/api/admin/process/personality/{user_id}/` | Queues personality analysis. |
| POST | `/api/admin/process/voice-clone/{user_id}/` | Requires Premium and consent; queues voice preparation/cloning and finalization. |
| POST | `/api/admin/process/finalize/{user_id}/` | Queues final validation/readiness. |
| POST | `/api/admin/process/voice-preview/{user_id}/` | `{ text }`, 1–300 characters; requires a prepared Replicate voice reference. Returns `{ preview_id, status }` (`202` newly queued, `200` reused). |
| GET | `/api/admin/process/voice-preview/{user_id}/{preview_id}/` | Returns `{ preview_id, status }`, plus `audio_url` when complete or `error` on failure. |
| GET | `/api/admin/process/voice-preview/{user_id}/{preview_id}/audio/` | Authenticated audio file. Fetch with Bearer token and play a client Blob URL. |

Status contains `user_id`, `ai_ready`, `overall_status`, `steps`, `created_at`, and `updated_at`. `steps` has `transcription`, `personality_analysis`, and `voice_cloning`, each with `status`, `error`, and `result`; transcription also includes `full_transcript`. Step statuses are `pending`, `in_progress`, `complete`, `failed`. Overall status additionally supports `recorded_and_uploaded`. Voice is not required for the free text-only experience. Provider choice and timings depend on deployment configuration; the API makes no fixed latency guarantee.

## Chat and response audio

The signed-in account must own the ready AI or have accepted family access. Chat authorization and conversation ownership are derived server-side from the authenticated account.

| Method | Endpoint | Request / result |
| --- | --- | --- |
| POST | `/api/chat/stream/` | `{ ai_owner_id, question }`; streams SSE. Maximum backend question length: 1,000 characters. |
| GET | `/api/chat/stream/?ai_owner_id=...&message=...` | Alternate streaming request; still requires the Authorization header. Prefer POST in browsers. |
| GET | `/api/chat/conversations/?ai_owner_id=...&page=1&per_page=20` | Paginated current participant's history, newest first: `{ count, next, previous, results }`. Maximum page size: 100. |
| POST | `/api/chat/conversations/{conversation_id}/rate/` | `{ rating, feedback }`; rating integer 1–5, optional feedback up to 1,000 characters; participant ownership required. |
| POST | `/api/chat/transcribe-voice/` | Multipart `audio` file; maximum 25 MiB; returns `{ transcript, success }`. Supported MIME types: WebM, Ogg, MP4, MPEG, WAV. |
| GET | `/api/chat/audio-status/{task_id}/?conversation_id=...` | Poll using both task and conversation IDs from the stream; returns `pending`, `processing`, `complete`, or `failed`, with `audio_url` or `error` when applicable. |
| GET | `/api/chat/audio/{conversation_id}/?token=...` | Protected playback using the signed URL returned by history/stream/status. |

Conversation entries contain nested `ai_owner` and `family_member`, `question_text`, `response_text`, `audio_url`, `created_at`, `response_time_ms`, `gpt_tokens_used`, `user_rating`, and `user_feedback`. The backend selects the participant from authentication; passing a different `family_member_id` does not grant access to another participant's history.

### SSE protocol

Use `fetch` with the Authorization header and consume its response body. Each event is JSON in a `data: ...` line, separated by a blank line. Network chunks need buffering; a chunk can contain partial or multiple events.

| `type` | Relevant payload / meaning |
| --- | --- |
| `text_chunk` | `content`, optional `timestamp`; append text. |
| `text_complete` | `full_text`, `tokens`; text is finished, audio may still be pending. |
| `audio_processing` | `task_id`, `conversation_id`; poll audio status. |
| `audio_generating` | `message`, `conversation_id`; synchronous generation progress. |
| `audio_ready` | `audio_url`, `conversation_id`; playback is available. |
| `audio_unavailable` | `message`, optional `upgrade_required` and `conversation_id`; text may still succeed. |
| `audio_failed` | `error`, `conversation_id`; text may still succeed. |
| `complete` | `conversation_id`, optional timing/cache fields; terminal success. |
| `error` | `message`, optional `upgrade_required`; terminal failure. |

Not every stream emits every event. Validation, authentication, and access failures can be ordinary non-200 JSON responses before streaming begins. Handle both HTTP errors and in-stream `error`; an EOF without a terminal event is an interrupted request. Voice responses require the AI owner's Premium eligibility and configured voice.

## Family invitations

| Method | Endpoint | Access / result |
| --- | --- | --- |
| POST | `/api/family/invite/` | Ready AI owner; `{ email, full_name, relationship, personal_message? }`; returns `201`. |
| GET | `/api/family/invitation/{token}/` | Public preview of a valid invitation. |
| POST | `/api/family/accept-invite/{token}/` | Authenticated invitation recipient; empty JSON body. |
| GET | `/api/family/members/` | Current AI owner's members: `{ count, members }`. |
| DELETE | `/api/family/members/{member_id}/` | Owner removes member and access; `204`. |
| POST | `/api/family/members/{member_id}/resend/` | Owner regenerates a pending invitation; returns new link. |
| GET | `/api/family/accessible-ais/` | Signed-in account's ready, accessible AIs: `{ results }`. Includes own ready AI. |

Relationships: `spouse`, `child`, `parent`, `sibling`, `friend`.

Invitation creation returns `family_member_id`, `email`, `full_name`, `relationship`, `invitation_link`, `expires_at`, `email_sent`, and `message`. Creation can succeed with `email_sent: false`; the owner can share the returned link or resend.

Public preview returns `ai_owner: { id, full_name }`, `invitee_name`, `invitee_email`, `relationship`, `expires_at`, `is_expired`, and `already_accepted`. Token validity is enforced by the server-side cache. Tokens expire after seven days and are single-use; the response's displayed expiry is informational.

Acceptance requires signing up or logging in with the invited email address. A different signed-in email returns `403`; anonymous requests return `401` for a valid token. Invalid/expired/consumed tokens return `400`. The server links the authenticated user, grants access, invalidates the token, and returns `{ message, ai_owner: { id, name, relationship }, redirect_url }`. Sending a `user_id` cannot select another account. Follow the returned `/chat/{ai_owner_id}` redirect.

Member entries include access/invitation timestamps and conversation counts. Accessible AI entries include `id`, `full_name`, `ai_ready`, `relationship`, `plan_type`, `is_premium`, `voice_enabled`, and `usage_quota`. Family membership changes are owner-only; there is no member PATCH endpoint.

## Packages, checkout, and billing

The available plans are **free** (Memory Starter) and **premium** (one-time lifetime purchase). Get current prices/currency/features from the API rather than hardcoding pricing or obsolete package tiers. Usage limits remain plan-specific even with lifetime access.

| Method | Endpoint | Access / result |
| --- | --- | --- |
| GET | `/api/payments/packages/` | Public `{ packages }`; entries include `tier`, `name`, `price` in major currency units, `price_display`, `features`, `highlighted`; Premium also includes `currency`. |
| POST | `/api/payments/create-checkout/` | Signed-in account; `{ "package_tier": "premium" }`; returns `{ checkout_url, session_id }`. Redirect to Stripe. |
| POST | `/api/payments/confirm-checkout/` | Signed-in account; `{ session_id }`; verifies ownership/payment with Stripe. Returns `200` if paid, `202` if not yet paid. |
| GET | `/api/payments/status/` | Current entitlement/payment flags and `usage_quota`. |
| GET | `/api/payments/billing/` | `{ is_paid, plan_name, amount_paid_cents, paid_at, payment_method_display, is_lifetime, receipt_url }`; unavailable billing fields can be null. |
| POST | `/api/payments/webhook/` | Stripe-signed webhook; no Bearer token. |

Checkout confirmation returns `payment_completed`, `is_premium`, `payment_status`, and `session_status`. A session belonging to another account returns `403`. Refresh the profile after confirmation. Successful Stripe checkout redirects to `${FRONTEND_URL}/pricing/success?session_id=...`; cancellation redirects to `${FRONTEND_URL}/pricing?canceled=true`.

The webhook verifies `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET`. `checkout.session.completed` records payment and activates Premium. `payment_intent.succeeded` and `payment_intent.payment_failed` are logged. This is a one-time checkout flow, not a subscription API.

## Administration

These endpoints require a backend-configured administrator. The user profile's `is_admin` is the frontend gate; server authorization remains authoritative. `/admin/` on the frontend is its own UI; Django's management UI is separate from the `/api/admin/` JSON endpoints.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/admin/me/` | Verify authenticated admin identity. |
| GET | `/api/admin/stats/` | Counts, revenue, processing/API usage summaries. |
| GET | `/api/admin/users/` | `page`, `limit`, `search`, `status`; returns `{ count, results }`. |
| GET / PATCH / DELETE | `/api/admin/users/{user_id}/` | Inspect, update supported fields, or delete an account. |
| GET | `/api/admin/processing/` | Processing jobs; optional `status`, `user`, `page`, `limit`. |
| POST | `/api/admin/batch-process-pending/` | Queue pending account pipelines. |
| POST | `/api/admin/batch-retry-failed/` | Retry eligible failed processing. |
| GET | `/api/admin/payments/` | Payment records; optional `status`, `search`, `page`, `limit`. |
| POST | `/api/admin/payments/{payment_id}/refund/` | Issue a real Stripe refund; returns the updated payment. |
| GET | `/api/admin/logs/` | Optional `type=failures` or `type=audit`, and `limit`. |

Admin list pagination uses `page >= 1`, `limit` 1–100 (default 20).

Question administration uses `/api/recordings/questions/`:

| Method | Suffix | Request / result |
| --- | --- | --- |
| GET | `{question_id}/` | Inspect one question. |
| POST | `create/` | Question fields; returns created question. |
| PUT / PATCH | `{question_id}/update/` | Update question fields. |
| DELETE | `{question_id}/delete/` | Delete question. |
| POST | `reorder/` | `{ "questions": [{ "id": "uuid", "order": 1 }] }`. |
| POST | `seed/` | Seed default questions. |
| POST | `bulk-update/` | `{ question_ids, is_active }`. |
| POST | `bulk-delete/` | `{ question_ids }`. |
| GET | `export/` | Download CSV. |

Question fields: `question_text`, `domain`, `order`, `is_active`, `tip`, `suggested_duration_seconds`. All operations in this administration table require admin authorization.

## Provider webhooks, errors, and verification

`POST /api/chat/replicate/webhook/` accepts verified Replicate callbacks for response audio and voice previews. Provider callbacks use their signature verification instead of user Bearer tokens; configure their public backend callback URL for the deployment.

Errors vary by endpoint: common forms are `{ error, message }`, `{ error, details }`, or DRF `{ detail }`. Quota errors can include `upgrade_required` and limit information. Do not assume every error has the same envelope.

| Status | Meaning |
| --- | --- |
| 400 | Invalid request, unsupported state, or invalid invitation. |
| 401 | Missing, invalid, or expired credentials. |
| 402 | Plan quota/upgrade requirement on supported operations. |
| 403 | Authenticated account lacks ownership/admin/recipient access, or a protected operation is ineligible. |
| 404 | Resource not found. |
| 409 | Conflicting resource, such as a duplicate invitation/question recording. |
| 429 | Configured rate limit exceeded. |
| 500 / 502 / 503 | Application failure, provider failure, or dependency unavailable. |

Throttles are configured in `backend/config/settings.py` and `backend/utils/throttling.py`, with endpoint-specific exemptions. Do not rely on fixed request limits or custom rate-limit headers from this reference. Respect HTTP status and `Retry-After` when provided.

For disposable local integration checks through the frontend proxy, run `python3 scripts/smoke.py --upload-draft` from the repository root. This validates authentication, questions, local multipart storage, signed playback, deletion, and authorization without finalizing an upload or invoking paid AI providers. See the [deployment guide](DEPLOYMENT.md) for service configuration.
