"""
Monitoring router — /ping, /status, /db, and CRON endpoints.

Mounted at /api/health in main.py so:
  GET /api/health/ping   → lightweight liveness
  GET /api/health/status  → full service status
  GET /api/health/db      → database version, migrations, size, connections
  POST /api/health/cron/onboarding → trigger onboarding email sequence
"""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession

from monitoring.checks import run_all_checks, get_memory_usage
from db.database import get_session

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
        "memory": get_memory_usage(),
        "services": services,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


# ───────────────────────────────────────────────────────────────────────────
# GET /db — Database health with version, migrations, size, connections
# ───────────────────────────────────────────────────────────────────────────

@router.get("/db")
async def db_health():
    """
    Database health endpoint.

    Returns PostgreSQL version, current/head Alembic migration,
    database size, and active connection count.
    """
    from sqlalchemy import text
    from db.database import async_session_maker

    result = {
        "database": {
            "status": "unknown",
            "latency_ms": None,
            "version": None,
            "size_mb": None,
            "active_connections": None,
            "max_connections": None,
        },
        "migrations": {
            "current_revision": None,
            "head_revision": None,
            "pending": None,
            "is_up_to_date": None,
        },
    }

    try:
        start = time.time()
        async with async_session_maker() as session:
            # PostgreSQL version
            row = await session.execute(text("SELECT version()"))
            pg_version = row.scalar()

            latency = round((time.time() - start) * 1000, 2)

            # Database size
            row = await session.execute(
                text("SELECT pg_database_size(current_database())")
            )
            db_size_bytes = row.scalar() or 0
            size_mb = round(db_size_bytes / (1024 * 1024), 2)

            # Active connections
            row = await session.execute(
                text("SELECT count(*) FROM pg_stat_activity WHERE state = 'active'")
            )
            active_conns = row.scalar() or 0

            # Max connections
            row = await session.execute(text("SHOW max_connections"))
            max_conns = int(row.scalar() or 100)

            result["database"].update({
                "status": "healthy",
                "latency_ms": latency,
                "version": pg_version,
                "size_mb": size_mb,
                "active_connections": active_conns,
                "max_connections": max_conns,
            })

    except Exception as e:
        result["database"]["status"] = "unhealthy"
        result["database"]["error"] = str(e)[:200]

    # Alembic migration status
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        from alembic.runtime.migration import MigrationContext

        import os
        alembic_cfg = Config(
            os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini")
        )
        alembic_cfg.set_main_option(
            "script_location",
            os.path.join(os.path.dirname(__file__), "..", "..", "alembic"),
        )
        script = ScriptDirectory.from_config(alembic_cfg)
        head_rev = script.get_current_head()

        # Get current revision from DB
        from db.database import engine
        async with engine.connect() as conn:
            def _get_current(sync_conn):
                ctx = MigrationContext.configure(sync_conn)
                return ctx.get_current_revision()

            current_rev = await conn.run_sync(_get_current)

        pending = 0
        if current_rev != head_rev and head_rev is not None:
            revs = list(script.iterate_revisions(head_rev, current_rev or "base"))
            pending = len(revs)

        result["migrations"].update({
            "current_revision": current_rev,
            "head_revision": head_rev,
            "pending": pending,
            "is_up_to_date": current_rev == head_rev,
        })

    except Exception as e:
        result["migrations"]["error"] = str(e)[:200]

    return result


# ───────────────────────────────────────────────────────────────────────────
# POST /cron/onboarding — Trigger onboarding email sequence
# ───────────────────────────────────────────────────────────────────────────

async def _verify_cron_secret(x_cron_secret: str = Header(None)) -> None:
    """Vérifie le secret CRON pour protéger les endpoints internes."""
    from core.config import settings
    expected = getattr(settings, 'CRON_SECRET', None) or "deepsight-cron-secret"
    if not x_cron_secret or x_cron_secret != expected:
        raise HTTPException(status_code=403, detail="Invalid CRON secret")


@router.post("/cron/onboarding", include_in_schema=False)
async def trigger_onboarding_emails(
    db: AsyncSession = Depends(get_session),
    _auth: None = Depends(_verify_cron_secret),
):
    """
    Déclenche la séquence d'emails onboarding (J+2 feature discovery, J+7 engagement).

    Appelé par Railway Cron Job toutes les heures.
    Idempotent : ne renvoie jamais un email déjà envoyé.

    Header requis : X-Cron-Secret
    """
    from core.logging import logger

    try:
        from services.onboarding_emails import process_onboarding_emails
        stats = await process_onboarding_emails(db)
        logger.info("Onboarding CRON completed", extra=stats)
        return {
            "status": "ok",
            "stats": stats,
            "executed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("Onboarding CRON failed", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Onboarding CRON error: {str(e)[:200]}")
