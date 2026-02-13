"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎫 PLAN LIMITS — Middleware de vérification des limites par plan                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Vérifie les limites quotidiennes et les features bloquées par plan                ║
║  • daily_analyses: Nombre d'analyses max par jour                                  ║
║  • blocked_features: Features non disponibles pour ce plan                         ║
║  • upgrade_prompt: Message d'upgrade personnalisé                                  ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from datetime import date
from typing import Tuple, Dict, Any, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import User, DailyQuota
from core.config import PLAN_LIMITS


async def get_daily_usage(session: AsyncSession, user_id: int) -> int:
    """
    Récupère le nombre d'analyses effectuées aujourd'hui par l'utilisateur.
    """
    today = date.today().isoformat()

    result = await session.execute(
        select(DailyQuota).where(
            DailyQuota.user_id == user_id,
            DailyQuota.quota_date == today
        )
    )
    quota = result.scalar_one_or_none()

    return quota.videos_used if quota else 0


async def increment_daily_usage(session: AsyncSession, user_id: int) -> int:
    """
    Incrémente le compteur d'analyses quotidiennes.
    Retourne le nouveau total.
    """
    today = date.today().isoformat()

    result = await session.execute(
        select(DailyQuota).where(
            DailyQuota.user_id == user_id,
            DailyQuota.quota_date == today
        )
    )
    quota = result.scalar_one_or_none()

    if quota:
        quota.videos_used += 1
        new_count = quota.videos_used
    else:
        new_quota = DailyQuota(
            user_id=user_id,
            quota_date=today,
            videos_used=1
        )
        session.add(new_quota)
        new_count = 1

    await session.commit()
    return new_count


async def check_daily_analysis_limit(
    session: AsyncSession,
    user: User,
    lang: str = "fr"
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Vérifie si l'utilisateur peut effectuer une analyse aujourd'hui.

    Returns:
        Tuple[bool, Optional[Dict]]: (can_analyze, error_info)
        - can_analyze: True si l'utilisateur peut analyser
        - error_info: Dict avec les détails de l'erreur si can_analyze=False
    """
    plan = user.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    daily_limit = limits.get("daily_analyses", 5)

    # -1 = illimité
    if daily_limit == -1:
        return True, None

    current_usage = await get_daily_usage(session, user.id)

    if current_usage >= daily_limit:
        upgrade_prompt = limits.get("upgrade_prompt", {}).get(lang, limits.get("upgrade_prompt", {}).get("fr", ""))

        # Déterminer le prochain plan
        next_plan = get_next_plan(plan)
        next_plan_limits = PLAN_LIMITS.get(next_plan, {})
        next_plan_daily = next_plan_limits.get("daily_analyses", 0)

        return False, {
            "code": "daily_limit_reached",
            "message": f"Limite quotidienne atteinte ({current_usage}/{daily_limit})" if lang == "fr"
                       else f"Daily limit reached ({current_usage}/{daily_limit})",
            "current_usage": current_usage,
            "daily_limit": daily_limit,
            "plan": plan,
            "upgrade_prompt": upgrade_prompt,
            "next_plan": next_plan,
            "next_plan_daily_limit": next_plan_daily,
            "action": "upgrade"
        }

    return True, None


def check_feature_access(
    user: User,
    feature: str,
    lang: str = "fr"
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Vérifie si l'utilisateur a accès à une fonctionnalité spécifique.

    Features possibles:
    - playlists: Analyse de playlists
    - export_csv: Export CSV
    - export_excel: Export Excel
    - batch_api: API batch
    - tts: Text-to-speech
    - deep_research: Recherche approfondie
    - web_search: Recherche web

    Returns:
        Tuple[bool, Optional[Dict]]: (has_access, error_info)
    """
    plan = user.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    blocked_features = limits.get("blocked_features", [])

    if feature in blocked_features:
        upgrade_prompt = limits.get("upgrade_prompt", {}).get(lang, "")
        required_plan = get_required_plan_for_feature(feature)
        required_plan_info = PLAN_LIMITS.get(required_plan, {})

        feature_names = {
            "playlists": {"fr": "Analyse de playlists", "en": "Playlist analysis"},
            "export_csv": {"fr": "Export CSV", "en": "CSV export"},
            "export_excel": {"fr": "Export Excel", "en": "Excel export"},
            "batch_api": {"fr": "API batch", "en": "Batch API"},
            "tts": {"fr": "Synthèse vocale", "en": "Text-to-speech"},
            "deep_research": {"fr": "Recherche approfondie", "en": "Deep research"},
            "web_search": {"fr": "Recherche web", "en": "Web search"}
        }

        feature_name = feature_names.get(feature, {}).get(lang, feature)

        return False, {
            "code": "feature_blocked",
            "message": f"{feature_name} n'est pas disponible avec votre plan {plan}" if lang == "fr"
                       else f"{feature_name} is not available with your {plan} plan",
            "feature": feature,
            "current_plan": plan,
            "required_plan": required_plan,
            "required_plan_price": required_plan_info.get("price_display", {}).get(lang, ""),
            "upgrade_prompt": upgrade_prompt,
            "action": "upgrade"
        }

    return True, None


def get_next_plan(current_plan: str) -> str:
    """Retourne le plan suivant dans la hiérarchie."""
    plan_hierarchy = ["free", "starter", "pro", "expert", "unlimited"]

    try:
        current_index = plan_hierarchy.index(current_plan)
        if current_index < len(plan_hierarchy) - 1:
            return plan_hierarchy[current_index + 1]
    except ValueError:
        pass

    return "starter"  # Par défaut


def get_required_plan_for_feature(feature: str) -> str:
    """
    Retourne le plan minimum requis pour une fonctionnalité.
    """
    feature_requirements = {
        "playlists": "pro",
        "export_csv": "starter",
        "export_excel": "starter",
        "batch_api": "expert",
        "tts": "starter",
        "deep_research": "expert",
        "web_search": "starter"
    }

    return feature_requirements.get(feature, "starter")


def get_plan_info(plan: str, lang: str = "fr") -> Dict[str, Any]:
    """
    Retourne les informations complètes d'un plan.
    """
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    return {
        "plan": plan,
        "name": limits.get("name", {}).get(lang, plan),
        "color": limits.get("color", "#888888"),
        "price": limits.get("price", 0),
        "price_display": limits.get("price_display", {}).get(lang, ""),
        "daily_analyses": limits.get("daily_analyses", 5),
        "monthly_credits": limits.get("monthly_credits", 0),
        "models": limits.get("models", ["mistral-small-latest"]),
        "blocked_features": limits.get("blocked_features", []),
        "upgrade_prompt": limits.get("upgrade_prompt", {}).get(lang, "")
    }


async def get_user_limits_status(
    session: AsyncSession,
    user: User,
    lang: str = "fr"
) -> Dict[str, Any]:
    """
    Retourne le statut complet des limites pour un utilisateur.
    Utile pour l'affichage dans l'interface.
    """
    plan = user.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    daily_limit = limits.get("daily_analyses", 5)
    current_usage = await get_daily_usage(session, user.id)

    # Calculer le pourcentage d'utilisation
    if daily_limit == -1:
        usage_percent = 0
        remaining = -1  # Illimité
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
            "is_unlimited": daily_limit == -1
        },
        "credits": {
            "current": user.credits or 0,
            "monthly_allowance": limits.get("monthly_credits", 0)
        },
        "blocked_features": limits.get("blocked_features", []),
        "upgrade_prompt": limits.get("upgrade_prompt", {}).get(lang, ""),
        "next_plan": get_next_plan(plan),
        "next_plan_info": get_plan_info(get_next_plan(plan), lang) if plan != "unlimited" else None
    }
