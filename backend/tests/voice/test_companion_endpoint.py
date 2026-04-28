"""
Tests pour l'endpoint GET /api/voice/companion-context (Task 11).

Pattern : on monte l'app FastAPI complete avec dependency_overrides pour
get_current_user et get_session, puis on patche build_companion_context
au niveau du router (voice.router.build_companion_context).
"""

import os
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Setup environnement avant tout import du module main
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from httpx import AsyncClient, ASGITransport


def _make_mock_user(plan: str = "pro", uid: int = 1) -> MagicMock:
    """User mock minimal pour les dependency_overrides."""
    user = MagicMock()
    user.id = uid
    user.email = f"{plan}@test.fr"
    user.plan = plan
    user.is_admin = False
    user.first_name = "Test"
    user.prenom = "Test"
    user.language = "fr"
    return user


@pytest.fixture
def mock_session():
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def app(mock_session):
    """FastAPI app avec override de la session DB."""
    from main import app
    from db.database import get_session

    async def override_session():
        return mock_session

    app.dependency_overrides[get_session] = override_session
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def authed_pro_client(app):
    """Client avec un utilisateur Pro authentifié."""
    from auth.dependencies import get_current_user

    async def override_user():
        return _make_mock_user(plan="pro")

    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


@pytest.fixture
async def authed_free_client(app):
    """Client avec un utilisateur Free authentifié."""
    from auth.dependencies import get_current_user

    async def override_user():
        return _make_mock_user(plan="free", uid=2)

    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


@pytest.fixture
async def unauth_client(app):
    """Client sans authentification (pas d'override de get_current_user)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


def _make_response_payload():
    """Construit un CompanionContextResponse valide pour les mocks."""
    from voice.schemas import CompanionContextResponse, ProfileBlock

    return CompanionContextResponse(
        profile=ProfileBlock(
            prenom="Test",
            plan="pro",
            langue="fr",
            total_analyses=0,
            recent_titles=[],
            themes=[],
            streak_days=0,
            flashcards_due_today=0,
        ),
        initial_recos=[],
        cache_hit=False,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_companion_context_endpoint_pro_user_200(authed_pro_client: AsyncClient):
    """Pro user : 200 + payload conforme à CompanionContextResponse."""
    with patch(
        "voice.router.build_companion_context",
        new_callable=AsyncMock,
    ) as mock_build:
        mock_build.return_value = _make_response_payload()

        resp = await authed_pro_client.get("/api/voice/companion-context")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["profile"]["plan"] == "pro"
    assert body["initial_recos"] == []
    assert body["cache_hit"] is False


@pytest.mark.asyncio
async def test_companion_context_endpoint_free_user_402(authed_free_client: AsyncClient):
    """Free user : 402 Payment Required + message d'upgrade."""
    resp = await authed_free_client.get("/api/voice/companion-context")
    assert resp.status_code == 402, resp.text
    detail = resp.json()["detail"]
    # detail peut être str ou dict — on tolère les deux formats.
    detail_str = detail if isinstance(detail, str) else str(detail)
    assert "upgrade" in detail_str.lower()


@pytest.mark.asyncio
async def test_companion_context_endpoint_unauth_401(unauth_client: AsyncClient):
    """Pas d'auth : 401."""
    resp = await unauth_client.get("/api/voice/companion-context")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_companion_context_force_refresh_query_param(authed_pro_client: AsyncClient):
    """?refresh=true : transmet bien force_refresh=True à build_companion_context."""
    with patch(
        "voice.router.build_companion_context",
        new_callable=AsyncMock,
    ) as mock_build:
        mock_build.return_value = _make_response_payload()

        resp = await authed_pro_client.get(
            "/api/voice/companion-context?refresh=true"
        )

    assert resp.status_code == 200, resp.text
    assert mock_build.await_count == 1
    kwargs = mock_build.call_args.kwargs
    assert kwargs["force_refresh"] is True


@pytest.mark.asyncio
async def test_companion_context_default_refresh_is_false(authed_pro_client: AsyncClient):
    """Sans query param : force_refresh=False par défaut."""
    with patch(
        "voice.router.build_companion_context",
        new_callable=AsyncMock,
    ) as mock_build:
        mock_build.return_value = _make_response_payload()

        resp = await authed_pro_client.get("/api/voice/companion-context")

    assert resp.status_code == 200, resp.text
    assert mock_build.await_count == 1
    kwargs = mock_build.call_args.kwargs
    assert kwargs["force_refresh"] is False
