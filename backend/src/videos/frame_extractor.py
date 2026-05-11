"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎞️ FRAME EXTRACTOR — Téléchargement vidéo + extraction frames JPEG               ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pipeline :                                                                        ║
║  1. yt-dlp download (réutilise YOUTUBE_PROXY + cookies via _yt_dlp_extra_args)    ║
║  2. ffprobe pour mesurer la durée                                                  ║
║  3. ffmpeg extraction frames avec auto-scaling par durée (cap 2 fps, 100 frames)  ║
║  4. Cleanup explicite (caller's responsibility) ou TTL via cleanup_stale_frames() ║
║                                                                                    ║
║  Inspiré de bradautomates/claude-video (algorithme de frame budget).              ║
║  Spec: docs/superpowers/specs/2026-05-05-visual-analysis-poc.md (à créer)         ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import json
import logging
import os
import shutil
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from transcripts.audio_utils import _yt_dlp_extra_args

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Hard caps (alignés sur claude-video pour limiter le coût en tokens vision)
MAX_FRAMES = 100
MAX_FPS = 2.0
DEFAULT_FRAME_WIDTH = 512  # px ; 1024 si OCR nécessaire (option future)

# Grille de frames par mode × durée vidéo (mode normal, hors focused)
# - "default" = Pro : analyse plus légère, plafond ~24 frames analysées
# - "expert"  = Expert : analyse approfondie, pousse au cap dur Mistral (8 batches × 8)
# - "ultra"   = Expert + opt-in (settings.VISUAL_ULTRA_ENABLED) sur vidéos très
#              longues (>2h) : densité supérieure pour exploiter le proxy Decodo
#              qui bypass le bot challenge. Cap 96 frames (12 batches × 8).
# Multiples de 8 pour saturer les batches Mistral (8 images/req max).
FRAME_BUDGET_GRID: Dict[str, List[Tuple[float, int]]] = {
    "default": [
        (30.0, 8),
        (60.0, 12),
        (180.0, 16),
        (600.0, 20),
        (float("inf"), 24),
    ],
    "expert": [
        (30.0, 16),
        (60.0, 24),
        (180.0, 40),
        (600.0, 56),
        (float("inf"), 64),
    ],
    "ultra": [
        (1800.0, 16),    # ≤30min
        (3600.0, 24),    # ≤1h
        (7200.0, 32),    # ≤2h
        (10800.0, 48),   # ≤3h
        (14400.0, 64),   # ≤4h
        (21600.0, 80),   # ≤6h
        (float("inf"), 96),  # >6h
    ],
}
DEFAULT_MODE = "default"

# Timeouts
DOWNLOAD_TIMEOUT_S = 300  # 5 min max pour télécharger
FFMPEG_TIMEOUT_S = 120  # 2 min max pour extraire les frames
FFPROBE_TIMEOUT_S = 30

# Storage : configurable via env, fallback /tmp
FRAMES_BASE_DIR = os.getenv("VISUAL_FRAMES_DIR", "/tmp/deepsight-frames")
FRAMES_TTL_SECONDS = 3600  # 1h ; cleanup_stale_frames() purge au-delà

# Limite taille téléchargement (la vidéo elle-même n'est jamais conservée
# au-delà de l'extraction frames + audio fallback)
MAX_VIDEO_FILESIZE = "200M"  # yt-dlp --max-filesize

# Format yt-dlp : on prend la résolution minimale acceptable pour les frames
# (les frames seront downscale par ffmpeg de toute façon, donc inutile de
# télécharger en 1080p si on output en 512px).
YTDLP_FORMAT = "best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best"

executor = ThreadPoolExecutor(max_workers=2)


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 RESULT TYPE
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class FrameExtractionResult:
    """Résultat d'une extraction de frames."""

    workdir: str  # Dossier contenant les frames JPEG (cleanup à la charge du caller)
    frame_paths: List[str]  # Chemins absolus des frames, ordre chronologique
    frame_timestamps: List[float]  # Timestamps absolus en secondes (1:1 avec frame_paths)
    duration_s: float  # Durée totale de la vidéo
    fps_used: float  # FPS effectif appliqué (≤ MAX_FPS)
    frame_count: int  # len(frame_paths)
    width: int  # Largeur des frames en px
    long_video_warning: bool  # True si >10min ; le caller peut suggérer focused mode

    def cleanup(self) -> None:
        """Supprime le workdir et toutes les frames. À appeler en fin de vie."""
        try:
            shutil.rmtree(self.workdir, ignore_errors=True)
        except Exception as e:
            logger.warning("[FRAME_EXTRACT] Cleanup failed for %s: %s", self.workdir, e)


# ═══════════════════════════════════════════════════════════════════════════════
# 📐 ALGORITHME DE BUDGET FRAMES (inspiré claude-video)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_frame_budget(
    duration_s: float,
    focused_start: Optional[float] = None,
    focused_end: Optional[float] = None,
    *,
    mode: str = DEFAULT_MODE,
) -> Tuple[float, int, bool]:
    """
    Calcule (fps, max_frames, long_video_warning) selon la durée et le mode.

    Mode normal (full video) — grille adaptative par durée, par mode :
    - "default" (Pro)   : 8 → 24 frames selon durée
    - "expert"  (Expert): 16 → 64 frames selon durée

    Mode focused (start/end fournis) : densité plus élevée, indépendant du mode.

    Le caller est libre de bypass via override (--max-frames N).
    """
    long_warning = False

    # ── Mode focused : zoom dense sur une section ──
    if focused_start is not None or focused_end is not None:
        start = focused_start or 0.0
        end = focused_end if focused_end is not None else duration_s
        focus_duration = max(0.1, end - start)

        if focus_duration <= 5:
            target_frames = min(10, int(focus_duration * 2))
            fps = MAX_FPS
        elif focus_duration <= 15:
            target_frames = min(30, int(focus_duration * 2))
            fps = MAX_FPS
        elif focus_duration <= 30:
            target_frames = min(60, int(focus_duration * 2))
            fps = MAX_FPS
        elif focus_duration <= 60:
            target_frames = 80
            fps = min(MAX_FPS, target_frames / focus_duration)
        else:  # focused mais long → 100 frames cap
            target_frames = MAX_FRAMES
            fps = min(MAX_FPS, target_frames / focus_duration)

        return fps, min(target_frames, MAX_FRAMES), False

    # ── Mode normal : grille par mode ──
    grid = FRAME_BUDGET_GRID.get(mode) or FRAME_BUDGET_GRID[DEFAULT_MODE]
    target_frames = grid[-1][1]
    for max_dur, frames in grid:
        if duration_s <= max_dur:
            target_frames = frames
            break

    if duration_s > 600:
        long_warning = True

    target_frames = min(target_frames, MAX_FRAMES)
    fps = min(MAX_FPS, target_frames / max(1.0, duration_s))

    return fps, target_frames, long_warning


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 FFPROBE — durée vidéo
# ═══════════════════════════════════════════════════════════════════════════════


def _ffprobe_duration(video_path: str) -> Optional[float]:
    """Renvoie la durée de la vidéo en secondes via ffprobe. None si erreur."""
    try:
        cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            video_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFPROBE_TIMEOUT_S)
        if result.returncode != 0:
            logger.warning("[FRAME_EXTRACT] ffprobe failed: %s", result.stderr[:200])
            return None
        data = json.loads(result.stdout or "{}")
        duration_str = data.get("format", {}).get("duration")
        if not duration_str:
            return None
        return float(duration_str)
    except Exception as e:
        logger.warning("[FRAME_EXTRACT] ffprobe exception: %s", e)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 YT-DLP DOWNLOAD VIDÉO COMPLÈTE (mode video, pas audio-only)
# ═══════════════════════════════════════════════════════════════════════════════


def _download_video_sync(url: str, dest_dir: str, log_tag: str) -> Optional[str]:
    """Télécharge la vidéo via yt-dlp. Renvoie le chemin du fichier ou None."""
    output_template = str(Path(dest_dir) / "video.%(ext)s")
    cmd = [
        "yt-dlp",
        *_yt_dlp_extra_args(),
        "-f",
        YTDLP_FORMAT,
        "--max-filesize",
        MAX_VIDEO_FILESIZE,
        "--no-playlist",
        "--no-warnings",
        "--retries",
        "3",
        "-o",
        output_template,
        url,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=DOWNLOAD_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        logger.warning("[%s] yt-dlp download timeout (%ds)", log_tag, DOWNLOAD_TIMEOUT_S)
        return None

    if result.returncode != 0:
        logger.warning("[%s] yt-dlp failed: %s", log_tag, result.stderr[:300])
        return None

    # Trouver le fichier produit (extension variable selon le format)
    for child in Path(dest_dir).iterdir():
        if child.is_file() and child.stem == "video":
            return str(child)

    logger.warning("[%s] yt-dlp returned 0 but no video file found in %s", log_tag, dest_dir)
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎞️ FFMPEG — extraction frames JPEG
# ═══════════════════════════════════════════════════════════════════════════════


def _extract_frames_sync(
    video_path: str,
    frames_dir: str,
    fps: float,
    width: int,
    start_s: Optional[float],
    end_s: Optional[float],
    log_tag: str,
) -> Tuple[List[str], List[float]]:
    """Extrait les frames JPEG. Renvoie (paths, timestamps_absolute_s)."""
    Path(frames_dir).mkdir(parents=True, exist_ok=True)

    # On veut des timestamps absolus dans le nom de fichier → on utilise le
    # filtre showinfo de ffmpeg pas pratique, donc on calcule à partir de
    # start + index/fps. C'est exact car ffmpeg avec -vf fps=... produit des
    # frames espacées régulièrement.
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error"]

    if start_s is not None:
        cmd.extend(["-ss", f"{start_s:.3f}"])
    if end_s is not None and start_s is not None:
        cmd.extend(["-t", f"{max(0.0, end_s - start_s):.3f}"])
    elif end_s is not None:
        cmd.extend(["-t", f"{end_s:.3f}"])

    cmd.extend(
        [
            "-i",
            video_path,
            "-vf",
            f"fps={fps:.4f},scale={width}:-2",
            "-q:v",
            "4",  # Qualité JPEG raisonnable (1=best, 31=worst)
            "-vsync",
            "0",
            str(Path(frames_dir) / "frame_%04d.jpg"),
        ]
    )

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        logger.warning("[%s] ffmpeg timeout (%ds)", log_tag, FFMPEG_TIMEOUT_S)
        return [], []

    if result.returncode != 0:
        logger.warning("[%s] ffmpeg failed: %s", log_tag, result.stderr[:300])
        return [], []

    # Récupération + tri lexicographique = ordre chronologique grâce au padding
    paths = sorted(str(p) for p in Path(frames_dir).glob("frame_*.jpg"))

    # Timestamps absolus : start + index / fps
    base_offset = start_s or 0.0
    timestamps = [base_offset + (i / fps if fps > 0 else 0.0) for i in range(len(paths))]

    return paths, timestamps


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 API PUBLIQUE
# ═══════════════════════════════════════════════════════════════════════════════


async def extract_frames_from_url(
    url: str,
    *,
    focused_start: Optional[float] = None,
    focused_end: Optional[float] = None,
    max_frames_override: Optional[int] = None,
    width: int = DEFAULT_FRAME_WIDTH,
    mode: str = DEFAULT_MODE,
    log_tag: str = "FRAME_EXTRACT",
) -> Optional[FrameExtractionResult]:
    """
    Pipeline complet pour une URL distante (YouTube, TikTok, Vimeo, etc.).

    1. Crée un workdir unique sous FRAMES_BASE_DIR
    2. Télécharge la vidéo via yt-dlp (proxy + cookies hérités)
    3. ffprobe → durée
    4. compute_frame_budget(duration, mode=mode) → (fps, max_frames)
    5. ffmpeg → extraction JPEG
    6. Renvoie FrameExtractionResult ; le caller appelle .cleanup() en fin de vie

    En cas d'échec à n'importe quelle étape, renvoie None (workdir nettoyé).
    """
    Path(FRAMES_BASE_DIR).mkdir(parents=True, exist_ok=True)
    workdir = str(Path(FRAMES_BASE_DIR) / f"job_{uuid.uuid4().hex[:12]}")
    Path(workdir).mkdir(parents=True, exist_ok=True)

    loop = asyncio.get_event_loop()

    try:
        # ── 1. Download vidéo ──
        t0 = time.time()
        video_path = await loop.run_in_executor(executor, _download_video_sync, url, workdir, log_tag)
        if not video_path:
            shutil.rmtree(workdir, ignore_errors=True)
            return None
        logger.info("[%s] Download OK in %.1fs: %s", log_tag, time.time() - t0, video_path)

        # ── 2. Durée ──
        duration_s = await loop.run_in_executor(executor, _ffprobe_duration, video_path)
        if not duration_s or duration_s <= 0:
            logger.warning("[%s] Could not determine duration, aborting", log_tag)
            shutil.rmtree(workdir, ignore_errors=True)
            return None

        # ── 3. Budget frames ──
        fps, target_frames, long_warning = compute_frame_budget(
            duration_s,
            focused_start=focused_start,
            focused_end=focused_end,
            mode=mode,
        )
        if max_frames_override is not None:
            target_frames = min(max_frames_override, MAX_FRAMES)
            # Si l'override est plus restrictif, recompute fps en conséquence
            effective_duration = duration_s
            if focused_start is not None or focused_end is not None:
                start = focused_start or 0.0
                end = focused_end if focused_end is not None else duration_s
                effective_duration = max(0.1, end - start)
            fps = min(MAX_FPS, target_frames / effective_duration)

        logger.info(
            "[%s] duration=%.1fs fps=%.3f target_frames=%d long=%s focused=%s mode=%s",
            log_tag,
            duration_s,
            fps,
            target_frames,
            long_warning,
            focused_start is not None or focused_end is not None,
            mode,
        )

        # ── 4. Extraction frames ──
        frames_dir = str(Path(workdir) / "frames")
        t0 = time.time()
        paths, timestamps = await loop.run_in_executor(
            executor,
            _extract_frames_sync,
            video_path,
            frames_dir,
            fps,
            width,
            focused_start,
            focused_end,
            log_tag,
        )
        if not paths:
            shutil.rmtree(workdir, ignore_errors=True)
            return None

        # Si ffmpeg a généré plus que target_frames (peut arriver avec
        # arrondis), on tronque proprement.
        if len(paths) > target_frames:
            for extra in paths[target_frames:]:
                Path(extra).unlink(missing_ok=True)
            paths = paths[:target_frames]
            timestamps = timestamps[:target_frames]

        logger.info("[%s] Frames extracted: %d in %.1fs", log_tag, len(paths), time.time() - t0)

        # On peut supprimer le fichier vidéo brut ; on garde juste les frames
        try:
            Path(video_path).unlink(missing_ok=True)
        except Exception:
            pass

        return FrameExtractionResult(
            workdir=workdir,
            frame_paths=paths,
            frame_timestamps=timestamps,
            duration_s=duration_s,
            fps_used=fps,
            frame_count=len(paths),
            width=width,
            long_video_warning=long_warning,
        )

    except Exception as e:
        logger.exception("[%s] Unexpected error: %s", log_tag, e)
        shutil.rmtree(workdir, ignore_errors=True)
        return None


async def extract_frames_from_local(
    video_path: str,
    *,
    focused_start: Optional[float] = None,
    focused_end: Optional[float] = None,
    max_frames_override: Optional[int] = None,
    width: int = DEFAULT_FRAME_WIDTH,
    mode: str = DEFAULT_MODE,
    log_tag: str = "FRAME_EXTRACT",
) -> Optional[FrameExtractionResult]:
    """Variante pour fichier local déjà téléchargé. Skip l'étape yt-dlp."""
    if not Path(video_path).exists():
        logger.warning("[%s] Local file not found: %s", log_tag, video_path)
        return None

    Path(FRAMES_BASE_DIR).mkdir(parents=True, exist_ok=True)
    workdir = str(Path(FRAMES_BASE_DIR) / f"job_{uuid.uuid4().hex[:12]}")
    Path(workdir).mkdir(parents=True, exist_ok=True)
    frames_dir = str(Path(workdir) / "frames")

    loop = asyncio.get_event_loop()

    try:
        duration_s = await loop.run_in_executor(executor, _ffprobe_duration, video_path)
        if not duration_s or duration_s <= 0:
            shutil.rmtree(workdir, ignore_errors=True)
            return None

        fps, target_frames, long_warning = compute_frame_budget(
            duration_s,
            focused_start=focused_start,
            focused_end=focused_end,
            mode=mode,
        )
        if max_frames_override is not None:
            target_frames = min(max_frames_override, MAX_FRAMES)
            effective_duration = duration_s
            if focused_start is not None or focused_end is not None:
                start = focused_start or 0.0
                end = focused_end if focused_end is not None else duration_s
                effective_duration = max(0.1, end - start)
            fps = min(MAX_FPS, target_frames / effective_duration)

        paths, timestamps = await loop.run_in_executor(
            executor,
            _extract_frames_sync,
            video_path,
            frames_dir,
            fps,
            width,
            focused_start,
            focused_end,
            log_tag,
        )
        if not paths:
            shutil.rmtree(workdir, ignore_errors=True)
            return None

        if len(paths) > target_frames:
            for extra in paths[target_frames:]:
                Path(extra).unlink(missing_ok=True)
            paths = paths[:target_frames]
            timestamps = timestamps[:target_frames]

        return FrameExtractionResult(
            workdir=workdir,
            frame_paths=paths,
            frame_timestamps=timestamps,
            duration_s=duration_s,
            fps_used=fps,
            frame_count=len(paths),
            width=width,
            long_video_warning=long_warning,
        )

    except Exception as e:
        logger.exception("[%s] Local extraction failed: %s", log_tag, e)
        shutil.rmtree(workdir, ignore_errors=True)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🧹 CLEANUP TTL — purge des workdirs orphelins
# ═══════════════════════════════════════════════════════════════════════════════


def cleanup_stale_frames(ttl_seconds: int = FRAMES_TTL_SECONDS) -> int:
    """
    Supprime les workdirs sous FRAMES_BASE_DIR plus vieux que ttl_seconds.
    À brancher dans l'APScheduler du backend (cron horaire).

    Renvoie le nombre de workdirs purgés.
    """
    base = Path(FRAMES_BASE_DIR)
    if not base.exists():
        return 0

    cutoff = time.time() - ttl_seconds
    purged = 0

    for child in base.iterdir():
        if not child.is_dir() or not child.name.startswith("job_"):
            continue
        try:
            mtime = child.stat().st_mtime
            if mtime < cutoff:
                shutil.rmtree(child, ignore_errors=True)
                purged += 1
        except Exception as e:
            logger.warning("[FRAME_CLEANUP] Failed to inspect %s: %s", child, e)

    if purged:
        logger.info("[FRAME_CLEANUP] Purged %d stale workdirs", purged)
    return purged
