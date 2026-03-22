"""
Health Check Router — /api/v1/health

GET /api/v1/health       → Simple PostgreSQL ping (public)
GET /api/v1/health/deep  → Full parallel dependency check (protected by secret)
"""

import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from core.config import (
    HEALTH_CHECK_SECRET,
    MISTRAL_API_KEY,
    PERPLEXITY_API_KEY,
    BRAVE_SEARCH_API_KEY,
    EMAIL_CONFIG,
)

router = APIRouter(tags=["Health Check"])

VERSION = os.environ.get("APP_VERSION", "")
if not VERSION:
    try:
        from core.config import VERSION as _CFG_VERSION
        VERSION = _CFG_VERSION
    except ImportError:
        VERSION = "unknown"

# Timeout per individual check (seconds)
CHECK_TIMEOUT = 10

# Critical services — if any is down, overall status is "unhealthy"
CRITICAL_SERVICES = {"database", "stripe"}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _timed_check(
    name: str,
    coro,
) -> Dict[str, Any]:
    """Run a check coroutine with a timeout and return a standardised result."""
    start = time.perf_counter()
    try:
        result = await asyncio.wait_for(coro, timeout=CHECK_TIMEOUT)
        latency = round((time.perf_counter() - start) * 1000, 2)
        return {
            "status": result.get("status", "ok"),
            "latency_ms": latency,
            **({"error": result["error"]} if result.get("error") else {}),
        }
    except asyncio.TimeoutError:
        return {
            "status": "timeout",
            "latency_ms": round((time.perf_counter() - start) * 1000, 2),
            "error": f"Timeout after {CHECK_TIMEOUT}s",
        }
    except Exception as e:
        return {
            "status": "error",
            "latency_ms": round((time.perf_counter() - start) * 1000, 2),
            "error": str(e)[:200],
        }


# ─────────────────────────────────────────────────────────────────────────────
# Individual checks
# ─────────────────────────────────────────────────────────────────────────────

async def _check_database() -> Dict[str, Any]:
    from db.database import async_session_maker
    from sqlalchemy import text

    async with async_session_maker() as session:
        await session.execute(text("SELECT 1"))
    return {"status": "ok"}


async def _check_redis() -> Dict[str, Any]:
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        return {"status": "error", "error": "REDIS_URL not configured"}

    import redis.asyncio as aioredis

    r = aioredis.from_url(redis_url, socket_connect_timeout=CHECK_TIMEOUT)
    try:
        pong = await r.ping()
        if not pong:
            return {"status": "error", "error": "PING returned False"}

        info = await r.info(section="all")
        db_size = await r.dbsize()

        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        total = hits + misses
        hit_ratio = round(hits / total, 2) if total > 0 else None

        uptime_s = info.get("uptime_in_seconds", 0)

        return {
            "status": "ok",
            "connected_clients": info.get("connected_clients"),
            "memory": info.get("used_memory_human", "unknown"),
            "hit_ratio": hit_ratio,
            "uptime_hours": round(uptime_s / 3600, 1),
            "keys": db_size,
        }
    finally:
        await r.aclose()


async def _check_mistral() -> Dict[str, Any]:
    if not MISTRAL_API_KEY:
        return {"status": "error", "error": "MISTRAL_API_KEY not configured"}

    async with httpx.AsyncClient(timeout=CHECK_TIMEOUT) as client:
        resp = await client.get(
            "https://api.mistral.ai/v1/models",
            headers={"Authorization": f"Bearer {MISTRAL_API_KEY}"},
        )
    if resp.status_code == 200:
        return {"status": "ok"}
    return {"status": "error", "error": f"HTTP {resp.status_code}"}


async def _check_perplexity() -> Dict[str, Any]:
    if not PERPLEXITY_API_KEY:
        return {"status": "error", "error": "PERPLEXITY_API_KEY not configured"}

    async with httpx.AsyncClient(timeout=CHECK_TIMEOUT) as client:
        resp = await client.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "sonar",
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1,
            },
        )
    # 200 = OK, 422 = validation error but API is up
    if resp.status_code in (200, 422):
        return {"status": "ok"}
    return {"status": "error", "error": f"HTTP {resp.status_code}"}


async def _check_stripe() -> Dict[str, Any]:
    from core.config import get_stripe_key

    stripe_key = get_stripe_key()
    if not stripe_key:
        return {"status": "error", "error": "Stripe key not configured"}

    async with httpx.AsyncClient(timeout=CHECK_TIMEOUT) as client:
        resp = await client.get(
            "https://api.stripe.com/v1/balance",
            headers={"Authorization": f"Bearer {stripe_key}"},
        )
    if resp.status_code == 200:
        return {"status": "ok"}
    return {"status": "error", "error": f"HTTP {resp.status_code}"}


async def _check_resend() -> Dict[str, Any]:
    api_key = EMAIL_CONFIG.get("RESEND_API_KEY", "")
    if not api_key:
        return {"status": "error", "error": "RESEND_API_KEY not configured"}

    async with httpx.AsyncClient(timeout=CHECK_TIMEOUT) as client:
        resp = await client.get(
            "https://api.resend.com/domains",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if resp.status_code == 200:
        return {"status": "ok"}
    return {"status": "error", "error": f"HTTP {resp.status_code}"}


async def _check_brave() -> Dict[str, Any]:
    if not BRAVE_SEARCH_API_KEY:
        return {"status": "error", "error": "BRAVE_API_KEY not configured"}

    async with httpx.AsyncClient(timeout=CHECK_TIMEOUT) as client:
        resp = await client.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": "test", "count": "1"},
            headers={"X-Subscription-Token": BRAVE_SEARCH_API_KEY},
        )
    if resp.status_code == 200:
        return {"status": "ok"}
    return {"status": "error", "error": f"HTTP {resp.status_code}"}


async def _check_frontend() -> Dict[str, Any]:
    async with httpx.AsyncClient(
        timeout=CHECK_TIMEOUT,
        follow_redirects=True,
    ) as client:
        resp = await client.get("https://deepsightsynthesis.com")
    if resp.status_code == 200:
        return {"status": "ok"}
    return {"status": "error", "error": f"HTTP {resp.status_code}"}


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("")
async def health_simple():
    """
    Simple health check — tests PostgreSQL connectivity only.

    Returns 200 if healthy, 503 if unhealthy.
    """
    start = time.perf_counter()
    try:
        db_result = await _timed_check("database", _check_database())
        is_healthy = db_result["status"] == "ok"

        body = {
            "status": "healthy" if is_healthy else "unhealthy",
            "timestamp": _now_iso(),
            "version": VERSION,
        }

        if not is_healthy:
            return JSONResponse(status_code=503, content=body)
        return body

    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": _now_iso(),
                "version": VERSION,
                "error": str(e)[:200],
            },
        )


@router.get("/deep")
async def health_deep(secret: str = Query(default="")):
    """
    Deep health check — tests ALL external dependencies in parallel.

    Protected by HEALTH_CHECK_SECRET query parameter.
    Returns detailed status for each service.
    """
    # Auth
    if not HEALTH_CHECK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="HEALTH_CHECK_SECRET not configured on server",
        )
    if secret != HEALTH_CHECK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")

    # Run all checks in parallel
    check_tasks = {
        "database": _check_database(),
        "redis": _check_redis(),
        "mistral": _check_mistral(),
        "perplexity": _check_perplexity(),
        "stripe": _check_stripe(),
        "resend": _check_resend(),
        "brave_search": _check_brave(),
        "frontend": _check_frontend(),
    }

    names = list(check_tasks.keys())
    coros = [_timed_check(name, coro) for name, coro in check_tasks.items()]
    results = await asyncio.gather(*coros, return_exceptions=True)

    services: Dict[str, Any] = {}
    for i, name in enumerate(names):
        result = results[i]
        if isinstance(result, Exception):
            services[name] = {
                "status": "error",
                "latency_ms": None,
                "error": str(result)[:200],
            }
        else:
            services[name] = result

    # Determine overall status
    all_ok = all(s.get("status") == "ok" for s in services.values())
    critical_down = any(
        services.get(svc, {}).get("status") != "ok"
        for svc in CRITICAL_SERVICES
    )

    if critical_down:
        overall = "unhealthy"
    elif all_ok:
        overall = "healthy"
    else:
        overall = "degraded"

    status_code = 200 if overall != "unhealthy" else 503

    body = {
        "status": overall,
        "timestamp": _now_iso(),
        "version": VERSION,
        "services": services,
    }

    return JSONResponse(status_code=status_code, content=body)


# ─────────────────────────────────────────────────────────────────────────────
# GET /redis — Detailed Redis metrics (secret-protected)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/redis")
async def health_redis(secret: str = Query(default="")):
    """
    Detailed Redis health — memory, stats, clients, keyspace, slow log.

    Protected by HEALTH_CHECK_SECRET query parameter.
    """
    if not HEALTH_CHECK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="HEALTH_CHECK_SECRET not configured on server",
        )
    if secret != HEALTH_CHECK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")

    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "error": "REDIS_URL not configured"},
        )

    import redis.asyncio as aioredis

    r = aioredis.from_url(redis_url, socket_connect_timeout=5)
    try:
        start = time.perf_counter()
        await r.ping()
        latency = round((time.perf_counter() - start) * 1000, 2)

        info_memory = await r.info(section="memory")
        info_stats = await r.info(section="stats")
        info_clients = await r.info(section="clients")
        info_keyspace = await r.info(section="keyspace")
        info_server = await r.info(section="server")
        db_size = await r.dbsize()

        # Slow log (last 5 entries)
        slow_log_raw: list = await r.slowlog_get(5)
        slow_log = [
            {
                "id": entry.get("id"),
                "duration_us": entry.get("duration"),
                "command": entry.get("command", b"").decode("utf-8", errors="replace")
                if isinstance(entry.get("command"), bytes)
                else str(entry.get("command", "")),
                "timestamp": entry.get("start_time"),
            }
            for entry in slow_log_raw
        ] if slow_log_raw else []

        # Hit ratio
        hits = info_stats.get("keyspace_hits", 0)
        misses = info_stats.get("keyspace_misses", 0)
        total = hits + misses
        hit_ratio = round(hits / total, 4) if total > 0 else None

        # Keyspace db0 info
        db0 = info_keyspace.get("db0", {})
        db0_keys = db0.get("keys", 0) if isinstance(db0, dict) else None

        frag_ratio = info_memory.get("mem_fragmentation_ratio")

        return {
            "status": "operational",
            "timestamp": _now_iso(),
            "latency_ms": latency,
            "memory": {
                "used_memory_human": info_memory.get("used_memory_human"),
                "used_memory_peak_human": info_memory.get("used_memory_peak_human"),
                "fragmentation_ratio": float(frag_ratio) if frag_ratio else None,
                "maxmemory_human": info_memory.get("maxmemory_human"),
            },
            "stats": {
                "keyspace_hits": hits,
                "keyspace_misses": misses,
                "hit_ratio": hit_ratio,
                "expired_keys": info_stats.get("expired_keys", 0),
                "evicted_keys": info_stats.get("evicted_keys", 0),
                "total_commands_processed": info_stats.get("total_commands_processed", 0),
            },
            "clients": {
                "connected_clients": info_clients.get("connected_clients"),
                "blocked_clients": info_clients.get("blocked_clients"),
            },
            "keyspace": {
                "db_size": db_size,
                "db0_keys": db0_keys,
            },
            "server": {
                "redis_version": info_server.get("redis_version"),
                "uptime_hours": round(info_server.get("uptime_in_seconds", 0) / 3600, 1),
            },
            "slow_log": slow_log,
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "down",
                "timestamp": _now_iso(),
                "error": str(e)[:200],
            },
        )
    finally:
        await r.aclose()
