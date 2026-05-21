"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔐 AUTH SERVICE v2.0 — Sessions Robustes & Uniques                                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FEATURES v2.0:                                                                    ║
║  ✅ Session unique par utilisateur (déconnexion auto autres appareils)             ║
║  ✅ Tokens JWT avec session_token intégré                                          ║
║  ✅ Refresh token rotation sécurisée                                               ║
║  ✅ Persistance robuste côté serveur                                               ║
║  ✅ Validation session à chaque requête                                            ║
║                                                                                    ║
║  Wave 1 Step 2 (2026-05-21) — Auth V2 session lifecycle :                          ║
║  ✅ create_session_v2 / rotate_refresh_session / revoke_session_v2                 ║
║  ✅ list_user_sessions / validate_session_v2                                       ║
║  ✅ TTLs sliding 30j (24h si !stay_signed_in) + absolute cap 90j                   ║
║  ✅ Rotation single-use refresh token + Redis blocklist                            ║
║  ✅ Device label parsé du user-agent + IP hash anonymisée                          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import hashlib
import os
import re
import secrets
import uuid
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from jose import jwt, JWTError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import JWT_CONFIG, GOOGLE_OAUTH_CONFIG, APPLE_OAUTH_CONFIG, EMAIL_CONFIG, APP_URL, ADMIN_CONFIG
from core.logging import logger
from billing.plan_config import get_limits
from db.database import User, ChatQuota, WebSearchUsage, UserSession, hash_password, verify_password

# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 SESSION TOKEN FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════


def generate_session_token() -> str:
    """Génère un token de session unique et sécurisé"""
    return secrets.token_urlsafe(32)


async def create_user_session(session: AsyncSession, user_id: int) -> str:
    """
    Multi-device: réutilise le session_token existant en DB s'il y en a un,
    sinon en crée un nouveau. Les logins simultanés Web/Mobile/Extension
    cohabitent — plus d'écrasement qui invaliderait les autres devices.

    Why: avant, chaque login/refresh écrasait `User.session_token`, déconnectant
    silencieusement tous les autres devices (UX "SESSION_EXPIRED" récurrent dès
    que l'user se reloggait ailleurs).
    """
    result = await session.execute(select(User.session_token).where(User.id == user_id))
    existing = result.scalar_one_or_none()

    if existing:
        # Session déjà active → on update juste last_login, on garde le token.
        await session.execute(update(User).where(User.id == user_id).values(last_login=datetime.utcnow()))
        await session.commit()
        return existing

    session_token = generate_session_token()
    await session.execute(
        update(User).where(User.id == user_id).values(session_token=session_token, last_login=datetime.utcnow())
    )
    await session.commit()

    print(f"🔐 New session created for user {user_id}", flush=True)
    return session_token


async def validate_session_token(session: AsyncSession, user_id: int, session_token: str) -> bool:
    """Vérifie si le session_token est valide.

    Multi-device: on n'exige plus l'égalité stricte avec le token DB. Tant
    que le DB token n'a PAS été explicitement révoqué (NULL via /logout ou
    invalidate_user_session), le JWT signé est suffisant.
    """
    result = await session.execute(select(User.session_token).where(User.id == user_id))
    stored_token = result.scalar_one_or_none()

    # NULL en DB = logout/révocation volontaire → on rejette.
    if stored_token is None:
        return False
    return True


async def invalidate_user_session(session: AsyncSession, user_id: int) -> None:
    """Invalide la session de l'utilisateur (déconnexion)"""
    await session.execute(update(User).where(User.id == user_id).values(session_token=None))
    await session.commit()
    print(f"🚪 Session invalidated for user {user_id}", flush=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 JWT FUNCTIONS (Enhanced with session_token)
# ═══════════════════════════════════════════════════════════════════════════════


def create_access_token(user_id: int, is_admin: bool = False, session_token: str = None) -> str:
    """Crée un access token JWT avec session_token intégré"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_CONFIG["ACCESS_TOKEN_EXPIRE_MINUTES"])
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access",
        "is_admin": is_admin,
        "session": session_token,  # 🆕 Session token pour validation
    }
    return jwt.encode(payload, JWT_CONFIG["SECRET_KEY"], algorithm=JWT_CONFIG["ALGORITHM"])


def create_refresh_token(user_id: int, session_token: str = None) -> str:
    """Crée un refresh token JWT avec session_token intégré"""
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_CONFIG["REFRESH_TOKEN_EXPIRE_DAYS"])
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh",
        "session": session_token,  # 🆕 Session token pour validation
    }
    return jwt.encode(payload, JWT_CONFIG["SECRET_KEY"], algorithm=JWT_CONFIG["ALGORITHM"])


def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    """Vérifie et décode un token JWT, retourne le payload avec session_token"""
    try:
        payload = jwt.decode(token, JWT_CONFIG["SECRET_KEY"], algorithms=[JWT_CONFIG["ALGORITHM"]])
        if payload.get("type") != token_type:
            return None
        return payload
    except JWTError as e:
        print(f"❌ JWT verification error: {e}", flush=True)
        return None


def get_token_session(token: str) -> Optional[str]:
    """Extrait le session_token d'un JWT sans vérification complète"""
    try:
        payload = jwt.decode(
            token,
            JWT_CONFIG["SECRET_KEY"],
            algorithms=[JWT_CONFIG["ALGORITHM"]],
            options={"verify_exp": False},  # Ne pas vérifier l'expiration
        )
        return payload.get("session")
    except JWTError:
        return None


def generate_verification_code() -> str:
    """Génère un code de vérification à 6 chiffres"""
    return "".join([str(secrets.randbelow(10)) for _ in range(6)])


def generate_reset_code() -> str:
    """Génère un code de reset sécurisé"""
    return secrets.token_urlsafe(32)


# ═══════════════════════════════════════════════════════════════════════════════
# 👤 USER SERVICE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════


async def get_user_by_id(session: AsyncSession, user_id: int) -> Optional[User]:
    """Récupère un utilisateur par ID"""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(session: AsyncSession, email: str) -> Optional[User]:
    """Récupère un utilisateur par email"""
    result = await session.execute(select(User).where(User.email == email.lower().strip()))
    return result.scalar_one_or_none()


async def get_user_by_username(session: AsyncSession, username: str) -> Optional[User]:
    """Récupère un utilisateur par username"""
    result = await session.execute(select(User).where(User.username == username.lower().strip()))
    return result.scalar_one_or_none()


async def create_user(
    session: AsyncSession,
    username: str,
    email: str,
    password: str,
    email_verified: bool = False,
    google_id: Optional[str] = None,
) -> Tuple[bool, Optional[User], str]:
    """
    Crée un nouvel utilisateur.
    Retourne: (success, user, message)
    """
    email = email.lower().strip()
    username = username.lower().strip()

    # Vérifier si l'email existe
    existing = await get_user_by_email(session, email)
    if existing:
        return False, None, "❌ Email déjà utilisé"

    # Vérifier si le username existe
    existing = await get_user_by_username(session, username)
    if existing:
        return False, None, "❌ Nom d'utilisateur déjà pris"

    # Crédits initiaux selon le plan free
    initial_credits = get_limits("free")["monthly_credits"]

    # Générer le code de vérification si nécessaire
    # IMPORTANT: Vérifier que Resend est réellement configuré, pas juste "enabled"
    verification_code = None
    verification_expires = None
    email_service_configured = (
        EMAIL_CONFIG.get("ENABLED")
        and EMAIL_CONFIG.get("RESEND_API_KEY")
        and len(EMAIL_CONFIG.get("RESEND_API_KEY", "")) > 0
    )

    if not email_verified and email_service_configured:
        verification_code = generate_verification_code()
        verification_expires = datetime.now() + timedelta(minutes=10)
    elif not email_verified and not email_service_configured:
        # Auto-vérifier si le service email n'est pas configuré (mode dev)
        email_verified = True
        print(f"⚠️ Auto-verifying user {email} (Resend not configured)", flush=True)

    # Créer l'utilisateur
    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        email_verified=email_verified,
        verification_code=verification_code,
        verification_expires=verification_expires,
        plan="free",
        credits=initial_credits,
        google_id=google_id,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return True, user, "✅ Compte créé avec succès"


async def authenticate_user(
    session: AsyncSession, email: str, password: str
) -> Tuple[bool, Optional[User], str, Optional[str]]:
    """
    Authentifie un utilisateur et crée une nouvelle session.
    IMPORTANT: Invalide les sessions précédentes (session unique).
    Retourne: (success, user, message, session_token)
    """
    user = await get_user_by_email(session, email)

    if not user:
        # 🔐 SECURITY LOG: Tentative de connexion avec email inexistant
        print(f"🔒 [SECURITY] Failed login attempt - unknown email: {email[:3]}***", flush=True)
        return False, None, "❌ Email ou mot de passe incorrect", None

    # 🔐 Utiliser verify_password pour compatibilité bcrypt/SHA256
    if not verify_password(password, user.password_hash):
        # 🔐 SECURITY LOG: Mot de passe incorrect
        print(f"🔒 [SECURITY] Failed login attempt - wrong password for user_id: {user.id}", flush=True)
        return False, None, "❌ Email ou mot de passe incorrect", None

    # 🔄 Migration automatique vers bcrypt si ancien hash SHA256
    if user.password_hash and not user.password_hash.startswith("$2"):
        try:
            user.password_hash = hash_password(password)
            await session.commit()
            print(f"🔐 Migrated password hash to bcrypt for user {user.id}", flush=True)
        except Exception:
            pass  # Non-bloquant si la migration échoue

    # Vérifier si l'email doit être vérifié
    # IMPORTANT: Seulement si Resend est réellement configuré
    email_service_configured = (
        EMAIL_CONFIG.get("ENABLED")
        and EMAIL_CONFIG.get("RESEND_API_KEY")
        and len(EMAIL_CONFIG.get("RESEND_API_KEY", "")) > 0
    )

    if email_service_configured and not user.email_verified:
        return False, user, "📧 VERIFICATION_REQUIRED", None

    # Si l'email n'est pas configuré mais l'utilisateur n'est pas vérifié, auto-vérifier
    if not user.email_verified and not email_service_configured:
        user.email_verified = True
        await session.commit()
        print(f"⚠️ Auto-verified user {user.email} on login (Resend not configured)", flush=True)

    # 🆕 Créer une nouvelle session unique (invalide les anciennes)
    session_token = await create_user_session(session, user.id)

    return True, user, "✅ Connexion réussie", session_token


async def verify_email(session: AsyncSession, email: str, code: str) -> Tuple[bool, str]:
    """Vérifie le code email"""
    user = await get_user_by_email(session, email)

    if not user:
        return False, "❌ Email non trouvé"

    if user.email_verified:
        return True, "✅ Email déjà vérifié"

    if user.verification_code != code:
        return False, "❌ Code incorrect"

    # Vérifier expiration
    if user.verification_expires:
        if datetime.now() > user.verification_expires:
            return False, "❌ Code expiré. Demandez un nouveau code."

    # Marquer comme vérifié
    user.email_verified = True
    user.verification_code = None
    await session.commit()

    return True, "✅ Email vérifié avec succès"


async def resend_verification(session: AsyncSession, email: str) -> Tuple[bool, str, Optional[str]]:
    """
    Renvoie le code de vérification.
    Retourne: (success, message, code)
    """
    user = await get_user_by_email(session, email)

    if not user:
        return False, "❌ Email non trouvé", None

    if user.email_verified:
        return False, "✅ Email déjà vérifié", None

    # Générer nouveau code
    code = generate_verification_code()
    user.verification_code = code
    user.verification_expires = datetime.now() + timedelta(minutes=10)
    await session.commit()

    return True, "✅ Nouveau code généré", code


async def initiate_password_reset(session: AsyncSession, email: str) -> Tuple[bool, str, Optional[str]]:
    """
    Initie la réinitialisation du mot de passe.
    Retourne: (success, message, reset_code)
    """
    user = await get_user_by_email(session, email)

    if not user:
        # Ne pas révéler si l'email existe ou non
        return True, "✅ Si cet email existe, un lien de réinitialisation a été envoyé", None

    # Générer code de reset
    code = generate_reset_code()
    user.reset_code = code
    user.reset_expires = datetime.now() + timedelta(hours=1)
    await session.commit()

    return True, "✅ Code de réinitialisation généré", code


async def reset_password(session: AsyncSession, email: str, code: str, new_password: str) -> Tuple[bool, str]:
    """Réinitialise le mot de passe"""
    user = await get_user_by_email(session, email)

    if not user:
        return False, "❌ Email non trouvé"

    if not user.reset_code or user.reset_code != code:
        return False, "❌ Code invalide"

    if user.reset_expires and datetime.now() > user.reset_expires:
        return False, "❌ Code expiré"

    # Mettre à jour le mot de passe
    user.password_hash = hash_password(new_password)
    user.reset_code = None
    user.reset_expires = None
    await session.commit()

    return True, "✅ Mot de passe réinitialisé"


async def change_password(
    session: AsyncSession, user_id: int, current_password: str, new_password: str
) -> Tuple[bool, str]:
    """Change le mot de passe"""
    user = await get_user_by_id(session, user_id)

    if not user:
        return False, "❌ Utilisateur non trouvé"

    # 🔐 Utiliser verify_password pour compatibilité bcrypt/SHA256
    if not verify_password(current_password, user.password_hash):
        return False, "❌ Mot de passe actuel incorrect"

    # Toujours hasher avec bcrypt
    user.password_hash = hash_password(new_password)
    await session.commit()

    return True, "✅ Mot de passe modifié"


async def update_user_preferences(session: AsyncSession, user_id: int, **kwargs) -> bool:
    """Met à jour les préférences utilisateur.

    Champs scalaires whitelistés (`default_lang`, `default_mode`, etc.) → écrits
    directement comme attributs de la table User.

    Champs JSON-bag (`ambient_lighting_enabled`, `extra_preferences`) → mergés
    non-destructivement dans la colonne `User.preferences` (JSON). On réassigne
    explicitement `user.preferences = {...nouveau dict...}` car SQLAlchemy ne
    détecte pas les mutations in-place sur les colonnes JSON (sauf usage de
    MutableDict, non activé ici).
    """
    import logging

    log = logging.getLogger(__name__)

    allowed_fields = ["default_lang", "default_mode", "default_model", "mistral_key", "supadata_key"]

    user = await get_user_by_id(session, user_id)
    if not user:
        return False

    # 1. Champs scalaires (colonnes dédiées)
    for field, value in kwargs.items():
        if field in allowed_fields and value is not None:
            setattr(user, field, value)

    # 2. Bag JSON `preferences` — merge des prefs souples
    prefs_updates: dict = {}

    ambient_value = kwargs.get("ambient_lighting_enabled")
    if ambient_value is not None:
        prefs_updates["ambient_lighting_enabled"] = bool(ambient_value)

    extra = kwargs.get("extra_preferences")
    if isinstance(extra, dict) and extra:
        # Les clés explicites (ex: ambient_lighting_enabled) gagnent sur extra_preferences
        # si fournies en doublon → on merge extra d'abord puis prefs_updates par-dessus.
        merged_extras = {**extra, **prefs_updates}
        prefs_updates = merged_extras

    if prefs_updates:
        current = dict(user.preferences or {})
        current.update(prefs_updates)
        # Réassignation explicite : SQLAlchemy ne détecte pas la mutation in-place
        # sur une colonne JSON sans MutableDict.
        user.preferences = current
        log.debug(f"update_user_preferences user_id={user_id} prefs_updates={prefs_updates}")

    await session.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 QUOTA FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════


async def get_user_quota(session: AsyncSession, user_id: int) -> dict:
    """Récupère les quotas complets d'un utilisateur"""
    user = await get_user_by_id(session, user_id)
    if not user:
        return {}

    plan = user.plan or "free"
    limits = get_limits(plan)

    # Chat quota du jour
    today = datetime.now().strftime("%Y-%m-%d")
    chat_result = await session.execute(
        select(ChatQuota).where(ChatQuota.user_id == user_id, ChatQuota.quota_date == today)
    )
    chat_quota = chat_result.scalar_one_or_none()
    chat_used = chat_quota.daily_count if chat_quota else 0

    # Web search quota du mois
    month = datetime.now().strftime("%Y-%m")
    web_result = await session.execute(
        select(WebSearchUsage).where(WebSearchUsage.user_id == user_id, WebSearchUsage.month_year == month)
    )
    web_quota = web_result.scalar_one_or_none()
    web_used = web_quota.search_count if web_quota else 0

    return {
        "credits": user.credits,
        "monthly_credits": limits.get("monthly_credits", 10),
        "credits_remaining": user.credits,
        "can_use": user.credits > 0,
        "plan": plan,
        "max_playlist_videos": limits.get("max_playlist_videos", 0),
        "chat_daily_limit": limits.get("chat_daily_limit", 10),
        "chat_used_today": chat_used,
        "web_search_monthly": limits.get("web_search_monthly", 0),
        "web_search_used": web_used,
        "web_search_enabled": limits.get("web_search_enabled", False),
        "chat_playlist_enabled": limits.get("chat_playlist_enabled", False),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 GOOGLE OAUTH
# ═══════════════════════════════════════════════════════════════════════════════

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def get_google_auth_url(state: Optional[str] = None) -> str:
    """Génère l'URL d'authentification Google"""
    if not GOOGLE_OAUTH_CONFIG.get("ENABLED") or not GOOGLE_OAUTH_CONFIG.get("CLIENT_ID"):
        return ""

    # State pour CSRF protection
    if not state:
        csrf_token = secrets.token_urlsafe(16)
        state = csrf_token

    import urllib.parse

    params = {
        "client_id": GOOGLE_OAUTH_CONFIG["CLIENT_ID"],
        "redirect_uri": GOOGLE_OAUTH_CONFIG.get("REDIRECT_URI", f"{APP_URL}/api/auth/google/callback"),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }

    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


async def exchange_google_code(code: str) -> Optional[dict]:
    """Échange le code d'autorisation contre un token"""
    try:
        data = {
            "client_id": GOOGLE_OAUTH_CONFIG["CLIENT_ID"],
            "client_secret": GOOGLE_OAUTH_CONFIG["CLIENT_SECRET"],
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": GOOGLE_OAUTH_CONFIG.get("REDIRECT_URI", f"{APP_URL}/api/auth/google/callback"),
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(GOOGLE_TOKEN_URL, data=data, timeout=10)

            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ Google token error: {response.text}", flush=True)
                return None
    except Exception as e:
        print(f"❌ Google OAuth exception: {e}", flush=True)
        return None


async def get_google_user_info(access_token: str) -> Optional[dict]:
    """Récupère les infos utilisateur Google"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=10
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception as e:
        print(f"❌ Google userinfo error: {e}", flush=True)
        return None


async def login_or_register_google_user(
    session: AsyncSession,
    google_user: dict,
    auto_create: bool = True,
) -> Tuple[bool, Optional[User], str, Optional[str]]:
    """
    Connecte ou crée un utilisateur via Google OAuth.
    L'email est automatiquement vérifié.
    Si l'email correspond à ADMIN_EMAIL, l'utilisateur devient admin.

    Si `auto_create=False` et qu'aucun utilisateur n'existe pour cet email
    (ni ce google_id), retourne `(False, None, "NOT_REGISTERED", None)`. Ce
    mode est utilisé par l'extension Chrome en auto-login silencieux: on ne
    crée pas de compte sans interaction utilisateur, on laisse le client
    rediriger vers le formulaire signup avec email pré-rempli.

    Retourne: (success, user, message, session_token)
    """
    email = google_user.get("email", "").lower().strip()
    google_id = google_user.get("id", "")
    google_user.get("name", email.split("@")[0])

    if not email:
        return False, None, "❌ Email non fourni par Google", None

    # Vérifier si c'est l'admin
    admin_email = ADMIN_CONFIG.get("ADMIN_EMAIL", "").lower().strip()
    is_admin_user = email == admin_email

    # Chercher l'utilisateur existant
    result = await session.execute(select(User).where((User.email == email) | (User.google_id == google_id)))
    user = result.scalar_one_or_none()

    if user:
        # Utilisateur existant - mettre à jour google_id si nécessaire
        if not user.google_id:
            user.google_id = google_id
            user.email_verified = True

        # 🔐 Si c'est l'admin, s'assurer que is_admin=True et plan=pro
        if is_admin_user and not user.is_admin:
            user.is_admin = True
            user.plan = "pro"
            user.credits = 999999
            print(f"🔐 Admin privileges granted to: {email}", flush=True)

        await session.commit()

        # 🆕 Créer une session unique
        session_token = await create_user_session(session, user.id)

        return True, user, "✅ Connexion Google réussie", session_token

    # Aucun utilisateur trouvé et création désactivée (extension silent auto-login)
    if not auto_create:
        return False, None, "NOT_REGISTERED", None

    # Nouvel utilisateur
    username = email.split("@")[0].lower()

    # S'assurer que le username est unique
    base_username = username
    counter = 1
    while True:
        existing = await get_user_by_username(session, username)
        if not existing:
            break
        username = f"{base_username}{counter}"
        counter += 1

    # Créer avec mot de passe aléatoire
    random_password = secrets.token_urlsafe(16)

    # 🔐 Si c'est l'admin, créer avec privilèges admin
    if is_admin_user:
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(random_password),
            email_verified=True,
            google_id=google_id,
            plan="pro",
            credits=999999,
            is_admin=True,
        )
        print(f"🔐 Admin user created via Google: {email}", flush=True)
    else:
        initial_credits = get_limits("free")["monthly_credits"]
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(random_password),
            email_verified=True,
            google_id=google_id,
            plan="free",
            credits=initial_credits,
        )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    # 🆕 Créer une session unique
    session_token = await create_user_session(session, user.id)

    return True, user, "✅ Compte créé avec Google", session_token


# ═══════════════════════════════════════════════════════════════════════════════
# 📱 GOOGLE OAUTH MOBILE — Vérification ID Token (Expo / @react-native-google-signin)
# ═══════════════════════════════════════════════════════════════════════════════


def _get_allowed_google_audiences(client_platform: str = "web") -> list[str]:
    """
    Retourne la liste des audiences Google OAuth autorisées selon la plateforme.
    Toutes les audiences non-vides sont incluses pour supporter le cross-platform
    (ex: ID token émis pour le client Web depuis @react-native-google-signin Android).
    """
    audiences: set[str] = set()
    for key in ("CLIENT_ID", "IOS_CLIENT_ID", "ANDROID_CLIENT_ID"):
        value = GOOGLE_OAUTH_CONFIG.get(key)
        if value:
            audiences.add(value)
    return [a for a in audiences if a]


def verify_google_id_token(id_token_str: str, client_platform: str = "web") -> Optional[dict]:
    """
    Vérifie un Google ID token JWT (signé par Google).

    - Valide la signature via les clés publiques Google (tls + cache httpcache).
    - Vérifie que l'audience (`aud`) correspond à l'un de nos client IDs OAuth
      (Web, iOS, Android — toutes plateformes acceptées).
    - Vérifie que l'issuer (`iss`) est Google.
    - Vérifie l'expiration (`exp`).

    Retourne les claims décodés (dict) si valides, None sinon.

    Les claims Google incluent typiquement:
      - sub: Google user ID (stable, unique)
      - email: adresse email
      - email_verified: bool
      - name, picture, given_name, family_name
      - aud, iss, exp, iat
    """
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
    except ImportError as e:
        # google-auth non installé — dégradation gracieuse
        import logging

        logging.getLogger(__name__).error(
            f"google-auth package not installed: {e}. Install with: pip install google-auth>=2.23.0"
        )
        return None

    allowed_audiences = _get_allowed_google_audiences(client_platform)
    if not allowed_audiences:
        import logging

        logging.getLogger(__name__).error(
            "No Google OAuth client IDs configured (GOOGLE_CLIENT_ID / GOOGLE_IOS_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID)"
        )
        return None

    try:
        # google.oauth2.id_token.verify_oauth2_token accepte une seule audience.
        # Pour en accepter plusieurs, on tente chacune successivement.
        request = google_requests.Request()
        last_error: Optional[Exception] = None
        for audience in allowed_audiences:
            try:
                claims = google_id_token.verify_oauth2_token(
                    id_token_str,
                    request,
                    audience=audience,
                )
                # Vérifier l'issuer
                issuer = claims.get("iss", "")
                if issuer not in ("accounts.google.com", "https://accounts.google.com"):
                    last_error = ValueError(f"Invalid issuer: {issuer}")
                    continue
                return claims
            except ValueError as e:
                last_error = e
                continue

        # Aucune audience n'a matché
        import logging

        logging.getLogger(__name__).warning(f"Google ID token verification failed for all audiences: {last_error}")
        return None
    except Exception as e:
        import logging

        logging.getLogger(__name__).error(f"Unexpected error verifying Google ID token: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🍎 SIGN IN WITH APPLE — Verification id_token + login/register
# ═══════════════════════════════════════════════════════════════════════════════

APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"

# Cache des JWKs Apple (les clés tournent — TTL 1h suffit pour limiter les fetches
# tout en restant resilient aux rotations). Cle = "jwks", valeur = (timestamp, jwks_dict).
_APPLE_JWKS_CACHE: dict = {}
_APPLE_JWKS_TTL_SECONDS = 3600


async def _fetch_apple_jwks() -> Optional[dict]:
    """Recupere les JWKs publics Apple (cache 1h)."""
    import time
    import logging

    log = logging.getLogger(__name__)
    cached = _APPLE_JWKS_CACHE.get("jwks")
    now = time.time()
    if cached and (now - cached[0]) < _APPLE_JWKS_TTL_SECONDS:
        return cached[1]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(APPLE_JWKS_URL, timeout=10)
            if response.status_code != 200:
                log.warning(f"Apple JWKs fetch failed: HTTP {response.status_code}")
                # Fallback sur cache stale si dispo
                return cached[1] if cached else None
            jwks = response.json()
            _APPLE_JWKS_CACHE["jwks"] = (now, jwks)
            return jwks
    except Exception as e:
        log.error(f"Apple JWKs fetch exception: {e}")
        return cached[1] if cached else None


def _get_allowed_apple_audiences(client_platform: str = "web") -> list[str]:
    """
    Retourne la liste des audiences Apple autorisees selon la plateforme.
    Web/extension utilisent APPLE_CLIENT_ID (Service ID), iOS utilise APPLE_BUNDLE_ID.
    Toutes les audiences non-vides sont incluses pour supporter le cross-platform.
    """
    audiences: set[str] = set()
    for key in ("CLIENT_ID", "BUNDLE_ID"):
        value = APPLE_OAUTH_CONFIG.get(key)
        if value:
            audiences.add(value)
    return [a for a in audiences if a]


async def verify_apple_id_token(id_token_str: str, client_platform: str = "web") -> Optional[dict]:
    """
    Verifie un Apple ID token JWT (signe RS256 par Apple).

    - Recupere les JWKs publics Apple (cache 1h).
    - Selectionne la cle par `kid` dans le header du JWT.
    - Verifie la signature RS256.
    - Verifie l'audience (`aud`) contre APPLE_CLIENT_ID (Service ID web) ou
      APPLE_BUNDLE_ID (iOS).
    - Verifie l'issuer (`iss = https://appleid.apple.com`).
    - Verifie l'expiration (`exp`).

    Retourne les claims decodes (dict) si valides, None sinon.

    Claims Apple typiques :
      - sub: identifiant utilisateur opaque et stable (NOTRE clef de lookup)
      - email: adresse email (peut etre un alias prive @privaterelay.appleid.com)
      - email_verified: bool (toujours True chez Apple)
      - is_private_email: bool (True si email est un alias Apple Hide My Email)
      - aud, iss, exp, iat
    """
    import logging

    log = logging.getLogger(__name__)

    allowed_audiences = _get_allowed_apple_audiences(client_platform)
    if not allowed_audiences:
        log.error("No Apple audiences configured (APPLE_CLIENT_ID / APPLE_BUNDLE_ID)")
        return None

    jwks = await _fetch_apple_jwks()
    if not jwks or "keys" not in jwks:
        log.error("Apple JWKs unavailable — cannot verify id_token")
        return None

    try:
        unverified_header = jwt.get_unverified_header(id_token_str)
    except JWTError as e:
        log.warning(f"Apple id_token: cannot parse header: {e}")
        return None

    kid = unverified_header.get("kid")
    if not kid:
        log.warning("Apple id_token header missing 'kid'")
        return None

    matching_key = next((k for k in jwks["keys"] if k.get("kid") == kid), None)
    if not matching_key:
        log.warning(f"Apple id_token: no JWK matches kid={kid}")
        # Force-refresh cache au cas ou Apple a tourne ses cles
        _APPLE_JWKS_CACHE.pop("jwks", None)
        return None

    # Try each allowed audience (jose.decode prend une seule audience a la fois)
    last_error: Optional[Exception] = None
    for audience in allowed_audiences:
        try:
            claims = jwt.decode(
                id_token_str,
                matching_key,
                algorithms=["RS256"],
                audience=audience,
                issuer=APPLE_ISSUER,
            )
            return claims
        except JWTError as e:
            last_error = e
            continue

    log.warning(f"Apple id_token verification failed for all audiences: {last_error}")
    return None


async def login_or_register_apple_user(
    session: AsyncSession,
    apple_sub: str,
    email: Optional[str],
    full_name: Optional[str] = None,
    auto_create: bool = True,
) -> Tuple[bool, Optional[User], str, Optional[str]]:
    """
    Connecte ou cree un utilisateur via Sign in with Apple.

    Particularite Apple : `email` peut etre None sur les logins SUIVANTS (Apple
    ne renvoie email/name que sur first sign-in). On retombe alors sur le lookup
    par `apple_sub` strictement.

    Lookup priorise :
      1. apple_sub (stable, unique, opaque)
      2. email (si fourni — premier sign-in OU manuellement par client)

    Si l'utilisateur existe par email mais pas par apple_sub, on link les deux
    (idempotence : on peut se reconnecter Apple sur un compte Google existant).

    Si `auto_create=False` et qu'aucun utilisateur n'existe, retourne
    `(False, None, "NOT_REGISTERED", None)`.

    Retourne : (success, user, message, session_token)
    """
    apple_sub = apple_sub.strip()
    if not apple_sub:
        return False, None, "❌ apple_sub manquant", None

    normalized_email = email.lower().strip() if email else None

    # 1. Lookup par apple_sub (priorite)
    result = await session.execute(select(User).where(User.apple_sub == apple_sub))
    user = result.scalar_one_or_none()

    # 2. Si pas trouve, lookup par email
    if not user and normalized_email:
        user = await get_user_by_email(session, normalized_email)

    admin_email = ADMIN_CONFIG.get("ADMIN_EMAIL", "").lower().strip()
    is_admin_user = bool(normalized_email and normalized_email == admin_email)

    if user:
        # Lier apple_sub si pas encore present (cas : compte cree par Google ou email/password)
        if not user.apple_sub:
            user.apple_sub = apple_sub
        # Apple verifie l'email lui-meme avant emission de l'id_token
        if normalized_email and not user.email_verified:
            user.email_verified = True

        if is_admin_user and not user.is_admin:
            user.is_admin = True
            user.plan = "pro"
            user.credits = 999999
            print(f"🔐 Admin privileges granted via Apple to: {normalized_email}", flush=True)

        await session.commit()
        session_token = await create_user_session(session, user.id)
        return True, user, "✅ Connexion Apple réussie", session_token

    # Aucun utilisateur — creation desactivee (extension silent flow)
    if not auto_create:
        return False, None, "NOT_REGISTERED", None

    # Creation. Apple peut ne pas fournir d'email (Hide My Email + private relay)
    # mais on a TOUJOURS apple_sub. Si pas d'email, on cree un email placeholder
    # base sur sub pour respecter la contrainte UNIQUE NOT NULL de users.email.
    # Le user pourra le rattacher a son vrai email via la page de settings ulterieurement.
    if not normalized_email:
        normalized_email = f"apple_{apple_sub[:16]}@privaterelay.appleid.com"

    # Username depuis full_name si fourni, sinon depuis email
    base_username = ""
    if full_name:
        base_username = "".join(c for c in full_name.lower() if c.isalnum())[:30]
    if not base_username:
        base_username = normalized_email.split("@")[0].lower()
    if not base_username:
        base_username = f"apple{apple_sub[:8]}"

    username = base_username
    counter = 1
    while True:
        existing = await get_user_by_username(session, username)
        if not existing:
            break
        username = f"{base_username}{counter}"
        counter += 1

    random_password = secrets.token_urlsafe(16)

    if is_admin_user:
        user = User(
            username=username,
            email=normalized_email,
            password_hash=hash_password(random_password),
            email_verified=True,
            apple_sub=apple_sub,
            plan="pro",
            credits=999999,
            is_admin=True,
        )
        print(f"🔐 Admin user created via Apple: {normalized_email}", flush=True)
    else:
        initial_credits = get_limits("free")["monthly_credits"]
        user = User(
            username=username,
            email=normalized_email,
            password_hash=hash_password(random_password),
            email_verified=True,
            apple_sub=apple_sub,
            plan="free",
            credits=initial_credits,
        )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    session_token = await create_user_session(session, user.id)
    return True, user, "✅ Compte créé avec Apple", session_token


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 AUTH V2 — SESSION LIFECYCLE (Wave 1 Step 2, 2026-05-21)
# ═══════════════════════════════════════════════════════════════════════════════
# Cycle de vie complet des sessions multi-device + rotation single-use refresh.
# Spec : 01-Projects/DeepSight/Specs/2026-05-21-auth-v2-complet-design.md §4.
#
# Pattern global :
#   1. Login → create_session_v2 → INSERT UserSession (id=UUID, hash="")
#      → caller émet refresh_jwt avec jti=session.id
#      → update_session_refresh_hash met le hash final.
#   2. Refresh → rotate_refresh_session (decode JWT, lookup par jti, vérif
#      sliding+absolute+hash, mark old as revoked, blocklist Redis, nouvelle
#      session avec stay_signed_in préservé).
#   3. Logout/Settings → revoke_session_v2 (soft-delete revoked_at=now).
#   4. Settings « Appareils actifs » → list_user_sessions.
#   5. Dependency get_current_user_v2 → validate_session_v2.
#
# Step 3 (séparé, autre sub-agent) wirera /api/auth/login, /api/auth/refresh,
# /api/auth/sessions/* dans router.py — ce module ne touche PAS au router.
# Step 4 (séparé) ajoutera le feature flag AUTH_V2_ENABLED qui décidera entre
# le flow legacy (create_user_session/validate_session_token au-dessus) et ce
# nouveau flow V2.

# Constantes TTL — surchargeables via env pour les tests + Hetzner override.
_ACCESS_TOKEN_TTL_MIN = int(os.getenv("ACCESS_TOKEN_TTL_MIN", "60"))
_REFRESH_TOKEN_STAY_SIGNED_IN_DAYS = int(os.getenv("REFRESH_TOKEN_STAY_SIGNED_IN_DAYS", "30"))
_REFRESH_TOKEN_SHORT_HOURS = int(os.getenv("REFRESH_TOKEN_SHORT_HOURS", "24"))
_REFRESH_TOKEN_ABSOLUTE_DAYS = int(os.getenv("REFRESH_TOKEN_ABSOLUTE_DAYS", "90"))


def _hash_ip(ip: Optional[str]) -> Optional[str]:
    """SHA-256(ip + IP_HASH_SALT) tronqué à 16 chars hex.

    Anonymise l'IP pour la compliance RGPD : permet de détecter une connexion
    suspecte depuis une « autre IP » sans stocker l'IP brute. Le salt est
    requis pour empêcher la table arc-en-ciel triviale sur l'espace IPv4.

    Returns:
        16 chars hex ou None si ip est None/empty.
    """
    if not ip:
        return None
    salt = os.getenv("IP_HASH_SALT", "")
    digest = hashlib.sha256((ip + salt).encode("utf-8")).hexdigest()
    return digest[:16]


def _parse_device_label(user_agent: Optional[str]) -> Optional[str]:
    """Parse un user-agent en label lisible « <Browser> on <OS> ».

    Implémentation inline (pas de dépendance externe `user-agents` ajoutée —
    requirements.txt déjà ~80 packages). Détection best-effort des navigateurs
    majoritaires + OS. Si parsing échoue, retourne le UA tronqué à 100 chars
    pour préserver un signal utilisateur (« Mozilla/5.0 ... »).

    Examples:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
         (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        → "Chrome on macOS"

        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15
         (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
        → "Safari on iOS"

    Returns:
        Label parsé ou None si user_agent est None/empty.
    """
    if not user_agent:
        return None

    ua = user_agent.strip()

    # Browser detection — order matters (Edge contains Chrome, Chrome contains Safari).
    browser = None
    if re.search(r"Edg/|EdgA/|EdgiOS/", ua):
        browser = "Edge"
    elif re.search(r"OPR/|Opera/", ua):
        browser = "Opera"
    elif "Firefox/" in ua and "Seamonkey/" not in ua:
        browser = "Firefox"
    elif "Chrome/" in ua and "Chromium/" not in ua and "Edg" not in ua:
        browser = "Chrome"
    elif "Chromium/" in ua:
        browser = "Chromium"
    elif "Safari/" in ua and "Chrome/" not in ua:
        browser = "Safari"

    # OS detection — order matters (iPad contains Mac OS X).
    os_label = None
    if "Windows NT" in ua or "Windows " in ua:
        os_label = "Windows"
    elif "Android" in ua:
        os_label = "Android"
    elif re.search(r"iPad|iPhone|iPod|iOS", ua):
        os_label = "iOS"
    elif "Mac OS X" in ua or "Macintosh" in ua:
        os_label = "macOS"
    elif "Linux" in ua:
        os_label = "Linux"
    elif "CrOS" in ua:
        os_label = "ChromeOS"

    if browser and os_label:
        return f"{browser} on {os_label}"
    if browser:
        return browser
    if os_label:
        return os_label
    # Fallback : préserver un signal exploitable
    return ua[:100]


def _hash_refresh_jwt(refresh_jwt: str) -> str:
    """SHA-256 hex digest d'un JWT (64 chars).

    Utilisé pour stocker l'intégrité du refresh token en DB sans le token brut.
    Permet de détecter une modification du token (tampering) ET d'invalider
    instantanément via blocklist.
    """
    return hashlib.sha256(refresh_jwt.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    """UTC now sans tzinfo — match les colonnes DateTime SQLAlchemy (naive UTC)."""
    return datetime.utcnow()


def _request_user_agent(request) -> Optional[str]:
    """Extrait le user-agent d'un FastAPI Request, tolérant à None/Mock.

    Sépare l'extraction pour faciliter les tests (mock Request sans starlette).
    """
    if request is None:
        return None
    try:
        headers = getattr(request, "headers", None)
        if headers is None:
            return None
        # FastAPI headers est case-insensitive (starlette MutableHeaders)
        return headers.get("user-agent") or headers.get("User-Agent")
    except Exception:  # noqa: BLE001
        return None


def _request_client_host(request) -> Optional[str]:
    """Extrait request.client.host, tolérant à None/Mock."""
    if request is None:
        return None
    try:
        client = getattr(request, "client", None)
        if client is None:
            return None
        return getattr(client, "host", None)
    except Exception:  # noqa: BLE001
        return None


def create_refresh_token_v2(user_id: int, jti: str, ttl_seconds: int) -> str:
    """Émet un refresh JWT V2 avec `jti=session.id` + TTL custom.

    NE remplace PAS `create_refresh_token` (legacy) — coexistent jusqu'au
    Step 4 qui branchera via feature flag AUTH_V2_ENABLED.

    Args:
        user_id: ID de l'utilisateur (sub).
        jti: UUID String(36) — primary key de UserSession en DB.
        ttl_seconds: durée de vie du JWT (typiquement = sliding TTL).

    Returns:
        JWT encodé HS256 avec claims {sub, exp, iat, type:"refresh", jti}.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=ttl_seconds)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": now,
        "type": "refresh",
        "jti": jti,
    }
    return jwt.encode(payload, JWT_CONFIG["SECRET_KEY"], algorithm=JWT_CONFIG["ALGORITHM"])


def create_access_token_v2(user_id: int, jti: str, is_admin: bool = False) -> str:
    """Émet un access JWT V2 avec `jti=session.id` (au lieu de `session` legacy).

    NE remplace PAS `create_access_token` (legacy) — coexistent jusqu'au
    Step 4 qui branchera via feature flag AUTH_V2_ENABLED.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=_ACCESS_TOKEN_TTL_MIN)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": now,
        "type": "access",
        "is_admin": is_admin,
        "jti": jti,
    }
    return jwt.encode(payload, JWT_CONFIG["SECRET_KEY"], algorithm=JWT_CONFIG["ALGORITHM"])


async def create_session_v2(
    session: AsyncSession,
    user_id: int,
    stay_signed_in: bool,
    request=None,
) -> UserSession:
    """Crée une nouvelle UserSession en DB (Auth V2).

    Workflow en 2 étapes nécessaire — la PK `session.id` doit être connue
    AVANT d'émettre le refresh JWT (jti=session.id) :

      1. INSERT UserSession (refresh_token_hash="" placeholder, sera updaté
         juste après par le caller via update_session_refresh_hash).
      2. session.flush() pour matérialiser l'id (UUID assigné par default
         lambda côté model).
      3. Caller émet refresh_jwt = create_refresh_token_v2(user_id, session.id, ttl)
      4. Caller appelle update_session_refresh_hash(session, session.id, refresh_jwt)
      5. Caller commit (ou laisse le caller upstream commit).

    Pourquoi 2 étapes : le `refresh_token_hash` est UNIQUE en DB et porte
    l'intégrité du JWT. Le JWT contient le `jti=session.id`. Donc on a un
    cycle « id → JWT → hash → DB → id ». La résolution = INSERT avec hash
    vide puis UPDATE. Une seule transaction côté caller, atomique.

    Args:
        session: AsyncSession SQLAlchemy.
        user_id: ID utilisateur.
        stay_signed_in: True → sliding 30j, False → sliding 24h hard.
        request: FastAPI Request (pour User-Agent + client.host). Optionnel
            pour faciliter les tests / endpoints sans contexte HTTP.

    Returns:
        UserSession ORM instance (id assigné, refresh_token_hash="").
    """
    now = _utcnow()

    # Sliding TTL piloté par stay_signed_in (cf spec §4.2)
    if stay_signed_in:
        sliding_delta = timedelta(days=_REFRESH_TOKEN_STAY_SIGNED_IN_DAYS)
    else:
        sliding_delta = timedelta(hours=_REFRESH_TOKEN_SHORT_HOURS)

    sliding_expires_at = now + sliding_delta
    absolute_expires_at = now + timedelta(days=_REFRESH_TOKEN_ABSOLUTE_DAYS)

    # Parse contexte client
    user_agent = _request_user_agent(request)
    device_label = _parse_device_label(user_agent)
    ip = _request_client_host(request)
    ip_hash = _hash_ip(ip)

    # Génère l'UUID explicitement pour qu'il soit dispo AVANT le flush
    # (sinon le default lambda du model ne se déclenche qu'au flush, et on
    # peut avoir besoin de l'id côté caller pour émettre le JWT).
    session_id = str(uuid.uuid4())

    user_session = UserSession(
        id=session_id,
        user_id=user_id,
        # Placeholder — sera updaté par update_session_refresh_hash après
        # émission du JWT. Forced unique via DB constraint, donc on prefixe
        # par session_id pour garantir l'unicité même entre 2 placeholders
        # concurrents.
        refresh_token_hash=f"pending:{session_id}",
        device_label=device_label,
        ip_hash=ip_hash,
        user_agent=user_agent,
        stay_signed_in=stay_signed_in,
        sliding_expires_at=sliding_expires_at,
        absolute_expires_at=absolute_expires_at,
    )

    session.add(user_session)
    await session.flush()  # matérialise l'id sans commit

    logger.info(
        "auth_v2.session_created",
        user_id=user_id,
        session_id=session_id,
        device_label=device_label,
        stay_signed_in=stay_signed_in,
        sliding_expires_at=sliding_expires_at.isoformat(),
        absolute_expires_at=absolute_expires_at.isoformat(),
    )

    return user_session


async def update_session_refresh_hash(
    session: AsyncSession,
    session_id: str,
    refresh_jwt: str,
) -> None:
    """Met à jour `refresh_token_hash` après émission du JWT.

    Workaround au cycle id → JWT → hash → DB : create_session_v2 insère
    un placeholder, on update ici une fois le JWT émis.

    Args:
        session: AsyncSession SQLAlchemy (mêmes que create_session_v2).
        session_id: PK de la UserSession à updater.
        refresh_jwt: Le JWT émis (sera hashé SHA-256).
    """
    new_hash = _hash_refresh_jwt(refresh_jwt)
    await session.execute(update(UserSession).where(UserSession.id == session_id).values(refresh_token_hash=new_hash))


async def rotate_refresh_session(
    session: AsyncSession,
    old_refresh_jwt: str,
    request=None,
) -> Tuple[Optional[UserSession], bool, str]:
    """Rotation single-use du refresh token (Auth V2).

    Workflow critique de sécurité — détecte les replays (token déjà rotaté
    qui revient) et blocklist les anciens JTIs.

    Steps :
      1. Decode JWT (verify_token type="refresh").
      2. Lookup UserSession by jti = payload["jti"] = session.id.
      3. Vérifier intégrité : refresh_token_hash DB == sha256(old_refresh_jwt).
         Mismatch = JWT modifié OU déjà rotaté → REJECT.
      4. Vérifier revoked_at IS NULL.
      5. Vérifier sliding_expires_at > now.
      6. Vérifier absolute_expires_at > now.
      7. Marquer ancienne session : revoked_at=now, sliding_expires_at=now
         (defense in depth — empêche une re-rotation même si la blocklist
         tombe).
      8. Add old_jti à Redis blocklist (TTL = sliding restante de l'ancienne).
      9. Create new UserSession (stay_signed_in préservé depuis l'ancienne).
      10. Émettre nouveau refresh JWT avec jti = new_session.id.
      11. Update new session refresh_token_hash.
      12. Return new session.

    Important : pas de commit ici — c'est au caller (router endpoint) de
    commit ou rollback. Permet une transaction atomique côté router.

    Args:
        session: AsyncSession SQLAlchemy.
        old_refresh_jwt: Le refresh JWT envoyé par le client.
        request: FastAPI Request pour le nouveau device context.

    Returns:
        (new_session, ok, reason) :
        - (UserSession, True, "ok") si rotation OK
        - (None, False, "invalid_token") si JWT invalide/expiré
        - (None, False, "session_not_found") si session inexistante
        - (None, False, "replay_detected") si hash mismatch (rotation déjà
           consommée OU JWT modifié)
        - (None, False, "session_revoked") si déjà révoquée
        - (None, False, "sliding_expired") si sliding TTL expiré
        - (None, False, "absolute_expired") si cap 90j atteint

    Note: le caller (router /api/auth/refresh) doit émettre lui-même les
    nouveaux access+refresh JWTs et appeler update_session_refresh_hash
    + commit. Ce service ne fait QUE l'orchestration DB.
    """
    # Step 1 : decode JWT (signature + exp)
    payload = verify_token(old_refresh_jwt, token_type="refresh")
    if payload is None:
        logger.warning("auth_v2.rotate.invalid_token")
        return None, False, "invalid_token"

    jti = payload.get("jti")
    if not jti:
        logger.warning("auth_v2.rotate.no_jti", payload_keys=list(payload.keys()))
        return None, False, "invalid_token"

    # Step 2 : lookup UserSession by id (= jti)
    result = await session.execute(select(UserSession).where(UserSession.id == jti))
    old_session = result.scalar_one_or_none()

    if old_session is None:
        logger.warning("auth_v2.rotate.session_not_found", jti=jti)
        return None, False, "session_not_found"

    # Step 3 : vérifier intégrité du token (anti-tampering + replay detection)
    expected_hash = _hash_refresh_jwt(old_refresh_jwt)
    if old_session.refresh_token_hash != expected_hash:
        # Hash mismatch = ce JWT n'est plus le « current » refresh de cette
        # session. Causes possibles : déjà rotaté (replay attack) OU JWT
        # modifié. Dans les 2 cas → security incident.
        logger.warning(
            "auth_v2.rotate.replay_or_tamper_detected",
            session_id=jti,
            user_id=old_session.user_id,
        )
        # Defensive : on révoque la session puisqu'un replay = compromission.
        # (Cas où l'attaquant a le JWT mais pas le hash actualisé suggère que
        # le legitimate user a refresh entre-temps. On bloque par sécurité.)
        old_session.revoked_at = _utcnow()
        return None, False, "replay_detected"

    # Step 4 : vérifier non-révoquée
    if old_session.revoked_at is not None:
        logger.warning(
            "auth_v2.rotate.session_revoked",
            session_id=jti,
            user_id=old_session.user_id,
            revoked_at=old_session.revoked_at.isoformat(),
        )
        return None, False, "session_revoked"

    now = _utcnow()

    # Step 5 : sliding TTL
    if old_session.sliding_expires_at <= now:
        logger.info(
            "auth_v2.rotate.sliding_expired",
            session_id=jti,
            user_id=old_session.user_id,
        )
        return None, False, "sliding_expired"

    # Step 6 : absolute cap (90j depuis issued_at)
    if old_session.absolute_expires_at <= now:
        logger.info(
            "auth_v2.rotate.absolute_expired",
            session_id=jti,
            user_id=old_session.user_id,
        )
        return None, False, "absolute_expired"

    # Step 7 : marquer ancienne session révoquée + sliding défensif
    user_id = old_session.user_id
    stay_signed_in = old_session.stay_signed_in
    old_session.revoked_at = now
    old_session.sliding_expires_at = now  # defense in depth

    # Step 8 : blocklist Redis du JWT (l'ancien, qui vient d'être rotaté).
    # TTL = exp restante du JWT pour éviter cleanup manuel (Redis auto-expire).
    try:
        from core.security import blacklist_token

        exp = payload.get("exp")
        if isinstance(exp, (int, float)):
            ttl_seconds = max(1, int(exp - now.replace(tzinfo=timezone.utc).timestamp()))
        else:
            # Fallback : 24h (en pratique le sliding restant est ~30j)
            ttl_seconds = 86400
        await blacklist_token(old_refresh_jwt, expiry_seconds=ttl_seconds)
    except Exception as e:  # noqa: BLE001
        # Fail-open : la révocation DB + sliding=now au step 7 protège déjà
        # contre une nouvelle rotation. La blocklist Redis est une ceinture
        # par-dessus la bretelle DB.
        logger.warning(
            "auth_v2.rotate.blocklist_failed",
            session_id=jti,
            error=str(e),
        )

    # Step 9 : créer la nouvelle session (stay_signed_in préservé)
    new_session = await create_session_v2(
        session=session,
        user_id=user_id,
        stay_signed_in=stay_signed_in,
        request=request,
    )

    logger.info(
        "auth_v2.rotate.success",
        old_session_id=jti,
        new_session_id=new_session.id,
        user_id=user_id,
        stay_signed_in=stay_signed_in,
    )

    return new_session, True, "ok"


async def revoke_session_v2(
    session: AsyncSession,
    session_id: str,
    user_id: int,
) -> bool:
    """Révoque une session par id (soft-delete revoked_at=now).

    Sécurité : on n'accepte de révoquer QUE les sessions appartenant au
    `user_id` fourni. Empêche un user A de révoquer la session d'un user B
    par énumération d'UUIDs (qui sont devinables si on connaît le pattern).

    Args:
        session: AsyncSession SQLAlchemy.
        session_id: UUID de la UserSession à révoquer.
        user_id: ID du user qui demande la révocation (= owner).

    Returns:
        True si trouvée + appartient au user + révoquée maintenant.
        False sinon (not found, owner mismatch, ou déjà révoquée).
    """
    result = await session.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
        )
    )
    target = result.scalar_one_or_none()

    if target is None:
        logger.warning(
            "auth_v2.revoke.not_found_or_unauthorized",
            session_id=session_id,
            requesting_user_id=user_id,
        )
        return False

    if target.revoked_at is not None:
        # Déjà révoquée — idempotent, on retourne False pour signaler qu'il
        # n'y a pas eu de changement (utile pour audit).
        return False

    now = _utcnow()
    target.revoked_at = now
    # Defense in depth : sliding et absolute à now pour bloquer toute
    # tentative de rotation qui contournerait revoked_at.
    target.sliding_expires_at = now
    target.absolute_expires_at = now

    logger.info(
        "auth_v2.revoke.success",
        session_id=session_id,
        user_id=user_id,
    )
    return True


async def list_user_sessions(
    session: AsyncSession,
    user_id: int,
) -> List[UserSession]:
    """Liste les sessions actives d'un utilisateur.

    Critère « active » : revoked_at IS NULL AND sliding_expires_at > now
    AND absolute_expires_at > now. Pour la page « Appareils actifs » dans
    Settings (Wave 1 Step 3 — endpoint GET /api/auth/sessions).

    Index utilisé (idéalement) : `ix_user_sessions_user_id_revoked_at`
    (déjà créé par la migration 033).

    Args:
        session: AsyncSession SQLAlchemy.
        user_id: ID du user.

    Returns:
        Liste de UserSession actives, triées par last_seen_at DESC (plus
        récente en premier — UX standard).
    """
    now = _utcnow()
    result = await session.execute(
        select(UserSession)
        .where(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
            UserSession.sliding_expires_at > now,
            UserSession.absolute_expires_at > now,
        )
        .order_by(UserSession.last_seen_at.desc())
    )
    return list(result.scalars().all())


async def validate_session_v2(
    session: AsyncSession,
    jti: str,
    refresh_token_hash: Optional[str] = None,
) -> bool:
    """Vérifie qu'une session est encore valide.

    Utilisé par `get_current_user_v2` (Step 4) pour valider que chaque
    requête authentifiée porte un JTI qui correspond à une session active.

    Args:
        session: AsyncSession SQLAlchemy.
        jti: UUID String(36) = UserSession.id, extrait du JWT.
        refresh_token_hash: optionnel — si fourni, on vérifie aussi le hash
            (anti-tampering). En général utile uniquement sur /refresh ; le
            access token n'embarque pas le hash (juste le jti).

    Returns:
        True si:
        - row existe par id == jti,
        - revoked_at IS NULL,
        - sliding_expires_at > now,
        - absolute_expires_at > now,
        - (si refresh_token_hash fourni) refresh_token_hash matche.
    """
    result = await session.execute(select(UserSession).where(UserSession.id == jti))
    user_session = result.scalar_one_or_none()

    if user_session is None:
        return False

    now = _utcnow()
    if user_session.revoked_at is not None:
        return False
    if user_session.sliding_expires_at <= now:
        return False
    if user_session.absolute_expires_at <= now:
        return False

    if refresh_token_hash is not None:
        if user_session.refresh_token_hash != refresh_token_hash:
            logger.warning(
                "auth_v2.validate.hash_mismatch",
                session_id=jti,
                user_id=user_session.user_id,
            )
            return False

    return True
