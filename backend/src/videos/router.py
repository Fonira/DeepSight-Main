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

import asyncio
import json
import logging
import math
import os
import httpx
from uuid import uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User, Summary
from auth.dependencies import (
    get_current_user,
    get_verified_user,
    require_plan,
    check_daily_limit,
    require_feature,
    get_current_admin,
)
from core.config import PLAN_LIMITS, CATEGORIES, get_mistral_key
from core.http_client import shared_http_client
from core.logging import logger
from core.moderation_service import moderate_text

# Import du système de sécurité
try:
    from core.security import (
        check_can_analyze as secure_check_can_analyze,
        reserve_credits,
        consume_reserved_credits,
        release_reserved_credits,
        get_credit_cost,
        generate_secure_operation_id,
        verify_resource_ownership,
    )

    SECURITY_AVAILABLE = True
except ImportError:
    SECURITY_AVAILABLE = False
    logger.warning("⚠️ [VIDEO] Security module not available")

from .schemas import (
    AnalyzeVideoRequest,
    AnalyzePlaylistRequest,
    UpdateSummaryRequest,
    SummaryResponse,
    SummaryListItem,
    HistoryResponse,
    CategoryResponse,
    TaskStatusResponse,
    VideoInfoResponse,
    ExtensionSummaryResponse,
    GuestAnalyzeRequest,
    GuestAnalyzeResponse,
    QuickChatRequest,
    QuickChatResponse,
    UpgradeQuickChatRequest,
    UpgradeQuickChatResponse,
    AnalyzeImagesRequest,
    AnalyzeImagesResponse,
)
from images.screenshot_detection import (
    detect_video_screenshot as _detect_video_screenshot,
    detect_video_screenshot_vision as _detect_video_screenshot_vision,
    search_video_from_screenshot as _search_video_from_screenshot,
    mistral_vision_request as _mistral_vision_request,
    is_garbage_query as _is_garbage_query,
    _brave_search_video,
)
from .summary_extractor import extract_extension_summary
from voice.companion_context import invalidate_companion_context_cache
from .service import (
    check_can_analyze,
    deduct_credit,
    save_summary,
    get_summary_by_id,
    get_summary_by_video_id,
    get_user_history,
    update_summary,
    delete_summary,
    delete_all_history,
    create_playlist_analysis,
    get_user_playlists,
    get_playlist_summaries,
    get_user_stats,
    create_task,
    update_task_status,
    get_task,
)
from .analysis import (
    generate_summary,
    detect_category,
    extract_entities,
    calculate_reliability_score,
    CATEGORIES as ANALYSIS_CATEGORIES,
)
from .long_video_analyzer import (
    needs_chunking,
    analyze_long_video,
    get_chunk_stats,
    LongVideoResult,
    store_chunks_in_db,
)
from .web_enrichment import (
    get_pre_analysis_context,
    get_enrichment_level,
    get_enrichment_badge,
    EnrichmentLevel,
    format_sources_markdown,
)
from .raw_text_enhance import (
    enhance_raw_text,
    generate_smart_title,
    generate_thumbnail,
    SourceType,
    SourceContext,
    get_source_specific_instructions,
)

# 📚 Import du système de définitions de concepts
from .concept_definitions import get_concepts_with_definitions, extract_concepts, clean_concept_markers

# 📚 Import des définitions enrichies v2 (Mistral + Perplexity)
from .enriched_definitions import get_enriched_definitions, extract_terms_from_text, get_category_info, CATEGORIES

# 🆕 v2.1: Import des nouveaux modules d'analyse avancée
try:
    from .youtube_comments import analyze_comments
    from .metadata_enriched import get_enriched_metadata, detect_sponsorship, detect_propaganda_risk
    from .anti_ai_prompts import build_customized_prompt, get_anti_ai_prompt, get_style_instruction
    from .schemas import (
        AnalysisCustomization,
        WritingStyle,
        AnalyzeRequestV2,
        AnalyzeResponseV2,
        CommentsAnalysis,
        VideoMetadataEnriched,
    )

    ADVANCED_ANALYSIS_AVAILABLE = True
except ImportError as e:
    ADVANCED_ANALYSIS_AVAILABLE = False
    logger.warning(f"⚠️ [VIDEO] Advanced analysis modules not available: {e}")

# 🕐 Import du système de fraîcheur et fact-check LITE
try:
    from .freshness_factcheck import analyze_freshness, analyze_claims_lite, analyze_content_reliability, FreshnessLevel

    FACTCHECK_LITE_AVAILABLE = True
except ImportError:
    FACTCHECK_LITE_AVAILABLE = False
    logger.warning("⚠️ [VIDEO] Freshness/FactCheck LITE module not available")
from transcripts import (
    extract_video_id,
    extract_playlist_id,
    get_video_info,
    get_transcript_with_timestamps,
    get_playlist_videos,
    get_playlist_info,
)

# 🎵 TikTok support
from transcripts.tiktok import (
    is_tiktok_url,
    extract_tiktok_video_id,
    get_tiktok_video_info,
    get_tiktok_transcript,
    detect_platform,
)

# 🔔 Import du système de notifications (SSE)
try:
    from notifications.router import notify_analysis_complete, notify_analysis_failed

    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False
    logger.warning("⚠️ [VIDEO] Notifications module not available")

    # Fallback: fonctions vides
    async def notify_analysis_complete(*args, **kwargs):
        pass

    async def notify_analysis_failed(*args, **kwargs):
        pass


router = APIRouter()

# 🔴 REDIS-BACKED: TaskStore proxy dict + GuestLimiter (cross-worker)
# Voir core/task_store.py pour l'implémentation.
# _task_store se comporte comme un dict normal mais sync vers Redis en background.
from core.task_store import task_store as _task_store, guest_limiter as _guest_limiter

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
            index_entries = build_structured_index(transcript_timestamped, video_duration, profile.tier)
            if index_entries:
                index_json = serialize_index(index_entries)
                from sqlalchemy import update as sql_update

                await session.execute(
                    sql_update(Summary).where(Summary.id == summary_id).values(structured_index=index_json)
                )
                await session.commit()
                logger.info(
                    f"📑 [v4.0] Structured index saved: {len(index_entries)} entries for summary_id={summary_id}, tier={profile.tier.value}"
                )
            else:
                logger.info(f"📑 [v4.0] No index entries generated for summary_id={summary_id}")
        else:
            logger.info(f"📑 [v4.0] No index needed (tier={profile.tier.value}) for summary_id={summary_id}")
    except Exception as e:
        logger.error(f"⚠️ [v4.0] Structured index failed (non-blocking): {e}")


async def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """
    Public accessor for task status — Redis-backed (cross-worker).
    Utilise aget() pour lire depuis Redis si absent du cache local.
    """
    return await _task_store.aget(task_id)


def set_task_status(task_id: str, data: Dict[str, Any]) -> None:
    """
    Public mutator for task status — écrit dans le cache local + sync Redis.
    Reste synchrone car le flush Redis est batché en background.
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
    session: AsyncSession = Depends(get_session),
):
    """
    Mode Quick Chat - Prepare une video pour le chat IA sans analyse complete.
    Zero credit consomme, temps de reponse ~2-5s.
    """
    import time

    start_time = time.time()
    url = request.url.strip()
    platform = detect_platform(url)
    logger.info(f"[QUICK CHAT] Starting for {platform} URL: {url[:80]}...")

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
        logger.info(f"[QUICK CHAT] Existing summary found: id={existing.id}")
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
            message="Analyse existante trouvee - chat disponible immediatement",
        )

    # 2b. Résoudre les URLs courtes TikTok (vm.tiktok.com → tiktok.com/@user/video/...)
    resolved_url = url
    if platform == "tiktok" and ("vm.tiktok.com" in url or "vt.tiktok.com" in url):
        try:
            async with shared_http_client() as client:
                head_resp = await client.head(url, timeout=8.0)
                if head_resp.status_code in (200, 301, 302) and "tiktok.com" in str(head_resp.url):
                    resolved_url = str(head_resp.url).split("?")[0]  # Drop tracking params
                    logger.info(f"[QUICK CHAT] Resolved short URL → {resolved_url[:80]}")
        except Exception as e:
            logger.error(f"[QUICK CHAT] Short URL resolution failed: {e}")

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
        logger.error(f"[QUICK CHAT] Failed to get video info: {e}")
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
                    logger.warning(f"[QUICK CHAT] oEmbed fallback: thumb={bool(thumbnail_url)}, title={title[:40]}")
        except Exception as e:
            logger.error(f"[QUICK CHAT] oEmbed fallback failed: {e}")

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
        logger.error(f"[QUICK CHAT] Failed to get transcript: {e}")
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
        logger.info(f"[QUICK CHAT] Derived title from transcript: {title[:50]}...")

    # 5. Creer un Summary leger (transcript-only)
    # Securite: tronquer tous les champs VARCHAR avant insert
    safe_video_id = str(video_id)[:100]
    safe_url = str(resolved_url if resolved_url != url else url)[:500]
    safe_thumbnail = str(thumbnail_url)[:500] if thumbnail_url else ""
    try:
        summary_id = await save_summary(
            session=session,
            user_id=current_user.id,
            video_id=safe_video_id,
            video_title=title,
            video_channel=channel,
            video_duration=duration,
            video_url=safe_url,
            thumbnail_url=safe_thumbnail,
            category="general",
            category_confidence=0.0,
            lang=request.lang,
            mode="quick_chat",
            model_used="none",
            summary_content="",
            transcript_context=transcript_text,
            video_upload_date=upload_date,
            platform=platform,
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
        logger.error(f"[QUICK CHAT] Failed to save: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde.")

    # 🖼️ Persist thumbnail to R2 (non-blocking)
    try:
        import asyncio as _aio_qc
        from storage.thumbnail_generator import ensure_thumbnail

        _aio_qc.create_task(
            ensure_thumbnail(
                summary_id=summary_id,
                video_id=video_id,
                title=title,
                category="general",
                platform=platform,
                original_url=thumbnail_url,
                video_url=str(url),
            )
        )
    except Exception as thumb_err:
        logger.error(f"⚠️ [THUMBNAIL] R2 persist failed (non-blocking): {thumb_err}")

    elapsed = time.time() - start_time
    logger.info(f"[QUICK CHAT] Done in {elapsed:.1f}s - summary_id={summary_id}, words={word_count}")

    return QuickChatResponse(
        summary_id=summary_id,
        video_id=video_id,
        video_title=title,
        video_channel=channel,
        video_duration=duration,
        thumbnail_url=thumbnail_url,
        platform=platform,
        transcript_available=True,
        word_count=word_count,
        message=f"Quick Chat pret en {elapsed:.1f}s - {word_count} mots disponibles",
    )


# =========================================================================
# UPGRADE QUICK CHAT -> ANALYSE COMPLETE (conserve historique de chat)
# =========================================================================


@router.post("/quick-chat/upgrade", response_model=UpgradeQuickChatResponse)
async def upgrade_quick_chat(
    request: UpgradeQuickChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
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
        return UpgradeQuickChatResponse(
            task_id="already_done", status="completed", message="Analyse complete deja disponible"
        )

    # 3. Credits
    can, reason, _, _ = await check_can_analyze(session, current_user.id)
    if not can:
        raise HTTPException(status_code=403, detail=reason)
    await deduct_credit(session, current_user.id)

    # 4. Background task
    task_id = str(uuid4())
    _task_store[task_id] = {
        "status": "processing",
        "progress": 10,
        "message": "Analyse en cours...",
        "summary_id": request.summary_id,
    }

    async def run_upgrade():
        from db.database import async_session_maker

        try:
            async with async_session_maker() as bg_session:
                res = await bg_session.execute(
                    sa_select(Summary).where(Summary.id == request.summary_id, Summary.user_id == current_user.id)
                )
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
                        title=s.video_title or "",
                        transcript=s.transcript_context,
                        category=cat,
                        lang=s.lang or "fr",
                        mode=request.mode,
                        channel=s.video_channel or "",
                        platform=s.platform or "youtube",
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
                    reliability = await calculate_reliability_score(
                        summary_content, s.video_title or "", s.video_channel or ""
                    )
                except Exception:
                    reliability = 50.0

                import json as json_mod

                await bg_session.execute(
                    sa_update(Summary)
                    .where(Summary.id == request.summary_id)
                    .values(
                        summary_content=summary_content,
                        category=cat,
                        mode=request.mode,
                        model_used="mistral-small-2603",
                        entities_extracted=json_mod.dumps(entities) if entities else None,
                        reliability_score=reliability,
                        word_count=len(s.transcript_context.split()),
                    )
                )
                await bg_session.commit()
                _task_store[task_id].update({"status": "completed", "progress": 100, "message": "Analyse terminee"})
                logger.info(f"[UPGRADE] Summary {request.summary_id} upgraded OK")
        except Exception as e:
            logger.error(f"[UPGRADE] Failed: {e}")
            _task_store[task_id].update({"status": "failed", "message": f"Erreur: {str(e)[:100]}"})

    background_tasks.add_task(run_upgrade)
    return UpgradeQuickChatResponse(
        task_id=task_id, status="processing", message="Analyse lancee - historique conserve"
    )


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

    # 🔴 Redis-backed guest rate limiting (cross-worker)
    allowed, used_count = await _guest_limiter.check(client_ip)

    if not allowed:
        raise HTTPException(
            status_code=429, detail="Vous avez utilisé vos 3 analyses gratuites. Créez un compte pour continuer !"
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
                detail=f"L'essai gratuit est limité aux vidéos de moins de 5 minutes. Cette vidéo dure {duration // 60}:{duration % 60:02d}.",
            )

        try:
            transcript_text = await get_tiktok_transcript(url)
        except Exception:
            raise HTTPException(
                status_code=400, detail="Impossible de récupérer la transcription de cette vidéo TikTok."
            )

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
                detail=f"L'essai gratuit est limité aux vidéos de moins de 5 minutes. Cette vidéo dure {duration // 60}:{duration % 60:02d}.",
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

    # 6. Marquer IP comme utilisée (Redis-backed)
    await _guest_limiter.record(client_ip)
    remaining = await _guest_limiter.get_remaining(client_ip)

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
    session: AsyncSession = Depends(get_session),
):
    """
    🔐 Lance l'analyse d'une vidéo YouTube avec SÉCURITÉ RENFORCÉE.

    SÉCURITÉ:
    - Email vérifié obligatoire
    - Rate limiting appliqué
    - Crédits réservés AVANT l'opération
    - Coût variable selon le modèle
    """
    logger.info(f"📥 [v6.0] Analyze request: {request.url} by user {current_user.id} (plan: {current_user.plan})")

    async def _invalidate_companion_cache() -> None:
        """Invalidate the companion_context Redis cache for this user (best-effort)."""
        try:
            from core.cache import cache_service

            redis = getattr(cache_service.backend, "redis", None)
            if redis is not None:
                await invalidate_companion_context_cache(redis=redis, user_id=current_user.id)
        except Exception as exc:
            logger.warning("companion cache invalidation skipped: %s", exc)

    # 🎵 Détecter la plateforme (YouTube ou TikTok)
    platform = detect_platform(request.url)

    if platform == "tiktok":
        video_id = extract_tiktok_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={"code": "invalid_url", "message": "Invalid TikTok URL"})
        logger.info(f"🎵 [TIKTOK] Detected TikTok video: {video_id}")
    else:
        video_id = extract_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={"code": "invalid_url", "message": "Invalid YouTube URL"})

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
        can_analyze, reason, info = await secure_check_can_analyze(session, current_user.id, model)
    else:
        # check_can_analyze retourne 4 valeurs: (can_analyze, reason, credits, cost)
        can_analyze, reason, credits_remaining, estimated_cost = await check_can_analyze(session, current_user.id)
        info = {"credits": credits_remaining, "cost": estimated_cost}  # Construire info dict

    if not can_analyze:
        raise HTTPException(
            status_code=403,
            detail={
                "code": reason,
                "message": info.get("message", f"Cannot analyze: {reason}"),
                "credits": info.get("credits", 0),
                "cost": credit_cost,
                **info,
            },
        )

    logger.info(f"🎬 Video ID extracted: {video_id}, cost: {credit_cost} credits")

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
                    logger.info(
                        f"💾 [GLOBAL CACHE HIT] {platform}/{video_id} → summary_id={_cache_summary_id} (0 credits)"
                    )
                    # Generate Mistral extras (synthesis, key_quotes, key_takeaways,
                    # chapter_themes) in the background. Without this, the row inherits
                    # `summary_extras = NULL` from the freshly-saved Summary and the
                    # frontend falls back to rendering raw markdown instead of the
                    # structured "Vue d'ensemble / Citations marquantes" layout —
                    # which is exactly what every other analyze code path does after
                    # save_summary() (cf. lines 1685, 2593, 3454, 4953, 5682).
                    asyncio.create_task(
                        _autogen_summary_extras(current_user.id, _cache_summary_id)
                    )
                    await _invalidate_companion_cache()
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
                        },
                    )
        except Exception as _vcache_err:
            logger.error(f"⚠️ [GLOBAL CACHE] Check failed (continuing): {_vcache_err}")

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
                logger.info(f"💾 [CACHE HIT] Using cached analysis: summary_id={existing.id} (age: {cache_age.days}d)")
                return TaskStatusResponse(
                    task_id=f"cached_{existing.id}",
                    status="completed",
                    progress=100,
                    message="✅ Analyse retrouvée en cache (gratuit!)",
                    result={
                        "summary_id": existing.id,
                        "cached": True,
                        "cache_age_days": cache_age.days,
                        "video_title": existing.video_title,
                        "category": existing.category,
                        "cost": 0,  # Gratuit car cache
                    },
                )
            else:
                logger.info(f"⏰ [CACHE EXPIRED] Cache too old ({cache_age.days} days), re-analyzing...")
    else:
        logger.info("🔄 [FORCE REFRESH] Bypassing cache as requested")

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
            raise HTTPException(
                status_code=403,
                detail={
                    "code": reserve_reason,
                    "message": f"Could not reserve credits: {reserve_reason}",
                    **reserve_info,
                },
            )
        logger.info(f"🔒 Credits reserved: {credit_cost} for task {task_id[:12]}")

    _task_store[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Initializing...",
        "user_id": current_user.id,
        "video_id": video_id,
        "credit_cost": credit_cost,
        "deep_research": deep_research,  # 🆕 v5.5
    }

    logger.info(f"🚀 Task created: {task_id} (deep_research={deep_research})")

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
        platform=platform,  # 🎵 TikTok support
        include_visual_analysis=request.include_visual_analysis,  # 🆕 Phase 2
    )

    await _invalidate_companion_cache()

    return TaskStatusResponse(
        task_id=task_id,
        status="pending",
        progress=0,
        message="Analysis started",
        result={"cost": credit_cost, "deep_research": deep_research},
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
    session: AsyncSession = Depends(get_session),
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
    logger.info(f"📥 [v2.0] Analyze request: {request.url} by user {current_user.id}")

    # 🛡️ Phase 2 — Mistral moderation sur le user_prompt (si présent)
    if getattr(request, "user_prompt", None):
        moderation = await moderate_text(request.user_prompt)
        if not moderation.allowed:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "content_policy_violation",
                    "categories": moderation.flagged_categories,
                },
            )

    # 🎵 Détecter la plateforme
    platform = detect_platform(request.url)

    if platform == "tiktok":
        video_id = extract_tiktok_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={"code": "invalid_url", "message": "Invalid TikTok URL"})
    else:
        video_id = extract_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={"code": "invalid_url", "message": "Invalid YouTube URL"})

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
        can_analyze, reason, info = await secure_check_can_analyze(session, current_user.id, model)
    else:
        can_analyze, reason, credits_remaining, estimated_cost = await check_can_analyze(session, current_user.id)
        info = {"credits": credits_remaining, "cost": estimated_cost}

    if not can_analyze:
        raise HTTPException(
            status_code=403,
            detail={
                "code": reason,
                "message": info.get("message", f"Cannot analyze: {reason}"),
                "credits": info.get("credits", 0),
                "cost": credit_cost,
                **info,
            },
        )

    # Vérifier le cache (sauf si force_refresh)
    if not request.force_refresh:
        existing = await get_summary_by_video_id(session, video_id, current_user.id)
        if existing and existing.mode == request.mode:
            from datetime import timedelta

            cache_age = datetime.now() - existing.created_at
            if cache_age < timedelta(days=7):
                logger.info(f"💾 [CACHE HIT] v2: summary_id={existing.id}")
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
                        "cache_age_days": cache_age.days,
                    },
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
            raise HTTPException(
                status_code=403,
                detail={
                    "code": reserve_reason,
                    "message": f"Could not reserve credits: {reserve_reason}",
                    **reserve_info,
                },
            )
        logger.info(f"🔒 [v2] Credits reserved: {credit_cost} for task {task_id[:12]}")

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
        "custom": request.customization or {},
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
        "v2_options": customization_options,
    }

    logger.info(f"🚀 [v2] Task created: {task_id}")

    # Créer en DB
    await create_task(session, task_id, current_user.id, "video_analysis_v2")

    # Estimer la durée
    estimated_duration = (
        30 if request.summary_length == "short" else (60 if request.summary_length == "standard" else 90)
    )
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
        platform=platform,  # 🎵 TikTok support
    )

    return AnalyzeV2Response(
        task_id=task_id,
        status="pending",
        progress=0,
        message="Analysis v2 started with custom options",
        estimated_duration_seconds=estimated_duration,
        cost=credit_cost,
        applied_options=customization_options,
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
    platform: str = "youtube",
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

    logger.info(f"🔧 [v2.0] Background task started: {task_id}")

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
            if _task_store.get(task_id, {}).get("status") == "cancelled":
                logger.info("Task %s cancelled", task_id[:12])
                if SECURITY_AVAILABLE:
                    await release_reserved_credits(user_id, task_id)
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
                transcript, transcript_timestamped, detected_lang = await get_transcript_with_timestamps(
                    video_id, is_short=_is_short, duration=_duration
                )
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
                        youtube_categories=video_info.get("categories", []),
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
                        upload_date=video_info.get("upload_date", ""),
                    )
                except Exception as e:
                    logger.error(f"⚠️ [v2.0] Web enrichment failed: {e}")
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

            # 👁️ Phase 2 visual hook (V2) — enrich full_context + capture pour persist post-save
            _visual_analysis_data: Optional[Dict[str, Any]] = None
            if options.get("include_visual_analysis", True) and platform in ("youtube", "tiktok"):
                from .visual_integration import enrich_and_capture_visual

                _visual_flag_on = (
                    os.getenv("VISUAL_ANALYSIS_ENABLED", "false").strip().lower()
                    in {"1", "true", "yes", "on"}
                )
                full_context, _visual_analysis_data = await enrich_and_capture_visual(
                    db=session,
                    user_id=user_id,
                    url=url,
                    transcript_excerpt=transcript_to_analyze or "",
                    web_context=full_context or "",
                    flag_enabled=_visual_flag_on,
                    log_tag=f"VISUAL_V2 user={user_id}",
                )

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
                summary_content = (
                    _long_video_result.summary
                    if isinstance(_long_video_result, LongVideoResult)
                    else _long_video_result
                )
                # Fallback si la synthèse a échoué
                if not summary_content:
                    logger.warning("⚠️ [v3.0] Long video analysis returned empty summary, falling back to truncated")
                    truncated = " ".join(transcript_to_analyze.split()[:8000])
                    summary_content = await generate_summary(
                        title=video_info["title"],
                        transcript=truncated,
                        category=category,
                        lang=lang,
                        mode=mode,
                        model=model,
                        duration=video_duration,
                        channel=video_info.get("channel", ""),
                        description=video_info.get("description", "")
                        + "\n\n⚠️ NOTE: Cette vidéo est très longue. Seule la première partie a été analysée.",
                        web_context=full_context,
                        video_id=video_id,
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
                    calculate_reliability_score(summary_content, {}, lang=lang),
                )
                if entities and len(entities) > 5:
                    reliability = min(98, reliability + 2)
            elif _do_entities:
                entities = await extract_entities(summary_content, lang=lang)
            elif _do_reliability:
                reliability = await calculate_reliability_score(summary_content, {}, lang=lang)

            if reliability is not None and enrichment_sources:
                reliability_bonus = {EnrichmentLevel.FULL: 8, EnrichmentLevel.DEEP: 15}.get(enrichment_level, 0)
                reliability = min(98, reliability + reliability_bonus)

            # 8. Consommer les crédits et sauvegarder
            _task_store[task_id]["progress"] = 92
            _task_store[task_id]["message"] = "💾 Sauvegarde des résultats..."

            if SECURITY_AVAILABLE:
                await consume_reserved_credits(
                    session, user_id, task_id, f"Video v2: {video_info['title'][:50]} ({model})"
                )
            else:
                await deduct_credit(session, user_id, credit_cost, f"Video v2: {video_info['title'][:50]}")

            _task_store[task_id]["progress"] = 94
            _task_store[task_id]["message"] = "💾 Enregistrement de l'analyse..."

            enrichment_metadata = None
            if enrichment_sources:
                enrichment_metadata = {
                    "level": enrichment_level.value,
                    "sources": enrichment_sources,
                    "enriched_at": datetime.utcnow().isoformat(),
                    "v2_options": options,
                }

            # Thumbnail dynamique selon la plateforme
            if platform == "tiktok":
                default_thumbnail = video_info.get("thumbnail_url", "")
            else:
                default_thumbnail = video_info.get(
                    "thumbnail_url", f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
                )

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

            # 👁️ Phase 2 plumbing V2 : persist visual_analysis si capturé.
            if _visual_analysis_data is not None:
                try:
                    from sqlalchemy import update as sql_update
                    await session.execute(
                        sql_update(Summary)
                        .where(Summary.id == summary_id)
                        .values(visual_analysis=_visual_analysis_data)
                    )
                    await session.commit()
                    logger.info(
                        f"👁️ [VISUAL_V2] persisted to Summary.visual_analysis (id={summary_id})"
                    )
                except Exception as _vpe:
                    logger.warning(f"👁️ [VISUAL_V2] persist failed (graceful): {_vpe}")
                    await session.rollback()

            # 📚 Auto-générer les extras Mistral (Option A 2026-05-06) —
            # fire-and-forget best-effort, alimente la vue native sectionnée.
            asyncio.create_task(_autogen_summary_extras(user_id, summary_id))

            _task_store[task_id]["progress"] = 97
            _task_store[task_id]["message"] = "🧩 Indexation et finalisation..."

            # 🆕 v4.0: Générer et sauvegarder l'index structuré
            await _save_structured_index(
                session, summary_id, video_info.get("duration", 0), transcript, transcript_timestamped
            )

            # v3.0: Stocker les VideoChunks pour réutilisation par le digest pipeline
            if isinstance(_long_video_result, LongVideoResult) and _long_video_result.chunks:
                try:
                    await store_chunks_in_db(_long_video_result, summary_id, session)
                except Exception as chunk_err:
                    logger.error(f"⚠️ [v3.0] VideoChunk storage failed (non-blocking): {chunk_err}")

            # Incrémenter le quota quotidien
            try:
                from core.plan_limits import increment_daily_usage

                await increment_daily_usage(session, user_id)
            except Exception as quota_err:
                logger.error(f"⚠️ [v2] Quota increment failed: {quota_err}")

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
                    }
                    if enrichment_level != EnrichmentLevel.NONE
                    else None,
                },
            }

            await update_task_status(
                session, task_id, status="completed", progress=100, result=_task_store[task_id]["result"]
            )

            # Notification SSE
            try:
                await notify_analysis_complete(
                    user_id=user_id,
                    summary_id=summary_id,
                    video_title=video_info["title"],
                    video_id=video_id,
                    cached=False,
                )
            except Exception as notify_err:
                logger.error(f"⚠️ [v2] Notification failed: {notify_err}")

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
                                "status": "completed",
                            },
                            timeout=30.0,
                        )
                    logger.info(f"🔔 [v2] Webhook sent to {webhook_url}")
                except Exception as webhook_err:
                    logger.error(f"⚠️ [v2] Webhook failed: {webhook_err}")

            logger.info(f"✅ [v2.0] Task completed: {task_id}")

    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ [v2] Analysis error for task {task_id}: {error_msg}")

        if SECURITY_AVAILABLE:
            await release_reserved_credits(user_id, task_id)

        _task_store[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": f"Error: {error_msg}",
            "user_id": user_id,
            "error": error_msg,
        }

        try:
            await notify_analysis_failed(
                user_id=user_id,
                video_title=video_info.get("title", "Vidéo") if "video_info" in dir() else "Vidéo",
                error=error_msg[:200],
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
    session: AsyncSession = Depends(get_session),
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
    logger.info(f"📥 [v2.1] Advanced analyze request: {request.url} by user {current_user.id}")

    if not ADVANCED_ANALYSIS_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail={"code": "feature_unavailable", "message": "Advanced analysis features are not available"},
        )

    # 🛡️ Phase 2 — Mistral moderation sur le user_prompt (si présent)
    if getattr(request, "user_prompt", None):
        moderation = await moderate_text(request.user_prompt)
        if not moderation.allowed:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "content_policy_violation",
                    "categories": moderation.flagged_categories,
                },
            )

    # 🎵 Détecter la plateforme (YouTube ou TikTok)
    platform = detect_platform(request.url)

    if platform == "tiktok":
        video_id = extract_tiktok_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={"code": "invalid_url", "message": "Invalid TikTok URL"})
        logger.info(f"🎵 [TIKTOK] Detected TikTok video: {video_id}")
    else:
        video_id = extract_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={"code": "invalid_url", "message": "Invalid YouTube URL"})

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
        logger.warning("⚠️ [v2.1] Anti-AI disabled (requires Pro)")

    # Analyse des commentaires: Pro only
    if customization.analyze_comments and not is_premium:
        customization.analyze_comments = False
        logger.warning("⚠️ [v2.1] Comments analysis disabled (requires Pro)")

    # Analyse de propagande: Pro only (advanced feature)
    if customization.detect_propaganda and not (
        current_user.is_admin or current_user.plan in ("pro", "expert")
    ):
        customization.detect_propaganda = False
        logger.warning("⚠️ [v2.1] Propaganda analysis disabled (requires Pro)")

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
        can_analyze, reason, info = await secure_check_can_analyze(session, current_user.id, model)
    else:
        can_analyze, reason, credits_remaining, estimated_cost = await check_can_analyze(session, current_user.id)
        info = {"credits": credits_remaining, "cost": estimated_cost}

    if not can_analyze:
        raise HTTPException(
            status_code=403,
            detail={
                "code": reason,
                "message": info.get("message", f"Cannot analyze: {reason}"),
                "credits": info.get("credits", 0),
                "cost": credit_cost,
                **info,
            },
        )

    # Vérifier le cache (sauf si force_refresh)
    if not request.force_refresh:
        existing = await get_summary_by_video_id(session, video_id, current_user.id)
        if existing and existing.mode == request.mode:
            from datetime import timedelta

            cache_age = datetime.now() - existing.created_at
            if cache_age < timedelta(days=7):
                logger.info(f"💾 [CACHE HIT] v2.1: summary_id={existing.id}")
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
                    "comments_analysis": None,
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
            raise HTTPException(
                status_code=403,
                detail={
                    "code": reserve_reason,
                    "message": f"Could not reserve credits: {reserve_reason}",
                    **reserve_info,
                },
            )
        logger.info(f"🔒 [v2.1] Credits reserved: {credit_cost} for task {task_id[:12]}")

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
            "analyze_publication_intent": customization.analyze_publication_intent,
        },
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
        "v2_1_options": full_options,
    }

    logger.info(f"🚀 [v2.1] Task created: {task_id} with advanced options")

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
        platform=platform,  # 🎵 TikTok support
    )

    return {
        "task_id": task_id,
        "status": "pending",
        "progress": 0,
        "message": "Analysis v2.1 started with advanced customization",
        "estimated_duration_seconds": estimated_duration,
        "cost": credit_cost,
        "applied_customization": full_options.get("customization"),
        "comments_analysis": None,
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
    platform: str = "youtube",
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

    logger.info(f"🔧 [v2.1] Advanced background task started: {task_id}")

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
                transcript, transcript_timestamped, detected_lang = await get_transcript_with_timestamps(
                    video_id, is_short=_is_short, duration=_duration
                )
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
                        youtube_categories=video_info.get("categories", []),
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
                        model=model,
                    )
                    logger.info(f"✅ [v2.1] Comments analysis: {result.analyzed_count} comments")
                    return result
                except Exception as e:
                    logger.error(f"⚠️ [v2.1] Comments analysis failed: {e}")
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
                        lang=lang,
                    )
                    logger.info("✅ [v2.1] Metadata enriched")
                    return result
                except Exception as e:
                    logger.error(f"⚠️ [v2.1] Metadata enrichment failed: {e}")
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
                        upload_date=video_info.get("upload_date", ""),
                    )
                except Exception as e:
                    logger.error(f"⚠️ [v2.1] Web enrichment failed: {e}")
                    return None, [], enrichment_level

            # ⚡ Lancer les 4 tâches en parallèle
            (
                (category, confidence),
                comments_analysis_result,
                metadata_enriched_result,
                (_web_ctx, _enrich_src, _),
            ) = await asyncio.gather(
                _detect_cat_v21(), _analyze_comments_v21(), _enrich_metadata_v21(), _enrich_web_v21()
            )
            web_context = _web_ctx
            enrichment_sources = _enrich_src
            logger.info("⚡ [v2.1.1] Category + comments + metadata + web computed in PARALLEL")

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
                lang=lang,
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

            # 👁️ Phase 2 visual hook (V2.1) — enrich full_context + capture pour persist post-save
            _visual_analysis_data: Optional[Dict[str, Any]] = None
            if options.get("include_visual_analysis", True) and platform in ("youtube", "tiktok"):
                from .visual_integration import enrich_and_capture_visual

                _visual_flag_on = (
                    os.getenv("VISUAL_ANALYSIS_ENABLED", "false").strip().lower()
                    in {"1", "true", "yes", "on"}
                )
                full_context, _visual_analysis_data = await enrich_and_capture_visual(
                    db=session,
                    user_id=user_id,
                    url=url,
                    transcript_excerpt=transcript_to_analyze or "",
                    web_context=full_context or "",
                    flag_enabled=_visual_flag_on,
                    log_tag=f"VISUAL_V2.1 user={user_id}",
                )

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
                summary_content = (
                    _long_video_result2.summary
                    if isinstance(_long_video_result2, LongVideoResult)
                    else _long_video_result2
                )
                # Fallback si la synthèse a échoué
                if not summary_content:
                    logger.warning("⚠️ [v3.0] Long video analysis returned empty summary, falling back to truncated")
                    truncated = " ".join(transcript_to_analyze.split()[:8000])
                    summary_content = await generate_summary(
                        title=video_info["title"],
                        transcript=truncated,
                        category=category,
                        lang=lang,
                        mode=mode,
                        model=model,
                        duration=video_duration,
                        channel=video_info.get("channel", ""),
                        description=video_info.get("description", "")
                        + "\n\n⚠️ NOTE: Cette vidéo est très longue. Seule la première partie a été analysée.",
                        web_context=full_context,
                        video_id=video_id,
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
                    calculate_reliability_score(summary_content, {}, lang=lang),
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
                    reliability_bonus = {EnrichmentLevel.FULL: 8, EnrichmentLevel.DEEP: 15}.get(enrichment_level, 0)
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
                    session, user_id, task_id, f"Video v2.1: {video_info['title'][:50]} ({model})"
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
                "sponsorship_detected": metadata_enriched_result.sponsorship.type.value
                if metadata_enriched_result
                else None,
                "propaganda_risk": metadata_enriched_result.propaganda_analysis.risk_level.value
                if metadata_enriched_result and metadata_enriched_result.propaganda_analysis
                else None,
            }

            # Thumbnail dynamique selon la plateforme
            if platform == "tiktok":
                default_thumbnail = video_info.get("thumbnail_url", "")
            else:
                default_thumbnail = video_info.get(
                    "thumbnail_url", f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
                )

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

            # 👁️ Phase 2 plumbing V2.1 : persist visual_analysis si capturé.
            if _visual_analysis_data is not None:
                try:
                    from sqlalchemy import update as sql_update
                    await session.execute(
                        sql_update(Summary)
                        .where(Summary.id == summary_id)
                        .values(visual_analysis=_visual_analysis_data)
                    )
                    await session.commit()
                    logger.info(
                        f"👁️ [VISUAL_V2.1] persisted to Summary.visual_analysis (id={summary_id})"
                    )
                except Exception as _vpe:
                    logger.warning(f"👁️ [VISUAL_V2.1] persist failed (graceful): {_vpe}")
                    await session.rollback()

            # 📚 Auto-générer les extras Mistral (Option A 2026-05-06)
            asyncio.create_task(_autogen_summary_extras(user_id, summary_id))

            # 🆕 v4.0: Index structuré
            await _save_structured_index(
                session, summary_id, video_info.get("duration", 0), transcript, transcript_timestamped
            )

            # v3.0: Stocker les VideoChunks pour réutilisation par le digest pipeline
            if isinstance(_long_video_result2, LongVideoResult) and _long_video_result2.chunks:
                try:
                    await store_chunks_in_db(_long_video_result2, summary_id, session)
                except Exception as chunk_err:
                    logger.error(f"⚠️ [v3.0] VideoChunk storage failed (non-blocking): {chunk_err}")

            # Incrémenter le quota
            try:
                from core.plan_limits import increment_daily_usage

                await increment_daily_usage(session, user_id)
            except Exception as quota_err:
                logger.error(f"⚠️ [v2.1] Quota increment failed: {quota_err}")

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
                    "summary": comments_analysis_result.summary,
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
                        "disclosed": metadata_enriched_result.sponsorship.disclosed,
                    },
                    "propaganda_analysis": {
                        "risk_level": metadata_enriched_result.propaganda_analysis.risk_level.value,
                        "techniques": metadata_enriched_result.propaganda_analysis.detected_techniques,
                        "recommendation": metadata_enriched_result.propaganda_analysis.recommendation,
                    }
                    if metadata_enriched_result.propaganda_analysis
                    else None,
                    "publication_intent": {
                        "primary": metadata_enriched_result.publication_intent.primary_intent,
                        "educational_score": metadata_enriched_result.publication_intent.educational_score,
                        "commercial_score": metadata_enriched_result.publication_intent.commercial_score,
                    }
                    if metadata_enriched_result.publication_intent
                    else None,
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
                    }
                    if enrichment_level != EnrichmentLevel.NONE
                    else None,
                },
            }

            await update_task_status(
                session, task_id, status="completed", progress=100, result=_task_store[task_id]["result"]
            )

            # Notification SSE
            try:
                await notify_analysis_complete(
                    user_id=user_id,
                    summary_id=summary_id,
                    video_title=video_info["title"],
                    video_id=video_id,
                    cached=False,
                )
            except Exception as notify_err:
                logger.error(f"⚠️ [v2.1] Notification failed: {notify_err}")

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
                                "version": "v2.1",
                            },
                            timeout=30.0,
                        )
                    logger.info(f"🔔 [v2.1] Webhook sent to {webhook_url}")
                except Exception as webhook_err:
                    logger.error(f"⚠️ [v2.1] Webhook failed: {webhook_err}")

            logger.info(f"✅ [v2.1] Task completed: {task_id}")

    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ [v2.1] Analysis error for task {task_id}: {error_msg}")

        if SECURITY_AVAILABLE:
            await release_reserved_credits(user_id, task_id)

        _task_store[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": f"Error: {error_msg}",
            "user_id": user_id,
            "error": error_msg,
        }

        try:
            await notify_analysis_failed(
                user_id=user_id,
                video_title=video_info.get("title", "Vidéo") if video_info else "Vidéo",
                error=error_msg[:200],
            )
        except Exception:
            pass

        try:
            async with async_session_maker() as session:
                await update_task_status(session, task_id, status="failed", progress=0, error=error_msg)
        except Exception:
            pass


async def _async_none():
    """Helper async qui résout immédiatement sur None.

    Utilisé pour rendre les branches optionnelles (ex: contexte chaîne quand
    aucun channel_id n'est extractible) compatibles avec ``asyncio.gather``
    sans logique conditionnelle dispersée.
    """
    return None


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
    platform: str = "youtube",  # 🎵 TikTok support
    include_visual_analysis: bool = False,  # 🆕 Phase 2 — frames + Mistral Vision
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

    logger.info(f"🔧 [v6.0] Background task started: {task_id} (deep_research={deep_research}, platform={platform})")

    # 🆕 v5.5: Si deep_research activé, utiliser enrichissement maximal
    if deep_research:
        enrichment_level = EnrichmentLevel.DEEP
        logger.info("🔬 [v5.5] Deep research enabled - using DEEP enrichment")
    else:
        # Déterminer le niveau d'enrichissement selon le plan
        enrichment_level = get_enrichment_level(user_plan)
    logger.info(f"🌐 [v6.0] Enrichment level: {enrichment_level.value} for plan {user_plan}")

    try:
        async with async_session_maker() as session:
            # Check if cancelled before starting
            if _task_store.get(task_id, {}).get("status") == "cancelled":
                logger.info("Task %s cancelled before start", task_id[:12])
                if SECURITY_AVAILABLE:
                    await release_reserved_credits(user_id, task_id)
                return

            _task_store[task_id]["status"] = "processing"
            _task_store[task_id]["progress"] = 5
            _task_store[task_id]["message"] = "🚀 Démarrage de l'analyse..."

            # ═══════════════════════════════════════════════════════════════════
            # 1. RÉCUPÉRER LES INFOS VIDÉO
            # ═══════════════════════════════════════════════════════════════════
            if _task_store.get(task_id, {}).get("status") == "cancelled":
                logger.info("Task %s cancelled", task_id[:12])
                if SECURITY_AVAILABLE:
                    await release_reserved_credits(user_id, task_id)
                return
            _task_store[task_id]["progress"] = 10
            _task_store[task_id]["message"] = "📺 Récupération des infos vidéo..."

            logger.info(f"📺 Fetching video info for {video_id} (platform={platform})...")
            if platform == "tiktok":
                video_info = await get_tiktok_video_info(url)
            else:
                video_info = await get_video_info(video_id)
            if not video_info:
                raise Exception("Could not fetch video info")

            logger.info(f"✅ Video info: {video_info.get('title', 'Unknown')[:50]}")

            # 🏷️ v8.0: Extraire l'ID de chaîne (channel_id YouTube ou username TikTok)
            # → utilisé en étape 3+4 pour fetch le contexte chaîne en parallèle.
            # Imports lazy : évitent les coûts de chargement quand la feature ne tire pas.
            _channel_external_id: Optional[str] = None
            try:
                if platform == "tiktok":
                    from transcripts.tiktok import (
                        extract_tiktok_username_from_video_metadata as _extract_chan_id,
                    )

                    _channel_external_id = _extract_chan_id(video_info)
                else:
                    from transcripts.youtube_channel import (
                        extract_channel_id_from_video_metadata as _extract_chan_id,
                    )

                    _channel_external_id = _extract_chan_id(video_info)
            except Exception as _ce:
                # Fail-safe : aucune erreur ne doit bloquer l'analyse principale.
                logger.warning(f"[CHANNEL-CTX] Failed to extract channel id: {_ce}")
                _channel_external_id = None

            if _channel_external_id:
                logger.info(
                    f"🏷️ [CHANNEL-CTX] Resolved channel id for {platform}: {_channel_external_id}"
                )
            else:
                logger.info(
                    f"🏷️ [CHANNEL-CTX] No channel id resolvable for {platform}/{video_id} — "
                    "context fetch will be skipped"
                )

            # ═══════════════════════════════════════════════════════════════════
            # 2. EXTRAIRE LA TRANSCRIPTION (avec global cache check)
            # ═══════════════════════════════════════════════════════════════════
            if _task_store.get(task_id, {}).get("status") == "cancelled":
                logger.info("Task %s cancelled before transcript", task_id[:12])
                if SECURITY_AVAILABLE:
                    await release_reserved_credits(user_id, task_id)
                return
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
                            logger.info(
                                f"💾 [GLOBAL CACHE HIT] Transcript for {platform}/{video_id}: {len(transcript)} chars"
                            )
            except Exception as _vce:
                logger.error(f"⚠️ [GLOBAL CACHE] Transcript check failed: {_vce}")

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
                    transcript, transcript_timestamped, detected_lang = await get_transcript_with_timestamps(
                        video_id, is_short=_is_short, duration=_duration
                    )

                # 💾 Cache the freshly extracted transcript
                if transcript:
                    try:
                        if _vcache is not None:
                            await _vcache.set_transcript(
                                platform,
                                video_id,
                                {
                                    "transcript": transcript,
                                    "transcript_timestamped": transcript_timestamped,
                                    "detected_lang": detected_lang,
                                },
                            )
                            logger.info(f"💾 [GLOBAL CACHE SET] Transcript cached for {platform}/{video_id}")
                    except Exception:
                        pass

            if not transcript or _is_empty_transcript(transcript):
                # 🎞️ Slideshow detection: empty transcript + short video = possible image slideshow
                _vid_duration = video_info.get("duration", 0) or 0
                _vid_url = video_info.get("url") or video_info.get("webpage_url") or url
                if _vid_duration <= 120 or not transcript:
                    logger.info(
                        f"🎞️ [SLIDESHOW] Empty/minimal transcript ({len(transcript or '')} chars, {_vid_duration}s), trying frame extraction..."
                    )
                    _task_store[task_id]["message"] = "Transcript vide — extraction des slides..."
                    _task_store[task_id]["progress"] = 22
                    try:
                        _slideshow_frames = await _extract_slideshow_frames(_vid_url, platform, max_frames=10)
                        if _slideshow_frames:
                            _task_store[task_id]["message"] = "Analyse des slides avec Vision IA..."
                            _api_key = get_mistral_key()
                            _slide_content = [
                                {
                                    "type": "text",
                                    "text": f"Analyse ces {len(_slideshow_frames)} slides extraites d'une video {platform}. Pour chaque slide, extrais tout le texte visible et decris le visuel. Assemble le tout comme un transcript coherent. Reponds en {'francais' if lang == 'fr' else 'anglais'}.",
                                }
                            ]
                            for _frame in _slideshow_frames:
                                _data_uri = f"data:{_frame['mime_type']};base64,{_frame['data']}"
                                _slide_content.append({"type": "image_url", "image_url": _data_uri})
                            _slide_result = await _mistral_vision_request(
                                api_key=_api_key,
                                messages=[
                                    {
                                        "role": "system",
                                        "content": "Tu es un expert en OCR et analyse d'images. Extrais et decris le contenu de chaque slide.",
                                    },
                                    {"role": "user", "content": _slide_content},
                                ],
                                model="mistral-small-2603",
                                max_tokens=6000,
                                timeout=120.0,
                                fallback_models=[
                                    "pixtral-large-2411",
                                    "pixtral-12b-2409",
                                    "mistral-small-latest",
                                    "mistral-medium-2508",
                                    "mistral-large-latest",
                                ],
                            )
                            if _slide_result:
                                transcript = (
                                    "[SLIDESHOW — "
                                    + str(len(_slideshow_frames))
                                    + " slides]"
                                    + chr(10)
                                    + chr(10)
                                    + _slide_result
                                )
                                logger.info(f"🎞️ [SLIDESHOW] Vision OCR success: {len(_slide_result)} chars")
                            else:
                                logger.error("🎞️ [SLIDESHOW] Vision OCR failed")
                    except Exception as _se:
                        logger.error(f"🎞️ [SLIDESHOW] Error: {_se}")

                if not transcript or len(transcript.strip()) < 30:
                    raise Exception("No transcript available for this video")

            logger.info(f"✅ Transcript: {len(transcript)} chars")

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
                        youtube_categories=video_info.get("categories", []),
                    )
                    logger.info(f"🏷️ Auto-detected category: {cat} ({conf:.0%})")
                    return cat, conf
                return category, 0.9

            # — Enrichissement web (async)
            async def _enrich_web_async():
                if enrichment_level == EnrichmentLevel.NONE:
                    logger.warning(f"⏭️ [v5.0] Skipping web enrichment (plan={user_plan})")
                    return None, [], enrichment_level
                logger.info("🌐 [v5.0] PRE-ANALYSIS: Fetching web context from Perplexity...")
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
                        upload_date=video_info.get("upload_date", ""),
                    )
                    if _wc:
                        logger.info(f"✅ [v5.0] PRE-ANALYSIS: Got {len(_wc)} chars, {len(_es)} sources")
                    else:
                        logger.warning("⚠️ [v5.0] PRE-ANALYSIS: No web context returned")
                    return _wc, _es, _al
                except Exception as e:
                    logger.error(f"⚠️ [v5.0] PRE-ANALYSIS failed (continuing without): {e}")
                    return None, [], enrichment_level

            # 🏷️ v8.0 — Fetch contexte chaîne (async, lazy import)
            async def _fetch_channel_context_async():
                if not _channel_external_id:
                    return None
                try:
                    from services.channel_content_cache import (
                        get_or_fetch_channel_context as _get_chan_ctx,
                    )

                    ctx = await _get_chan_ctx(platform, _channel_external_id, limit=50)
                    if ctx:
                        logger.info(
                            f"✅ [CHANNEL-CTX] Fetched context for {platform}/"
                            f"{_channel_external_id}: name='{ctx.get('name', '')[:40]}', "
                            f"{len(ctx.get('last_videos') or [])} recent videos"
                        )
                    else:
                        logger.warning(
                            f"⚠️ [CHANNEL-CTX] No context returned for {platform}/{_channel_external_id}"
                        )
                    return ctx
                except Exception as e:
                    logger.error(
                        f"⚠️ [CHANNEL-CTX] Fetch failed (continuing without): {e}"
                    )
                    return None

            # ⚡ Lancer les trois en parallèle (return_exceptions=True pour fail-safe)
            results = await asyncio.gather(
                _detect_category_async(),
                _enrich_web_async(),
                _fetch_channel_context_async(),
                return_exceptions=True,
            )

            # Unpack catégorie (avec safety)
            cat_result = results[0]
            if isinstance(cat_result, Exception):
                logger.error(f"⚠️ [v6.1] Category detection failed: {cat_result}")
                category, confidence = (category or "general", 0.5)
            else:
                category, confidence = cat_result

            # Unpack enrichissement web (avec safety)
            web_result = results[1]
            if isinstance(web_result, Exception):
                logger.error(f"⚠️ [v6.1] Web enrichment failed: {web_result}")
                _web_ctx, _enrich_src = None, []
            else:
                _web_ctx, _enrich_src, _ = web_result
            web_context = _web_ctx
            enrichment_sources = _enrich_src

            # Unpack contexte chaîne (avec safety)
            chan_result = results[2]
            if isinstance(chan_result, Exception):
                logger.error(f"⚠️ [v6.1] Channel context fetch raised: {chan_result}")
                channel_context = None
            else:
                channel_context = chan_result

            _task_store[task_id]["progress"] = 45
            logger.info("⚡ [v6.1] Category + web enrichment computed in PARALLEL")

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

            # ═══════════════════════════════════════════════════════════════════
            # 🆕 PHASE 2 — VISUAL ANALYSIS ENRICHMENT (frames + Mistral Vision)
            # Best-effort : si échec, on continue sans la couche visuelle.
            # ═══════════════════════════════════════════════════════════════════
            _visual_analysis_data: Optional[Dict[str, Any]] = None
            if include_visual_analysis and platform in ("youtube", "tiktok"):
                try:
                    from .visual_integration import (
                        STATUS_OK,
                        format_visual_context_for_prompt,
                        maybe_enrich_with_visual,
                    )
                    from sqlalchemy import select as _sel
                    from db.database import User as _UserModel

                    _visual_flag_on = (
                        os.getenv("VISUAL_ANALYSIS_ENABLED", "false").strip().lower()
                        in {"1", "true", "yes", "on"}
                    )
                    if _visual_flag_on:
                        _task_store[task_id]["progress"] = 50
                        _task_store[task_id]["message"] = "👁️ Analyse visuelle en cours..."
                        _user_q = await session.execute(
                            _sel(_UserModel).where(_UserModel.id == user_id)
                        )
                        _user_row = _user_q.scalar_one_or_none()
                        if _user_row:
                            _visual = await maybe_enrich_with_visual(
                                db=session,
                                user=_user_row,
                                url=url,
                                transcript_excerpt=(transcript_to_analyze or "")[:8000],
                                flag_enabled=True,
                            )
                            if _visual.get("status") == STATUS_OK:
                                _visual_block = format_visual_context_for_prompt(_visual)
                                if _visual_block:
                                    web_context = (
                                        (web_context or "") + "\n\n" + _visual_block
                                    )
                                # 👁️ Phase 2 plumbing — capture le dict serialisé
                                # pour persistance dans Summary.visual_analysis
                                # après save_summary() (alembic 024).
                                _visual_analysis_data = _visual.get("analysis")
                                logger.info(
                                    f"👁️ [VISUAL] enrichment OK: "
                                    f"frames={_visual.get('frame_count', 0)} "
                                    f"model={_visual.get('model_used')} "
                                    f"elapsed={_visual.get('elapsed_s', 0.0):.1f}s"
                                )
                            else:
                                logger.info(
                                    f"👁️ [VISUAL] skipped: status={_visual.get('status')}"
                                )
                except Exception as _ve:
                    # Graceful degradation : aucune erreur visuelle ne bloque l'analyse
                    logger.warning(
                        f"👁️ [VISUAL] enrichment raised (graceful): {_ve}"
                    )

            if needs_chunk:
                # ════════════════════════════════════════════════════════════
                # 📚 VIDÉO LONGUE — Analyse par chunks
                # ════════════════════════════════════════════════════════════
                logger.info(f"📚 [v7.0] LONG VIDEO DETECTED: {word_count} words ({chunk_reason})")
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
                summary_content = (
                    _long_video_result3.summary
                    if isinstance(_long_video_result3, LongVideoResult)
                    else _long_video_result3
                )

                if not summary_content:
                    logger.error("⚠️ [v7.0] Chunking failed, falling back to truncated analysis")
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
                        description=video_info.get("description", "")
                        + "\n\n⚠️ NOTE: Cette vidéo est très longue. Seule la première partie a été analysée.",
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
                        channel_context=channel_context,
                    )
            else:
                # ════════════════════════════════════════════════════════════
                # 📝 VIDÉO STANDARD — Analyse directe
                # ════════════════════════════════════════════════════════════
                if _task_store.get(task_id, {}).get("status") == "cancelled":
                    logger.info("Task %s cancelled before Mistral summary", task_id[:12])
                    if SECURITY_AVAILABLE:
                        await release_reserved_credits(user_id, task_id)
                    return
                if web_context:
                    _task_store[task_id]["message"] = "🧠 Génération du résumé enrichi avec l'IA..."
                else:
                    _task_store[task_id]["message"] = "🧠 Génération du résumé avec l'IA..."

                logger.info(f"🧠 Generating summary with {model}...")
                if web_context:
                    logger.info(f"🌐 [v5.0] Including {len(web_context)} chars of web context in Mistral prompt")

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
                    channel_context=channel_context,
                )

            if not summary_content:
                raise Exception("AI service temporarily unavailable, please retry")

            final_word_count = len(summary_content.split())
            logger.info(f"✅ Summary generated: {final_word_count} words")

            # ═══════════════════════════════════════════════════════════════════
            # 6+7. ⚡ ENTITÉS + FIABILITÉ EN PARALLÈLE (optimisation v6.1)
            # ═══════════════════════════════════════════════════════════════════
            if _task_store.get(task_id, {}).get("status") == "cancelled":
                logger.info("Task %s cancelled before entities extraction", task_id[:12])
                if SECURITY_AVAILABLE:
                    await release_reserved_credits(user_id, task_id)
                return
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

            logger.info("⚡ [v6.1] Entities + reliability computed in PARALLEL")

            # Bonus de fiabilité si enrichi avec Perplexity (PRÉ-ANALYSE)
            if enrichment_sources:
                reliability_bonus = {
                    EnrichmentLevel.FULL: 8,  # Pro: +8
                    EnrichmentLevel.DEEP: 15,  # Expert: +15
                }.get(enrichment_level, 0)
                reliability = min(98, reliability + reliability_bonus)
                logger.info(f"🎯 [v5.0] Reliability boosted by {reliability_bonus} (web-enriched analysis)")

            # ═══════════════════════════════════════════════════════════════════
            # 8. SAUVEGARDER LE RÉSUMÉ
            # ═══════════════════════════════════════════════════════════════════
            _task_store[task_id]["progress"] = 92
            _task_store[task_id]["message"] = "💾 Sauvegarde des résultats..."

            # 🔐 CONSOMMER les crédits réservés (succès de l'opération)
            if SECURITY_AVAILABLE:
                await consume_reserved_credits(
                    session, user_id, task_id, f"Video: {video_info['title'][:50]} ({model})"
                )
            else:
                await deduct_credit(session, user_id, credit_cost, f"Video: {video_info['title'][:50]}")

            _task_store[task_id]["progress"] = 94
            _task_store[task_id]["message"] = "💾 Enregistrement de l'analyse..."

            # Préparer les métadonnées d'enrichissement
            enrichment_metadata = None
            if enrichment_sources:
                enrichment_metadata = {
                    "level": enrichment_level.value,
                    "sources": enrichment_sources,
                    "enriched_at": datetime.utcnow().isoformat(),
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

            logger.info(f"💾 Summary saved: id={summary_id}")

            # 👁️ Phase 2 plumbing : persiste visual_analysis si capturé.
            # Best-effort — ne fait pas échouer le flow si ça plante.
            if _visual_analysis_data is not None:
                try:
                    from sqlalchemy import update as sql_update
                    await session.execute(
                        sql_update(Summary)
                        .where(Summary.id == summary_id)
                        .values(visual_analysis=_visual_analysis_data)
                    )
                    await session.commit()
                    logger.info(
                        f"👁️ [VISUAL] persisted to Summary.visual_analysis (id={summary_id})"
                    )
                except Exception as _vpe:
                    logger.warning(
                        f"👁️ [VISUAL] persist failed (graceful): {_vpe}"
                    )
                    await session.rollback()

            # 📚 Auto-générer les extras Mistral (Option A 2026-05-06)
            asyncio.create_task(_autogen_summary_extras(user_id, summary_id))

            _task_store[task_id]["progress"] = 97
            _task_store[task_id]["message"] = "🧩 Indexation et finalisation..."

            # 🆕 v4.0: Index structuré
            await _save_structured_index(
                session, summary_id, video_info.get("duration", 0), transcript, transcript_timestamped
            )

            # v3.0: Stocker les VideoChunks pour réutilisation par le digest pipeline
            if isinstance(_long_video_result3, LongVideoResult) and _long_video_result3.chunks:
                try:
                    await store_chunks_in_db(_long_video_result3, summary_id, session)
                except Exception as chunk_err:
                    logger.error(f"⚠️ [v3.0] VideoChunk storage failed (non-blocking): {chunk_err}")

            # 🎨 Enqueue keyword image generation (non-blocking)
            try:
                from images.keyword_images import enqueue_images_for_summary

                await enqueue_images_for_summary(summary_id)
            except Exception as img_err:
                logger.error(f"⚠️ [IMAGES] Keyword image enqueue failed (non-blocking): {img_err}")

            # 🖼️ Persist thumbnail to R2 (non-blocking)
            try:
                from storage.thumbnail_generator import ensure_thumbnail

                asyncio.create_task(
                    ensure_thumbnail(
                        summary_id=summary_id,
                        video_id=video_id,
                        title=video_info["title"],
                        category=category,
                        platform=platform,
                        original_url=default_thumbnail,
                        video_url=url,
                    )
                )
            except Exception as thumb_err:
                logger.error(f"⚠️ [THUMBNAIL] R2 persist failed (non-blocking): {thumb_err}")

            # ⚡ Cache + quota en parallèle (perf v6.2)
            async def _cache_analysis():
                try:
                    from main import get_video_cache

                    _vcache_post = get_video_cache()
                    if _vcache_post is not None:
                        await _vcache_post.set_analysis(
                            platform,
                            video_id,
                            mode,
                            lang,
                            {
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
                            },
                        )
                except Exception as _vce:
                    logger.error(f"⚠️ [GLOBAL CACHE] Analysis cache set failed: {_vce}")

            async def _increment_quota():
                # ⚠️ Fire-and-forget background task — must NOT reuse the
                # caller's `session` because the surrounding `async with
                # async_session_maker() as session` may exit (and close the
                # session) before this task completes. That race triggers
                # SQLAlchemy IllegalStateChangeError ("Method 'close()' can't
                # be called here; method '_connection_for_bind()' is already
                # in progress" — https://sqlalche.me/e/20/isce) which then
                # bubbles up to the outer try/except and surfaces as an
                # "Analysis error" in the client UI even though the analysis
                # itself succeeded. Open a dedicated session for this BG op.
                try:
                    from core.plan_limits import increment_daily_usage

                    async with async_session_maker() as bg_session:
                        await increment_daily_usage(bg_session, user_id)
                except Exception as quota_err:
                    logger.error(f"⚠️ [QUOTA] Failed to increment daily usage: {quota_err}")

            # ═══════════════════════════════════════════════════════════════════
            # 9. MARQUER COMME TERMINÉ (AVANT cache/notify — frontend voit le résultat plus tôt)
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
                        "badge": enrichment_badge,
                    }
                    if enrichment_level != EnrichmentLevel.NONE
                    else None,
                },
            }

            await update_task_status(
                session, task_id, status="completed", progress=100, result=_task_store[task_id]["result"]
            )

            logger.info(f"✅ [v6.0] Task completed: {task_id}")
            if enrichment_level != EnrichmentLevel.NONE:
                logger.info(f"   └─ Enrichment: {enrichment_level.value}, {len(enrichment_sources)} sources")

            # ⚡ Cache + quota fire-and-forget (perf v6.3) — le frontend voit "completed" 100-500ms plus tôt
            async def _post_completion_tasks():
                await asyncio.gather(_cache_analysis(), _increment_quota())

            asyncio.create_task(_post_completion_tasks())

            # 🔔 NOTIFICATION PUSH fire-and-forget — Alerter l'utilisateur que l'analyse est prête
            async def _send_complete_notification():
                try:
                    await notify_analysis_complete(
                        user_id=user_id,
                        summary_id=summary_id,
                        video_title=video_info["title"],
                        video_id=video_id,
                        cached=False,
                    )
                    logger.info(f"🔔 [NOTIFY] Analysis complete notification sent to user {user_id}")
                except Exception as notify_err:
                    logger.error(f"⚠️ [NOTIFY] Failed to send notification: {notify_err}")

            asyncio.create_task(_send_complete_notification())

    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Analysis error for task {task_id}: {error_msg}")

        # 🔐 LIBÉRER les crédits réservés (échec de l'opération)
        if SECURITY_AVAILABLE:
            await release_reserved_credits(user_id, task_id)
            logger.error(f"🔓 [SECURITY] Credits released due to failure: task={task_id[:12]}")

        _task_store[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": f"Error: {error_msg}",
            "user_id": user_id,
            "error": error_msg,
        }

        # 🔔 NOTIFICATION PUSH — Alerter l'utilisateur de l'échec
        try:
            video_title_for_notif = video_info.get("title", "Vidéo") if "video_info" in dir() else "Vidéo"
            await notify_analysis_failed(user_id=user_id, video_title=video_title_for_notif, error=error_msg[:200])
            logger.error(f"🔔 [NOTIFY] Analysis failure notification sent to user {user_id}")
        except Exception as notify_err:
            logger.error(f"⚠️ [NOTIFY] Failed to send failure notification: {notify_err}")

        try:
            async with async_session_maker() as session:
                await update_task_status(session, task_id, status="failed", progress=0, error=error_msg)
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
    """Annule une tâche d'analyse en cours et libère les crédits réservés."""
    task = await _task_store.aget(task_id)
    if task is not None:
        if task.get("user_id") != current_user.id:
            raise HTTPException(status_code=404, detail="Task not found")

        task["status"] = "cancelled"
        task["message"] = "Analyse annulée par l'utilisateur"

        if SECURITY_AVAILABLE:
            try:
                await release_reserved_credits(current_user.id, task_id)
                logger.info("Credits released on cancel: task=%s user=%s", task_id[:12], current_user.id)
            except Exception as e:
                logger.warning("Failed to release credits on cancel: %s", e)

        logger.info("Task %s cancelled by user %s", task_id[:12], current_user.id)
        return {"status": "cancelled", "task_id": task_id}

    raise HTTPException(status_code=404, detail="Task not found")


@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status_endpoint(
    task_id: str, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    """Récupère le status d'une tâche d'analyse.

    NOTE 2026-05-07 : renommé `get_task_status` → `get_task_status_endpoint`
    pour éliminer la collision avec le helper `get_task_status(task_id)` défini
    plus haut (ligne 252). Sans ce renommage, l'import `from videos.router
    import get_task_status` (utilisé par `api_public/router.py`) résolvait vers
    le route handler à cause de Python's last-definition-wins, qui exigeait des
    Depends non-résolus → AttributeError 'Depends' object has no attribute 'id'.
    Le décorateur `@router.get(...)` enregistre la route par URL, le nom de la
    fonction est purement identitaire — pas de breaking change pour le client.
    """

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
                    },
                )
        except (ValueError, Exception):
            pass
        raise HTTPException(status_code=404, detail="Task not found")

    # 🔴 Redis-backed: lecture cross-worker via aget()
    task = await _task_store.aget(task_id)
    if task is not None:
        # Vérifier que c'est bien la tâche de cet utilisateur
        if task.get("user_id") != current_user.id:
            raise HTTPException(status_code=404, detail="Task not found")

        return TaskStatusResponse(
            task_id=task_id,
            status=task.get("status", "unknown"),
            progress=task.get("progress", 0),
            message=task.get("message", ""),
            result=task.get("result"),
            error=task.get("error"),
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
        error=task_db.error_message,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 RÉSUMÉS
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/summary/{summary_id}")
async def get_summary(
    summary_id: int,
    format: Optional[str] = Query(default=None, description="Format de réponse: full (défaut) ou extension"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
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
            visual_analysis=summary.visual_analysis,
        )

    # Format complet (défaut)
    entities = None
    if summary.entities_extracted:
        try:
            entities = (
                json.loads(summary.entities_extracted)
                if isinstance(summary.entities_extracted, str)
                else summary.entities_extracted
            )
        except (json.JSONDecodeError, TypeError):
            pass

    # 📊 Calculate engagement rate on-the-fly
    engagement_rate = None
    _vc = getattr(summary, "view_count", None)
    if _vc and _vc > 0:
        _total = (
            (getattr(summary, "like_count", 0) or 0)
            + (getattr(summary, "comment_count", 0) or 0)
            + (getattr(summary, "share_count", 0) or 0)
        )
        engagement_rate = round(_total / _vc * 100, 2)

    # Deserialize JSON fields
    _source_tags = None
    if getattr(summary, "source_tags_json", None):
        try:
            _source_tags = json.loads(summary.source_tags_json)
        except (json.JSONDecodeError, TypeError):
            pass

    _carousel_images = None
    if getattr(summary, "carousel_images_json", None):
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
        thumbnail_url=(
            summary.thumbnail_url
            or (
                f"https://img.youtube.com/vi/{summary.video_id}/mqdefault.jpg"
                if (summary.platform or "youtube") != "tiktok"
                else ""
            )
        ),
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
        view_count=getattr(summary, "view_count", None),
        like_count=getattr(summary, "like_count", None),
        comment_count=getattr(summary, "comment_count", None),
        share_count=getattr(summary, "share_count", None),
        channel_follower_count=getattr(summary, "channel_follower_count", None),
        engagement_rate=engagement_rate,
        content_type=getattr(summary, "content_type", None) or "video",
        music_title=getattr(summary, "music_title", None),
        music_author=getattr(summary, "music_author", None),
        source_tags=_source_tags,
        carousel_images=_carousel_images,
        # Summary extras (spike 2026-05-06) — null tant que pas généré
        summary_extras=getattr(summary, "summary_extras", None),
        # Visual analysis (Phase 2 plumbing 2026-05-06) — null pour analyses
        # legacy avant Phase 2, flag OFF, quota dépassé, ou Mistral fail.
        visual_analysis=getattr(summary, "visual_analysis", None),
        is_public=getattr(summary, "is_public", False),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 SUMMARY EXTRAS — refonte synthèse Option A 2026-05-06
# ═══════════════════════════════════════════════════════════════════════════════


async def _autogen_summary_extras(user_id: int, summary_id: int) -> None:
    """Génère les extras Mistral en fire-and-forget après création d'un Summary.

    Best-effort : un échec Mistral / JSON invalide est loggé en warning mais ne
    bloque ni l'analyse principale ni la réponse au user. Utilise une session DB
    indépendante via async_session_maker (la session de l'analyse est déjà fermée
    quand cette task se déclenche).
    """
    try:
        from db.database import async_session_maker
        from videos.summary_enrichment_service import generate_summary_extras
        from sqlalchemy import select

        async with async_session_maker() as bg_session:
            result = await bg_session.execute(
                select(Summary).where(Summary.id == summary_id, Summary.user_id == user_id)
            )
            summary = result.scalar_one_or_none()
            if summary is None:
                logger.warning(
                    f"[AUTOGEN-EXTRAS] Summary {summary_id} not found for user {user_id} — skip"
                )
                return
            if getattr(summary, "summary_extras", None):
                # Déjà populé (race condition rare) — on ne réécrase pas.
                return

            extras = await generate_summary_extras(summary)
            if extras is None:
                logger.warning(
                    f"[AUTOGEN-EXTRAS] Generation returned None for summary {summary_id} — best-effort skip"
                )
                return

            summary.summary_extras = extras
            await bg_session.commit()
            synthesis = "yes" if extras.get("synthesis") else "no"
            q = len(extras.get("key_quotes", []))
            t = len(extras.get("key_takeaways", []))
            th = len(extras.get("chapter_themes", []))
            logger.info(
                f"[AUTOGEN-EXTRAS] OK summary={summary_id} (synthesis={synthesis}, q={q}, t={t}, th={th})"
            )
    except Exception as exc:  # noqa: BLE001 — best-effort, on log et on quitte
        logger.warning(
            f"[AUTOGEN-EXTRAS] Unexpected error summary={summary_id}: {exc}"
        )


@router.post("/summary/{summary_id}/enrich")
async def enrich_summary(
    summary_id: int,
    force: bool = Query(default=False, description="Force regen même si cache présent"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Génère (ou retourne du cache) les extras Mistral d'une analyse.

    Idempotent : si `summary_extras` est déjà populé, retourne le cache
    sans regénérer (sauf si `force=true`).

    Best-effort : si Mistral échoue, retourne 502 mais ne casse pas l'analyse.
    """
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    existing = getattr(summary, "summary_extras", None)
    if existing and not force:
        from videos.schemas import SummaryEnrichResponse

        return SummaryEnrichResponse(
            summary_id=summary.id,
            cached=True,
            extras=existing,  # type: ignore[arg-type]  # Pydantic coerces dict→model
        )

    # Génération Mistral
    from videos.summary_enrichment_service import generate_summary_extras

    extras = await generate_summary_extras(summary)
    if extras is None:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "summary_enrichment_failed",
                "message": (
                    "L'enrichissement Mistral a échoué. Réessaie dans quelques "
                    "secondes ou contacte le support si le problème persiste."
                ),
            },
        )

    # Persist
    summary.summary_extras = extras
    await session.commit()

    from videos.schemas import SummaryEnrichResponse

    return SummaryEnrichResponse(
        summary_id=summary.id,
        cached=False,
        extras=extras,  # type: ignore[arg-type]
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 CONCEPTS & DÉFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/concepts/{summary_id}")
async def get_summary_concepts(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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
            text=summary.summary_content, context=summary.video_title or "", language=summary.lang or "fr"
        )

        logger.info(f"📚 [Concepts] Got {result['count']} concepts for summary {summary_id}")

        return {
            "summary_id": summary_id,
            "video_title": summary.video_title,
            "concepts": result["concepts"],
            "count": result["count"],
        }

    except Exception as e:
        logger.error(f"❌ [Concepts] Error: {e}")
        # Fallback: extraire les termes sans définitions
        concepts = extract_concepts(summary.summary_content)
        return {
            "summary_id": summary_id,
            "video_title": summary.video_title,
            "concepts": [{"term": c, "definition": "", "category": "other"} for c in concepts],
            "count": len(concepts),
        }


@router.get("/concepts/{summary_id}/enriched")
async def get_enriched_concepts(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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
            "provider": "none",
        }

    # Extraire les termes [[marqués]]
    terms = extract_terms_from_text(summary.summary_content)

    if not terms:
        return {
            "summary_id": summary_id,
            "video_title": summary.video_title,
            "concepts": [],
            "count": 0,
            "provider": "none",
        }

    # Déterminer si on utilise Perplexity (Pro only)
    use_perplexity = current_user.plan in ["pro"]

    try:
        # Obtenir les définitions enrichies
        definitions = await get_enriched_definitions(
            terms=terms, context=summary.video_title or "", language=summary.lang or "fr", use_perplexity=use_perplexity
        )

        # Convertir en format JSON
        concepts_list = []
        for defn in definitions:
            cat_info = get_category_info(defn.category, summary.lang or "fr")
            concepts_list.append(
                {
                    "term": defn.term,
                    "definition": defn.definition,
                    "category": defn.category,
                    "category_label": cat_info["label"],
                    "category_icon": cat_info["icon"],
                    "context_relevance": defn.context_relevance,
                    "sources": defn.sources,
                    "confidence": defn.confidence,
                    "provider": defn.provider,
                }
            )

        provider = "perplexity+mistral" if use_perplexity else "mistral"
        logger.info(
            f"📚 [Enriched] Got {len(concepts_list)} enriched definitions for summary {summary_id} ({provider})"
        )

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
                    "count": sum(1 for c in concepts_list if c["category"] == cat_id),
                }
                for cat_id, cat_data in CATEGORIES.items()
            },
        }

    except Exception as e:
        logger.error(f"❌ [Enriched] Error: {e}")
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
                    "provider": "none",
                }
                for t in terms
            ],
            "count": len(terms),
            "provider": "fallback",
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
    session: AsyncSession = Depends(get_session),
):
    """Récupère l'historique des résumés de l'utilisateur"""
    items, total = await get_user_history(
        session=session,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        category=category,
        search=search,
        favorites_only=favorites_only,
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
        pages=math.ceil(total / per_page) if per_page > 0 else 0,
    )


@router.post("/summary/{summary_id}/favorite")
async def toggle_favorite(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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
    session: AsyncSession = Depends(get_session),
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
    session: AsyncSession = Depends(get_session),
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
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    """Supprime un résumé"""
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    await delete_summary(session, summary_id, current_user.id)
    return {"success": True}


@router.delete("/history")
async def clear_history(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
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
async def get_stats(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """Récupère les statistiques de l'utilisateur"""
    stats = await get_user_stats(session, current_user.id)
    return stats


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 OUTILS D'ÉTUDE — Fiches de révision & Arbres pédagogiques
# ═══════════════════════════════════════════════════════════════════════════════

from .study_tools import generate_study_card, generate_concept_map, generate_study_materials


@router.post("/study/{summary_id}/card")
async def create_study_card(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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
            model="mistral-small-2603",
        )

        return {"success": True, "summary_id": summary_id, "study_card": study_card}

    except Exception as e:
        logger.error(f"❌ [STUDY_CARD] Erreur: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


@router.post("/study/{summary_id}/mindmap")
async def create_concept_map(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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
            model="mistral-small-2603",
        )

        return {"success": True, "summary_id": summary_id, "concept_map": concept_map}

    except Exception as e:
        logger.error(f"❌ [CONCEPT_MAP] Erreur: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


@router.post("/study/{summary_id}/all")
async def create_all_study_materials(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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
            include_map=True,
        )

        return {"success": True, "summary_id": summary_id, "materials": materials}

    except Exception as e:
        logger.error(f"❌ [STUDY_ALL] Erreur: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 INTELLIGENT DISCOVERY — Recherche intelligente de vidéos
# ═══════════════════════════════════════════════════════════════════════════════

from .intelligent_discovery import IntelligentDiscoveryService, generate_text_video_id, validate_raw_text
from .schemas import (
    SmartDiscoveryRequest,
    DiscoveryResponse,
    VideoCandidateResponse,
    HybridAnalyzeRequest,
    HybridAnalysisResponse,
    InputType,
    CreditEstimation,
    RawTextAnalysisResponse,
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

    logger.info(f"🔍 [DISCOVER] User {current_user.email} searching: {request.query}")

    try:
        result = await IntelligentDiscoveryService.discover(
            query=request.query,
            languages=request.languages,
            max_results=request.max_results,
            min_quality=request.min_quality,
            target_duration=request.target_duration,
        )

        # Convertir en response
        candidates = [VideoCandidateResponse(**c.to_dict()) for c in result.candidates]

        duration_ms = int((time.time() - start) * 1000)
        logger.info(f"✅ [DISCOVER] Found {len(candidates)} candidates in {duration_ms}ms")

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
        logger.error(f"❌ [DISCOVER] Error: {e}")
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
    logger.info(f"🏆 [DISCOVER/BEST] User {current_user.email} searching: {query}")

    lang_list = [l.strip() for l in languages.split(",")]

    try:
        result = await IntelligentDiscoveryService.discover_single_best(
            query=query,
            languages=lang_list,
        )

        if not result:
            raise HTTPException(status_code=404, detail="Aucune vidéo de qualité trouvée pour cette recherche")

        return VideoCandidateResponse(**result.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [DISCOVER/BEST] Error: {e}")
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
    logger.info(f"🔍 [DISCOVER/SEARCH] User {current_user.email} query='{query}' sort={sort_by} limit={limit}")

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
            videos.append(
                {
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
                }
            )

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

        logger.info(f"✅ [DISCOVER/SEARCH] Returning {len(videos)} videos")

        return {
            "videos": videos,
            "total": len(videos),
            "query": query,
        }

    except Exception as e:
        logger.error(f"❌ [DISCOVER/SEARCH] Error: {e}")
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
    session: AsyncSession = Depends(get_session),
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

    logger.info(f"🔀 [HYBRID] User {current_user.email} - Type: {input_type.value}")

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
            request=analyze_request, background_tasks=background_tasks, current_user=current_user, session=session
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
            raise HTTPException(status_code=402, detail=f"Crédits insuffisants ({current_user.credits}/{credit_cost})")

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

        len(request.raw_text)
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
            raise HTTPException(status_code=400, detail="search_query est requis pour le mode recherche")

        # Découverte intelligente
        discovery_result = await IntelligentDiscoveryService.discover(
            query=request.search_query.strip(),
            languages=request.search_languages,
            max_results=10 if not request.auto_select_best else 1,
            min_quality=25.0,
        )

        candidates = [VideoCandidateResponse(**c.to_dict()) for c in discovery_result.candidates]

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
                request=analyze_request, background_tasks=background_tasks, current_user=current_user, session=session
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
        message="" if sufficient else f"Il vous manque {total_cost - current_user.credits} crédits",
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

    logger.info(f"📝 [RAW_TEXT] Starting analysis for {text_id}")

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
            source_hint=source,  # Utiliser la source comme indice
        )

        logger.info(f"🎯 [RAW_TEXT] Smart title: {smart_title}")
        logger.info(f"📚 [RAW_TEXT] Source type: {source_context.source_type.value}")
        if source_context.detected_origin:
            logger.info(f"   Origin: {source_context.detected_origin}")
        logger.info(f"🖼️ [RAW_TEXT] Thumbnail: {len(thumbnail_url) if thumbnail_url else 0} chars")

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
            web_context=source_instructions if source_instructions else None,  # Injecter les instructions
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

        # 📚 Auto-générer les extras Mistral (Option A 2026-05-06)
        asyncio.create_task(_autogen_summary_extras(user_id, summary_id))

        # 🖼️ Persist AI thumbnail to R2 (non-blocking)
        try:
            import asyncio as _aio_thumb
            from storage.thumbnail_generator import ensure_thumbnail

            _aio_thumb.create_task(
                ensure_thumbnail(
                    summary_id=summary_id,
                    video_id=text_id,
                    title=smart_title,
                    category=detected_category,
                    platform="text",
                    original_url=None,
                    video_url=None,
                )
            )
        except Exception as thumb_err:
            logger.error(f"⚠️ [THUMBNAIL] R2 text thumbnail failed (non-blocking): {thumb_err}")

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

        logger.info(f"✅ [RAW_TEXT] Analysis completed: {text_id}")

    except Exception as e:
        logger.error(f"❌ [RAW_TEXT] Error: {e}")
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
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    """
    🕐 Analyse la fiabilité d'un contenu : fraîcheur + fact-check LITE.

    DISPONIBLE POUR TOUS LES PLANS (Free, Starter, Pro, Expert)

    Returns:
        - freshness: Indicateur de fraîcheur de la vidéo
        - fact_check_lite: Analyse heuristique des affirmations
    """
    if not FACTCHECK_LITE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Service de vérification temporairement indisponible")

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
        lang=summary.lang or "fr",
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
        logger.error(f"⚠️ [PUSH] Factcheck notification failed: {e}")

    return result


@router.post("/reliability/analyze")
async def analyze_text_reliability(
    text: str = Form(..., description="Texte à analyser"),
    title: str = Form(default="", description="Titre (optionnel)"),
    video_date: str = Form(default="", description="Date de publication (optionnel, ISO format)"),
    lang: str = Form(default="fr", description="Langue"),
    current_user: User = Depends(get_current_user),
):
    """
    🔍 Analyse directe d'un texte sans résumé préalable.

    Utile pour analyser du contenu brut ou des extraits.
    """
    if not FACTCHECK_LITE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Service de vérification temporairement indisponible")

    # Validation
    if len(text) < 100:
        raise HTTPException(status_code=400, detail="Texte trop court (minimum 100 caractères)")

    if len(text) > 50000:
        text = text[:50000]  # Limiter

    # Date par défaut = maintenant (considéré frais)
    if not video_date:
        video_date = datetime.utcnow().isoformat()

    result = analyze_content_reliability(video_date=video_date, video_title=title, summary_content=text, lang=lang)

    result["user_plan"] = current_user.plan or "free"
    result["full_factcheck_available"] = current_user.plan in ["pro"]

    return result


@router.get("/freshness/{summary_id}")
async def get_video_freshness(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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
        transcript_excerpt=summary.summary_content[:2000] if summary.summary_content else "",
    )

    return {"summary_id": summary_id, "video_title": summary.video_title, **freshness.to_dict()}


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

    # 🛡️ Phase 2 — Mistral moderation sur title + context utilisateur (si présents)
    user_text_parts = []
    if request.title:
        user_text_parts.append(request.title)
    if request.context:
        user_text_parts.append(request.context)
    if user_text_parts:
        moderation = await moderate_text(" ".join(user_text_parts))
        if not moderation.allowed:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "content_policy_violation",
                    "categories": moderation.flagged_categories,
                },
            )

    # Valider les tailles (base64 → ~1.37x taille originale, donc 14MB en b64 ≈ 10MB réel)
    MAX_B64_SIZE = 14_000_000
    for i, img in enumerate(request.images):
        if len(img.data) > MAX_B64_SIZE:
            raise HTTPException(status_code=400, detail=f"Image {i + 1} trop volumineuse (max 10 MB)")
        if img.mime_type not in ("image/jpeg", "image/png", "image/webp"):
            raise HTTPException(
                status_code=400,
                detail=f"Image {i + 1} : format non supporté ({img.mime_type}). Utiliser JPEG, PNG ou WebP.",
            )

    # Vérifier les crédits
    model = request.model or "mistral-small-2603"
    credit_cost = get_credit_cost(model) if SECURITY_AVAILABLE else 1

    if current_user.credits < credit_cost:
        raise HTTPException(status_code=402, detail=f"Crédits insuffisants ({current_user.credits}/{credit_cost})")

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

    logger.info(f"📸 [IMAGES] User {current_user.email} - {len(request.images)} images - task={task_id}")

    return AnalyzeImagesResponse(
        task_id=task_id,
        status="processing",
        message=f"Analyse de {len(request.images)} image(s) en cours...",
        image_count=len(request.images),
        estimated_duration_seconds=15 + len(request.images) * 5,
        cost=credit_cost,
    )


# NOTE: _detect_video_screenshot, _detect_video_screenshot_vision,
# _search_video_from_screenshot, _brave_search_video, _is_garbage_query,
# and _mistral_vision_request are imported from images.screenshot_detection


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

    logger.info(f"📸 [IMAGES] Starting analysis for {image_id} ({len(images)} images)")

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

                logger.info(
                    f"📱 [IMAGES] Screenshot detected: {platform} — OCR query: '{ocr_query}' — URL: {video_url}"
                )

                # TOUJOURS appeler Vision quand OCR n'a pas trouvé d'URL directe
                # Vision est beaucoup plus fiable que le parsing OCR pour extraire titre/chaîne
                if not video_url:
                    logger.info("🔍 [IMAGES] No direct URL from OCR, calling Vision for title extraction...")
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
                            logger.info(f"✅ [IMAGES] Vision query (primary): '{search_query}'")
                        elif not _is_garbage_query(ocr_query):
                            search_query = ocr_query
                            logger.error(f"⚠️ [IMAGES] Vision failed, using OCR query: '{search_query}'")
                        else:
                            logger.error("❌ [IMAGES] Both Vision and OCR queries are garbage")
                    elif not _is_garbage_query(ocr_query):
                        logger.warning(f"⚠️ [IMAGES] Vision returned nothing, using OCR query: '{search_query}'")
                    else:
                        logger.error(f"❌ [IMAGES] Vision failed and OCR query is garbage: '{ocr_query}'")

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
                        logger.info(f"🔎 [IMAGES] Last resort Brave search with channel: '{_brave_q}'")
                        found_url = await _brave_search_video(_brave_q, platform)

                if found_url:
                    logger.info(f"🎯 [IMAGES] Video found: {found_url}")

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

                            _user = (await _db.execute(_select(User).where(User.id == user_id))).scalar_one_or_none()
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
                        _task_store[task_id]["message"] = (
                            f"Capture {platform} détectée ! Redirection vers l'analyse vidéo..."
                        )
                        _task_store[task_id]["result"] = {
                            "new_task_id": new_task_id,
                            "platform": platform,
                            "video_url": found_url,
                            "video_id": vid_id,
                        }
                        logger.info(f"✅ [IMAGES] Screenshot → video redirect: {found_url} → new_task={new_task_id}")
                        return
                    else:
                        logger.warning(f"⚠️ [IMAGES] Could not extract video_id from {found_url}")
                else:
                    logger.warning(
                        f"⚠️ [IMAGES] Video not found for query '{search_query}', falling back to image analysis"
                    )
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
            fallback_models=[
                "pixtral-large-2411",
                "pixtral-12b-2409",
                "mistral-small-latest",
                "mistral-medium-2508",
                "mistral-large-latest",
            ],
        )

        if not vision_result:
            raise Exception("Mistral Vision : l'API est temporairement surchargée. Réessayez dans 1-2 minutes.")

        logger.info(f"📸 [IMAGES] Vision analysis complete: {len(vision_result)} chars")

        _task_store[task_id]["progress"] = 40
        _task_store[task_id]["message"] = "Texte et visuels extraits. Génération de la synthèse..."

        # ─── Phase 2 : Assembler le pseudo-transcript ───
        header = (
            f"📸 ANALYSE D'IMAGES — {image_count} image(s)"
            if lang == "fr"
            else f"📸 IMAGE ANALYSIS — {image_count} image(s)"
        )
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
            detected_category, category_confidence = detect_category(
                title=title or "", transcript=pseudo_transcript[:5000]
            )

        _task_store[task_id]["progress"] = 60
        _task_store[task_id]["message"] = "Génération de la synthèse DeepSight..."

        # ─── Phase 4 : Générer la synthèse ───
        smart_title = title or (
            f"Analyse d'images ({image_count})" if lang == "fr" else f"Image Analysis ({image_count})"
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

        reliability = await calculate_reliability_score(summary_content or pseudo_transcript, entities, lang=lang)

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
            logger.error(f"[IMAGES] Thumbnail error: {e}")

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

        # 📚 Auto-générer les extras Mistral (Option A 2026-05-06)
        asyncio.create_task(_autogen_summary_extras(user_id, summary_id))

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

        logger.info(f"✅ [IMAGES] Analysis completed: {image_id} → summary_id={summary_id}")

    except Exception as e:
        logger.error(f"❌ [IMAGES] Error: {e}")
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
        r"\[(?:Musique|Music|Applause|Applaudissements)\]",
        r"[♪♫🎵🎶]+",
        r"\[.*?\]",
    ]
    for pat in noise_patterns:
        cleaned = _re.sub(pat, "", cleaned, flags=_re.IGNORECASE)
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

    logger.info(f"🎞️ [SLIDESHOW] Extracting frames from {platform}: {video_url}")

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            video_path = os.path.join(tmpdir, "video.mp4")

            download_cmd = [
                "yt-dlp",
                "--no-warnings",
                "--geo-bypass",
                "-f",
                "worst[ext=mp4]/worst",
                "--max-filesize",
                "50M",
                "-o",
                video_path,
                video_url,
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
                logger.error("🎞️ [SLIDESHOW] Download failed")
                return None

            def get_dur():
                try:
                    r = subprocess.run(
                        [
                            "ffprobe",
                            "-v",
                            "error",
                            "-show_entries",
                            "format=duration",
                            "-of",
                            "default=noprint_wrappers=1:nokey=1",
                            video_path,
                        ],
                        capture_output=True,
                        text=True,
                        timeout=10,
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
                "ffmpeg",
                "-i",
                video_path,
                "-vf",
                f"fps=1/{interval},scale=640:-1",
                "-q:v",
                "3",
                "-frames:v",
                str(max_frames),
                frames_pat,
                "-y",
                "-loglevel",
                "error",
            ]

            def do_ff():
                try:
                    r = subprocess.run(ff_cmd, capture_output=True, text=True, timeout=30)
                    return r.returncode == 0
                except Exception:
                    return False

            ok = await loop.run_in_executor(None, do_ff)
            if not ok:
                logger.error("🎞️ [SLIDESHOW] ffmpeg extraction failed")
                return None

            frame_files = sorted(glob_module.glob(os.path.join(tmpdir, "frame_*.jpg")))
            if not frame_files:
                logger.info("🎞️ [SLIDESHOW] No frames found")
                return None

            frames = []
            for fpath in frame_files[:max_frames]:
                with open(fpath, "rb") as f:
                    raw = f.read()
                    frames.append({"data": base64.b64encode(raw).decode(), "mime_type": "image/jpeg"})

            logger.info(f"🎞️ [SLIDESHOW] Extracted {len(frames)} frames from {duration:.1f}s video")
            return frames

    except Exception as e:
        logger.error(f"🎞️ [SLIDESHOW] Error: {e}")
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
