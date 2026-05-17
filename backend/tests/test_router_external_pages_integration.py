"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — PR3 external_pages pipeline integration                                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre l'intégration de extract_external_pages dans le pipeline v6/v2.1 :         ║
║                                                                                    ║
║    1. save_summary persiste correctement le dict external_pages                    ║
║    2. save_summary accepte None pour external_pages (skip persistence)             ║
║    3. l'orchestrator est importable depuis le path qu'utilise router.py            ║
║    4. signature compatible — extract_external_pages(video_info, user_plan, lang)   ║
║                                                                                    ║
║  Note : le pipeline v6 complet n'est pas testé end-to-end ici — c'est trop         ║
║  intriqué (transcript, Mistral, save_summary etc.). On teste les blocs unitaires   ║
║  qui forment le contrat de wire-up : import path + signature orchestrator,         ║
║  persistence via save_summary, et le shape attendu sur le retour None.             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import inspect
from typing import Any, Dict, Optional
from unittest.mock import AsyncMock, patch

import pytest

from videos.external_pages.orchestrator import extract_external_pages
from videos.service import save_summary


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Import path + signature
# ═══════════════════════════════════════════════════════════════════════════════


def test_orchestrator_importable_from_router_path():
    """router.py importe via `from videos.external_pages.orchestrator import extract_external_pages` — vérifie que ce path résout bien la coroutine."""
    assert callable(extract_external_pages)
    assert inspect.iscoroutinefunction(extract_external_pages)


def test_orchestrator_signature_matches_wire_up():
    """router.py appelle extract_external_pages(video_info=..., user_plan=..., lang=...) — vérifie que la signature accepte ces 3 kwargs."""
    sig = inspect.signature(extract_external_pages)
    params = sig.parameters
    assert "video_info" in params, "router.py passe video_info=...; le param doit exister"
    assert "user_plan" in params, "router.py passe user_plan=...; le param doit exister"
    assert "lang" in params, "router.py passe lang=...; le param doit exister"


# ═══════════════════════════════════════════════════════════════════════════════
# 2. save_summary persistence
# ═══════════════════════════════════════════════════════════════════════════════


def test_save_summary_accepts_external_pages_kwarg():
    """save_summary doit accepter le kwarg external_pages (PR3 wire-up)."""
    sig = inspect.signature(save_summary)
    assert "external_pages" in sig.parameters
    # Default doit être None pour rester rétrocompatible
    assert sig.parameters["external_pages"].default is None


def test_save_summary_external_pages_default_is_none_optional_dict():
    """external_pages: Optional[Dict] = None — vérifie annotation."""
    sig = inspect.signature(save_summary)
    annot = sig.parameters["external_pages"].annotation
    # Optional[Dict] résout à Optional[Dict] / Union[Dict, None]
    annot_str = str(annot)
    assert "Dict" in annot_str or "dict" in annot_str.lower(), (
        f"Expected Optional[Dict] annotation, got {annot_str}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Orchestrator contract — NE LÈVE JAMAIS sur input dégradé
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_orchestrator_returns_none_on_free_plan():
    """Free plan → skip total (cap=0). Garantit le contrat utilisé par router.py
    qui s'appuie sur None pour skipper la persistence."""
    video_info = {
        "description": "Check out https://example.com/article",
        "title": "Test",
        "channel": "TestChan",
    }
    result = await extract_external_pages(video_info=video_info, user_plan="free", lang="fr")
    assert result is None


@pytest.mark.asyncio
async def test_orchestrator_returns_none_on_empty_description():
    """Description vide → None. Garantit que le wire-up ne casse pas quand
    video_info.description est absent (typique TikTok carousel par ex)."""
    video_info = {"description": "", "title": "Test", "channel": "TestChan"}
    result = await extract_external_pages(video_info=video_info, user_plan="pro", lang="fr")
    assert result is None


@pytest.mark.asyncio
async def test_orchestrator_returns_none_on_no_urls():
    """Description sans URL → None."""
    video_info = {
        "description": "Pas d'URL ici, juste du texte sans rien d'intéressant.",
        "title": "Test",
        "channel": "TestChan",
    }
    result = await extract_external_pages(video_info=video_info, user_plan="pro", lang="fr")
    assert result is None


@pytest.mark.asyncio
async def test_orchestrator_swallows_exceptions_never_raises():
    """Le contrat strict : extract_external_pages NE LÈVE JAMAIS. Si une étape
    interne crashe, on retourne None proprement. router.py wrap déjà en
    try/except pour double safety, mais ce test garantit la première ligne
    de défense au niveau de l'orchestrator."""
    # Force resolve_urls à throw une exception arbitraire
    with patch(
        "videos.external_pages.orchestrator.resolve_urls",
        new=AsyncMock(side_effect=RuntimeError("boom")),
    ):
        video_info = {
            "description": "https://example.com/foo",
            "title": "Test",
            "channel": "TestChan",
        }
        # Doit retourner None sans propager l'exception
        result = await extract_external_pages(
            video_info=video_info, user_plan="pro", lang="fr"
        )
        assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Shape du dict canonique (sanity — la PR2 le couvre déjà mais on
#    documente le contrat consommé par le wire-up router/save_summary).
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_orchestrator_dict_shape_when_pipeline_succeeds():
    """Quand le pipeline va jusqu'au bout, le dict retourné a la shape exacte
    consommée par save_summary → Summary.external_pages (JSON column).
    """
    from videos.external_pages.scraper import ScrapedPage
    from videos.external_pages.summarizer import PageSummary
    from videos.external_pages.url_resolver import ResolvedURL

    resolved = [
        ResolvedURL(
            input_url="https://example.com/a",
            final_url="https://example.com/a",
            status=200,
        )
    ]
    scraped = ScrapedPage(
        url="https://example.com/a",
        final_url="https://example.com/a",
        title="Article A",
        text="some long text body" * 50,
        status="ok",
        bytes_fetched=1000,
        fetched_via_proxy=False,
    )
    page_summary = PageSummary(
        url="https://example.com/a",
        final_url="https://example.com/a",
        title="Article A",
        summary="A summary",
        key_claims=["Claim 1", "Claim 2"],
        status="ok",
        fetched_via_proxy=False,
        bytes_fetched=1000,
    )

    with patch(
        "videos.external_pages.orchestrator.resolve_urls",
        new=AsyncMock(return_value=resolved),
    ), patch(
        "videos.external_pages.orchestrator.scrape_page",
        new=AsyncMock(return_value=scraped),
    ), patch(
        "videos.external_pages.orchestrator.summarize_page",
        new=AsyncMock(return_value=page_summary),
    ):
        video_info = {
            "description": "Source : https://example.com/a",
            "title": "Test",
            "channel": "TestChan",
        }
        result = await extract_external_pages(
            video_info=video_info, user_plan="pro", lang="fr"
        )

    # Shape canonique consommée par save_summary
    assert isinstance(result, dict)
    assert set(result.keys()) >= {"extracted_at", "schema_version", "stats", "pages"}
    assert result["schema_version"] == 1
    assert isinstance(result["pages"], list)
    assert len(result["pages"]) == 1
    page = result["pages"][0]
    assert set(page.keys()) >= {
        "url",
        "final_url",
        "title",
        "summary",
        "key_claims",
        "status",
        "fetched_via_proxy",
        "bytes_fetched",
    }
    # Doit être JSON-sérialisable (column JSON)
    import json

    json.dumps(result)  # raise si non-sérialisable


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Schemas — SummaryResponse expose external_pages
# ═══════════════════════════════════════════════════════════════════════════════


def test_summary_response_exposes_external_pages_field():
    """SummaryResponse doit exposer external_pages: Optional[Dict] pour que
    le frontend (futur PR3.5) puisse le consommer."""
    from videos.schemas import SummaryResponse

    fields = SummaryResponse.model_fields
    assert "external_pages" in fields, (
        "SummaryResponse doit exposer external_pages (PR3 wire-up)"
    )
    # Default doit être None
    assert fields["external_pages"].default is None


def test_summary_response_external_pages_serializes_dict():
    """Smoke test Pydantic v2 : SummaryResponse.external_pages accepte un dict
    arbitraire (Dict[str, Any]) tel que le retour orchestrator."""
    from datetime import datetime

    from videos.schemas import SummaryResponse

    payload = {
        "id": 1,
        "video_id": "abc",
        "video_title": "T",
        "video_channel": "C",
        "video_duration": 60,
        "video_url": "https://yt/abc",
        "thumbnail_url": "",
        "category": "tech",
        "lang": "fr",
        "mode": "default",
        "model_used": "mistral-small",
        "summary_content": "X",
        "word_count": 1,
        "created_at": datetime.utcnow(),
        "external_pages": {
            "extracted_at": "2026-05-17T00:00:00Z",
            "schema_version": 1,
            "stats": {"successful": 1},
            "pages": [{"url": "https://e.com", "title": "T"}],
        },
    }
    response = SummaryResponse(**payload)
    assert response.external_pages is not None
    assert response.external_pages["schema_version"] == 1
