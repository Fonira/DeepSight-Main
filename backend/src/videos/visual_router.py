"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  👁️ VISUAL ANALYSIS — Router debug admin (POC)                                    ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Endpoint isolé pour valider le pipeline frame_extractor + visual_analyzer        ║
║  sur une URL distante, sans toucher au flow /analyze principal.                   ║
║                                                                                    ║
║  Gating : admin uniquement + feature flag VISUAL_ANALYSIS_ENABLED.                ║
║  Aucune écriture DB, aucune consommation de crédits.                              ║
║                                                                                    ║
║  Phase 2 : intégration dans /api/videos/analyze derrière un flag par requête.     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import logging
import os
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth.dependencies import get_current_admin
from db.database import User

from .frame_extractor import extract_frames_from_url
from .visual_analyzer import analyze_frames
from .youtube_storyboard import extract_storyboard_frames, normalize_video_id

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FEATURE FLAG
# ═══════════════════════════════════════════════════════════════════════════════


def _flag_enabled() -> bool:
    return os.getenv("VISUAL_ANALYSIS_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class VisualAnalysisDebugResponse(BaseModel):
    status: str = Field(..., description="ok | extract_failed | vision_failed | flag_off | invalid_input")
    source: str = ""  # "url" | "storyboard"
    url: str = ""
    video_id: str = ""
    duration_s: float = 0.0
    fps_used: float = 0.0
    frame_count: int = 0
    frames_downsampled: bool = False
    long_video_warning: bool = False
    elapsed_total_s: float = 0.0
    elapsed_extract_s: float = 0.0
    elapsed_vision_s: float = 0.0
    model_used: str = ""
    analysis: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/debug-from-url", response_model=VisualAnalysisDebugResponse)
async def debug_visual_from_url(
    url: str = Query(..., min_length=10, description="URL de la vidéo à analyser"),
    transcript: Optional[str] = Query(
        None,
        description="Extrait de transcript optionnel pour enrichir le prompt vision.",
    ),
    focused_start: Optional[float] = Query(None, ge=0, description="Début (s) — focused mode"),
    focused_end: Optional[float] = Query(None, ge=0, description="Fin (s) — focused mode"),
    max_frames: Optional[int] = Query(None, ge=1, le=100, description="Override budget frames (≤100)"),
    width: int = Query(512, ge=256, le=1280, description="Largeur frames en px"),
    user: User = Depends(get_current_admin),
) -> VisualAnalysisDebugResponse:
    """
    POC : extrait les frames d'une URL distante et les passe à Mistral Vision.

    Réservé admin + feature flag VISUAL_ANALYSIS_ENABLED. Aucun crédit consommé,
    aucune écriture DB. Cleanup automatique des frames en fin de requête.
    """
    if not _flag_enabled():
        return VisualAnalysisDebugResponse(
            status="flag_off",
            url=url,
            error="VISUAL_ANALYSIS_ENABLED is not set to true",
        )

    if focused_end is not None and focused_start is not None and focused_end <= focused_start:
        raise HTTPException(400, "focused_end must be > focused_start")

    log_tag = f"VISUAL_POC user={user.id}"
    t_total = time.time()

    # ── 1. Extraction frames ──
    t_extract = time.time()
    extraction = await extract_frames_from_url(
        url,
        focused_start=focused_start,
        focused_end=focused_end,
        max_frames_override=max_frames,
        width=width,
        log_tag=log_tag,
    )
    elapsed_extract = time.time() - t_extract

    if not extraction:
        return VisualAnalysisDebugResponse(
            status="extract_failed",
            source="url",
            url=url,
            elapsed_extract_s=round(elapsed_extract, 2),
            elapsed_total_s=round(time.time() - t_total, 2),
            error="frame extraction failed (yt-dlp or ffmpeg). Check container logs.",
        )

    # ── 2. Analyse vision ──
    t_vision = time.time()
    try:
        analysis = await analyze_frames(
            extraction.frame_paths,
            extraction.frame_timestamps,
            transcript_excerpt=transcript or "",
            log_tag=log_tag,
        )
    finally:
        # On nettoie les frames qu'il y ait eu erreur ou pas
        extraction.cleanup()
    elapsed_vision = time.time() - t_vision

    if not analysis:
        return VisualAnalysisDebugResponse(
            status="vision_failed",
            source="url",
            url=url,
            duration_s=round(extraction.duration_s, 2),
            fps_used=round(extraction.fps_used, 3),
            frame_count=extraction.frame_count,
            long_video_warning=extraction.long_video_warning,
            elapsed_extract_s=round(elapsed_extract, 2),
            elapsed_vision_s=round(elapsed_vision, 2),
            elapsed_total_s=round(time.time() - t_total, 2),
            error="Mistral Vision returned no usable JSON. Check Mistral key & quotas.",
        )

    return VisualAnalysisDebugResponse(
        status="ok",
        source="url",
        url=url,
        duration_s=round(extraction.duration_s, 2),
        fps_used=round(extraction.fps_used, 3),
        frame_count=extraction.frame_count,
        frames_downsampled=analysis.frames_downsampled,
        long_video_warning=extraction.long_video_warning,
        elapsed_extract_s=round(elapsed_extract, 2),
        elapsed_vision_s=round(elapsed_vision, 2),
        elapsed_total_s=round(time.time() - t_total, 2),
        model_used=analysis.model_used,
        analysis=analysis.to_dict(),
    )


@router.get("/debug-from-youtube", response_model=VisualAnalysisDebugResponse)
async def debug_visual_from_youtube(
    video_id_or_url: str = Query(
        ...,
        min_length=11,
        description="Video ID YouTube (11 chars) ou URL complète. Pivot 5 : utilise les storyboards i.ytimg.com (pas de download de la vidéo, contourne l'IP ban Hetzner).",
    ),
    transcript: Optional[str] = Query(
        None,
        description="Extrait de transcript optionnel pour enrichir le prompt vision.",
    ),
    max_frames: Optional[int] = Query(None, ge=1, le=100, description="Override budget frames (≤100)"),
    user: User = Depends(get_current_admin),
) -> VisualAnalysisDebugResponse:
    """
    POC Pivot 5 : extrait les frames d'une vidéo YouTube via les storyboards
    publics (i.ytimg.com), pas via download du stream vidéo. Pas de proxy
    nécessaire, fonctionne malgré l'IP ban Hetzner sur le stream YouTube.

    Réservé admin + feature flag VISUAL_ANALYSIS_ENABLED.
    """
    if not _flag_enabled():
        return VisualAnalysisDebugResponse(
            status="flag_off",
            source="storyboard",
            url=video_id_or_url,
            error="VISUAL_ANALYSIS_ENABLED is not set to true",
        )

    video_id = normalize_video_id(video_id_or_url)
    if not video_id:
        return VisualAnalysisDebugResponse(
            status="invalid_input",
            source="storyboard",
            url=video_id_or_url,
            error="Could not extract a valid 11-char YouTube video_id",
        )

    log_tag = f"VISUAL_SB user={user.id}"
    t_total = time.time()

    # ── 1. Extraction storyboards ──
    t_extract = time.time()
    extraction = await extract_storyboard_frames(
        video_id,
        max_frames_override=max_frames,
        log_tag=log_tag,
    )
    elapsed_extract = time.time() - t_extract

    if not extraction:
        return VisualAnalysisDebugResponse(
            status="extract_failed",
            source="storyboard",
            url=video_id_or_url,
            video_id=video_id,
            elapsed_extract_s=round(elapsed_extract, 2),
            elapsed_total_s=round(time.time() - t_total, 2),
            error="Storyboard extraction failed (yt-dlp -j blocked, no sb format, or sheet 403). Check logs.",
        )

    # ── 2. Analyse vision ──
    t_vision = time.time()
    try:
        analysis = await analyze_frames(
            extraction.frame_paths,
            extraction.frame_timestamps,
            transcript_excerpt=transcript or "",
            log_tag=log_tag,
        )
    finally:
        extraction.cleanup()
    elapsed_vision = time.time() - t_vision

    if not analysis:
        return VisualAnalysisDebugResponse(
            status="vision_failed",
            source="storyboard",
            url=video_id_or_url,
            video_id=video_id,
            duration_s=round(extraction.duration_s, 2),
            fps_used=round(extraction.fps_used, 3),
            frame_count=extraction.frame_count,
            long_video_warning=extraction.long_video_warning,
            elapsed_extract_s=round(elapsed_extract, 2),
            elapsed_vision_s=round(elapsed_vision, 2),
            elapsed_total_s=round(time.time() - t_total, 2),
            error="Mistral Vision returned no usable JSON. Check Mistral key & quotas.",
        )

    return VisualAnalysisDebugResponse(
        status="ok",
        source="storyboard",
        url=video_id_or_url,
        video_id=video_id,
        duration_s=round(extraction.duration_s, 2),
        fps_used=round(extraction.fps_used, 3),
        frame_count=extraction.frame_count,
        frames_downsampled=analysis.frames_downsampled,
        long_video_warning=extraction.long_video_warning,
        elapsed_extract_s=round(elapsed_extract, 2),
        elapsed_vision_s=round(elapsed_vision, 2),
        elapsed_total_s=round(time.time() - t_total, 2),
        model_used=analysis.model_used,
        analysis=analysis.to_dict(),
    )


@router.get("/health")
async def visual_health(user: User = Depends(get_current_admin)) -> Dict[str, Any]:
    """Sanity check : flag state + ffmpeg/yt-dlp dispo."""
    import shutil

    return {
        "flag_enabled": _flag_enabled(),
        "ffmpeg_available": shutil.which("ffmpeg") is not None,
        "ffprobe_available": shutil.which("ffprobe") is not None,
        "yt_dlp_available": shutil.which("yt-dlp") is not None,
        "frames_dir": os.getenv("VISUAL_FRAMES_DIR", "/tmp/deepsight-frames"),
    }
