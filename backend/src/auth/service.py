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
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import secrets
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from jose import jwt, JWTError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import JWT_CONFIG, GOOGLE_OAUTH_CONFIG, EMAIL_CONFIG, PLAN_LIMITS, APP_URL, ADMIN_CONFIG
from db.database import User, ChatQuota, WebSearchUsage, hash_password, verify_password

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
    initial_credits = PLAN_LIMITS["free"]["monthly_credits"]

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
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

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
        initial_credits = PLAN_LIMITS["free"]["monthly_credits"]
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
