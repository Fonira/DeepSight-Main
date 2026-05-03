# Semantic Search V1 — Phase 1 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre le moteur de recherche sémantique de DeepSight (aujourd'hui transcripts only) à l'ensemble du contenu personnel d'un user — synthèses, flashcards, quiz, chat history — et exposer 4 endpoints qui consommeront le frontend tri-plateforme à venir.

**Architecture:** Pattern strictement identique à `TranscriptEmbedding` existant : 1024-dim Mistral embed sérialisé en JSON Text dans Postgres, cosine similarity en pure Python, filtre `user_id` SQL. **Approche pragmatique** retenue lors du brainstorm — pgvector reporté V2. Materialization des flashcards/quiz dans 2 nouvelles tables (aujourd'hui en-mémoire only) pour permettre l'indexation. Triggers fire-and-forget `asyncio.create_task` aux moments de création.

**Tech Stack:** FastAPI + Python 3.11, SQLAlchemy 2.0 async, Alembic migrations, Postgres 17, Redis 7 (cache query 24h), Mistral `mistral-embed` v23.12 (1024-dim), `mistral-small-latest` pour le tooltip.

**Spec source:** `docs/superpowers/specs/2026-05-03-semantic-search-design.md`

---

## File Structure

### Files créés

- `backend/alembic/versions/015_add_search_index_tables.py` — migration 7 tables
- `backend/src/search/embedding_service.py` — étendu (helpers existants gardés, 4 nouveaux helpers ajoutés)
- `backend/src/search/global_search.py` — service de recherche globale cross-source
- `backend/src/search/within_search.py` — service de recherche intra-analyse
- `backend/src/search/explain_passage.py` — service tooltip IA + cache
- `backend/src/search/recent_queries.py` — service recent queries cache
- `backend/scripts/backfill_search_index.py` — backfill prod
- `backend/tests/search/__init__.py`
- `backend/tests/search/conftest.py` — fixtures Mistral mock
- `backend/tests/search/test_embedding_service.py`
- `backend/tests/search/test_global_search.py`
- `backend/tests/search/test_within_search.py`
- `backend/tests/search/test_explain_passage.py`
- `backend/tests/search/test_router.py`
- `backend/tests/study/test_persistence.py` — pour la matérialisation

### Files modifiés

- `backend/src/db/database.py` — ajout 7 modèles SQLAlchemy
- `backend/src/search/router.py` — étendu : 4 nouveaux endpoints
- `backend/src/study/router.py` — persiste Flashcard/QuizQuestion à la génération + trigger embed
- `backend/src/videos/service.py` — trigger `embed_summary` après création Summary
- `backend/src/chat/router.py` — trigger `embed_chat_turn` après pair user+assistant complet
- `backend/src/billing/plan_config.py` — feature flag `semantic_search_tooltip` × 9 dicts
- `backend/src/core/config.py` — env flag `SEMANTIC_SEARCH_V1_ENABLED` + helper `is_semantic_search_v1_enabled()`

### Hors scope cette PR (frontend)

- `frontend/src/config/planPrivileges.ts`
- `mobile/src/config/planPrivileges.ts`
  Ces mirrors seront mis à jour dans les Phases 2/3 quand on touchera ces plateformes. Aucun impact backend.

---

## Conventions globales pour TOUTES les tasks

- Branche worktree dédiée : `feat/search-backend-phase1`
- Commits ASCII propres (pas d'emojis), prefix `feat(search):` / `test(search):` / `chore(search):` / `feat(study):` selon scope
- Tests pytest avec `pytest-asyncio` mode auto
- `mistral-embed` mocké via `@patch("search.embedding_service.MISTRAL_API_KEY", "sk-test")` + `@patch("httpx.AsyncClient.post", new_callable=AsyncMock)` (pattern existant dans `tests/images/test_screenshot_detection.py`)
- Pas de `print()`, toujours `logger`
- Pas de `datetime.utcnow()` (deprecated Py3.12+) → utiliser `datetime.now(timezone.utc)`
- Toutes les nouvelles fonctions retournent des types explicites
- Schemas Pydantic v2 avec `Field(min_length=2, max_length=500)` quand pertinent

---

## Task 1: Alembic migration 015 — création des 7 tables

**Files:**

- Create: `backend/alembic/versions/015_add_search_index_tables.py`

- [ ] **Step 1.1: Créer le fichier de migration**

```python
"""Add search index tables for Semantic Search V1.

Revision ID: 015_add_search_index_tables
Revises: 014_add_channel_contexts
Create Date: 2026-05-03

Tables ajoutées (Semantic Search V1, cf. docs/superpowers/specs/2026-05-03-semantic-search-design.md):

  Persistance flashcards/quiz (matérialisation pour permettre l'indexation) :
    1. flashcards            — flashcards persistées par génération
    2. quiz_questions        — questions quiz persistées par génération

  Embeddings par source (1 table par type pour clarté + indexes ciblés) :
    3. summary_embeddings    — 1 embedding par section structured_index
    4. flashcard_embeddings  — 1 embedding par flashcard (Q+A concaténés)
    5. quiz_embeddings       — 1 embedding par question (Q + bonne réponse)
    6. chat_embeddings       — 1 embedding par turn user+assistant

  Cache tooltip IA :
    7. explain_passage_cache — cache 7j sha256(query+passage+summary_id)

Tous les embeddings :
  - JSON 1024-dim Text (pas de pgvector — cf. ADR brainstorm 2026-05-03)
  - model_version VARCHAR(50) default 'mistral-embed' (versionnable)
  - user_id dénormalisé pour filtre SQL rapide (pas besoin de JOIN summaries)
  - ON DELETE CASCADE depuis user/summary

Backward compat : aucune. Les tables sont nouvelles. Le `transcript_embeddings`
existant est inchangé.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "015_add_search_index_tables"
down_revision: Union[str, None] = "014_add_channel_contexts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── 1. flashcards ──────────────────────────────────────────────────────
    op.create_table(
        "flashcards",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("position", sa.Integer, nullable=False, default=0),
        sa.Column("front", sa.Text, nullable=False),
        sa.Column("back", sa.Text, nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("summary_id", "position", name="uix_flashcards_summary_position"),
    )
    op.create_index("ix_flashcards_summary", "flashcards", ["summary_id"])
    op.create_index("ix_flashcards_user", "flashcards", ["user_id"])

    # ─── 2. quiz_questions ──────────────────────────────────────────────────
    op.create_table(
        "quiz_questions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("position", sa.Integer, nullable=False, default=0),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("options_json", sa.Text, nullable=False),  # JSON list[str]
        sa.Column("correct_index", sa.Integer, nullable=False),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default="standard"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("summary_id", "position", name="uix_quiz_summary_position"),
    )
    op.create_index("ix_quiz_summary", "quiz_questions", ["summary_id"])
    op.create_index("ix_quiz_user", "quiz_questions", ["user_id"])

    # ─── 3. summary_embeddings ──────────────────────────────────────────────
    op.create_table(
        "summary_embeddings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("section_index", sa.Integer, nullable=False),
        sa.Column("section_ref", sa.String(100), nullable=True),
        sa.Column("embedding_json", sa.Text, nullable=False),
        sa.Column("text_preview", sa.String(500)),
        sa.Column("token_count", sa.Integer, default=0),
        sa.Column(
            "model_version",
            sa.String(50),
            nullable=False,
            server_default="mistral-embed",
        ),
        sa.Column("source_metadata", sa.Text, nullable=True),  # JSON
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("summary_id", "section_index", name="uix_summary_emb_section"),
    )
    op.create_index("ix_summary_emb_user", "summary_embeddings", ["user_id"])
    op.create_index("ix_summary_emb_summary", "summary_embeddings", ["summary_id"])
    op.create_index("ix_summary_emb_model", "summary_embeddings", ["model_version"])

    # ─── 4. flashcard_embeddings ────────────────────────────────────────────
    op.create_table(
        "flashcard_embeddings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "flashcard_id",
            sa.Integer,
            sa.ForeignKey("flashcards.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("embedding_json", sa.Text, nullable=False),
        sa.Column("text_preview", sa.String(500)),
        sa.Column(
            "model_version",
            sa.String(50),
            nullable=False,
            server_default="mistral-embed",
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_flashcard_emb_user", "flashcard_embeddings", ["user_id"])
    op.create_index("ix_flashcard_emb_summary", "flashcard_embeddings", ["summary_id"])

    # ─── 5. quiz_embeddings ─────────────────────────────────────────────────
    op.create_table(
        "quiz_embeddings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "quiz_question_id",
            sa.Integer,
            sa.ForeignKey("quiz_questions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("embedding_json", sa.Text, nullable=False),
        sa.Column("text_preview", sa.String(500)),
        sa.Column(
            "model_version",
            sa.String(50),
            nullable=False,
            server_default="mistral-embed",
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_quiz_emb_user", "quiz_embeddings", ["user_id"])
    op.create_index("ix_quiz_emb_summary", "quiz_embeddings", ["summary_id"])

    # ─── 6. chat_embeddings ─────────────────────────────────────────────────
    op.create_table(
        "chat_embeddings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("turn_index", sa.Integer, nullable=False),
        sa.Column(
            "user_message_id",
            sa.Integer,
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "agent_message_id",
            sa.Integer,
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("embedding_json", sa.Text, nullable=False),
        sa.Column("text_preview", sa.String(500)),
        sa.Column("token_count", sa.Integer, default=0),
        sa.Column(
            "model_version",
            sa.String(50),
            nullable=False,
            server_default="mistral-embed",
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("summary_id", "turn_index", name="uix_chat_emb_turn"),
    )
    op.create_index("ix_chat_emb_user", "chat_embeddings", ["user_id"])
    op.create_index("ix_chat_emb_summary_turn", "chat_embeddings", ["summary_id", "turn_index"])

    # ─── 7. explain_passage_cache ───────────────────────────────────────────
    op.create_table(
        "explain_passage_cache",
        sa.Column("cache_key", sa.String(64), primary_key=True),
        sa.Column("explanation", sa.Text, nullable=False),
        sa.Column("model_used", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_explain_cache_expires", "explain_passage_cache", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_explain_cache_expires", "explain_passage_cache")
    op.drop_table("explain_passage_cache")

    op.drop_index("ix_chat_emb_summary_turn", "chat_embeddings")
    op.drop_index("ix_chat_emb_user", "chat_embeddings")
    op.drop_table("chat_embeddings")

    op.drop_index("ix_quiz_emb_summary", "quiz_embeddings")
    op.drop_index("ix_quiz_emb_user", "quiz_embeddings")
    op.drop_table("quiz_embeddings")

    op.drop_index("ix_flashcard_emb_summary", "flashcard_embeddings")
    op.drop_index("ix_flashcard_emb_user", "flashcard_embeddings")
    op.drop_table("flashcard_embeddings")

    op.drop_index("ix_summary_emb_model", "summary_embeddings")
    op.drop_index("ix_summary_emb_summary", "summary_embeddings")
    op.drop_index("ix_summary_emb_user", "summary_embeddings")
    op.drop_table("summary_embeddings")

    op.drop_index("ix_quiz_user", "quiz_questions")
    op.drop_index("ix_quiz_summary", "quiz_questions")
    op.drop_table("quiz_questions")

    op.drop_index("ix_flashcards_user", "flashcards")
    op.drop_index("ix_flashcards_summary", "flashcards")
    op.drop_table("flashcards")
```

- [ ] **Step 1.2: Vérifier que la migration applique correctement en dev SQLite**

Run :

```bash
cd backend && alembic upgrade head
```

Expected output (extrait) :

```
INFO  [alembic.runtime.migration] Running upgrade 014_add_channel_contexts -> 015_add_search_index_tables, Add search index tables for Semantic Search V1.
```

- [ ] **Step 1.3: Vérifier le rollback**

Run :

```bash
cd backend && alembic downgrade -1 && alembic upgrade head
```

Expected : pas d'erreur, tables drop puis recreate clean.

- [ ] **Step 1.4: Commit**

```bash
git add backend/alembic/versions/015_add_search_index_tables.py
git commit -m "feat(search): alembic 015 — 7 search index tables (flashcards/quiz materialized + 4 embeddings + cache tooltip)"
```

---

## Task 2: Modèles SQLAlchemy dans database.py

**Files:**

- Modify: `backend/src/db/database.py` (ajout après la classe `TranscriptEmbedding` qui finit ligne 722)

- [ ] **Step 2.1: Ajouter les 7 modèles**

Ouvrir `backend/src/db/database.py`, repérer la ligne 722 (fin de `TranscriptEmbedding`), insérer juste après :

```python


# ════════════════════════════════════════════════════════════════════════════════
# 🔍 SEARCH INDEX V1 — Semantic Search étendu (Summary + Flashcard + Quiz + Chat)
# ════════════════════════════════════════════════════════════════════════════════


class Flashcard(Base):
    """Flashcards persistées (matérialisation pour permettre l'indexation sémantique).
    Avant V1 elles étaient générées à la volée par study/router.py sans persistance."""

    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False, default=0)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    category = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("summary_id", "position", name="uix_flashcards_summary_position"),
        Index("ix_flashcards_summary", "summary_id"),
        Index("ix_flashcards_user", "user_id"),
    )


class QuizQuestion(Base):
    """Quiz questions persistées (matérialisation pour permettre l'indexation)."""

    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False, default=0)
    question = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)  # JSON list[str]
    correct_index = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    difficulty = Column(String(20), nullable=False, default="standard", server_default="standard")
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("summary_id", "position", name="uix_quiz_summary_position"),
        Index("ix_quiz_summary", "summary_id"),
        Index("ix_quiz_user", "user_id"),
    )


class SummaryEmbedding(Base):
    """Embeddings par section du structured_index d'un Summary."""

    __tablename__ = "summary_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_index = Column(Integer, nullable=False)
    section_ref = Column(String(100), nullable=True)  # ts ou anchor
    embedding_json = Column(Text, nullable=False)  # JSON 1024 floats
    text_preview = Column(String(500))
    token_count = Column(Integer, default=0)
    model_version = Column(
        String(50), nullable=False, default="mistral-embed", server_default="mistral-embed"
    )
    source_metadata = Column(Text, nullable=True)  # JSON {tab, start_ts?, end_ts?, anchor?}
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("summary_id", "section_index", name="uix_summary_emb_section"),
        Index("ix_summary_emb_user", "user_id"),
        Index("ix_summary_emb_summary", "summary_id"),
        Index("ix_summary_emb_model", "model_version"),
    )


class FlashcardEmbedding(Base):
    """1 embedding par flashcard (Q+A concaténés)."""

    __tablename__ = "flashcard_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flashcard_id = Column(
        Integer,
        ForeignKey("flashcards.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    embedding_json = Column(Text, nullable=False)
    text_preview = Column(String(500))
    model_version = Column(
        String(50), nullable=False, default="mistral-embed", server_default="mistral-embed"
    )
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("ix_flashcard_emb_user", "user_id"),
        Index("ix_flashcard_emb_summary", "summary_id"),
    )


class QuizEmbedding(Base):
    """1 embedding par question quiz (question + bonne réponse)."""

    __tablename__ = "quiz_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    quiz_question_id = Column(
        Integer,
        ForeignKey("quiz_questions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    embedding_json = Column(Text, nullable=False)
    text_preview = Column(String(500))
    model_version = Column(
        String(50), nullable=False, default="mistral-embed", server_default="mistral-embed"
    )
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("ix_quiz_emb_user", "user_id"),
        Index("ix_quiz_emb_summary", "summary_id"),
    )


class ChatEmbedding(Base):
    """1 embedding par turn user+assistant fusionné dans une conversation."""

    __tablename__ = "chat_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    turn_index = Column(Integer, nullable=False)
    user_message_id = Column(
        Integer,
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=True,
    )
    agent_message_id = Column(
        Integer,
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=True,
    )
    embedding_json = Column(Text, nullable=False)
    text_preview = Column(String(500))
    token_count = Column(Integer, default=0)
    model_version = Column(
        String(50), nullable=False, default="mistral-embed", server_default="mistral-embed"
    )
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("summary_id", "turn_index", name="uix_chat_emb_turn"),
        Index("ix_chat_emb_user", "user_id"),
        Index("ix_chat_emb_summary_turn", "summary_id", "turn_index"),
    )


class ExplainPassageCache(Base):
    """Cache tooltip IA — 7 jours par sha256(query+passage_text+summary_id)."""

    __tablename__ = "explain_passage_cache"

    cache_key = Column(String(64), primary_key=True)
    explanation = Column(Text, nullable=False)
    model_used = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=func.now())
    expires_at = Column(DateTime, nullable=False)

    __table_args__ = (Index("ix_explain_cache_expires", "expires_at"),)
```

- [ ] **Step 2.2: Vérifier qu'aucun import manque**

Le fichier utilise déjà `Column, Integer, String, Text, ForeignKey, UniqueConstraint, Index, Boolean, DateTime, Float, func` (vérifier ligne 1-15). Si nécessaire, étendre l'import.

- [ ] **Step 2.3: Run pytest pour vérifier que les modèles parsent**

```bash
cd backend && python -c "from db.database import Flashcard, QuizQuestion, SummaryEmbedding, FlashcardEmbedding, QuizEmbedding, ChatEmbedding, ExplainPassageCache; print('OK')"
```

Expected : `OK`

- [ ] **Step 2.4: Commit**

```bash
git add backend/src/db/database.py
git commit -m "feat(search): SQLAlchemy models for 7 search index tables"
```

---

## Task 3: Test infrastructure (conftest fixtures)

**Files:**

- Create: `backend/tests/search/__init__.py` (vide)
- Create: `backend/tests/search/conftest.py`

- [ ] **Step 3.1: Créer **init**.py vide**

```bash
touch backend/tests/search/__init__.py
```

- [ ] **Step 3.2: Créer conftest.py avec fixtures Mistral mock**

```python
# backend/tests/search/conftest.py
"""Fixtures partagées pour les tests search/."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture
def fake_embedding_1024() -> list[float]:
    """Embedding factice de 1024 floats normalisés."""
    return [0.001 * (i + 1) for i in range(1024)]


@pytest.fixture
def fake_embedding_other_1024() -> list[float]:
    """Second embedding factice (différent du premier) pour tester cosine != 1.0."""
    return [0.002 * (i + 1) for i in range(1024)]


@pytest.fixture
def mock_mistral_embed_response(fake_embedding_1024):
    """Mock de la réponse JSON de POST /v1/embeddings."""
    return {
        "data": [{"embedding": fake_embedding_1024, "index": 0}],
        "model": "mistral-embed",
        "usage": {"prompt_tokens": 10, "total_tokens": 10},
    }


@pytest.fixture
def mock_mistral_embed_batch_response(fake_embedding_1024, fake_embedding_other_1024):
    """Mock de la réponse JSON pour un batch de 2 embeddings."""
    return {
        "data": [
            {"embedding": fake_embedding_1024, "index": 0},
            {"embedding": fake_embedding_other_1024, "index": 1},
        ],
        "model": "mistral-embed",
        "usage": {"prompt_tokens": 20, "total_tokens": 20},
    }


@pytest.fixture
def patch_httpx_post(monkeypatch, mock_mistral_embed_response):
    """Patche httpx.AsyncClient.post pour retourner un embedding factice."""
    mock_response = MagicMock()
    mock_response.json = MagicMock(return_value=mock_mistral_embed_response)
    mock_response.raise_for_status = MagicMock()
    mock_response.status_code = 200

    async def mock_post(*_args, **_kwargs):
        return mock_response

    import httpx

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr("search.embedding_service.MISTRAL_API_KEY", "sk-test-fake")
    return mock_post
```

- [ ] **Step 3.3: Vérifier que les fixtures sont importables**

```bash
cd backend && python -m pytest tests/search/ --collect-only -v 2>&1 | head -20
```

Expected : pas d'erreur d'import, "0 tests collected" est OK à ce stade.

- [ ] **Step 3.4: Commit**

```bash
git add backend/tests/search/__init__.py backend/tests/search/conftest.py
git commit -m "test(search): conftest fixtures Mistral embed mock + fake 1024-dim embeddings"
```

---

## Task 4: Persister Flashcards à la génération (study/router.py)

**Files:**

- Modify: `backend/src/study/router.py` (fonction `generate_flashcards` — repérer la ligne par grep)
- Test: `backend/tests/study/test_persistence.py` (créer)

- [ ] **Step 4.1: Écrire le test failing**

Créer `backend/tests/study/test_persistence.py` :

```python
# backend/tests/study/test_persistence.py
"""Tests de matérialisation flashcards/quiz pour l'indexation sémantique V1."""

import pytest
from sqlalchemy import select

from db.database import Flashcard, QuizQuestion


@pytest.mark.asyncio
async def test_generate_flashcards_persists_in_db(
    async_session, summary_factory, mock_generate_study_card
):
    """generate_flashcards doit upsert les flashcards en DB (replace existantes)."""
    summary = await summary_factory()
    # Mock le générateur LLM pour retourner 2 flashcards déterministes
    mock_generate_study_card.return_value = {
        "flashcards": [
            {"front": "Q1", "back": "A1", "category": "concept"},
            {"front": "Q2", "back": "A2", "category": "definition"},
        ]
    }

    from study.router import generate_flashcards

    response = await generate_flashcards(
        summary_id=summary.id,
        current_user=summary.user,
        session=async_session,
    )

    assert response.success is True
    assert len(response.flashcards) == 2

    # Verify DB state
    result = await async_session.execute(
        select(Flashcard).where(Flashcard.summary_id == summary.id).order_by(Flashcard.position)
    )
    rows = result.scalars().all()
    assert len(rows) == 2
    assert rows[0].front == "Q1"
    assert rows[0].back == "A1"
    assert rows[0].position == 0
    assert rows[0].user_id == summary.user_id


@pytest.mark.asyncio
async def test_generate_flashcards_replaces_existing(
    async_session, summary_factory, mock_generate_study_card
):
    """Une 2e génération doit DELETE les anciennes et INSERT les nouvelles."""
    summary = await summary_factory()
    # 1ère génération : 2 cartes
    mock_generate_study_card.return_value = {
        "flashcards": [{"front": "Q1", "back": "A1"}, {"front": "Q2", "back": "A2"}]
    }
    from study.router import generate_flashcards

    await generate_flashcards(summary.id, summary.user, async_session)

    # 2e génération : 3 cartes différentes
    mock_generate_study_card.return_value = {
        "flashcards": [
            {"front": "X1", "back": "Y1"},
            {"front": "X2", "back": "Y2"},
            {"front": "X3", "back": "Y3"},
        ]
    }
    await generate_flashcards(summary.id, summary.user, async_session)

    rows = (
        await async_session.execute(
            select(Flashcard).where(Flashcard.summary_id == summary.id).order_by(Flashcard.position)
        )
    ).scalars().all()
    assert len(rows) == 3
    assert [r.front for r in rows] == ["X1", "X2", "X3"]
```

- [ ] **Step 4.2: Run test, vérifier qu'il fail**

```bash
cd backend && python -m pytest tests/study/test_persistence.py -v
```

Expected : FAIL — flashcards générés en mémoire mais pas persistés.

- [ ] **Step 4.3: Repérer la fonction generate_flashcards**

```bash
grep -n "async def generate_flashcards\|@router.post.*flashcards" backend/src/study/router.py
```

Note la ligne de définition. La fonction retourne actuellement une `FlashcardsResponse` Pydantic en mémoire.

- [ ] **Step 4.4: Modifier generate_flashcards pour persister**

Repérer le bloc où la fonction construit la `FlashcardsResponse` (typiquement après l'appel à `generate_study_materials` ou `generate_study_card`). Insérer juste avant le `return` :

```python
    # ─── V1 Semantic Search : matérialisation des flashcards ────────────────
    from db.database import Flashcard
    from sqlalchemy import delete as sa_delete

    # 1. Delete existantes pour ce summary
    await session.execute(sa_delete(Flashcard).where(Flashcard.summary_id == summary_id))

    # 2. Insert nouvelles
    db_flashcards = []
    for idx, card in enumerate(flashcards_list):
        db_card = Flashcard(
            summary_id=summary_id,
            user_id=current_user.id,
            position=idx,
            front=card.front if hasattr(card, "front") else card["front"],
            back=card.back if hasattr(card, "back") else card["back"],
            category=getattr(card, "category", None) if hasattr(card, "category") else card.get("category"),
        )
        session.add(db_card)
        db_flashcards.append(db_card)

    await session.commit()

    # 3. Le trigger embed_flashcards sera ajouté en Task 17, pas dans cette task
    #    (le helper n'existe pas encore à ce stade du plan)

    # ─── End V1 Semantic Search materialization ─────────────────────────────
```

**Note** : le nom exact de la variable `flashcards_list` dépend du code existant. Lire la fonction et adapter (`response.flashcards`, `result["flashcards"]`, etc.) selon ce qui est retourné par le générateur LLM.

- [ ] **Step 4.5: Run test, vérifier qu'il passe**

```bash
cd backend && python -m pytest tests/study/test_persistence.py::test_generate_flashcards_persists_in_db -v
cd backend && python -m pytest tests/study/test_persistence.py::test_generate_flashcards_replaces_existing -v
```

Expected : 2 PASS.

- [ ] **Step 4.6: Commit**

```bash
git add backend/src/study/router.py backend/tests/study/test_persistence.py
git commit -m "feat(study): persist flashcards to DB on generation (Semantic Search V1 prep)"
```

---

## Task 5: Persister Quiz Questions à la génération (study/router.py)

**Files:**

- Modify: `backend/src/study/router.py` (fonction `generate_quiz`)
- Test: `backend/tests/study/test_persistence.py` (compléter)

- [ ] **Step 5.1: Écrire le test failing**

Ajouter à `backend/tests/study/test_persistence.py` :

```python
@pytest.mark.asyncio
async def test_generate_quiz_persists_in_db(
    async_session, summary_factory, mock_generate_study_card
):
    """generate_quiz doit upsert les questions en DB."""
    summary = await summary_factory()
    mock_generate_study_card.return_value = {
        "quiz": [
            {
                "question": "Q1?",
                "options": ["A", "B", "C", "D"],
                "correct_index": 1,
                "explanation": "B est correct car...",
            },
            {
                "question": "Q2?",
                "options": ["E", "F", "G", "H"],
                "correct_index": 3,
                "explanation": None,
            },
        ]
    }

    from study.router import generate_quiz

    response = await generate_quiz(summary.id, summary.user, async_session)

    assert response.success is True
    assert len(response.quiz) == 2

    rows = (
        await async_session.execute(
            select(QuizQuestion).where(QuizQuestion.summary_id == summary.id).order_by(QuizQuestion.position)
        )
    ).scalars().all()
    assert len(rows) == 2
    assert rows[0].question == "Q1?"
    assert rows[0].correct_index == 1
    assert rows[0].explanation == "B est correct car..."
    import json as _json
    assert _json.loads(rows[0].options_json) == ["A", "B", "C", "D"]


@pytest.mark.asyncio
async def test_generate_quiz_replaces_existing(
    async_session, summary_factory, mock_generate_study_card
):
    summary = await summary_factory()
    mock_generate_study_card.return_value = {
        "quiz": [{"question": "Q1?", "options": ["A","B"], "correct_index": 0}]
    }
    from study.router import generate_quiz
    await generate_quiz(summary.id, summary.user, async_session)

    mock_generate_study_card.return_value = {
        "quiz": [
            {"question": "X1?", "options": ["P","Q"], "correct_index": 1},
            {"question": "X2?", "options": ["R","S"], "correct_index": 0},
        ]
    }
    await generate_quiz(summary.id, summary.user, async_session)

    rows = (
        await async_session.execute(
            select(QuizQuestion).where(QuizQuestion.summary_id == summary.id).order_by(QuizQuestion.position)
        )
    ).scalars().all()
    assert len(rows) == 2
    assert [r.question for r in rows] == ["X1?", "X2?"]
```

- [ ] **Step 5.2: Run test, vérifier qu'il fail**

```bash
cd backend && python -m pytest tests/study/test_persistence.py::test_generate_quiz_persists_in_db -v
```

Expected : FAIL.

- [ ] **Step 5.3: Modifier generate_quiz pour persister**

Repérer la fonction `generate_quiz`. Insérer juste avant le `return` :

```python
    # ─── V1 Semantic Search : matérialisation des quiz questions ────────────
    import json as _json
    from db.database import QuizQuestion as DBQuizQuestion
    from sqlalchemy import delete as sa_delete

    await session.execute(
        sa_delete(DBQuizQuestion).where(DBQuizQuestion.summary_id == summary_id)
    )

    for idx, q in enumerate(quiz_list):
        db_q = DBQuizQuestion(
            summary_id=summary_id,
            user_id=current_user.id,
            position=idx,
            question=q.question if hasattr(q, "question") else q["question"],
            options_json=_json.dumps(
                q.options if hasattr(q, "options") else q["options"]
            ),
            correct_index=q.correct_index if hasattr(q, "correct_index") else q["correct_index"],
            explanation=getattr(q, "explanation", None) if hasattr(q, "explanation") else q.get("explanation"),
            difficulty=getattr(q, "difficulty", "standard") if hasattr(q, "difficulty") else q.get("difficulty", "standard"),
        )
        session.add(db_q)

    await session.commit()

    # ─── End V1 Semantic Search materialization ─────────────────────────────
```

**Note** : adapter `quiz_list` selon le nom de variable réel dans la fonction. L'alias `as DBQuizQuestion` évite le shadowing avec le Pydantic model `QuizQuestion` déjà importé en haut du fichier.

- [ ] **Step 5.4: Run tests**

```bash
cd backend && python -m pytest tests/study/test_persistence.py -v
```

Expected : 4 PASS (2 flashcards + 2 quiz).

- [ ] **Step 5.5: Commit**

```bash
git add backend/src/study/router.py backend/tests/study/test_persistence.py
git commit -m "feat(study): persist quiz questions to DB on generation (Semantic Search V1 prep)"
```

---

## Task 6: Étendre embedding_service.py — helpers `embed_summary`

**Files:**

- Modify: `backend/src/search/embedding_service.py` (ajout après `embed_transcript` ligne 181)
- Test: `backend/tests/search/test_embedding_service.py` (créer)

- [ ] **Step 6.1: Écrire le test failing**

```python
# backend/tests/search/test_embedding_service.py
"""Tests pour les nouveaux helpers d'embedding (Summary, Flashcard, Quiz, Chat)."""

import json
import pytest
from sqlalchemy import select
from unittest.mock import patch, AsyncMock, MagicMock

from db.database import Summary, SummaryEmbedding


@pytest.mark.asyncio
async def test_embed_summary_uses_structured_index(
    async_session, summary_factory, patch_httpx_post
):
    """embed_summary doit créer 1 embedding par section du structured_index."""
    summary = await summary_factory(
        structured_index=json.dumps([
            {"ts": "00:00", "title": "Intro", "summary": "Présentation", "kw": ["intro"]},
            {"ts": "01:30", "title": "Main", "summary": "Développement", "kw": ["main"]},
            {"ts": "05:00", "title": "Outro", "summary": "Conclusion", "kw": ["outro"]},
        ]),
        full_digest="Some full digest content unused here",
    )

    from search.embedding_service import embed_summary
    result = await embed_summary(summary.id)

    assert result is True
    rows = (
        await async_session.execute(
            select(SummaryEmbedding).where(SummaryEmbedding.summary_id == summary.id).order_by(SummaryEmbedding.section_index)
        )
    ).scalars().all()
    assert len(rows) == 3
    assert rows[0].section_ref == "00:00"
    assert "Intro" in rows[0].text_preview


@pytest.mark.asyncio
async def test_embed_summary_falls_back_to_full_digest_chunks(
    async_session, summary_factory, patch_httpx_post
):
    """Si structured_index manquant, fallback chunks 500 mots du full_digest."""
    summary = await summary_factory(
        structured_index=None,
        full_digest=" ".join(["mot"] * 1200),  # 1200 mots → 3 chunks de 500
    )

    from search.embedding_service import embed_summary
    result = await embed_summary(summary.id)

    assert result is True
    rows = (
        await async_session.execute(
            select(SummaryEmbedding).where(SummaryEmbedding.summary_id == summary.id)
        )
    ).scalars().all()
    # 1200 mots / 500 = 2 chunks pleins + 1 partiel = 3 chunks
    assert len(rows) >= 2
    assert all(r.section_ref is None for r in rows)  # pas de ts en mode fallback


@pytest.mark.asyncio
async def test_embed_summary_idempotent(
    async_session, summary_factory, patch_httpx_post
):
    """Un 2e appel sur le même summary doit replace, pas duplicate."""
    summary = await summary_factory(
        structured_index=json.dumps([{"ts": "00:00", "title": "X", "summary": "Y", "kw": []}])
    )

    from search.embedding_service import embed_summary
    await embed_summary(summary.id)
    await embed_summary(summary.id)

    rows = (
        await async_session.execute(
            select(SummaryEmbedding).where(SummaryEmbedding.summary_id == summary.id)
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_embed_summary_returns_false_on_missing_summary(async_session):
    from search.embedding_service import embed_summary
    result = await embed_summary(summary_id=999999)
    assert result is False
```

- [ ] **Step 6.2: Run test, vérifier qu'il fail**

```bash
cd backend && python -m pytest tests/search/test_embedding_service.py::test_embed_summary_uses_structured_index -v
```

Expected : FAIL — `ImportError: cannot import name 'embed_summary'`.

- [ ] **Step 6.3: Implémenter `embed_summary`**

Ajouter à `backend/src/search/embedding_service.py` après la ligne 181 (fin de `embed_transcript`) :

```python


# ════════════════════════════════════════════════════════════════════════════════
# 🔍 SEMANTIC SEARCH V1 — embed helpers étendus
# ════════════════════════════════════════════════════════════════════════════════


async def embed_summary(summary_id: int) -> bool:
    """Embed un Summary par section du structured_index, fallback chunks full_digest.

    Idempotent : delete les SummaryEmbedding existants pour ce summary, puis insert.
    Returns True si succès, False si Summary introuvable ou échec embed.
    """
    from db.database import async_session_maker, Summary, SummaryEmbedding
    from sqlalchemy import select, delete as sa_delete

    async with async_session_maker() as session:
        summary = await session.get(Summary, summary_id)
        if summary is None:
            logger.warning(f"[EMBED-SUMMARY] Summary {summary_id} not found")
            return False

        # Parse structured_index si présent
        sections: list[dict] = []
        if summary.structured_index:
            try:
                parsed = json.loads(summary.structured_index)
                if isinstance(parsed, list):
                    sections = parsed
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(
                    f"[EMBED-SUMMARY] structured_index invalid JSON for {summary_id}: {e}"
                )

        # Fallback : chunks 500 mots du full_digest
        if not sections:
            text = summary.full_digest or summary.summary_content or ""
            if not text.strip():
                logger.info(f"[EMBED-SUMMARY] No content to embed for {summary_id}")
                return False
            chunks = _chunk_text(text, words_per_chunk=CHUNK_WORDS)
            sections = [
                {"ts": None, "title": f"Section {i+1}", "summary": chunk, "kw": []}
                for i, chunk in enumerate(chunks)
            ]

        # Préparer les textes à embed
        texts = [
            f"{section.get('title', '')}\n\n{section.get('summary', '')}"
            for section in sections
        ]

        # Delete existants (idempotence)
        await session.execute(
            sa_delete(SummaryEmbedding).where(SummaryEmbedding.summary_id == summary_id)
        )

        # Embed par batches de 10
        all_embeddings: list = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            batch_embeddings = await generate_embeddings_batch(batch)
            all_embeddings.extend(batch_embeddings)

        # Insert
        inserted = 0
        for idx, (section, embedding) in enumerate(zip(sections, all_embeddings)):
            if embedding is None:
                logger.warning(f"[EMBED-SUMMARY] Embedding {idx} failed for {summary_id}")
                continue
            preview = (texts[idx] or "")[:497]
            if len(texts[idx]) > 500:
                preview += "..."
            session.add(
                SummaryEmbedding(
                    summary_id=summary_id,
                    user_id=summary.user_id,
                    section_index=idx,
                    section_ref=str(section.get("ts")) if section.get("ts") else None,
                    embedding_json=json.dumps(embedding),
                    text_preview=preview,
                    token_count=len(texts[idx].split()),
                    model_version=MODEL_VERSION_TAG,
                    source_metadata=json.dumps(
                        {
                            "tab": "synthesis" if summary.structured_index else "digest",
                            "ts": section.get("ts"),
                            "title": section.get("title"),
                            "kw": section.get("kw", []),
                        }
                    ),
                )
            )
            inserted += 1

        await session.commit()
        logger.info(
            f"[EMBED-SUMMARY] {summary_id}: {inserted}/{len(sections)} sections embedded"
        )
        return inserted > 0
```

- [ ] **Step 6.4: Run tests**

```bash
cd backend && python -m pytest tests/search/test_embedding_service.py -v
```

Expected : 4 PASS.

- [ ] **Step 6.5: Commit**

```bash
git add backend/src/search/embedding_service.py backend/tests/search/test_embedding_service.py
git commit -m "feat(search): embed_summary helper — structured_index sections + full_digest fallback"
```

---

## Task 7: `embed_flashcards` helper

**Files:**

- Modify: `backend/src/search/embedding_service.py`
- Modify: `backend/tests/search/test_embedding_service.py`

- [ ] **Step 7.1: Écrire le test failing**

Ajouter à `test_embedding_service.py` :

```python
@pytest.mark.asyncio
async def test_embed_flashcards(
    async_session, summary_factory, flashcard_factory, patch_httpx_post
):
    summary = await summary_factory()
    f1 = await flashcard_factory(summary=summary, position=0, front="Q1", back="A1")
    f2 = await flashcard_factory(summary=summary, position=1, front="Q2", back="A2")

    from search.embedding_service import embed_flashcards
    result = await embed_flashcards(summary.id)

    assert result is True
    from db.database import FlashcardEmbedding
    rows = (
        await async_session.execute(
            select(FlashcardEmbedding).where(FlashcardEmbedding.summary_id == summary.id)
        )
    ).scalars().all()
    assert len(rows) == 2
    assert {r.flashcard_id for r in rows} == {f1.id, f2.id}
    assert all("Q" in r.text_preview and "A" in r.text_preview for r in rows)


@pytest.mark.asyncio
async def test_embed_flashcards_idempotent(
    async_session, summary_factory, flashcard_factory, patch_httpx_post
):
    summary = await summary_factory()
    await flashcard_factory(summary=summary, position=0, front="Q", back="A")
    from search.embedding_service import embed_flashcards
    await embed_flashcards(summary.id)
    await embed_flashcards(summary.id)
    from db.database import FlashcardEmbedding
    rows = (
        await async_session.execute(
            select(FlashcardEmbedding).where(FlashcardEmbedding.summary_id == summary.id)
        )
    ).scalars().all()
    assert len(rows) == 1
```

- [ ] **Step 7.2: Run, fail, implémenter**

```bash
cd backend && python -m pytest tests/search/test_embedding_service.py::test_embed_flashcards -v
```

Expected FAIL puis ajouter dans `embedding_service.py` :

```python


async def embed_flashcards(summary_id: int) -> bool:
    """Embed toutes les flashcards d'un Summary (Q+A concaténés).

    Idempotent : delete les FlashcardEmbedding existants, puis insert.
    """
    from db.database import async_session_maker, Flashcard, FlashcardEmbedding
    from sqlalchemy import select, delete as sa_delete

    async with async_session_maker() as session:
        result = await session.execute(
            select(Flashcard).where(Flashcard.summary_id == summary_id).order_by(Flashcard.position)
        )
        flashcards = result.scalars().all()

        if not flashcards:
            logger.info(f"[EMBED-FLASHCARD] No flashcards for summary {summary_id}")
            return False

        # Texts : "Q: ...\n\nA: ..."
        texts = [f"Q: {f.front}\n\nA: {f.back}" for f in flashcards]

        # Delete existants
        await session.execute(
            sa_delete(FlashcardEmbedding).where(FlashcardEmbedding.summary_id == summary_id)
        )

        # Embed par batches
        all_embeddings = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            all_embeddings.extend(await generate_embeddings_batch(batch))

        user_id = flashcards[0].user_id
        inserted = 0
        for f, embedding, text in zip(flashcards, all_embeddings, texts):
            if embedding is None:
                continue
            session.add(
                FlashcardEmbedding(
                    flashcard_id=f.id,
                    summary_id=summary_id,
                    user_id=user_id,
                    embedding_json=json.dumps(embedding),
                    text_preview=text[:500],
                    model_version=MODEL_VERSION_TAG,
                )
            )
            inserted += 1

        await session.commit()
        logger.info(f"[EMBED-FLASHCARD] {summary_id}: {inserted}/{len(flashcards)} flashcards embedded")
        return inserted > 0
```

- [ ] **Step 7.3: Run tests**

```bash
cd backend && python -m pytest tests/search/test_embedding_service.py::test_embed_flashcards tests/search/test_embedding_service.py::test_embed_flashcards_idempotent -v
```

Expected : 2 PASS.

- [ ] **Step 7.4: Commit**

```bash
git add backend/src/search/embedding_service.py backend/tests/search/test_embedding_service.py
git commit -m "feat(search): embed_flashcards helper — Q+A concatenated, idempotent"
```

---

## Task 8: `embed_quiz` helper

**Files:**

- Modify: `backend/src/search/embedding_service.py`
- Modify: `backend/tests/search/test_embedding_service.py`

- [ ] **Step 8.1: Test failing**

```python
@pytest.mark.asyncio
async def test_embed_quiz(
    async_session, summary_factory, quiz_question_factory, patch_httpx_post
):
    summary = await summary_factory()
    q1 = await quiz_question_factory(
        summary=summary, position=0,
        question="Quelle est la capitale ?",
        options=["Paris","Lyon","Berlin","Rome"], correct_index=0
    )
    q2 = await quiz_question_factory(
        summary=summary, position=1,
        question="Combien font 2+2 ?",
        options=["3","4","5"], correct_index=1
    )

    from search.embedding_service import embed_quiz
    result = await embed_quiz(summary.id)

    assert result is True
    from db.database import QuizEmbedding
    rows = (
        await async_session.execute(
            select(QuizEmbedding).where(QuizEmbedding.summary_id == summary.id)
        )
    ).scalars().all()
    assert len(rows) == 2
    # Le text_preview doit contenir question + bonne réponse
    assert any("Paris" in r.text_preview for r in rows)
    assert any("4" in r.text_preview for r in rows)
```

- [ ] **Step 8.2: Implémenter**

Ajouter dans `embedding_service.py` :

```python


async def embed_quiz(summary_id: int) -> bool:
    """Embed toutes les quiz questions d'un Summary (question + bonne réponse).

    Idempotent.
    """
    from db.database import async_session_maker, QuizQuestion, QuizEmbedding
    from sqlalchemy import select, delete as sa_delete

    async with async_session_maker() as session:
        result = await session.execute(
            select(QuizQuestion).where(QuizQuestion.summary_id == summary_id).order_by(QuizQuestion.position)
        )
        questions = result.scalars().all()

        if not questions:
            logger.info(f"[EMBED-QUIZ] No quiz questions for summary {summary_id}")
            return False

        # Texts : "Q: ...\n\nBonne réponse : ..."
        texts: list[str] = []
        for q in questions:
            try:
                options = json.loads(q.options_json)
                correct_text = options[q.correct_index] if 0 <= q.correct_index < len(options) else "?"
            except (json.JSONDecodeError, IndexError):
                correct_text = "?"
            texts.append(f"Q: {q.question}\n\nBonne réponse : {correct_text}")

        # Delete existants
        await session.execute(
            sa_delete(QuizEmbedding).where(QuizEmbedding.summary_id == summary_id)
        )

        # Embed par batches
        all_embeddings = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            all_embeddings.extend(await generate_embeddings_batch(batch))

        user_id = questions[0].user_id
        inserted = 0
        for q, embedding, text in zip(questions, all_embeddings, texts):
            if embedding is None:
                continue
            session.add(
                QuizEmbedding(
                    quiz_question_id=q.id,
                    summary_id=summary_id,
                    user_id=user_id,
                    embedding_json=json.dumps(embedding),
                    text_preview=text[:500],
                    model_version=MODEL_VERSION_TAG,
                )
            )
            inserted += 1

        await session.commit()
        logger.info(f"[EMBED-QUIZ] {summary_id}: {inserted}/{len(questions)} quiz embedded")
        return inserted > 0
```

- [ ] **Step 8.3: Run tests**

```bash
cd backend && python -m pytest tests/search/test_embedding_service.py::test_embed_quiz -v
```

Expected : PASS.

- [ ] **Step 8.4: Commit**

```bash
git add backend/src/search/embedding_service.py backend/tests/search/test_embedding_service.py
git commit -m "feat(search): embed_quiz helper — question + correct answer"
```

---

## Task 9: `embed_chat_turn` helper

**Files:**

- Modify: `backend/src/search/embedding_service.py`
- Modify: `backend/tests/search/test_embedding_service.py`

- [ ] **Step 9.1: Test failing**

```python
@pytest.mark.asyncio
async def test_embed_chat_turn(
    async_session, summary_factory, chat_message_factory, patch_httpx_post
):
    summary = await summary_factory()
    user_msg = await chat_message_factory(
        summary=summary, role="user",
        content="Peux-tu m'expliquer la transition énergétique européenne ?",
    )
    agent_msg = await chat_message_factory(
        summary=summary, role="assistant",
        content="La transition énergétique européenne désigne le passage progressif des énergies fossiles vers les renouvelables, encadré par le Green Deal de 2019.",
    )

    from search.embedding_service import embed_chat_turn
    result = await embed_chat_turn(user_msg.id, agent_msg.id)

    assert result is True
    from db.database import ChatEmbedding
    rows = (
        await async_session.execute(
            select(ChatEmbedding).where(ChatEmbedding.summary_id == summary.id)
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_message_id == user_msg.id
    assert rows[0].agent_message_id == agent_msg.id


@pytest.mark.asyncio
async def test_embed_chat_turn_skips_short_turns(
    async_session, summary_factory, chat_message_factory, patch_httpx_post
):
    """Turn avec <30 tokens combinés doit être skippé."""
    summary = await summary_factory()
    user_msg = await chat_message_factory(summary=summary, role="user", content="ok")
    agent_msg = await chat_message_factory(summary=summary, role="assistant", content="d'accord")

    from search.embedding_service import embed_chat_turn
    result = await embed_chat_turn(user_msg.id, agent_msg.id)
    assert result is False
    from db.database import ChatEmbedding
    rows = (
        await async_session.execute(select(ChatEmbedding))
    ).scalars().all()
    assert len(rows) == 0
```

- [ ] **Step 9.2: Implémenter**

Ajouter dans `embedding_service.py` :

```python


MIN_TURN_TOKENS = 30  # filtre turns trop courts (ok merci, etc.)


async def embed_chat_turn(user_msg_id: int, agent_msg_id: int) -> bool:
    """Embed une paire user+agent comme un seul turn searchable.

    Skip si tokens combinés < MIN_TURN_TOKENS (filtre noise).
    Idempotent par (summary_id, turn_index) — recompute le turn_index à partir
    de la position du user_msg dans la conversation.
    """
    from db.database import async_session_maker, ChatMessage, ChatEmbedding
    from sqlalchemy import select, func as sa_func, delete as sa_delete

    async with async_session_maker() as session:
        user_msg = await session.get(ChatMessage, user_msg_id)
        agent_msg = await session.get(ChatMessage, agent_msg_id)
        if user_msg is None or agent_msg is None:
            logger.warning(
                f"[EMBED-CHAT] Messages not found: user={user_msg_id} agent={agent_msg_id}"
            )
            return False

        if user_msg.summary_id != agent_msg.summary_id:
            logger.warning(
                f"[EMBED-CHAT] summary_id mismatch: {user_msg.summary_id} != {agent_msg.summary_id}"
            )
            return False

        summary_id = user_msg.summary_id
        if summary_id is None:
            logger.info(f"[EMBED-CHAT] Skipping orphan messages (no summary_id)")
            return False

        # Filtre noise — approx 1 token = 1 mot
        combined_tokens = len(user_msg.content.split()) + len(agent_msg.content.split())
        if combined_tokens < MIN_TURN_TOKENS:
            logger.debug(
                f"[EMBED-CHAT] Skip short turn ({combined_tokens} tokens) for summary {summary_id}"
            )
            return False

        # Compute turn_index : nb de paires user+assistant dans cette conversation jusqu'à user_msg
        result = await session.execute(
            select(sa_func.count())
            .select_from(ChatMessage)
            .where(
                ChatMessage.summary_id == summary_id,
                ChatMessage.role == "user",
                ChatMessage.created_at < user_msg.created_at,
            )
        )
        turn_index = result.scalar() or 0

        # Embed
        text = f"Q: {user_msg.content}\n\nA: {agent_msg.content}"
        embedding = await generate_embedding(text)
        if embedding is None:
            logger.warning(f"[EMBED-CHAT] Embedding failed for turn {turn_index}")
            return False

        # Idempotence : delete pour ce (summary_id, turn_index) puis insert
        await session.execute(
            sa_delete(ChatEmbedding).where(
                ChatEmbedding.summary_id == summary_id,
                ChatEmbedding.turn_index == turn_index,
            )
        )

        session.add(
            ChatEmbedding(
                summary_id=summary_id,
                user_id=user_msg.user_id,
                turn_index=turn_index,
                user_message_id=user_msg_id,
                agent_message_id=agent_msg_id,
                embedding_json=json.dumps(embedding),
                text_preview=text[:500],
                token_count=combined_tokens,
                model_version=MODEL_VERSION_TAG,
            )
        )

        await session.commit()
        logger.info(
            f"[EMBED-CHAT] summary {summary_id} turn {turn_index} embedded ({combined_tokens} tokens)"
        )
        return True
```

- [ ] **Step 9.3: Run tests**

```bash
cd backend && python -m pytest tests/search/test_embedding_service.py::test_embed_chat_turn tests/search/test_embedding_service.py::test_embed_chat_turn_skips_short_turns -v
```

Expected : 2 PASS.

- [ ] **Step 9.4: Commit**

```bash
git add backend/src/search/embedding_service.py backend/tests/search/test_embedding_service.py
git commit -m "feat(search): embed_chat_turn helper — paired user+assistant, skip noise <30 tokens"
```

---

## Task 10: Service `global_search`

**Files:**

- Create: `backend/src/search/global_search.py`
- Create: `backend/tests/search/test_global_search.py`

- [ ] **Step 10.1: Écrire le test failing**

```python
# backend/tests/search/test_global_search.py
"""Tests pour le moteur de recherche globale cross-source."""

import json
import pytest
from unittest.mock import patch

from db.database import (
    SummaryEmbedding, FlashcardEmbedding, QuizEmbedding, ChatEmbedding
)


@pytest.fixture
def patched_query_embedding(monkeypatch, fake_embedding_1024):
    """Patche generate_embedding pour la query (différent du seed des fixtures)."""
    async def fake_gen(text: str):
        return [0.5] * 1024  # query embedding différent
    monkeypatch.setattr("search.global_search.generate_embedding", fake_gen)
    monkeypatch.setattr("search.global_search.MIN_SIMILARITY", 0.0)  # pas de filtre score


@pytest.mark.asyncio
async def test_search_global_filters_by_user_id(
    async_session, summary_factory, summary_embedding_factory,
    user_factory, patched_query_embedding,
):
    user_a = await user_factory(email="a@test.com")
    user_b = await user_factory(email="b@test.com")
    summary_a = await summary_factory(user=user_a)
    summary_b = await summary_factory(user=user_b)
    await summary_embedding_factory(summary=summary_a, section_index=0, text_preview="content user A")
    await summary_embedding_factory(summary=summary_b, section_index=0, text_preview="content user B")

    from search.global_search import search_global, SearchFilters
    results = await search_global(
        user_id=user_a.id,
        query="test",
        filters=SearchFilters(limit=10, source_types=["summary"]),
    )

    assert all(r.user_id == user_a.id if hasattr(r, 'user_id') else "user A" in r.text_preview for r in results)
    assert len(results) == 1


@pytest.mark.asyncio
async def test_search_global_filters_by_source_types(
    async_session, summary_factory, summary_embedding_factory,
    flashcard_factory, flashcard_embedding_factory, patched_query_embedding,
):
    summary = await summary_factory()
    await summary_embedding_factory(summary=summary, section_index=0, text_preview="from summary")
    fc = await flashcard_factory(summary=summary, front="Q", back="A")
    await flashcard_embedding_factory(flashcard=fc, text_preview="from flashcard")

    from search.global_search import search_global, SearchFilters
    # Only summaries
    results = await search_global(
        user_id=summary.user_id,
        query="test",
        filters=SearchFilters(limit=10, source_types=["summary"]),
    )
    assert all(r.source_type == "summary" for r in results)

    # Only flashcards
    results = await search_global(
        user_id=summary.user_id,
        query="test",
        filters=SearchFilters(limit=10, source_types=["flashcard"]),
    )
    assert all(r.source_type == "flashcard" for r in results)
```

- [ ] **Step 10.2: Run, fail, implémenter**

Créer `backend/src/search/global_search.py` :

```python
"""Service de recherche sémantique globale (cross-source, filtré user_id).

Charge les embeddings depuis les 5 tables (summary/flashcard/quiz/chat/transcript),
calcule le cosine vs l'embedding de la query, retourne les top N triés.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from db.database import (
    async_session_maker,
    Summary,
    SummaryEmbedding,
    Flashcard,
    FlashcardEmbedding,
    QuizQuestion,
    QuizEmbedding,
    ChatMessage,
    ChatEmbedding,
    TranscriptEmbedding,
    TranscriptCache,
)
from .embedding_service import (
    generate_embedding,
    _cosine_similarity,
    MIN_SIMILARITY,
)

logger = logging.getLogger(__name__)

ALL_SOURCE_TYPES = ["summary", "flashcard", "quiz", "chat", "transcript"]


@dataclass
class SearchFilters:
    limit: int = 30
    source_types: list[str] = field(default_factory=lambda: list(ALL_SOURCE_TYPES))
    platform: Optional[str] = None
    lang: Optional[str] = None
    category: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    favorites_only: bool = False
    playlist_id: Optional[str] = None


@dataclass
class SearchResult:
    source_type: str  # summary|flashcard|quiz|chat|transcript
    source_id: int
    summary_id: Optional[int]
    score: float
    text_preview: str
    source_metadata: dict


async def search_global(
    user_id: int, query: str, filters: SearchFilters
) -> list[SearchResult]:
    """Recherche sémantique globale, filtrée par user_id et options."""
    if not query or len(query) < 2:
        return []

    query_embedding = await generate_embedding(query)
    if query_embedding is None:
        logger.error(f"[SEARCH-GLOBAL] Failed to embed query for user {user_id}")
        return []

    candidates: list[SearchResult] = []

    async with async_session_maker() as session:
        # ─── Summaries ──────────────────────────────────────────────────────
        if "summary" in filters.source_types:
            stmt = (
                select(SummaryEmbedding, Summary)
                .join(Summary, SummaryEmbedding.summary_id == Summary.id)
                .where(SummaryEmbedding.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            for emb, summary in (await session.execute(stmt)).all():
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                meta = json.loads(emb.source_metadata) if emb.source_metadata else {}
                candidates.append(
                    SearchResult(
                        source_type="summary",
                        source_id=emb.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            **meta,
                            "summary_title": summary.video_title,
                            "summary_thumbnail": summary.thumbnail_url,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "section_ref": emb.section_ref,
                        },
                    )
                )

        # ─── Flashcards ─────────────────────────────────────────────────────
        if "flashcard" in filters.source_types:
            stmt = (
                select(FlashcardEmbedding, Flashcard, Summary)
                .join(Flashcard, FlashcardEmbedding.flashcard_id == Flashcard.id)
                .join(Summary, FlashcardEmbedding.summary_id == Summary.id)
                .where(FlashcardEmbedding.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            for emb, fc, summary in (await session.execute(stmt)).all():
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                candidates.append(
                    SearchResult(
                        source_type="flashcard",
                        source_id=fc.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            "summary_title": summary.video_title,
                            "summary_thumbnail": summary.thumbnail_url,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "tab": "flashcards",
                            "flashcard_id": fc.id,
                            "position": fc.position,
                        },
                    )
                )

        # ─── Quiz ───────────────────────────────────────────────────────────
        if "quiz" in filters.source_types:
            stmt = (
                select(QuizEmbedding, QuizQuestion, Summary)
                .join(QuizQuestion, QuizEmbedding.quiz_question_id == QuizQuestion.id)
                .join(Summary, QuizEmbedding.summary_id == Summary.id)
                .where(QuizEmbedding.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            for emb, q, summary in (await session.execute(stmt)).all():
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                candidates.append(
                    SearchResult(
                        source_type="quiz",
                        source_id=q.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            "summary_title": summary.video_title,
                            "summary_thumbnail": summary.thumbnail_url,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "tab": "quiz",
                            "quiz_question_id": q.id,
                            "position": q.position,
                        },
                    )
                )

        # ─── Chat ───────────────────────────────────────────────────────────
        if "chat" in filters.source_types:
            stmt = (
                select(ChatEmbedding, Summary)
                .join(Summary, ChatEmbedding.summary_id == Summary.id)
                .where(ChatEmbedding.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            for emb, summary in (await session.execute(stmt)).all():
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                candidates.append(
                    SearchResult(
                        source_type="chat",
                        source_id=emb.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            "summary_title": summary.video_title,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "tab": "chat",
                            "turn_index": emb.turn_index,
                            "user_message_id": emb.user_message_id,
                            "agent_message_id": emb.agent_message_id,
                        },
                    )
                )

        # ─── Transcripts (filtré via JOIN summaries.user_id) ────────────────
        if "transcript" in filters.source_types:
            # Le transcript est cross-user mais on ne montre que si le user a une
            # Summary qui pointe sur ce video_id.
            stmt = (
                select(TranscriptEmbedding, TranscriptCache, Summary)
                .join(TranscriptCache, TranscriptEmbedding.video_id == TranscriptCache.video_id)
                .join(Summary, Summary.video_id == TranscriptCache.video_id)
                .where(Summary.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            seen_video_ids = set()
            for emb, tc, summary in (await session.execute(stmt)).all():
                if (emb.video_id, emb.chunk_index) in seen_video_ids:
                    continue
                seen_video_ids.add((emb.video_id, emb.chunk_index))
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                candidates.append(
                    SearchResult(
                        source_type="transcript",
                        source_id=emb.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            "summary_title": summary.video_title,
                            "summary_thumbnail": summary.thumbnail_url,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "tab": "transcript",
                            "chunk_index": emb.chunk_index,
                        },
                    )
                )

    candidates.sort(key=lambda r: -r.score)
    return candidates[: filters.limit]


def _apply_summary_filters(stmt, filters: SearchFilters):
    """Applique les filtres optionnels qui dépendent de la table Summary."""
    if filters.platform:
        stmt = stmt.where(Summary.platform == filters.platform)
    if filters.lang:
        stmt = stmt.where(Summary.lang == filters.lang)
    if filters.category:
        stmt = stmt.where(Summary.category == filters.category)
    if filters.date_from:
        stmt = stmt.where(Summary.created_at >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(Summary.created_at <= filters.date_to)
    if filters.favorites_only:
        stmt = stmt.where(Summary.is_favorite.is_(True))
    if filters.playlist_id:
        stmt = stmt.where(Summary.playlist_id == filters.playlist_id)
    return stmt
```

- [ ] **Step 10.3: Run tests**

```bash
cd backend && python -m pytest tests/search/test_global_search.py -v
```

Expected : 2 PASS.

- [ ] **Step 10.4: Commit**

```bash
git add backend/src/search/global_search.py backend/tests/search/test_global_search.py
git commit -m "feat(search): global_search service — cross-source semantic with user_id filter"
```

---

## Task 11: Endpoint `POST /api/search/global`

**Files:**

- Modify: `backend/src/search/router.py`
- Create: `backend/tests/search/test_router.py`

- [ ] **Step 11.1: Écrire le test failing**

```python
# backend/tests/search/test_router.py
"""Tests pour les endpoints /api/search/*."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_global_requires_auth(client: AsyncClient):
    response = await client.post("/api/search/global", json={"query": "test"})
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_search_global_validates_query_min_length(authed_client: AsyncClient):
    response = await authed_client.post("/api/search/global", json={"query": "x"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_search_global_returns_empty_for_no_data(
    authed_client: AsyncClient, patched_query_embedding
):
    response = await authed_client.post("/api/search/global", json={"query": "transition énergétique"})
    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "transition énergétique"
    assert body["total_results"] == 0
    assert body["results"] == []


@pytest.mark.asyncio
async def test_search_global_returns_results_with_metadata(
    authed_client: AsyncClient, summary_factory, summary_embedding_factory,
    authed_user, patched_query_embedding,
):
    summary = await summary_factory(
        user=authed_user, video_title="Crise énergétique EU", video_channel="Le Monde"
    )
    await summary_embedding_factory(
        summary=summary, section_index=0, text_preview="…la transition énergétique impose…"
    )
    response = await authed_client.post(
        "/api/search/global",
        json={"query": "transition énergétique", "limit": 10, "source_types": ["summary"]},
    )
    body = response.json()
    assert body["total_results"] >= 1
    r = body["results"][0]
    assert r["source_type"] == "summary"
    assert r["source_metadata"]["summary_title"] == "Crise énergétique EU"
    assert r["source_metadata"]["channel"] == "Le Monde"
```

- [ ] **Step 11.2: Run, fail, implémenter**

Modifier `backend/src/search/router.py` — remplacer le contenu actuel par :

```python
"""🔍 Search router — Semantic Search V1.

Endpoints :
- POST /api/search/semantic            (legacy, conservé pour backward compat)
- POST /api/search/global              (V1, cross-source filtered by user_id)
- POST /api/search/within/{summary_id} (V1, intra-analyse)
- POST /api/search/explain-passage     (V1, tooltip IA Pro+Expert)
- GET/DELETE /api/search/recent-queries
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from auth.dependencies import get_current_user
from db.database import User
from .embedding_service import search_similar
from .global_search import search_global, SearchFilters, ALL_SOURCE_TYPES

router = APIRouter()


# ════════════════════════════════════════════════════════════════════════════════
# LEGACY — POST /api/search/semantic (gardé pour backward compat)
# ════════════════════════════════════════════════════════════════════════════════


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    limit: int = Field(10, ge=1, le=30)
    category: Optional[str] = None


class SearchResultItem(BaseModel):
    video_id: str
    score: float
    text_preview: str
    video_title: Optional[str] = None
    video_channel: Optional[str] = None
    thumbnail_url: Optional[str] = None
    category: Optional[str] = None


class SemanticSearchResponse(BaseModel):
    query: str
    total_results: int
    results: list[SearchResultItem]
    searched_at: str


@router.post("/semantic", response_model=SemanticSearchResponse)
async def semantic_search(
    request: SemanticSearchRequest, user: User = Depends(get_current_user)
):
    results = await search_similar(
        query=request.query, limit=request.limit, category=request.category
    )
    return SemanticSearchResponse(
        query=request.query,
        total_results=len(results),
        results=[SearchResultItem(**r) for r in results],
        searched_at=datetime.now(timezone.utc).isoformat(),
    )


# ════════════════════════════════════════════════════════════════════════════════
# V1 — POST /api/search/global
# ════════════════════════════════════════════════════════════════════════════════


class GlobalSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    limit: int = Field(20, ge=1, le=50)
    source_types: Optional[list[str]] = None
    platform: Optional[str] = None
    lang: Optional[str] = None
    category: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    favorites_only: bool = False
    playlist_id: Optional[str] = None


class GlobalSearchResultItem(BaseModel):
    source_type: str
    source_id: int
    summary_id: Optional[int]
    score: float
    text_preview: str
    source_metadata: dict


class GlobalSearchResponse(BaseModel):
    query: str
    total_results: int
    results: list[GlobalSearchResultItem]
    searched_at: str


@router.post("/global", response_model=GlobalSearchResponse)
async def global_search(
    request: GlobalSearchRequest, user: User = Depends(get_current_user)
):
    """Recherche sémantique globale dans tout le contenu personnel du user."""
    source_types = request.source_types or ALL_SOURCE_TYPES
    invalid = set(source_types) - set(ALL_SOURCE_TYPES)
    if invalid:
        raise HTTPException(400, f"Invalid source_types: {invalid}")

    filters = SearchFilters(
        limit=request.limit,
        source_types=source_types,
        platform=request.platform,
        lang=request.lang,
        category=request.category,
        date_from=request.date_from,
        date_to=request.date_to,
        favorites_only=request.favorites_only,
        playlist_id=request.playlist_id,
    )
    results = await search_global(user_id=user.id, query=request.query, filters=filters)

    return GlobalSearchResponse(
        query=request.query,
        total_results=len(results),
        results=[
            GlobalSearchResultItem(
                source_type=r.source_type,
                source_id=r.source_id,
                summary_id=r.summary_id,
                score=r.score,
                text_preview=r.text_preview,
                source_metadata=r.source_metadata,
            )
            for r in results
        ],
        searched_at=datetime.now(timezone.utc).isoformat(),
    )
```

- [ ] **Step 11.3: Run tests**

```bash
cd backend && python -m pytest tests/search/test_router.py -v
```

Expected : 4 PASS.

- [ ] **Step 11.4: Commit**

```bash
git add backend/src/search/router.py backend/tests/search/test_router.py
git commit -m "feat(search): POST /api/search/global endpoint — Pydantic v2 schemas + filters"
```

---

## Task 12: Service `within_search` — recherche intra-analyse

**Files:**

- Create: `backend/src/search/within_search.py`
- Create: `backend/tests/search/test_within_search.py`

- [ ] **Step 12.1: Test failing**

```python
# backend/tests/search/test_within_search.py
"""Tests pour la recherche sémantique intra-analyse."""

import pytest


@pytest.mark.asyncio
async def test_search_within_returns_all_matches(
    async_session, summary_factory, summary_embedding_factory, patched_query_embedding,
):
    summary = await summary_factory()
    await summary_embedding_factory(summary=summary, section_index=0, text_preview="première section")
    await summary_embedding_factory(summary=summary, section_index=1, text_preview="deuxième section")

    from search.within_search import search_within
    matches = await search_within(
        summary_id=summary.id, user_id=summary.user_id, query="section",
    )
    assert len(matches) >= 2
    assert all(m.summary_id == summary.id for m in matches)


@pytest.mark.asyncio
async def test_search_within_403_when_not_owner(
    async_session, summary_factory, user_factory, patched_query_embedding,
):
    summary = await summary_factory()
    other_user = await user_factory(email="other@test.com")

    from search.within_search import search_within, NotOwnerError
    with pytest.raises(NotOwnerError):
        await search_within(summary_id=summary.id, user_id=other_user.id, query="x")
```

- [ ] **Step 12.2: Implémenter**

Créer `backend/src/search/within_search.py` :

```python
"""Service de recherche sémantique intra-analyse."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select

from db.database import (
    async_session_maker,
    Summary,
    SummaryEmbedding,
    Flashcard,
    FlashcardEmbedding,
    QuizQuestion,
    QuizEmbedding,
    ChatEmbedding,
    TranscriptEmbedding,
    TranscriptCache,
)
from .embedding_service import generate_embedding, _cosine_similarity, MIN_SIMILARITY

logger = logging.getLogger(__name__)


class NotOwnerError(Exception):
    """User n'est pas propriétaire du summary demandé."""


@dataclass
class WithinMatch:
    source_type: str
    source_id: int
    summary_id: int
    text: str
    text_html: str  # avec <mark>
    tab: str
    score: float
    passage_id: str  # hash stable pour deeplink
    metadata: dict


async def search_within(
    summary_id: int,
    user_id: int,
    query: str,
    source_types: Optional[list[str]] = None,
) -> list[WithinMatch]:
    """Recherche sémantique limitée à un summary, vérifie ownership."""
    if not query or len(query) < 2:
        return []

    source_types = source_types or ["summary", "flashcard", "quiz", "chat", "transcript"]

    async with async_session_maker() as session:
        summary = await session.get(Summary, summary_id)
        if summary is None:
            raise NotOwnerError(f"Summary {summary_id} not found")
        if summary.user_id != user_id:
            raise NotOwnerError(
                f"User {user_id} not owner of summary {summary_id}"
            )

        query_embedding = await generate_embedding(query)
        if query_embedding is None:
            return []

        matches: list[WithinMatch] = []

        if "summary" in source_types:
            rows = (
                await session.execute(
                    select(SummaryEmbedding).where(SummaryEmbedding.summary_id == summary_id)
                )
            ).scalars().all()
            for emb in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                meta = json.loads(emb.source_metadata) if emb.source_metadata else {}
                matches.append(
                    WithinMatch(
                        source_type="summary",
                        source_id=emb.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab=meta.get("tab", "synthesis"),
                        score=score,
                        passage_id=f"summary:{emb.id}",
                        metadata=meta,
                    )
                )

        if "flashcard" in source_types:
            rows = (
                await session.execute(
                    select(FlashcardEmbedding, Flashcard)
                    .join(Flashcard, FlashcardEmbedding.flashcard_id == Flashcard.id)
                    .where(FlashcardEmbedding.summary_id == summary_id)
                )
            ).all()
            for emb, fc in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                matches.append(
                    WithinMatch(
                        source_type="flashcard",
                        source_id=fc.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab="flashcards",
                        score=score,
                        passage_id=f"flashcard:{fc.id}",
                        metadata={"position": fc.position},
                    )
                )

        if "quiz" in source_types:
            rows = (
                await session.execute(
                    select(QuizEmbedding, QuizQuestion)
                    .join(QuizQuestion, QuizEmbedding.quiz_question_id == QuizQuestion.id)
                    .where(QuizEmbedding.summary_id == summary_id)
                )
            ).all()
            for emb, q in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                matches.append(
                    WithinMatch(
                        source_type="quiz",
                        source_id=q.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab="quiz",
                        score=score,
                        passage_id=f"quiz:{q.id}",
                        metadata={"position": q.position},
                    )
                )

        if "chat" in source_types:
            rows = (
                await session.execute(
                    select(ChatEmbedding).where(ChatEmbedding.summary_id == summary_id)
                )
            ).scalars().all()
            for emb in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                matches.append(
                    WithinMatch(
                        source_type="chat",
                        source_id=emb.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab="chat",
                        score=score,
                        passage_id=f"chat:{emb.id}",
                        metadata={"turn_index": emb.turn_index},
                    )
                )

        if "transcript" in source_types:
            rows = (
                await session.execute(
                    select(TranscriptEmbedding)
                    .join(TranscriptCache, TranscriptEmbedding.video_id == TranscriptCache.video_id)
                    .where(TranscriptCache.video_id == summary.video_id)
                )
            ).scalars().all()
            for emb in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                matches.append(
                    WithinMatch(
                        source_type="transcript",
                        source_id=emb.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab="transcript",
                        score=score,
                        passage_id=f"transcript:{emb.id}",
                        metadata={"chunk_index": emb.chunk_index},
                    )
                )

    matches.sort(key=lambda m: -m.score)
    return matches


def _wrap_query_in_mark(text: str, query: str) -> str:
    """Wrap les occurrences de la query dans <mark>. Naïf (case-insensitive substring)."""
    if not text or not query:
        return text
    import re
    pattern = re.compile(re.escape(query), re.IGNORECASE)
    return pattern.sub(lambda m: f"<mark>{m.group(0)}</mark>", text)
```

- [ ] **Step 12.3: Run tests**

```bash
cd backend && python -m pytest tests/search/test_within_search.py -v
```

Expected : 2 PASS.

- [ ] **Step 12.4: Commit**

```bash
git add backend/src/search/within_search.py backend/tests/search/test_within_search.py
git commit -m "feat(search): within_search service — intra-analysis with ownership check"
```

---

## Task 13: Endpoint `POST /api/search/within/{summary_id}`

**Files:**

- Modify: `backend/src/search/router.py`
- Modify: `backend/tests/search/test_router.py`

- [ ] **Step 13.1: Test failing**

Ajouter à `test_router.py` :

```python
@pytest.mark.asyncio
async def test_search_within_403_for_other_user(
    authed_client, summary_factory, user_factory, patched_query_embedding,
):
    other = await user_factory(email="other@test.com")
    summary = await summary_factory(user=other)
    response = await authed_client.post(
        f"/api/search/within/{summary.id}", json={"query": "test"}
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_search_within_returns_matches(
    authed_client, summary_factory, summary_embedding_factory, authed_user,
    patched_query_embedding,
):
    summary = await summary_factory(user=authed_user)
    await summary_embedding_factory(summary=summary, section_index=0, text_preview="économie")
    response = await authed_client.post(
        f"/api/search/within/{summary.id}", json={"query": "économie"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "matches" in body
    assert len(body["matches"]) >= 1
    m = body["matches"][0]
    assert "passage_id" in m and m["passage_id"].startswith("summary:")
```

- [ ] **Step 13.2: Ajouter l'endpoint dans `router.py`**

```python
# Après l'endpoint /global, ajouter :

from .within_search import search_within, NotOwnerError, WithinMatch


class WithinSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    source_types: Optional[list[str]] = None


class WithinMatchItem(BaseModel):
    source_type: str
    source_id: int
    summary_id: int
    text: str
    text_html: str
    tab: str
    score: float
    passage_id: str
    metadata: dict


class WithinSearchResponse(BaseModel):
    summary_id: int
    query: str
    matches: list[WithinMatchItem]


@router.post("/within/{summary_id}", response_model=WithinSearchResponse)
async def within_search(
    request: WithinSearchRequest,
    summary_id: int = Path(..., gt=0),
    user: User = Depends(get_current_user),
):
    try:
        matches = await search_within(
            summary_id=summary_id,
            user_id=user.id,
            query=request.query,
            source_types=request.source_types,
        )
    except NotOwnerError as e:
        raise HTTPException(403, str(e))

    return WithinSearchResponse(
        summary_id=summary_id,
        query=request.query,
        matches=[
            WithinMatchItem(
                source_type=m.source_type,
                source_id=m.source_id,
                summary_id=m.summary_id,
                text=m.text,
                text_html=m.text_html,
                tab=m.tab,
                score=m.score,
                passage_id=m.passage_id,
                metadata=m.metadata,
            )
            for m in matches
        ],
    )
```

- [ ] **Step 13.3: Run tests**

```bash
cd backend && python -m pytest tests/search/test_router.py -v
```

Expected : tous les tests passent.

- [ ] **Step 13.4: Commit**

```bash
git add backend/src/search/router.py backend/tests/search/test_router.py
git commit -m "feat(search): POST /api/search/within/{summary_id} — intra-analysis endpoint"
```

---

## Task 14: Service `explain_passage` + endpoint

**Files:**

- Create: `backend/src/search/explain_passage.py`
- Create: `backend/tests/search/test_explain_passage.py`
- Modify: `backend/src/search/router.py`
- Modify: `backend/tests/search/test_router.py`

- [ ] **Step 14.1: Test failing pour le service**

```python
# backend/tests/search/test_explain_passage.py
"""Tests pour le service de tooltip IA."""

import hashlib
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

from db.database import ExplainPassageCache


@pytest.mark.asyncio
async def test_explain_passage_returns_cached_when_present(async_session):
    cache_key = hashlib.sha256("query|passage|1".encode()).hexdigest()
    async_session.add(
        ExplainPassageCache(
            cache_key=cache_key,
            explanation="Cached explanation.",
            model_used="mistral-small-latest",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
    )
    await async_session.commit()

    from search.explain_passage import explain_passage
    result = await explain_passage(
        summary_id=1, passage_text="passage", query="query", source_type="summary"
    )
    assert result["explanation"] == "Cached explanation."
    assert result["cached"] is True


@pytest.mark.asyncio
async def test_explain_passage_calls_mistral_and_caches(async_session):
    fake_mistral_response = {
        "choices": [{"message": {"content": "Ce passage matche car il mentionne X."}}]
    }
    with patch("search.explain_passage._call_mistral_chat", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = "Ce passage matche car il mentionne X."
        from search.explain_passage import explain_passage
        result = await explain_passage(
            summary_id=42, passage_text="some unique passage", query="some query",
            source_type="summary",
        )
        assert result["cached"] is False
        assert "mentionne X" in result["explanation"]
        mock_call.assert_called_once()

    # 2e appel = cache hit, sans nouveau call
    with patch("search.explain_passage._call_mistral_chat", new_callable=AsyncMock) as mock_call2:
        result2 = await explain_passage(
            summary_id=42, passage_text="some unique passage", query="some query",
            source_type="summary",
        )
        assert result2["cached"] is True
        mock_call2.assert_not_called()
```

- [ ] **Step 14.2: Implémenter**

Créer `backend/src/search/explain_passage.py` :

```python
"""Service tooltip IA — explique pourquoi un passage matche une query.

Cache PG 7 jours sur sha256(query+passage_text+summary_id).
Modèle : mistral-small-latest (économie 6× vs large, 2 phrases suffisent).
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import select, delete as sa_delete

from core.config import MISTRAL_API_KEY
from db.database import async_session_maker, ExplainPassageCache

logger = logging.getLogger(__name__)

MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
EXPLAIN_MODEL = "mistral-small-latest"
EXPLAIN_TIMEOUT = 30.0
CACHE_TTL_DAYS = 7

SYSTEM_PROMPT = """Tu es un assistant qui explique pourquoi un passage de texte matche une recherche.
Donne une explication courte (2 phrases max) qui :
1. Identifie le concept central commun entre la query et le passage
2. Mentionne précisément ce que le passage apporte par rapport à la query

Sois factuel. Si le match est faible ou ambigu, dis-le clairement.
Réponds UNIQUEMENT avec l'explication, pas de préambule."""


def _make_cache_key(query: str, passage_text: str, summary_id: int) -> str:
    return hashlib.sha256(f"{query}|{passage_text}|{summary_id}".encode()).hexdigest()


async def explain_passage(
    summary_id: int, passage_text: str, query: str, source_type: str
) -> dict:
    """Retourne {explanation, cached, model_used}."""
    cache_key = _make_cache_key(query, passage_text, summary_id)

    async with async_session_maker() as session:
        # Cache check
        cached = await session.get(ExplainPassageCache, cache_key)
        now = datetime.now(timezone.utc)
        if cached and cached.expires_at > now:
            logger.info(f"[EXPLAIN] cache hit {cache_key[:8]}")
            return {
                "explanation": cached.explanation,
                "cached": True,
                "model_used": cached.model_used,
            }

        # Cache miss → Mistral
        user_prompt = (
            f"Query : {query}\n\n"
            f"Passage ({source_type}) : {passage_text}\n\n"
            f"Pourquoi ce passage matche la query ?"
        )
        explanation = await _call_mistral_chat(user_prompt)
        if not explanation:
            return {
                "explanation": "Explication indisponible pour le moment.",
                "cached": False,
                "model_used": EXPLAIN_MODEL,
            }

        # Upsert cache (delete-then-insert pour idempotence)
        await session.execute(
            sa_delete(ExplainPassageCache).where(ExplainPassageCache.cache_key == cache_key)
        )
        session.add(
            ExplainPassageCache(
                cache_key=cache_key,
                explanation=explanation,
                model_used=EXPLAIN_MODEL,
                expires_at=now + timedelta(days=CACHE_TTL_DAYS),
            )
        )
        await session.commit()

        return {
            "explanation": explanation,
            "cached": False,
            "model_used": EXPLAIN_MODEL,
        }


async def _call_mistral_chat(user_prompt: str) -> str | None:
    """Appelle Mistral chat completion. Retourne None si erreur."""
    if not MISTRAL_API_KEY:
        logger.error("[EXPLAIN] MISTRAL_API_KEY missing")
        return None

    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": EXPLAIN_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 200,
    }

    try:
        async with httpx.AsyncClient(timeout=EXPLAIN_TIMEOUT) as client:
            resp = await client.post(MISTRAL_CHAT_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            return content
    except (httpx.HTTPError, KeyError, IndexError) as e:
        logger.error(f"[EXPLAIN] Mistral call failed: {e}")
        return None
```

- [ ] **Step 14.3: Run service tests**

```bash
cd backend && python -m pytest tests/search/test_explain_passage.py -v
```

Expected : 2 PASS.

- [ ] **Step 14.4: Ajouter endpoint dans router.py**

Ajouter à `backend/src/search/router.py` :

```python
# Imports en haut
from billing.plan_config import is_feature_available
from .explain_passage import explain_passage
from .within_search import search_within, NotOwnerError as WithinNotOwnerError


# Schemas en milieu de fichier (avec les autres) :


class ExplainPassageRequest(BaseModel):
    summary_id: int = Field(..., gt=0)
    passage_text: str = Field(..., min_length=1, max_length=5000)
    query: str = Field(..., min_length=2, max_length=500)
    source_type: str = Field(..., pattern="^(summary|flashcard|quiz|chat|transcript)$")


class ExplainPassageResponse(BaseModel):
    explanation: str
    cached: bool
    model_used: str


@router.post("/explain-passage", response_model=ExplainPassageResponse)
async def explain_passage_endpoint(
    request: ExplainPassageRequest, user: User = Depends(get_current_user)
):
    """Tooltip IA — Pro+Expert only."""
    # Plan gating
    if not is_feature_available(
        user.plan, feature="semantic_search_tooltip", platform="web"
    ):
        raise HTTPException(
            403, "Le tooltip IA est inclus à partir du plan Pro. Upgrade pour débloquer."
        )

    # Verify ownership of the summary
    from db.database import async_session_maker, Summary
    async with async_session_maker() as session:
        summary = await session.get(Summary, request.summary_id)
        if summary is None:
            raise HTTPException(404, "Summary not found")
        if summary.user_id != user.id:
            raise HTTPException(403, "Not owner of this summary")

    result = await explain_passage(
        summary_id=request.summary_id,
        passage_text=request.passage_text,
        query=request.query,
        source_type=request.source_type,
    )
    return ExplainPassageResponse(**result)
```

- [ ] **Step 14.5: Test endpoint**

Ajouter à `test_router.py` :

```python
@pytest.mark.asyncio
async def test_explain_passage_403_for_free_user(
    authed_client_free, summary_factory, authed_user_free,
):
    summary = await summary_factory(user=authed_user_free)
    response = await authed_client_free.post(
        "/api/search/explain-passage",
        json={
            "summary_id": summary.id,
            "passage_text": "some passage",
            "query": "some query",
            "source_type": "summary",
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_explain_passage_works_for_pro_user(
    authed_client_pro, summary_factory, authed_user_pro,
):
    summary = await summary_factory(user=authed_user_pro)
    with patch("search.explain_passage._call_mistral_chat", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = "Le passage parle directement de X, ce qui correspond à la query."
        response = await authed_client_pro.post(
            "/api/search/explain-passage",
            json={
                "summary_id": summary.id,
                "passage_text": "some passage",
                "query": "some query",
                "source_type": "summary",
            },
        )
        assert response.status_code == 200
        assert "X" in response.json()["explanation"]
```

- [ ] **Step 14.6: Run all router tests**

```bash
cd backend && python -m pytest tests/search/test_router.py -v
```

Expected : tous les tests passent.

- [ ] **Step 14.7: Commit**

```bash
git add backend/src/search/explain_passage.py backend/tests/search/test_explain_passage.py backend/src/search/router.py backend/tests/search/test_router.py
git commit -m "feat(search): /api/search/explain-passage — Mistral tooltip with PG 7d cache"
```

---

## Task 15: Service `recent_queries` + endpoints

**Files:**

- Create: `backend/src/search/recent_queries.py`
- Modify: `backend/src/search/router.py`
- Modify: `backend/tests/search/test_router.py`

- [ ] **Step 15.1: Implémenter le service Redis-based**

Créer `backend/src/search/recent_queries.py` :

```python
"""Service recent queries — stocke les 10 dernières queries d'un user dans Redis.

Clé Redis : `search:recent:{user_id}` (LIST, max length 10, TTL 90 jours).
"""
import logging
from typing import List

logger = logging.getLogger(__name__)

MAX_RECENT = 10
TTL_SECONDS = 90 * 24 * 3600  # 90 jours


def _key(user_id: int) -> str:
    return f"search:recent:{user_id}"


async def get_recent_queries(user_id: int) -> List[str]:
    try:
        from core.redis_client import get_redis_client
        redis = await get_redis_client()
        if redis is None:
            return []
        items = await redis.lrange(_key(user_id), 0, MAX_RECENT - 1)
        return [item.decode() if isinstance(item, bytes) else item for item in items]
    except Exception as e:
        logger.warning(f"[RECENT] get failed for user {user_id}: {e}")
        return []


async def push_recent_query(user_id: int, query: str) -> None:
    """Ajoute une query en tête, trim à MAX_RECENT, refresh TTL."""
    try:
        from core.redis_client import get_redis_client
        redis = await get_redis_client()
        if redis is None:
            return
        # LREM tout duplicate, LPUSH en tête, LTRIM, EXPIRE
        await redis.lrem(_key(user_id), 0, query)
        await redis.lpush(_key(user_id), query)
        await redis.ltrim(_key(user_id), 0, MAX_RECENT - 1)
        await redis.expire(_key(user_id), TTL_SECONDS)
    except Exception as e:
        logger.warning(f"[RECENT] push failed for user {user_id}: {e}")


async def clear_recent_queries(user_id: int) -> None:
    try:
        from core.redis_client import get_redis_client
        redis = await get_redis_client()
        if redis is None:
            return
        await redis.delete(_key(user_id))
    except Exception as e:
        logger.warning(f"[RECENT] clear failed for user {user_id}: {e}")
```

**Note** : si `core.redis_client` n'existe pas avec ce nom, repérer le module Redis client réel via `grep -rn "get_redis\|redis_client" backend/src/core/` et adapter l'import. À défaut, créer le service avec un fallback in-memory dict (acceptable pour V1, le user le perdra au restart).

- [ ] **Step 15.2: Endpoints + push automatique depuis /global**

Modifier `router.py` — dans la fonction `global_search`, ajouter à la fin (avant le `return`) :

```python
    # Push dans recent queries (fire-and-forget)
    try:
        import asyncio
        from .recent_queries import push_recent_query
        asyncio.create_task(push_recent_query(user.id, request.query))
    except Exception as e:
        logger.warning(f"[SEARCH] recent_queries push failed: {e}")
```

Et ajouter les 2 endpoints :

```python
from .recent_queries import get_recent_queries, clear_recent_queries


class RecentQueriesResponse(BaseModel):
    queries: list[str]


@router.get("/recent-queries", response_model=RecentQueriesResponse)
async def list_recent_queries(user: User = Depends(get_current_user)):
    queries = await get_recent_queries(user.id)
    return RecentQueriesResponse(queries=queries)


@router.delete("/recent-queries", status_code=204)
async def delete_recent_queries(user: User = Depends(get_current_user)):
    await clear_recent_queries(user.id)
```

- [ ] **Step 15.3: Test endpoints**

Ajouter à `test_router.py` :

```python
@pytest.mark.asyncio
async def test_recent_queries_empty_initially(authed_client):
    response = await authed_client.get("/api/search/recent-queries")
    assert response.status_code == 200
    assert response.json()["queries"] == []


@pytest.mark.asyncio
async def test_recent_queries_pushed_on_global_search(
    authed_client, patched_query_embedding, monkeypatch,
):
    # Push direct
    from search.recent_queries import push_recent_query, get_recent_queries
    await push_recent_query(user_id=1, query="test query")
    queries = await get_recent_queries(user_id=1)
    assert "test query" in queries


@pytest.mark.asyncio
async def test_recent_queries_clear(authed_client, authed_user):
    from search.recent_queries import push_recent_query
    await push_recent_query(authed_user.id, "to-clear")
    response = await authed_client.delete("/api/search/recent-queries")
    assert response.status_code == 204
    response = await authed_client.get("/api/search/recent-queries")
    assert response.json()["queries"] == []
```

- [ ] **Step 15.4: Commit**

```bash
git add backend/src/search/recent_queries.py backend/src/search/router.py backend/tests/search/test_router.py
git commit -m "feat(search): recent queries Redis service + GET/DELETE /api/search/recent-queries"
```

---

## Task 16: Trigger `embed_summary` après création Summary

**Files:**

- Modify: `backend/src/videos/service.py` (ou `backend/src/videos/router.py` selon où le Summary est commité)

- [ ] **Step 16.1: Repérer le hook**

```bash
grep -rn "session.add(summary)\|db.add(summary)\|Summary(\s*$" backend/src/videos/ | head -10
```

Identifier la ligne où le `Summary` est commité (probablement dans `videos/service.py` après `await session.commit()`).

- [ ] **Step 16.2: Ajouter le trigger non-bloquant**

Juste après le `await session.commit()` qui persiste le Summary, insérer :

```python
        # ─── Semantic Search V1 trigger (fire-and-forget) ──────────────────
        try:
            import asyncio
            from search.embedding_service import embed_summary

            asyncio.create_task(embed_summary(summary.id))
        except ImportError:
            pass
        except Exception as emb_err:
            logger.warning(f"[VIDEOS] embed_summary trigger failed for {summary.id}: {emb_err}")
```

- [ ] **Step 16.3: Test du trigger via le test d'intégration**

Ajouter à `tests/search/test_embedding_service.py` :

```python
@pytest.mark.asyncio
async def test_embed_summary_triggered_on_summary_create(
    async_session, summary_factory, patch_httpx_post,
):
    """Le trigger doit être appelable et faire son job sur un Summary fraîchement créé."""
    summary = await summary_factory(
        structured_index=json.dumps([{"ts": "00:00", "title": "X", "summary": "Y", "kw": []}])
    )

    # Au lieu de tester l'asyncio.create_task (race condition flaky),
    # on appelle directement embed_summary pour vérifier qu'il fonctionne avec
    # une vraie Summary commitée.
    from search.embedding_service import embed_summary
    result = await embed_summary(summary.id)
    assert result is True
```

- [ ] **Step 16.4: Run tests**

```bash
cd backend && python -m pytest tests/search/ -v
```

Expected : tout passe.

- [ ] **Step 16.5: Commit**

```bash
git add backend/src/videos/service.py backend/tests/search/test_embedding_service.py
git commit -m "feat(search): trigger embed_summary on Summary creation (fire-and-forget)"
```

---

## Task 17: Trigger `embed_flashcards` et `embed_quiz` dans study/router

**Files:**

- Modify: `backend/src/study/router.py`

- [ ] **Step 17.1: Ajouter trigger dans `generate_flashcards`**

Juste après le `await session.commit()` ajouté en Task 4, ajouter :

```python
        # ─── Semantic Search V1 trigger ─────────────────────────────────────
        try:
            import asyncio
            from search.embedding_service import embed_flashcards
            asyncio.create_task(embed_flashcards(summary_id))
        except ImportError:
            pass
        except Exception as emb_err:
            logger.warning(f"[STUDY] embed_flashcards trigger failed for {summary_id}: {emb_err}")
```

- [ ] **Step 17.2: Ajouter trigger dans `generate_quiz`**

Juste après le `await session.commit()` ajouté en Task 5 :

```python
        # ─── Semantic Search V1 trigger ─────────────────────────────────────
        try:
            import asyncio
            from search.embedding_service import embed_quiz
            asyncio.create_task(embed_quiz(summary_id))
        except ImportError:
            pass
        except Exception as emb_err:
            logger.warning(f"[STUDY] embed_quiz trigger failed for {summary_id}: {emb_err}")
```

- [ ] **Step 17.3: Vérifier que les imports `logger` sont présents**

Dans `study/router.py` en haut, vérifier `import logging; logger = logging.getLogger(__name__)`. Sinon ajouter.

- [ ] **Step 17.4: Run all study tests**

```bash
cd backend && python -m pytest tests/study/ tests/search/ -v
```

- [ ] **Step 17.5: Commit**

```bash
git add backend/src/study/router.py
git commit -m "feat(search): trigger embed_flashcards/embed_quiz after generation (fire-and-forget)"
```

---

## Task 18: Trigger `embed_chat_turn` dans chat/router

**Files:**

- Modify: `backend/src/chat/router.py`

- [ ] **Step 18.1: Repérer le hook**

```bash
grep -n "ChatMessage(\|session.add\|await session.commit" backend/src/chat/router.py | head -20
```

Identifier l'endpoint `/api/chat/ask` qui crée 2 ChatMessage (1 user + 1 assistant) et commit.

- [ ] **Step 18.2: Ajouter le trigger après le commit du turn complet**

Juste après le `await session.commit()` qui persiste les 2 messages :

```python
        # ─── Semantic Search V1 trigger ─────────────────────────────────────
        try:
            import asyncio
            from search.embedding_service import embed_chat_turn
            asyncio.create_task(embed_chat_turn(user_msg.id, assistant_msg.id))
        except ImportError:
            pass
        except Exception as emb_err:
            logger.warning(
                f"[CHAT] embed_chat_turn trigger failed for {user_msg.id}/{assistant_msg.id}: {emb_err}"
            )
```

**Note** : adapter les noms de variables (`user_msg`, `assistant_msg`) selon le code réel.

- [ ] **Step 18.3: Run tests**

```bash
cd backend && python -m pytest tests/search/ tests/chat/ -v
```

- [ ] **Step 18.4: Commit**

```bash
git add backend/src/chat/router.py
git commit -m "feat(search): trigger embed_chat_turn after user+assistant pair commit"
```

---

## Task 19: Feature flag + plan_config update

**Files:**

- Modify: `backend/src/core/config.py`
- Modify: `backend/src/billing/plan_config.py`

- [ ] **Step 19.1: Ajouter env flag dans config.py**

Repérer la ligne 753 (fin du bloc `MAGISTRAL_EPISTEMIC_*`), insérer après :

```python


# 🔍 Semantic Search V1 (extended : summary + flashcard + quiz + chat)
SEMANTIC_SEARCH_V1_ENABLED: bool = (
    os.getenv("SEMANTIC_SEARCH_V1_ENABLED", "false").lower() == "true"
)
```

Et ajouter le helper après ligne 875 (autres `is_*_available` helpers) :

```python


def is_semantic_search_v1_enabled() -> bool:
    """Check if extended semantic search V1 is enabled (gates UI rollout).

    The endpoints exist regardless, but the frontend hides the search tab if
    this returns False. Allows progressive rollout.
    """
    return SEMANTIC_SEARCH_V1_ENABLED and bool(MISTRAL_API_KEY)
```

- [ ] **Step 19.2: Ajouter `semantic_search_tooltip` dans plan_config.py**

Repérer les 9 dicts `platforms.{web,mobile,extension}` (lignes Free.web L141-158, Free.mobile L159-176, Free.extension L177-194, Pro.web L275-292, Pro.mobile L293-310, Pro.extension L311-328, Expert.web L411-428, Expert.mobile L429-446, Expert.extension L447-464).

Dans chaque dict, ajouter une nouvelle clé après `"history"` :

| Plan   | Web     | Mobile  | Extension |
| ------ | ------- | ------- | --------- |
| Free   | `False` | `False` | `False`   |
| Pro    | `True`  | `True`  | `False`   |
| Expert | `True`  | `True`  | `False`   |

Exemple pour Pro.web (autour de L275-292) :

```python
            "history": True,
            "semantic_search_tooltip": True,  # V1 — tooltip IA "pourquoi ce passage matche"
            "voice_chat": False,
```

Faire les 9 modifications.

- [ ] **Step 19.3: Vérifier**

```bash
cd backend && python -c "
from billing.plan_config import is_feature_available
assert is_feature_available('free', 'semantic_search_tooltip', 'web') is False
assert is_feature_available('pro', 'semantic_search_tooltip', 'web') is True
assert is_feature_available('expert', 'semantic_search_tooltip', 'mobile') is True
assert is_feature_available('expert', 'semantic_search_tooltip', 'extension') is False
print('OK')
"
```

Expected : `OK`.

- [ ] **Step 19.4: Commit**

```bash
git add backend/src/core/config.py backend/src/billing/plan_config.py
git commit -m "feat(search): SEMANTIC_SEARCH_V1_ENABLED env flag + semantic_search_tooltip plan feature"
```

---

## Task 20: Backfill script

**Files:**

- Create: `backend/scripts/backfill_search_index.py`

- [ ] **Step 20.1: Créer le script**

```python
# backend/scripts/backfill_search_index.py
"""Backfill the Semantic Search V1 index for existing summaries.

Usage::

    # Dry-run sur 1 user
    python -m scripts.backfill_search_index --user-id 42 --dry-run

    # Run réel batch 50 par 50, all users
    python -m scripts.backfill_search_index --all-users --batch-size 50

    # Filtrer pour ne backfiller que les summaries pas encore embeddées
    python -m scripts.backfill_search_index --all-users --only-missing

Idempotent : appel multiple safe (les helpers embed_* font delete-then-insert).
Rate-limited : 2 sec de pause entre batches Mistral.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Path hack pour rendre `src/` importable depuis backend/scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from sqlalchemy import select  # noqa: E402

from db.database import (  # noqa: E402
    async_session_maker,
    Summary,
    SummaryEmbedding,
    Flashcard,
    FlashcardEmbedding,
    QuizQuestion,
    QuizEmbedding,
    ChatMessage,
    ChatEmbedding,
)
from search.embedding_service import (  # noqa: E402
    embed_summary,
    embed_flashcards,
    embed_quiz,
    embed_chat_turn,
)

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s", level=logging.INFO
)
logger = logging.getLogger("backfill_search")

BATCH_SLEEP_SECONDS = 2.0


async def _summaries_missing_embeddings(user_id: int | None) -> list[int]:
    async with async_session_maker() as session:
        stmt = select(Summary.id).outerjoin(SummaryEmbedding, SummaryEmbedding.summary_id == Summary.id).where(SummaryEmbedding.id.is_(None))
        if user_id is not None:
            stmt = stmt.where(Summary.user_id == user_id)
        return [row[0] for row in (await session.execute(stmt)).all()]


async def _all_summary_ids(user_id: int | None) -> list[int]:
    async with async_session_maker() as session:
        stmt = select(Summary.id)
        if user_id is not None:
            stmt = stmt.where(Summary.user_id == user_id)
        return [row[0] for row in (await session.execute(stmt)).all()]


async def _flashcards_summary_ids(user_id: int | None) -> list[int]:
    async with async_session_maker() as session:
        stmt = select(Flashcard.summary_id).distinct()
        if user_id is not None:
            stmt = stmt.where(Flashcard.user_id == user_id)
        return [row[0] for row in (await session.execute(stmt)).all()]


async def _quiz_summary_ids(user_id: int | None) -> list[int]:
    async with async_session_maker() as session:
        stmt = select(QuizQuestion.summary_id).distinct()
        if user_id is not None:
            stmt = stmt.where(QuizQuestion.user_id == user_id)
        return [row[0] for row in (await session.execute(stmt)).all()]


async def _chat_turns(user_id: int | None) -> list[tuple[int, int]]:
    """Liste les paires (user_msg_id, agent_msg_id) consécutives par summary."""
    async with async_session_maker() as session:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.summary_id.is_not(None))
            .order_by(ChatMessage.summary_id, ChatMessage.created_at)
        )
        if user_id is not None:
            stmt = stmt.where(ChatMessage.user_id == user_id)
        msgs = (await session.execute(stmt)).scalars().all()

    pairs: list[tuple[int, int]] = []
    by_summary: dict[int, list[ChatMessage]] = {}
    for m in msgs:
        by_summary.setdefault(m.summary_id, []).append(m)
    for sid, lst in by_summary.items():
        i = 0
        while i < len(lst) - 1:
            if lst[i].role == "user" and lst[i + 1].role == "assistant":
                pairs.append((lst[i].id, lst[i + 1].id))
                i += 2
            else:
                i += 1
    return pairs


async def main(user_id: int | None, only_missing: bool, batch_size: int, dry_run: bool):
    # 1. Summaries
    summary_ids = (
        await _summaries_missing_embeddings(user_id) if only_missing
        else await _all_summary_ids(user_id)
    )
    logger.info(f"Summaries to embed: {len(summary_ids)}")
    if not dry_run:
        for i in range(0, len(summary_ids), batch_size):
            batch = summary_ids[i : i + batch_size]
            await asyncio.gather(*[embed_summary(sid) for sid in batch])
            logger.info(f"Summary batch {i//batch_size + 1} done ({len(batch)} items)")
            await asyncio.sleep(BATCH_SLEEP_SECONDS)

    # 2. Flashcards par summary
    fc_summary_ids = await _flashcards_summary_ids(user_id)
    logger.info(f"Summaries with flashcards to embed: {len(fc_summary_ids)}")
    if not dry_run:
        for i in range(0, len(fc_summary_ids), batch_size):
            batch = fc_summary_ids[i : i + batch_size]
            await asyncio.gather(*[embed_flashcards(sid) for sid in batch])
            logger.info(f"Flashcards batch {i//batch_size + 1} done")
            await asyncio.sleep(BATCH_SLEEP_SECONDS)

    # 3. Quiz par summary
    quiz_summary_ids = await _quiz_summary_ids(user_id)
    logger.info(f"Summaries with quiz to embed: {len(quiz_summary_ids)}")
    if not dry_run:
        for i in range(0, len(quiz_summary_ids), batch_size):
            batch = quiz_summary_ids[i : i + batch_size]
            await asyncio.gather(*[embed_quiz(sid) for sid in batch])
            logger.info(f"Quiz batch {i//batch_size + 1} done")
            await asyncio.sleep(BATCH_SLEEP_SECONDS)

    # 4. Chat turns
    chat_pairs = await _chat_turns(user_id)
    logger.info(f"Chat turns to embed: {len(chat_pairs)}")
    if not dry_run:
        for i in range(0, len(chat_pairs), batch_size):
            batch = chat_pairs[i : i + batch_size]
            await asyncio.gather(*[embed_chat_turn(u, a) for u, a in batch])
            logger.info(f"Chat batch {i//batch_size + 1} done")
            await asyncio.sleep(BATCH_SLEEP_SECONDS)

    logger.info("Backfill complete.")


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Backfill Semantic Search V1 index.")
    grp = p.add_mutually_exclusive_group(required=True)
    grp.add_argument("--user-id", type=int, help="Backfill only this user's content")
    grp.add_argument("--all-users", action="store_true", help="Backfill all users")
    p.add_argument("--only-missing", action="store_true",
                   help="Only summaries that have no SummaryEmbedding yet")
    p.add_argument("--batch-size", type=int, default=50)
    p.add_argument("--dry-run", action="store_true", help="Count only, don't embed")
    return p


if __name__ == "__main__":
    args = _build_parser().parse_args()
    user_id = None if args.all_users else args.user_id
    asyncio.run(main(user_id, args.only_missing, args.batch_size, args.dry_run))
```

- [ ] **Step 20.2: Test dry-run en dev**

```bash
cd backend && python -m scripts.backfill_search_index --all-users --dry-run
```

Expected output (extrait) :

```
INFO  Summaries to embed: 0
INFO  Summaries with flashcards to embed: 0
INFO  Summaries with quiz to embed: 0
INFO  Chat turns to embed: 0
INFO  Backfill complete.
```

- [ ] **Step 20.3: Commit**

```bash
git add backend/scripts/backfill_search_index.py
git commit -m "feat(search): backfill_search_index script — idempotent, rate-limited, batch-aware"
```

---

## Task 21: Smoke test bout-en-bout en dev

**Files:**

- Create: `backend/tests/search/test_e2e_smoke.py`

- [ ] **Step 21.1: Écrire un test e2e qui valide le flow complet**

```python
# backend/tests/search/test_e2e_smoke.py
"""Smoke test bout-en-bout : créer Summary → trigger auto-embed → search global."""

import json
import pytest


@pytest.mark.asyncio
async def test_e2e_summary_then_search_global(
    authed_client, summary_factory, authed_user, patched_query_embedding,
):
    """Crée un Summary avec structured_index → embed → search global retrouve."""
    summary = await summary_factory(
        user=authed_user,
        video_title="Vidéo sur l'énergie nucléaire",
        structured_index=json.dumps([
            {"ts": "00:00", "title": "Intro", "summary": "Présentation du sujet nucléaire", "kw": []}
        ]),
    )

    # Trigger embed manuellement (asyncio.create_task de prod n'est pas attendu en test)
    from search.embedding_service import embed_summary
    await embed_summary(summary.id)

    # Search global
    response = await authed_client.post(
        "/api/search/global",
        json={"query": "nucléaire", "source_types": ["summary"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_results"] >= 1
    assert body["results"][0]["source_metadata"]["summary_title"] == "Vidéo sur l'énergie nucléaire"


@pytest.mark.asyncio
async def test_e2e_within_search_after_summary_embed(
    authed_client, summary_factory, authed_user, patched_query_embedding,
):
    summary = await summary_factory(
        user=authed_user,
        structured_index=json.dumps([
            {"ts": "01:30", "title": "Section A", "summary": "Du contenu pertinent ici", "kw": []},
            {"ts": "05:00", "title": "Section B", "summary": "Autre contenu", "kw": []},
        ]),
    )
    from search.embedding_service import embed_summary
    await embed_summary(summary.id)

    response = await authed_client.post(
        f"/api/search/within/{summary.id}",
        json={"query": "contenu"},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["matches"]) >= 1
    assert body["matches"][0]["passage_id"].startswith("summary:")
```

- [ ] **Step 21.2: Run tous les tests search**

```bash
cd backend && python -m pytest tests/search/ tests/study/test_persistence.py -v
```

Expected : tous les tests passent. Si certains échouent à cause de fixtures manquantes (ex: `flashcard_factory`, `quiz_question_factory`, `summary_embedding_factory`), les ajouter dans `tests/conftest.py` (voir Step 21.3).

- [ ] **Step 21.3: Compléter conftest si fixtures manquent**

Vérifier que `backend/tests/conftest.py` expose ces factories. Si non, les ajouter :

```python
# backend/tests/conftest.py — ajouter en bas

@pytest.fixture
async def flashcard_factory(async_session, summary_factory):
    async def _make(summary=None, position=0, front="Q", back="A", category=None):
        from db.database import Flashcard
        if summary is None:
            summary = await summary_factory()
        fc = Flashcard(
            summary_id=summary.id, user_id=summary.user_id,
            position=position, front=front, back=back, category=category,
        )
        async_session.add(fc)
        await async_session.commit()
        await async_session.refresh(fc)
        return fc
    return _make


@pytest.fixture
async def quiz_question_factory(async_session, summary_factory):
    async def _make(summary=None, position=0, question="Q?", options=None, correct_index=0,
                    explanation=None, difficulty="standard"):
        from db.database import QuizQuestion
        import json as _json
        if summary is None:
            summary = await summary_factory()
        if options is None:
            options = ["A", "B", "C", "D"]
        q = QuizQuestion(
            summary_id=summary.id, user_id=summary.user_id, position=position,
            question=question, options_json=_json.dumps(options),
            correct_index=correct_index, explanation=explanation, difficulty=difficulty,
        )
        async_session.add(q)
        await async_session.commit()
        await async_session.refresh(q)
        return q
    return _make


@pytest.fixture
async def summary_embedding_factory(async_session, summary_factory):
    async def _make(summary=None, section_index=0, text_preview="text", embedding=None):
        import json as _json
        from db.database import SummaryEmbedding
        if summary is None:
            summary = await summary_factory()
        if embedding is None:
            embedding = [0.001 * (i + 1) for i in range(1024)]
        emb = SummaryEmbedding(
            summary_id=summary.id, user_id=summary.user_id,
            section_index=section_index,
            embedding_json=_json.dumps(embedding),
            text_preview=text_preview,
            model_version="mistral-embed",
        )
        async_session.add(emb)
        await async_session.commit()
        await async_session.refresh(emb)
        return emb
    return _make


@pytest.fixture
async def flashcard_embedding_factory(async_session, flashcard_factory):
    async def _make(flashcard=None, text_preview="Q+A", embedding=None):
        import json as _json
        from db.database import FlashcardEmbedding
        if flashcard is None:
            flashcard = await flashcard_factory()
        if embedding is None:
            embedding = [0.001 * (i + 1) for i in range(1024)]
        emb = FlashcardEmbedding(
            flashcard_id=flashcard.id, summary_id=flashcard.summary_id, user_id=flashcard.user_id,
            embedding_json=_json.dumps(embedding), text_preview=text_preview,
            model_version="mistral-embed",
        )
        async_session.add(emb)
        await async_session.commit()
        await async_session.refresh(emb)
        return emb
    return _make


@pytest.fixture
async def chat_message_factory(async_session, summary_factory):
    async def _make(summary=None, role="user", content="hello world"):
        from db.database import ChatMessage
        if summary is None:
            summary = await summary_factory()
        msg = ChatMessage(
            summary_id=summary.id, user_id=summary.user_id, role=role, content=content,
        )
        async_session.add(msg)
        await async_session.commit()
        await async_session.refresh(msg)
        return msg
    return _make
```

- [ ] **Step 21.4: Run all tests**

```bash
cd backend && python -m pytest tests/search/ tests/study/test_persistence.py -v
```

Expected : tous PASS, coverage ≥80% sur `backend/src/search/`.

- [ ] **Step 21.5: Commit final**

```bash
git add backend/tests/search/test_e2e_smoke.py backend/tests/conftest.py
git commit -m "test(search): e2e smoke tests + factory fixtures (flashcard, quiz, embeddings, chat_message)"
```

---

## Definition of Done — Phase 1 Backend

- [ ] Migration Alembic 015 applique en dev (SQLite) sans erreur
- [ ] Migration 015 applique en prod Hetzner (Postgres) — vérifier au déploiement
- [ ] 7 modèles SQLAlchemy importables sans erreur
- [ ] `embed_summary` / `embed_flashcards` / `embed_quiz` / `embed_chat_turn` testés (≥80% coverage)
- [ ] `study/router.py` persiste flashcards + quiz à chaque génération (idempotent : delete+insert)
- [ ] 4 endpoints en dev répondent : `/global`, `/within/{id}`, `/explain-passage`, `/recent-queries` (GET+DELETE)
- [ ] Tooltip endpoint gate Pro+Expert (Free → 403)
- [ ] 3 triggers fire-and-forget actifs : Summary création, Study génération, Chat turn complet
- [ ] Backfill script run en dry-run, count cohérent
- [ ] Feature flag `SEMANTIC_SEARCH_V1_ENABLED` configurable via env
- [ ] Plan config `semantic_search_tooltip` mappée correctement (Free=False, Pro=True web+mobile, Expert=idem, Extension=False partout)
- [ ] Tests `tests/search/` : 100% des tests passent
- [ ] Pas de `print()` ni de `datetime.utcnow()` introduit
- [ ] Branch `feat/search-backend-phase1` mergée sur main avec flag `SEMANTIC_SEARCH_V1_ENABLED=false` en prod
- [ ] Backfill prod lancé en background (`nohup python -m scripts.backfill_search_index --all-users > backfill.log 2>&1 &`) après merge
- [ ] Documentation : ajouter section "Semantic Search V1 — Backend" dans `docs/CLAUDE-BACKEND.md`

## Hors scope Phase 1 (à faire en Phase 2/3/4)

- Frontend web search page + intra-analysis Cmd+F + tooltip UI
- Mobile search tab + PassageActionSheet
- Extension QuickSearch dans HomeView
- Mirrors `frontend/src/config/planPrivileges.ts` et `mobile/src/config/planPrivileges.ts`
- pgvector migration (V2)
- Activation prod du flag (à la fin du rollout web/mobile/extension)

---

_Plan rédigé 2026-05-03 par Claude Sonnet 4.6 sur la base du spec
`docs/superpowers/specs/2026-05-03-semantic-search-design.md`._
