# DeepSight API Reference 📡

Complete API documentation for the DeepSight backend.

**Base URL:** `https://api.deepsightsynthesis.com`

**Interactive Docs:** [Swagger UI](/docs) | [ReDoc](/redoc)

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [Videos](#videos)
- [Chat](#chat)
- [Voice](#voice)
- [Study Tools](#study-tools)
- [History](#history)
- [Billing](#billing)
- [Profile](#profile)
- [Usage & Stats](#usage--stats)
- [Error Handling](#error-handling)

---

## 🔐 Authentication

All authenticated endpoints require:

```
Authorization: Bearer <access_token>
```

### Register

Create a new user account.

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "user@example.com",
  "password": "string (min 8 chars)"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "✅ Compte créé ! Vérifiez votre email."
}
```

### Login

Authenticate and receive tokens.

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "string"
}
```

**Response:** `200 OK`

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "user@example.com",
    "plan": "free",
    "is_verified": true
  }
}
```

### Refresh Token

Get a new access token.

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ..."
}
```

**Response:** `200 OK`

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": { ... }
}
```

### Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "username": "johndoe",
  "email": "user@example.com",
  "plan": "starter",
  "credits_remaining": 2500,
  "analyses_remaining": 45,
  "is_verified": true,
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Get Quota

```http
GET /api/auth/quota
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "plan": "starter",
  "credits_used": 500,
  "credits_limit": 3000,
  "analyses_used": 15,
  "analyses_limit": 60,
  "reset_date": "2024-02-01T00:00:00Z"
}
```

### Google OAuth

```http
# Step 1: Get OAuth URL
GET /api/auth/google/login?redirect_uri=https://yourapp.com/callback

# Step 2: Exchange code for tokens
POST /api/auth/google/callback
Content-Type: application/json

{
  "code": "oauth_code_from_google",
  "redirect_uri": "https://yourapp.com/callback"
}
```

### Mobile Google OAuth

For mobile apps using expo-auth-session:

```http
POST /api/auth/google/token
Content-Type: application/json

{
  "id_token": "google_id_token_from_expo"
}
```

---

## 🎬 Videos

### Analyze Video

Start a video analysis task.

```http
POST /api/videos/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://youtube.com/watch?v=...",
  "mode": "standard",  // "accessible" | "standard" | "expert"
  "language": "fr"     // "fr" | "en"
}
```

**Response:** `202 Accepted`

```json
{
  "task_id": "abc123",
  "status": "pending",
  "message": "Analysis started"
}
```

### Check Analysis Status

Poll for task completion.

```http
GET /api/videos/status/{task_id}
Authorization: Bearer <token>
```

**Response (pending):**

```json
{
  "task_id": "abc123",
  "status": "processing",
  "progress": 45,
  "step": "Extracting concepts"
}
```

**Response (completed):**

```json
{
  "task_id": "abc123",
  "status": "completed",
  "summary_id": 456
}
```

### Get Summary

Retrieve analysis results.

```http
GET /api/videos/summary/{summary_id}
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "id": 456,
  "video_url": "https://youtube.com/watch?v=...",
  "video_title": "Video Title",
  "channel_name": "Channel Name",
  "thumbnail_url": "https://...",
  "duration_seconds": 1234,
  "summary": "# Summary\n\nMarkdown content...",
  "concepts": [
    {
      "name": "Concept Name",
      "definition": "Brief definition",
      "category": "science",
      "epistemic_status": "SOLID"
    }
  ],
  "epistemic_markers": {
    "SOLID": 5,
    "PLAUSIBLE": 3,
    "UNCERTAIN": 2,
    "TO_VERIFY": 1
  },
  "mode": "standard",
  "language": "fr",
  "credits_used": 45,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Get Concepts

```http
GET /api/videos/concepts/{summary_id}
Authorization: Bearer <token>
```

### Get Enriched Concepts

Concepts with additional context and sources.

```http
GET /api/videos/concepts/{summary_id}/enriched
Authorization: Bearer <token>
```

### Toggle Favorite

```http
POST /api/videos/summary/{summary_id}/favorite
Authorization: Bearer <token>
```

### Update Notes

```http
PUT /api/videos/summary/{summary_id}/notes
Authorization: Bearer <token>
Content-Type: application/json

{
  "notes": "My personal notes about this video..."
}
```

### Update Tags

```http
PUT /api/videos/summary/{summary_id}/tags
Authorization: Bearer <token>
Content-Type: application/json

{
  "tags": ["science", "physics", "quantum"]
}
```

### Delete Summary

```http
DELETE /api/videos/summary/{summary_id}
Authorization: Bearer <token>
```

### Estimate Credits

Get credit cost before analysis.

```http
POST /api/videos/estimate-credits
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://youtube.com/watch?v=...",
  "mode": "standard"
}
```

**Response:**

```json
{
  "estimated_credits": 42,
  "video_duration_seconds": 1800,
  "mode": "standard"
}
```

---

## 💬 Chat

### Ask Question

Ask about an analyzed video.

```http
POST /api/chat/ask
Authorization: Bearer <token>
Content-Type: application/json

{
  "summary_id": 456,
  "question": "What are the main arguments?",
  "enrichment_level": "standard"  // "basic" | "standard" | "deep"
}
```

**Response:** `200 OK`

```json
{
  "response": "The main arguments presented are...",
  "sources_used": true,
  "web_search_used": false,
  "fact_checked": true,
  "credits_used": 5
}
```

### Ask Question (Streaming)

Real-time streaming response.

```http
POST /api/chat/ask/stream
Authorization: Bearer <token>
Content-Type: application/json

{
  "summary_id": 456,
  "question": "Explain the concept in detail"
}
```

**Response:** `text/event-stream`

```
data: {"chunk": "The concept"}
data: {"chunk": " refers to"}
data: {"chunk": " a fundamental..."}
data: {"done": true, "credits_used": 8}
```

### Get Chat History

Returns the unified text + voice timeline for a video, ordered by `created_at ASC`.

```http
GET /api/chat/history/{summary_id}
Authorization: Bearer <token>
```

**Response:** (Spec #1 unified schema — `source`, `voice_speaker`, `voice_session_id`, `time_in_call_secs` populated when applicable)

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What are the main points?",
      "source": "text",
      "created_at": "2024-01-15T11:00:00Z"
    },
    {
      "role": "assistant",
      "content": "The main points are...",
      "source": "text",
      "web_search_used": false,
      "fact_checked": true,
      "created_at": "2024-01-15T11:00:05Z"
    },
    {
      "role": "user",
      "content": "Can you go deeper on point 3?",
      "source": "voice",
      "voice_speaker": "user",
      "voice_session_id": "vs_abc123",
      "time_in_call_secs": 15.4,
      "created_at": "2024-01-15T11:01:30Z"
    },
    {
      "role": "assistant",
      "content": "Sure — the third point argues that...",
      "source": "voice",
      "voice_speaker": "agent",
      "voice_session_id": "vs_abc123",
      "time_in_call_secs": 22.1,
      "created_at": "2024-01-15T11:01:35Z"
    }
  ]
}
```

> **Note:** voice rows are excluded from `check_chat_quota` (text quota is preserved across voice usage).

### Delete Chat History

```http
DELETE /api/chat/history/{summary_id}
Authorization: Bearer <token>
```

---

## 🎙️ Voice

ElevenLabs voice agent integration — bidirectional sync between text chat and voice calls. Voice rows persist into the same `chat_messages` table as text (Spec #1 unified timeline).

### Create Voice Session

```http
POST /api/voice/session
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body:**

```json
{
  "summary_id": 42,
  "agent_type": "explorer",
  "language": "fr"
}
```

**Fields:**

- `summary_id` (int, optional) — required for `explorer`/`debate_moderator`/`tutor`/`quiz_coach`/`onboarding`. Optional for `companion` (free-form chat without video context).
- `debate_id` (int, optional) — XOR with `summary_id`; pass exactly one (or none for `companion`).
- `agent_type` (string) — one of `explorer`, `tutor`, `debate_moderator`, `quiz_coach`, `onboarding`, `companion`.
- `language` (string) — `fr` or `en`.

**Response:**

```json
{
  "session_id": "vs_abc123",
  "agent_id": "agent_xyz",
  "signed_url": "wss://api.elevenlabs.io/v1/convai/conversation?...",
  "conversation_token": "...",
  "expires_at": "2026-04-26T12:00:00Z"
}
```

**Errors:**

- `400 summary_required` — `agent_type` requires a video, but `summary_id` is missing.
- `403` — voice chat not available on your plan (Pro+ required).
- `429 voice_quota_exceeded` — monthly voice minutes used up.

### Append Transcript Turn

Persist a transcript turn from the live ElevenLabs conversation into the unified chat timeline. Called from the frontend on every `onMessage` event of the SDK.

```http
POST /api/voice/transcripts/append
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body:**

```json
{
  "voice_session_id": "vs_abc123",
  "speaker": "user",
  "content": "What does the speaker mean by X?",
  "time_in_call_secs": 15.4
}
```

**Fields:**

- `voice_session_id` (string, required) — must belong to the authenticated user (404 otherwise).
- `speaker` (`"user"` | `"agent"`) — server maps to `role` (`user`→`user`, `agent`→`assistant`).
- `content` (string) — transcript text.
- `time_in_call_secs` (float, optional) — offset within the call.

**Response:**

```json
{
  "id": 12345,
  "created": true,
  "voice_session_id": "vs_abc123"
}
```

`created=false` indicates a 60-second dedup hit (same `voice_session_id` + `role` + `content` already persisted).

**Errors:**

- `404 voice_session_not_found` — session missing OR not owned by current user (IDOR-safe; identical response either way).
- `429` — rate-limit exceeded (60 appends/min per session).
- `422` — `speaker` must be `"user"` or `"agent"`.

### ElevenLabs Webhook (post-call)

Receives the final transcript from ElevenLabs at end-of-call. Reconciles drift with real-time appends (e.g., if a network blip dropped a turn). HMAC-SHA256 signature verified via `ELEVENLABS_WEBHOOK_SECRET`.

```http
POST /api/voice/webhook
X-Elevenlabs-Signature: <hmac-sha256>
Content-Type: application/json
```

The webhook is internal; clients do not call it directly. It writes any missing rows from the canonical transcript when drift > 30% (using `difflib.SequenceMatcher.ratio`).

### Voice Configuration

Set these env vars on the backend:

```env
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_TEMPLATE_ID=...
ELEVENLABS_WEBHOOK_SECRET=...
ELEVENLABS_VOICE_ID=...                    # default voice (Rachel)
ELEVENLABS_COMPANION_VOICE_ID=...          # optional override for companion agent
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

If `ELEVENLABS_COMPANION_VOICE_ID` is empty, the companion agent falls back to `ELEVENLABS_VOICE_ID`.

---

## 📚 Study Tools

### Generate Quiz

```http
POST /api/study/quiz/{summary_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "num_questions": 10,
  "difficulty": "medium"  // "easy" | "medium" | "hard"
}
```

**Response:**

```json
{
  "questions": [
    {
      "question": "What is the main thesis?",
      "options": ["A", "B", "C", "D"],
      "correct_answer": 0,
      "explanation": "The video states that..."
    }
  ],
  "credits_used": 15
}
```

### Generate Mind Map

```http
POST /api/study/mindmap/{summary_id}
Authorization: Bearer <token>
```

**Response:**

```json
{
  "nodes": [
    { "id": "1", "label": "Main Topic", "level": 0 },
    { "id": "2", "label": "Subtopic 1", "level": 1, "parent": "1" }
  ],
  "edges": [{ "from": "1", "to": "2" }],
  "credits_used": 10
}
```

### Generate Flashcards

```http
POST /api/study/flashcards/{summary_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "num_cards": 20
}
```

**Response:**

```json
{
  "cards": [
    {
      "front": "What is X?",
      "back": "X is defined as...",
      "difficulty": "medium"
    }
  ],
  "credits_used": 12
}
```

### Generate All Study Materials

```http
POST /api/study/all/{summary_id}
Authorization: Bearer <token>
```

---

## 📜 History

### Get Analysis History

```http
GET /api/history?page=1&limit=20&search=quantum
Authorization: Bearer <token>
```

**Query Parameters:**

- `page` — Page number (default: 1)
- `limit` — Items per page (default: 20, max: 100)
- `search` — Search in titles
- `category` — Filter by category
- `favorite` — Filter favorites only (boolean)

**Response:**

```json
{
  "items": [...],
  "total": 45,
  "page": 1,
  "pages": 3,
  "has_next": true,
  "has_prev": false
}
```

### Get Categories

```http
GET /api/videos/categories
Authorization: Bearer <token>
```

### Get Stats

```http
GET /api/videos/stats
Authorization: Bearer <token>
```

**Response:**

```json
{
  "total_analyses": 45,
  "total_duration_watched": 86400,
  "favorite_count": 12,
  "category_breakdown": {
    "science": 15,
    "technology": 20,
    "other": 10
  }
}
```

### Clear All History

```http
DELETE /api/videos/history
Authorization: Bearer <token>
```

---

## 💳 Billing

### Get Plans

```http
GET /api/billing/plans
```

**Response:**

```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "analyses_limit": 3,
      "credits_limit": 150,
      "features": ["Basic analysis", "3-day history"]
    },
    {
      "id": "starter",
      "name": "Starter",
      "price": 5.99,
      "analyses_limit": 60,
      "credits_limit": 3000,
      "features": ["Extended videos", "Exports", "60-day history"]
    }
  ]
}
```

### Get Billing Info

```http
GET /api/billing/info
Authorization: Bearer <token>
```

### Create Checkout Session

```http
POST /api/billing/create-checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan_id": "starter",
  "success_url": "https://yourapp.com/success",
  "cancel_url": "https://yourapp.com/cancel"
}
```

**Response:**

```json
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

### Get Customer Portal

```http
GET /api/billing/portal
Authorization: Bearer <token>
```

### Check Trial Eligibility

```http
GET /api/billing/trial-eligibility
Authorization: Bearer <token>
```

### Start Pro Trial

```http
POST /api/billing/start-pro-trial
Authorization: Bearer <token>
```

---

## 👤 Profile

### Get Profile

```http
GET /api/profile
Authorization: Bearer <token>
```

### Update Profile

```http
PUT /api/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newusername",
  "preferences": {
    "default_mode": "standard",
    "default_language": "fr",
    "theme": "dark"
  }
}
```

### Upload Avatar

```http
POST /api/profile/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image file>
```

### Delete Avatar

```http
DELETE /api/profile/avatar
Authorization: Bearer <token>
```

---

## 📊 Usage & Stats

### Get Usage Stats

```http
GET /api/usage/stats
Authorization: Bearer <token>
```

**Response:**

```json
{
  "current_period": {
    "credits_used": 1500,
    "credits_limit": 3000,
    "analyses_used": 25,
    "analyses_limit": 60
  },
  "all_time": {
    "total_analyses": 150,
    "total_credits_used": 12500
  }
}
```

### Get Cost Details

```http
GET /api/usage/costs
Authorization: Bearer <token>
```

### Get Transactions

```http
GET /api/usage/transactions?limit=50
Authorization: Bearer <token>
```

---

## 🔔 Notifications (SSE)

Real-time notifications via Server-Sent Events.

```http
GET /api/notifications/stream
Authorization: Bearer <token>
Accept: text/event-stream
```

**Events:**

```
event: analysis_complete
data: {"summary_id": 456, "title": "Video Title"}

event: credits_low
data: {"remaining": 50, "threshold": 100}
```

---

## ❌ Error Handling

### Error Response Format

```json
{
  "detail": "Error message",
  "error_code": "SPECIFIC_ERROR_CODE"
}
```

### Common HTTP Status Codes

| Code  | Meaning                              |
| ----- | ------------------------------------ |
| `200` | Success                              |
| `201` | Created                              |
| `202` | Accepted (async task started)        |
| `400` | Bad Request (validation error)       |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found                            |
| `429` | Too Many Requests (rate limit)       |
| `500` | Internal Server Error                |

### Error Codes

| Code                     | Description                 |
| ------------------------ | --------------------------- |
| `EMAIL_NOT_VERIFIED`     | Email verification required |
| `INSUFFICIENT_CREDITS`   | Not enough credits          |
| `QUOTA_EXCEEDED`         | Monthly limit reached       |
| `PLAN_REQUIRED`          | Feature requires upgrade    |
| `SESSION_EXPIRED`        | Token/session invalid       |
| `VIDEO_TOO_LONG`         | Video exceeds plan limit    |
| `TRANSCRIPT_UNAVAILABLE` | No captions available       |

---

## 🔧 Rate Limits

| Plan    | Requests/min | Concurrent Analyses |
| ------- | ------------ | ------------------- |
| Free    | 30           | 1                   |
| Student | 60           | 2                   |
| Starter | 60           | 2                   |
| Pro     | 120          | 5                   |
| Team    | 300          | 10                  |

---

## 📝 Notes

- All timestamps are in ISO 8601 format (UTC)
- All text content supports Markdown
- Request body should be JSON (`Content-Type: application/json`)
- Maximum request size: 10MB (for avatar uploads)
