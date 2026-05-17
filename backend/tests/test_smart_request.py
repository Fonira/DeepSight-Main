"""Tests for core.http_client.smart_request — direct-first with proxy fallback."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest


def _make_resp(status_code: int, content: bytes = b"") -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.content = content
    resp.num_bytes_downloaded = len(content)
    return resp


@pytest.fixture
def mock_clients(monkeypatch):
    """Mock shared_http_client + get_proxied_client + record_proxied_response.

    Use state["direct_resp"] / state["proxy_resp"] / state["direct_exc"] to
    control what each path returns. Read state["direct_calls"] /
    state["proxy_calls"] to assert routing.
    """
    state = {
        "direct_resp": _make_resp(200, b"direct"),
        "proxy_resp": _make_resp(200, b"proxy"),
        "direct_calls": 0,
        "proxy_calls": 0,
        "direct_exc": None,
        "record_calls": [],
    }

    @asynccontextmanager
    async def mock_shared(**kwargs):
        client = AsyncMock()

        async def request(*args, **kw):
            state["direct_calls"] += 1
            if state["direct_exc"] is not None:
                raise state["direct_exc"]
            return state["direct_resp"]

        client.request = request
        yield client

    @asynccontextmanager
    async def mock_proxied(**kwargs):
        client = AsyncMock()

        async def request(*args, **kw):
            state["proxy_calls"] += 1
            return state["proxy_resp"]

        client.request = request
        yield client

    async def mock_record(response, provider):
        state["record_calls"].append(provider)

    monkeypatch.setattr("core.http_client.shared_http_client", mock_shared)
    monkeypatch.setattr("core.http_client.get_proxied_client", mock_proxied)
    monkeypatch.setattr("core.http_client.record_proxied_response", mock_record)

    return state


@pytest.mark.asyncio
async def test_smart_request_direct_success(mock_clients):
    """200 from direct → returns direct response, no proxy call, no telemetry."""
    from core.http_client import smart_request

    resp = await smart_request("GET", "https://example.com/oembed", provider="test_oembed")

    assert resp.status_code == 200
    assert resp.content == b"direct"
    assert mock_clients["direct_calls"] == 1
    assert mock_clients["proxy_calls"] == 0
    assert mock_clients["record_calls"] == []


@pytest.mark.asyncio
async def test_smart_request_direct_403_falls_back(mock_clients):
    """403 from direct → falls back to proxy, records telemetry."""
    mock_clients["direct_resp"] = _make_resp(403)
    from core.http_client import smart_request

    resp = await smart_request("GET", "https://example.com/oembed", provider="test_oembed")

    assert resp.status_code == 200
    assert resp.content == b"proxy"
    assert mock_clients["direct_calls"] == 1
    assert mock_clients["proxy_calls"] == 1
    assert mock_clients["record_calls"] == ["test_oembed"]


@pytest.mark.asyncio
async def test_smart_request_direct_429_falls_back(mock_clients):
    """429 rate-limit → falls back to proxy."""
    mock_clients["direct_resp"] = _make_resp(429)
    from core.http_client import smart_request

    await smart_request("GET", "https://example.com/oembed", provider="test_oembed")

    assert mock_clients["proxy_calls"] == 1


@pytest.mark.asyncio
async def test_smart_request_direct_502_falls_back(mock_clients):
    """502 bad gateway → falls back to proxy."""
    mock_clients["direct_resp"] = _make_resp(502)
    from core.http_client import smart_request

    await smart_request("GET", "https://example.com/oembed", provider="test_oembed")

    assert mock_clients["proxy_calls"] == 1


@pytest.mark.asyncio
async def test_smart_request_direct_timeout_falls_back(mock_clients):
    """Direct httpx.ConnectTimeout → falls back to proxy."""
    mock_clients["direct_exc"] = httpx.ConnectTimeout("timeout")
    from core.http_client import smart_request

    resp = await smart_request("GET", "https://example.com/oembed", provider="test_oembed")

    assert resp.status_code == 200
    assert mock_clients["direct_calls"] == 1
    assert mock_clients["proxy_calls"] == 1


@pytest.mark.asyncio
async def test_smart_request_direct_connect_error_falls_back(mock_clients):
    """Direct httpx.ConnectError → falls back to proxy."""
    mock_clients["direct_exc"] = httpx.ConnectError("refused")
    from core.http_client import smart_request

    await smart_request("GET", "https://example.com/oembed", provider="test_oembed")

    assert mock_clients["proxy_calls"] == 1


@pytest.mark.asyncio
async def test_smart_request_direct_404_not_block(mock_clients):
    """404 from direct is NOT a block — returns direct response, no fallback."""
    mock_clients["direct_resp"] = _make_resp(404)
    from core.http_client import smart_request

    resp = await smart_request("GET", "https://example.com/oembed", provider="test_oembed")

    assert resp.status_code == 404
    assert mock_clients["proxy_calls"] == 0


@pytest.mark.asyncio
async def test_smart_request_custom_block_codes(mock_clients):
    """Caller can override block_status_codes (e.g., treat 404 as block)."""
    mock_clients["direct_resp"] = _make_resp(404)
    from core.http_client import smart_request

    resp = await smart_request(
        "GET",
        "https://example.com/oembed",
        provider="test_oembed",
        block_status_codes=(404,),
    )

    assert resp.status_code == 200
    assert mock_clients["proxy_calls"] == 1


@pytest.mark.asyncio
async def test_smart_request_non_transport_error_propagates(mock_clients):
    """Non-transport error (e.g., ValueError) is NOT caught, propagates."""
    mock_clients["direct_exc"] = ValueError("programmer bug")
    from core.http_client import smart_request

    with pytest.raises(ValueError, match="programmer bug"):
        await smart_request("GET", "https://example.com/oembed", provider="test_oembed")

    assert mock_clients["proxy_calls"] == 0  # No fallback for non-transport errors
