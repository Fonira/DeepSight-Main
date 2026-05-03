"""Tests de matérialisation flashcards/quiz pour l'indexation sémantique V1.

Ces tests vérifient que les endpoints `generate_flashcards` et `generate_quiz`
de `study/router.py` persistent les données générées dans les tables
`flashcards` et `quiz_questions` (pattern delete-then-insert).

Pattern : SQLite in-memory async (cf. `tests/chat/conftest.py`).
Les fixtures `async_session`, `summary_factory` et `mock_generate_study_card`
sont définies localement dans ce fichier car non disponibles dans
`tests/conftest.py` au moment de Phase 1.
"""

from __future__ import annotations

import json
from typing import Any, Dict
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Importer db.database enregistre tous les modèles sur Base.metadata
from db.database import (  # noqa: F401
    Base,
    Flashcard,
    QuizQuestion,
    Summary,
    User,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ FIXTURES — DB async SQLite + factories
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def async_session():
    """AsyncSession isolée sur SQLite in-memory (schéma fresh par test)."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionMaker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionMaker() as session:
        try:
            yield session
        finally:
            await session.close()
    await engine.dispose()


@pytest_asyncio.fixture
async def summary_factory(async_session: AsyncSession):
    """Crée un User + Summary persistés et retourne le Summary (avec `summary.user`)."""
    counter = {"n": 0}

    async def _factory() -> Summary:
        counter["n"] += 1
        n = counter["n"]
        user = User(
            username=f"study_tester_{n}",
            email=f"study{n}@test.fr",
            password_hash="x",
            plan="pro",
            email_verified=True,
            credits=100,
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)

        summary = Summary(
            user_id=user.id,
            video_id=f"vid-study-{n}",
            video_title=f"Test Video Study {n}",
            video_channel="Channel Test",
            platform="youtube",
            lang="fr",
            summary_content="Résumé de test pour study.",
            transcript_context="Transcript de test.",
        )
        async_session.add(summary)
        await async_session.commit()
        await async_session.refresh(summary)
        # Attache le user pour que le test puisse faire `summary.user`
        summary.user = user
        return summary

    return _factory


@pytest.fixture
def mock_generate_study_card(monkeypatch):
    """Patche `study.router.generate_study_card` (réimporté localement) pour
    retourner un dict déterministe configuré par le test via `.return_value`."""
    mock = AsyncMock()
    mock.return_value = {}

    # generate_study_card est importé directement dans study/router.py via
    # `from videos.study_tools import generate_study_card`, donc le symbole
    # à patcher est `study.router.generate_study_card`.
    monkeypatch.setattr("study.router.generate_study_card", mock)
    return mock


@pytest.fixture(autouse=True)
def _bypass_credits_and_cache(monkeypatch):
    """Neutralise la déduction de crédits et le cache vidéo cross-user pendant ces tests.
    On veut tester la persistance, pas la machinerie billing/cache."""

    async def _noop_deduct_credit(*_args, **_kwargs):
        return True

    monkeypatch.setattr("study.router.deduct_credit", _noop_deduct_credit)

    # Désactiver le video cache : `from main import get_video_cache` à l'intérieur
    # des handlers. On le neutralise en faisant lever ImportError, ce qui passe
    # par le `except Exception: pass` côté handler.
    import sys as _sys

    fake_main = type(_sys)("main")

    def _no_cache():  # pragma: no cover - trivial stub
        return None

    fake_main.get_video_cache = _no_cache  # type: ignore[attr-defined]
    monkeypatch.setitem(_sys.modules, "main", fake_main)


# ═══════════════════════════════════════════════════════════════════════════════
# 📇 TASK 4 — FLASHCARDS PERSISTENCE
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_generate_flashcards_persists_in_db(
    async_session: AsyncSession, summary_factory, mock_generate_study_card
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
    assert rows[0].category == "concept"
    assert rows[1].front == "Q2"
    assert rows[1].position == 1


@pytest.mark.asyncio
async def test_generate_flashcards_replaces_existing(
    async_session: AsyncSession, summary_factory, mock_generate_study_card
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
    assert [r.position for r in rows] == [0, 1, 2]


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 TASK 5 — QUIZ PERSISTENCE
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_generate_quiz_persists_in_db(
    async_session: AsyncSession, summary_factory, mock_generate_study_card
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
    assert json.loads(rows[0].options_json) == ["A", "B", "C", "D"]
    assert rows[0].user_id == summary.user_id
    assert rows[0].position == 0
    # Position 1 — vérification ordre + JSON encoded options
    assert rows[1].question == "Q2?"
    assert rows[1].correct_index == 3
    assert json.loads(rows[1].options_json) == ["E", "F", "G", "H"]


@pytest.mark.asyncio
async def test_generate_quiz_replaces_existing(
    async_session: AsyncSession, summary_factory, mock_generate_study_card
):
    """Une 2e génération doit DELETE les anciennes et INSERT les nouvelles."""
    summary = await summary_factory()
    mock_generate_study_card.return_value = {
        "quiz": [{"question": "Q1?", "options": ["A", "B"], "correct_index": 0}]
    }
    from study.router import generate_quiz

    await generate_quiz(summary.id, summary.user, async_session)

    mock_generate_study_card.return_value = {
        "quiz": [
            {"question": "X1?", "options": ["P", "Q"], "correct_index": 1},
            {"question": "X2?", "options": ["R", "S"], "correct_index": 0},
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
    assert [r.position for r in rows] == [0, 1]
