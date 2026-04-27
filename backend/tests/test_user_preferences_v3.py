"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST USER PREFERENCES V3 — ambient_lighting_enabled (Task 1.11 + Task 15)    ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Vérifie le contrat HTTP du PUT /api/auth/preferences avec ambient_lighting_enabled.

Avec Task 15 : la persistance se fait maintenant server-side dans
User.preferences (JSON column, migration 008). Ces tests-ci continuent
de mocker le service pour vérifier le contrat router/schema (pas de DB) ;
la persistance réelle est couverte par tests/test_user_preferences_ambient.py.

Tests :
  1. PUT /api/auth/preferences avec ambient_lighting_enabled=False → 200 +
     service appelé avec ambient_lighting_enabled=False
  2. PUT avec ambient_lighting_enabled=True → 200 + service appelé avec True
  3. GET /api/auth/me par défaut → pas d'erreur (default frontend = True)
  4. PUT combinant ambient_lighting_enabled + champs scalaires → 200 + tous
     les champs propagés au service

Pattern fixtures repris de tests/test_auth_flow.py (AsyncClient + ASGITransport
+ dependency_overrides) car il n'existe pas de fixtures `client`/`auth_headers`
globales dans conftest.py.
"""

import os
import sys
import importlib
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

# Env defaults pour import safety
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from httpx import AsyncClient, ASGITransport

# Fix module shadowing — auth/__init__.py ré-exporte router
_auth_router = importlib.import_module('auth.router')


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS & FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════


def make_mock_user(**overrides):
    """Mock User avec tous les champs requis pour UserResponse."""
    user = MagicMock()
    defaults = {
        "id": 1,
        "username": "ambientuser",
        "email": "ambient@example.com",
        "email_verified": True,
        "plan": "pro",
        "credits": 1500,
        "is_admin": False,
        "avatar_url": None,
        "default_lang": "fr",
        "default_mode": "standard",
        "default_model": "mistral-medium-2508",
        "total_videos": 0,
        "total_words": 0,
        "total_playlists": 0,
        "created_at": datetime(2026, 4, 26),
        "password_hash": "hashed_pw",
        "session_token": "valid_session_token",
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "google_id": None,
    }
    defaults.update(overrides)
    for key, value in defaults.items():
        setattr(user, key, value)
    return user


@pytest.fixture
def api_user():
    return make_mock_user()


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
    """FastAPI app avec get_session overridé."""
    from main import app
    from db.database import get_session

    async def override_session():
        return mock_session

    app.dependency_overrides[get_session] = override_session
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_client(app, api_user):
    """Client HTTP authentifié — get_current_user retourne api_user."""
    from auth.dependencies import get_current_user

    async def override_user():
        return api_user

    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_user_preferences_accepts_ambient_lighting_enabled(auth_client, api_user):
    """PUT /preferences accepte ambient_lighting_enabled (False puis True) sans 422
    et le router le propage au service (Task 15: persistance server-side)."""
    from unittest.mock import patch

    with patch.object(_auth_router, "update_user_preferences", new_callable=AsyncMock) as m_update:
        m_update.return_value = True

        # Toggle OFF
        resp = await auth_client.put(
            "/api/auth/preferences",
            json={"ambient_lighting_enabled": False},
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["success"] is True
        # Task 15: vérifier que le router transmet bien ambient_lighting_enabled au service
        assert m_update.call_args.kwargs.get("ambient_lighting_enabled") is False, (
            "Router doit propager ambient_lighting_enabled=False au service "
            "(sinon la persistance dans User.preferences ne se fera pas)"
        )

        # Toggle ON
        resp = await auth_client.put(
            "/api/auth/preferences",
            json={"ambient_lighting_enabled": True},
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["success"] is True
        assert m_update.call_args.kwargs.get("ambient_lighting_enabled") is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_user_preferences_default_ambient_lighting_enabled_true(auth_client, api_user):
    """GET /me par défaut → pas de 'ambient_lighting_enabled' explicite (frontend default = True)."""
    resp = await auth_client.get("/api/auth/me")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    data = resp.json()
    # Pour la phase v3 foundation, la pref n'est PAS persistée backend
    # (storage local côté client). Le frontend lit absente → default True.
    # Ce test documente ce contrat : si le champ apparaît plus tard côté
    # backend, il devra être True par défaut.
    val = data.get("ambient_lighting_enabled", True)
    assert val is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_user_preferences_combined_with_other_fields(auth_client, api_user):
    """PUT /preferences accepte ambient_lighting_enabled combiné aux autres champs existants
    et propage tous les champs au service (Task 15: pas de drop silencieux)."""
    from unittest.mock import patch

    with patch.object(_auth_router, "update_user_preferences", new_callable=AsyncMock) as m_update:
        m_update.return_value = True

        resp = await auth_client.put(
            "/api/auth/preferences",
            json={
                "default_lang": "en",
                "default_mode": "deep",
                "ambient_lighting_enabled": False,
            },
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["success"] is True

        kwargs = m_update.call_args.kwargs
        assert kwargs.get("default_lang") == "en"
        assert kwargs.get("default_mode") == "deep"
        assert kwargs.get("ambient_lighting_enabled") is False
