"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Decodo Web Scraping API wrapper (Phase 0)                              ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Coverage:                                                                         ║
║  • cost_estimate_usd matrix (standard/premium × headless False/True)               ║
║  • DecodoScrapingClient.scrape: 200 OK happy path → ScrapeResult populated         ║
║  • Retry: 500 → 500 → 200 succeeds after 3 attempts                                ║
║  • Hard-stop env DECODO_SCRAPING_DISABLED=true → DecodoDisabledError               ║
║  • Hard-stop monthly budget → DecodoBudgetExceededError                            ║
║  • Missing API key → DecodoConfigError                                             ║
║  • Telemetry: row inserted into decodo_scraping_usage on each call                 ║
║  • Payload shape: proxy_pool, headless, output_format                              ║
║  • 4xx (401/403) → no retry, immediate DecodoRequestError                          ║
║  • Malformed response → DecodoResponseError                                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Add src to path (mirror conftest pattern).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_telemetry_state():
    """Reset the in-memory monthly count cache between tests."""
    from decodo.telemetry import _reset_state_for_tests

    _reset_state_for_tests()
    yield
    _reset_state_for_tests()


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """Default env: no kill-switch, no monthly cap, fake API key present."""
    monkeypatch.delenv("DECODO_SCRAPING_DISABLED", raising=False)
    monkeypatch.delenv("DECODO_SCRAPING_MAX_MONTHLY_REQ", raising=False)
    # Force the settings reader to see our test values.
    monkeypatch.setattr(
        "core.config.DECODO_SCRAPING_DISABLED", False, raising=False
    )
    monkeypatch.setattr(
        "core.config.DECODO_SCRAPING_MAX_MONTHLY_REQ", 0, raising=False
    )
    monkeypatch.setattr(
        "core.config.DECODO_SCRAPING_API_KEY",
        "Basic dGVzdHVzZXI6dGVzdHBhc3M=",
        raising=False,
    )
    # Also patch the settings attribute in case clients import via settings.X.
    try:
        from core.config import settings as _s

        monkeypatch.setattr(_s, "DECODO_SCRAPING_DISABLED", False, raising=False)
        monkeypatch.setattr(_s, "DECODO_SCRAPING_MAX_MONTHLY_REQ", 0, raising=False)
        monkeypatch.setattr(
            _s,
            "DECODO_SCRAPING_API_KEY",
            "Basic dGVzdHVzZXI6dGVzdHBhc3M=",
            raising=False,
        )
    except Exception:
        pass
    yield


@pytest.fixture
async def db_session():
    """SQLite async in-memory session with the decodo_scraping_usage table."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE TABLE decodo_scraping_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    url TEXT NOT NULL,
                    proxy_pool TEXT NOT NULL,
                    headless BOOLEAN NOT NULL DEFAULT 0,
                    output_format TEXT NOT NULL,
                    target_status_code INTEGER NULL,
                    decodo_http_status INTEGER NULL,
                    cost_estimate_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
                    duration_s NUMERIC(10,3) NOT NULL DEFAULT 0,
                    error TEXT NULL
                )
                """
            )
        )

    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        yield session

    await engine.dispose()


def _fake_httpx_response(
    *,
    status_code: int = 200,
    body: Any = None,
    raise_timeout: bool = False,
) -> MagicMock:
    """Build a fake httpx.Response. If raise_timeout, the AsyncClient.post
    raises httpx.TimeoutException instead."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = "" if body is None else (body if isinstance(body, str) else "")
    if isinstance(body, dict):
        resp.json = MagicMock(return_value=body)
        resp.text = ""
    elif body is None:
        resp.json = MagicMock(return_value={})
    else:
        resp.json = MagicMock(side_effect=ValueError("not JSON"))
    return resp


def _patch_httpx_post(responses: List[Any], monkeypatch):
    """Patch httpx.AsyncClient.post to return / raise from the `responses` list
    in order, one per call. List items can be:
      • a MagicMock response object → returned
      • an Exception class or instance → raised
    """
    call_idx = {"i": 0}

    async def fake_post(self, url, json=None, headers=None):
        i = call_idx["i"]
        call_idx["i"] += 1
        if i >= len(responses):
            raise AssertionError(
                f"httpx.post called more times ({i + 1}) than fakes provided ({len(responses)})"
            )
        r = responses[i]
        if isinstance(r, Exception):
            raise r
        if isinstance(r, type) and issubclass(r, Exception):
            raise r("fake")
        return r

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return call_idx


# ─────────────────────────────────────────────────────────────────────────────
# Cost matrix
# ─────────────────────────────────────────────────────────────────────────────


class TestCostMatrix:
    @pytest.mark.unit
    def test_cost_standard_no_js(self):
        from decodo.telemetry import cost_estimate_usd

        assert cost_estimate_usd(proxy_pool="standard", headless=False) == 0.00050

    @pytest.mark.unit
    def test_cost_standard_with_js(self):
        from decodo.telemetry import cost_estimate_usd

        assert cost_estimate_usd(proxy_pool="standard", headless=True) == 0.00065

    @pytest.mark.unit
    def test_cost_premium_no_js(self):
        from decodo.telemetry import cost_estimate_usd

        assert cost_estimate_usd(proxy_pool="premium", headless=False) == 0.00090

    @pytest.mark.unit
    def test_cost_premium_with_js(self):
        from decodo.telemetry import cost_estimate_usd

        assert cost_estimate_usd(proxy_pool="premium", headless=True) == 0.00125

    @pytest.mark.unit
    def test_cost_unknown_combo_returns_zero(self):
        """Defensive: unknown pool/headless combos fail open with 0.0."""
        from decodo.telemetry import cost_estimate_usd

        assert cost_estimate_usd(proxy_pool="weird_pool", headless=True) == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Happy path + retry
# ─────────────────────────────────────────────────────────────────────────────


class TestScrapeHappyPath:
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_scrape_returns_scrape_result(self, monkeypatch, db_session):
        """Decodo returns 200 with valid envelope → ScrapeResult populated."""
        from decodo import DecodoScrapingClient

        fake_body = {
            "results": [
                {
                    "status_code": 200,
                    "content": "<html><body>OK</body></html>",
                    "headers": {"Content-Type": "text/html; charset=utf-8"},
                }
            ]
        }
        _patch_httpx_post(
            [_fake_httpx_response(status_code=200, body=fake_body)], monkeypatch
        )

        # Skip sleep in retry path (not actually used here).
        monkeypatch.setattr(
            "decodo.scraping_client.asyncio.sleep", AsyncMock(return_value=None)
        )

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        result = await client.scrape(
            "https://example.com",
            proxy_pool="premium",
            headless=True,
            output_format="raw_html",
        )

        assert result.status_code == 200
        assert result.content == "<html><body>OK</body></html>"
        assert result.headers["content-type"].startswith("text/html")
        assert result.cost_estimate_usd == 0.00125  # premium + js
        assert result.duration_s >= 0
        assert result.proxy_pool == "premium"
        assert result.output_format == "raw_html"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_scrape_retries_on_5xx_then_succeeds(self, monkeypatch, db_session):
        """500 → 500 → 200 succeeds after 3 attempts."""
        from decodo import DecodoScrapingClient

        success_body = {
            "results": [
                {"status_code": 200, "content": "ok", "headers": {}}
            ]
        }
        responses = [
            _fake_httpx_response(status_code=500, body="upstream boom"),
            _fake_httpx_response(status_code=502, body="upstream boom"),
            _fake_httpx_response(status_code=200, body=success_body),
        ]
        call_idx = _patch_httpx_post(responses, monkeypatch)

        # No real sleeping during tests.
        sleep_mock = AsyncMock(return_value=None)
        monkeypatch.setattr("decodo.scraping_client.asyncio.sleep", sleep_mock)

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        result = await client.scrape("https://example.com")

        assert call_idx["i"] == 3
        assert result.status_code == 200
        # 2 backoff sleeps between 3 attempts.
        assert sleep_mock.await_count == 2

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_scrape_4xx_no_retry(self, monkeypatch, db_session):
        """401/403/404 from Decodo bubble up immediately without retry."""
        from decodo import DecodoScrapingClient
        from decodo.errors import DecodoRequestError

        responses = [_fake_httpx_response(status_code=401, body="bad auth")]
        call_idx = _patch_httpx_post(responses, monkeypatch)

        sleep_mock = AsyncMock(return_value=None)
        monkeypatch.setattr("decodo.scraping_client.asyncio.sleep", sleep_mock)

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        with pytest.raises(DecodoRequestError) as exc_info:
            await client.scrape("https://example.com")

        assert exc_info.value.status_code == 401
        assert call_idx["i"] == 1  # No retry on 4xx.
        assert sleep_mock.await_count == 0

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_scrape_timeout_then_succeeds(self, monkeypatch, db_session):
        """Timeout → retry → success."""
        from decodo import DecodoScrapingClient

        success_body = {
            "results": [{"status_code": 200, "content": "ok", "headers": {}}]
        }
        responses = [
            httpx.TimeoutException("first timeout"),
            _fake_httpx_response(status_code=200, body=success_body),
        ]
        _patch_httpx_post(responses, monkeypatch)
        monkeypatch.setattr(
            "decodo.scraping_client.asyncio.sleep", AsyncMock(return_value=None)
        )

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        result = await client.scrape("https://example.com")
        assert result.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_scrape_all_retries_exhausted_raises_last(
        self, monkeypatch, db_session
    ):
        """3 consecutive 5xx → DecodoRequestError raised on last attempt."""
        from decodo import DecodoScrapingClient
        from decodo.errors import DecodoRequestError

        responses = [
            _fake_httpx_response(status_code=503, body="boom"),
            _fake_httpx_response(status_code=503, body="boom"),
            _fake_httpx_response(status_code=503, body="boom"),
        ]
        _patch_httpx_post(responses, monkeypatch)
        monkeypatch.setattr(
            "decodo.scraping_client.asyncio.sleep", AsyncMock(return_value=None)
        )

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        with pytest.raises(DecodoRequestError) as exc_info:
            await client.scrape("https://example.com")
        assert exc_info.value.status_code == 503


# ─────────────────────────────────────────────────────────────────────────────
# Hard-stops
# ─────────────────────────────────────────────────────────────────────────────


class TestHardStops:
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_disabled_env_raises_immediately(self, monkeypatch, db_session):
        """DECODO_SCRAPING_DISABLED=true → DecodoDisabledError, no HTTP."""
        from decodo import DecodoScrapingClient
        from decodo.errors import DecodoDisabledError

        monkeypatch.setenv("DECODO_SCRAPING_DISABLED", "true")
        try:
            from core.config import settings as _s

            monkeypatch.setattr(_s, "DECODO_SCRAPING_DISABLED", True, raising=False)
        except Exception:
            pass

        # Patch httpx.post — should NOT be called.
        post_mock = AsyncMock(side_effect=AssertionError("should not be called"))
        monkeypatch.setattr(httpx.AsyncClient, "post", post_mock)

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        with pytest.raises(DecodoDisabledError):
            await client.scrape("https://example.com")

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_monthly_budget_exceeded(self, monkeypatch, db_session):
        """Monthly count >= max → DecodoBudgetExceededError, no HTTP."""
        from decodo import DecodoScrapingClient
        from decodo.errors import DecodoBudgetExceededError

        # Override the env reader directly — bypasses settings caching issues.
        monkeypatch.setattr(
            "decodo.scraping_client._max_monthly_req", lambda: 5
        )

        # Mock the count query. The client imports it via
        # `from decodo.telemetry import get_monthly_request_count`, so we must
        # patch on the importing module's namespace.
        async def fake_count(session=None):
            return 10  # Way over the cap of 5

        monkeypatch.setattr(
            "decodo.scraping_client.get_monthly_request_count", fake_count
        )

        post_mock = AsyncMock(side_effect=AssertionError("should not be called"))
        monkeypatch.setattr(httpx.AsyncClient, "post", post_mock)

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        with pytest.raises(DecodoBudgetExceededError) as exc_info:
            await client.scrape("https://example.com")
        assert exc_info.value.current_count == 10
        assert exc_info.value.max_count == 5

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_missing_api_key_raises_config_error(self, monkeypatch, db_session):
        """Empty API key → DecodoConfigError before any HTTP call."""
        from decodo import DecodoScrapingClient
        from decodo.errors import DecodoConfigError

        post_mock = AsyncMock(side_effect=AssertionError("should not be called"))
        monkeypatch.setattr(httpx.AsyncClient, "post", post_mock)

        client = DecodoScrapingClient(api_key="", db_session=db_session)
        with pytest.raises(DecodoConfigError):
            await client.scrape("https://example.com")


# ─────────────────────────────────────────────────────────────────────────────
# Payload shape
# ─────────────────────────────────────────────────────────────────────────────


class TestPayload:
    @pytest.mark.unit
    def test_payload_markdown_includes_output_format(self):
        from decodo.scraping_client import DecodoScrapingClient

        payload = DecodoScrapingClient._build_payload(
            url="https://example.com",
            proxy_pool="premium",
            headless=True,
            device_type="desktop_chrome",
            output_format="markdown",
        )
        assert payload["url"] == "https://example.com"
        assert payload["proxy_pool"] == "premium"
        assert payload["device_type"] == "desktop_chrome"
        assert payload["headless"] == "html"
        assert payload["output_format"] == "markdown"

    @pytest.mark.unit
    def test_payload_raw_html_no_output_format(self):
        from decodo.scraping_client import DecodoScrapingClient

        payload = DecodoScrapingClient._build_payload(
            url="https://example.com",
            proxy_pool="standard",
            headless=False,
            device_type="desktop_chrome",
            output_format="raw_html",
        )
        # No JS, no output_format param — Decodo defaults to raw HTML.
        assert "headless" not in payload
        assert "output_format" not in payload


# ─────────────────────────────────────────────────────────────────────────────
# Response parsing
# ─────────────────────────────────────────────────────────────────────────────


class TestResponseParsing:
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_malformed_response_no_results(self, monkeypatch, db_session):
        """200 OK but body has no `results` array → DecodoResponseError."""
        from decodo import DecodoScrapingClient
        from decodo.errors import DecodoResponseError

        bad_body = {"unexpected": "shape"}
        _patch_httpx_post(
            [_fake_httpx_response(status_code=200, body=bad_body)], monkeypatch
        )
        monkeypatch.setattr(
            "decodo.scraping_client.asyncio.sleep", AsyncMock(return_value=None)
        )

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        with pytest.raises(DecodoResponseError):
            await client.scrape("https://example.com")

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_malformed_response_empty_results(self, monkeypatch, db_session):
        """200 OK with empty results array → DecodoResponseError."""
        from decodo import DecodoScrapingClient
        from decodo.errors import DecodoResponseError

        bad_body = {"results": []}
        _patch_httpx_post(
            [_fake_httpx_response(status_code=200, body=bad_body)], monkeypatch
        )

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        with pytest.raises(DecodoResponseError):
            await client.scrape("https://example.com")


# ─────────────────────────────────────────────────────────────────────────────
# Telemetry
# ─────────────────────────────────────────────────────────────────────────────


class TestTelemetry:
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_success_writes_telemetry_row(self, monkeypatch, db_session):
        """On 200 OK, one row is inserted into decodo_scraping_usage."""
        from decodo import DecodoScrapingClient

        success_body = {
            "results": [
                {
                    "status_code": 200,
                    "content": "ok",
                    "headers": {"x-foo": "bar"},
                }
            ]
        }
        _patch_httpx_post(
            [_fake_httpx_response(status_code=200, body=success_body)], monkeypatch
        )

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        await client.scrape(
            "https://example.com/path",
            proxy_pool="premium",
            headless=True,
            output_format="markdown",
        )

        result = await db_session.execute(
            text(
                "SELECT url, proxy_pool, headless, output_format, "
                "target_status_code, decodo_http_status, "
                "cost_estimate_usd, error FROM decodo_scraping_usage"
            )
        )
        rows = result.fetchall()
        assert len(rows) == 1
        row = rows[0]
        assert row[0] == "https://example.com/path"
        assert row[1] == "premium"
        assert bool(row[2]) is True
        assert row[3] == "markdown"
        assert row[4] == 200  # target_status_code
        assert row[5] == 200  # decodo_http_status
        assert float(row[6]) == 0.00125  # premium + js cost
        assert row[7] is None  # no error

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_failure_writes_telemetry_with_error(self, monkeypatch, db_session):
        """On 4xx, a row is still written with the error text."""
        from decodo import DecodoScrapingClient
        from decodo.errors import DecodoRequestError

        _patch_httpx_post(
            [_fake_httpx_response(status_code=403, body="forbidden")],
            monkeypatch,
        )
        monkeypatch.setattr(
            "decodo.scraping_client.asyncio.sleep", AsyncMock(return_value=None)
        )

        client = DecodoScrapingClient(
            api_key="Basic dGVzdA==", db_session=db_session
        )
        with pytest.raises(DecodoRequestError):
            await client.scrape("https://example.com")

        result = await db_session.execute(
            text(
                "SELECT decodo_http_status, target_status_code, error "
                "FROM decodo_scraping_usage"
            )
        )
        rows = result.fetchall()
        assert len(rows) == 1
        assert rows[0][0] == 403
        assert rows[0][1] is None
        assert "403" in (rows[0][2] or "")
