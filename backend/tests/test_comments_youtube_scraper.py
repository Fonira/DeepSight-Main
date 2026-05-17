"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — comments/youtube_scraper.py (Innertube /youtubei/v1/next)             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Mocks :                                                                           ║
║    - get_proxied_client → AsyncClient mock qui retourne des httpx.Response        ║
║    - record_proxy_usage → AsyncMock pour vérifier l'appel telemetry               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

# Setup env before importing src modules
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from comments.schemas import CommentsBatch
from comments import youtube_scraper as ys


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════


def _make_initial_response(token: str = "TOKEN_INITIAL") -> dict:
    """Payload Innertube /next initial avec panel comments + continuation token."""
    return {
        "engagementPanels": [
            {
                "engagementPanelSectionListRenderer": {
                    "targetId": "engagement-panel-comments-section",
                    "content": {
                        "sectionListRenderer": {
                            "contents": [
                                {
                                    "itemSectionRenderer": {
                                        "contents": [
                                            {
                                                "continuationItemRenderer": {
                                                    "continuationEndpoint": {
                                                        "continuationCommand": {
                                                            "token": token,
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                }
            }
        ]
    }


def _make_comment_page(
    *,
    comments: list[dict],
    next_token: str | None = None,
) -> dict:
    """Payload Innertube continuation response avec commentEntityPayload[]."""
    mutations = []
    for c in comments:
        mutations.append(
            {
                "payload": {
                    "commentEntityPayload": {
                        "properties": {
                            "commentId": c["cid"],
                            "content": {"content": c["text"]},
                            "publishedTime": c.get("published", "1 year ago"),
                        },
                        "author": {
                            "displayName": c.get("author", "TestAuthor"),
                            "channelId": c.get("author_id"),
                            "isCreator": c.get("is_creator", False),
                        },
                        "toolbar": {
                            "likeCountNotliked": str(c.get("likes", 0)),
                            "replyCount": str(c.get("replies", 0)),
                        },
                    }
                }
            }
        )

    payload: dict = {
        "frameworkUpdates": {
            "entityBatchUpdate": {"mutations": mutations}
        },
    }
    if next_token:
        payload["onResponseReceivedEndpoints"] = [
            {
                "appendContinuationItemsAction": {
                    "continuationItems": [
                        {
                            "continuationItemRenderer": {
                                "continuationEndpoint": {
                                    "continuationCommand": {"token": next_token}
                                }
                            }
                        }
                    ]
                }
            }
        ]
    return payload


def _build_response(payload: dict, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json=payload,
        request=httpx.Request("POST", "https://www.youtube.com/youtubei/v1/next"),
    )


class _AsyncContextClientMock:
    """Mock get_proxied_client(): async context manager yielding a mock client."""

    def __init__(self, post_side_effect):
        self.client = AsyncMock()
        self.client.post = AsyncMock(side_effect=post_side_effect)

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self.client

    async def __aexit__(self, exc_type, exc, tb):
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_fetch_youtube_comments_happy_path():
    """3 commentaires sur une seule page, no continuation, parse + return."""
    initial = _build_response(_make_initial_response("TOK_0"))
    page1 = _build_response(
        _make_comment_page(
            comments=[
                {"cid": "C1", "text": "Super vidéo !", "author": "Alice", "likes": 100},
                {"cid": "C2", "text": "Bof", "author": "Bob", "likes": 5},
                {"cid": "C3", "text": "Top", "author": "Charlie", "likes": 50},
            ],
            next_token=None,
        )
    )
    mock_ctx = _AsyncContextClientMock(post_side_effect=[initial, page1])

    with patch.object(ys, "get_proxied_client", mock_ctx), patch.object(
        ys, "record_proxy_usage", AsyncMock()
    ):
        batch = await ys.fetch_youtube_comments("dQw4w9WgXcQ", top_n=100, random_n=50)

    assert isinstance(batch, CommentsBatch)
    assert batch.platform == "youtube"
    assert batch.video_id == "dQw4w9WgXcQ"
    assert batch.disabled is False
    assert batch.total_seen == 3
    assert len(batch.sampled) == 3
    # Top sorted by likes desc → Alice (100), Charlie (50), Bob (5)
    assert batch.sampled[0].author == "Alice"
    assert batch.sampled[0].like_count == 100


@pytest.mark.asyncio
async def test_fetch_youtube_comments_disabled_when_no_panel():
    """Pas de engagement-panel-comments-section dans engagementPanels → disabled=True."""
    initial = _build_response({"engagementPanels": []})  # no panel = disabled
    mock_ctx = _AsyncContextClientMock(post_side_effect=[initial])

    with patch.object(ys, "get_proxied_client", mock_ctx), patch.object(
        ys, "record_proxy_usage", AsyncMock()
    ):
        batch = await ys.fetch_youtube_comments("disabled_video_id")

    assert batch.disabled is True
    assert len(batch.sampled) == 0
    assert batch.total_seen == 0


@pytest.mark.asyncio
async def test_fetch_youtube_comments_telemetry_called():
    """record_proxy_usage est appelé avec provider='comments_youtube'."""
    initial = _build_response(_make_initial_response("TOK_T"))
    page = _build_response(
        _make_comment_page(comments=[{"cid": "X", "text": "T", "likes": 1}])
    )
    mock_ctx = _AsyncContextClientMock(post_side_effect=[initial, page])

    record_mock = AsyncMock()
    with patch.object(ys, "get_proxied_client", mock_ctx), patch.object(
        ys, "record_proxy_usage", record_mock
    ):
        await ys.fetch_youtube_comments("vid_telemetry", top_n=10, random_n=5)

    assert record_mock.called
    # Au moins un appel a provider=comments_youtube
    calls_with_youtube = [
        call for call in record_mock.call_args_list
        if call.kwargs.get("provider") == "comments_youtube"
    ]
    assert len(calls_with_youtube) >= 1
    # bytes_in > 0
    assert any(call.kwargs.get("bytes_in", 0) > 0 for call in calls_with_youtube)


@pytest.mark.asyncio
async def test_fetch_youtube_comments_http_error_returns_empty():
    """HTTP 403 sur initial → batch vide non-disabled."""
    bad = _build_response({}, status=403)
    mock_ctx = _AsyncContextClientMock(post_side_effect=[bad])

    with patch.object(ys, "get_proxied_client", mock_ctx), patch.object(
        ys, "record_proxy_usage", AsyncMock()
    ):
        batch = await ys.fetch_youtube_comments("bad_403")

    # 403 sur initial → pas de token → batch vide, disabled=False (le scrape a échoué)
    assert batch.disabled is False
    assert len(batch.sampled) == 0


@pytest.mark.asyncio
async def test_fetch_youtube_comments_pagination_two_pages():
    """2 pages : page1 a next_token, page2 = end."""
    initial = _build_response(_make_initial_response("TOK_INITIAL"))
    page1 = _build_response(
        _make_comment_page(
            comments=[
                {"cid": f"P1_{i}", "text": f"Page 1 c{i}", "author": f"u{i}", "likes": 100 - i}
                for i in range(5)
            ],
            next_token="TOK_PAGE2",
        )
    )
    page2 = _build_response(
        _make_comment_page(
            comments=[
                {"cid": f"P2_{i}", "text": f"Page 2 c{i}", "author": f"u{i}", "likes": 50 - i}
                for i in range(3)
            ],
            next_token=None,
        )
    )
    mock_ctx = _AsyncContextClientMock(post_side_effect=[initial, page1, page2])

    with patch.object(ys, "get_proxied_client", mock_ctx), patch.object(
        ys, "record_proxy_usage", AsyncMock()
    ):
        batch = await ys.fetch_youtube_comments("video_paged", top_n=100, random_n=50)

    assert batch.total_seen == 8
    assert len(batch.sampled) == 8  # < top_n + random_n → all returned


@pytest.mark.asyncio
async def test_fetch_youtube_comments_dedup():
    """Doublons (même comment_id sur 2 pages) → dédupliqués."""
    initial = _build_response(_make_initial_response("TOK_DED"))
    page1 = _build_response(
        _make_comment_page(
            comments=[
                {"cid": "DUP", "text": "first", "author": "A", "likes": 10},
                {"cid": "UNQ1", "text": "u1", "author": "B", "likes": 5},
            ],
            next_token="TOK_DED2",
        )
    )
    page2 = _build_response(
        _make_comment_page(
            comments=[
                {"cid": "DUP", "text": "first repeated", "author": "A", "likes": 10},
                {"cid": "UNQ2", "text": "u2", "author": "C", "likes": 3},
            ],
            next_token=None,
        )
    )
    mock_ctx = _AsyncContextClientMock(post_side_effect=[initial, page1, page2])

    with patch.object(ys, "get_proxied_client", mock_ctx), patch.object(
        ys, "record_proxy_usage", AsyncMock()
    ):
        batch = await ys.fetch_youtube_comments("vid_dup")

    # DUP, UNQ1, UNQ2 → 3 comments uniques
    assert batch.total_seen == 3
    cids = {c.comment_id for c in batch.sampled}
    assert cids == {"DUP", "UNQ1", "UNQ2"}


def test_parse_like_count():
    """1.2K → 1200, 3M → 3000000, 'foo' → 0, etc."""
    assert ys._parse_like_count("1.2K") == 1200
    assert ys._parse_like_count("3M") == 3_000_000
    assert ys._parse_like_count("847") == 847
    assert ys._parse_like_count("0") == 0
    assert ys._parse_like_count("") == 0
    assert ys._parse_like_count(None) == 0
    assert ys._parse_like_count("foo") == 0


def test_walk_helper():
    """_walk trouve récursivement tous les dicts avec la clé cible."""
    data = {
        "a": {"target": {"v": 1}},
        "b": [{"target": {"v": 2}}, {"nope": "x"}],
        "c": {"deep": {"target": {"v": 3}}},
    }
    found = list(ys._walk(data, "target"))
    assert len(found) == 3
    values = sorted(f["v"] for f in found)
    assert values == [1, 2, 3]


def test_get_innertube_key_env_override():
    """YOUTUBE_INNERTUBE_KEY env var override le default."""
    original = os.environ.get("YOUTUBE_INNERTUBE_KEY")
    try:
        os.environ["YOUTUBE_INNERTUBE_KEY"] = "MY_CUSTOM_KEY"
        assert ys._get_innertube_key() == "MY_CUSTOM_KEY"
        os.environ["YOUTUBE_INNERTUBE_KEY"] = ""
        assert ys._get_innertube_key() == ys.INNERTUBE_API_KEY_DEFAULT
    finally:
        if original is not None:
            os.environ["YOUTUBE_INNERTUBE_KEY"] = original
        else:
            os.environ.pop("YOUTUBE_INNERTUBE_KEY", None)
