"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Scholar end-to-end search (PR1 / spec §5.1, §4.6, §4.5, §8)            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  ⚠️  OBSOLETE après Phase 1.2 Decodo Scraping migration (PR #535) :                ║
║      - get_proxied_client + httpx flow → remplacé par DecodoScrapingClient         ║
║      - HTML SERP parsing → remplacé par Markdown extraction via Mistral            ║
║      - should_bypass_proxy_async hard-stop → géré côté DecodoScrapingClient.scrape ║
║      Coverage des scénarios valables migrée vers test_scholar_decodo_markdown.py.  ║
║      File skipped pour ne pas bloquer CI. TODO: supprimer après audit coverage.    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytestmark = pytest.mark.skip(
    reason="Obsolete after Phase 1.2 Decodo migration (PR #535) — "
    "coverage moved to test_scholar_decodo_markdown.py"
)

_HERE = os.path.dirname(os.path.abspath(__file__))
_SRC = os.path.abspath(os.path.join(_HERE, "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from academic import scholar  # noqa: E402


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "scholar")


def _read_fixture(name: str) -> str:
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture(autouse=True)
def _reset_scholar_state():
    scholar._reset_state_for_tests()
    yield
    scholar._reset_state_for_tests()


@pytest.fixture(autouse=True)
def _fast_interval(monkeypatch):
    """Shrink rate-limit interval so end-to-end tests don't sleep 5s each."""
    monkeypatch.setattr(scholar, "SCHOLAR_RATE_INTERVAL", 0.0)


@pytest.fixture(autouse=True)
def _no_proxy_telemetry(monkeypatch):
    """Disable telemetry side-effects (avoid DB session usage in tests)."""
    monkeypatch.setattr(
        "academic.scholar.record_proxy_usage",
        AsyncMock(return_value=None),
    )


def _make_proxied_client_cm(html: str, status_code: int = 200):
    """Build a context-manager factory that yields a fake httpx.AsyncClient.

    The returned client.get(...) yields a response object whose .text returns
    `html` and .status_code returns `status_code`.
    """
    response = MagicMock()
    response.text = html
    response.status_code = status_code

    client = AsyncMock()
    client.get = AsyncMock(return_value=response)

    @asynccontextmanager
    async def _factory(*args, **kwargs):
        yield client

    return _factory, client


# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_happy_path(redis_client_fixture, monkeypatch):
    """Happy path: proxied GET → 200 + valid SERP → batch with papers."""
    await scholar.init_scholar_redis(redis_client_fixture)

    html = _read_fixture("serp_normal.html")
    factory, client = _make_proxied_client_cm(html, status_code=200)
    monkeypatch.setattr("academic.scholar.get_proxied_client", factory)
    monkeypatch.setattr(
        "academic.scholar.should_bypass_proxy_async",
        AsyncMock(return_value=False),
    )

    batch = await scholar.search_scholar("quantum computing", limit=20)

    # Assertions on batch shape.
    assert batch.query == "quantum computing"
    assert batch.raw_html_size == len(html)
    assert len(batch.papers) == 20
    # And the proxy client was invoked once.
    client.get.assert_called_once()
    called_url = client.get.call_args[0][0]
    assert called_url.startswith(scholar.SCHOLAR_BASE_URL)
    assert "quantum" in called_url.lower()


@pytest.mark.asyncio
async def test_search_circuit_open_returns_empty(redis_client_fixture, monkeypatch):
    """When the CB is open, search_scholar must return an empty batch immediately."""
    await scholar.init_scholar_redis(redis_client_fixture)

    # Force CB open by writing the future open_until key directly.
    import time

    future = time.time() + 3600
    await redis_client_fixture.set(scholar.SCHOLAR_CB_OPEN_KEY, str(future), ex=3600)

    factory, client = _make_proxied_client_cm("garbage")
    monkeypatch.setattr("academic.scholar.get_proxied_client", factory)
    monkeypatch.setattr(
        "academic.scholar.should_bypass_proxy_async",
        AsyncMock(return_value=False),
    )

    batch = await scholar.search_scholar("anything", limit=20)

    assert batch.papers == []
    assert batch.raw_html_size == 0
    client.get.assert_not_called()


@pytest.mark.asyncio
async def test_search_proxy_bypass_returns_empty(redis_client_fixture, monkeypatch):
    """When Decodo hard-stop is active, search returns empty without HTTP fetch."""
    await scholar.init_scholar_redis(redis_client_fixture)

    factory, client = _make_proxied_client_cm("garbage")
    monkeypatch.setattr("academic.scholar.get_proxied_client", factory)
    monkeypatch.setattr(
        "academic.scholar.should_bypass_proxy_async",
        AsyncMock(return_value=True),  # ← hard-stop triggered
    )

    batch = await scholar.search_scholar("anything", limit=20)

    assert batch.papers == []
    assert batch.raw_html_size == 0
    client.get.assert_not_called()


@pytest.mark.asyncio
async def test_search_captcha_records_failure(redis_client_fixture, monkeypatch):
    """CAPTCHA response → record_failure called, batch empty, CB counter incremented."""
    await scholar.init_scholar_redis(redis_client_fixture)

    captcha_html = "garbage " * 1500 + "<title>Sorry...</title>" + "more padding " * 200
    assert len(captcha_html) >= scholar.SCHOLAR_MIN_HTML_BYTES

    factory, client = _make_proxied_client_cm(captcha_html, status_code=200)
    monkeypatch.setattr("academic.scholar.get_proxied_client", factory)
    monkeypatch.setattr(
        "academic.scholar.should_bypass_proxy_async",
        AsyncMock(return_value=False),
    )

    batch = await scholar.search_scholar("anything", limit=20)
    assert batch.papers == []
    assert batch.raw_html_size == len(captcha_html)

    # CB counter should be at 1.
    raw = await redis_client_fixture.get(scholar.SCHOLAR_CB_FAIL_KEY)
    assert raw is not None
    assert int(raw) == 1

    # Reach threshold by failing twice more → CB opens.
    factory2, _ = _make_proxied_client_cm(captcha_html, status_code=200)
    monkeypatch.setattr("academic.scholar.get_proxied_client", factory2)
    await scholar.search_scholar("anything else 1", limit=20)
    await scholar.search_scholar("anything else 2", limit=20)
    assert await scholar.is_circuit_open() is True


@pytest.mark.asyncio
async def test_search_caches_successful_result(redis_client_fixture, monkeypatch):
    """Successful search → cache_set, then second call returns from cache without HTTP."""
    await scholar.init_scholar_redis(redis_client_fixture)

    html = _read_fixture("serp_normal.html")
    factory, client = _make_proxied_client_cm(html, status_code=200)
    monkeypatch.setattr("academic.scholar.get_proxied_client", factory)
    monkeypatch.setattr(
        "academic.scholar.should_bypass_proxy_async",
        AsyncMock(return_value=False),
    )

    # First call: HTTP hit + cache populated.
    batch1 = await scholar.search_scholar("quantum", limit=20)
    assert len(batch1.papers) > 0
    assert client.get.call_count == 1

    # Second call SAME query: should hit cache, no second HTTP call.
    batch2 = await scholar.search_scholar("quantum", limit=20)
    assert len(batch2.papers) == len(batch1.papers)
    assert client.get.call_count == 1, (
        f"second call should be served from cache, but HTTP was invoked again: "
        f"{client.get.call_count}"
    )
