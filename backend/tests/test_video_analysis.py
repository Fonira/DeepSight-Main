"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST VIDEO ANALYSIS — Tests des endpoints d'analyse vidéo                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import json
import importlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from httpx import AsyncClient, ASGITransport

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIX MODULE SHADOWING — import vrai module router
# ═══════════════════════════════════════════════════════════════════════════════
_videos_router = importlib.import_module('videos.router')


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
        "video_title": "Test Video", "video_channel": "TestChannel",
        "video_duration": 600, "video_url": "https://youtube.com/watch?v=test123",
        "thumbnail_url": "https://img.youtube.com/vi/test123/mqdefault.jpg",
        "category": "science", "category_confidence": 0.9,
        "lang": "fr", "mode": "standard", "model_used": "mistral-small-latest",
        "summary_content": "Résumé de test avec du contenu.",
        "transcript_context": "Transcript de test",
        "word_count": 50, "reliability_score": 85,
        "is_favorite": False, "notes": None, "tags": None,
        "entities_extracted": None, "fact_check_result": None,
        "deep_research": None, "enrichment_sources": None,
        "enrichment_data": None, "full_digest": None,
        "platform": "youtube", "playlist_id": None,
        "view_count": 0, "like_count": 0, "comment_count": 0, "share_count": 0,
        "channel_follower_count": None, "content_type": "video",
        "music_title": None, "music_author": None,
        "source_tags_json": None, "carousel_images": None,
        "created_at": datetime(2024, 1, 1),
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
def free_user():
    return make_mock_user(plan="free", credits=0)


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
def auth_app(app, api_user):
    """App avec user authentifié + email vérifié + daily limit bypassé."""
    from auth.dependencies import get_current_user, get_verified_user, check_daily_limit

    async def override_user():
        return api_user

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_verified_user] = override_user
    app.dependency_overrides[check_daily_limit] = override_user
    return app


@pytest.fixture
async def auth_client(auth_app):
    async with AsyncClient(
        transport=ASGITransport(app=auth_app),
        base_url="http://test"
    ) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# 🎬 TESTS POST /analyze
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestAnalyzeVideo:

    @pytest.mark.asyncio
    async def test_analyze_valid_url(self, auth_client, api_user):
        """POST /analyze avec URL YouTube valide → 200 + task_id."""
        with patch.object(_videos_router, "extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch.object(_videos_router, "detect_platform", return_value="youtube"), \
             patch.object(_videos_router, "SECURITY_AVAILABLE", False), \
             patch.object(_videos_router, "check_can_analyze", new_callable=AsyncMock) as m_check, \
             patch.object(_videos_router, "get_summary_by_video_id", new_callable=AsyncMock, return_value=None), \
             patch.object(_videos_router, "create_task", new_callable=AsyncMock), \
             patch.object(_videos_router, "_analyze_video_background_v6", new_callable=AsyncMock):
            m_check.return_value = (True, None, 100, 1)

            resp = await auth_client.post("/api/videos/analyze", json={
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "mode": "standard",
                "lang": "fr"
            })

        assert resp.status_code == 200
        data = resp.json()
        assert "task_id" in data
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_analyze_invalid_url(self, auth_client):
        """POST /analyze avec URL invalide → 400."""
        with patch.object(_videos_router, "detect_platform", return_value="youtube"), \
             patch.object(_videos_router, "extract_video_id", return_value=None), \
             patch.object(_videos_router, "SECURITY_AVAILABLE", False):

            resp = await auth_client.post("/api/videos/analyze", json={
                "url": "https://notayoutube.com/invalid",
                "mode": "standard",
                "lang": "fr"
            })

        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_analyze_zero_credits(self, app, mock_session):
        """POST /analyze avec quota épuisé (0 crédits) → 403."""
        zero_user = make_mock_user(credits=0)

        from auth.dependencies import get_current_user, get_verified_user, check_daily_limit
        async def override():
            return zero_user
        app.dependency_overrides[get_current_user] = override
        app.dependency_overrides[get_verified_user] = override
        app.dependency_overrides[check_daily_limit] = override

        with patch.object(_videos_router, "extract_video_id", return_value="abc123"), \
             patch.object(_videos_router, "detect_platform", return_value="youtube"), \
             patch.object(_videos_router, "SECURITY_AVAILABLE", False), \
             patch.object(_videos_router, "check_can_analyze", new_callable=AsyncMock) as m_check, \
             patch.object(_videos_router, "get_summary_by_video_id", new_callable=AsyncMock, return_value=None), \
             patch.object(_videos_router, "_analyze_video_background_v6", new_callable=AsyncMock):
            m_check.return_value = (False, "insufficient_credits", 0, 1)

            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test"
            ) as client:
                resp = await client.post("/api/videos/analyze", json={
                    "url": "https://www.youtube.com/watch?v=abc123",
                    "mode": "standard",
                    "lang": "fr"
                })

        assert resp.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TESTS GET /status
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestTaskStatus:

    @pytest.mark.asyncio
    async def test_status_existing_task(self, auth_client, api_user):
        """GET /status/{task_id} existant → statut correct."""
        task_id = "test-task-123"
        mock_task = {
            "status": "completed",
            "progress": 100,
            "message": "Done",
            "user_id": api_user.id,
            "result": {"summary_id": 1}
        }
        with patch.object(_videos_router._task_store, "aget", new_callable=AsyncMock, return_value=mock_task):
            resp = await auth_client.get(f"/api/videos/status/{task_id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["progress"] == 100

    @pytest.mark.asyncio
    async def test_status_nonexistent_task(self, auth_client):
        """GET /status/{task_id} inexistant → 404."""
        with patch.object(_videos_router, "get_task", new_callable=AsyncMock, return_value=None):
            resp = await auth_client.get("/api/videos/status/nonexistent-task")

        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# 📜 TESTS GET /history
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestHistory:

    @pytest.mark.asyncio
    async def test_history_default(self, auth_client):
        """GET /history → liste paginée."""
        mock_items = [
            MagicMock(
                id=i, video_id=f"vid{i}", video_title=f"Video {i}",
                video_channel="Ch", video_duration=300,
                thumbnail_url="http://img.jpg", category="science",
                lang="fr", mode="standard", model_used="mistral-small-latest",
                word_count=100, is_favorite=False, created_at=datetime(2024, 1, i + 1),
                platform="youtube", reliability_score=80, tags=None, notes=None,
            )
            for i in range(3)
        ]
        with patch.object(_videos_router, "get_user_history", new_callable=AsyncMock) as m:
            m.return_value = (mock_items, 3)
            resp = await auth_client.get("/api/videos/history")

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    @pytest.mark.asyncio
    async def test_history_pagination(self, auth_client):
        """GET /history avec pagination (page=2, limit=10)."""
        with patch.object(_videos_router, "get_user_history", new_callable=AsyncMock) as m:
            m.return_value = ([], 25)
            resp = await auth_client.get("/api/videos/history?page=2&per_page=10")

        assert resp.status_code == 200
        m.assert_called_once()
        call_kwargs = m.call_args
        assert call_kwargs.kwargs.get("page") == 2 or call_kwargs[1].get("page") == 2


# ═══════════════════════════════════════════════════════════════════════════════
# 🔒 TESTS GET /summary — Accès par ownership
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestSummaryAccess:

    @pytest.mark.asyncio
    async def test_summary_own_user(self, auth_client, api_user):
        """GET /summary/{id} appartenant au user → 200."""
        summary = make_mock_summary(user_id=api_user.id)
        with patch.object(_videos_router, "get_summary_by_id", new_callable=AsyncMock, return_value=summary):
            resp = await auth_client.get("/api/videos/summary/1")

        assert resp.status_code == 200
        data = resp.json()
        assert data["video_title"] == "Test Video"

    @pytest.mark.asyncio
    async def test_summary_other_user(self, auth_client):
        """GET /summary/{id} d'un autre user → 404 (get_summary_by_id filtre par user_id)."""
        with patch.object(_videos_router, "get_summary_by_id", new_callable=AsyncMock, return_value=None):
            resp = await auth_client.get("/api/videos/summary/999")

        assert resp.status_code == 404
