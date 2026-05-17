"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — comments/service.py (orchestration + cache + timeout)                 ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from comments.schemas import Comment, CommentsBatch, CommunityTake
from comments import service as svc


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════


def _make_batch(*, sampled_count: int = 50, disabled: bool = False) -> CommentsBatch:
    return CommentsBatch(
        platform="youtube",
        video_id="vid_x",
        total_seen=sampled_count,
        sampled=[
            Comment(comment_id=f"c{i}", author=f"u{i}", text=f"text {i}", like_count=100 - i)
            for i in range(sampled_count)
        ],
        disabled=disabled,
    )


def _make_take(signal: str = "agree") -> CommunityTake:
    return CommunityTake(
        agreement_signal=signal,
        sentiment_distribution={"positive": 0.6, "neutral": 0.3, "negative": 0.1},
        controversies=[],
        community_summary="OK",
        top_voices=[],
        comments_analyzed=50,
        model_used="mistral-medium-2508",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — fetch_comments
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_fetch_comments_cache_hit():
    cached = _make_batch(sampled_count=42)

    with patch.object(svc, "cache_get_comments_batch", AsyncMock(return_value=cached)), patch.object(
        svc, "_is_proxy_quota_exhausted", AsyncMock(return_value=False)
    ), patch.object(svc, "_fetch_yt", AsyncMock()) as yt_mock:
        batch = await svc.fetch_comments("youtube", "vid_x")

    assert batch.total_seen == 42
    assert not yt_mock.called  # cache HIT → no scrape


@pytest.mark.asyncio
async def test_fetch_comments_quota_exhausted():
    """Soft quota dépassée → batch vide non-disabled, pas de scrape."""
    with patch.object(svc, "cache_get_comments_batch", AsyncMock(return_value=None)), patch.object(
        svc, "_is_proxy_quota_exhausted", AsyncMock(return_value=True)
    ), patch.object(svc, "_fetch_yt", AsyncMock()) as yt_mock:
        batch = await svc.fetch_comments("youtube", "vid_x")

    assert batch.disabled is False
    assert len(batch.sampled) == 0
    assert not yt_mock.called


@pytest.mark.asyncio
async def test_fetch_comments_dispatches_youtube():
    with patch.object(svc, "cache_get_comments_batch", AsyncMock(return_value=None)), patch.object(
        svc, "_is_proxy_quota_exhausted", AsyncMock(return_value=False)
    ), patch.object(svc, "_fetch_yt", AsyncMock(return_value=_make_batch(sampled_count=10))) as yt_mock, patch.object(
        svc, "_fetch_tt", AsyncMock()
    ) as tt_mock, patch.object(svc, "cache_set_comments_batch", AsyncMock()):
        batch = await svc.fetch_comments("youtube", "vid_y")

    assert yt_mock.called
    assert not tt_mock.called
    assert batch.total_seen == 10


@pytest.mark.asyncio
async def test_fetch_comments_dispatches_tiktok():
    with patch.object(svc, "cache_get_comments_batch", AsyncMock(return_value=None)), patch.object(
        svc, "_is_proxy_quota_exhausted", AsyncMock(return_value=False)
    ), patch.object(svc, "_fetch_yt", AsyncMock()) as yt_mock, patch.object(
        svc, "_fetch_tt", AsyncMock(return_value=_make_batch(sampled_count=5))
    ) as tt_mock, patch.object(svc, "cache_set_comments_batch", AsyncMock()):
        batch = await svc.fetch_comments("tiktok", "vid_t")

    assert tt_mock.called
    assert not yt_mock.called


@pytest.mark.asyncio
async def test_fetch_comments_unsupported_platform_raises():
    with patch.object(svc, "cache_get_comments_batch", AsyncMock(return_value=None)), patch.object(
        svc, "_is_proxy_quota_exhausted", AsyncMock(return_value=False)
    ):
        with pytest.raises(ValueError):
            await svc.fetch_comments("instagram", "x")


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — generate_community_analysis
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_generate_community_analysis_disabled():
    """batch.disabled=True → CommunityTake(disabled=True)."""
    batch = _make_batch(disabled=True, sampled_count=0)
    with patch.object(svc, "fetch_comments", AsyncMock(return_value=batch)):
        take = await svc.generate_community_analysis(
            "youtube",
            "vid_x",
            plan="pro",
            video_title="t",
        )
    assert take is not None
    assert take.disabled is True
    assert take.agreement_signal == "unclear"


@pytest.mark.asyncio
async def test_generate_community_analysis_insufficient():
    """sampled < 10 → CommunityTake(insufficient_data=True)."""
    batch = _make_batch(sampled_count=3)
    with patch.object(svc, "fetch_comments", AsyncMock(return_value=batch)):
        take = await svc.generate_community_analysis(
            "youtube",
            "vid_x",
            plan="pro",
            video_title="t",
        )
    assert take is not None
    assert take.insufficient_data is True
    assert take.comments_analyzed == 3


@pytest.mark.asyncio
async def test_generate_community_analysis_cache_hit():
    """Cache HIT take → pas d'appel generate_community_take."""
    batch = _make_batch(sampled_count=50)
    cached_take = _make_take()
    with patch.object(svc, "fetch_comments", AsyncMock(return_value=batch)), patch.object(
        svc, "cache_get_take", AsyncMock(return_value=cached_take)
    ), patch.object(svc, "generate_community_take", AsyncMock()) as gen_mock:
        take = await svc.generate_community_analysis(
            "youtube",
            "vid_x",
            plan="pro",
            video_title="t",
        )

    assert take == cached_take
    assert not gen_mock.called


@pytest.mark.asyncio
async def test_generate_community_analysis_happy_path():
    """Cache MISS → appel generate_community_take + cache_set."""
    batch = _make_batch(sampled_count=50)
    take = _make_take()

    with patch.object(svc, "fetch_comments", AsyncMock(return_value=batch)), patch.object(
        svc, "cache_get_take", AsyncMock(return_value=None)
    ), patch.object(svc, "generate_community_take", AsyncMock(return_value=take)) as gen_mock, patch.object(
        svc, "cache_set_take", AsyncMock()
    ) as cache_set_mock:
        result = await svc.generate_community_analysis(
            "youtube",
            "vid_x",
            plan="pro",
            video_title="t",
            video_topic_hint="tech",
        )

    assert result == take
    assert gen_mock.called
    assert cache_set_mock.called


@pytest.mark.asyncio
async def test_generate_community_analysis_swallows_exceptions():
    """Toute exception → log + return None, jamais bloquant."""
    with patch.object(svc, "fetch_comments", AsyncMock(side_effect=RuntimeError("scrape down"))):
        take = await svc.generate_community_analysis(
            "youtube",
            "vid_x",
            plan="pro",
            video_title="t",
        )
    assert take is None


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — timeout wrapper
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_with_timeout_passes_through():
    """generate_community_analysis_with_timeout retourne le résultat si OK."""
    take = _make_take()

    async def _fast(*args, **kwargs):
        return take

    with patch.object(svc, "generate_community_analysis", _fast):
        result = await svc.generate_community_analysis_with_timeout(
            "youtube", "vid_x", plan="pro", video_title="t", timeout_s=1.0
        )
    assert result == take


@pytest.mark.asyncio
async def test_with_timeout_kills_slow_call():
    """Si l'inner appelle dépasse timeout_s → None."""

    async def _slow(*args, **kwargs):
        await asyncio.sleep(0.5)
        return _make_take()

    with patch.object(svc, "generate_community_analysis", _slow):
        result = await svc.generate_community_analysis_with_timeout(
            "youtube", "vid_x", plan="pro", video_title="t", timeout_s=0.05
        )
    assert result is None


@pytest.mark.asyncio
async def test_with_timeout_swallows_outer_exception():
    async def _boom(*args, **kwargs):
        raise RuntimeError("oh no")

    with patch.object(svc, "generate_community_analysis", _boom):
        result = await svc.generate_community_analysis_with_timeout(
            "youtube", "vid_x", plan="pro", video_title="t", timeout_s=1.0
        )
    assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — helpers
# ═══════════════════════════════════════════════════════════════════════════════


def test_plan_to_tier():
    assert svc._plan_to_tier("free") == "small"
    assert svc._plan_to_tier("pro") == "medium"
    assert svc._plan_to_tier("expert") == "large"
    assert svc._plan_to_tier("unknown") == "small"


@pytest.mark.asyncio
async def test_is_proxy_quota_exhausted_fail_open_on_db_error():
    """Si get_mtd_bytes throw → return False (fail-open)."""
    with patch("middleware.proxy_telemetry.get_mtd_bytes", AsyncMock(side_effect=RuntimeError("db down"))):
        result = await svc._is_proxy_quota_exhausted()
    assert result is False
