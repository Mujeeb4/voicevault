<!-- Backend commands in this document run from backend/. -->
# Voice cloning preset substitution — 2026-10-11

The installed ElevenLabs Python SDK is 2.68.0. The old worker called
`client.voices.add`, which does not exist in that SDK. Its exception handler then
saved Rachel (`21m00Tcm4TlvDq8ikWAM`) as `voice_clone_id`, reported a successful
clone, and assigned a fabricated quality score. Chat faithfully used that saved
preset ID. This was a cloning failure concealed as success.

The corrected worker uses `client.voices.ivc.create`. With this SDK, omitted
labels are serialized incorrectly for the service; explicitly passing `labels={}`
fixes the live `invalid_labels` error. A serialized JSON string is also incorrect
because the SDK serializes it again. Files and handles are cleaned up on all
paths. Missing downloads, invalid responses, and verification requirements are
reported as failures. No preset is substituted, and no similarity score is
invented. Chat rejects the known legacy preset and stale queued voice IDs.
Cached responses now include the voice ID and use a new namespace so older
preset audio is not reused after a re-clone.

## Verification

- `../.venv/bin/python manage.py test apps.ai_processing --settings=config.settings_test --noinput`
- SDK multipart request tested with an HTTP mock transport, including labels and sample bytes.
- Live IVC test used `media/storage/recordings/1c1053b1-f1f0-405f-994a-6a6196182108/combined_20260609_163133.mp3` (356.64 seconds).
- ElevenLabs created `gvnkFW0f6g9avsqNp0PV`, confirmed category `cloned`, and returned a 75,276-byte MP3 preview with `eleven_v3`, stability 0.75 and similarity boost 0.85.
- Preview and API result are saved under `artifacts/voice-cloning/` (ignored local artifacts).
- The other local recording is 10.86 seconds, below this application's 60-second minimum. Recordings from different users were not combined.

This confirms the correct voice identity and functioning API flow. Perceptual
similarity has not been measured; a successful IVC response is not a guarantee
of an exact acoustic match.

## Apply to the application

The configured Supabase PostgreSQL connection was rejected with `ENOTFOUND: tenant/user not found` during verification. Restore the correct connection URL for an active project before applying the migration.
No live user configuration was modified, and the diagnostic voice was not
assigned to a user. The new diagnostic voice remains in the ElevenLabs account
as “VoiceVault diagnostic” for comparison with the saved preview.

Once database access is restored:

1. Install the updated requirements and stop the old Celery voice workers.
2. Run `../.venv/bin/python manage.py migrate` against the intended application database.
3. Restart the backend and Celery workers with this code.
4. Retry voice cloning for affected users through the existing processing flow.

Migration `0002_remove_preset_voice_fallback` clears Rachel substitutions,
resets their AI-ready state, and marks the old successful clone tasks as failed.
It preserves real clone IDs. Re-cloning should generate new chat audio;
previous conversation MP3s still contain whatever voice originally generated
them.

Official API reference: https://elevenlabs.io/docs/api-reference/voices/ivc/create

## Accent fidelity follow-up

The user rejected the initial preview because its accent differed from the
recording. API success and `category=cloned` are not fidelity acceptance criteria.
The initial preview is not approved for voice likeness.

The first 20 seconds of the original recording were extracted to
`artifacts/voice-cloning/source-comparison.mp3`. ElevenLabs Scribe v2 identified
English and transcribed the source passage; no language was forced. OpenAI
transcription could not run because the configured account has no credits.

Three bounded comparison samples repeat the opening sentence using the same
clone ID, seed 42, stability 0.75, and similarity boost 0.95, across `eleven_v3`,
`eleven_multilingual_v2`, and `eleven_v4`. All generated successfully. Their MP3s
and parameters are in `artifacts/voice-cloning/accent-comparison*`. The
similarity-boost parameter is a synthesis control, not a measured likeness score.
No model was selected as best; listening acceptance remains outstanding.

The live ElevenLabs account reports `starter` and
`can_use_professional_voice_cloning=False`. Professional cloning cannot be
completed with the current account and these recordings: it needs a plan with
PVC access, at least 30 minutes of suitable speech from the same speaker, and
speaker verification. Neither IVC nor PVC guarantees a 10/10 acoustic match.
