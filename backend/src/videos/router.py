"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📹 VIDEO ROUTER v6.0 — SÉCURITÉ RENFORCÉE + ENRICHISSEMENT PERPLEXITY             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  🆕 v6.0: SÉCURITÉ RENFORCÉE                                                       ║
║  • 🔐 Réservation atomique des crédits avant analyse                               ║
║  • 🛡️ Rate limiting par utilisateur                                               ║
║  • ✅ Vérification email obligatoire                                               ║
║  • 💰 Coût variable selon le modèle (small=1, medium=2, large=3)                  ║
║  • 🌐 Perplexity PRÉ-ANALYSE pour Pro/Expert                                       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import math
from uuid import uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User
from auth.dependencies import get_current_user, get_verified_user, require_plan, check_daily_limit, require_feature, get_current_admin
from core.config import PLAN_LIMITS, CATEGORIES

# Import du système de sécurité
try:
    from core.security import (
        check_can_analyze as secure_check_can_analyze,
        reserve_credits, consume_reserved_credits, release_reserved_credits,
        get_credit_cost, generate_secure_operation_id, verify_resource_ownership
    )
    SECURITY_AVAILABLE = True
except ImportError:
    SECURITY_AVAILABLE = False
    print("⚠️ [VIDEO] Security module not available", flush=True)

from .schemas import (
    AnalyzeVideoRequest, AnalyzePlaylistRequest, UpdateSummaryRequest,
    SummaryResponse, SummaryListItem, HistoryResponse, CategoryResponse,
    TaskStatusResponse, VideoInfoResponse, ExtensionSummaryResponse,
    GuestAnalyzeRequest, GuestAnalyzeResponse
)
from .summary_extractor import extract_extension_summary
from .service import (
    check_can_analyze, deduct_credit, save_summary,
    get_summary_by_id, get_summary_by_video_id, get_user_history,
    update_summary, delete_summary, delete_all_history,
    create_playlist_analysis, get_user_playlists, get_playlist_summaries,
    get_user_stats, create_task, update_task_status, get_task
)
from .analysis import (
    generate_summary, detect_category, extract_entities,
    calculate_reliability_score, CATEGORIES as ANALYSIS_CATEGORIES
)
from .long_video_analyzer import (
    needs_chunking, analyze_long_video, get_chunk_stats
)
from .web_enrichment import (
    get_pre_analysis_context, get_enrichment_level, get_enrichment_badge,
    EnrichmentLevel, format_sources_markdown
)
from .raw_text_enhance import (
    enhance_raw_text, generate_smart_title, generate_thumbnail,
    SourceType, SourceContext, get_source_specific_instructions
)
# 📚 Import du système de définitions de concepts
from .concept_definitions import (
    get_concepts_with_definitions, extract_concepts, clean_concept_markers
)
# 📚 Import des définitions enrichies v2 (Mistral + Perplexity)
from .enriched_definitions import (
    get_enriched_definitions, extract_terms_from_text, get_category_info, CATEGORIES
)

# 🆕 v2.1: Import des nouveaux modules d'analyse avancée
try:
    from .youtube_comments import analyze_comments
    from .metadata_enriched import get_enriched_metadata, detect_sponsorship, detect_propaganda_risk
    from .anti_ai_prompts import build_customized_prompt, get_anti_ai_prompt, get_style_instruction
    from .schemas import (
        AnalysisCustomization, WritingStyle, AnalyzeRequestV2, AnalyzeResponseV2,
        CommentsAnalysis, VideoMetadataEnriched
    )
    ADVANCED_ANALYSIS_AVAILABLE = True
except ImportError as e:
    ADVANCED_ANALYSIS_AVAILABLE = False
    print(f"⚠️ [VIDEO] Advanced analysis modules not available: {e}", flush=True)

# 🕐 Import du système de fraîcheur et fact-check LITE
try:
    from .freshness_factcheck import (
        analyze_freshness, analyze_claims_lite, analyze_content_reliability,
        FreshnessLevel
    )
    FACTCHECK_LITE_AVAILABLE = True
except ImportError:
    FACTCHECK_LITE_AVAILABLE = False
    print("⚠️ [VIDEO] Freshness/FactCheck LITE module not available", flush=True)
from transcripts import (
    extract_video_id, extract_playlist_id,
    get_video_info, get_transcript_with_timestamps,
    get_playlist_videos, get_playlist_info
)
# 🎵 TikTok support
from transcripts.tiktok import (
    is_tiktok_url, extract_tiktok_video_id,
    get_tiktok_video_info, get_tiktok_transcript,
    detect_platform
)

# 🔔 Import du système de notifications (SSE)
try:
    from notifications.router import notify_analysis_complete, notify_analysis_failed
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False
    print("⚠️ [VIDEO] Notifications module not available", flush=True)
    
    # Fallback: fonctions vides
    async def notify_analysis_complete(*args, **kwargs):
        pass
    async def notify_analysis_failed(*args, **kwargs):
        pass

router = APIRouter()

# Store en mémoire pour les tâches (en production: Redis)
_task_store: Dict[str, Dict[str, Any]] = {}

# 🆓 Guest demo rate limiting (1 analyse/IP/24h)
_guest_usage: Dict[str, float] = {}  # IP → timestamp
MAX_VIDEO_DURATION_GUEST = 300  # 5 minutes


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 CHECK CACHE — Public endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/check-cache/{video_id}")
async def check_video_cache(video_id: str):
    """
    Public endpoint — check if a video transcript is cached and return metadata.
    """
    try:
        from transcripts.cache_db import check_transcript_cached
        result = await check_transcript_cached(video_id)
        if result:
            return {"cached": True, **result}
        return {"cached": False, "video_id": video_id}
    except ImportError:
        return {"cached": False, "video_id": video_id, "error": "Cache module not available"}


# ═══════════════════════════════════════════════════════════════════════════════
# 🆓 GUEST DEMO — Analyse express sans authentification
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze/guest", response_model=GuestAnalyzeResponse)
async def analyze_video_guest(
    request: GuestAnalyzeRequest,
    raw_request: Request,
):
    """
    Analyse express pour visiteurs non connectés.
    - YouTube ET TikTok, vidéos < 5 min
    - 1 analyse par IP toutes les 24h
    - Mode accessible, résumé court
    - Aucune sauvegarde en DB
    """
    import time

    # 1. Rate-limit par IP
    client_ip = raw_request.headers.get("x-forwarded-for", raw_request.client.host if raw_request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    now = time.time()
    last_used = _guest_usage.get(client_ip, 0)
    if now - last_used < 86400:  # 24h
        raise HTTPException(
            status_code=429,
            detail="Vous avez déjà utilisé votre essai gratuit. Créez un compte pour continuer !"
        )

    # 2. Détecter plateforme et valider URL
    url = request.url.strip()
    platform = detect_platform(url)

    if platform == "tiktok":
        # ── TikTok ──
        tiktok_id = extract_tiktok_video_id(url)
        if not tiktok_id:
            raise HTTPException(status_code=400, detail="URL TikTok invalide.")

        try:
            video_info = await get_tiktok_video_info(url)
            if not video_info:
                raise ValueError("No info")
        except Exception:
            raise HTTPException(status_code=400, detail="Impossible de récupérer les informations de la vidéo TikTok.")

        duration = video_info.get("duration", 0)
        if duration > MAX_VIDEO_DURATION_GUEST:
            raise HTTPException(
                status_code=400,
                detail=f"L'essai gratuit est limité aux vidéos de moins de 5 minutes. Cette vidéo dure {duration // 60}:{duration % 60:02d}."
            )

        try:
            transcript_text = await get_tiktok_transcript(url)
        except Exception:
            raise HTTPException(status_code=400, detail="Impossible de récupérer la transcription de cette vidéo TikTok.")

        thumbnail_url = video_info.get("thumbnail", video_info.get("thumbnail_url", ""))
    else:
        # ── YouTube ──
        video_id = extract_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail="URL YouTube ou TikTok invalide. Vérifiez le lien copié.")

        try:
            video_info = await get_video_info(video_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Impossible de récupérer les informations de la vidéo.")

        duration = video_info.get("duration", 0)
        if duration > MAX_VIDEO_DURATION_GUEST:
            raise HTTPException(
                status_code=400,
                detail=f"L'essai gratuit est limité aux vidéos de moins de 5 minutes. Cette vidéo dure {duration // 60}:{duration % 60:02d}."
            )

        try:
            transcript_result = await get_transcript_with_timestamps(video_id)
            if isinstance(transcript_result, tuple):
                transcript_text = transcript_result[0]
            else:
                transcript_text = transcript_result
        except Exception:
            raise HTTPException(status_code=400, detail="Impossible de récupérer la transcription de la vidéo.")

        thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    # 3. Vérifier transcription
    if not transcript_text or len(transcript_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="La transcription de cette vidéo est trop courte ou indisponible.")

    # 4. Détecter catégorie
    try:
        category = await detect_category(transcript_text[:2000])
    except Exception:
        category = "general"

    # 5. Générer résumé court en mode accessible
    try:
        summary = await generate_summary(
            title=video_info.get("title", ""),
            transcript=transcript_text,
            category=category,
            lang="fr",
            mode="accessible",
            channel=video_info.get("channel", video_info.get("author", "")),
            platform=platform,
            target_length="short",
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur lors de la génération du résumé.")

    if not summary:
        raise HTTPException(status_code=500, detail="Le résumé n'a pas pu être généré.")

    # 6. Marquer IP comme utilisée
    _guest_usage[client_ip] = now

    # 7. Cleanup vieilles entrées (éviter fuite mémoire)
    expired = [ip for ip, ts in _guest_usage.items() if now - ts > 86400]
    for ip in expired:
        del _guest_usage[ip]

    word_count = len(summary.split())

    return GuestAnalyzeResponse(
        video_title=video_info.get("title", "Vidéo"),
        video_channel=video_info.get("channel", video_info.get("author", "")),
        video_duration=duration,
        thumbnail_url=thumbnail_url,
        summary_content=summary,
        category=category,
        word_count=word_count,
        mode="accessible",
        lang="fr",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🎬 ANALYSE VIDÉO
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze", response_model=TaskStatusResponse)
async def analyze_video(
    request: AnalyzeVideoRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(check_daily_limit),  # 🔐 Email vérifié + limite quotidienne
    session: AsyncSession = Depends(get_session)
):
    """
    🔐 Lance l'analyse d'une vidéo YouTube avec SÉCURITÉ RENFORCÉE.
    
    SÉCURITÉ:
    - Email vérifié obligatoire
    - Rate limiting appliqué
    - Crédits réservés AVANT l'opération
    - Coût variable selon le modèle
    """
    print(f"📥 [v6.0] Analyze request: {request.url} by user {current_user.id} (plan: {current_user.plan})", flush=True)

    # 🎵 Détecter la plateforme (YouTube ou TikTok)
    platform = detect_platform(request.url)

    if platform == "tiktok":
        video_id = extract_tiktok_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={
                "code": "invalid_url",
                "message": "Invalid TikTok URL"
            })
        print(f"🎵 [TIKTOK] Detected TikTok video: {video_id}", flush=True)
    else:
        video_id = extract_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={
                "code": "invalid_url",
                "message": "Invalid YouTube URL"
            })
    
    # Déterminer le modèle à utiliser
    plan_limits = PLAN_LIMITS.get(current_user.plan, PLAN_LIMITS["free"])
    model = request.model or plan_limits.get("default_model", "mistral-small-latest")
    
    # Vérifier que le modèle est autorisé
    allowed_models = plan_limits.get("models", ["mistral-small-latest"])
    if model not in allowed_models:
        model = allowed_models[0]  # Fallback au modèle par défaut
    
    # 🆕 v5.5: Vérifier si deep_research est autorisé
    deep_research = request.deep_research and plan_limits.get("deep_research_enabled", False)
    deep_research_cost = plan_limits.get("deep_research_credits_cost", 0) if deep_research else 0
    
    # 🔐 Calculer le coût en crédits
    if SECURITY_AVAILABLE:
        credit_cost = get_credit_cost("video_analysis", model)
    else:
        credit_cost = 1
    
    # Ajouter le coût de deep_research
    credit_cost += deep_research_cost
    
    # 🔐 Vérifier les crédits avec le système sécurisé
    if SECURITY_AVAILABLE:
        can_analyze, reason, info = await secure_check_can_analyze(
            session, current_user.id, model
        )
    else:
        # check_can_analyze retourne 4 valeurs: (can_analyze, reason, credits, cost)
        can_analyze, reason, credits_remaining, estimated_cost = await check_can_analyze(session, current_user.id)
        info = {"credits": credits_remaining, "cost": estimated_cost}  # Construire info dict
    
    if not can_analyze:
        raise HTTPException(status_code=403, detail={
            "code": reason,
            "message": info.get("message", f"Cannot analyze: {reason}"),
            "credits": info.get("credits", 0),
            "cost": credit_cost,
            **info
        })
    
    print(f"🎬 Video ID extracted: {video_id}, cost: {credit_cost} credits", flush=True)
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # 💾 SYSTÈME DE CACHE v2.0 — Économise les crédits API
    # ═══════════════════════════════════════════════════════════════════════════════
    # Vérifier si déjà analysée (même vidéo, même mode) - SAUF si force_refresh
    if not request.force_refresh:
        existing = await get_summary_by_video_id(session, video_id, current_user.id)
        
        if existing and existing.mode == request.mode:
            # Vérifier la fraîcheur du cache (7 jours max)
            from datetime import timedelta
            cache_age = datetime.now() - existing.created_at
            cache_valid = cache_age < timedelta(days=7)
            
            if cache_valid:
                print(f"💾 [CACHE HIT] Using cached analysis: summary_id={existing.id} (age: {cache_age.days}d)", flush=True)
                return TaskStatusResponse(
                    task_id=f"cached_{existing.id}",
                    status="completed",
                    progress=100,
                    message=f"✅ Analyse retrouvée en cache (gratuit!)",
                    result={
                        "summary_id": existing.id,
                        "cached": True,
                        "cache_age_days": cache_age.days,
                        "video_title": existing.video_title,
                        "category": existing.category,
                        "cost": 0  # Gratuit car cache
                    }
                )
            else:
                print(f"⏰ [CACHE EXPIRED] Cache too old ({cache_age.days} days), re-analyzing...", flush=True)
    else:
        print(f"🔄 [FORCE REFRESH] Bypassing cache as requested", flush=True)
    
    # 🔐 Générer un ID d'opération sécurisé
    if SECURITY_AVAILABLE:
        task_id = generate_secure_operation_id(current_user.id, "video_analysis")
    else:
        task_id = str(uuid4())
    
    # 🔐 RÉSERVER les crédits AVANT de lancer l'opération
    if SECURITY_AVAILABLE:
        reserved, reserve_reason, reserve_info = await reserve_credits(
            session, current_user.id, credit_cost, task_id, "video_analysis"
        )
        if not reserved:
            raise HTTPException(status_code=403, detail={
                "code": reserve_reason,
                "message": f"Could not reserve credits: {reserve_reason}",
                **reserve_info
            })
        print(f"🔒 Credits reserved: {credit_cost} for task {task_id[:12]}", flush=True)
    
    _task_store[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Initializing...",
        "user_id": current_user.id,
        "video_id": video_id,
        "credit_cost": credit_cost,
        "deep_research": deep_research  # 🆕 v5.5
    }
    
    print(f"🚀 Task created: {task_id} (deep_research={deep_research})", flush=True)
    
    # Créer dans la DB aussi
    await create_task(session, task_id, current_user.id, "video_analysis")
    
    # Lancer l'analyse en background
    background_tasks.add_task(
        _analyze_video_background_v6,  # 🆕 Nouvelle version
        task_id=task_id,
        video_id=video_id,
        url=request.url,
        mode=request.mode,
        category=request.category,
        lang=request.lang,
        model=model,
        user_id=current_user.id,
        user_plan=current_user.plan,
        credit_cost=credit_cost,
        deep_research=deep_research,  # 🆕 v5.5
        platform=platform  # 🎵 TikTok support
    )

    return TaskStatusResponse(
        task_id=task_id,
        status="pending",
        progress=0,
        message="Analysis started",
        result={"cost": credit_cost, "deep_research": deep_research}
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🆕 ANALYSE V2 — Customization complète
# ═══════════════════════════════════════════════════════════════════════════════

from .schemas import AnalyzeVideoV2Request, AnalyzeV2Response

@router.post("/analyze/v2", response_model=AnalyzeV2Response)
async def analyze_video_v2(
    request: AnalyzeVideoV2Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(check_daily_limit),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 v2.0: Analyse vidéo avec customization complète.

    Fonctionnalités avancées:
    - Options de customization détaillées
    - Contrôle de la longueur du résumé
    - Génération de table des matières (TOC)
    - Webhook de notification
    - Priorité de traitement (Pro/Expert)

    SÉCURITÉ:
    - Email vérifié obligatoire
    - Rate limiting appliqué
    - Crédits réservés AVANT l'opération
    """
    print(f"📥 [v2.0] Analyze request: {request.url} by user {current_user.id}", flush=True)

    # 🎵 Détecter la plateforme
    platform = detect_platform(request.url)

    if platform == "tiktok":
        video_id = extract_tiktok_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={
                "code": "invalid_url",
                "message": "Invalid TikTok URL"
            })
    else:
        video_id = extract_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={
                "code": "invalid_url",
                "message": "Invalid YouTube URL"
            })

    # Déterminer le modèle
    plan_limits = PLAN_LIMITS.get(current_user.plan, PLAN_LIMITS["free"])
    model = request.model or plan_limits.get("default_model", "mistral-small-latest")

    # Vérifier que le modèle est autorisé
    allowed_models = plan_limits.get("models", ["mistral-small-latest"])
    if model not in allowed_models:
        model = allowed_models[0]

    # Vérifier deep_research
    deep_research = request.deep_research and plan_limits.get("deep_research_enabled", False)
    deep_research_cost = plan_limits.get("deep_research_credits_cost", 0) if deep_research else 0

    # Calculer le coût
    if SECURITY_AVAILABLE:
        credit_cost = get_credit_cost("video_analysis", model)
    else:
        credit_cost = 1
    credit_cost += deep_research_cost

    # Bonus de coût pour options avancées
    if request.generate_toc:
        credit_cost += 1  # TOC coûte 1 crédit supplémentaire
    if request.summary_length == "detailed":
        credit_cost += 1  # Résumé détaillé coûte 1 crédit supplémentaire

    # Vérifier les crédits
    if SECURITY_AVAILABLE:
        can_analyze, reason, info = await secure_check_can_analyze(
            session, current_user.id, model
        )
    else:
        can_analyze, reason, credits_remaining, estimated_cost = await check_can_analyze(session, current_user.id)
        info = {"credits": credits_remaining, "cost": estimated_cost}

    if not can_analyze:
        raise HTTPException(status_code=403, detail={
            "code": reason,
            "message": info.get("message", f"Cannot analyze: {reason}"),
            "credits": info.get("credits", 0),
            "cost": credit_cost,
            **info
        })

    # Vérifier le cache (sauf si force_refresh)
    if not request.force_refresh:
        existing = await get_summary_by_video_id(session, video_id, current_user.id)
        if existing and existing.mode == request.mode:
            from datetime import timedelta
            cache_age = datetime.now() - existing.created_at
            if cache_age < timedelta(days=7):
                print(f"💾 [CACHE HIT] v2: summary_id={existing.id}", flush=True)
                return AnalyzeV2Response(
                    task_id=f"cached_{existing.id}",
                    status="completed",
                    progress=100,
                    message="✅ Analyse retrouvée en cache (gratuit!)",
                    cost=0,
                    video_info={
                        "video_id": existing.video_id,
                        "title": existing.video_title,
                        "channel": existing.video_channel,
                    },
                    applied_options={
                        "mode": existing.mode,
                        "lang": existing.lang,
                        "cached": True,
                        "cache_age_days": cache_age.days
                    }
                )

    # Générer l'ID de tâche
    if SECURITY_AVAILABLE:
        task_id = generate_secure_operation_id(current_user.id, "video_analysis_v2")
    else:
        task_id = str(uuid4())

    # Réserver les crédits
    if SECURITY_AVAILABLE:
        reserved, reserve_reason, reserve_info = await reserve_credits(
            session, current_user.id, credit_cost, task_id, "video_analysis_v2"
        )
        if not reserved:
            raise HTTPException(status_code=403, detail={
                "code": reserve_reason,
                "message": f"Could not reserve credits: {reserve_reason}",
                **reserve_info
            })
        print(f"🔒 [v2] Credits reserved: {credit_cost} for task {task_id[:12]}", flush=True)

    # Préparer les options de customization
    # 🆕 v5.2: Map frontend target_length → backend summary_length
    effective_summary_length = request.summary_length  # legacy default
    if request.target_length:
        _tl_map = {"short": "short", "medium": "standard", "long": "detailed", "auto": "standard"}
        effective_summary_length = _tl_map.get(request.target_length, "standard")

    customization_options = {
        "summary_length": effective_summary_length,
        "highlight_key_points": request.highlight_key_points,
        "generate_toc": request.generate_toc,
        "include_entities": request.include_entities,
        "include_timestamps": request.include_timestamps,
        "include_reliability": request.include_reliability,
        "priority": request.priority if current_user.plan in ["pro", "expert", "unlimited"] else "normal",
        "webhook_url": request.webhook_url,
        "custom": request.customization or {}
    }

    # Stocker la tâche
    _task_store[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Initializing v2 analysis...",
        "user_id": current_user.id,
        "video_id": video_id,
        "credit_cost": credit_cost,
        "deep_research": deep_research,
        "v2_options": customization_options
    }

    print(f"🚀 [v2] Task created: {task_id}", flush=True)

    # Créer en DB
    await create_task(session, task_id, current_user.id, "video_analysis_v2")

    # Estimer la durée
    estimated_duration = 30 if request.summary_length == "short" else (60 if request.summary_length == "standard" else 90)
    if deep_research:
        estimated_duration += 30

    # Lancer l'analyse en background
    background_tasks.add_task(
        _analyze_video_background_v2,
        task_id=task_id,
        video_id=video_id,
        url=request.url,
        mode=request.mode,
        category=request.category,
        lang=request.lang,
        model=model,
        user_id=current_user.id,
        user_plan=current_user.plan,
        credit_cost=credit_cost,
        deep_research=deep_research,
        options=customization_options,
        force_refresh=request.force_refresh,
        platform=platform  # 🎵 TikTok support
    )

    return AnalyzeV2Response(
        task_id=task_id,
        status="pending",
        progress=0,
        message="Analysis v2 started with custom options",
        estimated_duration_seconds=estimated_duration,
        cost=credit_cost,
        applied_options=customization_options
    )


async def _analyze_video_background_v2(
    task_id: str,
    video_id: str,
    url: str,
    mode: str,
    category: Optional[str],
    lang: str,
    model: str,
    user_id: int,
    user_plan: str,
    credit_cost: int,
    deep_research: bool,
    options: Dict[str, Any],
    force_refresh: bool = False,
    platform: str = "youtube"
):
    """
    🆕 v2.0: Background analysis avec options de customization.

    Ajoute le support de:
    - Longueur de résumé variable
    - Table des matières
    - Points clés mis en évidence
    - Webhook de notification
    """
    from db.database import async_session_maker
    import httpx

    print(f"🔧 [v2.0] Background task started: {task_id}", flush=True)

    # Déterminer le niveau d'enrichissement
    if deep_research:
        enrichment_level = EnrichmentLevel.DEEP
    else:
        enrichment_level = get_enrichment_level(user_plan)

    try:
        async with async_session_maker() as session:
            _task_store[task_id]["status"] = "processing"
            _task_store[task_id]["progress"] = 5
            _task_store[task_id]["message"] = "🚀 Démarrage de l'analyse v2..."

            # 1. Récupérer les infos vidéo
            _task_store[task_id]["progress"] = 10
            _task_store[task_id]["message"] = "📺 Récupération des infos vidéo..."

            if platform == "tiktok":
                video_info = await get_tiktok_video_info(url)
            else:
                video_info = await get_video_info(video_id)
            if not video_info:
                raise Exception("Could not fetch video info")

            # 2. Extraire la transcription
            _task_store[task_id]["progress"] = 20
            _task_store[task_id]["message"] = "📝 Extraction du transcript..."

            if platform == "tiktok":
                transcript, transcript_timestamped, detected_lang = await get_tiktok_transcript(url, video_id)
            else:
                transcript, transcript_timestamped, detected_lang = await get_transcript_with_timestamps(video_id)
            if not transcript:
                raise Exception("No transcript available for this video")

            if not lang or lang == "auto":
                lang = detected_lang or "fr"

            # 3. Détecter la catégorie
            _task_store[task_id]["progress"] = 30
            _task_store[task_id]["message"] = "🏷️ Détection de la catégorie..."

            if not category or category == "auto":
                category, confidence = detect_category(
                    title=video_info["title"],
                    description=video_info.get("description", ""),
                    transcript=transcript[:3000],
                    channel=video_info.get("channel", ""),
                    tags=video_info.get("tags", []),
                    youtube_categories=video_info.get("categories", [])
                )
            else:
                confidence = 0.9

            # 4. Enrichissement web (si activé)
            web_context = None
            enrichment_sources = []

            if enrichment_level != EnrichmentLevel.NONE:
                _task_store[task_id]["progress"] = 40
                _task_store[task_id]["message"] = f"🌐 Recherche web ({enrichment_level.value})..."

                try:
                    web_context, enrichment_sources, actual_level = await get_pre_analysis_context(
                        video_title=video_info["title"],
                        video_channel=video_info.get("channel", ""),
                        category=category,
                        transcript=transcript,
                        plan=user_plan,
                        lang=lang
                    )
                except Exception as e:
                    print(f"⚠️ [v2.0] Web enrichment failed: {e}", flush=True)

            # 5. Générer le résumé avec les options de customization
            _task_store[task_id]["progress"] = 55
            _task_store[task_id]["message"] = "🧠 Génération du résumé personnalisé..."

            # Ajuster le prompt selon les options
            summary_instructions = []
            if options.get("summary_length") == "short":
                summary_instructions.append("Fais un résumé COURT et CONCIS (max 500 mots).")
            elif options.get("summary_length") == "detailed":
                summary_instructions.append("Fais un résumé DÉTAILLÉ et EXHAUSTIF (1500+ mots).")

            if options.get("highlight_key_points"):
                summary_instructions.append("Mets en évidence les points clés avec des marqueurs **gras**.")

            if options.get("generate_toc"):
                summary_instructions.append("Commence par une table des matières structurée.")

            # Customization utilisateur
            custom = options.get("custom", {})
            if custom.get("focus_topics"):
                summary_instructions.append(f"Concentre-toi sur ces sujets: {', '.join(custom['focus_topics'])}")
            if custom.get("exclude_topics"):
                summary_instructions.append(f"Évite ces sujets: {', '.join(custom['exclude_topics'])}")
            if custom.get("tone") == "formal":
                summary_instructions.append("Utilise un ton formel et académique.")
            elif custom.get("tone") == "casual":
                summary_instructions.append("Utilise un ton accessible et décontracté.")

            custom_context = "\n".join(summary_instructions) if summary_instructions else None

            # Combiner web_context et custom_context
            full_context = None
            if web_context and custom_context:
                full_context = f"{web_context}\n\n--- Instructions personnalisées ---\n{custom_context}"
            elif web_context:
                full_context = web_context
            elif custom_context:
                full_context = custom_context

            # Détecter si chunking nécessaire
            transcript_to_analyze = transcript_timestamped or transcript
            video_duration = video_info.get("duration", 0)
            needs_chunk, word_count, chunk_reason = needs_chunking(transcript_to_analyze)

            if needs_chunk:
                _task_store[task_id]["message"] = f"📚 Vidéo longue ({word_count} mots)..."

                def update_progress(progress: int, message: str):
                    _task_store[task_id]["progress"] = progress
                    _task_store[task_id]["message"] = message

                summary_content = await analyze_long_video(
                    title=video_info["title"],
                    transcript=transcript_to_analyze,
                    video_duration=video_duration,
                    category=category,
                    lang=lang,
                    mode=mode,
                    model=model,
                    web_context=full_context,
                    progress_callback=update_progress,
                    transcript_timestamped=transcript_timestamped
                )
            else:
                summary_content = await generate_summary(
                    title=video_info["title"],
                    transcript=transcript_to_analyze,
                    category=category,
                    lang=lang,
                    mode=mode,
                    model=model,
                    duration=video_duration,
                    channel=video_info.get("channel", ""),
                    description=video_info.get("description", ""),
                    web_context=full_context,
                    video_id=video_id,
                    force_refresh=force_refresh,
                    target_length=options.get("summary_length", "standard"),
                )

            if not summary_content:
                raise Exception("Failed to generate summary")

            # 6. Extraire les entités (si demandé)
            entities = None
            if options.get("include_entities", True):
                _task_store[task_id]["progress"] = 75
                _task_store[task_id]["message"] = "🔍 Extraction des entités..."
                entities = await extract_entities(summary_content, lang=lang)

            # 7. Calculer la fiabilité (si demandé)
            reliability = None
            if options.get("include_reliability", True):
                _task_store[task_id]["progress"] = 85
                _task_store[task_id]["message"] = "⚖️ Calcul du score de fiabilité..."
                reliability = await calculate_reliability_score(summary_content, entities or {}, lang=lang)

                if enrichment_sources:
                    reliability_bonus = {
                        EnrichmentLevel.FULL: 8,
                        EnrichmentLevel.DEEP: 15
                    }.get(enrichment_level, 0)
                    reliability = min(98, reliability + reliability_bonus)

            # 8. Consommer les crédits et sauvegarder
            _task_store[task_id]["progress"] = 92
            _task_store[task_id]["message"] = "💾 Sauvegarde des résultats..."

            if SECURITY_AVAILABLE:
                await consume_reserved_credits(
                    session, user_id, task_id,
                    f"Video v2: {video_info['title'][:50]} ({model})"
                )
            else:
                await deduct_credit(session, user_id, credit_cost, f"Video v2: {video_info['title'][:50]}")

            enrichment_metadata = None
            if enrichment_sources:
                enrichment_metadata = {
                    "level": enrichment_level.value,
                    "sources": enrichment_sources,
                    "enriched_at": datetime.utcnow().isoformat(),
                    "v2_options": options
                }

            # Thumbnail dynamique selon la plateforme
            if platform == "tiktok":
                default_thumbnail = video_info.get("thumbnail_url", "")
            else:
                default_thumbnail = video_info.get("thumbnail_url", f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg")

            summary_id = await save_summary(
                session=session,
                user_id=user_id,
                video_id=video_id,
                video_title=video_info["title"],
                video_channel=video_info.get("channel", "Unknown"),
                video_duration=video_info.get("duration", 0),
                video_url=url,
                thumbnail_url=default_thumbnail,
                category=category,
                category_confidence=confidence,
                lang=lang,
                mode=mode,
                model_used=model,
                summary_content=summary_content,
                transcript_context=transcript_timestamped or transcript,
                video_upload_date=video_info.get("upload_date"),
                entities_extracted=entities,
                reliability_score=reliability,
                enrichment_data=enrichment_metadata,
                platform=platform
            )

            # Incrémenter le quota quotidien
            try:
                from core.plan_limits import increment_daily_usage
                await increment_daily_usage(session, user_id)
            except Exception as quota_err:
                print(f"⚠️ [v2] Quota increment failed: {quota_err}", flush=True)

            # 9. Marquer comme terminé
            final_word_count = len(summary_content.split())
            enrichment_badge = get_enrichment_badge(enrichment_level, lang)

            _task_store[task_id] = {
                "status": "completed",
                "progress": 100,
                "message": f"✅ Analyse v2 terminée {enrichment_badge}".strip(),
                "user_id": user_id,
                "result": {
                    "summary_id": summary_id,
                    "video_id": video_id,
                    "video_title": video_info["title"],
                    "word_count": final_word_count,
                    "category": category,
                    "reliability_score": reliability,
                    "v2_options_applied": options,
                    "enrichment": {
                        "level": enrichment_level.value,
                        "sources_count": len(enrichment_sources),
                    } if enrichment_level != EnrichmentLevel.NONE else None
                }
            }

            await update_task_status(
                session, task_id,
                status="completed",
                progress=100,
                result=_task_store[task_id]["result"]
            )

            # Notification SSE
            try:
                await notify_analysis_complete(
                    user_id=user_id,
                    summary_id=summary_id,
                    video_title=video_info["title"],
                    video_id=video_id,
                    cached=False
                )
            except Exception as notify_err:
                print(f"⚠️ [v2] Notification failed: {notify_err}", flush=True)

            # Webhook (si configuré)
            webhook_url = options.get("webhook_url")
            if webhook_url:
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            webhook_url,
                            json={
                                "event": "analysis_complete",
                                "task_id": task_id,
                                "summary_id": summary_id,
                                "video_id": video_id,
                                "status": "completed"
                            },
                            timeout=10.0
                        )
                    print(f"🔔 [v2] Webhook sent to {webhook_url}", flush=True)
                except Exception as webhook_err:
                    print(f"⚠️ [v2] Webhook failed: {webhook_err}", flush=True)

            print(f"✅ [v2.0] Task completed: {task_id}", flush=True)

    except Exception as e:
        error_msg = str(e)
        print(f"❌ [v2] Analysis error for task {task_id}: {error_msg}", flush=True)

        if SECURITY_AVAILABLE:
            await release_reserved_credits(user_id, task_id)

        _task_store[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": f"Error: {error_msg}",
            "user_id": user_id,
            "error": error_msg
        }

        try:
            await notify_analysis_failed(
                user_id=user_id,
                video_title=video_info.get("title", "Vidéo") if 'video_info' in dir() else "Vidéo",
                error=error_msg[:200]
            )
        except Exception:
            pass

        try:
            async with async_session_maker() as session:
                await update_task_status(session, task_id, status="failed", progress=0, error=error_msg)
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════════════════════
# 🆕 ANALYSE V2.1 — Customization AVANCÉE avec anti-AI, commentaires, etc.
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze/v2.1")
async def analyze_video_v2_1(
    request: AnalyzeRequestV2 if ADVANCED_ANALYSIS_AVAILABLE else AnalyzeVideoV2Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(check_daily_limit),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 v2.1: Analyse vidéo avec TOUTES les options de personnalisation avancées.

    Fonctionnalités exclusives v2.1:
    - 🔒 Anti-détection IA (humanisation du texte)
    - 🎨 Styles d'écriture (académique, journalistique, conversationnel...)
    - 💬 Analyse des commentaires YouTube
    - 📊 Métadonnées enrichies (sponsorship, propagande, figures publiques)
    - 🎯 Analyse de l'intention de publication
    - ✍️ Prompts personnalisés

    SÉCURITÉ:
    - Email vérifié obligatoire
    - Pro/Expert requis pour certaines fonctionnalités
    - Rate limiting appliqué
    """
    print(f"📥 [v2.1] Advanced analyze request: {request.url} by user {current_user.id}", flush=True)

    if not ADVANCED_ANALYSIS_AVAILABLE:
        raise HTTPException(status_code=501, detail={
            "code": "feature_unavailable",
            "message": "Advanced analysis features are not available"
        })

    # 🎵 Détecter la plateforme (YouTube ou TikTok)
    platform = detect_platform(request.url)

    if platform == "tiktok":
        video_id = extract_tiktok_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={
                "code": "invalid_url",
                "message": "Invalid TikTok URL"
            })
        print(f"🎵 [TIKTOK] Detected TikTok video: {video_id}", flush=True)
    else:
        video_id = extract_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={
                "code": "invalid_url",
                "message": "Invalid YouTube URL"
            })

    # Déterminer le modèle
    plan_limits = PLAN_LIMITS.get(current_user.plan, PLAN_LIMITS["free"])
    model = request.model or plan_limits.get("default_model", "mistral-small-latest")

    # Vérifier que le modèle est autorisé
    allowed_models = plan_limits.get("models", ["mistral-small-latest"])
    if model not in allowed_models:
        model = allowed_models[0]

    # Options de customization — merge top-level fields du frontend v4
    # Mapping frontend writing_style → backend WritingStyle enum
    _FRONTEND_STYLE_MAP = {
        "default": "neutral",
        "human": "conversational",
        "academic": "academic",
        "casual": "conversational",
        "humorous": "creative",
        "soft": "pedagogical",
    }

    if request.customization:
        customization = AnalysisCustomization(**request.customization)
    else:
        # Construire depuis les champs top-level envoyés par le frontend
        custom_kwargs: dict = {}
        if request.user_prompt:
            custom_kwargs["user_prompt"] = request.user_prompt
        if request.anti_ai_detection:
            custom_kwargs["anti_ai_detection"] = request.anti_ai_detection
        if request.writing_style:
            mapped_style = _FRONTEND_STYLE_MAP.get(request.writing_style, request.writing_style)
            try:
                custom_kwargs["writing_style"] = WritingStyle(mapped_style)
            except ValueError:
                pass  # Style inconnu, garder le défaut
        customization = AnalysisCustomization(**custom_kwargs)

    # Vérifier les permissions pour fonctionnalités avancées
    is_premium = current_user.plan in ["pro", "expert", "unlimited"]
    
    # Anti-AI detection: Pro/Expert only
    if customization.anti_ai_detection and not is_premium:
        customization.anti_ai_detection = False
        print(f"⚠️ [v2.1] Anti-AI disabled (requires Pro/Expert)", flush=True)
    
    # Analyse des commentaires: Pro/Expert only
    if customization.analyze_comments and not is_premium:
        customization.analyze_comments = False
        print(f"⚠️ [v2.1] Comments analysis disabled (requires Pro/Expert)", flush=True)
    
    # Analyse de propagande: Expert only
    if customization.detect_propaganda and current_user.plan not in ["expert", "unlimited"]:
        customization.detect_propaganda = False
        print(f"⚠️ [v2.1] Propaganda analysis disabled (requires Expert)", flush=True)
    
    # Analyse d'intention: Pro/Expert only
    if customization.analyze_publication_intent and not is_premium:
        customization.analyze_publication_intent = False

    # Deep research
    deep_research = request.deep_research and plan_limits.get("deep_research_enabled", False)
    deep_research_cost = plan_limits.get("deep_research_credits_cost", 0) if deep_research else 0

    # Calculer le coût de base
    if SECURITY_AVAILABLE:
        credit_cost = get_credit_cost("video_analysis", model)
    else:
        credit_cost = 1
    credit_cost += deep_research_cost

    # Coûts supplémentaires pour options avancées
    if request.generate_toc:
        credit_cost += 1
    if request.summary_length == "detailed":
        credit_cost += 1
    if customization.analyze_comments:
        credit_cost += 2  # Analyse des commentaires coûte 2 crédits
    if customization.anti_ai_detection and customization.humanize_level >= 2:
        credit_cost += 1  # Humanisation forte coûte 1 crédit
    if customization.detect_propaganda:
        credit_cost += 1  # Analyse de propagande coûte 1 crédit

    # Vérifier les crédits
    if SECURITY_AVAILABLE:
        can_analyze, reason, info = await secure_check_can_analyze(
            session, current_user.id, model
        )
    else:
        can_analyze, reason, credits_remaining, estimated_cost = await check_can_analyze(session, current_user.id)
        info = {"credits": credits_remaining, "cost": estimated_cost}

    if not can_analyze:
        raise HTTPException(status_code=403, detail={
            "code": reason,
            "message": info.get("message", f"Cannot analyze: {reason}"),
            "credits": info.get("credits", 0),
            "cost": credit_cost,
            **info
        })

    # Vérifier le cache (sauf si force_refresh)
    if not request.force_refresh:
        existing = await get_summary_by_video_id(session, video_id, current_user.id)
        if existing and existing.mode == request.mode:
            from datetime import timedelta
            cache_age = datetime.now() - existing.created_at
            if cache_age < timedelta(days=7):
                print(f"💾 [CACHE HIT] v2.1: summary_id={existing.id}", flush=True)
                return {
                    "task_id": f"cached_{existing.id}",
                    "status": "completed",
                    "progress": 100,
                    "message": "✅ Analyse retrouvée en cache (gratuit!)",
                    "cost": 0,
                    "video_info": {
                        "video_id": existing.video_id,
                        "title": existing.video_title,
                        "channel": existing.video_channel,
                    },
                    "applied_customization": None,
                    "comments_analysis": None
                }

    # Générer l'ID de tâche
    if SECURITY_AVAILABLE:
        task_id = generate_secure_operation_id(current_user.id, "video_analysis_v2.1")
    else:
        task_id = str(uuid4())

    # Réserver les crédits
    if SECURITY_AVAILABLE:
        reserved, reserve_reason, reserve_info = await reserve_credits(
            session, current_user.id, credit_cost, task_id, "video_analysis_v2.1"
        )
        if not reserved:
            raise HTTPException(status_code=403, detail={
                "code": reserve_reason,
                "message": f"Could not reserve credits: {reserve_reason}",
                **reserve_info
            })
        print(f"🔒 [v2.1] Credits reserved: {credit_cost} for task {task_id[:12]}", flush=True)

    # Préparer les options complètes
    full_options = {
        "summary_length": request.summary_length,  # v2.1 uses summary_length directly
        "highlight_key_points": request.highlight_key_points,
        "generate_toc": request.generate_toc,
        "include_entities": request.include_entities,
        "include_timestamps": request.include_timestamps,
        "include_reliability": request.include_reliability,
        "priority": request.priority if is_premium else "normal",
        "webhook_url": request.webhook_url,
        # v2.1 specific options
        "customization": {
            "user_prompt": customization.user_prompt,
            "writing_style": customization.writing_style.value if customization.writing_style else "neutral",
            "anti_ai_detection": customization.anti_ai_detection,
            "humanize_level": customization.humanize_level,
            "focus_topics": customization.focus_topics,
            "exclude_topics": customization.exclude_topics,
            "target_audience": customization.target_audience,
            "expertise_level": customization.expertise_level,
            "include_quotes": customization.include_quotes,
            "include_statistics": customization.include_statistics,
            "bullet_points_preferred": customization.bullet_points_preferred,
            "analyze_comments": customization.analyze_comments,
            "comments_limit": customization.comments_limit,
            "detect_sponsorship": customization.detect_sponsorship,
            "detect_propaganda": customization.detect_propaganda,
            "extract_public_figures": customization.extract_public_figures,
            "analyze_publication_intent": customization.analyze_publication_intent
        }
    }

    # Stocker la tâche
    _task_store[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Initializing v2.1 advanced analysis...",
        "user_id": current_user.id,
        "video_id": video_id,
        "credit_cost": credit_cost,
        "deep_research": deep_research,
        "v2_1_options": full_options
    }

    print(f"🚀 [v2.1] Task created: {task_id} with advanced options", flush=True)

    # Créer en DB
    await create_task(session, task_id, current_user.id, "video_analysis_v2.1")

    # Estimer la durée
    estimated_duration = 45  # Base
    if request.summary_length == "detailed":
        estimated_duration += 20
    if deep_research:
        estimated_duration += 30
    if customization.analyze_comments:
        estimated_duration += 20
    if customization.detect_propaganda:
        estimated_duration += 10

    # Lancer l'analyse en background
    background_tasks.add_task(
        _analyze_video_background_v2_1,
        task_id=task_id,
        video_id=video_id,
        url=request.url,
        mode=request.mode,
        category=request.category,
        lang=request.lang,
        model=model,
        user_id=current_user.id,
        user_plan=current_user.plan,
        credit_cost=credit_cost,
        deep_research=deep_research,
        options=full_options,
        force_refresh=request.force_refresh,
        platform=platform  # 🎵 TikTok support
    )

    return {
        "task_id": task_id,
        "status": "pending",
        "progress": 0,
        "message": "Analysis v2.1 started with advanced customization",
        "estimated_duration_seconds": estimated_duration,
        "cost": credit_cost,
        "applied_customization": full_options.get("customization"),
        "comments_analysis": None
    }


async def _analyze_video_background_v2_1(
    task_id: str,
    video_id: str,
    url: str,
    mode: str,
    category: Optional[str],
    lang: str,
    model: str,
    user_id: int,
    user_plan: str,
    credit_cost: int,
    deep_research: bool,
    options: Dict[str, Any],
    force_refresh: bool = False,
    platform: str = "youtube"
):
    """
    🆕 v2.1: Background analysis avec TOUTES les fonctionnalités avancées.

    Nouvelles fonctionnalités:
    - 🔒 Anti-détection IA avec humanisation
    - 🎨 Styles d'écriture personnalisés
    - 💬 Analyse des commentaires YouTube
    - 📊 Métadonnées enrichies
    - 🎯 Analyse d'intention de publication
    """
    from db.database import async_session_maker
    import httpx

    print(f"🔧 [v2.1] Advanced background task started: {task_id}", flush=True)

    # Extraire les options de customization
    custom_opts = options.get("customization", {})
    
    # Déterminer le niveau d'enrichissement
    if deep_research:
        enrichment_level = EnrichmentLevel.DEEP
    else:
        enrichment_level = get_enrichment_level(user_plan)

    # Variables pour les résultats
    comments_analysis_result = None
    metadata_enriched_result = None
    video_info = None

    try:
        async with async_session_maker() as session:
            _task_store[task_id]["status"] = "processing"
            _task_store[task_id]["progress"] = 3
            _task_store[task_id]["message"] = "🚀 Démarrage de l'analyse avancée v2.1..."

            # ═══════════════════════════════════════════════════════════════════
            # 1. RÉCUPÉRER LES INFOS VIDÉO
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 8
            _task_store[task_id]["message"] = "📺 Récupération des infos vidéo..."

            if platform == "tiktok":
                video_info = await get_tiktok_video_info(url)
            else:
                video_info = await get_video_info(video_id)
            if not video_info:
                raise Exception("Could not fetch video info")

            # ═══════════════════════════════════════════════════════════════════
            # 2. EXTRAIRE LA TRANSCRIPTION
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 15
            _task_store[task_id]["message"] = "📝 Extraction du transcript..."

            if platform == "tiktok":
                transcript, transcript_timestamped, detected_lang = await get_tiktok_transcript(url, video_id)
            else:
                transcript, transcript_timestamped, detected_lang = await get_transcript_with_timestamps(video_id)
            if not transcript:
                raise Exception("No transcript available for this video")

            if not lang or lang == "auto":
                lang = detected_lang or "fr"

            # ═══════════════════════════════════════════════════════════════════
            # 3. DÉTECTER LA CATÉGORIE
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 22
            _task_store[task_id]["message"] = "🏷️ Détection de la catégorie..."

            if not category or category == "auto":
                category, confidence = detect_category(
                    title=video_info["title"],
                    description=video_info.get("description", ""),
                    transcript=transcript[:3000],
                    channel=video_info.get("channel", ""),
                    tags=video_info.get("tags", []),
                    youtube_categories=video_info.get("categories", [])
                )
            else:
                confidence = 0.9

            # ═══════════════════════════════════════════════════════════════════
            # 4. 🆕 ANALYSE DES COMMENTAIRES (si activée)
            # ═══════════════════════════════════════════════════════════════════
            if custom_opts.get("analyze_comments", False):
                _task_store[task_id]["progress"] = 28
                _task_store[task_id]["message"] = "💬 Analyse des commentaires YouTube..."
                
                try:
                    comments_limit = custom_opts.get("comments_limit", 100)
                    comments_analysis_result = await analyze_comments(
                        video_id=video_id,
                        limit=comments_limit,
                        use_ai=True,
                        video_title=video_info["title"],
                        lang=lang,
                        model=model
                    )
                    print(f"✅ [v2.1] Comments analysis: {comments_analysis_result.analyzed_count} comments", flush=True)
                except Exception as e:
                    print(f"⚠️ [v2.1] Comments analysis failed: {e}", flush=True)

            # ═══════════════════════════════════════════════════════════════════
            # 5. 🆕 MÉTADONNÉES ENRICHIES
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 35
            _task_store[task_id]["message"] = "📊 Extraction des métadonnées enrichies..."
            
            try:
                metadata_enriched_result = await get_enriched_metadata(
                    video_id=video_id,
                    title=video_info["title"],
                    description=video_info.get("description", ""),
                    transcript=transcript[:5000],
                    channel=video_info.get("channel", ""),
                    tags=video_info.get("tags", []),
                    category=category,
                    analyze_propaganda=custom_opts.get("detect_propaganda", False),
                    analyze_intent=custom_opts.get("analyze_publication_intent", False),
                    extract_figures=custom_opts.get("extract_public_figures", True),
                    lang=lang
                )
                print(f"✅ [v2.1] Metadata enriched: sponsorship={metadata_enriched_result.sponsorship.type.value}", flush=True)
            except Exception as e:
                print(f"⚠️ [v2.1] Metadata enrichment failed: {e}", flush=True)

            # ═══════════════════════════════════════════════════════════════════
            # 6. ENRICHISSEMENT WEB
            # ═══════════════════════════════════════════════════════════════════
            web_context = None
            enrichment_sources = []

            if enrichment_level != EnrichmentLevel.NONE:
                _task_store[task_id]["progress"] = 42
                _task_store[task_id]["message"] = f"🌐 Recherche web ({enrichment_level.value})..."

                try:
                    web_context, enrichment_sources, actual_level = await get_pre_analysis_context(
                        video_title=video_info["title"],
                        video_channel=video_info.get("channel", ""),
                        category=category,
                        transcript=transcript,
                        plan=user_plan,
                        lang=lang
                    )
                except Exception as e:
                    print(f"⚠️ [v2.1] Web enrichment failed: {e}", flush=True)

            # ═══════════════════════════════════════════════════════════════════
            # 7. 🆕 CONSTRUIRE LE PROMPT PERSONNALISÉ
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 50
            _task_store[task_id]["message"] = "🧠 Construction du prompt personnalisé..."

            # Instructions de base selon les options
            base_instructions = []
            
            if options.get("summary_length") == "short":
                base_instructions.append("Fais un résumé COURT et CONCIS (max 500 mots).")
            elif options.get("summary_length") == "detailed":
                base_instructions.append("Fais un résumé DÉTAILLÉ et EXHAUSTIF (1500+ mots).")

            if options.get("highlight_key_points"):
                base_instructions.append("Mets en évidence les points clés avec des marqueurs **gras**.")

            if options.get("generate_toc"):
                base_instructions.append("Commence par une table des matières structurée.")

            if custom_opts.get("include_quotes", True):
                base_instructions.append("Inclus des citations directes pertinentes de la vidéo.")

            if custom_opts.get("include_statistics", True):
                base_instructions.append("Mentionne les statistiques et chiffres importants.")

            if custom_opts.get("bullet_points_preferred", False):
                base_instructions.append("Utilise des listes à puces quand c'est pertinent.")

            base_prompt = "\n".join(base_instructions) if base_instructions else ""

            # Utiliser le module anti_ai_prompts pour construire le prompt complet
            writing_style = WritingStyle(custom_opts.get("writing_style", "neutral"))
            
            customized_prompt = build_customized_prompt(
                base_prompt=base_prompt,
                writing_style=writing_style,
                anti_ai_detection=custom_opts.get("anti_ai_detection", False),
                humanize_level=custom_opts.get("humanize_level", 0),
                user_prompt=custom_opts.get("user_prompt"),
                target_audience=custom_opts.get("target_audience"),
                focus_topics=custom_opts.get("focus_topics", []),
                exclude_topics=custom_opts.get("exclude_topics", []),
                lang=lang
            )

            # Combiner avec le contexte web
            full_context = None
            if web_context and customized_prompt:
                full_context = f"{web_context}\n\n{customized_prompt}"
            elif web_context:
                full_context = web_context
            elif customized_prompt:
                full_context = customized_prompt

            # ═══════════════════════════════════════════════════════════════════
            # 8. GÉNÉRER LE RÉSUMÉ
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 58
            _task_store[task_id]["message"] = "🧠 Génération du résumé personnalisé..."

            transcript_to_analyze = transcript_timestamped or transcript
            video_duration = video_info.get("duration", 0)
            needs_chunk, word_count, chunk_reason = needs_chunking(transcript_to_analyze)

            if needs_chunk:
                _task_store[task_id]["message"] = f"📚 Vidéo longue ({word_count} mots)..."

                def update_progress(progress: int, message: str):
                    _task_store[task_id]["progress"] = progress
                    _task_store[task_id]["message"] = message

                summary_content = await analyze_long_video(
                    title=video_info["title"],
                    transcript=transcript_to_analyze,
                    video_duration=video_duration,
                    category=category,
                    lang=lang,
                    mode=mode,
                    model=model,
                    web_context=full_context,
                    progress_callback=update_progress,
                    transcript_timestamped=transcript_timestamped
                )
            else:
                summary_content = await generate_summary(
                    title=video_info["title"],
                    transcript=transcript_to_analyze,
                    category=category,
                    lang=lang,
                    mode=mode,
                    model=model,
                    duration=video_duration,
                    channel=video_info.get("channel", ""),
                    description=video_info.get("description", ""),
                    web_context=full_context,
                    video_id=video_id,
                    force_refresh=force_refresh,
                    target_length=options.get("summary_length", "standard"),
                )

            if not summary_content:
                raise Exception("Failed to generate summary")

            # ═══════════════════════════════════════════════════════════════════
            # 9. EXTRAIRE LES ENTITÉS
            # ═══════════════════════════════════════════════════════════════════
            entities = None
            if options.get("include_entities", True):
                _task_store[task_id]["progress"] = 75
                _task_store[task_id]["message"] = "🔍 Extraction des entités..."
                entities = await extract_entities(summary_content, lang=lang)

            # ═══════════════════════════════════════════════════════════════════
            # 10. CALCULER LA FIABILITÉ
            # ═══════════════════════════════════════════════════════════════════
            reliability = None
            if options.get("include_reliability", True):
                _task_store[task_id]["progress"] = 82
                _task_store[task_id]["message"] = "⚖️ Calcul du score de fiabilité..."
                reliability = await calculate_reliability_score(summary_content, entities or {}, lang=lang)

                # Bonus si enrichi avec web
                if enrichment_sources:
                    reliability_bonus = {
                        EnrichmentLevel.FULL: 8,
                        EnrichmentLevel.DEEP: 15
                    }.get(enrichment_level, 0)
                    reliability = min(98, reliability + reliability_bonus)

                # Malus si propagande détectée
                if metadata_enriched_result and metadata_enriched_result.propaganda_analysis:
                    prop = metadata_enriched_result.propaganda_analysis
                    if prop.risk_level.value in ["high", "critical"]:
                        reliability = max(20, reliability - 20)
                    elif prop.risk_level.value == "medium":
                        reliability = max(30, reliability - 10)

            # ═══════════════════════════════════════════════════════════════════
            # 11. SAUVEGARDER
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 90
            _task_store[task_id]["message"] = "💾 Sauvegarde des résultats..."

            if SECURITY_AVAILABLE:
                await consume_reserved_credits(
                    session, user_id, task_id,
                    f"Video v2.1: {video_info['title'][:50]} ({model})"
                )
            else:
                await deduct_credit(session, user_id, credit_cost, f"Video v2.1: {video_info['title'][:50]}")

            # Préparer les métadonnées d'enrichissement
            enrichment_metadata = {
                "level": enrichment_level.value,
                "sources": enrichment_sources,
                "enriched_at": datetime.utcnow().isoformat(),
                "v2_1_options": options,
                "comments_analyzed": comments_analysis_result.analyzed_count if comments_analysis_result else 0,
                "sponsorship_detected": metadata_enriched_result.sponsorship.type.value if metadata_enriched_result else None,
                "propaganda_risk": metadata_enriched_result.propaganda_analysis.risk_level.value if metadata_enriched_result and metadata_enriched_result.propaganda_analysis else None
            }

            # Thumbnail dynamique selon la plateforme
            if platform == "tiktok":
                default_thumbnail = video_info.get("thumbnail_url", "")
            else:
                default_thumbnail = video_info.get("thumbnail_url", f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg")

            summary_id = await save_summary(
                session=session,
                user_id=user_id,
                video_id=video_id,
                video_title=video_info["title"],
                video_channel=video_info.get("channel", "Unknown"),
                video_duration=video_info.get("duration", 0),
                video_url=url,
                thumbnail_url=default_thumbnail,
                category=category,
                category_confidence=confidence,
                lang=lang,
                mode=mode,
                model_used=model,
                summary_content=summary_content,
                transcript_context=transcript_timestamped or transcript,
                video_upload_date=video_info.get("upload_date"),
                entities_extracted=entities,
                reliability_score=reliability,
                enrichment_data=enrichment_metadata,
                platform=platform
            )

            # Incrémenter le quota
            try:
                from core.plan_limits import increment_daily_usage
                await increment_daily_usage(session, user_id)
            except Exception as quota_err:
                print(f"⚠️ [v2.1] Quota increment failed: {quota_err}", flush=True)

            # ═══════════════════════════════════════════════════════════════════
            # 12. MARQUER COMME TERMINÉ
            # ═══════════════════════════════════════════════════════════════════
            final_word_count = len(summary_content.split())
            enrichment_badge = get_enrichment_badge(enrichment_level, lang)

            # Préparer le résultat des commentaires
            comments_result = None
            if comments_analysis_result:
                comments_result = {
                    "analyzed_count": comments_analysis_result.analyzed_count,
                    "sentiment_distribution": comments_analysis_result.sentiment_distribution,
                    "average_sentiment": comments_analysis_result.average_sentiment,
                    "constructive_ratio": comments_analysis_result.constructive_ratio,
                    "controversy_score": comments_analysis_result.controversy_score,
                    "top_questions": comments_analysis_result.top_questions,
                    "summary": comments_analysis_result.summary
                }

            # Préparer les métadonnées enrichies
            metadata_result = None
            if metadata_enriched_result:
                metadata_result = {
                    "public_figures": [
                        {"name": f.name, "role": f.role, "organization": f.organization}
                        for f in metadata_enriched_result.public_figures[:10]
                    ],
                    "sponsorship": {
                        "type": metadata_enriched_result.sponsorship.type.value,
                        "brands": metadata_enriched_result.sponsorship.brands,
                        "disclosed": metadata_enriched_result.sponsorship.disclosed
                    },
                    "propaganda_analysis": {
                        "risk_level": metadata_enriched_result.propaganda_analysis.risk_level.value,
                        "techniques": metadata_enriched_result.propaganda_analysis.detected_techniques,
                        "recommendation": metadata_enriched_result.propaganda_analysis.recommendation
                    } if metadata_enriched_result.propaganda_analysis else None,
                    "publication_intent": {
                        "primary": metadata_enriched_result.publication_intent.primary_intent,
                        "educational_score": metadata_enriched_result.publication_intent.educational_score,
                        "commercial_score": metadata_enriched_result.publication_intent.commercial_score
                    } if metadata_enriched_result.publication_intent else None
                }

            _task_store[task_id] = {
                "status": "completed",
                "progress": 100,
                "message": f"✅ Analyse v2.1 terminée {enrichment_badge}".strip(),
                "user_id": user_id,
                "result": {
                    "summary_id": summary_id,
                    "video_id": video_id,
                    "video_title": video_info["title"],
                    "word_count": final_word_count,
                    "category": category,
                    "reliability_score": reliability,
                    "v2_1_options_applied": options.get("customization"),
                    "comments_analysis": comments_result,
                    "metadata_enriched": metadata_result,
                    "enrichment": {
                        "level": enrichment_level.value,
                        "sources_count": len(enrichment_sources),
                    } if enrichment_level != EnrichmentLevel.NONE else None
                }
            }

            await update_task_status(
                session, task_id,
                status="completed",
                progress=100,
                result=_task_store[task_id]["result"]
            )

            # Notification SSE
            try:
                await notify_analysis_complete(
                    user_id=user_id,
                    summary_id=summary_id,
                    video_title=video_info["title"],
                    video_id=video_id,
                    cached=False
                )
            except Exception as notify_err:
                print(f"⚠️ [v2.1] Notification failed: {notify_err}", flush=True)

            # Webhook
            webhook_url = options.get("webhook_url")
            if webhook_url:
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            webhook_url,
                            json={
                                "event": "analysis_complete",
                                "task_id": task_id,
                                "summary_id": summary_id,
                                "video_id": video_id,
                                "status": "completed",
                                "version": "v2.1"
                            },
                            timeout=10.0
                        )
                    print(f"🔔 [v2.1] Webhook sent to {webhook_url}", flush=True)
                except Exception as webhook_err:
                    print(f"⚠️ [v2.1] Webhook failed: {webhook_err}", flush=True)

            print(f"✅ [v2.1] Task completed: {task_id}", flush=True)

    except Exception as e:
        error_msg = str(e)
        print(f"❌ [v2.1] Analysis error for task {task_id}: {error_msg}", flush=True)

        if SECURITY_AVAILABLE:
            await release_reserved_credits(user_id, task_id)

        _task_store[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": f"Error: {error_msg}",
            "user_id": user_id,
            "error": error_msg
        }

        try:
            await notify_analysis_failed(
                user_id=user_id,
                video_title=video_info.get("title", "Vidéo") if video_info else "Vidéo",
                error=error_msg[:200]
            )
        except Exception:
            pass

        try:
            async with async_session_maker() as session:
                await update_task_status(session, task_id, status="failed", progress=0, error=error_msg)
        except Exception:
            pass


async def _analyze_video_background_v6(
    task_id: str,
    video_id: str,
    url: str,
    mode: str,
    category: Optional[str],
    lang: str,
    model: str,
    user_id: int,
    user_plan: str,
    credit_cost: int,
    deep_research: bool = False,  # 🆕 v5.5
    platform: str = "youtube"  # 🎵 TikTok support
):
    """
    🔐 Fonction d'analyse v6.0 avec SÉCURITÉ RENFORCÉE.
    
    SÉCURITÉ:
    - Crédits réservés AVANT (dans l'endpoint)
    - Crédits consommés uniquement si SUCCÈS
    - Crédits libérés si ÉCHEC
    
    📊 Étapes:
    1. Récupérer les infos vidéo
    2. Extraire la transcription
    3. Détecter la catégorie
    4. Enrichir le contexte avec Perplexity (Pro/Expert)
    5. Générer le résumé (Mistral)
    6. Extraire les entités
    7. Calculer le score de fiabilité
    8. ✅ Consommer les crédits
    9. Sauvegarder
    """
    from db.database import async_session_maker
    
    print(f"🔧 [v6.0] Background task started: {task_id} (deep_research={deep_research}, platform={platform})", flush=True)
    
    # 🆕 v5.5: Si deep_research activé, utiliser enrichissement maximal
    if deep_research:
        enrichment_level = EnrichmentLevel.DEEP
        print(f"🔬 [v5.5] Deep research enabled - using DEEP enrichment", flush=True)
    else:
        # Déterminer le niveau d'enrichissement selon le plan
        enrichment_level = get_enrichment_level(user_plan)
    print(f"🌐 [v6.0] Enrichment level: {enrichment_level.value} for plan {user_plan}", flush=True)
    
    try:
        async with async_session_maker() as session:
            # Update status
            _task_store[task_id]["status"] = "processing"
            _task_store[task_id]["progress"] = 5
            _task_store[task_id]["message"] = "🚀 Démarrage de l'analyse..."
            
            # ═══════════════════════════════════════════════════════════════════
            # 1. RÉCUPÉRER LES INFOS VIDÉO
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 10
            _task_store[task_id]["message"] = "📺 Récupération des infos vidéo..."
            
            print(f"📺 Fetching video info for {video_id} (platform={platform})...", flush=True)
            if platform == "tiktok":
                video_info = await get_tiktok_video_info(url)
            else:
                video_info = await get_video_info(video_id)
            if not video_info:
                raise Exception("Could not fetch video info")
            
            print(f"✅ Video info: {video_info.get('title', 'Unknown')[:50]}", flush=True)
            
            # ═══════════════════════════════════════════════════════════════════
            # 2. EXTRAIRE LA TRANSCRIPTION
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 20
            _task_store[task_id]["message"] = "📝 Extraction du transcript..."
            
            if platform == "tiktok":
                transcript, transcript_timestamped, detected_lang = await get_tiktok_transcript(url, video_id)
            else:
                transcript, transcript_timestamped, detected_lang = await get_transcript_with_timestamps(video_id)

            if not transcript:
                raise Exception("No transcript available for this video")
            
            print(f"✅ Transcript: {len(transcript)} chars", flush=True)
            
            # Utiliser la langue détectée si pas spécifiée
            if not lang or lang == "auto":
                lang = detected_lang or "fr"
            
            # ═══════════════════════════════════════════════════════════════════
            # 3. DÉTECTER LA CATÉGORIE (🆕 v3.0: avec métadonnées enrichies)
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 30
            _task_store[task_id]["message"] = "🏷️ Détection de la catégorie..."
            
            if not category or category == "auto":
                # 🆕 v3.0: Passer TOUTES les métadonnées pour une meilleure détection
                category, confidence = detect_category(
                    title=video_info["title"],
                    description=video_info.get("description", ""),
                    transcript=transcript[:3000],
                    channel=video_info.get("channel", ""),
                    tags=video_info.get("tags", []),
                    youtube_categories=video_info.get("categories", [])
                )
                print(f"🏷️ Auto-detected category: {category} ({confidence:.0%})", flush=True)
            else:
                confidence = 0.9
            
            # ═══════════════════════════════════════════════════════════════════
            # 4. 🆕 ENRICHIR LE CONTEXTE AVEC PERPLEXITY (AVANT Mistral)
            # ═══════════════════════════════════════════════════════════════════
            web_context = None
            enrichment_sources = []
            
            if enrichment_level != EnrichmentLevel.NONE:
                _task_store[task_id]["progress"] = 40
                _task_store[task_id]["message"] = f"🌐 Recherche web préliminaire ({enrichment_level.value})..."
                
                print(f"🌐 [v5.0] PRE-ANALYSIS: Fetching web context from Perplexity...", flush=True)
                
                try:
                    web_context, enrichment_sources, actual_level = await get_pre_analysis_context(
                        video_title=video_info["title"],
                        video_channel=video_info.get("channel", ""),
                        category=category,
                        transcript=transcript,
                        plan=user_plan,
                        lang=lang
                    )
                    
                    if web_context:
                        print(f"✅ [v5.0] PRE-ANALYSIS: Got {len(web_context)} chars of web context", flush=True)
                        print(f"✅ [v5.0] PRE-ANALYSIS: {len(enrichment_sources)} sources found", flush=True)
                    else:
                        print(f"⚠️ [v5.0] PRE-ANALYSIS: No web context returned", flush=True)
                        
                except Exception as e:
                    print(f"⚠️ [v5.0] PRE-ANALYSIS failed (continuing without): {e}", flush=True)
                    web_context = None
                    enrichment_sources = []
            else:
                print(f"⏭️ [v5.0] Skipping web enrichment (plan={user_plan})", flush=True)
            
            # ═══════════════════════════════════════════════════════════════════
            # 5. GÉNÉRER LE RÉSUMÉ (MISTRAL) AVEC CONTEXTE WEB
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 55
            
            # Déterminer le modèle selon le plan
            plan_limits = PLAN_LIMITS.get(user_plan, PLAN_LIMITS["free"])
            if not model:
                model = plan_limits.get("default_model", "mistral-small-latest")
            
            # Vérifier que le modèle est autorisé
            allowed_models = plan_limits.get("models", ["mistral-small-latest"])
            if model not in allowed_models:
                model = allowed_models[0]
            
            # 🆕 v7.0: DÉTECTION VIDÉO LONGUE ET CHUNKING
            transcript_to_analyze = transcript_timestamped or transcript
            video_duration = video_info.get("duration", 0)
            
            needs_chunk, word_count, chunk_reason = needs_chunking(transcript_to_analyze)
            
            if needs_chunk:
                # ════════════════════════════════════════════════════════════
                # 📚 VIDÉO LONGUE — Analyse par chunks
                # ════════════════════════════════════════════════════════════
                print(f"📚 [v7.0] LONG VIDEO DETECTED: {word_count} words ({chunk_reason})", flush=True)
                _task_store[task_id]["message"] = f"📚 Vidéo longue détectée ({word_count} mots)..."
                
                # Fonction de callback pour le progress
                def update_progress(progress: int, message: str):
                    _task_store[task_id]["progress"] = progress
                    _task_store[task_id]["message"] = message
                
                # 🆕 v3.0: Analyser avec les VRAIS timestamps YouTube
                summary_content = await analyze_long_video(
                    title=video_info["title"],
                    transcript=transcript_to_analyze,
                    video_duration=video_duration,
                    category=category,
                    lang=lang,
                    mode=mode,
                    model=model,
                    web_context=web_context,
                    progress_callback=update_progress,
                    transcript_timestamped=transcript_timestamped  # 🆕 Vrais timestamps!
                )
                
                if not summary_content:
                    print("⚠️ [v7.0] Chunking failed, falling back to truncated analysis", flush=True)
                    # Fallback: analyser seulement les premiers 8000 mots
                    truncated_transcript = " ".join(transcript_to_analyze.split()[:8000])
                    summary_content = await generate_summary(
                        title=video_info["title"],
                        transcript=truncated_transcript,
                        category=category,
                        lang=lang,
                        mode=mode,
                        model=model,
                        duration=video_duration,
                        channel=video_info.get("channel", ""),
                        description=video_info.get("description", "") + "\n\n⚠️ NOTE: Cette vidéo est très longue. Seule la première partie a été analysée.",
                        web_context=web_context,
                        video_id=video_id,
                    )
            else:
                # ════════════════════════════════════════════════════════════
                # 📝 VIDÉO STANDARD — Analyse directe
                # ════════════════════════════════════════════════════════════
                if web_context:
                    _task_store[task_id]["message"] = "🧠 Génération du résumé enrichi avec l'IA..."
                else:
                    _task_store[task_id]["message"] = "🧠 Génération du résumé avec l'IA..."

                print(f"🧠 Generating summary with {model}...", flush=True)
                if web_context:
                    print(f"🌐 [v5.0] Including {len(web_context)} chars of web context in Mistral prompt", flush=True)

                summary_content = await generate_summary(
                    title=video_info["title"],
                    transcript=transcript_to_analyze,
                    category=category,
                    lang=lang,
                    mode=mode,
                    model=model,
                    duration=video_duration,
                    channel=video_info.get("channel", ""),
                    description=video_info.get("description", ""),
                    web_context=web_context,
                    video_id=video_id,
                )

            if not summary_content:
                raise Exception("Failed to generate summary")
            
            final_word_count = len(summary_content.split())
            print(f"✅ Summary generated: {final_word_count} words", flush=True)
            
            # ═══════════════════════════════════════════════════════════════════
            # 6. EXTRAIRE LES ENTITÉS
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 75
            _task_store[task_id]["message"] = "🔍 Extraction des entités..."
            
            entities = await extract_entities(summary_content, lang=lang)
            
            # ═══════════════════════════════════════════════════════════════════
            # 7. CALCULER LE SCORE DE FIABILITÉ
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 85
            _task_store[task_id]["message"] = "⚖️ Calcul du score de fiabilité..."
            
            reliability = await calculate_reliability_score(summary_content, entities, lang=lang)
            
            # Bonus de fiabilité si enrichi avec Perplexity (PRÉ-ANALYSE)
            if enrichment_sources:
                reliability_bonus = {
                    EnrichmentLevel.FULL: 8,   # Pro: +8
                    EnrichmentLevel.DEEP: 15   # Expert: +15
                }.get(enrichment_level, 0)
                reliability = min(98, reliability + reliability_bonus)
                print(f"🎯 [v5.0] Reliability boosted by {reliability_bonus} (web-enriched analysis)", flush=True)
            
            # ═══════════════════════════════════════════════════════════════════
            # 8. SAUVEGARDER LE RÉSUMÉ
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 92
            _task_store[task_id]["message"] = "💾 Sauvegarde des résultats..."
            
            # 🔐 CONSOMMER les crédits réservés (succès de l'opération)
            if SECURITY_AVAILABLE:
                await consume_reserved_credits(
                    session, user_id, task_id,
                    f"Video: {video_info['title'][:50]} ({model})"
                )
            else:
                await deduct_credit(session, user_id, credit_cost, f"Video: {video_info['title'][:50]}")
            
            # Préparer les métadonnées d'enrichissement
            enrichment_metadata = None
            if enrichment_sources:
                enrichment_metadata = {
                    "level": enrichment_level.value,
                    "sources": enrichment_sources,
                    "enriched_at": datetime.utcnow().isoformat()
                }

            # 🎵 Thumbnail par défaut selon la plateforme
            default_thumbnail = video_info.get("thumbnail_url", "")
            if not default_thumbnail and platform == "youtube":
                default_thumbnail = f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"

            # Sauvegarder le résumé
            summary_id = await save_summary(
                session=session,
                user_id=user_id,
                video_id=video_id,
                video_title=video_info["title"],
                video_channel=video_info.get("channel", "Unknown"),
                video_duration=video_info.get("duration", 0),
                video_url=url,
                thumbnail_url=default_thumbnail,
                category=category,
                category_confidence=confidence,
                lang=lang,
                mode=mode,
                model_used=model,
                summary_content=summary_content,
                transcript_context=transcript_timestamped or transcript,
                video_upload_date=video_info.get("upload_date"),
                entities_extracted=entities,
                reliability_score=reliability,
                # 🆕 Métadonnées d'enrichissement
                enrichment_data=enrichment_metadata,
                platform=platform,
            )
            
            print(f"💾 Summary saved: id={summary_id}", flush=True)

            # 🎫 Incrémenter le compteur quotidien d'analyses
            try:
                from core.plan_limits import increment_daily_usage
                daily_count = await increment_daily_usage(session, user_id)
                print(f"📊 [QUOTA] User {user_id} daily usage: {daily_count}", flush=True)
            except Exception as quota_err:
                print(f"⚠️ [QUOTA] Failed to increment daily usage: {quota_err}", flush=True)

            # ═══════════════════════════════════════════════════════════════════
            # 9. MARQUER COMME TERMINÉ
            # ═══════════════════════════════════════════════════════════════════
            enrichment_badge = get_enrichment_badge(enrichment_level, lang)
            
            _task_store[task_id] = {
                "status": "completed",
                "progress": 100,
                "message": f"✅ Analyse terminée {enrichment_badge}".strip(),
                "user_id": user_id,
                "result": {
                    "summary_id": summary_id,
                    "video_id": video_id,
                    "video_title": video_info["title"],
                    "video_channel": video_info.get("channel", "Unknown"),
                    "thumbnail_url": default_thumbnail,
                    "word_count": final_word_count,
                    "category": category,
                    "reliability_score": reliability,
                    "mode": mode,
                    "lang": lang,
                    "platform": platform,  # 🎵 TikTok support
                    # 🆕 Infos enrichissement
                    "enrichment": {
                        "level": enrichment_level.value,
                        "sources_count": len(enrichment_sources),
                        "badge": enrichment_badge
                    } if enrichment_level != EnrichmentLevel.NONE else None
                }
            }
            
            await update_task_status(
                session, task_id,
                status="completed",
                progress=100,
                result=_task_store[task_id]["result"]
            )
            
            print(f"✅ [v6.0] Task completed: {task_id}", flush=True)
            if enrichment_level != EnrichmentLevel.NONE:
                print(f"   └─ Enrichment: {enrichment_level.value}, {len(enrichment_sources)} sources", flush=True)
            
            # 🔔 NOTIFICATION PUSH — Alerter l'utilisateur que l'analyse est prête
            try:
                await notify_analysis_complete(
                    user_id=user_id,
                    summary_id=summary_id,
                    video_title=video_info["title"],
                    video_id=video_id,
                    cached=False
                )
                print(f"🔔 [NOTIFY] Analysis complete notification sent to user {user_id}", flush=True)
            except Exception as notify_err:
                print(f"⚠️ [NOTIFY] Failed to send notification: {notify_err}", flush=True)
            
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Analysis error for task {task_id}: {error_msg}", flush=True)
        
        # 🔐 LIBÉRER les crédits réservés (échec de l'opération)
        if SECURITY_AVAILABLE:
            await release_reserved_credits(user_id, task_id)
            print(f"🔓 [SECURITY] Credits released due to failure: task={task_id[:12]}", flush=True)
        
        _task_store[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": f"Error: {error_msg}",
            "user_id": user_id,
            "error": error_msg
        }
        
        # 🔔 NOTIFICATION PUSH — Alerter l'utilisateur de l'échec
        try:
            video_title_for_notif = video_info.get("title", "Vidéo") if 'video_info' in dir() else "Vidéo"
            await notify_analysis_failed(
                user_id=user_id,
                video_title=video_title_for_notif,
                error=error_msg[:200]
            )
            print(f"🔔 [NOTIFY] Analysis failure notification sent to user {user_id}", flush=True)
        except Exception as notify_err:
            print(f"⚠️ [NOTIFY] Failed to send failure notification: {notify_err}", flush=True)
        
        try:
            async with async_session_maker() as session:
                await update_task_status(
                    session, task_id,
                    status="failed",
                    progress=0,
                    error=error_msg
                )
        except:
            pass


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 STATUS & POLLING
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Récupère le status d'une tâche d'analyse"""

    # Gérer les task_id de cache (format: cached_<summary_id>)
    if task_id.startswith("cached_"):
        try:
            summary_id = int(task_id.replace("cached_", ""))
            summary = await get_summary_by_id(session, summary_id, current_user.id)
            if summary:
                return TaskStatusResponse(
                    task_id=task_id,
                    status="completed",
                    progress=100,
                    message="✅ Analyse retrouvée en cache (gratuit!)",
                    result={
                        "summary_id": summary.id,
                        "cached": True,
                        "video_title": summary.video_title,
                        "category": summary.category,
                        "cost": 0,
                    }
                )
        except (ValueError, Exception):
            pass
        raise HTTPException(status_code=404, detail="Task not found")

    # Vérifier le cache mémoire d'abord
    if task_id in _task_store:
        task = _task_store[task_id]
        
        # Vérifier que c'est bien la tâche de cet utilisateur
        if task.get("user_id") != current_user.id:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return TaskStatusResponse(
            task_id=task_id,
            status=task.get("status", "unknown"),
            progress=task.get("progress", 0),
            message=task.get("message", ""),
            result=task.get("result"),
            error=task.get("error")
        )
    
    # Sinon chercher en DB
    task_db = await get_task(session, task_id)
    if not task_db or task_db.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    
    result = None
    if task_db.result:
        try:
            result = json.loads(task_db.result) if isinstance(task_db.result, str) else task_db.result
        except:
            pass
    
    return TaskStatusResponse(
        task_id=task_id,
        status=task_db.status,
        progress=task_db.progress,
        message="",
        result=result,
        error=task_db.error_message
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 RÉSUMÉS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/summary/{summary_id}")
async def get_summary(
    summary_id: int,
    format: Optional[str] = Query(default=None, description="Format de réponse: full (défaut) ou extension"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère un résumé par son ID.

    Query params:
        format: "full" (défaut) retourne l'analyse complète,
                "extension" retourne un JSON condensé pour l'extension Chrome.
    """
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    # Format condensé pour l'extension Chrome
    if format == "extension":
        return extract_extension_summary(
            summary_id=summary.id,
            summary_content=summary.summary_content,
            video_title=summary.video_title,
            category=summary.category,
            reliability_score=summary.reliability_score,
            tags=summary.tags,
        )

    # Format complet (défaut)
    entities = None
    if summary.entities_extracted:
        try:
            entities = json.loads(summary.entities_extracted) if isinstance(summary.entities_extracted, str) else summary.entities_extracted
        except:
            pass

    return SummaryResponse(
        id=summary.id,
        video_id=summary.video_id,
        video_title=summary.video_title,
        video_channel=summary.video_channel or "Unknown",
        video_duration=summary.video_duration or 0,
        video_url=summary.video_url or f"https://youtube.com/watch?v={summary.video_id}",
        thumbnail_url=summary.thumbnail_url or f"https://img.youtube.com/vi/{summary.video_id}/mqdefault.jpg",
        category=summary.category,
        category_confidence=summary.category_confidence,
        lang=summary.lang,
        mode=summary.mode,
        model_used=summary.model_used,
        summary_content=summary.summary_content,
        word_count=summary.word_count or len(summary.summary_content.split()),
        reliability_score=summary.reliability_score,
        is_favorite=summary.is_favorite,
        notes=summary.notes,
        tags=summary.tags,
        entities=entities,
        transcript_context=summary.transcript_context,
        created_at=summary.created_at.isoformat() if summary.created_at else None
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 CONCEPTS & DÉFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/concepts/{summary_id}")
async def get_summary_concepts(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    📚 Extrait les concepts [[terme]] d'un résumé et retourne leurs définitions.
    Utilise Perplexity pour générer des définitions courtes.
    """
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    # Extraire et définir les concepts
    try:
        result = await get_concepts_with_definitions(
            text=summary.summary_content,
            context=summary.video_title or "",
            language=summary.lang or "fr"
        )
        
        print(f"📚 [Concepts] Got {result['count']} concepts for summary {summary_id}")
        
        return {
            "summary_id": summary_id,
            "video_title": summary.video_title,
            "concepts": result["concepts"],
            "count": result["count"]
        }
        
    except Exception as e:
        print(f"❌ [Concepts] Error: {e}")
        # Fallback: extraire les termes sans définitions
        concepts = extract_concepts(summary.summary_content)
        return {
            "summary_id": summary_id,
            "video_title": summary.video_title,
            "concepts": [
                {
                    "term": c,
                    "definition": "",
                    "category": "other"
                }
                for c in concepts
            ],
            "count": len(concepts)
        }


@router.get("/concepts/{summary_id}/enriched")
async def get_enriched_concepts(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    📚 Extrait les concepts [[terme]] et retourne des définitions ENRICHIES.
    
    Combine Mistral (catégorisation rapide) + Perplexity (définitions web).
    
    Fonctionnalités:
    - Définitions contextuelles précises
    - Catégorisation intelligente (person, company, technology, etc.)
    - Sources web quand disponibles
    - Pertinence dans le contexte de la vidéo
    
    Plans:
    - Free/Starter: Définitions Mistral uniquement
    - Pro/Expert: Définitions enrichies Perplexity + sources
    """
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    if not summary.summary_content:
        return {
            "summary_id": summary_id,
            "video_title": summary.video_title,
            "concepts": [],
            "count": 0,
            "provider": "none"
        }
    
    # Extraire les termes [[marqués]]
    terms = extract_terms_from_text(summary.summary_content)
    
    if not terms:
        return {
            "summary_id": summary_id,
            "video_title": summary.video_title,
            "concepts": [],
            "count": 0,
            "provider": "none"
        }
    
    # Déterminer si on utilise Perplexity (Pro/Expert seulement)
    use_perplexity = current_user.plan in ["pro", "expert", "unlimited"]
    
    try:
        # Obtenir les définitions enrichies
        definitions = await get_enriched_definitions(
            terms=terms,
            context=summary.video_title or "",
            language=summary.lang or "fr",
            use_perplexity=use_perplexity
        )
        
        # Convertir en format JSON
        concepts_list = []
        for defn in definitions:
            cat_info = get_category_info(defn.category, summary.lang or "fr")
            concepts_list.append({
                "term": defn.term,
                "definition": defn.definition,
                "category": defn.category,
                "category_label": cat_info["label"],
                "category_icon": cat_info["icon"],
                "context_relevance": defn.context_relevance,
                "sources": defn.sources,
                "confidence": defn.confidence,
                "provider": defn.provider
            })
        
        provider = "perplexity+mistral" if use_perplexity else "mistral"
        print(f"📚 [Enriched] Got {len(concepts_list)} enriched definitions for summary {summary_id} ({provider})")
        
        return {
            "summary_id": summary_id,
            "video_title": summary.video_title,
            "concepts": concepts_list,
            "count": len(concepts_list),
            "provider": provider,
            "categories": {
                cat_id: {
                    "label": cat_data.get(summary.lang or "fr", cat_data.get("fr")),
                    "icon": cat_data.get("icon"),
                    "count": sum(1 for c in concepts_list if c["category"] == cat_id)
                }
                for cat_id, cat_data in CATEGORIES.items()
            }
        }
        
    except Exception as e:
        print(f"❌ [Enriched] Error: {e}")
        # Fallback: termes sans définitions
        return {
            "summary_id": summary_id,
            "video_title": summary.video_title,
            "concepts": [
                {
                    "term": t,
                    "definition": "",
                    "category": "other",
                    "category_label": "Autres",
                    "category_icon": "📌",
                    "context_relevance": "",
                    "sources": [],
                    "confidence": 0,
                    "provider": "none"
                }
                for t in terms
            ],
            "count": len(terms),
            "provider": "fallback"
        }


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    platform: Optional[str] = Query(None, description="Filtrer par plateforme: youtube, tiktok"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Récupère l'historique des résumés de l'utilisateur"""
    items, total = await get_user_history(
        session=session,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        category=category,
        search=search,
        favorites_only=favorites_only
    )

    # 🎵 Filtrage par plateforme côté Python (pas de modification SQL requise)
    if platform and platform in ("youtube", "tiktok"):
        items = [item for item in items if getattr(item, "platform", "youtube") == platform]
        total = len(items)

    def _get_thumbnail(item) -> str:
        """Retourne le thumbnail adapté à la plateforme."""
        if item.thumbnail_url:
            return item.thumbnail_url
        item_platform = getattr(item, "platform", "youtube")
        if item_platform == "youtube":
            return f"https://img.youtube.com/vi/{item.video_id}/mqdefault.jpg"
        return ""  # TikTok thumbnails viennent du backend lors de l'analyse

    return HistoryResponse(
        items=[
            SummaryListItem(
                id=item.id,
                video_id=item.video_id,
                video_title=item.video_title,
                video_channel=item.video_channel or "Unknown",
                video_duration=item.video_duration or 0,
                thumbnail_url=_get_thumbnail(item),
                category=item.category,
                mode=item.mode,
                word_count=item.word_count or 0,
                reliability_score=item.reliability_score,
                is_favorite=item.is_favorite,
                created_at=item.created_at.isoformat() if item.created_at else None,
                platform=getattr(item, "platform", "youtube"),
            )
            for item in items
        ],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if per_page > 0 else 0
    )


@router.post("/summary/{summary_id}/favorite")
async def toggle_favorite(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Toggle le statut favori d'un résumé"""
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    new_status = not summary.is_favorite
    await update_summary(session, summary_id, current_user.id, is_favorite=new_status)
    
    return {"is_favorite": new_status}


@router.put("/summary/{summary_id}/notes")
async def update_notes(
    summary_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Met à jour les notes d'un résumé"""
    from core.sanitize import sanitize_text

    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    # 🛡️ Sanitize user input
    notes = sanitize_text(data.get("notes", ""), max_length=10000)
    await update_summary(session, summary_id, current_user.id, notes=notes)
    return {"success": True}


@router.put("/summary/{summary_id}/tags")
async def update_tags(
    summary_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Met à jour les tags d'un résumé"""
    from core.sanitize import sanitize_text

    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    # 🛡️ Sanitize user input
    tags = sanitize_text(data.get("tags", ""), max_length=500)
    await update_summary(session, summary_id, current_user.id, tags=tags)
    return {"success": True}


@router.delete("/summary/{summary_id}")
async def remove_summary(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Supprime un résumé"""
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    await delete_summary(session, summary_id, current_user.id)
    return {"success": True}


@router.delete("/history")
async def clear_history(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Efface tout l'historique de l'utilisateur"""
    count = await delete_all_history(session, current_user.id)
    return {"success": True, "deleted": count}


# ═══════════════════════════════════════════════════════════════════════════════
# 📂 CATÉGORIES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/categories", response_model=CategoryResponse)
async def get_categories():
    """Liste toutes les catégories disponibles"""
    return CategoryResponse(
        categories=[
            {"id": cat_id, "name": cat_info["fr"], "icon": cat_info.get("icon", "📋")}
            for cat_id, cat_info in CATEGORIES.items()
        ]
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 STATISTIQUES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Récupère les statistiques de l'utilisateur"""
    stats = await get_user_stats(session, current_user.id)
    return stats


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 OUTILS D'ÉTUDE — Fiches de révision & Arbres pédagogiques
# ═══════════════════════════════════════════════════════════════════════════════

from .study_tools import generate_study_card, generate_concept_map, generate_study_materials

@router.post("/study/{summary_id}/card")
async def create_study_card(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🎓 Génère une fiche de révision pour une vidéo analysée.
    
    Inclut:
    - Points clés classés par importance
    - Définitions des termes techniques
    - Questions/Réponses de compréhension
    - Quiz QCM avec corrections
    - Conseils d'apprentissage
    """
    
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Résumé non trouvé")
    
    # Vérifier les crédits (1 crédit pour une fiche)
    if current_user.credits < 1:
        raise HTTPException(status_code=402, detail="Crédits insuffisants")
    
    # Déduire 1 crédit
    await deduct_credit(session, current_user.id, 1, "study_card")
    
    # Générer la fiche
    try:
        study_card = await generate_study_card(
            title=summary.video_title or "Vidéo",
            channel=summary.video_channel or "Chaîne inconnue",
            summary=summary.summary_content or "",
            transcript=summary.transcript_context or "",
            lang=summary.lang or "fr",
            model="mistral-small-latest"
        )
        
        return {
            "success": True,
            "summary_id": summary_id,
            "study_card": study_card
        }
        
    except Exception as e:
        print(f"❌ [STUDY_CARD] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


@router.post("/study/{summary_id}/mindmap")
async def create_concept_map(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🌳 Génère un arbre pédagogique (mindmap) au format Mermaid.
    
    Inclut:
    - Code Mermaid prêt à afficher
    - Liste des concepts avec relations
    - Parcours d'apprentissage suggéré
    """
    
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Résumé non trouvé")
    
    # Vérifier les crédits (1 crédit pour un mindmap)
    if current_user.credits < 1:
        raise HTTPException(status_code=402, detail="Crédits insuffisants")
    
    # Déduire 1 crédit
    await deduct_credit(session, current_user.id, 1, "concept_map")
    
    # Générer le mindmap
    try:
        concept_map = await generate_concept_map(
            title=summary.video_title or "Vidéo",
            channel=summary.video_channel or "Chaîne inconnue",
            summary=summary.summary_content or "",
            lang=summary.lang or "fr",
            model="mistral-small-latest"
        )
        
        return {
            "success": True,
            "summary_id": summary_id,
            "concept_map": concept_map
        }
        
    except Exception as e:
        print(f"❌ [CONCEPT_MAP] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


@router.post("/study/{summary_id}/all")
async def create_all_study_materials(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    📚 Génère tous les outils d'étude en une fois.
    
    Inclut:
    - Fiche de révision complète
    - Arbre pédagogique (mindmap)
    
    Coût: 2 crédits
    """
    
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Résumé non trouvé")
    
    # Vérifier les crédits (2 crédits pour tout)
    if current_user.credits < 2:
        raise HTTPException(status_code=402, detail="Crédits insuffisants (2 requis)")
    
    # Déduire 2 crédits
    await deduct_credit(session, current_user.id, 2, "study_all")
    
    # Générer tout
    try:
        materials = await generate_study_materials(
            title=summary.video_title or "Vidéo",
            channel=summary.video_channel or "Chaîne inconnue",
            summary=summary.summary_content or "",
            transcript=summary.transcript_context or "",
            lang=summary.lang or "fr",
            model="mistral-small-latest",
            include_card=True,
            include_map=True
        )
        
        return {
            "success": True,
            "summary_id": summary_id,
            "materials": materials
        }
        
    except Exception as e:
        print(f"❌ [STUDY_ALL] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 INTELLIGENT DISCOVERY — Recherche intelligente de vidéos
# ═══════════════════════════════════════════════════════════════════════════════

from .intelligent_discovery import (
    IntelligentDiscoveryService, 
    generate_text_video_id, 
    validate_raw_text
)
from .schemas import (
    SmartDiscoveryRequest, DiscoveryResponse, VideoCandidateResponse,
    HybridAnalyzeRequest, HybridAnalysisResponse, InputType,
    CreditEstimation, RawTextAnalysisResponse
)


@router.post("/discover", response_model=DiscoveryResponse)
async def discover_videos(
    request: SmartDiscoveryRequest,
    current_user: User = Depends(get_current_user),
):
    """
    🔍 Découverte intelligente de vidéos YouTube.
    
    GRATUIT - Ne consomme pas de crédits.
    Recherche les meilleures vidéos avec scoring multi-critères:
    - Score Tournesol (éthique et qualité)
    - Score académique (sources, références)
    - Engagement (likes/vues)
    - Fraîcheur (date de publication)
    - Pénalité clickbait
    
    La découverte est GRATUITE, seule l'analyse coûte des crédits.
    """
    import time
    start = time.time()
    
    print(f"🔍 [DISCOVER] User {current_user.email} searching: {request.query}", flush=True)
    
    try:
        result = await IntelligentDiscoveryService.discover(
            query=request.query,
            languages=request.languages,
            max_results=request.max_results,
            min_quality=request.min_quality,
            target_duration=request.target_duration,
        )
        
        # Convertir en response
        candidates = [
            VideoCandidateResponse(**c.to_dict())
            for c in result.candidates
        ]
        
        duration_ms = int((time.time() - start) * 1000)
        print(f"✅ [DISCOVER] Found {len(candidates)} candidates in {duration_ms}ms", flush=True)
        
        return DiscoveryResponse(
            query=result.query,
            reformulated_queries=result.reformulated_queries,
            candidates=candidates,
            total_searched=result.total_searched,
            languages_searched=result.languages_searched,
            search_duration_ms=result.search_duration_ms,
            tournesol_available=result.tournesol_available,
        )
        
    except Exception as e:
        print(f"❌ [DISCOVER] Error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur de recherche: {str(e)}")


@router.post("/discover/best", response_model=VideoCandidateResponse)
async def discover_best_video(
    query: str = Query(..., description="Requête de recherche"),
    languages: str = Query("fr,en", description="Langues séparées par virgule"),
    current_user: User = Depends(get_current_user),
):
    """
    🏆 Trouve LA meilleure vidéo pour une requête.
    
    GRATUIT - Ne consomme pas de crédits.
    Retourne directement le meilleur candidat.
    """
    print(f"🏆 [DISCOVER/BEST] User {current_user.email} searching: {query}", flush=True)
    
    lang_list = [l.strip() for l in languages.split(",")]
    
    try:
        result = await IntelligentDiscoveryService.discover_single_best(
            query=query,
            languages=lang_list,
        )
        
        if not result:
            raise HTTPException(
                status_code=404, 
                detail="Aucune vidéo de qualité trouvée pour cette recherche"
            )
        
        return VideoCandidateResponse(**result.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [DISCOVER/BEST] Error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@router.post("/discover/search")
async def discover_search_videos(
    query: str = Query(..., description="Requête de recherche"),
    languages: str = Query("fr,en", description="Langues séparées par virgule"),
    limit: int = Query(15, ge=1, le=50, description="Nombre max de résultats"),
    sort_by: str = Query("quality", description="Tri: quality, views, date, academic"),
    current_user: User = Depends(get_current_user),
):
    """
    🔍 Recherche de vidéos pour le mobile — retourne une liste triée.

    GRATUIT - Ne consomme pas de crédits.
    Retourne toujours { videos: [...], total: N, query: str }, jamais de 404.
    """
    print(f"🔍 [DISCOVER/SEARCH] User {current_user.email} query='{query}' sort={sort_by} limit={limit}", flush=True)

    lang_list = [l.strip() for l in languages.split(",")]

    try:
        result = await IntelligentDiscoveryService.discover(
            query=query,
            languages=lang_list,
            max_results=limit,
            min_quality=15.0,
        )

        # Convert candidates to dicts
        videos = []
        for c in result.candidates:
            d = c.to_dict()
            videos.append({
                "video_id": d.get("video_id", ""),
                "title": d.get("title", ""),
                "channel": d.get("channel", ""),
                "thumbnail_url": d.get("thumbnail_url", ""),
                "duration": d.get("duration", 0),
                "view_count": d.get("view_count", 0),
                "quality_score": d.get("quality_score", 0),
                "tournesol_score": d.get("tournesol_score", 0),
                "published_at": d.get("published_at"),
                "is_tournesol_pick": d.get("is_tournesol_pick", False),
            })

        # Sort according to sort_by
        if sort_by == "views":
            videos.sort(key=lambda v: v["view_count"], reverse=True)
        elif sort_by == "date":
            videos.sort(key=lambda v: v["published_at"] or "", reverse=True)
        elif sort_by == "academic":
            videos.sort(key=lambda v: v["tournesol_score"], reverse=True)
        else:  # quality (default)
            videos.sort(key=lambda v: v["quality_score"], reverse=True)

        # Limit results
        videos = videos[:limit]

        print(f"✅ [DISCOVER/SEARCH] Returning {len(videos)} videos", flush=True)

        return {
            "videos": videos,
            "total": len(videos),
            "query": query,
        }

    except Exception as e:
        print(f"❌ [DISCOVER/SEARCH] Error: {e}", flush=True)
        # Always return valid JSON, never 404
        return {
            "videos": [],
            "total": 0,
            "query": query,
        }


@router.post("/analyze/hybrid", response_model=HybridAnalysisResponse)
async def analyze_hybrid(
    request: HybridAnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🔀 Analyse hybride unifiée.
    
    Supporte 3 modes d'entrée:
    1. **URL** - Analyse classique d'une vidéo YouTube
    2. **RAW_TEXT** - Analyse de texte brut (comme si c'était une transcription)
    3. **SEARCH** - Découverte intelligente puis sélection
    
    COÛT:
    - Découverte (SEARCH sans auto_select): GRATUIT
    - Analyse (URL, RAW_TEXT, SEARCH avec auto_select): 1+ crédits selon le modèle
    """
    try:
        input_type = request.detect_input_type()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    print(f"🔀 [HYBRID] User {current_user.email} - Type: {input_type.value}", flush=True)
    
    # === MODE URL ===
    if input_type == InputType.URL:
        # Réutiliser le endpoint d'analyse classique
        from .schemas import AnalyzeVideoRequest
        
        analyze_request = AnalyzeVideoRequest(
            url=request.url,
            mode=request.mode,
            category=request.category,
            lang=request.lang,
            model=request.model,
            deep_research=request.deep_research,
        )
        
        result = await analyze_video(
            request=analyze_request,
            background_tasks=background_tasks,
            current_user=current_user,
            session=session
        )
        
        return HybridAnalysisResponse(
            input_type=InputType.URL,
            task_id=result.task_id,
            status=result.status,
            message=result.message,
            result=result.result,
        )
    
    # === MODE RAW_TEXT ===
    elif input_type == InputType.RAW_TEXT:
        # Valider le texte
        is_valid, error = validate_raw_text(request.raw_text)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error)
        
        # Vérifier les crédits
        model = request.model or "mistral-small-latest"
        credit_cost = get_credit_cost(model) if SECURITY_AVAILABLE else 1
        
        if current_user.credits < credit_cost:
            raise HTTPException(
                status_code=402, 
                detail=f"Crédits insuffisants ({current_user.credits}/{credit_cost})"
            )
        
        # Générer un ID unique pour ce texte
        text_id = generate_text_video_id(request.raw_text)
        
        # Créer une tâche avec user_id pour le tracking
        task_id = str(uuid4())
        _task_store[task_id] = {
            "status": "processing",
            "progress": 0,
            "message": "Analyse du texte en cours...",
            "text_id": text_id,
            "user_id": current_user.id,  # 🔧 FIX: Nécessaire pour le status endpoint
        }
        
        # Lancer l'analyse en background
        background_tasks.add_task(
            _analyze_raw_text_background,
            task_id=task_id,
            text=request.raw_text,
            text_id=text_id,
            title=request.text_title or "Texte analysé",
            source=request.text_source or "Import manuel",
            user_id=current_user.id,
            mode=request.mode,
            lang=request.lang,
            model=model,
            category=request.category,
        )
        
        char_count = len(request.raw_text)
        word_count = len(request.raw_text.split())
        
        return HybridAnalysisResponse(
            input_type=InputType.RAW_TEXT,
            task_id=task_id,
            status="processing",
            message=f"Analyse de {word_count} mots en cours...",
        )
    
    # === MODE SEARCH ===
    else:
        # Valider la requête de recherche
        if not request.search_query or not request.search_query.strip():
            raise HTTPException(
                status_code=400,
                detail="search_query est requis pour le mode recherche"
            )

        # Découverte intelligente
        discovery_result = await IntelligentDiscoveryService.discover(
            query=request.search_query.strip(),
            languages=request.search_languages,
            max_results=10 if not request.auto_select_best else 1,
            min_quality=25.0,
        )
        
        candidates = [
            VideoCandidateResponse(**c.to_dict())
            for c in discovery_result.candidates
        ]
        
        discovery_response = DiscoveryResponse(
            query=discovery_result.query,
            reformulated_queries=discovery_result.reformulated_queries,
            candidates=candidates,
            total_searched=discovery_result.total_searched,
            languages_searched=discovery_result.languages_searched,
            search_duration_ms=discovery_result.search_duration_ms,
            tournesol_available=discovery_result.tournesol_available,
        )
        
        # Si auto_select, lancer l'analyse du meilleur
        if request.auto_select_best and candidates:
            best = candidates[0]
            
            analyze_request = AnalyzeVideoRequest(
                url=f"https://youtube.com/watch?v={best.video_id}",
                mode=request.mode,
                category=request.category,
                lang=request.lang,
                model=request.model,
                deep_research=request.deep_research,
            )
            
            result = await analyze_video(
                request=analyze_request,
                background_tasks=background_tasks,
                current_user=current_user,
                session=session
            )
            
            return HybridAnalysisResponse(
                input_type=InputType.SEARCH,
                task_id=result.task_id,
                status=result.status,
                message=f"Analyse de '{best.title}' en cours...",
                discovery=discovery_response,
                selected_video=best,
            )
        
        # Sinon, retourner les candidats pour sélection manuelle
        return HybridAnalysisResponse(
            input_type=InputType.SEARCH,
            status="discovery_complete",
            message=f"{len(candidates)} vidéos trouvées",
            discovery=discovery_response,
        )


@router.post("/estimate-credits", response_model=CreditEstimation)
async def estimate_credits(
    num_videos: int = Query(1, ge=1, le=50),
    model: str = Query("mistral-small-latest"),
    current_user: User = Depends(get_current_user),
):
    """
    💰 Estime le coût en crédits pour une analyse.
    
    Utile avant de lancer une analyse multiple ou playlist.
    """
    # Multiplicateur selon le modèle
    multipliers = {
        "mistral-small-latest": 1.0,
        "mistral-medium-latest": 2.0,
        "mistral-large-latest": 3.0,
    }
    
    multiplier = multipliers.get(model, 1.0)
    base_cost = num_videos
    total_cost = int(math.ceil(base_cost * multiplier))
    sufficient = current_user.credits >= total_cost
    
    return CreditEstimation(
        base_cost=base_cost,
        model_multiplier=multiplier,
        total_cost=total_cost,
        user_credits=current_user.credits,
        sufficient=sufficient,
        message="" if sufficient else f"Il vous manque {total_cost - current_user.credits} crédits"
    )


async def _analyze_raw_text_background(
    task_id: str,
    text: str,
    text_id: str,
    title: str,
    source: str,
    user_id: int,
    mode: str,
    lang: str,
    model: str,
    category: Optional[str] = None,
):
    """
    📝 Analyse un texte brut en background.
    
    Simule une vidéo avec:
    - video_id = txt_XXXX (hash du contenu)
    - video_url = text://txt_XXXX
    - Pas de durée/thumbnail réelles
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from db.database import async_session_maker
    
    print(f"📝 [RAW_TEXT] Starting analysis for {text_id}", flush=True)
    
    try:
        _task_store[task_id]["progress"] = 5
        _task_store[task_id]["message"] = "Détection de catégorie..."
        
        # Détecter la catégorie
        if category and category != "auto":
            detected_category = category
            category_confidence = 1.0
        else:
            detected_category, category_confidence = detect_category(title="", transcript=text[:5000])
        
        _task_store[task_id]["progress"] = 15
        _task_store[task_id]["message"] = "Analyse du contexte et génération du titre..."
        
        # 🎨 v2.0: Générer titre intelligent, thumbnail ET détecter le type de source
        smart_title, thumbnail_url, source_context = await enhance_raw_text(
            text=text,
            provided_title=title,
            category=detected_category,
            lang=lang,
            source_hint=source  # Utiliser la source comme indice
        )
        
        print(f"🎯 [RAW_TEXT] Smart title: {smart_title}", flush=True)
        print(f"📚 [RAW_TEXT] Source type: {source_context.source_type.value}", flush=True)
        if source_context.detected_origin:
            print(f"   Origin: {source_context.detected_origin}", flush=True)
        print(f"🖼️ [RAW_TEXT] Thumbnail: {len(thumbnail_url) if thumbnail_url else 0} chars", flush=True)
        
        _task_store[task_id]["progress"] = 30
        _task_store[task_id]["message"] = "Génération du résumé adapté au contexte..."
        
        # 🆕 Générer les instructions spécifiques au type de source
        source_instructions = get_source_specific_instructions(source_context, lang)
        
        # Générer le résumé avec le contexte source
        word_count = len(text.split())
        summary_content = await generate_summary(
            title=smart_title,
            transcript=text,
            category=detected_category,
            lang=lang,
            mode=mode,
            model=model,
            channel=source or source_context.detected_origin or "",
            web_context=source_instructions if source_instructions else None  # Injecter les instructions
        )
        
        _task_store[task_id]["progress"] = 70
        _task_store[task_id]["message"] = "Extraction des entités..."
        
        # Extraire les entités
        entities = await extract_entities(summary_content or text[:10000], lang=lang)
        
        _task_store[task_id]["progress"] = 85
        _task_store[task_id]["message"] = "Calcul du score de fiabilité..."
        
        # Score de fiabilité
        reliability = await calculate_reliability_score(summary_content or text, entities, lang=lang)
        
        _task_store[task_id]["progress"] = 95
        _task_store[task_id]["message"] = "Sauvegarde..."
        
        # Sauvegarder en base
        async with async_session_maker() as session:
            # Déduire les crédits
            credit_cost = get_credit_cost(model) if SECURITY_AVAILABLE else 1
            await deduct_credit(session, user_id, credit_cost, f"raw_text:{text_id}")
            
            # Sauvegarder le résumé
            summary_id = await save_summary(
                session=session,
                user_id=user_id,
                video_id=text_id,
                video_title=smart_title,  # 🎯 Titre intelligent
                video_channel=source or "Import manuel",
                video_duration=0,  # Pas de durée pour du texte
                video_url=f"text://{text_id}",
                thumbnail_url=thumbnail_url or "",  # 🖼️ Thumbnail Nano Banana 2
                category=detected_category,
                category_confidence=category_confidence,
                lang=lang,
                mode=mode,
                model_used=model,
                summary_content=summary_content,
                entities_extracted=entities,
                reliability_score=reliability,
                transcript_context=text[:50000],
                platform="text",
            )
            
            await session.commit()
        
        _task_store[task_id]["status"] = "completed"
        _task_store[task_id]["progress"] = 100
        _task_store[task_id]["message"] = "Analyse terminée"
        _task_store[task_id]["result"] = {
            "summary_id": summary_id,
            "text_id": text_id,
            "word_count": word_count,
            "category": detected_category,
        }
        
        # Notification SSE
        if NOTIFICATIONS_AVAILABLE:
            await notify_analysis_complete(
                user_id=user_id,
                summary_id=summary_id,
                video_title=title,
                video_id=text_id,
            )
        
        print(f"✅ [RAW_TEXT] Analysis completed: {text_id}", flush=True)
        
    except Exception as e:
        print(f"❌ [RAW_TEXT] Error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        
        _task_store[task_id]["status"] = "failed"
        _task_store[task_id]["error"] = str(e)
        _task_store[task_id]["message"] = f"Erreur: {str(e)}"
        
        if NOTIFICATIONS_AVAILABLE:
            await notify_analysis_failed(
                user_id=user_id,
                video_title=title,
                error=str(e),
            )


# ═══════════════════════════════════════════════════════════════════════════════
# 🕐 FRESHNESS & FACT-CHECK LITE — Disponible pour TOUS les plans
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reliability/{summary_id}")
async def get_content_reliability(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🕐 Analyse la fiabilité d'un contenu : fraîcheur + fact-check LITE.
    
    DISPONIBLE POUR TOUS LES PLANS (Free, Starter, Pro, Expert)
    
    Returns:
        - freshness: Indicateur de fraîcheur de la vidéo
        - fact_check_lite: Analyse heuristique des affirmations
    """
    if not FACTCHECK_LITE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Service de vérification temporairement indisponible"
        )
    
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    # Récupérer la date de publication depuis video_url ou utiliser created_at
    video_date = None
    
    # Essayer d'obtenir la vraie date de publication
    try:
        video_id = extract_video_id(summary.video_url)
        if video_id:
            video_info = await get_video_info(video_id)
            if video_info and video_info.get("publish_date"):
                video_date = video_info["publish_date"]
    except Exception:
        pass
    
    # Fallback sur la date de création de l'analyse
    if not video_date:
        video_date = summary.created_at.isoformat() if summary.created_at else datetime.utcnow().isoformat()
    
    # Analyser la fiabilité
    result = analyze_content_reliability(
        video_date=video_date,
        video_title=summary.video_title or "",
        summary_content=summary.summary_content or "",
        video_description="",  # Pas stocké actuellement
        lang=summary.lang or "fr"
    )
    
    # Ajouter les infos du résumé
    result["summary_id"] = summary_id
    result["video_title"] = summary.video_title
    result["video_channel"] = summary.video_channel
    result["user_plan"] = current_user.plan or "free"
    
    # Indiquer si l'utilisateur peut avoir un fact-check complet
    result["full_factcheck_available"] = current_user.plan in ["pro", "expert", "unlimited"]

    # Push notification for fact-check complete
    try:
        from notifications.router import notify_factcheck_complete
        await notify_factcheck_complete(
            user_id=current_user.id,
            summary_id=summary_id,
            video_title=summary.video_title or "",
            reliability_score=result.get("overall_score"),
        )
    except Exception as e:
        print(f"⚠️ [PUSH] Factcheck notification failed: {e}", flush=True)

    return result


@router.post("/reliability/analyze")
async def analyze_text_reliability(
    text: str = Form(..., description="Texte à analyser"),
    title: str = Form(default="", description="Titre (optionnel)"),
    video_date: str = Form(default="", description="Date de publication (optionnel, ISO format)"),
    lang: str = Form(default="fr", description="Langue"),
    current_user: User = Depends(get_current_user)
):
    """
    🔍 Analyse directe d'un texte sans résumé préalable.
    
    Utile pour analyser du contenu brut ou des extraits.
    """
    if not FACTCHECK_LITE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Service de vérification temporairement indisponible"
        )
    
    # Validation
    if len(text) < 100:
        raise HTTPException(
            status_code=400,
            detail="Texte trop court (minimum 100 caractères)"
        )
    
    if len(text) > 50000:
        text = text[:50000]  # Limiter
    
    # Date par défaut = maintenant (considéré frais)
    if not video_date:
        video_date = datetime.utcnow().isoformat()
    
    result = analyze_content_reliability(
        video_date=video_date,
        video_title=title,
        summary_content=text,
        lang=lang
    )
    
    result["user_plan"] = current_user.plan or "free"
    result["full_factcheck_available"] = current_user.plan in ["pro", "expert", "unlimited"]
    
    return result


@router.get("/freshness/{summary_id}")
async def get_video_freshness(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    📅 Obtient uniquement l'indicateur de fraîcheur d'une vidéo.
    
    Endpoint léger pour afficher rapidement l'alerte de fraîcheur.
    """
    if not FACTCHECK_LITE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Service indisponible")
    
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    # Récupérer la date de publication
    video_date = None
    try:
        video_id = extract_video_id(summary.video_url)
        if video_id:
            video_info = await get_video_info(video_id)
            if video_info and video_info.get("publish_date"):
                video_date = video_info["publish_date"]
    except Exception:
        pass
    
    if not video_date:
        video_date = summary.created_at.isoformat() if summary.created_at else datetime.utcnow().isoformat()
    
    freshness = analyze_freshness(
        video_date=video_date,
        video_title=summary.video_title or "",
        video_description="",
        transcript_excerpt=summary.summary_content[:2000] if summary.summary_content else ""
    )
    
    return {
        "summary_id": summary_id,
        "video_title": summary.video_title,
        **freshness.to_dict()
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 ADMIN — Backfill metadata for cached transcripts
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/admin/backfill-metadata")
async def admin_backfill_metadata(
    limit: int = Query(50, ge=1, le=500),
    platform: Optional[str] = Query(None, pattern="^(youtube|tiktok)$"),
    admin: User = Depends(get_current_admin),
):
    """
    Admin endpoint — backfill metadata for cached transcripts
    that haven't been enriched yet.
    """
    from transcripts.metadata_service import backfill_missing_metadata

    result = await backfill_missing_metadata(limit=limit, platform=platform)
    return {"status": "ok", **result}
