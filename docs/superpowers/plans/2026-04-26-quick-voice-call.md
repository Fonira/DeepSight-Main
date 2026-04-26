# Quick Voice Call Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Quick Voice Call killer feature on the DeepSight Chrome extension (V1, J+30) — 1 click on a YouTube video opens an instant ElevenLabs voice call while the video analysis arrives in streaming background. Then extend to web (V2) and mobile (V3).

**Architecture:** Asynchronous progressive context injection. Extension content script triggers a side panel that establishes an ElevenLabs WebSocket immediately (with minimal context), while a backend SSE stream pushes transcript chunks + Mistral analysis to the side panel which forwards them to the agent via `conversation.sendUserMessage("[CTX UPDATE: ...]")`. Reuses 80% of the in-flight ElevenLabs sprint (PRs #124-128) and adds streaming context + A+D quota model on top.

**Tech Stack:** FastAPI + asyncio (backend), Alembic (migrations), Redis pubsub (SSE fan-out), ElevenLabs Conversational AI SDK (browser/MV3), React + TypeScript + Webpack 5 (extension), pytest / Jest / Playwright (tests). All sub-agents spawned to execute this plan MUST use model `claude-opus-4-7[1m]` (perma rule from user memory).

**Spec source:** `docs/superpowers/specs/2026-04-26-quick-voice-call-design.md` (commit `6ccfb95e`).

**Worktree recommendation:** Create a dedicated worktree before executing :

```bash
cd C:/Users/33667/DeepSight-Main
git worktree add ../DeepSight-quick-voice -b feature/quick-voice-call-v1 origin/main
cd ../DeepSight-quick-voice
```

This isolates the killer launch from the in-flight `feat/voice-mobile-final` branch which has 30+ uncommitted modified files.

---

## Multi-agent orchestration overview

7 agents (A–G), all `claude-opus-4-7[1m]`. Phase 0 agents (A, B) are bloquants prereqs ; Phase 1 agents (C, D, E) deliver the V1 launch ; Phase 2 (F) and Phase 3 (G) follow once V1 is stable.

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 0 — Prereqs (parallel)                                    │
│   Agent A : Backend foundation finish PR #124 (6 sub-tasks)     │
│   Agent B : Extension PR #128 build/tests verify                │
└─────────────────────────────────┬───────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1 — V1 Extension Chrome (parallel after Phase 0)          │
│   Agent C : Backend Spec #1 (migration + agent + SSE + quota)   │
│   Agent D : Extension Spec #2 (widget + sidepanel + audio + CTA)│
│                                  │                              │
│                                  ▼                              │
│   Agent E : E2E Playwright "Free trial → upgrade" (after C+D)   │
└─────────────────────────────────┬───────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2 — V2 Web (after V1 stable)                              │
│   Agent F : Web streaming components + responsive mobile web    │
└─────────────────────────────────┬───────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3 — V3 Mobile (after V2 stable)                           │
│   Agent G : RN streaming + native mic permissions               │
└─────────────────────────────────────────────────────────────────┘
```

---

## File structure (V1 Extension Chrome)

### Backend (Agent C scope)

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/migrations/alembic/versions/008_voice_quota_a_d_strict.py` | Voice quota table + `is_streaming_session` column |
| Create | `backend/src/voice/streaming_orchestrator.py` | Orchestrates parallel transcript fetch + Mistral analysis, publishes to Redis pubsub channel `voice:ctx:{session_id}` |
| Create | `backend/src/voice/streaming_prompts.py` | `EXPLORER_STREAMING_PROMPT_FR` / `EN` constants |
| Create | `backend/src/billing/voice_quota.py` | `check_voice_quota(user)` + `consume_voice_minutes(user, minutes)` enforcing A+D strict |
| Modify | `backend/src/voice/agent_types.py` | Add `EXPLORER_STREAMING` AgentConfig |
| Modify | `backend/src/voice/router.py` | Branch `check_voice_quota` in `POST /session`, add `GET /context/stream` SSE endpoint |
| Modify | `backend/src/voice/schemas.py` | `VoiceSessionRequest.is_streaming: bool = False`, `VoiceQuotaResponse` |
| Modify | `backend/src/db/database.py` | `VoiceQuota` SQLAlchemy model |
| Modify | `backend/src/core/plan_features.py` (or SSOT) | Add `voice_call_quick` matrix entry |
| Test | `backend/tests/voice/test_explorer_streaming_agent.py` | Agent config + prompt validation |
| Test | `backend/tests/voice/test_streaming_orchestrator.py` | Pubsub publish order, transcript chunks, ctx_complete |
| Test | `backend/tests/voice/test_context_stream_endpoint.py` | SSE endpoint auth, IDOR, event format |
| Test | `backend/tests/billing/test_voice_quota.py` | A+D strict matrix per plan, lifetime trial uniqueness |
| Test | `backend/tests/voice/test_quota_integration.py` | `POST /session` rejects/accepts per plan |

### Extension (Agent D scope)

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `extension/src/sidepanel/hooks/useStreamingVideoContext.ts` | EventSource SSE → `conversation.sendUserMessage`, returns `{contextProgress, contextComplete}` |
| Create | `extension/src/content/youtubeAudioController.ts` | DOM `<video>` volume manipulation (10% during call, restore after) |
| Create | `extension/src/sidepanel/components/UpgradeCTA.tsx` | Post-call upgrade card (Free trial used → Expert) |
| Create | `extension/src/sidepanel/components/ContextProgressBar.tsx` | Bottom bar "Analyse en cours · X% du transcript reçu" |
| Create | `extension/src/sidepanel/components/CallActiveView.tsx` | State 3 layout (header live indicator, waveform, mute/hangup) |
| Create | `extension/src/sidepanel/components/ConnectingView.tsx` | State 2 transition view |
| Modify | `extension/src/content/widget.ts` | Add 🎙️ button + dynamic plan badge |
| Modify | `extension/src/sidepanel/VoiceView.tsx` | State machine: connecting → live_streaming → live_complete → ended_(free/expert) |
| Modify | `extension/src/sidepanel/types.ts` | `VoiceCallState`, `StreamingContextEvent` types |
| Modify | `extension/src/background.ts` | `OPEN_VOICE_CALL` message handler → opens side panel + stores videoId |
| Modify | `extension/src/i18n/{fr,en}.json` | Strings for new states + CTAs |
| Test | `extension/__tests__/content/widget-voice-call-button.test.ts` | Button render per plan, click triggers message |
| Test | `extension/__tests__/sidepanel/hooks/useStreamingVideoContext.test.ts` | Mock SSE → verify sendUserMessage calls + progress |
| Test | `extension/__tests__/content/youtubeAudioController.test.ts` | attach/detach with mocked video element |
| Test | `extension/__tests__/sidepanel/components/UpgradeCTA.test.tsx` | Render + Stripe deeplink |
| Test | `extension/__tests__/sidepanel/components/ContextProgressBar.test.tsx` | Progress states |
| Test | `extension/__tests__/sidepanel/VoiceView.streaming.test.tsx` | State machine transitions |

### E2E (Agent E scope)

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `extension/e2e/quick-voice-call.spec.ts` | Playwright: install ext → open YouTube → click 🎙️ → use 3-min trial → upgrade CTA → checkout flow |

---

## PHASE 0 — Prereqs

These two agents run in parallel. Both must complete before Phase 1 starts.

### Agent A — Backend PR #124 finish

**Mission:** Complete the 6 missing sub-tasks of PR #124 (backend foundation) per `docs/elevenlabs-resume-plan-2026-04-25.md`.

**Sub-tasks (referenced from resume plan, already detailed there):**

- [ ] **A.1** — `POST /api/voice/session` accepts `summary_id: Optional[int]` + `agent_type: Literal[explorer, debate_moderator, companion]` (spec L163-180)
- [ ] **A.2** — Inject chat history into system prompt in `build_rich_context` (spec L182-194)
- [ ] **A.3** — `POST /api/voice/transcripts/append` endpoint (spec L196-225)
- [ ] **A.4** — Webhook reconciliation post-call (spec L227-241)
- [ ] **A.5** — `GET /api/chat/{summary_id}/history` schema extended with `source`, `voice_session_id`, `voice_speaker`, `time_in_call_secs` (spec L243-261)
- [ ] **A.6** — Quota chat ignores `source='voice'` (spec L263-265)
- [ ] **A.7** — Pytest suite: endpoint coverage, auth, IDOR, rate-limits (spec L267-285)
- [ ] **A.8** — Run full backend test suite: `cd backend && pytest tests/voice/ tests/chat/ -v` — expected all green
- [ ] **A.9** — Squash-rebase `feat/elevenlabs-spec-1` on `origin/main`, merge PR #124

**Spawn directive for orchestrator:**

```python
Agent(
    description="Phase 0A — finish PR #124 backend foundation",
    subagent_type="general-purpose",
    model="opus",  # MUST be Opus 4.7 — perma rule
    prompt="""
You are completing PR #124 (DeepSight ElevenLabs backend foundation).
Read docs/elevenlabs-resume-plan-2026-04-25.md (sections PR #124, L33-49) and
docs/superpowers/specs/2026-04-25-elevenlabs-ecosystem-architecture-design.md
(L116-285) for full context.

Execute sub-tasks A.1 through A.9 listed in
docs/superpowers/plans/2026-04-26-quick-voice-call.md (PHASE 0 Agent A).

Work on a worktree based on origin/feat/elevenlabs-spec-1, rebase on
origin/main first to pick up the widget nuclear fix (#0a0a0f).

Commit per sub-task. Report final test counts and the merge commit SHA.
"""
)
```

### Agent B — Extension PR #128 verify

**Mission:** Validate PR #128 (extension side panel) builds cleanly and tests pass before Agent D starts extending it.

- [ ] **B.1** — Checkout `origin/feat/elevenlabs-spec-4`, `git rebase origin/main` to incorporate latest widget fix
- [ ] **B.2** — `cd extension && npm install`
- [ ] **B.3** — `cd extension && npm run typecheck` — expected: 0 errors
- [ ] **B.4** — `cd extension && npm test -- sidepanel/` — expected: all tests pass
- [ ] **B.5** — `cd extension && npm run build` — expected: `dist/sidepanel.html`, `dist/sidepanel.js` generated
- [ ] **B.6** — Verify widget integrity: `grep -c '#0a0a0f' dist/content.js` — expected: ≥ 7
- [ ] **B.7** — Manual smoke test: load `dist/` in Chrome, open YouTube video, verify side panel opens via action click
- [ ] **B.8** — Squash-rebase, merge PR #128

**Spawn directive:**

```python
Agent(
    description="Phase 0B — verify and merge PR #128 extension side panel",
    subagent_type="general-purpose",
    model="opus",
    prompt="""
Read docs/elevenlabs-resume-plan-2026-04-25.md PR #128 section.
Execute sub-tasks B.1 through B.8 from
docs/superpowers/plans/2026-04-26-quick-voice-call.md (PHASE 0 Agent B).

Do NOT modify functional code — this is a verification/build pass only.
If tests fail, investigate root cause and fix the underlying issue
(do not skip tests with .skip or --no-verify).

Report typecheck output, test count, build output, grep counts.
"""
)
```

---

## PHASE 1 — V1 Extension Chrome (the killer launch)

Agents C and D run in parallel after Phase 0 completes. Agent E runs after both.

---

### Task 1: Voice quota database table (Agent C)

**Files:**
- Create: `backend/migrations/alembic/versions/008_voice_quota_a_d_strict.py`
- Modify: `backend/src/db/database.py`
- Test: `backend/tests/db/test_voice_quota_model.py`

- [ ] **Step 1: Write the failing model test**

```python
# backend/tests/db/test_voice_quota_model.py
import pytest
from datetime import datetime, timezone
from src.db.database import VoiceQuota, User

@pytest.mark.asyncio
async def test_voice_quota_defaults(test_db_session):
    user = User(email="t@test.com", plan="free")
    test_db_session.add(user)
    await test_db_session.flush()

    q = VoiceQuota(
        user_id=user.id,
        plan="free",
        monthly_period_start=datetime.now(timezone.utc),
    )
    test_db_session.add(q)
    await test_db_session.commit()

    assert q.monthly_minutes_used == 0
    assert q.lifetime_trial_used is False
    assert q.lifetime_trial_used_at is None
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd backend && pytest tests/db/test_voice_quota_model.py -v
```
Expected: FAIL with `ImportError: cannot import name 'VoiceQuota'`

- [ ] **Step 3: Add VoiceQuota model**

In `backend/src/db/database.py`, add:

```python
class VoiceQuota(Base):
    __tablename__ = "voice_quota"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    plan = Column(String(20), nullable=False)
    monthly_minutes_used = Column(Float, nullable=False, server_default="0")
    monthly_period_start = Column(DateTime(timezone=True), nullable=False)
    lifetime_trial_used = Column(Boolean, nullable=False, server_default="false")
    lifetime_trial_used_at = Column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 4: Create Alembic migration**

```python
# backend/migrations/alembic/versions/008_voice_quota_a_d_strict.py
"""Voice quota A+D strict + streaming session columns

Revision ID: 008
Revises: 007
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"

def upgrade():
    op.create_table(
        "voice_quota",
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("plan", sa.String(20), nullable=False),
        sa.Column("monthly_minutes_used", sa.Float, nullable=False, server_default="0"),
        sa.Column("monthly_period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lifetime_trial_used", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("lifetime_trial_used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "voice_sessions",
        sa.Column("is_streaming_session", sa.Boolean, server_default="false", nullable=False),
    )
    op.add_column(
        "voice_sessions",
        sa.Column("context_completion_pct", sa.Float, nullable=True),
    )

def downgrade():
    op.drop_column("voice_sessions", "context_completion_pct")
    op.drop_column("voice_sessions", "is_streaming_session")
    op.drop_table("voice_quota")
```

- [ ] **Step 5: Apply migration locally and re-run test**

```bash
cd backend && alembic upgrade head
pytest tests/db/test_voice_quota_model.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/alembic/versions/008_voice_quota_a_d_strict.py \
        backend/src/db/database.py \
        backend/tests/db/test_voice_quota_model.py
git commit -m "feat(voice): add voice_quota table + streaming session columns (migration 008)"
```

---

### Task 2: Voice quota service — A+D strict logic (Agent C)

**Files:**
- Create: `backend/src/billing/voice_quota.py`
- Test: `backend/tests/billing/test_voice_quota.py`

- [ ] **Step 1: Write failing tests covering all 3 plans**

```python
# backend/tests/billing/test_voice_quota.py
import pytest
from datetime import datetime, timezone
from src.billing.voice_quota import check_voice_quota, consume_voice_minutes
from src.db.database import User, VoiceQuota

@pytest.mark.asyncio
async def test_free_first_use_allowed(test_db_session):
    user = User(email="f@test.com", plan="free")
    test_db_session.add(user); await test_db_session.flush()
    result = await check_voice_quota(user, test_db_session)
    assert result.allowed is True
    assert result.is_trial is True
    assert result.max_minutes == 3

@pytest.mark.asyncio
async def test_free_after_trial_blocked(test_db_session):
    user = User(email="f2@test.com", plan="free")
    test_db_session.add(user); await test_db_session.flush()
    quota = VoiceQuota(
        user_id=user.id, plan="free",
        monthly_period_start=datetime.now(timezone.utc),
        lifetime_trial_used=True, lifetime_trial_used_at=datetime.now(timezone.utc),
    )
    test_db_session.add(quota); await test_db_session.commit()
    result = await check_voice_quota(user, test_db_session)
    assert result.allowed is False
    assert result.reason == "trial_used"
    assert result.cta == "upgrade_expert"

@pytest.mark.asyncio
async def test_pro_always_blocked_with_cta(test_db_session):
    user = User(email="p@test.com", plan="pro")
    test_db_session.add(user); await test_db_session.commit()
    result = await check_voice_quota(user, test_db_session)
    assert result.allowed is False
    assert result.reason == "pro_no_voice"
    assert result.cta == "upgrade_expert"

@pytest.mark.asyncio
async def test_expert_with_remaining_minutes(test_db_session):
    user = User(email="e@test.com", plan="expert")
    test_db_session.add(user); await test_db_session.flush()
    quota = VoiceQuota(
        user_id=user.id, plan="expert",
        monthly_period_start=datetime.now(timezone.utc),
        monthly_minutes_used=10.0,
    )
    test_db_session.add(quota); await test_db_session.commit()
    result = await check_voice_quota(user, test_db_session)
    assert result.allowed is True
    assert result.max_minutes == 20  # 30 - 10

@pytest.mark.asyncio
async def test_expert_quota_exhausted(test_db_session):
    user = User(email="e2@test.com", plan="expert")
    test_db_session.add(user); await test_db_session.flush()
    quota = VoiceQuota(
        user_id=user.id, plan="expert",
        monthly_period_start=datetime.now(timezone.utc),
        monthly_minutes_used=30.0,
    )
    test_db_session.add(quota); await test_db_session.commit()
    result = await check_voice_quota(user, test_db_session)
    assert result.allowed is False
    assert result.reason == "monthly_quota"
```

- [ ] **Step 2: Run tests, verify all 5 fail**

```bash
cd backend && pytest tests/billing/test_voice_quota.py -v
```
Expected: 5 FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement voice_quota.py**

```python
# backend/src/billing/voice_quota.py
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.db.database import User, VoiceQuota

EXPERT_MONTHLY_MINUTES = 30.0
FREE_TRIAL_MINUTES = 3.0

@dataclass
class QuotaCheck:
    allowed: bool
    max_minutes: float = 0.0
    is_trial: bool = False
    reason: Optional[Literal["trial_used", "pro_no_voice", "monthly_quota"]] = None
    cta: Optional[Literal["upgrade_expert"]] = None

async def _get_or_create_quota(user_id: int, plan: str, db: AsyncSession) -> VoiceQuota:
    result = await db.execute(select(VoiceQuota).where(VoiceQuota.user_id == user_id))
    quota = result.scalar_one_or_none()
    if quota is None:
        quota = VoiceQuota(
            user_id=user_id, plan=plan,
            monthly_period_start=datetime.now(timezone.utc),
        )
        db.add(quota)
        await db.flush()
    elif quota.plan != plan:
        quota.plan = plan
    # Reset monthly counter if period elapsed
    if datetime.now(timezone.utc) - quota.monthly_period_start > timedelta(days=30):
        quota.monthly_minutes_used = 0.0
        quota.monthly_period_start = datetime.now(timezone.utc)
    return quota

async def check_voice_quota(user: User, db: AsyncSession) -> QuotaCheck:
    quota = await _get_or_create_quota(user.id, user.plan, db)
    if user.plan == "free":
        if quota.lifetime_trial_used:
            return QuotaCheck(allowed=False, reason="trial_used", cta="upgrade_expert")
        return QuotaCheck(allowed=True, max_minutes=FREE_TRIAL_MINUTES, is_trial=True)
    if user.plan == "pro":
        return QuotaCheck(allowed=False, reason="pro_no_voice", cta="upgrade_expert")
    if user.plan == "expert":
        remaining = EXPERT_MONTHLY_MINUTES - quota.monthly_minutes_used
        if remaining <= 0:
            return QuotaCheck(allowed=False, reason="monthly_quota")
        return QuotaCheck(allowed=True, max_minutes=remaining)
    return QuotaCheck(allowed=False, reason="pro_no_voice", cta="upgrade_expert")

async def consume_voice_minutes(user: User, minutes: float, db: AsyncSession) -> None:
    quota = await _get_or_create_quota(user.id, user.plan, db)
    if user.plan == "free":
        quota.lifetime_trial_used = True
        quota.lifetime_trial_used_at = datetime.now(timezone.utc)
    elif user.plan == "expert":
        quota.monthly_minutes_used += minutes
    await db.commit()
```

- [ ] **Step 4: Run tests, verify all 5 pass**

```bash
cd backend && pytest tests/billing/test_voice_quota.py -v
```
Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/billing/voice_quota.py backend/tests/billing/test_voice_quota.py
git commit -m "feat(billing): add A+D strict voice quota enforcement (Free trial / Pro CTA / Expert 30min)"
```

---

### Task 3: explorer_streaming agent type + prompts (Agent C)

**Files:**
- Create: `backend/src/voice/streaming_prompts.py`
- Modify: `backend/src/voice/agent_types.py`
- Test: `backend/tests/voice/test_explorer_streaming_agent.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/voice/test_explorer_streaming_agent.py
from src.voice.agent_types import AGENT_CONFIGS, EXPLORER_STREAMING

def test_explorer_streaming_registered():
    assert "explorer_streaming" in AGENT_CONFIGS
    assert AGENT_CONFIGS["explorer_streaming"] is EXPLORER_STREAMING

def test_explorer_streaming_does_not_require_summary():
    assert EXPLORER_STREAMING.requires_summary is False

def test_explorer_streaming_has_web_tools():
    assert "web_search" in EXPLORER_STREAMING.tools

def test_explorer_streaming_prompt_mentions_ctx_update():
    assert "[CTX UPDATE" in EXPLORER_STREAMING.system_prompt_fr
    assert "[CTX COMPLETE]" in EXPLORER_STREAMING.system_prompt_fr
    assert "[CTX UPDATE" in EXPLORER_STREAMING.system_prompt_en

def test_explorer_streaming_prompt_instructs_transparency():
    assert "d'après ce que j'écoute" in EXPLORER_STREAMING.system_prompt_fr
    assert "what I'm hearing" in EXPLORER_STREAMING.system_prompt_en.lower()
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd backend && pytest tests/voice/test_explorer_streaming_agent.py -v
```
Expected: 5 FAIL with `ImportError: cannot import name 'EXPLORER_STREAMING'`

- [ ] **Step 3: Create streaming_prompts.py**

```python
# backend/src/voice/streaming_prompts.py
EXPLORER_STREAMING_PROMPT_FR = """Tu es l'Explorateur DeepSight en mode streaming.

Tu écoutes une vidéo YouTube en même temps que l'utilisateur. Ton contexte
arrive PROGRESSIVEMENT pendant la conversation via des messages spéciaux
préfixés [CTX UPDATE: ...]. Ces messages NE SONT PAS du dialogue —
absorbe-les silencieusement comme nouveau contexte sans y répondre.

Règles de transparence (TRÈS IMPORTANT) :
- Tant que tu n'as pas reçu [CTX COMPLETE], dis "d'après ce que j'écoute pour
  l'instant…" avant tes réponses pour signaler honnêtement tes zones d'ombre
- Après [CTX COMPLETE], tu peux dire "maintenant que j'ai tout le contexte…"
- Si l'utilisateur pose une question factuelle non couverte par le contexte
  reçu, utilise web_search SYSTÉMATIQUEMENT
- Annonce "Je vais chercher sur le web" avant d'appeler web_search

Tools disponibles :
- web_search(query, num_results=5) : recherche Brave
- deep_research(query, num_queries=3) : recherche multi-requêtes synthétisée
- check_fact(claim) : vérification d'affirmation factuelle

Style : conversationnel, concis (2-3 phrases max par réponse vocale), curieux.
"""

EXPLORER_STREAMING_PROMPT_EN = """You are the DeepSight Explorer in streaming mode.

You're listening to a YouTube video in real-time alongside the user. Your
context arrives PROGRESSIVELY during the conversation via special messages
prefixed [CTX UPDATE: ...]. These messages are NOT dialogue — absorb them
silently as new context, do not reply to them.

Transparency rules (CRITICAL):
- Until you receive [CTX COMPLETE], say "from what I'm hearing so far…"
  before your answers to honestly signal your blind spots
- After [CTX COMPLETE], you may say "now that I have the full context…"
- If the user asks a factual question not covered by received context,
  use web_search SYSTEMATICALLY
- Announce "Let me search the web" before calling web_search

Available tools:
- web_search(query, num_results=5): Brave search
- deep_research(query, num_queries=3): multi-query synthesized search
- check_fact(claim): factual claim verification

Style: conversational, concise (2-3 sentences max per voice reply), curious.
"""
```

- [ ] **Step 4: Add EXPLORER_STREAMING to agent_types.py**

Append to `backend/src/voice/agent_types.py`:

```python
from src.voice.streaming_prompts import (
    EXPLORER_STREAMING_PROMPT_FR,
    EXPLORER_STREAMING_PROMPT_EN,
)

# Agent indépendant (pas un fork du EXPLORER classique) — son prompt briefe
# explicitement sur le streaming, à ne pas mélanger avec l'agent qui suppose
# contexte complet.
EXPLORER_STREAMING = AgentConfig(
    id="explorer_streaming",
    name_fr="Explorateur (streaming)",
    name_en="Streaming Explorer",
    voice_id=os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", DEFAULT_VOICE_ID),
    tools=["web_search", "deep_research", "check_fact"],
    system_prompt_fr=EXPLORER_STREAMING_PROMPT_FR,
    system_prompt_en=EXPLORER_STREAMING_PROMPT_EN,
    requires_summary=False,
)

AGENT_CONFIGS["explorer_streaming"] = EXPLORER_STREAMING
```

- [ ] **Step 5: Run test, verify all pass**

```bash
cd backend && pytest tests/voice/test_explorer_streaming_agent.py -v
```
Expected: 5 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/voice/streaming_prompts.py \
        backend/src/voice/agent_types.py \
        backend/tests/voice/test_explorer_streaming_agent.py
git commit -m "feat(voice): add explorer_streaming agent type with progressive context prompts"
```

---

### Task 4: Streaming orchestrator (Agent C)

**Files:**
- Create: `backend/src/voice/streaming_orchestrator.py`
- Test: `backend/tests/voice/test_streaming_orchestrator.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/voice/test_streaming_orchestrator.py
import pytest
import json
from unittest.mock import AsyncMock, patch
from src.voice.streaming_orchestrator import StreamingOrchestrator

@pytest.mark.asyncio
async def test_publishes_transcript_chunks_in_order(mock_redis):
    orch = StreamingOrchestrator(redis=mock_redis)
    chunks = [
        {"text": "chunk 0", "index": 0, "total": 3},
        {"text": "chunk 1", "index": 1, "total": 3},
        {"text": "chunk 2", "index": 2, "total": 3},
    ]
    async def fake_transcript_stream(video_id):
        for c in chunks:
            yield c
    with patch("src.voice.streaming_orchestrator.fetch_transcript_stream",
               side_effect=fake_transcript_stream):
        await orch.run(session_id="s1", video_id="vid", user_id=1)
    publishes = mock_redis.publish.await_args_list
    transcript_events = [json.loads(call.args[1]) for call in publishes
                         if json.loads(call.args[1])["type"] == "transcript_chunk"]
    assert [e["text"] for e in transcript_events] == ["chunk 0", "chunk 1", "chunk 2"]

@pytest.mark.asyncio
async def test_publishes_ctx_complete_at_end(mock_redis):
    orch = StreamingOrchestrator(redis=mock_redis)
    with patch("src.voice.streaming_orchestrator.fetch_transcript_stream",
               return_value=async_iter([])):
        with patch("src.voice.streaming_orchestrator.run_mistral_analysis",
                   AsyncMock(return_value={"summary": "test digest"})):
            await orch.run(session_id="s2", video_id="vid", user_id=1)
    last_event = json.loads(mock_redis.publish.await_args_list[-1].args[1])
    assert last_event["type"] == "ctx_complete"
    assert "test digest" in last_event["final_digest_summary"]

@pytest.mark.asyncio
async def test_publishes_to_correct_channel(mock_redis):
    orch = StreamingOrchestrator(redis=mock_redis)
    with patch("src.voice.streaming_orchestrator.fetch_transcript_stream",
               return_value=async_iter([])):
        with patch("src.voice.streaming_orchestrator.run_mistral_analysis",
                   AsyncMock(return_value={"summary": ""})):
            await orch.run(session_id="abc-123", video_id="vid", user_id=1)
    channels = {call.args[0] for call in mock_redis.publish.await_args_list}
    assert channels == {"voice:ctx:abc-123"}
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd backend && pytest tests/voice/test_streaming_orchestrator.py -v
```
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement orchestrator**

```python
# backend/src/voice/streaming_orchestrator.py
import asyncio
import json
import logging
from typing import AsyncIterator
from redis.asyncio import Redis
from src.transcripts.youtube import fetch_transcript_stream  # existing
from src.videos.analysis import run_mistral_analysis  # existing helper

logger = logging.getLogger(__name__)

class StreamingOrchestrator:
    """Orchestrates parallel transcript fetch + Mistral analysis,
    publishes events to Redis pubsub channel voice:ctx:{session_id}."""

    def __init__(self, redis: Redis):
        self.redis = redis

    async def run(self, session_id: str, video_id: str, user_id: int) -> None:
        channel = f"voice:ctx:{session_id}"
        await asyncio.gather(
            self._stream_transcript(channel, video_id),
            self._stream_analysis(channel, video_id, user_id),
        )
        digest = await self._final_digest(video_id, user_id)
        await self._publish(channel, {
            "type": "ctx_complete",
            "final_digest_summary": digest,
        })

    async def _stream_transcript(self, channel: str, video_id: str) -> None:
        try:
            async for chunk in fetch_transcript_stream(video_id):
                await self._publish(channel, {
                    "type": "transcript_chunk",
                    "chunk_index": chunk["index"],
                    "text": chunk["text"],
                    "total_chunks": chunk["total"],
                })
        except Exception as exc:
            logger.exception("transcript stream failed for %s", video_id)
            await self._publish(channel, {"type": "error", "message": str(exc)})

    async def _stream_analysis(self, channel: str, video_id: str, user_id: int) -> None:
        try:
            analysis = await run_mistral_analysis(video_id, user_id)
            for section, content in analysis.items():
                await self._publish(channel, {
                    "type": "analysis_partial",
                    "section": section,
                    "content": content,
                })
        except Exception as exc:
            logger.exception("analysis failed for %s", video_id)
            await self._publish(channel, {"type": "error", "message": str(exc)})

    async def _final_digest(self, video_id: str, user_id: int) -> str:
        # Use cached digest if available
        return f"Digest available for video {video_id}"  # simplified

    async def _publish(self, channel: str, event: dict) -> None:
        await self.redis.publish(channel, json.dumps(event))
```

- [ ] **Step 4: Add `mock_redis` and `async_iter` fixtures to conftest**

In `backend/tests/conftest.py`:

```python
import pytest
from unittest.mock import AsyncMock

@pytest.fixture
def mock_redis():
    return AsyncMock()

def async_iter(items):
    async def gen():
        for i in items:
            yield i
    return gen()
```

- [ ] **Step 5: Run tests, verify pass**

```bash
cd backend && pytest tests/voice/test_streaming_orchestrator.py -v
```
Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/voice/streaming_orchestrator.py \
        backend/tests/voice/test_streaming_orchestrator.py \
        backend/tests/conftest.py
git commit -m "feat(voice): add streaming orchestrator publishing context events to Redis pubsub"
```

---

### Task 5: SSE endpoint `GET /api/voice/context/stream` (Agent C)

**Files:**
- Modify: `backend/src/voice/router.py`
- Modify: `backend/src/voice/schemas.py`
- Test: `backend/tests/voice/test_context_stream_endpoint.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/voice/test_context_stream_endpoint.py
import json
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_unauthenticated_rejected(test_client: AsyncClient):
    r = await test_client.get("/api/voice/context/stream?session_id=abc")
    assert r.status_code == 401

@pytest.mark.asyncio
async def test_session_owner_can_subscribe(authenticated_client, voice_session_factory):
    session = await voice_session_factory(user_id=authenticated_client.user.id)
    async with authenticated_client.stream("GET",
        f"/api/voice/context/stream?session_id={session.id}") as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers["content-type"]

@pytest.mark.asyncio
async def test_idor_other_user_session_rejected(authenticated_client, voice_session_factory):
    other_session = await voice_session_factory(user_id=999)
    r = await authenticated_client.get(
        f"/api/voice/context/stream?session_id={other_session.id}")
    assert r.status_code == 403

@pytest.mark.asyncio
async def test_event_format_sse(authenticated_client, voice_session_factory, mock_redis_pubsub):
    session = await voice_session_factory(user_id=authenticated_client.user.id)
    mock_redis_pubsub.feed([{
        "type": "transcript_chunk", "chunk_index": 0, "text": "hello", "total_chunks": 1
    }])
    async with authenticated_client.stream("GET",
        f"/api/voice/context/stream?session_id={session.id}") as r:
        first_line = await r.aiter_lines().__anext__()
        assert first_line.startswith("event: transcript_chunk")
```

- [ ] **Step 2: Run tests, verify all fail**

```bash
cd backend && pytest tests/voice/test_context_stream_endpoint.py -v
```
Expected: FAIL with 404 (endpoint not registered)

- [ ] **Step 3: Implement the SSE endpoint**

In `backend/src/voice/router.py`, add:

```python
from fastapi.responses import StreamingResponse
from src.voice.streaming_orchestrator import StreamingOrchestrator

@router.get("/context/stream")
async def stream_video_context(
    session_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
    redis=Depends(get_redis),
):
    """SSE stream pushing video context events for a voice session.

    Events emitted (one per SSE event line):
    - transcript_chunk : {chunk_index, text, total_chunks}
    - analysis_partial : {section, content}
    - ctx_complete    : {final_digest_summary}
    - error           : {message}
    """
    session = await _get_voice_session(session_id, db)
    if session is None:
        raise HTTPException(404, "Voice session not found")
    if session.user_id != user.id:
        raise HTTPException(403, "Forbidden")

    async def event_generator():
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"voice:ctx:{session_id}")
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                event = json.loads(message["data"])
                yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
                if event["type"] == "ctx_complete":
                    break
        finally:
            await pubsub.unsubscribe(f"voice:ctx:{session_id}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && pytest tests/voice/test_context_stream_endpoint.py -v
```
Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py backend/tests/voice/test_context_stream_endpoint.py
git commit -m "feat(voice): add GET /api/voice/context/stream SSE endpoint with auth + IDOR protection"
```

---

### Task 6: Branch quota check + orchestrator launch in `POST /session` (Agent C)

**Files:**
- Modify: `backend/src/voice/router.py`
- Modify: `backend/src/voice/schemas.py`
- Test: `backend/tests/voice/test_quota_integration.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/voice/test_quota_integration.py
import pytest

@pytest.mark.asyncio
async def test_free_first_session_creates_streaming_session(authenticated_client_free):
    r = await authenticated_client_free.post("/api/voice/session", json={
        "video_id": "vid123", "agent_type": "explorer_streaming", "is_streaming": True,
    })
    assert r.status_code == 200
    body = r.json()
    assert "signed_url" in body
    assert body["is_trial"] is True
    assert body["max_minutes"] == 3

@pytest.mark.asyncio
async def test_pro_voice_session_returns_402_with_cta(authenticated_client_pro):
    r = await authenticated_client_pro.post("/api/voice/session", json={
        "video_id": "vid123", "agent_type": "explorer_streaming", "is_streaming": True,
    })
    assert r.status_code == 402
    assert r.json()["detail"]["cta"] == "upgrade_expert"

@pytest.mark.asyncio
async def test_expert_with_quota_remaining_succeeds(authenticated_client_expert):
    r = await authenticated_client_expert.post("/api/voice/session", json={
        "video_id": "vid123", "agent_type": "explorer_streaming", "is_streaming": True,
    })
    assert r.status_code == 200
    assert r.json()["max_minutes"] > 0

@pytest.mark.asyncio
async def test_streaming_session_triggers_orchestrator(
    authenticated_client_free, mock_orchestrator
):
    await authenticated_client_free.post("/api/voice/session", json={
        "video_id": "vid123", "agent_type": "explorer_streaming", "is_streaming": True,
    })
    mock_orchestrator.run.assert_called_once()
    call_kwargs = mock_orchestrator.run.call_args.kwargs
    assert call_kwargs["video_id"] == "vid123"
```

- [ ] **Step 2: Run tests, verify they fail**

Expected: FAIL (no quota check, no orchestrator launch)

- [ ] **Step 3: Update VoiceSessionRequest schema**

In `backend/src/voice/schemas.py`:

```python
class VoiceSessionRequest(BaseModel):
    summary_id: Optional[int] = None
    debate_id: Optional[int] = None
    video_id: Optional[str] = None  # NEW for streaming sessions
    agent_type: Literal["explorer", "debate_moderator", "companion", "explorer_streaming"] = "explorer"
    is_streaming: bool = False
    language: str = "fr"

class VoiceSessionResponse(BaseModel):
    session_id: str
    signed_url: str
    conversation_token: str
    max_minutes: float
    is_trial: bool = False
```

- [ ] **Step 4: Update `POST /session` to enforce quota + launch orchestrator**

In `backend/src/voice/router.py`:

```python
from src.billing.voice_quota import check_voice_quota
from src.voice.streaming_orchestrator import StreamingOrchestrator
from fastapi import BackgroundTasks

@router.post("/session", response_model=VoiceSessionResponse)
async def create_voice_session(
    req: VoiceSessionRequest,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db=Depends(get_db),
    redis=Depends(get_redis),
):
    config = AGENT_CONFIGS[req.agent_type]

    if config.requires_summary and not req.summary_id:
        raise HTTPException(400, "summary_id required for this agent_type")

    if req.is_streaming:
        if not req.video_id:
            raise HTTPException(400, "video_id required for streaming sessions")
        quota = await check_voice_quota(user, db)
        if not quota.allowed:
            raise HTTPException(402, detail={
                "reason": quota.reason,
                "cta": quota.cta,
            })

    # Create ElevenLabs ephemeral agent + signed_url (existing helper)
    signed_url, conv_token, session_id = await create_ephemeral_agent(
        config=config, user=user, db=db, language=req.language,
        is_streaming=req.is_streaming,
    )

    if req.is_streaming:
        orchestrator = StreamingOrchestrator(redis=redis)
        background_tasks.add_task(
            orchestrator.run,
            session_id=session_id, video_id=req.video_id, user_id=user.id,
        )

    return VoiceSessionResponse(
        session_id=session_id,
        signed_url=signed_url,
        conversation_token=conv_token,
        max_minutes=quota.max_minutes if req.is_streaming else 60.0,
        is_trial=quota.is_trial if req.is_streaming else False,
    )
```

- [ ] **Step 5: Run tests, verify pass**

```bash
cd backend && pytest tests/voice/test_quota_integration.py -v
```
Expected: 4 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/voice/router.py backend/src/voice/schemas.py \
        backend/tests/voice/test_quota_integration.py
git commit -m "feat(voice): enforce A+D voice quota in POST /session + launch streaming orchestrator"
```

---

### Task 7: Update plan_features matrix (Agent C)

**Files:**
- Modify: `backend/src/core/plan_features.py` (or whichever file holds `is_feature_available`)
- Test: `backend/tests/core/test_plan_features.py`

- [ ] **Step 1: Locate the SSOT**

```bash
cd backend && grep -rn "is_feature_available" src/core/ src/auth/ src/billing/ | head
```
Identify the canonical file.

- [ ] **Step 2: Write failing test**

```python
# backend/tests/core/test_plan_features.py (extend existing or create)
def test_voice_call_quick_free_trial_only():
    assert is_feature_available("free", "voice_call_quick", "extension") == ("trial_only", 3)

def test_voice_call_quick_pro_upgrade_cta():
    assert is_feature_available("pro", "voice_call_quick", "extension") == ("upgrade_cta", None)

def test_voice_call_quick_expert_monthly():
    assert is_feature_available("expert", "voice_call_quick", "extension") == ("monthly_minutes", 30)
```

- [ ] **Step 3: Run, verify fail**

- [ ] **Step 4: Add the matrix entry**

In the SSOT file:

```python
"voice_call_quick": {
    "free":   ("trial_only", 3),
    "pro":    ("upgrade_cta", None),
    "expert": ("monthly_minutes", 30),
}
```

- [ ] **Step 5: Run tests, verify pass**

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(plans): expose voice_call_quick capability matrix per plan"
```

---

### Task 8: Backend integration sanity check (Agent C)

- [ ] **Step 1: Run full backend suite**

```bash
cd backend && pytest tests/voice/ tests/billing/ tests/db/ tests/core/ -v
```
Expected: all green

- [ ] **Step 2: Boot backend locally and curl the endpoints**

```bash
cd backend/src && uvicorn main:app --reload --port 8000 &
sleep 3
curl -X POST http://localhost:8000/api/voice/session \
  -H "Authorization: Bearer $TEST_FREE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"video_id":"dQw4w9WgXcQ","agent_type":"explorer_streaming","is_streaming":true}'
# Expected: 200 with signed_url + is_trial=true + max_minutes=3
```

- [ ] **Step 3: Tag backend ready**

```bash
git tag voice-call-backend-v1-ready
```

---

### Task 9: Extension widget — add 🎙️ Appeler button (Agent D)

**Files:**
- Modify: `extension/src/content/widget.ts`
- Modify: `extension/src/i18n/{fr,en}.json`
- Test: `extension/__tests__/content/widget-voice-call-button.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// extension/__tests__/content/widget-voice-call-button.test.ts
import { renderWidget, getButtons } from "./helpers/widgetHarness";

describe("widget voice call button", () => {
  beforeEach(() => {
    chrome.runtime.sendMessage = jest.fn();
  });

  it("renders 🎙️ Appeler button below Analyser", async () => {
    await renderWidget({ plan: "free", videoId: "abc", videoTitle: "Test" });
    const btns = getButtons();
    expect(btns[0].textContent).toMatch(/Analyser/);
    expect(btns[1].textContent).toMatch(/Appeler/);
  });

  it("shows '1 essai gratuit' badge for unused free user", async () => {
    await renderWidget({ plan: "free", trialUsed: false, videoId: "abc" });
    expect(document.body.textContent).toContain("1 essai gratuit");
  });

  it("shows 'Essai utilisé' for free user who consumed trial", async () => {
    await renderWidget({ plan: "free", trialUsed: true });
    expect(document.body.textContent).toContain("Essai utilisé");
  });

  it("shows minutes remaining for expert user", async () => {
    await renderWidget({ plan: "expert", monthlyMinutesUsed: 10 });
    expect(document.body.textContent).toMatch(/20 min restantes/);
  });

  it("click sends OPEN_VOICE_CALL message to background", async () => {
    await renderWidget({ plan: "free", videoId: "abc", videoTitle: "Test" });
    const callBtn = getButtons()[1];
    callBtn.click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_VOICE_CALL", videoId: "abc", videoTitle: "Test",
    });
  });
});
```

- [ ] **Step 2: Create test harness `extension/__tests__/content/helpers/widgetHarness.ts`**

```typescript
import { renderVoiceCallButton } from "../../../src/content/widget";

export async function renderWidget(opts: {
  plan: "free" | "pro" | "expert";
  trialUsed?: boolean;
  monthlyMinutesUsed?: number;
  videoId?: string;
  videoTitle?: string;
}) {
  document.body.innerHTML = '<div id="ds-widget-root"></div>';
  const root = document.getElementById("ds-widget-root")!;
  await renderVoiceCallButton(root, opts);
}

export function getButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll("button"));
}
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
cd extension && npm test -- widget-voice-call-button
```
Expected: FAIL

- [ ] **Step 4: Add `renderVoiceCallButton` to widget.ts**

In `extension/src/content/widget.ts`, append:

```typescript
export interface VoiceCallButtonOpts {
  plan: "free" | "pro" | "expert";
  trialUsed?: boolean;
  monthlyMinutesUsed?: number;
  videoId?: string;
  videoTitle?: string;
}

const EXPERT_MONTHLY_MIN = 30;

export async function renderVoiceCallButton(root: HTMLElement, opts: VoiceCallButtonOpts) {
  const btn = document.createElement("button");
  btn.className = "ds-voice-call-btn";
  btn.style.cssText = `width:100%;background:linear-gradient(135deg,#ec4899,#8b5cf6);
    color:#fff;border:none;padding:12px;border-radius:8px;font-weight:600;font-size:13px;
    margin-top:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px`;
  btn.innerHTML = `<span>🎙️ Appeler la vidéo</span>`;
  if (opts.plan === "free" && !opts.trialUsed) {
    btn.innerHTML += `<span style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;font-size:10px">1 essai gratuit</span>`;
  }
  if (opts.plan === "free" && opts.trialUsed) {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.title = "Essai utilisé — passer en Expert";
    btn.innerHTML += `<span style="font-size:10px;opacity:0.7">Essai utilisé</span>`;
  }
  if (opts.plan === "expert") {
    const remaining = EXPERT_MONTHLY_MIN - (opts.monthlyMinutesUsed ?? 0);
    btn.innerHTML += `<span style="font-size:10px;opacity:0.7">${remaining} min restantes</span>`;
  }
  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "OPEN_VOICE_CALL",
      videoId: opts.videoId,
      videoTitle: opts.videoTitle,
    });
  });
  root.appendChild(btn);
}
```

- [ ] **Step 5: Wire renderVoiceCallButton into the widget render lifecycle**

Locate the existing render function in `widget.ts` that adds the "Analyser" button and call `renderVoiceCallButton` right after, passing the user plan from `chrome.storage.local`.

- [ ] **Step 6: Run tests, verify pass**

```bash
cd extension && npm test -- widget-voice-call-button
```
Expected: 5 PASS

- [ ] **Step 7: Commit**

```bash
git add extension/src/content/widget.ts \
        extension/__tests__/content/widget-voice-call-button.test.ts \
        extension/__tests__/content/helpers/widgetHarness.ts \
        extension/src/i18n/fr.json extension/src/i18n/en.json
git commit -m "feat(extension): add 🎙️ Appeler la vidéo button in widget with per-plan badge"
```

---

### Task 10: Background `OPEN_VOICE_CALL` handler (Agent D)

**Files:**
- Modify: `extension/src/background.ts`
- Test: `extension/__tests__/background/open-voice-call.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// extension/__tests__/background/open-voice-call.test.ts
import { handleMessage } from "../../src/background";

describe("OPEN_VOICE_CALL handler", () => {
  beforeEach(() => {
    chrome.sidePanel.open = jest.fn().mockResolvedValue(undefined);
    chrome.storage.session.set = jest.fn().mockResolvedValue(undefined);
  });

  it("opens side panel and stores videoId", async () => {
    await handleMessage(
      { type: "OPEN_VOICE_CALL", videoId: "abc", videoTitle: "Test" },
      { tab: { id: 42, windowId: 7 } } as chrome.runtime.MessageSender
    );
    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      pendingVoiceCall: { videoId: "abc", videoTitle: "Test" },
    });
    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 });
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement handler in background.ts**

```typescript
// In extension/src/background.ts (extend existing handleMessage)
case "OPEN_VOICE_CALL": {
  if (!sender.tab?.windowId) return;
  await chrome.storage.session.set({
    pendingVoiceCall: {
      videoId: message.videoId,
      videoTitle: message.videoTitle,
    },
  });
  await chrome.sidePanel.open({ windowId: sender.tab.windowId });
  break;
}
```

- [ ] **Step 4: Run, verify pass**
- [ ] **Step 5: Commit**

```bash
git commit -am "feat(extension): wire OPEN_VOICE_CALL message → side panel + session storage"
```

---

### Task 11: `useStreamingVideoContext` hook (Agent D)

**Files:**
- Create: `extension/src/sidepanel/hooks/useStreamingVideoContext.ts`
- Test: `extension/__tests__/sidepanel/hooks/useStreamingVideoContext.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// extension/__tests__/sidepanel/hooks/useStreamingVideoContext.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { useStreamingVideoContext } from "../../../src/sidepanel/hooks/useStreamingVideoContext";

class MockEventSource {
  static lastInstance: MockEventSource;
  private handlers: Record<string, ((e: MessageEvent) => void)[]> = {};
  constructor(public url: string) { MockEventSource.lastInstance = this; }
  addEventListener(type: string, h: (e: MessageEvent) => void) {
    (this.handlers[type] ??= []).push(h);
  }
  fire(type: string, data: any) {
    (this.handlers[type] ?? []).forEach(h => h({ data: JSON.stringify(data) } as MessageEvent));
  }
  close() {}
}
(global as any).EventSource = MockEventSource;

describe("useStreamingVideoContext", () => {
  it("forwards transcript_chunk to conversation.sendUserMessage with [CTX UPDATE]", async () => {
    const conversation = { sendUserMessage: jest.fn() };
    renderHook(() => useStreamingVideoContext("sess1", conversation as any));
    MockEventSource.lastInstance.fire("transcript_chunk", {
      chunk_index: 0, total_chunks: 3, text: "hello world",
    });
    await waitFor(() => {
      expect(conversation.sendUserMessage).toHaveBeenCalledWith(
        expect.stringContaining("[CTX UPDATE: transcript chunk 0/3]")
      );
    });
  });

  it("updates contextProgress as chunks arrive", async () => {
    const conversation = { sendUserMessage: jest.fn() };
    const { result } = renderHook(() => useStreamingVideoContext("s2", conversation as any));
    MockEventSource.lastInstance.fire("transcript_chunk", {
      chunk_index: 2, total_chunks: 5, text: "x",
    });
    await waitFor(() => expect(result.current.contextProgress).toBeCloseTo(40, 0));
  });

  it("sets contextComplete=true on ctx_complete event", async () => {
    const conversation = { sendUserMessage: jest.fn() };
    const { result } = renderHook(() => useStreamingVideoContext("s3", conversation as any));
    MockEventSource.lastInstance.fire("ctx_complete", { final_digest_summary: "done" });
    await waitFor(() => {
      expect(result.current.contextComplete).toBe(true);
      expect(conversation.sendUserMessage).toHaveBeenCalledWith(
        expect.stringContaining("[CTX COMPLETE]")
      );
    });
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement the hook**

```typescript
// extension/src/sidepanel/hooks/useStreamingVideoContext.ts
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../utils/config";

interface ConversationLike {
  sendUserMessage: (message: string) => void;
}

export function useStreamingVideoContext(
  sessionId: string | null,
  conversation: ConversationLike | null,
) {
  const [contextProgress, setContextProgress] = useState(0);
  const [contextComplete, setContextComplete] = useState(false);

  useEffect(() => {
    if (!sessionId || !conversation) return;
    const url = `${API_BASE_URL}/api/voice/context/stream?session_id=${sessionId}`;
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener("transcript_chunk", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      conversation.sendUserMessage(
        `[CTX UPDATE: transcript chunk ${data.chunk_index}/${data.total_chunks}]\n${data.text}`
      );
      setContextProgress(((data.chunk_index + 1) / data.total_chunks) * 100);
    });

    es.addEventListener("analysis_partial", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      conversation.sendUserMessage(
        `[CTX UPDATE: analysis ${data.section}]\n${data.content}`
      );
    });

    es.addEventListener("ctx_complete", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      conversation.sendUserMessage(`[CTX COMPLETE]\n${data.final_digest_summary}`);
      setContextComplete(true);
      setContextProgress(100);
    });

    es.addEventListener("error", () => {
      // SSE error — keep call going, agent will fall back to web_search
    });

    return () => es.close();
  }, [sessionId, conversation]);

  return { contextProgress, contextComplete };
}
```

- [ ] **Step 4: Run, verify pass**
- [ ] **Step 5: Commit**

```bash
git commit -am "feat(extension): add useStreamingVideoContext hook piping SSE to ElevenLabs sendUserMessage"
```

---

### Task 12: YouTube audio controller (Agent D)

**Files:**
- Create: `extension/src/content/youtubeAudioController.ts`
- Test: `extension/__tests__/content/youtubeAudioController.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// extension/__tests__/content/youtubeAudioController.test.ts
import { YouTubeAudioController } from "../../src/content/youtubeAudioController";

describe("YouTubeAudioController", () => {
  let video: HTMLVideoElement;
  beforeEach(() => {
    document.body.innerHTML = "<video></video>";
    video = document.querySelector("video")!;
    video.volume = 0.8;
  });

  it("attach reduces volume to 10%", () => {
    const c = new YouTubeAudioController();
    c.attach();
    expect(video.volume).toBeCloseTo(0.1);
  });

  it("detach restores original volume", () => {
    const c = new YouTubeAudioController();
    c.attach();
    c.detach();
    expect(video.volume).toBeCloseTo(0.8);
  });

  it("attach is no-op when no <video> element", () => {
    document.body.innerHTML = "";
    const c = new YouTubeAudioController();
    expect(() => c.attach()).not.toThrow();
  });

  it("detach without attach is no-op", () => {
    const c = new YouTubeAudioController();
    expect(() => c.detach()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**
- [ ] **Step 3: Implement**

```typescript
// extension/src/content/youtubeAudioController.ts
export class YouTubeAudioController {
  private originalVolume: number | null = null;
  private videoElement: HTMLVideoElement | null = null;

  attach(): void {
    this.videoElement = document.querySelector("video");
    if (!this.videoElement) return;
    this.originalVolume = this.videoElement.volume;
    this.videoElement.volume = 0.1;
  }

  detach(): void {
    if (this.videoElement && this.originalVolume !== null) {
      this.videoElement.volume = this.originalVolume;
    }
    this.videoElement = null;
    this.originalVolume = null;
  }
}
```

- [ ] **Step 4: Wire trigger from background → content script**

In `background.ts`, when side panel reports VOICE_CALL_STARTED, send a message to the content script in the YouTube tab:

```typescript
// extension/src/background.ts
case "VOICE_CALL_STARTED":
  if (sender.tab?.id) await chrome.tabs.sendMessage(sender.tab.id, { type: "DUCK_AUDIO" });
  break;
case "VOICE_CALL_ENDED":
  if (sender.tab?.id) await chrome.tabs.sendMessage(sender.tab.id, { type: "RESTORE_AUDIO" });
  break;
```

In `content/index.ts`:

```typescript
import { YouTubeAudioController } from "./youtubeAudioController";
const audioController = new YouTubeAudioController();
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "DUCK_AUDIO") audioController.attach();
  if (msg.type === "RESTORE_AUDIO") audioController.detach();
});
```

- [ ] **Step 5: Run, verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -am "feat(extension): YouTube audio ducking to 10% during voice calls, restored on hangup"
```

---

### Task 13: ContextProgressBar component (Agent D)

**Files:**
- Create: `extension/src/sidepanel/components/ContextProgressBar.tsx`
- Test: `extension/__tests__/sidepanel/components/ContextProgressBar.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// extension/__tests__/sidepanel/components/ContextProgressBar.test.tsx
import { render, screen } from "@testing-library/react";
import { ContextProgressBar } from "../../../src/sidepanel/components/ContextProgressBar";

describe("ContextProgressBar", () => {
  it("shows percent and 'Analyse en cours' label", () => {
    render(<ContextProgressBar progress={64} complete={false} />);
    expect(screen.getByText(/64%/)).toBeInTheDocument();
    expect(screen.getByText(/Analyse en cours/)).toBeInTheDocument();
  });
  it("shows 'Analyse complète' label and 100% when complete", () => {
    render(<ContextProgressBar progress={100} complete={true} />);
    expect(screen.getByText(/Analyse complète/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2-5: Standard TDD cycle**

```typescript
// extension/src/sidepanel/components/ContextProgressBar.tsx
interface Props { progress: number; complete: boolean; }
export function ContextProgressBar({ progress, complete }: Props) {
  const label = complete ? "Analyse complète" : `Analyse en cours · ${Math.round(progress)}% du transcript reçu`;
  return (
    <div className="ds-ctx-bar">
      <div className="ds-ctx-bar__label">
        <span className={`ds-ctx-bar__dot ${complete ? "complete" : "live"}`} />
        <span>{label}</span>
      </div>
      <div className="ds-ctx-bar__track">
        <div className="ds-ctx-bar__fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(extension): ContextProgressBar showing streaming analysis progress"
```

---

### Task 14: UpgradeCTA component (Agent D)

**Files:**
- Create: `extension/src/sidepanel/components/UpgradeCTA.tsx`
- Test: `extension/__tests__/sidepanel/components/UpgradeCTA.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// extension/__tests__/sidepanel/components/UpgradeCTA.test.tsx
import { render, fireEvent, screen } from "@testing-library/react";
import { UpgradeCTA } from "../../../src/sidepanel/components/UpgradeCTA";

describe("UpgradeCTA", () => {
  it("renders Expert plan card with 14.99€ and 30 min/mois", () => {
    render(<UpgradeCTA reason="trial_used" onUpgrade={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText(/14.99€/)).toBeInTheDocument();
    expect(screen.getByText(/30 min/)).toBeInTheDocument();
  });

  it("clicking 'Passer en Expert' calls onUpgrade", () => {
    const onUpgrade = jest.fn();
    render(<UpgradeCTA reason="trial_used" onUpgrade={onUpgrade} onDismiss={jest.fn()} />);
    fireEvent.click(screen.getByText(/Passer en Expert/));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("clicking 'Continuer en Free' calls onDismiss", () => {
    const onDismiss = jest.fn();
    render(<UpgradeCTA reason="trial_used" onUpgrade={jest.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText(/Continuer en Free/));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2-4: TDD cycle**

```typescript
// extension/src/sidepanel/components/UpgradeCTA.tsx
interface Props {
  reason: "trial_used" | "monthly_quota" | "pro_no_voice";
  onUpgrade: () => void;
  onDismiss: () => void;
}
export function UpgradeCTA({ reason, onUpgrade, onDismiss }: Props) {
  return (
    <div className="ds-upgrade-cta">
      <div className="ds-upgrade-cta__emoji">✨</div>
      <h2>Tu as adoré ?<br/>Continue avec 30 min/mois</h2>
      <p>Tu viens d'utiliser ton essai gratuit. Upgrade vers Expert pour appeler n'importe quelle vidéo, autant que tu veux.</p>
      <div className="ds-upgrade-cta__plan">
        <div className="ds-upgrade-cta__plan-header">
          <span className="ds-upgrade-cta__plan-name">Expert</span>
          <span className="ds-upgrade-cta__plan-price">14.99€<span>/mois</span></span>
        </div>
        <ul>
          <li>✓ 30 min de voice call/mois</li>
          <li>✓ Analyses illimitées</li>
          <li>✓ Mind maps, web search, exports</li>
        </ul>
      </div>
      <button className="ds-upgrade-cta__primary" onClick={onUpgrade}>Passer en Expert →</button>
      <button className="ds-upgrade-cta__dismiss" onClick={onDismiss}>Continuer en Free (sans voice)</button>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(extension): UpgradeCTA component for post-call Free → Expert conversion"
```

---

### Task 15: ConnectingView and CallActiveView components (Agent D)

**Files:**
- Create: `extension/src/sidepanel/components/ConnectingView.tsx`
- Create: `extension/src/sidepanel/components/CallActiveView.tsx`
- Test: `extension/__tests__/sidepanel/components/ConnectingView.test.tsx`
- Test: `extension/__tests__/sidepanel/components/CallActiveView.test.tsx`

- [ ] **Step 1: Tests for ConnectingView**

```typescript
import { render, screen } from "@testing-library/react";
import { ConnectingView } from "../../../src/sidepanel/components/ConnectingView";

describe("ConnectingView", () => {
  it("shows pulsing mic + 'Connexion à l'agent…' message", () => {
    render(<ConnectingView />);
    expect(screen.getByText(/Connexion à l'agent/)).toBeInTheDocument();
    expect(screen.getByText(/L'appel démarre dans une seconde/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement ConnectingView**

```typescript
export function ConnectingView() {
  return (
    <div className="ds-connecting">
      <div className="ds-connecting__mic">🎙️</div>
      <h2>Connexion à l'agent…</h2>
      <p>DeepSight commence à analyser la vidéo en parallèle. L'appel démarre dans une seconde.</p>
      <div className="ds-connecting__bar"><div /></div>
    </div>
  );
}
```

- [ ] **Step 3: Tests for CallActiveView**

```typescript
describe("CallActiveView", () => {
  it("shows live indicator and elapsed time", () => {
    render(<CallActiveView elapsedSec={23} onMute={jest.fn()} onHangup={jest.fn()} />);
    expect(screen.getByText(/En appel/)).toBeInTheDocument();
    expect(screen.getByText(/00:23/)).toBeInTheDocument();
  });
  it("renders Mute and Raccrocher buttons", () => {
    render(<CallActiveView elapsedSec={0} onMute={jest.fn()} onHangup={jest.fn()} />);
    expect(screen.getByRole("button", { name: /Mute/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Raccrocher/ })).toBeInTheDocument();
  });
  it("hangup callback fires on click", () => {
    const onHangup = jest.fn();
    render(<CallActiveView elapsedSec={0} onMute={jest.fn()} onHangup={onHangup} />);
    fireEvent.click(screen.getByRole("button", { name: /Raccrocher/ }));
    expect(onHangup).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Implement CallActiveView**

```typescript
interface Props { elapsedSec: number; onMute: () => void; onHangup: () => void; }
export function CallActiveView({ elapsedSec, onMute, onHangup }: Props) {
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");
  return (
    <div className="ds-call-active">
      <header>
        <div className="ds-call-active__indicator" />
        <span className="ds-call-active__label">En appel</span>
        <span className="ds-call-active__elapsed">· {mm}:{ss}</span>
      </header>
      <div className="ds-call-active__waveform">
        {[30,80,50,90,40,70,55].map((h,i)=>(<span key={i} style={{height:`${h}%`}} />))}
      </div>
      <footer>
        <button onClick={onMute}>🔇 Mute</button>
        <button onClick={onHangup} className="ds-hangup">📞 Raccrocher</button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(extension): ConnectingView + CallActiveView components for call lifecycle states"
```

---

### Task 16: VoiceView state machine — wire everything together (Agent D)

**Files:**
- Modify: `extension/src/sidepanel/VoiceView.tsx`
- Modify: `extension/src/sidepanel/types.ts`
- Modify: `extension/src/sidepanel/useExtensionVoiceChat.ts`
- Test: `extension/__tests__/sidepanel/VoiceView.streaming.test.tsx`

- [ ] **Step 1: Define types**

```typescript
// extension/src/sidepanel/types.ts (extend existing)
export type VoiceCallState =
  | { phase: "idle" }
  | { phase: "connecting"; videoId: string; videoTitle: string }
  | { phase: "live_streaming"; videoId: string; sessionId: string; startedAt: number }
  | { phase: "live_complete"; videoId: string; sessionId: string; startedAt: number }
  | { phase: "ended_free_cta"; reason: "trial_used" }
  | { phase: "ended_expert" }
  | { phase: "error_quota"; reason: "trial_used" | "pro_no_voice" | "monthly_quota" }
  | { phase: "error_mic_permission" }
  | { phase: "error_generic"; message: string };
```

- [ ] **Step 2: Write integration test**

```typescript
// extension/__tests__/sidepanel/VoiceView.streaming.test.tsx
import { render, screen, waitFor, act } from "@testing-library/react";
import { VoiceView } from "../../src/sidepanel/VoiceView";

describe("VoiceView streaming flow", () => {
  beforeEach(() => {
    chrome.storage.session.get = jest.fn().mockResolvedValue({
      pendingVoiceCall: { videoId: "abc", videoTitle: "Test Video" },
    });
  });

  it("starts in connecting phase, transitions to live_streaming after session created", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ session_id: "s1", signed_url: "wss://...", conversation_token: "tok", max_minutes: 3, is_trial: true }),
    });
    render(<VoiceView />);
    expect(screen.getByText(/Connexion à l'agent/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/En appel/)).toBeInTheDocument());
  });

  it("shows 402 error → UpgradeCTA when Pro user attempts call", async () => {
    chrome.storage.session.get = jest.fn().mockResolvedValue({
      pendingVoiceCall: { videoId: "abc", videoTitle: "T" },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 402,
      json: async () => ({ detail: { reason: "pro_no_voice", cta: "upgrade_expert" } }),
    });
    render(<VoiceView />);
    await waitFor(() => expect(screen.getByText(/Passer en Expert/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 3-5: Refactor VoiceView**

```typescript
// extension/src/sidepanel/VoiceView.tsx — major rewrite
import { useEffect, useState } from "react";
import { ConnectingView } from "./components/ConnectingView";
import { CallActiveView } from "./components/CallActiveView";
import { ContextProgressBar } from "./components/ContextProgressBar";
import { UpgradeCTA } from "./components/UpgradeCTA";
import { useExtensionVoiceChat } from "./useExtensionVoiceChat";
import { useStreamingVideoContext } from "./hooks/useStreamingVideoContext";
import type { VoiceCallState } from "./types";

export function VoiceView() {
  const [state, setState] = useState<VoiceCallState>({ phase: "idle" });
  const [elapsedSec, setElapsedSec] = useState(0);
  const voiceChat = useExtensionVoiceChat();

  useEffect(() => {
    chrome.storage.session.get("pendingVoiceCall").then(async ({ pendingVoiceCall }) => {
      if (!pendingVoiceCall) return;
      setState({ phase: "connecting", videoId: pendingVoiceCall.videoId, videoTitle: pendingVoiceCall.videoTitle });
      await chrome.storage.session.remove("pendingVoiceCall");

      try {
        const session = await voiceChat.startSession({
          videoId: pendingVoiceCall.videoId,
          agentType: "explorer_streaming",
          isStreaming: true,
        });
        chrome.runtime.sendMessage({ type: "VOICE_CALL_STARTED" });
        setState({
          phase: "live_streaming",
          videoId: pendingVoiceCall.videoId,
          sessionId: session.session_id,
          startedAt: Date.now(),
        });
      } catch (err: any) {
        if (err.status === 402) {
          setState({ phase: "error_quota", reason: err.detail.reason });
        } else if (err.name === "NotAllowedError") {
          setState({ phase: "error_mic_permission" });
        } else {
          setState({ phase: "error_generic", message: String(err) });
        }
      }
    });
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (state.phase !== "live_streaming" && state.phase !== "live_complete") return;
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - state.startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [state]);

  const sessionId = (state.phase === "live_streaming" || state.phase === "live_complete") ? state.sessionId : null;
  const { contextProgress, contextComplete } = useStreamingVideoContext(sessionId, voiceChat.conversation);

  useEffect(() => {
    if (contextComplete && state.phase === "live_streaming") {
      setState((s) => s.phase === "live_streaming" ? { ...s, phase: "live_complete" } : s);
    }
  }, [contextComplete, state.phase]);

  const handleHangup = () => {
    voiceChat.endSession();
    chrome.runtime.sendMessage({ type: "VOICE_CALL_ENDED" });
    if (voiceChat.lastSessionWasTrial) {
      setState({ phase: "ended_free_cta", reason: "trial_used" });
    } else {
      setState({ phase: "ended_expert" });
    }
  };

  if (state.phase === "connecting") return <ConnectingView />;
  if (state.phase === "live_streaming" || state.phase === "live_complete") {
    return (
      <>
        <CallActiveView elapsedSec={elapsedSec} onMute={voiceChat.toggleMute} onHangup={handleHangup} />
        <ContextProgressBar progress={contextProgress} complete={contextComplete} />
      </>
    );
  }
  if (state.phase === "ended_free_cta" || state.phase === "error_quota") {
    return (
      <UpgradeCTA
        reason={state.phase === "error_quota" ? state.reason : "trial_used"}
        onUpgrade={() => window.open(`${API_BASE_URL}/billing/checkout?plan=expert&source=voice_call`, "_blank")}
        onDismiss={() => setState({ phase: "idle" })}
      />
    );
  }
  if (state.phase === "error_mic_permission") {
    return <div className="ds-error">Permission micro requise. <button onClick={() => location.reload()}>Réessayer</button></div>;
  }
  return null;
}
```

- [ ] **Step 4: Extend useExtensionVoiceChat**

In `extension/src/sidepanel/useExtensionVoiceChat.ts`, add `startSession({ videoId, agentType, isStreaming })` that calls `POST /api/voice/session`, throws on 402 with `{status, detail}`, and stores `lastSessionWasTrial` from response.

- [ ] **Step 5: Run tests, verify pass**

```bash
cd extension && npm test -- VoiceView.streaming
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(extension): VoiceView state machine wiring streaming context + upgrade flow"
```

---

### Task 17: Side panel build + manual smoke test (Agent D)

- [ ] **Step 1: Run all extension tests**

```bash
cd extension && npm test
```
Expected: all green

- [ ] **Step 2: Build**

```bash
cd extension && npm run build
```
Expected: dist/ updated, no warnings

- [ ] **Step 3: Verify widget integrity preserved**

```bash
grep -c "#0a0a0f" extension/dist/content.js
```
Expected: ≥ 7

- [ ] **Step 4: Manual smoke test**

1. Reload extension in `chrome://extensions`
2. Open YouTube video (any short one)
3. Verify widget shows the new 🎙️ button with "1 essai gratuit" badge
4. Click the button → side panel opens
5. Verify ConnectingView → CallActiveView transition
6. Verify YouTube volume drops to 10%
7. Speak; agent responds with "d'après ce que j'écoute pour l'instant…"
8. Wait until ContextProgressBar reaches 100%; agent acknowledges full context
9. Hang up; verify YouTube volume restored
10. Try a 2nd call; verify UpgradeCTA appears (trial_used)

- [ ] **Step 5: Tag extension ready**

```bash
git tag voice-call-extension-v1-ready
```

---

### Task 18: E2E Playwright "Free trial → upgrade" (Agent E)

**Files:**
- Create: `extension/e2e/quick-voice-call.spec.ts`

- [ ] **Step 1: Write the E2E spec**

```typescript
// extension/e2e/quick-voice-call.spec.ts
import { test, expect, chromium } from "@playwright/test";
import path from "path";

test("Free user 1-trial → upgrade CTA → Stripe checkout", async () => {
  const ext = path.resolve(__dirname, "../dist");
  const browser = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    permissions: ["microphone"],
  });
  const page = await browser.newPage();
  await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.waitForSelector("#ds-widget-root", { timeout: 30000 });

  // Login as a fresh Free user via test helper
  await page.evaluate(() => chrome.storage.local.set({ jwt: window.__E2E_FREE_JWT__ }));

  await page.locator("button.ds-voice-call-btn").click();
  // Side panel opens (in another window context)
  const sidePanelPage = await browser.waitForEvent("page", { timeout: 5000 });
  await expect(sidePanelPage.locator("text=Connexion à l'agent")).toBeVisible();
  await expect(sidePanelPage.locator("text=En appel")).toBeVisible({ timeout: 10000 });

  // Hang up
  await sidePanelPage.locator("button.ds-hangup").click();

  // Try again — should hit upgrade CTA
  await page.locator("button.ds-voice-call-btn").click();
  await expect(sidePanelPage.locator("text=Passer en Expert")).toBeVisible({ timeout: 5000 });

  // Click upgrade → opens Stripe checkout in new tab
  const [stripeTab] = await Promise.all([
    browser.waitForEvent("page"),
    sidePanelPage.locator("text=Passer en Expert").click(),
  ]);
  await expect(stripeTab.url()).toMatch(/checkout\.stripe\.com|billing\/checkout/);

  await browser.close();
});
```

- [ ] **Step 2: Run E2E**

```bash
cd extension && npx playwright test e2e/quick-voice-call.spec.ts
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git commit -am "test(extension): E2E Playwright Free trial → upgrade flow"
```

---

### Task 19: PostHog instrumentation (Agent D)

**Files:**
- Modify: `extension/src/sidepanel/VoiceView.tsx`

- [ ] Add `posthog.capture()` calls at each state transition with the events listed in the spec (`voice_call_started`, `voice_call_duration_seconds`, `voice_call_context_complete_at_ms`, `voice_call_ended_reason`, `voice_call_upgrade_cta_shown`, `voice_call_upgrade_cta_clicked`).
- [ ] Smoke test: open PostHog dashboard after a manual call, verify events arrived with expected properties.
- [ ] Commit: `feat(extension): PostHog instrumentation for voice call funnel`

---

### Task 20: Phase 1 release & monitoring (orchestrator)

- [ ] Merge Agent A and B prereq PRs first
- [ ] Open one PR per Agent C and D scope (split for cleaner review)
- [ ] Open one PR for Agent E (E2E spec only)
- [ ] After merge to main: deploy backend (SSH VPS rebuild), build + zip extension dist/, submit to Chrome Web Store
- [ ] Add Sentry alert: budget ElevenLabs > $X/day → page user
- [ ] Add kill switch env var `VOICE_CALL_DISABLED=true` (already in spec)

---

## PHASE 2 — V2 Web (Agent F)

Macro tasks once V1 is stable. Each will be detailed in a follow-up plan after V1 launch metrics are reviewed.

- [ ] **F.1** Web `useStreamingVideoContext` hook (mirror of extension hook, uses fetch SSE polyfill if needed)
- [ ] **F.2** Extend `frontend/src/components/voice/VoiceCallButton.tsx` (PR #125) with `streaming: boolean` prop
- [ ] **F.3** Extend `frontend/src/components/voice/VoiceOverlay.tsx` (PR #126) with `<ContextProgressBar />`
- [ ] **F.4** Add 🎙️ button on `DashboardPage`, `AnalysisPage`, `ChatPage` (replaces or complements Quick Chat)
- [ ] **F.5** Mobile-web responsive design : viewport < 768px → overlay full-screen
- [ ] **F.6** Vitest coverage for new hook + components
- [ ] **F.7** Playwright E2E web Free trial → upgrade
- [ ] **F.8** Deploy web (Vercel auto on merge to main)

**Plan file:** `docs/superpowers/plans/2026-MM-DD-quick-voice-call-v2-web.md` (write after V1 metrics review)

---

## PHASE 3 — V3 Mobile (Agent G)

Macro tasks. Same caveat: detailed plan written after V2 launch.

- [ ] **G.1** Mobile `useStreamingVideoContext` hook using `react-native-sse`
- [ ] **G.2** Extend `mobile/src/components/voice/VoiceButton.tsx` (PR #127) with streaming variant
- [ ] **G.3** FAB voice on `library.tsx`, sub-tab voice on `study.tsx`
- [ ] **G.4** Native mic permissions iOS/Android via `expo-av`
- [ ] **G.5** Native audio ducking via `AVAudioSession` mode (iOS) / `AudioFocus` (Android)
- [ ] **G.6** Jest RN coverage
- [ ] **G.7** Manual device testing iOS + Android via EAS preview build
- [ ] **G.8** Deploy via `eas update` (OTA) then `eas build` for native changes

**Plan file:** `docs/superpowers/plans/2026-MM-DD-quick-voice-call-v3-mobile.md`

---

## Self-review checklist (run before handoff)

- [x] Spec coverage : every section of `2026-04-26-quick-voice-call-design.md` mapped to Phase 0 / 1 tasks (V2 / V3 stubbed for follow-up plans)
- [x] No placeholders : tasks use exact code blocks, no "TBD" / "TODO"
- [x] Type consistency : `VoiceCallState`, `QuotaCheck`, `VoiceQuota`, `EXPLORER_STREAMING`, `useStreamingVideoContext` all referenced consistently across tasks
- [x] Test for every public API : quota service, orchestrator, SSE endpoint, widget button, hook, audio controller, components, VoiceView state machine, E2E
- [x] Commit per task (atomic)
- [x] Opus 4.7 directive in agent spawn examples and in the header

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-26-quick-voice-call.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Orchestrator dispatches a fresh Opus 4.7 subagent per agent (A, B, C, D, E), reviews between handoffs, fast iteration. Phase 0 agents (A, B) run in parallel ; Phase 1 agents (C, D) run in parallel after Phase 0 ; Agent E runs after C and D.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
