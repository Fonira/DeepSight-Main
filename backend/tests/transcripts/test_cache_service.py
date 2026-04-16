"""
Tests for transcripts.cache.TranscriptCacheService (L1 Redis + L2 DB).

Uses AsyncMock to patch:
  - core.cache.cache_service           (L1 backend)
  - core.cache.transcript_metrics      (counters)
  - transcripts.cache_db functions     (L2 authoritative store)
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from transcripts.cache import (
    TranscriptCacheService,
    L1_TTL_SECONDS,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def service() -> TranscriptCacheService:
    return TranscriptCacheService()


@pytest.fixture
def mock_cache_service():
    """AsyncMock stand-in for core.cache.cache_service."""
    m = MagicMock()
    m.get = AsyncMock(return_value=None)
    m.set = AsyncMock(return_value=True)
    m.delete = AsyncMock(return_value=True)
    return m


@pytest.fixture
def mock_metrics():
    m = MagicMock()
    m.increment = AsyncMock(return_value=None)
    return m


def _patch_deps(
    mock_cache_service,
    mock_metrics,
    db_get=None,
    db_save=None,
):
    """
    Build the two patchers used by each test to stub the lazy-imported
    dependencies inside `transcripts.cache`.
    """
    def make_cache_key(namespace, vid):
        return f"{namespace}:{vid}"

    cache_patch = patch(
        "transcripts.cache._get_cache_service",
        return_value=(mock_cache_service, make_cache_key, mock_metrics),
    )
    db_patch = patch(
        "transcripts.cache._get_db_cache",
        return_value=(db_get, db_save),
    )
    return cache_patch, db_patch


# ---------------------------------------------------------------------------
# GET scenarios
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_l1_hit_does_not_touch_l2(service, mock_cache_service, mock_metrics):
    """L1 hit → L2 DB function must not be called."""
    mock_cache_service.get.return_value = {
        "simple": "hello",
        "timestamped": "[0:00] hello",
        "lang": "en",
    }
    db_get = AsyncMock()
    db_save = AsyncMock()

    cache_patch, db_patch = _patch_deps(mock_cache_service, mock_metrics, db_get, db_save)
    with cache_patch, db_patch:
        payload = await service.get("abc123", platform="youtube")

    assert payload == {"simple": "hello", "timestamped": "[0:00] hello", "lang": "en"}
    mock_cache_service.get.assert_awaited_once_with("transcript:abc123")
    db_get.assert_not_awaited()
    mock_metrics.increment.assert_awaited_with("l1_hits")


@pytest.mark.asyncio
async def test_l1_miss_l2_hit_warms_l1(service, mock_cache_service, mock_metrics):
    """L1 miss + L2 hit → return DB payload and set L1 with TTL."""
    mock_cache_service.get.return_value = None
    db_get = AsyncMock(return_value=("hello", "[0:00] hello", "en"))
    db_save = AsyncMock()

    cache_patch, db_patch = _patch_deps(mock_cache_service, mock_metrics, db_get, db_save)
    with cache_patch, db_patch:
        payload = await service.get("abc123", platform="youtube")

    assert payload == {"simple": "hello", "timestamped": "[0:00] hello", "lang": "en"}
    db_get.assert_awaited_once_with("abc123")
    # L1 warmed with the full payload and correct TTL
    mock_cache_service.set.assert_awaited_once_with(
        "transcript:abc123",
        {"simple": "hello", "timestamped": "[0:00] hello", "lang": "en"},
        ttl=L1_TTL_SECONDS,
    )
    mock_metrics.increment.assert_any_await("l2_hits")


@pytest.mark.asyncio
async def test_l1_miss_l2_miss_returns_none(service, mock_cache_service, mock_metrics):
    """Both misses → None, counter `misses` incremented."""
    mock_cache_service.get.return_value = None
    db_get = AsyncMock(return_value=None)
    db_save = AsyncMock()

    cache_patch, db_patch = _patch_deps(mock_cache_service, mock_metrics, db_get, db_save)
    with cache_patch, db_patch:
        payload = await service.get("nope", platform="youtube")

    assert payload is None
    db_get.assert_awaited_once_with("nope")
    mock_cache_service.set.assert_not_awaited()
    mock_metrics.increment.assert_any_await("misses")


@pytest.mark.asyncio
async def test_l1_raises_fallbacks_to_l2(service, mock_cache_service, mock_metrics):
    """L1 error must not propagate; service must still read L2."""
    mock_cache_service.get.side_effect = RuntimeError("redis down")
    db_get = AsyncMock(return_value=("hello", "ts", "fr"))
    db_save = AsyncMock()

    cache_patch, db_patch = _patch_deps(mock_cache_service, mock_metrics, db_get, db_save)
    with cache_patch, db_patch:
        payload = await service.get("abc123", platform="youtube")

    assert payload == {"simple": "hello", "timestamped": "ts", "lang": "fr"}
    db_get.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_ignores_empty_l1_payload(service, mock_cache_service, mock_metrics):
    """An L1 payload with no `simple` key is treated as a miss."""
    mock_cache_service.get.return_value = {"simple": None}
    db_get = AsyncMock(return_value=("hi", "[0:00] hi", "en"))
    db_save = AsyncMock()

    cache_patch, db_patch = _patch_deps(mock_cache_service, mock_metrics, db_get, db_save)
    with cache_patch, db_patch:
        payload = await service.get("abc123", platform="youtube")

    assert payload == {"simple": "hi", "timestamped": "[0:00] hi", "lang": "en"}


# ---------------------------------------------------------------------------
# SET scenarios
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_set_writes_db_and_l1(service, mock_cache_service, mock_metrics):
    """A successful set() writes both L2 (DB) and L1 (Redis)."""
    db_get = AsyncMock()
    db_save = AsyncMock(return_value=True)

    cache_patch, db_patch = _patch_deps(mock_cache_service, mock_metrics, db_get, db_save)
    with cache_patch, db_patch:
        ok = await service.set(
            video_id="abc123",
            simple="hello world",
            timestamped="[0:00] hello world",
            lang="en",
            platform="youtube",
            extraction_method="supadata",
            thumbnail_url="https://example.com/thumb.jpg",
        )

    assert ok is True
    db_save.assert_awaited_once()
    kwargs = db_save.await_args.kwargs
    assert kwargs["video_id"] == "abc123"
    assert kwargs["simple"] == "hello world"
    assert kwargs["platform"] == "youtube"
    assert kwargs["extraction_method"] == "supadata"
    assert kwargs["thumbnail_url"] == "https://example.com/thumb.jpg"

    mock_cache_service.set.assert_awaited_once_with(
        "transcript:abc123",
        {"simple": "hello world", "timestamped": "[0:00] hello world", "lang": "en"},
        ttl=L1_TTL_SECONDS,
    )


@pytest.mark.asyncio
async def test_set_l1_failure_does_not_fail_write(service, mock_cache_service, mock_metrics):
    """If Redis raises during SET, the DB write still succeeds and no exception leaks."""
    mock_cache_service.set.side_effect = RuntimeError("redis down")
    db_save = AsyncMock(return_value=True)

    cache_patch, db_patch = _patch_deps(mock_cache_service, mock_metrics, None, db_save)
    with cache_patch, db_patch:
        ok = await service.set(
            video_id="abc123",
            simple="hello",
            timestamped=None,
            lang="en",
            platform="youtube",
        )

    assert ok is True
    db_save.assert_awaited_once()


@pytest.mark.asyncio
async def test_set_skips_empty_content(service, mock_cache_service, mock_metrics):
    """Empty transcripts are a no-op — neither tier is written."""
    db_save = AsyncMock(return_value=True)

    cache_patch, db_patch = _patch_deps(mock_cache_service, mock_metrics, None, db_save)
    with cache_patch, db_patch:
        ok = await service.set(
            video_id="abc123",
            simple="",
            timestamped=None,
            lang=None,
            platform="youtube",
        )

    assert ok is False
    db_save.assert_not_awaited()
    mock_cache_service.set.assert_not_awaited()


# ---------------------------------------------------------------------------
# INVALIDATE scenarios
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invalidate_deletes_l1(service, mock_cache_service, mock_metrics):
    """
    invalidate() always deletes the L1 key. The L2 delete path uses the
    real async_session_maker, which is unreachable in unit tests; we assert
    that the call does not raise and that L1 DELETE was issued.
    """
    db_get = AsyncMock()
    db_save = AsyncMock()

    cache_patch, db_patch = _patch_deps(mock_cache_service, mock_metrics, db_get, db_save)
    # Force the L2 invalidation path to bail out cleanly by making the
    # sqlalchemy session factory unavailable.
    db_db_patch = patch("db.database.async_session_maker", side_effect=RuntimeError("no db"))
    with cache_patch, db_patch, db_db_patch:
        await service.invalidate("abc123", platform="youtube")

    mock_cache_service.delete.assert_awaited_once_with("transcript:abc123")


# ---------------------------------------------------------------------------
# Graceful degradation when dependencies are missing
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_without_any_backend_returns_none(service):
    """If both L1 and L2 imports fail, get() returns None without raising."""
    with patch("transcripts.cache._get_cache_service", return_value=(None, None, None)), \
         patch("transcripts.cache._get_db_cache", return_value=(None, None)):
        result = await service.get("abc123", platform="youtube")
    assert result is None


@pytest.mark.asyncio
async def test_set_without_any_backend_returns_false(service):
    """If both L1 and L2 imports fail, set() returns False (nothing persisted)."""
    with patch("transcripts.cache._get_cache_service", return_value=(None, None, None)), \
         patch("transcripts.cache._get_db_cache", return_value=(None, None)):
        ok = await service.set(
            video_id="abc123",
            simple="hello",
            timestamped=None,
            lang="en",
            platform="youtube",
        )
    assert ok is False
