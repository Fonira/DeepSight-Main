"""Tests pour la recherche sémantique intra-analyse."""
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

    Patche également ``search.within_search.async_session_maker`` pour qu'il
    pointe sur cette même engine, afin que ``search_within`` voit les données
    insérées via la session de test.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionMaker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    from unittest.mock import patch as _patch

    patcher = _patch("search.within_search.async_session_maker", SessionMaker)
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
            username=kwargs.pop("username", f"within_user_{n}"),
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
            video_id=kwargs.pop("video_id", f"vid-within-{n}"),
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


@pytest.fixture
def patched_query_embedding(monkeypatch, fake_embedding_1024):
    """Patche generate_embedding dans search.within_search."""
    async def fake_gen(text: str):
        return [0.5] * 1024
    monkeypatch.setattr("search.within_search.generate_embedding", fake_gen)
    monkeypatch.setattr("search.within_search.MIN_SIMILARITY", 0.0)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Tests
# ═══════════════════════════════════════════════════════════════════════════════


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
    # Query must be ≥ 2 chars (length guard runs before ownership check in
    # the service); this ensures we exercise the ownership-check path.
    with pytest.raises(NotOwnerError):
        await search_within(summary_id=summary.id, user_id=other_user.id, query="xy")
