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

# Decodo Scraping fallback — Feature 1.3 Phase 1 (2026-05-21). Lazy import the
# client inside the helper so unrelated callers don't pull httpx/pydantic in.

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

YTDLP_INFO_TIMEOUT_S = 60
SHEET_DOWNLOAD_TIMEOUT_S = 30
HTTPX_RETRIES_PER_SHEET = 2

executor = ThreadPoolExecutor(max_workers=2)

YOUTUBE_VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{11}$")

# Match [HH:MM:SS] or [MM:SS] anchors inside Supadata transcripts.
_TIMESTAMP_ANCHOR_RE = re.compile(r"\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]")


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def _estimate_duration_from_transcript(transcript: str) -> Optional[float]:
    """Parse `[HH:MM:SS]` / `[MM:SS]` timestamps from a transcript and return
    the largest one as duration estimate (in seconds).

    Used as a last-resort fallback for storyboard `duration_s` when yt-dlp,
    sb fragments, and Supadata `get_video_info` all fail to return one. The
    Supadata transcript pipeline (`transcripts.youtube`) always emits these
    timestamps, so this works whenever the upstream transcript step succeeded
    (which it always has by the time the visual hook is called).

    Underestimates slightly when the video has silent tail content after the
    last spoken word, but for the purpose of computing a frame-extraction
    budget the rounding is negligible.
    """
    if not transcript:
        return None
    max_seconds = 0.0
    for m in _TIMESTAMP_ANCHOR_RE.finditer(transcript):
        if m.group(3):  # HH:MM:SS
            h, mm, ss = int(m.group(1)), int(m.group(2)), int(m.group(3))
            secs = h * 3600 + mm * 60 + ss
        else:  # MM:SS
            mm, ss = int(m.group(1)), int(m.group(2))
            secs = mm * 60 + ss
        if secs > max_seconds:
            max_seconds = float(secs)
    return max_seconds if max_seconds > 0 else None


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

    Sprint 2026-05-12 follow-up à PR #469 : passe `include_proxy=True` (défaut)
    pour que ce metadata fetch parte via le proxy résidentiel Decodo. Sans
    proxy, yt-dlp est bot-challenged depuis l'IP Hetzner et retourne None →
    `extract_storyboard_frames` exit early L298 AVANT que les 4 fallbacks
    duration + le 5e fallback duration_hint (PR #468) puissent fire. C'était
    la racine cachée de Summary 209 visual_analysis=null sur zjkBMFhNj_g
    (Karpathy 1h LLM intro) : metadata duration OK via #469 mais storyboards
    inaccessibles ici sans proxy.

    L'ancien commentaire mentionnait "le proxy Webshare datacenter renvoie 407" —
    obsolète depuis la migration sur Decodo résidentiel (gate.decodo.com:7000).

    `--ignore-no-formats-error` : yt-dlp 2024+ refuse de produire le JSON quand
    aucun format vidéo "downloadable" (mp4/webm) n'est exposé, même avec
    `--skip-download`. Or pour Phase 2 visual storyboard on n'a besoin que des
    formats `sb*` (mhtml). Sans ce flag, yt-dlp lève "Requested format is not
    available" et on ne récupère jamais les storyboards.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    cmd = [
        "yt-dlp",
        *_yt_dlp_extra_args(),  # include_proxy=True par défaut — Decodo résidentiel
        "-j",
        "--skip-download",
        "--ignore-no-formats-error",
        "--no-warnings",
        "--no-playlist",
        url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=YTDLP_INFO_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        logger.warning("[%s] yt-dlp -j timeout (%ds)", log_tag, YTDLP_INFO_TIMEOUT_S)
        return None

    # yt-dlp peut exit non-zero alors qu'il a produit un JSON valide sur stdout —
    # cas connu : `--cookies /app/cookies.txt` monté en read-only fait crasher
    # `YoutubeDL.save_cookies()` dans `__exit__`, traceback sur stderr, exit 1,
    # mais le JSON stdout est intact (étapes upstream ont réussi avant le cleanup).
    # On parse donc le JSON d'abord, et on ne considère l'erreur que si le JSON
    # est absent / corrompu.
    if result.stdout:
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            pass  # fall through to error log

    if result.returncode != 0:
        logger.warning(
            "[%s] yt-dlp -j failed (exit=%d): %s",
            log_tag,
            result.returncode,
            result.stderr[:300],
        )
    else:
        logger.warning("[%s] yt-dlp -j output not JSON (empty or malformed)", log_tag)
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


def _slice_sheet(sheet_bytes: bytes, cols: int, rows: int, log_tag: str) -> List[bytes]:
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
# 🛰️ DECODO SCRAPING FALLBACK — Feature 1.3 Phase 1 (2026-05-21)
# ═══════════════════════════════════════════════════════════════════════════════
#
# yt-dlp depuis Hetzner reçoit régulièrement un bot challenge YouTube. Avant
# Phase 1 le pipeline restait coincé sur `_ytdlp_info_sync` → None et tous les
# fallbacks downstream (duration_hint inclus, PR #470) ne tombaient pas car
# `extract_storyboard_frames` n'avait pas d'`info` à parser.
#
# Cette section ajoute un 6e fallback : si yt-dlp KO, scraper la watch page via
# Decodo Premium+JS (Cloudflare/anti-bot bypass), extraire
# `ytInitialPlayerResponse` JSON, et reconstruire un dict info compatible
# yt-dlp (duration + title + storyboards reconstruits depuis
# `playerStoryboardSpecRenderer.spec`).
#
# Le test cURL pré-flight a été validé au smoke J0 (2026-05-21) — HTTP 200,
# 2.2 MB rendered HTML, ytInitialPlayerResponse présent, lengthSeconds OK.
# Fixture capturée dans `backend/tests/fixtures/youtube/watch_decodo_player_response.json`.

# Regex YouTube-compatible. `ytInitialPlayerResponse` est assigné via
# `var ytInitialPlayerResponse = {...};` dans le bundle inline. yt-dlp upstream
# utilise une regex non-greedy équivalente (cf. `extractor/youtube.py`).
_YT_PLAYER_RESPONSE_REGEX = re.compile(r"ytInitialPlayerResponse\s*=\s*({.+?});", re.DOTALL)

# Storyboard CDN base : YouTube serve les sheets via `i.ytimg.com/sb/<vid>/storyboard3_L$L/$N.jpg`
# où `$L` = level (résolution storyboard) et `$N` = index du sheet.
_YT_STORYBOARD_BASE = "https://i.ytimg.com"

# Hard cap on Decodo scrape duration. 45s gives the wrapper room for one retry
# at 15s + one at 30s without blowing the user-facing analyse timeout.
_DECODO_YT_TIMEOUT_S = 45.0


def _parse_youtube_storyboards(player_response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert ``playerStoryboardSpecRenderer.spec`` → yt-dlp-compatible formats list.

    MVP duration-only acceptable: yt-dlp dedicates ~300 LOC to the full
    storyboard spec parser. We implement the canonical "level | duration_ms |
    rows | cols | count" pipe-delimited base format with a best-effort URL
    template. This is sufficient to feed `select_storyboard_format` and the
    downstream sheet download loop. If parsing yields nothing usable, the
    function returns ``[]`` and ``extract_storyboard_frames`` will exit at the
    "No storyboard format available" guard — but `duration` and `title` will
    still have been recovered, so the 5e fallback (duration_hint PR #470) can
    still be exercised by upstream callers in v6/v2.1.

    Spec format observed on dQw4w9WgXcQ::

        https://i.ytimg.com/sb/dQw4w9WgXcQ/storyboard3_L$L/$N.jpg?sqp=...|
        48#27#100#10#10#0#default#rs$AOn4CL...|
        80#45#108#10#10#2000#M$M#rs$AOn4CL...|
        160#90#108#5#5#2000#M$M#rs$AOn4CL...|
        320#180#56#5#5#2000#M$M#rs$AOn4CL...

    First token is the URL template (with ``$L`` and ``$N`` placeholders),
    each subsequent token describes one level. Returns a list with one
    yt-dlp-style format dict per level (format_id="sb0"|"sb1"|...).
    """
    if not isinstance(player_response, dict):
        return []
    storyboards = player_response.get("storyboards") or {}
    if not isinstance(storyboards, dict):
        return []
    renderer = storyboards.get("playerStoryboardSpecRenderer") or {}
    spec_str = renderer.get("spec")
    if not isinstance(spec_str, str) or "|" not in spec_str:
        return []

    parts = spec_str.split("|")
    url_template = parts[0]
    if "$L" not in url_template or "$N" not in url_template:
        return []

    formats: List[Dict[str, Any]] = []
    for level_idx, level_str in enumerate(parts[1:]):
        fields = level_str.split("#")
        if len(fields) < 5:
            continue
        try:
            width = int(fields[0])
            height = int(fields[1])
            total_count = int(fields[2])  # total frames across all sheets
            cols = int(fields[3])
            rows = int(fields[4])
        except ValueError:
            continue
        if width <= 0 or height <= 0 or total_count <= 0 or cols <= 0 or rows <= 0:
            continue

        per_sheet = max(1, cols * rows)
        sheet_count = max(1, -(-total_count // per_sheet))  # ceil div

        # Sheet URL: substitute $L with level index, $N with sheet number.
        # YouTube serves these from i.ytimg.com (CDN sffe) which doesn't
        # bot-guard from Hetzner (validated 2026-05-05).
        url_tpl = url_template.replace("$L", str(level_idx))
        fragments = [
            {
                "url": url_tpl.replace("$N", str(n)),
                # We don't know per-fragment duration here; the downstream
                # code accepts duration=0 and uses cumulative_t = 0 then
                # walks frames evenly. The duration_s passed separately to
                # extract_storyboard_frames is what truly drives clipping.
                "duration": 0.0,
            }
            for n in range(sheet_count)
        ]
        formats.append(
            {
                "format_id": f"sb{level_idx}",
                "ext": "mhtml",
                "width": width,
                "height": height,
                "columns": cols,
                "rows": rows,
                "fragments": fragments,
            }
        )

    return formats


async def _decodo_scrape_youtube_info(video_id: str, log_tag: str) -> Optional[Dict[str, Any]]:
    """6e fallback : scrape YouTube watch page via Decodo Premium+JS.

    Active uniquement après échec de ``_ytdlp_info_sync`` (bot challenge
    Hetzner). Parse ``ytInitialPlayerResponse`` qui contient ``videoDetails``
    (duration, title) et ``storyboards.playerStoryboardSpecRenderer.spec``.

    Reconstruit un dict compatible avec le format yt-dlp downstream :
      - id, title, duration (s)
      - formats: list of storyboard dicts (sb0, sb1, ...)
      - _source: "decodo_scrape" pour traçabilité

    Returns None si Decodo retourne KO, HTML trop court, regex no-match ou
    JSON parse fail. Tous les cas font un warning log et fall-through ; la
    fonction NE LÈVE JAMAIS — caller fait son propre `if not info`.

    Spec § 6.3, Phase 1.3 Decodo Web Scraping rollout.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        # Lazy import: keep decodo client out of the hot path when unused.
        from decodo import DecodoScrapingClient

        client = DecodoScrapingClient()
        result = await client.scrape(
            url,
            proxy_pool="premium",
            headless=True,
            output_format="raw_html",
            timeout_s=_DECODO_YT_TIMEOUT_S,
        )
    except Exception as e:
        # DecodoDisabledError / DecodoBudgetExceededError / DecodoConfigError /
        # DecodoRequestError / DecodoTimeoutError / DecodoResponseError all
        # inherit from DecodoScrapingError. Anything else is unexpected but
        # must not break the analyse pipeline.
        logger.warning(
            "[%s] decodo_youtube_watch: client.scrape raised %s: %s",
            log_tag,
            type(e).__name__,
            str(e)[:200],
        )
        return None

    html = result.content or ""
    if len(html) < 50_000:
        logger.warning(
            "[%s] decodo_youtube_watch: html too short (%d bytes)",
            log_tag,
            len(html),
        )
        return None

    m = _YT_PLAYER_RESPONSE_REGEX.search(html)
    if not m:
        logger.warning(
            "[%s] decodo_youtube_watch: ytInitialPlayerResponse not found in %d byte HTML",
            log_tag,
            len(html),
        )
        return None

    try:
        player = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        logger.warning(
            "[%s] decodo_youtube_watch: JSON parse error at offset %d: %s",
            log_tag,
            getattr(e, "pos", -1),
            str(e)[:200],
        )
        return None

    video_details = player.get("videoDetails") or {}
    try:
        duration = int(video_details.get("lengthSeconds", 0) or 0)
    except (TypeError, ValueError):
        duration = 0
    title = video_details.get("title") or ""

    formats = _parse_youtube_storyboards(player)
    logger.info(
        "[%s] decodo_youtube_watch: recovered info (duration=%ds, storyboards=%d)",
        log_tag,
        duration,
        len(formats),
    )
    return {
        "id": video_id,
        "title": title,
        "duration": duration,
        "formats": formats,
        "_source": "decodo_scrape",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 API PUBLIQUE
# ═══════════════════════════════════════════════════════════════════════════════


async def extract_storyboard_frames(
    video_id_or_url: str,
    *,
    max_frames_override: Optional[int] = None,
    mode: str = DEFAULT_MODE,
    transcript_hint: Optional[str] = None,
    duration_hint: Optional[float] = None,
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

    `duration_hint` (Option C) : 5ème fallback de durée fourni par le caller
    depuis `video_info["duration"]` (Supadata metadata HTTP, fiable). N'est
    consulté qu'après les 4 fallbacks classiques (yt-dlp top-level, fragments
    sb*, Supadata get_video_info, transcript timestamps regex). Évite le skip
    silencieux observé prod 2026-05-11 sur les vidéos où les 4 fallbacks
    classiques échouent en cascade.
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

        # ── Fallback 1: dériver la durée depuis les fragments storyboard ──
        # Certaines vidéos (anciennes ou avec formats lockés) retournent top-level
        # duration=None mais ont des fragments sb* avec des durations partielles.
        if duration_s <= 0:
            for fmt in info.get("formats", []) or []:
                if not str(fmt.get("format_id", "")).startswith("sb"):
                    continue
                total = sum(float(frag.get("duration") or 0) for frag in (fmt.get("fragments") or []))
                if total > 0:
                    duration_s = total
                    logger.info("[%s] Duration from sb fragments fallback: %.1fs", log_tag, duration_s)
                    break

        # ── Fallback 2: Supadata via get_video_info (déjà en prod, fiable) ──
        # Couvre le cas où yt-dlp `--ignore-no-formats-error` ne renvoie ni
        # duration ni storyboards utilisables (vidéos très anciennes,
        # restrictions régionales avec cookies insuffisants).
        if duration_s <= 0:
            try:
                from transcripts import get_video_info as _get_video_info

                vinfo = await _get_video_info(video_id)
                if vinfo:
                    d = float(vinfo.get("duration") or 0)
                    if d > 0:
                        duration_s = d
                        logger.info(
                            "[%s] Duration from Supadata fallback: %.1fs",
                            log_tag,
                            duration_s,
                        )
            except Exception as e:
                logger.warning("[%s] Supadata duration fallback raised: %s", log_tag, e)

        # ── Fallback 3: estimer depuis les timestamps du transcript ──
        # Le pipeline d'analyse extrait toujours le transcript AVANT le hook
        # visual ; les timestamps Supadata `[mm:ss]` sont fiables et permettent
        # de récupérer la durée même quand toutes les sources métadonnées
        # échouent (cas vu en prod 2026-05-11 sur certaines vidéos).
        if duration_s <= 0 and transcript_hint:
            est = _estimate_duration_from_transcript(transcript_hint)
            if est and est > 0:
                duration_s = est
                logger.info(
                    "[%s] Duration estimated from transcript timestamps: %.1fs",
                    log_tag,
                    duration_s,
                )

        # ── Fallback 4 (Option C): duration_hint propagé par le caller ──
        # Provient de `video_info["duration"]` côté router (Supadata metadata
        # HTTP, fiable). Active quand le transcript Supadata est en plain text
        # (bug endpoint unifié, cf. transcripts/youtube.py:913 / :940) — la
        # regex `[mm:ss]` ne matche rien et les 3 fallbacks précédents ont
        # tous échoué. C'est le filet de sécurité prod, JAMAIS prioritaire.
        if duration_s <= 0 and duration_hint and duration_hint > 0:
            duration_s = float(duration_hint)
            logger.info(
                "[%s] Duration from upstream duration_hint fallback: %.1fs",
                log_tag,
                duration_s,
            )

        if duration_s <= 0:
            logger.warning(
                "[%s] No duration found (yt-dlp + fragments + Supadata + transcript + hint all failed)",
                log_tag,
            )
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

                sliced = await loop.run_in_executor(executor, _slice_sheet, sheet_bytes, cols, rows, log_tag)
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
