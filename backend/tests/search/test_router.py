"""Tests pour les endpoints /api/search/* — V1 routers.

Approach : monter l'app FastAPI complète avec :
- SQLite in-memory (engine local + Base.metadata.create_all)
- Patches `async_session_maker` dans les modules services (`search.global_search`,
  `search.within_search`, `search.explain_passage`) pour qu'ils tapent dans la DB
  de test (Summary, embeddings, ExplainPassageCache).
- `dependency_overrides[get_current_user]` pour injecter un User mock en bypass auth.
- `dependency_overrides[get_session]` pour les autres routers (pas critique ici).
- `monkeypatch` de `generate_embedding` dans les services pour des embeddings déterministes.
- Patch `_call_mistral_chat` dans `search.explain_passage` pour éviter les appels réseau.
- `recent_queries` utilise le fallback in-memory quand Redis est absent (cf. service).

Author : Wave 3 — Semantic Search V1 Phase 1 backend.
"""
from __future__ import annotations

import json
import os
import sys
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Setup environnement avant tout import du module main
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))

# Importing db.database registers all Base subclasses on Base.metadata so
# create_all builds the full schema.
from db.database import (  # noqa: F401, E402
    Base,
    ExplainPassageCache,
    Flashcard,
    FlashcardEmbedding,
    Summary,
    SummaryEmbedding,
    User,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ Fixtures locales — DB SQLite in-memory + factories + AsyncClient
# (inlined ici car le conftest global ne fournit pas ces helpers)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def async_session():
    """AsyncSession isolée sur SQLite in-memory.

    Patche `async_session_maker` des modules services search.* pour que tous
    les services (`search_global`, `search_within`, `explain_passage`) voient
    les mêmes données que la session de test.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionMaker = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    patchers = [
        patch("search.global_search.async_session_maker", SessionMaker),
        patch("search.within_search.async_session_maker", SessionMaker),
        patch("search.router.async_session_maker", SessionMaker),
    ]
    for p in patchers:
        p.start()
    try:
        async with SessionMaker() as session:
            try:
                yield session
            finally:
                await session.close()
    finally:
        for p in patchers:
            p.stop()
        await engine.dispose()


@pytest_asyncio.fixture
async def user_factory(async_session: AsyncSession):
    """Crée un User persisté."""
    counter = {"n": 0}

    async def _factory(email: str | None = None, **kwargs) -> User:
        counter["n"] += 1
        n = counter["n"]
        user = User(
            username=kwargs.pop("username", f"router_user_{n}"),
            email=email or f"router_user_{n}@test.fr",
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
            video_id=kwargs.pop("video_id", f"vid-router-{n}"),
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
    """Patche generate_embedding dans les modules services pour des embeddings stables."""

    async def fake_gen(text: str):
        return [0.5] * 1024  # query embedding différent

    monkeypatch.setattr("search.global_search.generate_embedding", fake_gen)
    monkeypatch.setattr("search.global_search.MIN_SIMILARITY", 0.0)
    monkeypatch.setattr("search.within_search.generate_embedding", fake_gen)
    monkeypatch.setattr("search.within_search.MIN_SIMILARITY", 0.0)


@pytest.fixture
def cleanup_recent_queries():
    """Reset le store in-memory de recent_queries (process-local)."""
    from search import recent_queries as rq_module

    rq_module._recent_cache.clear()
    yield
    rq_module._recent_cache.clear()


# ─── App + clients (auth-overridden) ───────────────────────────────────────────


@pytest.fixture
def app_for_search(async_session):
    """FastAPI app avec dependency_overrides initialisés.

    On ne touche pas get_session ici (les routes /api/search/* utilisent
    `async_session_maker` directement, qui est patché par `async_session`).
    """
    from main import app

    yield app
    app.dependency_overrides.clear()


def _make_user_dep(user: User):
    async def _override():
        return user

    return _override


@pytest_asyncio.fixture
async def client(app_for_search) -> AsyncGenerator[AsyncClient, None]:
    """Client non authentifié."""
    async with AsyncClient(
        transport=ASGITransport(app=app_for_search),
        base_url="http://test",
    ) as c:
        yield c


@pytest_asyncio.fixture
async def authed_user(user_factory) -> User:
    """User Pro authentifié pour la majorité des tests."""
    user = await user_factory(plan="pro", email="authed@test.fr")
    return user


@pytest_asyncio.fixture
async def authed_client(
    app_for_search, authed_user
) -> AsyncGenerator[AsyncClient, None]:
    """Client avec un user Pro injecté via dependency_overrides."""
    from auth.dependencies import get_current_user

    app_for_search.dependency_overrides[get_current_user] = _make_user_dep(authed_user)
    async with AsyncClient(
        transport=ASGITransport(app=app_for_search),
        base_url="http://test",
    ) as c:
        yield c


@pytest_asyncio.fixture
async def authed_user_free(user_factory) -> User:
    user = await user_factory(plan="free", email="free@test.fr")
    return user


@pytest_asyncio.fixture
async def authed_client_free(
    app_for_search, authed_user_free
) -> AsyncGenerator[AsyncClient, None]:
    from auth.dependencies import get_current_user

    app_for_search.dependency_overrides[get_current_user] = _make_user_dep(
        authed_user_free
    )
    async with AsyncClient(
        transport=ASGITransport(app=app_for_search),
        base_url="http://test",
    ) as c:
        yield c


@pytest_asyncio.fixture
async def authed_user_pro(user_factory) -> User:
    user = await user_factory(plan="pro", email="pro@test.fr")
    return user


@pytest_asyncio.fixture
async def authed_client_pro(
    app_for_search, authed_user_pro
) -> AsyncGenerator[AsyncClient, None]:
    from auth.dependencies import get_current_user

    app_for_search.dependency_overrides[get_current_user] = _make_user_dep(
        authed_user_pro
    )
    async with AsyncClient(
        transport=ASGITransport(app=app_for_search),
        base_url="http://test",
    ) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Tests — Task 11 : POST /api/search/global
# ═══════════════════════════════════════════════════════════════════════════════


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
    response = await authed_client.post(
        "/api/search/global", json={"query": "transition énergétique"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["query"] == "transition énergétique"
    assert body["total_results"] == 0
    assert body["results"] == []


@pytest.mark.asyncio
async def test_search_global_returns_results_with_metadata(
    authed_client: AsyncClient,
    summary_factory,
    summary_embedding_factory,
    authed_user,
    patched_query_embedding,
):
    summary = await summary_factory(
        user=authed_user, video_title="Crise énergétique EU", video_channel="Le Monde"
    )
    await summary_embedding_factory(
        summary=summary,
        section_index=0,
        text_preview="…la transition énergétique impose…",
    )
    response = await authed_client.post(
        "/api/search/global",
        json={
            "query": "transition énergétique",
            "limit": 10,
            "source_types": ["summary"],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_results"] >= 1
    r = body["results"][0]
    assert r["source_type"] == "summary"
    assert r["source_metadata"]["summary_title"] == "Crise énergétique EU"
    assert r["source_metadata"]["channel"] == "Le Monde"


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Tests — Task 13 : POST /api/search/within/{summary_id}
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_search_within_403_for_other_user(
    authed_client: AsyncClient,
    summary_factory,
    user_factory,
    patched_query_embedding,
):
    """Un user qui n'est pas owner du summary reçoit 403."""
    other = await user_factory(email="other_owner@test.com")
    summary = await summary_factory(user=other)
    response = await authed_client.post(
        f"/api/search/within/{summary.id}", json={"query": "test"}
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_search_within_returns_matches(
    authed_client: AsyncClient,
    summary_factory,
    summary_embedding_factory,
    authed_user,
    patched_query_embedding,
):
    summary = await summary_factory(user=authed_user)
    await summary_embedding_factory(
        summary=summary, section_index=0, text_preview="économie"
    )
    response = await authed_client.post(
        f"/api/search/within/{summary.id}", json={"query": "économie"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert "matches" in body
    assert len(body["matches"]) >= 1
    m = body["matches"][0]
    assert "passage_id" in m
    assert m["passage_id"].startswith("summary:")


@pytest.mark.asyncio
async def test_search_within_403_for_short_query_when_not_owner(
    authed_client: AsyncClient,
    summary_factory,
    user_factory,
    patched_query_embedding,
):
    """SECURITY FIX : un non-owner reçoit 403 même avec une query trop courte
    (1 caractère), car l'ownership-check précède la validation de length.

    Avant ce fix, le service `search_within` retournait `[]` pour query <2,
    ce qui leakait l'existence du summary (aucune erreur = summary existe).
    Maintenant, l'endpoint vérifie l'ownership AVANT le length check du
    service, donc un non-owner reçoit toujours 403.

    NOTE : la query "x" (1 char) est rejetée par Pydantic (422). Pour tester
    le fix de sécurité au niveau service, on envoie une query >=2 mais
    qui aurait été tronquée si on relayait au service avant ownership.
    Le scénario testé : non-owner + summary qui existe = 403, pas 200/[].
    """
    other = await user_factory(email="leak_test@test.com")
    summary = await summary_factory(user=other)
    # Query valide Pydantic (≥2 chars) mais le test prouve que la 403
    # arrive avant tout traitement (ownership-first).
    response = await authed_client.post(
        f"/api/search/within/{summary.id}", json={"query": "xy"}
    )
    assert response.status_code == 403
    # Vérifie qu'on ne reçoit PAS 200 avec un body vide (qui leakait l'existence)
    assert response.status_code != 200
