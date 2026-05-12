"""
Global rate limiter for Resend API (prevents 429 errors).

Sprint scalabilité — chantier B
================================
Avant ce sprint, le limiter était intra-process (``aiolimiter.AsyncLimiter``).
Avec 4 workers uvicorn, le throughput agrégé pouvait dépasser le cap Resend
(10 req/s) lors de pics (signup massif, password reset spam) → ~56 erreurs 429
par 24h en prod.

Ce module fournit désormais un **token bucket Redis-backed** : capacity et
leak-rate partagés entre tous les workers via une clé Redis atomique. Le cap
``RESEND_RATE_LIMIT_PER_SEC`` est donc un cap *global* (par défaut 10 req/s),
plus un cap par-worker.

Backward compatibility
----------------------
- Si ``REDIS_URL`` est absent → fallback in-memory (``aiolimiter``,
  comportement antérieur). Utilisé en tests et dev local.
- L'API publique (``RESEND_LIMITER`` async context manager,
  ``send_with_rate_limit``) est inchangée.
- Si Redis échoue à runtime (timeout, déconnexion) → fail-open vers le mode
  in-memory pour ne pas bloquer les emails transactionnels critiques.

Algorithme : token bucket Redis
-------------------------------
Chaque acquisition consomme 1 token. La capacité du bucket ré-augmente
linéairement à ``rate`` tokens/seconde (max ``capacity``). Un script Lua
atomique (``GET`` + ``SET`` + ``CAS``) calcule le nombre de tokens disponibles
et le délai d'attente nécessaire si bucket vide.

Configurable via :
- ``RESEND_RATE_LIMIT_PER_SEC`` (rate, default 10)
- ``RESEND_RATE_LIMIT_BURST`` (capacity, default = rate, env override)

Voir docs/RUNBOOK.md §19 "Email DLQ et replay" pour le tuning prod.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Awaitable, Callable, Dict, Optional, TypeVar

from aiolimiter import AsyncLimiter

from core.config import RESEND_RATE_LIMIT_PER_SEC

logger = logging.getLogger("deepsight.email_rate_limiter")

# ─────────────────────────────────────────────────────────────────────────────
# Constants & defaults
# ─────────────────────────────────────────────────────────────────────────────

# Global cap (token bucket capacity = burst). Defaults to the per-second rate
# but can be raised via env to allow short bursts (e.g. cron onboarding flush).
_DEFAULT_GLOBAL_RATE = max(RESEND_RATE_LIMIT_PER_SEC * 4, 10)
GLOBAL_RATE_PER_SEC: int = int(os.environ.get("RESEND_GLOBAL_RATE_PER_SEC", _DEFAULT_GLOBAL_RATE))
BURST_CAPACITY: int = int(os.environ.get("RESEND_RATE_LIMIT_BURST", GLOBAL_RATE_PER_SEC))

# Redis token bucket key (single key, all workers share)
_REDIS_KEY = "deepsight:email:resend:bucket"
# Maximum sleep loops before giving up acquiring a token (safety net)
_MAX_ACQUIRE_LOOPS = 30
# Per-loop sleep upper bound (to avoid pathological waits on huge bursts)
_MAX_PER_LOOP_SLEEP = 2.0

# Defense-in-depth retry config (used by send_with_rate_limit below)
MAX_429_RETRIES: int = int(os.environ.get("RESEND_MAX_429_RETRIES", "4"))
BACKOFF_BASE_SECONDS: float = float(os.environ.get("RESEND_BACKOFF_BASE_SECONDS", "1.0"))


# ─────────────────────────────────────────────────────────────────────────────
# Token bucket Lua script (atomic GET+SET on Redis)
# ─────────────────────────────────────────────────────────────────────────────
#
# KEYS[1] = bucket key
# ARGV[1] = capacity (max tokens)
# ARGV[2] = rate per second
# ARGV[3] = current epoch in milliseconds
# ARGV[4] = tokens requested (always 1 for our use case)
#
# Returns: [allowed (0|1), tokens_remaining, retry_after_ms]
#   - allowed=1 → consumed, retry_after_ms=0
#   - allowed=0 → not enough tokens, retry_after_ms = wait time
#
_TOKEN_BUCKET_LUA = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_ms')
local tokens = tonumber(data[1])
local last_ms = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  last_ms = now_ms
end

-- Refill based on elapsed time
local elapsed_ms = math.max(0, now_ms - last_ms)
local refill = (elapsed_ms / 1000.0) * rate
tokens = math.min(capacity, tokens + refill)

local allowed = 0
local retry_after_ms = 0

if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
else
  -- Time to wait for the missing tokens
  local missing = requested - tokens
  retry_after_ms = math.ceil((missing / rate) * 1000)
end

redis.call('HMSET', key, 'tokens', tokens, 'last_ms', now_ms)
-- Expire after 5 minutes of inactivity (auto-cleanup)
redis.call('PEXPIRE', key, 300000)

return {allowed, tokens, retry_after_ms}
"""


# ─────────────────────────────────────────────────────────────────────────────
# Redis client (lazy-initialized, per-event-loop singleton)
# ─────────────────────────────────────────────────────────────────────────────

_redis_clients: "Dict[asyncio.AbstractEventLoop, Optional[Any]]" = {}
_redis_init_lock = asyncio.Lock()


async def _get_redis_client() -> Optional[Any]:
    """Return a Redis async client, or None if unavailable.

    Cached per event loop. Returns None if:
    - REDIS_URL is empty (dev/tests)
    - redis package is not importable
    - ping fails (Redis down)
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return None

    if loop in _redis_clients:
        return _redis_clients[loop]

    redis_url = os.environ.get("REDIS_URL", "").strip()
    if not redis_url:
        _redis_clients[loop] = None
        return None

    try:
        import redis.asyncio as redis_lib  # type: ignore
    except ImportError:
        logger.warning("redis package not installed — falling back to in-memory rate limiter")
        _redis_clients[loop] = None
        return None

    try:
        client = redis_lib.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
        )
        await client.ping()
        _redis_clients[loop] = client
        logger.info(
            "Email rate limiter using Redis token bucket (rate=%s/s, burst=%s)", GLOBAL_RATE_PER_SEC, BURST_CAPACITY
        )
        return client
    except Exception as e:
        logger.warning("Redis ping failed for email rate limiter, fallback in-memory: %s", e)
        _redis_clients[loop] = None
        return None


# ─────────────────────────────────────────────────────────────────────────────
# In-memory fallback limiter (per event loop, intra-process)
# ─────────────────────────────────────────────────────────────────────────────

_inmemory_limiters: "Dict[asyncio.AbstractEventLoop, AsyncLimiter]" = {}


def _get_inmemory_limiter() -> AsyncLimiter:
    """Per-loop AsyncLimiter (matches the pre-sprint behavior)."""
    loop = asyncio.get_running_loop()
    limiter = _inmemory_limiters.get(loop)
    if limiter is None:
        # Use the per-worker rate (RESEND_RATE_LIMIT_PER_SEC) as before; aggregate
        # remains <= 10 req/s with 4 workers and default RESEND_RATE_LIMIT_PER_SEC=2.
        limiter = AsyncLimiter(
            max_rate=RESEND_RATE_LIMIT_PER_SEC,
            time_period=1.0,
        )
        _inmemory_limiters[loop] = limiter
    return limiter


# ─────────────────────────────────────────────────────────────────────────────
# Public limiter: Redis-aware async context manager
# ─────────────────────────────────────────────────────────────────────────────


class _GlobalLimiterProxy:
    """Context manager that acquires 1 token from the global bucket.

    Usage::

        async with RESEND_LIMITER:
            response = await client.post(...)

    Works whether Redis is up or not (transparent fallback).
    """

    @property
    def max_rate(self) -> float:
        """Effective per-second rate (Redis-backed) for tests/metrics."""
        return float(GLOBAL_RATE_PER_SEC)

    @property
    def per_worker_max_rate(self) -> float:
        """Effective per-worker fallback rate (in-memory mode)."""
        return float(RESEND_RATE_LIMIT_PER_SEC)

    async def __aenter__(self) -> "_GlobalLimiterProxy":
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        # Token bucket has no release: tokens regenerate over time.
        return None

    async def acquire(self) -> None:
        """Block until a token is available (or fall back to in-memory)."""
        client = await _get_redis_client()

        if client is None:
            # No Redis → in-memory limiter (per-worker, comportement pré-sprint).
            limiter = _get_inmemory_limiter()
            await limiter.acquire()
            return

        # Token bucket via Lua script
        for _ in range(_MAX_ACQUIRE_LOOPS):
            try:
                now_ms = int(time.time() * 1000)
                result = await client.eval(
                    _TOKEN_BUCKET_LUA,
                    1,
                    _REDIS_KEY,
                    BURST_CAPACITY,
                    GLOBAL_RATE_PER_SEC,
                    now_ms,
                    1,
                )
                allowed = int(result[0])
                if allowed == 1:
                    return
                # Otherwise wait the suggested delay (cap to avoid pathological waits)
                retry_ms = int(result[2])
                sleep_s = min(_MAX_PER_LOOP_SLEEP, max(0.05, retry_ms / 1000.0))
                await asyncio.sleep(sleep_s)
            except Exception as e:
                # Redis hiccup → degrade gracefully to in-memory for this call
                logger.warning("Redis token bucket error, falling back in-memory: %s", e)
                limiter = _get_inmemory_limiter()
                await limiter.acquire()
                return

        # Safety net: extremely contended bucket. Fall through to in-memory.
        logger.warning("Resend bucket exhausted after %d loops — falling back in-memory", _MAX_ACQUIRE_LOOPS)
        limiter = _get_inmemory_limiter()
        await limiter.acquire()


# Public singleton — same name as before (back-compat).
RESEND_LIMITER: _GlobalLimiterProxy = _GlobalLimiterProxy()


# ─────────────────────────────────────────────────────────────────────────────
# send_with_rate_limit — exponential backoff on 429
# ─────────────────────────────────────────────────────────────────────────────

T = TypeVar("T")


class ResendRateLimitError(Exception):
    """Raised after exhausting all 429 retry attempts against Resend."""


async def send_with_rate_limit(
    send_coro_factory: Callable[[], Awaitable[T]],
    is_rate_limited: Callable[[T], bool],
    *,
    is_retryable_5xx: Optional[Callable[[T], bool]] = None,
    context: str = "",
    max_retries: int = MAX_429_RETRIES,
    backoff_base: float = BACKOFF_BASE_SECONDS,
) -> T:
    """Execute a Resend send coroutine behind the global rate limiter.

    Retries on:
    - 429 (rate limited) — via ``is_rate_limited``
    - 5xx (transient server error) — via optional ``is_retryable_5xx``

    Exponential backoff: ``backoff_base * 2**(attempt-1)``
    Default: 1s, 2s, 4s, 8s (max 4 retries).

    Args:
        send_coro_factory: Zero-arg callable returning a fresh awaitable each
            time. Must be re-callable because we retry it.
        is_rate_limited: Predicate that returns True when the result indicates
            a 429 outcome (retry).
        is_retryable_5xx: Optional predicate for transient 5xx (also retried
            with exponential backoff).
        context: Optional short description of the call site (for logs).
        max_retries: Maximum retry attempts after an initial failure.
        backoff_base: Seconds; delay = backoff_base * 2**(attempt-1).

    Returns:
        The successful (or final non-retryable) result from ``send_coro_factory``.

    Raises:
        ResendRateLimitError: All ``max_retries`` attempts returned 429.
        Exception: Any other exception raised by the underlying send.
    """
    attempt = 0
    last_result: Any = None

    while attempt <= max_retries:
        async with RESEND_LIMITER:
            last_result = await send_coro_factory()

        is_429 = is_rate_limited(last_result)
        is_5xx = bool(is_retryable_5xx and is_retryable_5xx(last_result))

        if not is_429 and not is_5xx:
            return last_result

        attempt += 1
        if attempt > max_retries:
            break

        delay = backoff_base * (2 ** (attempt - 1))
        reason = "429" if is_429 else "5xx"
        logger.warning(
            "Resend %s, retry %d/%d after %.1fs (context=%s)",
            reason,
            attempt,
            max_retries,
            delay,
            context or "n/a",
        )
        await asyncio.sleep(delay)

    if is_rate_limited(last_result):
        logger.error("Resend 429 — all %d retries exhausted (context=%s)", max_retries, context or "n/a")
        raise ResendRateLimitError(f"Resend rate-limited after {max_retries} retries (context={context or 'n/a'})")

    # 5xx exhausted but not 429 → return last result so caller decides (DLQ, etc.)
    return last_result


# ─────────────────────────────────────────────────────────────────────────────
# Test helper (used by test_email_rate_limiter.py)
# ─────────────────────────────────────────────────────────────────────────────


def _reset_state_for_tests() -> None:
    """Clear per-loop caches so each test starts from a fresh limiter.

    Pytest-asyncio creates a new event loop per test; existing entries are
    bound to dead loops and would otherwise leak across tests.
    """
    _redis_clients.clear()
    _inmemory_limiters.clear()
