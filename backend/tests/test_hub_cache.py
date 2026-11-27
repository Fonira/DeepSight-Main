"""Cache des endpoints rappelés à chaque ouverture d'une conversation du Hub.

`/api/videos/concepts/{id}/enriched` (Mistral) et `/api/videos/reliability/{id}`
(métadonnées vidéo + notification) ne doivent faire le travail coûteux qu'une
fois par résumé. Cache in-memory isolé par test, IO externes mockés.
"""

from __future__ import annotations

import importlib
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.cache import InMemoryCacheBackend, cache_service
from db.database import Base, Summary, User


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


@pytest_asyncio.fixture
async def summary(session: AsyncSession) -> Summary:
    user = User(username="hub", email="hub@test.fr", password_hash="x", plan="free", credits=5)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    s = Summary(
        user_id=user.id,
        video_id="dQw4w9WgXcQ",
        video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        video_title="Titre",
        video_channel="Chaîne",
        platform="youtube",
        lang="fr",
        summary_content="La [[photosynthèse]] et la [[chlorophylle]].",
    )
    session.add(s)
    await session.commit()
    await session.refresh(s)
    s.user = user
    return s


@pytest.fixture(autouse=True)
def fresh_cache(monkeypatch):
    monkeypatch.setattr(cache_service, "backend", InMemoryCacheBackend())


@pytest.fixture
def videos_router():
    return importlib.import_module("videos.router")


def _definition(term: str, definition: str = "déf") -> SimpleNamespace:
    return SimpleNamespace(
        term=term,
        definition=definition,
        category="other",
        context_relevance="",
        sources=[],
        confidence=0.7,
        provider="mistral",
    )


@pytest.mark.asyncio
async def test_enriched_concepts_cached_per_summary(session, summary, videos_router, monkeypatch):
    llm = AsyncMock(return_value=[_definition("photosynthèse"), _definition("chlorophylle")])
    monkeypatch.setattr(videos_router, "get_enriched_definitions", llm)

    first = await videos_router.get_enriched_concepts(summary.id, summary.user, session)
    second = await videos_router.get_enriched_concepts(summary.id, summary.user, session)

    assert first["count"] == 2
    assert second == first
    assert llm.await_count == 1


@pytest.mark.asyncio
async def test_enriched_concepts_cache_follows_summary_content(session, summary, videos_router, monkeypatch):
    llm = AsyncMock(return_value=[_definition("photosynthèse")])
    monkeypatch.setattr(videos_router, "get_enriched_definitions", llm)

    await videos_router.get_enriched_concepts(summary.id, summary.user, session)
    summary.summary_content = "Le [[climat]] change."
    await session.commit()
    await videos_router.get_enriched_concepts(summary.id, summary.user, session)

    assert llm.await_count == 2


@pytest.mark.asyncio
async def test_enriched_concepts_degraded_result_not_cached(session, summary, videos_router, monkeypatch):
    llm = AsyncMock(return_value=[_definition("photosynthèse", definition="")])
    monkeypatch.setattr(videos_router, "get_enriched_definitions", llm)

    await videos_router.get_enriched_concepts(summary.id, summary.user, session)
    await videos_router.get_enriched_concepts(summary.id, summary.user, session)

    assert llm.await_count == 2


@pytest.mark.asyncio
async def test_reliability_cached_per_summary(session, summary, videos_router, monkeypatch):
    if not videos_router.FACTCHECK_LITE_AVAILABLE:
        pytest.skip("freshness_factcheck indisponible")

    video_info = AsyncMock(return_value={"publish_date": "2026-01-01T00:00:00"})
    analyze = MagicMock(return_value={"overall_score": 80})
    notify = AsyncMock()
    monkeypatch.setattr(videos_router, "get_video_info", video_info)
    monkeypatch.setattr(videos_router, "analyze_content_reliability", analyze)
    notifications = importlib.import_module("notifications.router")
    monkeypatch.setattr(notifications, "notify_factcheck_complete", notify)

    first = await videos_router.get_content_reliability(summary.id, summary.user, session)
    summary.user.plan = "pro"
    second = await videos_router.get_content_reliability(summary.id, summary.user, session)

    assert first["overall_score"] == second["overall_score"] == 80
    assert video_info.await_count == 1
    assert analyze.call_count == 1
    assert notify.await_count == 1
    # Les champs propres à l'utilisateur restent à jour malgré le cache
    assert first["user_plan"] == "free"
    assert second["user_plan"] == "pro"
    assert second["full_factcheck_available"] is True
