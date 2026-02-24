"""
PERMISSIONS — Enforcement des limites de plan.

Raise des HTTPException structurées pour le frontend (feature_locked, quota_exceeded, video_too_long).
"""

from typing import Optional
import logging

from fastapi import HTTPException

from .plan_config import (
    get_plan,
    get_limits,
    is_feature_available,
    get_minimum_plan_for,
    get_plan_index,
    PLANS,
    PlanId,
    PLAN_HIERARCHY,
)

logger = logging.getLogger(__name__)

FRONTEND_UPGRADE_URL = "/upgrade"


def _plan_name(plan_id: str) -> str:
    """Retourne le nom FR du plan."""
    return get_plan(plan_id).get("name", plan_id)


def _plan_price_display(plan_id: str) -> str:
    """Retourne le prix affiché du plan."""
    cents = get_plan(plan_id).get("price_monthly_cents", 0)
    if cents == 0:
        return "Gratuit"
    return f"{cents / 100:.2f}€/mois"


def require_feature(
    user_plan: str,
    feature: str,
    platform: str = "web",
    label: Optional[str] = None,
) -> None:
    """Vérifie qu'une feature est disponible. Raise 403 si verrouillée."""
    if is_feature_available(user_plan, feature, platform):
        return

    required_plan = get_minimum_plan_for(feature)
    feature_label = label or feature.replace("_", " ").title()

    logger.info(
        "Feature locked: user_plan=%s feature=%s platform=%s required=%s",
        user_plan, feature, platform, required_plan,
    )

    raise HTTPException(
        status_code=403,
        detail={
            "error": "feature_locked",
            "feature": feature,
            "feature_label": feature_label,
            "current_plan": user_plan,
            "current_plan_name": _plan_name(user_plan),
            "required_plan": required_plan,
            "required_plan_name": _plan_name(required_plan),
            "required_plan_price": _plan_price_display(required_plan),
            "message": f"{feature_label} nécessite le plan {_plan_name(required_plan)} ou supérieur.",
            "upgrade_url": FRONTEND_UPGRADE_URL,
        },
    )


def require_quota(
    user_plan: str,
    feature: str,
    current_usage: int,
    label: Optional[str] = None,
) -> None:
    """Vérifie qu'un quota n'est pas dépassé. Raise 429 si épuisé.

    -1 dans les limites = illimité → toujours autorisé.
    """
    limits = get_limits(user_plan)
    limit_value = limits.get(feature)

    if limit_value is None:
        return
    if limit_value == -1:
        return
    if current_usage < limit_value:
        return

    feature_label = label or feature.replace("_", " ").title()

    logger.info(
        "Quota exceeded: user_plan=%s feature=%s used=%d limit=%d",
        user_plan, feature, current_usage, limit_value,
    )

    raise HTTPException(
        status_code=429,
        detail={
            "error": "quota_exceeded",
            "feature": feature,
            "feature_label": feature_label,
            "current_plan": user_plan,
            "current_plan_name": _plan_name(user_plan),
            "limit": limit_value,
            "used": current_usage,
            "message": f"Limite atteinte : {current_usage}/{limit_value} {feature_label}. Passez au plan supérieur pour continuer.",
            "upgrade_url": FRONTEND_UPGRADE_URL,
        },
    )


def require_video_length(
    user_plan: str,
    duration_minutes: float,
) -> None:
    """Vérifie que la durée de la vidéo est autorisée. Raise 403 si trop longue."""
    limits = get_limits(user_plan)
    max_length = limits.get("max_video_length_min", 15)

    if max_length == -1:
        return
    if duration_minutes <= max_length:
        return

    # Trouver le plan minimum pour cette durée
    required_plan = user_plan
    for pid in PLAN_HIERARCHY:
        p_limits = PLANS[pid]["limits"]
        p_max = p_limits.get("max_video_length_min", 0)
        if p_max == -1 or p_max >= duration_minutes:
            required_plan = pid.value
            break

    logger.info(
        "Video too long: user_plan=%s duration=%.1fmin max=%dmin",
        user_plan, duration_minutes, max_length,
    )

    raise HTTPException(
        status_code=403,
        detail={
            "error": "video_too_long",
            "video_duration_min": round(duration_minutes, 1),
            "max_duration_min": max_length,
            "current_plan": user_plan,
            "current_plan_name": _plan_name(user_plan),
            "required_plan": required_plan,
            "required_plan_name": _plan_name(required_plan),
            "message": f"Cette vidéo dure {round(duration_minutes)}min. Votre plan {_plan_name(user_plan)} autorise {max_length}min max. Passez au plan {_plan_name(required_plan)} pour l'analyser.",
            "upgrade_url": FRONTEND_UPGRADE_URL,
        },
    )


def get_allowed_model(user_plan: str, requested: Optional[str] = None) -> str:
    """Retourne le modèle autorisé ou le modèle par défaut du plan.

    Si le modèle demandé n'est pas dans les modèles autorisés, retourne le défaut.
    """
    limits = get_limits(user_plan)
    allowed = limits.get("allowed_models", ["mistral-small-latest"])
    default = limits.get("default_model", "mistral-small-latest")

    if requested and requested in allowed:
        return requested
    return default
