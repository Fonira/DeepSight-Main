"""
Monitoring router — /ping and /status endpoints.

Mounted at /api/health in main.py so:
  GET /api/health/ping   → lightweight liveness
  GET /api/health/status  → full service status
"""

import time
from datetime import datetime, timezone

from fastapi import APIRouter

from monitoring.checks import run_all_checks

router = APIRouter(tags=["Monitoring"])

try:
    from core.config import VERSION
except ImportError:
    VERSION = "4.0.0"

# Set at application startup (from main.py)
_startup_time: float | None = None


def set_startup_time(t: float) -> None:
    global _startup_time
    _startup_time = t


# ───────────────────────────────────────────────────────────────────────────
# GET /ping
# ───────────────────────────────────────────────────────────────────────────

@router.get("/ping")
async def ping():
    """Lightweight liveness probe."""
    return {"status": "ok"}


# ───────────────────────────────────────────────────────────────────────────
# GET /status
# ───────────────────────────────────────────────────────────────────────────

@router.get("/status")
async def status():
    """Full service status with latency per service, version, and uptime."""
    services = await run_all_checks()

    # Derive overall status
    statuses = [s["status"] for s in services]
    if "down" in statuses:
        overall = "down"
    elif "degraded" in statuses:
        overall = "degraded"
    else:
        overall = "operational"

    uptime = None
    if _startup_time is not None:
        uptime = round(time.time() - _startup_time, 1)

    return {
        "status": overall,
        "version": VERSION,
        "uptime_seconds": uptime,
        "services": services,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
