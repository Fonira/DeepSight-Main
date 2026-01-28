"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📊 USAGE ROUTER — Statistiques d'utilisation et quotas                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from db.database import get_session, User, Summary, CreditTransaction
from auth.dependencies import get_current_user
from core.config import PLAN_LIMITS, MISTRAL_MODELS
from core.credits import (
    calculate_analysis_cost,
    calculate_chat_cost,
    calculate_playlist_cost,
    get_credits_summary,
    MODEL_COSTS,
    FEATURE_COSTS,
    PLAN_CREDITS
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class UsageStats(BaseModel):
    """Statistiques d'utilisation de l'utilisateur"""
    # Plan actuel
    plan: str
    plan_name: str
    plan_color: str
    
    # Crédits
    credits_remaining: int
    credits_monthly: int
    credits_used_this_month: int
    credits_percent_used: float
    
    # Analyses
    analyses_this_month: int
    analyses_total: int
    
    # Chat IA
    chat_daily_limit: int
    chat_used_today: int
    chat_remaining_today: int
    
    # Recherche Web
    web_search_monthly: int
    web_search_used: int
    web_search_remaining: int
    web_search_enabled: bool
    
    # Playlists
    playlists_enabled: bool
    max_playlist_videos: int
    
    # Modèles disponibles
    available_models: List[str]
    default_model: str
    
    # Dates
    member_since: Optional[datetime]
    subscription_renewal: Optional[datetime]


class ModelInfo(BaseModel):
    """Informations sur un modèle Mistral"""
    id: str
    name: str
    speed: str
    quality: str
    description_fr: str
    description_en: str
    available: bool
    cost_indicator: str  # €, €€, €€€


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/stats", response_model=UsageStats)
async def get_usage_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Retourne les statistiques d'utilisation complètes de l'utilisateur.
    """
    plan = current_user.plan or "free"
    plan_limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    
    # Calculer le début du mois
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Compter les analyses ce mois
    analyses_this_month_result = await session.execute(
        select(func.count(Summary.id))
        .where(and_(
            Summary.user_id == current_user.id,
            Summary.created_at >= month_start
        ))
    )
    analyses_this_month = analyses_this_month_result.scalar() or 0
    
    # Compter les analyses totales
    analyses_total_result = await session.execute(
        select(func.count(Summary.id))
        .where(Summary.user_id == current_user.id)
    )
    analyses_total = analyses_total_result.scalar() or 0
    
    # Calculer les crédits utilisés ce mois (transactions négatives)
    credits_used_result = await session.execute(
        select(func.sum(func.abs(CreditTransaction.amount)))
        .where(and_(
            CreditTransaction.user_id == current_user.id,
            CreditTransaction.amount < 0,
            CreditTransaction.created_at >= month_start
        ))
    )
    credits_used_this_month = int(credits_used_result.scalar() or 0)
    
    # Calculer le chat utilisé aujourd'hui (approximation basée sur les transactions)
    chat_used_result = await session.execute(
        select(func.count(CreditTransaction.id))
        .where(and_(
            CreditTransaction.user_id == current_user.id,
            CreditTransaction.transaction_type == "chat",
            CreditTransaction.created_at >= today_start
        ))
    )
    chat_used_today = chat_used_result.scalar() or 0
    
    # Recherche web utilisée ce mois
    web_search_used_result = await session.execute(
        select(func.count(CreditTransaction.id))
        .where(and_(
            CreditTransaction.user_id == current_user.id,
            CreditTransaction.transaction_type == "web_search",
            CreditTransaction.created_at >= month_start
        ))
    )
    web_search_used = web_search_used_result.scalar() or 0
    
    # Calculs
    credits_remaining = current_user.credits or 0
    credits_monthly = plan_limits.get("monthly_credits", 0)
    
    chat_daily_limit = plan_limits.get("chat_daily_limit", 10)
    chat_remaining = max(0, chat_daily_limit - chat_used_today) if chat_daily_limit > 0 else -1
    
    web_search_monthly = plan_limits.get("web_search_monthly", 0)
    web_search_remaining = max(0, web_search_monthly - web_search_used) if web_search_monthly > 0 else 0
    
    # Pourcentage utilisé
    if credits_monthly > 0:
        credits_percent = min(100, (credits_used_this_month / credits_monthly) * 100)
    else:
        credits_percent = 0
    
    # Nom du plan
    plan_name_dict = plan_limits.get("name", {"fr": plan})
    plan_name = plan_name_dict.get("fr", plan) if isinstance(plan_name_dict, dict) else plan
    
    return UsageStats(
        # Plan
        plan=plan,
        plan_name=plan_name,
        plan_color=plan_limits.get("color", "#888888"),
        
        # Crédits
        credits_remaining=credits_remaining,
        credits_monthly=credits_monthly,
        credits_used_this_month=credits_used_this_month,
        credits_percent_used=round(credits_percent, 1),
        
        # Analyses
        analyses_this_month=analyses_this_month,
        analyses_total=analyses_total,
        
        # Chat
        chat_daily_limit=chat_daily_limit,
        chat_used_today=chat_used_today,
        chat_remaining_today=chat_remaining,
        
        # Web search
        web_search_monthly=web_search_monthly,
        web_search_used=web_search_used,
        web_search_remaining=web_search_remaining,
        web_search_enabled=plan_limits.get("web_search_enabled", False),
        
        # Playlists
        playlists_enabled=plan_limits.get("can_use_playlists", False),
        max_playlist_videos=plan_limits.get("max_playlist_videos", 0),
        
        # Modèles
        available_models=plan_limits.get("models", ["mistral-small-latest"]),
        default_model=plan_limits.get("default_model", "mistral-small-latest"),
        
        # Dates
        member_since=current_user.created_at,
        subscription_renewal=None  # TODO: récupérer depuis Stripe
    )


@router.get("/models")
async def get_available_models(
    current_user: User = Depends(get_current_user)
):
    """
    Retourne la liste des modèles Mistral avec leur disponibilité pour l'utilisateur.
    """
    plan = current_user.plan or "free"
    plan_limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    user_models = plan_limits.get("models", ["mistral-small-latest"])
    
    models = []
    for model_id, model_info in MISTRAL_MODELS.items():
        # Indicateur de coût
        cost = model_info.get("cost_per_1k_tokens", 0)
        if cost < 0.001:
            cost_indicator = "€"
        elif cost < 0.005:
            cost_indicator = "€€"
        else:
            cost_indicator = "€€€"
        
        models.append({
            "id": model_id,
            "name": model_info.get("name", model_id),
            "speed": model_info.get("speed", "medium"),
            "quality": model_info.get("quality", "good"),
            "description_fr": model_info.get("description", {}).get("fr", ""),
            "description_en": model_info.get("description", {}).get("en", ""),
            "available": model_id in user_models,
            "cost_indicator": cost_indicator,
            "context_window": model_info.get("context", 32000),
            "plans_required": model_info.get("plans", [])
        })
    
    return {
        "models": models,
        "current_plan": plan,
        "default_model": plan_limits.get("default_model", "mistral-small-latest")
    }


@router.get("/transactions")
async def get_recent_transactions(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = 20
):
    """
    Retourne les transactions récentes de l'utilisateur.
    """
    result = await session.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == current_user.id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(limit)
    )
    transactions = result.scalars().all()
    
    return {
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "balance_after": t.balance_after,
                "type": t.transaction_type or t.type,
                "description": t.description,
                "created_at": t.created_at
            }
            for t in transactions
        ]
    }


@router.get("/plan-features")
async def get_plan_features(
    current_user: User = Depends(get_current_user)
):
    """
    Retourne les fonctionnalités du plan actuel comparées aux autres plans.
    """
    current_plan = current_user.plan or "free"
    
    plans_comparison = {}
    for plan_id, limits in PLAN_LIMITS.items():
        if plan_id == "unlimited":
            continue
            
        plan_name = limits.get("name", {})
        plans_comparison[plan_id] = {
            "name": plan_name.get("fr", plan_id) if isinstance(plan_name, dict) else plan_id,
            "price": limits.get("price", 0),
            "price_display": limits.get("price_display", {}).get("fr", ""),
            "color": limits.get("color", "#888888"),
            "is_current": plan_id == current_plan,
            "features": {
                "monthly_credits": limits.get("monthly_credits", 0),
                "playlists": limits.get("can_use_playlists", False),
                "max_playlist_videos": limits.get("max_playlist_videos", 0),
                "chat_daily": limits.get("chat_daily_limit", 0),
                "web_search": limits.get("web_search_enabled", False),
                "web_search_monthly": limits.get("web_search_monthly", 0),
                "models": limits.get("models", []),
                "history_days": limits.get("history_days", 7)
            }
        }
    
    return {
        "current_plan": current_plan,
        "plans": plans_comparison
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 💰 ENDPOINTS COÛTS ET ESTIMATION
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/detailed")
async def get_detailed_usage(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    days: int = 30
):
    """
    Retourne les statistiques d'utilisation détaillées sur une période.

    Mobile-compatible endpoint providing granular usage data.

    Args:
        days: Nombre de jours à analyser (défaut: 30, max: 90)
    """
    days = min(days, 90)  # Max 90 jours
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)

    # Analyses par jour
    analyses_by_day_result = await session.execute(
        select(
            func.date(Summary.created_at).label("date"),
            func.count(Summary.id).label("count")
        )
        .where(Summary.user_id == current_user.id)
        .where(Summary.created_at >= start_date)
        .group_by(func.date(Summary.created_at))
        .order_by(func.date(Summary.created_at))
    )
    analyses_by_day = [
        {"date": str(row.date), "count": row.count}
        for row in analyses_by_day_result
    ]

    # Crédits utilisés par type
    credits_by_type_result = await session.execute(
        select(
            CreditTransaction.transaction_type,
            func.sum(func.abs(CreditTransaction.amount)).label("total")
        )
        .where(CreditTransaction.user_id == current_user.id)
        .where(CreditTransaction.amount < 0)
        .where(CreditTransaction.created_at >= start_date)
        .group_by(CreditTransaction.transaction_type)
    )
    credits_by_type = {
        row.transaction_type or "other": int(row.total or 0)
        for row in credits_by_type_result
    }

    # Catégories analysées
    categories_result = await session.execute(
        select(
            Summary.category,
            func.count(Summary.id).label("count")
        )
        .where(Summary.user_id == current_user.id)
        .where(Summary.created_at >= start_date)
        .group_by(Summary.category)
        .order_by(func.count(Summary.id).desc())
    )
    categories = {
        row.category or "Autre": row.count
        for row in categories_result
    }

    # Modèles utilisés
    models_result = await session.execute(
        select(
            Summary.model_used,
            func.count(Summary.id).label("count")
        )
        .where(Summary.user_id == current_user.id)
        .where(Summary.created_at >= start_date)
        .where(Summary.model_used.isnot(None))
        .group_by(Summary.model_used)
    )
    models_used = {
        row.model_used: row.count
        for row in models_result
    }

    # Totaux sur la période
    totals_result = await session.execute(
        select(
            func.count(Summary.id).label("analyses"),
            func.sum(Summary.video_duration).label("duration"),
            func.sum(Summary.word_count).label("words")
        )
        .where(Summary.user_id == current_user.id)
        .where(Summary.created_at >= start_date)
    )
    totals = totals_result.first()

    total_credits_result = await session.execute(
        select(func.sum(func.abs(CreditTransaction.amount)))
        .where(CreditTransaction.user_id == current_user.id)
        .where(CreditTransaction.amount < 0)
        .where(CreditTransaction.created_at >= start_date)
    )
    total_credits = int(total_credits_result.scalar() or 0)

    return {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": now.isoformat(),
        "totals": {
            "analyses": totals.analyses or 0,
            "duration_seconds": totals.duration or 0,
            "duration_formatted": f"{(totals.duration or 0) // 3600}h {((totals.duration or 0) % 3600) // 60}min",
            "words_generated": totals.words or 0,
            "credits_used": total_credits
        },
        "daily_analyses": analyses_by_day,
        "credits_by_type": credits_by_type,
        "categories": categories,
        "models_used": models_used,
        "averages": {
            "analyses_per_day": round((totals.analyses or 0) / days, 1),
            "credits_per_day": round(total_credits / days, 1)
        }
    }


@router.get("/costs")
async def get_costs_info():
    """
    Retourne les informations sur les coûts en crédits.
    Utile pour l'affichage dans l'UI.
    """
    return get_credits_summary()


@router.post("/estimate")
async def estimate_cost(
    action: str,  # "analysis", "chat", "playlist"
    model: str = "mistral-small-latest",
    duration_minutes: int = 15,
    with_web_search: bool = False,
    with_fact_check: bool = False,
    fact_check_level: str = "basic",
    video_count: int = 1,
    current_user: User = Depends(get_current_user)
):
    """
    Estime le coût d'une action avant exécution.
    
    Permet à l'UI d'afficher le coût estimé avant que l'utilisateur ne lance l'action.
    """
    plan = current_user.plan or "free"
    plan_limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    available_models = plan_limits.get("models", ["mistral-small-latest"])
    
    # Vérifier que le modèle est disponible pour le plan
    if model not in available_models:
        return {
            "error": "model_not_available",
            "message": f"Model {model} not available for plan {plan}",
            "available_models": available_models
        }
    
    # Vérifier la recherche web
    if with_web_search and not plan_limits.get("web_search_enabled", False):
        return {
            "error": "web_search_not_available",
            "message": "Web search not available for your plan",
            "upgrade_required": True
        }
    
    # Calculer le coût
    if action == "analysis":
        cost_info = calculate_analysis_cost(
            model=model,
            duration_minutes=duration_minutes,
            with_web_search=with_web_search,
            with_fact_check=with_fact_check,
            fact_check_level=fact_check_level
        )
    elif action == "chat":
        cost_info = calculate_chat_cost(
            model=model,
            with_web_search=with_web_search
        )
    elif action == "playlist":
        cost_info = calculate_playlist_cost(
            video_count=video_count,
            model=model,
            with_web_search=with_web_search
        )
    else:
        return {"error": "unknown_action"}
    
    # Ajouter les infos utilisateur
    user_credits = current_user.credits or 0
    cost_info["user_credits"] = user_credits
    cost_info["can_afford"] = user_credits >= cost_info["total"]
    cost_info["credits_after"] = max(0, user_credits - cost_info["total"])
    
    return cost_info


@router.get("/costs/models")
async def get_model_costs(current_user: User = Depends(get_current_user)):
    """
    Retourne les coûts détaillés par modèle pour l'utilisateur.
    """
    plan = current_user.plan or "free"
    plan_limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    available_models = plan_limits.get("models", ["mistral-small-latest"])
    
    models_with_costs = []
    for model_id, cost_info in MODEL_COSTS.items():
        models_with_costs.append({
            "id": model_id,
            "name": cost_info["name"],
            "analysis_cost": cost_info["analysis"],
            "chat_cost": cost_info["chat"],
            "multiplier": cost_info["multiplier"],
            "available": model_id in available_models,
            "examples": {
                "short_video": calculate_analysis_cost(model_id, 10)["total"],
                "medium_video": calculate_analysis_cost(model_id, 30)["total"],
                "long_video": calculate_analysis_cost(model_id, 60)["total"],
                "with_web_search": calculate_analysis_cost(model_id, 30, True)["total"]
            }
        })
    
    return {
        "models": models_with_costs,
        "features": FEATURE_COSTS,
        "user_credits": current_user.credits or 0,
        "plan": plan
    }
