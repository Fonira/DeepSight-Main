"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎙️ TEXT-TO-SPEECH ROUTER                                                         ║
║  Endpoints pour lecture et téléchargement audio des résumés                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal
import io

from auth.dependencies import get_current_user, get_optional_user
from tts.service import (
    generate_speech,
    generate_speech_with_provider,
    clean_text_for_tts,
    estimate_duration,
    estimate_cost,
    MAX_TEXT_LENGTH
)

# 🆕 Imports SQLAlchemy pour les endpoints /summary et /playlist
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_session, Summary, User, PlaylistAnalysis

router = APIRouter(tags=["Text-to-Speech"])


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class TTSRequest(BaseModel):
    """Requête de génération audio"""
    text: str = Field(..., min_length=1, max_length=10000, description="Texte à convertir")
    language: Literal["fr", "en"] = Field(default="fr", description="Langue du texte")
    voice_style: Literal["warm", "calm", "soft", "narrative"] = Field(
        default="warm", 
        description="Style de voix"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Bienvenue sur Deep Sight, votre assistant d'analyse vidéo.",
                "language": "fr",
                "voice_style": "warm"
            }
        }


class TTSEstimate(BaseModel):
    """Estimation avant génération"""
    text_length: int
    estimated_duration_seconds: float
    estimated_cost_elevenlabs: float
    estimated_cost_openai: float
    is_within_limit: bool
    truncated_preview: str


class TTSResponse(BaseModel):
    """Réponse de génération"""
    success: bool
    provider: str
    duration_estimate: float
    message: str


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/estimate", response_model=TTSEstimate)
async def estimate_tts(
    request: TTSRequest,
    current_user = Depends(get_optional_user)
):
    """
    📊 Estime le coût et la durée avant génération.
    
    Utile pour afficher une preview à l'utilisateur avant de lancer la synthèse.
    """
    cleaned = clean_text_for_tts(request.text)
    
    return TTSEstimate(
        text_length=len(cleaned),
        estimated_duration_seconds=estimate_duration(cleaned),
        estimated_cost_elevenlabs=estimate_cost(cleaned, "elevenlabs"),
        estimated_cost_openai=estimate_cost(cleaned, "openai"),
        is_within_limit=len(cleaned) <= MAX_TEXT_LENGTH,
        truncated_preview=cleaned[:200] + "..." if len(cleaned) > 200 else cleaned
    )


@router.post("/generate", response_class=Response)
async def generate_tts_audio(
    request: TTSRequest,
    current_user = Depends(get_current_user)
):
    """
    🎙️ Génère l'audio à partir du texte.
    
    Retourne directement le fichier MP3.
    
    **Providers utilisés:**
    - ElevenLabs (principal) - Voix ultra-naturelle
    - OpenAI TTS (fallback) - Si ElevenLabs échoue
    
    **Styles de voix disponibles:**
    - `warm`: Voix chaleureuse et accueillante
    - `calm`: Voix calme et posée
    - `soft`: Voix douce et apaisante
    - `narrative`: Voix de narrateur
    """
    # Vérifier les quotas utilisateur (Pro requis pour TTS)
    user_plan = current_user.get("plan", "free")
    if user_plan == "free":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "tts_pro_required",
                "message": "La synthèse vocale est réservée aux abonnés Starter et Pro",
                "upgrade_url": "/upgrade"
            }
        )
    
    # Générer l'audio
    audio_data, provider = await generate_speech(
        text=request.text,
        language=request.language,
        voice_preference=request.voice_style,
        use_cache=True
    )
    
    if not audio_data:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "tts_generation_failed",
                "message": f"Échec de la génération audio: {provider}",
                "provider_error": provider
            }
        )
    
    # Retourner l'audio MP3
    return Response(
        content=audio_data,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=deepsight_audio.mp3",
            "X-TTS-Provider": provider,
            "X-Audio-Duration": str(estimate_duration(request.text))
        }
    )


@router.post("/download")
async def download_tts_audio(
    request: TTSRequest,
    filename: str = Query(default="resume_audio", description="Nom du fichier"),
    current_user = Depends(get_current_user)
):
    """
    📥 Télécharge l'audio en MP3.
    
    Similaire à /generate mais force le téléchargement avec un nom de fichier.
    """
    # Vérifier les quotas
    user_plan = current_user.get("plan", "free")
    if user_plan == "free":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "tts_pro_required",
                "message": "Le téléchargement audio est réservé aux abonnés"
            }
        )
    
    # Générer l'audio
    audio_data, provider = await generate_speech(
        text=request.text,
        language=request.language,
        voice_preference=request.voice_style,
        use_cache=True
    )
    
    if not audio_data:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "tts_generation_failed",
                "message": "Service TTS indisponible. Veuillez réessayer plus tard.",
                "provider": provider
            }
        )
    
    # Nettoyer le nom de fichier
    safe_filename = "".join(c for c in filename if c.isalnum() or c in "._- ")[:50]
    
    return Response(
        content=audio_data,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}.mp3"',
            "X-TTS-Provider": provider
        }
    )


@router.get("/voices")
async def list_available_voices():
    """
    📋 Liste les voix disponibles par langue.
    
    Utile pour permettre à l'utilisateur de choisir sa voix préférée.
    """
    return {
        "fr": {
            "warm": {
                "name": "Rachel",
                "description": "Voix féminine chaleureuse et accueillante",
                "provider": "elevenlabs",
                "recommended_for": ["résumés", "tutoriels", "podcasts"]
            },
            "calm": {
                "name": "Drew", 
                "description": "Voix masculine calme et posée",
                "provider": "elevenlabs",
                "recommended_for": ["analyses", "rapports", "documentaires"]
            },
            "soft": {
                "name": "Bella",
                "description": "Voix féminine douce et apaisante",
                "provider": "elevenlabs",
                "recommended_for": ["méditation", "histoires", "contenu relaxant"]
            },
            "narrative": {
                "name": "Antoni",
                "description": "Voix masculine de narrateur professionnel",
                "provider": "elevenlabs",
                "recommended_for": ["documentaires", "livres audio", "présentations"]
            }
        },
        "en": {
            "warm": {
                "name": "Nova",
                "description": "Warm and friendly female voice",
                "provider": "openai",
                "recommended_for": ["summaries", "tutorials", "podcasts"]
            },
            "calm": {
                "name": "Onyx",
                "description": "Deep and calm male voice",
                "provider": "openai", 
                "recommended_for": ["analysis", "reports", "documentaries"]
            }
        },
        "default_voice": {
            "fr": "warm",
            "en": "warm"
        }
    }


@router.get("/status")
async def tts_service_status():
    """
    🔍 Vérifie le statut du service TTS.
    
    Indique quels providers sont configurés et disponibles.
    """
    import os
    
    elevenlabs_configured = bool(os.getenv("ELEVENLABS_API_KEY"))
    openai_configured = bool(os.getenv("OPENAI_API_KEY"))
    
    return {
        "service": "tts",
        "status": "operational" if (elevenlabs_configured or openai_configured) else "degraded",
        "providers": {
            "elevenlabs": {
                "configured": elevenlabs_configured,
                "status": "available" if elevenlabs_configured else "not_configured",
                "quality": "premium",
                "languages": ["fr", "en", "es", "de", "it", "pt", "pl", "hi", "ar", "zh", "ja", "ko"]
            },
            "openai": {
                "configured": openai_configured,
                "status": "available" if openai_configured else "not_configured",
                "quality": "standard",
                "languages": ["fr", "en", "es", "de", "it", "pt", "pl", "ru", "ja", "zh"]
            }
        },
        "fallback_enabled": elevenlabs_configured and openai_configured,
        "cache_enabled": True,
        "max_text_length": MAX_TEXT_LENGTH
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 ENDPOINTS POUR RÉSUMÉS VIDÉO (SQLAlchemy)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/summary/{summary_id}/audio", response_class=Response)
async def generate_summary_audio(
    summary_id: int,
    voice_style: str = Query(default="warm", description="Style de voix: warm, calm, soft, narrative"),
    provider: str = Query(default="auto", description="Provider TTS: auto, openai (Pro/Expert), elevenlabs"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🎬 Génère l'audio pour un résumé de vidéo.
    
    **Providers disponibles:**
    - `auto`: ElevenLabs avec fallback OpenAI (Starter+)
    - `openai`: OpenAI TTS direct - voix HD (Pro/Expert uniquement)
    - `elevenlabs`: ElevenLabs uniquement, sans fallback
    
    **Voix disponibles:**
    - `warm`: Rachel/Nova - Voix chaleureuse (recommandé)
    - `calm`: Drew/Onyx - Voix calme et posée  
    - `soft`: Bella/Shimmer - Voix douce
    - `narrative`: Antoni/Fable - Voix narrateur
    
    **Plans:**
    - Free: ❌ Non disponible
    - Starter: ✅ Auto (ElevenLabs → OpenAI fallback)
    - Pro/Expert: ✅ Tous les providers + OpenAI HD direct
    """
    
    # Vérifier le plan
    if current_user.plan == "free":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "tts_pro_required",
                "message": "La synthèse vocale est réservée aux abonnés Starter et Pro",
                "upgrade_url": "/upgrade"
            }
        )
    
    # Vérifier l'accès au provider OpenAI (Pro/Expert seulement)
    if provider == "openai" and current_user.plan not in ["pro", "expert", "unlimited"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "openai_tts_pro_required",
                "message": "OpenAI TTS HD est réservé aux abonnés Pro et Expert",
                "available_provider": "auto",
                "upgrade_url": "/upgrade"
            }
        )
    
    # Récupérer le résumé
    result = await session.execute(
        select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == current_user.id
        )
    )
    summary = result.scalar_one_or_none()
    
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    # Préparer le texte pour TTS
    text = summary.summary_content
    if not text:
        raise HTTPException(status_code=404, detail="No content to convert")
    
    # Détecter la langue
    language = summary.lang or "fr"
    if language not in ["fr", "en"]:
        language = "fr"
    
    # Ajouter un intro
    intro = f"Résumé de la vidéo: {summary.video_title}. " if summary.video_title else ""
    full_text = intro + text
    
    print(f"🎙️ [TTS] Generating audio for summary {summary_id} ({len(full_text)} chars) - provider: {provider}", flush=True)
    
    # Générer l'audio avec le provider choisi
    audio_data, used_provider = await generate_speech_with_provider(
        text=full_text,
        language=language,
        voice_preference=voice_style,
        provider=provider,
        use_cache=True
    )
    
    if not audio_data:
        # Message d'erreur clair pour le frontend
        error_message = "Service de synthèse vocale temporairement indisponible. "
        if used_provider == "all_providers_failed":
            error_message += "Tous les fournisseurs (ElevenLabs et OpenAI) ont échoué. Veuillez réessayer plus tard ou ajouter des crédits API."
        elif used_provider == "elevenlabs_failed":
            error_message += "ElevenLabs n'est pas disponible."
        elif used_provider == "openai_failed":
            error_message += "OpenAI TTS n'est pas disponible. Vérifiez vos crédits."
        else:
            error_message += "Veuillez réessayer plus tard."
        
        raise HTTPException(
            status_code=503,
            detail={
                "error": "tts_generation_failed",
                "message": error_message,
                "provider": used_provider
            }
        )
    
    print(f"🎙️ [TTS] Audio generated with {used_provider} ({len(audio_data)} bytes)", flush=True)
    
    # Nom de fichier safe
    safe_title = "".join(c for c in (summary.video_title or "resume")[:30] if c.isalnum() or c in " -_")
    
    return Response(
        content=audio_data,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f'inline; filename="deepsight_{safe_title}.mp3"',
            "X-TTS-Provider": used_provider,
            "X-Summary-ID": str(summary_id),
            "X-Audio-Duration": str(estimate_duration(full_text)),
            "Cache-Control": "public, max-age=86400"  # Cache 24h
        }
    )


@router.post("/playlist/{playlist_id}/audio", response_class=Response)
async def generate_playlist_meta_audio(
    playlist_id: str,
    voice_style: str = Query(default="narrative", description="Style de voix"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    📋 Génère l'audio pour la méta-analyse d'une playlist.
    
    Lit la synthèse transversale de toutes les vidéos de la playlist.
    Voix "narrative" recommandée pour les analyses longues.
    """
    
    # Vérifier le plan
    if current_user.plan == "free":
        raise HTTPException(
            status_code=403,
            detail={"error": "tts_pro_required", "message": "Abonnement requis"}
        )
    
    # Récupérer la playlist
    result = await session.execute(
        select(PlaylistAnalysis).where(
            PlaylistAnalysis.playlist_id == playlist_id,
            PlaylistAnalysis.user_id == current_user.id
        )
    )
    playlist = result.scalar_one_or_none()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Récupérer la méta-analyse
    meta_analysis = playlist.meta_analysis
    if not meta_analysis:
        raise HTTPException(status_code=404, detail="No meta-analysis available")
    
    # Préparer le texte
    intro = f"Méta-analyse de la playlist: {playlist.playlist_name}. " if playlist.playlist_name else "Méta-analyse. "
    full_text = intro + meta_analysis
    
    # Détecter la langue
    language = "fr"  # Par défaut
    
    print(f"🎙️ [TTS] Generating meta-analysis audio for playlist {playlist_id}", flush=True)
    
    # Générer l'audio
    audio_data, provider = await generate_speech(
        text=full_text,
        language=language,
        voice_preference=voice_style,
        use_cache=True
    )
    
    if not audio_data:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "tts_generation_failed",
                "message": "Service TTS indisponible. Veuillez réessayer plus tard.",
                "provider": provider
            }
        )
    
    safe_name = "".join(c for c in (playlist.playlist_name or "playlist")[:30] if c.isalnum() or c in " -_")
    
    return Response(
        content=audio_data,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f'inline; filename="deepsight_meta_{safe_name}.mp3"',
            "X-TTS-Provider": provider,
            "X-Playlist-ID": playlist_id,
            "Cache-Control": "public, max-age=86400"
        }
    )


@router.get("/summary/{summary_id}/estimate", response_model=TTSEstimate)
async def estimate_summary_tts(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    📊 Estime la durée et le coût TTS pour un résumé.
    
    Permet d'afficher une preview avant la génération.
    """
    
    result = await session.execute(
        select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == current_user.id
        )
    )
    summary = result.scalar_one_or_none()
    
    if not summary or not summary.summary_content:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    text = summary.summary_content
    cleaned = clean_text_for_tts(text)
    
    return TTSEstimate(
        text_length=len(cleaned),
        estimated_duration_seconds=estimate_duration(cleaned),
        estimated_cost_elevenlabs=estimate_cost(cleaned, "elevenlabs"),
        estimated_cost_openai=estimate_cost(cleaned, "openai"),
        is_within_limit=len(cleaned) <= MAX_TEXT_LENGTH,
        truncated_preview=cleaned[:200] + "..." if len(cleaned) > 200 else cleaned
    )
