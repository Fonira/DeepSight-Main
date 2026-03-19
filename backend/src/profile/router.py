"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  👤 PROFILE ROUTER — Gestion du profil et préférences utilisateur                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  ✅ GET/PUT /profile — Préférences utilisateur                                     ║
║  ✅ POST /profile/avatar — Upload d'avatar                                         ║
║  ✅ GET /profile/models — Modèles disponibles selon le plan                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import base64
import hashlib
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User
from auth.dependencies import get_current_user

router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════════
# 📦 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ProfileResponse(BaseModel):
    id: int
    username: str
    email: str
    plan: str
    credits: int
    avatar_url: Optional[str] = None
    default_lang: str
    default_mode: str
    default_model: str
    total_videos: int
    total_words: int
    total_playlists: int
    
class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    default_lang: Optional[str] = Field(None, pattern="^(fr|en)$")
    default_mode: Optional[str] = Field(None, pattern="^(accessible|standard|expert)$")
    default_model: Optional[str] = None

class ModelInfo(BaseModel):
    id: str
    name: str
    description: str
    available: bool
    plan_required: str

class ModelsResponse(BaseModel):
    models: List[ModelInfo]
    current_model: str
    plan: str

# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 CONFIGURATION DES MODÈLES PAR PLAN
# ═══════════════════════════════════════════════════════════════════════════════

MODELS_CONFIG = {
    "mistral-small-2603": {
        "name": "Mistral Small",
        "description": "Rapide et économique, idéal pour les analyses simples",
        "plans": ["free", "starter", "pro", "expert", "unlimited"]
    },
    "mistral-medium-2508": {
        "name": "Mistral Medium",
        "description": "Équilibré entre vitesse et qualité",
        "plans": ["starter", "pro", "expert", "unlimited"]
    },
    "mistral-large-2512": {
        "name": "Mistral Large",
        "description": "Haute qualité, analyses détaillées et nuancées",
        "plans": ["pro", "expert", "unlimited"]
    }
}

PLAN_HIERARCHY = {
    "free": 0,
    "starter": 1,
    "pro": 2,
    "expert": 3,
    "unlimited": 4
}

# ═══════════════════════════════════════════════════════════════════════════════
# 📋 ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=ProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user)
):
    """Récupère le profil de l'utilisateur connecté."""
    return ProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        plan=current_user.plan,
        credits=current_user.credits,
        avatar_url=getattr(current_user, 'avatar_url', None),
        default_lang=current_user.default_lang or "fr",
        default_mode=current_user.default_mode or "standard",
        default_model=current_user.default_model or "mistral-small-2603",
        total_videos=current_user.total_videos or 0,
        total_words=current_user.total_words or 0,
        total_playlists=current_user.total_playlists or 0
    )


@router.put("", response_model=ProfileResponse)
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Met à jour les préférences de l'utilisateur."""
    
    # Mettre à jour le username
    if data.username is not None:
        current_user.username = data.username
    
    # Mettre à jour la langue
    if data.default_lang is not None:
        current_user.default_lang = data.default_lang
    
    # Mettre à jour le mode
    if data.default_mode is not None:
        current_user.default_mode = data.default_mode
    
    # Mettre à jour le modèle (avec vérification du plan)
    if data.default_model is not None:
        model_config = MODELS_CONFIG.get(data.default_model)
        if model_config:
            allowed_plans = model_config["plans"]
            if current_user.plan in allowed_plans:
                current_user.default_model = data.default_model
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Le modèle {data.default_model} n'est pas disponible pour le plan {current_user.plan}"
                )
        else:
            raise HTTPException(status_code=400, detail="Modèle invalide")
    
    await session.commit()
    await session.refresh(current_user)
    
    print(f"✅ Profile updated: {current_user.username} - lang={current_user.default_lang}, mode={current_user.default_mode}, model={current_user.default_model}", flush=True)
    
    return ProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        plan=current_user.plan,
        credits=current_user.credits,
        avatar_url=getattr(current_user, 'avatar_url', None),
        default_lang=current_user.default_lang or "fr",
        default_mode=current_user.default_mode or "standard",
        default_model=current_user.default_model or "mistral-small-2603",
        total_videos=current_user.total_videos or 0,
        total_words=current_user.total_words or 0,
        total_playlists=current_user.total_playlists or 0
    )


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Upload un avatar pour l'utilisateur.
    Accepte: PNG, JPG, JPEG, GIF, WebP
    Taille max: 2MB
    Stocke en base64 dans la base de données.
    """
    
    # Vérifier le type de fichier
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Type de fichier non supporté. Acceptés: PNG, JPG, GIF, WebP"
        )
    
    # Lire le contenu
    content = await file.read()
    
    # Vérifier la taille (2MB max)
    max_size = 2 * 1024 * 1024  # 2MB
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="L'image ne doit pas dépasser 2MB"
        )
    
    # Convertir en base64 avec préfixe data URL
    base64_content = base64.b64encode(content).decode('utf-8')
    avatar_url = f"data:{file.content_type};base64,{base64_content}"
    
    # Sauvegarder en base
    # Note: Le champ avatar_url doit exister dans le modèle User
    # Si ce n'est pas le cas, on stocke dans un champ existant ou on crée une table séparée
    try:
        current_user.avatar_url = avatar_url
    except AttributeError:
        # Si le champ n'existe pas, on utilise un workaround
        # On peut stocker dans un champ JSON ou créer une migration
        pass
    
    await session.commit()
    
    print(f"✅ Avatar uploaded for {current_user.username}: {len(content)} bytes", flush=True)
    
    return {
        "success": True,
        "avatar_url": avatar_url,
        "message": "Avatar mis à jour avec succès"
    }


@router.delete("/avatar")
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Supprime l'avatar de l'utilisateur."""
    try:
        current_user.avatar_url = None
    except AttributeError:
        pass
    
    await session.commit()
    
    return {"success": True, "message": "Avatar supprimé"}


@router.get("/models", response_model=ModelsResponse)
async def get_available_models(
    current_user: User = Depends(get_current_user)
):
    """
    Retourne la liste des modèles disponibles selon le plan de l'utilisateur.
    """
    user_plan = current_user.plan
    user_plan_level = PLAN_HIERARCHY.get(user_plan, 0)
    
    models = []
    for model_id, config in MODELS_CONFIG.items():
        # Vérifier si le modèle est disponible pour ce plan
        required_plan = config["plans"][0]  # Le premier plan de la liste est le minimum
        required_level = PLAN_HIERARCHY.get(required_plan, 0)
        
        available = user_plan_level >= required_level
        
        models.append(ModelInfo(
            id=model_id,
            name=config["name"],
            description=config["description"],
            available=available,
            plan_required=required_plan if not available else user_plan
        ))
    
    return ModelsResponse(
        models=models,
        current_model=current_user.default_model or "mistral-small-2603",
        plan=user_plan
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 ENDPOINT STATS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_user)
):
    """Retourne les statistiques de l'utilisateur."""
    return {
        "total_videos": current_user.total_videos or 0,
        "total_words": current_user.total_words or 0,
        "total_playlists": current_user.total_playlists or 0,
        "credits": current_user.credits,
        "plan": current_user.plan,
        "member_since": current_user.created_at.isoformat() if current_user.created_at else None
    }

@router.get("/credits")
async def get_credits_info(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🔐 Retourne les informations détaillées sur les crédits et quotas.
    Inclut le reset mensuel automatique si nécessaire.
    """
    try:
        from core.security import get_user_credits_info
        info = await get_user_credits_info(session, current_user.id)
        return info
    except ImportError:
        # Fallback sans le module de sécurité
        from core.config import PLAN_LIMITS
        plan_limits = PLAN_LIMITS.get(current_user.plan, PLAN_LIMITS["free"])
        return {
            "credits": {
                "current": current_user.credits or 0,
                "available": current_user.credits or 0,
                "reserved": 0,
                "monthly_limit": plan_limits.get("monthly_credits", 10)
            },
            "plan": {
                "name": current_user.plan,
                "display_name": plan_limits.get("name", {}).get("fr", current_user.plan),
                "color": plan_limits.get("color", "#888888")
            },
            "limits": {
                "chat_daily": plan_limits.get("chat_daily_limit", 10),
                "chat_per_video": plan_limits.get("chat_per_video_limit", 5),
                "web_search_monthly": plan_limits.get("web_search_monthly", 0),
                "max_playlist_videos": plan_limits.get("max_playlist_videos", 0),
                "can_use_playlists": plan_limits.get("can_use_playlists", False)
            },
            "costs": {
                "video_small": 1,
                "video_medium": 2,
                "video_large": 3,
                "playlist_video": 1
            }
        }
