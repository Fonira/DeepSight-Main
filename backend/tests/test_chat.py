"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST CHAT — Tests du chat IA contextuel                                       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import importlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from httpx import AsyncClient, ASGITransport

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIX MODULE SHADOWING — import vrai module router
# ═══════════════════════════════════════════════════════════════════════════════
_chat_router = importlib.import_module('chat.router')


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def make_mock_user(**overrides):
    user = MagicMock()
    defaults = {
        "id": 1, "username": "testuser", "email": "test@example.com",
        "email_verified": True, "plan": "pro", "credits": 100,
        "is_admin": False, "avatar_url": None,
        "default_lang": "fr", "default_mode": "standard",
        "default_model": "mistral-small-latest",
        "total_videos": 5, "total_words": 10000, "total_playlists": 0,
        "created_at": datetime(2024, 1, 1),
        "password_hash": "h", "session_token": "s",
        "stripe_customer_id": None, "stripe_subscription_id": None,
    }
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


def make_mock_summary(**overrides):
    s = MagicMock()
    defaults = {
        "id": 1, "user_id": 1, "video_id": "test123",
        "video_title": "Test Video", "summary_content": "Un résumé de test.",
        "transcript_context": "Transcript de test complet.",
        "lang": "fr", "mode": "standard", "category": "science",
    }
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


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
    from main import app
    from db.database import get_session

    async def override_session():
        return mock_session

    app.dependency_overrides[get_session] = override_session
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_client(app, api_user):
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
# 💬 TESTS CHAT /ask
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestChatAsk:

    @pytest.mark.asyncio
    async def test_ask_valid_message(self, auth_client, api_user):
        """POST /chat/ask avec message valide → réponse."""
        with patch.object(_chat_router, "V4_AVAILABLE", True), \
             patch.object(_chat_router, "process_chat_message_v4", new_callable=AsyncMock) as m_chat:
            m_chat.return_value = {
                "response": "Voici la réponse à votre question.",
                "web_search_used": False,
                "sources": [],
                "enrichment_level": "none",
                "quota_info": {"daily_used": 1, "daily_limit": 200}
            }

            resp = await auth_client.post("/api/chat/ask", json={
                "question": "De quoi parle cette vidéo ?",
                "summary_id": 1,
                "mode": "standard",
                "use_web_search": False
            })

        assert resp.status_code == 200
        data = resp.json()
        assert "response" in data
        assert data["response"] == "Voici la réponse à votre question."
        assert data["web_search_used"] is False

    @pytest.mark.asyncio
    async def test_ask_missing_summary_id(self, auth_client):
        """POST /chat/ask sans summary_id → 422 (validation Pydantic)."""
        resp = await auth_client.post("/api/chat/ask", json={
            "question": "Question test"
            # summary_id manquant → erreur validation
        })

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_ask_summary_not_found(self, auth_client):
        """POST /chat/ask avec summary d'un autre user → 404."""
        with patch.object(_chat_router, "V4_AVAILABLE", True), \
             patch.object(_chat_router, "process_chat_message_v4", new_callable=AsyncMock) as m_chat:
            m_chat.return_value = {"error": "Summary not found"}

            resp = await auth_client.post("/api/chat/ask", json={
                "question": "Question sur une vidéo qui n'est pas à moi",
                "summary_id": 999,
                "mode": "standard",
                "use_web_search": False
            })

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_ask_quota_exceeded(self, auth_client):
        """POST /chat/ask avec crédits insuffisants → 429."""
        with patch.object(_chat_router, "V4_AVAILABLE", True), \
             patch.object(_chat_router, "process_chat_message_v4", new_callable=AsyncMock) as m_chat:
            m_chat.return_value = {"error": "Daily chat limit reached"}

            resp = await auth_client.post("/api/chat/ask", json={
                "question": "Encore une question",
                "summary_id": 1,
                "mode": "standard",
                "use_web_search": False
            })

        assert resp.status_code == 429
