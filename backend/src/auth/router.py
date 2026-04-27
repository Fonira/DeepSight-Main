"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔐 AUTH ROUTER — Endpoints d'authentification                                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from db.database import get_session
from core.config import FRONTEND_URL, EMAIL_CONFIG, GOOGLE_OAUTH_CONFIG
from .schemas import (
    UserRegister,
    UserLogin,
    RefreshTokenRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    UpdatePreferencesRequest,
    GoogleCallbackRequest,
    GoogleMobileTokenRequest,
    DeleteAccountRequest,
    UserResponse,
    TokenResponse,
    AuthUrlResponse,
    MessageResponse,
    QuotaResponse,
)
from .service import (
    create_user,
    authenticate_user,
    verify_email,
    resend_verification,
    initiate_password_reset,
    reset_password,
    change_password,
    update_user_preferences,
    get_user_by_id,
    get_user_quota,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_google_auth_url,
    exchange_google_code,
    get_google_user_info,
    login_or_register_google_user,
    create_user_session,
    invalidate_user_session,
    validate_session_token,
    verify_google_id_token,
)
from .dependencies import get_current_user
from .email import send_verification_email, send_password_reset_email, send_welcome_email

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 INSCRIPTION / CONNEXION
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/register", response_model=MessageResponse)
async def register(data: UserRegister, session: AsyncSession = Depends(get_session)):
    """
    Inscription d'un nouvel utilisateur.
    Envoie un email de vérification si EMAIL_ENABLED.
    """
    success, user, message = await create_user(
        session, username=data.username, email=data.email, password=data.password
    )

    if not success:
        raise HTTPException(status_code=400, detail=message)

    # Envoyer l'email de vérification
    if EMAIL_CONFIG.get("ENABLED") and user and user.verification_code:
        email_sent = await send_verification_email(
            email=user.email, code=user.verification_code, username=user.username
        )
        if email_sent:
            message = "✅ Compte créé ! Vérifiez votre email."
        else:
            message = "✅ Compte créé ! Email de vérification non envoyé."

    return MessageResponse(success=True, message=message)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, session: AsyncSession = Depends(get_session)):
    """
    Connexion d'un utilisateur.
    Retourne les tokens JWT si succès.
    🆕 Crée une session unique (déconnecte les autres appareils).
    """
    success, user, message, session_token = await authenticate_user(session, email=data.email, password=data.password)

    if not success:
        if message == "📧 VERIFICATION_REQUIRED":
            raise HTTPException(
                status_code=403, detail="EMAIL_NOT_VERIFIED", headers={"X-Email": user.email if user else ""}
            )
        raise HTTPException(status_code=401, detail=message)

    # Générer les tokens avec session_token intégré
    access_token = create_access_token(user.id, user.is_admin, session_token)
    refresh_token = create_refresh_token(user.id, session_token)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest, session: AsyncSession = Depends(get_session)):
    """
    Rafraîchit l'access token avec le refresh token.
    🆕 Valide le session_token et en crée un nouveau.
    """
    payload = verify_token(data.refresh_token, token_type="refresh")

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token payload")
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid refresh token payload")
    old_session_token = payload.get("session")

    user = await get_user_by_id(session, user_id)

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # 🆕 Valider que le session_token est toujours valide
    if old_session_token:
        is_valid = await validate_session_token(session, user_id, old_session_token)
        if not is_valid:
            raise HTTPException(status_code=401, detail="SESSION_EXPIRED", headers={"X-Session-Invalid": "true"})

    # 🆕 Créer une nouvelle session (rotation de session)
    new_session_token = await create_user_session(session, user_id)

    # Nouveaux tokens avec nouveau session_token
    access_token = create_access_token(user.id, user.is_admin, new_session_token)
    new_refresh_token = create_refresh_token(user.id, new_session_token)

    return TokenResponse(
        access_token=access_token, refresh_token=new_refresh_token, user=UserResponse.model_validate(user)
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user=Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """
    Déconnexion de l'utilisateur.
    🆕 Invalide la session côté serveur.
    """
    # Invalider la session
    await invalidate_user_session(session, current_user.id)

    return MessageResponse(success=True, message="✅ Déconnecté")


@router.delete("/account", response_model=MessageResponse)
async def delete_account(
    data: DeleteAccountRequest, current_user=Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    """
    Supprime le compte de l'utilisateur connecté.
    Requiert le mot de passe pour les comptes email.
    Les comptes Google peuvent être supprimés sans mot de passe.
    """
    from db.database import verify_password

    # Vérifier le mot de passe pour les comptes avec mot de passe
    if current_user.password_hash:
        if not data.password:
            raise HTTPException(status_code=400, detail="Mot de passe requis")
        if not verify_password(data.password, current_user.password_hash):
            raise HTTPException(status_code=401, detail="Mot de passe incorrect")

    # Invalider la session avant suppression
    await invalidate_user_session(session, current_user.id)

    # Supprimer l'utilisateur (cascade delete automatique)
    await session.delete(current_user)
    await session.commit()

    return MessageResponse(success=True, message="✅ Compte supprimé définitivement")


# ═══════════════════════════════════════════════════════════════════════════════
# 📧 VÉRIFICATION EMAIL
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email_endpoint(data: VerifyEmailRequest, session: AsyncSession = Depends(get_session)):
    """
    Vérifie le code email et retourne les tokens si valide.
    🆕 Crée une session unique.
    """
    success, message = await verify_email(session, data.email, data.code)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    # Récupérer l'utilisateur et générer les tokens
    from .service import get_user_by_email

    user = await get_user_by_email(session, data.email)

    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # 📧 Send welcome email after successful verification
    if EMAIL_CONFIG.get("ENABLED"):
        try:
            await send_welcome_email(user.email, user.username)
        except Exception:
            pass  # Non-blocking — don't fail verification if email fails

    # 🆕 Créer une session unique
    session_token = await create_user_session(session, user.id)

    access_token = create_access_token(user.id, user.is_admin, session_token)
    refresh_token = create_refresh_token(user.id, session_token)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.model_validate(user))


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_endpoint(data: ResendVerificationRequest, session: AsyncSession = Depends(get_session)):
    """Renvoie le code de vérification email"""
    success, message, code = await resend_verification(session, data.email)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    # Envoyer l'email
    if code:
        from .service import get_user_by_email

        user = await get_user_by_email(session, data.email)
        if user:
            await send_verification_email(data.email, code, user.username)

    return MessageResponse(success=True, message="✅ Nouveau code envoyé")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 MOT DE PASSE
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password_endpoint(data: ForgotPasswordRequest, session: AsyncSession = Depends(get_session)):
    """Initie la réinitialisation du mot de passe"""
    success, message, code = await initiate_password_reset(session, data.email)

    # Envoyer l'email si on a un code
    if code:
        await send_password_reset_email(data.email, code)

    # Toujours retourner succès (ne pas révéler si l'email existe)
    return MessageResponse(success=True, message="✅ Si cet email existe, un lien de réinitialisation a été envoyé")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_endpoint(data: ResetPasswordRequest, session: AsyncSession = Depends(get_session)):
    """Réinitialise le mot de passe avec le code"""
    success, message = await reset_password(session, data.email, data.code, data.new_password)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return MessageResponse(success=True, message=message)


@router.post("/change-password", response_model=MessageResponse)
async def change_password_endpoint(
    data: ChangePasswordRequest, current_user=Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    """Change le mot de passe de l'utilisateur connecté"""
    success, message = await change_password(session, current_user.id, data.current_password, data.new_password)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return MessageResponse(success=True, message=message)


# ═══════════════════════════════════════════════════════════════════════════════
# 👤 PROFIL UTILISATEUR
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    """Retourne les informations de l'utilisateur connecté"""
    from core.config import ADMIN_CONFIG, PLAN_LIMITS

    # Déterminer si l'utilisateur est admin (par email ou flag DB)
    admin_email = ADMIN_CONFIG.get("ADMIN_EMAIL", "").lower()
    is_admin = current_user.is_admin or (current_user.email.lower() == admin_email)

    # Récupérer les crédits mensuels du plan
    plan = current_user.plan or "free"
    plan_limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    credits_monthly = plan_limits.get("monthly_credits", 0)

    # Créer une copie avec is_admin mis à jour
    user_data = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "email_verified": current_user.email_verified,
        "plan": current_user.plan,
        "credits": current_user.credits,
        "credits_monthly": credits_monthly,  # Nouveau champ !
        "is_admin": is_admin,  # Dynamique !
        "avatar_url": current_user.avatar_url,
        "default_lang": current_user.default_lang,
        "default_mode": current_user.default_mode,
        "default_model": current_user.default_model,
        "total_videos": current_user.total_videos,
        "total_words": current_user.total_words,
        "total_playlists": current_user.total_playlists,
        "created_at": current_user.created_at,
    }

    return UserResponse(**user_data)


@router.get("/quota", response_model=QuotaResponse)
async def get_quota(current_user=Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """Retourne les quotas de l'utilisateur"""
    quota = await get_user_quota(session, current_user.id)
    return QuotaResponse(**quota)


@router.get("/limits")
async def get_plan_limits(current_user=Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """
    🎫 Retourne le statut complet des limites pour l'utilisateur.

    Inclut:
    - Limites quotidiennes d'analyses (utilisées/max)
    - Crédits restants
    - Features bloquées
    - Suggestion d'upgrade

    Utile pour afficher les alertes d'upgrade dans l'interface.
    """
    from core.plan_limits import get_user_limits_status

    lang = current_user.default_lang or "fr"
    limits_status = await get_user_limits_status(session, current_user, lang)

    return limits_status


@router.put("/preferences", response_model=MessageResponse)
async def update_preferences(
    data: UpdatePreferencesRequest, current_user=Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    """Met à jour les préférences utilisateur.

    - Champs scalaires (`default_lang`, `default_mode`, `default_model`) → colonnes dédiées.
    - `ambient_lighting_enabled` (bool) → persisté dans `User.preferences` JSON.
    - `extra_preferences` (dict arbitraire) → mergé non-destructivement dans
      `User.preferences` JSON — permet aux clients d'ajouter des prefs UI
      futures sans nouvelle migration.
    """
    success = await update_user_preferences(
        session,
        current_user.id,
        default_lang=data.default_lang,
        default_mode=data.default_mode,
        default_model=data.default_model,
        ambient_lighting_enabled=data.ambient_lighting_enabled,
        extra_preferences=data.extra_preferences,
    )

    if not success:
        raise HTTPException(status_code=400, detail="Erreur mise à jour")

    return MessageResponse(success=True, message="✅ Préférences mises à jour")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 GOOGLE OAUTH
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/google/login")
async def google_login(redirect: bool = Query(default=False)):
    """Retourne l'URL d'authentification Google ou redirige directement"""
    if not GOOGLE_OAUTH_CONFIG.get("ENABLED"):
        if redirect:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_disabled")
        raise HTTPException(status_code=400, detail="Google OAuth non activé")

    auth_url = get_google_auth_url()

    if not auth_url:
        if redirect:
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_config")
        raise HTTPException(status_code=500, detail="Erreur configuration OAuth")

    if redirect:
        return RedirectResponse(url=auth_url, status_code=302)

    return AuthUrlResponse(auth_url=auth_url)


@router.get("/google/callback")
async def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    """
    Callback Google OAuth.
    Redirige vers le frontend avec les tokens.
    🆕 Crée une session unique.
    """
    # Gestion des erreurs Google
    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error={error}", status_code=302)

    if not code:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=no_code", status_code=302)

    # Échanger le code contre un token
    token_data = await exchange_google_code(code)

    if not token_data or "access_token" not in token_data:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=token_exchange_failed", status_code=302)

    # Récupérer les infos utilisateur
    google_user = await get_google_user_info(token_data["access_token"])

    if not google_user:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=userinfo_failed", status_code=302)

    # Créer ou connecter l'utilisateur (avec session unique)
    try:
        success, user, message, session_token = await login_or_register_google_user(session, google_user)
    except Exception as e:
        import logging

        logging.getLogger(__name__).error(f"Google OAuth DB error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=database_error", status_code=302)

    if not success or not user:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=auth_failed", status_code=302)

    # Générer les tokens JWT avec session_token
    access_token = create_access_token(user.id, user.is_admin, session_token)
    refresh_token = create_refresh_token(user.id, session_token)

    # Rediriger vers le frontend avec les tokens
    return RedirectResponse(
        url=f"{FRONTEND_URL}/auth/callback?access_token={access_token}&refresh_token={refresh_token}", status_code=302
    )


@router.post("/google/callback", response_model=TokenResponse)
async def google_callback_post(data: GoogleCallbackRequest, session: AsyncSession = Depends(get_session)):
    """
    Callback Google OAuth (POST alternative).
    Pour les SPAs qui préfèrent gérer le callback côté client.
    🆕 Crée une session unique.
    """
    # Échanger le code
    token_data = await exchange_google_code(data.code)

    if not token_data or "access_token" not in token_data:
        raise HTTPException(status_code=400, detail="Token exchange failed")

    # Récupérer les infos utilisateur
    google_user = await get_google_user_info(token_data["access_token"])

    if not google_user:
        raise HTTPException(status_code=400, detail="Could not get user info")

    # Créer ou connecter (avec session unique)
    try:
        success, user, message, session_token = await login_or_register_google_user(session, google_user)
    except Exception as e:
        import logging

        logging.getLogger(__name__).error(f"Google OAuth DB error: {e}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")

    if not success or not user:
        raise HTTPException(status_code=400, detail=message)

    # Tokens JWT avec session_token
    access_token = create_access_token(user.id, user.is_admin, session_token)
    refresh_token = create_refresh_token(user.id, session_token)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.model_validate(user))


@router.post("/google/token", response_model=TokenResponse)
async def google_token_login(data: GoogleMobileTokenRequest, session: AsyncSession = Depends(get_session)):
    """
    Google OAuth mobile — vérifie un `id_token` Google (JWT signé) et retourne
    nos propres JWT (access_token + refresh_token).

    Flow côté mobile (Expo + @react-native-google-signin/google-signin):
      1. Mobile appelle GoogleSignin.signIn() → reçoit un `id_token` JWT.
      2. Mobile envoie cet `id_token` à ce endpoint.
      3. Backend vérifie la signature + audience via `google.oauth2.id_token`.
      4. Backend lookup/crée l'utilisateur, génère JWT, retourne TokenResponse.

    Réponse identique à POST /login pour réutiliser le flow mobile.
    """
    import logging

    log = logging.getLogger(__name__)

    # 1. Vérifier cryptographiquement l'id_token avec Google
    claims = verify_google_id_token(data.id_token, client_platform=data.client_platform)
    if not claims:
        log.warning(f"Google mobile login: invalid id_token (platform={data.client_platform})")
        raise HTTPException(status_code=401, detail="Invalid Google ID token")

    # 2. Extraire les claims essentiels
    google_sub = claims.get("sub")
    email = (claims.get("email") or "").lower().strip()
    email_verified = bool(claims.get("email_verified", False))
    name = claims.get("name") or (email.split("@")[0] if email else "")
    picture = claims.get("picture")

    if not google_sub or not email:
        log.warning("Google mobile login: id_token missing sub or email claim")
        raise HTTPException(status_code=401, detail="Invalid Google ID token payload")

    if not email_verified:
        log.warning(f"Google mobile login: email not verified for {email}")
        raise HTTPException(status_code=401, detail="Google email not verified")

    # 3. Construire la structure google_user attendue par login_or_register_google_user
    #    (qui utilise la clé "id" pour le google_id, pas "sub")
    google_user = {
        "id": google_sub,
        "email": email,
        "name": name,
        "picture": picture,
        "verified_email": email_verified,
    }

    # 4. Login ou création avec merge par email (comportement existant)
    try:
        success, user, message, session_token = await login_or_register_google_user(
            session, google_user, auto_create=data.auto_create
        )
    except Exception as e:
        log.error(f"Google mobile login DB error for {email}: {e}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")

    # Cas silent auto-login extension: user inexistant et auto_create=False
    # → retourner 404 avec les claims Google pour redirect signup pré-rempli.
    if not success and message == "NOT_REGISTERED":
        log.info(
            f"Google silent login: no DeepSight account for {email} (platform={data.client_platform}) → redirect signup"
        )
        raise HTTPException(
            status_code=404,
            detail={
                "code": "user_not_registered",
                "email": email,
                "name": name,
                "picture": picture,
            },
        )

    if not success or not user:
        log.warning(f"Google mobile login failed for {email}: {message}")
        raise HTTPException(status_code=400, detail=message)

    # 5. Générer nos JWT (device_name transmis pour traçabilité future)
    access_token = create_access_token(user.id, user.is_admin, session_token)
    refresh_token = create_refresh_token(user.id, session_token)

    log.info(
        f"Google mobile login success: user_id={user.id} email={email} "
        f"google_id={google_sub} platform={data.client_platform} "
        f"device={data.device_name or 'unknown'}"
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.model_validate(user))


# ═══════════════════════════════════════════════════════════════════════════════
# 🦊 GITLAB OAUTH (Désactivé - fonctionnalité non implémentée)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/gitlab/login", response_model=AuthUrlResponse)
async def gitlab_login():
    """GitLab OAuth non implémenté"""
    raise HTTPException(status_code=501, detail="GitLab OAuth non implémenté")


@router.get("/gitlab/callback")
async def gitlab_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    """GitLab OAuth callback non implémenté"""
    return RedirectResponse(url=f"{FRONTEND_URL}/login?error=gitlab_not_implemented", status_code=302)
