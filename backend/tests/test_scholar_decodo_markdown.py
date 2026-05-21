"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Scholar Phase 1.2 — Decodo Scraping API + Mistral markdown extract     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Spec source : `01-Projects/DeepSight/Ideas/2026-05-21-decodo-scraping-phase1-     ║
║  quick-wins.md` § 5.7                                                              ║
║                                                                                    ║
║  Couvre :                                                                          ║
║  • Unit : `parse_scholar_markdown_via_mistral` happy fixture → ≥5 papers           ║
║  • Unit : `parse_scholar_markdown_via_mistral` empty fixture → []                  ║
║  • Unit : `parse_scholar_markdown_via_mistral` captcha guard → [] sans Mistral     ║
║  • Integration : `search_scholar` happy (mock Decodo + mock Mistral) → batch       ║
║  • Integration : `search_scholar` Decodo retourne empty → empty batch + CB fail    ║
║  • Integration : `search_scholar` cache HIT → court-circuit (pas d'appel Decodo)   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SRC = os.path.abspath(os.path.join(_HERE, "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from academic import scholar  # noqa: E402

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "scholar")


def _read_fixture(name: str) -> str:
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8") as f:
        return f.read()


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_scholar_state():
    scholar._reset_state_for_tests()
    yield
    scholar._reset_state_for_tests()


@pytest.fixture(autouse=True)
def _fast_interval(monkeypatch):
    """Shrink rate-limit interval so tests don't sleep 2s each."""
    monkeypatch.setattr(scholar, "SCHOLAR_RATE_INTERVAL", 0.0)


@pytest.fixture(autouse=True)
def _no_proxy_telemetry(monkeypatch):
    """Disable telemetry side-effects (no DB session in tests)."""
    monkeypatch.setattr(
        "academic.scholar.record_proxy_usage",
        AsyncMock(return_value=None),
    )


def _make_decodo_client(
    *,
    markdown: str,
    target_status: int = 200,
    raises: Exception | None = None,
):
    """Build a fake DecodoScrapingClient whose .scrape() returns ScrapeResult or raises.

    Returns a tuple (client_cls_factory, scrape_mock).
    """
    if raises is not None:
        scrape_mock = AsyncMock(side_effect=raises)
    else:
        # Build a minimal ScrapeResult-like object — duck-typed.
        result = MagicMock()
        result.content = markdown
        result.status_code = target_status
        scrape_mock = AsyncMock(return_value=result)

    client_instance = MagicMock()
    client_instance.scrape = scrape_mock

    def _factory(*args, **kwargs):
        return client_instance

    return _factory, scrape_mock


# ═════════════════════════════════════════════════════════════════════════════
# UNIT 1 — parse_scholar_markdown_via_mistral happy path
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_parse_markdown_happy_returns_papers(monkeypatch):
    """Fixture markdown transformer + Mistral mock → ≥5 ScholarPaper instances."""
    md = _read_fixture("decodo_markdown_transformer.md")
    assert len(md) > scholar.SCHOLAR_MIN_MARKDOWN_BYTES

    # Mock Mistral response — schéma JSON strict, retourne 6 papers.
    mistral_papers = {
        "papers": [
            {
                "title": "Attention is all you need",
                "authors": ["A Vaswani", "N Shazeer", "N Parmar"],
                "year": 2017,
                "venue": "NeurIPS",
                "abstract": "We propose a new simple network architecture...",
                "url": "https://arxiv.org/abs/1706.03762",
                "pdf_url": "https://arxiv.org/pdf/1706.03762",
                "citation_count": 150000,
            },
            {
                "title": "Transformer in transformer",
                "authors": ["K Han", "A Xiao"],
                "year": 2021,
                "venue": "NeurIPS",
                "abstract": "Transformers with high performance...",
                "url": "https://proceedings.neurips.cc/paper/2021/hash/x",
                "pdf_url": None,
                "citation_count": 2940,
            },
            {
                "title": "Transformer for graphs: An overview from architecture perspective",
                "authors": ["E Min", "R Chen", "Y Bian"],
                "year": 2022,
                "venue": "arXiv preprint arXiv:2202.08455",
                "abstract": "For these Transformer variants...",
                "url": "https://arxiv.org/abs/2202.08455",
                "pdf_url": "https://arxiv.org/pdf/2202.08455",
                "citation_count": 333,
            },
            {
                "title": "On limitations of the transformer architecture",
                "authors": ["B Peng", "S Narayanan"],
                "year": 2024,
                "venue": "First conference on language modeling",
                "abstract": "That humans have little difficulty composing...",
                "url": "https://openreview.net/forum?id=KidynPuLNW",
                "pdf_url": "https://openreview.net/pdf?id=KidynPuLNW",
                "citation_count": 105,
            },
            {
                "title": "Vision transformer",
                "authors": ["A Dosovitskiy"],
                "year": 2020,
                "venue": "ICLR",
                "abstract": "We present...",
                "url": None,
                "pdf_url": None,
                "citation_count": 50000,
            },
            {
                "title": "BERT: Pre-training of deep bidirectional transformers",
                "authors": ["J Devlin"],
                "year": 2019,
                "venue": "NAACL",
                "abstract": None,
                "url": None,
                "pdf_url": None,
                "citation_count": 80000,
            },
        ]
    }

    monkeypatch.setattr(
        "academic.scholar.mistral_extract_json",
        AsyncMock(return_value=mistral_papers),
        raising=False,
    )
    # Also patch via the import path used inside the function (lazy import).
    with patch("core.llm_provider.mistral_extract_json", AsyncMock(return_value=mistral_papers)):
        papers = await scholar.parse_scholar_markdown_via_mistral(md, "transformer architecture", limit=20)

    assert len(papers) >= 5
    titles = [p.title for p in papers]
    assert any("attention" in t.lower() for t in titles)
    # Schema enforcement
    for p in papers:
        assert isinstance(p, scholar.ScholarPaper)
        assert p.title
        assert isinstance(p.authors, list)
        assert isinstance(p.citation_count, int)


# ═════════════════════════════════════════════════════════════════════════════
# UNIT 2 — empty input / empty result paths
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_parse_markdown_empty_input_returns_empty_list():
    """md_text vide ou trop court → [] sans appel Mistral."""
    papers = await scholar.parse_scholar_markdown_via_mistral("", "anything", limit=10)
    assert papers == []
    papers2 = await scholar.parse_scholar_markdown_via_mistral("x" * 100, "anything", limit=10)
    assert papers2 == []


@pytest.mark.asyncio
async def test_parse_markdown_empty_fixture_no_results():
    """Fixture markdown empty-query (xqz...) — Mistral retourne papers=[] → []"""
    md = _read_fixture("decodo_markdown_empty.md")
    # La fixture vide est < SCHOLAR_MIN_MARKDOWN_BYTES (~4.3KB) — guard pré-Mistral.
    # On force le guard pour valider — sinon on aurait court-circuité.
    with patch("core.llm_provider.mistral_extract_json", AsyncMock(return_value={"papers": []})):
        papers = await scholar.parse_scholar_markdown_via_mistral(md, "xqz12345", limit=10)
    assert papers == []


# ═════════════════════════════════════════════════════════════════════════════
# UNIT 3 — CAPTCHA guard short-circuits Mistral
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_parse_markdown_captcha_guard_skips_mistral():
    """Markdown contenant 'captcha' → [] sans appeler Mistral."""
    fake_md = "# Header\n\nLorem ipsum " * 200 + " unusual traffic from your computer network "
    assert len(fake_md) > scholar.SCHOLAR_MIN_MARKDOWN_BYTES

    mistral_mock = AsyncMock(return_value={"papers": [{"title": "should-not-appear"}]})
    with patch("core.llm_provider.mistral_extract_json", mistral_mock):
        papers = await scholar.parse_scholar_markdown_via_mistral(fake_md, "anything", limit=10)

    assert papers == []
    mistral_mock.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════════
# INTEGRATION 1 — search_scholar happy path (Decodo OK + Mistral OK)
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_search_scholar_happy_decodo_plus_mistral(redis_client_fixture, monkeypatch):
    """search_scholar end-to-end avec mocks Decodo + Mistral → batch valid."""
    await scholar.init_scholar_redis(redis_client_fixture)

    md = _read_fixture("decodo_markdown_transformer.md")
    factory, scrape_mock = _make_decodo_client(markdown=md)
    monkeypatch.setattr("decodo.DecodoScrapingClient", factory)
    monkeypatch.setattr(
        "academic.scholar.should_bypass_proxy_async",
        AsyncMock(return_value=False),
    )

    fake_papers = {
        "papers": [
            {"title": f"Paper {i}", "authors": [f"Author{i}"], "year": 2020 + i, "citation_count": i * 10}
            for i in range(7)
        ]
    }
    with patch("core.llm_provider.mistral_extract_json", AsyncMock(return_value=fake_papers)):
        batch = await scholar.search_scholar("transformer architecture", limit=20)

    assert batch.query == "transformer architecture"
    assert batch.raw_html_size == len(md)
    assert len(batch.papers) == 7
    scrape_mock.assert_called_once()
    called_kwargs = scrape_mock.call_args.kwargs
    assert called_kwargs.get("proxy_pool") == "premium"
    assert called_kwargs.get("headless") is True
    assert called_kwargs.get("output_format") == "markdown"


# ═════════════════════════════════════════════════════════════════════════════
# INTEGRATION 2 — Decodo returns empty markdown → empty batch + CB fail counter
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_search_scholar_decodo_empty_records_failure(redis_client_fixture, monkeypatch):
    """Decodo retourne markdown trop court → empty batch + CB counter incrementé."""
    await scholar.init_scholar_redis(redis_client_fixture)

    factory, scrape_mock = _make_decodo_client(markdown="")
    monkeypatch.setattr("decodo.DecodoScrapingClient", factory)
    monkeypatch.setattr(
        "academic.scholar.should_bypass_proxy_async",
        AsyncMock(return_value=False),
    )

    batch = await scholar.search_scholar("anything", limit=20)

    assert batch.papers == []
    assert batch.raw_html_size == 0
    scrape_mock.assert_called_once()

    # CB counter should be at 1 (one markdown_too_short failure).
    raw = await redis_client_fixture.get(scholar.SCHOLAR_CB_FAIL_KEY)
    assert raw is not None
    assert int(raw) == 1


# ═════════════════════════════════════════════════════════════════════════════
# INTEGRATION 3 — Cache HIT bypasses Decodo + Mistral
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_search_scholar_cache_hit_skips_decodo(redis_client_fixture, monkeypatch):
    """2e appel mêmes query : doit servir depuis Redis cache, sans toucher Decodo."""
    await scholar.init_scholar_redis(redis_client_fixture)

    md = _read_fixture("decodo_markdown_transformer.md")
    factory, scrape_mock = _make_decodo_client(markdown=md)
    monkeypatch.setattr("decodo.DecodoScrapingClient", factory)
    monkeypatch.setattr(
        "academic.scholar.should_bypass_proxy_async",
        AsyncMock(return_value=False),
    )

    fake_papers = {
        "papers": [
            {"title": "Paper A", "authors": ["X"], "year": 2020, "citation_count": 50},
            {"title": "Paper B", "authors": ["Y"], "year": 2021, "citation_count": 80},
        ]
    }
    with patch("core.llm_provider.mistral_extract_json", AsyncMock(return_value=fake_papers)):
        batch1 = await scholar.search_scholar("quantum", limit=20)
        assert len(batch1.papers) == 2
        assert scrape_mock.call_count == 1

        # 2e call : doit hit le cache, pas de nouveau Decodo call ni Mistral.
        batch2 = await scholar.search_scholar("quantum", limit=20)
        assert len(batch2.papers) == 2
        assert scrape_mock.call_count == 1, (
            f"second call should be cache HIT but Decodo was called again: {scrape_mock.call_count}"
        )
