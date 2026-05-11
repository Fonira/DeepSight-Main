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

import asyncio
import logging
import re
import subprocess
import tempfile
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import User, VisualAnalysisQuota
from transcripts.audio_utils import _yt_dlp_extra_args, executor as audio_executor

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

# Coût en crédits par appel visual_analysis (s'ajoute au coût d'analyse de base).
# Différencié par mode : Pro (default) paye moins, Expert paye plus pour ×2-3 frames.
VISUAL_CREDITS_COST_BY_MODE: Dict[str, int] = {
    "default": 2,
    "expert": 3,
}
# Cap frames analysées par Mistral, par mode. Default (Pro) plafonne ~24,
# Expert pousse au cap dur Mistral (64 = 8 batches × 8 frames).
MAX_FRAMES_CAP_BY_MODE: Dict[str, int] = {
    "default": 24,
    "expert": 64,
}
# Rétro-compat : constante historique. Lisez VISUAL_CREDITS_COST_BY_MODE pour la valeur réelle.
VISUAL_CREDITS_COST = VISUAL_CREDITS_COST_BY_MODE["default"]


def _select_mode_for_plan(plan: Optional[str]) -> str:
    """Mappe le plan user → mode visual analysis ('default' | 'expert').

    Plans Expert obtiennent le mode dense (~64 frames cap). Tous les autres plans
    payants (Pro, starter legacy, plus legacy) sont en mode 'default' (~24 frames cap).
    Free n'arrive pas jusqu'ici (filtré en amont par can_consume).
    """
    return "expert" if _normalize_plan(plan) == "expert" else "default"


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

    # ── 2. Sélection mode selon plan ──
    mode = _select_mode_for_plan(getattr(user, "plan", None))

    # ── 3. Détection plateforme + extraction frames adaptée ──
    platform = _detect_visual_platform(url)

    if platform == "youtube":
        video_id = normalize_video_id(url)
        if not video_id:
            return {
                "status": STATUS_NOT_SUPPORTED,
                "elapsed_s": round(time.time() - t0, 2),
            }
        # transcript_excerpt provient déjà du caller (videos/router.py)
        # et contient les timestamps Supadata `[mm:ss]` — utilisé en
        # fallback ultime dans extract_storyboard_frames si yt-dlp +
        # sb fragments + Supadata get_video_info échouent à donner duration.
        extraction = await extract_storyboard_frames(
            video_id,
            mode=mode,
            transcript_hint=transcript_excerpt or None,
            log_tag=log_tag,
        )
        identifier_for_logs = video_id
    elif platform == "tiktok":
        # TikTok : download via tikwm fallback (IP Hetzner ban yt-dlp direct)
        # → extract_frames_from_local → cleanup
        video_id = _extract_tiktok_id_or_fallback(url)
        extraction = await _extract_tiktok_visual_frames(url, video_id, mode=mode, log_tag=log_tag)
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
            "visual_mode": mode,
            "elapsed_s": round(time.time() - t0, 2),
        }

    # ── 4. Mistral Vision (commun à toutes plateformes) ──
    max_frames_cap = MAX_FRAMES_CAP_BY_MODE.get(mode, MAX_FRAMES_CAP_BY_MODE["default"])
    try:
        analysis = await analyze_frames(
            extraction.frame_paths,
            extraction.frame_timestamps,
            transcript_excerpt=transcript_excerpt,
            max_frames_cap=max_frames_cap,
            log_tag=log_tag,
        )
    finally:
        extraction.cleanup()

    if analysis is None:
        return {
            "status": STATUS_VISION_FAILED,
            "video_id": identifier_for_logs,
            "platform": platform,
            "visual_mode": mode,
            "frame_count": extraction.frame_count,
            "elapsed_s": round(time.time() - t0, 2),
        }

    # ── 5. Quota incrément (succès uniquement) ──
    new_count = await increment_quota(db, user.id)

    elapsed = round(time.time() - t0, 2)
    credits_consumed = VISUAL_CREDITS_COST_BY_MODE.get(mode, VISUAL_CREDITS_COST_BY_MODE["default"])
    logger.info(
        "[%s] OK in %.1fs (platform=%s mode=%s frames=%d model=%s quota_count=%d credits=%d)",
        log_tag,
        elapsed,
        platform,
        mode,
        extraction.frame_count,
        analysis.model_used,
        new_count,
        credits_consumed,
    )

    return {
        "status": STATUS_OK,
        "video_id": identifier_for_logs,
        "platform": platform,
        "visual_mode": mode,
        "frame_count": extraction.frame_count,
        "duration_s": round(extraction.duration_s, 2),
        "model_used": analysis.model_used,
        "frames_downsampled": analysis.frames_downsampled,
        "analysis": analysis.to_dict(),
        "credits_consumed": credits_consumed,
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


_TIKWM_API_URL = "https://www.tikwm.com/api/"
_TIKWM_TIMEOUT_S = 15.0
_TIKWM_DOWNLOAD_TIMEOUT_S = 60.0


async def _download_tiktok_video_no_watermark(
    url: str, *, log_tag: str
) -> Optional[bytes]:
    """Télécharge la vidéo TikTok no-watermark via tikwm.com (`data.play`).

    `transcripts.tiktok._download_video_bytes()` priorise `music_info.play`
    qui retourne l'audio MP3 de la musique de fond — utile pour Phase 5 OCR
    transcript mais inutilisable pour ffmpeg frame extraction.

    Ici on prend le champ `data.play` qui est la vidéo MP4 (audio + vidéo),
    nécessaire pour ffprobe + ffmpeg dans extract_frames_from_local.
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=_TIKWM_TIMEOUT_S) as client:
            resp = await client.post(_TIKWM_API_URL, data={"url": url})
        if resp.status_code != 200:
            logger.warning(
                "[%s] tikwm API HTTP %d for %s", log_tag, resp.status_code, url
            )
            return None
        payload = resp.json()
    except Exception as e:
        logger.warning("[%s] tikwm API request failed for %s: %s", log_tag, url, e)
        return None

    data = payload.get("data") or {}
    media_url = data.get("play") or data.get("hdplay") or data.get("wmplay")
    if not media_url:
        logger.warning(
            "[%s] tikwm response missing play/hdplay/wmplay (keys=%s)",
            log_tag,
            list(data.keys())[:10],
        )
        return None

    try:
        async with httpx.AsyncClient(
            timeout=_TIKWM_DOWNLOAD_TIMEOUT_S,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                "Referer": "https://www.tiktok.com/",
            },
        ) as client:
            r = await client.get(media_url)
        if r.status_code != 200:
            logger.warning(
                "[%s] tikwm video CDN HTTP %d for %s", log_tag, r.status_code, media_url[:80]
            )
            return None
        if len(r.content) < 1000:
            logger.warning(
                "[%s] tikwm video CDN returned only %d bytes (suspect)",
                log_tag,
                len(r.content),
            )
            return None
        return r.content
    except Exception as e:
        logger.warning("[%s] tikwm video download failed: %s", log_tag, e)
        return None


async def _download_tiktok_video_via_ytdlp(
    url: str, *, log_tag: str, timeout_s: int = 60
) -> Optional[bytes]:
    """Télécharge la vidéo TikTok via yt-dlp + proxy Decodo + cookies TikTok.

    Stratégie 2026-05-11 : tikwm.com retourne "Url parsing failed" depuis l'IP
    Hetzner — on bascule sur yt-dlp direct via le proxy résidentiel Decodo
    (env YOUTUBE_PROXY unifié YouTube/TikTok côté bypass IP-ban) et les cookies
    de session TikTok (TIKTOK_COOKIES_PATH) pour passer le bot challenge.

    Retourne les bytes mp4 si succès, None sinon. Le caller décide du fallback.
    """
    loop = asyncio.get_event_loop()

    def _dl() -> Optional[bytes]:
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = f"{tmpdir}/video.mp4"
            cmd = [
                "yt-dlp",
                *_yt_dlp_extra_args(include_proxy=True, use_tiktok_cookies=True),
                "-f",
                "best[ext=mp4]/best",
                "-o",
                out_path,
                "--no-warnings",
                "--no-playlist",
                "--retries",
                "2",
                url,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s)
            if result.returncode != 0:
                logger.warning(
                    "[%s] yt-dlp TikTok download failed: %s",
                    log_tag,
                    (result.stderr or "")[:200],
                )
                return None
            for f in Path(tmpdir).iterdir():
                if f.suffix.lower() in {".mp4", ".webm", ".mkv"}:
                    data = f.read_bytes()
                    if data and len(data) > 1000:
                        return data
            return None

    try:
        return await asyncio.wait_for(
            loop.run_in_executor(audio_executor, _dl),
            timeout=timeout_s + 5,
        )
    except asyncio.TimeoutError:
        logger.warning("[%s] yt-dlp TikTok download timeout (%ds)", log_tag, timeout_s)
    except Exception as e:
        logger.warning("[%s] yt-dlp TikTok download raised: %s", log_tag, e)
    return None


async def _extract_tiktok_visual_frames(
    url: str, video_id: str, *, mode: str = "default", log_tag: str
) -> Optional[FrameExtractionResult]:
    """Pipeline TikTok : yt-dlp+Decodo (priorité) → tikwm fallback → /tmp .mp4 → extract_frames_from_local.

    Stratégie 2026-05-11 (sprint TikTok via proxy Decodo) :
    - L'API tikwm.com s'est cassée externellement ("Url parsing failed"). On
      bascule en priorité sur yt-dlp direct via le proxy résidentiel Decodo
      ($YOUTUBE_PROXY) + cookies TikTok ($TIKTOK_COOKIES_PATH) pour bypass
      l'IP-ban Hetzner et le bot challenge TikTok.
    - tikwm reste en fallback secondaire pour les cas où yt-dlp échoue
      (vidéo privée, proxy saturé, cookies expirés).

    `mode` est propagé à extract_frames_from_local pour la grille frames.
    """
    t0 = time.time()
    video_data: Optional[bytes] = None
    download_source = "none"

    # ── Tentative 1 : yt-dlp + Decodo proxy + cookies TikTok ──
    try:
        video_data = await _download_tiktok_video_via_ytdlp(url, log_tag=log_tag)
        if video_data:
            download_source = "yt-dlp"
    except Exception as e:
        logger.warning("[%s] yt-dlp path raised: %s", log_tag, e)

    # ── Tentative 2 : tikwm fallback ──
    if not video_data:
        try:
            video_data = await _download_tiktok_video_no_watermark(url, log_tag=log_tag)
            if video_data:
                download_source = "tikwm"
        except Exception as e:
            logger.warning("[%s] tikwm fallback raised: %s", log_tag, e)

    if not video_data:
        logger.warning(
            "[%s] TikTok download failed (yt-dlp + tikwm) for %s", log_tag, video_id
        )
        return None

    logger.info(
        "[%s] TikTok download OK via %s in %.1fs (%.0f KB)",
        log_tag,
        download_source,
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
        result = await extract_frames_from_local(
            str(tmp_path), mode=mode, log_tag=f"{log_tag} TIKTOK"
        )
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
