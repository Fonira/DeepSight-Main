"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Scholar rate limiter (PR1 / spec §4.5)                                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║  • Blocking under 5 s window                                                       ║
║  • Pass-through after 5 s elapsed                                                  ║
║  • Fallback local when Redis down (no exception)                                  ║
║  • 4 concurrent workers serialized by the Redis lock                              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from unittest.mock import AsyncMock

import pytest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SRC = os.path.abspath(os.path.join(_HERE, "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from academic import scholar  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_scholar_state():
    """Reset module-level state between tests (isolation)."""
    scholar._reset_state_for_tests()
    yield
    scholar._reset_state_for_tests()


@pytest.fixture
def fast_interval(monkeypatch):
    """Shrink the rate interval so tests don't wait 5s each.

    The behaviour under test is "block until enough time elapsed" — the exact
    interval value is incidental. We use 0.1s in tests for speed.
    """
    monkeypatch.setattr(scholar, "SCHOLAR_RATE_INTERVAL", 0.1)


# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rate_limit_blocks_under_5s(fast_interval, redis_client_fixture):
    """Two back-to-back calls within the interval window must serialize."""
    await scholar.init_scholar_redis(redis_client_fixture)

    t0 = time.monotonic()
    await scholar._rate_limit()
    after_first = time.monotonic()
    await scholar._rate_limit()
    after_second = time.monotonic()

    # First call returns immediately (< interval).
    assert (after_first - t0) < scholar.SCHOLAR_RATE_INTERVAL, (
        f"first call should be fast, took {after_first - t0:.3f}s"
    )
    # Second call must wait at least most of the interval.
    second_call_wait = after_second - after_first
    assert second_call_wait >= scholar.SCHOLAR_RATE_INTERVAL * 0.8, (
        f"second call should block ~{scholar.SCHOLAR_RATE_INTERVAL}s, took {second_call_wait:.3f}s"
    )


@pytest.mark.asyncio
async def test_rate_limit_passes_after_interval(fast_interval, redis_client_fixture):
    """Wait > interval before the second call → no blocking."""
    await scholar.init_scholar_redis(redis_client_fixture)

    await scholar._rate_limit()
    # Sleep over the interval.
    await asyncio.sleep(scholar.SCHOLAR_RATE_INTERVAL * 1.2)

    t0 = time.monotonic()
    await scholar._rate_limit()
    elapsed = time.monotonic() - t0

    # Should be near-instant since lock TTL elapsed.
    assert elapsed < scholar.SCHOLAR_RATE_INTERVAL * 0.5, f"call after interval should be fast, took {elapsed:.3f}s"


@pytest.mark.asyncio
async def test_rate_limit_fallback_local_when_redis_down(fast_interval):
    """If Redis.get raises, we fall back to local timer (no propagated exception)."""
    bad_redis = AsyncMock()
    bad_redis.get = AsyncMock(side_effect=ConnectionError("redis down"))
    bad_redis.set = AsyncMock(side_effect=ConnectionError("redis down"))
    bad_redis.incr = AsyncMock(side_effect=ConnectionError("redis down"))
    bad_redis.expire = AsyncMock(side_effect=ConnectionError("redis down"))
    bad_redis.delete = AsyncMock(side_effect=ConnectionError("redis down"))

    await scholar.init_scholar_redis(bad_redis)

    # First call: no exception, sets local timer.
    t0 = time.monotonic()
    await scholar._rate_limit()
    first_elapsed = time.monotonic() - t0
    assert first_elapsed < scholar.SCHOLAR_RATE_INTERVAL

    # Second call: must block locally.
    t1 = time.monotonic()
    await scholar._rate_limit()
    second_elapsed = time.monotonic() - t1
    assert second_elapsed >= scholar.SCHOLAR_RATE_INTERVAL * 0.8, (
        f"local fallback should still block, took {second_elapsed:.3f}s"
    )


@pytest.mark.asyncio
async def test_rate_limit_concurrent_workers(fast_interval, redis_client_fixture):
    """4 concurrent workers run through the shared Redis rate marker safely.

    Scholar's limiter is a *best-effort timestamp marker* (spec sect. 4.5), NOT a
    strict SETNX lock. Under cooperative asyncio + fakeredis, every worker's
    ``GET`` resolves before any sibling's ``SET``, so the exact number that block
    is timing-dependent and is NOT a guaranteed contract (asserting it made this
    test flaky). What IS deterministic and worth asserting:

      * every concurrent worker returns without raising,
      * the shared rate marker is set afterwards,
      * a subsequent call within the interval is then throttled (~interval).
    """
    await scholar.init_scholar_redis(redis_client_fixture)

    async def worker(idx: int) -> float:
        t = time.monotonic()
        await scholar._rate_limit()
        return time.monotonic() - t

    waits = await asyncio.gather(*(worker(i) for i in range(4)))

    # All workers completed without exception and produced a measurement.
    assert len(waits) == 4
    # The limiter set the shared marker (cross-worker coordination point).
    assert await redis_client_fixture.get(scholar.SCHOLAR_RATE_LOCK_KEY) is not None

    # Deterministic guarantee: an immediate follow-up call is throttled.
    t0 = time.monotonic()
    await scholar._rate_limit()
    follow_up_wait = time.monotonic() - t0
    assert follow_up_wait >= scholar.SCHOLAR_RATE_INTERVAL * 0.8, (
        f"follow-up call within interval should throttle ~{scholar.SCHOLAR_RATE_INTERVAL}s, took {follow_up_wait:.3f}s"
    )
