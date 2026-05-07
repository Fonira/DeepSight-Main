"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔌 VISUAL INTEGRATION — Hook Phase 2 dans le flow /api/videos/analyze            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Orchestre l'enrichissement visuel multimodal (Phase 2) :                         ║
║  1. Plan gating : Pro/Expert seulement (Free → upsell, jamais incrémenté)         ║
║  2. Quota mensuel : Pro=30, Expert=illimité (table visual_analysis_quota)         ║
║  3. Extraction frames selon plateforme :                                          ║
║     • YouTube → Pivot 5 storyboards (i.ytimg.com, no download)                    ║
║     • TikTok  → download via tikwm fallback + ffmpeg frames (extract_frames_from_local)║
║  4. Mistral Vision (analyze_frames, agnostic)                                     ║
║  5. Format visual context pour injection dans le prompt Mistral analysis          ║
║                                                                                    ║
║  Source de vérité quotas : core.plan_limits (DRY) ; ce module ne hardcode pas.    ║
║  Spec : 01-Projects/DeepSight/Sessions/2026-05-06-visual-analysis-phase-2-spec.md ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import logging
import re
import tempfile
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import User, VisualAnalysisQuota

from .frame_extractor import FrameExtractionResult, extract_frames_from_local
from .visual_analyzer import analyze_frames
from .youtube_storyboard import extract_storyboard_frames, normalize_video_id

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 QUOTAS PHASE 2 (single source of truth)
# ═══════════════════════════════════════════════════════════════════════════════

VISUAL_QUOTA_BY_PLAN: Dict[str, Optional[int]] = {
    "free": 0,
    "pro": 30,
    "expert": None,  # None = illimité
    # Legacy aliases (cf. pricing v2 migration 012)
    "starter": 30,  # ancien starter == pro après migration
    "plus": 30,
}

# Coût en crédits par appel visual_analysis (s'ajoute au coût d'analyse de base)
VISUAL_CREDITS_COST = 2


# ═══════════════════════════════════════════════════════════════════════════════
# 🚦 RÉSULTATS ENUM-LIKE
# ═══════════════════════════════════════════════════════════════════════════════

# Status renvoyés par maybe_enrich_with_visual()
STATUS_OK = "ok"
STATUS_DISABLED = "disabled"  # flag VISUAL_ANALYSIS_ENABLED pas activé
STATUS_PLAN_NOT_ALLOWED = "plan_not_allowed"  # Free
STATUS_QUOTA_EXCEEDED = "quota_exceeded"
STATUS_NOT_SUPPORTED = "not_supported"  # plateforme inconnue (Vimeo, etc.)
STATUS_NOT_YOUTUBE = "not_youtube"  # rétro-compat — synonyme de not_supported pour callers existants
STATUS_EXTRACT_FAILED = "extract_failed"
STATUS_VISION_FAILED = "vision_failed"


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def _current_period() -> str:
    """Renvoie le mois courant au format YYYY-MM."""
    return datetime.utcnow().strftime("%Y-%m")


def _normalize_plan(plan: Optional[str]) -> str:
    """Normalize plan name (lowercase, fallback 'free')."""
    if not plan:
        return "free"
    return str(plan).strip().lower()


def get_quota_for_plan(plan: str) -> Optional[int]:
    """Renvoie le quota mensuel pour un plan, None si illimité, 0 si Free."""
    return VISUAL_QUOTA_BY_PLAN.get(_normalize_plan(plan), 0)


# ═══════════════════════════════════════════════════════════════════════════════
# 🗃️ QUOTA DB OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════════


async def get_or_create_quota_row(
    db: AsyncSession, user_id: int, period: Optional[str] = None
) -> VisualAnalysisQuota:
    """Récupère la ligne quota du mois ou la crée si absente. Pas de commit."""
    period = period or _current_period()

    result = await db.execute(
        select(VisualAnalysisQuota).where(
            VisualAnalysisQuota.user_id == user_id,
            VisualAnalysisQuota.period == period,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = VisualAnalysisQuota(user_id=user_id, period=period, count=0)
        db.add(row)
        await db.flush()
    return row


async def can_consume(db: AsyncSession, user: User) -> Tuple[bool, str]:
    """
    Vérifie si l'user peut consommer un visual_analysis.

    Retourne (allowed, reason). reason ∈ STATUS_*.
    Ne mute pas le quota — c'est increment_quota() qui le fait après succès.
    """
    plan = _normalize_plan(getattr(user, "plan", None))
    quota = get_quota_for_plan(plan)

    if quota == 0:
        return False, STATUS_PLAN_NOT_ALLOWED
    if quota is None:
        return True, STATUS_OK  # illimité (Expert)

    row = await get_or_create_quota_row(db, user.id)
    if row.count >= quota:
        return False, STATUS_QUOTA_EXCEEDED
    return True, STATUS_OK


async def increment_quota(db: AsyncSession, user_id: int) -> int:
    """Incrémente le compteur du mois pour user_id. Renvoie la nouvelle valeur. Pas de commit."""
    row = await get_or_create_quota_row(db, user_id)
    row.count = (row.count or 0) + 1
    row.last_used_at = datetime.utcnow()
    db.add(row)
    await db.flush()
    return row.count


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 INTÉGRATION FLOW /analyze
# ═══════════════════════════════════════════════════════════════════════════════


async def maybe_enrich_with_visual(
    db: AsyncSession,
    user: User,
    url: str,
    *,
    transcript_excerpt: str = "",
    flag_enabled: bool = True,
) -> Dict[str, Any]:
    """
    Pipeline Phase 2 appelé depuis videos/router.py quand
    AnalyzeVideoRequest.include_visual_analysis=True.

    Renvoie toujours un dict avec au minimum `status` et `elapsed_s`.
    Si status=ok, contient également `analysis` (dict serialisé), `frame_count`,
    `model_used`. Le caller injecte `analysis.summary_visual` et `key_moments`
    dans le prompt Mistral analysis principal.

    NE PAS RAISER : cette fonction est best-effort. En cas d'échec, l'analyse
    de base se fait quand même sans la couche visuelle (graceful degradation).

    Aucun commit DB n'est fait ici — le caller commit en fin de flow.
    """
    t0 = time.time()
    log_tag = f"VISUAL_INT user={user.id}"

    if not flag_enabled:
        return {"status": STATUS_DISABLED, "elapsed_s": 0.0}

    # ── 1. Plan gating + quota check ──
    allowed, reason = await can_consume(db, user)
    if not allowed:
        logger.info("[%s] Skipped (%s)", log_tag, reason)
        return {"status": reason, "elapsed_s": round(time.time() - t0, 2)}

    # ── 2. Détection plateforme + extraction frames adaptée ──
    platform = _detect_visual_platform(url)

    if platform == "youtube":
        video_id = normalize_video_id(url)
        if not video_id:
            return {
                "status": STATUS_NOT_SUPPORTED,
                "elapsed_s": round(time.time() - t0, 2),
            }
        extraction = await extract_storyboard_frames(video_id, log_tag=log_tag)
        identifier_for_logs = video_id
    elif platform == "tiktok":
        # TikTok : download via tikwm fallback (IP Hetzner ban yt-dlp direct)
        # → extract_frames_from_local → cleanup
        video_id = _extract_tiktok_id_or_fallback(url)
        extraction = await _extract_tiktok_visual_frames(url, video_id, log_tag=log_tag)
        identifier_for_logs = video_id
    else:
        return {
            "status": STATUS_NOT_SUPPORTED,
            "elapsed_s": round(time.time() - t0, 2),
        }

    if extraction is None:
        return {
            "status": STATUS_EXTRACT_FAILED,
            "video_id": identifier_for_logs,
            "platform": platform,
            "elapsed_s": round(time.time() - t0, 2),
        }

    # ── 3. Mistral Vision (commun à toutes plateformes) ──
    try:
        analysis = await analyze_frames(
            extraction.frame_paths,
            extraction.frame_timestamps,
            transcript_excerpt=transcript_excerpt,
            log_tag=log_tag,
        )
    finally:
        extraction.cleanup()

    if analysis is None:
        return {
            "status": STATUS_VISION_FAILED,
            "video_id": identifier_for_logs,
            "platform": platform,
            "frame_count": extraction.frame_count,
            "elapsed_s": round(time.time() - t0, 2),
        }

    # ── 4. Quota incrément (succès uniquement) ──
    new_count = await increment_quota(db, user.id)

    elapsed = round(time.time() - t0, 2)
    logger.info(
        "[%s] OK in %.1fs (platform=%s frames=%d model=%s quota_count=%d)",
        log_tag,
        elapsed,
        platform,
        extraction.frame_count,
        analysis.model_used,
        new_count,
    )

    return {
        "status": STATUS_OK,
        "video_id": identifier_for_logs,
        "platform": platform,
        "frame_count": extraction.frame_count,
        "duration_s": round(extraction.duration_s, 2),
        "model_used": analysis.model_used,
        "frames_downsampled": analysis.frames_downsampled,
        "analysis": analysis.to_dict(),
        "credits_consumed": VISUAL_CREDITS_COST,
        "quota_count_after": new_count,
        "elapsed_s": elapsed,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🎬 EXTRACTION FRAMES PAR PLATEFORME
# ═══════════════════════════════════════════════════════════════════════════════


_TIKTOK_HOSTS_RE = re.compile(r"(?:^|\.)(?:tiktok\.com|vm\.tiktok\.com)", re.IGNORECASE)


def _detect_visual_platform(url: str) -> str:
    """Détecte la plateforme à partir de l'URL.

    Returns:
        "youtube" | "tiktok" | "unknown"
    """
    if not url:
        return "unknown"
    if _TIKTOK_HOSTS_RE.search(url):
        return "tiktok"
    if normalize_video_id(url):
        return "youtube"
    # Fallback : pas de match URL mais peut-être une chaîne d'ID YouTube brut
    return "unknown"


def _extract_tiktok_id_or_fallback(url: str) -> str:
    """Extrait l'ID vidéo TikTok ou retourne 'tiktok_<rand>' en fallback (logs only)."""
    try:
        from transcripts.tiktok import extract_tiktok_video_id

        vid = extract_tiktok_video_id(url)
        if vid:
            return vid
    except Exception:
        pass
    return f"tiktok_{uuid.uuid4().hex[:8]}"


async def _extract_tiktok_visual_frames(
    url: str, video_id: str, *, log_tag: str
) -> Optional[FrameExtractionResult]:
    """Pipeline TikTok : download bytes → /tmp file → extract_frames_from_local.

    L'IP Hetzner est ban TikTok pour `yt-dlp <video_url>` direct, donc on
    réutilise `_download_video_bytes()` qui a un fallback tikwm.com éprouvé
    en prod (utilisé par Phase 5 Visual OCR du transcript).
    """
    # Lazy import : évite cycle transcripts → videos → transcripts
    try:
        from transcripts.tiktok import _download_video_bytes
    except Exception as e:
        logger.warning("[%s] _download_video_bytes import failed: %s", log_tag, e)
        return None

    t0 = time.time()
    try:
        video_data = await _download_video_bytes(url, video_id)
    except Exception as e:
        logger.warning("[%s] TikTok download raised: %s", log_tag, e)
        return None

    if not video_data:
        logger.warning("[%s] TikTok download returned empty for %s", log_tag, video_id)
        return None

    logger.info(
        "[%s] TikTok download OK in %.1fs (%.0f KB)",
        log_tag,
        time.time() - t0,
        len(video_data) / 1024,
    )

    # Sauvegarde fichier temporaire — extract_frames_from_local lira ffprobe + ffmpeg
    tmp_path = Path(tempfile.gettempdir()) / f"tk_visual_{video_id}_{uuid.uuid4().hex[:8]}.mp4"
    try:
        tmp_path.write_bytes(video_data)
    except OSError as e:
        logger.warning("[%s] Failed to write tmp file %s: %s", log_tag, tmp_path, e)
        return None

    try:
        result = await extract_frames_from_local(str(tmp_path), log_tag=f"{log_tag} TIKTOK")
    finally:
        # Le mp4 source n'est plus utile une fois les frames extraites — peu importe le résultat
        tmp_path.unlink(missing_ok=True)

    if result is None:
        logger.warning("[%s] TikTok ffmpeg extraction returned None for %s", log_tag, video_id)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 HELPER UNIFIÉ — wraps maybe_enrich + format pour V1/V2/V2.1
# ═══════════════════════════════════════════════════════════════════════════════


async def enrich_and_capture_visual(
    db: AsyncSession,
    user_id: int,
    url: str,
    *,
    transcript_excerpt: str,
    web_context: str,
    flag_enabled: bool,
    log_tag: str,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    Helper unifié appelé par V1, V2, V2.1 pour appliquer le hook visual.

    Flow :
    1. Check flag VISUAL_ANALYSIS_ENABLED
    2. Fetch user (pour quota check)
    3. Run maybe_enrich_with_visual (extraction storyboards + Mistral Vision)
    4. Si OK : append visual block à web_context + capture le dict
    5. Si KO : log + retourne web_context inchangé, visual_analysis_data=None

    Renvoie (updated_web_context, visual_analysis_data).
    Le caller persist `visual_analysis_data` sur Summary.visual_analysis
    après save_summary().

    Best-effort — toute exception est attrapée et loggée (graceful degradation).
    """
    if not flag_enabled:
        return web_context, None

    try:
        _user_q = await db.execute(select(User).where(User.id == user_id))
        _user_row = _user_q.scalar_one_or_none()
        if not _user_row:
            return web_context, None

        _visual = await maybe_enrich_with_visual(
            db=db,
            user=_user_row,
            url=url,
            transcript_excerpt=(transcript_excerpt or "")[:8000],
            flag_enabled=True,
        )
        if _visual.get("status") != STATUS_OK:
            logger.info(f"👁️ [{log_tag}] visual skipped: status={_visual.get('status')}")
            return web_context, None

        _visual_block = format_visual_context_for_prompt(_visual)
        new_web_context = web_context or ""
        if _visual_block:
            new_web_context = (
                (new_web_context + "\n\n" + _visual_block) if new_web_context else _visual_block
            )

        logger.info(
            f"👁️ [{log_tag}] visual enrichment OK: "
            f"frames={_visual.get('frame_count', 0)} "
            f"model={_visual.get('model_used')} "
            f"elapsed={_visual.get('elapsed_s', 0.0):.1f}s"
        )
        return new_web_context, _visual.get("analysis")
    except Exception as e:
        # Graceful — pas de raise. L'analyse de base continue sans la couche visuelle.
        logger.warning(f"👁️ [{log_tag}] visual enrichment raised (graceful): {e}")
        return web_context, None


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 FORMAT POUR INJECTION DANS LE PROMPT
# ═══════════════════════════════════════════════════════════════════════════════


def format_visual_context_for_prompt(visual_result: Dict[str, Any]) -> str:
    """
    Transforme un résultat de maybe_enrich_with_visual (status=ok) en bloc texte
    à injecter dans le prompt Mistral analysis principal.

    Renvoie une chaîne vide si status != ok ou analysis manquante (graceful no-op).
    """
    if visual_result.get("status") != STATUS_OK:
        return ""
    analysis = visual_result.get("analysis") or {}
    if not analysis:
        return ""

    parts: list[str] = []
    parts.append("--- COUCHE VISUELLE (analyse multimodale) ---")

    if analysis.get("visual_hook"):
        parts.append(f"Hook visuel : {analysis['visual_hook']}")
    if analysis.get("visual_structure"):
        parts.append(f"Structure dominante : {analysis['visual_structure']}")
    if analysis.get("summary_visual"):
        parts.append(f"Résumé visuel : {analysis['summary_visual']}")

    moments = analysis.get("key_moments") or []
    if moments:
        parts.append("Moments visuels saillants :")
        for m in moments[:8]:
            ts = m.get("timestamp_s", 0)
            desc = m.get("description", "")
            mtype = m.get("type", "")
            parts.append(f"  • [{ts:.1f}s][{mtype}] {desc}")

    if analysis.get("visible_text"):
        parts.append(f"Texte visible à l'écran : {analysis['visible_text']}")

    parts.append("--- FIN COUCHE VISUELLE ---")
    return "\n".join(parts)
