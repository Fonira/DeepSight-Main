"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📋 AUTH SCHEMAS — Modèles Pydantic pour l'authentification                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from pydantic import BaseModel, EmailStr, Field, computed_field
from typing import Optional
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 REQUÊTES (Input)
# ═══════════════════════════════════════════════════════════════════════════════

class UserRegister(BaseModel):
    """Schéma pour l'inscription"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


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


class GoogleCallbackRequest(BaseModel):
    """Schéma pour le callback Google OAuth"""
    code: str
    state: Optional[str] = None


class GoogleTokenRequest(BaseModel):
    """Schéma pour Google OAuth via access token (mobile)"""
    access_token: str


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
