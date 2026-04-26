"""
Global async rate limiter for Resend API (prevents 429 errors).

⚠️ Multi-worker caveat
----------------------
The backend runs uvicorn with 4 workers. ``aiolimiter.AsyncLimiter`` is an
intra-process primitive — it does **not** coordinate across workers. Therefore
the effective Resend throughput is ``RESEND_RATE_LIMIT_PER_SEC * 4``.

Resend free tier caps at 2 req/s; paid tiers allow 5–10 req/s. We default to
``RESEND_RATE_LIMIT_PER_SEC=2`` so that even with 4 workers the aggregate stays
at ~8 req/s — comfortably under the 10 req/s paid-tier ceiling.

Configure via the ``RESEND_RATE_LIMIT_PER_SEC`` env var.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Dict, TypeVar

from aiolimiter import AsyncLimiter

from core.config import RESEND_RATE_LIMIT_PER_SEC

logger = logging.getLogger("deepsight.email_rate_limiter")

# Max retries for defense-in-depth against 429 responses that slip through
# the limiter (e.g. clock skew, multi-worker contention, Resend side hiccups).
MAX_429_RETRIES: int = 3
# Exponential backoff base delay: 1s, 2s, 4s
BACKOFF_BASE_SECONDS: float = 1.0


# One AsyncLimiter per event loop to avoid cross-loop reuse warnings.
# In production (uvicorn, 1 loop per worker) this dict ends up with 1 entry.
# In tests (pytest-asyncio spawns a fresh loop per test) we get one per loop.
_limiters: "Dict[asyncio.AbstractEventLoop, AsyncLimiter]" = {}


def get_resend_limiter() -> AsyncLimiter:
    """Return the AsyncLimiter bound to the current running event loop."""
    loop = asyncio.get_running_loop()
    limiter = _limiters.get(loop)
    if limiter is None:
        limiter = AsyncLimiter(
            max_rate=RESEND_RATE_LIMIT_PER_SEC,
            time_period=1.0,
        )
        _limiters[loop] = limiter
    return limiter


class _LimiterProxy:
    """Back-compat proxy: ``RESEND_LIMITER`` keeps working as ``async with``."""

    @property
    def max_rate(self) -> float:
        # Exposed for tests/metrics. The value is a static config, safe to
        # return even when no loop is running.
        return RESEND_RATE_LIMIT_PER_SEC

    async def __aenter__(self) -> AsyncLimiter:
        limiter = get_resend_limiter()
        await limiter.__aenter__()
        return limiter

    async def __aexit__(self, exc_type, exc, tb) -> None:
        limiter = get_resend_limiter()
        await limiter.__aexit__(exc_type, exc, tb)


# Public singleton. Usable as ``async with RESEND_LIMITER: ...``
RESEND_LIMITER: _LimiterProxy = _LimiterProxy()


T = TypeVar("T")


class ResendRateLimitError(Exception):
    """Raised after exhausting all 429 retry attempts against Resend."""


async def send_with_rate_limit(
    send_coro_factory: Callable[[], Awaitable[T]],
    is_rate_limited: Callable[[T], bool],
    *,
    context: str = "",
    max_retries: int = MAX_429_RETRIES,
    backoff_base: float = BACKOFF_BASE_SECONDS,
) -> T:
    """
    Execute a Resend send coroutine behind the global rate limiter,
    with exponential-backoff retry on 429 responses.

    Args:
        send_coro_factory: Zero-arg callable returning a fresh awaitable each
            time. Must be re-callable because we retry it on 429.
        is_rate_limited: Predicate that returns True when the result indicates
            a 429 (rate limit) outcome and we should retry.
        context: Optional short description of the call site (for logs).
        max_retries: Maximum retry attempts after an initial failure.
        backoff_base: Seconds; delay = backoff_base * 2**(attempt-1).

    Returns:
        The successful result from ``send_coro_factory``.

    Raises:
        ResendRateLimitError: All ``max_retries`` attempts returned 429.
        Exception: Any other exception raised by the underlying send.
    """
    attempt = 0
    last_result: Any = None

    while attempt <= max_retries:
        async with RESEND_LIMITER:
            last_result = await send_coro_factory()

        if not is_rate_limited(last_result):
            return last_result

        attempt += 1
        if attempt > max_retries:
            break

        delay = backoff_base * (2 ** (attempt - 1))
        logger.warning(f"Resend 429, retry {attempt}/{max_retries} after {delay}s (context={context or 'n/a'})")
        await asyncio.sleep(delay)

    logger.error(f"Resend 429 — all {max_retries} retries exhausted (context={context or 'n/a'})")
    raise ResendRateLimitError(f"Resend rate-limited after {max_retries} retries (context={context or 'n/a'})")
