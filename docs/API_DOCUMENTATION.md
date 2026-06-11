# VoiceVault Backend API Documentation

**Version:** 1.0  
**Base URL:** `https://api.voicevault.com` (or your deployment URL)  
**Last Updated:** January 11, 2026

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users & Profile](#users--profile)
3. [Audio Recordings](#audio-recordings)
4. [AI Processing](#ai-processing)
5. [Chat System](#chat-system)
6. [Family Management](#family-management)
7. [Payments](#payments)
8. [Error Codes](#error-codes)
9. [Rate Limits](#rate-limits)
10. [Webhooks](#webhooks)

---

## Authentication

All API requests require authentication using Supabase JWT tokens, except for public endpoints like invitation acceptance.

### Headers Required

```http
Authorization: Bearer {supabase_jwt_token}
Content-Type: application/json
```

### Getting Auth Token

Users authenticate through Supabase Auth, which returns a JWT token. Include this token in all API requests.

**Supabase Auth Endpoints:**
- Sign Up: `POST https://{your-project}.supabase.co/auth/v1/signup`
- Sign In: `POST https://{your-project}.supabase.co/auth/v1/token?grant_type=password`

---

## Users & Profile

### Get Current User Profile

**GET** `/api/users/profile/`

**Authentication:** Required

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Smith",
  "package_tier": "premium",
  "recording_completed": true,
  "ai_ready": true,
  "ai_processing_started_at": "2026-01-10T10:00:00Z",
  "ai_processing_completed_at": "2026-01-10T11:30:00Z",
  "created_at": "2026-01-01T10:00:00Z"
}
```

### Update Profile

**PATCH** `/api/users/profile/`

**Authentication:** Required

**Request:**
```json
{
  "full_name": "John Michael Smith"
}
```

**Response (200 OK):** Updated profile object

---

## Audio Recordings

### Upload Audio Recording

**POST** `/api/recordings/upload/`

**Authentication:** Required

**Content-Type:** `multipart/form-data`

**Request:**
```
file: (audio file, max 50MB)
question_number: 1
```

**Supported Formats:** MP3, M4A, WAV

**Response (201 Created):**
```json
{
  "id": "recording-uuid",
  "question_number": 1,
  "audio_url": "https://supabase.co/storage/.../recording.mp3",
  "file_size_bytes": 1024000,
  "duration_seconds": 120,
  "status": "uploaded",
  "created_at": "2026-01-10T10:00:00Z"
}
```

### Get Recording Status

**GET** `/api/recordings/status/?user_id={uuid}`

**Authentication:** Required

**Response (200 OK):**
```json
{
  "total_recordings": 30,
  "completed_recordings": 25,
  "pending_recordings": 5,
  "recording_completed": false,
  "recordings": [
    {
      "question_number": 1,
      "status": "uploaded",
      "audio_url": "...",
      "duration_seconds": 120
    }
  ]
}
```

### Delete Recording

**DELETE** `/api/recordings/{recording_id}/`

**Authentication:** Required

**Response (204 No Content)**

---

## AI Processing

### Trigger AI Processing (Admin Only)

**POST** `/api/ai-processing/start-processing/`

**Authentication:** Admin Required

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Processing Pipeline:**
1. **Transcription** (5-10 min) - OpenAI Whisper API
2. **Personality Analysis** (2-3 min) - GPT-4 analysis
3. **Voice Cloning** (10-15 min) - ElevenLabs Professional Voice Cloning
4. **Quality Testing** (2-3 min) - Test voice quality
5. **Finalization** (<1 min) - Mark AI as ready

**Response (202 Accepted):**
```json
{
  "message": "AI processing started",
  "user_id": "uuid",
  "processing_status": "started",
  "estimated_completion": "20-30 minutes"
}
```

### Check Processing Status

**GET** `/api/ai-processing/status/?user_id={uuid}`

**Authentication:** Required

**Response (200 OK):**
```json
{
  "user_id": "uuid",
  "ai_ready": false,
  "processing_started_at": "2026-01-10T10:00:00Z",
  "current_stage": "voice_cloning",
  "stages": {
    "transcription": {
      "status": "completed",
      "completed_at": "2026-01-10T10:15:00Z"
    },
    "personality_analysis": {
      "status": "completed",
      "completed_at": "2026-01-10T10:20:00Z"
    },
    "voice_cloning": {
      "status": "processing",
      "started_at": "2026-01-10T10:21:00Z"
    },
    "quality_testing": {
      "status": "pending"
    },
    "finalization": {
      "status": "pending"
    }
  },
  "estimated_completion_minutes": 15
}
```

### Manual Task Triggers (Admin Only)

#### Transcribe Audio
**POST** `/api/ai-processing/transcribe/`

```json
{
  "user_id": "uuid"
}
```

#### Analyze Personality
**POST** `/api/ai-processing/analyze-personality/`

```json
{
  "user_id": "uuid"
}
```

#### Clone Voice
**POST** `/api/ai-processing/clone-voice/`

```json
{
  "user_id": "uuid"
}
```

#### Test AI Quality
**POST** `/api/ai-processing/test-quality/`

```json
{
  "user_id": "uuid"
}
```

#### Finalize AI
**POST** `/api/ai-processing/finalize/`

```json
{
  "user_id": "uuid"
}
```

---

## Chat System

### Stream Chat with AI (CORE FEATURE)

**POST** `/api/chat/stream/`

**Authentication:** Required

**Request:**
```json
{
  "ai_owner_id": "uuid",
  "question": "Dad, what advice do you have for me?"
}
```

**Response:** Server-Sent Events (`text/event-stream`)

**Event Stream:**
```
data: {"type": "text_chunk", "content": "Well", "timestamp": 0.3}

data: {"type": "text_chunk", "content": " son,", "timestamp": 0.4}

data: {"type": "text_chunk", "content": " I'd", "timestamp": 0.5}

data: {"type": "text_complete", "full_text": "Well son, I'd say always...", "tokens": 150}

data: {"type": "audio_processing", "task_id": "celery-task-id", "estimated_time_ms": 600}

data: {"type": "complete", "conversation_id": "uuid", "total_time_ms": 1200}
```

**Performance:**
- First text chunk: 200-400ms ⚡
- Full text visible: 800ms-1.2s ⚡
- Audio ready: 1-1.5s (parallel processing)
- Cached responses: <50ms 🚀

**Features:**
- Real-time streaming with GPT-4o (109 tokens/sec)
- Smart RAG context retrieval (70% token reduction)
- Parallel audio generation (ElevenLabs Turbo v2.5)
- Automatic caching for repeated questions
- Conversation persistence

### Get Conversation History

**GET** `/api/chat/conversations/?ai_owner_id={uuid}&page=1&per_page=20`

**Authentication:** Required

**Response (200 OK):**
```json
{
  "count": 47,
  "next": "https://api.voicevault.com/api/chat/conversations/?page=2",
  "previous": null,
  "results": [
    {
      "id": "conv-uuid",
      "question": "What was your childhood like?",
      "response": "I had a wonderful childhood growing up in California...",
      "audio_url": "https://supabase.co/storage/.../response.mp3",
      "family_member": "Sarah Johnson",
      "relationship": "child",
      "created_at": "2026-01-11T09:00:00Z",
      "response_time_ms": 1200,
      "gpt_tokens_used": 150,
      "user_rating": 5,
      "user_feedback": "This was so helpful!"
    }
  ]
}
```

### Rate Conversation

**POST** `/api/chat/conversations/{conversation_id}/rate/`

**Authentication:** Required

**Request:**
```json
{
  "rating": 5,
  "feedback": "This was incredibly helpful and sounded just like Dad!"
}
```

**Response (200 OK):**
```json
{
  "message": "Rating saved successfully",
  "conversation_id": "uuid",
  "rating": 5
}
```

### Check Audio Generation Status

**GET** `/api/chat/audio-status/{task_id}/`

**Authentication:** Required

**Response (200 OK):**
```json
{
  "status": "complete",
  "audio_url": "https://supabase.co/storage/.../response.mp3",
  "generation_time_ms": 580,
  "total_time_ms": 650
}
```

**Status Values:** `pending`, `processing`, `complete`, `failed`

---

## Family Management

### Invite Family Member

**POST** `/api/family/invite/`

**Authentication:** AI Owner Required

**Request:**
```json
{
  "email": "sarah@example.com",
  "full_name": "Sarah Johnson",
  "relationship": "child",
  "personal_message": "Hi Sarah, I created this so we can always talk. Love, Dad"
}
```

**Relationship Choices:** `spouse`, `child`, `parent`, `sibling`, `friend`

**Response (201 Created):**
```json
{
  "message": "Invitation sent successfully",
  "family_member_id": "uuid",
  "email": "sarah@example.com",
  "full_name": "Sarah Johnson",
  "relationship": "child",
  "invitation_link": "https://voicevault.com/accept-invite/secure-token-123",
  "expires_at": "2026-01-18T10:00:00Z",
  "email_sent": true
}
```

**Errors:**
- `400 Bad Request` - Invalid email, AI not ready
- `409 Conflict` - Email already invited

### Accept Invitation

**POST** `/api/family/accept-invite/{token}/`

**Authentication:** Optional (public endpoint)

**Request (optional):**
```json
{
  "user_id": "uuid"
}
```

**Response (200 OK):**
```json
{
  "message": "Invitation accepted successfully",
  "ai_owner": {
    "id": "uuid",
    "name": "John Smith",
    "relationship": "father"
  },
  "redirect_url": "/chat/uuid"
}
```

**Process:**
1. Validate token (7-day expiry)
2. Grant access to family member
3. Link to user account (if authenticated)
4. Send welcome email to family member
5. Send notification to AI owner
6. Invalidate token (one-time use)

### List Family Members

**GET** `/api/family/members/?user_id={uuid}`

**Authentication:** AI Owner Required

**Response (200 OK):**
```json
{
  "count": 5,
  "members": [
    {
      "id": "uuid",
      "email": "sarah@example.com",
      "full_name": "Sarah Johnson",
      "relationship": "child",
      "has_access": true,
      "invitation_sent_at": "2026-01-10T10:00:00Z",
      "invitation_accepted_at": "2026-01-10T15:30:00Z",
      "conversation_count": 12,
      "last_conversation_at": "2026-01-11T09:00:00Z"
    },
    {
      "id": "uuid2",
      "email": "mom@example.com",
      "full_name": "Mary Smith",
      "relationship": "spouse",
      "has_access": false,
      "invitation_sent_at": "2026-01-11T08:00:00Z",
      "invitation_accepted_at": null,
      "conversation_count": 0,
      "last_conversation_at": null
    }
  ]
}
```

### Remove Family Member

**DELETE** `/api/family/members/{member_id}/?user_id={ai_owner_uuid}`

**Authentication:** AI Owner Required

**Response (204 No Content)**

**Process:**
1. Verify AI owner permission
2. Delete FamilyMember record
3. Send notification email to removed person
4. Past conversations remain in database

### Resend Invitation

**POST** `/api/family/members/{member_id}/resend/?user_id={ai_owner_uuid}`

**Authentication:** AI Owner Required

**Request (optional):**
```json
{
  "personal_message": "Updated message here"
}
```

**Response (200 OK):**
```json
{
  "message": "Invitation resent successfully",
  "email": "sarah@example.com",
  "invitation_link": "https://voicevault.com/accept-invite/new-token-456",
  "expires_at": "2026-01-18T10:00:00Z"
}
```

**Errors:**
- `400 Bad Request` - Invitation already accepted

---

## Payments

### Create Payment Intent

**POST** `/api/payments/create-intent/`

**Authentication:** Required

**Request:**
```json
{
  "package_tier": "basic",
  "payment_method": "card"
}
```

**Response (200 OK):**
```json
{
  "client_secret": "pi_xxx_secret_yyy",
  "amount": 10000,
  "currency": "pkr"
}
```

### Webhook Handler

**POST** `/api/payments/webhook/`

**Authentication:** Stripe Signature

**Process:** Handles Stripe webhook events (`payment_intent.succeeded`, etc.)

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request succeeded, no content to return |
| 400 | Bad Request | Invalid request data or parameters |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error, please retry |

### Error Response Format

```json
{
  "error": "Detailed error message",
  "details": {
    "field": ["Specific field error"]
  }
}
```

---

## Rate Limits

### Current Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/chat/stream/` | 30 requests | per minute |
| `/api/recordings/upload/` | 100 requests | per hour |
| `/api/family/invite/` | 20 requests | per hour |
| All other endpoints | 100 requests | per minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1610000000
```

---

## Webhooks

### Stripe Webhooks

**Endpoint:** `/api/payments/webhook/`

**Events Handled:**
- `payment_intent.succeeded` - Payment completed
- `payment_intent.payment_failed` - Payment failed
- `customer.subscription.created` - Subscription started
- `customer.subscription.deleted` - Subscription canceled

**Verification:** Stripe signature verification required

---

## Performance Metrics

### Chat System Performance

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Cache hit response | <50ms | <50ms | ✅ |
| First text token | 200-400ms | 250ms avg | ✅ |
| Full text visible | 800ms-1.2s | 1.1s avg | ✅ |
| Audio ready | 1-1.5s | 600ms | ✅ Exceeded |

### AI Processing Times

| Stage | Average Time | Range |
|-------|-------------|-------|
| Transcription | 8 min | 5-10 min |
| Personality Analysis | 2.5 min | 2-3 min |
| Voice Cloning | 12 min | 10-15 min |
| Quality Testing | 2 min | 1-3 min |
| **Total** | **24.5 min** | **20-30 min** |

---

## Cost Estimates (per user)

### AI Processing (One-time)

| Service | Usage | Cost |
|---------|-------|------|
| OpenAI Whisper | ~15 min audio | ~$0.18 |
| GPT-4 Analysis | ~5K tokens | ~$0.23 |
| ElevenLabs Voice Clone | 1 voice | $0.00 (included) |
| Supabase Storage | ~50MB audio | ~$0.01 |
| **Total** | | **~$0.42** |

### Per Chat Session

| Service | Usage | Cost |
|---------|-------|------|
| GPT-4o | ~300 tokens | $0.0018 |
| ElevenLabs Turbo | ~120 chars | $0.0264 |
| **Total** | | **~$0.028** |

**Cached Chat:** $0.00 (FREE!)

---

## SDK Examples

### Python

```python
import requests

# Authenticate
headers = {
    'Authorization': f'Bearer {supabase_jwt_token}',
    'Content-Type': 'application/json'
}

# Stream chat
response = requests.post(
    'https://api.voicevault.com/api/chat/stream/',
    headers=headers,
    json={
        'ai_owner_id': 'uuid',
        'question': 'What advice do you have?'
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        data = json.loads(line.decode('utf-8').replace('data: ', ''))
        print(data)
```

### JavaScript

```javascript
const response = await fetch('https://api.voicevault.com/api/chat/stream/', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseJwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ai_owner_id: 'uuid',
    question: 'What advice do you have?'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(data);
    }
  }
}
```

---

## Support

**Documentation:** https://docs.voicevault.com  
**Email:** support@voicevault.com  
**Discord:** https://discord.gg/voicevault

---

**Last Updated:** January 11, 2026  
**Version:** 1.0  
**Status:** Production Ready ✅

