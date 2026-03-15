"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST AUTH FLOW — Tests complets du flux d'authentification                    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import importlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

# Env defaults pour import safety
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from httpx import AsyncClient, ASGITransport

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIX MODULE SHADOWING
# auth/__init__.py fait `from .router import router` ce qui écrase l'attribut
# auth.router (module) par l'objet APIRouter. On importe le vrai module ici.
# ═══════════════════════════════════════════════════════════════════════════════
_auth_router = importlib.import_module('auth.router')


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def make_mock_user(**overrides):
    """Factory: mock User avec tous les champs requis pour UserResponse."""
    user = MagicMock()
    defaults = {
        "id": 1,
        "username": "testuser",
        "email": "test@example.com",
        "email_verified": True,
        "plan": "free",
        "credits": 150,
        "is_admin": False,
        "avatar_url": None,
        "default_lang": "fr",
        "default_mode": "standard",
        "default_model": "mistral-small-latest",
        "total_videos": 0,
        "total_words": 0,
        "total_playlists": 0,
        "created_at": datetime(2024, 1, 1),
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


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════

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
async def client(app):
    """Client HTTP non authentifié."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
async def auth_client(app, api_user):
    """Client HTTP authentifié."""
    from auth.dependencies import get_current_user

    async def override_user():
        return api_user

    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 TESTS INSCRIPTION
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestRegister:

    @pytest.mark.asyncio
    async def test_register_valid_email(self, client, api_user):
        """POST /register avec email valide → 200 + success."""
        with patch.object(_auth_router, "create_user", new_callable=AsyncMock) as m, \
             patch.object(_auth_router, "EMAIL_CONFIG", {"ENABLED": False}):
            m.return_value = (True, api_user, "Compte créé")

            resp = await client.post("/api/auth/register", json={
                "username": "newuser",
                "email": "new@example.com",
                "password": "securepass123"
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client):
        """POST /register avec email déjà pris → 400."""
        with patch.object(_auth_router, "create_user", new_callable=AsyncMock) as m:
            m.return_value = (False, None, "Email already exists")

            resp = await client.post("/api/auth/register", json={
                "username": "newuser",
                "email": "existing@example.com",
                "password": "securepass123"
            })

        assert resp.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 TESTS LOGIN
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestLogin:

    @pytest.mark.asyncio
    async def test_login_valid_credentials(self, client, api_user):
        """POST /login credentials valides → token retourné."""
        with patch.object(_auth_router, "authenticate_user", new_callable=AsyncMock) as m_auth, \
             patch.object(_auth_router, "create_access_token", return_value="test_access_token"), \
             patch.object(_auth_router, "create_refresh_token", return_value="test_refresh_token"):
            m_auth.return_value = (True, api_user, "OK", "session_tok")

            resp = await client.post("/api/auth/login", json={
                "email": "test@example.com",
                "password": "correctpassword"
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"] == "test_access_token"
        assert data["refresh_token"] == "test_refresh_token"
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        """POST /login mauvais password → 401."""
        with patch.object(_auth_router, "authenticate_user", new_callable=AsyncMock) as m_auth:
            m_auth.return_value = (False, None, "Invalid credentials", None)

            resp = await client.post("/api/auth/login", json={
                "email": "test@example.com",
                "password": "wrongpassword"
            })

        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# 👤 TESTS GET /ME
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestGetMe:

    @pytest.mark.asyncio
    async def test_me_valid_token(self, auth_client, api_user):
        """GET /me avec token valide → profil user."""
        resp = await auth_client.get("/api/auth/me")

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == api_user.id
        assert data["email"] == api_user.email
        assert data["plan"] == api_user.plan

    @pytest.mark.asyncio
    async def test_me_no_token(self, client):
        """GET /me sans token → 401."""
        with patch("auth.dependencies.SECURITY_AVAILABLE", False):
            resp = await client.get("/api/auth/me")

        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_me_expired_token(self, client):
        """GET /me avec token expiré → 401."""
        with patch("auth.dependencies.SECURITY_AVAILABLE", False), \
             patch("auth.dependencies.verify_token", return_value=None):
            resp = await client.get(
                "/api/auth/me",
                headers={"Authorization": "Bearer expired.token.here"}
            )

        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 TESTS REFRESH TOKEN
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestRefreshToken:

    @pytest.mark.asyncio
    async def test_refresh_valid(self, client, api_user):
        """POST /refresh avec refresh_token valide → nouveau access_token."""
        with patch.object(_auth_router, "verify_token") as m_verify, \
             patch.object(_auth_router, "get_user_by_id", new_callable=AsyncMock) as m_get_user, \
             patch.object(_auth_router, "validate_session_token", new_callable=AsyncMock) as m_valid, \
             patch.object(_auth_router, "create_user_session", new_callable=AsyncMock) as m_session, \
             patch.object(_auth_router, "create_access_token", return_value="new_access"), \
             patch.object(_auth_router, "create_refresh_token", return_value="new_refresh"):
            m_verify.return_value = {"sub": "1", "session": "old_session"}
            m_get_user.return_value = api_user
            m_valid.return_value = True
            m_session.return_value = "new_session_token"

            resp = await client.post("/api/auth/refresh", json={
                "refresh_token": "valid_refresh_token"
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"] == "new_access"
        assert data["refresh_token"] == "new_refresh"

    @pytest.mark.asyncio
    async def test_refresh_expired(self, client):
        """POST /refresh avec refresh_token expiré → 401."""
        with patch.object(_auth_router, "verify_token", return_value=None):
            resp = await client.post("/api/auth/refresh", json={
                "refresh_token": "expired_refresh_token"
            })

        assert resp.status_code == 401
