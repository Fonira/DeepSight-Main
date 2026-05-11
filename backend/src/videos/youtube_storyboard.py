"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎬 YOUTUBE STORYBOARD — Frame extraction sans download (Pivot 5)                 ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pipeline :                                                                        ║
║  1. yt-dlp -j --skip-download <url> → JSON (juste les métadonnées + storyboards)  ║
║  2. Sélection du format `sb*` de plus haute résolution                            ║
║  3. Download chaque sheet via httpx sur i.ytimg.com (CDN sffe, pas de bot guard)  ║
║  4. Slice chaque sheet en mini-frames via Pillow (cols×rows)                      ║
║  5. Renvoie un FrameExtractionResult drop-in pour visual_analyzer                 ║
║                                                                                    ║
║  Validé 2026-05-05 : i.ytimg.com répond HTTP/2 200/404 normalement depuis         ║
║  Hetzner (server: sffe), pas de bot challenge sur ce CDN.                         ║
║                                                                                    ║
║  Limitations :                                                                     ║
║  - Qualité : 320×180 ou 160×90 (storyboard YouTube standard, pas full HD)         ║
║  - Suffisant pour visual_hook/structure/key_moments. Limité pour OCR fin.         ║
║  - Si yt-dlp -j est aussi bloqué → fallback HTML parsing (TODO Phase 2)           ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import io
import json
import logging
import re
import shutil
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from PIL import Image

from transcripts.audio_utils import _yt_dlp_extra_args

from .frame_extractor import (
    DEFAULT_MODE,
    FRAMES_BASE_DIR,
    MAX_FRAMES,
    FrameExtractionResult,
    compute_frame_budget,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

YTDLP_INFO_TIMEOUT_S = 60
SHEET_DOWNLOAD_TIMEOUT_S = 30
HTTPX_RETRIES_PER_SHEET = 2

executor = ThreadPoolExecutor(max_workers=2)

YOUTUBE_VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{11}$")


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def normalize_video_id(value: str) -> Optional[str]:
    """Accepte un video_id brut (11 chars) ou une URL et renvoie le video_id."""
    if not value:
        return None
    value = value.strip()
    if YOUTUBE_VIDEO_ID_PATTERN.match(value):
        return value
    # Pattern simple URL → extraction
    m = re.search(r"(?:v=|youtu\.be/|/embed/|/shorts/)([a-zA-Z0-9_-]{11})", value)
    if m:
        return m.group(1)
    return None


def _ytdlp_info_sync(video_id: str, log_tag: str) -> Optional[Dict[str, Any]]:
    """Lance yt-dlp -j --skip-download (sync, à appeler dans un executor).

    `include_proxy=False` : le metadata fetch YouTube (storyboards inclus)
    fonctionne en direct depuis le backend Hetzner — le proxy Webshare
    datacenter renvoie 407 et casse cet appel inutilement.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    cmd = [
        "yt-dlp",
        *_yt_dlp_extra_args(include_proxy=False),
        "-j",
        "--skip-download",
        "--no-warnings",
        "--no-playlist",
        url,
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=YTDLP_INFO_TIMEOUT_S
        )
    except subprocess.TimeoutExpired:
        logger.warning("[%s] yt-dlp -j timeout (%ds)", log_tag, YTDLP_INFO_TIMEOUT_S)
        return None

    if result.returncode != 0:
        logger.warning("[%s] yt-dlp -j failed: %s", log_tag, result.stderr[:300])
        return None

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        logger.warning("[%s] yt-dlp output not JSON: %s", log_tag, e)
        return None


def select_storyboard_format(info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Sélectionne le format storyboard `sb*` de meilleure résolution.

    yt-dlp 2024+ inclut les storyboards comme entrées dans `info["formats"]`
    avec format_id="sb0"|"sb1"|"sb2" (du plus simple au plus dense), ext="mhtml",
    et un champ `fragments[]` listant les sheets.
    """
    formats = info.get("formats") or []
    sb_formats = [f for f in formats if str(f.get("format_id", "")).startswith("sb")]
    if not sb_formats:
        return None

    # Tri par résolution décroissante (width × height puis format_id pour stable)
    sb_formats.sort(
        key=lambda f: (
            (f.get("width") or 0) * (f.get("height") or 0),
            str(f.get("format_id", "")),
        ),
        reverse=True,
    )
    return sb_formats[0]


def _slice_sheet(
    sheet_bytes: bytes, cols: int, rows: int, log_tag: str
) -> List[bytes]:
    """Découpe un sheet en cols×rows mini-frames JPEG. Renvoie une liste de bytes."""
    try:
        img = Image.open(io.BytesIO(sheet_bytes))
        img.load()
    except Exception as e:
        logger.warning("[%s] PIL open failed: %s", log_tag, e)
        return []

    sheet_w, sheet_h = img.size
    if cols <= 0 or rows <= 0:
        return []

    frame_w = sheet_w // cols
    frame_h = sheet_h // rows
    if frame_w == 0 or frame_h == 0:
        logger.warning("[%s] Invalid grid: %dx%d on %dx%d sheet", log_tag, cols, rows, sheet_w, sheet_h)
        return []

    frames: List[bytes] = []
    for row_i in range(rows):
        for col_i in range(cols):
            x = col_i * frame_w
            y = row_i * frame_h
            crop = img.crop((x, y, x + frame_w, y + frame_h))
            # Convert to RGB if needed (storyboards sont JPEG donc déjà RGB normalement)
            if crop.mode != "RGB":
                crop = crop.convert("RGB")
            buf = io.BytesIO()
            crop.save(buf, format="JPEG", quality=85, optimize=True)
            frames.append(buf.getvalue())
    return frames


async def _download_sheet(client: httpx.AsyncClient, url: str, log_tag: str) -> Optional[bytes]:
    """Télécharge un sheet storyboard avec retries."""
    for attempt in range(HTTPX_RETRIES_PER_SHEET + 1):
        try:
            r = await client.get(url, timeout=SHEET_DOWNLOAD_TIMEOUT_S, follow_redirects=True)
            if r.status_code == 200:
                return r.content
            logger.warning(
                "[%s] sheet download HTTP %d (attempt %d): %s",
                log_tag,
                r.status_code,
                attempt + 1,
                url[:120],
            )
            if r.status_code in (403, 429):
                # Bot challenge / rate limit → ne pas insister
                return None
        except (httpx.TimeoutException, httpx.HTTPError) as e:
            logger.warning("[%s] sheet download error (attempt %d): %s", log_tag, attempt + 1, e)
        if attempt < HTTPX_RETRIES_PER_SHEET:
            await asyncio.sleep(0.5 * (attempt + 1))
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 API PUBLIQUE
# ═══════════════════════════════════════════════════════════════════════════════


async def extract_storyboard_frames(
    video_id_or_url: str,
    *,
    max_frames_override: Optional[int] = None,
    mode: str = DEFAULT_MODE,
    log_tag: str = "STORYBOARD",
) -> Optional[FrameExtractionResult]:
    """
    Pipeline complet :
    1. Normalise le video_id (URL → ID)
    2. yt-dlp -j --skip-download → info JSON
    3. Sélection format sb* de meilleure résolution
    4. Download tous les sheets (httpx + retries)
    5. Slice chaque sheet via Pillow
    6. Tronque selon le budget (mode × durée) ou max_frames_override
    7. Renvoie FrameExtractionResult drop-in pour visual_analyzer

    Renvoie None à toute étape qui échoue. Workdir est nettoyé automatiquement
    en cas d'échec.
    """
    video_id = normalize_video_id(video_id_or_url)
    if not video_id:
        logger.warning("[%s] Invalid video_id_or_url: %s", log_tag, video_id_or_url)
        return None

    Path(FRAMES_BASE_DIR).mkdir(parents=True, exist_ok=True)
    workdir = str(Path(FRAMES_BASE_DIR) / f"job_sb_{uuid.uuid4().hex[:12]}")
    Path(workdir).mkdir(parents=True, exist_ok=True)

    loop = asyncio.get_event_loop()

    try:
        # ── 1. yt-dlp -j ──
        t0 = time.time()
        info = await loop.run_in_executor(executor, _ytdlp_info_sync, video_id, log_tag)
        if not info:
            shutil.rmtree(workdir, ignore_errors=True)
            return None
        logger.info("[%s] yt-dlp info OK in %.1fs (video_id=%s)", log_tag, time.time() - t0, video_id)

        duration_s = float(info.get("duration") or 0)
        if duration_s <= 0:
            logger.warning("[%s] No duration in info JSON", log_tag)
            shutil.rmtree(workdir, ignore_errors=True)
            return None

        # ── 2. Sélection storyboard ──
        sb = select_storyboard_format(info)
        if not sb:
            logger.warning("[%s] No storyboard format available", log_tag)
            shutil.rmtree(workdir, ignore_errors=True)
            return None

        cols = int(sb.get("columns") or 1)
        rows = int(sb.get("rows") or 1)
        fragments = sb.get("fragments") or []
        if not fragments:
            logger.warning("[%s] Storyboard has no fragments", log_tag)
            shutil.rmtree(workdir, ignore_errors=True)
            return None

        sb_width = int(sb.get("width") or 0)
        sb_height = int(sb.get("height") or 0)
        single_frame_w = sb_width // cols if sb_width and cols else 0

        logger.info(
            "[%s] Selected sb %s: %dx%d grid=%dx%d, %d fragments, dur=%.1fs",
            log_tag,
            sb.get("format_id"),
            sb_width,
            sb_height,
            cols,
            rows,
            len(fragments),
            duration_s,
        )

        # ── 3+4. Download + slice + save ──
        frame_paths: List[str] = []
        frame_timestamps: List[float] = []
        cumulative_t = 0.0

        async with httpx.AsyncClient() as client:
            for frag_idx, frag in enumerate(fragments):
                url = frag.get("url")
                frag_duration = float(frag.get("duration") or 0)
                if not url:
                    continue

                sheet_bytes = await _download_sheet(client, url, log_tag)
                if not sheet_bytes:
                    continue

                sliced = await loop.run_in_executor(
                    executor, _slice_sheet, sheet_bytes, cols, rows, log_tag
                )
                if not sliced:
                    continue

                # Calcul des timestamps : intervalle = durée du fragment / N frames du sheet
                interval = frag_duration / len(sliced) if sliced else 0
                for sub_idx, frame_bytes in enumerate(sliced):
                    ts = cumulative_t + sub_idx * interval
                    if ts > duration_s + 1.0:  # tolérance arrondi
                        break
                    global_idx = len(frame_paths)
                    frame_path = str(Path(workdir) / f"frame_{global_idx:04d}.jpg")
                    Path(frame_path).write_bytes(frame_bytes)
                    frame_paths.append(frame_path)
                    frame_timestamps.append(ts)

                    if len(frame_paths) >= MAX_FRAMES:
                        break

                cumulative_t += frag_duration
                if len(frame_paths) >= MAX_FRAMES:
                    break

        if not frame_paths:
            logger.warning("[%s] Aucun frame n'a pu être extrait", log_tag)
            shutil.rmtree(workdir, ignore_errors=True)
            return None

        # ── 5. Budget frames (mode × durée) ou override explicite ──
        if max_frames_override is None:
            _, budget_frames, _ = compute_frame_budget(duration_s, mode=mode)
            effective_max = budget_frames
        else:
            effective_max = max_frames_override

        if effective_max and len(frame_paths) > effective_max:
            step = len(frame_paths) / effective_max
            keep_indices = sorted(set(int(i * step) for i in range(effective_max)))
            kept_paths = []
            kept_ts = []
            for i, p in enumerate(frame_paths):
                if i in keep_indices:
                    kept_paths.append(p)
                    kept_ts.append(frame_timestamps[i])
                else:
                    Path(p).unlink(missing_ok=True)
            frame_paths = kept_paths
            frame_timestamps = kept_ts

        logger.info(
            "[%s] mode=%s budget=%d kept=%d (raw=%d before tronc)",
            log_tag,
            mode,
            effective_max,
            len(frame_paths),
            len(frame_paths) if effective_max == 0 else max(effective_max, len(frame_paths)),
        )

        # ── 6. Wrap result ──
        fps_used = len(frame_paths) / duration_s if duration_s > 0 else 0.0
        return FrameExtractionResult(
            workdir=workdir,
            frame_paths=frame_paths,
            frame_timestamps=frame_timestamps,
            duration_s=duration_s,
            fps_used=fps_used,
            frame_count=len(frame_paths),
            width=single_frame_w,
            long_video_warning=duration_s > 600,
        )

    except Exception as e:
        logger.exception("[%s] Unexpected error: %s", log_tag, e)
        shutil.rmtree(workdir, ignore_errors=True)
        return None
