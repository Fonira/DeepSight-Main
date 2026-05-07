"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS: Public API v1 — GET /api/v1/analysis/{analysis_id}                     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Spécifiquement, vérifie l'exposition de `visual_analysis` dans le payload.       ║
║  Bug confirmé empiriquement 2026-05-07 (Phase 0 du sprint Export to AI) :         ║
║  la colonne `summaries.visual_analysis JSON` (alembic 024) existe en BDD mais     ║
║  n'était PAS exposée dans le payload public, bloquant le futur builder export.    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import importlib
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

# Env de test (idem test_video_analysis.py)
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
    """Mock minimal d'une row Summary pour l'endpoint /api/v1/analysis/{id}."""
    s = MagicMock()
    defaults = {
        "id": 169,
        "user_id": 1,
        "video_id": "dQw4w9WgXcQ",
        "video_title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
        "video_channel": "Rick Astley",
        "video_duration": 213,
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        "summary_content": "Résumé test.",
        "summary_extras": None,
        "transcript_context": "Transcript test",
        "lang": "fr",
        "mode": "standard",
        "model_used": "mistral-small-2603",
        "platform": "youtube",
        "category": "music",
        "reliability_score": 44,
        "deep_research": False,
        "created_at": datetime(2026, 5, 7, 14, 32, 0),
        # 👁️ Phase 2 — par défaut None, surchargé dans le test happy-path.
        "visual_analysis": None,
    }
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


def make_mock_api_user(**overrides):
    user = MagicMock()
    defaults = {
        "id": 1,
        "email": "test@example.com",
        "plan": "expert",
        "is_admin": False,
        "credits": 100,
        "api_key_created_at": datetime(2026, 1, 1),
        "api_key_last_used": datetime(2026, 5, 7),
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


@pytest.fixture
def app(mock_session):
    """App avec auth API publique mockée."""
    from main import app as fastapi_app
    from db.database import get_session

    user = make_mock_api_user()

    async def override_session():
        return mock_session

    async def override_api_user():
        return user

    fastapi_app.dependency_overrides[get_session] = override_session
    fastapi_app.dependency_overrides[_api_public_router.get_api_user] = override_api_user

    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# 👁️ TESTS — visual_analysis exposé dans /api/v1/analysis/{id}
# ═══════════════════════════════════════════════════════════════════════════════

# Sample représentatif d'une analyse visuelle persistée par Phase 2 (alembic 024).
# Forme issue de videos/visual_analyzer.py et confirmée prod (analyse id=169).
_VISUAL_SAMPLE = {
    "visual_hook": "Plan rapproché stylisé années 80 avec smoking sombre",
    "visual_structure": "Alternance plans danse / plans face caméra / plans groupe",
    "key_moments": [
        {"t": 17, "label": "Premier refrain — geste signature"},
        {"t": 134, "label": "Pont visuel — backup dancers"},
    ],
    "visible_text": ["Never Gonna Give You Up", "Rick Astley"],
    "visual_seo_indicators": {
        "hook_strength": "high",
        "thumbnail_clickability": "moderate",
        "watchtime_signals": ["motion", "color_contrast", "facial_close_up"],
    },
    "summary_visual": "Clip iconique 80s, montage rythmé.",
    "model_used": "mistral-medium-vision-2508",
    "frames_analyzed": 8,
    "frames_downsampled": True,
}


@pytest.mark.unit
class TestGetAnalysisVisualExposed:
    """Régression contre le bug d'exposition `visual_analysis` API publique."""

    @pytest.mark.asyncio
    async def test_visual_analysis_field_present_when_populated(
        self, client, mock_session
    ):
        """GET /api/v1/analysis/{id} → payload contient `visual_analysis` non-null
        quand la colonne est peuplée (cas analyse id=169 confirmé prod 2026-05-07)."""
        summary = make_mock_summary(id=169, visual_analysis=_VISUAL_SAMPLE)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client.get(
            "/api/v1/analysis/169",
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        # Régression : le champ DOIT être présent au top-level.
        assert "visual_analysis" in data, (
            "visual_analysis manquant du payload — bug d'exposition (Phase 0 sprint Export to AI)"
        )
        assert data["visual_analysis"] == _VISUAL_SAMPLE
        # Sanity sur les sous-clés clés exploitées par le builder export.
        assert data["visual_analysis"]["visual_seo_indicators"]["hook_strength"] == "high"
        assert data["visual_analysis"]["key_moments"][0]["t"] == 17

    @pytest.mark.asyncio
    async def test_visual_analysis_field_present_and_null_when_absent(
        self, client, mock_session
    ):
        """GET /api/v1/analysis/{id} → champ `visual_analysis` présent mais null
        quand la colonne est NULL (legacy, flag OFF, Mistral fail). Pas de breaking
        change pour les consumers qui ignorent le champ ou check null."""
        summary = make_mock_summary(id=42, visual_analysis=None)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client.get(
            "/api/v1/analysis/42",
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "visual_analysis" in data
        assert data["visual_analysis"] is None

    @pytest.mark.asyncio
    async def test_other_fields_unchanged(self, client, mock_session):
        """Sanity : le champ ajouté ne casse aucun champ existant du contrat."""
        summary = make_mock_summary(id=169, visual_analysis=_VISUAL_SAMPLE)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client.get(
            "/api/v1/analysis/169",
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 200
        data = resp.json()
        # Champs historiques (signature pré-fix) tous présents.
        for field in (
            "id",
            "video_id",
            "video_title",
            "video_channel",
            "video_duration",
            "video_url",
            "thumbnail_url",
            "summary_content",
            "summary_extras",
            "transcript",
            "lang",
            "mode",
            "model_used",
            "platform",
            "category",
            "reliability_score",
            "deep_research",
            "created_at",
        ):
            assert field in data, f"champ historique manquant : {field}"
        assert data["id"] == "169"
        assert data["video_id"] == "dQw4w9WgXcQ"
        assert data["mode"] == "standard"
