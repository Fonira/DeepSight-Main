"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS: Public API v1 — POST /api/v1/analyze — Visual cache bypass             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Sprint F (2026-05-11) — Fix `visual_analysis=None` cache hit pré-alembic 024.    ║
║                                                                                    ║
║  Le bug : `POST /api/v1/analyze` retournait un Summary cached pré-024 (sans       ║
║  `visual_analysis`), court-circuitant `_analyze_video_background_v6`. Conséquence ║
║  : aucune analyse visuelle nouvelle n'était lancée pour les users API v1, même   ║
║  sur plan=expert + `include_visual_analysis=True`.                                ║
║                                                                                    ║
║  Le fix :                                                                          ║
║   1. Si `include_visual_analysis=True` (default) ET plan in (pro|expert) ET       ║
║      `summary.visual_analysis IS NULL` → bypass cache, lancer une nouvelle        ║
║      analyse (silencieux côté client, log `[CACHE_BYPASS]`).                      ║
║   2. Param `force_refresh: bool = False` exposé sur le schéma `AnalyzeRequest`    ║
║      pour permettre au client de demander explicitement un re-analyze.            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import importlib
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

# Env de test (idem test_api_public_v1_analysis.py)
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Force l'import du vrai module (cf conftest.py — fix module shadowing)
_api_public_router = importlib.import_module("api_public.router")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def make_mock_summary(**overrides):
    """Mock minimal d'une row Summary."""
    s = MagicMock()
    defaults = {
        "id": 204,
        "user_id": 1,
        "video_id": "abc12345678",
        "video_title": "Test video",
        "video_channel": "Test channel",
        "video_duration": 600,
        "summary_content": "Résumé test.",
        "mode": "standard",
        "platform": "youtube",
        "created_at": datetime(2026, 5, 1, 12, 0, 0),
        # Par défaut : NULL → cas pré-alembic 024.
        "visual_analysis": None,
    }
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


def make_mock_api_user(plan: str = "expert", **overrides):
    user = MagicMock()
    defaults = {
        "id": 1,
        "email": "test@example.com",
        "plan": plan,
        "is_admin": False,
        "credits": 1000,
        "api_key_created_at": datetime(2026, 1, 1),
        "api_key_last_used": datetime(2026, 5, 11),
    }
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def mock_session():
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


def _make_app(mock_session, user):
    """Crée une instance App FastAPI avec auth + session mockées."""
    from main import app as fastapi_app
    from db.database import get_session

    async def override_session():
        return mock_session

    async def override_api_user():
        return user

    fastapi_app.dependency_overrides[get_session] = override_session
    fastapi_app.dependency_overrides[_api_public_router.get_api_user] = override_api_user

    return fastapi_app


@pytest.fixture
def expert_user():
    return make_mock_api_user(plan="expert")


@pytest.fixture
def pro_user():
    return make_mock_api_user(plan="pro")


@pytest.fixture
def free_user():
    return make_mock_api_user(plan="free")


@pytest.fixture
async def client_factory(mock_session):
    """Factory qui crée un client httpx avec un user spécifique."""
    created_apps = []

    async def _make(user):
        app = _make_app(mock_session, user)
        created_apps.append(app)
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    yield _make

    for app in created_apps:
        app.dependency_overrides.clear()


# Visual sample (forme issue de Phase 2 Mistral Vision).
_VISUAL_SAMPLE = {
    "visual_hook": "Plan d'introduction iconique",
    "visual_structure": "Séquences alternées",
    "key_moments": [{"t": 30, "label": "Hook"}],
    "visible_text": ["Test"],
    "visual_seo_indicators": {"hook_strength": "high"},
    "summary_visual": "Description visuelle.",
    "model_used": "mistral-medium-vision-2508",
    "frames_analyzed": 8,
    "frames_downsampled": False,
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — Cache bypass quand visual_analysis manquant pré-024
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestAnalyzeCacheBypassVisualMissing:
    """Régression : cache bypass quand `visual_analysis IS NULL` + plan eligible."""

    @pytest.mark.asyncio
    async def test_cache_bypass_when_visual_missing_and_plan_expert(
        self, client_factory, mock_session, expert_user
    ):
        """Cache hit pré-024 + expert + visual demandé → bypass + background task."""
        cached_summary = make_mock_summary(id=204, visual_analysis=None)

        with patch.object(
            _api_public_router, "get_summary_by_video_id", new=AsyncMock(return_value=cached_summary)
        ), patch.object(
            _api_public_router, "_analyze_video_background_v6", new=AsyncMock(return_value=None)
        ), patch.object(
            _api_public_router, "set_task_status", new=MagicMock()
        ), patch.object(
            _api_public_router, "detect_platform", new=MagicMock(return_value="youtube")
        ), patch.object(
            _api_public_router, "extract_video_id", new=MagicMock(return_value="abc12345678")
        ), patch("asyncio.ensure_future") as mock_ensure_future, patch.object(
            _api_public_router.logger, "info", new=MagicMock()
        ) as mock_log_info:
            # ensure_future appelle simplement la coroutine — la consomme.
            mock_ensure_future.side_effect = lambda coro: coro.close() or MagicMock()

            client = await client_factory(expert_user)
            async with client as c:
                resp = await c.post(
                    "/api/v1/analyze",
                    headers={"X-API-Key": "ds_live_test"},
                    json={
                        "url": "https://www.youtube.com/watch?v=abc12345678",
                        "mode": "standard",
                        "include_visual_analysis": True,
                    },
                )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        # Pas de cache hit retourné — nouvelle task lancée.
        assert data["status"] == "pending", f"Expected pending, got {data}"
        assert not data["task_id"].startswith("cached_"), (
            "Cache aurait dû être bypassed mais a retourné un task cached"
        )
        # ensure_future a été appelé → background task lancée.
        assert mock_ensure_future.called, "_analyze_video_background_v6 n'a pas été lancé"
        # Log [CACHE_BYPASS] émis sur le logger DeepSight (propagate=False
        # donc on patch directement la méthode `.info()` du logger).
        bypass_calls = [
            call for call in mock_log_info.call_args_list
            if call.args and "[CACHE_BYPASS]" in str(call.args[0])
        ]
        assert bypass_calls, f"Log [CACHE_BYPASS] absent — calls: {mock_log_info.call_args_list}"
        msg = str(bypass_calls[0].args[0])
        assert "visual_missing_pre_024" in msg
        assert "summary_id=204" in msg

    @pytest.mark.asyncio
    async def test_cache_hit_when_visual_already_populated(
        self, client_factory, mock_session, expert_user
    ):
        """Summary avec `visual_analysis` non null → cached retourné direct."""
        cached_summary = make_mock_summary(id=205, visual_analysis=_VISUAL_SAMPLE)

        with patch.object(
            _api_public_router, "get_summary_by_video_id", new=AsyncMock(return_value=cached_summary)
        ), patch.object(
            _api_public_router, "_analyze_video_background_v6", new=AsyncMock(return_value=None)
        ), patch.object(
            _api_public_router, "detect_platform", new=MagicMock(return_value="youtube")
        ), patch.object(
            _api_public_router, "extract_video_id", new=MagicMock(return_value="abc12345678")
        ), patch("asyncio.ensure_future") as mock_ensure_future:
            client = await client_factory(expert_user)
            async with client as c:
                resp = await c.post(
                    "/api/v1/analyze",
                    headers={"X-API-Key": "ds_live_test"},
                    json={
                        "url": "https://www.youtube.com/watch?v=abc12345678",
                        "mode": "standard",
                        "include_visual_analysis": True,
                    },
                )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        # Cache hit → status=completed + task_id cached_X.
        assert data["status"] == "completed"
        assert data["task_id"] == "cached_205"
        assert data["cached"] is True
        # Aucune background task lancée.
        assert not mock_ensure_future.called, (
            "Background task lancée alors que cache aurait dû hit"
        )

    @pytest.mark.asyncio
    async def test_cache_hit_when_user_plan_free_visual_disabled(
        self, client_factory, mock_session, free_user
    ):
        """Free plan + visual NULL → cached retourné (visual non-éligible)."""
        # Free → API v1 normalement bloqué par get_api_user, mais on teste la logique
        # interne avec un user "free" qui aurait passé l'auth (cas admin-bypass ou
        # legacy). La règle métier : si plan ∉ {pro, expert}, on ne backfill pas.
        cached_summary = make_mock_summary(id=206, visual_analysis=None)

        with patch.object(
            _api_public_router, "get_summary_by_video_id", new=AsyncMock(return_value=cached_summary)
        ), patch.object(
            _api_public_router, "_analyze_video_background_v6", new=AsyncMock(return_value=None)
        ), patch.object(
            _api_public_router, "detect_platform", new=MagicMock(return_value="youtube")
        ), patch.object(
            _api_public_router, "extract_video_id", new=MagicMock(return_value="abc12345678")
        ), patch("asyncio.ensure_future") as mock_ensure_future:
            client = await client_factory(free_user)
            async with client as c:
                resp = await c.post(
                    "/api/v1/analyze",
                    headers={"X-API-Key": "ds_live_test"},
                    json={
                        "url": "https://www.youtube.com/watch?v=abc12345678",
                        "mode": "standard",
                        "include_visual_analysis": True,
                    },
                )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "completed"
        assert data["task_id"] == "cached_206"
        assert data["cached"] is True
        assert not mock_ensure_future.called

    @pytest.mark.asyncio
    async def test_cache_hit_when_include_visual_analysis_false(
        self, client_factory, mock_session, expert_user
    ):
        """`include_visual_analysis=False` explicite → cache retourné direct."""
        cached_summary = make_mock_summary(id=207, visual_analysis=None)

        with patch.object(
            _api_public_router, "get_summary_by_video_id", new=AsyncMock(return_value=cached_summary)
        ), patch.object(
            _api_public_router, "_analyze_video_background_v6", new=AsyncMock(return_value=None)
        ), patch.object(
            _api_public_router, "detect_platform", new=MagicMock(return_value="youtube")
        ), patch.object(
            _api_public_router, "extract_video_id", new=MagicMock(return_value="abc12345678")
        ), patch("asyncio.ensure_future") as mock_ensure_future:
            client = await client_factory(expert_user)
            async with client as c:
                resp = await c.post(
                    "/api/v1/analyze",
                    headers={"X-API-Key": "ds_live_test"},
                    json={
                        "url": "https://www.youtube.com/watch?v=abc12345678",
                        "mode": "standard",
                        "include_visual_analysis": False,
                    },
                )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "completed"
        assert data["task_id"] == "cached_207"
        assert not mock_ensure_future.called

    @pytest.mark.asyncio
    async def test_force_refresh_bypasses_cache_even_when_visual_present(
        self, client_factory, mock_session, expert_user
    ):
        """`force_refresh=True` → bypass cache même si visual déjà présent."""
        cached_summary = make_mock_summary(id=208, visual_analysis=_VISUAL_SAMPLE)

        with patch.object(
            _api_public_router, "get_summary_by_video_id", new=AsyncMock(return_value=cached_summary)
        ), patch.object(
            _api_public_router, "_analyze_video_background_v6", new=AsyncMock(return_value=None)
        ), patch.object(
            _api_public_router, "set_task_status", new=MagicMock()
        ), patch.object(
            _api_public_router, "detect_platform", new=MagicMock(return_value="youtube")
        ), patch.object(
            _api_public_router, "extract_video_id", new=MagicMock(return_value="abc12345678")
        ), patch("asyncio.ensure_future") as mock_ensure_future:
            mock_ensure_future.side_effect = lambda coro: coro.close() or MagicMock()

            client = await client_factory(expert_user)
            async with client as c:
                resp = await c.post(
                    "/api/v1/analyze",
                    headers={"X-API-Key": "ds_live_test"},
                    json={
                        "url": "https://www.youtube.com/watch?v=abc12345678",
                        "mode": "standard",
                        "force_refresh": True,
                    },
                )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "pending"
        assert not data["task_id"].startswith("cached_")
        assert mock_ensure_future.called

    @pytest.mark.asyncio
    async def test_pro_user_also_triggers_bypass(
        self, client_factory, mock_session, pro_user
    ):
        """Plan Pro + visual NULL → bypass aussi (pas seulement Expert)."""
        cached_summary = make_mock_summary(id=209, visual_analysis=None)

        with patch.object(
            _api_public_router, "get_summary_by_video_id", new=AsyncMock(return_value=cached_summary)
        ), patch.object(
            _api_public_router, "_analyze_video_background_v6", new=AsyncMock(return_value=None)
        ), patch.object(
            _api_public_router, "set_task_status", new=MagicMock()
        ), patch.object(
            _api_public_router, "detect_platform", new=MagicMock(return_value="youtube")
        ), patch.object(
            _api_public_router, "extract_video_id", new=MagicMock(return_value="abc12345678")
        ), patch("asyncio.ensure_future") as mock_ensure_future, patch.object(
            _api_public_router.logger, "info", new=MagicMock()
        ) as mock_log_info:
            mock_ensure_future.side_effect = lambda coro: coro.close() or MagicMock()

            client = await client_factory(pro_user)
            async with client as c:
                resp = await c.post(
                    "/api/v1/analyze",
                    headers={"X-API-Key": "ds_live_test"},
                    json={
                        "url": "https://www.youtube.com/watch?v=abc12345678",
                        "mode": "standard",
                        "include_visual_analysis": True,
                    },
                )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "pending"
        assert mock_ensure_future.called
        bypass_calls = [
            call for call in mock_log_info.call_args_list
            if call.args and "[CACHE_BYPASS]" in str(call.args[0])
        ]
        assert bypass_calls
        assert "plan=pro" in str(bypass_calls[0].args[0])
