"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS: Public API v1 — Phase 3 sprint Export to AI + GEO                       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Endpoints couverts :                                                              ║
║    • GET   /api/v1/public/summaries/{slug}    — public, no auth, opt-in is_public  ║
║    • PATCH /api/v1/summaries/{id}/visibility   — auth Pro/Expert, owner only       ║
║                                                                                    ║
║  Spec : Vault/01-Projects/DeepSight/Specs/2026-05-07-deepsight-export-to-ai-geo-   ║
║  design.md (§ 4.3 routing, § 4.4 Schema.org, § 5.4 critères Phase 3)               ║
║                                                                                    ║
║  Vérifie notamment :                                                               ║
║   1. 200 + JSON payload + Cache-Control public quand is_public=true                ║
║   2. 404 anti-leak quand is_public=false (mêmes message qu'inexistant)             ║
║   3. 404 sur slug malformé                                                         ║
║   4. PATCH met à jour is_public et retourne le slug                                ║
║   5. PATCH 404 quand summary appartient à un autre user                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import importlib
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

# Env de test (idem test_export_markdown.py / test_api_public_v1_analysis.py)
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
    """Mock minimal d'une row Summary pour les endpoints public/visibility."""
    s = MagicMock()
    defaults = {
        "id": 169,
        "user_id": 1,
        "video_id": "dQw4w9WgXcQ",
        "video_title": "Rick Astley - Never Gonna Give You Up",
        "video_channel": "Rick Astley",
        "video_duration": 213,
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        "summary_content": "Résumé test public.",
        "summary_extras": {"key_takeaways": ["Item 1"]},
        "lang": "fr",
        "mode": "standard",
        "model_used": "mistral-small-2603",
        "platform": "youtube",
        "category": "music",
        "reliability_score": 44,
        "deep_research": False,
        "created_at": datetime(2026, 5, 7, 14, 32, 0),
        "visual_analysis": None,
        "is_public": True,
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
def app_public(mock_session):
    """App FastAPI sans override d'auth (endpoint public)."""
    from main import app as fastapi_app
    from db.database import get_session

    async def override_session():
        return mock_session

    fastapi_app.dependency_overrides[get_session] = override_session

    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def app_authed(mock_session):
    """App FastAPI avec auth API publique mockée (PATCH visibility)."""
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
async def client_public(app_public):
    async with AsyncClient(
        transport=ASGITransport(app=app_public),
        base_url="http://test",
    ) as c:
        yield c


@pytest.fixture
async def client_authed(app_authed):
    async with AsyncClient(
        transport=ASGITransport(app=app_authed),
        base_url="http://test",
    ) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# 🌍 TESTS — GET /api/v1/public/summaries/{slug}
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestPublicSummaryEndpoint:
    """Tests de l'endpoint public — opt-in is_public, anti-leak 404."""

    @pytest.mark.asyncio
    async def test_public_summary_returns_200_when_is_public_true(
        self, client_public, mock_session
    ):
        """200 + JSON payload quand is_public=true et slug existe."""
        # slug = a{hex(169)} = "aa9"
        summary = make_mock_summary(id=169, is_public=True)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client_public.get("/api/v1/public/summaries/aa9")

        assert resp.status_code == 200, resp.text
        assert "application/json" in resp.headers.get("content-type", "")

        # Cache-Control public + s-maxage 1h + stale 24h (cf spec § 4.3 + 4.4)
        cache = resp.headers.get("cache-control", "")
        assert "public" in cache
        assert "s-maxage=3600" in cache
        assert "stale-while-revalidate=86400" in cache

        data = resp.json()
        assert data["id"] == "169"
        assert data["slug"] == "aa9"
        assert data["video_title"] == "Rick Astley - Never Gonna Give You Up"
        assert data["video_id"] == "dQw4w9WgXcQ"
        assert data["permalink"] == "https://deepsightsynthesis.com/a/aa9"
        # Contrat avec PR-A : visual_analysis présent au top-level (même null).
        assert "visual_analysis" in data

    @pytest.mark.asyncio
    async def test_public_summary_404_when_is_public_false(
        self, client_public, mock_session
    ):
        """404 anti-leak — comportement identique à un summary inexistant.

        Le query inclut WHERE is_public=true donc la row n'est PAS retournée
        si is_public=false. Le client ne doit PAS pouvoir distinguer entre
        "n'existe pas" et "existe mais privée" (cf spec § 4.3).
        """
        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client_public.get("/api/v1/public/summaries/aa9")

        assert resp.status_code == 404
        data = resp.json()
        detail = data.get("detail", data)
        assert detail.get("error") == "not_found"
        # Le message DOIT être identique au cas "slug malformé" pour anti-leak.
        assert "not found" in detail.get("message", "").lower()

    @pytest.mark.asyncio
    async def test_public_summary_404_on_malformed_slug(
        self, client_public, mock_session
    ):
        """404 sur slug malformé — pas de leak via détail différent."""
        # Slugs invalides : missing 'a' prefix, non-hex, empty after 'a'.
        for bad_slug in ("zzz", "b1234", "a", "axyz", "alongnonsensestring!"):
            resp = await client_public.get(f"/api/v1/public/summaries/{bad_slug}")
            assert resp.status_code == 404, f"slug {bad_slug!r} should 404"
            data = resp.json()
            detail = data.get("detail", data)
            assert detail.get("error") == "not_found"

    @pytest.mark.asyncio
    async def test_public_summary_does_not_require_auth(
        self, client_public, mock_session
    ):
        """L'endpoint est PUBLIC — aucun X-API-Key requis (cf spec § 4.3)."""
        summary = make_mock_summary(id=169, is_public=True)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        # Pas de header X-API-Key, pas d'Authorization
        resp = await client_public.get("/api/v1/public/summaries/aa9")
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# 🔓 TESTS — PATCH /api/v1/summaries/{id}/visibility
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestVisibilityPatchEndpoint:
    """Tests de l'endpoint PATCH visibility — auth API key + owner only."""

    @pytest.mark.asyncio
    async def test_visibility_patch_sets_public_true(
        self, client_authed, mock_session
    ):
        """PATCH is_public=true → 200 + slug + permalink."""
        summary = make_mock_summary(id=169, user_id=1, is_public=False)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client_authed.patch(
            "/api/v1/summaries/169/visibility",
            json={"is_public": True},
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary_id"] == 169
        assert data["is_public"] is True
        assert data["slug"] == "aa9"
        assert data["permalink"] == "https://deepsightsynthesis.com/a/aa9"
        # commit() effectivement appelé (sanity check persistence).
        mock_session.commit.assert_awaited()
        # Side-effect : objet mis à jour.
        assert summary.is_public is True

    @pytest.mark.asyncio
    async def test_visibility_patch_sets_public_false(
        self, client_authed, mock_session
    ):
        """PATCH is_public=false → 200 + retour à privé."""
        summary = make_mock_summary(id=169, user_id=1, is_public=True)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client_authed.patch(
            "/api/v1/summaries/169/visibility",
            json={"is_public": False},
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["is_public"] is False
        assert summary.is_public is False

    @pytest.mark.asyncio
    async def test_visibility_patch_404_when_not_owner(
        self, client_authed, mock_session
    ):
        """404 quand summary appartient à un autre user (anti-leak).

        Le query filtre par user_id → la row n'est pas retournée. Pas de 403
        pour ne pas leak l'existence du summary (cf contrat /export endpoint).
        """
        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client_authed.patch(
            "/api/v1/summaries/999/visibility",
            json={"is_public": True},
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 404
        data = resp.json()
        detail = data.get("detail", data)
        assert detail.get("error") == "not_found"
        # commit NON appelé (rollback du flow sans modif).
        mock_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_visibility_patch_422_on_missing_body(
        self, client_authed, mock_session
    ):
        """422 quand body est invalide (champ is_public manquant)."""
        # Empty body — is_public is required.
        resp = await client_authed.patch(
            "/api/v1/summaries/169/visibility",
            json={},
            headers={"X-API-Key": "ds_live_test_dummy"},
        )
        assert resp.status_code == 422

        # Type non-coercible vers bool (list / dict). Pydantic v2 coerce
        # "yes"/"no"/"1"/"0" → bool, donc on teste avec un type qui ne peut
        # PAS être coerce.
        resp2 = await client_authed.patch(
            "/api/v1/summaries/169/visibility",
            json={"is_public": ["not", "a", "bool"]},
            headers={"X-API-Key": "ds_live_test_dummy"},
        )
        assert resp2.status_code == 422
