"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — comments/tiktok_scraper.py (Web /api/comment/list/)                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, patch

import httpx
import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from comments.schemas import CommentsBatch
from comments import tiktok_scraper as ts


def _make_payload(
    *,
    comments: list[dict],
    cursor: int = 0,
    has_more: bool = False,
    status_code: int = 0,
    total: int | None = None,
) -> dict:
    """Construit un payload TikTok web /api/comment/list/."""
    items = []
    for c in comments:
        items.append(
            {
                "cid": c["cid"],
                "text": c["text"],
                "digg_count": c.get("likes", 0),
                "reply_comment_total": c.get("replies", 0),
                "create_time": c.get("create_time", 1700000000),
                "user": {
                    "nickname": c.get("author", "TestUser"),
                    "uid": c.get("author_id", "uid_x"),
                },
                "stick_position": c.get("stick", 0),
            }
        )
    return {
        "status_code": status_code,
        "comments": items,
        "cursor": cursor,
        "has_more": has_more,
        "total": total if total is not None else len(items),
    }


def _build_response(payload: dict, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json=payload,
        request=httpx.Request("GET", "https://www.tiktok.com/api/comment/list/"),
    )


class _AsyncContextClientMock:
    def __init__(self, get_side_effect):
        self.client = AsyncMock()
        self.client.get = AsyncMock(side_effect=get_side_effect)

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self.client

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_fetch_tiktok_comments_happy_path():
    resp = _build_response(
        _make_payload(
            comments=[
                {"cid": "T1", "text": "Trop bien", "author": "Alice", "likes": 200},
                {"cid": "T2", "text": "Pas mal", "author": "Bob", "likes": 30},
                {"cid": "T3", "text": "Top", "author": "Charlie", "likes": 80},
            ],
            has_more=False,
        )
    )
    mock_ctx = _AsyncContextClientMock(get_side_effect=[resp])

    with patch.object(ts, "get_proxied_client", mock_ctx), patch.object(
        ts, "record_proxy_usage", AsyncMock()
    ):
        batch = await ts.fetch_tiktok_comments("7300000000000000000", top_n=100, random_n=50)

    assert isinstance(batch, CommentsBatch)
    assert batch.platform == "tiktok"
    assert batch.disabled is False
    assert batch.total_seen == 3
    assert len(batch.sampled) == 3
    assert batch.sampled[0].author == "Alice"
    assert batch.sampled[0].like_count == 200


@pytest.mark.asyncio
async def test_fetch_tiktok_comments_disabled():
    """status_code=10202 → disabled=True."""
    resp = _build_response(_make_payload(comments=[], status_code=10202))
    mock_ctx = _AsyncContextClientMock(get_side_effect=[resp])

    with patch.object(ts, "get_proxied_client", mock_ctx), patch.object(
        ts, "record_proxy_usage", AsyncMock()
    ):
        batch = await ts.fetch_tiktok_comments("disabled_tt")

    assert batch.disabled is True
    assert len(batch.sampled) == 0


@pytest.mark.asyncio
async def test_fetch_tiktok_comments_video_removed():
    """status_code=10204 → batch vide non-disabled (vidéo supprimée)."""
    resp = _build_response(_make_payload(comments=[], status_code=10204))
    mock_ctx = _AsyncContextClientMock(get_side_effect=[resp])

    with patch.object(ts, "get_proxied_client", mock_ctx), patch.object(
        ts, "record_proxy_usage", AsyncMock()
    ):
        batch = await ts.fetch_tiktok_comments("removed_tt")

    assert batch.disabled is False  # On considère "removed" comme insufficient
    assert len(batch.sampled) == 0


@pytest.mark.asyncio
async def test_fetch_tiktok_comments_pagination():
    """has_more=True + cursor → page suivante."""
    page1 = _build_response(
        _make_payload(
            comments=[
                {"cid": f"P1_{i}", "text": f"c{i}", "author": f"u{i}", "likes": 100 - i}
                for i in range(3)
            ],
            cursor=3,
            has_more=True,
        )
    )
    page2 = _build_response(
        _make_payload(
            comments=[
                {"cid": f"P2_{i}", "text": f"d{i}", "author": f"v{i}", "likes": 50 - i}
                for i in range(2)
            ],
            cursor=5,
            has_more=False,
        )
    )
    mock_ctx = _AsyncContextClientMock(get_side_effect=[page1, page2])

    with patch.object(ts, "get_proxied_client", mock_ctx), patch.object(
        ts, "record_proxy_usage", AsyncMock()
    ):
        batch = await ts.fetch_tiktok_comments("paged_tt")

    assert batch.total_seen == 5


@pytest.mark.asyncio
async def test_fetch_tiktok_comments_telemetry():
    resp = _build_response(
        _make_payload(comments=[{"cid": "X", "text": "T", "author": "U", "likes": 1}])
    )
    mock_ctx = _AsyncContextClientMock(get_side_effect=[resp])

    record_mock = AsyncMock()
    with patch.object(ts, "get_proxied_client", mock_ctx), patch.object(
        ts, "record_proxy_usage", record_mock
    ):
        await ts.fetch_tiktok_comments("video_tel_tt")

    assert record_mock.called
    calls = [
        c for c in record_mock.call_args_list
        if c.kwargs.get("provider") == "comments_tiktok"
    ]
    assert len(calls) >= 1
    assert any(c.kwargs.get("bytes_in", 0) > 0 for c in calls)


@pytest.mark.asyncio
async def test_fetch_tiktok_comments_http_error():
    """HTTP 403 → batch vide, pas de crash."""
    bad = _build_response({"status_code": 0, "comments": []}, status=403)
    mock_ctx = _AsyncContextClientMock(get_side_effect=[bad])

    with patch.object(ts, "get_proxied_client", mock_ctx), patch.object(
        ts, "record_proxy_usage", AsyncMock()
    ):
        batch = await ts.fetch_tiktok_comments("bad_tt")

    assert batch.disabled is False
    assert len(batch.sampled) == 0


def test_parse_tiktok_comment_valid():
    item = {
        "cid": "C1",
        "text": "Hello",
        "digg_count": 42,
        "reply_comment_total": 3,
        "create_time": 1700000000,
        "user": {"nickname": "Bob", "uid": "uid_42"},
        "stick_position": 0,
    }
    c = ts._parse_tiktok_comment(item)
    assert c is not None
    assert c.comment_id == "C1"
    assert c.text == "Hello"
    assert c.like_count == 42
    assert c.reply_count == 3
    assert c.author == "Bob"
    assert c.author_id == "uid_42"


def test_parse_tiktok_comment_missing_text():
    """Item sans text → retourne None."""
    item = {"cid": "C1", "user": {"nickname": "X"}}
    assert ts._parse_tiktok_comment(item) is None


def test_parse_tiktok_comment_missing_cid():
    item = {"text": "no cid", "user": {"nickname": "X"}}
    assert ts._parse_tiktok_comment(item) is None


def test_generate_ms_token_format():
    token = ts._generate_ms_token()
    assert isinstance(token, str)
    assert len(token) == 64  # token_hex(32) = 64 chars
    int(token, 16)  # must be valid hex
