"""Scholar daily quota — track per-user daily Google Scholar search count.

Backed by `daily_quotas.scholar_queries` (Integer, NOT NULL DEFAULT 0).
Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md § 6.4, § 9.

Plan limits:
- free   : 0 per day (gated upstream via 403 in router)
- pro    : 5 per day
- expert : 30 per day

This module never raises HTTP errors; the router translates `(False, payload)`
results into HTTP 403/429. Keeps the quota logic plain-async + DB-only so it
can be unit-tested with an in-memory SQLite engine.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import DailyQuota, User


# Daily limits per plan (spec § 9.1). Free is gated upstream — kept here for
# defense in depth if router ever calls into us without checking.
SCHOLAR_DAILY_LIMITS: Dict[str, int] = {
    "free": 0,
    "pro": 5,
    "expert": 30,
}


def _normalize_plan(plan: Optional[str]) -> str:
    """Lowercase + fallback to 'free' for unknown values. Mirrors normalize_plan_id
    behaviour without importing billing (avoid circular)."""
    if not plan:
        return "free"
    p = plan.strip().lower()
    if p in SCHOLAR_DAILY_LIMITS:
        return p
    # Legacy aliases — map plus/starter/student/etudiant → pro (mirrors billing.normalize_plan_id)
    if p in ("plus", "starter", "student", "etudiant", "unlimited"):
        return "pro"
    return "free"


async def get_scholar_daily_usage(session: AsyncSession, user_id: int) -> int:
    """Return today's Scholar query count for `user_id` (0 if no row)."""
    today = date.today().isoformat()
    result = await session.execute(
        select(DailyQuota).where(
            DailyQuota.user_id == user_id,
            DailyQuota.quota_date == today,
        )
    )
    quota = result.scalar_one_or_none()
    if quota is None:
        return 0
    return int(quota.scholar_queries or 0)


def get_scholar_daily_limit(plan: Optional[str]) -> int:
    """Return the daily Scholar query limit for a plan id."""
    return SCHOLAR_DAILY_LIMITS.get(_normalize_plan(plan), 0)


async def check_and_increment_scholar_quota(session: AsyncSession, user: User) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """Atomically check the daily Scholar quota and increment if allowed.

    Returns:
        (True, None) if the query is allowed — the counter is incremented and
        committed before returning.
        (False, error_payload) otherwise — error_payload is a dict suitable
        for an HTTPException detail body.

    Notes:
        - Free plan always returns `(False, plan_required-ish)` because limit=0;
          the router catches this case earlier with a 403, so this branch is
          defense in depth.
        - Commit is local to this function. Caller can still raise afterwards
          without rollback (the counter increment is intentional even if the
          downstream Scholar fetch fails — we count attempted queries).
    """
    plan = _normalize_plan(user.plan)
    limit = SCHOLAR_DAILY_LIMITS.get(plan, 0)

    if limit == 0:
        return False, {
            "code": "scholar_not_allowed",
            "message": "Plan does not allow Scholar search.",
            "current_plan": plan,
        }

    today = date.today().isoformat()
    result = await session.execute(
        select(DailyQuota).where(
            DailyQuota.user_id == user.id,
            DailyQuota.quota_date == today,
        )
    )
    quota = result.scalar_one_or_none()
    current = int(quota.scholar_queries or 0) if quota else 0

    if current >= limit:
        return False, {
            "code": "scholar_daily_limit_reached",
            "message": f"Scholar daily quota reached ({current}/{limit}). Resets next day 00:00 UTC.",
            "current_usage": current,
            "daily_limit": limit,
            "resets_at": "next day 00:00 UTC",
        }

    if quota is not None:
        quota.scholar_queries = current + 1
    else:
        session.add(
            DailyQuota(
                user_id=user.id,
                quota_date=today,
                videos_used=0,
                scholar_queries=1,
            )
        )
    await session.commit()
    return True, None
