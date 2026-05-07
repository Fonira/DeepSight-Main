"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📋 AUTH SCHEMAS — Modèles Pydantic pour l'authentification                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from pydantic import BaseModel, EmailStr, Field, computed_field, field_validator
from typing import Optional, Literal
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 REQUÊTES (Input)
# ═══════════════════════════════════════════════════════════════════════════════


class UserRegister(BaseModel):
    """Schéma pour l'inscription.

    🚀 Launch J0 (2026-05-15) — accepte les UTM/source frontend pour
    persistance dans `User.preferences` (JSON column, migration 008 prod).
    Tous les champs UTM sont Optional pour rester backward-compatible avec
    les anciens clients qui ne les envoient pas.

    SSOT vocabulary `signup_source` aligné avec `utmCapture.ts` frontend
    et `acquisition_channel` Stripe (sub-agent Q parallel PR) :
        product_hunt | twitter | reddit | linkedin | indiehackers |
        hackernews | karim_inmail | mobile_deeplink | direct.
    """

    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    # 🚀 Launch tracking — UTM/source persistance pour analyses cross-channel
    signup_source: Optional[str] = Field(None, max_length=50)
    utm_source: Optional[str] = Field(None, max_length=80)
    utm_medium: Optional[str] = Field(None, max_length=80)
    utm_campaign: Optional[str] = Field(None, max_length=80)
    referrer: Optional[str] = Field(None, max_length=300)


class UserLogin(BaseModel):
    """Schéma pour la connexion"""

    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    """Schéma pour rafraîchir le token"""

    refresh_token: str


class VerifyEmailRequest(BaseModel):
    """Schéma pour vérifier l'email"""

    email: EmailStr
    code: str


class ResendVerificationRequest(BaseModel):
    """Schéma pour renvoyer le code de vérification"""

    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    """Schéma pour mot de passe oublié"""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schéma pour réinitialiser le mot de passe"""

    email: EmailStr
    code: str
    new_password: str = Field(..., min_length=6)


class ChangePasswordRequest(BaseModel):
    """Schéma pour changer le mot de passe"""

    current_password: str
    new_password: str = Field(..., min_length=6)


class UpdatePreferencesRequest(BaseModel):
    """Schéma pour mettre à jour les préférences"""

    default_lang: Optional[str] = None
    default_mode: Optional[str] = None
    default_model: Optional[str] = None
    # Ambient Lighting v3 — toggle pour activer/désactiver l'effet lumineux
    # immersif derrière le sidepanel/widgets (web + mobile + extension).
    # Persisté server-side dans la colonne User.preferences JSON (migration 008).
    ambient_lighting_enabled: Optional[bool] = None
    # Bag arbitraire pour préférences UI futures (clé/valeur souple, JSON merge).
    # Permet aux clients d'ajouter de nouvelles prefs sans migration de schema
    # côté backend ; mergé non-destructivement dans User.preferences.
    extra_preferences: Optional[dict] = None


class GoogleCallbackRequest(BaseModel):
    """Schéma pour le callback Google OAuth"""

    code: str
    state: Optional[str] = None


class GoogleTokenRequest(BaseModel):
    """Schéma pour Google OAuth via access token (mobile, legacy)"""

    access_token: str


class GoogleMobileTokenRequest(BaseModel):
    """
    Schéma pour Google OAuth via id_token JWT.

    Utilisé par le mobile (Expo / @react-native-google-signin) et l'extension
    Chrome (chrome.identity.getAuthToken). Le client obtient l'id_token puis
    l'envoie ici pour vérification serveur + échange contre nos propres JWT.

    Si `auto_create=False` et qu'aucun compte DeepSight n'existe pour l'email
    Google, le serveur retourne HTTP 404 avec les claims Google (email, name,
    picture) pour permettre au client de rediriger vers le formulaire signup
    pré-rempli. Comportement utilisé par l'extension Chrome en mode
    "silent auto-login": si connecté à Google mais pas à DeepSight, on ne crée
    pas de compte automatiquement — on redirige vers signup.
    """

    id_token: str = Field(..., min_length=10, description="Google ID token JWT signé")
    client_platform: Literal["ios", "android", "web", "extension"] = Field(
        default="web", description="Plateforme cliente (pour sélectionner l'audience attendue + tracking)"
    )
    device_name: Optional[str] = Field(
        default=None, max_length=100, description="Nom du device pour tracking des sessions (ex: 'iPhone 15 Pro')"
    )
    auto_create: bool = Field(
        default=True,
        description=(
            "Si True (défaut mobile), crée un compte DeepSight automatiquement "
            "si aucun n'existe pour cet email Google. Si False (extension silent "
            "auto-login), retourne 404 pour rediriger vers signup."
        ),
    )


class GoogleNotRegisteredResponse(BaseModel):
    """
    Réponse 404 quand un ID token Google valide est fourni mais qu'aucun compte
    DeepSight n'existe pour cet email et que `auto_create=False`. Permet au
    client (extension Chrome) de rediriger vers signup avec email pré-rempli.
    """

    code: Literal["user_not_registered"] = "user_not_registered"
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None


class DeleteAccountRequest(BaseModel):
    """Schéma pour supprimer le compte"""

    password: Optional[str] = None  # Optionnel pour les comptes Google


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 RÉPONSES (Output)
# ═══════════════════════════════════════════════════════════════════════════════


class UserResponse(BaseModel):
    """Schéma de réponse pour un utilisateur"""

    id: int
    username: str
    email: str
    email_verified: bool
    plan: str
    credits: int
    credits_monthly: Optional[int] = 0  # Crédits mensuels du plan
    is_admin: bool
    avatar_url: Optional[str] = None
    default_lang: str
    default_mode: str
    default_model: str
    total_videos: int
    total_words: int
    total_playlists: int
    created_at: datetime
    # User preferences JSON (Ambient Lighting v3 + future feature flags).
    # Persisté server-side dans User.preferences (migration 008) ; exposé ici
    # pour que le frontend connaisse l'état actuel des prefs après login/refresh
    # et puisse rendre la bonne UI dès le mount sans round-trip supplémentaire.
    # Toujours un dict (jamais None) pour simplifier le frontend.
    preferences: dict = Field(
        default_factory=dict,
        description="User preferences JSON (ambient_lighting_enabled, future feature flags)",
    )

    @field_validator("preferences", mode="before")
    @classmethod
    def _coerce_preferences(cls, v):
        # Tolère None (legacy users avant migration 008) et tout ce qui n'est
        # pas un dict (ex: MagicMock dans les fixtures de tests qui ne settent
        # pas explicitement l'attribut). Le contrat externe reste : toujours
        # un dict côté frontend.
        if not isinstance(v, dict):
            return {}
        return v

    @computed_field
    @property
    def credits_remaining(self) -> int:
        """Alias pour compatibilité frontend"""
        return self.credits

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Schéma de réponse avec tokens JWT"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class AuthUrlResponse(BaseModel):
    """Schéma de réponse pour l'URL d'auth Google"""

    auth_url: str


class MessageResponse(BaseModel):
    """Schéma de réponse simple avec message"""

    success: bool
    message: str


class QuotaResponse(BaseModel):
    """Schéma de réponse pour les quotas"""

    credits: int
    monthly_credits: int
    credits_remaining: int
    can_use: bool
    plan: str
    max_playlist_videos: int
    chat_daily_limit: int
    chat_used_today: int
    web_search_monthly: int
    web_search_used: int
