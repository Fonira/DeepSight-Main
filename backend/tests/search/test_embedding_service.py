"""Tests pour les nouveaux helpers d'embedding (Summary, Flashcard, Quiz, Chat).

Tâches 6-9 du plan Semantic Search V1 Phase 1 backend.

Pattern : SQLite in-memory async + monkeypatch de `db.database.async_session_maker`
pour que les helpers d'`embedding_service.py` (qui ouvrent leur propre session)
écrivent dans la même DB que les tests. Inspiré de `tests/study/test_persistence.py`.
"""

from __future__ import annotations

import json
from typing import Optional
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Importer db.database enregistre tous les modèles sur Base.metadata
from db.database import (  # noqa: F401
    Base,
    ChatEmbedding,
    ChatMessage,
    Flashcard,
    FlashcardEmbedding,
    QuizEmbedding,
    QuizQuestion,
    Summary,
    SummaryEmbedding,
    User,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ FIXTURES — DB async SQLite in-memory + factories locales
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def async_session(monkeypatch):
    """AsyncSession isolée sur SQLite in-memory.

    Patche `db.database.async_session_maker` pour que les helpers
    `embed_summary`/`embed_flashcards`/etc. (qui ouvrent leur propre session via
    `async with async_session_maker()`) écrivent dans la MÊME DB que le test.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionMaker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Redirige les helpers vers notre engine in-memory
    monkeypatch.setattr("db.database.async_session_maker", SessionMaker)

    async with SessionMaker() as session:
        try:
            yield session
        finally:
            await session.close()
    await engine.dispose()


@pytest_asyncio.fixture
async def user_factory(async_session: AsyncSession):
    """Crée un User persisté unique."""
    counter = {"n": 0}

    async def _factory(email: Optional[str] = None) -> User:
        counter["n"] += 1
        n = counter["n"]
        user = User(
            username=f"search_tester_{n}",
            email=email or f"search{n}@test.fr",
            password_hash="x",
            plan="pro",
            email_verified=True,
            credits=100,
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)
        return user

    return _factory


@pytest_asyncio.fixture
async def summary_factory(async_session: AsyncSession, user_factory):
    """Crée un User + Summary persistés ; retourne le Summary."""
    counter = {"n": 0}

    async def _factory(
        user: Optional[User] = None,
        structured_index: Optional[str] = None,
        full_digest: Optional[str] = None,
        summary_content: str = "Résumé de test pour search.",
    ) -> Summary:
        counter["n"] += 1
        n = counter["n"]
        if user is None:
            user = await user_factory()
        summary = Summary(
            user_id=user.id,
            video_id=f"vid-search-{n}",
            video_title=f"Test Video Search {n}",
            video_channel="Channel Test",
            platform="youtube",
            lang="fr",
            summary_content=summary_content,
            transcript_context="Transcript de test.",
            structured_index=structured_index,
            full_digest=full_digest,
        )
        async_session.add(summary)
        await async_session.commit()
        await async_session.refresh(summary)
        # Attache le user pour les tests qui en ont besoin
        summary.user = user
        return summary

    return _factory


@pytest_asyncio.fixture
async def flashcard_factory(async_session: AsyncSession):
    """Crée et persiste une Flashcard liée à un summary existant."""

    async def _factory(
        summary: Summary,
        position: int = 0,
        front: str = "Q",
        back: str = "A",
    ) -> Flashcard:
        flashcard = Flashcard(
            summary_id=summary.id,
            user_id=summary.user_id,
            position=position,
            front=front,
            back=back,
        )
        async_session.add(flashcard)
        await async_session.commit()
        await async_session.refresh(flashcard)
        return flashcard

    return _factory


@pytest_asyncio.fixture
async def quiz_question_factory(async_session: AsyncSession):
    """Crée et persiste une QuizQuestion liée à un summary existant."""

    async def _factory(
        summary: Summary,
        position: int = 0,
        question: str = "Question?",
        options: Optional[list] = None,
        correct_index: int = 0,
        explanation: Optional[str] = None,
    ) -> QuizQuestion:
        if options is None:
            options = ["A", "B", "C", "D"]
        question_obj = QuizQuestion(
            summary_id=summary.id,
            user_id=summary.user_id,
            position=position,
            question=question,
            options_json=json.dumps(options),
            correct_index=correct_index,
            explanation=explanation,
        )
        async_session.add(question_obj)
        await async_session.commit()
        await async_session.refresh(question_obj)
        return question_obj

    return _factory


@pytest_asyncio.fixture
async def chat_message_factory(async_session: AsyncSession):
    """Crée et persiste un ChatMessage lié à un summary existant."""

    async def _factory(
        summary: Summary,
        role: str = "user",
        content: str = "message",
    ) -> ChatMessage:
        message = ChatMessage(
            user_id=summary.user_id,
            summary_id=summary.id,
            role=role,
            content=content,
        )
        async_session.add(message)
        await async_session.commit()
        await async_session.refresh(message)
        return message

    return _factory


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TASK 6 — embed_summary
# ═══════════════════════════════════════════════════════════════════════════════


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
            select(SummaryEmbedding)
            .where(SummaryEmbedding.summary_id == summary.id)
            .order_by(SummaryEmbedding.section_index)
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


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TASK 7 — embed_flashcards
# ═══════════════════════════════════════════════════════════════════════════════


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
    rows = (
        await async_session.execute(
            select(FlashcardEmbedding).where(FlashcardEmbedding.summary_id == summary.id)
        )
    ).scalars().all()
    assert len(rows) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TASK 8 — embed_quiz
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_embed_quiz(
    async_session, summary_factory, quiz_question_factory, patch_httpx_post
):
    summary = await summary_factory()
    q1 = await quiz_question_factory(
        summary=summary,
        position=0,
        question="Quelle est la capitale ?",
        options=["Paris", "Lyon", "Berlin", "Rome"],
        correct_index=0,
    )
    q2 = await quiz_question_factory(
        summary=summary,
        position=1,
        question="Combien font 2+2 ?",
        options=["3", "4", "5"],
        correct_index=1,
    )

    from search.embedding_service import embed_quiz
    result = await embed_quiz(summary.id)

    assert result is True
    rows = (
        await async_session.execute(
            select(QuizEmbedding).where(QuizEmbedding.summary_id == summary.id)
        )
    ).scalars().all()
    assert len(rows) == 2
    # Le text_preview doit contenir question + bonne réponse
    assert any("Paris" in r.text_preview for r in rows)
    assert any("4" in r.text_preview for r in rows)
    # Vérifier qu'on a bien les 2 quiz_question_id
    assert {r.quiz_question_id for r in rows} == {q1.id, q2.id}
