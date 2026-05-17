"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — videos.external_pages.summarizer                                       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║    - _cache_key : déterministe + bon préfixe                                       ║
║    - summarize_page :                                                              ║
║        * pass-through si scraped.status != "ok" (paywall, empty, timeout)          ║
║        * pass-through si scraped.text vide                                         ║
║        * cache hit → ne pas appeler Mistral                                        ║
║        * cache miss → appel Mistral, parse JSON, set cache                         ║
║        * JSON invalide → degraded summary (no cache set)                           ║
║        * Mistral exception → status="error"                                        ║
║    - _normalize_plan : free/pro/expert/legacy                                      ║
║                                                                                    ║
║  Stratégie : tout mocké (cache_service.get/set, llm_complete).                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
from unittest.mock import AsyncMock, patch

import pytest

from videos.external_pages.scraper import ScrapedPage
from videos.external_pages.summarizer import (
    CACHE_PREFIX,
    PageSummary,
    _cache_key,
    _normalize_plan,
    summarize_page,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 _cache_key
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestCacheKey:
    def test_deterministic(self):
        k1 = _cache_key("https://example.com/article")
        k2 = _cache_key("https://example.com/article")
        assert k1 == k2

    def test_prefix(self):
        k = _cache_key("https://example.com")
        assert k.startswith(CACHE_PREFIX)

    def test_different_urls_different_keys(self):
        k1 = _cache_key("https://a.com")
        k2 = _cache_key("https://b.com")
        assert k1 != k2


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 _normalize_plan
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestNormalizePlan:
    def test_free(self):
        assert _normalize_plan("free") == "free"

    def test_pro(self):
        assert _normalize_plan("pro") == "pro"

    def test_expert(self):
        assert _normalize_plan("expert") == "expert"

    def test_legacy_plus_aliased(self):
        assert _normalize_plan("plus") == "pro"

    def test_unknown_falls_back_to_free(self):
        assert _normalize_plan("enterprise") == "free"

    def test_none_falls_back_to_free(self):
        assert _normalize_plan(None) == "free"

    def test_uppercase(self):
        assert _normalize_plan("PRO") == "pro"


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 summarize_page
# ═══════════════════════════════════════════════════════════════════════════════


def _make_scraped(*, status: str = "ok", text: str = "A " * 500) -> ScrapedPage:
    """Builder ScrapedPage avec defaults raisonnables."""
    return ScrapedPage(
        url="https://example.com",
        final_url="https://example.com",
        title="Test Page",
        text=text if status == "ok" else None,
        status=status,
        bytes_fetched=2000,
        fetched_via_proxy=False,
        content_type="text/html",
        http_status=200,
    )


@pytest.mark.asyncio
@pytest.mark.unit
class TestSummarizePage:
    """Tous les tests mockent cache_service + llm_complete."""

    async def test_passthrough_paywall_status(self):
        """scraped.status='paywall' → pas d'appel Mistral, pas de cache set."""
        scraped = _make_scraped(status="paywall")
        with patch(
            "videos.external_pages.summarizer.cache_service"
        ) as mock_cache, patch(
            "videos.external_pages.summarizer.llm_complete",
            new=AsyncMock(),
        ) as mock_llm:
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock()
            result = await summarize_page(scraped, plan="pro")
        assert result.status == "paywall"
        assert result.summary is None
        assert result.key_claims == []
        mock_llm.assert_not_called()
        mock_cache.set.assert_not_called()

    async def test_passthrough_empty_text(self):
        """scraped.status='ok' mais text=None → passthrough."""
        scraped = ScrapedPage(
            url="https://example.com",
            final_url="https://example.com",
            title="X",
            text=None,
            status="ok",
            bytes_fetched=100,
            fetched_via_proxy=False,
        )
        with patch(
            "videos.external_pages.summarizer.cache_service"
        ) as mock_cache, patch(
            "videos.external_pages.summarizer.llm_complete",
            new=AsyncMock(),
        ) as mock_llm:
            mock_cache.get = AsyncMock(return_value=None)
            result = await summarize_page(scraped, plan="pro")
        mock_llm.assert_not_called()

    async def test_cache_hit_skips_mistral(self):
        """Cache HIT → retourne données du cache, pas d'appel Mistral."""
        scraped = _make_scraped()
        cached_payload = json.dumps(
            {
                "title": "Cached Title",
                "summary": "Cached summary content.",
                "key_claims": ["cached claim 1", "cached claim 2"],
            }
        )
        with patch(
            "videos.external_pages.summarizer.cache_service"
        ) as mock_cache, patch(
            "videos.external_pages.summarizer.llm_complete",
            new=AsyncMock(),
        ) as mock_llm:
            mock_cache.get = AsyncMock(return_value=cached_payload)
            mock_cache.set = AsyncMock()
            result = await summarize_page(scraped, plan="pro")
        assert result.cached is True
        assert result.summary == "Cached summary content."
        assert result.key_claims == ["cached claim 1", "cached claim 2"]
        assert result.title == "Cached Title"
        assert result.status == "ok"
        mock_llm.assert_not_called()
        mock_cache.set.assert_not_called()

    async def test_cache_miss_calls_mistral_and_sets_cache(self):
        """Cache MISS → appel Mistral, parse JSON, set cache."""
        scraped = _make_scraped()
        fake_llm_result = type(
            "R",
            (),
            {
                "content": json.dumps(
                    {
                        "summary": "Une synthèse de la page en deux phrases.",
                        "key_claims": ["claim A", "claim B", "claim C"],
                    }
                )
            },
        )()

        with patch(
            "videos.external_pages.summarizer.cache_service"
        ) as mock_cache, patch(
            "videos.external_pages.summarizer.llm_complete",
            new=AsyncMock(return_value=fake_llm_result),
        ) as mock_llm:
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock(return_value=True)
            result = await summarize_page(
                scraped,
                plan="pro",
                creator_channel="MyChannel",
                video_title="My Video",
            )
        assert result.status == "ok"
        assert result.cached is False
        assert result.summary == "Une synthèse de la page en deux phrases."
        assert result.key_claims == ["claim A", "claim B", "claim C"]
        # Mistral a été appelé
        assert mock_llm.called
        # Cache set a bien eu lieu
        assert mock_cache.set.called

    async def test_json_invalid_returns_degraded(self):
        """Mistral renvoie texte non-JSON → degraded (raw tronqué) no cache."""
        scraped = _make_scraped()
        fake_llm_result = type("R", (), {"content": "Désolé je n'ai pas compris."})()

        with patch(
            "videos.external_pages.summarizer.cache_service"
        ) as mock_cache, patch(
            "videos.external_pages.summarizer.llm_complete",
            new=AsyncMock(return_value=fake_llm_result),
        ):
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock()
            result = await summarize_page(scraped, plan="pro")
        # On a un summary (degraded) mais pas de key_claims
        assert result.summary is not None
        assert "Désolé" in result.summary
        assert result.key_claims == []
        # Pas de cache set sur degraded
        mock_cache.set.assert_not_called()

    async def test_mistral_exception_returns_error_status(self):
        """llm_complete lève → status='error'."""
        scraped = _make_scraped()

        async def raise_runtime(**_kwargs):
            raise RuntimeError("Mistral 429")

        with patch(
            "videos.external_pages.summarizer.cache_service"
        ) as mock_cache, patch(
            "videos.external_pages.summarizer.llm_complete",
            new=raise_runtime,
        ):
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock()
            result = await summarize_page(scraped, plan="pro")
        assert result.status == "error"
        assert result.summary is None
        mock_cache.set.assert_not_called()

    async def test_mistral_returns_none_content(self):
        """llm_complete renvoie objet sans content → status='error'."""
        scraped = _make_scraped()
        fake = type("R", (), {"content": ""})()

        with patch(
            "videos.external_pages.summarizer.cache_service"
        ) as mock_cache, patch(
            "videos.external_pages.summarizer.llm_complete",
            new=AsyncMock(return_value=fake),
        ):
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock()
            result = await summarize_page(scraped, plan="pro")
        assert result.status == "error"
        mock_cache.set.assert_not_called()
