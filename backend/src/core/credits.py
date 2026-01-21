"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💰 CREDITS SYSTEM — Gestion centralisée des crédits Deep Sight                    ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Système de crédits avec coûts variables selon :                                   ║
║  • Le modèle Mistral utilisé (Small, Medium, Large)                                ║
║  • L'utilisation de la recherche web Perplexity                                    ║
║  • Le type d'action (analyse, chat, export)                                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Tuple, Dict, Any, Optional
from datetime import datetime

from db.database import User, CreditTransaction


# ═══════════════════════════════════════════════════════════════════════════════
# 💰 CONFIGURATION DES COÛTS
# ═══════════════════════════════════════════════════════════════════════════════

# Crédits mensuels par plan (grands nombres pour effet psychologique positif)
PLAN_CREDITS = {
    "free": 500,           # ~10 analyses basiques
    "starter": 5_000,      # ~100 analyses basiques ou 50 avec Medium
    "pro": 25_000,         # ~500 analyses ou usage intensif avec Large
    "expert": 100_000,     # Usage très intensif
    "unlimited": 999_999   # Admin
}

# Coût de base par modèle (pour une analyse standard)
MODEL_COSTS = {
    "mistral-small-latest": {
        "analysis": 50,      # Analyse vidéo
        "chat": 5,           # Message chat
        "name": "Mistral Small",
        "multiplier": 1.0
    },
    "mistral-medium-latest": {
        "analysis": 100,     # 2x Small
        "chat": 10,          # 2x Small
        "name": "Mistral Medium",
        "multiplier": 2.0
    },
    "mistral-large-latest": {
        "analysis": 250,     # 5x Small
        "chat": 25,          # 5x Small
        "name": "Mistral Large",
        "multiplier": 5.0
    }
}

# Coûts additionnels pour les fonctionnalités premium
FEATURE_COSTS = {
    "web_search": 30,           # Recherche Perplexity par requête
    "fact_check_basic": 20,     # Vérification basique
    "fact_check_advanced": 50,  # Vérification avancée (multiple sources)
    "export_pdf": 10,           # Export PDF
    "export_audio": 50,         # Export audio TTS
    "playlist_per_video": 30,   # Par vidéo dans une playlist
}

# Modificateurs selon la longueur du contenu
LENGTH_MULTIPLIERS = {
    "short": 0.5,      # < 10 min
    "medium": 1.0,     # 10-30 min
    "long": 1.5,       # 30-60 min
    "very_long": 2.0,  # > 60 min
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🧮 CALCUL DES COÛTS
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_analysis_cost(
    model: str = "mistral-small-latest",
    duration_minutes: int = 15,
    with_web_search: bool = False,
    with_fact_check: bool = False,
    fact_check_level: str = "basic"
) -> Dict[str, Any]:
    """
    Calcule le coût total d'une analyse vidéo.
    
    Args:
        model: Le modèle Mistral à utiliser
        duration_minutes: Durée de la vidéo en minutes
        with_web_search: Activer la recherche web Perplexity
        with_fact_check: Activer la vérification des faits
        fact_check_level: "basic" ou "advanced"
    
    Returns:
        Dict avec breakdown détaillé et total
    """
    model_info = MODEL_COSTS.get(model, MODEL_COSTS["mistral-small-latest"])
    
    # Coût de base selon le modèle
    base_cost = model_info["analysis"]
    
    # Multiplicateur de longueur
    if duration_minutes < 10:
        length_mult = LENGTH_MULTIPLIERS["short"]
    elif duration_minutes < 30:
        length_mult = LENGTH_MULTIPLIERS["medium"]
    elif duration_minutes < 60:
        length_mult = LENGTH_MULTIPLIERS["long"]
    else:
        length_mult = LENGTH_MULTIPLIERS["very_long"]
    
    # Calculer le coût ajusté
    adjusted_cost = int(base_cost * length_mult)
    
    # Coûts additionnels
    web_search_cost = FEATURE_COSTS["web_search"] if with_web_search else 0
    
    fact_check_cost = 0
    if with_fact_check:
        if fact_check_level == "advanced":
            fact_check_cost = FEATURE_COSTS["fact_check_advanced"]
        else:
            fact_check_cost = FEATURE_COSTS["fact_check_basic"]
    
    total = adjusted_cost + web_search_cost + fact_check_cost
    
    return {
        "total": total,
        "breakdown": {
            "model_base": base_cost,
            "length_multiplier": length_mult,
            "model_adjusted": adjusted_cost,
            "web_search": web_search_cost,
            "fact_check": fact_check_cost
        },
        "model": model,
        "model_name": model_info["name"],
        "duration_minutes": duration_minutes
    }


def calculate_chat_cost(
    model: str = "mistral-small-latest",
    with_web_search: bool = False,
    message_length: str = "normal"  # "short", "normal", "long"
) -> Dict[str, Any]:
    """
    Calcule le coût d'un message de chat IA.
    """
    model_info = MODEL_COSTS.get(model, MODEL_COSTS["mistral-small-latest"])
    
    base_cost = model_info["chat"]
    
    # Ajustement selon la longueur
    length_mult = {"short": 0.5, "normal": 1.0, "long": 1.5}.get(message_length, 1.0)
    adjusted_cost = int(base_cost * length_mult)
    
    web_search_cost = FEATURE_COSTS["web_search"] if with_web_search else 0
    
    total = adjusted_cost + web_search_cost
    
    return {
        "total": total,
        "breakdown": {
            "model_base": base_cost,
            "length_multiplier": length_mult,
            "model_adjusted": adjusted_cost,
            "web_search": web_search_cost
        },
        "model": model,
        "model_name": model_info["name"]
    }


def calculate_playlist_cost(
    video_count: int,
    model: str = "mistral-small-latest",
    with_web_search: bool = False
) -> Dict[str, Any]:
    """
    Calcule le coût d'une analyse de playlist.
    """
    # Coût par vidéo (réduit pour les playlists)
    per_video_cost = FEATURE_COSTS["playlist_per_video"]
    model_mult = MODEL_COSTS.get(model, MODEL_COSTS["mistral-small-latest"])["multiplier"]
    
    videos_cost = int(video_count * per_video_cost * model_mult)
    
    # Synthèse globale
    synthesis_cost = int(MODEL_COSTS.get(model, MODEL_COSTS["mistral-small-latest"])["analysis"] * 0.5)
    
    web_cost = FEATURE_COSTS["web_search"] if with_web_search else 0
    
    total = videos_cost + synthesis_cost + web_cost
    
    return {
        "total": total,
        "breakdown": {
            "videos": videos_cost,
            "synthesis": synthesis_cost,
            "web_search": web_cost,
            "per_video": int(per_video_cost * model_mult)
        },
        "video_count": video_count,
        "model": model
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 💳 OPÉRATIONS SUR LES CRÉDITS
# ═══════════════════════════════════════════════════════════════════════════════

async def get_user_credits(session: AsyncSession, user_id: int) -> Tuple[int, str]:
    """
    Récupère les crédits et le plan d'un utilisateur.
    Returns: (credits, plan)
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return 0, "free"
    
    return user.credits or 0, user.plan or "free"


async def check_credits(
    session: AsyncSession,
    user_id: int,
    required: int
) -> Tuple[bool, int, str]:
    """
    Vérifie si l'utilisateur a assez de crédits.
    Returns: (has_enough, current_credits, message)
    """
    credits, plan = await get_user_credits(session, user_id)
    
    if credits >= required:
        return True, credits, "ok"
    
    deficit = required - credits
    return False, credits, f"insufficient_credits:{deficit}"


async def deduct_credits(
    session: AsyncSession,
    user_id: int,
    amount: int,
    action_type: str,
    description: str,
    metadata: Optional[Dict] = None
) -> Tuple[bool, int]:
    """
    Déduit des crédits avec enregistrement détaillé.
    
    Args:
        session: Session DB
        user_id: ID utilisateur
        amount: Montant à déduire
        action_type: "analysis", "chat", "export", "playlist", "web_search"
        description: Description lisible
        metadata: Données additionnelles (model, video_id, etc.)
    
    Returns: (success, new_balance)
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return False, 0
    
    current = user.credits or 0
    if current < amount:
        return False, current
    
    # Déduire
    user.credits = current - amount
    
    # Créer la transaction
    transaction = CreditTransaction(
        user_id=user_id,
        amount=-amount,
        balance_after=user.credits,
        transaction_type=action_type,
        type=action_type,
        description=description
    )
    session.add(transaction)
    
    await session.commit()
    
    print(f"💰 Credits: User {user_id} spent {amount} credits ({action_type}). Balance: {user.credits}", flush=True)
    
    return True, user.credits


async def add_credits(
    session: AsyncSession,
    user_id: int,
    amount: int,
    reason: str,
    transaction_type: str = "purchase"
) -> Tuple[bool, int]:
    """
    Ajoute des crédits (achat, bonus, remboursement).
    Returns: (success, new_balance)
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return False, 0
    
    current = user.credits or 0
    user.credits = current + amount
    
    transaction = CreditTransaction(
        user_id=user_id,
        amount=amount,
        balance_after=user.credits,
        transaction_type=transaction_type,
        type=transaction_type,
        description=reason
    )
    session.add(transaction)
    
    await session.commit()
    
    print(f"💰 Credits: User {user_id} received {amount} credits ({transaction_type}). Balance: {user.credits}", flush=True)
    
    return True, user.credits


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 ESTIMATION POUR L'UI
# ═══════════════════════════════════════════════════════════════════════════════

def get_cost_preview(
    action: str,
    model: str = "mistral-small-latest",
    **kwargs
) -> Dict[str, Any]:
    """
    Génère une estimation de coût pour l'affichage UI.
    
    Usage:
        get_cost_preview("analysis", model="mistral-large-latest", duration_minutes=45)
        get_cost_preview("chat", model="mistral-medium-latest", with_web_search=True)
    """
    if action == "analysis":
        return calculate_analysis_cost(
            model=model,
            duration_minutes=kwargs.get("duration_minutes", 15),
            with_web_search=kwargs.get("with_web_search", False),
            with_fact_check=kwargs.get("with_fact_check", False),
            fact_check_level=kwargs.get("fact_check_level", "basic")
        )
    elif action == "chat":
        return calculate_chat_cost(
            model=model,
            with_web_search=kwargs.get("with_web_search", False),
            message_length=kwargs.get("message_length", "normal")
        )
    elif action == "playlist":
        return calculate_playlist_cost(
            video_count=kwargs.get("video_count", 1),
            model=model,
            with_web_search=kwargs.get("with_web_search", False)
        )
    else:
        return {"total": 0, "error": "unknown_action"}


def get_credits_summary() -> Dict[str, Any]:
    """
    Retourne un résumé des coûts pour la documentation/UI.
    """
    return {
        "plans": {
            plan: {"monthly_credits": credits}
            for plan, credits in PLAN_CREDITS.items()
            if plan != "unlimited"
        },
        "models": {
            model_id: {
                "name": info["name"],
                "analysis_cost": info["analysis"],
                "chat_cost": info["chat"],
                "multiplier": info["multiplier"]
            }
            for model_id, info in MODEL_COSTS.items()
        },
        "features": {
            "web_search": FEATURE_COSTS["web_search"],
            "fact_check_basic": FEATURE_COSTS["fact_check_basic"],
            "fact_check_advanced": FEATURE_COSTS["fact_check_advanced"],
            "export_pdf": FEATURE_COSTS["export_pdf"],
            "export_audio": FEATURE_COSTS["export_audio"]
        },
        "examples": {
            "analysis_small_short": calculate_analysis_cost("mistral-small-latest", 10),
            "analysis_large_long": calculate_analysis_cost("mistral-large-latest", 60, True, True, "advanced"),
            "chat_small": calculate_chat_cost("mistral-small-latest"),
            "chat_large_web": calculate_chat_cost("mistral-large-latest", True)
        }
    }
