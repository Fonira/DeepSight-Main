# TTS Provider Policy

**Status** : Active — Phase 7 of the Mistral-First migration (2026-05-02)
**Spec source** : `01-Projects/DeepSight/Specs/2026-05-02-mistral-first-migration-design.md`

This document formalises which TTS provider DeepSight uses for which surface,
and pins the choice technically so accidental migrations cannot regress the
real-time voice experience.

---

## Quick Voice Call (real-time conversational voice)

**Provider unique : ElevenLabs `eleven_flash_v2_5`** (or other `eleven_*`
variants — Turbo, Multilingual — at the user's preference, all served by
ElevenLabs Conversational AI).

### Reasons

- Latency < 200ms (critical for real-time conversation — Flash v2.5 hits
  ~150ms first-byte, Turbo v2.5 ~300ms).
- Premium voices already catalogued in Voice Packs (PR #29
  `elevenlabs-voice-packs`, mergée prod 2026-04).
- ElevenLabs Conversational AI handles STT + LLM streaming + TTS as a single
  agent loop — replacing it would require rebuilding turn-taking, VAD,
  interruption handling, LiveKit JWT signaling, etc.
- No migration is planned in the current roadmap.

### Files concerned

- `backend/src/voice/router.py` — the `/api/voice/*` endpoints (notably
  `POST /api/voice/session` and the companion / debate session creators).
  Provider is structurally pinned: the route invokes
  `voice.elevenlabs.ElevenLabsClient` directly. There is no multi-provider
  selector here.
- `backend/src/voice/elevenlabs.py` — `ElevenLabsClient.create_conversation_agent()`
  hardcodes the ElevenLabs API base URL (`api.elevenlabs.io/v1`) and the
  default model `eleven_flash_v2_5`. The HARD-PIN guard is implemented here
  and in the session-creation site.
- `backend/src/voice/schemas.py` — `VoicePreferencesRequest.voice_chat_model`
  Pydantic validator restricts user-selectable models to
  `{eleven_multilingual_v2, eleven_turbo_v2_5, eleven_flash_v2_5}`. Any other
  value raises 422.
- `backend/src/tts/providers.py` — block `ElevenLabsTTSProvider` (around
  L67-L157) covers the **non-conversational** TTS path; the voice-call path
  does not transit through `tts/providers.py`.

### Rule

**Do not migrate `/api/voice/*` (Quick Voice Call, Voice Companion, Debate
voice) routes to another TTS provider without explicit product validation.**
Voxtral TTS is excluded from this surface. Any contributor proposing such a
migration must:

1. Demonstrate p95 first-byte latency ≤ 200ms on French + English under load.
2. Re-cap voices in Voice Packs and ensure premium parity.
3. Ship a feature flag with instant rollback to ElevenLabs.

---

## Async TTS / audio summaries (future)

**Candidate provider : Voxtral TTS (`voxtral-mini-tts-2603`)** — Mistral AI's
TTS model — for cost reduction.

- Implementation already drafted in
  `backend/src/tts/providers.py::VoxtralTTSProvider` (secondary in the
  fallback chain). Used today only when ElevenLabs is unavailable AND the
  Voxtral voice IDs are configured.
- **Out of scope for the Mistral-First v1 migration.** A dedicated sprint
  will:
  - Pre-create Voxtral voices via the Mistral Voices API.
  - Calibrate quality vs ElevenLabs on French audio summaries.
  - Decide whether to flip Voxtral to primary on `POST /api/tts/summary/*`
    only (keeping voice-call untouched).

---

## Generic / non-conversational TTS (current production)

Routes : `POST /api/tts`, `POST /api/tts/summary/{summary_id}`,
`POST /api/tts/dub/{summary_id}`.

Multi-provider chain via `tts.providers.get_tts_provider()`:

- **Primary** : ElevenLabs `eleven_multilingual_v2` (highest quality, all
  languages).
- **Secondary** : Voxtral `voxtral-mini-tts-2603` (only when configured).
- **Fallback** : OpenAI `tts-1` (when ElevenLabs circuit breaker is open and
  Voxtral is unavailable).

The fallback chain is unchanged by the Mistral-First v1 migration.

---

## Mistral-First migration context

Phase 7 of the migration (this document) makes the policy explicit and adds
a technical hard-pin guard on the voice-call session-creation path so that:

- A future contributor cannot accidentally route Quick Voice Call through
  `tts.providers.get_tts_provider()` (which would let the
  Voxtral/OpenAI fallback chain handle conversational voice).
- The session creator emits the `X-TTS-Provider: elevenlabs` response header
  so observability dashboards can detect any provider anomaly.

See the migration spec for the full context:
`01-Projects/DeepSight/Specs/2026-05-02-mistral-first-migration-design.md`.
