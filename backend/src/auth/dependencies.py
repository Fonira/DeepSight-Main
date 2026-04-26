"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔗 AUTH DEPENDENCIES v3.0 — Sessions Uniques & Sécurité Renforcée                 ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  SÉCURITÉ v3.0:                                                                    ║
║  ✅ Validation du session_token (session unique par utilisateur)                   ║
║  ✅ Vérification des tokens blacklistés                                            ║
║  ✅ Rate limiting intégré                                                           ║
║  ✅ Validation stricte des permissions                                              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from db.database import get_session, User
from .service import verify_token, get_user_by_id, validate_session_token

logger = logging.getLogger(__name__)

# Import du service de sécurité
try:
    from core.security import is_token_blacklisted, check_rate_limit
    SECURITY_AVAILABLE = True
except ImportError:
    SECURITY_AVAILABLE = False
    if os.getenv("ENV") == "production":
        raise ImportError("core.security module is required in production but could not be imported")
    logger.warning("Security module not available, using basic auth")

# Schéma OAuth2 pour les tokens Bearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
http_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    🔐 Dépendance SÉCURISÉE pour obtenir l'utilisateur courant.
    
    Vérifications v3.0:
    1. Présence du token
    2. Token non blacklisté
    3. Token valide et non expiré
    4. Utilisateur existe
    5. 🆕 Session_token valide (session unique)
    6. Rate limiting
    """
    # Priorité au Bearer token dans les headers
    actual_token = None
    if credentials:
        actual_token = credentials.credentials
    elif token:
        actual_token = token
    
    if not actual_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "not_authenticated",
                "message": "Authentication required. Please log in."
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 🔒 Vérifier si le token est blacklisté (logout/révoqué)
    if SECURITY_AVAILABLE and is_token_blacklisted(actual_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "token_revoked",
                "message": "This session has been revoked. Please log in again."
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Vérifier le token
    payload = verify_token(actual_token, token_type="access")
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "token_invalid",
                "message": "Invalid or expired token. Please log in again."
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Récupérer l'utilisateur
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_invalid", "message": "Invalid token payload: missing sub."},
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_invalid", "message": "Invalid token payload: sub must be an integer."},
            headers={"WWW-Authenticate": "Bearer"},
        )
    session_token = payload.get("session")  # 🆕 Récupérer le session_token du JWT

    user = await get_user_by_id(session, user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "user_not_found",
                "message": "User account not found."
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 🆕 Valider le session_token (session unique par utilisateur)
    if session_token:
        is_valid_session = await validate_session_token(session, user_id, session_token)
        if not is_valid_session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "session_expired",
                    "message": "Your session has expired. You may have logged in from another device."
                },
                headers={
                    "WWW-Authenticate": "Bearer",
                    "X-Session-Invalid": "true"
                },
            )
    
    # 🔒 Rate limiting (optionnel à ce niveau, plus strict dans les endpoints sensibles)
    # Admin exempt du rate limiting auth-level (protection DDoS reste au niveau Caddy)
    if SECURITY_AVAILABLE and not user.is_admin:
        rate_ok, rate_reason, rate_info = await check_rate_limit(user_id, user.plan or "free")
        if not rate_ok:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": rate_reason,
                    "message": rate_info.get("message", "Too many requests"),
                    "wait_seconds": rate_info.get("wait_seconds", 60)
                }
            )
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session)
) -> Optional[User]:
    """
    Dépendance optionnelle pour obtenir l'utilisateur courant.
    Retourne None si non authentifié (pas d'exception).
    
    ⚠️ ATTENTION: N'utilisez PAS cette dépendance pour des endpoints sensibles!
    """
    actual_token = None
    if credentials:
        actual_token = credentials.credentials
    elif token:
        actual_token = token
    
    if not actual_token:
        return None
    
    # Vérifier le blacklist
    if SECURITY_AVAILABLE and is_token_blacklisted(actual_token):
        return None
    
    payload = verify_token(actual_token, token_type="access")
    
    if not payload:
        return None
    
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        return None
    session_token = payload.get("session")

    user = await get_user_by_id(session, user_id)

    if not user:
        return None
    
    # 🆕 Valider le session_token même pour optionnel
    if session_token:
        is_valid_session = await validate_session_token(session, user_id, session_token)
        if not is_valid_session:
            return None
    
    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dépendance pour vérifier que l'utilisateur est admin.
    """
    from core.config import ADMIN_CONFIG
    
    # Vérifier is_admin dans la DB OU email == ADMIN_EMAIL
    admin_email = ADMIN_CONFIG.get("ADMIN_EMAIL", "").lower()
    is_admin = current_user.is_admin or ((current_user.email or "").lower() == admin_email)
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "admin_required",
                "message": "Admin access required"
            }
        )
    return current_user


# Alias pour compatibilité avec TTS router
async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session)
) -> Optional[User]:
    """Alias de get_current_user_optional pour compatibilité."""
    return await get_current_user_optional(credentials, token, session)


async def get_verified_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    🔐 Dépendance pour vérifier que l'email est vérifié.
    OBLIGATOIRE pour les opérations qui consomment des crédits.
    """
    # Les admins sont exemptés
    if current_user.is_admin:
        return current_user
    
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "email_not_verified",
                "message": "Please verify your email before using this feature.",
                "action": "verify_email"
            }
        )
    return current_user


def require_plan(min_plan: str):
    """
    Factory de dépendance pour vérifier le plan utilisateur.
    Usage: Depends(require_plan("pro"))
    Hiérarchie Avril 2026 : free → pro (2 plans uniquement).
    """
    from billing.plan_config import normalize_plan_id, get_plan_index

    async def check_plan(current_user: User = Depends(get_verified_user)) -> User:
        # Admin bypass — accès à tous les plans
        if current_user.is_admin:
            return current_user

        raw_plan = current_user.plan or "free"
        user_plan = normalize_plan_id(raw_plan)
        normalized_min = normalize_plan_id(min_plan)

        user_idx = get_plan_index(user_plan)
        min_idx = get_plan_index(normalized_min)

        if user_idx < min_idx:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "plan_required",
                    "message": "This feature requires Pro plan.",
                    "current_plan": user_plan,
                    "required_plan": normalized_min,
                    "action": "upgrade"
                }
            )
        return current_user

    return check_plan


def require_credits(min_credits: int = 1):
    """
    🔐 Factory de dépendance pour vérifier les crédits disponibles.
    Usage: Depends(require_credits(3))
    """
    async def check_credits(
        current_user: User = Depends(get_verified_user),
        session: AsyncSession = Depends(get_session)
    ) -> User:
        # Admin users have unlimited access
        if current_user.is_admin:
            return current_user

        credits = current_user.credits or 0

        if credits < min_credits:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "insufficient_credits",
                    "message": f"Not enough credits. You have {credits}, need {min_credits}.",
                    "credits": credits,
                    "required": min_credits,
                    "action": "upgrade"
                }
            )
        return current_user

    return check_credits


async def check_daily_limit(
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    🎫 Vérifie la limite quotidienne d'analyses.
    Usage: Depends(check_daily_limit)

    Plans (Avril 2026):
    - free: 5 analyses/jour
    - pro: 50 analyses/jour
    """
    # Admin bypass — analyses illimitées
    if current_user.is_admin:
        return current_user

    from core.plan_limits import check_daily_analysis_limit

    can_analyze, error_info = await check_daily_analysis_limit(
        session, current_user, lang=current_user.default_lang or "fr"
    )

    if not can_analyze:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_info
        )

    return current_user


def require_feature(feature: str):
    """
    🔐 Factory de dépendance pour vérifier l'accès à une feature.
    Usage: Depends(require_feature("playlists"))

    Features:
    - playlists: Analyse de playlists
    - export_csv: Export CSV
    - export_excel: Export Excel
    - batch_api: API batch
    - tts: Text-to-speech
    - deep_research: Recherche approfondie
    - web_search: Recherche web
    """
    async def check_feature(
        current_user: User = Depends(get_verified_user)
    ) -> User:
        # Admin bypass — toutes les features accessibles
        if current_user.is_admin:
            return current_user

        from core.plan_limits import check_feature_access

        has_access, error_info = check_feature_access(
            current_user, feature, lang=current_user.default_lang or "fr"
        )

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_info
            )

        return current_user

    return check_feature
