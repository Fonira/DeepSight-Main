"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎙️ VOICE QUOTA SERVICE — Gestion des quotas de conversation vocale               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import logging
from datetime import datetime, date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import VoiceQuota, User

logger = logging.getLogger(__name__)


# =============================================================================
# 🎙️ VOICE LIMITS PAR PLAN
# =============================================================================

VOICE_LIMITS = {
    "free":      {"enabled": False, "monthly_minutes": 0,   "max_session_minutes": 0},
    "etudiant":  {"enabled": True,  "monthly_minutes": 5,   "max_session_minutes": 10},
    "starter":   {"enabled": True,  "monthly_minutes": 15,  "max_session_minutes": 10},
    "pro":       {"enabled": True,  "monthly_minutes": 45,  "max_session_minutes": 10},
    "expert":    {"enabled": True,  "monthly_minutes": 90,  "max_session_minutes": 15},
    "unlimited": {"enabled": True,  "monthly_minutes": 999, "max_session_minutes": 30},
}

WARNING_THRESHOLDS = [50, 80, 95, 100]


# =============================================================================
# 📊 FONCTIONS DE GESTION DES QUOTAS
# =============================================================================

async def get_or_create_voice_quota(
    user_id: int, plan: str, db: AsyncSession
) -> VoiceQuota:
    """Récupère ou crée le quota vocal pour le mois en cours."""
    now = datetime.now()
    year = now.year
    month = now.month

    result = await db.execute(
        select(VoiceQuota).where(
            VoiceQuota.user_id == user_id,
            VoiceQuota.year == year,
            VoiceQuota.month == month,
        )
    )
    quota = result.scalars().first()

    if quota is None:
        limits = VOICE_LIMITS.get(plan, VOICE_LIMITS["free"])
        seconds_limit = limits["monthly_minutes"] * 60

        quota = VoiceQuota(
            user_id=user_id,
            year=year,
            month=month,
            seconds_used=0,
            seconds_limit=seconds_limit,
            sessions_count=0,
        )
        db.add(quota)
        await db.flush()
        logger.info(
            "Created voice quota for user %d (%s): %d seconds",
            user_id, plan, seconds_limit,
        )

    return quota


async def check_voice_quota(
    user_id: int, plan: str, db: AsyncSession
) -> dict:
    """Vérifie le quota vocal et retourne l'état détaillé."""
    quota = await get_or_create_voice_quota(user_id, plan, db)

    # Charger le user pour voice_bonus_seconds
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    bonus_seconds = user.voice_bonus_seconds if user else 0

    total_limit = quota.seconds_limit + bonus_seconds
    seconds_remaining = total_limit - quota.seconds_used
    seconds_remaining = max(seconds_remaining, 0)

    # Calculer le pourcentage utilisé
    if total_limit > 0:
        pct_used = (quota.seconds_used / total_limit) * 100
    else:
        pct_used = 100.0 if quota.seconds_used > 0 else 0.0

    # Déterminer le warning_level : le plus grand seuil dépassé
    warning_level = None
    for threshold in WARNING_THRESHOLDS:
        if pct_used >= threshold:
            warning_level = threshold

    return {
        "can_use": seconds_remaining > 0,
        "seconds_remaining": seconds_remaining,
        "seconds_used": quota.seconds_used,
        "seconds_limit": quota.seconds_limit,
        "bonus_seconds": bonus_seconds,
        "warning_level": warning_level,
    }


async def deduct_voice_usage(
    user_id: int, duration_seconds: int, db: AsyncSession
) -> float:
    """Déduit l'usage vocal du quota. Minimum 5 secondes facturées.

    Retourne les minutes déduites.
    """
    duration_seconds = max(duration_seconds, 5)

    # Récupérer le user pour connaître le plan
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise ValueError(f"User {user_id} not found")

    plan = user.plan or "free"
    quota = await get_or_create_voice_quota(user_id, plan, db)

    # Mettre à jour le quota
    quota.seconds_used += duration_seconds
    quota.sessions_count += 1

    # Si dépassement du quota plan, déduire du bonus
    overage = quota.seconds_used - quota.seconds_limit
    if overage > 0 and user.voice_bonus_seconds > 0:
        deduct_from_bonus = min(overage, user.voice_bonus_seconds)
        user.voice_bonus_seconds -= deduct_from_bonus
        logger.info(
            "User %d exceeded plan quota by %ds, deducted %ds from bonus (remaining: %ds)",
            user_id, overage, deduct_from_bonus, user.voice_bonus_seconds,
        )

    await db.commit()

    minutes_deducted = duration_seconds / 60
    logger.info(
        "Deducted %.2f min voice usage for user %d (total used: %ds/%ds)",
        minutes_deducted, user_id, quota.seconds_used, quota.seconds_limit,
    )
    return minutes_deducted


async def get_voice_quota_info(
    user_id: int, plan: str, db: AsyncSession
) -> dict:
    """Retourne les informations complètes du quota vocal."""
    quota = await get_or_create_voice_quota(user_id, plan, db)
    limits = VOICE_LIMITS.get(plan, VOICE_LIMITS["free"])

    # Calculer la date de reset (1er du mois prochain)
    now = datetime.now()
    year = now.year
    month = now.month
    if month == 12:
        reset_date = date(year + 1, 1, 1)
    else:
        reset_date = date(year, month + 1, 1)

    user = await db.get(User, user_id)
    bonus = user.voice_bonus_seconds if user else 0
    total_available = quota.seconds_limit + bonus
    total_seconds_remaining = max(total_available - quota.seconds_used, 0)
    minutes_remaining = total_seconds_remaining / 60

    return {
        "plan": plan,
        "voice_enabled": limits["enabled"],
        "seconds_used": quota.seconds_used,
        "seconds_limit": quota.seconds_limit,
        "minutes_remaining": round(minutes_remaining, 2),
        "max_session_minutes": limits["max_session_minutes"],
        "sessions_this_month": quota.sessions_count,
        "reset_date": reset_date.isoformat(),
    }
