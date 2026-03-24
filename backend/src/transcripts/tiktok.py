"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎵 TIKTOK v3.0 — Supadata prioritaire + multi-fallback STT                       ║
║                                                                                    ║
║  Pipeline multi-phase:                                                             ║
║  Phase 0.5: Supadata API (PRIORITAIRE — texte natif ou STT côté serveur)          ║
║  Phase 1: yt-dlp standard → Groq Whisper                                          ║
║  Phase 2: yt-dlp avec headers alternatifs → Groq Whisper                          ║
║  Phase 3: yt-dlp avec retry exponentiel → Groq Whisper                            ║
║                                                                                    ║
║  + Supadata metadata en priorité + Circuit breaker + exponential backoff          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import asyncio
import subprocess
import json
import time
import logging
import httpx
from typing import Optional, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from transcripts.audio_utils import (
    download_audio_ytdlp,
    transcribe_audio_groq,
    compress_audio,
    executor as audio_executor,
)
from core.config import get_supadata_key, get_mistral_key

logger = logging.getLogger(__name__)

# 💾 Redis Cache L1
try:
    from core.cache import cache_service, make_cache_key
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False
    logger.warning("[TIKTOK] Redis cache not available")

# 💾 DB Cache L2 (persistent, cross-user)
try:
    from transcripts.cache_db import get_cached_transcript, save_transcript_to_cache
    DB_CACHE_AVAILABLE = True
except ImportError:
    DB_CACHE_AVAILABLE = False
    logger.warning("[TIKTOK] DB cache not available")

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Durée max TikTok supportée (10 minutes — au-delà c'est rare)
TIKTOK_MAX_DURATION = 600

# Headers alternatifs pour contourner les restrictions TikTok
ALT_HEADERS = [
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.tiktok.com/",
    },
    {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Referer": "https://www.tiktok.com/",
    },
]

# Retry config
MAX_RETRIES = 3
BASE_BACKOFF_SEC = 2.0

# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 CIRCUIT BREAKER (évite de spammer TikTok si le service est down)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class CircuitBreaker:
    """Simple circuit breaker pour les requêtes TikTok."""
    failure_count: int = 0
    last_failure_time: float = 0.0
    threshold: int = 5          # Nombre d'échecs avant ouverture
    reset_timeout: float = 300  # 5 min avant de réessayer

    def record_failure(self) -> None:
        self.failure_count += 1
        self.last_failure_time = time.time()
        logger.warning(f"[TIKTOK] Circuit breaker: failure #{self.failure_count}")

    def record_success(self) -> None:
        self.failure_count = 0
        self.last_failure_time = 0.0

    def is_open(self) -> bool:
        if self.failure_count < self.threshold:
            return False
        elapsed = time.time() - self.last_failure_time
        if elapsed > self.reset_timeout:
            # Half-open: on laisse passer pour tester
            logger.info("[TIKTOK] Circuit breaker: half-open, allowing retry")
            return False
        logger.warning(f"[TIKTOK] Circuit breaker OPEN ({self.failure_count} failures, retry in {int(self.reset_timeout - elapsed)}s)")
        return True


_circuit_breaker = CircuitBreaker()

# Patterns TikTok reconnus
TIKTOK_PATTERNS = [
    # URL standard : https://www.tiktok.com/@user/video/1234567890
    re.compile(r'tiktok\.com/@[\w.-]+/video/(\d+)', re.IGNORECASE),
    # URL courte : https://vm.tiktok.com/ZMxxxxxx/
    re.compile(r'vm\.tiktok\.com/([\w-]+)', re.IGNORECASE),
    # URL mobile : https://m.tiktok.com/v/1234567890
    re.compile(r'm\.tiktok\.com/v/(\d+)', re.IGNORECASE),
    # URL avec /t/ : https://www.tiktok.com/t/ZMxxxxxx/
    re.compile(r'tiktok\.com/t/([\w-]+)', re.IGNORECASE),
    # URL desktop sans @ : https://www.tiktok.com/video/1234567890
    re.compile(r'tiktok\.com/video/(\d+)', re.IGNORECASE),
]


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 DÉTECTION & EXTRACTION D'URL
# ═══════════════════════════════════════════════════════════════════════════════

def is_tiktok_url(url: str) -> bool:
    """Vérifie si une URL est une URL TikTok valide."""
    if not url:
        return False
    url = url.strip()
    return any(pattern.search(url) for pattern in TIKTOK_PATTERNS)


def extract_tiktok_video_id(url: str) -> Optional[str]:
    """
    Extrait l'ID vidéo TikTok d'une URL.
    Retourne l'ID numérique ou le short code pour les URLs courtes.
    """
    if not url:
        return None

    url = url.strip()
    for pattern in TIKTOK_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 📺 MÉTADONNÉES VIDÉO
# ═══════════════════════════════════════════════════════════════════════════════

async def get_tiktok_video_info(url: str) -> Optional[Dict[str, Any]]:
    """
    Récupère les métadonnées d'une vidéo TikTok.
    🆕 v3.0: Supadata metadata en priorité, puis yt-dlp, puis oEmbed.

    Retourne un dict compatible avec le format get_video_info() de youtube.py:
    {
        "video_id": str,
        "title": str,
        "channel": str,
        "thumbnail_url": str,
        "duration": int,
        "upload_date": str | None,
        "description": str,
        "platform": "tiktok",
    }
    """
    logger.info(f"[TIKTOK] Getting video info for: {url}")

    # ─── Supadata metadata (PRIORITAIRE) ─────────────────────────────────
    supadata_key = get_supadata_key()
    if supadata_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    "https://api.supadata.ai/v1/metadata",
                    params={"url": url},
                    headers={"x-api-key": supadata_key},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    vid = data.get("id", extract_tiktok_video_id(url) or "unknown")
                    duration = data.get("duration", 0) or 0
                    # 📊 Support both new unified format (author/stats objects)
                    # and legacy flat format (likeCount, viewCount, etc.)
                    author = data.get("author", {})
                    stats = data.get("stats", {})
                    additional = data.get("additionalData", {})
                    # ⚠️ Supadata peut retourner channel comme dict {"name": "...", "id": "..."}
                    raw_channel = data.get("channel", data.get("author", "Unknown"))
                    if isinstance(raw_channel, dict):
                        channel_str = (
                            raw_channel.get("displayName")
                            or raw_channel.get("name")
                            or raw_channel.get("username")
                            or raw_channel.get("title")
                            or "Unknown"
                        )
                    elif isinstance(author, dict) and author.get("displayName"):
                        channel_str = author.get("displayName") or author.get("username") or "Unknown"
                    else:
                        channel_str = str(raw_channel) if raw_channel else "Unknown"

                    # 📸 Carousel detection: Supadata returns type: "carousel"
                    content_type = data.get("type", "video") or "video"
                    carousel_images = []
                    if content_type == "carousel":
                        media = data.get("media", {})
                        items = media.get("items", []) if isinstance(media, dict) else []
                        carousel_images = [item.get("url") for item in items if item.get("url")]
                        logger.info(f"[TIKTOK] 📸 Carousel detected: {len(carousel_images)} images")

                    # 🎵 Music info from additionalData
                    music_data = additional.get("music", {}) if isinstance(additional, dict) else {}

                    logger.info(f"[TIKTOK] Supadata metadata OK: {data.get('title', '')[:50]} ({duration}s, type={content_type})")
                    return {
                        "video_id": str(vid),
                        "title": (data.get("title", "TikTok Video") or "TikTok Video")[:500],
                        "channel": channel_str,
                        "thumbnail_url": data.get("thumbnail", ""),
                        "duration": duration,
                        "upload_date": data.get("uploadDate") or data.get("createdAt"),
                        "description": (data.get("description", "") or "")[:2000],
                        "platform": "tiktok",
                        # Engagement: new stats object OR legacy flat fields
                        "like_count": stats.get("likes") or data.get("likeCount", 0),
                        "comment_count": stats.get("comments") or data.get("commentCount", 0),
                        "view_count": stats.get("views") or data.get("viewCount", 0),
                        "share_count": stats.get("shares") or data.get("shareCount", 0),
                        "tags": data.get("tags", []),
                        "categories": ["Social Media"],
                        # 📊 New metadata
                        "content_type": content_type,
                        "carousel_images": carousel_images,
                        "channel_id": (author.get("id") if isinstance(author, dict) else None) or data.get("channelId"),
                        "creator_verified": author.get("verified", False) if isinstance(author, dict) else False,
                        "music_title": music_data.get("title") if isinstance(music_data, dict) else None,
                        "music_author": music_data.get("author") if isinstance(music_data, dict) else None,
                    }
                else:
                    logger.warning(f"[TIKTOK] Supadata metadata error {resp.status_code}")
        except Exception as e:
            logger.warning(f"[TIKTOK] Supadata metadata exception: {e}")

    # ─── yt-dlp (fallback) ─────────────────────────────────────────────────
    # Circuit breaker check
    if _circuit_breaker.is_open():
        logger.error("[TIKTOK] Circuit breaker is open, skipping yt-dlp info")
        # Try oEmbed as last resort
        oembed_info = await _get_info_via_oembed(url)
        return oembed_info

    attempts = [
        {"headers": None, "label": "standard"},
        {"headers": ALT_HEADERS[0], "label": "alt-headers-chrome"},
        {"headers": ALT_HEADERS[1], "label": "alt-headers-safari"},
    ]

    for attempt in attempts:
        try:
            loop = asyncio.get_event_loop()
            headers = attempt["headers"]
            label = attempt["label"]

            def _get_info():
                cmd = [
                    "yt-dlp", "--dump-json",
                    "--no-warnings", "--skip-download",
                    "--no-playlist",
                ]
                if headers:
                    for key, value in headers.items():
                        cmd.extend(["--add-header", f"{key}: {value}"])
                cmd.append(url)
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                if result.returncode == 0:
                    return json.loads(result.stdout)
                stderr = result.stderr[:200] if result.stderr else "no stderr"
                # Détecter les erreurs spécifiques
                if "private" in stderr.lower() or "removed" in stderr.lower():
                    logger.warning(f"[TIKTOK] Video is private or removed")
                    return {"_error": "private_or_removed"}
                if "geo" in stderr.lower() or "not available" in stderr.lower():
                    logger.warning(f"[TIKTOK] Video is geo-restricted")
                    return {"_error": "geo_restricted"}
                logger.warning(f"[TIKTOK] yt-dlp info failed ({label}): {stderr}")
                return None

            data = await asyncio.wait_for(
                loop.run_in_executor(audio_executor, _get_info),
                timeout=30
            )

            # Gestion des erreurs détectées
            if data and "_error" in data:
                _circuit_breaker.record_failure()
                return None

            if not data:
                continue  # Essayer le prochain set de headers

            video_id = str(data.get("id", extract_tiktok_video_id(url) or "unknown"))
            duration = data.get("duration", 0) or 0

            # Vérifier la durée
            if duration > TIKTOK_MAX_DURATION:
                logger.warning(f"[TIKTOK] Video too long: {duration}s (max {TIKTOK_MAX_DURATION}s)")
                return None

            info = {
                "video_id": video_id,
                "title": data.get("title", data.get("description", "TikTok Video"))[:500],
                "channel": data.get("uploader", data.get("creator", "Unknown")),
                "thumbnail_url": data.get("thumbnail", ""),
                "duration": duration,
                "upload_date": data.get("upload_date"),
                "description": (data.get("description", "") or "")[:2000],
                "platform": "tiktok",
                # Métadonnées TikTok supplémentaires
                "like_count": data.get("like_count", 0),
                "comment_count": data.get("comment_count", 0),
                "view_count": data.get("view_count", 0),
                "tags": data.get("tags", []),
                "categories": ["Social Media"],
            }

            logger.info(f"[TIKTOK] Info OK ({label}): \"{info['title'][:50]}\" by {info['channel']} ({duration}s)")
            _circuit_breaker.record_success()
            return info

        except asyncio.TimeoutError:
            logger.warning(f"[TIKTOK] Info timeout ({attempt['label']})")
        except Exception as e:
            logger.error(f"[TIKTOK] Info error ({attempt['label']}): {e}")

    # ─── Phase 4 : Fallback oEmbed API (léger, pas de yt-dlp) ──────────
    logger.info(f"[TIKTOK] yt-dlp failed, trying oEmbed fallback for: {url}")
    oembed_info = await _get_info_via_oembed(url)
    if oembed_info:
        _circuit_breaker.record_success()
        return oembed_info

    _circuit_breaker.record_failure()
    return None


async def _resolve_short_url(url: str) -> Optional[str]:
    """
    Résout une URL courte TikTok (vm.tiktok.com, tiktok.com/t/)
    vers l'URL canonique en suivant les redirections.
    """
    if not any(p in url for p in ["vm.tiktok.com", "/t/", "m.tiktok.com"]):
        return url  # Déjà une URL longue

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
        ) as client:
            resp = await client.head(url)
            resolved = str(resp.url)
            logger.info(f"[TIKTOK] Resolved short URL → {resolved}")
            return resolved
    except Exception as e:
        logger.warning(f"[TIKTOK] Short URL resolution failed: {e}")
        return None


async def _get_info_via_oembed(url: str) -> Optional[Dict[str, Any]]:
    """
    Fallback via l'API oEmbed publique de TikTok.
    https://www.tiktok.com/oembed?url=...

    Retourne moins de métadonnées que yt-dlp mais c'est fiable et léger.
    Pas besoin de yt-dlp, pas de blocage IP.
    """
    try:
        # 1. Résoudre les URLs courtes
        resolved_url = await _resolve_short_url(url)
        if not resolved_url:
            return None

        # 2. Extraire le video_id depuis l'URL résolue
        video_id = extract_tiktok_video_id(resolved_url) or extract_tiktok_video_id(url) or "unknown"

        # 3. Appeler l'API oEmbed
        oembed_url = f"https://www.tiktok.com/oembed?url={resolved_url}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(oembed_url)
            if resp.status_code != 200:
                logger.warning(f"[TIKTOK] oEmbed returned {resp.status_code}")
                return None

            data = resp.json()

        title = data.get("title", "TikTok Video")[:500]
        author = data.get("author_name", "Unknown")
        thumbnail = data.get("thumbnail_url", "")

        info = {
            "video_id": video_id,
            "title": title,
            "channel": author,
            "thumbnail_url": thumbnail,
            "duration": 0,  # oEmbed ne fournit pas la durée
            "upload_date": None,
            "description": title,
            "platform": "tiktok",
            "like_count": 0,
            "comment_count": 0,
            "view_count": 0,
            "tags": [],
            "categories": ["Social Media"],
        }

        logger.info(f"[TIKTOK] oEmbed OK: \"{title[:50]}\" by {author}")
        return info

    except Exception as e:
        logger.error(f"[TIKTOK] oEmbed fallback failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🥇 SUPADATA API — PRIORITAIRE (texte natif ou STT côté Supadata)
# ═══════════════════════════════════════════════════════════════════════════════

async def _get_transcript_supadata_tiktok(
    url: str,
    video_id: str,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Récupère le transcript TikTok via l'API unifiée Supadata.
    Endpoint: GET https://api.supadata.ai/v1/transcript?url=...
    Supadata gère nativement TikTok (captions + fallback STT côté serveur).
    """
    api_key = get_supadata_key()
    if not api_key:
        logger.info("[TIKTOK] Supadata skipped: no API key")
        return None, None, None

    logger.info(f"[TIKTOK] Supadata: trying for {video_id}")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(
                "https://api.supadata.ai/v1/transcript",
                params={"url": url},
                headers={"x-api-key": api_key},
            )

            if resp.status_code == 200:
                data = resp.json()

                # Format: {"content": "...", "lang": "en", ...}
                content = data.get("content", "")
                lang = data.get("lang", "fr")

                if content and len(content.strip()) >= 20:
                    logger.info(f"[TIKTOK] Supadata SUCCESS: {len(content)} chars")
                    return content.strip(), content.strip(), lang

            elif resp.status_code == 202:
                # Async job — poll for result
                job_id = resp.json().get("jobId")
                if job_id:
                    logger.info(f"[TIKTOK] Supadata async job: {job_id}")
                    for _ in range(12):  # 60s max (12 * 5s)
                        await asyncio.sleep(5)
                        poll_resp = await client.get(
                            f"https://api.supadata.ai/v1/transcript/{job_id}",
                            headers={"x-api-key": api_key},
                        )
                        if poll_resp.status_code == 200:
                            poll_data = poll_resp.json()
                            content = poll_data.get("content", "")
                            lang = poll_data.get("lang", "fr")
                            if content and len(content.strip()) >= 20:
                                logger.info(f"[TIKTOK] Supadata async SUCCESS: {len(content)} chars")
                                return content.strip(), content.strip(), lang
                        elif poll_resp.status_code == 202:
                            continue  # Still processing
                        else:
                            break
            else:
                logger.warning(f"[TIKTOK] Supadata error: {resp.status_code}")

    except Exception as e:
        logger.error(f"[TIKTOK] Supadata exception: {e}")

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ TRANSCRIPTION COMPLÈTE
# ═══════════════════════════════════════════════════════════════════════════════

async def get_tiktok_transcript(
    url: str,
    video_id: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🆕 v2.1: Pipeline multi-fallback de transcription TikTok.
    + Cache Redis L1 + DB L2 persistent (cross-user).

    Phase 0: Cache check (Redis L1 → DB L2)
    Phase 1: yt-dlp standard → Groq Whisper
    Phase 2: yt-dlp avec headers alternatifs → Groq Whisper
    Phase 3: Retry avec exponential backoff
    Phase 4: Fallback téléchargement direct

    Args:
        url: URL TikTok complète
        video_id: ID vidéo (optionnel, pour les logs)

    Returns:
        (full_text, timestamped_text, detected_language) ou (None, None, None)
    """
    vid = video_id or extract_tiktok_video_id(url) or "unknown"
    logger.info(f"[TIKTOK] Starting transcript extraction for {vid}")

    # Circuit breaker check
    if _circuit_breaker.is_open():
        logger.error(f"[TIKTOK] Circuit breaker open, skipping transcript for {vid}")
        return None, None, None

    # ─── Phase 0 : Cache check (Redis L1 → DB L2) ─────────────────────────
    if CACHE_AVAILABLE:
        try:
            cache_key = make_cache_key("transcript", f"tiktok_{vid}")
            cached = await cache_service.get(cache_key)
            if cached and isinstance(cached, dict):
                logger.info(f"[TIKTOK] Redis Cache HIT for {vid}")
                return cached.get("simple"), cached.get("timestamped"), cached.get("lang")
            else:
                logger.info(f"[TIKTOK] Redis Cache MISS for {vid}")
        except Exception as e:
            logger.warning(f"[TIKTOK] Redis cache error: {e}")

    if DB_CACHE_AVAILABLE:
        try:
            db_cached = await get_cached_transcript(f"tiktok_{vid}")
            if db_cached:
                simple, timestamped, lang = db_cached
                logger.info(f"[TIKTOK] DB Cache HIT for {vid} ({len(simple)} chars)")
                # Populate Redis L1
                if CACHE_AVAILABLE:
                    try:
                        cache_key = make_cache_key("transcript", f"tiktok_{vid}")
                        await cache_service.set(cache_key, {"simple": simple, "timestamped": timestamped, "lang": lang})
                    except Exception:
                        pass
                return simple, timestamped, lang
            else:
                logger.info(f"[TIKTOK] DB Cache MISS for {vid}")
        except Exception as e:
            logger.warning(f"[TIKTOK] DB cache error: {e}")

    # Helper to cache result after successful extraction
    async def _cache_result(result: Tuple, method: str):
        simple, timestamped, lang = result
        if not simple:
            return
        # Redis L1
        if CACHE_AVAILABLE:
            try:
                cache_key = make_cache_key("transcript", f"tiktok_{vid}")
                await cache_service.set(cache_key, {"simple": simple, "timestamped": timestamped, "lang": lang})
                logger.info(f"[TIKTOK] Redis cached for {vid}")
            except Exception:
                pass
        # DB L2
        if DB_CACHE_AVAILABLE:
            try:
                await save_transcript_to_cache(f"tiktok_{vid}", simple, timestamped, lang, platform="tiktok", extraction_method=method)
                print(f"🗄️ DB Cache SAVED for tiktok_{vid}", flush=True)
            except Exception as e:
                print(f"⚠️ DB Cache save error for tiktok_{vid}: {e}", flush=True)

    # ─── Phase 0.5 : Supadata API (PRIORITAIRE) ──────────────────────────
    logger.info(f"[TIKTOK] Phase 0.5: Supadata API (priority) for {vid}")
    try:
        supadata_result = await _get_transcript_supadata_tiktok(url, vid)
        if supadata_result[0]:
            _circuit_breaker.record_success()
            await _cache_result(supadata_result, "tiktok-supadata")
            return supadata_result
    except Exception as e:
        logger.warning(f"[TIKTOK] Supadata failed: {e}")

    # ─── Phase 1 : yt-dlp standard ────────────────────────────────────────
    audio_data, audio_ext = await _download_with_retry(url, label="phase1-standard")

    if audio_data:
        result = await _transcribe_safely(audio_data, audio_ext, vid, "phase1")
        if result[0]:
            _circuit_breaker.record_success()
            await _cache_result(result, "tiktok-phase1-ytdlp")
            return result

    # ─── Phase 2 : yt-dlp avec headers alternatifs ────────────────────────
    for idx, headers in enumerate(ALT_HEADERS):
        logger.info(f"[TIKTOK] Phase 2: trying alt-headers #{idx + 1} for {vid}")
        audio_data, audio_ext = await _download_with_retry(
            url, label=f"phase2-alt{idx + 1}", extra_args=_headers_to_args(headers)
        )
        if audio_data:
            result = await _transcribe_safely(audio_data, audio_ext, vid, f"phase2-alt{idx + 1}")
            if result[0]:
                _circuit_breaker.record_success()
                await _cache_result(result, f"tiktok-phase2-alt{idx + 1}")
                return result

    # ─── Phase 3 : Retry avec exponential backoff ─────────────────────────
    for retry in range(MAX_RETRIES):
        backoff = BASE_BACKOFF_SEC * (2 ** retry)
        logger.info(f"[TIKTOK] Phase 3: retry #{retry + 1} after {backoff}s for {vid}")
        await asyncio.sleep(backoff)

        audio_data, audio_ext = await _download_with_retry(url, label=f"phase3-retry{retry + 1}")
        if audio_data:
            result = await _transcribe_safely(audio_data, audio_ext, vid, f"phase3-retry{retry + 1}")
            if result[0]:
                _circuit_breaker.record_success()
                await _cache_result(result, f"tiktok-phase3-retry{retry + 1}")
                return result

    # ─── Phase 4 : Fallback téléchargement direct (sans yt-dlp) ──────────
    logger.info(f"[TIKTOK] Phase 4: trying direct download fallbacks for {vid}")
    audio_data, audio_ext = await _download_audio_direct(url, vid)
    if audio_data:
        result = await _transcribe_safely(audio_data, audio_ext, vid, "phase4-direct")
        if result[0]:
            _circuit_breaker.record_success()
            await _cache_result(result, "tiktok-phase4-direct")
            return result

    # ─── Phase 5 : Visual OCR fallback (TikTok slides avec texte) ─────
    logger.info(f"[TIKTOK] Phase 5: Visual OCR fallback for {vid}")
    if get_mistral_key():
        try:
            from transcripts.visual_ocr import extract_text_from_video_frames

            # Télécharger la vidéo complète (pas juste l'audio)
            video_data = await _download_video_bytes(url, vid)
            if video_data:
                ocr_text, ocr_lang = await extract_text_from_video_frames(video_data, vid)
                if ocr_text:
                    logger.info(f"[TIKTOK] Visual OCR success for {vid}: {len(ocr_text)} chars")
                    _circuit_breaker.record_success()
                    result = (ocr_text, None, ocr_lang or "fr")
                    await _cache_result(result, "tiktok-phase5-visual-ocr")
                    return result
        except Exception as e:
            logger.warning(f"[TIKTOK] Visual OCR failed: {e}")

    _circuit_breaker.record_failure()
    logger.error(f"[TIKTOK] All phases (including visual OCR) failed for {vid}")
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 TÉLÉCHARGEMENT AUDIO DIRECT (sans yt-dlp — Phase 4 fallback)
# ═══════════════════════════════════════════════════════════════════════════════

# Services tiers pour obtenir les URLs média TikTok
TIKTOK_DOWNLOAD_APIS = [
    {
        "name": "tikwm",
        "url": "https://www.tikwm.com/api/",
        "method": "POST",
        "body_key": "url",
        "extract": lambda data: (
            data.get("data", {}).get("music_info", {}).get("play")
            or data.get("data", {}).get("music")
            or data.get("data", {}).get("play")
        ),
    },
    {
        "name": "tikwm-v2",
        "url": "https://www.tikwm.com/api/",
        "method": "POST",
        "body_key": "url",
        "extract": lambda data: data.get("data", {}).get("play"),
    },
]


async def _download_audio_direct(
    url: str,
    video_id: str,
) -> Tuple[Optional[bytes], str]:
    """
    🆕 Phase 4 : Télécharge l'audio TikTok SANS yt-dlp.

    Utilise des APIs tierces (tikwm.com) pour obtenir un lien direct
    vers la vidéo/audio, puis télécharge avec httpx.

    Fallback ultime : télécharge la vidéo entière et extrait l'audio avec ffmpeg.
    """
    import tempfile
    from pathlib import Path

    # 1. Résoudre les URLs courtes
    resolved_url = await _resolve_short_url(url)
    target_url = resolved_url or url

    # 2. Essayer les APIs de téléchargement
    for api in TIKTOK_DOWNLOAD_APIS:
        try:
            media_url = await _get_media_url_from_api(target_url, api)
            if not media_url:
                continue

            # Télécharger le média
            audio_data = await _download_media_bytes(media_url, api["name"])
            if not audio_data:
                continue

            # Si c'est une vidéo (mp4), extraire l'audio avec ffmpeg
            if media_url.endswith(".mp4") or b"\x00\x00\x00" in audio_data[:10]:
                logger.info(f"[TIKTOK] Converting video to audio with ffmpeg ({api['name']})")
                audio_data, ext = await _extract_audio_ffmpeg(audio_data)
                if audio_data:
                    return audio_data, ext
            else:
                # C'est déjà de l'audio
                logger.info(f"[TIKTOK] Direct audio downloaded: {len(audio_data)/1024:.0f}KB ({api['name']})")
                return audio_data, ".mp3"

        except Exception as e:
            logger.warning(f"[TIKTOK] API {api['name']} failed: {e}")

    logger.warning(f"[TIKTOK] All direct download fallbacks failed for {video_id}")
    return None, ".mp3"


async def _get_media_url_from_api(url: str, api_config: dict) -> Optional[str]:
    """Obtient l'URL du média via une API tierce."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if api_config["method"] == "POST":
                resp = await client.post(
                    api_config["url"],
                    data={api_config["body_key"]: url},
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Accept": "application/json",
                    },
                )
            else:
                resp = await client.get(
                    api_config["url"],
                    params={api_config["body_key"]: url},
                    headers={"User-Agent": "Mozilla/5.0"},
                )

            if resp.status_code != 200:
                logger.warning(f"[TIKTOK] API {api_config['name']} returned {resp.status_code}")
                return None

            data = resp.json()
            media_url = api_config["extract"](data)

            if media_url:
                logger.info(f"[TIKTOK] Got media URL from {api_config['name']}: {media_url[:80]}...")
                return media_url

    except Exception as e:
        logger.warning(f"[TIKTOK] API {api_config['name']} error: {e}")

    return None


async def _download_media_bytes(media_url: str, source: str) -> Optional[bytes]:
    """Télécharge le contenu d'une URL média en bytes."""
    try:
        async with httpx.AsyncClient(
            timeout=60.0,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.tiktok.com/",
            },
        ) as client:
            resp = await client.get(media_url)
            if resp.status_code == 200 and len(resp.content) > 1000:
                logger.info(f"[TIKTOK] Downloaded {len(resp.content)/1024:.0f}KB from {source}")
                return resp.content
            else:
                logger.warning(f"[TIKTOK] Media download failed: status={resp.status_code}, size={len(resp.content)}")
    except Exception as e:
        logger.warning(f"[TIKTOK] Media download error from {source}: {e}")
    return None


async def _extract_audio_ffmpeg(video_data: bytes) -> Tuple[Optional[bytes], str]:
    """Extrait l'audio d'une vidéo MP4 via ffmpeg."""
    import tempfile
    from pathlib import Path

    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_in:
            tmp_in.write(video_data)
            tmp_in_path = tmp_in.name

        tmp_out_path = tmp_in_path.replace(".mp4", ".mp3")

        loop = asyncio.get_event_loop()

        def _convert():
            import subprocess
            cmd = [
                "ffmpeg", "-i", tmp_in_path,
                "-vn",  # No video
                "-b:a", "64k", "-ac", "1", "-ar", "16000",
                "-y", tmp_out_path,
            ]
            result = subprocess.run(cmd, capture_output=True, timeout=60)
            return result.returncode == 0

        success = await asyncio.wait_for(
            loop.run_in_executor(audio_executor, _convert),
            timeout=60,
        )

        if success and Path(tmp_out_path).exists():
            audio_bytes = Path(tmp_out_path).read_bytes()
            logger.info(f"[TIKTOK] ffmpeg extracted audio: {len(audio_bytes)/1024:.0f}KB")
            Path(tmp_in_path).unlink(missing_ok=True)
            Path(tmp_out_path).unlink(missing_ok=True)
            return audio_bytes, ".mp3"

        Path(tmp_in_path).unlink(missing_ok=True)
        Path(tmp_out_path).unlink(missing_ok=True)

    except Exception as e:
        logger.error(f"[TIKTOK] ffmpeg extraction failed: {e}")

    return None, ".mp3"


# ═══════════════════════════════════════════════════════════════════════════════
# 📹 TÉLÉCHARGEMENT VIDÉO COMPLÈTE (pour Visual OCR — Phase 5)
# ═══════════════════════════════════════════════════════════════════════════════

async def _download_video_bytes(url: str, video_id: str) -> Optional[bytes]:
    """
    Télécharge la vidéo TikTok complète (pas juste l'audio).
    Nécessaire pour extraire les frames visuelles (slides OCR).

    Essaie d'abord les APIs tierces (tikwm), puis yt-dlp.
    """
    import tempfile
    from pathlib import Path

    # 1. Essayer les APIs tierces (plus rapide, pas de yt-dlp)
    resolved_url = await _resolve_short_url(url)
    target_url = resolved_url or url

    for api in TIKTOK_DOWNLOAD_APIS:
        try:
            media_url = await _get_media_url_from_api(target_url, api)
            if not media_url:
                continue
            video_data = await _download_media_bytes(media_url, api["name"])
            if video_data and len(video_data) > 1000:
                logger.info(f"[TIKTOK] Video downloaded via {api['name']}: {len(video_data)/1024:.0f}KB")
                return video_data
        except Exception as e:
            logger.warning(f"[TIKTOK] Video download via {api['name']} failed: {e}")

    # 2. Fallback yt-dlp (téléchargement vidéo, pas audio)
    try:
        loop = asyncio.get_event_loop()

        def _dl():
            with tempfile.TemporaryDirectory() as tmpdir:
                video_path = f"{tmpdir}/video.mp4"
                cmd = [
                    "yt-dlp",
                    "-f", "best[ext=mp4]/best",
                    "-o", video_path,
                    "--no-warnings", "--no-playlist",
                    "--retries", "2",
                    url,
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                if result.returncode == 0:
                    for f in Path(tmpdir).iterdir():
                        if f.suffix in [".mp4", ".webm", ".mkv"]:
                            data = f.read_bytes()
                            if data:
                                return data
                return None

        video_data = await asyncio.wait_for(
            loop.run_in_executor(audio_executor, _dl),
            timeout=60,
        )
        if video_data:
            logger.info(f"[TIKTOK] Video downloaded via yt-dlp: {len(video_data)/1024:.0f}KB")
            return video_data
    except asyncio.TimeoutError:
        logger.warning(f"[TIKTOK] yt-dlp video download timeout for {video_id}")
    except Exception as e:
        logger.warning(f"[TIKTOK] yt-dlp video download failed for {video_id}: {e}")

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS INTERNES
# ═══════════════════════════════════════════════════════════════════════════════

def _headers_to_args(headers: Dict[str, str]) -> list:
    """Convertit un dict de headers en arguments yt-dlp."""
    args = []
    for key, value in headers.items():
        args.extend(["--add-header", f"{key}: {value}"])
    return args


async def _download_with_retry(
    url: str,
    label: str = "default",
    extra_args: Optional[list] = None,
    timeout: int = 120,
) -> Tuple[Optional[bytes], Optional[str]]:
    """Télécharge l'audio avec paramètres optionnels."""
    try:
        audio_data, audio_ext = await download_audio_ytdlp(
            url=url,
            source_name=f"TIKTOK-{label}",
            timeout=timeout,
            extra_args=extra_args,
        )
        return audio_data, audio_ext
    except Exception as e:
        logger.warning(f"[TIKTOK] Download failed ({label}): {e}")
        return None, None


async def _transcribe_safely(
    audio_data: bytes,
    audio_ext: str,
    vid: str,
    label: str,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Transcrit de manière sécurisée avec logging."""
    try:
        full_text, timestamped, lang = await transcribe_audio_groq(
            audio_data=audio_data,
            audio_ext=audio_ext,
            source_name=f"TIKTOK-{label}",
        )
        if full_text:
            logger.info(f"[TIKTOK] Transcript OK ({label}): {len(full_text)} chars, lang={lang}, vid={vid}")
        return full_text, timestamped, lang
    except Exception as e:
        logger.error(f"[TIKTOK] Transcription error ({label}): {e}")
        return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 DÉTECTION DE PLATEFORME (helper pour le router)
# ═══════════════════════════════════════════════════════════════════════════════

def detect_platform(url: str) -> str:
    """
    Détecte la plateforme d'une URL.
    Retourne "tiktok" ou "youtube" (défaut).
    """
    if is_tiktok_url(url):
        return "tiktok"
    return "youtube"
