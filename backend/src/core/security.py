"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔐 SECURITY SERVICE v2.0 — Sécurité & Rate Limiting Intelligent                   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  CORRECTIONS v2.0:                                                                 ║
║  ✅ Rate limiting intelligent avec cache pour endpoints légers                     ║
║  ✅ Limites burst augmentées pour éviter les faux positifs                         ║
║  ✅ Whitelist des endpoints exemptés du rate limiting strict                       ║
║  ✅ Headers de réponse avec temps d'attente                                        ║
║  ✅ Gestion des crédits atomique                                                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import hashlib
import time
import secrets
from datetime import datetime, date
from typing import Optional, Dict, Any, Tuple
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from enum import Enum

from db.database import User, CreditTransaction, Summary, ChatQuota, WebSearchUsage
from core.config import PLAN_LIMITS


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TYPES ET CONSTANTES
# ═══════════════════════════════════════════════════════════════════════════════

class OperationType(Enum):
    VIDEO_ANALYSIS = "video_analysis"
    PLAYLIST_ANALYSIS = "playlist_analysis"
    CHAT_MESSAGE = "chat_message"
    WEB_SEARCH = "web_search"
    EXPORT = "export"


class SecurityError(Exception):
    """Exception de sécurité personnalisée"""
    def __init__(self, code: str, message: str, status_code: int = 403):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


# Coûts en crédits par opération et par modèle
CREDIT_COSTS = {
    "video_analysis": {
        "mistral-small-2603": 1,
        "mistral-medium-2508": 2,
        "mistral-large-2512": 3,
    },
    "playlist_video": 1,
    "chat_message": 0,
    "web_search": 0,
    "export": 0,
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 RATE LIMITING v2.0 — Configuration intelligente
# ═══════════════════════════════════════════════════════════════════════════════

# Rate limiting par plan - LIMITES AUGMENTÉES
RATE_LIMITS = {
    "free": {"requests_per_minute": 60, "burst": 30},
    "pro": {"requests_per_minute": 200, "burst": 80},
    "unlimited": {"requests_per_minute": 2000, "burst": 500},
}

# Endpoints exemptés du rate limiting strict
# ⚡ v7.1: Ajout status polling + history/keywords (polling léger, ne doit pas bloquer l'UX)
RATE_LIMIT_EXEMPT_ENDPOINTS = {
    "/api/auth/me",
    "/api/auth/quota",
    "/api/health",
    "/health",
}

# Endpoints avec préfixe — exemptés si le path commence par un de ces préfixes
RATE_LIMIT_EXEMPT_PREFIXES = [
    "/api/videos/status/",      # Polling status analyse (2-3 req/sec pendant analyse)
    "/api/history/keywords",    # Auto-complete keywords
]

# Cache pour les appels récents
_user_request_cache: Dict[int, Dict[str, float]] = {}
CACHE_COOLDOWN_SECONDS = 2


# ═══════════════════════════════════════════════════════════════════════════════
# 🔒 STOCKAGE EN MÉMOIRE
# ═══════════════════════════════════════════════════════════════════════════════

_user_locks: Dict[int, asyncio.Lock] = {}
_credit_reservations: Dict[int, Dict[str, int]] = {}
_rate_limits: Dict[int, Dict[str, Any]] = {}
_token_blacklist: Dict[str, float] = {}
_monthly_reset_cache: Dict[int, str] = {}

# 🆕 IP-based rate limiting for unauthenticated requests
_ip_rate_limits: Dict[str, Dict[str, Any]] = {}
IP_RATE_LIMIT = {"requests_per_minute": 20, "burst": 10}  # Stricter for anonymous


def _get_user_lock(user_id: int) -> asyncio.Lock:
    if user_id not in _user_locks:
        _user_locks[user_id] = asyncio.Lock()
    return _user_locks[user_id]


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()[:32]


# ═══════════════════════════════════════════════════════════════════════════════
# 🛡️ RATE LIMITING v2.0 — Intelligent
# ═══════════════════════════════════════════════════════════════════════════════

def is_endpoint_exempt(endpoint: str) -> bool:
    """Vérifie si un endpoint est exempté du rate limiting strict"""
    if endpoint in RATE_LIMIT_EXEMPT_ENDPOINTS:
        return True
    # Vérifier les préfixes (endpoints dynamiques comme /status/{task_id})
    for prefix in RATE_LIMIT_EXEMPT_PREFIXES:
        if endpoint.startswith(prefix):
            return True
    return False


async def check_rate_limit(
    user_id: int, 
    user_plan: str,
    endpoint: str = ""
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Vérifie et applique le rate limiting pour un utilisateur.
    """
    now = time.time()
    
    # Endpoints exemptés
    if is_endpoint_exempt(endpoint):
        return True, "exempt", {"exempt": True, "endpoint": endpoint}
    
    limits = RATE_LIMITS.get(user_plan, RATE_LIMITS["free"])
    max_requests = limits["requests_per_minute"]
    burst = limits["burst"]
    
    if user_id not in _rate_limits:
        _rate_limits[user_id] = {
            "count": 0,
            "window_start": now,
            "blocked_until": 0,
            "burst_count": 0,
            "burst_window": now
        }
    
    rate_info = _rate_limits[user_id]
    
    # Vérifier si bloqué
    if rate_info["blocked_until"] > now:
        wait_time = int(rate_info["blocked_until"] - now)
        return False, "rate_limit_blocked", {
            "blocked": True,
            "wait_seconds": wait_time,
            "message": f"Trop de requêtes. Réessayez dans {wait_time}s",
            "retry_after": wait_time
        }
    
    # Réinitialiser la fenêtre si expirée
    if now - rate_info["window_start"] > 60:
        rate_info["count"] = 0
        rate_info["window_start"] = now
    
    if now - rate_info["burst_window"] > 10:
        rate_info["burst_count"] = 0
        rate_info["burst_window"] = now
    
    # Vérifier le burst
    rate_info["burst_count"] += 1
    if rate_info["burst_count"] > burst:
        rate_info["blocked_until"] = now + 5
        return False, "burst_limit", {
            "blocked": True,
            "wait_seconds": 5,
            "message": "Trop de requêtes simultanées. Patientez 5 secondes.",
            "retry_after": 5
        }
    
    # Vérifier le rate limit global
    rate_info["count"] += 1
    if rate_info["count"] > max_requests:
        rate_info["blocked_until"] = now + 30
        return False, "rate_limit_exceeded", {
            "blocked": True,
            "wait_seconds": 30,
            "message": f"Limite de {max_requests} requêtes/minute atteinte.",
            "retry_after": 30
        }
    
    remaining = max_requests - rate_info["count"]
    return True, "ok", {
        "remaining": remaining,
        "limit": max_requests,
        "reset_in": int(60 - (now - rate_info["window_start"]))
    }


async def check_rate_limit_for_auth(user_id: int, user_plan: str) -> Tuple[bool, str, Dict[str, Any]]:
    """Version allégée du rate limiting pour les endpoints d'authentification."""
    now = time.time()
    limits = RATE_LIMITS.get(user_plan, RATE_LIMITS["free"])
    max_requests = limits["requests_per_minute"] * 2
    burst = limits["burst"] * 2

    if user_id not in _rate_limits:
        _rate_limits[user_id] = {
            "count": 0,
            "window_start": now,
            "blocked_until": 0,
            "burst_count": 0,
            "burst_window": now
        }

    rate_info = _rate_limits[user_id]

    if rate_info["blocked_until"] > now:
        wait_time = int(rate_info["blocked_until"] - now)
        return False, "rate_limit_blocked", {
            "blocked": True,
            "wait_seconds": wait_time,
            "message": f"Trop de requêtes. Réessayez dans {wait_time}s"
        }

    if now - rate_info["window_start"] > 60:
        rate_info["count"] = 0
        rate_info["window_start"] = now

    if now - rate_info["burst_window"] > 10:
        rate_info["burst_count"] = 0
        rate_info["burst_window"] = now

    rate_info["burst_count"] += 1
    rate_info["count"] += 1

    remaining = max(0, max_requests - rate_info["count"])
    return True, "ok", {
        "remaining": remaining,
        "limit": max_requests
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 IP-BASED RATE LIMITING — Pour requêtes non authentifiées
# ═══════════════════════════════════════════════════════════════════════════════

async def check_ip_rate_limit(
    ip_address: str,
    endpoint: str = ""
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Rate limiting basé sur l'IP pour les requêtes non authentifiées.
    Plus strict que le rate limiting utilisateur.
    """
    now = time.time()

    # Endpoints exemptés
    if is_endpoint_exempt(endpoint):
        return True, "exempt", {"exempt": True, "endpoint": endpoint}

    max_requests = IP_RATE_LIMIT["requests_per_minute"]
    burst = IP_RATE_LIMIT["burst"]

    # Normaliser l'IP (supprimer port si présent)
    ip_key = ip_address.split(":")[0] if ":" in ip_address and not ip_address.startswith("[") else ip_address

    if ip_key not in _ip_rate_limits:
        _ip_rate_limits[ip_key] = {
            "count": 0,
            "window_start": now,
            "blocked_until": 0,
            "burst_count": 0,
            "burst_window": now
        }

    rate_info = _ip_rate_limits[ip_key]

    # Vérifier si bloqué
    if rate_info["blocked_until"] > now:
        wait_time = int(rate_info["blocked_until"] - now)
        return False, "ip_rate_limit_blocked", {
            "blocked": True,
            "wait_seconds": wait_time,
            "message": f"Too many requests from your IP. Retry in {wait_time}s",
            "retry_after": wait_time
        }

    # Réinitialiser la fenêtre si expirée
    if now - rate_info["window_start"] > 60:
        rate_info["count"] = 0
        rate_info["window_start"] = now

    if now - rate_info["burst_window"] > 10:
        rate_info["burst_count"] = 0
        rate_info["burst_window"] = now

    # Vérifier le burst
    rate_info["burst_count"] += 1
    if rate_info["burst_count"] > burst:
        rate_info["blocked_until"] = now + 10  # 10s block pour IP
        return False, "ip_burst_limit", {
            "blocked": True,
            "wait_seconds": 10,
            "message": "Too many rapid requests. Wait 10 seconds.",
            "retry_after": 10
        }

    # Vérifier le rate limit global
    rate_info["count"] += 1
    if rate_info["count"] > max_requests:
        rate_info["blocked_until"] = now + 60  # 60s block pour IP
        return False, "ip_rate_limit_exceeded", {
            "blocked": True,
            "wait_seconds": 60,
            "message": f"Rate limit of {max_requests} requests/minute exceeded.",
            "retry_after": 60
        }

    remaining = max_requests - rate_info["count"]
    return True, "ok", {
        "remaining": remaining,
        "limit": max_requests,
        "reset_in": int(60 - (now - rate_info["window_start"]))
    }


def cleanup_expired_ip_limits():
    """Nettoie les entrées IP expirées pour libérer la mémoire."""
    now = time.time()
    expired = [
        ip for ip, info in _ip_rate_limits.items()
        if now - info["window_start"] > 300  # 5 minutes d'inactivité
    ]
    for ip in expired:
        del _ip_rate_limits[ip]
    return len(expired)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 GESTION DES TOKENS
# ═══════════════════════════════════════════════════════════════════════════════

def blacklist_token(token: str, expiry_seconds: int = 86400):
    token_hash = _hash_token(token)
    _token_blacklist[token_hash] = time.time() + expiry_seconds
    
    now = time.time()
    expired = [h for h, exp in _token_blacklist.items() if exp < now]
    for h in expired:
        del _token_blacklist[h]


def is_token_blacklisted(token: str) -> bool:
    token_hash = _hash_token(token)
    if token_hash in _token_blacklist:
        if _token_blacklist[token_hash] > time.time():
            return True
        else:
            del _token_blacklist[token_hash]
    return False


def generate_secure_operation_id(user_id: int, operation_type: str) -> str:
    random_part = secrets.token_hex(8)
    timestamp = int(time.time() * 1000)
    raw = f"{user_id}-{operation_type}-{timestamp}-{random_part}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


# ═══════════════════════════════════════════════════════════════════════════════
# 💰 RESET MENSUEL DES CRÉDITS
# ═══════════════════════════════════════════════════════════════════════════════

async def check_and_reset_monthly_credits(
    session: AsyncSession,
    user: User
) -> Tuple[int, bool]:
    # Admin bypass — ne jamais réinitialiser les crédits admin
    if user.is_admin:
        return user.credits or 999999, False

    from billing.plan_config import normalize_plan_id  # lazy import to avoid circular dependency
    normalized_plan = normalize_plan_id(user.plan)
    if normalized_plan == "free":
        return user.credits or 0, False
    
    today = date.today()
    current_month = today.strftime("%Y-%m")
    
    last_reset = _monthly_reset_cache.get(user.id)
    if last_reset == current_month:
        return user.credits or 0, False
    
    user_lock = _get_user_lock(user.id)
    async with user_lock:
        last_reset = _monthly_reset_cache.get(user.id)
        if last_reset == current_month:
            return user.credits or 0, False
        
        result = await session.execute(
            select(CreditTransaction)
            .where(
                CreditTransaction.user_id == user.id,
                CreditTransaction.transaction_type.in_(["renewal", "monthly_reset", "purchase"])
            )
            .order_by(CreditTransaction.created_at.desc())
            .limit(1)
        )
        last_transaction = result.scalar_one_or_none()
        
        if last_transaction and last_transaction.created_at.strftime("%Y-%m") == current_month:
            _monthly_reset_cache[user.id] = current_month
            return user.credits or 0, False
        
        plan_limits = PLAN_LIMITS.get(user.plan, PLAN_LIMITS["free"])
        monthly_credits = plan_limits.get("monthly_credits", 10)
        
        old_credits = user.credits or 0
        user.credits = monthly_credits
        
        transaction = CreditTransaction(
            user_id=user.id,
            amount=monthly_credits,
            balance_after=monthly_credits,
            transaction_type="monthly_reset",
            type="monthly_reset",
            description=f"Renouvellement mensuel {current_month}"
        )
        session.add(transaction)
        await session.commit()
        
        _monthly_reset_cache[user.id] = current_month
        print(f"✅ Monthly reset for user {user.id}: {old_credits} → {monthly_credits} credits", flush=True)
        
        return monthly_credits, True


# ═══════════════════════════════════════════════════════════════════════════════
# 💳 GESTION DES CRÉDITS
# ═══════════════════════════════════════════════════════════════════════════════

def get_credit_cost(operation_type: str, model: str = None) -> int:
    if operation_type == "video_analysis" and model:
        return CREDIT_COSTS.get("video_analysis", {}).get(model, 1)
    return CREDIT_COSTS.get(operation_type, 0)


async def reserve_credits(
    session: AsyncSession,
    user_id: int,
    amount: int,
    operation_type: str
) -> Tuple[bool, str, Dict[str, Any]]:
    operation_id = generate_secure_operation_id(user_id, operation_type)
    user_lock = _get_user_lock(user_id)
    
    async with user_lock:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            return False, "user_not_found", {}
        
        credits, _ = await check_and_reset_monthly_credits(session, user)
        
        already_reserved = sum(_credit_reservations.get(user_id, {}).values())
        available = credits - already_reserved
        
        if available < amount:
            return False, "insufficient_credits", {
                "credits": credits,
                "available": available,
                "requested": amount,
                "reserved": already_reserved
            }
        
        if user_id not in _credit_reservations:
            _credit_reservations[user_id] = {}
        _credit_reservations[user_id][operation_id] = amount
        
        return True, "ok", {
            "operation_id": operation_id,
            "reserved": amount,
            "available_after": available - amount
        }


async def consume_credits(
    session: AsyncSession,
    user_id: int,
    operation_id: str,
    description: str = ""
) -> Tuple[bool, str]:
    user_lock = _get_user_lock(user_id)
    
    async with user_lock:
        reservations = _credit_reservations.get(user_id, {})
        if operation_id not in reservations:
            return False, "reservation_not_found"
        
        amount = reservations[operation_id]
        
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            del reservations[operation_id]
            return False, "user_not_found"
        
        user.credits = max(0, (user.credits or 0) - amount)
        
        transaction = CreditTransaction(
            user_id=user_id,
            amount=-amount,
            balance_after=user.credits,
            transaction_type="consumption",
            type="consumption",
            description=description or f"Operation {operation_id[:8]}"
        )
        session.add(transaction)
        
        await session.commit()
        
        del reservations[operation_id]
        
        return True, "ok"


async def release_reservation(user_id: int, operation_id: str):
    reservations = _credit_reservations.get(user_id, {})
    if operation_id in reservations:
        del reservations[operation_id]


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 VÉRIFICATIONS PRÉ-OPÉRATION
# ═══════════════════════════════════════════════════════════════════════════════

async def check_video_analysis_allowed(
    session: AsyncSession,
    user_id: int,
    model: str = "mistral-small-2603"
) -> Tuple[bool, str, Dict[str, Any]]:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        return False, "user_not_found", {}

    # Admin bypass — tous les modèles, crédits illimités
    if user.is_admin:
        return True, "ok", {
            "credits": user.credits or 999999,
            "available": user.credits or 999999,
            "cost": 0,
            "model": model,
            "plan": user.plan
        }

    plan_limits = PLAN_LIMITS.get(user.plan, PLAN_LIMITS["free"])
    
    allowed_models = plan_limits.get("models", ["mistral-small-2603"])
    if model not in allowed_models:
        return False, "model_not_allowed", {
            "message": f"Le modèle {model} n'est pas disponible pour votre plan.",
            "allowed_models": allowed_models
        }
    
    credits, _ = await check_and_reset_monthly_credits(session, user)
    reserved = sum(_credit_reservations.get(user_id, {}).values())
    available = credits - reserved
    cost = get_credit_cost("video_analysis", model)
    
    if available < cost:
        return False, "insufficient_credits", {
            "credits": credits,
            "available": available,
            "cost": cost,
            "plan": user.plan
        }

    return True, "ok", {
        "credits": credits,
        "available": available,
        "cost": cost,
        "model": model,
        "plan": user.plan
    }


async def check_playlist_analysis_allowed(
    session: AsyncSession,
    user_id: int,
    num_videos: int
) -> Tuple[bool, str, Dict[str, Any]]:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        return False, "user_not_found", {}

    # Admin bypass — playlists illimitées
    if user.is_admin:
        return True, "ok", {
            "credits": user.credits or 999999,
            "available": user.credits or 999999,
            "cost": 0,
            "max_videos": 999,
            "plan": user.plan
        }

    plan_limits = PLAN_LIMITS.get(user.plan, PLAN_LIMITS["free"])
    
    if not plan_limits.get("can_use_playlists", False):
        return False, "playlists_not_allowed", {
            "message": "Les playlists ne sont pas disponibles pour votre plan.",
            "required_plan": "pro"
        }
    
    max_videos = plan_limits.get("max_playlist_videos", 0)
    if num_videos > max_videos:
        return False, "too_many_videos", {
            "message": f"Maximum {max_videos} vidéos par playlist pour votre plan.",
            "max_videos": max_videos,
            "requested": num_videos
        }
    
    credits, _ = await check_and_reset_monthly_credits(session, user)
    reserved = sum(_credit_reservations.get(user_id, {}).values())
    available = credits - reserved
    
    cost = num_videos
    
    if available < cost:
        return False, "insufficient_credits", {
            "credits": credits,
            "available": available,
            "cost": cost,
            "plan": user.plan
        }
    
    return True, "ok", {
        "credits": credits,
        "available": available,
        "cost": cost,
        "max_videos": max_videos,
        "plan": user.plan
    }


async def check_chat_quota(
    session: AsyncSession,
    user_id: int,
    summary_id: Optional[int] = None
) -> Tuple[bool, str, Dict[str, Any]]:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        return False, "user_not_found", {}

    # Admin bypass — chat illimité
    from core.config import ADMIN_CONFIG
    admin_email = ADMIN_CONFIG.get("ADMIN_EMAIL", "").lower()
    is_admin = user.is_admin or (user.email or "").lower() == admin_email
    if is_admin:
        return True, "ok", {
            "daily_used": 0, "daily_limit": -1,
            "video_used": 0, "video_limit": -1,
            "unlimited": True
        }

    plan_limits = PLAN_LIMITS.get(user.plan, PLAN_LIMITS["free"])
    daily_limit = plan_limits.get("chat_daily_limit", 10)
    per_video_limit = plan_limits.get("chat_per_video_limit", 5)
    
    if daily_limit == -1:
        return True, "ok", {
            "daily_used": 0,
            "daily_limit": -1,
            "video_used": 0,
            "video_limit": -1,
            "unlimited": True
        }
    
    today = date.today().isoformat()
    quota_result = await session.execute(
        select(ChatQuota).where(
            ChatQuota.user_id == user_id,
            ChatQuota.quota_date == today
        )
    )
    quota = quota_result.scalar_one_or_none()
    daily_used = quota.daily_count if quota else 0
    
    info = {
        "daily_used": daily_used,
        "daily_limit": daily_limit,
        "daily_remaining": max(0, daily_limit - daily_used),
        "video_limit": per_video_limit
    }
    
    if daily_used >= daily_limit:
        return False, "daily_limit_reached", info
    
    return True, "ok", info


async def check_web_search_quota(
    session: AsyncSession,
    user_id: int
) -> Tuple[bool, str, Dict[str, Any]]:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        return False, "user_not_found", {}

    # Admin bypass — web search illimité
    if user.is_admin:
        return True, "ok", {"unlimited": True}

    plan_limits = PLAN_LIMITS.get(user.plan, PLAN_LIMITS["free"])
    
    if not plan_limits.get("web_search_enabled", False):
        return False, "web_search_disabled", {
            "message": "La recherche web n'est pas disponible pour votre plan.",
            "required_plan": "pro"
        }
    
    monthly_limit = plan_limits.get("web_search_monthly", 0)
    
    if monthly_limit == -1:
        return True, "ok", {"unlimited": True}
    
    month = date.today().strftime("%Y-%m")
    usage_result = await session.execute(
        select(WebSearchUsage).where(
            WebSearchUsage.user_id == user_id,
            WebSearchUsage.month_year == month
        )
    )
    usage = usage_result.scalar_one_or_none()
    used = usage.search_count if usage else 0
    
    info = {
        "used": used,
        "limit": monthly_limit,
        "remaining": max(0, monthly_limit - used)
    }
    
    if used >= monthly_limit:
        return False, "monthly_limit_reached", info
    
    return True, "ok", info


async def get_user_credits_info(
    session: AsyncSession,
    user_id: int
) -> Dict[str, Any]:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return {"error": "user_not_found"}
    
    credits, was_reset = await check_and_reset_monthly_credits(session, user)
    
    plan_limits = PLAN_LIMITS.get(user.plan, PLAN_LIMITS["free"])
    reserved = sum(_credit_reservations.get(user_id, {}).values())
    
    first_of_month = date.today().replace(day=1)
    analyses_result = await session.execute(
        select(func.count())
        .select_from(Summary)
        .where(Summary.user_id == user_id)
        .where(Summary.created_at >= datetime.combine(first_of_month, datetime.min.time()))
    )
    analyses_this_month = analyses_result.scalar() or 0
    
    return {
        "credits": {
            "current": credits,
            "available": credits - reserved,
            "reserved": reserved,
            "monthly_limit": plan_limits.get("monthly_credits", 10),
            "was_reset": was_reset
        },
        "plan": {
            "name": user.plan,
            "display_name": plan_limits.get("name", {}).get("fr", user.plan),
            "color": plan_limits.get("color", "#888888")
        },
        "usage": {
            "analyses_this_month": analyses_this_month,
        },
        "limits": {
            "chat_daily": plan_limits.get("chat_daily_limit", 10),
            "chat_per_video": plan_limits.get("chat_per_video_limit", 5),
            "web_search_monthly": plan_limits.get("web_search_monthly", 0),
            "max_playlist_videos": plan_limits.get("max_playlist_videos", 0),
            "can_use_playlists": plan_limits.get("can_use_playlists", False)
        },
        "costs": {
            "video_small": get_credit_cost("video_analysis", "mistral-small-2603"),
            "video_medium": get_credit_cost("video_analysis", "mistral-medium-2508"),
            "video_large": get_credit_cost("video_analysis", "mistral-large-2512"),
            "playlist_video": CREDIT_COSTS["playlist_video"]
        }
    }


async def verify_resource_ownership(
    session: AsyncSession,
    user_id: int,
    resource_type: str,
    resource_id: int
) -> bool:
    if resource_type == "summary":
        result = await session.execute(
            select(Summary).where(
                Summary.id == resource_id,
                Summary.user_id == user_id
            )
        )
        return result.scalar_one_or_none() is not None
    
    return False
