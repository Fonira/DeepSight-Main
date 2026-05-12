"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📺 YOUTUBE SERVICE v7.0 — SUPADATA PRIORITAIRE + STT SHORTS ONLY                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  🆕 v7.0: SUPADATA EN PRIORITÉ + STT RÉSERVÉ AUX SHORTS                           ║
║  • 🥇 Supadata API en PRIORITÉ (seul, avant tout le reste)                        ║
║  • 🔄 User-agents rotatifs (anti-détection)                                        ║
║  • 🛡️ Options anti-bot renforcées pour yt-dlp (mweb, retries, sleep)              ║
║  • 🌐 Invidious (10 instances) + Piped (8 instances)                               ║
║  • 🎙️ STT (Groq/OpenAI/Deepgram/AssemblyAI) — SHORTS UNIQUEMENT                  ║
║  • 🔌 Circuit Breaker (skip méthodes cassées)                                      ║
║  • 📈 Exponential Backoff (retries intelligents)                                   ║
║  • 🏥 Instance Health Manager (évite instances mortes)                             ║
║  • 🌍 Support 12+ langues (fr, en, es, de, pt, it, nl, ru, ja, ko, zh, ar)        ║
║                                                                                    ║
║  ARCHITECTURE (10 méthodes en 4 phases):                                           ║
║  ┌─ Phase 0: Supadata API EN PRIORITÉ (seul) ─────────────────────────────────────┐║
║  │  1. Supadata API (stable, payant, toujours essayé en premier)                  │║
║  └────────────────────────────────────────────────────────────────────────────────┘║
║  ┌─ Phase 1: Texte EN PARALLÈLE (si Supadata échoue) ────────────────────────────┐║
║  │  2. youtube-transcript-api (gratuit, rapide)                                   │║
║  │  3. Invidious API (10 instances, contourne blocage)                            │║
║  │  4. Piped API (8 instances, alternative Invidious)                             │║
║  └────────────────────────────────────────────────────────────────────────────────┘║
║  ┌─ Phase 2: yt-dlp (séquentiel, plus lent) ──────────────────────────────────────┐║
║  │  5. yt-dlp manual subtitles (avec anti-bot)                                    │║
║  │  6. yt-dlp auto-captions (avec anti-bot)                                       │║
║  └────────────────────────────────────────────────────────────────────────────────┘║
║  ┌─ Phase 3: Audio STT (dernier recours — toutes vidéos) ────────────────────────┐║
║  │  7. Groq Whisper (rapide, gratuit jusqu'à 25MB)                                │║
║  │  8. OpenAI Whisper (fallback si Groq échoue)                                   │║
║  │  9. Deepgram Nova-2 (ultra-rapide)                                             │║
║  │  10. AssemblyAI (premium, très fiable)                                         │║
║  └────────────────────────────────────────────────────────────────────────────────┘║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import os
import json
import httpx
import tempfile
import subprocess
import random
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from enum import Enum
import asyncio
import time
import contextvars

from core.config import (
    get_supadata_key,
    get_groq_key,
    get_deepgram_key,
    get_openai_key,
    get_assemblyai_key,
    get_elevenlabs_key,
    get_mistral_key,
    get_youtube_proxy,
    TRANSCRIPT_CONFIG,
)
from core.http_client import shared_http_client, get_proxied_client

# 💾 Cache pour les transcripts (TTL 24h)
try:
    from core.cache import cache_service, make_cache_key, transcript_metrics

    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False
    transcript_metrics = None
    print("⚠️ [YOUTUBE] Cache not available, transcripts won't be cached", flush=True)

# 💾 DB Cache L2 (persistent, cross-user) — kept for legacy / direct use
try:
    from transcripts.cache_db import get_cached_transcript, save_transcript_to_cache

    DB_CACHE_AVAILABLE = True
except ImportError:
    DB_CACHE_AVAILABLE = False
    print("⚠️ [YOUTUBE] DB cache not available", flush=True)

# 💾 Unified L1 (Redis) + L2 (DB) transcript cache orchestrator
try:
    from transcripts.cache import transcript_cache

    TRANSCRIPT_CACHE_AVAILABLE = True
except ImportError:
    TRANSCRIPT_CACHE_AVAILABLE = False
    transcript_cache = None
    print("⚠️ [YOUTUBE] Unified transcript cache not available", flush=True)

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

GROQ_MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB max pour Groq
OPENAI_MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB max pour OpenAI Whisper
MAX_DURATION_FOR_STT = int(os.environ.get("MAX_DURATION_FOR_STT", "1200"))  # 20 min max pour STT

# 🚦 Semaphore: limite les extractions transcript concurrentes
# Évite de flood les APIs externes (Supadata, Invidious, Piped, etc.)
MAX_CONCURRENT_EXTRACTIONS = int(os.environ.get("MAX_CONCURRENT_EXTRACTIONS", "10"))
_extraction_semaphore = asyncio.Semaphore(MAX_CONCURRENT_EXTRACTIONS)

TIMEOUTS = {
    "supadata": 25,  # 45 → 25 (perf: fail-fast si Supadata lent)
    "ytapi": 25,  # 15 → 25 (plus de marge)
    "invidious": 35,  # 20 → 35 (instances lentes)
    "piped": 35,  # Nouveau - Piped API
    "ytdlp_subs": 90,  # 60 → 90 (anti-bot delays)
    "ytdlp_auto": 90,  # 60 → 90 (anti-bot delays)
    "whisper_download": 240,  # 180 → 240 (vidéos longues)
    "whisper_transcribe": 120,  # 360 → 120 (perf: fail-fast)
    "voxtral_stt": 300,  # v7.2 - Mistral Voxtral STT (3h audio max)
    "openai_whisper": 180,  # 360 → 180 (perf: fail-fast)
    "deepgram": 300,  # Deepgram Nova-2
    "assemblyai": 300,  # Nouveau - AssemblyAI
    "elevenlabs_scribe": 300,  # ElevenLabs Scribe v2
}

# ⚡ v7.1: Timeouts réduits pour vidéos courtes (<5 min) — gain ~50% sur fallback
TIMEOUTS_SHORT = {
    "supadata": 20,  # 45 → 20 (petite vidéo = réponse rapide)
    "ytapi": 15,  # 25 → 15
    "invidious": 20,  # 35 → 20
    "piped": 20,  # 35 → 20
    "ytdlp_subs": 45,  # 90 → 45
    "ytdlp_auto": 45,  # 90 → 45
    "whisper_download": 60,  # 240 → 60 (fichier audio petit)
    "whisper_transcribe": 60,  # 90 → 60 (perf: fail-fast)
    "voxtral_stt": 90,  # 300 → 90
    "openai_whisper": 90,  # 360 → 90
    "deepgram": 60,  # 300 → 60
    "assemblyai": 60,  # 300 → 60
    "elevenlabs_scribe": 60,  # 300 → 60
}


# MIME types pour multipart uploads (Voxtral STT, etc.)
AUDIO_MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".webm": "audio/webm",
    ".opus": "audio/opus",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
}


def get_timeout(method: str, is_short: bool = False) -> int:
    """Retourne le timeout adapté à la durée de la vidéo."""
    timeouts = TIMEOUTS_SHORT if is_short else TIMEOUTS
    return timeouts.get(method, 30)


# ⚡ v7.1: ContextVar async-safe pour timeouts adaptatifs
# Permet à toutes les sous-fonctions d'utiliser automatiquement les bons timeouts
# sans modifier leurs signatures. Set une seule fois dans get_transcript_with_timestamps().
_active_timeouts: contextvars.ContextVar[dict] = contextvars.ContextVar("_active_timeouts", default=TIMEOUTS)


def _t(method: str) -> int:
    """Raccourci async-safe: retourne le timeout actif pour la méthode donnée."""
    return _active_timeouts.get().get(method, 30)


# 🛡️ USER-AGENTS ROTATIFS (anti-détection)
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# 🌐 INSTANCES INVIDIOUS PUBLIQUES (fallback pour contourner le blocage YouTube)
# Liste mise à jour janvier 2025 - instances les plus fiables
INVIDIOUS_INSTANCES = [
    "https://invidious.fdn.fr",  # France - très fiable
    "https://inv.nadeko.net",  # Stable
    "https://invidious.nerdvpn.de",  # Allemagne
    "https://yt.artemislena.eu",  # EU
    "https://invidious.protokolla.fi",  # Finlande
    "https://inv.tux.pizza",  # Stable
    "https://vid.puffyan.us",  # US
    "https://invidious.projectsegfau.lt",  # EU
    "https://invidious.privacyredirect.com",
    "https://invidious.io.lol",
]

# 🆕 INSTANCES PIPED PUBLIQUES (alternative à Invidious)
# Liste mise à jour janvier 2025 - instances les plus fiables
PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",  # Principal - très fiable
    "https://api.piped.yt",  # Stable
    "https://pipedapi.tokhmi.xyz",  # Asie
    "https://pipedapi.moomoo.me",  # EU
    "https://pipedapi.syncpundit.io",  # EU
    "https://api.piped.projectsegfau.lt",  # EU
    "https://pipedapi.r4fo.com",  # EU
    "https://pipedapi.privacy.com.de",  # Allemagne
]


def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)


def get_working_invidious_instance() -> Optional[str]:
    """Trouve une instance Invidious qui fonctionne"""
    random.shuffle(INVIDIOUS_INSTANCES)
    return INVIDIOUS_INSTANCES[0] if INVIDIOUS_INSTANCES else None


def get_working_piped_instance() -> Optional[str]:
    """Trouve une instance Piped qui fonctionne"""
    random.shuffle(PIPED_INSTANCES)
    return PIPED_INSTANCES[0] if PIPED_INSTANCES else None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 CIRCUIT BREAKER — Skip méthodes qui échouent répétitivement
# ═══════════════════════════════════════════════════════════════════════════════


class CircuitState(Enum):
    CLOSED = "closed"  # Normal - méthode active
    OPEN = "open"  # Méthode désactivée temporairement
    HALF_OPEN = "half_open"  # Test en cours


@dataclass
class CircuitBreaker:
    """Circuit Breaker pattern pour éviter de perdre du temps sur méthodes cassées"""

    name: str
    failure_threshold: int = 5
    recovery_timeout: int = 300  # 5 minutes
    state: CircuitState = CircuitState.CLOSED
    failures: int = 0
    last_failure_time: float = 0

    def record_success(self):
        """Enregistre un succès et réinitialise le compteur"""
        self.failures = 0
        self.state = CircuitState.CLOSED

    def record_failure(self):
        """Enregistre un échec et ouvre le circuit si nécessaire"""
        self.failures += 1
        self.last_failure_time = time.time()
        if self.failures >= self.failure_threshold:
            self.state = CircuitState.OPEN
            print(f"  🔌 [CIRCUIT] {self.name} OUVERT après {self.failures} échecs", flush=True)

    def can_execute(self) -> bool:
        """Vérifie si la méthode peut être exécutée"""
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            # Vérifier si le temps de récupération est passé
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                print(f"  🔌 [CIRCUIT] {self.name} HALF-OPEN (test)", flush=True)
                return True
            return False
        return True  # HALF_OPEN


# Instance globale des circuit breakers
_circuit_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str) -> CircuitBreaker:
    """Récupère ou crée un circuit breaker pour une méthode"""
    if name not in _circuit_breakers:
        config = TRANSCRIPT_CONFIG
        _circuit_breakers[name] = CircuitBreaker(
            name=name,
            failure_threshold=config.get("circuit_breaker_failure_threshold", 5),
            recovery_timeout=config.get("circuit_breaker_recovery_timeout", 300),
        )
    return _circuit_breakers[name]


# ═══════════════════════════════════════════════════════════════════════════════
# 📈 EXPONENTIAL BACKOFF — Retries intelligents
# ═══════════════════════════════════════════════════════════════════════════════


def calculate_backoff(attempt: int, base: float = 1.0, max_delay: float = 30.0) -> float:
    """
    Calcule le délai d'attente avec exponential backoff + jitter
    attempt 0: ~1s, attempt 1: ~2s, attempt 2: ~4s, etc.
    """
    config = TRANSCRIPT_CONFIG
    base = config.get("backoff_base", base)
    max_delay = config.get("backoff_max", max_delay)

    delay = min(base * (2**attempt), max_delay)
    jitter = random.uniform(0, delay * 0.3)  # 30% de jitter
    return delay + jitter


# ═══════════════════════════════════════════════════════════════════════════════
# 🏥 INSTANCE HEALTH MANAGER — Évite les instances mortes
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class InstanceHealth:
    """Suivi de santé d'une instance"""

    url: str
    failures: int = 0
    successes: int = 0
    last_check: float = 0
    is_healthy: bool = True


_instance_health: Dict[str, InstanceHealth] = {}


def get_instance_health(url: str) -> InstanceHealth:
    """Récupère ou crée le suivi de santé d'une instance"""
    if url not in _instance_health:
        _instance_health[url] = InstanceHealth(url=url)
    return _instance_health[url]


def record_instance_success(url: str):
    """Enregistre un succès pour une instance"""
    health = get_instance_health(url)
    health.successes += 1
    health.failures = max(0, health.failures - 1)  # Décrémente les échecs
    health.is_healthy = True
    health.last_check = time.time()


def record_instance_failure(url: str):
    """Enregistre un échec pour une instance"""
    config = TRANSCRIPT_CONFIG
    threshold = config.get("instance_timeout_threshold", 3)

    health = get_instance_health(url)
    health.failures += 1
    health.last_check = time.time()

    if health.failures >= threshold:
        health.is_healthy = False
        print(f"  🏥 [HEALTH] {url[:30]}... marqué DOWN après {health.failures} échecs", flush=True)


def get_healthy_instances(instances: List[str]) -> List[str]:
    """Retourne les instances en bonne santé, avec les saines en premier"""
    config = TRANSCRIPT_CONFIG
    check_interval = config.get("health_check_interval", 600)
    current_time = time.time()

    healthy = []
    unhealthy = []

    for url in instances:
        health = get_instance_health(url)
        # Réactiver les instances après un certain temps
        if not health.is_healthy and (current_time - health.last_check) > check_interval:
            health.is_healthy = True
            health.failures = 0
            print(f"  🏥 [HEALTH] {url[:30]}... réactivé", flush=True)

        if health.is_healthy:
            healthy.append(url)
        else:
            unhealthy.append(url)

    # Shuffle les instances saines pour distribuer la charge
    random.shuffle(healthy)
    return healthy + unhealthy  # Les unhealthy à la fin en dernier recours


class TranscriptSource(Enum):
    SUPADATA = "supadata"
    YTAPI = "youtube-transcript-api"
    INVIDIOUS = "invidious"
    PIPED = "piped"  # Nouveau
    YTDLP = "yt-dlp"
    YTDLP_AUTO = "yt-dlp-auto"
    VOXTRAL_STT = "voxtral-stt"  # v7.2 — Mistral Voxtral STT (prioritaire Phase 3)
    WHISPER = "groq-whisper"
    OPENAI_WHISPER = "openai-whisper"
    DEEPGRAM = "deepgram-nova2"
    ASSEMBLYAI = "assemblyai"
    ELEVENLABS_SCRIBE = "elevenlabs-scribe"
    CACHE = "cache"
    NONE = "none"


@dataclass
class TranscriptResult:
    text: str
    text_timestamped: str
    lang: str
    source: TranscriptSource
    duration_seconds: float = 0
    confidence: float = 1.0


try:
    from youtube_transcript_api import YouTubeTranscriptApi

    YTAPI_AVAILABLE = True
    print("✅ youtube-transcript-api available", flush=True)
except ImportError:
    YTAPI_AVAILABLE = False
    print("⚠️ youtube-transcript-api not available", flush=True)

executor = ThreadPoolExecutor(max_workers=4)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 EXTRACTION VIDEO ID / PLAYLIST ID
# ═══════════════════════════════════════════════════════════════════════════════


def extract_video_id(url: str) -> Optional[str]:
    if not url:
        return None
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/)([a-zA-Z0-9_-]{11})",
        r"youtube\.com/shorts/([a-zA-Z0-9_-]{11})",
        r"youtube\.com/live/([a-zA-Z0-9_-]{11})",
        r"music\.youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_playlist_id(url: str) -> Optional[str]:
    if not url:
        return None
    patterns = [r"[?&]list=([a-zA-Z0-9_-]+)", r"^([a-zA-Z0-9_-]{13,})$"]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 📺 VIDEO INFO
# ═══════════════════════════════════════════════════════════════════════════════


async def get_video_info(video_id: str) -> Optional[Dict[str, Any]]:
    """
    Récupère les infos via Supadata (prioritaire) puis Invidious puis yt-dlp.
    🆕 v7.0: Supadata metadata en priorité
    ⚡ v7.3: Cache Redis (TTL 12h) pour éviter re-fetch métadonnées
    """
    print(f"📺 [VIDEO INFO] Getting info for: {video_id}", flush=True)

    # ─── Cache check (Redis L1) ──────────────────────────────────────────
    _vinfo_cache_key = f"video_info:youtube:{video_id}"
    try:
        from core.cache import cache_service as _cache_service

        _cached = await _cache_service.get(_vinfo_cache_key)
        if _cached:
            print(f"💾 [VIDEO INFO] Cache HIT for {video_id}", flush=True)
            return _cached
    except Exception:
        pass

    # ─── Supadata metadata (PRIORITAIRE) ─────────────────────────────────
    supadata_key = get_supadata_key()
    if supadata_key:
        try:
            yt_url = f"https://www.youtube.com/watch?v={video_id}"
            async with shared_http_client() as client:
                resp = await client.get(
                    "https://api.supadata.ai/v1/metadata",
                    params={"url": yt_url},
                    headers={"x-api-key": supadata_key},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    duration = data.get("duration", 0) or 0
                    if duration > 0:
                        print(f"  ✅ [SUPADATA] Metadata OK - Duration: {duration}s", flush=True)
                        # 📊 Support both new unified format (author/stats objects)
                        # and legacy flat format (viewCount, likeCount, etc.)
                        author = data.get("author", {})
                        stats = data.get("stats", {})
                        # Channel: new format has author.displayName, legacy has channel/author string
                        raw_channel = data.get("channel", data.get("author", "Unknown"))
                        if isinstance(raw_channel, dict):
                            channel_name = (
                                raw_channel.get("displayName")
                                or raw_channel.get("name")
                                or raw_channel.get("username")
                                or "Unknown"
                            )
                        elif isinstance(author, dict) and author.get("displayName"):
                            channel_name = author.get("displayName") or author.get("username") or "Unknown"
                        else:
                            channel_name = str(raw_channel) if raw_channel else "Unknown"
                        _supa_result = {
                            "video_id": video_id,
                            "title": data.get("title", "Unknown"),
                            "channel": channel_name,
                            "thumbnail_url": data.get(
                                "thumbnail", f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                            ),
                            "duration": duration,
                            "upload_date": data.get("uploadDate") or data.get("createdAt"),
                            "description": (data.get("description", "") or "")[:2000],
                            "tags": data.get("tags", []),
                            "categories": data.get("categories", []),
                            # Engagement: new stats object OR legacy flat fields
                            "view_count": stats.get("views") or data.get("viewCount"),
                            "like_count": stats.get("likes") or data.get("likeCount"),
                            "comment_count": stats.get("comments") or data.get("commentCount"),
                            "channel_id": (author.get("id") if isinstance(author, dict) else None)
                            or data.get("channelId"),
                            "channel_follower_count": data.get("channelFollowerCount"),
                            "content_type": "video",
                        }
                        # Cache set (TTL 12h)
                        try:
                            from core.cache import cache_service as _cs

                            await _cs.set(_vinfo_cache_key, _supa_result, ttl=43200)
                        except Exception:
                            pass
                        return _supa_result
                    else:
                        print("  ⚠️ [SUPADATA] Metadata OK but no duration", flush=True)
                else:
                    print(f"  ⚠️ [SUPADATA] Metadata error {resp.status_code}", flush=True)
        except Exception as e:
            print(f"  ⚠️ [SUPADATA] Metadata exception: {str(e)[:100]}", flush=True)

    # ─── Invidious (fallback) ─────────────────────────────────────────────
    # Essayer plusieurs instances Invidious
    for instance in INVIDIOUS_INSTANCES[:5]:  # Essayer 5 instances
        try:
            async with shared_http_client() as client:
                response = await client.get(
                    f"{instance}/api/v1/videos/{video_id}", timeout=10, headers={"User-Agent": get_random_user_agent()}
                )
                if response.status_code == 200:
                    data = response.json()
                    duration = data.get("lengthSeconds", 0)
                    if isinstance(duration, str):
                        duration = int(duration) if duration.isdigit() else 0
                    print(f"  ✅ [INVIDIOUS] {instance} - Duration: {duration}s", flush=True)
                    if duration > 0:  # Seulement si on a une durée valide
                        _inv_result = {
                            "video_id": video_id,
                            "title": data.get("title", "Unknown"),
                            "channel": data.get("author", "Unknown"),
                            "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                            "duration": duration,
                            "upload_date": None,
                            "description": data.get("description", "")[:2000],
                            "tags": data.get("keywords", []),
                            "categories": [data.get("genre", "")] if data.get("genre") else [],
                            "view_count": data.get("viewCount"),
                            "like_count": data.get("likeCount"),
                        }
                        # Cache set (TTL 12h)
                        try:
                            from core.cache import cache_service as _cs

                            await _cs.set(_vinfo_cache_key, _inv_result, ttl=43200)
                        except Exception:
                            pass
                        return _inv_result
        except Exception as e:
            print(f"  ⚠️ [INVIDIOUS] {instance} error: {str(e)[:50]}", flush=True)

    # Essayer yt-dlp (plus lent mais plus fiable)
    print("  🔄 [YT-DLP] Trying yt-dlp fallback...", flush=True)
    ytdlp_result = await get_video_info_ytdlp(video_id)
    if ytdlp_result and ytdlp_result.get("duration", 0) > 0:
        print(f"  ✅ [YT-DLP] Duration: {ytdlp_result['duration']}s", flush=True)
        # Cache set (TTL 12h)
        try:
            from core.cache import cache_service as _cs

            await _cs.set(_vinfo_cache_key, ytdlp_result, ttl=43200)
        except Exception:
            pass
        return ytdlp_result

    # Essayer oembed pour au moins avoir le titre (pas de durée)
    # 🔌 Sprint B (Audit) — l'oEmbed YouTube tape `www.youtube.com` directement,
    # qui est bloqué depuis Hetzner. On route via le proxy résidentiel Decodo
    # (settings.YOUTUBE_PROXY). Si non configuré, le client retombe sur bare.
    print("  🔄 [OEMBED] Trying oembed fallback...", flush=True)
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        async with get_proxied_client(timeout=10.0) as client:
            response = await client.get(url, headers={"User-Agent": get_random_user_agent()})
            if response.status_code == 200:
                data = response.json()
                print("  ⚠️ [OEMBED] Got title but no duration", flush=True)
                return {
                    "video_id": video_id,
                    "title": data.get("title", "Unknown"),
                    "channel": data.get("author_name", "Unknown"),
                    "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                    "duration": 0,  # oembed ne fournit pas la durée
                    "upload_date": None,
                    "description": "",
                    "tags": [],
                    "categories": [],
                }
    except Exception as e:
        print(f"  ⚠️ [OEMBED] error: {e}", flush=True)

    # Dernier recours
    print(f"  ❌ [VIDEO INFO] All methods failed for {video_id}", flush=True)
    return {
        "video_id": video_id,
        "title": "Unknown Video",
        "channel": "Unknown Channel",
        "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
        "duration": 0,
        "upload_date": None,
        "description": "",
        "tags": [],
        "categories": [],
    }


async def get_video_info_ytdlp(video_id: str) -> Optional[Dict[str, Any]]:
    """
    Récupère les infos vidéo via yt-dlp avec TOUTES les métadonnées importantes.
    🆕 v4.1: Extraction de tags, catégorie YouTube, description complète
    """
    try:
        loop = asyncio.get_event_loop()

        def _get_info():
            cmd = [
                "yt-dlp",
                "--dump-json",
                "--no-warnings",
                "--skip-download",
                "--user-agent",
                get_random_user_agent(),
                "--extractor-args",
                "youtube:player_client=android",
                f"https://youtube.com/watch?v={video_id}",
            ]
            proxy = get_youtube_proxy()
            if proxy:
                cmd.insert(1, "--proxy")
                cmd.insert(2, proxy)
                print("  🔌 [YT-DLP-INFO] Using proxy", flush=True)
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                return json.loads(result.stdout)
            return None

        data = await loop.run_in_executor(executor, _get_info)
        if data:
            return {
                "video_id": video_id,
                "title": data.get("title", "Unknown"),
                "channel": data.get("channel", data.get("uploader", "Unknown")),
                "thumbnail_url": data.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"),
                "duration": data.get("duration", 0),
                "upload_date": data.get("upload_date"),
                "view_count": data.get("view_count"),
                # 🆕 Métadonnées enrichies pour la détection de catégorie
                "description": data.get("description", "")[:2000],
                "tags": data.get("tags", []),
                "categories": data.get("categories", []),
                "like_count": data.get("like_count"),
                "comment_count": data.get("comment_count"),
                "channel_id": data.get("channel_id"),
                "channel_url": data.get("channel_url", data.get("uploader_url")),
                "channel_follower_count": data.get("channel_follower_count"),
                "language": data.get("language"),
                # 📊 Additional metadata
                "chapters": data.get("chapters", []),
                "content_type": "video",
            }
    except Exception as e:
        print(f"⚠️ yt-dlp info error: {e}", flush=True)

    return {
        "video_id": video_id,
        "title": "Unknown Video",
        "channel": "Unknown Channel",
        "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
        "duration": 0,
        "upload_date": None,
        "description": "",
        "tags": [],
        "categories": [],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def format_seconds_to_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def _parse_vtt_content(content: str) -> Tuple[Optional[str], Optional[str]]:
    if not content:
        return None, None

    lines = []
    timestamps = []
    current_time = 0

    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("WEBVTT") or line.startswith("Kind:") or line.startswith("Language:"):
            continue

        time_match = re.match(r"(\d{1,2}):(\d{2}):(\d{2})", line)
        if time_match:
            h, m, s = map(int, time_match.groups())
            current_time = h * 3600 + m * 60 + s
            continue

        time_match2 = re.match(r"(\d{1,2}):(\d{2})[\.,]", line)
        if time_match2:
            m, s = map(int, time_match2.groups())
            current_time = m * 60 + s
            continue

        if not line or line.isdigit() or "-->" in line:
            continue

        clean = re.sub(r"<[^>]+>", "", line)
        clean = re.sub(r"\[.*?\]", "", clean)
        clean = clean.strip()

        if clean and len(clean) > 1:
            lines.append(clean)
            timestamps.append(current_time)

    if not lines:
        return None, None

    simple = " ".join(lines)

    timestamped_parts = []
    last_ts = -30
    for i, text in enumerate(lines):
        t = timestamps[i] if i < len(timestamps) else 0
        if t - last_ts >= 30:
            ts = format_seconds_to_timestamp(t)
            timestamped_parts.append(f"\n[{ts}] {text}")
            last_ts = t
        else:
            timestamped_parts.append(f" {text}")

    timestamped = "".join(timestamped_parts).strip()
    return simple, timestamped


def _parse_subtitle_files(tmpdir: str, video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    for lang in ["fr", "en", "es", "de", "it", "pt"]:
        for ext in ["vtt", "srt"]:
            sub_file = Path(tmpdir) / f"{video_id}.{lang}.{ext}"
            if sub_file.exists():
                content = sub_file.read_text(encoding="utf-8", errors="ignore")
                simple, timestamped = _parse_vtt_content(content)
                if simple and len(simple) > 50:
                    return simple, timestamped, lang

    for f in Path(tmpdir).glob("*.vtt"):
        content = f.read_text(encoding="utf-8", errors="ignore")
        simple, timestamped = _parse_vtt_content(content)
        if simple and len(simple) > 50:
            lang = "fr"
            parts = f.stem.split(".")
            if len(parts) >= 2:
                lang = parts[-1]
            return simple, timestamped, lang

    for f in Path(tmpdir).glob("*.srt"):
        content = f.read_text(encoding="utf-8", errors="ignore")
        simple, timestamped = _parse_vtt_content(content)
        if simple and len(simple) > 50:
            lang = "fr"
            parts = f.stem.split(".")
            if len(parts) >= 2:
                lang = parts[-1]
            return simple, timestamped, lang

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🥇 MÉTHODE 1: SUPADATA
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_supadata(
    video_id: str, api_key: str = None
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    api_key = api_key or get_supadata_key()
    if not api_key:
        print("  ⏭️ [SUPADATA] Skipped: No API key", flush=True)
        return None, None, None

    print("  🥇 [SUPADATA] Trying...", flush=True)

    try:
        async with shared_http_client() as client:
            # ─── Méthode 1 : Endpoint YouTube-specific (segments + timestamps) ───
            for lang in ["fr", "en", "es", "de", "pt", "it", None]:
                params = {"videoId": video_id}
                if lang:
                    params["lang"] = lang

                try:
                    response = await client.get(
                        "https://api.supadata.ai/v1/youtube/transcript",
                        params=params,
                        headers={"x-api-key": api_key},
                        timeout=_t("supadata"),
                    )

                    if response.status_code == 200:
                        data = response.json()
                        segments = []
                        if isinstance(data, list):
                            segments = data
                        elif isinstance(data, dict):
                            segments = data.get("segments", data.get("transcript", []))
                            if isinstance(segments, str):
                                print(f"  ✅ [SUPADATA] YT-specific success: {len(segments)} chars", flush=True)
                                return segments, segments, lang or "fr"

                        if segments:
                            simple_parts = []
                            timestamped_parts = []
                            last_ts = -30

                            for seg in segments:
                                text = seg.get("text", "").strip()
                                start = seg.get("start", seg.get("offset", 0))
                                if not text:
                                    continue
                                simple_parts.append(text)
                                if start - last_ts >= 30:
                                    ts = format_seconds_to_timestamp(start)
                                    timestamped_parts.append(f"\n[{ts}] {text}")
                                    last_ts = start
                                else:
                                    timestamped_parts.append(f" {text}")

                            simple = " ".join(simple_parts)
                            timestamped = "".join(timestamped_parts).strip()

                            if simple:
                                print(f"  ✅ [SUPADATA] YT-specific success: {len(simple)} chars", flush=True)
                                return simple, timestamped, lang or "fr"

                    elif response.status_code == 404:
                        continue
                    else:
                        print(f"  ⚠️ [SUPADATA] YT-specific error {response.status_code}", flush=True)
                        break

                except httpx.TimeoutException:
                    print("  ⚠️ [SUPADATA] YT-specific timeout", flush=True)
                    break

            # ─── Méthode 2 : Endpoint unifié (fallback — supporte STT côté Supadata) ───
            print("  🔄 [SUPADATA] Trying unified endpoint (with AI fallback)...", flush=True)
            try:
                url = f"https://www.youtube.com/watch?v={video_id}"
                response = await client.get(
                    "https://api.supadata.ai/v1/transcript",
                    params={"url": url},
                    headers={"x-api-key": api_key},
                    timeout=60,
                )

                if response.status_code == 200:
                    data = response.json()
                    content = data.get("content", "")
                    detected_lang = data.get("lang", "fr")
                    # ⚡ v7.1: Supadata peut retourner une liste au lieu d'un string
                    if isinstance(content, list):
                        # Liste de segments [{text: "...", start: ...}, ...]
                        if content and isinstance(content[0], dict):
                            content = " ".join(seg.get("text", "") for seg in content if seg.get("text"))
                        elif content and isinstance(content[0], str):
                            content = " ".join(content)
                        else:
                            content = ""
                    if content and isinstance(content, str) and len(content.strip()) >= 20:
                        print(f"  ✅ [SUPADATA] Unified success: {len(content)} chars", flush=True)
                        return content.strip(), content.strip(), detected_lang

                elif response.status_code == 202:
                    # Async job — poll
                    job_id = response.json().get("jobId")
                    if job_id:
                        print(f"  ⏳ [SUPADATA] Async job {job_id}, polling...", flush=True)
                        for _ in range(12):  # 60s max
                            await asyncio.sleep(5)
                            poll = await client.get(
                                f"https://api.supadata.ai/v1/transcript/{job_id}",
                                headers={"x-api-key": api_key},
                            )
                            if poll.status_code == 200:
                                pd = poll.json()
                                content = pd.get("content", "")
                                detected_lang = pd.get("lang", "fr")
                                # ⚡ v7.1: Même protection list → string
                                if isinstance(content, list):
                                    if content and isinstance(content[0], dict):
                                        content = " ".join(seg.get("text", "") for seg in content if seg.get("text"))
                                    elif content and isinstance(content[0], str):
                                        content = " ".join(content)
                                    else:
                                        content = ""
                                if content and isinstance(content, str) and len(content.strip()) >= 20:
                                    print(f"  ✅ [SUPADATA] Async success: {len(content)} chars", flush=True)
                                    return content.strip(), content.strip(), detected_lang
                            elif poll.status_code == 202:
                                continue
                            else:
                                break
                else:
                    print(f"  ⚠️ [SUPADATA] Unified error {response.status_code}", flush=True)

            except httpx.TimeoutException:
                print("  ⚠️ [SUPADATA] Unified timeout", flush=True)

    except Exception as e:
        print(f"  ⚠️ [SUPADATA] Exception: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🥈 MÉTHODE 2: YOUTUBE-TRANSCRIPT-API
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_ytapi(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    if not YTAPI_AVAILABLE:
        print("  ⏭️ [YTAPI] Skipped: Not installed", flush=True)
        return None, None, None

    print("  🥈 [YTAPI] Trying...", flush=True)

    try:
        loop = asyncio.get_event_loop()

        def _fetch():
            try:
                # 🔌 Proxy support pour youtube-transcript-api
                proxy = get_youtube_proxy()
                if proxy:
                    import requests as _requests

                    proxies = {"https": proxy, "http": proxy}
                    session = _requests.Session()
                    session.proxies.update(proxies)
                    ytt_api = YouTubeTranscriptApi(http_client=session)
                    print("  🔌 [YTAPI] Using proxy", flush=True)
                else:
                    ytt_api = YouTubeTranscriptApi()
                transcript_list = ytt_api.list(video_id)
                preferred_langs = ["fr", "en", "es", "de", "it", "pt", "nl", "ru", "ja", "ko", "zh", "ar"]

                for is_manual in [True, False]:
                    for lang in preferred_langs:
                        try:
                            if is_manual:
                                transcript = transcript_list.find_manually_created_transcript([lang])
                            else:
                                transcript = transcript_list.find_generated_transcript([lang])

                            fetched = transcript.fetch()

                            if hasattr(fetched, "to_raw_data"):
                                data = fetched.to_raw_data()
                            elif hasattr(fetched, "__iter__"):
                                data = list(fetched)
                            else:
                                continue

                            if data:
                                simple_parts = []
                                timestamped_parts = []
                                last_ts = -30

                                for entry in data:
                                    text = entry.get("text", "").strip()
                                    start = entry.get("start", 0)
                                    if not text or text in ["[Music]", "[Applause]", "[Musique]"]:
                                        continue
                                    simple_parts.append(text)
                                    if start - last_ts >= 30:
                                        ts = format_seconds_to_timestamp(start)
                                        timestamped_parts.append(f"\n[{ts}] {text}")
                                        last_ts = start
                                    else:
                                        timestamped_parts.append(f" {text}")

                                simple = " ".join(simple_parts)
                                timestamped = "".join(timestamped_parts).strip()

                                if simple and len(simple) > 50:
                                    return simple, timestamped, lang
                        except Exception:
                            continue
            except Exception as e:
                print(f"  ⚠️ [YTAPI] Error: {e}", flush=True)
            return None, None, None

        simple, timestamped, lang = await asyncio.wait_for(loop.run_in_executor(executor, _fetch), timeout=_t("ytapi"))

        if simple:
            print(f"  ✅ [YTAPI] Success: {len(simple)} chars", flush=True)
            return simple, timestamped, lang
        else:
            print("  ⚠️ [YTAPI] No captions found", flush=True)

    except asyncio.TimeoutError:
        print("  ⚠️ [YTAPI] Timeout", flush=True)
    except Exception as e:
        print(f"  ⚠️ [YTAPI] Exception: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🥉 MÉTHODE 3: INVIDIOUS API (CONTOURNE LE BLOCAGE YOUTUBE)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_invidious(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🌐 Utilise Invidious pour récupérer les sous-titres
    Contourne le blocage YouTube car Invidious a ses propres IPs
    """
    print("  🌐 [INVIDIOUS] Trying captions...", flush=True)

    for instance in INVIDIOUS_INSTANCES[:5]:  # Essayer 5 instances max (augmenté de 3)
        try:
            async with shared_http_client() as client:
                # Récupérer la liste des captions
                response = await client.get(
                    f"{instance}/api/v1/captions/{video_id}",
                    timeout=_t("invidious"),
                    headers={"User-Agent": get_random_user_agent()},
                )

                if response.status_code != 200:
                    continue

                data = response.json()
                captions = data.get("captions", [])

                if not captions:
                    continue

                # Trouver les captions préférées (plus de langues)
                caption_url = None
                caption_lang = "fr"

                for lang in ["fr", "en", "es", "de", "pt", "it", "nl", "ru", "ja", "ko"]:
                    for cap in captions:
                        if cap.get("language_code", "").startswith(lang):
                            caption_url = cap.get("url")
                            caption_lang = lang
                            break
                    if caption_url:
                        break

                if not caption_url:
                    # Prendre le premier disponible
                    caption_url = captions[0].get("url")
                    caption_lang = captions[0].get("language_code", "fr")[:2]

                if not caption_url:
                    continue

                # Télécharger les sous-titres
                if caption_url.startswith("/"):
                    caption_url = f"{instance}{caption_url}"

                caption_response = await client.get(
                    caption_url, timeout=_t("invidious"), headers={"User-Agent": get_random_user_agent()}
                )

                if caption_response.status_code == 200:
                    content = caption_response.text
                    simple, timestamped = _parse_vtt_content(content)

                    if simple and len(simple) > 50:
                        print(f"  ✅ [INVIDIOUS] Success: {len(simple)} chars from {instance}", flush=True)
                        return simple, timestamped, caption_lang

        except Exception as e:
            print(f"  ⚠️ [INVIDIOUS] {instance} error: {str(e)[:50]}", flush=True)
            continue

    print("  ⚠️ [INVIDIOUS] No captions from any instance", flush=True)
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🥉 MÉTHODE 4: PIPED API (ALTERNATIVE À INVIDIOUS)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_piped(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🌐 Utilise Piped pour récupérer les sous-titres
    Alternative à Invidious - différentes IPs, mêmes fonctionnalités
    """
    print("  🟣 [PIPED] Trying captions...", flush=True)

    # Utiliser les instances saines en priorité
    healthy_instances = get_healthy_instances(PIPED_INSTANCES)

    for instance in healthy_instances[:5]:  # Essayer 5 instances max
        try:
            async with shared_http_client() as client:
                # API Piped pour les streams (inclut les sous-titres)
                response = await client.get(
                    f"{instance}/streams/{video_id}",
                    timeout=_t("piped"),
                    headers={"User-Agent": get_random_user_agent()},
                )

                if response.status_code != 200:
                    record_instance_failure(instance)
                    continue

                data = response.json()
                subtitles = data.get("subtitles", [])

                if not subtitles:
                    continue

                # Trouver les sous-titres préférés
                caption_url = None
                caption_lang = "fr"

                for lang in ["fr", "en", "es", "de", "pt", "it", "nl", "ru", "ja", "ko"]:
                    for sub in subtitles:
                        sub_lang = sub.get("code", "").lower()
                        if sub_lang.startswith(lang):
                            caption_url = sub.get("url")
                            caption_lang = lang
                            break
                    if caption_url:
                        break

                if not caption_url and subtitles:
                    # Prendre le premier disponible
                    caption_url = subtitles[0].get("url")
                    caption_lang = subtitles[0].get("code", "fr")[:2]

                if not caption_url:
                    continue

                # Télécharger les sous-titres
                caption_response = await client.get(
                    caption_url,
                    timeout=_t("piped"),
                    headers={"User-Agent": get_random_user_agent()},
                    follow_redirects=True,
                )

                if caption_response.status_code == 200:
                    content = caption_response.text
                    simple, timestamped = _parse_vtt_content(content)

                    if simple and len(simple) > 50:
                        record_instance_success(instance)
                        print(f"  ✅ [PIPED] Success: {len(simple)} chars from {instance}", flush=True)
                        return simple, timestamped, caption_lang

        except Exception as e:
            record_instance_failure(instance)
            print(f"  ⚠️ [PIPED] {instance} error: {str(e)[:50]}", flush=True)
            continue

    print("  ⚠️ [PIPED] No captions from any instance", flush=True)
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🏅 MÉTHODE 5: YT-DLP SUBTITLES MANUELS (AVEC OPTIONS ANTI-BOT)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_ytdlp(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    print("  🏅 [YT-DLP] Trying manual subtitles...", flush=True)

    try:
        loop = asyncio.get_event_loop()

        def _fetch():
            with tempfile.TemporaryDirectory() as tmpdir:
                cmd = [
                    "yt-dlp",
                    "--write-subs",
                    "--sub-langs",
                    "fr,en,es,de,it,pt,nl,ru,ja,ko,zh,ar",
                    "--sub-format",
                    "vtt/srt/best",
                    "--skip-download",
                    "--no-warnings",
                    "--user-agent",
                    get_random_user_agent(),
                    "--extractor-args",
                    "youtube:player_client=android,web,mweb",
                    "--sleep-requests",
                    "1.5",
                    "--sleep-interval",
                    "1",
                    "--max-sleep-interval",
                    "3",
                    "--retries",
                    "3",
                    "--fragment-retries",
                    "3",
                    "-o",
                    f"{tmpdir}/%(id)s.%(ext)s",
                    f"https://youtube.com/watch?v={video_id}",
                ]
                # 🔌 Proxy support — contourne le blocage IP YouTube
                proxy = get_youtube_proxy()
                if proxy:
                    cmd.insert(1, "--proxy")
                    cmd.insert(2, proxy)
                    print("  🔌 [YT-DLP] Using proxy", flush=True)
                subprocess.run(cmd, capture_output=True, text=True, timeout=_t("ytdlp_subs"))
                return _parse_subtitle_files(tmpdir, video_id)

        simple, timestamped, lang = await asyncio.wait_for(
            loop.run_in_executor(executor, _fetch), timeout=_t("ytdlp_subs") + 10
        )

        if simple:
            print(f"  ✅ [YT-DLP] Success: {len(simple)} chars", flush=True)
            return simple, timestamped, lang
        else:
            print("  ⚠️ [YT-DLP] No manual subtitles", flush=True)

    except asyncio.TimeoutError:
        print("  ⚠️ [YT-DLP] Timeout", flush=True)
    except Exception as e:
        print(f"  ⚠️ [YT-DLP] Exception: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎖️ MÉTHODE 5: YT-DLP AUTO-CAPTIONS (AVEC OPTIONS ANTI-BOT)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_ytdlp_auto(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    print("  🎖️ [YT-DLP-AUTO] Trying auto-captions...", flush=True)

    try:
        loop = asyncio.get_event_loop()

        def _fetch():
            with tempfile.TemporaryDirectory() as tmpdir:
                cmd = [
                    "yt-dlp",
                    "--write-auto-subs",
                    "--sub-langs",
                    "fr,en,es,de,it,pt,nl,ru,ja,ko,zh,ar",
                    "--sub-format",
                    "vtt/srt/best",
                    "--skip-download",
                    "--no-warnings",
                    "--user-agent",
                    get_random_user_agent(),
                    "--extractor-args",
                    "youtube:player_client=android,web,mweb",
                    "--sleep-requests",
                    "1.5",
                    "--sleep-interval",
                    "1",
                    "--max-sleep-interval",
                    "3",
                    "--retries",
                    "3",
                    "--fragment-retries",
                    "3",
                    "-o",
                    f"{tmpdir}/%(id)s.%(ext)s",
                    f"https://youtube.com/watch?v={video_id}",
                ]
                # 🔌 Proxy support
                proxy = get_youtube_proxy()
                if proxy:
                    cmd.insert(1, "--proxy")
                    cmd.insert(2, proxy)
                subprocess.run(cmd, capture_output=True, text=True, timeout=_t("ytdlp_auto"))
                return _parse_subtitle_files(tmpdir, video_id)

        simple, timestamped, lang = await asyncio.wait_for(
            loop.run_in_executor(executor, _fetch), timeout=_t("ytdlp_auto") + 10
        )

        if simple:
            print(f"  ✅ [YT-DLP-AUTO] Success: {len(simple)} chars", flush=True)
            return simple, timestamped, lang
        else:
            print("  ⚠️ [YT-DLP-AUTO] No auto-captions", flush=True)

    except asyncio.TimeoutError:
        print("  ⚠️ [YT-DLP-AUTO] Timeout", flush=True)
    except Exception as e:
        print(f"  ⚠️ [YT-DLP-AUTO] Exception: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ MÉTHODE 6: GROQ WHISPER VIA INVIDIOUS (DERNIER RECOURS - FONCTIONNE TOUJOURS)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_whisper(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🎙️ Groq Whisper - Transcription audio (TOUJOURS fonctionne si clé configurée)
    Utilise Invidious pour télécharger l'audio si YouTube bloque
    """
    groq_key = get_groq_key()
    if not groq_key:
        print("  ❌ [WHISPER] GROQ_API_KEY not configured!", flush=True)
        return None, None, None

    print("  🎙️ [WHISPER] Downloading audio...", flush=True)

    audio_data = None
    audio_ext = ".mp3"

    # MÉTHODE A: Essayer via Invidious d'abord (contourne le blocage)
    for instance in INVIDIOUS_INSTANCES[:2]:
        try:
            async with shared_http_client() as client:
                # Récupérer les formats audio
                response = await client.get(
                    f"{instance}/api/v1/videos/{video_id}", timeout=60, headers={"User-Agent": get_random_user_agent()}
                )

                if response.status_code != 200:
                    continue

                data = response.json()

                # Trouver un format audio
                audio_url = None
                for fmt in data.get("adaptiveFormats", []):
                    if fmt.get("type", "").startswith("audio/"):
                        audio_url = fmt.get("url")
                        if "audio/mp4" in fmt.get("type", ""):
                            audio_ext = ".m4a"
                        elif "audio/webm" in fmt.get("type", ""):
                            audio_ext = ".webm"
                        break

                if not audio_url:
                    continue

                print("  🎙️ [WHISPER] Downloading from Invidious...", flush=True)

                audio_response = await client.get(
                    audio_url, timeout=120, headers={"User-Agent": get_random_user_agent()}, follow_redirects=True
                )

                if audio_response.status_code == 200 and len(audio_response.content) > 10000:
                    audio_data = audio_response.content
                    print(f"  ✅ [WHISPER] Audio from Invidious: {len(audio_data) / 1024 / 1024:.1f}MB", flush=True)
                    break

        except Exception as e:
            print(f"  ⚠️ [WHISPER] Invidious {instance}: {str(e)[:50]}", flush=True)
            continue

    # MÉTHODE B: Fallback sur yt-dlp si Invidious échoue
    if not audio_data:
        print("  🎙️ [WHISPER] Trying yt-dlp download...", flush=True)
        try:
            loop = asyncio.get_event_loop()

            def _download_audio():
                with tempfile.TemporaryDirectory() as tmpdir:
                    audio_path = f"{tmpdir}/{video_id}.mp3"

                    cmd = [
                        "yt-dlp",
                        "-x",
                        "--audio-format",
                        "mp3",
                        "--audio-quality",
                        "9",
                        "-o",
                        audio_path,
                        "--no-warnings",
                        "--no-playlist",
                        "--user-agent",
                        get_random_user_agent(),
                        "--extractor-args",
                        "youtube:player_client=android",
                        f"https://youtube.com/watch?v={video_id}",
                    ]
                    proxy = get_youtube_proxy()
                    if proxy:
                        cmd.insert(1, "--proxy")
                        cmd.insert(2, proxy)
                        print("  🔌 [WHISPER] Using proxy", flush=True)

                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=_t("whisper_download"))

                    if result.returncode != 0:
                        print(f"  ⚠️ [WHISPER] yt-dlp failed: {result.stderr[:100]}", flush=True)
                        return None, None

                    for f in Path(tmpdir).iterdir():
                        if f.suffix in [".mp3", ".m4a", ".webm", ".opus", ".wav"]:
                            return f.read_bytes(), f.suffix

                    return None, None

            result = await asyncio.wait_for(
                loop.run_in_executor(executor, _download_audio), timeout=_t("whisper_download")
            )

            if result and result[0]:
                audio_data, audio_ext = result
                print(f"  ✅ [WHISPER] Audio from yt-dlp: {len(audio_data) / 1024 / 1024:.1f}MB", flush=True)

        except Exception as e:
            print(f"  ⚠️ [WHISPER] yt-dlp download failed: {e}", flush=True)

    if not audio_data:
        print("  ❌ [WHISPER] Failed to download audio", flush=True)
        return None, None, None

    # Compresser si trop gros
    if len(audio_data) > GROQ_MAX_FILE_SIZE:
        print(f"  🎙️ [WHISPER] Compressing audio (>{GROQ_MAX_FILE_SIZE / 1024 / 1024:.0f}MB)...", flush=True)
        try:
            with tempfile.NamedTemporaryFile(suffix=audio_ext, delete=False) as tmp_in:
                tmp_in.write(audio_data)
                tmp_in_path = tmp_in.name

            tmp_out_path = tmp_in_path + "_compressed.mp3"

            cmd = ["ffmpeg", "-i", tmp_in_path, "-b:a", "32k", "-ac", "1", "-ar", "16000", "-y", tmp_out_path]
            subprocess.run(cmd, capture_output=True, timeout=120)

            if Path(tmp_out_path).exists():
                audio_data = Path(tmp_out_path).read_bytes()
                audio_ext = ".mp3"
                print(f"  ✅ [WHISPER] Compressed to: {len(audio_data) / 1024 / 1024:.1f}MB", flush=True)

            # Cleanup
            Path(tmp_in_path).unlink(missing_ok=True)
            Path(tmp_out_path).unlink(missing_ok=True)

        except Exception as e:
            print(f"  ⚠️ [WHISPER] Compression failed: {e}", flush=True)

    if len(audio_data) > GROQ_MAX_FILE_SIZE:
        print("  ❌ [WHISPER] Audio still too large", flush=True)
        return None, None, None

    # Transcrire avec Groq
    print(f"  🎙️ [WHISPER] Sending {len(audio_data) / 1024 / 1024:.1f}MB to Groq...", flush=True)

    try:
        mime_types = {
            ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4",
            ".webm": "audio/webm",
            ".opus": "audio/opus",
            ".wav": "audio/wav",
        }
        mime_type = mime_types.get(audio_ext, "audio/mpeg")

        async with shared_http_client() as client:
            files = {"file": (f"audio{audio_ext}", audio_data, mime_type)}
            data = {"model": "whisper-large-v3", "response_format": "verbose_json"}

            start_time = time.time()
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                files=files,
                data=data,
                timeout=_t("whisper_transcribe"),
            )
            elapsed = time.time() - start_time
            print(f"  🎙️ [WHISPER] Groq response in {elapsed:.1f}s: {response.status_code}", flush=True)

            if response.status_code == 200:
                result = response.json()
                full_text = result.get("text", "")
                segments = result.get("segments", [])
                detected_lang = result.get("language", "fr")

                if full_text:
                    if segments:
                        timestamped_parts = []
                        last_ts = -30
                        for seg in segments:
                            text = seg.get("text", "").strip()
                            start = seg.get("start", 0)
                            if not text:
                                continue
                            if start - last_ts >= 30:
                                ts = format_seconds_to_timestamp(start)
                                timestamped_parts.append(f"\n[{ts}] {text}")
                                last_ts = start
                            else:
                                timestamped_parts.append(f" {text}")
                        timestamped = "".join(timestamped_parts).strip()
                    else:
                        timestamped = full_text

                    print(f"  ✅ [WHISPER] Success: {len(full_text)} chars", flush=True)
                    return full_text, timestamped, detected_lang
            else:
                print(f"  ❌ [WHISPER] Groq error: {response.text[:200]}", flush=True)

    except Exception as e:
        print(f"  ❌ [WHISPER] Transcription error: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ MÉTHODE 6b: VOXTRAL STT (MISTRAL AI — PRIORITAIRE PHASE 3)
# v7.2 — Supporte jusqu'à 3h d'audio, multilingue 13 langues,
#         timestamps segment-level, même clé API que Mistral LLM.
# ═══════════════════════════════════════════════════════════════════════════════

VOXTRAL_STT_URL = "https://api.mistral.ai/v1/audio/transcriptions"
# v7.3 — Switch to transcribe-only model (faster + cheaper than chat-tuned voxtral-mini-latest)
# Official doc: https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02
VOXTRAL_STT_MODEL = "voxtral-mini-2602"
VOXTRAL_MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB (Mistral est très généreux)


async def get_transcript_voxtral(
    video_id: str,
    audio_data: bytes = None,
    audio_ext: str = ".mp3",
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🎙️ Voxtral STT (Mistral AI) — Transcription prioritaire Phase 3.

    Avantages vs Groq/OpenAI Whisper:
    - Jusqu'à 3h d'audio par requête
    - Pas de limite de taille à 25MB
    - Timestamps segment-level
    - Même clé API que Mistral (pas de coût supplémentaire avec Scale tier)
    - Multilingue 13 langues avec détection auto

    API: POST /v1/audio/transcriptions (multipart/form-data)
    Model: voxtral-mini-2602 (transcribe-only, fine-tuned for STT)
    """
    mistral_key = get_mistral_key()
    if not mistral_key:
        print("  ⏭️ [VOXTRAL-STT] Skipped: No Mistral API key", flush=True)
        return None, None, None

    print("  🎙️ [VOXTRAL-STT] Starting...", flush=True)

    # ── Télécharger l'audio si pas fourni ────────────────────────────────
    if not audio_data:
        audio_data, audio_ext = await _download_audio_for_transcription(video_id)
        if not audio_data:
            print("  ❌ [VOXTRAL-STT] Failed to download audio", flush=True)
            return None, None, None

    if len(audio_data) > VOXTRAL_MAX_FILE_SIZE:
        print(
            f"  ❌ [VOXTRAL-STT] Audio too large: {len(audio_data) / 1024 / 1024:.1f}MB > {VOXTRAL_MAX_FILE_SIZE / 1024 / 1024:.0f}MB",
            flush=True,
        )
        return None, None, None

    print(f"  🎙️ [VOXTRAL-STT] Sending {len(audio_data) / 1024 / 1024:.1f}MB to Mistral Voxtral...", flush=True)

    try:
        mime_type = AUDIO_MIME_TYPES.get(audio_ext, "audio/mpeg")

        async with shared_http_client() as client:
            # Multipart form-data: file + model + timestamp_granularities
            files = {
                "file": (f"audio{audio_ext}", audio_data, mime_type),
            }
            data = {
                "model": VOXTRAL_STT_MODEL,
                "timestamp_granularities": "segment",
            }

            start_time = time.time()
            response = await client.post(
                VOXTRAL_STT_URL,
                headers={"Authorization": f"Bearer {mistral_key}"},
                files=files,
                data=data,
                timeout=_t("voxtral_stt"),
            )
            elapsed = time.time() - start_time
            print(f"  🎙️ [VOXTRAL-STT] Response in {elapsed:.1f}s: {response.status_code}", flush=True)

            if response.status_code == 200:
                result = response.json()

                # Voxtral returns { "text": "...", "segments": [...] }
                full_text = result.get("text", "")

                if not full_text:
                    print("  ❌ [VOXTRAL-STT] Empty transcription returned", flush=True)
                    return None, None, None

                # ── Build timestamped text from segments ─────────────────
                segments = result.get("segments", [])
                detected_lang = result.get("language", "fr")

                if segments:
                    timestamped_parts = []
                    last_ts = -30
                    for seg in segments:
                        text = seg.get("text", "").strip()
                        start = seg.get("start", 0)
                        if not text:
                            continue
                        if start - last_ts >= 30:
                            ts = format_seconds_to_timestamp(start)
                            timestamped_parts.append(f"\n[{ts}] {text}")
                            last_ts = start
                        else:
                            timestamped_parts.append(f" {text}")
                    timestamped = "".join(timestamped_parts).strip()
                else:
                    timestamped = full_text

                print(
                    f"  ✅ [VOXTRAL-STT] Success: {len(full_text)} chars, lang={detected_lang}, {elapsed:.1f}s",
                    flush=True,
                )
                return full_text, timestamped, detected_lang

            else:
                error_body = response.text[:200]
                print(f"  ❌ [VOXTRAL-STT] Error {response.status_code}: {error_body}", flush=True)

    except httpx.TimeoutException:
        print(f"  ❌ [VOXTRAL-STT] Timeout ({_t('voxtral_stt')}s)", flush=True)
    except Exception as e:
        print(f"  ❌ [VOXTRAL-STT] Transcription error: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ MÉTHODE 7: DEEPGRAM NOVA-2 (ALTERNATIVE À WHISPER - ULTRA-RAPIDE)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_deepgram(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🎙️ Deepgram Nova-2 - Transcription audio ultra-rapide
    Alternative à Whisper si Groq échoue ou n'est pas configuré
    """
    deepgram_key = get_deepgram_key()
    if not deepgram_key:
        print("  ⏭️ [DEEPGRAM] Skipped: No API key", flush=True)
        return None, None, None

    print("  🎙️ [DEEPGRAM] Starting...", flush=True)

    audio_data = None
    audio_ext = ".mp3"

    # Télécharger l'audio via Invidious (même logique que Whisper)
    for instance in INVIDIOUS_INSTANCES[:3]:
        try:
            async with shared_http_client() as client:
                response = await client.get(
                    f"{instance}/api/v1/videos/{video_id}", timeout=60, headers={"User-Agent": get_random_user_agent()}
                )

                if response.status_code != 200:
                    continue

                data = response.json()

                audio_url = None
                for fmt in data.get("adaptiveFormats", []):
                    if fmt.get("type", "").startswith("audio/"):
                        audio_url = fmt.get("url")
                        if "audio/mp4" in fmt.get("type", ""):
                            audio_ext = ".m4a"
                        elif "audio/webm" in fmt.get("type", ""):
                            audio_ext = ".webm"
                        break

                if not audio_url:
                    continue

                print("  🎙️ [DEEPGRAM] Downloading audio from Invidious...", flush=True)

                audio_response = await client.get(
                    audio_url, timeout=120, headers={"User-Agent": get_random_user_agent()}, follow_redirects=True
                )

                if audio_response.status_code == 200 and len(audio_response.content) > 10000:
                    audio_data = audio_response.content
                    print(f"  ✅ [DEEPGRAM] Audio downloaded: {len(audio_data) / 1024 / 1024:.1f}MB", flush=True)
                    break

        except Exception as e:
            print(f"  ⚠️ [DEEPGRAM] Invidious {instance}: {str(e)[:50]}", flush=True)
            continue

    # Fallback yt-dlp si Invidious échoue
    if not audio_data:
        print("  🎙️ [DEEPGRAM] Trying yt-dlp download...", flush=True)
        try:
            loop = asyncio.get_event_loop()

            def _download_audio():
                with tempfile.TemporaryDirectory() as tmpdir:
                    audio_path = f"{tmpdir}/{video_id}.mp3"

                    cmd = [
                        "yt-dlp",
                        "-x",
                        "--audio-format",
                        "mp3",
                        "--audio-quality",
                        "9",
                        "-o",
                        audio_path,
                        "--no-warnings",
                        "--no-playlist",
                        "--user-agent",
                        get_random_user_agent(),
                        "--extractor-args",
                        "youtube:player_client=android,web,mweb",
                        "--retries",
                        "3",
                        f"https://youtube.com/watch?v={video_id}",
                    ]
                    proxy = get_youtube_proxy()
                    if proxy:
                        cmd.insert(1, "--proxy")
                        cmd.insert(2, proxy)
                        print("  🔌 [DEEPGRAM] Using proxy", flush=True)

                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=_t("whisper_download"))

                    if result.returncode != 0:
                        return None, None

                    for f in Path(tmpdir).iterdir():
                        if f.suffix in [".mp3", ".m4a", ".webm", ".opus", ".wav"]:
                            return f.read_bytes(), f.suffix

                    return None, None

            result = await asyncio.wait_for(
                loop.run_in_executor(executor, _download_audio), timeout=_t("whisper_download")
            )

            if result and result[0]:
                audio_data, audio_ext = result
                print(f"  ✅ [DEEPGRAM] Audio from yt-dlp: {len(audio_data) / 1024 / 1024:.1f}MB", flush=True)

        except Exception as e:
            print(f"  ⚠️ [DEEPGRAM] yt-dlp download failed: {e}", flush=True)

    if not audio_data:
        print("  ❌ [DEEPGRAM] Failed to download audio", flush=True)
        return None, None, None

    # Envoyer à Deepgram
    print(f"  🎙️ [DEEPGRAM] Sending {len(audio_data) / 1024 / 1024:.1f}MB to Deepgram Nova-2...", flush=True)

    try:
        mime_types = {
            ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4",
            ".webm": "audio/webm",
            ".opus": "audio/opus",
            ".wav": "audio/wav",
        }
        mime_type = mime_types.get(audio_ext, "audio/mpeg")

        async with shared_http_client() as client:
            start_time = time.time()
            response = await client.post(
                "https://api.deepgram.com/v1/listen",
                params={
                    "model": "nova-2",
                    "detect_language": "true",
                    "punctuate": "true",
                    "paragraphs": "true",
                    "smart_format": "true",
                },
                headers={
                    "Authorization": f"Token {deepgram_key}",
                    "Content-Type": mime_type,
                },
                content=audio_data,
                timeout=_t("deepgram"),
            )
            elapsed = time.time() - start_time
            print(f"  🎙️ [DEEPGRAM] Response in {elapsed:.1f}s: {response.status_code}", flush=True)

            if response.status_code == 200:
                result = response.json()

                # Extraire le transcript
                channels = result.get("results", {}).get("channels", [])
                if channels:
                    alternatives = channels[0].get("alternatives", [])
                    if alternatives:
                        transcript = alternatives[0].get("transcript", "")
                        paragraphs = alternatives[0].get("paragraphs", {}).get("paragraphs", [])

                        # Détecter la langue
                        detected_lang = (
                            result.get("results", {}).get("channels", [{}])[0].get("detected_language", "fr")
                        )
                        if not detected_lang:
                            detected_lang = "fr"

                        if transcript:
                            # Créer version avec timestamps si paragraphes disponibles
                            if paragraphs:
                                timestamped_parts = []
                                for para in paragraphs:
                                    start = para.get("start", 0)
                                    text = " ".join([s.get("text", "") for s in para.get("sentences", [])])
                                    if text:
                                        ts = format_seconds_to_timestamp(start)
                                        timestamped_parts.append(f"\n[{ts}] {text}")
                                timestamped = "".join(timestamped_parts).strip()
                            else:
                                timestamped = transcript

                            print(f"  ✅ [DEEPGRAM] Success: {len(transcript)} chars", flush=True)
                            return transcript, timestamped, detected_lang
            else:
                print(f"  ❌ [DEEPGRAM] Error {response.status_code}: {response.text[:200]}", flush=True)

    except Exception as e:
        print(f"  ❌ [DEEPGRAM] Transcription error: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ MÉTHODE 8: OPENAI WHISPER (FALLBACK SI GROQ ÉCHOUE)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_openai_whisper(
    video_id: str, audio_data: bytes = None, audio_ext: str = ".mp3"
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🎙️ OpenAI Whisper - Fallback si Groq échoue
    Utilise l'audio pré-téléchargé si fourni, sinon télécharge
    """
    openai_key = get_openai_key()
    if not openai_key:
        print("  ⏭️ [OPENAI-WHISPER] Skipped: No API key", flush=True)
        return None, None, None

    print("  🎙️ [OPENAI-WHISPER] Starting...", flush=True)

    # Si pas d'audio fourni, télécharger
    if not audio_data:
        audio_data, audio_ext = await _download_audio_for_transcription(video_id)
        if not audio_data:
            print("  ❌ [OPENAI-WHISPER] Failed to download audio", flush=True)
            return None, None, None

    # Compresser si nécessaire
    if len(audio_data) > OPENAI_MAX_FILE_SIZE:
        audio_data, audio_ext = await _compress_audio(audio_data, audio_ext, "OPENAI-WHISPER")
        if not audio_data or len(audio_data) > OPENAI_MAX_FILE_SIZE:
            print("  ❌ [OPENAI-WHISPER] Audio still too large after compression", flush=True)
            return None, None, None

    # Transcrire avec OpenAI
    print(f"  🎙️ [OPENAI-WHISPER] Sending {len(audio_data) / 1024 / 1024:.1f}MB to OpenAI...", flush=True)

    try:
        mime_types = {
            ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4",
            ".webm": "audio/webm",
            ".opus": "audio/opus",
            ".wav": "audio/wav",
        }
        mime_type = mime_types.get(audio_ext, "audio/mpeg")

        async with shared_http_client() as client:
            files = {"file": (f"audio{audio_ext}", audio_data, mime_type)}
            data = {"model": "whisper-1", "response_format": "verbose_json"}

            start_time = time.time()
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {openai_key}"},
                files=files,
                data=data,
                timeout=_t("openai_whisper"),
            )
            elapsed = time.time() - start_time
            print(f"  🎙️ [OPENAI-WHISPER] Response in {elapsed:.1f}s: {response.status_code}", flush=True)

            if response.status_code == 200:
                result = response.json()
                full_text = result.get("text", "")
                segments = result.get("segments", [])
                detected_lang = result.get("language", "fr")

                if full_text:
                    if segments:
                        timestamped_parts = []
                        last_ts = -30
                        for seg in segments:
                            text = seg.get("text", "").strip()
                            start = seg.get("start", 0)
                            if not text:
                                continue
                            if start - last_ts >= 30:
                                ts = format_seconds_to_timestamp(start)
                                timestamped_parts.append(f"\n[{ts}] {text}")
                                last_ts = start
                            else:
                                timestamped_parts.append(f" {text}")
                        timestamped = "".join(timestamped_parts).strip()
                    else:
                        timestamped = full_text

                    print(f"  ✅ [OPENAI-WHISPER] Success: {len(full_text)} chars", flush=True)
                    return full_text, timestamped, detected_lang
            else:
                print(f"  ❌ [OPENAI-WHISPER] Error: {response.text[:200]}", flush=True)

    except Exception as e:
        print(f"  ❌ [OPENAI-WHISPER] Transcription error: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ MÉTHODE 10: ASSEMBLYAI (PREMIUM, TRÈS FIABLE)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_assemblyai(
    video_id: str, audio_data: bytes = None, audio_ext: str = ".mp3"
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🎙️ AssemblyAI - Transcription premium très fiable
    Dernier recours si tous les autres services échouent
    """
    assemblyai_key = get_assemblyai_key()
    if not assemblyai_key:
        print("  ⏭️ [ASSEMBLYAI] Skipped: No API key", flush=True)
        return None, None, None

    print("  🎙️ [ASSEMBLYAI] Starting...", flush=True)

    # Si pas d'audio fourni, télécharger
    if not audio_data:
        audio_data, audio_ext = await _download_audio_for_transcription(video_id)
        if not audio_data:
            print("  ❌ [ASSEMBLYAI] Failed to download audio", flush=True)
            return None, None, None

    try:
        async with shared_http_client() as client:
            # Étape 1: Upload de l'audio
            print(f"  🎙️ [ASSEMBLYAI] Uploading {len(audio_data) / 1024 / 1024:.1f}MB...", flush=True)
            upload_response = await client.post(
                "https://api.assemblyai.com/v2/upload",
                headers={"Authorization": assemblyai_key},
                content=audio_data,
                timeout=120,
            )

            if upload_response.status_code != 200:
                print(f"  ❌ [ASSEMBLYAI] Upload failed: {upload_response.text[:100]}", flush=True)
                return None, None, None

            upload_url = upload_response.json().get("upload_url")
            if not upload_url:
                print("  ❌ [ASSEMBLYAI] No upload URL returned", flush=True)
                return None, None, None

            # Étape 2: Demander la transcription
            print("  🎙️ [ASSEMBLYAI] Starting transcription...", flush=True)
            transcript_request = await client.post(
                "https://api.assemblyai.com/v2/transcript",
                headers={"Authorization": assemblyai_key},
                json={
                    "audio_url": upload_url,
                    "language_detection": True,
                    "punctuate": True,
                    "format_text": True,
                },
            )

            if transcript_request.status_code != 200:
                print(f"  ❌ [ASSEMBLYAI] Transcript request failed: {transcript_request.text[:100]}", flush=True)
                return None, None, None

            transcript_id = transcript_request.json().get("id")
            if not transcript_id:
                print("  ❌ [ASSEMBLYAI] No transcript ID returned", flush=True)
                return None, None, None

            # Étape 3: Polling jusqu'à complétion
            print("  🎙️ [ASSEMBLYAI] Waiting for transcription...", flush=True)
            start_time = time.time()
            while time.time() - start_time < _t("assemblyai"):
                status_response = await client.get(
                    f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                    headers={"Authorization": assemblyai_key},
                )

                if status_response.status_code != 200:
                    await asyncio.sleep(3)
                    continue

                status_data = status_response.json()
                status = status_data.get("status")

                if status == "completed":
                    full_text = status_data.get("text", "")
                    words = status_data.get("words", [])
                    detected_lang = status_data.get("language_code", "fr")

                    if full_text:
                        # Créer version avec timestamps
                        if words:
                            timestamped_parts = []
                            last_ts = -30000  # millisecondes
                            current_segment = []
                            for word in words:
                                start_ms = word.get("start", 0)
                                text = word.get("text", "")
                                if start_ms - last_ts >= 30000:  # 30 secondes
                                    if current_segment:
                                        timestamped_parts.append(" ".join(current_segment))
                                    ts = format_seconds_to_timestamp(start_ms / 1000)
                                    timestamped_parts.append(f"\n[{ts}] {text}")
                                    current_segment = []
                                    last_ts = start_ms
                                else:
                                    current_segment.append(text)
                            if current_segment:
                                timestamped_parts.append(" " + " ".join(current_segment))
                            timestamped = "".join(timestamped_parts).strip()
                        else:
                            timestamped = full_text

                        elapsed = time.time() - start_time
                        print(f"  ✅ [ASSEMBLYAI] Success in {elapsed:.1f}s: {len(full_text)} chars", flush=True)
                        return full_text, timestamped, detected_lang

                elif status == "error":
                    error = status_data.get("error", "Unknown error")
                    print(f"  ❌ [ASSEMBLYAI] Transcription error: {error}", flush=True)
                    return None, None, None

                await asyncio.sleep(3)

            print("  ❌ [ASSEMBLYAI] Timeout waiting for transcription", flush=True)

    except Exception as e:
        print(f"  ❌ [ASSEMBLYAI] Error: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ MÉTHODE 11: ELEVENLABS SCRIBE v2
# ═══════════════════════════════════════════════════════════════════════════════


async def _elevenlabs_scribe_transcribe(
    video_id: str, audio_data: bytes = None, audio_ext: str = ".mp3", language: str = None
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🎙️ ElevenLabs Scribe v2 - Dernier fallback STT
    Utilise l'audio pré-téléchargé si fourni, sinon télécharge
    """
    elevenlabs_key = get_elevenlabs_key()
    if not elevenlabs_key:
        print("  ⏭️ [ELEVENLABS-SCRIBE] Skipped: No API key", flush=True)
        return None, None, None

    print("  🎙️ [ELEVENLABS-SCRIBE] Starting...", flush=True)

    # Si pas d'audio fourni, télécharger
    if not audio_data:
        audio_data, audio_ext = await _download_audio_for_transcription(video_id)
        if not audio_data:
            print("  ❌ [ELEVENLABS-SCRIBE] Failed to download audio", flush=True)
            return None, None, None

    print(f"  🎙️ [ELEVENLABS-SCRIBE] Sending {len(audio_data) / 1024 / 1024:.1f}MB to ElevenLabs...", flush=True)

    try:
        mime_types = {
            ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4",
            ".webm": "audio/webm",
            ".opus": "audio/opus",
            ".wav": "audio/wav",
        }
        mime_type = mime_types.get(audio_ext, "audio/mpeg")

        async with shared_http_client() as client:
            files = {"file": (f"audio{audio_ext}", audio_data, mime_type)}
            data = {"model": "scribe_v2"}
            if language:
                data["language_code"] = language

            start_time = time.time()
            response = await client.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                headers={"xi-api-key": elevenlabs_key},
                files=files,
                data=data,
                timeout=_t("elevenlabs_scribe"),
            )
            elapsed = time.time() - start_time
            print(f"  🎙️ [ELEVENLABS-SCRIBE] Response in {elapsed:.1f}s: {response.status_code}", flush=True)

            if response.status_code == 200:
                result = response.json()
                full_text = result.get("text", "")
                utterances = result.get("utterances", [])
                detected_lang = result.get("language_code", language or "fr")

                if full_text:
                    if utterances:
                        timestamped_parts = []
                        last_ts = -30
                        for utt in utterances:
                            text = utt.get("text", "").strip()
                            start = utt.get("start", 0)
                            if not text:
                                continue
                            # ElevenLabs returns start in seconds (float)
                            if start - last_ts >= 30:
                                ts = format_seconds_to_timestamp(start)
                                timestamped_parts.append(f"\n[{ts}] {text}")
                                last_ts = start
                            else:
                                timestamped_parts.append(f" {text}")
                        timestamped = "".join(timestamped_parts).strip()
                    else:
                        timestamped = full_text

                    print(f"  ✅ [ELEVENLABS-SCRIBE] Success: {len(full_text)} chars", flush=True)
                    return full_text, timestamped, detected_lang
            else:
                print(f"  ❌ [ELEVENLABS-SCRIBE] Error: {response.text[:200]}", flush=True)

    except Exception as e:
        print(f"  ❌ [ELEVENLABS-SCRIBE] Transcription error: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS AUDIO — Fonctions partagées pour le téléchargement/compression audio
# ═══════════════════════════════════════════════════════════════════════════════


async def _download_audio_for_transcription(video_id: str) -> Tuple[Optional[bytes], str]:
    """Télécharge l'audio d'une vidéo YouTube pour transcription"""
    audio_ext = ".mp3"

    # Essayer Invidious d'abord
    healthy_instances = get_healthy_instances(INVIDIOUS_INSTANCES)
    for instance in healthy_instances[:3]:
        try:
            async with shared_http_client() as client:
                response = await client.get(
                    f"{instance}/api/v1/videos/{video_id}", timeout=60, headers={"User-Agent": get_random_user_agent()}
                )

                if response.status_code != 200:
                    record_instance_failure(instance)
                    continue

                data = response.json()
                audio_url = None
                for fmt in data.get("adaptiveFormats", []):
                    if fmt.get("type", "").startswith("audio/"):
                        audio_url = fmt.get("url")
                        if "audio/mp4" in fmt.get("type", ""):
                            audio_ext = ".m4a"
                        elif "audio/webm" in fmt.get("type", ""):
                            audio_ext = ".webm"
                        break

                if not audio_url:
                    continue

                audio_response = await client.get(
                    audio_url, timeout=120, headers={"User-Agent": get_random_user_agent()}, follow_redirects=True
                )

                if audio_response.status_code == 200 and len(audio_response.content) > 10000:
                    record_instance_success(instance)
                    return audio_response.content, audio_ext

        except Exception:
            record_instance_failure(instance)
            continue

    # Fallback yt-dlp
    try:
        loop = asyncio.get_event_loop()

        def _download():
            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = f"{tmpdir}/{video_id}.mp3"
                cmd = [
                    "yt-dlp",
                    "-x",
                    "--audio-format",
                    "mp3",
                    "--audio-quality",
                    "9",
                    "-o",
                    audio_path,
                    "--no-warnings",
                    "--no-playlist",
                    "--user-agent",
                    get_random_user_agent(),
                    "--extractor-args",
                    "youtube:player_client=android,web,mweb",
                    "--retries",
                    "3",
                    f"https://youtube.com/watch?v={video_id}",
                ]
                # 🔌 Proxy support pour download audio
                proxy = get_youtube_proxy()
                if proxy:
                    cmd.insert(1, "--proxy")
                    cmd.insert(2, proxy)
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=_t("whisper_download"))
                if result.returncode != 0:
                    return None, ".mp3"
                for f in Path(tmpdir).iterdir():
                    if f.suffix in [".mp3", ".m4a", ".webm", ".opus", ".wav"]:
                        return f.read_bytes(), f.suffix
                return None, ".mp3"

        result = await asyncio.wait_for(loop.run_in_executor(executor, _download), timeout=_t("whisper_download"))
        return result

    except Exception:
        pass

    return None, ".mp3"


async def _compress_audio(audio_data: bytes, audio_ext: str, source_name: str = "AUDIO") -> Tuple[Optional[bytes], str]:
    """Compresse l'audio si trop gros"""
    print(f"  🎙️ [{source_name}] Compressing audio...", flush=True)
    try:
        with tempfile.NamedTemporaryFile(suffix=audio_ext, delete=False) as tmp_in:
            tmp_in.write(audio_data)
            tmp_in_path = tmp_in.name

        tmp_out_path = tmp_in_path + "_compressed.mp3"

        cmd = ["ffmpeg", "-i", tmp_in_path, "-b:a", "32k", "-ac", "1", "-ar", "16000", "-y", tmp_out_path]
        subprocess.run(cmd, capture_output=True, timeout=120)

        if Path(tmp_out_path).exists():
            compressed = Path(tmp_out_path).read_bytes()
            print(f"  ✅ [{source_name}] Compressed to: {len(compressed) / 1024 / 1024:.1f}MB", flush=True)
            Path(tmp_in_path).unlink(missing_ok=True)
            Path(tmp_out_path).unlink(missing_ok=True)
            return compressed, ".mp3"

        Path(tmp_in_path).unlink(missing_ok=True)
        Path(tmp_out_path).unlink(missing_ok=True)

    except Exception as e:
        print(f"  ⚠️ [{source_name}] Compression failed: {e}", flush=True)

    return audio_data, audio_ext


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION PRINCIPALE — 10 MÉTHODES EN 3 PHASES (PARALLÈLE + SÉQUENTIEL)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_transcript_with_timestamps(
    video_id: str,
    supadata_key: str = None,
    is_short: bool = False,
    duration: int = 0,
    user_plan: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🎯 FONCTION PRINCIPALE v7.1 - Supadata PRIORITAIRE + STT pour TOUTES vidéos
    Retourne: (transcript_simple, transcript_timestamped, lang)

    Architecture:
    ┌─ Phase 0: Supadata API EN PRIORITÉ (seul, rapide, payant) ───────────────────┐
    │  1. Supadata API (stable, payant) — TOUJOURS essayé en premier                │
    └────────────────────────────────────────────────────────────────────────────────┘
    ┌─ Phase 1: Texte EN PARALLÈLE (si Supadata échoue) ──────────────────────────────┐
    │  2. youtube-transcript-api (gratuit, rapide)                                   │
    │  3. Invidious API (10 instances, contourne blocage)                            │
    │  4. Piped API (8 instances, alternative Invidious)                             │
    └────────────────────────────────────────────────────────────────────────────────┘
    ┌─ Phase 2: yt-dlp (séquentiel, plus lent) ──────────────────────────────────────┐
    │  5. yt-dlp manual subtitles (avec anti-bot)                                    │
    │  6. yt-dlp auto-captions (avec anti-bot)                                       │
    └────────────────────────────────────────────────────────────────────────────────┘
    ┌─ Phase 3: Audio STT (dernier recours — toutes vidéos) ───────────────────────┐
    │  7. Groq Whisper (rapide, gratuit jusqu'à 25MB)                                │
    │  8. OpenAI Whisper (fallback si Groq échoue)                                   │
    │  9. Deepgram Nova-2 (ultra-rapide)                                             │
    │  10. AssemblyAI (premium, très fiable)                                         │
    └────────────────────────────────────────────────────────────────────────────────┘
    """
    # 🚦 Semaphore: limite les extractions concurrentes pour protéger les APIs
    async with _extraction_semaphore:
        return await _get_transcript_with_timestamps_inner(video_id, supadata_key, is_short, duration, user_plan)


async def _get_transcript_with_timestamps_inner(
    video_id: str,
    supadata_key: str = None,
    is_short: bool = False,
    duration: int = 0,
    user_plan: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Inner function — exécutée sous le semaphore de concurrence."""
    print("", flush=True)
    print(f"{'=' * 70}", flush=True)
    print(
        f"🔍 TRANSCRIPT EXTRACTION v7.1 for {video_id} (is_short={is_short}) [slots: {MAX_CONCURRENT_EXTRACTIONS - _extraction_semaphore._value}/{MAX_CONCURRENT_EXTRACTIONS}]",
        flush=True,
    )
    print(f"{'=' * 70}", flush=True)

    # ⚡ v7.1: Activer les timeouts adaptatifs pour vidéos courtes
    if is_short:
        _active_timeouts.set(TIMEOUTS_SHORT)
        print("⚡ [v7.1] Short video detected → using REDUCED timeouts (50% faster fallback)", flush=True)
    else:
        _active_timeouts.set(TIMEOUTS)

    # ═══════════════════════════════════════════════════════════════════════════════
    # CACHE CHECK: Unified L1 (Redis) + L2 (DB) lookup via TranscriptCacheService
    # ═══════════════════════════════════════════════════════════════════════════════
    if TRANSCRIPT_CACHE_AVAILABLE and transcript_cache is not None:
        try:
            payload = await transcript_cache.get(video_id, platform="youtube")
            if payload is not None and payload.get("simple"):
                print(f"💾 Transcript cache HIT for {video_id}", flush=True)
                print(f"{'=' * 70}", flush=True)
                return payload.get("simple"), payload.get("timestamped"), payload.get("lang")
            else:
                print(f"💾 Transcript cache MISS for {video_id}", flush=True)
        except Exception as e:
            print(f"⚠️ Transcript cache error (continuing): {e}", flush=True)

    # Helper pour cacher un résultat réussi (évite la duplication de code)
    async def _cache_success(vid: str, simple: str, timestamped: str, lang: str, method_name: str):
        if TRANSCRIPT_CACHE_AVAILABLE and transcript_cache is not None:
            try:
                await transcript_cache.set(
                    video_id=vid,
                    simple=simple,
                    timestamped=timestamped,
                    lang=lang,
                    platform="youtube",
                    extraction_method=method_name,
                    thumbnail_url=f"https://img.youtube.com/vi/{vid}/mqdefault.jpg",
                )
                print(f"💾 Transcript cached (L1+L2) for {vid}", flush=True)
            except Exception as e:
                print(f"⚠️ Transcript cache save error for {vid}: {e}", flush=True)

    # ═══════════════════════════════════════════════════════════════════════════════
    # PHASE 0: Supadata API EN PRIORITÉ (seul, le plus fiable)
    # ═══════════════════════════════════════════════════════════════════════════════
    print("", flush=True)
    print("🥇 PHASE 0: Supadata API (PRIORITY)", flush=True)
    print("─" * 50, flush=True)

    supadata_cb = get_circuit_breaker("supadata")
    if supadata_cb.can_execute():
        # ⚡ v7.3: 1 attempt only (was 2) — fallback Phase 1 plus rapide en cas de lenteur Supadata
        for attempt in range(1):
            try:
                if transcript_metrics:
                    await transcript_metrics.increment("supadata_calls")
                simple, timestamped, lang = await get_transcript_supadata(video_id, supadata_key)
                if simple and timestamped:
                    supadata_cb.record_success()
                    if transcript_metrics:
                        await transcript_metrics.increment("supadata_successes")
                    print("✅ SUCCESS with Supadata API (Phase 0 - Priority)", flush=True)
                    print(f"{'=' * 70}", flush=True)
                    await _cache_success(video_id, simple, timestamped, lang, "Supadata API")
                    return simple, timestamped, lang
            except Exception as e:
                print(f"  ⚠️ [Supadata] Attempt {attempt + 1} failed ({type(e).__name__}): {str(e)[:200]}", flush=True)
        supadata_cb.record_failure()
        print("  ❌ [Supadata] Failed — falling back to Phase 1", flush=True)
    else:
        print("  ⏭️ [Supadata] Skipped (circuit OPEN)", flush=True)

    # ═══════════════════════════════════════════════════════════════════════════════
    # PHASE 1: Méthodes texte EN PARALLÈLE (sans Supadata)
    # ═══════════════════════════════════════════════════════════════════════════════
    print("", flush=True)
    print("📋 PHASE 1: Text methods (PARALLEL — sans Supadata)", flush=True)
    print("─" * 50, flush=True)

    phase1_methods = [
        ("youtube-transcript-api", "ytapi", lambda: get_transcript_ytapi(video_id)),
        ("Invidious API", "invidious", lambda: get_transcript_invidious(video_id)),
        ("Piped API", "piped", lambda: get_transcript_piped(video_id)),
    ]

    # Filtrer les méthodes avec circuit breaker ouvert
    active_methods = []
    for name, cb_name, method in phase1_methods:
        cb = get_circuit_breaker(cb_name)
        if cb.can_execute():
            active_methods.append((name, cb_name, method))
        else:
            print(f"  ⏭️ [{name}] Skipped (circuit OPEN)", flush=True)

    if active_methods:
        # Exécuter en parallèle
        async def run_method_with_retry(name: str, cb_name: str, method):
            cb = get_circuit_breaker(cb_name)
            for attempt in range(2):
                try:
                    simple, timestamped, lang = await method()
                    if simple and timestamped:
                        cb.record_success()
                        return (name, simple, timestamped, lang)
                except Exception as e:
                    print(f"  ⚠️ [{name}] Attempt {attempt + 1} failed ({type(e).__name__}): {str(e)[:200]}", flush=True)
                if attempt == 0:
                    await asyncio.sleep(calculate_backoff(attempt))
            cb.record_failure()
            return None

        # ⚡ Phase 1 race-cancel: first valid result wins, cancel the rest
        tasks = [
            asyncio.create_task(run_method_with_retry(name, cb_name, method))
            for name, cb_name, method in active_methods
        ]
        phase1_timeout = max(
            TIMEOUTS.get("invidious", 35),
            TIMEOUTS.get("piped", 35),
            TIMEOUTS.get("ytapi", 25),
        )

        winning_result = None
        remaining = set(tasks)
        deadline_left = phase1_timeout

        # Boucle: attendre FIRST_COMPLETED, vérifier la validité, annuler si gagnant trouvé
        while remaining and winning_result is None and deadline_left > 0:
            start_wait = time.monotonic()
            done, pending = await asyncio.wait(
                remaining,
                return_when=asyncio.FIRST_COMPLETED,
                timeout=deadline_left,
            )
            deadline_left -= time.monotonic() - start_wait

            if not done:
                # Timeout global atteint sans nouveau résultat
                break

            for task in done:
                try:
                    result = task.result()
                except Exception:
                    continue
                if result and not isinstance(result, Exception):
                    name, simple, timestamped, lang = result
                    if simple and timestamped:
                        winning_result = (name, simple, timestamped, lang)
                        print(f"🏁 [Phase 1] Winner: {name} — cancelling {len(pending)} pending", flush=True)
                        break

            # Recalculer le set des tasks encore en cours
            remaining = pending

        # Annuler tout ce qui reste
        for p in remaining:
            p.cancel()

        if winning_result is not None:
            name, simple, timestamped, lang = winning_result
            print("", flush=True)
            print(f"✅ SUCCESS with {name} (Phase 1 - Race)", flush=True)
            print(f"{'=' * 70}", flush=True)
            await _cache_success(video_id, simple, timestamped, lang, name)
            return simple, timestamped, lang

    # ═══════════════════════════════════════════════════════════════════════════════
    # PHASE 1.5: VOXTRAL SHORT-CIRCUIT (Mistral-First Phase 1, Task 1.3)
    # No captions detected by Supadata/Phase 1 → skip directly to Voxtral STT
    # if duration fits the plan cap. Saves 5-30s vs trying yt-dlp first when
    # the video has no captions at all.
    # ═══════════════════════════════════════════════════════════════════════════════
    from core.config import get_max_stt_duration as _get_max_stt_duration

    _short_circuit_cap = _get_max_stt_duration(user_plan or "free")
    _voxtral_cb = get_circuit_breaker("voxtral_stt")
    if (
        duration > 0
        and duration <= _short_circuit_cap
        and _voxtral_cb.can_execute()
    ):
        print("", flush=True)
        print(
            f"🎙️ PHASE 1.5: No captions detected by Supadata, short-circuiting to Voxtral STT "
            f"(duration={duration}s ≤ cap={_short_circuit_cap}s, plan={user_plan or 'free'})",
            flush=True,
        )
        print("─" * 50, flush=True)
        try:
            sc_simple, sc_timestamped, sc_lang = await get_transcript_voxtral(video_id)
            if sc_simple and sc_timestamped:
                _voxtral_cb.record_success()
                print("✅ SUCCESS with Voxtral STT (Phase 1.5 short-circuit)", flush=True)
                print(f"{'=' * 70}", flush=True)
                await _cache_success(video_id, sc_simple, sc_timestamped, sc_lang, "Voxtral STT (short-circuit)")
                return sc_simple, sc_timestamped, sc_lang
            else:
                print("  ❌ [Voxtral short-circuit] Empty result, falling back to Phase 2", flush=True)
        except Exception as e:
            print(
                f"  ⚠️ [Voxtral short-circuit] Failed ({type(e).__name__}): {str(e)[:200]} — "
                f"falling back to Phase 2",
                flush=True,
            )
            # Don't record failure on circuit breaker — Phase 3 will retry the same provider
            # only if the short-circuit timed out / network failed. Real STT errors will
            # be recorded there. We want to give yt-dlp a chance before giving up on Voxtral.

    # ═══════════════════════════════════════════════════════════════════════════════
    # PHASE 2: yt-dlp (séquentiel, plus lent mais fiable)
    # ═══════════════════════════════════════════════════════════════════════════════
    print("", flush=True)
    print("📋 PHASE 2: yt-dlp methods (SEQUENTIAL)", flush=True)
    print("─" * 50, flush=True)

    phase2_methods = [
        ("yt-dlp manual", "ytdlp", lambda: get_transcript_ytdlp(video_id)),
        ("yt-dlp auto", "ytdlp_auto", lambda: get_transcript_ytdlp_auto(video_id)),
    ]

    for name, cb_name, method in phase2_methods:
        cb = get_circuit_breaker(cb_name)
        if not cb.can_execute():
            print(f"  ⏭️ [{name}] Skipped (circuit OPEN)", flush=True)
            continue

        print(f"  🔄 [{name}] Trying...", flush=True)
        for attempt in range(2):
            try:
                simple, timestamped, lang = await method()
                if simple and timestamped:
                    cb.record_success()
                    print(f"✅ SUCCESS with {name} (Phase 2)", flush=True)
                    print(f"{'=' * 70}", flush=True)
                    await _cache_success(video_id, simple, timestamped, lang, name)
                    return simple, timestamped, lang
            except Exception as e:
                print(f"  ⚠️ [{name}] Attempt {attempt + 1} failed ({type(e).__name__}): {str(e)[:200]}", flush=True)
            if attempt == 0:
                await asyncio.sleep(calculate_backoff(attempt))
        cb.record_failure()

    # ═══════════════════════════════════════════════════════════════════════════════
    # PHASE 3: Audio STT (dernier recours — toutes vidéos)
    # ═══════════════════════════════════════════════════════════════════════════════
    print("", flush=True)
    print(f"📋 PHASE 3: Audio STT (last resort{' — SHORT' if is_short else ' — full video'})", flush=True)
    print("─" * 50, flush=True)

    # Duration guard: plan-aware cap (Mistral-First Phase 1).
    # Free=20min / Pro=40min / Expert=60min. Voxtral handles up to 3h, so the
    # caps reflect business policy (paid tiers unlock longer audio), not API limits.
    # _get_max_stt_duration is already imported above at the Phase 1.5 short-circuit.
    max_stt_duration = _get_max_stt_duration(user_plan or "free")
    if duration > 0 and duration > max_stt_duration:
        print(
            f"  ⏭️ [STT] Skipped ALL STT providers: video duration {duration}s > "
            f"max_stt_duration {max_stt_duration}s for plan={user_plan or 'free'}",
            flush=True,
        )
    else:
        # Télécharger l'audio une seule fois pour tous les services
        print("  🎵 Downloading audio for transcription...", flush=True)
        audio_data, audio_ext = await _download_audio_for_transcription(video_id)

        if not audio_data:
            print("  ❌ Failed to download audio - trying services anyway", flush=True)

        phase3_methods = [
            ("Voxtral STT", "voxtral_stt", lambda: get_transcript_voxtral(video_id, audio_data, audio_ext)),
            ("Groq Whisper", "whisper", lambda: get_transcript_whisper(video_id)),
            (
                "OpenAI Whisper",
                "openai_whisper",
                lambda: get_transcript_openai_whisper(video_id, audio_data, audio_ext),
            ),
            ("Deepgram Nova-2", "deepgram", lambda: get_transcript_deepgram(video_id)),
            ("AssemblyAI", "assemblyai", lambda: get_transcript_assemblyai(video_id, audio_data, audio_ext)),
            (
                "ElevenLabs Scribe",
                "elevenlabs_scribe",
                lambda: _elevenlabs_scribe_transcribe(video_id, audio_data, audio_ext),
            ),
        ]

        for name, cb_name, method in phase3_methods:
            cb = get_circuit_breaker(cb_name)
            if not cb.can_execute():
                print(f"  ⏭️ [{name}] Skipped (circuit OPEN)", flush=True)
                continue

            print(f"  🎙️ [{name}] Trying...", flush=True)
            try:
                simple, timestamped, lang = await method()
                if simple:
                    cb.record_success()
                    print(f"✅ SUCCESS with {name} (Phase 3 - Audio STT)", flush=True)
                    print(f"{'=' * 70}", flush=True)
                    result_ts = timestamped or simple
                    await _cache_success(video_id, simple, result_ts, lang, name)
                    return simple, result_ts, lang
            except Exception as e:
                print(f"  ⚠️ [{name}] Failed ({type(e).__name__}): {str(e)[:200]}", flush=True)
            cb.record_failure()

    # ═══════════════════════════════════════════════════════════════════════════════
    # ÉCHEC TOTAL — Log détaillé pour diagnostic
    # ═══════════════════════════════════════════════════════════════════════════════
    print("", flush=True)
    print(f"❌ FAILED: All methods failed for {video_id} (is_short={is_short})", flush=True)
    # Log l'état des circuit breakers pour diagnostic
    for cb_name in [
        "supadata",
        "ytapi",
        "invidious",
        "piped",
        "ytdlp",
        "ytdlp_auto",
        "voxtral_stt",
        "whisper",
        "openai_whisper",
        "deepgram",
        "assemblyai",
        "elevenlabs_scribe",
    ]:
        cb = get_circuit_breaker(cb_name)
        if cb.state != CircuitState.CLOSED:
            print(f"  🔌 [{cb_name}] circuit={cb.state.value} failures={cb.failures}", flush=True)
    print(f"{'=' * 70}", flush=True)
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 PLAYLISTS
# ═══════════════════════════════════════════════════════════════════════════════


async def get_playlist_videos(playlist_id: str, max_videos: int = 50) -> List[Dict[str, Any]]:
    """Récupère les vidéos d'une playlist via yt-dlp ou Invidious"""

    # Essayer Invidious d'abord
    for instance in INVIDIOUS_INSTANCES[:2]:
        try:
            async with shared_http_client() as client:
                response = await client.get(
                    f"{instance}/api/v1/playlists/{playlist_id}",
                    timeout=30,
                    headers={"User-Agent": get_random_user_agent()},
                )

                if response.status_code == 200:
                    data = response.json()
                    videos = []
                    for v in data.get("videos", [])[:max_videos]:
                        videos.append(
                            {
                                "video_id": v.get("videoId"),
                                "title": v.get("title", "Unknown"),
                                "duration": v.get("lengthSeconds", 0),
                                "channel": v.get("author", "Unknown"),
                            }
                        )
                    if videos:
                        print(f"📋 Playlist {playlist_id}: {len(videos)} videos from Invidious", flush=True)
                        return videos
        except Exception as e:
            print(f"⚠️ Invidious playlist error: {e}", flush=True)

    # Fallback yt-dlp
    try:
        loop = asyncio.get_event_loop()

        def _fetch():
            cmd = [
                "yt-dlp",
                "--flat-playlist",
                "--dump-json",
                "--no-warnings",
                "--user-agent",
                get_random_user_agent(),
                f"https://www.youtube.com/playlist?list={playlist_id}",
            ]
            proxy = get_youtube_proxy()
            if proxy:
                cmd.insert(1, "--proxy")
                cmd.insert(2, proxy)
                print("  🔌 [PLAYLIST] Using proxy", flush=True)
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                return []
            videos = []
            for line in result.stdout.strip().split("\n"):
                if line:
                    try:
                        data = json.loads(line)
                        videos.append(
                            {
                                "video_id": data.get("id"),
                                "title": data.get("title", "Unknown"),
                                "duration": data.get("duration", 0),
                                "channel": data.get("channel", data.get("uploader", "Unknown")),
                            }
                        )
                    except json.JSONDecodeError:
                        continue
            return videos[:max_videos]

        videos = await loop.run_in_executor(executor, _fetch)
        print(f"📋 Playlist {playlist_id}: {len(videos)} videos found", flush=True)
        return videos
    except Exception as e:
        print(f"⚠️ Playlist fetch error: {e}", flush=True)
        return []


async def get_playlist_info(playlist_id: str) -> Optional[Dict[str, Any]]:
    """Récupère les infos d'une playlist"""

    # Essayer Invidious d'abord
    for instance in INVIDIOUS_INSTANCES[:2]:
        try:
            async with shared_http_client() as client:
                response = await client.get(
                    f"{instance}/api/v1/playlists/{playlist_id}",
                    timeout=20,
                    headers={"User-Agent": get_random_user_agent()},
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "playlist_id": playlist_id,
                        "title": data.get("title", "Unknown Playlist"),
                        "channel": data.get("author", "Unknown"),
                        "video_count": data.get("videoCount", len(data.get("videos", []))),
                        "description": data.get("description", "")[:500],
                    }
        except Exception:
            continue

    # Fallback yt-dlp
    try:
        loop = asyncio.get_event_loop()

        def _fetch():
            cmd = [
                "yt-dlp",
                "--dump-single-json",
                "--flat-playlist",
                "--no-warnings",
                "--user-agent",
                get_random_user_agent(),
                f"https://www.youtube.com/playlist?list={playlist_id}",
            ]
            proxy = get_youtube_proxy()
            if proxy:
                cmd.insert(1, "--proxy")
                cmd.insert(2, proxy)
                print("  🔌 [PLAYLIST-INFO] Using proxy", flush=True)
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode == 0:
                return json.loads(result.stdout)
            return None

        data = await loop.run_in_executor(executor, _fetch)
        if data:
            return {
                "playlist_id": playlist_id,
                "title": data.get("title", "Unknown Playlist"),
                "channel": data.get("channel", data.get("uploader", "Unknown")),
                "video_count": len(data.get("entries", [])),
                "description": data.get("description", "")[:500],
            }
    except Exception as e:
        print(f"⚠️ Playlist info error: {e}", flush=True)

    return {
        "playlist_id": playlist_id,
        "title": "Unknown Playlist",
        "channel": "Unknown",
        "video_count": 0,
        "description": "",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 EXPORTS
# ═══════════════════════════════════════════════════════════════════════════════

# Alias pour compatibilité avec les imports existants
get_transcript = get_transcript_with_timestamps

__all__ = [
    # Video ID extraction
    "extract_video_id",
    "extract_playlist_id",
    # Video info
    "get_video_info",
    "get_video_info_ytdlp",
    # Main transcript function
    "get_transcript",  # Alias pour compatibilité
    "get_transcript_with_timestamps",
    # Phase 1: Text methods
    "get_transcript_supadata",
    "get_transcript_ytapi",
    "get_transcript_invidious",
    "get_transcript_piped",  # v6.0
    # Phase 2: yt-dlp
    "get_transcript_ytdlp",
    "get_transcript_ytdlp_auto",
    # Phase 3: Audio transcription
    "get_transcript_voxtral",  # v7.2 — Mistral Voxtral STT (prioritaire)
    "get_transcript_whisper",
    "get_transcript_openai_whisper",  # v6.0
    "get_transcript_deepgram",
    "get_transcript_assemblyai",  # v6.0
    "_elevenlabs_scribe_transcribe",  # v7.2
    # Playlists
    "get_playlist_videos",
    "get_playlist_info",
    # Utilities
    "format_seconds_to_timestamp",
    "TranscriptSource",
    "TranscriptResult",
    # Circuit Breaker
    "CircuitBreaker",
    "CircuitState",
    "get_circuit_breaker",
    # Instance Health
    "get_healthy_instances",
    "record_instance_success",
    "record_instance_failure",
]
