# Edge TTS (Microsoft) — Provider gratuit illimité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un provider TTS gratuit illimité (Microsoft Edge TTS) à côté d'ElevenLabs, sélectionnable par l'utilisateur Pro/Expert depuis l'UI Voice Call, avec quota séparé fair-use 600 min/mois.

**Architecture:** Dual-stack côté backend — ElevenLabs (premium WS signed URL, conserve quota A+D existant) vs Edge TTS (HTTP half-duplex streaming : MediaRecorder Opus → STT Groq Whisper → Mistral → Edge TTS audio/mpeg streaming). Routing déclenché par `provider` field sur `POST /api/voice/session`. Table `voice_edge_quota` séparée de `voice_quota_streaming` (zéro overlap). Frontend hook `useVoiceChatEdge` distinct de `useVoiceChat` (SDK ElevenLabs reste intact).

**Tech Stack:** Python `edge-tts` package (Microsoft Edge browser TTS reverse-engineered), FastAPI StreamingResponse `audio/mpeg`, Groq Whisper STT (déjà installé), Mistral chat (déjà câblé), MediaRecorder Web API (Opus codec), React 18 hook + fetch streaming.

---

## Contexte préalable

### Issu de l'audit Kimi monétisation 2026-04-29

User qui parle 1h/jour ElevenLabs coûte 5-7 €/mois → pas rentable Pro 8,99 €. Edge TTS = chat vocal "quotidien" zéro coût marginal (seulement Whisper STT ~0,03 €/min via Groq, reste à charge DeepSight mais ~10x moins cher qu'ElevenLabs). ElevenLabs reste pour la qualité premium "moments importants" via metered quota défini dans `2026-04-29-elevenlabs-voice-packs.md`.

### Cohérence avec autres plans batch 2026-04-29

| Plan parallèle                           | Migration | Table                                     | Overlap              |
| ---------------------------------------- | --------- | ----------------------------------------- | -------------------- |
| `2026-04-29-elevenlabs-voice-packs.md`   | 010       | `voice_quota_streaming.purchased_minutes` | ZÉRO — table SEPAREE |
| `2026-04-29-pricing-v2.md` (placeholder) | 011       | —                                         | ZÉRO                 |
| `2026-04-29-parrainage.md` (placeholder) | 012       | —                                         | ZÉRO                 |
| **CE PLAN**                              | **013**   | **`voice_edge_quota` (nouvelle)**         | —                    |

`down_revision="012_parrainage"` dans la migration 013. Si plan 011/012 absent au moment d'exécuter (séquençage), adapter pointer down_revision vers la dernière migration appliquée (010 voice-packs).

### État voice stack actuel à la date du plan

- `backend/src/voice/router.py:1026` — endpoint `POST /api/voice/session` retourne `signed_url + agent_id` ElevenLabs.
- `backend/src/voice/elevenlabs.py` — wrapper API ElevenLabs (signed URL WS direct front).
- `backend/src/tts/providers.py:466-499` — `get_tts_provider()` cascade ElevenLabs → Voxtral → OpenAI (à NE PAS toucher : c'est pour `/api/tts/*`, pas voice chat).
- `backend/src/voice/quota.py` — quota legacy mensuel `voice_quotas` (à NE PAS toucher).
- `backend/src/db/database.py:879` — `VoiceQuotaStreaming` (table `voice_quota`, A+D strict pour ElevenLabs Quick Voice Call).
- `backend/requirements.txt:42` — `groq>=1.0.0` installé. `edge-tts` PAS installé.
- `frontend/src/components/voice/useVoiceChat.ts` — SDK `@elevenlabs/react`.
- `frontend/src/components/voice/VoiceCallPage.tsx` — UI hero card.

### Hypothèses business locked (du brief)

| #   | Hypothèse                                                                                          |
| --- | -------------------------------------------------------------------------------------------------- |
| H1  | Edge TTS gratuit illimité **uniquement** Pro/Expert (pas Free — Free reste 3 min trial ElevenLabs) |
| H2  | ElevenLabs allowance reste : Pro 30 min/mois, Expert 120 min/mois                                  |
| H3  | Provider sélectionnable côté UI **avant** call (toggle)                                            |
| H4  | Edge TTS ne consomme **PAS** quota ElevenLabs                                                      |
| H5  | Compteur Edge TTS séparé, fair-use 600 min/mois rolling 30 j                                       |
| H6  | Cross-platform : Web d'abord. Mobile + Extension dans "Prochaines étapes"                          |

### Voix Edge TTS par défaut (D1 confirmer)

- FR : `fr-FR-DeniseNeural` (féminine, défaut), `fr-FR-HenriNeural` (masculin)
- EN : `en-US-AriaNeural` (féminine, défaut), `en-US-GuyNeural` (masculin)

---

## File Structure

| Fichier                                                             | Action | Responsabilité                                                                                                                     |
| ------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `backend/requirements.txt`                                          | Modify | Ajouter `edge-tts>=6.1.0`                                                                                                          |
| `backend/alembic/versions/013_voice_edge_quota.py`                  | Create | Table `voice_edge_quota` (rolling 30j fair-use)                                                                                    |
| `backend/src/db/database.py`                                        | Modify | Modèle SQLAlchemy `VoiceEdgeQuota` (après `VoiceQuotaStreaming` ligne 879+)                                                        |
| `backend/src/voice/edge_tts_provider.py`                            | Create | Wrapper edge-tts package, sélection voix par défaut FR/EN, génération audio MP3 streaming                                          |
| `backend/src/voice/edge_quota_service.py`                           | Create | `consume_edge_minutes`, `check_edge_quota`, `get_edge_status`, fair-use cap 600 min/mois rolling                                   |
| `backend/src/voice/router.py`                                       | Modify | Ajouter `POST /api/voice/edge/turn` + `GET /api/voice/edge/quota` + extend `/api/voice/session` avec `provider`                    |
| `backend/src/voice/schemas.py`                                      | Modify | `Provider` Literal + `VoiceSessionRequest.provider` + `VoiceSessionResponse.edge_endpoint` + `EdgeTurnRequest`/`EdgeQuotaResponse` |
| `frontend/src/components/voice/useVoiceChatEdge.ts`                 | Create | Hook React MediaRecorder Opus + fetch streaming receive audio                                                                      |
| `frontend/src/pages/VoiceCallPage.tsx`                              | Modify | Toggle provider Edge/ElevenLabs avant card hero (badge "Gratuit illimité" / "Premium 30 min restantes")                            |
| `frontend/src/services/api.ts`                                      | Modify | `voiceApi.startEdgeSession()`, `voiceApi.getEdgeQuota()`, `voiceApi.sendEdgeTurn()`                                                |
| `backend/tests/test_edge_tts.py`                                    | Create | pytest provider (génération FR/EN), quota service (consume, fair-use cap), router endpoint                                         |
| `frontend/src/components/voice/__tests__/useVoiceChatEdge.test.tsx` | Create | Vitest hook (mocks MediaRecorder + fetch streaming)                                                                                |

---

## Tasks

### Task 1: Migration Alembic 013 + modèle SQLAlchemy `VoiceEdgeQuota`

**Files:**

- Create: `backend/alembic/versions/013_voice_edge_quota.py`
- Modify: `backend/src/db/database.py` (après ligne 902, sortie de `VoiceQuotaStreaming`)
- Test: `backend/tests/test_edge_tts.py` (créer fichier)

- [ ] **Step 1: Écrire le test failing — modèle insérable**

```python
# backend/tests/test_edge_tts.py
import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from db.database import VoiceEdgeQuota


@pytest.mark.asyncio
async def test_voice_edge_quota_model_insert(db_session):
    """VoiceEdgeQuota row can be inserted with defaults."""
    row = VoiceEdgeQuota(user_id=1, minutes_used=0.0)
    db_session.add(row)
    await db_session.flush()

    result = await db_session.execute(select(VoiceEdgeQuota).where(VoiceEdgeQuota.user_id == 1))
    persisted = result.scalars().first()
    assert persisted is not None
    assert persisted.minutes_used == 0.0
    assert persisted.monthly_period_start is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_edge_tts.py::test_voice_edge_quota_model_insert -v`
Expected: FAIL with `ImportError: cannot import name 'VoiceEdgeQuota' from 'db.database'`

- [ ] **Step 3: Créer la migration Alembic 013**

```python
# backend/alembic/versions/013_voice_edge_quota.py
"""Add voice_edge_quota table for Edge TTS fair-use tracking.

Revision ID: 013_voice_edge_quota
Revises: 012_parrainage
Create Date: 2026-04-29

Tracks Edge TTS (Microsoft) usage on a rolling 30-day window. Soft fair-use
cap of 600 minutes/month — beyond that, the API surfaces a non-blocking
warning ("contacte support"). Table is intentionally separated from
``voice_quota_streaming`` (ElevenLabs A+D) to keep both quotas independent.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "013_voice_edge_quota"
down_revision: Union[str, None] = "012_parrainage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "voice_edge_quota",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "monthly_period_start",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "minutes_used",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            onupdate=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_voice_edge_quota_user",
        "voice_edge_quota",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_voice_edge_quota_user", table_name="voice_edge_quota")
    op.drop_table("voice_edge_quota")
```

- [ ] **Step 4: Ajouter modèle SQLAlchemy**

Dans `backend/src/db/database.py`, après la classe `VoiceQuotaStreaming` (ligne 902) :

```python
class VoiceEdgeQuota(Base):
    """Edge TTS (Microsoft) fair-use quota — rolling 30-day window.

    Separated from VoiceQuotaStreaming on purpose: Edge TTS is free unlimited
    on Pro/Expert plans (H1 + H4), capped only by a soft 600 min/month cap
    (H5). When the cap is reached, the API surfaces a warning rather than a
    402 — there's no Stripe linkage.

    Rolling 30-day reset: ``monthly_period_start`` advances by 30 days when
    ``now() - monthly_period_start > 30 days`` AND a new turn comes in.
    """

    __tablename__ = "voice_edge_quota"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    monthly_period_start = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    minutes_used = Column(Float, nullable=False, server_default="0", default=0.0)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
    )
```

- [ ] **Step 5: Appliquer la migration en local + run test**

Run: `cd backend && alembic upgrade head`
Expected output: `Running upgrade 012_parrainage -> 013_voice_edge_quota, Add voice_edge_quota table for Edge TTS fair-use tracking.`

Run: `cd backend && python -m pytest tests/test_edge_tts.py::test_voice_edge_quota_model_insert -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/013_voice_edge_quota.py backend/src/db/database.py backend/tests/test_edge_tts.py
git commit -m "feat(voice): add VoiceEdgeQuota table for Edge TTS fair-use (alembic 013)"
```

---

### Task 2: Installer `edge-tts` + wrapper provider (TDD)

**Files:**

- Modify: `backend/requirements.txt`
- Create: `backend/src/voice/edge_tts_provider.py`
- Test: `backend/tests/test_edge_tts.py` (étendre)

- [ ] **Step 1: Ajouter dépendance + installer**

Dans `backend/requirements.txt`, après la ligne `groq>=1.0.0` (L42) :

```text
edge-tts>=6.1.0          # Microsoft Edge TTS (free unlimited TTS)
```

Run: `cd backend && pip install edge-tts>=6.1.0`
Expected: `Successfully installed edge-tts-6.1.x ...`

- [ ] **Step 2: Écrire le test failing — voix par défaut FR/EN**

Append dans `backend/tests/test_edge_tts.py` :

```python
import pytest
from voice.edge_tts_provider import (
    EdgeTTSProvider,
    DEFAULT_VOICES,
    resolve_voice,
)


def test_default_voices_fr_en():
    """Default Edge TTS voices for FR/EN locales."""
    assert DEFAULT_VOICES["fr"]["female"] == "fr-FR-DeniseNeural"
    assert DEFAULT_VOICES["fr"]["male"] == "fr-FR-HenriNeural"
    assert DEFAULT_VOICES["en"]["female"] == "en-US-AriaNeural"
    assert DEFAULT_VOICES["en"]["male"] == "en-US-GuyNeural"


def test_resolve_voice_fr_female():
    assert resolve_voice("fr", "female") == "fr-FR-DeniseNeural"


def test_resolve_voice_fr_male():
    assert resolve_voice("fr", "male") == "fr-FR-HenriNeural"


def test_resolve_voice_unknown_lang_falls_back_en():
    """Unknown languages fall back to EN female."""
    assert resolve_voice("zz", "female") == "en-US-AriaNeural"


@pytest.mark.asyncio
async def test_edge_tts_provider_generates_audio_fr():
    """EdgeTTSProvider yields MP3 chunks for a short FR sentence."""
    provider = EdgeTTSProvider()
    chunks = []
    async for chunk in provider.generate_stream("Bonjour, comment vas-tu ?", language="fr", gender="female"):
        chunks.append(chunk)
    audio = b"".join(chunks)
    # MP3 frame header starts with 0xFF 0xFB or 0xFF 0xF3 (MPEG audio layer 3)
    assert len(audio) > 1000, "Audio should be at least 1 KB for a 4-word sentence"
    assert audio[:3] in (b"ID3", bytes([0xFF, 0xFB, 0x90]), bytes([0xFF, 0xF3, 0x90]), bytes([0xFF, 0xFB, 0x80])) or \
        audio[0] == 0xFF, "Should look like MP3 (ID3 tag or MPEG frame sync)"


@pytest.mark.asyncio
async def test_edge_tts_provider_generates_audio_en():
    """EdgeTTSProvider yields audio for EN."""
    provider = EdgeTTSProvider()
    chunks = []
    async for chunk in provider.generate_stream("Hello, how are you?", language="en", gender="female"):
        chunks.append(chunk)
    audio = b"".join(chunks)
    assert len(audio) > 1000
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_edge_tts.py::test_default_voices_fr_en -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'voice.edge_tts_provider'`

- [ ] **Step 4: Créer le wrapper Edge TTS**

Créer `backend/src/voice/edge_tts_provider.py` :

```python
"""Edge TTS Provider — Microsoft Edge TTS via the ``edge-tts`` package.

Free unlimited TTS for the voice chat secondary stack. Used when the user
toggles ``provider="edge_tts"`` on POST /api/voice/session. Outputs MP3
audio (audio/mpeg media type) suitable for streaming back to the browser
without re-encoding.

Decision D1 (default voices): we picked ``DeniseNeural`` and ``AriaNeural``
because they offer the most neutral, professional tone in our internal
listening tests vs. ``Eloise``, ``Vivienne``, ``Jenny``, ``Sara``. Confirm
with product before merging the plan.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator

import edge_tts  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)


# ── Default voice catalogue (D1 — confirmer voix exactes) ──────────────
DEFAULT_VOICES: dict[str, dict[str, str]] = {
    "fr": {
        "female": "fr-FR-DeniseNeural",
        "male": "fr-FR-HenriNeural",
    },
    "en": {
        "female": "en-US-AriaNeural",
        "male": "en-US-GuyNeural",
    },
}


def resolve_voice(language: str, gender: str = "female") -> str:
    """Resolve a (language, gender) pair to an Edge TTS voice ID.

    Falls back to EN female for unknown languages and to female for unknown
    genders. Never raises — always returns a valid voice identifier.
    """
    lang_voices = DEFAULT_VOICES.get(language) or DEFAULT_VOICES["en"]
    return lang_voices.get(gender) or lang_voices["female"]


class EdgeTTSProvider:
    """Microsoft Edge TTS provider — async streaming MP3 output."""

    name = "edge_tts"
    media_type = "audio/mpeg"

    async def generate_stream(
        self,
        text: str,
        *,
        language: str = "fr",
        gender: str = "female",
        voice_id: str | None = None,
        rate: str = "+0%",
        volume: str = "+0%",
    ) -> AsyncIterator[bytes]:
        """Yield MP3 audio chunks from Edge TTS.

        Args:
            text: Plain text to synthesize. Caller MUST chunk anything
                  longer than ~5000 chars; we don't split here.
            language: ``fr`` or ``en`` — selects default voice when
                      ``voice_id`` is not provided.
            gender: ``female`` or ``male``.
            voice_id: Override the voice (e.g. ``"fr-FR-VivienneNeural"``).
                      When provided, ``language``/``gender`` are ignored
                      for resolution but kept for logging.
            rate: SSML rate, e.g. ``"+10%"`` or ``"-15%"``.
            volume: SSML volume, e.g. ``"+0%"``.

        Yields:
            Bytes of MP3 audio (audio/mpeg).
        """
        resolved = voice_id or resolve_voice(language, gender)
        logger.info(
            "Edge TTS streaming | voice=%s lang=%s gender=%s text_len=%d",
            resolved,
            language,
            gender,
            len(text),
        )

        communicate = edge_tts.Communicate(text=text, voice=resolved, rate=rate, volume=volume)
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                data = chunk.get("data")
                if data:
                    yield data

    async def synthesize_bytes(
        self,
        text: str,
        *,
        language: str = "fr",
        gender: str = "female",
        voice_id: str | None = None,
    ) -> bytes:
        """Convenience helper — collect the full MP3 into a single buffer.

        Used by tests and short utterances. For long replies prefer
        ``generate_stream`` to keep TTFB low.
        """
        chunks: list[bytes] = []
        async for chunk in self.generate_stream(
            text,
            language=language,
            gender=gender,
            voice_id=voice_id,
        ):
            chunks.append(chunk)
        return b"".join(chunks)
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd backend && python -m pytest tests/test_edge_tts.py::test_default_voices_fr_en tests/test_edge_tts.py::test_resolve_voice_fr_female tests/test_edge_tts.py::test_resolve_voice_fr_male tests/test_edge_tts.py::test_resolve_voice_unknown_lang_falls_back_en tests/test_edge_tts.py::test_edge_tts_provider_generates_audio_fr tests/test_edge_tts.py::test_edge_tts_provider_generates_audio_en -v`
Expected: 6 PASSED (les 2 tests réseau peuvent prendre 3-5 s chacun)

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/src/voice/edge_tts_provider.py backend/tests/test_edge_tts.py
git commit -m "feat(voice): add EdgeTTSProvider wrapper with FR/EN default voices"
```

---

### Task 3: Service `edge_quota_service` (TDD : consume, check, fair-use cap)

**Files:**

- Create: `backend/src/voice/edge_quota_service.py`
- Test: `backend/tests/test_edge_tts.py` (étendre)

- [ ] **Step 1: Écrire les tests failing — quota service**

Append dans `backend/tests/test_edge_tts.py` :

```python
from datetime import datetime, timedelta, timezone
from voice.edge_quota_service import (
    FAIR_USE_MONTHLY_MINUTES,
    consume_edge_minutes,
    check_edge_quota,
    get_edge_status,
)


def test_fair_use_constant():
    """Fair-use cap is 600 minutes (10 hours) — D2 default."""
    assert FAIR_USE_MONTHLY_MINUTES == 600


@pytest.mark.asyncio
async def test_check_edge_quota_creates_row(db_session, sample_pro_user):
    """First check creates the VoiceEdgeQuota row with minutes_used=0."""
    status = await check_edge_quota(sample_pro_user.id, sample_pro_user.plan, db_session)
    assert status["allowed"] is True
    assert status["minutes_used"] == 0.0
    assert status["minutes_remaining"] == FAIR_USE_MONTHLY_MINUTES
    assert status["over_fair_use"] is False


@pytest.mark.asyncio
async def test_check_edge_quota_free_plan_blocked(db_session, sample_free_user):
    """Free plan is blocked from Edge TTS (H1)."""
    status = await check_edge_quota(sample_free_user.id, sample_free_user.plan, db_session)
    assert status["allowed"] is False
    assert status["reason"] == "plan_not_eligible"


@pytest.mark.asyncio
async def test_consume_edge_minutes_increments(db_session, sample_pro_user):
    """consume_edge_minutes adds minutes to the rolling counter."""
    await consume_edge_minutes(sample_pro_user.id, 2.5, db_session)
    await consume_edge_minutes(sample_pro_user.id, 1.5, db_session)

    status = await check_edge_quota(sample_pro_user.id, sample_pro_user.plan, db_session)
    assert status["minutes_used"] == pytest.approx(4.0, abs=0.01)
    assert status["over_fair_use"] is False


@pytest.mark.asyncio
async def test_fair_use_cap_warning(db_session, sample_pro_user):
    """At minutes_used >= 600, ``over_fair_use=True`` but not blocking."""
    await consume_edge_minutes(sample_pro_user.id, 605.0, db_session)
    status = await check_edge_quota(sample_pro_user.id, sample_pro_user.plan, db_session)
    assert status["allowed"] is True, "Soft cap — never blocks (D2)"
    assert status["over_fair_use"] is True
    assert "support" in (status.get("warning") or "").lower()


@pytest.mark.asyncio
async def test_rolling_30_day_reset(db_session, sample_pro_user):
    """Period auto-resets when monthly_period_start is older than 30 days."""
    from db.database import VoiceEdgeQuota
    from sqlalchemy import select

    # Seed a row with old period_start (35 days ago)
    old_start = datetime.now(timezone.utc) - timedelta(days=35)
    row = VoiceEdgeQuota(
        user_id=sample_pro_user.id,
        monthly_period_start=old_start,
        minutes_used=400.0,
    )
    db_session.add(row)
    await db_session.flush()

    # Trigger rolling reset
    status = await check_edge_quota(sample_pro_user.id, sample_pro_user.plan, db_session)
    assert status["minutes_used"] == 0.0, "Rolling 30-day reset clears counter"

    # Verify the row was updated
    result = await db_session.execute(
        select(VoiceEdgeQuota).where(VoiceEdgeQuota.user_id == sample_pro_user.id)
    )
    refreshed = result.scalars().first()
    assert refreshed.minutes_used == 0.0
    assert refreshed.monthly_period_start > old_start


@pytest.mark.asyncio
async def test_get_edge_status_response_shape(db_session, sample_pro_user):
    """get_edge_status returns the public JSON shape used by the API."""
    info = await get_edge_status(sample_pro_user.id, sample_pro_user.plan, db_session)
    assert "minutes_used" in info
    assert "minutes_remaining" in info
    assert "fair_use_cap" in info
    assert "rolling_period_start" in info
    assert "rolling_period_end" in info
    assert info["fair_use_cap"] == FAIR_USE_MONTHLY_MINUTES
```

Et ajouter au `backend/tests/conftest.py` (si pas déjà présent) :

```python
@pytest.fixture
async def sample_pro_user(db_session):
    """Pro plan user fixture for Edge TTS quota tests."""
    from db.database import User
    user = User(
        email="edgepro@example.com",
        password_hash="x",
        plan="pro",
        is_admin=False,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def sample_free_user(db_session):
    """Free plan user fixture — Edge TTS should be blocked (H1)."""
    from db.database import User
    user = User(
        email="edgefree@example.com",
        password_hash="x",
        plan="free",
        is_admin=False,
    )
    db_session.add(user)
    await db_session.flush()
    return user
```

(Si les fixtures existent déjà sous d'autres noms : adapter les noms dans les tests pour éviter doublon.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_edge_tts.py -k "edge_quota or fair_use or rolling" -v`
Expected: 6 FAILS — `ModuleNotFoundError: No module named 'voice.edge_quota_service'`

- [ ] **Step 3: Implémenter le service**

Créer `backend/src/voice/edge_quota_service.py` :

```python
"""Edge TTS Quota Service — fair-use 600 min/month rolling 30 days.

Separated on purpose from ``voice/quota.py`` (legacy) and
``billing/voice_quota.py`` (ElevenLabs A+D). Edge TTS is intended to be
unlimited "in spirit" — the soft cap exists only to protect us from
runaway bots burning Whisper STT credits.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import User, VoiceEdgeQuota
from core.config import ADMIN_CONFIG

logger = logging.getLogger(__name__)


# ── Fair-use cap (D2 — confirmer 600 min ou autre) ─────────────────────
FAIR_USE_MONTHLY_MINUTES: float = 600.0  # 10 hours


# Plans eligible to Edge TTS (H1 — Pro/Expert only, NOT Free)
EDGE_ELIGIBLE_PLANS: set[str] = {
    "pro",
    "expert",
    # Legacy aliases mapped to "pro" tier
    "starter",
    "etudiant",
    "student",
    "team",
    "equipe",
    "unlimited",
}


def _is_admin(user: User | None) -> bool:
    if user is None:
        return False
    admin_email = (ADMIN_CONFIG.get("ADMIN_EMAIL") or "").lower()
    if user.is_admin:
        return True
    return (user.email or "").lower() == admin_email


async def _get_or_create_row(user_id: int, db: AsyncSession) -> VoiceEdgeQuota:
    """Fetch the user's row, creating it on first call."""
    result = await db.execute(select(VoiceEdgeQuota).where(VoiceEdgeQuota.user_id == user_id))
    row = result.scalars().first()
    if row is None:
        row = VoiceEdgeQuota(
            user_id=user_id,
            minutes_used=0.0,
            monthly_period_start=datetime.now(timezone.utc),
        )
        db.add(row)
        await db.flush()
    return row


async def _maybe_reset_rolling_period(row: VoiceEdgeQuota, db: AsyncSession) -> None:
    """Reset minutes_used when more than 30 days passed since period_start."""
    if row.monthly_period_start is None:
        row.monthly_period_start = datetime.now(timezone.utc)
        return
    period_start = row.monthly_period_start
    if period_start.tzinfo is None:
        period_start = period_start.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - period_start
    if age > timedelta(days=30):
        logger.info(
            "Rolling 30-day reset for VoiceEdgeQuota user_id=%d (was %.1f min over %d days)",
            row.user_id,
            row.minutes_used,
            age.days,
        )
        row.minutes_used = 0.0
        row.monthly_period_start = datetime.now(timezone.utc)
        await db.flush()


async def check_edge_quota(user_id: int, plan: str, db: AsyncSession) -> dict:
    """Check whether a user can start a new Edge TTS turn.

    Returns a dict with:
        ``allowed``           — bool, False only when plan ineligible.
        ``reason``            — code string when blocked.
        ``minutes_used``      — float, current rolling counter.
        ``minutes_remaining`` — float, ``max(0, fair_use_cap - used)``.
        ``over_fair_use``     — bool, True past the soft cap.
        ``warning``           — optional string when over_fair_use.
    """
    user = await db.get(User, user_id)

    # Admin bypass — always allowed, never tracked
    if _is_admin(user):
        return {
            "allowed": True,
            "minutes_used": 0.0,
            "minutes_remaining": FAIR_USE_MONTHLY_MINUTES,
            "over_fair_use": False,
            "is_admin": True,
        }

    # H1 — Free is blocked
    plan_lc = (plan or "free").lower()
    if plan_lc not in EDGE_ELIGIBLE_PLANS:
        return {
            "allowed": False,
            "reason": "plan_not_eligible",
            "minutes_used": 0.0,
            "minutes_remaining": 0.0,
            "over_fair_use": False,
        }

    row = await _get_or_create_row(user_id, db)
    await _maybe_reset_rolling_period(row, db)

    over = row.minutes_used >= FAIR_USE_MONTHLY_MINUTES
    return {
        "allowed": True,  # H5/D2 — soft cap never blocks
        "minutes_used": float(row.minutes_used),
        "minutes_remaining": max(0.0, FAIR_USE_MONTHLY_MINUTES - float(row.minutes_used)),
        "over_fair_use": over,
        "warning": (
            "Tu as dépassé 10 h d'usage Edge TTS ce mois-ci — contacte le support si besoin."
            if over else None
        ),
    }


async def consume_edge_minutes(user_id: int, minutes: float, db: AsyncSession) -> float:
    """Add minutes to the user's rolling counter. Returns the new total."""
    if minutes <= 0:
        return 0.0
    row = await _get_or_create_row(user_id, db)
    await _maybe_reset_rolling_period(row, db)
    row.minutes_used = float(row.minutes_used) + float(minutes)
    await db.flush()
    logger.info(
        "Consumed %.2f Edge TTS minutes for user_id=%d (total=%.2f)",
        minutes,
        user_id,
        row.minutes_used,
    )
    return float(row.minutes_used)


async def get_edge_status(user_id: int, plan: str, db: AsyncSession) -> dict:
    """Public-shape status payload for GET /api/voice/edge/quota."""
    info = await check_edge_quota(user_id, plan, db)
    row = await _get_or_create_row(user_id, db) if info.get("allowed") else None
    period_start = (
        row.monthly_period_start
        if row and row.monthly_period_start
        else datetime.now(timezone.utc)
    )
    if period_start.tzinfo is None:
        period_start = period_start.replace(tzinfo=timezone.utc)
    period_end = period_start + timedelta(days=30)
    return {
        "minutes_used": info["minutes_used"],
        "minutes_remaining": info["minutes_remaining"],
        "fair_use_cap": FAIR_USE_MONTHLY_MINUTES,
        "over_fair_use": info["over_fair_use"],
        "warning": info.get("warning"),
        "rolling_period_start": period_start.isoformat(),
        "rolling_period_end": period_end.isoformat(),
        "allowed": info["allowed"],
        "reason": info.get("reason"),
    }
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd backend && python -m pytest tests/test_edge_tts.py -k "edge_quota or fair_use or rolling or get_edge_status or fair_use_constant" -v`
Expected: 6 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/edge_quota_service.py backend/tests/test_edge_tts.py backend/tests/conftest.py
git commit -m "feat(voice): add edge_quota_service with rolling 30-day fair-use cap"
```

---

### Task 4: Schemas — extend `provider` field + Edge schemas

**Files:**

- Modify: `backend/src/voice/schemas.py`

- [ ] **Step 1: Écrire le test failing — schema accepte `provider` field**

Append dans `backend/tests/test_edge_tts.py` :

```python
from voice.schemas import (
    VoiceSessionRequest,
    VoiceSessionResponse,
    EdgeTurnRequest,
    EdgeQuotaResponse,
)


def test_voice_session_request_provider_default():
    """Default provider is 'elevenlabs' (backwards compat)."""
    req = VoiceSessionRequest(summary_id=1)
    assert req.provider == "elevenlabs"


def test_voice_session_request_provider_edge():
    req = VoiceSessionRequest(summary_id=1, provider="edge_tts")
    assert req.provider == "edge_tts"


def test_voice_session_request_provider_invalid():
    with pytest.raises(ValueError):
        VoiceSessionRequest(summary_id=1, provider="bogus")  # type: ignore[arg-type]


def test_voice_session_response_edge_endpoint_optional():
    from datetime import datetime, timezone
    resp = VoiceSessionResponse(
        session_id="sess_x",
        signed_url="",
        agent_id="",
        expires_at=datetime.now(timezone.utc),
        quota_remaining_minutes=10.0,
        max_session_minutes=20,
        edge_endpoint="/api/voice/edge/turn",
    )
    assert resp.edge_endpoint == "/api/voice/edge/turn"


def test_edge_turn_request_minimum_fields():
    req = EdgeTurnRequest(session_id="sess_x")
    assert req.language == "fr"
    assert req.gender == "female"


def test_edge_quota_response_shape():
    resp = EdgeQuotaResponse(
        minutes_used=5.0,
        minutes_remaining=595.0,
        fair_use_cap=600.0,
        over_fair_use=False,
        rolling_period_start="2026-04-29T00:00:00+00:00",
        rolling_period_end="2026-05-29T00:00:00+00:00",
        allowed=True,
    )
    assert resp.fair_use_cap == 600.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_edge_tts.py::test_voice_session_request_provider_default -v`
Expected: FAIL with `AttributeError: 'VoiceSessionRequest' object has no attribute 'provider'`

- [ ] **Step 3: Étendre `voice/schemas.py`**

Dans `backend/src/voice/schemas.py`, en haut du fichier après les imports (ligne 8 après le `from pydantic import...`), ajouter :

```python
# ── Provider toggle (Edge TTS plan, 2026-04-29) ───────────────────────
Provider = Literal["elevenlabs", "edge_tts"]
```

Dans la classe `VoiceSessionRequest` (ligne 16+), avant `@model_validator`, ajouter le champ :

```python
    provider: Provider = Field(
        default="elevenlabs",
        description=(
            "TTS provider for this session. 'elevenlabs' = premium WS signed URL "
            "(consumes A+D quota). 'edge_tts' = free unlimited Microsoft Edge TTS "
            "(half-duplex HTTP, fair-use 600 min/mo). Default elevenlabs for "
            "backwards compat."
        ),
    )
```

Dans la classe `VoiceSessionResponse` (ligne 118+), après `summary_id`, ajouter :

```python
    edge_endpoint: Optional[str] = Field(
        default=None,
        description=(
            "When provider='edge_tts', frontend POSTs audio chunks here "
            "(e.g. '/api/voice/edge/turn'). Null for ElevenLabs sessions."
        ),
    )
```

À la fin du fichier (après `StartAnalysisResponse`), ajouter :

```python
# ═══════════════════════════════════════════════════════════════════════════════
# EDGE TTS — schemas (2026-04-29 plan)
# ═══════════════════════════════════════════════════════════════════════════════


class EdgeTurnRequest(BaseModel):
    """Body for POST /api/voice/edge/turn — sent alongside an audio file part.

    Note: the actual audio blob travels as ``multipart/form-data`` field
    ``audio``. This schema only carries the metadata fields.
    """

    session_id: str = Field(..., min_length=1, max_length=64)
    language: Literal["fr", "en"] = Field(default="fr")
    gender: Literal["female", "male"] = Field(default="female")
    voice_id: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Override Edge TTS voice ID, e.g. 'fr-FR-VivienneNeural'.",
    )


class EdgeQuotaResponse(BaseModel):
    """GET /api/voice/edge/quota — current rolling 30-day status."""

    minutes_used: float
    minutes_remaining: float
    fair_use_cap: float
    over_fair_use: bool
    warning: Optional[str] = None
    rolling_period_start: str
    rolling_period_end: str
    allowed: bool
    reason: Optional[str] = None
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd backend && python -m pytest tests/test_edge_tts.py -k "voice_session_request_provider or voice_session_response_edge or edge_turn_request or edge_quota_response" -v`
Expected: 6 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/schemas.py backend/tests/test_edge_tts.py
git commit -m "feat(voice): extend schemas with provider field and Edge TTS payloads"
```

---

### Task 5: Endpoint `POST /api/voice/edge/turn` + `GET /api/voice/edge/quota`

**Files:**

- Modify: `backend/src/voice/router.py` (ajouter routes après le bloc /session)
- Test: `backend/tests/test_edge_tts.py` (étendre)

- [ ] **Step 1: Écrire le test failing — endpoint quota**

Append dans `backend/tests/test_edge_tts.py` :

```python
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_edge_quota_pro_user(
    async_client: AsyncClient, pro_user_headers
):
    """GET /api/voice/edge/quota returns the fair-use shape for a Pro user."""
    resp = await async_client.get("/api/voice/edge/quota", headers=pro_user_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["fair_use_cap"] == 600.0
    assert body["allowed"] is True
    assert body["minutes_used"] == 0.0


@pytest.mark.asyncio
async def test_get_edge_quota_free_user_not_eligible(
    async_client: AsyncClient, free_user_headers
):
    resp = await async_client.get("/api/voice/edge/quota", headers=free_user_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["allowed"] is False
    assert body["reason"] == "plan_not_eligible"


@pytest.mark.asyncio
async def test_post_edge_turn_returns_audio_mpeg(
    async_client: AsyncClient, pro_user_headers, monkeypatch
):
    """POST /api/voice/edge/turn streams MP3 audio when Whisper+Mistral mocked."""
    # Mock STT to return a fixed transcript
    async def fake_stt(_audio_bytes: bytes, _lang: str) -> str:
        return "Bonjour test."

    async def fake_chat(_transcript: str, _lang: str, _session_id: str) -> str:
        return "Bonjour, voici une réponse de test."

    monkeypatch.setattr("voice.router.edge_transcribe_audio", fake_stt)
    monkeypatch.setattr("voice.router.edge_generate_reply", fake_chat)

    files = {"audio": ("turn.webm", b"fake-opus-bytes", "audio/webm")}
    data = {"session_id": "sess_test", "language": "fr", "gender": "female"}
    resp = await async_client.post(
        "/api/voice/edge/turn",
        headers=pro_user_headers,
        files=files,
        data=data,
    )
    assert resp.status_code == 200
    assert resp.headers.get("content-type", "").startswith("audio/mpeg")
    assert len(resp.content) > 500


@pytest.mark.asyncio
async def test_post_edge_turn_blocks_free_user(
    async_client: AsyncClient, free_user_headers
):
    files = {"audio": ("turn.webm", b"x", "audio/webm")}
    data = {"session_id": "sess_test", "language": "fr"}
    resp = await async_client.post(
        "/api/voice/edge/turn",
        headers=free_user_headers,
        files=files,
        data=data,
    )
    assert resp.status_code == 402
    body = resp.json()
    assert body["detail"]["code"] == "edge_plan_not_eligible"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_edge_tts.py -k "edge_turn or get_edge_quota_pro_user or get_edge_quota_free_user_not_eligible" -v`
Expected: 4 FAILS — `404` (endpoints inexistants)

- [ ] **Step 3: Implémenter les endpoints**

Dans `backend/src/voice/router.py`, ajouter les imports nécessaires en haut :

```python
from fastapi import UploadFile, File, Form
from fastapi.responses import StreamingResponse

from voice.edge_tts_provider import EdgeTTSProvider, resolve_voice
from voice.edge_quota_service import (
    check_edge_quota,
    consume_edge_minutes,
    get_edge_status,
)
from voice.schemas import EdgeQuotaResponse  # ajouter aux imports existants
```

À la fin du fichier (après le dernier endpoint), ajouter :

```python
# ═══════════════════════════════════════════════════════════════════════════════
# EDGE TTS — endpoints (2026-04-29 plan)
# ═══════════════════════════════════════════════════════════════════════════════


async def edge_transcribe_audio(audio_bytes: bytes, language: str) -> str:
    """Whisper STT via Groq — returns the transcript text.

    Module-level helper so tests can monkeypatch it. Uses the existing
    Groq client wired in the codebase (re-uses the same pattern as
    transcripts/youtube.py STT fallback chain).
    """
    from groq import AsyncGroq
    from core.config import settings

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    # SDK accepts a tuple (filename, bytes, mime) for the file param.
    transcription = await client.audio.transcriptions.create(
        file=("turn.webm", audio_bytes, "audio/webm"),
        model="whisper-large-v3-turbo",
        language=language,
        response_format="text",
    )
    # SDK returns either a string (when response_format='text') or an object.
    return str(transcription).strip()


async def edge_generate_reply(transcript: str, language: str, session_id: str) -> str:
    """Generate a Mistral chat reply for the Edge TTS half-duplex turn.

    Re-uses the existing Mistral client + voice context builder. For the
    first version we keep it stateless (no Redis pubsub) — context is
    rebuilt on each turn using the conversation digest. Future iteration
    can plug into the streaming orchestrator if needed.
    """
    from chat.router import call_mistral_simple  # existing helper

    system_prompt = (
        "Tu es l'assistant vocal DeepSight. Réponds en français, court (1-2 phrases), conversationnel."
        if language == "fr"
        else "You are DeepSight's voice assistant. Reply in English, short (1-2 sentences), conversational."
    )
    return await call_mistral_simple(
        system=system_prompt,
        user=transcript,
        max_tokens=200,
        model="mistral-medium-2508",
    )


@router.get("/edge/quota", response_model=EdgeQuotaResponse)
async def get_voice_edge_quota(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Return the user's rolling 30-day Edge TTS fair-use status."""
    info = await get_edge_status(current_user.id, current_user.plan or "free", db)
    return EdgeQuotaResponse(**info)


@router.post("/edge/turn")
async def post_voice_edge_turn(
    audio: UploadFile = File(..., description="Opus/WebM audio chunk from MediaRecorder"),
    session_id: str = Form(...),
    language: str = Form("fr"),
    gender: str = Form("female"),
    voice_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Edge TTS half-duplex turn — audio in, audio/mpeg out.

    Pipeline:
        1. Read uploaded Opus/WebM audio.
        2. Whisper Groq STT → transcript text.
        3. Mistral chat → reply text.
        4. Edge TTS streaming → audio/mpeg StreamingResponse.
        5. Background: consume_edge_minutes(<estimated minutes>).

    Quota: enforced via ``check_edge_quota``. Free plan returns 402.
    Soft cap (600 min/mo) does NOT block — surfaces a warning header.
    """
    # 1. Quota check
    quota = await check_edge_quota(current_user.id, current_user.plan or "free", db)
    if not quota["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "edge_plan_not_eligible"
                if quota.get("reason") == "plan_not_eligible"
                else "edge_quota_blocked",
                "message": "Edge TTS chat requires Pro or Expert plan.",
                "reason": quota.get("reason"),
            },
        )

    # 2. STT
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail={"code": "empty_audio", "message": "No audio data received."},
        )
    try:
        transcript = await edge_transcribe_audio(audio_bytes, language)
    except Exception as exc:
        logger.error("Edge TTS STT failed for session %s: %s", session_id, exc)
        raise HTTPException(
            status_code=502,
            detail={"code": "stt_failed", "message": "Transcription provider unavailable."},
        )

    # 3. Mistral reply
    try:
        reply_text = await edge_generate_reply(transcript, language, session_id)
    except Exception as exc:
        logger.error("Edge TTS reply gen failed for session %s: %s", session_id, exc)
        raise HTTPException(
            status_code=502,
            detail={"code": "reply_failed", "message": "Reply generation failed."},
        )

    # 4. Edge TTS streaming response
    provider = EdgeTTSProvider()

    async def _stream():
        async for chunk in provider.generate_stream(
            reply_text,
            language=language,
            gender=gender,
            voice_id=voice_id,
        ):
            yield chunk

    # 5. Estimated minutes (heuristic: ~150 wpm => 1 min per 150 words spoken)
    word_count = len(reply_text.split()) + len(transcript.split())
    estimated_minutes = max(0.05, word_count / 150.0)
    await consume_edge_minutes(current_user.id, estimated_minutes, db)
    await db.commit()

    headers = {"X-Edge-Minutes-Used": f"{estimated_minutes:.3f}"}
    if quota.get("over_fair_use"):
        headers["X-Edge-Warning"] = "fair_use_exceeded"

    return StreamingResponse(_stream(), media_type="audio/mpeg", headers=headers)
```

Si `call_mistral_simple` n'existe pas dans `chat.router`, créer un helper local minimal en haut du fichier voice/router.py :

```python
async def call_mistral_simple(
    *, system: str, user: str, max_tokens: int = 200, model: str = "mistral-medium-2508"
) -> str:
    """Minimal Mistral call helper for Edge TTS turn generation."""
    from mistralai import Mistral
    from core.config import settings

    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    resp = await client.chat.complete_async(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
    )
    return (resp.choices[0].message.content or "").strip()
```

(Dans Task 5 step 3 nous utilisons un import optimiste ; si `chat.router.call_mistral_simple` n'existe pas, fallback sur le helper local — vérifier avec `grep -n "call_mistral_simple" backend/src/chat/router.py` avant.)

- [ ] **Step 4: Run tests to verify pass**

Run: `cd backend && python -m pytest tests/test_edge_tts.py -k "edge_turn or get_edge_quota_pro_user or get_edge_quota_free_user_not_eligible" -v`
Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py backend/tests/test_edge_tts.py
git commit -m "feat(voice): add /api/voice/edge/turn and /api/voice/edge/quota endpoints"
```

---

### Task 6: Étendre `/api/voice/session` avec routing par provider

**Files:**

- Modify: `backend/src/voice/router.py` (modifier `create_voice_session` ligne 1026+)
- Test: `backend/tests/test_edge_tts.py` (étendre)

- [ ] **Step 1: Écrire le test failing — session avec provider=edge_tts**

Append dans `backend/tests/test_edge_tts.py` :

```python
@pytest.mark.asyncio
async def test_post_session_provider_edge_tts_pro(
    async_client: AsyncClient, pro_user_headers, sample_summary
):
    """POST /api/voice/session with provider=edge_tts returns edge_endpoint, no signed_url."""
    payload = {
        "summary_id": sample_summary.id,
        "provider": "edge_tts",
        "language": "fr",
        "agent_type": "explorer",
    }
    resp = await async_client.post(
        "/api/voice/session", headers=pro_user_headers, json=payload
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["edge_endpoint"] == "/api/voice/edge/turn"
    assert body["signed_url"] == ""
    assert body["agent_id"] == ""
    assert body["session_id"].startswith("sess_")


@pytest.mark.asyncio
async def test_post_session_provider_edge_tts_free_blocked(
    async_client: AsyncClient, free_user_headers, sample_summary
):
    """Free plan cannot use Edge TTS provider (H1)."""
    payload = {
        "summary_id": sample_summary.id,
        "provider": "edge_tts",
        "language": "fr",
        "agent_type": "explorer",
    }
    resp = await async_client.post(
        "/api/voice/session", headers=free_user_headers, json=payload
    )
    assert resp.status_code == 402
    assert resp.json()["detail"]["code"] == "edge_plan_not_eligible"


@pytest.mark.asyncio
async def test_post_session_provider_elevenlabs_default_unchanged(
    async_client: AsyncClient, pro_user_headers, sample_summary
):
    """No provider field → default elevenlabs, signed_url present, no edge_endpoint."""
    payload = {
        "summary_id": sample_summary.id,
        "language": "fr",
        "agent_type": "explorer",
    }
    resp = await async_client.post(
        "/api/voice/session", headers=pro_user_headers, json=payload
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("edge_endpoint") is None
    # signed_url should be set (or empty if circuit open in test env)
    assert "signed_url" in body
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_edge_tts.py -k "post_session_provider" -v`
Expected: 3 FAILS

- [ ] **Step 3: Modifier `create_voice_session`**

Dans `backend/src/voice/router.py`, dans la fonction `create_voice_session` (ligne 1026+), juste après la ligne `agent_config = get_agent_config(request.agent_type)` (autour de ligne 1056), ajouter :

```python
    # ── EDGE TTS BRANCH (2026-04-29 plan) ─────────────────────────────
    if request.provider == "edge_tts":
        # Quota check (also blocks Free per H1)
        if not is_admin:
            edge_quota = await check_edge_quota(current_user.id, plan, db)
            if not edge_quota["allowed"]:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail={
                        "code": "edge_plan_not_eligible"
                        if edge_quota.get("reason") == "plan_not_eligible"
                        else "edge_quota_blocked",
                        "message": "Edge TTS chat requires Pro or Expert plan.",
                        "reason": edge_quota.get("reason"),
                    },
                )

        # Generate a session_id (no Stripe metered events here)
        import secrets
        from datetime import datetime, timedelta, timezone
        edge_session_id = f"sess_edge_{secrets.token_hex(8)}"
        return VoiceSessionResponse(
            session_id=edge_session_id,
            signed_url="",
            agent_id="",
            conversation_token=None,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
            quota_remaining_minutes=float(edge_quota["minutes_remaining"]) if not is_admin else 999999.0,
            max_session_minutes=120,  # 2h soft cap per session for Edge half-duplex
            input_mode="ptt",
            ptt_key=" ",
            playback_rate=1.0,
            is_streaming=False,
            is_trial=False,
            max_minutes=None,
            summary_id=request.summary_id,
            edge_endpoint="/api/voice/edge/turn",
        )
    # ── END EDGE TTS BRANCH ───────────────────────────────────────────
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd backend && python -m pytest tests/test_edge_tts.py -k "post_session_provider" -v`
Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py backend/tests/test_edge_tts.py
git commit -m "feat(voice): route /api/voice/session by provider field (edge_tts vs elevenlabs)"
```

---

### Task 7: Frontend hook `useVoiceChatEdge` (MediaRecorder Opus + fetch streaming)

**Files:**

- Create: `frontend/src/components/voice/useVoiceChatEdge.ts`
- Modify: `frontend/src/services/api.ts`
- Test: `frontend/src/components/voice/__tests__/useVoiceChatEdge.test.tsx`

- [ ] **Step 1: Ajouter les helpers API**

Dans `frontend/src/services/api.ts`, dans l'objet `voiceApi` (chercher `voiceApi = {`), ajouter :

```typescript
  /** Start a half-duplex Edge TTS voice session. */
  startEdgeSession: async (params: {
    summaryId?: number;
    debateId?: number;
    language?: "fr" | "en";
    agentType?: string;
  }): Promise<{
    session_id: string;
    edge_endpoint: string;
    quota_remaining_minutes: number;
    max_session_minutes: number;
  }> => {
    const resp = await api.post("/api/voice/session", {
      summary_id: params.summaryId,
      debate_id: params.debateId,
      language: params.language ?? "fr",
      agent_type: params.agentType ?? "explorer",
      provider: "edge_tts",
    });
    return resp.data;
  },

  /** Get rolling 30-day Edge TTS fair-use status. */
  getEdgeQuota: async (): Promise<{
    minutes_used: number;
    minutes_remaining: number;
    fair_use_cap: number;
    over_fair_use: boolean;
    warning?: string | null;
    rolling_period_start: string;
    rolling_period_end: string;
    allowed: boolean;
    reason?: string | null;
  }> => {
    const resp = await api.get("/api/voice/edge/quota");
    return resp.data;
  },

  /** POST one Edge TTS turn (audio in, audio/mpeg out). Returns Blob. */
  sendEdgeTurn: async (params: {
    sessionId: string;
    audio: Blob;
    language: "fr" | "en";
    gender: "female" | "male";
    voiceId?: string;
  }): Promise<Blob> => {
    const fd = new FormData();
    fd.append("audio", params.audio, "turn.webm");
    fd.append("session_id", params.sessionId);
    fd.append("language", params.language);
    fd.append("gender", params.gender);
    if (params.voiceId) fd.append("voice_id", params.voiceId);

    const token = getAccessToken();
    const resp = await fetch(`${API_URL}/api/voice/edge/turn`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.detail?.message || `Edge turn failed: ${resp.status}`);
    }
    return await resp.blob();
  },
```

- [ ] **Step 2: Écrire le test failing pour le hook**

Créer `frontend/src/components/voice/__tests__/useVoiceChatEdge.test.tsx` :

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useVoiceChatEdge } from "../useVoiceChatEdge";

// Minimal MediaRecorder polyfill for jsdom
class FakeMediaRecorder {
  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["fake-audio"], { type: "audio/webm" }),
    });
    this.onstop?.();
  }
}

beforeEach(() => {
  // @ts-expect-error polyfill
  global.MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
    configurable: true,
  });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: async () =>
      new Blob([new Uint8Array([0xff, 0xfb, 0x90])], { type: "audio/mpeg" }),
  });
  // mock URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => "blob:fake");
});

describe("useVoiceChatEdge", () => {
  it("starts in idle status", () => {
    const { result } = renderHook(() => useVoiceChatEdge({ summaryId: 1 }));
    expect(result.current.status).toBe("idle");
  });

  it("transitions to listening on start()", async () => {
    // mock startEdgeSession call
    vi.doMock("../../../services/api", () => ({
      voiceApi: {
        startEdgeSession: vi.fn().mockResolvedValue({
          session_id: "sess_x",
          edge_endpoint: "/api/voice/edge/turn",
          quota_remaining_minutes: 100,
          max_session_minutes: 120,
        }),
        sendEdgeTurn: vi.fn(),
      },
      API_URL: "",
      getAccessToken: () => "tok",
    }));

    const { result } = renderHook(() => useVoiceChatEdge({ summaryId: 1 }));
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe("listening"));
  });

  it("emits a reply blob URL after pushTurn()", async () => {
    const { result } = renderHook(() => useVoiceChatEdge({ summaryId: 1 }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.pushTurn();
    });
    await waitFor(() =>
      expect(result.current.lastReplyAudioUrl).toBe("blob:fake"),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/useVoiceChatEdge.test.tsx`
Expected: FAIL — module `useVoiceChatEdge` not found.

- [ ] **Step 4: Implémenter le hook**

Créer `frontend/src/components/voice/useVoiceChatEdge.ts` :

```typescript
/**
 * useVoiceChatEdge — Hook half-duplex pour le provider Edge TTS (Microsoft).
 *
 * Différent de useVoiceChat (ElevenLabs WebSocket) : ici, le frontend
 * enregistre du micro en MediaRecorder Opus, POSTe le blob, reçoit du
 * audio/mpeg en réponse, et le joue via un <audio> caché.
 *
 * Turn-taking côté client : PTT par défaut. Pas de VAD pour le V1.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { voiceApi } from "../../services/api";

export type EdgeStatus =
  | "idle"
  | "starting"
  | "listening"
  | "uploading"
  | "playing"
  | "error";

interface UseVoiceChatEdgeOptions {
  summaryId?: number;
  debateId?: number;
  language?: "fr" | "en";
  gender?: "female" | "male";
  agentType?: string;
  onError?: (msg: string) => void;
}

interface UseVoiceChatEdgeReturn {
  status: EdgeStatus;
  start: () => Promise<void>;
  stop: () => void;
  /** Mark current recording as the user turn and ship it. */
  pushTurn: () => Promise<void>;
  sessionId: string | null;
  quotaRemainingMinutes: number;
  /** Object URL of the latest agent reply audio. */
  lastReplyAudioUrl: string | null;
  errorMessage: string | null;
}

export function useVoiceChatEdge(
  opts: UseVoiceChatEdgeOptions,
): UseVoiceChatEdgeReturn {
  const [status, setStatus] = useState<EdgeStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quotaRemainingMinutes, setQuotaRemainingMinutes] = useState(0);
  const [lastReplyAudioUrl, setLastReplyAudioUrl] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    setStatus("starting");
    setErrorMessage(null);
    try {
      const session = await voiceApi.startEdgeSession({
        summaryId: opts.summaryId,
        debateId: opts.debateId,
        language: opts.language ?? "fr",
        agentType: opts.agentType,
      });
      setSessionId(session.session_id);
      setQuotaRemainingMinutes(session.quota_remaining_minutes);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start(100); // 100ms chunks for low latency

      setStatus("listening");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to start Edge session.";
      setErrorMessage(msg);
      setStatus("error");
      opts.onError?.(msg);
    }
  }, [opts]);

  const pushTurn = useCallback(async () => {
    if (!sessionId || !recorderRef.current) return;
    setStatus("uploading");
    try {
      // Stop recorder to flush chunks
      const recorder = recorderRef.current;
      const stopped = new Promise<void>((res) => {
        recorder.onstop = () => res();
      });
      recorder.stop();
      await stopped;

      const audio = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];

      const replyBlob = await voiceApi.sendEdgeTurn({
        sessionId,
        audio,
        language: opts.language ?? "fr",
        gender: opts.gender ?? "female",
      });

      const url = URL.createObjectURL(replyBlob);
      setLastReplyAudioUrl(url);
      setStatus("playing");

      // Restart recorder for the next user turn
      if (streamRef.current) {
        const next = new MediaRecorder(streamRef.current, {
          mimeType: "audio/webm;codecs=opus",
        });
        next.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorderRef.current = next;
        next.start(100);
        setStatus("listening");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Edge turn failed.";
      setErrorMessage(msg);
      setStatus("error");
      opts.onError?.(msg);
    }
  }, [sessionId, opts]);

  const stop = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      stop();
      if (lastReplyAudioUrl) URL.revokeObjectURL(lastReplyAudioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    start,
    stop,
    pushTurn,
    sessionId,
    quotaRemainingMinutes,
    lastReplyAudioUrl,
    errorMessage,
  };
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd frontend && npx vitest run src/components/voice/__tests__/useVoiceChatEdge.test.tsx`
Expected: 3 PASSED

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/voice/useVoiceChatEdge.ts frontend/src/components/voice/__tests__/useVoiceChatEdge.test.tsx frontend/src/services/api.ts
git commit -m "feat(voice): add useVoiceChatEdge hook + voiceApi.startEdgeSession/sendEdgeTurn/getEdgeQuota"
```

---

### Task 8: UI toggle provider dans `VoiceCallPage`

**Files:**

- Modify: `frontend/src/pages/VoiceCallPage.tsx` (ou `frontend/src/components/voice/VoiceCallPage.tsx` selon emplacement réel — vérifier avec `grep -n "VoiceCallPage" frontend/src` au moment d'exécuter)

- [ ] **Step 1: Localiser le bon fichier**

Run: `grep -rn "VoiceCallPage" frontend/src --include="*.tsx" | head -5`
Expected: identifier le path exact (visible dans le file listing initial : `frontend/src/components/voice/VoiceCallPage.tsx`).

- [ ] **Step 2: Ajouter le toggle provider**

Dans `frontend/src/components/voice/VoiceCallPage.tsx` (le fichier hero card), juste avant le rendu de `<AnalysisVoiceHero>` ou son équivalent (chercher "VoiceHero" ou "hero card" dans le fichier), ajouter un état provider et un toggle :

```typescript
import { useState, useEffect } from "react";
import { voiceApi } from "../../services/api";

// ... dans le composant
const [provider, setProvider] = useState<"elevenlabs" | "edge_tts">("elevenlabs");
const [edgeQuota, setEdgeQuota] = useState<{
  minutes_remaining: number;
  fair_use_cap: number;
  allowed: boolean;
  over_fair_use: boolean;
} | null>(null);

useEffect(() => {
  // Best-effort: fetch quota for the toggle badge. Ignore failures.
  voiceApi.getEdgeQuota()
    .then(setEdgeQuota)
    .catch(() => setEdgeQuota(null));
}, []);

// ... avant <AnalysisVoiceHero> ou bloc équivalent
<div className="mb-4 flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-xl">
  <button
    type="button"
    onClick={() => setProvider("elevenlabs")}
    aria-pressed={provider === "elevenlabs"}
    className={[
      "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
      provider === "elevenlabs"
        ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg"
        : "text-white/70 hover:bg-white/5",
    ].join(" ")}
  >
    <span>Premium (ElevenLabs)</span>
    <span className="ml-2 text-[10px] uppercase tracking-wide opacity-80">
      30 min restantes
    </span>
  </button>
  <button
    type="button"
    onClick={() => setProvider("edge_tts")}
    aria-pressed={provider === "edge_tts"}
    disabled={edgeQuota?.allowed === false}
    className={[
      "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
      provider === "edge_tts"
        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg"
        : "text-white/70 hover:bg-white/5",
    ].join(" ")}
    title={
      edgeQuota?.allowed === false
        ? "Edge TTS nécessite Pro ou Expert."
        : edgeQuota?.over_fair_use
        ? "Tu as dépassé la fair-use de 10 h ce mois."
        : "Free unlimited TTS by Microsoft Edge."
    }
  >
    <span>Edge TTS</span>
    <span className="ml-2 text-[10px] uppercase tracking-wide opacity-80">
      Gratuit illimité
    </span>
  </button>
</div>
```

Et passer `provider` au hook : remplacer

```tsx
const voice = useVoiceChat({...});
```

par un branch conditionnel :

```tsx
const elevenlabsVoice = useVoiceChat({
  summaryId,
  debateId,
  agentType,
  language,
});
const edgeVoice = useVoiceChatEdge({
  summaryId,
  debateId,
  agentType,
  language,
});
const voice = provider === "edge_tts" ? edgeVoice : elevenlabsVoice;
```

(Adapter selon la structure exacte du fichier : si `useVoiceChat` est appelé dans un sous-composant, hisser le toggle `provider` au niveau parent et le passer en prop.)

- [ ] **Step 3: Vérifier visuellement**

Run: `cd frontend && npm run dev` (port 5173)
Naviguer vers `/voice-call?summary_id=1` (ou équivalent) avec un compte Pro de test.
Expected: Voir le toggle apparaître au-dessus de la carte hero, avec deux pilules cliquables.
Vérifier la console : pas d'erreur React. Le bouton "Edge TTS" est désactivé pour un compte Free.

- [ ] **Step 4: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 0 erreurs TS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voice/VoiceCallPage.tsx
git commit -m "feat(voice): add provider toggle (Edge TTS vs ElevenLabs) in VoiceCallPage"
```

---

### Task 9: Smoke test E2E manuel — Edge call FR + EN + provider switch + fair-use

**Files:**

- Aucun fichier modifié — checklist de tests manuels avec un VPS staging ou dev local backend.

- [ ] **Step 1: Backend up + migrations appliquées**

Run (sur Hetzner VPS) : `ssh -i ~/.ssh/id_hetzner root@89.167.23.214 "docker exec repo-backend-1 alembic current"`
Expected: `013_voice_edge_quota (head)`

Run en local : `cd backend/src && uvicorn main:app --reload --port 8000` (laisser tourner)

- [ ] **Step 2: Test manuel Edge FR — depuis frontend dev**

Run : `cd frontend && npm run dev`

Étapes navigateur :

1. Login compte Pro de test
2. Aller sur `/voice-call?summary_id=<ID>`
3. Cliquer sur "Edge TTS"
4. Cliquer sur le bouton micro / espace (PTT)
5. Dire "Bonjour, parle-moi de cette vidéo"
6. Relâcher : pousser le turn

Expected:

- Console réseau : `POST /api/voice/edge/turn` 200 + body `audio/mpeg`
- Audio joué dans le navigateur (réponse Mistral en français)
- Header `X-Edge-Minutes-Used` présent

- [ ] **Step 3: Test manuel Edge EN**

Idem step 2 mais avec `?language=en` ou toggle langue, et phrase anglaise.
Expected: réponse en anglais, voice `en-US-AriaNeural`.

- [ ] **Step 4: Test manuel provider switch live**

Pendant un call Edge TTS actif :

1. Cliquer sur "Premium (ElevenLabs)"
2. Vérifier qu'un nouveau call ElevenLabs démarre (signed URL + WS)
3. Reswitch sur Edge TTS
4. Vérifier que le call Edge reprend sans crash UI

Expected: zéro fuite micro (vérifier indicateur navigateur micro éteint quand pas en call), zéro erreur console.

- [ ] **Step 5: Test manuel fair-use cap simulation**

Run (en local pgsql ou via shell asyncpg) :

```sql
UPDATE voice_edge_quota SET minutes_used = 605 WHERE user_id = <ID_TEST_PRO>;
```

Recharger la page voice-call.
Expected:

- Toggle Edge TTS reste cliquable (cap soft)
- Au turn suivant, header de réponse `X-Edge-Warning: fair_use_exceeded` présent
- UI affiche un toast/banner "Tu as dépassé 10 h..." (à câbler dans Task 8 si pas déjà fait — sinon vérifier au moins via DevTools)

- [ ] **Step 6: Smoke backend health**

Run : `curl -s http://localhost:8000/api/voice/edge/quota -H "Authorization: Bearer <TOKEN>" | jq .`
Expected: payload JSON avec `fair_use_cap: 600`

Run : `cd backend && python -m pytest tests/test_edge_tts.py -v`
Expected: tous les tests passent (>= 18 tests si les tasks précédentes ont été exécutées)

- [ ] **Step 7: Commit (commits déjà faits aux tasks précédentes — rien à commit ici)**

Si des micro-fixes UI émergent du smoke test, faire un commit `chore(voice): polish Edge TTS toggle after smoke test`.

---

## Self-Review

### 1. Spec coverage

| Brief item                                                 | Task                        |
| ---------------------------------------------------------- | --------------------------- |
| Migration Alembic 013 + modèle                             | Task 1                      |
| edge-tts package + wrapper provider FR/EN                  | Task 2                      |
| edge_quota_service consume/check/fair-use                  | Task 3                      |
| Schemas Provider literal + edge_endpoint                   | Task 4                      |
| POST /api/voice/edge/turn (audio in → STT → Mistral → TTS) | Task 5                      |
| GET /api/voice/edge/quota                                  | Task 5                      |
| Extend /api/voice/session avec routing par provider        | Task 6                      |
| Frontend useVoiceChatEdge hook                             | Task 7                      |
| API client startEdgeSession/getEdgeQuota/sendEdgeTurn      | Task 7                      |
| UI toggle provider dans VoiceCallPage avec badges          | Task 8                      |
| Smoke E2E manuel                                           | Task 9                      |
| Pytest test_edge_tts.py                                    | Tasks 1-6 (incrémental TDD) |
| Vitest useVoiceChatEdge.test.tsx                           | Task 7                      |

Couvert. RAS.

### 2. Placeholder scan

- Aucun "TBD"/"TODO"/"implement later" dans le plan.
- Code complet dans chaque step (signatures, types, blocs entiers).
- Commandes de run/expected output explicites.
- `call_mistral_simple` adressé avec un fallback explicite (Task 5 step 3 note).

### 3. Type consistency

- `Provider` literal : `"elevenlabs" | "edge_tts"` cohérent backend (`schemas.py`) + frontend (`useVoiceChatEdge.ts` + UI toggle).
- `EdgeQuotaResponse` shape : champs identiques entre `get_edge_status()` (Task 3), schema Pydantic (Task 4), client TS (Task 7), et UI (Task 8).
- `EdgeTurnRequest` : champs `session_id, language, gender, voice_id` identiques entre Task 4 et Task 5 + Task 7.
- `consume_edge_minutes(user_id, minutes, db)` signature stable Task 3 → Task 5.
- `resolve_voice(language, gender)` signature stable Task 2 → Task 5.

### Décisions à confirmer (à présenter à l'utilisateur AVANT exécution)

| ID     | Décision                              | Recommandation par défaut                                                                                                                                                                                                        |
| ------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Voix Edge TTS par défaut FR/EN        | FR : `fr-FR-DeniseNeural` (♀) + `fr-FR-HenriNeural` (♂) ; EN : `en-US-AriaNeural` (♀) + `en-US-GuyNeural` (♂)                                                                                                                    |
| **D2** | Fair-use cap rolling 30j              | 600 minutes (10h). Confirmer ou ajuster (300/450/900) selon coût Whisper accepté.                                                                                                                                                |
| **D3** | Mobile/Extension scope                | Hors scope (H6 — Web d'abord). Ajouter un task 10/11 mobile + extension dans un follow-up plan ?                                                                                                                                 |
| **D4** | Branche git                           | `feature/audit-kimi-plans-2026-04-29` (donnée dans le brief). Confirmer pas de worktree dédié séparé.                                                                                                                            |
| **D5** | Latence acceptable Edge vs ElevenLabs | Edge TTS half-duplex : TTFB ~800-1500 ms (STT + Mistral + TTS) vs ElevenLabs WS ~300-600 ms. Acceptable pour le V1 ? Si non : streamer la réponse Mistral token-par-token vers Edge TTS chunks (refactor possible mais hors V1). |

---

## Execution Handoff

Plan complet et sauvegardé dans `docs/superpowers/plans/2026-04-29-edge-tts-gratuit.md`. Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — Je dispatche un sous-agent frais par tâche, review entre tâches, itération rapide
2. **Inline Execution** — Exécution des tâches dans cette session via executing-plans, exécution batch avec checkpoints

Avant d'exécuter : confirmer **D1 voix par défaut**, **D2 fair-use 600 min**, **D3 mobile/extension**, **D4 branche**, **D5 latence acceptable**.

Quelle approche ?
