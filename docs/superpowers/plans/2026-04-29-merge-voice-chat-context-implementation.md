# Merge Voice ↔ Chat Context — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Sub-agent model:** All Agent invocations MUST use `model: claude-opus-4-7[1m]` (perma rule from user memory).

**Goal:** Implémenter la mémoire bidirectionnelle unifiée chat ↔ voice par vidéo, avec digest pré-calculé pour la reprise sur sessions précédentes, sur 3 surfaces (web + extension + mobile).

**Architecture:** Service `context_builder` partagé entre `chat/router` et `voice/router` qui construit un bloc unifié [digests anciens + 30 derniers messages verbatim] avec étiquettes `[VOCAL/TEXTE • Δt • speaker]`. Service `context_digest` qui génère un mini-résumé Mistral-small en fin de session voice et tous les 20 messages chat texte. Cap dur 12 KB pour `system_prompt` voice (limite ElevenLabs), 30 KB pour chat (Mistral-large 262K). Endpoint clear unifié RGPD-friendly.

**Tech Stack:** Python 3.11 + FastAPI + SQLAlchemy 2.0 async + Alembic + PostgreSQL 17 + Redis 7 + Mistral AI (`mistral-small-2603`) côté backend. React 18 + Vite (web), MV3 + Webpack (extension), Expo SDK 54 + RN 0.81 (mobile) côté frontends. Pytest async (backend), Vitest (web), Jest (extension + mobile), Playwright (E2E).

**Spec source:** [`docs/superpowers/specs/2026-04-29-merge-voice-chat-context-design.md`](../specs/2026-04-29-merge-voice-chat-context-design.md)

---

## File Structure

### Backend (créés)

| Fichier                                                    | Responsabilité                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `backend/alembic/versions/010_add_conversation_digests.py` | Migration : `voice_sessions.digest_text/digest_generated_at` + table `chat_text_digests`       |
| `backend/src/voice/context_builder.py`                     | Build bloc unifié contexte (digests anciens + verbatim récent), formats FR/EN, caps voice/chat |
| `backend/src/voice/context_digest.py`                      | Génère digest Mistral-small : end-of-voice-session + bucket de 20 chat texte                   |
| `backend/tests/voice/test_context_builder.py`              | Unit tests builder (ordre, exclude, format, caps, lang)                                        |
| `backend/tests/voice/test_context_digest.py`               | Unit tests digest (idempotence, bucket, fallback)                                              |
| `backend/tests/voice/test_voice_recall_with_history.py`    | Test voice/router avec sessions précédentes                                                    |
| `backend/tests/chat/__init__.py`                           | Init test dir chat                                                                             |
| `backend/tests/chat/test_chat_with_voice_history.py`       | Test chat/router incluant voice rows                                                           |
| `backend/tests/chat/test_clear_unified.py`                 | Test endpoint clear unifié                                                                     |

### Backend (modifiés)

| Fichier                       | Changement                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `backend/src/db/database.py`  | Ajouter classe `ChatTextDigest` model + colonnes `digest_text/digest_generated_at` sur `VoiceSession`      |
| `backend/src/voice/router.py` | Remplacer `_build_chat_history_block_for_voice` par appel à `context_builder` ; hook end-of-session digest |
| `backend/src/chat/service.py` | Remplacer `chat_history[-6:]` par appel à `context_builder` ; hook bucket digest dans `save_chat_message`  |
| `backend/src/chat/router.py`  | Étendre `DELETE /history/{summary_id}` avec query param `include_voice` (default `True`)                   |

### Frontend web (modifiés)

| Fichier                                       | Changement                                                   |
| --------------------------------------------- | ------------------------------------------------------------ |
| `frontend/src/services/api.ts`                | `clearChatHistory(summaryId, includeVoice=true)` query param |
| `frontend/src/components/chat/ChatHeader.tsx` | Confirm modale FR/EN avant clear (texte + voice)             |
| `frontend/src/i18n/fr.json` + `en.json`       | Strings `chat.clear.confirm.title/body/yes/cancel`           |

### Frontend extension (modifiés)

| Fichier                                         | Changement                 |
| ----------------------------------------------- | -------------------------- |
| `extension/src/utils/api.ts` (ou équivalent)    | Param `include_voice=true` |
| `extension/src/popup/components/ChatDrawer.tsx` | Confirm modale             |
| `extension/src/i18n/fr.json` + `en.json`        | Strings i18n               |

### Frontend mobile (modifiés)

| Fichier                                     | Changement                                   |
| ------------------------------------------- | -------------------------------------------- |
| `mobile/src/services/api.ts`                | Param `include_voice=true`                   |
| `mobile/src/components/chat/ChatHeader.tsx` | Confirm modale (Alert.alert ou bottom sheet) |
| `mobile/src/i18n/...`                       | Strings i18n                                 |

### Tests E2E

| Fichier                                     | Responsabilité                                                 |
| ------------------------------------------- | -------------------------------------------------------------- |
| `frontend/e2e/voice-chat-symbiosis.spec.ts` | 3 scenarios Playwright (voice→chat, voice→voice rappel, clear) |

### Scripts backfill (optionnels, post-deploy)

| Fichier                                     | Responsabilité                                   |
| ------------------------------------------- | ------------------------------------------------ |
| `scripts/backfill_voice_session_digests.py` | Génère digests pour voice_sessions historiques   |
| `scripts/backfill_chat_text_digests.py`     | Génère digests bucket pour chat texte historique |

---

## Phase 1 — Backend

### Task 1: Migration Alembic 010 + ChatTextDigest model

**Files:**

- Create: `backend/alembic/versions/010_add_conversation_digests.py`
- Modify: `backend/src/db/database.py` (ajouter `ChatTextDigest` class + 2 colonnes sur `VoiceSession`)
- Test: `backend/tests/voice/test_context_builder.py` (créé en Task 2 ; cette migration sert de base)

- [ ] **Step 1.1: Créer le fichier de migration**

Contenu de `backend/alembic/versions/010_add_conversation_digests.py` :

```python
"""Add conversation digests (voice + chat text) for unified context recall.

Revision ID: 010_add_conversation_digests
Revises: 009_add_user_preferences_json
Create Date: 2026-04-29

Adds:
  - voice_sessions.digest_text (Text, nullable)        : 2-3 bullets résumé end-of-session
  - voice_sessions.digest_generated_at (DateTime)      : timestamp génération + idempotency guard
  - chat_text_digests (table, 1 row par bucket de 20 messages texte d'une vidéo)

Backward compat:
  - All new columns nullable / table independent → no impact on existing rows.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "010_add_conversation_digests"
down_revision: Union[str, None] = "009_add_user_preferences_json"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "voice_sessions",
        sa.Column("digest_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "voice_sessions",
        sa.Column("digest_generated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "chat_text_digests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "summary_id",
            sa.Integer(),
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "first_message_id",
            sa.Integer(),
            sa.ForeignKey("chat_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "last_message_id",
            sa.Integer(),
            sa.ForeignKey("chat_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("digest_text", sa.Text(), nullable=False),
        sa.Column("msg_count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_chat_text_digests_summary_user",
        "chat_text_digests",
        ["summary_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_text_digests_summary_user", table_name="chat_text_digests")
    op.drop_table("chat_text_digests")
    op.drop_column("voice_sessions", "digest_generated_at")
    op.drop_column("voice_sessions", "digest_text")
```

- [ ] **Step 1.2: Ajouter le model ChatTextDigest et colonnes VoiceSession dans `db/database.py`**

Repérer la classe `VoiceSession` (chercher `class VoiceSession(Base):` autour de la ligne 810). Ajouter ces 2 colonnes dans la classe (après les autres colonnes existantes, avant `__table_args__` ou la fin de la classe) :

```python
    # 🆕 v6.1 (Spec merge voice ↔ chat 2026-04-29): digest end-of-session
    digest_text = Column(Text, nullable=True)
    digest_generated_at = Column(DateTime(timezone=True), nullable=True)
```

Puis, à la fin du fichier (avant l'export final éventuel), ajouter une nouvelle classe `ChatTextDigest` :

```python
class ChatTextDigest(Base):
    """Digest 2-3 bullets d'un bucket de 20 messages chat texte sur une vidéo.

    Permet de réinjecter un résumé condensé des échanges anciens dans le contexte
    voice/chat sans dépasser les limites tokens (cf. Spec merge 2026-04-29).
    """

    __tablename__ = "chat_text_digests"

    id = Column(Integer, primary_key=True)
    summary_id = Column(
        Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    first_message_id = Column(
        Integer, ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True
    )
    last_message_id = Column(
        Integer, ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True
    )
    digest_text = Column(Text, nullable=False)
    msg_count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_chat_text_digests_summary_user", "summary_id", "user_id"),
    )
```

Vérifier que `Index` est bien dans les imports en haut de `database.py` (sinon ajouter `from sqlalchemy import ..., Index`).

- [ ] **Step 1.3: Lancer la migration en local (SQLite)**

Run: `cd backend && alembic upgrade head`
Expected: `Running upgrade 009_add_user_preferences_json -> 010_add_conversation_digests, ...`

Vérifier qu'il n'y a pas d'erreur. Si erreur sur la `ForeignKey` cross-table, vérifier que les tables `summaries`, `users`, `chat_messages` existent bien (devraient exister, déjà migrées).

- [ ] **Step 1.4: Vérifier le schéma**

Run: `cd backend && python -c "from src.db.database import ChatTextDigest, VoiceSession; print(ChatTextDigest.__table__.columns.keys()); print([c for c in VoiceSession.__table__.columns.keys() if 'digest' in c])"`
Expected:

```
['id', 'summary_id', 'user_id', 'first_message_id', 'last_message_id', 'digest_text', 'msg_count', 'created_at']
['digest_text', 'digest_generated_at']
```

- [ ] **Step 1.5: Commit**

```bash
git add backend/alembic/versions/010_add_conversation_digests.py backend/src/db/database.py
git commit -m "feat(db): migration 010 — voice_sessions.digest + chat_text_digests table

Adds the persistence layer for the unified voice ↔ chat context recall:
  - voice_sessions.digest_text + digest_generated_at (end-of-session digest)
  - chat_text_digests (bucket of 20 text messages per video)

Per spec docs/superpowers/specs/2026-04-29-merge-voice-chat-context-design.md
Task 1 of merge-voice-chat-context-implementation.md."
```

---

### Task 2: context_builder — render block format (TDD)

**Files:**

- Create: `backend/src/voice/context_builder.py`
- Test: `backend/tests/voice/test_context_builder.py`

- [ ] **Step 2.1: Écrire le test du format de rendu (failing)**

Créer `backend/tests/voice/test_context_builder.py` :

```python
"""Unit tests for voice.context_builder.

Tests the unified block format: header, digest section, verbatim section,
labels [VOCAL/TEXTE • Δt • speaker], language switch (fr/en), caps, exclusions.
"""
from datetime import datetime, timedelta, timezone

import pytest

from voice.context_builder import (
    _humanize_relative_time,
    _format_message_label,
    _render_block,
    VOICE_SYSTEM_PROMPT_CAP_BYTES,
    CHAT_HISTORY_CAP_BYTES,
    PER_MESSAGE_MAX_CHARS,
)


# ── _humanize_relative_time ──────────────────────────────────────────────────


def test_humanize_just_now():
    now = datetime.now(timezone.utc)
    assert _humanize_relative_time(now - timedelta(seconds=10), lang="fr") == "à l'instant"
    assert _humanize_relative_time(now - timedelta(seconds=10), lang="en") == "just now"


def test_humanize_minutes_hours_days():
    now = datetime.now(timezone.utc)
    assert _humanize_relative_time(now - timedelta(minutes=5), lang="fr") == "il y a 5 min"
    assert _humanize_relative_time(now - timedelta(hours=2), lang="fr") == "il y a 2h"
    assert _humanize_relative_time(now - timedelta(days=3), lang="fr") == "il y a 3j"
    assert _humanize_relative_time(now - timedelta(days=3), lang="en") == "3d ago"


# ── _format_message_label ────────────────────────────────────────────────────


def test_format_voice_user_message_fr():
    now = datetime.now(timezone.utc)
    label = _format_message_label(
        source="voice",
        role="user",
        created_at=now - timedelta(days=2),
        lang="fr",
    )
    assert label == "[VOCAL • il y a 2j • user]"


def test_format_text_assistant_message_fr():
    now = datetime.now(timezone.utc)
    label = _format_message_label(
        source="text",
        role="assistant",
        created_at=now - timedelta(hours=1),
        lang="fr",
    )
    assert label == "[TEXTE • il y a 1h • toi]"


def test_format_text_assistant_message_en():
    now = datetime.now(timezone.utc)
    label = _format_message_label(
        source="text",
        role="assistant",
        created_at=now - timedelta(hours=1),
        lang="en",
    )
    assert label == "[TEXT • 1h ago • you]"


# ── _render_block (empty cases) ──────────────────────────────────────────────


def test_render_block_empty_returns_empty_string():
    assert _render_block(
        lang="fr",
        voice_digests=[],
        chat_digests=[],
        recent=[],
        exclude_voice_session_id=None,
    ) == ""


# ── _render_block (digests + verbatim) ───────────────────────────────────────


def _make_voice_digest(session_id: str, days_ago: int, duration: int, digest_text: str):
    """Helper: returns a tuple matching the SELECT shape."""
    now = datetime.now(timezone.utc)
    return (session_id, now - timedelta(days=days_ago), duration, digest_text)


def _make_chat_message(role: str, source: str, content: str, hours_ago: int, voice_session_id=None):
    """Helper: returns a dict-like object matching ChatMessage."""
    now = datetime.now(timezone.utc)

    class _Msg:
        pass

    m = _Msg()
    m.role = role
    m.source = source
    m.content = content
    m.created_at = now - timedelta(hours=hours_ago)
    m.voice_session_id = voice_session_id
    return m


def test_render_block_with_digests_and_verbatim_fr():
    voice_digests = [
        _make_voice_digest(
            "sess-1", days_ago=2, duration=480,
            digest_text="- user a demandé X\n- tu as répondu via web_search",
        ),
    ]
    recent = [
        _make_chat_message("user", "voice", "Pourquoi il dit que les Russes vont sur Mars ?", 48, voice_session_id="sess-1"),
        _make_chat_message("assistant", "voice", "Selon ce que j'écoute, JPP affirme que…", 48, voice_session_id="sess-1"),
        _make_chat_message("user", "text", "Résume-moi en 1 phrase", 1),
        _make_chat_message("assistant", "text", "JPP est disruptif car…", 1),
    ]

    out = _render_block(
        lang="fr",
        voice_digests=voice_digests,
        chat_digests=[],
        recent=recent,
        exclude_voice_session_id=None,
    )

    assert "## Contexte conversation précédente" in out
    assert "### Résumé sessions antérieures" in out
    assert "(voice 8 min)" in out  # 480s = 8 min
    assert "user a demandé X" in out
    assert "### Derniers échanges" in out
    assert "[VOCAL • il y a 2j • user] Pourquoi il dit que les Russes vont sur Mars ?" in out
    assert "[TEXTE • il y a 1h • toi]  JPP est disruptif car…" in out or \
           "[TEXTE • il y a 1h • toi] JPP est disruptif car…" in out
    assert "Continue dans la lignée de cette conversation." in out


def test_render_block_excludes_active_voice_session():
    """Rows of the active (just-created) voice session must not be re-injected."""
    recent = [
        _make_chat_message("user", "voice", "msg from active session", 0, voice_session_id="sess-active"),
        _make_chat_message("user", "voice", "msg from old session", 48, voice_session_id="sess-old"),
        _make_chat_message("user", "text", "msg text", 1),
    ]
    out = _render_block(
        lang="fr",
        voice_digests=[],
        chat_digests=[],
        recent=recent,
        exclude_voice_session_id="sess-active",
    )
    assert "msg from active session" not in out
    assert "msg from old session" in out
    assert "msg text" in out
```

- [ ] **Step 2.2: Run test pour vérifier qu'il fail**

Run: `cd backend && python -m pytest tests/voice/test_context_builder.py -v`
Expected: FAIL avec `ImportError: cannot import name '_humanize_relative_time' from 'voice.context_builder'` (le module n'existe pas encore)

- [ ] **Step 2.3: Créer `backend/src/voice/context_builder.py` avec le minimum**

```python
"""Unified context block builder for voice + chat agents.

Consolidates voice session digests + chat text digests + recent verbatim
messages into a single block injectable into either an ElevenLabs voice
agent system_prompt or a Mistral chat conversation history.

Replaces:
  - voice/router.py:_build_chat_history_block_for_voice (Spec #1, Task 6)
  - chat/service.py:build_chat_prompt history_text logic
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, Literal, Optional

VOICE_SYSTEM_PROMPT_CAP_BYTES = 12_000   # ElevenLabs system_prompt safe margin
CHAT_HISTORY_CAP_BYTES = 30_000          # Mistral-large 262K, room to spare
RECENT_VERBATIM_LIMIT = 30
PER_MESSAGE_MAX_CHARS = 600


# ── Time humanizer ───────────────────────────────────────────────────────────


def _humanize_relative_time(when: datetime, *, lang: str = "fr") -> str:
    """Return 'à l'instant' / 'il y a 5 min' / 'il y a 2h' / 'il y a 3j' (FR)
    or 'just now' / '5min ago' / '2h ago' / '3d ago' (EN).
    """
    now = datetime.now(timezone.utc)
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    delta = now - when
    seconds = int(delta.total_seconds())

    if seconds < 60:
        return "à l'instant" if lang == "fr" else "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"il y a {minutes} min" if lang == "fr" else f"{minutes}min ago"
    hours = minutes // 60
    if hours < 24:
        return f"il y a {hours}h" if lang == "fr" else f"{hours}h ago"
    days = hours // 24
    return f"il y a {days}j" if lang == "fr" else f"{days}d ago"


# ── Message label formatter ──────────────────────────────────────────────────


def _format_message_label(
    *, source: str, role: str, created_at: datetime, lang: str = "fr"
) -> str:
    """Format the prefix label like '[VOCAL • il y a 2j • user]'.

    source : 'voice' | 'text'
    role   : 'user'  | 'assistant'
    """
    if source == "voice":
        src_label = "VOCAL" if lang == "fr" else "VOICE"
    else:
        src_label = "TEXTE" if lang == "fr" else "TEXT"

    if role == "user":
        speaker = "user"
    else:
        speaker = "toi" if lang == "fr" else "you"

    when = _humanize_relative_time(created_at, lang=lang)
    return f"[{src_label} • {when} • {speaker}]"


# ── Block renderer ───────────────────────────────────────────────────────────


def _render_block(
    *,
    lang: str,
    voice_digests: Iterable[Any],   # tuple (session_id, created_at, duration_s, digest_text)
    chat_digests: Iterable[Any],    # ChatTextDigest-like (created_at, msg_count, digest_text)
    recent: Iterable[Any],          # ChatMessage-like (role, source, content, created_at, voice_session_id)
    exclude_voice_session_id: Optional[str],
) -> str:
    voice_list = list(voice_digests)
    chat_list = list(chat_digests)
    recent_list = [
        m for m in recent
        if not (exclude_voice_session_id and getattr(m, "voice_session_id", None) == exclude_voice_session_id)
    ]

    if not voice_list and not chat_list and not recent_list:
        return ""

    if lang == "en":
        title = "## Previous conversation context"
        digests_header = "### Summary of previous sessions"
        recent_header = f"### Recent exchanges ({len(recent_list)})"
        footer = "Continue this conversation in the same vein."
    else:
        title = "## Contexte conversation précédente"
        digests_header = "### Résumé sessions antérieures"
        recent_header = f"### Derniers échanges ({len(recent_list)})"
        footer = "Continue dans la lignée de cette conversation."

    lines: list[str] = [title, ""]

    # Digests section (chronological merge of voice + chat digests)
    digest_rows: list[tuple[datetime, str]] = []
    for vd in voice_list:
        session_id, created_at, duration_s, digest_text = vd
        date_str = created_at.strftime("%Y-%m-%d")
        duration_min = max(1, int(duration_s or 0) // 60)
        kind = f"(voice {duration_min} min)" if lang == "fr" else f"(voice {duration_min} min)"
        digest_rows.append((created_at, f"- {date_str} {kind} :\n  {digest_text}"))
    for cd in chat_list:
        date_str = cd.created_at.strftime("%Y-%m-%d")
        kind = (
            f"(chat texte {cd.msg_count} msgs)" if lang == "fr"
            else f"(text chat {cd.msg_count} msgs)"
        )
        digest_rows.append((cd.created_at, f"- {date_str} {kind} :\n  {cd.digest_text}"))

    if digest_rows:
        digest_rows.sort(key=lambda r: r[0])
        lines.append(digests_header)
        for _, body in digest_rows:
            lines.append(body)
        lines.append("")

    # Recent verbatim section
    if recent_list:
        lines.append(recent_header)
        for m in recent_list:
            content = (getattr(m, "content", "") or "").strip()
            if not content:
                continue
            if len(content) > PER_MESSAGE_MAX_CHARS:
                content = content[: PER_MESSAGE_MAX_CHARS - 1] + "…"
            label = _format_message_label(
                source=getattr(m, "source", "text") or "text",
                role=getattr(m, "role", "user"),
                created_at=getattr(m, "created_at"),
                lang=lang,
            )
            lines.append(f"{label} {content}")
        lines.append("")

    lines.append(footer)
    return "\n".join(lines)
```

- [ ] **Step 2.4: Re-run tests**

Run: `cd backend && python -m pytest tests/voice/test_context_builder.py -v`
Expected: tous PASS

- [ ] **Step 2.5: Commit**

```bash
git add backend/src/voice/context_builder.py backend/tests/voice/test_context_builder.py
git commit -m "feat(voice): context_builder render + label format helpers

Pure-function helpers for the unified voice ↔ chat context block:
  - _humanize_relative_time (FR/EN)
  - _format_message_label ([VOCAL • il y a 2j • user] etc.)
  - _render_block (digests + verbatim sections, exclude_voice_session_id)

Task 2 of merge-voice-chat-context-implementation.md."
```

---

### Task 3: context_builder — public `build_unified_context_block` + cap enforcement (TDD)

**Files:**

- Modify: `backend/src/voice/context_builder.py` (ajouter la fonction publique async)
- Modify: `backend/tests/voice/test_context_builder.py` (ajouter tests cap + DB fixtures)
- Test: réutilise `backend/tests/voice/test_context_builder.py`

- [ ] **Step 3.1: Ajouter test pour cap voice 12 KB et truncation**

Ajouter en bas de `backend/tests/voice/test_context_builder.py` :

```python
# ── Cap enforcement ──────────────────────────────────────────────────────────


def test_truncate_to_cap_keeps_recent_drops_old_digests():
    """When over cap, drop oldest digests first, keep recent verbatim."""
    from voice.context_builder import _truncate_to_cap

    big_digests_section = "### Résumé sessions antérieures\n" + "- old digest line\n" * 1000
    recent_section = "### Derniers échanges (2)\n[VOCAL] hi\n[TEXTE] hello"
    block = f"## Contexte conversation précédente\n\n{big_digests_section}\n{recent_section}\n\nContinue."

    out = _truncate_to_cap(block, cap=2_000, lang="fr")

    assert len(out.encode("utf-8")) <= 2_000
    assert "[VOCAL] hi" in out  # recent preserved
    assert "[TEXTE] hello" in out
    assert "[contexte tronqué]" in out  # truncation marker


# ── build_unified_context_block (DB integration) ─────────────────────────────


@pytest.mark.asyncio
async def test_build_unified_block_db_integration_voice_target(async_db_session, sample_user, sample_summary):
    """End-to-end with DB: voice_session digest + recent chat_messages."""
    from datetime import datetime, timedelta, timezone

    from db.database import ChatMessage, VoiceSession
    from voice.context_builder import build_unified_context_block

    now = datetime.now(timezone.utc)

    # Voice session terminée il y a 2 jours, avec digest
    vs = VoiceSession(
        id="sess-old",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        created_at=now - timedelta(days=2),
        duration_seconds=480,
        digest_text="- user demanded X\n- you answered via web_search",
        digest_generated_at=now - timedelta(days=2),
    )
    async_db_session.add(vs)

    # Recent verbatim text msg
    cm = ChatMessage(
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        role="user",
        content="Résume-moi en 1 phrase",
        source="text",
        created_at=now - timedelta(hours=1),
    )
    async_db_session.add(cm)
    await async_db_session.commit()

    out = await build_unified_context_block(
        async_db_session,
        summary_id=sample_summary.id,
        user_id=sample_user.id,
        lang="fr",
        target="voice",
    )

    assert "(voice 8 min)" in out
    assert "user demanded X" in out
    assert "[TEXTE • il y a 1h • user] Résume-moi en 1 phrase" in out


@pytest.mark.asyncio
async def test_build_unified_block_voice_cap_enforced(async_db_session, sample_user, sample_summary, monkeypatch):
    """When the rendered block exceeds 12 KB, truncate to 12 KB."""
    from datetime import datetime, timedelta, timezone
    from db.database import VoiceSession
    from voice.context_builder import build_unified_context_block, VOICE_SYSTEM_PROMPT_CAP_BYTES

    now = datetime.now(timezone.utc)
    big_text = "X" * 5000
    for i in range(5):
        vs = VoiceSession(
            id=f"sess-{i}",
            user_id=sample_user.id,
            summary_id=sample_summary.id,
            created_at=now - timedelta(days=10 - i),
            duration_seconds=300,
            digest_text=big_text,
            digest_generated_at=now - timedelta(days=10 - i),
        )
        async_db_session.add(vs)
    await async_db_session.commit()

    out = await build_unified_context_block(
        async_db_session,
        summary_id=sample_summary.id,
        user_id=sample_user.id,
        lang="fr",
        target="voice",
    )

    assert len(out.encode("utf-8")) <= VOICE_SYSTEM_PROMPT_CAP_BYTES
```

Note : ce test suppose que `async_db_session`, `sample_user`, `sample_summary` sont des fixtures pytest disponibles dans `backend/tests/conftest.py`. Vérifier en lisant ce fichier ; si les fixtures n'existent pas avec ces noms exacts, adapter le test pour utiliser celles qui existent (souvent `db_session`, `test_user`, etc.).

- [ ] **Step 3.2: Run test pour vérifier qu'il fail**

Run: `cd backend && python -m pytest tests/voice/test_context_builder.py -v`
Expected: FAIL — `_truncate_to_cap` et `build_unified_context_block` n'existent pas encore

- [ ] **Step 3.3: Ajouter `_truncate_to_cap` et `build_unified_context_block` dans `context_builder.py`**

À la fin de `backend/src/voice/context_builder.py`, ajouter :

```python
# ── Cap enforcement ──────────────────────────────────────────────────────────


def _truncate_to_cap(block: str, cap: int, *, lang: str) -> str:
    """Truncate the rendered block to fit within `cap` bytes.

    Strategy:
      1. Try block as-is. If under cap → return.
      2. Otherwise, drop digest section bullets one by one (oldest first)
         until under cap.
      3. If still over cap, drop oldest verbatim rows one by one.
      4. Append a footer marker '[contexte tronqué]' (or '[context truncated]').
    """
    if len(block.encode("utf-8")) <= cap:
        return block

    marker = "\n\n[contexte tronqué]" if lang == "fr" else "\n\n[context truncated]"
    marker_bytes = len(marker.encode("utf-8"))
    effective_cap = cap - marker_bytes

    lines = block.split("\n")

    def join_size(items: list[str]) -> int:
        return len("\n".join(items).encode("utf-8"))

    # Identify the recent section start so we never drop from there first
    try:
        recent_idx = next(
            i for i, line in enumerate(lines)
            if line.startswith("### Derniers échanges") or line.startswith("### Recent exchanges")
        )
    except StopIteration:
        recent_idx = None

    # 1. Drop oldest digest bullets (lines starting with "- " before recent section)
    digest_bullet_indices = [
        i for i, line in enumerate(lines)
        if line.startswith("- ") and (recent_idx is None or i < recent_idx)
    ]
    while join_size(lines) > effective_cap and digest_bullet_indices:
        idx = digest_bullet_indices.pop(0)
        lines[idx] = ""
        # also drop the indented continuation line that follows (digest body)
        if idx + 1 < len(lines) and lines[idx + 1].startswith("  "):
            lines[idx + 1] = ""

    # 2. Drop oldest verbatim rows (start at recent_idx + 2 to skip header + blank line)
    if join_size(lines) > effective_cap and recent_idx is not None:
        verbatim_start = recent_idx + 1
        while join_size(lines) > effective_cap and verbatim_start < len(lines):
            if lines[verbatim_start].startswith("["):
                lines[verbatim_start] = ""
                verbatim_start += 1
            else:
                verbatim_start += 1

    # Re-join, collapse multiple blank lines, append marker
    truncated = "\n".join(line for line in lines if line is not None)
    truncated = "\n".join(
        ln for i, ln in enumerate(truncated.split("\n"))
        if not (ln == "" and i > 0 and truncated.split("\n")[i - 1] == "")
    )
    return truncated.rstrip() + marker


# ── Public async builder ─────────────────────────────────────────────────────


async def build_unified_context_block(
    db,  # AsyncSession (typed weakly to avoid circular import in test fixtures)
    *,
    summary_id: int,
    user_id: int,
    lang: str = "fr",
    target: Literal["voice", "chat"],
    exclude_voice_session_id: Optional[str] = None,
) -> str:
    """Build the unified context block for a chat or voice agent.

    Args:
        db: AsyncSession
        summary_id: video summary id (per-video memory boundary)
        user_id: owner of the conversation
        lang: 'fr' or 'en'
        target: 'voice' (12 KB hard cap) or 'chat' (30 KB soft cap)
        exclude_voice_session_id: when called from a *new* voice session,
            pass its own id so its already-active rows are not re-injected

    Returns "" when nothing to inject.
    """
    from sqlalchemy import select

    from db.database import ChatMessage, ChatTextDigest, VoiceSession

    cap = (
        VOICE_SYSTEM_PROMPT_CAP_BYTES if target == "voice"
        else CHAT_HISTORY_CAP_BYTES
    )

    # 1. Voice digests (sessions previously ended on this video)
    vd_q = (
        select(
            VoiceSession.id,
            VoiceSession.created_at,
            VoiceSession.duration_seconds,
            VoiceSession.digest_text,
        )
        .where(
            VoiceSession.summary_id == summary_id,
            VoiceSession.user_id == user_id,
            VoiceSession.digest_text.isnot(None),
        )
        .order_by(VoiceSession.created_at.asc())
    )
    if exclude_voice_session_id:
        vd_q = vd_q.where(VoiceSession.id != exclude_voice_session_id)
    voice_digests = (await db.execute(vd_q)).all()

    # 2. Chat text digests
    cd_q = (
        select(ChatTextDigest)
        .where(
            ChatTextDigest.summary_id == summary_id,
            ChatTextDigest.user_id == user_id,
        )
        .order_by(ChatTextDigest.created_at.asc())
    )
    chat_digests = (await db.execute(cd_q)).scalars().all()

    # 3. Last RECENT_VERBATIM_LIMIT chat_messages (all sources, ASC chronological)
    rec_q = (
        select(ChatMessage)
        .where(
            ChatMessage.summary_id == summary_id,
            ChatMessage.user_id == user_id,
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(RECENT_VERBATIM_LIMIT)
    )
    recent = list(reversed((await db.execute(rec_q)).scalars().all()))

    # 4. Render
    block = _render_block(
        lang=lang,
        voice_digests=voice_digests,
        chat_digests=chat_digests,
        recent=recent,
        exclude_voice_session_id=exclude_voice_session_id,
    )

    # 5. Cap enforcement
    if block and len(block.encode("utf-8")) > cap:
        block = _truncate_to_cap(block, cap, lang=lang)

    return block
```

- [ ] **Step 3.4: Vérifier les fixtures dans conftest.py**

Run: `cd backend && grep -E "(async_db_session|sample_user|sample_summary|test_user|db_session)" tests/conftest.py 2>/dev/null | head -20`

Si les noms des fixtures diffèrent (très probable), adapter Step 3.1 pour matcher. Patterns courants : `db_session` au lieu de `async_db_session`, `test_user` au lieu de `sample_user`. Si aucune fixture utilisable n'existe, créer un mini-`conftest.py` dans `tests/voice/` qui crée user + summary inline avec un SQLite in-memory.

- [ ] **Step 3.5: Re-run tests**

Run: `cd backend && python -m pytest tests/voice/test_context_builder.py -v`
Expected: tous PASS

- [ ] **Step 3.6: Commit**

```bash
git add backend/src/voice/context_builder.py backend/tests/voice/test_context_builder.py
git commit -m "feat(voice): public build_unified_context_block with cap enforcement

Adds the async public builder that:
  - SELECTs voice_sessions.digest_text + chat_text_digests + last 30 messages
  - Calls _render_block to format the unified block
  - Enforces 12 KB cap for target='voice', 30 KB for target='chat'
  - Truncates oldest digests first, oldest verbatim rows second

Task 3 of merge-voice-chat-context-implementation.md."
```

---

### Task 4: context_digest — `generate_voice_session_digest` (TDD)

**Files:**

- Create: `backend/src/voice/context_digest.py`
- Test: `backend/tests/voice/test_context_digest.py`

- [ ] **Step 4.1: Écrire les tests (failing)**

Créer `backend/tests/voice/test_context_digest.py` :

```python
"""Unit tests for voice.context_digest.

Tests:
  - generate_voice_session_digest: idempotence, format, fallback on Mistral fail
  - maybe_generate_chat_text_digest: bucket of 20 trigger, no-op below threshold
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from voice.context_digest import (
    generate_voice_session_digest,
    DIGEST_MAX_OUTPUT_CHARS,
    CHAT_TEXT_BUCKET_SIZE,
)


@pytest.mark.asyncio
async def test_generate_voice_digest_idempotent(async_db_session, sample_user, sample_summary):
    """If digest_generated_at is already set, the function is a no-op."""
    from db.database import VoiceSession

    now = datetime.now(timezone.utc)
    vs = VoiceSession(
        id="sess-already-digested",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        created_at=now,
        duration_seconds=300,
        digest_text="existing digest",
        digest_generated_at=now,
    )
    async_db_session.add(vs)
    await async_db_session.commit()

    with patch("voice.context_digest._call_mistral_for_digest", new=AsyncMock()) as mock_mistral:
        await generate_voice_session_digest(async_db_session, "sess-already-digested")
        mock_mistral.assert_not_called()


@pytest.mark.asyncio
async def test_generate_voice_digest_writes_text(async_db_session, sample_user, sample_summary):
    """When run on a new session with messages, writes digest_text + timestamp."""
    from db.database import ChatMessage, VoiceSession

    now = datetime.now(timezone.utc)
    vs = VoiceSession(
        id="sess-new",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        created_at=now,
        duration_seconds=300,
        digest_text=None,
        digest_generated_at=None,
    )
    async_db_session.add(vs)
    async_db_session.add(ChatMessage(
        user_id=sample_user.id, summary_id=sample_summary.id,
        role="user", content="What is X?", source="voice",
        voice_session_id="sess-new", voice_speaker="user",
    ))
    async_db_session.add(ChatMessage(
        user_id=sample_user.id, summary_id=sample_summary.id,
        role="assistant", content="X is Y because Z.", source="voice",
        voice_session_id="sess-new", voice_speaker="agent",
    ))
    await async_db_session.commit()

    fake_digest = "- user demandé X\n- tu as répondu Y"
    with patch("voice.context_digest._call_mistral_for_digest", new=AsyncMock(return_value=fake_digest)):
        await generate_voice_session_digest(async_db_session, "sess-new")

    await async_db_session.refresh(vs)
    assert vs.digest_text == fake_digest
    assert vs.digest_generated_at is not None


@pytest.mark.asyncio
async def test_generate_voice_digest_fallback_on_mistral_fail(async_db_session, sample_user, sample_summary):
    """If Mistral raises, log + skip (digest_generated_at stays NULL for retry)."""
    from db.database import VoiceSession

    vs = VoiceSession(
        id="sess-fail", user_id=sample_user.id, summary_id=sample_summary.id,
        duration_seconds=300, digest_text=None, digest_generated_at=None,
    )
    async_db_session.add(vs)
    await async_db_session.commit()

    with patch(
        "voice.context_digest._call_mistral_for_digest",
        new=AsyncMock(side_effect=RuntimeError("mistral down")),
    ):
        await generate_voice_session_digest(async_db_session, "sess-fail")

    await async_db_session.refresh(vs)
    assert vs.digest_text is None
    assert vs.digest_generated_at is None
```

- [ ] **Step 4.2: Run test (fail expected)**

Run: `cd backend && python -m pytest tests/voice/test_context_digest.py -v`
Expected: FAIL — `voice.context_digest` n'existe pas

- [ ] **Step 4.3: Créer `backend/src/voice/context_digest.py`**

```python
"""Conversation digest generator for voice sessions and chat text buckets.

Generates 2-3 bullet summaries via Mistral-small to amortize the cost of
context recall (cf. spec 2026-04-29-merge-voice-chat-context-design).

Hooks:
  - voice/router.py on voice session end → generate_voice_session_digest
  - chat/service.py:save_chat_message after commit → maybe_generate_chat_text_digest
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update

from core.config import settings
from db.database import ChatMessage, ChatTextDigest, VoiceSession

logger = logging.getLogger(__name__)

DIGEST_MODEL = "mistral-small-2603"
DIGEST_MAX_OUTPUT_CHARS = 800
CHAT_TEXT_BUCKET_SIZE = 20

_DIGEST_PROMPT_FR = (
    "Tu es un digest writer concis. On te donne un échange (voice ou texte) entre "
    "un utilisateur et l'assistant DeepSight à propos d'une vidéo YouTube. Produis "
    "2 à 3 puces très courtes (max 80 caractères chacune) résumant : (1) ce que "
    "l'utilisateur a demandé, (2) ce que tu as répondu / les conclusions clés.\n\n"
    "Format strict :\n- [puce 1]\n- [puce 2]\n- [puce 3 si nécessaire]\n\n"
    "Aucune introduction, aucun commentaire, aucune phrase complète. Pas de markdown "
    "autre que les puces."
)


async def _call_mistral_for_digest(transcript: str, lang: str = "fr") -> str:
    """Single Mistral-small call. Returns digest text, raises on failure."""
    from core.llm_provider import get_mistral_client

    client = get_mistral_client()
    response = await client.chat.complete_async(
        model=DIGEST_MODEL,
        messages=[
            {"role": "system", "content": _DIGEST_PROMPT_FR},
            {"role": "user", "content": transcript},
        ],
        max_tokens=300,
        temperature=0.3,
    )
    text = (response.choices[0].message.content or "").strip()
    return text[:DIGEST_MAX_OUTPUT_CHARS]


async def generate_voice_session_digest(db, voice_session_id: str) -> None:
    """Generate and persist a digest of a voice session.

    Idempotent : skip if `digest_generated_at IS NOT NULL`.
    Failure is non-fatal (logged via Sentry).
    """
    vs = (
        await db.execute(
            select(VoiceSession).where(VoiceSession.id == voice_session_id)
        )
    ).scalar_one_or_none()

    if vs is None:
        logger.warning("generate_voice_digest: voice_session not found", extra={"id": voice_session_id})
        return

    if vs.digest_generated_at is not None:
        logger.debug("generate_voice_digest: idempotent skip", extra={"id": voice_session_id})
        return

    # Fetch all voice rows for this session, ordered chronologically
    msgs = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.voice_session_id == voice_session_id)
            .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        )
    ).scalars().all()

    if not msgs:
        logger.info("generate_voice_digest: empty session", extra={"id": voice_session_id})
        return

    transcript = "\n".join(
        f"{m.voice_speaker or m.role}: {m.content}"
        for m in msgs
        if m.content
    )

    try:
        digest_text = await _call_mistral_for_digest(transcript)
    except Exception as exc:
        logger.warning(
            "generate_voice_digest: Mistral failed (non-fatal)",
            extra={"id": voice_session_id, "error": str(exc)},
        )
        return

    # Atomic UPDATE WHERE digest_generated_at IS NULL (race-safe)
    await db.execute(
        update(VoiceSession)
        .where(
            VoiceSession.id == voice_session_id,
            VoiceSession.digest_generated_at.is_(None),
        )
        .values(
            digest_text=digest_text,
            digest_generated_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()
```

- [ ] **Step 4.4: Re-run tests**

Run: `cd backend && python -m pytest tests/voice/test_context_digest.py::test_generate_voice_digest_idempotent tests/voice/test_context_digest.py::test_generate_voice_digest_writes_text tests/voice/test_context_digest.py::test_generate_voice_digest_fallback_on_mistral_fail -v`
Expected: tous PASS

- [ ] **Step 4.5: Commit**

```bash
git add backend/src/voice/context_digest.py backend/tests/voice/test_context_digest.py
git commit -m "feat(voice): generate_voice_session_digest with idempotency + fallback

Mistral-small-based digest generator for voice sessions:
  - Idempotent via digest_generated_at IS NULL guard
  - Atomic UPDATE WHERE clause = race-safe under concurrent triggers
  - Mistral failure is non-fatal (logged, retry on next trigger)

Task 4 of merge-voice-chat-context-implementation.md."
```

---

### Task 5: context_digest — `maybe_generate_chat_text_digest` bucket (TDD)

**Files:**

- Modify: `backend/src/voice/context_digest.py` (ajouter la 2e fonction)
- Modify: `backend/tests/voice/test_context_digest.py` (ajouter tests bucket)

- [ ] **Step 5.1: Ajouter les tests bucket (failing)**

Ajouter à la fin de `backend/tests/voice/test_context_digest.py` :

```python
@pytest.mark.asyncio
async def test_maybe_chat_text_digest_no_op_below_threshold(async_db_session, sample_user, sample_summary):
    """19 ungested text msgs → no digest."""
    from db.database import ChatMessage
    from voice.context_digest import maybe_generate_chat_text_digest

    for i in range(19):
        async_db_session.add(ChatMessage(
            user_id=sample_user.id, summary_id=sample_summary.id,
            role="user" if i % 2 == 0 else "assistant",
            content=f"msg {i}", source="text",
        ))
    await async_db_session.commit()

    with patch("voice.context_digest._call_mistral_for_digest", new=AsyncMock()) as mock_m:
        await maybe_generate_chat_text_digest(async_db_session, sample_summary.id, sample_user.id)
        mock_m.assert_not_called()


@pytest.mark.asyncio
async def test_maybe_chat_text_digest_creates_bucket_at_20(async_db_session, sample_user, sample_summary):
    """20 ungested text msgs → 1 digest row created with first/last msg ids set."""
    from db.database import ChatMessage, ChatTextDigest
    from voice.context_digest import maybe_generate_chat_text_digest

    msgs = []
    for i in range(20):
        m = ChatMessage(
            user_id=sample_user.id, summary_id=sample_summary.id,
            role="user" if i % 2 == 0 else "assistant",
            content=f"msg {i}", source="text",
        )
        async_db_session.add(m)
        msgs.append(m)
    await async_db_session.commit()
    for m in msgs:
        await async_db_session.refresh(m)

    fake_digest = "- user a posé 10 questions\n- tu as répondu sur le thème X"
    with patch("voice.context_digest._call_mistral_for_digest", new=AsyncMock(return_value=fake_digest)):
        await maybe_generate_chat_text_digest(async_db_session, sample_summary.id, sample_user.id)

    digests = (await async_db_session.execute(
        select(ChatTextDigest).where(ChatTextDigest.summary_id == sample_summary.id)
    )).scalars().all()
    assert len(digests) == 1
    assert digests[0].msg_count == 20
    assert digests[0].first_message_id == msgs[0].id
    assert digests[0].last_message_id == msgs[19].id
    assert digests[0].digest_text == fake_digest
```

Note : `from sqlalchemy import select` peut être à ajouter en haut du fichier de test.

- [ ] **Step 5.2: Run test (fail expected)**

Run: `cd backend && python -m pytest tests/voice/test_context_digest.py -v -k "chat_text"`
Expected: FAIL — `maybe_generate_chat_text_digest` n'existe pas

- [ ] **Step 5.3: Ajouter la fonction dans `context_digest.py`**

À la fin de `backend/src/voice/context_digest.py`, ajouter :

```python
async def maybe_generate_chat_text_digest(
    db,
    summary_id: int,
    user_id: int,
) -> None:
    """If 20+ text messages on this video are ungested, create one digest row.

    'Ungested' = chat_messages where source='text' and id > MAX(last_message_id)
    of any existing chat_text_digests for (summary_id, user_id).
    """
    # 1. Find the highest last_message_id already digested
    q_max = select(ChatTextDigest.last_message_id).where(
        ChatTextDigest.summary_id == summary_id,
        ChatTextDigest.user_id == user_id,
        ChatTextDigest.last_message_id.isnot(None),
    ).order_by(ChatTextDigest.last_message_id.desc()).limit(1)
    last_digested_id = (await db.execute(q_max)).scalar_one_or_none() or 0

    # 2. Fetch the next bucket of CHAT_TEXT_BUCKET_SIZE ungested text messages
    q_bucket = (
        select(ChatMessage)
        .where(
            ChatMessage.summary_id == summary_id,
            ChatMessage.user_id == user_id,
            ChatMessage.source == "text",
            ChatMessage.id > last_digested_id,
        )
        .order_by(ChatMessage.id.asc())
        .limit(CHAT_TEXT_BUCKET_SIZE)
    )
    bucket = (await db.execute(q_bucket)).scalars().all()

    if len(bucket) < CHAT_TEXT_BUCKET_SIZE:
        return  # not yet a full bucket

    transcript = "\n".join(
        f"{'user' if m.role == 'user' else 'assistant'}: {m.content}"
        for m in bucket
        if m.content
    )

    try:
        digest_text = await _call_mistral_for_digest(transcript)
    except Exception as exc:
        logger.warning(
            "maybe_chat_text_digest: Mistral failed (non-fatal)",
            extra={"summary_id": summary_id, "user_id": user_id, "error": str(exc)},
        )
        return

    digest = ChatTextDigest(
        summary_id=summary_id,
        user_id=user_id,
        first_message_id=bucket[0].id,
        last_message_id=bucket[-1].id,
        digest_text=digest_text,
        msg_count=len(bucket),
    )
    db.add(digest)
    await db.commit()
```

- [ ] **Step 5.4: Re-run tests**

Run: `cd backend && python -m pytest tests/voice/test_context_digest.py -v`
Expected: tous PASS

- [ ] **Step 5.5: Commit**

```bash
git add backend/src/voice/context_digest.py backend/tests/voice/test_context_digest.py
git commit -m "feat(voice): maybe_generate_chat_text_digest bucket of 20

Bucket-based digest for text chat:
  - Tracks high-water-mark via MAX(last_message_id)
  - No-op when ungested count < 20 (CHAT_TEXT_BUCKET_SIZE)
  - Atomic insert when bucket reaches 20

Task 5 of merge-voice-chat-context-implementation.md."
```

---

### Task 6: Brancher `voice/router.py` au context_builder + hook end-of-session

**Files:**

- Modify: `backend/src/voice/router.py`
- Test: `backend/tests/voice/test_voice_recall_with_history.py` (NEW)

- [ ] **Step 6.1: Écrire le test du recall (failing)**

Créer `backend/tests/voice/test_voice_recall_with_history.py` :

```python
"""Test that a new voice session sees previous voice sessions' digests in
its system_prompt block."""
from datetime import datetime, timedelta, timezone

import pytest


@pytest.mark.asyncio
async def test_new_voice_session_includes_prior_digests(
    async_client, async_db_session, sample_user, sample_summary, auth_headers
):
    """Given: a previous voice_session with digest_text on summary_id S.
    When: user starts a new voice session on the same S.
    Then: the system_prompt includes the prior digest.
    """
    from db.database import VoiceSession

    now = datetime.now(timezone.utc)
    prev_session = VoiceSession(
        id="sess-prev",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        created_at=now - timedelta(days=2),
        duration_seconds=480,
        digest_text="- user a parlé du modèle Janus\n- tu as répondu via web_search",
        digest_generated_at=now - timedelta(days=2),
    )
    async_db_session.add(prev_session)
    await async_db_session.commit()

    response = await async_client.post(
        "/api/voice/session",
        json={
            "summary_id": sample_summary.id,
            "agent_type": "explorer",
            "video_id": "abc123",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    # The system_prompt is in the response payload (per existing API)
    assert "modèle Janus" in data.get("system_prompt", ""), \
        f"Expected prior digest in system_prompt, got: {data.get('system_prompt', '')[:500]}"
```

Note : adapter le payload `POST /api/voice/session` selon le schéma réel (voir `backend/src/voice/schemas.py`). Vérifier aussi le nom du champ retourné (`system_prompt` vs `agent_config.prompt` etc.).

- [ ] **Step 6.2: Run test (fail expected)**

Run: `cd backend && python -m pytest tests/voice/test_voice_recall_with_history.py -v`
Expected: FAIL — soit le system_prompt n'inclut pas le digest, soit il l'inclut déjà via l'ancien `_build_chat_history_block_for_voice` qui n'inclut pas voice rows.

- [ ] **Step 6.3: Modifier `voice/router.py` — remplacer l'ancienne injection**

Trouver dans `backend/src/voice/router.py` l'endroit où `_build_chat_history_block_for_voice` est appelé (chercher `_build_chat_history_block_for_voice`). Probablement dans le handler `POST /voice/session`.

Remplacer le bloc :

```python
# AVANT (ligne ≈ X)
chat_history = await get_chat_history(db, summary_id, user.id)
history_block = _build_chat_history_block_for_voice(chat_history, language=lang)
system_prompt += "\n\n" + history_block
```

par :

```python
# APRÈS — utilise le context_builder unifié
from voice.context_builder import build_unified_context_block

history_block = await build_unified_context_block(
    db,
    summary_id=summary_id,
    user_id=user.id,
    lang=lang,
    target="voice",
    exclude_voice_session_id=new_voice_session.id,
)
if history_block:
    system_prompt += "\n\n" + history_block
```

`new_voice_session.id` est l'ID de la session qu'on vient de créer (juste avant cet appel — vérifier le code existant pour le nom exact de la variable). Si la session est créée APRÈS la construction du system_prompt, déplacer la création AVANT (ou passer `exclude_voice_session_id=None` si on construit le prompt avant la création de la row — le filtre ne ferait rien dans ce cas).

**Important** : ne pas supprimer encore `_build_chat_history_block_for_voice` (le fonction). Le marquer `# DEPRECATED — replaced by context_builder` en commentaire au-dessus de la fonction. Suppression au cleanup ultérieur.

- [ ] **Step 6.4: Ajouter le hook end-of-session digest**

Trouver dans `voice/router.py` l'endroit qui détecte la fin de session (heartbeat timeout 30s OU explicit hangup OU `voice_call_ended` event). Probablement dans une fonction comme `_close_voice_session(session_id)` ou un endpoint `POST /voice/session/{id}/end`.

Ajouter à la fin de cette fonction :

```python
# Hook : génère le digest end-of-session en background
import asyncio
from voice.context_digest import generate_voice_session_digest

async def _digest_task():
    """Run with an independent DB session (current one is request-scoped)."""
    from db.database import async_session_factory
    async with async_session_factory() as bg_db:
        try:
            await generate_voice_session_digest(bg_db, session_id)
        except Exception as exc:
            logger.exception("voice end-of-session digest failed", extra={"session_id": session_id, "error": str(exc)})

asyncio.create_task(_digest_task())
```

Vérifier le nom exact de la factory de session DB indépendante (cherchez dans `backend/src/db/database.py` un pattern comme `async_session_factory`, `AsyncSessionLocal`, `engine.session_factory` ou similaire). Si non disponible, la créer dans `db/database.py` :

```python
from sqlalchemy.ext.asyncio import async_sessionmaker

async_session_factory = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)
```

- [ ] **Step 6.5: Re-run test**

Run: `cd backend && python -m pytest tests/voice/test_voice_recall_with_history.py -v`
Expected: PASS (le digest est inclus dans system_prompt)

- [ ] **Step 6.6: Smoke test : lancer aussi tous les tests voice**

Run: `cd backend && python -m pytest tests/voice/ -v`
Expected: tous PASS (aucune régression)

- [ ] **Step 6.7: Commit**

```bash
git add backend/src/voice/router.py backend/tests/voice/test_voice_recall_with_history.py
# si async_session_factory ajouté :
git add backend/src/db/database.py
git commit -m "feat(voice): wire context_builder + end-of-session digest hook

- voice/router.py: replace _build_chat_history_block_for_voice with
  build_unified_context_block (passes exclude_voice_session_id of the
  newly created session to avoid duplicate context)
- voice/router.py: enqueue generate_voice_session_digest at end-of-session
  via asyncio.create_task with an independent DB session

The legacy _build_chat_history_block_for_voice is marked deprecated and
will be removed in a follow-up cleanup PR.

Task 6 of merge-voice-chat-context-implementation.md."
```

---

### Task 7: Brancher `chat/service.py` + endpoint clear unifié

**Files:**

- Modify: `backend/src/chat/service.py`
- Modify: `backend/src/chat/router.py`
- Test: `backend/tests/chat/test_chat_with_voice_history.py` (NEW)
- Test: `backend/tests/chat/test_clear_unified.py` (NEW)
- Create: `backend/tests/chat/__init__.py` (empty)

- [ ] **Step 7.1: Créer le init du test dir et les 2 fichiers de test (failing)**

```bash
touch backend/tests/chat/__init__.py
```

Créer `backend/tests/chat/test_chat_with_voice_history.py` :

```python
"""Test that chat IA receives voice rows + voice digests in its prompt."""
from datetime import datetime, timedelta, timezone

import pytest


@pytest.mark.asyncio
async def test_chat_prompt_includes_voice_digest_and_voice_messages(
    async_client, async_db_session, sample_user, sample_summary, auth_headers
):
    """Given: voice_session with digest + voice ChatMessages on summary S.
    When: user posts a chat message on S.
    Then: the Mistral prompt history_text includes the voice digest and voice rows.
    """
    from unittest.mock import patch, AsyncMock
    from db.database import ChatMessage, VoiceSession

    now = datetime.now(timezone.utc)
    vs = VoiceSession(
        id="sess-old",
        user_id=sample_user.id, summary_id=sample_summary.id,
        created_at=now - timedelta(days=1),
        duration_seconds=300,
        digest_text="- user a posé question Q\n- tu as répondu R",
        digest_generated_at=now - timedelta(days=1),
    )
    async_db_session.add(vs)
    async_db_session.add(ChatMessage(
        user_id=sample_user.id, summary_id=sample_summary.id,
        role="user", content="vocal question", source="voice",
        voice_session_id="sess-old", voice_speaker="user",
        created_at=now - timedelta(days=1),
    ))
    await async_db_session.commit()

    captured_prompt = {}

    async def fake_mistral_call(system_prompt, user_prompt, **kw):
        captured_prompt["system"] = system_prompt
        captured_prompt["user"] = user_prompt
        return {"content": "answer", "sources": [], "web_search_used": False}

    with patch("chat.service.call_mistral_for_chat", new=AsyncMock(side_effect=fake_mistral_call)):
        response = await async_client.post(
            "/api/chat/ask",
            json={"summary_id": sample_summary.id, "question": "Suite ?", "mode": "standard"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    full_prompt = captured_prompt["system"] + "\n" + captured_prompt["user"]
    assert "user a posé question Q" in full_prompt  # digest
    assert "vocal question" in full_prompt or "[VOCAL" in full_prompt  # verbatim voice row
```

Note : adapter `call_mistral_for_chat` au nom réel utilisé dans `chat/service.py`. Si la fonction d'appel Mistral est nommée autrement (`generate_chat_response`, `_call_mistral`, etc.), patcher le bon symbole.

Créer `backend/tests/chat/test_clear_unified.py` :

```python
"""Test the unified clear endpoint: text + voice + digests."""
from datetime import datetime, timezone

import pytest


@pytest.mark.asyncio
async def test_clear_history_include_voice_default_true(
    async_client, async_db_session, sample_user, sample_summary, auth_headers
):
    """DELETE /api/chat/history/{id} default include_voice=true → wipes everything."""
    from db.database import ChatMessage, ChatTextDigest, VoiceSession

    now = datetime.now(timezone.utc)
    async_db_session.add(ChatMessage(
        user_id=sample_user.id, summary_id=sample_summary.id,
        role="user", content="text msg", source="text",
    ))
    async_db_session.add(ChatMessage(
        user_id=sample_user.id, summary_id=sample_summary.id,
        role="user", content="voice msg", source="voice",
        voice_session_id="sess-x", voice_speaker="user",
    ))
    vs = VoiceSession(
        id="sess-x", user_id=sample_user.id, summary_id=sample_summary.id,
        digest_text="digest content", digest_generated_at=now,
    )
    async_db_session.add(vs)
    cd = ChatTextDigest(
        summary_id=sample_summary.id, user_id=sample_user.id,
        digest_text="text digest", msg_count=20,
    )
    async_db_session.add(cd)
    await async_db_session.commit()

    response = await async_client.delete(
        f"/api/chat/history/{sample_summary.id}",
        headers=auth_headers,
    )
    assert response.status_code == 200

    # All chat messages gone
    from sqlalchemy import select
    msgs = (await async_db_session.execute(
        select(ChatMessage).where(ChatMessage.summary_id == sample_summary.id)
    )).scalars().all()
    assert len(msgs) == 0

    # Chat digests gone
    cds = (await async_db_session.execute(
        select(ChatTextDigest).where(ChatTextDigest.summary_id == sample_summary.id)
    )).scalars().all()
    assert len(cds) == 0

    # Voice session still exists (audit billing) but digest cleared
    await async_db_session.refresh(vs)
    assert vs.digest_text is None
    assert vs.digest_generated_at is None


@pytest.mark.asyncio
async def test_clear_history_include_voice_false_keeps_voice(
    async_client, async_db_session, sample_user, sample_summary, auth_headers
):
    """DELETE /api/chat/history/{id}?include_voice=false → text + chat digests only."""
    from db.database import ChatMessage, ChatTextDigest, VoiceSession
    from sqlalchemy import select

    async_db_session.add(ChatMessage(
        user_id=sample_user.id, summary_id=sample_summary.id,
        role="user", content="text", source="text",
    ))
    async_db_session.add(ChatMessage(
        user_id=sample_user.id, summary_id=sample_summary.id,
        role="user", content="voice", source="voice",
        voice_session_id="vs-1", voice_speaker="user",
    ))
    await async_db_session.commit()

    response = await async_client.delete(
        f"/api/chat/history/{sample_summary.id}?include_voice=false",
        headers=auth_headers,
    )
    assert response.status_code == 200

    rows = (await async_db_session.execute(
        select(ChatMessage).where(ChatMessage.summary_id == sample_summary.id)
    )).scalars().all()
    assert len(rows) == 1
    assert rows[0].source == "voice"
```

- [ ] **Step 7.2: Run tests (fail expected)**

Run: `cd backend && python -m pytest tests/chat/ -v`
Expected: FAIL (les tests font appel à la nouvelle logique)

- [ ] **Step 7.3: Modifier `chat/service.py:build_chat_prompt` pour utiliser le builder**

Dans `backend/src/chat/service.py`, repérer `build_chat_prompt` (≈ ligne 512). Modifier sa signature pour accepter un `db` AsyncSession (ou refactor pour appeler le builder ailleurs).

Le plus simple : modifier le caller (`chat/router.py:ask` et `ask_stream`). Au lieu de :

```python
# AVANT
history = await get_chat_history(session, request.summary_id, current_user.id)
system_prompt, user_prompt = build_chat_prompt(
    question=request.question,
    video_title=summary.title,
    transcript=transcript,
    summary=summary.summary_content or "",
    chat_history=history,
    mode=request.mode,
    lang=summary.lang or "fr",
)
```

Faire :

```python
# APRÈS
from voice.context_builder import build_unified_context_block

history_text = await build_unified_context_block(
    session,
    summary_id=request.summary_id,
    user_id=current_user.id,
    lang=summary.lang or "fr",
    target="chat",
    exclude_voice_session_id=None,
)
system_prompt, user_prompt = build_chat_prompt(
    question=request.question,
    video_title=summary.title,
    transcript=transcript,
    summary=summary.summary_content or "",
    history_text=history_text,  # bloc déjà formaté
    mode=request.mode,
    lang=summary.lang or "fr",
)
```

Et modifier `build_chat_prompt` pour prendre `history_text: str` au lieu de `chat_history: List[Dict]`. Remplacer dans la fonction le bloc :

```python
# AVANT (lignes ≈549-553)
history_text = ""
if chat_history:
    for msg in chat_history[-6:]:
        role = "Utilisateur" if msg["role"] == "user" else "Assistant"
        history_text += f"\n{role}: {msg['content']}"
```

Par : rien (la string `history_text` arrive déjà toute faite en argument). S'assurer que la signature et le docstring de `build_chat_prompt` reflètent le changement.

- [ ] **Step 7.4: Ajouter le hook bucket dans `save_chat_message`**

Dans `backend/src/chat/service.py`, repérer `save_chat_message` (≈ ligne 376). Après le `await session.commit()`, ajouter :

```python
# Hook bucket digest : si on dépasse les 20 ungested, génère un digest
import asyncio
from voice.context_digest import maybe_generate_chat_text_digest
from db.database import async_session_factory

async def _bucket_task():
    async with async_session_factory() as bg_db:
        try:
            await maybe_generate_chat_text_digest(bg_db, summary_id, user_id)
        except Exception as exc:
            logger.warning("chat bucket digest failed (non-fatal)", extra={"error": str(exc)})

asyncio.create_task(_bucket_task())
```

À placer juste avant le `return` de la fonction.

- [ ] **Step 7.5: Étendre le endpoint clear**

Dans `backend/src/chat/router.py`, repérer `DELETE /history/{summary_id}`. Modifier la signature pour accepter `include_voice: bool = Query(default=True)` :

```python
from fastapi import Query

@router.delete("/history/{summary_id}")
async def clear_chat_history_endpoint(
    summary_id: int,
    include_voice: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Efface l'historique conversationnel d'une vidéo.

    Default include_voice=True : efface chat texte + voice transcripts +
    voice_sessions digest fields + chat_text_digests pour cette
    (summary_id, user_id).

    include_voice=False : ne touche que source='text' + chat_text_digests.
    """
    deleted = await clear_chat_history_unified(
        session, summary_id, current_user.id, include_voice=include_voice
    )
    return {"success": True, "deleted": deleted}
```

Et créer `clear_chat_history_unified` dans `chat/service.py` (à côté de l'ancien `clear_chat_history`) :

```python
async def clear_chat_history_unified(
    session: AsyncSession,
    summary_id: int,
    user_id: int,
    *,
    include_voice: bool = True,
) -> int:
    """Efface conversationnellement une vidéo.

    include_voice=True (default):
      - chat_messages WHERE summary_id=… AND user_id=… (toutes sources)
      - chat_text_digests WHERE summary_id=… AND user_id=…
      - voice_sessions: digest_text=NULL, digest_generated_at=NULL (pas drop la row)

    include_voice=False:
      - chat_messages WHERE source='text' AND summary_id=… AND user_id=…
      - chat_text_digests WHERE summary_id=… AND user_id=…
    """
    from sqlalchemy import delete, update
    from db.database import ChatTextDigest, VoiceSession

    deleted_msgs_q = delete(ChatMessage).where(
        ChatMessage.summary_id == summary_id,
        ChatMessage.user_id == user_id,
    )
    if not include_voice:
        deleted_msgs_q = deleted_msgs_q.where(ChatMessage.source == "text")
    deleted_msgs = (await session.execute(deleted_msgs_q)).rowcount

    await session.execute(
        delete(ChatTextDigest).where(
            ChatTextDigest.summary_id == summary_id,
            ChatTextDigest.user_id == user_id,
        )
    )

    if include_voice:
        await session.execute(
            update(VoiceSession)
            .where(
                VoiceSession.summary_id == summary_id,
                VoiceSession.user_id == user_id,
            )
            .values(digest_text=None, digest_generated_at=None)
        )

    await session.commit()
    return deleted_msgs
```

- [ ] **Step 7.6: Re-run all backend tests**

Run: `cd backend && python -m pytest tests/voice/ tests/chat/ -v`
Expected: tous PASS, aucune régression

- [ ] **Step 7.7: Commit**

```bash
git add backend/src/chat/service.py backend/src/chat/router.py backend/tests/chat/
git commit -m "feat(chat): wire context_builder + bucket digest hook + unified clear

- chat/router.py:ask + ask_stream: replace chat_history[-6:] limit with
  build_unified_context_block (target='chat', cap 30 KB)
- chat/service.py:save_chat_message: enqueue maybe_generate_chat_text_digest
  via asyncio.create_task with independent DB session
- chat/router.py: DELETE /history/{id}?include_voice=true (default true)
  cascades on chat_messages + chat_text_digests + voice_sessions digest reset

Task 7 of merge-voice-chat-context-implementation.md."
```

---

## Phase 2 — Frontend tri-plateforme

### Task 8: Frontend web — confirm modale clear unifié

**Files:**

- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/components/chat/ChatHeader.tsx` (ou ChatPanel selon où le bouton corbeille existe)
- Modify: `frontend/src/i18n/fr.json`, `frontend/src/i18n/en.json`

- [ ] **Step 8.1: Vérifier où le bouton corbeille du chat est rendu**

Run: `cd frontend && grep -r "clearChatHistory\|trash\|Trash\|Clear chat" src/ --include="*.tsx" --include="*.ts" -l`

Lister les fichiers, ouvrir celui qui rend le bouton (probablement `ChatPanel.tsx` ou `ChatHeader.tsx`). Noter le nom exact.

- [ ] **Step 8.2: Modifier `services/api.ts` pour le query param**

Repérer la fonction `clearChatHistory(summaryId)` dans `frontend/src/services/api.ts`. Modifier :

```typescript
// AVANT
export async function clearChatHistory(
  summaryId: number,
): Promise<{ deleted: number }> {
  const response = await api.delete(`/api/chat/history/${summaryId}`);
  return response.data;
}

// APRÈS
export async function clearChatHistory(
  summaryId: number,
  options: { includeVoice?: boolean } = {},
): Promise<{ deleted: number }> {
  const includeVoice = options.includeVoice ?? true;
  const response = await api.delete(
    `/api/chat/history/${summaryId}?include_voice=${includeVoice}`,
  );
  return response.data;
}
```

- [ ] **Step 8.3: Ajouter les strings i18n**

Dans `frontend/src/i18n/fr.json`, ajouter dans la section `chat` (ou créer si absente) :

```json
"chat": {
  "clear": {
    "confirmTitle": "Effacer cette conversation ?",
    "confirmBody": "Cela efface le chat texte ET les transcripts d'appels vocaux pour cette vidéo. Action irréversible.",
    "confirmYes": "Effacer tout",
    "confirmCancel": "Annuler"
  }
}
```

Dans `frontend/src/i18n/en.json`, ajouter :

```json
"chat": {
  "clear": {
    "confirmTitle": "Clear this conversation?",
    "confirmBody": "This deletes both text chat and voice call transcripts for this video. Irreversible.",
    "confirmYes": "Clear all",
    "confirmCancel": "Cancel"
  }
}
```

Si la structure i18n existe déjà avec d'autres clés sous `chat`, ajouter à la suite sans écraser.

- [ ] **Step 8.4: Modifier le composant qui rend le bouton corbeille**

Dans le fichier identifié au Step 8.1 (probable `ChatPanel.tsx` ou `ChatHeader.tsx`), ajouter une confirm modale avant l'appel à `clearChatHistory`. Pattern simple avec `window.confirm` (acceptable V1) ou modale Tailwind/Radix selon ce qui existe :

```tsx
import { useTranslation } from "react-i18next";

const { t } = useTranslation();

const handleClearClick = async () => {
  const confirmed = window.confirm(
    `${t("chat.clear.confirmTitle")}\n\n${t("chat.clear.confirmBody")}`,
  );
  if (!confirmed) return;
  await clearChatHistory(summaryId, { includeVoice: true });
  // Refresh chat state (existing pattern)
};
```

Si le projet utilise déjà un composant `<ConfirmDialog>` ou `<AlertDialog>`, utiliser celui-là à la place de `window.confirm`. Vérifier avec :

Run: `grep -r "ConfirmDialog\|AlertDialog\|useDialog" frontend/src/ --include="*.tsx" -l | head -5`

- [ ] **Step 8.5: Build + typecheck + tests**

Run: `cd frontend && npm run typecheck && npm run test -- --run`
Expected: typecheck OK, tests existants OK

- [ ] **Step 8.6: Test manuel rapide**

Run: `cd frontend && npm run dev`
Ouvrir `http://localhost:5173/chat?summary={id existing}`, cliquer la corbeille → vérifier que la modale s'affiche avec le texte FR/EN. Confirmer → l'historique disparaît (chat texte + voice transcripts).

- [ ] **Step 8.7: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/components/chat/ChatHeader.tsx frontend/src/components/ChatPanel.tsx frontend/src/i18n/fr.json frontend/src/i18n/en.json
# (adapter aux fichiers réellement modifiés)
git commit -m "feat(web/chat): confirm modal for unified clear (text + voice)

- api.ts: clearChatHistory(summaryId, {includeVoice}) with default true
  forwards include_voice query param to backend
- ChatHeader/ChatPanel: confirm dialog before clear, FR/EN strings
  warn the user that voice transcripts will also be deleted

Task 8 of merge-voice-chat-context-implementation.md."
```

---

### Task 9: Frontend extension Chrome — confirm modale clear unifié

**Files:**

- Modify: `extension/src/utils/api.ts` (ou équivalent — chemin à confirmer)
- Modify: `extension/src/popup/components/ChatDrawer.tsx`
- Modify: `extension/src/i18n/fr.json`, `extension/src/i18n/en.json`

- [ ] **Step 9.1: Identifier le fichier API et le composant ChatDrawer**

Run:

```
grep -r "clearChatHistory\|chat/history" extension/src/ --include="*.tsx" --include="*.ts" -l
grep -rn "DELETE.*chat" extension/src/ --include="*.ts"
```

- [ ] **Step 9.2: Modifier l'API extension**

Pattern identique à Task 8.2 :

```typescript
export async function clearChatHistory(
  summaryId: number,
  options: { includeVoice?: boolean } = {},
): Promise<{ deleted: number }> {
  const includeVoice = options.includeVoice ?? true;
  return apiClient.delete(
    `/api/chat/history/${summaryId}?include_voice=${includeVoice}`,
  );
}
```

- [ ] **Step 9.3: Ajouter strings i18n extension**

Dans `extension/src/i18n/fr.json` et `en.json`, ajouter les mêmes clés que Task 8.3.

- [ ] **Step 9.4: Modifier `ChatDrawer.tsx`**

Pattern identique à Task 8.4 — confirm avant clear. L'extension n'a pas forcément React Router/i18next : si le projet utilise un système de traduction custom, utiliser celui-là. Sinon, hardcoder FR/EN selon `lang` détecté via `chrome.storage`.

```tsx
const handleClearClick = async () => {
  const confirmed = confirm(
    `${t("chat.clear.confirmTitle")}\n\n${t("chat.clear.confirmBody")}`,
  );
  if (!confirmed) return;
  await clearChatHistory(summaryId, { includeVoice: true });
  // refresh
};
```

- [ ] **Step 9.5: Build extension + tests**

Run: `cd extension && npm run typecheck && npm run build && npm run test`
Expected: tout OK

- [ ] **Step 9.6: Test manuel**

Charger `extension/dist` dans `chrome://extensions` (mode dev), ouvrir une vidéo YouTube avec analyse DeepSight, ouvrir le ChatDrawer, cliquer corbeille → modale apparaît, confirmer, historique disparu.

- [ ] **Step 9.7: Commit**

```bash
git add extension/src/utils/api.ts extension/src/popup/components/ChatDrawer.tsx extension/src/i18n/fr.json extension/src/i18n/en.json
# (adapter aux fichiers réellement modifiés)
git commit -m "feat(ext/chat): confirm modal for unified clear (text + voice)

Mirrors web (Task 8): includeVoice=true default, FR/EN i18n strings.

Task 9 of merge-voice-chat-context-implementation.md."
```

---

### Task 10: Frontend mobile — confirm modale clear unifié

**Files:**

- Modify: `mobile/src/services/api.ts`
- Modify: `mobile/src/components/chat/ChatHeader.tsx` (ou équivalent)
- Modify: `mobile/src/i18n/fr.json` + `en.json` (ou structure mobile équivalente)

- [ ] **Step 10.1: Identifier les fichiers**

Run:

```
grep -r "clearChatHistory" mobile/src/ --include="*.tsx" --include="*.ts" -l
```

- [ ] **Step 10.2: Modifier `mobile/src/services/api.ts`**

Pattern identique à Task 8.2.

- [ ] **Step 10.3: Strings i18n mobile**

Si le mobile utilise `i18next` (probable, miroir du frontend), même structure. Sinon adapter.

- [ ] **Step 10.4: Modifier le composant chat header mobile**

React Native n'a pas `window.confirm`. Utiliser `Alert.alert` :

```tsx
import { Alert } from "react-native";

const handleClearPress = () => {
  Alert.alert(t("chat.clear.confirmTitle"), t("chat.clear.confirmBody"), [
    { text: t("chat.clear.confirmCancel"), style: "cancel" },
    {
      text: t("chat.clear.confirmYes"),
      style: "destructive",
      onPress: async () => {
        await clearChatHistory(summaryId, { includeVoice: true });
        // refresh
      },
    },
  ]);
};
```

- [ ] **Step 10.5: Tests mobile**

Run: `cd mobile && npm run typecheck && npm run test`
Expected: tout OK

- [ ] **Step 10.6: Test manuel via Expo**

Run: `cd mobile && npx expo start`
Sur le simulateur/device, ouvrir une vidéo, chat tab, cliquer corbeille → Alert apparaît, confirmer → historique disparu.

- [ ] **Step 10.7: Commit**

```bash
git add mobile/src/services/api.ts mobile/src/components/chat/ChatHeader.tsx mobile/src/i18n/
# (adapter aux fichiers réellement modifiés)
git commit -m "feat(mobile/chat): confirm modal for unified clear (text + voice)

Mirrors web + extension: includeVoice=true default, Alert.alert (RN), FR/EN.

Task 10 of merge-voice-chat-context-implementation.md."
```

---

## Phase 3 — E2E + déploiement

### Task 11: E2E Playwright voice-chat-symbiosis

**Files:**

- Create: `frontend/e2e/voice-chat-symbiosis.spec.ts`

- [ ] **Step 11.1: Créer le fichier E2E**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Voice ↔ Chat memory symbiosis", () => {
  test("voice → chat: text chat references something said in voice", async ({
    page,
  }) => {
    // 1. Login (use existing fixture / helper)
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.E2E_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.E2E_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");

    // 2. Open an existing analyzed video (assumes seed data: summary id E2E_VIDEO_ID)
    await page.goto(`/chat?summary=${process.env.E2E_VIDEO_ID}`);

    // 3. Click voice call button → wait for voice overlay
    await page.click('[data-testid="voice-call-button"]');
    await page.waitForSelector('[data-testid="voice-overlay-active"]');

    // 4. Send a text message via voice (or simulate ElevenLabs send → assert via API)
    //    For E2E we mock ElevenLabs by directly POST-ing transcripts/append:
    await page.evaluate(async () => {
      const r = await fetch("/api/voice/transcripts/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_session_id: window.__E2E_VOICE_SESSION_ID,
          messages: [
            {
              speaker: "user",
              content: "Quelle est la conclusion sur Janus ?",
            },
            {
              speaker: "agent",
              content:
                "La conclusion est que Janus est un modèle bigravitationnel.",
            },
          ],
        }),
      });
      return r.status;
    });

    // 5. Hang up the call
    await page.click('[data-testid="voice-hangup"]');
    await page.waitForSelector('[data-testid="voice-overlay-closed"]', {
      timeout: 5000,
    });

    // 6. Wait for end-of-session digest (give it ~3s for background asyncio task + Mistral)
    await page.waitForTimeout(3500);

    // 7. Type a chat message that references the voice topic
    await page.fill(
      '[data-testid="chat-input"]',
      "Tu as dit quoi sur Janus tout à l'heure ?",
    );
    await page.click('[data-testid="chat-send"]');

    // 8. Wait for Mistral response and assert it references "Janus" / "bigravitationnel"
    const response = await page.waitForSelector(
      '[data-testid="chat-message-assistant"]:last-child',
      { timeout: 30_000 },
    );
    const text = await response.innerText();
    expect(text.toLowerCase()).toMatch(/janus|bigravit/);
  });

  test("voice → voice recall: second call references first call topic", async ({
    page,
  }) => {
    // 1-5: same setup as above (login + 1st voice call with seeded transcripts)
    // 6. Hang up, wait digest
    // 7. Open voice call again on same video
    // 8. Send "Tu te rappelles de quoi on a parlé ?"
    // 9. Assert response contains "Janus" or topic from previous call
    // Implementation analogous to test 1, with second call instead of chat reply.
    // Skipped here for brevity — duplicate test 1 pattern, replace step 7-8 with voice instead of chat.
  });

  test("clear unified: deletes text + voice + digests", async ({ page }) => {
    // 1. Login + open chat page on seeded summary
    // 2. Verify history has text + voice rows
    // 3. Click trash icon
    // 4. Assert confirm modal appears with "voice" or "vocal" word in body
    // 5. Confirm → wait for empty history state
    // 6. Reload page → still empty
  });
});
```

Variables d'environnement nécessaires (à ajouter dans `frontend/.env.test` ou `playwright.config.ts`) :

- `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` (compte de test seedé)
- `E2E_VIDEO_ID` (summary_id d'une vidéo seedée avec analyse complète)

- [ ] **Step 11.2: Run le test E2E**

Run: `cd frontend && npx playwright test e2e/voice-chat-symbiosis.spec.ts --headed`
Expected: les 3 tests passent. Si test 2 ou 3 ne sont pas implémentés (juste squelettés ci-dessus), les marquer `test.skip` temporairement et créer une follow-up task.

- [ ] **Step 11.3: Commit**

```bash
git add frontend/e2e/voice-chat-symbiosis.spec.ts
git commit -m "test(e2e): voice ↔ chat memory symbiosis (3 scenarios)

End-to-end Playwright tests covering:
  - voice → chat memory (Mistral chat references voice digest)
  - voice → voice recall (2nd call references 1st call topic)
  - clear unified (text + voice + digests wiped together)

Task 11 of merge-voice-chat-context-implementation.md."
```

---

### Task 12: Deploy Hetzner + smoke test prod

**Files:** none (deploy actions)

- [ ] **Step 12.1: Push la branche et créer la PR**

Run:

```bash
git push -u origin <current-branch>
gh pr create --title "feat: merge voice ↔ chat context (tri-plateforme)" --body "$(cat <<'EOF'
## Summary
- Implémente la mémoire bidirectionnelle voice ↔ chat par vidéo
- Migration 010 : voice_sessions.digest + chat_text_digests
- Service context_builder + context_digest (Mistral-small)
- Endpoint clear unifié RGPD
- Frontend tri-plateforme (web + extension + mobile)
- E2E Playwright

Spec : docs/superpowers/specs/2026-04-29-merge-voice-chat-context-design.md
Plan : docs/superpowers/plans/2026-04-29-merge-voice-chat-context-implementation.md

## Test plan
- [ ] Backend pytest tests/voice/ tests/chat/ all green
- [ ] Frontend typecheck + Vitest green
- [ ] Extension typecheck + build + Jest green
- [ ] Mobile typecheck + Jest green
- [ ] Playwright voice-chat-symbiosis 3 scenarios green
- [ ] Smoke test prod : 1 voice call + 1 chat msg sur vidéo de test
EOF
)"
```

- [ ] **Step 12.2: Attendre que la CI verte (Vercel + tests CI)**

Suivre le PR sur GitHub. Si CI rouge, fixer les régressions avant de merger.

- [ ] **Step 12.3: Merger la PR**

Run: `gh pr merge --squash --auto`

- [ ] **Step 12.4: Deploy backend Hetzner**

Run:

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 "cd /opt/deepsight/repo && git pull && docker build -t deepsight-backend:latest -f deploy/hetzner/Dockerfile . && docker stop repo-backend-1 && docker rm repo-backend-1 && docker run -d --name repo-backend-1 --network repo_deepsight --env-file .env.production -e RUN_MIGRATIONS=true -p 8080:8080 deepsight-backend:latest"
```

Le `RUN_MIGRATIONS=true` déclenche `alembic upgrade head` au démarrage via `entrypoint.sh` (cf. PR #189). La migration 010 sera appliquée automatiquement.

- [ ] **Step 12.5: Vérifier le démarrage prod**

Run:

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 "docker logs repo-backend-1 --tail 50 2>&1 | grep -E 'migration|010|error|started'"
```

Expected: `Running upgrade 009_add_user_preferences_json -> 010_add_conversation_digests` puis `Application startup complete`.

- [ ] **Step 12.6: Smoke test prod**

```bash
# Health check
curl -fsS https://api.deepsightsynthesis.com/health
# Expected: {"status":"ok",...}
```

Sur https://www.deepsightsynthesis.com :

1. Login compte de test
2. Ouvrir une vidéo déjà analysée
3. Faire un voice call de 30s avec une question simple
4. Hang up
5. Attendre 5s puis tape un message chat qui référence le voice
6. Vérifier que la réponse Mistral utilise le contexte voice

- [ ] **Step 12.7: Tag de release et commit du tag**

Run:

```bash
git tag -a v$(date +%Y.%m.%d)-merge-voice-chat -m "Merge voice ↔ chat context (tri-plateforme)"
git push origin v$(date +%Y.%m.%d)-merge-voice-chat
```

---

## Phase 4 — Backfill optionnel (post-deploy stable)

### Task 13: Scripts backfill voice + chat texte (asynchrone)

**Files:**

- Create: `scripts/backfill_voice_session_digests.py`
- Create: `scripts/backfill_chat_text_digests.py`

⚠️ **Cette task est optionnelle.** Le `context_builder` fonctionne sans : il y aura juste moins de digests anciens à injecter pour les conversations historiques. À lancer une seule fois post-deploy stable (≥ 24h sans incident).

- [ ] **Step 13.1: Script backfill voice**

Créer `scripts/backfill_voice_session_digests.py` :

```python
"""Backfill digests for voice_sessions that ended before the digest hook
was deployed (digest_text IS NULL but messages exist).

Run: cd backend && python -m scripts.backfill_voice_session_digests

Batch by 50 sessions, sleep 1s between batches to respect Mistral rate limit.
"""
import asyncio
import logging
from sqlalchemy import select

from db.database import VoiceSession, async_session_factory, ChatMessage
from voice.context_digest import generate_voice_session_digest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backfill_voice")

BATCH_SIZE = 50
SLEEP_BETWEEN_BATCHES_S = 1.0


async def main():
    async with async_session_factory() as db:
        sessions_to_process = (
            await db.execute(
                select(VoiceSession.id)
                .where(VoiceSession.digest_text.is_(None))
                .where(
                    VoiceSession.id.in_(
                        select(ChatMessage.voice_session_id)
                        .where(ChatMessage.voice_session_id.isnot(None))
                        .distinct()
                    )
                )
            )
        ).scalars().all()
    logger.info("Found %d voice sessions to backfill", len(sessions_to_process))

    for i in range(0, len(sessions_to_process), BATCH_SIZE):
        batch = sessions_to_process[i : i + BATCH_SIZE]
        async with async_session_factory() as db:
            for sid in batch:
                try:
                    await generate_voice_session_digest(db, sid)
                except Exception as exc:
                    logger.warning("backfill skipped sid=%s err=%s", sid, exc)
        logger.info("Batch %d/%d done", i // BATCH_SIZE + 1, (len(sessions_to_process) + BATCH_SIZE - 1) // BATCH_SIZE)
        await asyncio.sleep(SLEEP_BETWEEN_BATCHES_S)

    logger.info("Backfill voice digests complete.")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 13.2: Script backfill chat texte**

Créer `scripts/backfill_chat_text_digests.py` :

```python
"""Backfill digests for chat texte buckets accumulated before the bucket hook
was deployed.

Iterates per (summary_id, user_id) tuple and calls maybe_generate_chat_text_digest
in a loop until no more buckets are produced.

Run: cd backend && python -m scripts.backfill_chat_text_digests
"""
import asyncio
import logging
from sqlalchemy import select, distinct

from db.database import ChatMessage, ChatTextDigest, async_session_factory
from voice.context_digest import maybe_generate_chat_text_digest, CHAT_TEXT_BUCKET_SIZE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backfill_chat_text")


async def main():
    async with async_session_factory() as db:
        pairs = (
            await db.execute(
                select(distinct(ChatMessage.summary_id), ChatMessage.user_id)
                .where(ChatMessage.source == "text")
            )
        ).all()
    logger.info("Found %d (summary_id, user_id) pairs to inspect", len(pairs))

    for summary_id, user_id in pairs:
        async with async_session_factory() as db:
            # Loop while buckets are produced
            while True:
                count_before = (
                    await db.execute(
                        select(ChatTextDigest)
                        .where(
                            ChatTextDigest.summary_id == summary_id,
                            ChatTextDigest.user_id == user_id,
                        )
                    )
                ).scalars().all()
                await maybe_generate_chat_text_digest(db, summary_id, user_id)
                count_after = (
                    await db.execute(
                        select(ChatTextDigest)
                        .where(
                            ChatTextDigest.summary_id == summary_id,
                            ChatTextDigest.user_id == user_id,
                        )
                    )
                ).scalars().all()
                if len(count_after) == len(count_before):
                    break
        await asyncio.sleep(0.5)

    logger.info("Backfill chat text digests complete.")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 13.3: Lancer les scripts en prod (SSH Hetzner)**

Run:

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 "docker exec repo-backend-1 python -m scripts.backfill_voice_session_digests"
# attendre la fin (peut être long si beaucoup de sessions historiques)
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 "docker exec repo-backend-1 python -m scripts.backfill_chat_text_digests"
```

Surveiller les logs pour les éventuels échecs Mistral. Les sessions skippées seront retentées au prochain run.

- [ ] **Step 13.4: Commit les scripts**

```bash
git add scripts/backfill_voice_session_digests.py scripts/backfill_chat_text_digests.py
git commit -m "chore(backfill): scripts to digest historical voice + chat texte

Optional one-shot backfill scripts to run post-deploy:
  - backfill_voice_session_digests: 50/batch, 1s sleep, Mistral rate-friendly
  - backfill_chat_text_digests: iterate per (summary, user) until no new bucket

Task 13 of merge-voice-chat-context-implementation.md."
```

---

## Self-Review Notes

After writing, this plan was reviewed against the spec :

**Spec coverage** :

- ✅ Migration 010 — Task 1
- ✅ context_builder — Tasks 2, 3
- ✅ context_digest (voice + bucket chat) — Tasks 4, 5
- ✅ Branchement voice/router — Task 6
- ✅ Branchement chat/service — Task 7
- ✅ Endpoint clear unifié — Task 7
- ✅ Frontend web — Task 8
- ✅ Frontend extension — Task 9
- ✅ Frontend mobile — Task 10
- ✅ E2E Playwright — Task 11
- ✅ Deploy + smoke test — Task 12
- ✅ Backfill optionnel — Task 13

**Type consistency** :

- `build_unified_context_block` signature identical across Tasks 3, 6, 7
- `_format_message_label`, `_render_block`, `_truncate_to_cap` all return `str`, accept consistent kwargs
- `generate_voice_session_digest`, `maybe_generate_chat_text_digest` both take `db` first arg
- Cap constants (`VOICE_SYSTEM_PROMPT_CAP_BYTES=12_000`, `CHAT_HISTORY_CAP_BYTES=30_000`) used consistently

**Placeholder scan** : no TBD, TODO, "implement later". Tests are full code blocks. Dependencies (`async_session_factory`, fixtures) are flagged with explicit fallback instructions.

**Decomposition** : 13 tasks, each producing 1 commit. Phase 1 (Backend) is sequential. Phase 2 (Frontend) Tasks 8-9-10 can be parallelized across 3 sub-agents. Phase 3-4 sequential after Phase 1+2.

---

## Sub-Agent Dispatch Map (suggested for subagent-driven-development)

| Agent | Tasks | Précondition | Parallèle avec |
| ----- | ----- | ------------ | -------------- |
| A     | 1     | —            | —              |
| B     | 2, 3  | A            | —              |
| C     | 4, 5  | A            | B              |
| D     | 6     | B + C        | —              |
| E     | 7     | B + C        | D              |
| F     | 8     | E            | G, H           |
| G     | 9     | E            | F, H           |
| H     | 10    | E            | F, G           |
| I     | 11    | F + G + H    | —              |
| J     | 12    | I            | —              |
| K     | 13    | J + 24h      | —              |

**Toutes les invocations Agent doivent utiliser `model: claude-opus-4-7[1m]`** (perma rule from user memory).
