"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎵 TIKTOK v2.0 — Extraction de transcripts TikTok multi-fallback                ║
║                                                                                    ║
║  Pipeline multi-phase (inspiré du système YouTube ultra-résilient):               ║
║  Phase 1: yt-dlp standard → Groq Whisper                                          ║
║  Phase 2: yt-dlp avec headers alternatifs → Groq Whisper                          ║
║  Phase 3: yt-dlp avec retry exponentiel → Groq Whisper                            ║
║                                                                                    ║
║  + Circuit breaker + exponential backoff + meilleure gestion d'erreurs            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import asyncio
import subprocess
import json
import time
import logging
from typing import Optional, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from transcripts.audio_utils import (
    download_audio_ytdlp,
    transcribe_audio_groq,
    compress_audio,
    executor as audio_executor,
)

logger = logging.getLogger(__name__)

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
    Récupère les métadonnées d'une vidéo TikTok via yt-dlp --dump-json.
    🆕 v2.0: Retry avec headers alternatifs + meilleure gestion d'erreurs.

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

    # Circuit breaker check
    if _circuit_breaker.is_open():
        logger.error("[TIKTOK] Circuit breaker is open, skipping info request")
        return None

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

    _circuit_breaker.record_failure()
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ TRANSCRIPTION COMPLÈTE
# ═══════════════════════════════════════════════════════════════════════════════

async def get_tiktok_transcript(
    url: str,
    video_id: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🆕 v2.0: Pipeline multi-fallback de transcription TikTok.

    Phase 1: yt-dlp standard → Groq Whisper
    Phase 2: yt-dlp avec headers alternatifs → Groq Whisper
    Phase 3: Retry avec exponential backoff

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

    # ─── Phase 1 : yt-dlp standard ────────────────────────────────────────
    audio_data, audio_ext = await _download_with_retry(url, label="phase1-standard")

    if audio_data:
        result = await _transcribe_safely(audio_data, audio_ext, vid, "phase1")
        if result[0]:
            _circuit_breaker.record_success()
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
                return result

    _circuit_breaker.record_failure()
    logger.error(f"[TIKTOK] All phases failed for {vid}")
    return None, None, None


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
