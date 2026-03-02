"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎵 TIKTOK — Extraction de transcripts TikTok via yt-dlp + Groq Whisper          ║
║                                                                                    ║
║  Pipeline:                                                                         ║
║  1. Valider l'URL TikTok                                                           ║
║  2. Récupérer les métadonnées (titre, auteur, durée) via yt-dlp                    ║
║  3. Télécharger l'audio via yt-dlp                                                 ║
║  4. Transcrire via Groq Whisper                                                    ║
║  5. Retourner TranscriptResult compatible avec le pipeline YouTube                 ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import asyncio
import subprocess
import json
from typing import Optional, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from transcripts.audio_utils import (
    download_audio_ytdlp,
    transcribe_audio_groq,
    compress_audio,
    executor as audio_executor,
)

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Durée max TikTok supportée (10 minutes — au-delà c'est rare)
TIKTOK_MAX_DURATION = 600

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
    print(f"📺 [TIKTOK] Getting video info for: {url}", flush=True)

    try:
        loop = asyncio.get_event_loop()

        def _get_info():
            cmd = [
                "yt-dlp", "--dump-json",
                "--no-warnings", "--skip-download",
                "--no-playlist",
                url
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                return json.loads(result.stdout)
            print(f"  ⚠️ [TIKTOK] yt-dlp info failed: {result.stderr[:150]}", flush=True)
            return None

        data = await asyncio.wait_for(
            loop.run_in_executor(audio_executor, _get_info),
            timeout=30
        )

        if not data:
            return None

        video_id = str(data.get("id", extract_tiktok_video_id(url) or "unknown"))
        duration = data.get("duration", 0) or 0

        # Vérifier la durée
        if duration > TIKTOK_MAX_DURATION:
            print(f"  ⚠️ [TIKTOK] Video too long: {duration}s (max {TIKTOK_MAX_DURATION}s)", flush=True)
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

        print(f"  ✅ [TIKTOK] Info: \"{info['title'][:50]}\" by {info['channel']} ({duration}s)", flush=True)
        return info

    except asyncio.TimeoutError:
        print(f"  ⚠️ [TIKTOK] Info timeout", flush=True)
    except Exception as e:
        print(f"  ❌ [TIKTOK] Info error: {e}", flush=True)

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ TRANSCRIPTION COMPLÈTE
# ═══════════════════════════════════════════════════════════════════════════════

async def get_tiktok_transcript(
    url: str,
    video_id: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Pipeline complet de transcription TikTok :
    1. Télécharge l'audio via yt-dlp
    2. Compresse si nécessaire
    3. Transcrit via Groq Whisper

    Args:
        url: URL TikTok complète
        video_id: ID vidéo (optionnel, pour les logs)

    Returns:
        (full_text, timestamped_text, detected_language) ou (None, None, None)
    """
    vid = video_id or extract_tiktok_video_id(url) or "unknown"
    print(f"  🎵 [TIKTOK] Starting transcript extraction for {vid}...", flush=True)

    # Étape 1 : Télécharger l'audio
    audio_data, audio_ext = await download_audio_ytdlp(
        url=url,
        source_name="TIKTOK",
        timeout=120,  # TikTok vidéos courtes, pas besoin de 240s
    )

    if not audio_data:
        print(f"  ❌ [TIKTOK] Failed to download audio for {vid}", flush=True)
        return None, None, None

    # Étape 2 : Transcrire via Groq Whisper
    full_text, timestamped, lang = await transcribe_audio_groq(
        audio_data=audio_data,
        audio_ext=audio_ext,
        source_name="TIKTOK",
    )

    if full_text:
        print(f"  ✅ [TIKTOK] Transcript OK: {len(full_text)} chars, lang={lang}", flush=True)
    else:
        print(f"  ❌ [TIKTOK] Transcription failed for {vid}", flush=True)

    return full_text, timestamped, lang


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
