"""Tests pour le moteur de recherche globale cross-source."""
from __future__ import annotations

import json

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Importing db.database registers all Base subclasses on Base.metadata so
# create_all builds the full schema (User has relationships to FlashcardReview,
# StudySession, UserStudyStats, UserBadge etc., all defined in this module).
from db.database import (  # noqa: F401
    Base,
    Flashcard,
    FlashcardEmbedding,
    Summary,
    SummaryEmbedding,
    User,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ Fixtures locales — DB SQLite in-memory + factories
#   (inlined ici car non disponibles dans le conftest global au moment de Phase 1)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def async_session():
    """AsyncSession isolée sur SQLite in-memory (schéma fresh par test).

    Patche également ``search.global_search.async_session_maker`` pour qu'il
    pointe sur cette même engine, afin que ``search_global`` voit les données
    insérées via la session de test.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionMaker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Patch the session_maker imported into the search service module so that
    # the production code uses our test SQLite engine. We use unittest.mock
    # ``patch`` lifecycle manually since the fixture itself is async.
    from unittest.mock import patch as _patch

    patcher = _patch("search.global_search.async_session_maker", SessionMaker)
    patcher.start()
    try:
        async with SessionMaker() as session:
            try:
                yield session
            finally:
                await session.close()
    finally:
        patcher.stop()
        await engine.dispose()


@pytest_asyncio.fixture
async def user_factory(async_session: AsyncSession):
    """Crée un User persisté."""
    counter = {"n": 0}

    async def _factory(email: str | None = None, **kwargs) -> User:
        counter["n"] += 1
        n = counter["n"]
        user = User(
            username=kwargs.pop("username", f"global_user_{n}"),
            email=email or f"user{n}@test.fr",
            password_hash=kwargs.pop("password_hash", "x"),
            plan=kwargs.pop("plan", "pro"),
            email_verified=kwargs.pop("email_verified", True),
            credits=kwargs.pop("credits", 100),
            **kwargs,
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)
        return user

    return _factory


@pytest_asyncio.fixture
async def summary_factory(async_session: AsyncSession, user_factory):
    """Crée un Summary persisté (auto-crée un User si pas fourni)."""
    counter = {"n": 0}

    async def _factory(user: User | None = None, **kwargs) -> Summary:
        counter["n"] += 1
        n = counter["n"]
        if user is None:
            user = await user_factory()
        summary = Summary(
            user_id=user.id,
            video_id=kwargs.pop("video_id", f"vid-global-{n}"),
            video_title=kwargs.pop("video_title", f"Test Video {n}"),
            video_channel=kwargs.pop("video_channel", "Channel Test"),
            platform=kwargs.pop("platform", "youtube"),
            lang=kwargs.pop("lang", "fr"),
            summary_content=kwargs.pop("summary_content", "Contenu résumé"),
            transcript_context=kwargs.pop("transcript_context", "Transcript test"),
            **kwargs,
        )
        async_session.add(summary)
        await async_session.commit()
        await async_session.refresh(summary)
        # Attach user for convenience
        summary.user = user
        return summary

    return _factory


@pytest_asyncio.fixture
async def summary_embedding_factory(async_session: AsyncSession, fake_embedding_1024):
    """Crée un SummaryEmbedding persisté."""

    async def _factory(
        summary: Summary,
        section_index: int = 0,
        text_preview: str = "section text",
        embedding: list[float] | None = None,
        **kwargs,
    ) -> SummaryEmbedding:
        emb = SummaryEmbedding(
            summary_id=summary.id,
            user_id=summary.user_id,
            section_index=section_index,
            section_ref=kwargs.pop("section_ref", None),
            embedding_json=json.dumps(embedding or fake_embedding_1024),
            text_preview=text_preview,
            token_count=kwargs.pop("token_count", len(text_preview.split())),
            model_version=kwargs.pop("model_version", "mistral-embed"),
            source_metadata=kwargs.pop("source_metadata", None),
            **kwargs,
        )
        async_session.add(emb)
        await async_session.commit()
        await async_session.refresh(emb)
        return emb

    return _factory


@pytest_asyncio.fixture
async def flashcard_factory(async_session: AsyncSession):
    """Crée une Flashcard persistée (sans embedding)."""
    counter = {"n": 0}

    async def _factory(
        summary: Summary,
        front: str = "Q",
        back: str = "A",
        position: int | None = None,
        **kwargs,
    ) -> Flashcard:
        counter["n"] += 1
        pos = position if position is not None else counter["n"] - 1
        fc = Flashcard(
            summary_id=summary.id,
            user_id=summary.user_id,
            position=pos,
            front=front,
            back=back,
            category=kwargs.pop("category", None),
            **kwargs,
        )
        async_session.add(fc)
        await async_session.commit()
        await async_session.refresh(fc)
        return fc

    return _factory


@pytest_asyncio.fixture
async def flashcard_embedding_factory(async_session: AsyncSession, fake_embedding_1024):
    """Crée un FlashcardEmbedding persisté."""

    async def _factory(
        flashcard: Flashcard,
        text_preview: str = "flashcard text",
        embedding: list[float] | None = None,
        **kwargs,
    ) -> FlashcardEmbedding:
        emb = FlashcardEmbedding(
            flashcard_id=flashcard.id,
            summary_id=flashcard.summary_id,
            user_id=flashcard.user_id,
            embedding_json=json.dumps(embedding or fake_embedding_1024),
            text_preview=text_preview,
            model_version=kwargs.pop("model_version", "mistral-embed"),
            **kwargs,
        )
        async_session.add(emb)
        await async_session.commit()
        await async_session.refresh(emb)
        return emb

    return _factory


@pytest.fixture
def patched_query_embedding(monkeypatch, fake_embedding_1024):
    """Patche generate_embedding pour la query (différent du seed des fixtures)."""
    async def fake_gen(text: str):
        return [0.5] * 1024  # query embedding différent
    monkeypatch.setattr("search.global_search.generate_embedding", fake_gen)
    monkeypatch.setattr("search.global_search.MIN_SIMILARITY", 0.0)  # pas de filtre score


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Tests
# ═══════════════════════════════════════════════════════════════════════════════


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
