"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS: Public API v1 — GET /api/v1/summaries/{id}/export?format=markdown      ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Sprint Export to AI + GEO (PR-B). Spec :                                          ║
║  Vault/01-Projects/DeepSight/Specs/2026-05-07-deepsight-export-to-ai-geo-design.md ║
║                                                                                    ║
║  Vérifie :                                                                         ║
║   1. 200 + Content-Type text/markdown pour user owner                              ║
║   2. Frontmatter YAML conforme (source/permalink/video_url)                        ║
║   3. Section Visual Analysis + timestamps cliquables présents                      ║
║   4. 404 quand summary appartient à un autre user (Summary scoping)                ║
║   5. Builder résilient sur summary_extras vide                                     ║
║   6. Footer disclaimer reliability < 80                                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import importlib
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

# Env de test (idem test_api_public_v1_analysis.py)
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Force l'import du vrai module (cf conftest.py — fix module shadowing).
_api_public_router = importlib.import_module("api_public.router")

from exports.markdown_builder import build_markdown_export


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


_VISUAL_SAMPLE = {
    "visual_hook": "Plan rapproché stylisé années 80 avec smoking sombre",
    "visual_structure": "Alternance plans danse / plans face caméra / plans groupe",
    "key_moments": [
        {"timestamp_s": 17, "description": "Premier refrain — geste signature", "type": "hook"},
        {"timestamp_s": 134, "description": "Pont visuel — backup dancers", "type": "transition"},
    ],
    "visible_text": "Never Gonna Give You Up",
    "visual_seo_indicators": {
        "hook_strength": "high",
        "thumbnail_clickability": "moderate",
        "watchtime_signals": ["motion", "color_contrast"],
    },
    "summary_visual": "Clip iconique 80s, montage rythmé.",
    "model_used": "mistral-medium-vision-2508",
    "frames_analyzed": 8,
    "frames_downsampled": True,
}


_EXTRAS_SAMPLE = {
    "synthesis": "Vidéo musicale culte des années 80 avec un message d'engagement amoureux.",
    "key_takeaways": [
        "Promesse de fidélité au cœur du refrain",
        "Esthétique 80s très typée",
    ],
    "chapter_themes": [
        {
            "theme": "Introduction visuelle",
            "summary": "Mise en place du décor.",
            "key_points": ["Plan rapproché", "Smoking iconique"],
            "key_quote": {"quote": "Never gonna give you up", "context": "Ouverture du refrain"},
        }
    ],
    "key_quotes": [
        {"quote": "Never gonna give you up", "context": "Refrain"},
        {"quote": "Never gonna let you down", "context": "Refrain (suite)"},
    ],
}


def make_mock_summary(**overrides):
    """Mock minimal d'une row Summary pour le builder/endpoint export."""
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
        "summary_content": "Résumé test.",
        "summary_extras": _EXTRAS_SAMPLE,
        "transcript_context": "Transcript test",
        "lang": "en",
        "mode": "standard",
        "model_used": "mistral-small-2603",
        "platform": "youtube",
        "category": "music",
        "reliability_score": 44,
        "deep_research": False,
        "created_at": datetime(2026, 5, 7, 14, 32, 0),
        "visual_analysis": _VISUAL_SAMPLE,
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
    """App FastAPI avec auth API publique mockée."""
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
# 📥 TESTS — Endpoint GET /api/v1/summaries/{id}/export?format=markdown
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestExportEndpoint:
    """Tests de l'endpoint export — cas owner / non-owner / format invalide."""

    @pytest.mark.asyncio
    async def test_export_returns_markdown(self, client, mock_session):
        """200 + Content-Type text/markdown pour un user owner."""
        summary = make_mock_summary(id=169, user_id=1)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client.get(
            "/api/v1/summaries/169/export?format=markdown",
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 200, resp.text
        ctype = resp.headers.get("content-type", "")
        assert "text/markdown" in ctype, f"unexpected content-type: {ctype}"
        # Charset utf-8 explicite (caractères français + guillemets)
        assert "utf-8" in ctype.lower()
        # Content-Disposition pour download
        cd = resp.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert "deepsight-" in cd
        assert ".md" in cd
        # Body non vide
        assert len(resp.text) > 100

    @pytest.mark.asyncio
    async def test_export_contains_frontmatter(self, client, mock_session):
        """Le markdown commence par `---` et contient les méta canoniques."""
        summary = make_mock_summary(id=169, user_id=1)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client.get(
            "/api/v1/summaries/169/export?format=markdown",
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 200
        body = resp.text
        assert body.startswith("---\n"), "Frontmatter must start with --- + LF"
        assert "source: DeepSight" in body
        assert "video_url: https://www.youtube.com/watch?v=dQw4w9WgXcQ" in body
        assert "deepsight_permalink: https://deepsightsynthesis.com/a/" in body
        assert "deepsight_version:" in body
        # Header source-block présent
        assert "# Rick Astley - Never Gonna Give You Up" in body
        assert "**Source**" in body
        assert "**Permalink**" in body

    @pytest.mark.asyncio
    async def test_export_contains_visual_analysis(self, client, mock_session):
        """La section Visual Analysis est rendue avec timestamps cliquables."""
        summary = make_mock_summary(id=169, user_id=1)

        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client.get(
            "/api/v1/summaries/169/export?format=markdown",
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 200
        body = resp.text
        assert "## Visual Analysis" in body
        # Timestamp cliquable au format `[M:SS](url&t=Ns)`
        # Le sample inclut timestamp_s=17 → `[0:17]`.
        assert "[0:17]" in body or "[0:17] " in body
        # Le link doit contenir &t=17s (vidéo URL déjà avec ?v=)
        assert "t=17s" in body
        # Visual SEO indicators rendu
        assert "Visual SEO indicators" in body
        assert "hook_strength" in body

    @pytest.mark.asyncio
    async def test_export_404_when_summary_belongs_to_another_user(
        self, client, mock_session
    ):
        """404 — le query filtre par user_id donc la row n'est pas retournée.

        Note : le contrat API (cf endpoint /analysis/{id} dans le même router)
        est de retourner 404 et non 403 pour ne pas leak l'existence du summary.
        Le test garantit qu'un user qui n'est pas owner ne peut PAS exporter.
        """
        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client.get(
            "/api/v1/summaries/999/export?format=markdown",
            headers={"X-API-Key": "ds_live_test_dummy"},
        )

        assert resp.status_code == 404, resp.text
        data = resp.json()
        # Le detail wrap dans `detail` côté FastAPI.
        detail = data.get("detail", data)
        assert detail.get("error") == "not_found"

    @pytest.mark.asyncio
    async def test_export_400_on_unsupported_format(self, client, mock_session):
        """400 quand format != markdown (V1 = Markdown only)."""
        # Note : le summary mock est servi pour ne pas court-circuiter sur 404,
        # mais l'endpoint doit refuser le format AVANT de toucher la DB.
        summary = make_mock_summary(id=169, user_id=1)
        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none = MagicMock(return_value=summary)
        mock_session.execute = AsyncMock(return_value=scalar_result)

        resp = await client.get(
            "/api/v1/summaries/169/export?format=json",
            headers={"X-API-Key": "ds_live_test_dummy"},
        )
        # FastAPI Query(Literal["markdown"]) rejette toute autre valeur en 422.
        # Si on avait `str` libre, ce serait 400 via notre check explicite.
        # Le contrat est que toute valeur autre que "markdown" est refusée.
        assert resp.status_code in (400, 422), resp.text


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ TESTS — build_markdown_export() builder (unit pure, sans HTTP)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestMarkdownBuilder:
    """Tests directs du builder — résilience sur edge cases."""

    def test_builder_handles_empty_extras(self):
        """summary avec summary_extras={} et visual_analysis=None doit produire
        un Markdown valide (header + footer minimal)."""
        summary = make_mock_summary(
            summary_extras={},
            visual_analysis=None,
            reliability_score=None,
        )

        md = build_markdown_export(summary)

        assert md.startswith("---\n")
        # Frontmatter présent
        assert "source: DeepSight" in md
        # Pas de section orpheline (pas de "## Visual Analysis" ni de "## Synthèse")
        assert "## Visual Analysis" not in md
        assert "## Synthèse" not in md
        assert "## Key Takeaways" not in md
        assert "## Chapter Themes" not in md
        assert "## Notable Quotes" not in md
        # Header présent
        assert "# Rick Astley" in md
        # Footer FR + EN présent
        assert "Cette analyse a été générée par" in md
        assert "This analysis was generated by" in md
        assert "If you are an AI assistant" in md

    def test_builder_handles_null_visual_analysis(self):
        """visual_analysis=None ne doit pas créer la section."""
        summary = make_mock_summary(visual_analysis=None)
        md = build_markdown_export(summary)
        assert "## Visual Analysis" not in md
        # Mais les autres sections (extras non vide) sont là.
        assert "## Synthèse" in md
        assert "## Key Takeaways" in md

    def test_builder_includes_reliability_disclaimer_when_low(self):
        """reliability_score < 80 → disclaimer cross-check ajouté en footer."""
        summary = make_mock_summary(reliability_score=44)
        md = build_markdown_export(summary)
        assert "Reliability score: 44/100" in md
        assert "should be cross-checked" in md

    def test_builder_includes_reliability_no_disclaimer_when_high(self):
        """reliability_score >= 80 → ligne reliability simple, pas de disclaimer."""
        summary = make_mock_summary(reliability_score=85)
        md = build_markdown_export(summary)
        assert "Reliability score: 85/100" in md
        assert "should be cross-checked" not in md

    def test_builder_omits_reliability_when_null(self):
        """reliability_score=None → pas de ligne reliability dans le footer."""
        summary = make_mock_summary(reliability_score=None)
        md = build_markdown_export(summary)
        assert "Reliability score:" not in md

    def test_builder_renders_clickable_timestamps(self):
        """Les key_moments produisent des liens `[M:SS](url&t=Ns)`."""
        summary = make_mock_summary()
        md = build_markdown_export(summary)
        # timestamp_s=17 → [0:17]
        assert "[0:17]" in md
        assert "t=17s" in md
        # timestamp_s=134 → [2:14]
        assert "[2:14]" in md
        assert "t=134s" in md

    def test_builder_permalink_format(self):
        """Le permalink suit le format `https://deepsightsynthesis.com/a/{slug}`."""
        summary = make_mock_summary(id=169)
        md = build_markdown_export(summary)
        # 169 → hex(169) = "a9" → slug = "aa9"
        assert "deepsight_permalink: https://deepsightsynthesis.com/a/aa9" in md
        # Repris dans le header source-block.
        assert "https://deepsightsynthesis.com/a/aa9" in md

    def test_builder_handles_unknown_duration(self):
        """video_duration=0 → `Unknown` dans frontmatter (bug Phase 0 finding)."""
        summary = make_mock_summary(video_duration=0)
        md = build_markdown_export(summary)
        assert "duration: Unknown" in md
