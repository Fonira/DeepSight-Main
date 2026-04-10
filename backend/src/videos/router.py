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
import logging
import math
import httpx
from uuid import uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from db.database import get_session, User, Summary
from auth.dependencies import get_current_user, get_verified_user, require_plan, check_daily_limit, require_feature, get_current_admin
from core.config import PLAN_LIMITS, CATEGORIES, get_mistral_key
from core.http_client import shared_http_client
from core.http_client import shared_http_client

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
    GuestAnalyzeRequest, GuestAnalyzeResponse,
    QuickChatRequest, QuickChatResponse,
    UpgradeQuickChatRequest, UpgradeQuickChatResponse,
    AnalyzeImagesRequest, AnalyzeImagesResponse,
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
    needs_chunking, analyze_long_video, get_chunk_stats,
    LongVideoResult, store_chunks_in_db,
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

# TODO(REDIS-MIGRATION): _task_store and _guest_usage are process-local in-memory stores.
# With 4 Uvicorn workers, each worker has its own copy, meaning:
# - Task status updates from worker A are invisible to worker B.
# - Guest rate limiting (3 analyses/IP/24h) can be bypassed by round-robining across workers.
# Migration plan:
#   1. Replace _task_store with Redis HASH (key: task_id, TTL: 24h).
#   2. Replace _guest_usage with Redis ZSET per IP (trim by time window).
#   3. Use the existing redis_url from core.config / CACHE_CONFIG.
#   4. Wrap all read/write in try/except to fall back gracefully if Redis is unavailable.
# Store en mémoire pour les tâches (en production: Redis)
_task_store: Dict[str, Dict[str, Any]] = {}

# 🆓 Guest demo rate limiting (3 analyses/IP/24h)
_guest_usage: Dict[str, list] = {}  # IP → list of timestamps
MAX_GUEST_ANALYSES = 3
MAX_VIDEO_DURATION_GUEST = 300  # 5 minutes


async def _save_structured_index(
    session: AsyncSession,
    summary_id: int,
    video_duration: int,
    transcript: str,
    transcript_timestamped: Optional[str],
) -> None:
    """
    🆕 v4.0: Génère et sauvegarde l'index structuré (table des matières temporelle).
    Non-bloquant — en cas d'erreur, l'analyse est déjà sauvegardée.
    """
    try:
        from videos.duration_router import categorize_video, build_structured_index, serialize_index
        ts_source = transcript_timestamped or transcript
        profile = categorize_video(video_duration, ts_source, transcript_timestamped)

        if profile.tier.value != "short" and transcript_timestamped:
            index_entries = build_structured_index(
                transcript_timestamped, video_duration, profile.tier
            )
            if index_entries:
                index_json = serialize_index(index_entries)
                from sqlalchemy import update as sql_update
                await session.execute(
                    sql_update(Summary)
                    .where(Summary.id == summary_id)
                    .values(structured_index=index_json)
                )
                await session.commit()
                print(f"📑 [v4.0] Structured index saved: {len(index_entries)} entries for summary_id={summary_id}, tier={profile.tier.value}", flush=True)
            else:
                print(f"📑 [v4.0] No index entries generated for summary_id={summary_id}", flush=True)
        else:
            print(f"📑 [v4.0] No index needed (tier={profile.tier.value}) for summary_id={summary_id}", flush=True)
    except Exception as e:
        print(f"⚠️ [v4.0] Structured index failed (non-blocking): {e}", flush=True)


def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """
    Public accessor for task status from the in-memory _task_store.
    External modules (e.g. api_public/router.py) should import and use this
    function instead of directly importing the private _task_store dict.
    Returns None if the task_id is not found.
    """
    return _task_store.get(task_id)


def set_task_status(task_id: str, data: Dict[str, Any]) -> None:
    """
    Public mutator for task status in the in-memory _task_store.
    External modules should use this instead of directly accessing _task_store.
    """
    _task_store[task_id] = data


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 CHECK CACHE — Public endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/check-cache/{video_id}")
async def check_video_cache(video_id: str):
    """
    Public endpoint — check if a video transcript is cached (L1 Redis or L2 DB).
    Returns cache source and metadata if available.
    """
    # L1: Check Redis first (fastest)
    try:
        from core.cache import cache_service, make_cache_key
        cache_key = make_cache_key("transcript", video_id)
        cached = await cache_service.get(cache_key)
        if cached and isinstance(cached, dict):
            return {
                "cached": True,
                "source": "redis",
                "video_id": video_id,
                "lang": cached.get("lang"),
                "char_count": len(cached.get("simple", "")) if cached.get("simple") else 0,
            }
    except Exception:
        pass

    # L2: Check DB (persistent, with full metadata)
    try:
        from transcripts.cache_db import check_transcript_cached
        result = await check_transcript_cached(video_id)
        if result:
            return {"cached": True, "source": "db", **result}
    except Exception:
        pass

    return {"cached": False, "video_id": video_id}


# ═══════════════════════════════════════════════════════════════════════════════
# 🆓 GUEST DEMO — Analyse express sans authentification
# ═══════════════════════════════════════════════════════════════════════════════


# =========================================================================
# QUICK CHAT - Transcript-only, zero credit, acces direct au chat IA
# =========================================================================

@router.post("/quick-chat", response_model=QuickChatResponse)
async def quick_chat_prepare(
    request: QuickChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Mode Quick Chat - Prepare une video pour le chat IA sans analyse complete.
    Zero credit consomme, temps de reponse ~2-5s.
    """
    import time
    start_time = time.time()
    url = request.url.strip()
    platform = detect_platform(url)
    print(f"[QUICK CHAT] Starting for {platform} URL: {url[:80]}...", flush=True)

    # 1. Detecter plateforme et extraire video_id
    if platform == "tiktok":
        tiktok_id = extract_tiktok_video_id(url)
        if not tiktok_id:
            raise HTTPException(status_code=400, detail="URL TikTok invalide.")
        video_id = tiktok_id
    else:
        video_id = extract_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail="URL YouTube ou TikTok invalide.")

    # 2. Verifier si un Summary existe deja
    existing = await get_summary_by_video_id(session, str(video_id), int(current_user.id))
    if existing:
        print(f"[QUICK CHAT] Existing summary found: id={existing.id}", flush=True)
        return QuickChatResponse(
            summary_id=existing.id,
            video_id=video_id,
            video_title=existing.video_title or "",
            video_channel=existing.video_channel or "",
            video_duration=existing.video_duration or 0,
            thumbnail_url=existing.thumbnail_url or "",
            platform=existing.platform or platform,
            transcript_available=bool(existing.transcript_context),
            word_count=existing.word_count or 0,
            message="Analyse existante trouvee - chat disponible immediatement"
        )

    # 2b. Résoudre les URLs courtes TikTok (vm.tiktok.com → tiktok.com/@user/video/...)
    resolved_url = url
    if platform == "tiktok" and ("vm.tiktok.com" in url or "vt.tiktok.com" in url):
        try:
            async with shared_http_client() as client:
                head_resp = await client.head(url, timeout=8.0)
                if head_resp.status_code in (200, 301, 302) and "tiktok.com" in str(head_resp.url):
                    resolved_url = str(head_resp.url).split("?")[0]  # Drop tracking params
                    print(f"[QUICK CHAT] Resolved short URL → {resolved_url[:80]}", flush=True)
        except Exception as e:
            print(f"[QUICK CHAT] Short URL resolution failed: {e}", flush=True)

    # 3. Recuperer les metadonnees
    try:
        if platform == "tiktok":
            video_info = await get_tiktok_video_info(resolved_url)
            if not video_info:
                raise ValueError("No info")
            thumbnail_url = video_info.get("thumbnail", video_info.get("thumbnail_url", ""))
        else:
            video_info = await get_video_info(video_id)
            thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
    except Exception as e:
        print(f"[QUICK CHAT] Failed to get video info: {e}", flush=True)
        raise HTTPException(status_code=400, detail="Impossible de recuperer les informations de la video.")

    title = str(video_info.get("title", "Video sans titre"))[:255]
    raw_channel = video_info.get("channel", video_info.get("author", ""))
    # Supadata retourne channel comme dict {"username":"...","displayName":"...","avatarUrl":"..."}
    if isinstance(raw_channel, dict):
        channel = (
            raw_channel.get("displayName")
            or raw_channel.get("name")
            or raw_channel.get("username")
            or raw_channel.get("title")
            or "Unknown"
        )
    else:
        channel = str(raw_channel) if raw_channel else ""
    channel = channel[:255]  # Securite VARCHAR(255)
    duration = video_info.get("duration", 0)
    raw_upload_date = video_info.get("upload_date", "")
    upload_date = str(raw_upload_date)[:50] if raw_upload_date else ""

    # 3b. Fallback thumbnail TikTok via oEmbed si manquant
    if platform == "tiktok" and not thumbnail_url:
        try:
            async with shared_http_client() as client:
                oembed_resp = await client.get(
                    "https://www.tiktok.com/oembed",
                    timeout=5.0,
                    params={"url": resolved_url},
                )
                if oembed_resp.status_code == 200:
                    oembed_data = oembed_resp.json()
                    thumbnail_url = oembed_data.get("thumbnail_url", "")
                    # Also grab title/author from oEmbed if still generic
                    if title in ("TikTok Video", "Video sans titre", "", "TikTok"):
                        title = str(oembed_data.get("title", title))[:255]
                    if not channel or channel in ("Unknown", ""):
                        channel = str(oembed_data.get("author_name", channel))[:255]
                    print(f"[QUICK CHAT] oEmbed fallback: thumb={bool(thumbnail_url)}, title={title[:40]}", flush=True)
        except Exception as e:
            print(f"[QUICK CHAT] oEmbed fallback failed: {e}", flush=True)

    # 4. Extraire le transcript
    try:
        if platform == "tiktok" and video_info.get("content_type") == "carousel":
            # 📸 Carousel pipeline for Quick Chat
            from transcripts.carousel import get_carousel_transcript
            carousel_images = video_info.get("carousel_images", [])
            if not carousel_images:
                raise ValueError("Carousel détecté mais aucune image trouvée")
            carousel_result = await get_carousel_transcript(
                images=carousel_images,
                title=title,
                description=video_info.get("description", ""),
                lang=request.lang,
            )
            transcript_text = carousel_result[0] if isinstance(carousel_result, tuple) else carousel_result
        elif platform == "tiktok":
            tiktok_result = await get_tiktok_transcript(resolved_url)
            # get_tiktok_transcript returns (full_text, timestamped_text, lang)
            transcript_text = tiktok_result[0] if isinstance(tiktok_result, tuple) else tiktok_result
        else:
            is_short = "/shorts/" in url or duration <= 90
            transcript_result = await get_transcript_with_timestamps(video_id, is_short=is_short, duration=duration)
            transcript_text = transcript_result[0] if isinstance(transcript_result, tuple) else transcript_result
    except Exception as e:
        print(f"[QUICK CHAT] Failed to get transcript: {e}", flush=True)
        raise HTTPException(status_code=400, detail="Impossible de recuperer la transcription.")

    # Guard: extractors can return tuples (text, timestamps, lang)
    if isinstance(transcript_text, (tuple, list)):
        transcript_text = transcript_text[0]
    if not isinstance(transcript_text, str):
        transcript_text = str(transcript_text) if transcript_text else ""

    if not transcript_text or len(transcript_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Transcription trop courte ou indisponible.")

    word_count = len(transcript_text.split())

    # 4b. Si le titre est generique, deduire depuis le transcript
    if title in ("TikTok Video", "Video sans titre", "", "TikTok") and transcript_text:
        words = transcript_text.strip().split()[:15]
        derived_title = " ".join(words)
        if len(derived_title) > 80:
            derived_title = derived_title[:77] + "..."
        title = derived_title or title
        print(f"[QUICK CHAT] Derived title from transcript: {title[:50]}...", flush=True)

    # 5. Creer un Summary leger (transcript-only)
    # Securite: tronquer tous les champs VARCHAR avant insert
    safe_video_id = str(video_id)[:100]
    safe_url = str(resolved_url if resolved_url != url else url)[:500]
    safe_thumbnail = str(thumbnail_url)[:500] if thumbnail_url else ""
    try:
        summary_id = await save_summary(
            session=session, user_id=current_user.id,
            video_id=safe_video_id, video_title=title, video_channel=channel,
            video_duration=duration, video_url=safe_url, thumbnail_url=safe_thumbnail,
            category="general", category_confidence=0.0,
            lang=request.lang, mode="quick_chat", model_used="none",
            summary_content="", transcript_context=transcript_text,
            video_upload_date=upload_date, platform=platform,
            # 📊 Engagement metadata from video_info
            view_count=video_info.get("view_count"),
            like_count=video_info.get("like_count"),
            comment_count=video_info.get("comment_count"),
            share_count=video_info.get("share_count"),
            channel_follower_count=video_info.get("channel_follower_count"),
            content_type=video_info.get("content_type", "video"),
            source_tags=video_info.get("tags", []),
            video_description=video_info.get("description"),
            channel_id=video_info.get("channel_id"),
            music_title=video_info.get("music_title"),
            music_author=video_info.get("music_author"),
            carousel_images=video_info.get("carousel_images"),
        )
    except Exception as e:
        print(f"[QUICK CHAT] Failed to save: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde.")

    elapsed = time.time() - start_time
    print(f"[QUICK CHAT] Done in {elapsed:.1f}s - summary_id={summary_id}, words={word_count}", flush=True)

    return QuickChatResponse(
        summary_id=summary_id, video_id=video_id, video_title=title,
        video_channel=channel, video_duration=duration, thumbnail_url=thumbnail_url,
        platform=platform, transcript_available=True, word_count=word_count,
        message=f"Quick Chat pret en {elapsed:.1f}s - {word_count} mots disponibles"
    )


# =========================================================================
# UPGRADE QUICK CHAT -> ANALYSE COMPLETE (conserve historique de chat)
# =========================================================================

@router.post("/quick-chat/upgrade", response_model=UpgradeQuickChatResponse)
async def upgrade_quick_chat(
    request: UpgradeQuickChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Upgrade un Quick Chat vers une analyse complete, conserve l'historique."""
    from sqlalchemy import select as sa_select, update as sa_update

    # 1. Verifier le summary
    result = await session.execute(
        sa_select(Summary).where(Summary.id == request.summary_id, Summary.user_id == current_user.id)
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Analyse non trouvee")

    # 2. Deja analyse?
    if summary.mode and summary.mode != "quick_chat" and summary.summary_content:
        return UpgradeQuickChatResponse(task_id="already_done", status="completed", message="Analyse complete deja disponible")

    # 3. Credits
    can, reason, _, _ = await check_can_analyze(session, current_user.id)
    if not can:
        raise HTTPException(status_code=403, detail=reason)
    await deduct_credit(session, current_user.id)

    # 4. Background task
    task_id = str(uuid4())
    _task_store[task_id] = {"status": "processing", "progress": 10, "message": "Analyse en cours...", "summary_id": request.summary_id}

    async def run_upgrade():
        from db.database import async_session_maker
        try:
            async with async_session_maker() as bg_session:
                res = await bg_session.execute(sa_select(Summary).where(Summary.id == request.summary_id, Summary.user_id == current_user.id))
                s = res.scalar_one_or_none()
                if not s or not s.transcript_context:
                    _task_store[task_id].update({"status": "failed", "message": "Transcript introuvable"})
                    return

                _task_store[task_id].update({"progress": 30, "message": "Generation de l'analyse..."})
                try:
                    cat = request.category or await detect_category(s.transcript_context[:2000])
                except Exception:
                    cat = "general"

                try:
                    summary_content = await generate_summary(
                        title=s.video_title or "", transcript=s.transcript_context,
                        category=cat, lang=s.lang or "fr", mode=request.mode,
                        channel=s.video_channel or "", platform=s.platform or "youtube"
                    )
                except Exception as e:
                    _task_store[task_id].update({"status": "failed", "message": f"Erreur: {str(e)[:100]}"})
                    return

                if not summary_content:
                    _task_store[task_id].update({"status": "failed", "message": "Resume non genere"})
                    return

                _task_store[task_id].update({"progress": 70, "message": "Extraction des entites..."})
                try:
                    entities = await extract_entities(summary_content)
                except Exception:
                    entities = {}
                try:
                    reliability = await calculate_reliability_score(summary_content, s.video_title or "", s.video_channel or "")
                except Exception:
                    reliability = 50.0

                import json as json_mod
                await bg_session.execute(
                    sa_update(Summary).where(Summary.id == request.summary_id).values(
                        summary_content=summary_content, category=cat, mode=request.mode,
                        model_used="mistral-small-2603",
                        entities_extracted=json_mod.dumps(entities) if entities else None,
                        reliability_score=reliability, word_count=len(s.transcript_context.split())
                    )
                )
                await bg_session.commit()
                _task_store[task_id].update({"status": "completed", "progress": 100, "message": "Analyse terminee"})
                print(f"[UPGRADE] Summary {request.summary_id} upgraded OK", flush=True)
        except Exception as e:
            print(f"[UPGRADE] Failed: {e}", flush=True)
            _task_store[task_id].update({"status": "failed", "message": f"Erreur: {str(e)[:100]}"})

    background_tasks.add_task(run_upgrade)
    return UpgradeQuickChatResponse(task_id=task_id, status="processing", message="Analyse lancee - historique conserve")

@router.post("/analyze/guest", response_model=GuestAnalyzeResponse)
async def analyze_video_guest(
    request: GuestAnalyzeRequest,
    raw_request: Request,
):
    """
    Analyse express pour visiteurs non connectés.
    - YouTube ET TikTok, vidéos < 5 min
    - 3 analyses par IP par 24h
    - Mode accessible, résumé court
    - Aucune sauvegarde en DB
    """
    import time

    # 1. Rate-limit par IP (3 analyses / 24h)
    client_ip = raw_request.headers.get("x-forwarded-for", raw_request.client.host if raw_request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    now = time.time()
    # Nettoyer les timestamps > 24h pour cette IP
    ip_timestamps = _guest_usage.get(client_ip, [])
    ip_timestamps = [ts for ts in ip_timestamps if now - ts < 86400]
    _guest_usage[client_ip] = ip_timestamps

    if len(ip_timestamps) >= MAX_GUEST_ANALYSES:
        raise HTTPException(
            status_code=429,
            detail="Vous avez utilisé vos 3 analyses gratuites. Créez un compte pour continuer !"
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

        # Détecter si c'est un Short (URL /shorts/ ou durée < 90s)
        is_short = "/shorts/" in url or duration <= 90

        try:
            transcript_result = await get_transcript_with_timestamps(video_id, is_short=is_short, duration=duration)
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
    _guest_usage[client_ip].append(now)
    remaining = MAX_GUEST_ANALYSES - len(_guest_usage[client_ip])

    # 7. Cleanup vieilles entrées (éviter fuite mémoire)
    expired = [ip for ip, timestamps in _guest_usage.items() if all(now - ts > 86400 for ts in timestamps)]
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
        remaining_analyses=max(0, remaining),
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
    model = request.model or plan_limits.get("default_model", "mistral-small-2603")
    
    # Vérifier que le modèle est autorisé
    allowed_models = plan_limits.get("models", ["mistral-small-2603"])
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
    # 💾 GLOBAL VIDEO CONTENT CACHE — Cross-user L1 Redis / L2 PostgreSQL VPS
    # ═══════════════════════════════════════════════════════════════════════════════
    if not request.force_refresh:
        try:
            from main import get_video_cache
            _vcache = get_video_cache()
            if _vcache is not None:
                _analysis_lang = request.lang or "fr"
                _cached = await _vcache.get_analysis(platform, video_id, request.mode, _analysis_lang)
                if _cached and _cached.get("summary_content"):
                    # Sauvegarder dans l'historique utilisateur (gratuit, source=cache)
                    _cache_summary_id = await save_summary(
                        session=session,
                        user_id=current_user.id,
                        video_id=video_id,
                        video_title=_cached.get("video_title", "Unknown"),
                        video_channel=_cached.get("video_channel", "Unknown"),
                        video_duration=_cached.get("video_duration", 0),
                        video_url=request.url,
                        thumbnail_url=_cached.get("thumbnail_url", ""),
                        category=_cached.get("category", "general"),
                        category_confidence=_cached.get("category_confidence", 0.5),
                        lang=_cached.get("lang", _analysis_lang),
                        mode=_cached.get("mode", request.mode),
                        model_used=_cached.get("model_used", "cache"),
                        summary_content=_cached["summary_content"],
                        transcript_context=_cached.get("transcript_context", ""),
                        video_upload_date=_cached.get("video_upload_date"),
                        entities_extracted=_cached.get("entities_extracted"),
                        reliability_score=_cached.get("reliability_score", 0),
                        enrichment_data=_cached.get("enrichment_data"),
                        platform=platform,
                    )
                    try:
                        from core.plan_limits import increment_daily_usage
                        await increment_daily_usage(session, current_user.id)
                    except Exception:
                        pass
                    print(f"💾 [GLOBAL CACHE HIT] {platform}/{video_id} → summary_id={_cache_summary_id} (0 credits)", flush=True)
                    return TaskStatusResponse(
                        task_id=f"cached_{_cache_summary_id}",
                        status="completed",
                        progress=100,
                        message="✅ Analyse retrouvée en cache global (gratuit!)",
                        result={
                            "summary_id": _cache_summary_id,
                            "cached": True,
                            "from_cache": True,
                            "video_title": _cached.get("video_title", "Unknown"),
                            "category": _cached.get("category", "general"),
                            "cost": 0,
                        }
                    )
        except Exception as _vcache_err:
            print(f"⚠️ [GLOBAL CACHE] Check failed (continuing): {_vcache_err}", flush=True)

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
    model = request.model or plan_limits.get("default_model", "mistral-small-2603")

    # Vérifier que le modèle est autorisé
    allowed_models = plan_limits.get("models", ["mistral-small-2603"])
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
        "priority": request.priority if current_user.plan in ["pro"] else "normal",
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
            # Check cancellation
            if _task_store.get(task_id, {}).get("status") == "cancelled":
                print(f"🚫 [v6.0] Task {task_id[:12]} cancelled", flush=True)
                return
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

            if platform == "tiktok" and video_info.get("content_type") == "carousel":
                # 📸 Carousel pipeline: Vision analysis instead of audio transcript
                _task_store[task_id]["message"] = "📸 Analyse des images du carrousel..."
                from transcripts.carousel import get_carousel_transcript
                carousel_images = video_info.get("carousel_images", [])
                if not carousel_images:
                    raise Exception("Carousel détecté mais aucune image trouvée")
                transcript, transcript_timestamped, detected_lang = await get_carousel_transcript(
                    images=carousel_images,
                    title=video_info.get("title", ""),
                    description=video_info.get("description", ""),
                    lang=lang,
                )
            elif platform == "tiktok":
                transcript, transcript_timestamped, detected_lang = await get_tiktok_transcript(url, video_id)
            else:
                _duration = int(video_info.get("duration", 0) or 0)
                _is_short = "/shorts/" in url or _duration <= 90
                transcript, transcript_timestamped, detected_lang = await get_transcript_with_timestamps(video_id, is_short=_is_short, duration=_duration)
            if not transcript:
                raise Exception("No transcript available for this video")

            if not lang or lang == "auto":
                lang = detected_lang or "fr"

            # 3+4. ⚡ CATÉGORIE + ENRICHISSEMENT WEB EN PARALLÈLE (perf v2.0.1)
            import asyncio
            _task_store[task_id]["progress"] = 30
            _task_store[task_id]["message"] = "🏷️ Détection catégorie & recherche web..."

            async def _detect_cat_v2():
                if not category or category == "auto":
                    return detect_category(
                        title=video_info["title"],
                        description=video_info.get("description", ""),
                        transcript=transcript[:3000],
                        channel=video_info.get("channel", ""),
                        tags=video_info.get("tags", []),
                        youtube_categories=video_info.get("categories", [])
                    )
                return category, 0.9

            async def _enrich_web_v2():
                if enrichment_level == EnrichmentLevel.NONE:
                    return None, [], enrichment_level
                try:
                    return await get_pre_analysis_context(
                        video_title=video_info["title"],
                        video_channel=video_info.get("channel", ""),
                        category=category or "auto",
                        transcript=transcript,
                        plan=user_plan,
                        lang=lang,
                        upload_date=video_info.get("upload_date", "")
                    )
                except Exception as e:
                    print(f"⚠️ [v2.0] Web enrichment failed: {e}", flush=True)
                    return None, [], enrichment_level

            (category, confidence), (_web_ctx, _enrich_src, _) = await asyncio.gather(
                _detect_cat_v2(), _enrich_web_v2()
            )
            web_context = _web_ctx
            enrichment_sources = _enrich_src

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

            # Variable pour stocker les chunks (remplie si vidéo longue)
            _long_video_result = None

            if needs_chunk:
                _task_store[task_id]["message"] = f"📚 Vidéo longue ({word_count} mots)..."

                def update_progress(progress: int, message: str):
                    _task_store[task_id]["progress"] = progress
                    _task_store[task_id]["message"] = message

                _long_video_result = await analyze_long_video(
                    title=video_info["title"],
                    transcript=transcript_to_analyze,
                    video_duration=video_duration,
                    category=category,
                    lang=lang,
                    mode=mode,
                    model=model,
                    web_context=full_context,
                    progress_callback=update_progress,
                    transcript_timestamped=transcript_timestamped,
                    upload_date=video_info.get("upload_date", ""),
                    view_count=video_info.get("view_count") or 0,
                    user_plan=user_plan,
                )
                summary_content = _long_video_result.summary if isinstance(_long_video_result, LongVideoResult) else _long_video_result
                # Fallback si la synthèse a échoué
                if not summary_content:
                    print("⚠️ [v3.0] Long video analysis returned empty summary, falling back to truncated", flush=True)
                    truncated = " ".join(transcript_to_analyze.split()[:8000])
                    summary_content = await generate_summary(
                        title=video_info["title"], transcript=truncated,
                        category=category, lang=lang, mode=mode, model=model,
                        duration=video_duration, channel=video_info.get("channel", ""),
                        description=video_info.get("description", "") + "\n\n⚠️ NOTE: Cette vidéo est très longue. Seule la première partie a été analysée.",
                        web_context=full_context, video_id=video_id,
                        upload_date=video_info.get("upload_date", ""),
                        view_count=video_info.get("view_count") or 0,
                        like_count=video_info.get("like_count") or 0,
                        channel_follower_count=video_info.get("channel_follower_count") or 0,
                    )
            else:
                # 📊 Calculate engagement rate for prompt
                _vi_vc = video_info.get("view_count") or 0
                _vi_lc = video_info.get("like_count") or 0
                _vi_cc = video_info.get("comment_count") or 0
                _vi_sc = video_info.get("share_count") or 0
                _vi_er = round((_vi_lc + _vi_cc + _vi_sc) / _vi_vc * 100, 2) if _vi_vc > 0 else 0.0

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
                    upload_date=video_info.get("upload_date", ""),
                    view_count=_vi_vc,
                    like_count=_vi_lc,
                    channel_follower_count=video_info.get("channel_follower_count") or 0,
                    comment_count=_vi_cc,
                    share_count=_vi_sc,
                    engagement_rate=_vi_er,
                    content_type=video_info.get("content_type", "video"),
                    chapters=video_info.get("chapters"),
                )

            if not summary_content:
                raise Exception("AI service temporarily unavailable, please retry")

            # 6+7. ⚡ ENTITÉS + FIABILITÉ EN PARALLÈLE (perf v2.0.1)
            _task_store[task_id]["progress"] = 75
            _task_store[task_id]["message"] = "🔍 Extraction des entités & fiabilité..."

            entities = None
            reliability = None
            _do_entities = options.get("include_entities", True)
            _do_reliability = options.get("include_reliability", True)

            if _do_entities and _do_reliability:
                entities, reliability = await asyncio.gather(
                    extract_entities(summary_content, lang=lang),
                    calculate_reliability_score(summary_content, {}, lang=lang)
                )
                if entities and len(entities) > 5:
                    reliability = min(98, reliability + 2)
            elif _do_entities:
                entities = await extract_entities(summary_content, lang=lang)
            elif _do_reliability:
                reliability = await calculate_reliability_score(summary_content, {}, lang=lang)

            if reliability is not None and enrichment_sources:
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
                platform=platform,
                # 📊 Engagement metadata
                view_count=video_info.get("view_count"),
                like_count=video_info.get("like_count"),
                comment_count=video_info.get("comment_count"),
                share_count=video_info.get("share_count"),
                channel_follower_count=video_info.get("channel_follower_count"),
                content_type=video_info.get("content_type", "video"),
                source_tags=video_info.get("tags", []),
                video_description=video_info.get("description"),
                channel_id=video_info.get("channel_id"),
                music_title=video_info.get("music_title"),
                music_author=video_info.get("music_author"),
                carousel_images=video_info.get("carousel_images"),
            )

            # 🆕 v4.0: Générer et sauvegarder l'index structuré
            await _save_structured_index(
                session, summary_id,
                video_info.get("duration", 0),
                transcript, transcript_timestamped
            )

            # v3.0: Stocker les VideoChunks pour réutilisation par le digest pipeline
            if isinstance(_long_video_result, LongVideoResult) and _long_video_result.chunks:
                try:
                    await store_chunks_in_db(_long_video_result, summary_id, session)
                except Exception as chunk_err:
                    print(f"⚠️ [v3.0] VideoChunk storage failed (non-blocking): {chunk_err}", flush=True)

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
                    async with shared_http_client() as client:
                        await client.post(
                            webhook_url,
                            json={
                                "event": "analysis_complete",
                                "task_id": task_id,
                                "summary_id": summary_id,
                                "video_id": video_id,
                                "status": "completed"
                            },
                            timeout=30.0
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
    model = request.model or plan_limits.get("default_model", "mistral-small-2603")

    # Vérifier que le modèle est autorisé
    allowed_models = plan_limits.get("models", ["mistral-small-2603"])
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
    is_premium = current_user.plan in ["pro"]

    # Anti-AI detection: Pro only
    if customization.anti_ai_detection and not is_premium:
        customization.anti_ai_detection = False
        print(f"⚠️ [v2.1] Anti-AI disabled (requires Pro)", flush=True)

    # Analyse des commentaires: Pro only
    if customization.analyze_comments and not is_premium:
        customization.analyze_comments = False
        print(f"⚠️ [v2.1] Comments analysis disabled (requires Pro)", flush=True)

    # Analyse de propagande: Pro only (advanced feature)
    if customization.detect_propaganda and current_user.plan not in ["pro"]:
        customization.detect_propaganda = False
        print(f"⚠️ [v2.1] Propaganda analysis disabled (requires Pro)", flush=True)
    
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

            if platform == "tiktok" and video_info.get("content_type") == "carousel":
                # 📸 Carousel pipeline
                _task_store[task_id]["message"] = "📸 Analyse des images du carrousel..."
                from transcripts.carousel import get_carousel_transcript
                carousel_images = video_info.get("carousel_images", [])
                if not carousel_images:
                    raise Exception("Carousel détecté mais aucune image trouvée")
                transcript, transcript_timestamped, detected_lang = await get_carousel_transcript(
                    images=carousel_images,
                    title=video_info.get("title", ""),
                    description=video_info.get("description", ""),
                    lang=lang,
                )
            elif platform == "tiktok":
                transcript, transcript_timestamped, detected_lang = await get_tiktok_transcript(url, video_id)
            else:
                _duration = int(video_info.get("duration", 0) or 0)
                _is_short = "/shorts/" in url or _duration <= 90
                transcript, transcript_timestamped, detected_lang = await get_transcript_with_timestamps(video_id, is_short=_is_short, duration=_duration)
            if not transcript:
                raise Exception("No transcript available for this video")

            if not lang or lang == "auto":
                lang = detected_lang or "fr"

            # ═══════════════════════════════════════════════════════════════════
            # 3+4+5+6. ⚡ CATÉGORIE + COMMENTAIRES + METADATA + WEB EN PARALLÈLE (perf v2.1.1)
            # ═══════════════════════════════════════════════════════════════════
            import asyncio
            _task_store[task_id]["progress"] = 22
            _task_store[task_id]["message"] = "⚡ Détection catégorie, métadonnées & recherche web..."

            async def _detect_cat_v21():
                if not category or category == "auto":
                    return detect_category(
                        title=video_info["title"],
                        description=video_info.get("description", ""),
                        transcript=transcript[:3000],
                        channel=video_info.get("channel", ""),
                        tags=video_info.get("tags", []),
                        youtube_categories=video_info.get("categories", [])
                    )
                return category, 0.9

            async def _analyze_comments_v21():
                if not custom_opts.get("analyze_comments", False):
                    return None
                try:
                    comments_limit = custom_opts.get("comments_limit", 100)
                    result = await analyze_comments(
                        video_id=video_id,
                        limit=comments_limit,
                        use_ai=True,
                        video_title=video_info["title"],
                        lang=lang,
                        model=model
                    )
                    print(f"✅ [v2.1] Comments analysis: {result.analyzed_count} comments", flush=True)
                    return result
                except Exception as e:
                    print(f"⚠️ [v2.1] Comments analysis failed: {e}", flush=True)
                    return None

            async def _enrich_metadata_v21():
                try:
                    result = await get_enriched_metadata(
                        video_id=video_id,
                        title=video_info["title"],
                        description=video_info.get("description", ""),
                        transcript=transcript[:5000],
                        channel=video_info.get("channel", ""),
                        tags=video_info.get("tags", []),
                        category=category or "auto",
                        analyze_propaganda=custom_opts.get("detect_propaganda", False),
                        analyze_intent=custom_opts.get("analyze_publication_intent", False),
                        extract_figures=custom_opts.get("extract_public_figures", True),
                        lang=lang
                    )
                    print(f"✅ [v2.1] Metadata enriched", flush=True)
                    return result
                except Exception as e:
                    print(f"⚠️ [v2.1] Metadata enrichment failed: {e}", flush=True)
                    return None

            async def _enrich_web_v21():
                if enrichment_level == EnrichmentLevel.NONE:
                    return None, [], enrichment_level
                try:
                    return await get_pre_analysis_context(
                        video_title=video_info["title"],
                        video_channel=video_info.get("channel", ""),
                        category=category or "auto",
                        transcript=transcript,
                        plan=user_plan,
                        lang=lang,
                        upload_date=video_info.get("upload_date", "")
                    )
                except Exception as e:
                    print(f"⚠️ [v2.1] Web enrichment failed: {e}", flush=True)
                    return None, [], enrichment_level

            # ⚡ Lancer les 4 tâches en parallèle
            (category, confidence), comments_analysis_result, metadata_enriched_result, (_web_ctx, _enrich_src, _) = await asyncio.gather(
                _detect_cat_v21(),
                _analyze_comments_v21(),
                _enrich_metadata_v21(),
                _enrich_web_v21()
            )
            web_context = _web_ctx
            enrichment_sources = _enrich_src
            print(f"⚡ [v2.1.1] Category + comments + metadata + web computed in PARALLEL", flush=True)

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

            # Variable pour stocker les chunks (remplie si vidéo longue)
            _long_video_result2 = None

            if needs_chunk:
                _task_store[task_id]["message"] = f"📚 Vidéo longue ({word_count} mots)..."

                def update_progress(progress: int, message: str):
                    _task_store[task_id]["progress"] = progress
                    _task_store[task_id]["message"] = message

                _long_video_result2 = await analyze_long_video(
                    title=video_info["title"],
                    transcript=transcript_to_analyze,
                    video_duration=video_duration,
                    category=category,
                    lang=lang,
                    mode=mode,
                    model=model,
                    web_context=full_context,
                    progress_callback=update_progress,
                    transcript_timestamped=transcript_timestamped,
                    upload_date=video_info.get("upload_date", ""),
                    view_count=video_info.get("view_count") or 0,
                    user_plan=user_plan,
                )
                summary_content = _long_video_result2.summary if isinstance(_long_video_result2, LongVideoResult) else _long_video_result2
                # Fallback si la synthèse a échoué
                if not summary_content:
                    print("⚠️ [v3.0] Long video analysis returned empty summary, falling back to truncated", flush=True)
                    truncated = " ".join(transcript_to_analyze.split()[:8000])
                    summary_content = await generate_summary(
                        title=video_info["title"], transcript=truncated,
                        category=category, lang=lang, mode=mode, model=model,
                        duration=video_duration, channel=video_info.get("channel", ""),
                        description=video_info.get("description", "") + "\n\n⚠️ NOTE: Cette vidéo est très longue. Seule la première partie a été analysée.",
                        web_context=full_context, video_id=video_id,
                        upload_date=video_info.get("upload_date", ""),
                        view_count=video_info.get("view_count") or 0,
                        like_count=video_info.get("like_count") or 0,
                        channel_follower_count=video_info.get("channel_follower_count") or 0,
                    )
            else:
                # 📊 Calculate engagement rate for prompt
                _vi_vc2 = video_info.get("view_count") or 0
                _vi_lc2 = video_info.get("like_count") or 0
                _vi_cc2 = video_info.get("comment_count") or 0
                _vi_sc2 = video_info.get("share_count") or 0
                _vi_er2 = round((_vi_lc2 + _vi_cc2 + _vi_sc2) / _vi_vc2 * 100, 2) if _vi_vc2 > 0 else 0.0

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
                    upload_date=video_info.get("upload_date", ""),
                    view_count=_vi_vc2,
                    like_count=_vi_lc2,
                    channel_follower_count=video_info.get("channel_follower_count") or 0,
                    comment_count=_vi_cc2,
                    share_count=_vi_sc2,
                    engagement_rate=_vi_er2,
                    content_type=video_info.get("content_type", "video"),
                    chapters=video_info.get("chapters"),
                )

            if not summary_content:
                raise Exception("AI service temporarily unavailable, please retry")

            # ═══════════════════════════════════════════════════════════════════
            # 9+10. ⚡ ENTITÉS + FIABILITÉ EN PARALLÈLE (perf v2.1.1)
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 75
            _task_store[task_id]["message"] = "🔍 Extraction des entités & fiabilité..."

            entities = None
            reliability = None
            _do_entities = options.get("include_entities", True)
            _do_reliability = options.get("include_reliability", True)

            if _do_entities and _do_reliability:
                entities, reliability = await asyncio.gather(
                    extract_entities(summary_content, lang=lang),
                    calculate_reliability_score(summary_content, {}, lang=lang)
                )
                if entities and len(entities) > 5:
                    reliability = min(98, reliability + 2)
            elif _do_entities:
                entities = await extract_entities(summary_content, lang=lang)
            elif _do_reliability:
                reliability = await calculate_reliability_score(summary_content, {}, lang=lang)

            if reliability is not None:
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
                platform=platform,
                # 📊 Engagement metadata
                view_count=video_info.get("view_count"),
                like_count=video_info.get("like_count"),
                comment_count=video_info.get("comment_count"),
                share_count=video_info.get("share_count"),
                channel_follower_count=video_info.get("channel_follower_count"),
                content_type=video_info.get("content_type", "video"),
                source_tags=video_info.get("tags", []),
                video_description=video_info.get("description"),
                channel_id=video_info.get("channel_id"),
                music_title=video_info.get("music_title"),
                music_author=video_info.get("music_author"),
                carousel_images=video_info.get("carousel_images"),
            )

            # 🆕 v4.0: Index structuré
            await _save_structured_index(
                session, summary_id,
                video_info.get("duration", 0),
                transcript, transcript_timestamped
            )

            # v3.0: Stocker les VideoChunks pour réutilisation par le digest pipeline
            if isinstance(_long_video_result2, LongVideoResult) and _long_video_result2.chunks:
                try:
                    await store_chunks_in_db(_long_video_result2, summary_id, session)
                except Exception as chunk_err:
                    print(f"⚠️ [v3.0] VideoChunk storage failed (non-blocking): {chunk_err}", flush=True)

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
                    async with shared_http_client() as client:
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
                            timeout=30.0
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
            # Check if cancelled before starting
            if _task_store.get(task_id, {}).get("status") == "cancelled":
                print(f"🚫 [v6.0] Task {task_id[:12]} cancelled before start", flush=True)
                return

            _task_store[task_id]["status"] = "processing"
            _task_store[task_id]["progress"] = 5
            _task_store[task_id]["message"] = "🚀 Démarrage de l'analyse..."
            
            # ═══════════════════════════════════════════════════════════════════
            # 1. RÉCUPÉRER LES INFOS VIDÉO
            # ═══════════════════════════════════════════════════════════════════
            # Check cancellation
            if _task_store.get(task_id, {}).get("status") == "cancelled":
                print(f"🚫 [v6.0] Task {task_id[:12]} cancelled", flush=True)
                return
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
            # 2. EXTRAIRE LA TRANSCRIPTION (avec global cache check)
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 20
            _task_store[task_id]["message"] = "📝 Extraction du transcript..."

            # 💾 Check global video content cache for transcript
            transcript = None
            transcript_timestamped = None
            detected_lang = None
            try:
                from main import get_video_cache
                _vcache = get_video_cache()
                if _vcache is not None:
                    _cached_t = await _vcache.get_transcript(platform, video_id)
                    if _cached_t:
                        transcript = _cached_t.get("transcript")
                        transcript_timestamped = _cached_t.get("transcript_timestamped")
                        detected_lang = _cached_t.get("detected_lang")
                        if transcript:
                            print(f"💾 [GLOBAL CACHE HIT] Transcript for {platform}/{video_id}: {len(transcript)} chars", flush=True)
            except Exception as _vce:
                print(f"⚠️ [GLOBAL CACHE] Transcript check failed: {_vce}", flush=True)

            # Extract if not found in cache
            if not transcript:
                if platform == "tiktok" and video_info.get("content_type") == "carousel":
                    # 📸 Carousel pipeline
                    _task_store[task_id]["message"] = "📸 Analyse des images du carrousel..."
                    from transcripts.carousel import get_carousel_transcript
                    carousel_images = video_info.get("carousel_images", [])
                    if not carousel_images:
                        raise Exception("Carousel détecté mais aucune image trouvée")
                    transcript, transcript_timestamped, detected_lang = await get_carousel_transcript(
                        images=carousel_images,
                        title=video_info.get("title", ""),
                        description=video_info.get("description", ""),
                        lang=lang,
                    )
                elif platform == "tiktok":
                    transcript, transcript_timestamped, detected_lang = await get_tiktok_transcript(url, video_id)
                else:
                    _duration = int(video_info.get("duration", 0) or 0)
                    _is_short = "/shorts/" in url or _duration <= 90
                    transcript, transcript_timestamped, detected_lang = await get_transcript_with_timestamps(video_id, is_short=_is_short, duration=_duration)

                # 💾 Cache the freshly extracted transcript
                if transcript:
                    try:
                        if _vcache is not None:
                            await _vcache.set_transcript(platform, video_id, {
                                "transcript": transcript,
                                "transcript_timestamped": transcript_timestamped,
                                "detected_lang": detected_lang,
                            })
                            print(f"💾 [GLOBAL CACHE SET] Transcript cached for {platform}/{video_id}", flush=True)
                    except Exception:
                        pass

            if not transcript or _is_empty_transcript(transcript):
                # 🎞️ Slideshow detection: empty transcript + short video = possible image slideshow
                _vid_duration = video_info.get("duration", 0) or 0
                _vid_url = video_info.get("url") or video_info.get("webpage_url") or url
                if _vid_duration <= 120 or not transcript:
                    print(f"🎞️ [SLIDESHOW] Empty/minimal transcript ({len(transcript or '')} chars, {_vid_duration}s), trying frame extraction...", flush=True)
                    _task_store[task_id]["message"] = "Transcript vide — extraction des slides..."
                    _task_store[task_id]["progress"] = 22
                    try:
                        _slideshow_frames = await _extract_slideshow_frames(_vid_url, platform, max_frames=10)
                        if _slideshow_frames:
                            _task_store[task_id]["message"] = "Analyse des slides avec Vision IA..."
                            _api_key = get_mistral_key()
                            _slide_content = [{"type": "text", "text": f"Analyse ces {len(_slideshow_frames)} slides extraites d'une video {platform}. Pour chaque slide, extrais tout le texte visible et decris le visuel. Assemble le tout comme un transcript coherent. Reponds en {'francais' if lang == 'fr' else 'anglais'}."}]
                            for _frame in _slideshow_frames:
                                _data_uri = f"data:{_frame['mime_type']};base64,{_frame['data']}"
                                _slide_content.append({"type": "image_url", "image_url": _data_uri})
                            _slide_result = await _mistral_vision_request(
                                api_key=_api_key,
                                messages=[
                                    {"role": "system", "content": "Tu es un expert en OCR et analyse d'images. Extrais et decris le contenu de chaque slide."},
                                    {"role": "user", "content": _slide_content},
                                ],
                                model="mistral-small-2603",
                                max_tokens=6000,
                                timeout=120.0,
                                fallback_models=["pixtral-large-2411", "pixtral-12b-2409"],
                            )
                            if _slide_result:
                                transcript = "[SLIDESHOW — " + str(len(_slideshow_frames)) + " slides]" + chr(10) + chr(10) + _slide_result
                                print(f"🎞️ [SLIDESHOW] Vision OCR success: {len(_slide_result)} chars", flush=True)
                            else:
                                print(f"🎞️ [SLIDESHOW] Vision OCR failed", flush=True)
                    except Exception as _se:
                        print(f"🎞️ [SLIDESHOW] Error: {_se}", flush=True)
                
                if not transcript or len(transcript.strip()) < 30:
                    raise Exception("No transcript available for this video")

            print(f"✅ Transcript: {len(transcript)} chars", flush=True)

            # Utiliser la langue détectée si pas spécifiée
            if not lang or lang == "auto":
                lang = detected_lang or "fr"
            
            # ═══════════════════════════════════════════════════════════════════
            # 3+4. ⚡ CATÉGORIE + ENRICHISSEMENT WEB EN PARALLÈLE (v6.1)
            # ═══════════════════════════════════════════════════════════════════
            import asyncio
            _task_store[task_id]["progress"] = 30
            _task_store[task_id]["message"] = "🏷️ Détection catégorie & recherche web..."

            # — Catégorie (sync → wrap in executor si non-async, ou inline)
            async def _detect_category_async():
                if not category or category == "auto":
                    cat, conf = detect_category(
                        title=video_info["title"],
                        description=video_info.get("description", ""),
                        transcript=transcript[:3000],
                        channel=video_info.get("channel", ""),
                        tags=video_info.get("tags", []),
                        youtube_categories=video_info.get("categories", [])
                    )
                    print(f"🏷️ Auto-detected category: {cat} ({conf:.0%})", flush=True)
                    return cat, conf
                return category, 0.9

            # — Enrichissement web (async)
            async def _enrich_web_async():
                if enrichment_level == EnrichmentLevel.NONE:
                    print(f"⏭️ [v5.0] Skipping web enrichment (plan={user_plan})", flush=True)
                    return None, [], enrichment_level
                print(f"🌐 [v5.0] PRE-ANALYSIS: Fetching web context from Perplexity...", flush=True)
                try:
                    # Note: pour l'enrichissement, on passe "auto" comme catégorie provisoire
                    # car la catégorie finale est détectée en parallèle
                    _wc, _es, _al = await get_pre_analysis_context(
                        video_title=video_info["title"],
                        video_channel=video_info.get("channel", ""),
                        category=category or "auto",  # catégorie provisoire
                        transcript=transcript,
                        plan=user_plan,
                        lang=lang,
                        upload_date=video_info.get("upload_date", "")
                    )
                    if _wc:
                        print(f"✅ [v5.0] PRE-ANALYSIS: Got {len(_wc)} chars, {len(_es)} sources", flush=True)
                    else:
                        print(f"⚠️ [v5.0] PRE-ANALYSIS: No web context returned", flush=True)
                    return _wc, _es, _al
                except Exception as e:
                    print(f"⚠️ [v5.0] PRE-ANALYSIS failed (continuing without): {e}", flush=True)
                    return None, [], enrichment_level

            # ⚡ Lancer les deux en parallèle
            (category, confidence), (_web_ctx, _enrich_src, _) = await asyncio.gather(
                _detect_category_async(),
                _enrich_web_async()
            )
            web_context = _web_ctx
            enrichment_sources = _enrich_src

            _task_store[task_id]["progress"] = 45
            print(f"⚡ [v6.1] Category + web enrichment computed in PARALLEL", flush=True)
            
            # ═══════════════════════════════════════════════════════════════════
            # 5. GÉNÉRER LE RÉSUMÉ (MISTRAL) AVEC CONTEXTE WEB
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 55
            
            # Déterminer le modèle selon le plan
            plan_limits = PLAN_LIMITS.get(user_plan, PLAN_LIMITS["free"])
            if not model:
                model = plan_limits.get("default_model", "mistral-small-2603")
            
            # Vérifier que le modèle est autorisé
            allowed_models = plan_limits.get("models", ["mistral-small-2603"])
            if model not in allowed_models:
                model = allowed_models[0]
            
            # 🆕 v7.0: DÉTECTION VIDÉO LONGUE ET CHUNKING
            transcript_to_analyze = transcript_timestamped or transcript
            video_duration = video_info.get("duration", 0)
            
            needs_chunk, word_count, chunk_reason = needs_chunking(transcript_to_analyze)
            
            # Variable pour stocker les chunks (remplie si vidéo longue)
            _long_video_result3 = None

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

                # v3.0: Analyser avec les VRAIS timestamps YouTube + routage intelligent
                _long_video_result3 = await analyze_long_video(
                    title=video_info["title"],
                    transcript=transcript_to_analyze,
                    video_duration=video_duration,
                    category=category,
                    lang=lang,
                    mode=mode,
                    model=model,
                    web_context=web_context,
                    progress_callback=update_progress,
                    transcript_timestamped=transcript_timestamped,
                    user_plan=user_plan,
                )
                summary_content = _long_video_result3.summary if isinstance(_long_video_result3, LongVideoResult) else _long_video_result3

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
                        upload_date=video_info.get("upload_date", ""),
                        view_count=video_info.get("view_count") or 0,
                        like_count=video_info.get("like_count") or 0,
                        channel_follower_count=video_info.get("channel_follower_count") or 0,
                        comment_count=video_info.get("comment_count") or 0,
                        share_count=video_info.get("share_count") or 0,
                        content_type=video_info.get("content_type", "video"),
                        chapters=video_info.get("chapters"),
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
                    upload_date=video_info.get("upload_date", ""),
                    view_count=video_info.get("view_count") or 0,
                    like_count=video_info.get("like_count") or 0,
                    channel_follower_count=video_info.get("channel_follower_count") or 0,
                    comment_count=video_info.get("comment_count") or 0,
                    share_count=video_info.get("share_count") or 0,
                    content_type=video_info.get("content_type", "video"),
                    chapters=video_info.get("chapters"),
                )

            if not summary_content:
                raise Exception("AI service temporarily unavailable, please retry")

            final_word_count = len(summary_content.split())
            print(f"✅ Summary generated: {final_word_count} words", flush=True)
            
            # ═══════════════════════════════════════════════════════════════════
            # 6+7. ⚡ ENTITÉS + FIABILITÉ EN PARALLÈLE (optimisation v6.1)
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 75
            _task_store[task_id]["message"] = "🔍 Extraction des entités & fiabilité..."

            import asyncio
            entities_task = asyncio.create_task(extract_entities(summary_content, lang=lang))
            reliability_task = asyncio.create_task(calculate_reliability_score(summary_content, {}, lang=lang))

            entities, reliability_base = await asyncio.gather(entities_task, reliability_task)

            # Recalculer la fiabilité avec les entités si différent (léger ajustement)
            # La v6.0 passait entities à calculate_reliability_score, mais l'impact est marginal
            # On utilise le score de base + un bonus si les entités sont riches
            reliability = reliability_base
            if entities and len(entities) > 5:
                reliability = min(98, reliability + 2)  # Bonus pour richesse d'entités

            print(f"⚡ [v6.1] Entities + reliability computed in PARALLEL", flush=True)
            
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
                # 📊 Engagement metadata
                view_count=video_info.get("view_count"),
                like_count=video_info.get("like_count"),
                comment_count=video_info.get("comment_count"),
                share_count=video_info.get("share_count"),
                channel_follower_count=video_info.get("channel_follower_count"),
                content_type=video_info.get("content_type", "video"),
                source_tags=video_info.get("tags", []),
                video_description=video_info.get("description"),
                channel_id=video_info.get("channel_id"),
                music_title=video_info.get("music_title"),
                music_author=video_info.get("music_author"),
                carousel_images=video_info.get("carousel_images"),
            )

            print(f"💾 Summary saved: id={summary_id}", flush=True)

            # 🆕 v4.0: Index structuré
            await _save_structured_index(
                session, summary_id,
                video_info.get("duration", 0),
                transcript, transcript_timestamped
            )

            # v3.0: Stocker les VideoChunks pour réutilisation par le digest pipeline
            if isinstance(_long_video_result3, LongVideoResult) and _long_video_result3.chunks:
                try:
                    await store_chunks_in_db(_long_video_result3, summary_id, session)
                except Exception as chunk_err:
                    print(f"⚠️ [v3.0] VideoChunk storage failed (non-blocking): {chunk_err}", flush=True)

            # ⚡ Cache + quota en parallèle (perf v6.2)
            async def _cache_analysis():
                try:
                    from main import get_video_cache
                    _vcache_post = get_video_cache()
                    if _vcache_post is not None:
                        await _vcache_post.set_analysis(platform, video_id, mode, lang, {
                            "summary_content": summary_content,
                            "video_title": video_info["title"],
                            "video_channel": video_info.get("channel", "Unknown"),
                            "video_duration": video_info.get("duration", 0),
                            "thumbnail_url": default_thumbnail,
                            "category": category,
                            "category_confidence": confidence,
                            "lang": lang,
                            "mode": mode,
                            "model_used": model,
                            "transcript_context": (transcript_timestamped or transcript)[:10000],
                            "video_upload_date": video_info.get("upload_date"),
                            "entities_extracted": entities,
                            "reliability_score": reliability,
                            "enrichment_data": enrichment_metadata,
                        })
                except Exception as _vce:
                    print(f"⚠️ [GLOBAL CACHE] Analysis cache set failed: {_vce}", flush=True)

            async def _increment_quota():
                try:
                    from core.plan_limits import increment_daily_usage
                    await increment_daily_usage(session, user_id)
                except Exception as quota_err:
                    print(f"⚠️ [QUOTA] Failed to increment daily usage: {quota_err}", flush=True)

            await asyncio.gather(_cache_analysis(), _increment_quota())

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
        except Exception as e:
            logger.error(f"Failed to update task status to 'failed' for task {task_id}: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 STATUS & POLLING
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/cancel/{task_id}")
async def cancel_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """Annule une tâche d'analyse en cours."""
    if task_id in _task_store:
        task = _task_store[task_id]
        if task.get("user_id") != current_user.id:
            raise HTTPException(status_code=404, detail="Task not found")

        # Mark as cancelled
        _task_store[task_id]["status"] = "cancelled"
        _task_store[task_id]["message"] = "Analyse annulée par l'utilisateur"
        print(f"🚫 [CANCEL] Task {task_id[:12]} cancelled by user {current_user.id}", flush=True)
        return {"status": "cancelled", "task_id": task_id}

    raise HTTPException(status_code=404, detail="Task not found")


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
        except (json.JSONDecodeError, TypeError):
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
        except (json.JSONDecodeError, TypeError):
            pass

    # 📊 Calculate engagement rate on-the-fly
    engagement_rate = None
    _vc = getattr(summary, 'view_count', None)
    if _vc and _vc > 0:
        _total = (getattr(summary, 'like_count', 0) or 0) + (getattr(summary, 'comment_count', 0) or 0) + (getattr(summary, 'share_count', 0) or 0)
        engagement_rate = round(_total / _vc * 100, 2)

    # Deserialize JSON fields
    _source_tags = None
    if getattr(summary, 'source_tags_json', None):
        try:
            _source_tags = json.loads(summary.source_tags_json)
        except (json.JSONDecodeError, TypeError):
            pass

    _carousel_images = None
    if getattr(summary, 'carousel_images_json', None):
        try:
            _carousel_images = json.loads(summary.carousel_images_json)
        except (json.JSONDecodeError, TypeError):
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
        created_at=summary.created_at.isoformat() if summary.created_at else None,
        # 📊 Engagement metadata
        view_count=getattr(summary, 'view_count', None),
        like_count=getattr(summary, 'like_count', None),
        comment_count=getattr(summary, 'comment_count', None),
        share_count=getattr(summary, 'share_count', None),
        channel_follower_count=getattr(summary, 'channel_follower_count', None),
        engagement_rate=engagement_rate,
        content_type=getattr(summary, 'content_type', None) or "video",
        music_title=getattr(summary, 'music_title', None),
        music_author=getattr(summary, 'music_author', None),
        source_tags=_source_tags,
        carousel_images=_carousel_images,
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
    
    # Déterminer si on utilise Perplexity (Pro only)
    use_perplexity = current_user.plan in ["pro"]
    
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
            model="mistral-small-2603"
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
            model="mistral-small-2603"
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
            model="mistral-small-2603",
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
        model = request.model or "mistral-small-2603"
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
    model: str = Query("mistral-small-2603"),
    current_user: User = Depends(get_current_user),
):
    """
    💰 Estime le coût en crédits pour une analyse.
    
    Utile avant de lancer une analyse multiple ou playlist.
    """
    # Multiplicateur selon le modèle
    multipliers = {
        "mistral-small-2603": 1.0,
        "mistral-medium-2508": 2.0,
        "mistral-large-2512": 3.0,
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
    result["full_factcheck_available"] = current_user.plan in ["pro"]

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
    result["full_factcheck_available"] = current_user.plan in ["pro"]

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
# 📸 ANALYSE D'IMAGES — Input images/screenshots utilisateur
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze/images", response_model=AnalyzeImagesResponse)
async def analyze_images(
    request: AnalyzeImagesRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    """
    📸 Analyse d'images collées/uploadées par l'utilisateur.

    Utilise Mistral Vision pour :
    1. Extraire le texte (OCR) de chaque image
    2. Décrire les éléments visuels
    3. Faire le lien entre toutes les images (narration, logique)
    4. Générer une synthèse structurée

    Limites :
    - Max 10 images par requête
    - Max 10 MB par image
    - Formats : JPEG, PNG, WebP
    - Coût : 1 crédit
    """
    # Validation
    if len(request.images) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images par analyse")
    if len(request.images) < 1:
        raise HTTPException(status_code=400, detail="Au moins 1 image requise")

    # Valider les tailles (base64 → ~1.37x taille originale, donc 14MB en b64 ≈ 10MB réel)
    MAX_B64_SIZE = 14_000_000
    for i, img in enumerate(request.images):
        if len(img.data) > MAX_B64_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Image {i + 1} trop volumineuse (max 10 MB)"
            )
        if img.mime_type not in ("image/jpeg", "image/png", "image/webp"):
            raise HTTPException(
                status_code=400,
                detail=f"Image {i + 1} : format non supporté ({img.mime_type}). Utiliser JPEG, PNG ou WebP."
            )

    # Vérifier les crédits
    model = request.model or "mistral-small-2603"
    credit_cost = get_credit_cost(model) if SECURITY_AVAILABLE else 1

    if current_user.credits < credit_cost:
        raise HTTPException(
            status_code=402,
            detail=f"Crédits insuffisants ({current_user.credits}/{credit_cost})"
        )

    # Générer un ID unique pour cet ensemble d'images
    import hashlib
    image_hash = hashlib.sha256(
        f"{current_user.id}:{len(request.images)}:{request.images[0].data[:100]}".encode()
    ).hexdigest()[:12]
    image_id = f"img_{image_hash}"

    # Créer la tâche
    task_id = str(uuid4())
    _task_store[task_id] = {
        "status": "processing",
        "progress": 0,
        "message": f"Analyse de {len(request.images)} image(s) en cours...",
        "image_id": image_id,
        "user_id": current_user.id,
    }

    # Lancer l'analyse en background
    background_tasks.add_task(
        _analyze_images_background,
        task_id=task_id,
        images=request.images,
        image_id=image_id,
        title=request.title,
        context=request.context,
        user_id=current_user.id,
        mode=request.mode,
        lang=request.lang,
        model=model,
        category=request.category,
    )

    print(f"📸 [IMAGES] User {current_user.email} - {len(request.images)} images - task={task_id}", flush=True)

    return AnalyzeImagesResponse(
        task_id=task_id,
        status="processing",
        message=f"Analyse de {len(request.images)} image(s) en cours...",
        image_count=len(request.images),
        estimated_duration_seconds=15 + len(request.images) * 5,
        cost=credit_cost,
    )


async def _mistral_vision_request(
    api_key: str,
    messages: list,
    model: str = "mistral-small-2603",
    max_tokens: int = 4096,
    temperature: float = 0.1,
    response_format: Optional[Dict] = None,
    timeout: float = 120.0,
    max_retries: int = 3,
    fallback_models: Optional[list] = None,
) -> Optional[str]:
    """
    Appel Vision resilient: Mistral -> Claude Vision fallback.
    JAMAIS d'erreur rate-limit visible pour l'utilisateur.
    """
    import httpx as httpx_client
    import asyncio

    # -- Phase 1: Mistral (3 modeles max, rotation rapide) --
    mistral_models = [model] + (fallback_models or [])[:2]

    for model_idx, current_model in enumerate(mistral_models):
        for attempt in range(2):
            try:
                payload: Dict[str, Any] = {
                    "model": current_model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                }
                if response_format:
                    payload["response_format"] = response_format

                async with httpx_client.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        "https://api.mistral.ai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    if response.status_code == 200:
                        data = response.json()
                        c = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        if c:
                            if model_idx > 0 or attempt > 0:
                                print(f"[MISTRAL_VISION] Success with {current_model} (attempt {attempt+1})", flush=True)
                            return c.strip()
                    if response.status_code == 429:
                        print(f"[MISTRAL_VISION] {current_model} rate-limited, next model", flush=True)
                        break
                    print(f"[MISTRAL_VISION] {current_model} error {response.status_code}: {response.text[:200]}", flush=True)
                    break
            except Exception as e:
                print(f"[MISTRAL_VISION] {current_model} exception: {e}", flush=True)
                if attempt == 0:
                    await asyncio.sleep(2)
                    continue
                break

    # -- Phase 2: Anthropic Claude Vision (remplace OpenAI) --
    print(f"[VISION_FALLBACK] Mistral exhausted, trying Claude Vision...", flush=True)
    try:
        import os as _os
        anthropic_key = _os.environ.get("ANTHROPIC_API_KEY", "")
        if anthropic_key:
            # Convert Mistral messages format to Anthropic format
            claude_messages = []
            for msg in messages:
                role = msg.get("role", "user")
                raw_content = msg.get("content", "")
                if isinstance(raw_content, str):
                    claude_messages.append({"role": role, "content": raw_content})
                elif isinstance(raw_content, list):
                    claude_content = []
                    for item in raw_content:
                        if isinstance(item, dict):
                            if item.get("type") == "text":
                                claude_content.append(item)
                            elif item.get("type") == "image_url":
                                img_url = item.get("image_url", "")
                                url_str = ""
                                if isinstance(img_url, str):
                                    url_str = img_url
                                elif isinstance(img_url, dict):
                                    url_str = img_url.get("url", "")
                                # Convert data URI to Anthropic image block
                                if url_str.startswith("data:"):
                                    parts = url_str.split(",", 1)
                                    media_type = parts[0].replace("data:", "").replace(";base64", "")
                                    b64 = parts[1] if len(parts) > 1 else ""
                                    claude_content.append({
                                        "type": "image",
                                        "source": {"type": "base64", "media_type": media_type, "data": b64}
                                    })
                                else:
                                    claude_content.append({"type": "text", "text": "[Image URL]"})
                        else:
                            claude_content.append(item)
                    claude_messages.append({"role": role, "content": claude_content})
                else:
                    claude_messages.append({"role": role, "content": str(raw_content)})

            for claude_attempt in range(2):
                try:
                    async with httpx_client.AsyncClient(timeout=timeout) as client:
                        resp = await client.post(
                            "https://api.anthropic.com/v1/messages",
                            headers={
                                "x-api-key": anthropic_key,
                                "anthropic-version": "2023-06-01",
                                "Content-Type": "application/json",
                            },
                            json={
                                "model": "claude-sonnet-4-20250514",
                                "max_tokens": max_tokens or 1024,
                                "messages": claude_messages,
                            },
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            answer = ""
                            for block in data.get("content", []):
                                if block.get("type") == "text":
                                    answer += block.get("text", "")
                            if answer:
                                print(f"[VISION_FALLBACK] Claude Vision success!", flush=True)
                                return answer.strip()
                        if resp.status_code == 429:
                            print(f"[VISION_FALLBACK] Claude rate-limited, attempt {claude_attempt+1}/2", flush=True)
                            await asyncio.sleep(5)
                            continue
                        print(f"[VISION_FALLBACK] Claude error {resp.status_code}: {resp.text[:200]}", flush=True)
                        break
                except Exception as e:
                    print(f"[VISION_FALLBACK] Claude exception: {e}", flush=True)
                    if claude_attempt == 0:
                        await asyncio.sleep(3)
                        continue
                    break
        else:
            print(f"[VISION_FALLBACK] No ANTHROPIC_API_KEY, skipping", flush=True)
    except Exception as e:
        print(f"[VISION_FALLBACK] Claude setup error: {e}", flush=True)

    # -- Phase 3: Last resort - progressive backoff retries on Mistral --
    for retry_idx, wait_secs in enumerate([20, 40, 60]):
        print(f"[VISION_FALLBACK] Retry {retry_idx+1}/3 - waiting {wait_secs}s for rate limit reset...", flush=True)
        await asyncio.sleep(wait_secs)
        try:
            retry_model = mistral_models[retry_idx % len(mistral_models)]
            payload = {"model": retry_model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
            if response_format:
                payload["response_format"] = response_format
            async with httpx_client.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=payload,
                )
                if response.status_code == 200:
                    data = response.json()
                    c = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if c:
                        print(f"[VISION_FALLBACK] Retry {retry_idx+1} success with {retry_model}", flush=True)
                        return c.strip()
                if response.status_code == 429:
                    print(f"[VISION_FALLBACK] Retry {retry_idx+1} still rate-limited, continuing...", flush=True)
                    continue
                print(f"[VISION_FALLBACK] Retry {retry_idx+1} error {response.status_code}", flush=True)
        except Exception as e:
            print(f"[VISION_FALLBACK] Retry {retry_idx+1} exception: {e}", flush=True)

    print(f"[VISION_FALLBACK] FINAL FAILURE after 3 retries (total ~2min wait)", flush=True)
    return None


async def _detect_video_screenshot(
    image: Any,
    api_key: str,
) -> Optional[Dict[str, str]]:
    """
    📱 Détecte si une image est une capture d'écran YouTube/TikTok.

    Utilise l'API OCR dédiée de Mistral (/v1/ocr) qui a son propre rate limit
    séparé du chat completions. Extrait le texte visible puis parse pour
    trouver des URLs YouTube/TikTok et des indices de plateforme.

    Aucun appel Vision (chat completions) — zéro impact sur le quota chat.
    """
    import httpx as httpx_client
    import re

    b64_data = image.data
    if b64_data.startswith("data:"):
        b64_data = b64_data.split(",", 1)[-1]
    data_uri = f"data:{image.mime_type};base64,{b64_data}"

    try:
        # ── Étape 1 : OCR via /v1/ocr (quota séparé) ──
        async with httpx_client.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/ocr",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-ocr-latest",
                    "document": {
                        "type": "image_url",
                        "image_url": data_uri,
                    },
                },
            )

            if response.status_code != 200:
                logger.warning(f"[SCREENSHOT_DETECT] OCR API error: {response.status_code}")
                return None

            ocr_data = response.json()
            # Assembler tout le texte OCR
            ocr_text = ""
            for page in ocr_data.get("pages", []):
                ocr_text += page.get("markdown", "") + "\n"

            if not ocr_text.strip():
                return None

        logger.info(f"[SCREENSHOT_DETECT] OCR extracted {len(ocr_text)} chars")

        # ── Étape 2 : Chercher des URLs YouTube/TikTok dans le texte OCR ──
        video_url = None
        platform = None

        # YouTube URLs
        yt_patterns = [
            r'(https?://(?:www\.)?youtube\.com/watch\?v=[A-Za-z0-9_-]+[^\s\)\"\']*)',
            r'(https?://youtu\.be/[A-Za-z0-9_-]+[^\s\)\"\']*)',
            r'(https?://(?:www\.)?youtube\.com/shorts/[A-Za-z0-9_-]+[^\s\)\"\']*)',
            r'(youtube\.com/watch\?v=[A-Za-z0-9_-]+[^\s\)\"\']*)',
        ]
        for pattern in yt_patterns:
            match = re.search(pattern, ocr_text)
            if match:
                url = match.group(1)
                if not url.startswith("http"):
                    url = "https://" + url
                video_url = url
                platform = "youtube"
                logger.info(f"[SCREENSHOT_DETECT] YouTube URL found in OCR: {video_url}")
                break

        # TikTok URLs
        if not video_url:
            tt_patterns = [
                r'(https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+[^\s\)\"\']*)',
                r'(https?://vm\.tiktok\.com/[\w-]+[^\s\)\"\']*)',
                r'(tiktok\.com/@[\w.-]+/video/\d+)',
            ]
            for pattern in tt_patterns:
                match = re.search(pattern, ocr_text)
                if match:
                    url = match.group(1)
                    if not url.startswith("http"):
                        url = "https://" + url
                    video_url = url
                    platform = "tiktok"
                    logger.info(f"[SCREENSHOT_DETECT] TikTok URL found in OCR: {video_url}")
                    break

        # ── Étape 3 : Si pas d'URL, chercher des indices de plateforme ──
        if not platform:
            ocr_lower = ocr_text.lower()
            yt_indicators = [
                "youtube", "subscribe", "s'abonner", "views", "vues", "shorts",
                "j'aime", "dislike", "partager", "enregistrer", "save",
                "playlist", "regarder plus tard", "watch later", "abonnés", "subscribers",
            ]
            tt_indicators = [
                "tiktok", "pour toi", "for you", "fyp", "following",
                "suivre", "likes", "duet", "stitch", "son original",
                "original sound", "partager", "répondre", "discover", "créer",
            ]

            yt_score = sum(1 for ind in yt_indicators if ind in ocr_lower)
            tt_score = sum(1 for ind in tt_indicators if ind in ocr_lower)

            # Lower threshold if @username detected (strong platform signal)
            has_at_user = bool(re.search(r'@[\w.-]{2,30}', ocr_text))
            threshold = 1 if has_at_user else 2

            if yt_score >= threshold and yt_score > tt_score:
                platform = "youtube"
            elif tt_score >= threshold:
                platform = "tiktok"

        if not platform:
            return None

        # ── Étape 4 : Extraire titre et chaîne du texte OCR ──
        # Filtrer le bruit : onglets navigateur, barres d'adresse, UI Chrome
        lines = [l.strip() for l in ocr_text.split('\n') if l.strip()]

        # Mots-clés qui indiquent du bruit navigateur (titres d'onglets, barre d'adresse)
        browser_noise = [
            'connexion', 'chrome', 'edge', 'firefox', 'copilot', 'bing', 'google.com',
            'nouvel onglet', 'new tab', 'favoris', 'bookmarks', 'translate', 'extensions',
            'paramètres', 'settings', 'téléchargements', 'downloads', 'historique',
            'http://', 'https://', '.com/', '.fr/', 'www.', '://','\\|',
        ]
        # Filtrer les lignes qui ressemblent à des onglets ou de la navigation
        clean_lines = []
        for line in lines:
            ll = line.lower()
            # Skip si c'est clairement une barre d'onglets (séparée par | ou · avec des noms de sites)
            if ll.count('|') >= 2 or ll.count('·') >= 2:
                continue
            # Skip si la ligne contient surtout du bruit navigateur
            noise_count = sum(1 for nw in browser_noise if nw in ll)
            if noise_count >= 2 and len(line) < 80:
                continue
            # Skip URL brutes
            if re.match(r'^https?://\S+$', line.strip()):
                continue
            clean_lines.append(line)

        # Chercher des patterns de chaîne (@username) dans le texte FILTRÉ
        channel = None
        for cl in clean_lines:
            channel_match = re.search(r'@([\w.-]{2,30})', cl)
            if channel_match:
                channel = f"@{channel_match.group(1)}"
                break

        # Trouver le titre vidéo dans les lignes nettoyées
        candidate_titles = []
        for line in clean_lines:
            if len(line) < 10:
                continue
            if line.startswith('@') and len(line.split()) <= 2:
                continue
            if re.match(r'^[\d\s.,:%]+$', line):
                continue
            # Filtrer les éléments d'UI courts
            ui_words = [
                'subscribe', "s'abonner", 'views', 'vues', 'likes', 'share',
                'partager', 'follow', 'j\'aime', 'enregistrer', 'save',
                'clip', 'remix', 'thanks', 'merci', 'download',
            ]
            if any(w in line.lower() for w in ui_words) and len(line) < 40:
                continue
            candidate_titles.append(line)

        # Préférer la ligne la plus longue (souvent le titre vidéo)
        video_title = max(candidate_titles, key=len) if candidate_titles else (clean_lines[0] if clean_lines else None)
        if video_title:
            video_title = video_title[:120]

        # Construire la query de recherche
        parts = []
        if video_title:
            parts.append(video_title[:80])
        if channel:
            parts.append(channel)
        search_query = " ".join(parts) if parts else None

        logger.info(f"[SCREENSHOT_DETECT] Detected {platform}: url='{video_url}' title='{video_title}' channel='{channel}'")

        return {
            "platform": platform,
            "search_query": search_query,
            "video_title": video_title,
            "channel": channel,
            "video_url": video_url,
        }

    except Exception as e:
        logger.warning(f"[SCREENSHOT_DETECT] Error: {e}")
        return None




def _is_garbage_query(query: str) -> bool:
    """Check if OCR-extracted query is garbage (mostly symbols, numbers, too short)."""
    if not query or len(query.strip()) < 5:
        return True
    q = query.strip()
    # Mostly digits/spaces/symbols
    alpha_chars = sum(1 for c in q if c.isalpha())
    if alpha_chars < 5:
        return True
    # Repetitive patterns (0 0 0 0...)
    words = q.split()
    if len(words) > 3 and len(set(words)) <= 2:
        return True
    # HTML entities
    if '&lt;' in q or '&gt;' in q or '&amp;' in q:
        return True
    # Too many hashtags or special chars relative to real words
    hashtag_count = q.count('#')
    if hashtag_count >= 2 and alpha_chars < 15:
        return True
    # Garbled OCR: high ratio of digits+symbols to letters
    non_alpha = sum(1 for c in q if not c.isalpha() and not c.isspace())
    if len(q) > 8 and non_alpha > alpha_chars:
        return True
    # Single "word" queries that look like garbled text (no spaces, lots of digits)
    if len(words) <= 2 and any(len(w) > 5 and sum(c.isdigit() for c in w) > len(w) * 0.3 for w in words):
        return True
    # Starts with "Playlist:" but has garbled content after
    import re as _re_gb
    if _re_gb.match(r'^(Playlist|Mix|Queue)\s*:', q, _re_gb.IGNORECASE):
        after_colon = q.split(':', 1)[1].strip() if ':' in q else ""
        if len(after_colon) < 10 or sum(1 for c in after_colon if c.isalpha()) < 5:
            return True
    return False


async def _detect_video_screenshot_vision(
    image,
    api_key: str,
    platform: str = "youtube",
) -> Optional[Dict[str, str]]:
    """
    Fallback Vision: use Mistral/Claude vision to extract title + channel
    from a YouTube/TikTok screenshot when OCR gives garbage.
    Multi-model fallback: pixtral-12b → pixtral-large → mistral-small → Claude Vision
    """
    import httpx as httpx_client
    import re as re_mod

    b64_data = image.data
    if b64_data.startswith("data:"):
        b64_data = b64_data.split(",", 1)[-1]

    platform_name = "YouTube" if platform == "youtube" else "TikTok"
    prompt_text = (
        f"This is a screenshot of a {platform_name} video page. "
        f"Your task is to identify the EXACT video being watched.\n\n"
        f"Extract the following information visible on screen:\n"
        f"1. The video TITLE (the main, large title text of the video being played)\n"
        f"2. The CHANNEL name (the creator/uploader name below the title)\n"
        f"3. If visible in the browser address bar, the video URL or video ID\n\n"
        f"Reply in this exact format:\n"
        f"TITLE: <the exact video title as shown on screen>\n"
        f"CHANNEL: <the channel name>\n"
        f"URL: <the video URL if visible, otherwise UNKNOWN>\n"
        f"If you cannot find a field, write UNKNOWN for that field.\n"
        f"IMPORTANT: Focus on the MAIN video being watched, not suggested/related videos."
    )

    def _parse_vision_response(answer: str):
        title_match = re_mod.search(r"TITLE:\s*(.+)", answer)
        channel_match = re_mod.search(r"CHANNEL:\s*(.+)", answer)
        url_match = re_mod.search(r"URL:\s*(.+)", answer)
        title = title_match.group(1).strip() if title_match else None
        channel = channel_match.group(1).strip() if channel_match else None
        url_text = url_match.group(1).strip() if url_match else None
        if title and title.upper() == "UNKNOWN":
            title = None
        if channel and channel.upper() == "UNKNOWN":
            channel = None
        # Extract video URL from Vision response
        video_url = None
        if url_text and url_text.upper() != "UNKNOWN":
            yt_id_match = re_mod.search(r"(?:v=|youtu\.be/|shorts/)([A-Za-z0-9_-]{11})", url_text)
            if yt_id_match:
                video_url = f"https://www.youtube.com/watch?v={yt_id_match.group(1)}"
            tt_match = re_mod.search(r"(tiktok\.com/@[\w.-]+/video/\d+)", url_text)
            if tt_match and not video_url:
                video_url = f"https://www.{tt_match.group(1)}"
        if not title and not channel and not video_url:
            return None
        parts = []
        if title:
            parts.append(title[:80])
        if channel:
            parts.append(channel[:30])
        search_query = " ".join(parts)
        print(f"\U0001f50d [SCREENSHOT_VISION] Extracted: title=\'{title}\' channel=\'{channel}\' url=\'{video_url}\' query=\'{search_query}\'", flush=True)
        return {
            "platform": platform,
            "search_query": search_query,
            "video_title": title,
            "channel": channel,
            "video_url": video_url,
        }

    # ── Try Mistral models (pixtral-12b first, then small) ──
    mistral_models = ["pixtral-12b-2409", "pixtral-large-2411", "mistral-small-2603"]
    for model in mistral_models:
        try:
            async with httpx_client.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{image.mime_type};base64,{b64_data}"
                                    }
                                },
                                {"type": "text", "text": prompt_text}
                            ]
                        }],
                        "max_tokens": 150,
                        "temperature": 0.0,
                    },
                )

                if response.status_code == 429:
                    print(f"[SCREENSHOT_VISION] {model} rate-limited, trying next...", flush=True)
                    continue
                if response.status_code != 200:
                    print(f"[SCREENSHOT_VISION] {model} error: {response.status_code}", flush=True)
                    continue

                data = response.json()
                answer = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                print(f"[SCREENSHOT_VISION] {model} response: {answer[:200]}", flush=True)

                result = _parse_vision_response(answer)
                if result:
                    return result

        except Exception as e:
            print(f"[SCREENSHOT_VISION] {model} exception: {e}", flush=True)
            continue

    # ── Fallback: Anthropic Claude Vision (remplace OpenAI) ──
    try:
        import os as _os
        anthropic_key = _os.environ.get("ANTHROPIC_API_KEY", "")
        if anthropic_key:
            print(f"[SCREENSHOT_VISION] Trying Claude Vision fallback...", flush=True)
            async with httpx_client.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": anthropic_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 150,
                        "messages": [{
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": image.mime_type,
                                        "data": b64_data,
                                    }
                                },
                                {"type": "text", "text": prompt_text}
                            ]
                        }],
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    answer = ""
                    for block in data.get("content", []):
                        if block.get("type") == "text":
                            answer += block.get("text", "")
                    print(f"[SCREENSHOT_VISION] Claude response: {answer[:200]}", flush=True)
                    result = _parse_vision_response(answer)
                    if result:
                        return result
                else:
                    print(f"[SCREENSHOT_VISION] Claude error: {response.status_code} {response.text[:200]}", flush=True)
        else:
            print(f"[SCREENSHOT_VISION] No ANTHROPIC_API_KEY, skipping", flush=True)
    except Exception as e:
        print(f"[SCREENSHOT_VISION] Claude exception: {e}", flush=True)

    print("[SCREENSHOT_VISION] All models exhausted, no title found", flush=True)
    return None



async def _search_video_from_screenshot(
    search_query: str,
    platform: str,
    screenshot_data: Optional[Dict[str, str]] = None,
) -> Optional[str]:
    """
    Recherche une video YouTube/TikTok a partir des infos extraites d un screenshot.

    Strategie multi-fallback :
    - YouTube : yt-dlp ytsearch (titre + chaine)
    - TikTok : yt-dlp search sur TikTok (titre + @username)
    - Fallback : Brave Search API si yt-dlp echoue
    """
    if not search_query or len(search_query.strip()) < 3:
        return None

    import subprocess
    import asyncio
    import json as json_module

    try:
        if platform == "youtube":
            cmd = [
                "yt-dlp",
                "--dump-json",
                "--flat-playlist",
                "--no-warnings",
                "--geo-bypass",
                f"ytsearch5:{search_query}",
            ]

            loop = asyncio.get_event_loop()

            def run_yt_search():
                try:
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
                    return result.stdout
                except Exception:
                    return ""

            stdout = await loop.run_in_executor(None, run_yt_search)

            if stdout:
                for line in stdout.strip().split("\n"):
                    if line:
                        try:
                            video = json_module.loads(line)
                            video_id = video.get("id")
                            if video_id:
                                url = f"https://www.youtube.com/watch?v={video_id}"
                                logger.info(f"[SCREENSHOT_SEARCH] Found YouTube: {url} ({video.get('title', '?')})")
                                return url
                        except json_module.JSONDecodeError:
                            continue

            # Fallback: Brave Search API
            brave_url = await _brave_search_video(search_query, "youtube")
            if brave_url:
                return brave_url

        elif platform == "tiktok":
            # yt-dlp TikTok search
            tiktok_query = search_query
            cmd = [
                "yt-dlp",
                "--dump-json",
                "--flat-playlist",
                "--no-warnings",
                f"tiktoksearch3:{tiktok_query}",
            ]

            loop = asyncio.get_event_loop()

            def run_tt_search():
                try:
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
                    return result.stdout
                except Exception:
                    return ""

            stdout = await loop.run_in_executor(None, run_tt_search)

            if stdout:
                for line in stdout.strip().split("\n"):
                    if line:
                        try:
                            video = json_module.loads(line)
                            video_url = video.get("webpage_url") or video.get("url")
                            if video_url and "tiktok.com" in video_url:
                                logger.info(f"[SCREENSHOT_SEARCH] Found TikTok: {video_url}")
                                return video_url
                            video_id = video.get("id")
                            uploader = video.get("uploader_id") or video.get("uploader")
                            if video_id and uploader:
                                url = f"https://www.tiktok.com/@{uploader}/video/{video_id}"
                                logger.info(f"[SCREENSHOT_SEARCH] Found TikTok (constructed): {url}")
                                return url
                        except json_module.JSONDecodeError:
                            continue

            # Fallback: Brave Search API
            brave_url = await _brave_search_video(search_query, "tiktok")
            if brave_url:
                return brave_url

            logger.info(f"[SCREENSHOT_SEARCH] TikTok not found for: '{search_query}'")

    except Exception as e:
        logger.warning(f"[SCREENSHOT_SEARCH] Error: {e}")

    return None


async def _brave_search_video(query: str, platform: str) -> Optional[str]:
    """
    Recherche une video via Brave Search API quand yt-dlp echoue.
    Utile pour les screenshots mobile sans URL.
    """
    try:
        from core.config import BRAVE_SEARCH_API_KEY
        brave_key = BRAVE_SEARCH_API_KEY
        if not brave_key:
            return None

        import httpx as httpx_client
        import re as re_module

        site_filter = "site:youtube.com OR site:youtu.be" if platform == "youtube" else "site:tiktok.com"
        search_q = f"{query} {site_filter}"

        async with httpx_client.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"X-Subscription-Token": brave_key, "Accept": "application/json"},
                params={"q": search_q, "count": 5},
            )

            if response.status_code != 200:
                return None

            results = response.json().get("web", {}).get("results", [])
            for r in results:
                url = r.get("url", "")
                if platform == "youtube" and re_module.search(
                    r'youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/', url
                ):
                    logger.info(f"[BRAVE_SEARCH] Found YouTube: {url}")
                    return url
                elif platform == "tiktok" and re_module.search(
                    r'tiktok\.com/.*/video/\d+|tiktok\.com/@', url
                ):
                    logger.info(f"[BRAVE_SEARCH] Found TikTok: {url}")
                    return url

    except Exception as e:
        logger.warning(f"[BRAVE_SEARCH] Error: {e}")

    return None


async def _analyze_images_background(
    task_id: str,
    images: list,
    image_id: str,
    title: Optional[str],
    context: Optional[str],
    user_id: int,
    mode: str,
    lang: str,
    model: str,
    category: Optional[str] = None,
):
    """
    📸 Analyse des images en background avec Mistral Vision.

    Pipeline :
    1. Envoyer les images à Mistral Vision (OCR + description)
    2. Si plusieurs images : faire le lien narratif entre elles
    3. Assembler un pseudo-transcript
    4. Générer la synthèse DeepSight classique
    5. Sauvegarder comme un Summary (platform="images")
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from db.database import async_session_maker

    print(f"📸 [IMAGES] Starting analysis for {image_id} ({len(images)} images)", flush=True)

    try:
        _task_store[task_id]["progress"] = 5
        _task_store[task_id]["message"] = "Préparation des images..."

        # ─── Phase 1 : Analyse Vision de toutes les images ───
        _task_store[task_id]["progress"] = 10
        _task_store[task_id]["message"] = "Extraction du texte et analyse visuelle (Mistral Vision)..."

        api_key = get_mistral_key()
        if not api_key:
            raise Exception("Clé Mistral API non configurée")

        # ─── Phase 0 : Détection screenshot YouTube/TikTok ───
        # Si 1 seule image, vérifier si c'est une capture d'écran d'app vidéo
        if len(images) == 1 and not title:
            _task_store[task_id]["message"] = "Détection du type d'image..."
            screenshot_result = await _detect_video_screenshot(images[0], api_key)

            if screenshot_result:
                platform = screenshot_result.get("platform")  # "youtube" ou "tiktok"
                ocr_query = screenshot_result.get("search_query", "")
                video_url = screenshot_result.get("video_url")
                search_query = ocr_query

                print(f"📱 [IMAGES] Screenshot detected: {platform} — OCR query: '{ocr_query}' — URL: {video_url}", flush=True)

                # TOUJOURS appeler Vision quand OCR n'a pas trouvé d'URL directe
                # Vision est beaucoup plus fiable que le parsing OCR pour extraire titre/chaîne
                if not video_url:
                    print(f"🔍 [IMAGES] No direct URL from OCR, calling Vision for title extraction...", flush=True)
                    _task_store[task_id]["message"] = f"Analyse visuelle du screenshot {platform}..."
                    vision_result = await _detect_video_screenshot_vision(images[0], api_key, platform)
                    if vision_result:
                        vision_query = vision_result.get("search_query", "")
                        vision_url = vision_result.get("video_url")
                        if vision_url:
                            video_url = vision_url
                        # Préférer la query Vision sauf si elle est aussi garbage
                        if vision_query and not _is_garbage_query(vision_query):
                            search_query = vision_query
                            print(f"✅ [IMAGES] Vision query (primary): '{search_query}'", flush=True)
                        elif not _is_garbage_query(ocr_query):
                            search_query = ocr_query
                            print(f"⚠️ [IMAGES] Vision failed, using OCR query: '{search_query}'", flush=True)
                        else:
                            print(f"❌ [IMAGES] Both Vision and OCR queries are garbage", flush=True)
                    elif not _is_garbage_query(ocr_query):
                        print(f"⚠️ [IMAGES] Vision returned nothing, using OCR query: '{search_query}'", flush=True)
                    else:
                        print(f"❌ [IMAGES] Vision failed and OCR query is garbage: '{ocr_query}'", flush=True)

                _task_store[task_id]["progress"] = 15
                _task_store[task_id]["message"] = f"Capture d'écran {platform} détectée ! Recherche de la vidéo..."

                # Chercher la vidéo originale
                found_url = video_url
                if not found_url and search_query and not _is_garbage_query(search_query):
                    found_url = await _search_video_from_screenshot(search_query, platform)

                # Last resort: if Vision gave us a query but search failed, OR if everything failed,
                # try Brave Search with whatever clean text we can extract from OCR
                if not found_url and screenshot_result:
                    # Try to build a minimal query from OCR non-garbage lines
                    _ocr_title = screenshot_result.get("video_title", "")
                    _ocr_channel = screenshot_result.get("channel", "")
                    if _ocr_channel and len(_ocr_channel) > 2:
                        # Channel name is often reliable even when title is garbage
                        _brave_q = f"{_ocr_channel} {platform} video"
                        print(f"🔎 [IMAGES] Last resort Brave search with channel: '{_brave_q}'", flush=True)
                        found_url = await _brave_search_video(_brave_q, platform)

                if found_url:
                    print(f"🎯 [IMAGES] Video found: {found_url}", flush=True)

                    # Extraire le video_id et lancer l'analyse vidéo classique
                    import asyncio
                    from uuid import uuid4 as _uuid4

                    if platform == "tiktok":
                        vid_id = extract_tiktok_video_id(found_url)
                    else:
                        vid_id = extract_video_id(found_url)

                    if vid_id:
                        # Récupérer le plan et modèle de l'utilisateur
                        async with async_session_maker() as _db:
                            from sqlalchemy import select as _select
                            _user = (await _db.execute(
                                _select(User).where(User.id == user_id)
                            )).scalar_one_or_none()
                            _plan = _user.plan if _user else "free"

                        _plan_limits = PLAN_LIMITS.get(_plan, PLAN_LIMITS["free"])
                        _model = _plan_limits.get("default_model", "mistral-small-2603")
                        _credit_cost = get_credit_cost("video_analysis", _model) if SECURITY_AVAILABLE else 1

                        # Créer un nouveau task pour l'analyse vidéo
                        new_task_id = str(_uuid4())
                        _task_store[new_task_id] = {
                            "status": "processing",
                            "progress": 0,
                            "message": f"Analyse de la vidéo {platform} en cours...",
                            "user_id": user_id,
                            "video_id": vid_id,
                            "credit_cost": _credit_cost,
                        }

                        # Lancer l'analyse vidéo v6 en background
                        asyncio.create_task(
                            _analyze_video_background_v6(
                                task_id=new_task_id,
                                video_id=vid_id,
                                url=found_url,
                                mode=mode or "standard",
                                category=None,
                                lang=lang,
                                model=_model,
                                user_id=user_id,
                                user_plan=_plan,
                                credit_cost=_credit_cost,
                                deep_research=False,
                                platform=platform,
                            )
                        )

                        # Signaler la redirection au frontend (status "redirect" + new_task_id)
                        _task_store[task_id]["status"] = "redirect"
                        _task_store[task_id]["progress"] = 100
                        _task_store[task_id]["message"] = f"Capture {platform} détectée ! Redirection vers l'analyse vidéo..."
                        _task_store[task_id]["result"] = {
                            "new_task_id": new_task_id,
                            "platform": platform,
                            "video_url": found_url,
                            "video_id": vid_id,
                        }
                        print(f"✅ [IMAGES] Screenshot → video redirect: {found_url} → new_task={new_task_id}", flush=True)
                        return
                    else:
                        print(f"⚠️ [IMAGES] Could not extract video_id from {found_url}", flush=True)
                else:
                    print(f"⚠️ [IMAGES] Video not found for query '{search_query}', falling back to image analysis", flush=True)
                    _task_store[task_id]["message"] = "Vidéo non trouvée, analyse de l'image en cours..."

        # Construire le message multimodal
        vision_model = "mistral-small-2603"  # Vision-capable, cost-effective
        image_count = len(images)

        if lang == "fr":
            if image_count == 1:
                user_instruction = (
                    "Analyse cette image en détail.\n\n"
                    "Fournis :\n"
                    "1. **[OCR]** Tout le texte visible, exactement comme écrit\n"
                    "2. **[VISUEL]** Description des éléments visuels (graphiques, photos, schémas, captures d'écran)\n"
                    "3. **[TYPE]** Type d'image (capture d'écran, infographie, photo, document, schéma, meme, tableau)\n"
                    "4. **[SENS]** Le message principal ou l'information communiquée\n"
                )
            else:
                user_instruction = (
                    f"Analyse ces {image_count} images comme un ENSEMBLE COHÉRENT.\n\n"
                    "Pour chaque image, fournis :\n"
                    "1. **[OCR]** Tout le texte visible\n"
                    "2. **[VISUEL]** Description des éléments visuels\n"
                    "3. **[TYPE]** Type d'image\n\n"
                    "Puis OBLIGATOIREMENT une section finale :\n"
                    "**[LIENS ENTRE IMAGES]**\n"
                    "- Quel est le fil conducteur ou la logique narrative entre les images ?\n"
                    "- Comment les images se complètent-elles ?\n"
                    "- Quel message global émerge de l'ensemble ?\n"
                    "\nFormat de réponse pour chaque image :\n"
                    "[Image N]\n"
                    "OCR: ...\nVisuel: ...\nType: ...\n"
                )
        else:
            if image_count == 1:
                user_instruction = (
                    "Analyze this image in detail.\n\n"
                    "Provide:\n"
                    "1. **[OCR]** All visible text, exactly as written\n"
                    "2. **[VISUAL]** Description of visual elements (charts, photos, diagrams, screenshots)\n"
                    "3. **[TYPE]** Image type (screenshot, infographic, photo, document, diagram, meme, table)\n"
                    "4. **[MEANING]** The main message or information conveyed\n"
                )
            else:
                user_instruction = (
                    f"Analyze these {image_count} images as a COHERENT SET.\n\n"
                    "For each image, provide:\n"
                    "1. **[OCR]** All visible text\n"
                    "2. **[VISUAL]** Description of visual elements\n"
                    "3. **[TYPE]** Image type\n\n"
                    "Then MANDATORY final section:\n"
                    "**[LINKS BETWEEN IMAGES]**\n"
                    "- What is the connecting thread or narrative logic between the images?\n"
                    "- How do the images complement each other?\n"
                    "- What overall message emerges from the set?\n"
                    "\nOutput format for each image:\n"
                    "[Image N]\n"
                    "OCR: ...\nVisual: ...\nType: ...\n"
                )

        if context:
            user_instruction += f"\n\nContexte additionnel fourni par l'utilisateur : {context}"

        # Construire le contenu multimodal
        content = [{"type": "text", "text": user_instruction}]
        for img in images:
            # Nettoyer le préfixe data:... si présent
            b64_data = img.data
            if b64_data.startswith("data:"):
                # Extraire le base64 pur après la virgule
                b64_data = b64_data.split(",", 1)[-1]
            data_uri = f"data:{img.mime_type};base64,{b64_data}"
            content.append({"type": "image_url", "image_url": data_uri})

        system_prompt = (
            "Tu es un expert en OCR et analyse d'images. "
            "Tu extrais tout le texte visible et décris les éléments visuels avec précision. "
            f"Réponds en {'français' if lang == 'fr' else 'anglais'}."
        )

        vision_result = await _mistral_vision_request(
            api_key=api_key,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content},
            ],
            model=vision_model,
            max_tokens=6000,
            temperature=0.1,
            timeout=120.0,
            max_retries=2,
            fallback_models=["pixtral-large-2411", "pixtral-12b-2409", "mistral-small-latest", "mistral-medium-2508", "mistral-large-latest"],
        )

        if not vision_result:
            raise Exception("L'analyse d'image n'a pas pu être complétée. Veuillez réessayer.")

        print(f"📸 [IMAGES] Vision analysis complete: {len(vision_result)} chars", flush=True)

        _task_store[task_id]["progress"] = 40
        _task_store[task_id]["message"] = "Texte et visuels extraits. Génération de la synthèse..."

        # ─── Phase 2 : Assembler le pseudo-transcript ───
        header = f"📸 ANALYSE D'IMAGES — {image_count} image(s)" if lang == "fr" else f"📸 IMAGE ANALYSIS — {image_count} image(s)"
        parts = [header]
        if title:
            parts.append(f"{'Titre' if lang == 'fr' else 'Title'} : {title}")
        if context:
            parts.append(f"{'Contexte' if lang == 'fr' else 'Context'} : {context[:500]}")
        parts.append("")
        parts.append(vision_result)

        pseudo_transcript = "\n".join(parts)

        _task_store[task_id]["progress"] = 50
        _task_store[task_id]["message"] = "Détection de catégorie..."

        # ─── Phase 3 : Détection de catégorie ───
        if category and category != "auto":
            detected_category = category
            category_confidence = 1.0
        else:
            detected_category, category_confidence = detect_category(title=title or "", transcript=pseudo_transcript[:5000])

        _task_store[task_id]["progress"] = 60
        _task_store[task_id]["message"] = "Génération de la synthèse DeepSight..."

        # ─── Phase 4 : Générer la synthèse ───
        smart_title = title or (
            f"Analyse d'images ({image_count})" if lang == "fr"
            else f"Image Analysis ({image_count})"
        )

        summary_content = await generate_summary(
            title=smart_title,
            transcript=pseudo_transcript,
            category=detected_category,
            lang=lang,
            mode=mode,
            model=model,
            channel="Images importées" if lang == "fr" else "Imported images",
        )

        _task_store[task_id]["progress"] = 80
        _task_store[task_id]["message"] = "Extraction des entités..."

        # ─── Phase 5 : Entités et fiabilité ───
        entities = await extract_entities(summary_content or pseudo_transcript[:10000], lang=lang)

        _task_store[task_id]["progress"] = 90
        _task_store[task_id]["message"] = "Calcul du score de fiabilité..."

        reliability = await calculate_reliability_score(
            summary_content or pseudo_transcript, entities, lang=lang
        )

        _task_store[task_id]["progress"] = 95
        _task_store[task_id]["message"] = "Sauvegarde..."

        # ─── Phase 6 : Sauvegarder ───
        word_count = len(pseudo_transcript.split())

        # Generate thumbnail from first image
        image_thumbnail_url = ""
        try:
            import base64 as b64_mod
            first_img = images[0]
            b64_data = first_img.data
            if b64_data.startswith("data:"):
                b64_data = b64_data.split(",", 1)[-1]
            raw_bytes = b64_mod.b64decode(b64_data)
            if len(raw_bytes) < 200_000:
                image_thumbnail_url = f"data:{first_img.mime_type};base64,{b64_data[:65536]}"
            else:
                try:
                    from PIL import Image as PILImage
                    from io import BytesIO
                    img = PILImage.open(BytesIO(raw_bytes))
                    img.thumbnail((320, 180), PILImage.LANCZOS)
                    buffer = BytesIO()
                    img.save(buffer, format="JPEG", quality=60)
                    thumb_b64 = b64_mod.b64encode(buffer.getvalue()).decode()
                    image_thumbnail_url = f"data:image/jpeg;base64,{thumb_b64}"
                except Exception:
                    image_thumbnail_url = f"data:{first_img.mime_type};base64,{b64_data[:32768]}"
        except Exception as e:
            print(f"[IMAGES] Thumbnail error: {e}", flush=True)

        async with async_session_maker() as db_session:
            credit_cost = get_credit_cost(model) if SECURITY_AVAILABLE else 1
            await deduct_credit(db_session, user_id, credit_cost, f"images:{image_id}")

            summary_id = await save_summary(
                session=db_session,
                user_id=user_id,
                video_id=image_id,
                video_title=smart_title,
                video_channel="Images importées" if lang == "fr" else "Imported images",
                video_duration=0,
                video_url=f"images://{image_id}",
                thumbnail_url=image_thumbnail_url,
                category=detected_category,
                category_confidence=category_confidence,
                lang=lang,
                mode=mode,
                model_used=model,
                summary_content=summary_content,
                entities_extracted=entities,
                reliability_score=reliability,
                transcript_context=pseudo_transcript[:50000],
                platform="images",
            )

            await db_session.commit()

        _task_store[task_id]["status"] = "completed"
        _task_store[task_id]["progress"] = 100
        _task_store[task_id]["message"] = "Analyse terminée"
        _task_store[task_id]["result"] = {
            "summary_id": summary_id,
            "image_id": image_id,
            "image_count": image_count,
            "word_count": word_count,
            "category": detected_category,
        }

        if NOTIFICATIONS_AVAILABLE:
            await notify_analysis_complete(
                user_id=user_id,
                summary_id=summary_id,
                video_title=smart_title,
                video_id=image_id,
            )

        print(f"✅ [IMAGES] Analysis completed: {image_id} → summary_id={summary_id}", flush=True)

    except Exception as e:
        print(f"❌ [IMAGES] Error: {e}", flush=True)
        import traceback
        traceback.print_exc()

        _task_store[task_id]["status"] = "failed"
        _task_store[task_id]["error"] = str(e)
        _task_store[task_id]["message"] = f"Erreur: {str(e)}"



# ═══════════════════════════════════════════════════════════════════════════════
# 🎞️ SLIDESHOW — Frame extraction for image-only videos (TikTok/YouTube Shorts)
# ═══════════════════════════════════════════════════════════════════════════════

def _is_empty_transcript(transcript: str) -> bool:
    """Detect if a transcript is quasi-empty (slideshow probable)."""
    if not transcript:
        return True
    import re as _re
    cleaned = transcript
    noise_patterns = [
        r'\[(?:Musique|Music|Applause|Applaudissements)\]',
        r'[♪♫🎵🎶]+',
        r'\[.*?\]',
    ]
    for pat in noise_patterns:
        cleaned = _re.sub(pat, '', cleaned, flags=_re.IGNORECASE)
    cleaned = cleaned.strip()
    if len(cleaned) < 50:
        return True
    words = [w for w in cleaned.split() if len(w) > 2]
    return len(words) < 10


async def _extract_slideshow_frames(
    video_url: str,
    platform: str,
    max_frames: int = 10,
    interval_seconds: float = 3.0,
) -> Optional[list]:
    """
    Extract frames from a slideshow video (TikTok/YouTube Short with no speech).
    Returns list of dicts {"data": base64, "mime_type": "image/jpeg"} or None.
    """
    import subprocess
    import asyncio
    import tempfile
    import base64
    import os
    import glob as glob_module

    print(f"🎞️ [SLIDESHOW] Extracting frames from {platform}: {video_url}", flush=True)

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            video_path = os.path.join(tmpdir, "video.mp4")

            download_cmd = [
                "yt-dlp", "--no-warnings", "--geo-bypass",
                "-f", "worst[ext=mp4]/worst",
                "--max-filesize", "50M",
                "-o", video_path, video_url,
            ]

            loop = asyncio.get_event_loop()

            def run_dl():
                try:
                    r = subprocess.run(download_cmd, capture_output=True, text=True, timeout=60)
                    return r.returncode == 0
                except Exception:
                    return False

            ok = await loop.run_in_executor(None, run_dl)
            if not ok or not os.path.exists(video_path):
                print(f"🎞️ [SLIDESHOW] Download failed", flush=True)
                return None

            def get_dur():
                try:
                    r = subprocess.run(
                        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                         "-of", "default=noprint_wrappers=1:nokey=1", video_path],
                        capture_output=True, text=True, timeout=10,
                    )
                    return float(r.stdout.strip())
                except Exception:
                    return 30.0

            duration = await loop.run_in_executor(None, get_dur)

            if duration <= 15:
                interval = max(duration / (max_frames + 1), 1.0)
            elif duration <= 60:
                interval = interval_seconds
            else:
                interval = max(duration / max_frames, 3.0)

            frames_pat = os.path.join(tmpdir, "frame_%04d.jpg")
            ff_cmd = [
                "ffmpeg", "-i", video_path,
                "-vf", f"fps=1/{interval},scale=640:-1",
                "-q:v", "3", "-frames:v", str(max_frames),
                frames_pat, "-y", "-loglevel", "error",
            ]

            def do_ff():
                try:
                    r = subprocess.run(ff_cmd, capture_output=True, text=True, timeout=30)
                    return r.returncode == 0
                except Exception:
                    return False

            ok = await loop.run_in_executor(None, do_ff)
            if not ok:
                print(f"🎞️ [SLIDESHOW] ffmpeg extraction failed", flush=True)
                return None

            frame_files = sorted(glob_module.glob(os.path.join(tmpdir, "frame_*.jpg")))
            if not frame_files:
                print(f"🎞️ [SLIDESHOW] No frames found", flush=True)
                return None

            frames = []
            for fpath in frame_files[:max_frames]:
                with open(fpath, "rb") as f:
                    raw = f.read()
                    frames.append({"data": base64.b64encode(raw).decode(), "mime_type": "image/jpeg"})

            print(f"🎞️ [SLIDESHOW] Extracted {len(frames)} frames from {duration:.1f}s video", flush=True)
            return frames

    except Exception as e:
        print(f"🎞️ [SLIDESHOW] Error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return None


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
