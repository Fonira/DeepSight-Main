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
        if pong:
            return {"status": "ok"}
        return {"status": "error", "error": "PING returned False"}
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
