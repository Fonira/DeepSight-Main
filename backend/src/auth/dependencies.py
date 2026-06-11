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
from typing import Callable, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
import jwt  # PyJWT (Wave 1 Step 5 migration from python-jose, CVE-2024-33664/33663)
from jwt.exceptions import ExpiredSignatureError, PyJWTError as JWTError
from sqlalchemy.ext.asyncio import AsyncSession

import core.config as _core_config
from db.database import get_session, User
from .service import verify_token_with_flow, get_user_by_id, validate_session_token, validate_session_v2


def _jwt_config() -> dict:
    """Lookup JWT_CONFIG at call time, not import time.

    Workaround pour le test suite qui reload `core.config` via
    `importlib.reload` (cf `tests/billing/test_pricing_v2.py`). Un import
    `from core.config import JWT_CONFIG` au top du module fige une
    référence vers l'ancien dict, qui ne correspond plus au dict actif
    après reload — d'où des `JWSSignatureError` quand un token signé avec
    le nouveau dict est décodé avec l'ancienne référence. La résolution
    dynamique via `_core_config.JWT_CONFIG` à chaque call garantit la
    cohérence.
    """
    return _core_config.JWT_CONFIG


logger = logging.getLogger(__name__)


def is_admin_user(user: Optional[User]) -> bool:
    """True si l'utilisateur est admin (flag DB is_admin OU email == ADMIN_EMAIL)."""
    if user is None:
        return False
    admin_email = (_core_config.ADMIN_CONFIG.get("ADMIN_EMAIL") or "").lower()
    return bool(user.is_admin or ((user.email or "").lower() == admin_email))


def is_private_mode_allowed(user: Optional[User]) -> bool:
    """True si l'utilisateur peut accéder pendant le mode privé.

    Admin (is_admin / ADMIN_EMAIL) OU email dans l'allowlist de sécurité
    (cf core.config.private_mode_allowed_emails — garantit l'accès du fondateur).
    """
    if is_admin_user(user):
        return True
    email = (getattr(user, "email", "") or "").lower() if user is not None else ""
    return bool(email and email in _core_config.private_mode_allowed_emails())


def enforce_private_mode(user: Optional[User]) -> None:
    """🔒 Mode privé : bloque tout sauf l'admin/allowlist quand PRIVATE_MODE est actif.

    Lève une 403 explicite pour les non-autorisés. No-op si le mode est inactif
    (cas par défaut en dev/test) ou si l'utilisateur est autorisé.
    """
    if _core_config.is_private_mode() and not is_private_mode_allowed(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "private_mode",
                "message": (
                    "DeepSight est temporairement en accès privé (maintenance). L'accès est réservé à l'administrateur."
                ),
            },
        )


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
    session: AsyncSession = Depends(get_session),
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
            detail={"code": "not_authenticated", "message": "Authentication required. Please log in."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 🔒 Vérifier si le token est blacklisté (logout/révoqué) — Sprint C: now async (Redis)
    if SECURITY_AVAILABLE and await is_token_blacklisted(actual_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_revoked", "message": "This session has been revoked. Please log in again."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Vérifier le token + décider du flow (V1 legacy vs V2 — Wave 1 Step 4)
    payload, auth_flow = verify_token_with_flow(actual_token, token_type="access")

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_invalid", "message": "Invalid or expired token. Please log in again."},
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

    user = await get_user_by_id(session, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "user_not_found", "message": "User account not found."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 🆕 Wave 1 Step 4 — Validation session selon le flow décidé par feature_flags.
    # V1 legacy : validate_session_token (User.session_token unique partagé).
    # V2 :        validate_session_v2 (UserSession lookup via jti).
    if auth_flow == "v2":
        jti = payload.get("jti")
        if not jti:
            # Token V2 décidé par le feature flag mais pas de jti dans le payload
            # → token V1 émis avant l'enrollment dans le bucket. On rejette pour
            # forcer un re-login propre (et émettre un token V2 cette fois).
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "session_upgrade_required",
                    "message": "Your session needs to be upgraded. Please log in again.",
                },
                headers={"WWW-Authenticate": "Bearer", "X-Session-Invalid": "true"},
            )
        is_valid_session = await validate_session_v2(session, jti)
        if not is_valid_session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "session_expired",
                    "message": "Your session has expired. You may have logged in from another device.",
                },
                headers={"WWW-Authenticate": "Bearer", "X-Session-Invalid": "true"},
            )
    else:
        # Flow legacy V1 : validation session_token classique.
        session_token = payload.get("session")
        if session_token:
            is_valid_session = await validate_session_token(session, user_id, session_token)
            if not is_valid_session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={
                        "code": "session_expired",
                        "message": "Your session has expired. You may have logged in from another device.",
                    },
                    headers={"WWW-Authenticate": "Bearer", "X-Session-Invalid": "true"},
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
                    "wait_seconds": rate_info.get("wait_seconds", 60),
                },
            )

    # 🔒 Mode privé — coupe l'accès aux non-admins (y compris sessions déjà ouvertes)
    enforce_private_mode(user)

    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
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

    # Vérifier le blacklist — Sprint C: now async (Redis)
    if SECURITY_AVAILABLE and await is_token_blacklisted(actual_token):
        return None

    # Wave 1 Step 4 — branche V1 / V2 via feature flag.
    payload, auth_flow = verify_token_with_flow(actual_token, token_type="access")

    if not payload:
        return None

    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        return None

    user = await get_user_by_id(session, user_id)

    if not user:
        return None

    if auth_flow == "v2":
        jti = payload.get("jti")
        if not jti:
            # Pas de jti sur un user bucketé V2 → token V1 obsolète → reject silencieux.
            return None
        is_valid_session = await validate_session_v2(session, jti)
        if not is_valid_session:
            return None
    else:
        # Flow legacy V1.
        session_token = payload.get("session")
        if session_token:
            is_valid_session = await validate_session_token(session, user_id, session_token)
            if not is_valid_session:
                return None

    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dépendance pour vérifier que l'utilisateur est admin.
    """
    from core.config import ADMIN_CONFIG

    # Vérifier is_admin dans la DB OU email == ADMIN_EMAIL
    admin_email = ADMIN_CONFIG.get("ADMIN_EMAIL", "").lower()
    is_admin = current_user.is_admin or ((current_user.email or "").lower() == admin_email)

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail={"code": "admin_required", "message": "Admin access required"}
        )
    return current_user


# Alias pour compatibilité avec TTS router
async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> Optional[User]:
    """Alias de get_current_user_optional pour compatibilité."""
    return await get_current_user_optional(credentials, token, session)


async def get_verified_user(current_user: User = Depends(get_current_user)) -> User:
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
                "action": "verify_email",
            },
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
                    "action": "upgrade",
                },
            )
        return current_user

    return check_plan


def require_credits(min_credits: int = 1):
    """
    🔐 Factory de dépendance pour vérifier les crédits disponibles.
    Usage: Depends(require_credits(3))
    """

    async def check_credits(
        current_user: User = Depends(get_verified_user), session: AsyncSession = Depends(get_session)
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
                    "action": "upgrade",
                },
            )
        return current_user

    return check_credits


async def check_daily_limit(
    current_user: User = Depends(get_verified_user), session: AsyncSession = Depends(get_session)
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
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error_info)

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

    async def check_feature(current_user: User = Depends(get_verified_user)) -> User:
        # Admin bypass — toutes les features accessibles
        if current_user.is_admin:
            return current_user

        from core.plan_limits import check_feature_access

        has_access, error_info = check_feature_access(current_user, feature, lang=current_user.default_lang or "fr")

        if not has_access:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_info)

        return current_user

    return check_feature


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 AUTH V2 — Token payload + Re-auth scopé (Wave 1 Step 3, 2026-05-21)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_current_token_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    token: Optional[str] = Depends(oauth2_scheme),
) -> dict:
    """Decode le JWT courant et retourne le payload brut (sans re-valider la session).

    La validation complète (blocklist, session, user) est déjà faite par
    `get_current_user` — cette dépendance ne sert qu'à exposer le payload pour
    les endpoints qui ont besoin du `jti` (= session_id V2) pour marquer la
    session courante.

    Doit toujours être déclarée APRÈS `get_current_user` dans l'endpoint (FastAPI
    résout les Depends dans l'ordre de la signature, mais comme on ne re-valide
    pas ici, l'ordre importe peu en pratique).

    Returns:
        Le payload décodé du JWT (dict avec sub, exp, iat, type, jti, ...).

    Raises:
        HTTPException 401 si aucun token n'est fourni ou si le decode échoue
        (ne devrait pas arriver si get_current_user a précédemment validé).
    """
    # Priorité au Bearer token dans les headers (même règle que get_current_user)
    actual_token: Optional[str] = None
    if credentials:
        actual_token = credentials.credentials
    elif token:
        actual_token = token

    if not actual_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": "Authentication required."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return jwt.decode(
            actual_token,
            _jwt_config()["SECRET_KEY"],
            algorithms=[_jwt_config()["ALGORITHM"]],
        )
    except JWTError:
        # Ne devrait pas arriver si get_current_user a déjà validé, mais defensive.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_invalid", "message": "Invalid or expired token."},
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_recent_reauth(audience: str) -> Callable:
    """Factory de dépendance qui valide la présence d'un `X-Reauth-Token` valide.

    Utilisée pour scoper les endpoints sensibles (billing, account deletion,
    change-email, change-password). Le client doit d'abord appeler
    POST /api/auth/reauth pour obtenir un reauth_token (JWT 5 min, scope=reauth,
    aud=<audience>) puis le re-fournir dans le header `X-Reauth-Token`.

    Spec : `2026-05-21-auth-v2-complet-design.md` §4.6.

    Args:
        audience: scope cible (ex: "billing", "delete", "change-email",
            "change-password"). Doit matcher `ReauthAudience` Literal côté
            schemas.

    Usage:
        @router.delete("/account")
        async def delete_account(
            _: None = Depends(require_recent_reauth("delete")),
            current_user: User = Depends(get_current_user),
            ...
        ):
            ...

    Returns:
        Une dépendance FastAPI qui retourne None si OK, raise HTTPException 401
        sinon (avec un code détaillé : REAUTH_REQUIRED / REAUTH_EXPIRED /
        REAUTH_INVALID / REAUTH_WRONG_SCOPE / REAUTH_WRONG_AUDIENCE /
        REAUTH_USER_MISMATCH).
    """

    async def dep(
        request: Request,
        current_user: User = Depends(get_current_user),
    ) -> None:
        reauth_token = request.headers.get("X-Reauth-Token")
        if not reauth_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "REAUTH_REQUIRED", "message": "Re-authentication required for this action."},
            )

        try:
            payload = jwt.decode(
                reauth_token,
                _jwt_config()["SECRET_KEY"],
                algorithms=[_jwt_config()["ALGORITHM"]],
                audience=audience,
            )
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "REAUTH_EXPIRED",
                    "message": "Re-authentication expired. Please re-enter your password.",
                },
            )
        except JWTError as e:
            # jose lève JWTClaimsError (sous-classe de JWTError) si l'audience
            # ne match pas — on remap en REAUTH_WRONG_AUDIENCE pour signaler
            # clairement la cause côté frontend.
            msg = str(e).lower()
            if "audience" in msg:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"code": "REAUTH_WRONG_AUDIENCE", "message": "Re-auth token scoped for another action."},
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "REAUTH_INVALID", "message": "Re-authentication token invalid."},
            )

        if payload.get("scope") != "reauth":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "REAUTH_WRONG_SCOPE", "message": "Token is not a re-auth token."},
            )

        if str(payload.get("sub")) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "REAUTH_USER_MISMATCH",
                    "message": "Re-auth token does not belong to the current user.",
                },
            )

        return None

    return dep
