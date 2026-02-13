"""
Health check functions for DeepSight services.

Each check returns a ServiceStatus dict with:
  name, status (operational/degraded/down), latency_ms, message, last_checked
"""

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import httpx

# ---------------------------------------------------------------------------
# Type alias
# ---------------------------------------------------------------------------

ServiceStatus = Dict[str, Any]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------

async def check_database() -> ServiceStatus:
    """Ping database with SELECT 1."""
    try:
        from db.database import async_session_maker
        from sqlalchemy import text

        start = time.perf_counter()
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        latency = (time.perf_counter() - start) * 1000

        return {
            "name": "database",
            "status": "operational",
            "latency_ms": round(latency, 2),
            "message": None,
            "last_checked": _now_iso(),
        }
    except Exception as e:
        return {
            "name": "database",
            "status": "down",
            "latency_ms": None,
            "message": str(e)[:120],
            "last_checked": _now_iso(),
        }


async def check_stripe() -> ServiceStatus:
    """Validate Stripe connectivity via Account.retrieve()."""
    try:
        import stripe
        from billing.router import init_stripe

        if not init_stripe():
            return {
                "name": "stripe",
                "status": "degraded",
                "latency_ms": None,
                "message": "Stripe API key not configured",
                "last_checked": _now_iso(),
            }

        start = time.perf_counter()
        await asyncio.to_thread(stripe.Account.retrieve)
        latency = (time.perf_counter() - start) * 1000

        return {
            "name": "stripe",
            "status": "operational",
            "latency_ms": round(latency, 2),
            "message": None,
            "last_checked": _now_iso(),
        }
    except Exception as e:
        return {
            "name": "stripe",
            "status": "down",
            "latency_ms": None,
            "message": str(e)[:120],
            "last_checked": _now_iso(),
        }


async def check_mistral() -> ServiceStatus:
    """GET /v1/models — zero-cost endpoint that validates the API key."""
    try:
        from core.config import MISTRAL_API_KEY

        if not MISTRAL_API_KEY:
            return {
                "name": "mistral",
                "status": "degraded",
                "latency_ms": None,
                "message": "API key not configured",
                "last_checked": _now_iso(),
            }

        start = time.perf_counter()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.mistral.ai/v1/models",
                headers={"Authorization": f"Bearer {MISTRAL_API_KEY}"},
            )
        latency = (time.perf_counter() - start) * 1000

        if resp.status_code == 200:
            return {
                "name": "mistral",
                "status": "operational",
                "latency_ms": round(latency, 2),
                "message": None,
                "last_checked": _now_iso(),
            }
        return {
            "name": "mistral",
            "status": "degraded",
            "latency_ms": round(latency, 2),
            "message": f"HTTP {resp.status_code}",
            "last_checked": _now_iso(),
        }
    except Exception as e:
        return {
            "name": "mistral",
            "status": "down",
            "latency_ms": None,
            "message": str(e)[:120],
            "last_checked": _now_iso(),
        }


async def check_perplexity() -> ServiceStatus:
    """POST completions with max_tokens=1 — validates key + connectivity."""
    try:
        from core.config import PERPLEXITY_API_KEY

        if not PERPLEXITY_API_KEY:
            return {
                "name": "perplexity",
                "status": "degraded",
                "latency_ms": None,
                "message": "API key not configured",
                "last_checked": _now_iso(),
            }

        start = time.perf_counter()
        async with httpx.AsyncClient(timeout=10) as client:
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
        latency = (time.perf_counter() - start) * 1000

        if resp.status_code == 200:
            return {
                "name": "perplexity",
                "status": "operational",
                "latency_ms": round(latency, 2),
                "message": None,
                "last_checked": _now_iso(),
            }
        return {
            "name": "perplexity",
            "status": "degraded",
            "latency_ms": round(latency, 2),
            "message": f"HTTP {resp.status_code}",
            "last_checked": _now_iso(),
        }
    except Exception as e:
        return {
            "name": "perplexity",
            "status": "down",
            "latency_ms": None,
            "message": str(e)[:120],
            "last_checked": _now_iso(),
        }


async def check_resend() -> ServiceStatus:
    """Validate Resend email service connectivity via API key check."""
    try:
        from core.config import EMAIL_CONFIG

        api_key = EMAIL_CONFIG.get("RESEND_API_KEY", "")
        if not api_key:
            return {
                "name": "resend",
                "status": "degraded",
                "latency_ms": None,
                "message": "API key not configured",
                "last_checked": _now_iso(),
            }

        start = time.perf_counter()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.resend.com/domains",
                headers={"Authorization": f"Bearer {api_key}"},
            )
        latency = (time.perf_counter() - start) * 1000

        if resp.status_code == 200:
            return {
                "name": "resend",
                "status": "operational",
                "latency_ms": round(latency, 2),
                "message": None,
                "last_checked": _now_iso(),
            }
        return {
            "name": "resend",
            "status": "degraded",
            "latency_ms": round(latency, 2),
            "message": f"HTTP {resp.status_code}",
            "last_checked": _now_iso(),
        }
    except Exception as e:
        return {
            "name": "resend",
            "status": "down",
            "latency_ms": None,
            "message": str(e)[:120],
            "last_checked": _now_iso(),
        }


def get_memory_usage() -> Dict[str, Any]:
    """Return current process memory usage — critical for Railway 512MB."""
    import os
    try:
        import resource
        # Linux: getrusage returns max RSS in KB
        rusage = resource.getrusage(resource.RUSAGE_SELF)
        rss_mb = round(rusage.ru_maxrss / 1024, 2)  # KB → MB
    except ImportError:
        rss_mb = None

    # Fallback via /proc for Linux containers (Railway)
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    rss_mb = round(int(line.split()[1]) / 1024, 2)  # KB → MB
                    break
    except (FileNotFoundError, PermissionError):
        pass

    # Railway limit
    limit_mb = int(os.environ.get("RAILWAY_MEMORY_LIMIT_MB", "512"))

    return {
        "rss_mb": rss_mb,
        "limit_mb": limit_mb,
        "usage_percent": round((rss_mb / limit_mb) * 100, 1) if rss_mb else None,
        "status": (
            "critical" if rss_mb and rss_mb > limit_mb * 0.85
            else "warning" if rss_mb and rss_mb > limit_mb * 0.70
            else "healthy" if rss_mb
            else "unknown"
        ),
    }


# ---------------------------------------------------------------------------
# Aggregate
# ---------------------------------------------------------------------------

async def run_all_checks() -> List[ServiceStatus]:
    """Run all health checks concurrently and return results."""
    results = await asyncio.gather(
        check_database(),
        check_stripe(),
        check_mistral(),
        check_perplexity(),
        check_resend(),
        return_exceptions=True,
    )

    sanitized: List[ServiceStatus] = []
    names = ["database", "stripe", "mistral", "perplexity", "resend"]
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            sanitized.append({
                "name": names[i],
                "status": "down",
                "latency_ms": None,
                "message": str(result)[:120],
                "last_checked": _now_iso(),
            })
        else:
            sanitized.append(result)

    return sanitized
