"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔌 VISUAL INTEGRATION — Hook Phase 2 dans le flow /api/videos/analyze            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Orchestre l'enrichissement visuel multimodal (Phase 2) :                         ║
║  1. Plan gating : Pro/Expert seulement (Free → upsell, jamais incrémenté)         ║
║  2. Quota mensuel : Pro=30, Expert=illimité (table visual_analysis_quota)         ║
║  3. Extraction video_id YouTube (Phase 2 = YouTube uniquement)                    ║
║  4. Pipeline Pivot 5 : extract_storyboard_frames + analyze_frames                 ║
║  5. Format visual context pour injection dans le prompt Mistral analysis          ║
║                                                                                    ║
║  Source de vérité quotas : core.plan_limits (DRY) ; ce module ne hardcode pas.    ║
║  Spec : 01-Projects/DeepSight/Sessions/2026-05-06-visual-analysis-phase-2-spec.md ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import logging
import re
import time
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import User, VisualAnalysisQuota

from .visual_analyzer import VisualAnalysis, analyze_frames
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
STATUS_NOT_YOUTUBE = "not_youtube"  # URL TikTok/Vimeo, etc. — Phase 2 = YouTube uniquement
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

    # ── 2. URL → video_id YouTube ──
    video_id = normalize_video_id(url)
    if not video_id:
        # Pas une URL/ID YouTube → Phase 2 ne couvre pas TikTok/Vimeo
        return {
            "status": STATUS_NOT_YOUTUBE,
            "elapsed_s": round(time.time() - t0, 2),
        }

    # ── 3. Extraction storyboards (Pivot 5) ──
    extraction = await extract_storyboard_frames(video_id, log_tag=log_tag)
    if extraction is None:
        return {
            "status": STATUS_EXTRACT_FAILED,
            "video_id": video_id,
            "elapsed_s": round(time.time() - t0, 2),
        }

    # ── 4. Mistral Vision ──
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
            "video_id": video_id,
            "frame_count": extraction.frame_count,
            "elapsed_s": round(time.time() - t0, 2),
        }

    # ── 5. Quota incrément (succès uniquement) ──
    new_count = await increment_quota(db, user.id)

    elapsed = round(time.time() - t0, 2)
    logger.info(
        "[%s] OK in %.1fs (frames=%d model=%s quota_count=%d)",
        log_tag,
        elapsed,
        extraction.frame_count,
        analysis.model_used,
        new_count,
    )

    return {
        "status": STATUS_OK,
        "video_id": video_id,
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
