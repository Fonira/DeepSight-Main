"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎫 PLAN LIMITS — Middleware de vérification des limites par plan                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Migré Avril 2026 : utilise billing/plan_config.py comme SSOT.                    ║
║  Ce fichier reste pour compatibilité avec les modules qui l'importent.            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from datetime import date
from typing import Tuple, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import User, DailyQuota
from billing.plan_config import (
    normalize_plan_id,
    get_plan,
    get_limits,
    PlanId,
)


async def get_daily_usage(session: AsyncSession, user_id: int) -> int:
    """Récupère le nombre d'analyses effectuées aujourd'hui par l'utilisateur."""
    today = date.today().isoformat()
    result = await session.execute(
        select(DailyQuota).where(
            DailyQuota.user_id == user_id,
            DailyQuota.quota_date == today,
        )
    )
    quota = result.scalar_one_or_none()
    return quota.videos_used if quota else 0


async def increment_daily_usage(session: AsyncSession, user_id: int) -> int:
    """Incrémente le compteur d'analyses quotidiennes. Retourne le nouveau total."""
    today = date.today().isoformat()
    result = await session.execute(
        select(DailyQuota).where(
            DailyQuota.user_id == user_id,
            DailyQuota.quota_date == today,
        )
    )
    quota = result.scalar_one_or_none()

    if quota:
        quota.videos_used += 1
        new_count = quota.videos_used
    else:
        new_quota = DailyQuota(user_id=user_id, quota_date=today, videos_used=1)
        session.add(new_quota)
        new_count = 1

    await session.commit()
    return new_count


async def check_daily_analysis_limit(
    session: AsyncSession, user: User, lang: str = "fr"
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Vérifie si l'utilisateur peut effectuer une analyse aujourd'hui.
    Utilise plan_config.py comme SSOT.
    """
    # Admin bypass — analyses illimitées
    from core.config import ADMIN_CONFIG
    admin_email = ADMIN_CONFIG.get("ADMIN_EMAIL", "").lower()
    is_admin = getattr(user, 'is_admin', False) or (getattr(user, 'email', '') or '').lower() == admin_email
    if is_admin:
        return True, None

    raw_plan = user.plan or "free"
    plan = normalize_plan_id(raw_plan)
    limits = get_limits(plan)

    daily_limit = limits.get("monthly_analyses", 5)

    # -1 = illimité
    if daily_limit == -1:
        return True, None

    current_usage = await get_daily_usage(session, user.id)

    if current_usage >= daily_limit:
        next_plan = get_next_plan(plan)
        next_plan_limits = get_limits(next_plan)
        next_plan_daily = next_plan_limits.get("monthly_analyses", 0)

        return False, {
            "code": "daily_limit_reached",
            "message": (
                f"Limite quotidienne atteinte ({current_usage}/{daily_limit})"
                if lang == "fr"
                else f"Daily limit reached ({current_usage}/{daily_limit})"
            ),
            "current_usage": current_usage,
            "daily_limit": daily_limit,
            "plan": plan,
            "next_plan": next_plan,
            "next_plan_daily_limit": next_plan_daily,
            "action": "upgrade",
        }

    return True, None


def check_feature_access(
    user: User, feature: str, lang: str = "fr"
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Vérifie si l'utilisateur a accès à une fonctionnalité.
    Utilise plan_config.py comme SSOT.
    """
    # Admin bypass — toutes les features débloquées
    if getattr(user, 'is_admin', False):
        return True, None

    raw_plan = user.plan or "free"
    plan = normalize_plan_id(raw_plan)
    limits = get_limits(plan)

    # Vérifier les features booléennes
    feature_key = f"{feature}_enabled"
    if feature_key in limits:
        if limits[feature_key]:
            return True, None
    elif feature in limits:
        val = limits[feature]
        if isinstance(val, bool) and val:
            return True, None
        if isinstance(val, (int, float)) and (val == -1 or val > 0):
            return True, None

    # Feature bloquée — construire la réponse d'erreur
    required_plan = get_required_plan_for_feature(feature)
    plan_info = get_plan(required_plan)

    feature_names = {
        "playlists": {"fr": "Analyse de playlists", "en": "Playlist analysis"},
        "export_csv": {"fr": "Export CSV", "en": "CSV export"},
        "export_excel": {"fr": "Export Excel", "en": "Excel export"},
        "batch_api": {"fr": "API batch", "en": "Batch API"},
        "tts": {"fr": "Synthèse vocale", "en": "Text-to-speech"},
        "deep_research": {"fr": "Recherche approfondie", "en": "Deep research"},
        "web_search": {"fr": "Recherche web", "en": "Web search"},
        "voice_chat": {"fr": "Chat vocal", "en": "Voice chat"},
        "mindmap": {"fr": "Cartes mentales", "en": "Mind maps"},
        "factcheck": {"fr": "Fact-check", "en": "Fact-check"},
    }

    feature_name = feature_names.get(feature, {}).get(lang, feature)

    return False, {
        "code": "feature_blocked",
        "message": (
            f"{feature_name} n'est pas disponible avec votre plan {plan}"
            if lang == "fr"
            else f"{feature_name} is not available with your {plan} plan"
        ),
        "feature": feature,
        "current_plan": plan,
        "required_plan": required_plan,
        "required_plan_name": plan_info.get("name", required_plan),
        "action": "upgrade",
    }


def get_next_plan(current_plan: str) -> str:
    """Retourne le plan suivant dans la hiérarchie (2 plans : free → pro)."""
    normalized = normalize_plan_id(current_plan)
    if normalized == PlanId.FREE.value:
        return PlanId.PRO.value
    return PlanId.PRO.value  # Déjà au max


def get_required_plan_for_feature(feature: str) -> str:
    """Retourne le plan minimum requis pour une fonctionnalité.
    Avec 2 plans, tout ce qui n'est pas free est pro."""
    # Features disponibles en free
    free_features = {"flashcards", "quiz", "chat", "analyse", "history"}
    if feature in free_features:
        return PlanId.FREE.value
    return PlanId.PRO.value


def get_plan_info(plan: str, lang: str = "fr") -> Dict[str, Any]:
    """Retourne les informations complètes d'un plan."""
    plan_data = get_plan(plan)
    limits = plan_data["limits"]
    name_key = "name" if lang == "fr" else "name_en"

    return {
        "plan": normalize_plan_id(plan),
        "name": plan_data.get(name_key, plan),
        "color": plan_data.get("color", "#888888"),
        "price": plan_data.get("price_monthly_cents", 0),
        "monthly_analyses": limits.get("monthly_analyses", 5),
        "monthly_credits": limits.get("monthly_credits", 0),
        "models": limits.get("allowed_models", ["mistral-small-2603"]),
    }


async def get_user_limits_status(
    session: AsyncSession, user: User, lang: str = "fr"
) -> Dict[str, Any]:
    """Retourne le statut complet des limites pour un utilisateur."""
    raw_plan = user.plan or "free"
    plan = normalize_plan_id(raw_plan)
    limits = get_limits(plan)

    daily_limit = limits.get("monthly_analyses", 5)
    current_usage = await get_daily_usage(session, user.id)

    if daily_limit == -1:
        usage_percent = 0
        remaining = -1
    else:
        usage_percent = min(100, int((current_usage / daily_limit) * 100))
        remaining = max(0, daily_limit - current_usage)

    return {
        "plan": plan,
        "plan_info": get_plan_info(plan, lang),
        "daily_analyses": {
            "limit": daily_limit,
            "used": current_usage,
            "remaining": remaining,
            "percent_used": usage_percent,
            "is_unlimited": daily_limit == -1,
        },
        "credits": {
            "current": user.credits or 0,
            "monthly_allowance": limits.get("monthly_credits", 0),
        },
        "next_plan": get_next_plan(plan),
        "next_plan_info": (
            get_plan_info(get_next_plan(plan), lang)
            if plan == PlanId.FREE.value
            else None
        ),
    }
