"""
Tests for trending Redis cache migration + pre-cache job.

Covers:
- Cache hit (Redis returns data -> no DB query)
- Cache miss (Redis empty -> DB query -> cache set)
- refresh_deepsight_trending (pre-cache job)
- build_trending_cache_key generation
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

SAMPLE_TRENDING_DICT = {
    "videos": [
        {
            "video_id": "abc123",
            "title": "Test Video",
            "channel": "TestChannel",
            "thumbnail_url": "https://img.youtube.com/vi/abc123/mqdefault.jpg",
            "category": "Science",
            "duration": 600,
            "view_count": 10000,
            "upload_date": "2026-01-15",
            "analysis_count": 5,
            "unique_users": 3,
            "avg_reliability_score": 7.2,
            "latest_analyzed_at": "2026-04-10T12:00:00",
            "is_cached": True,
        }
    ],
    "period": "30d",
    "total_cached_videos": 42,
    "generated_at": "2026-04-16T10:00:00",
}


@pytest.fixture
def mock_cache_service():
    """Mock the cache_service singleton."""
    svc = AsyncMock()
    svc.get = AsyncMock(return_value=None)
    svc.set = AsyncMock(return_value=True)
    return svc


# ═══════════════════════════════════════════════════════════════════════════════
# build_trending_cache_key
# ═══════════════════════════════════════════════════════════════════════════════

class TestBuildCacheKey:
    """Test cache key generation."""

    def test_default_params(self):
        from trending.router import build_trending_cache_key
        key = build_trending_cache_key("30d", None, 20)
        assert key == "trending:deepsight:30d:all:20"

    def test_with_category(self):
        from trending.router import build_trending_cache_key
        key = build_trending_cache_key("7d", "Science", 10)
        assert key == "trending:deepsight:7d:Science:10"

    def test_all_period(self):
        from trending.router import build_trending_cache_key
        key = build_trending_cache_key("all", None, 50)
        assert key == "trending:deepsight:all:all:50"

    def test_different_params_produce_different_keys(self):
        from trending.router import build_trending_cache_key
        k1 = build_trending_cache_key("7d", None, 20)
        k2 = build_trending_cache_key("30d", None, 20)
        k3 = build_trending_cache_key("30d", "Music", 20)
        assert k1 != k2
        assert k2 != k3


# ═══════════════════════════════════════════════════════════════════════════════
# get_trending endpoint — cache hit
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetTrendingCacheHit:
    """When Redis has cached data, the DB should not be queried."""

    @pytest.mark.asyncio
    async def test_returns_cached_response(self, mock_cache_service):
        with (
            patch("trending.router.cache_service", mock_cache_service),
            patch("trending.router._query_trending_from_db") as mock_db,
        ):
            mock_cache_service.get.return_value = SAMPLE_TRENDING_DICT

            from trending.router import get_trending
            result = await get_trending(period="30d", category=None, limit=20)

            assert result.period == "30d"
            assert len(result.videos) == 1
            assert result.videos[0].video_id == "abc123"

            # DB should NOT be called on cache hit
            mock_db.assert_not_called()
            # cache_service.set should NOT be called (already cached)
            mock_cache_service.set.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════════
# get_trending endpoint — cache miss
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetTrendingCacheMiss:
    """When Redis returns None, should query DB then cache the result."""

    @pytest.mark.asyncio
    async def test_queries_db_and_caches(self, mock_cache_service):
        from trending.router import TrendingResponse

        db_response = TrendingResponse(**SAMPLE_TRENDING_DICT)

        with (
            patch("trending.router.cache_service", mock_cache_service),
            patch("trending.router._query_trending_from_db", new_callable=AsyncMock) as mock_db,
        ):
            mock_cache_service.get.return_value = None  # cache miss
            mock_db.return_value = db_response

            from trending.router import get_trending
            result = await get_trending(period="30d", category=None, limit=20)

            assert result.period == "30d"
            assert len(result.videos) == 1

            # DB should be called
            mock_db.assert_awaited_once_with("30d", None, 20)

            # Result should be stored in cache
            mock_cache_service.set.assert_awaited_once()
            call_args = mock_cache_service.set.call_args
            assert call_args[0][0] == "trending:deepsight:30d:all:20"  # cache key
            assert call_args[1]["ttl"] == 3600


# ═══════════════════════════════════════════════════════════════════════════════
# refresh_deepsight_trending
# ═══════════════════════════════════════════════════════════════════════════════

class TestRefreshDeepsightTrending:
    """Test the pre-cache refresh job."""

    @pytest.mark.asyncio
    async def test_precaches_default_combos(self, mock_cache_service):
        from trending.router import TrendingResponse

        db_response = TrendingResponse(**SAMPLE_TRENDING_DICT)

        with (
            patch("trending.trending_precache.cache_service", mock_cache_service),
            patch("trending.trending_precache._query_trending_from_db", new_callable=AsyncMock) as mock_db,
        ):
            mock_db.return_value = db_response

            from trending.trending_precache import refresh_deepsight_trending
            stats = await refresh_deepsight_trending()

            assert stats["cached"] == 2  # 30d + 7d
            assert stats["errors"] == 0
            assert len(stats["combos"]) == 2

            # DB should be called twice (once per combo)
            assert mock_db.await_count == 2

            # cache_service.set called twice
            assert mock_cache_service.set.await_count == 2

    @pytest.mark.asyncio
    async def test_handles_db_error_gracefully(self, mock_cache_service):
        with (
            patch("trending.trending_precache.cache_service", mock_cache_service),
            patch(
                "trending.trending_precache._query_trending_from_db",
                new_callable=AsyncMock,
                side_effect=Exception("DB connection lost"),
            ),
        ):
            from trending.trending_precache import refresh_deepsight_trending
            stats = await refresh_deepsight_trending()

            assert stats["cached"] == 0
            assert stats["errors"] == 2  # both combos failed
