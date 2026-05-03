"""Smoke test bout-en-bout : créer Summary → trigger auto-embed → search global/within.

Ces tests valident le flow complet de la Phase 1 backend Semantic Search V1 :
  1. Création d'un Summary avec `structured_index` peuplé
  2. Appel direct de `embed_summary(summary_id)` (Mistral mocké au niveau
     `generate_embeddings_batch`, pas httpx — pour ne pas casser le test
     client ASGITransport qui utilise httpx en interne)
  3. POST `/api/search/global` ou `/api/search/within/{id}` via AsyncClient
  4. Vérification que les résultats incluent bien le Summary créé

Approach (identique à `tests/search/test_router.py` Wave 3) :
- SQLite in-memory (engine local + Base.metadata.create_all)
- Patches `async_session_maker` dans :
    * `search.global_search`
    * `search.within_search`
    * `search.router`
    * `db.database` (utilisé par les helpers `embed_*` via local imports)
    * `search.embedding_service` (pour cohérence import-time)
- `dependency_overrides[get_current_user]` pour bypass auth (User mock Pro).
- `patched_embeddings` : monkeypatch `generate_embedding(s)_batch` côté query
  ET côté data — fait office de Mistral mock sans toucher à httpx.

Author : Group I — Task 21 (final closer of Phase 1 backend).
"""
from __future__ import annotations

import json
import os
import sys
from typing import AsyncGenerator
from unittest.mock import patch

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
    Summary,
    SummaryEmbedding,
    User,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ Fixtures locales — DB SQLite in-memory + factories + AsyncClient
# (inlined ici car le conftest global ne fournit pas ces helpers ; les factories
# extra `flashcard_factory`/`quiz_question_factory`/etc. viennent du conftest
# local `tests/search/conftest.py` et picken up `async_session` ci-dessous).
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def async_session():
    """AsyncSession isolée sur SQLite in-memory.

    Patche `async_session_maker` dans tous les modules services search.* +
    `db.database` pour que les helpers `embed_*` (qui importent en LOCAL via
    `from db.database import async_session_maker`) voient les mêmes données
    que la session de test.
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
        # explain_passage + embed_* importent async_session_maker en LOCAL
        # dans la fonction, donc on patch le module source.
        patch("db.database.async_session_maker", SessionMaker),
        # embed_transcript (legacy) lie async_session_maker à l'import-time
        # dans embedding_service.py — on patch aussi pour cohérence (au cas où
        # un futur test appellerait embed_transcript).
        patch("search.embedding_service.async_session_maker", SessionMaker),
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
            username=kwargs.pop("username", f"smoke_user_{n}"),
            email=email or f"smoke_user_{n}@test.fr",
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
            video_id=kwargs.pop("video_id", f"vid-smoke-{n}"),
            video_title=kwargs.pop("video_title", f"Test Video Smoke {n}"),
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


@pytest.fixture
def patched_embeddings(monkeypatch):
    """Patche generate_embedding (query side) + generate_embeddings_batch (data
    side, utilisé par embed_summary).

    Cette stratégie évite de patcher `httpx.AsyncClient.post` qui interférerait
    avec le test client lui-même (ASGITransport utilise httpx en interne).

    - generate_embedding → query embedding `[0.5] * 1024` (déterministe)
    - generate_embeddings_batch → N embeddings factices `[0.001 * (i+1) ...]`
      pour rester cohérent avec le seed historique de `fake_embedding_1024`.
    - MIN_SIMILARITY → 0.0 pour que tout match soit accepté.
    """
    fake_data_embedding = [0.001 * (i + 1) for i in range(1024)]

    async def fake_query_gen(text: str):
        return [0.5] * 1024  # cosine ≠ 1.0 vs fake_data_embedding mais > 0

    async def fake_batch_gen(texts: list[str]):
        return [fake_data_embedding for _ in texts]

    # Query side (services search)
    monkeypatch.setattr("search.global_search.generate_embedding", fake_query_gen)
    monkeypatch.setattr("search.global_search.MIN_SIMILARITY", 0.0)
    monkeypatch.setattr("search.within_search.generate_embedding", fake_query_gen)
    monkeypatch.setattr("search.within_search.MIN_SIMILARITY", 0.0)

    # Data side (helpers embed_*) — patch dans le module embedding_service
    # pour que `embed_summary` qui appelle `generate_embeddings_batch` pioche
    # ce mock au lieu de Mistral.
    monkeypatch.setattr(
        "search.embedding_service.generate_embeddings_batch", fake_batch_gen
    )
    monkeypatch.setattr(
        "search.embedding_service.generate_embedding", fake_query_gen
    )


# ─── App + clients (auth-overridden) ───────────────────────────────────────────


@pytest.fixture
def app_for_search(async_session):
    """FastAPI app avec dependency_overrides initialisés."""
    from main import app

    yield app
    app.dependency_overrides.clear()


def _make_user_dep(user: User):
    async def _override():
        return user

    return _override


@pytest_asyncio.fixture
async def authed_user(user_factory) -> User:
    """User Pro authentifié pour la majorité des tests."""
    user = await user_factory(plan="pro", email="smoke_authed@test.fr")
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


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Tests E2E smoke — Task 21 (Group I, Phase 1 backend final)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_e2e_summary_then_search_global(
    authed_client: AsyncClient,
    summary_factory,
    authed_user: User,
    patched_embeddings,
):
    """Crée un Summary avec structured_index → embed → search global retrouve.

    Flow :
      1. Summary persisté via factory avec `structured_index` peuplé
      2. `embed_summary(summary_id)` appelé directement (Mistral mocké)
      3. POST /api/search/global avec query "nucléaire"
      4. Vérifie que le Summary apparaît dans les résultats avec ses metadata
    """
    summary = await summary_factory(
        user=authed_user,
        video_title="Vidéo sur l'énergie nucléaire",
        structured_index=json.dumps(
            [
                {
                    "ts": "00:00",
                    "title": "Intro",
                    "summary": "Présentation du sujet nucléaire",
                    "kw": [],
                }
            ]
        ),
    )

    # Trigger embed manuellement (asyncio.create_task de prod n'est pas attendu en test)
    from search.embedding_service import embed_summary

    result = await embed_summary(summary.id)
    assert result is True, "embed_summary should succeed with mocked httpx"

    # Search global
    response = await authed_client.post(
        "/api/search/global",
        json={"query": "nucléaire", "source_types": ["summary"]},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_results"] >= 1, f"Expected >=1 result, got {body}"
    first = body["results"][0]
    assert first["source_type"] == "summary"
    assert first["source_metadata"]["summary_title"] == "Vidéo sur l'énergie nucléaire"


@pytest.mark.asyncio
async def test_e2e_within_search_after_summary_embed(
    authed_client: AsyncClient,
    summary_factory,
    authed_user: User,
    patched_embeddings,
):
    """Crée Summary multi-sections → embed → /within/{id} retourne les passages.

    Flow :
      1. Summary persisté avec 2 sections dans structured_index
      2. `embed_summary(summary_id)` — 2 SummaryEmbedding créés
      3. POST /api/search/within/{summary_id} avec query "contenu"
      4. Vérifie que matches contiennent bien des passage_id "summary:..."
    """
    summary = await summary_factory(
        user=authed_user,
        structured_index=json.dumps(
            [
                {
                    "ts": "01:30",
                    "title": "Section A",
                    "summary": "Du contenu pertinent ici",
                    "kw": [],
                },
                {
                    "ts": "05:00",
                    "title": "Section B",
                    "summary": "Autre contenu",
                    "kw": [],
                },
            ]
        ),
    )

    from search.embedding_service import embed_summary

    result = await embed_summary(summary.id)
    assert result is True, "embed_summary should succeed with mocked httpx"

    response = await authed_client.post(
        f"/api/search/within/{summary.id}",
        json={"query": "contenu"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert "matches" in body
    assert len(body["matches"]) >= 1, f"Expected >=1 match, got {body}"
    first_match = body["matches"][0]
    assert first_match["passage_id"].startswith("summary:"), (
        f"Expected passage_id 'summary:...', got {first_match['passage_id']}"
    )
