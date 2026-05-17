"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — videos.external_pages.orchestrator                                     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║    - free plan → None                                                              ║
║    - description vide → None                                                       ║
║    - aucune URL extraite → None                                                    ║
║    - pro plan cape à 5 URLs                                                        ║
║    - expert plan cape à 10 URLs                                                    ║
║    - Semaphore : pas plus de SCRAPE_CONCURRENCY scrapes en flight                  ║
║    - exception dans 1 scrape n'affecte pas le batch                                ║
║    - dict final shape conforme spec §6                                             ║
║                                                                                    ║
║  Stratégie : mock scrape_page / summarize_page / resolve_urls.                     ║
║              Inputs = video_info dict minimal.                                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
from typing import List
from unittest.mock import AsyncMock, patch

import pytest

from videos.external_pages.orchestrator import (
    SCHEMA_VERSION,
    SCRAPE_CONCURRENCY,
    extract_external_pages,
)
from videos.external_pages.scraper import ScrapedPage
from videos.external_pages.summarizer import PageSummary
from videos.external_pages.url_resolver import ResolvedURL


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _make_video_info(*, n_urls: int = 7) -> dict:
    """Construit une description avec n_urls liens distincts."""
    base = "Cette vidéo parle de plein de choses.\n\n"
    links = "\n".join(
        f"Ref {i}: https://site{i}.com/article-{i}" for i in range(n_urls)
    )
    return {
        "description": base + links,
        "title": "Ma super vidéo",
        "channel": "ChannelName",
        "channel_url": "https://www.youtube.com/@MyChannel",
    }


def _make_resolved(n: int) -> List[ResolvedURL]:
    """Liste de n ResolvedURL distincts."""
    return [
        ResolvedURL(
            input_url=f"https://site{i}.com/article-{i}",
            final_url=f"https://site{i}.com/article-{i}",
            status=200,
        )
        for i in range(n)
    ]


def _make_scraped(url: str) -> ScrapedPage:
    return ScrapedPage(
        url=url,
        final_url=url,
        title="Titre",
        text="Texte readable. " * 50,
        status="ok",
        bytes_fetched=10_000,
        fetched_via_proxy=False,
    )


def _make_summary(url: str, *, status: str = "ok") -> PageSummary:
    return PageSummary(
        url=url,
        final_url=url,
        title="Titre",
        summary="Résumé en français.",
        key_claims=["Claim 1", "Claim 2"],
        status=status,
        fetched_via_proxy=False,
        bytes_fetched=10_000,
        cached=False,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Plan gating + early returns
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.unit
class TestPlanGating:
    async def test_free_plan_returns_none(self):
        video_info = _make_video_info(n_urls=3)
        result = await extract_external_pages(video_info, user_plan="free")
        assert result is None

    async def test_unknown_plan_falls_back_to_free(self):
        video_info = _make_video_info(n_urls=3)
        result = await extract_external_pages(video_info, user_plan="enterprise")
        assert result is None

    async def test_empty_description_returns_none(self):
        result = await extract_external_pages(
            {"description": "", "title": "X"},
            user_plan="pro",
        )
        assert result is None

    async def test_description_with_no_urls_returns_none(self):
        result = await extract_external_pages(
            {"description": "Aucune URL ici, juste du texte.", "title": "X"},
            user_plan="pro",
        )
        assert result is None

    async def test_resolve_returns_empty_returns_none(self):
        """Si resolve_urls renvoie [], le pipeline doit s'arrêter."""
        video_info = _make_video_info(n_urls=3)
        with patch(
            "videos.external_pages.orchestrator.resolve_urls",
            new=AsyncMock(return_value=[]),
        ):
            result = await extract_external_pages(video_info, user_plan="pro")
        assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Plan caps
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.unit
class TestPlanCaps:
    async def test_pro_caps_at_5(self):
        """7 URLs résolues + pro → on scrape exactement 5."""
        video_info = _make_video_info(n_urls=7)
        resolved = _make_resolved(7)

        scrape_calls: List[str] = []

        async def fake_scrape(input_url, final_url):
            scrape_calls.append(final_url)
            return _make_scraped(final_url)

        async def fake_summarize(scraped, *, plan, creator_channel, video_title, lang):
            return _make_summary(scraped.final_url)

        with patch(
            "videos.external_pages.orchestrator.resolve_urls",
            new=AsyncMock(return_value=resolved),
        ), patch(
            "videos.external_pages.orchestrator.scrape_page",
            new=fake_scrape,
        ), patch(
            "videos.external_pages.orchestrator.summarize_page",
            new=fake_summarize,
        ):
            result = await extract_external_pages(video_info, user_plan="pro")

        assert result is not None
        assert len(scrape_calls) == 5
        assert len(result["pages"]) == 5
        assert result["stats"]["after_cap"] == 5

    async def test_expert_caps_at_10(self):
        """15 URLs résolues + expert → on scrape exactement 10."""
        video_info = _make_video_info(n_urls=15)
        resolved = _make_resolved(15)

        scrape_calls: List[str] = []

        async def fake_scrape(input_url, final_url):
            scrape_calls.append(final_url)
            return _make_scraped(final_url)

        async def fake_summarize(scraped, *, plan, creator_channel, video_title, lang):
            return _make_summary(scraped.final_url)

        with patch(
            "videos.external_pages.orchestrator.resolve_urls",
            new=AsyncMock(return_value=resolved),
        ), patch(
            "videos.external_pages.orchestrator.scrape_page",
            new=fake_scrape,
        ), patch(
            "videos.external_pages.orchestrator.summarize_page",
            new=fake_summarize,
        ):
            result = await extract_external_pages(video_info, user_plan="expert")

        assert result is not None
        assert len(scrape_calls) == 10
        assert len(result["pages"]) == 10
        assert result["stats"]["after_cap"] == 10


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Concurrency : Semaphore=5 cap
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.unit
class TestConcurrency:
    async def test_scrape_semaphore_limits_in_flight(self):
        """Pas plus de SCRAPE_CONCURRENCY scrapes simultanés."""
        video_info = _make_video_info(n_urls=10)
        resolved = _make_resolved(10)

        max_in_flight = 0
        current_in_flight = 0
        lock = asyncio.Lock()

        async def fake_scrape(input_url, final_url):
            nonlocal max_in_flight, current_in_flight
            async with lock:
                current_in_flight += 1
                max_in_flight = max(max_in_flight, current_in_flight)
            # Simule un peu d'I/O pour laisser d'autres tasks s'enchaîner
            await asyncio.sleep(0.01)
            async with lock:
                current_in_flight -= 1
            return _make_scraped(final_url)

        async def fake_summarize(scraped, *, plan, creator_channel, video_title, lang):
            return _make_summary(scraped.final_url)

        with patch(
            "videos.external_pages.orchestrator.resolve_urls",
            new=AsyncMock(return_value=resolved),
        ), patch(
            "videos.external_pages.orchestrator.scrape_page",
            new=fake_scrape,
        ), patch(
            "videos.external_pages.orchestrator.summarize_page",
            new=fake_summarize,
        ):
            result = await extract_external_pages(video_info, user_plan="expert")

        assert result is not None
        assert max_in_flight <= SCRAPE_CONCURRENCY


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Exception isolation
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.unit
class TestExceptionIsolation:
    async def test_one_scrape_exception_does_not_kill_batch(self):
        """Si 1 scrape lève, les autres doivent aboutir."""
        video_info = _make_video_info(n_urls=5)
        resolved = _make_resolved(5)

        call_idx = {"i": 0}

        async def fake_scrape(input_url, final_url):
            i = call_idx["i"]
            call_idx["i"] += 1
            if i == 2:
                raise RuntimeError("Boom on index 2")
            return _make_scraped(final_url)

        async def fake_summarize(scraped, *, plan, creator_channel, video_title, lang):
            return _make_summary(scraped.final_url)

        with patch(
            "videos.external_pages.orchestrator.resolve_urls",
            new=AsyncMock(return_value=resolved),
        ), patch(
            "videos.external_pages.orchestrator.scrape_page",
            new=fake_scrape,
        ), patch(
            "videos.external_pages.orchestrator.summarize_page",
            new=fake_summarize,
        ):
            result = await extract_external_pages(video_info, user_plan="pro")

        assert result is not None
        # 5 candidats, 1 a échoué → 4 PageSummary
        assert len(result["pages"]) == 4

    async def test_one_summarize_exception_does_not_kill_batch(self):
        """Si 1 summarize lève, les autres doivent aboutir."""
        video_info = _make_video_info(n_urls=4)
        resolved = _make_resolved(4)

        async def fake_scrape(input_url, final_url):
            return _make_scraped(final_url)

        call_idx = {"i": 0}

        async def fake_summarize(scraped, *, plan, creator_channel, video_title, lang):
            i = call_idx["i"]
            call_idx["i"] += 1
            if i == 1:
                raise RuntimeError("Mistral exploded")
            return _make_summary(scraped.final_url)

        with patch(
            "videos.external_pages.orchestrator.resolve_urls",
            new=AsyncMock(return_value=resolved),
        ), patch(
            "videos.external_pages.orchestrator.scrape_page",
            new=fake_scrape,
        ), patch(
            "videos.external_pages.orchestrator.summarize_page",
            new=fake_summarize,
        ):
            result = await extract_external_pages(video_info, user_plan="pro")

        assert result is not None
        # 4 candidats, 1 summary a échoué → 3 dans pages
        assert len(result["pages"]) == 3


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Output dict structure (spec §6)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.unit
class TestOutputStructure:
    async def test_final_dict_shape(self):
        video_info = _make_video_info(n_urls=3)
        resolved = _make_resolved(3)

        async def fake_scrape(input_url, final_url):
            return _make_scraped(final_url)

        async def fake_summarize(scraped, *, plan, creator_channel, video_title, lang):
            return _make_summary(scraped.final_url)

        with patch(
            "videos.external_pages.orchestrator.resolve_urls",
            new=AsyncMock(return_value=resolved),
        ), patch(
            "videos.external_pages.orchestrator.scrape_page",
            new=fake_scrape,
        ), patch(
            "videos.external_pages.orchestrator.summarize_page",
            new=fake_summarize,
        ):
            result = await extract_external_pages(video_info, user_plan="pro")

        assert result is not None
        # Top-level
        assert "extracted_at" in result
        assert isinstance(result["extracted_at"], str)
        assert result["schema_version"] == SCHEMA_VERSION
        assert "stats" in result
        assert "pages" in result

        # Stats keys
        stats = result["stats"]
        for key in (
            "candidates_found",
            "after_dedup",
            "after_blacklist",
            "after_cap",
            "successful",
            "paywalled",
            "errored",
        ):
            assert key in stats, f"missing stat: {key}"

        # Page entry shape (spec §6)
        page = result["pages"][0]
        for key in (
            "url",
            "final_url",
            "title",
            "summary",
            "key_claims",
            "status",
            "fetched_via_proxy",
            "bytes_fetched",
        ):
            assert key in page, f"missing page key: {key}"
        assert isinstance(page["key_claims"], list)
        assert isinstance(page["fetched_via_proxy"], bool)
        assert isinstance(page["bytes_fetched"], int)

        assert stats["successful"] == 3
        assert stats["paywalled"] == 0
        assert stats["errored"] == 0

    async def test_stats_count_paywalled_and_errored(self):
        """3 ok + 1 paywall + 1 error → stats reflètent."""
        video_info = _make_video_info(n_urls=5)
        resolved = _make_resolved(5)

        statuses = ["ok", "ok", "paywall", "error", "ok"]
        idx = {"i": 0}

        async def fake_scrape(input_url, final_url):
            return _make_scraped(final_url)

        async def fake_summarize(scraped, *, plan, creator_channel, video_title, lang):
            i = idx["i"]
            idx["i"] += 1
            return _make_summary(scraped.final_url, status=statuses[i])

        with patch(
            "videos.external_pages.orchestrator.resolve_urls",
            new=AsyncMock(return_value=resolved),
        ), patch(
            "videos.external_pages.orchestrator.scrape_page",
            new=fake_scrape,
        ), patch(
            "videos.external_pages.orchestrator.summarize_page",
            new=fake_summarize,
        ):
            result = await extract_external_pages(video_info, user_plan="pro")

        assert result is not None
        stats = result["stats"]
        assert stats["successful"] == 3
        assert stats["paywalled"] == 1
        assert stats["errored"] == 1
