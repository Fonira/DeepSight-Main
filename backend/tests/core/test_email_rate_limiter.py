"""Tests for core/email_rate_limiter.py — Resend rate limiter + 429 retry."""

from __future__ import annotations

import asyncio
import time
from typing import List
from unittest.mock import AsyncMock

import pytest

from core.email_rate_limiter import (
    RESEND_LIMITER,
    ResendRateLimitError,
    send_with_rate_limit,
)


class _FakeResponse:
    """Lightweight stand-in for httpx.Response — only status_code is used."""

    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


def _is_429(resp: _FakeResponse) -> bool:
    return resp.status_code == 429


@pytest.mark.asyncio
async def test_rate_limiter_caps_concurrent_sends() -> None:
    """N concurrent calls must be throttled by the limiter.

    ``aiolimiter`` is a leaky bucket with ``max_rate`` tokens per ``time_period``
    that refill continuously. Given N=10 calls through a limiter of 2 req/s,
    the total wall time must be at least ``(N - max_rate) / max_rate`` seconds
    — the initial burst empties the bucket, then the remaining calls must wait
    for token refills.

    We assert a lower bound on elapsed time rather than a strict rolling-window
    count, because cold-start bursts can technically fit 3 calls inside any 1s
    window (2 at t=0, 1 at t=0.5) without violating the average rate.
    """
    max_rate = RESEND_LIMITER.max_rate
    n_calls = 10
    timestamps: List[float] = []

    async def _send() -> _FakeResponse:
        timestamps.append(time.monotonic())
        return _FakeResponse(200)

    start = time.monotonic()
    await asyncio.gather(
        *[
            send_with_rate_limit(
                _send,
                is_rate_limited=_is_429,
                context=f"concurrent-{i}",
                max_retries=0,
            )
            for i in range(n_calls)
        ]
    )
    elapsed = time.monotonic() - start

    assert len(timestamps) == n_calls

    # Lower bound: with max_rate tokens available at t=0 and 1 token refilled
    # per (time_period / max_rate) seconds, the last call finishes no earlier
    # than (n_calls - max_rate) / max_rate seconds. Apply a small tolerance
    # (0.9x) for scheduler jitter.
    expected_min = (n_calls - max_rate) / max_rate * 0.9
    assert elapsed >= expected_min, (
        f"Rate limiter too permissive: {n_calls} calls finished in "
        f"{elapsed:.3f}s (expected >= {expected_min:.3f}s for rate={max_rate}/s)"
    )

    # Sanity: average throughput never exceeds max_rate + small burst tolerance.
    # The measured average over the full duration must be <= max_rate (since
    # the limiter is a leaky bucket with that steady-state rate).
    if elapsed > 0:
        avg_rate = n_calls / elapsed
        # Allow +1 for the initial burst (max_rate tokens at t=0 count against
        # a tiny elapsed duration on the very first instant).
        assert avg_rate <= max_rate + 1, (
            f"Average rate {avg_rate:.2f}/s exceeds limit {max_rate}/s"
        )


@pytest.mark.asyncio
async def test_retry_429_exhausts_and_raises() -> None:
    """If every attempt returns 429, we retry 3 times then raise ResendRateLimitError."""
    attempts = {"count": 0}

    async def _always_429() -> _FakeResponse:
        attempts["count"] += 1
        return _FakeResponse(429)

    with pytest.raises(ResendRateLimitError):
        await send_with_rate_limit(
            _always_429,
            is_rate_limited=_is_429,
            context="always-429",
            max_retries=3,
            backoff_base=0.0,  # Keep the test fast
        )

    # 1 initial attempt + 3 retries = 4 total
    assert attempts["count"] == 4


@pytest.mark.asyncio
async def test_retry_429_succeeds_on_second_attempt() -> None:
    """If Resend returns 429 once then 200, no exception should be raised."""
    calls = {"n": 0}

    async def _flaky() -> _FakeResponse:
        calls["n"] += 1
        if calls["n"] == 1:
            return _FakeResponse(429)
        return _FakeResponse(200)

    result = await send_with_rate_limit(
        _flaky,
        is_rate_limited=_is_429,
        context="flaky",
        max_retries=3,
        backoff_base=0.0,
    )

    assert result.status_code == 200
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_send_coro_factory_is_called_fresh_on_each_retry() -> None:
    """The factory must be re-invoked on each retry (not the same awaitable reused)."""
    mock = AsyncMock(
        side_effect=[_FakeResponse(429), _FakeResponse(429), _FakeResponse(200)]
    )

    async def _factory() -> _FakeResponse:
        return await mock()

    result = await send_with_rate_limit(
        _factory,
        is_rate_limited=_is_429,
        context="fresh-factory",
        max_retries=3,
        backoff_base=0.0,
    )

    assert result.status_code == 200
    assert mock.await_count == 3
