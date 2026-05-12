"""A+D strict voice quota enforcement for the Quick Voice Call feature.

Spec source: ``docs/superpowers/specs/2026-04-26-quick-voice-call-design.md``
section "e. Voice quota A+D strict".

Plan-to-policy matrix (UPDATED 2026-04-27 — "Expert" tier was retired before
the spec landed, top paid tier is now Pro €12.99/month):
  * Free                    : 1 lifetime trial of 3 minutes
  * Pro / Expert (alias)    : 30 minutes per rolling 30-day window
  * Starter / Student       : refused, CTA upgrade Pro
  * Anything else (legacy)  : refused, CTA upgrade Pro

The Quick Voice Call session router branches on ``check_voice_quota`` to
either let the call start (returning the remaining ``max_minutes``) or raise
a 402 with the structured ``cta`` hint so the extension UI can surface a
contextual upgrade card.

Note: this module is intentionally distinct from the legacy
``voice/quota.py`` (per-month seconds counter for the classic voice chat).
The two coexist on different tables (``voice_quota`` vs ``voice_quotas``).
"""

from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import VoiceQuotaStreaming, User

logger = logging.getLogger(__name__)


# ─── Spec constants (locked decision #4 — A+D strict, VC-1 updated 2026-04-29) ────
# Plan-aware allowance (rolling 30-day window):
#   Pro    : 30 min/month  (statu quo)
#   Expert : 120 min/month (VC-1 audit Kimi : differentiation tier)
MONTHLY_MINUTES_BY_PLAN: dict[str, float] = {
    "pro": 30.0,
    "expert": 120.0,
}
TOP_TIER_MONTHLY_MINUTES: float = 30.0  # legacy alias, kept for callers that don't pass plan
EXPERT_MONTHLY_MINUTES: float = MONTHLY_MINUTES_BY_PLAN["expert"]
FREE_TRIAL_MINUTES: float = 3.0
MONTHLY_PERIOD_DAYS: int = 30

# Plans that grant the rolling monthly minutes quota.
TOP_TIER_PLANS: frozenset[str] = frozenset({"pro", "expert"})


def _plan_monthly_allowance(plan: str) -> float:
    """Return the rolling 30-day minutes cap for a given plan.

    Returns 0.0 for plans without a Quick Voice Call allowance.
    """
    return float(MONTHLY_MINUTES_BY_PLAN.get(plan.lower(), 0.0))


QuotaReason = Literal["trial_used", "pro_no_voice", "monthly_quota"]
QuotaCta = Literal["upgrade_pro", "upgrade_expert"]


@dataclass
class QuotaCheck:
    """Outcome of ``check_voice_quota`` — drives router branching.

    Attributes:
        allowed: True if the call may start.
        max_minutes: Hard cap to enforce in the side panel session timer.
        is_trial: True only for the Free 1-shot lifetime trial.
        reason: Machine-readable refusal reason when ``allowed=False``.
        cta: Contextual CTA hint surfaced by the frontend on a 402 / refusal.
    """

    allowed: bool
    max_minutes: float = 0.0
    is_trial: bool = False
    reason: Optional[QuotaReason] = None
    cta: Optional[QuotaCta] = None


async def _get_or_create_quota(user_id: int, plan: str, db: AsyncSession) -> VoiceQuotaStreaming:
    """Fetch or insert the ``voice_quota`` row for the user.

    Side effect: when the existing row's ``monthly_period_start`` is older
    than ``MONTHLY_PERIOD_DAYS`` days, the rolling counter is reset
    in-memory (the caller commits if it mutates other fields).
    """
    result = await db.execute(select(VoiceQuotaStreaming).where(VoiceQuotaStreaming.user_id == user_id))
    quota = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if quota is None:
        quota = VoiceQuotaStreaming(
            user_id=user_id,
            plan=plan,
            monthly_period_start=now,
            monthly_minutes_used=0.0,
            lifetime_trial_used=False,
            lifetime_trial_used_at=None,
        )
        db.add(quota)
        await db.flush()
        return quota

    # Sync plan field if the user upgraded/downgraded since the row was created
    if quota.plan != plan:
        quota.plan = plan

    # Reset rolling 30-day counter if period elapsed
    period_start = quota.monthly_period_start
    if period_start.tzinfo is None:
        period_start = period_start.replace(tzinfo=timezone.utc)
    if now - period_start > timedelta(days=MONTHLY_PERIOD_DAYS):
        quota.monthly_minutes_used = 0.0
        quota.monthly_period_start = now

    return quota


async def check_voice_quota(user: User, db: AsyncSession) -> QuotaCheck:
    """Check whether ``user`` can start a Quick Voice Call session.

    Returns a structured ``QuotaCheck``. Caller is responsible for raising
    HTTPException(402, ...) and forwarding ``reason`` / ``cta`` to the
    client.

    Normalisation Pricing v2 : legacy "plus" -> "pro" via plan_config aliases.
    """
    from billing.plan_config import normalize_plan_id

    raw_plan = (user.plan or "free").lower()
    plan = normalize_plan_id(raw_plan)  # résout legacy "plus" -> "pro" automatiquement
    quota = await _get_or_create_quota(user.id, plan, db)

    if plan == "free":
        if quota.lifetime_trial_used:
            return QuotaCheck(
                allowed=False,
                reason="trial_used",
                cta="upgrade_pro",
            )
        return QuotaCheck(
            allowed=True,
            max_minutes=FREE_TRIAL_MINUTES,
            is_trial=True,
        )

    if plan in TOP_TIER_PLANS:
        plan_cap = _plan_monthly_allowance(plan)
        remaining_allowance = max(plan_cap - float(quota.monthly_minutes_used or 0.0), 0.0)
        purchased = float(getattr(quota, "purchased_minutes", 0.0) or 0.0)
        total_available = remaining_allowance + purchased
        if total_available <= 0:
            return QuotaCheck(allowed=False, reason="monthly_quota")
        return QuotaCheck(allowed=True, max_minutes=total_available)

    # Starter / Student / unknown legacy plan → blocked, CTA upgrade Pro.
    # We reuse the historical "pro_no_voice" reason code so the existing
    # extension UI (UpgradeCTA / VoiceView) keeps rendering its upgrade card
    # without a release-coupling change.
    logger.info(
        "Plan '%s' is not a top-tier voice plan for user_id=%d — returning upgrade CTA",
        plan,
        user.id,
    )
    return QuotaCheck(
        allowed=False,
        reason="pro_no_voice",
        cta="upgrade_pro",
    )


async def consume_voice_minutes(user: User, minutes: float, db: AsyncSession) -> None:
    """Record ``minutes`` of voice usage against ``user``'s quota.

    Consumption order (locked decision H4 — protect paid minutes from monthly reset):
      1. Plan allowance (rolling 30j) — drained first
      2. Purchased balance (non-expiring) — overflow fallback

    For Free users, flips the lifetime trial flag (single-shot).
    For top-tier users (Pro / Expert), splits ``minutes`` across both buckets:
    plan allowance first, then purchased pack balance.
    For other plans (Starter / Student), no-op — they are blocked upstream by
    ``check_voice_quota``, this stays safe if called by mistake.

    Always commits.
    """
    from billing.plan_config import normalize_plan_id

    raw_plan = (user.plan or "free").lower()
    plan = normalize_plan_id(raw_plan)
    quota = await _get_or_create_quota(user.id, plan, db)

    if plan == "free":
        quota.lifetime_trial_used = True
        quota.lifetime_trial_used_at = datetime.now(timezone.utc)
    elif plan in TOP_TIER_PLANS:
        plan_cap = _plan_monthly_allowance(plan)
        remaining_allowance = max(plan_cap - float(quota.monthly_minutes_used or 0.0), 0.0)
        from_allowance = min(float(minutes), remaining_allowance)
        from_purchased = max(float(minutes) - from_allowance, 0.0)

        quota.monthly_minutes_used = float(quota.monthly_minutes_used or 0.0) + from_allowance
        if from_purchased > 0:
            current_purchased = float(getattr(quota, "purchased_minutes", 0.0) or 0.0)
            # Clamp à 0 — ne jamais descendre sous zéro même si race-condition
            quota.purchased_minutes = max(current_purchased - from_purchased, 0.0)

    await db.commit()
