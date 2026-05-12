"""Pure logic du système voice credit packs.

Pas d'API Stripe ici (séparation des préoccupations) — l'achat passe par le
router qui orchestre Stripe + DB. Ce service expose uniquement les opérations
de lecture/écriture DB et le calcul du snapshot crédit utilisateur.
"""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import (
    User,
    VoiceCreditPack,
)
from billing.voice_quota import (
    TOP_TIER_PLANS,
    FREE_TRIAL_MINUTES,
    _get_or_create_quota,
    _plan_monthly_allowance,
)

logger = logging.getLogger(__name__)


async def list_active_packs(db: AsyncSession) -> list[VoiceCreditPack]:
    """Catalogue des packs actifs ordonnés par display_order asc."""
    result = await db.execute(
        select(VoiceCreditPack)
        .where(VoiceCreditPack.is_active.is_(True))
        .order_by(VoiceCreditPack.display_order.asc(), VoiceCreditPack.id.asc())
    )
    return list(result.scalars().all())


async def get_pack_by_slug(slug: str, db: AsyncSession) -> Optional[VoiceCreditPack]:
    """Récupère un pack par slug, None si introuvable."""
    result = await db.execute(select(VoiceCreditPack).where(VoiceCreditPack.slug == slug))
    return result.scalar_one_or_none()


async def add_purchased_minutes(user_id: int, minutes: float, db: AsyncSession) -> None:
    """Crédite ``minutes`` au solde non-expirant de l'utilisateur.

    Crée la row ``voice_quota`` si elle n'existe pas. Ne commit PAS — c'est au
    caller webhook de wrap dans une transaction et commit avec
    ``VoiceCreditPurchase`` pour idempotency atomique.
    """
    user = await db.get(User, user_id)
    plan = (user.plan if user else "free") or "free"

    quota = await _get_or_create_quota(user_id, plan.lower(), db)
    quota.purchased_minutes = float(quota.purchased_minutes or 0.0) + float(minutes)


async def get_user_credit_status(user: User, db: AsyncSession) -> dict:
    """Snapshot allowance + purchased pour widgets dashboard.

    Returns:
        ``{"allowance_total", "allowance_used", "allowance_remaining",
           "purchased_minutes", "total_minutes_available", "is_trial"}``
    """
    plan = (user.plan or "free").lower()
    quota = await _get_or_create_quota(user.id, plan, db)

    if plan == "free":
        allowance_total = FREE_TRIAL_MINUTES if not quota.lifetime_trial_used else 0.0
        allowance_used = 0.0  # trial est binaire
        is_trial = not quota.lifetime_trial_used
    elif plan in TOP_TIER_PLANS:
        allowance_total = _plan_monthly_allowance(plan)
        allowance_used = float(quota.monthly_minutes_used or 0.0)
        is_trial = False
    else:
        allowance_total = 0.0
        allowance_used = 0.0
        is_trial = False

    purchased = float(getattr(quota, "purchased_minutes", 0.0) or 0.0)
    allowance_remaining = max(allowance_total - allowance_used, 0.0)

    return {
        "allowance_total": allowance_total,
        "allowance_used": allowance_used,
        "allowance_remaining": allowance_remaining,
        "purchased_minutes": purchased,
        "total_minutes_available": allowance_remaining + purchased,
        "is_trial": is_trial,
    }
