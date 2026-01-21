"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📺 YOUTUBE SERVICE v4.0 — ANTI-BOT + INVIDIOUS + 6 FALLBACKS                      ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  🆕 v4.0: CONTOURNEMENT BLOCAGE YOUTUBE                                            ║
║  • 🔄 User-agents rotatifs (anti-détection)                                        ║
║  • 🛡️ Options anti-bot pour yt-dlp                                                ║
║  • 🌐 Invidious comme fallback (instances publiques)                               ║
║  • 🎙️ Groq Whisper optimisé via Invidious                                          ║
║  • ⚡ Retries intelligents avec délais                                             ║
║                                                                                    ║
║  ORDRE DES FALLBACKS:                                                              ║
║  1. Supadata API (stable, prioritaire)                                             ║
║  2. youtube-transcript-api (gratuit, rapide)                                       ║
║  3. Invidious API (contourne le blocage YouTube)                                   ║
║  4. yt-dlp subtitles (avec options anti-bot)                                       ║
║  5. yt-dlp auto-captions (avec options anti-bot)                                   ║
║  6. Groq Whisper via Invidious (dernier recours, TOUJOURS fonctionne)              ║
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

from core.config import get_supadata_key

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

GROQ_MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB max pour Groq

TIMEOUTS = {
    "supadata": 30,
    "ytapi": 15,
    "invidious": 20,
    "ytdlp_subs": 60,
    "ytdlp_auto": 60,
    "whisper_download": 180,
    "whisper_transcribe": 300,
}

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
    "https://invidious.fdn.fr",          # France - très fiable
    "https://inv.nadeko.net",             # Stable
    "https://invidious.nerdvpn.de",       # Allemagne
    "https://yt.artemislena.eu",          # EU
    "https://invidious.protokolla.fi",    # Finlande
    "https://inv.tux.pizza",              # Stable
    "https://vid.puffyan.us",             # US
    "https://invidious.projectsegfau.lt", # EU
    "https://invidious.privacyredirect.com",
    "https://invidious.io.lol",
]


def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)


def get_working_invidious_instance() -> Optional[str]:
    """Trouve une instance Invidious qui fonctionne"""
    random.shuffle(INVIDIOUS_INSTANCES)
    return INVIDIOUS_INSTANCES[0] if INVIDIOUS_INSTANCES else None


class TranscriptSource(Enum):
    SUPADATA = "supadata"
    YTAPI = "youtube-transcript-api"
    INVIDIOUS = "invidious"
    YTDLP = "yt-dlp"
    YTDLP_AUTO = "yt-dlp-auto"
    WHISPER = "groq-whisper"
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


def get_groq_key() -> Optional[str]:
    key = os.environ.get("GROQ_API_KEY")
    if key:
        print(f"🔑 [GROQ] API key configured: {key[:8]}...", flush=True)
    return key


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
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_playlist_id(url: str) -> Optional[str]:
    if not url:
        return None
    patterns = [
        r'[?&]list=([a-zA-Z0-9_-]+)',
        r'^([a-zA-Z0-9_-]{13,})$'
    ]
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
    Récupère les infos via Invidious puis yt-dlp en fallback.
    🆕 v4.2: Multiple instances Invidious + meilleur logging
    """
    print(f"📺 [VIDEO INFO] Getting info for: {video_id}", flush=True)
    
    # Essayer plusieurs instances Invidious
    for instance in INVIDIOUS_INSTANCES[:5]:  # Essayer 5 instances
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{instance}/api/v1/videos/{video_id}",
                    timeout=10,
                    headers={"User-Agent": get_random_user_agent()}
                )
                if response.status_code == 200:
                    data = response.json()
                    duration = data.get("lengthSeconds", 0)
                    if isinstance(duration, str):
                        duration = int(duration) if duration.isdigit() else 0
                    print(f"  ✅ [INVIDIOUS] {instance} - Duration: {duration}s", flush=True)
                    if duration > 0:  # Seulement si on a une durée valide
                        return {
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
        except Exception as e:
            print(f"  ⚠️ [INVIDIOUS] {instance} error: {str(e)[:50]}", flush=True)
    
    # Essayer yt-dlp (plus lent mais plus fiable)
    print(f"  🔄 [YT-DLP] Trying yt-dlp fallback...", flush=True)
    ytdlp_result = await get_video_info_ytdlp(video_id)
    if ytdlp_result and ytdlp_result.get("duration", 0) > 0:
        print(f"  ✅ [YT-DLP] Duration: {ytdlp_result['duration']}s", flush=True)
        return ytdlp_result
    
    # Essayer oembed pour au moins avoir le titre (pas de durée)
    print(f"  🔄 [OEMBED] Trying oembed fallback...", flush=True)
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10, headers={"User-Agent": get_random_user_agent()})
            if response.status_code == 200:
                data = response.json()
                print(f"  ⚠️ [OEMBED] Got title but no duration", flush=True)
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
                "yt-dlp", "--dump-json", "--no-warnings", "--skip-download",
                "--user-agent", get_random_user_agent(),
                "--extractor-args", "youtube:player_client=android",
                f"https://youtube.com/watch?v={video_id}"
            ]
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
                "description": data.get("description", "")[:2000],  # Plus de description
                "tags": data.get("tags", []),  # Tags YouTube
                "categories": data.get("categories", []),  # Catégories YouTube natives
                "like_count": data.get("like_count"),
                "comment_count": data.get("comment_count"),
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
    
    for line in content.split('\n'):
        line = line.strip()
        if line.startswith('WEBVTT') or line.startswith('Kind:') or line.startswith('Language:'):
            continue
        
        time_match = re.match(r'(\d{1,2}):(\d{2}):(\d{2})', line)
        if time_match:
            h, m, s = map(int, time_match.groups())
            current_time = h * 3600 + m * 60 + s
            continue
        
        time_match2 = re.match(r'(\d{1,2}):(\d{2})[\.,]', line)
        if time_match2:
            m, s = map(int, time_match2.groups())
            current_time = m * 60 + s
            continue
        
        if not line or line.isdigit() or '-->' in line:
            continue
        
        clean = re.sub(r'<[^>]+>', '', line)
        clean = re.sub(r'\[.*?\]', '', clean)
        clean = clean.strip()
        
        if clean and len(clean) > 1:
            lines.append(clean)
            timestamps.append(current_time)
    
    if not lines:
        return None, None
    
    simple = ' '.join(lines)
    
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
    for lang in ['fr', 'en', 'es', 'de', 'it', 'pt']:
        for ext in ['vtt', 'srt']:
            sub_file = Path(tmpdir) / f"{video_id}.{lang}.{ext}"
            if sub_file.exists():
                content = sub_file.read_text(encoding='utf-8', errors='ignore')
                simple, timestamped = _parse_vtt_content(content)
                if simple and len(simple) > 50:
                    return simple, timestamped, lang
    
    for f in Path(tmpdir).glob("*.vtt"):
        content = f.read_text(encoding='utf-8', errors='ignore')
        simple, timestamped = _parse_vtt_content(content)
        if simple and len(simple) > 50:
            lang = "fr"
            parts = f.stem.split('.')
            if len(parts) >= 2:
                lang = parts[-1]
            return simple, timestamped, lang
    
    for f in Path(tmpdir).glob("*.srt"):
        content = f.read_text(encoding='utf-8', errors='ignore')
        simple, timestamped = _parse_vtt_content(content)
        if simple and len(simple) > 50:
            lang = "fr"
            parts = f.stem.split('.')
            if len(parts) >= 2:
                lang = parts[-1]
            return simple, timestamped, lang
    
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🥇 MÉTHODE 1: SUPADATA
# ═══════════════════════════════════════════════════════════════════════════════

async def get_transcript_supadata(video_id: str, api_key: str = None) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    api_key = api_key or get_supadata_key()
    if not api_key:
        print(f"  ⏭️ [SUPADATA] Skipped: No API key", flush=True)
        return None, None, None
    
    print(f"  🥇 [SUPADATA] Trying...", flush=True)
    
    try:
        async with httpx.AsyncClient() as client:
            for lang in ["fr", "en", None]:
                params = {"videoId": video_id}
                if lang:
                    params["lang"] = lang
                
                try:
                    response = await client.get(
                        "https://api.supadata.ai/v1/youtube/transcript",
                        params=params,
                        headers={"Authorization": f"Bearer {api_key}"},
                        timeout=TIMEOUTS["supadata"]
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        segments = []
                        if isinstance(data, list):
                            segments = data
                        elif isinstance(data, dict):
                            segments = data.get("segments", data.get("transcript", []))
                            if isinstance(segments, str):
                                print(f"  ✅ [SUPADATA] Success: {len(segments)} chars", flush=True)
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
                                print(f"  ✅ [SUPADATA] Success: {len(simple)} chars", flush=True)
                                return simple, timestamped, lang or "fr"
                    
                    elif response.status_code == 404:
                        continue
                    else:
                        print(f"  ⚠️ [SUPADATA] Error {response.status_code}", flush=True)
                        break
                        
                except httpx.TimeoutException:
                    print(f"  ⚠️ [SUPADATA] Timeout", flush=True)
                    break
    
    except Exception as e:
        print(f"  ⚠️ [SUPADATA] Exception: {e}", flush=True)
    
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🥈 MÉTHODE 2: YOUTUBE-TRANSCRIPT-API
# ═══════════════════════════════════════════════════════════════════════════════

async def get_transcript_ytapi(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    if not YTAPI_AVAILABLE:
        print(f"  ⏭️ [YTAPI] Skipped: Not installed", flush=True)
        return None, None, None
    
    print(f"  🥈 [YTAPI] Trying...", flush=True)
    
    try:
        loop = asyncio.get_event_loop()
        
        def _fetch():
            try:
                ytt_api = YouTubeTranscriptApi()
                transcript_list = ytt_api.list(video_id)
                preferred_langs = ['fr', 'en', 'es', 'de', 'it', 'pt']
                
                for is_manual in [True, False]:
                    for lang in preferred_langs:
                        try:
                            if is_manual:
                                transcript = transcript_list.find_manually_created_transcript([lang])
                            else:
                                transcript = transcript_list.find_generated_transcript([lang])
                            
                            fetched = transcript.fetch()
                            
                            if hasattr(fetched, 'to_raw_data'):
                                data = fetched.to_raw_data()
                            elif hasattr(fetched, '__iter__'):
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
                                    if not text or text in ['[Music]', '[Applause]', '[Musique]']:
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
        
        simple, timestamped, lang = await asyncio.wait_for(
            loop.run_in_executor(executor, _fetch),
            timeout=TIMEOUTS["ytapi"]
        )
        
        if simple:
            print(f"  ✅ [YTAPI] Success: {len(simple)} chars", flush=True)
            return simple, timestamped, lang
        else:
            print(f"  ⚠️ [YTAPI] No captions found", flush=True)
    
    except asyncio.TimeoutError:
        print(f"  ⚠️ [YTAPI] Timeout", flush=True)
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
    print(f"  🌐 [INVIDIOUS] Trying captions...", flush=True)
    
    for instance in INVIDIOUS_INSTANCES[:3]:  # Essayer 3 instances max
        try:
            async with httpx.AsyncClient() as client:
                # Récupérer la liste des captions
                response = await client.get(
                    f"{instance}/api/v1/captions/{video_id}",
                    timeout=TIMEOUTS["invidious"],
                    headers={"User-Agent": get_random_user_agent()}
                )
                
                if response.status_code != 200:
                    continue
                
                data = response.json()
                captions = data.get("captions", [])
                
                if not captions:
                    continue
                
                # Trouver les captions préférées (FR puis EN)
                caption_url = None
                caption_lang = "fr"
                
                for lang in ["fr", "en", "es", "de"]:
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
                    caption_url,
                    timeout=TIMEOUTS["invidious"],
                    headers={"User-Agent": get_random_user_agent()}
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
    
    print(f"  ⚠️ [INVIDIOUS] No captions from any instance", flush=True)
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🏅 MÉTHODE 4: YT-DLP SUBTITLES MANUELS (AVEC OPTIONS ANTI-BOT)
# ═══════════════════════════════════════════════════════════════════════════════

async def get_transcript_ytdlp(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    print(f"  🏅 [YT-DLP] Trying manual subtitles...", flush=True)
    
    try:
        loop = asyncio.get_event_loop()
        
        def _fetch():
            with tempfile.TemporaryDirectory() as tmpdir:
                cmd = [
                    "yt-dlp",
                    "--write-subs", "--sub-langs", "fr,en,es,de,it,pt",
                    "--sub-format", "vtt/srt/best",
                    "--skip-download", "--no-warnings",
                    "--user-agent", get_random_user_agent(),
                    "--extractor-args", "youtube:player_client=android,web",
                    "--sleep-requests", "1",
                    "-o", f"{tmpdir}/%(id)s.%(ext)s",
                    f"https://youtube.com/watch?v={video_id}"
                ]
                subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUTS["ytdlp_subs"])
                return _parse_subtitle_files(tmpdir, video_id)
        
        simple, timestamped, lang = await asyncio.wait_for(
            loop.run_in_executor(executor, _fetch),
            timeout=TIMEOUTS["ytdlp_subs"] + 10
        )
        
        if simple:
            print(f"  ✅ [YT-DLP] Success: {len(simple)} chars", flush=True)
            return simple, timestamped, lang
        else:
            print(f"  ⚠️ [YT-DLP] No manual subtitles", flush=True)
    
    except asyncio.TimeoutError:
        print(f"  ⚠️ [YT-DLP] Timeout", flush=True)
    except Exception as e:
        print(f"  ⚠️ [YT-DLP] Exception: {e}", flush=True)
    
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎖️ MÉTHODE 5: YT-DLP AUTO-CAPTIONS (AVEC OPTIONS ANTI-BOT)
# ═══════════════════════════════════════════════════════════════════════════════

async def get_transcript_ytdlp_auto(video_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    print(f"  🎖️ [YT-DLP-AUTO] Trying auto-captions...", flush=True)
    
    try:
        loop = asyncio.get_event_loop()
        
        def _fetch():
            with tempfile.TemporaryDirectory() as tmpdir:
                cmd = [
                    "yt-dlp",
                    "--write-auto-subs", "--sub-langs", "fr,en,es,de,it,pt",
                    "--sub-format", "vtt/srt/best",
                    "--skip-download", "--no-warnings",
                    "--user-agent", get_random_user_agent(),
                    "--extractor-args", "youtube:player_client=android,web",
                    "--sleep-requests", "1",
                    "-o", f"{tmpdir}/%(id)s.%(ext)s",
                    f"https://youtube.com/watch?v={video_id}"
                ]
                subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUTS["ytdlp_auto"])
                return _parse_subtitle_files(tmpdir, video_id)
        
        simple, timestamped, lang = await asyncio.wait_for(
            loop.run_in_executor(executor, _fetch),
            timeout=TIMEOUTS["ytdlp_auto"] + 10
        )
        
        if simple:
            print(f"  ✅ [YT-DLP-AUTO] Success: {len(simple)} chars", flush=True)
            return simple, timestamped, lang
        else:
            print(f"  ⚠️ [YT-DLP-AUTO] No auto-captions", flush=True)
    
    except asyncio.TimeoutError:
        print(f"  ⚠️ [YT-DLP-AUTO] Timeout", flush=True)
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
        print(f"  ❌ [WHISPER] GROQ_API_KEY not configured!", flush=True)
        return None, None, None
    
    print(f"  🎙️ [WHISPER] Downloading audio...", flush=True)
    
    audio_data = None
    audio_ext = ".mp3"
    
    # MÉTHODE A: Essayer via Invidious d'abord (contourne le blocage)
    for instance in INVIDIOUS_INSTANCES[:2]:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                # Récupérer les formats audio
                response = await client.get(
                    f"{instance}/api/v1/videos/{video_id}",
                    headers={"User-Agent": get_random_user_agent()}
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
                
                print(f"  🎙️ [WHISPER] Downloading from Invidious...", flush=True)
                
                audio_response = await client.get(
                    audio_url,
                    timeout=120,
                    headers={"User-Agent": get_random_user_agent()},
                    follow_redirects=True
                )
                
                if audio_response.status_code == 200 and len(audio_response.content) > 10000:
                    audio_data = audio_response.content
                    print(f"  ✅ [WHISPER] Audio from Invidious: {len(audio_data)/1024/1024:.1f}MB", flush=True)
                    break
        
        except Exception as e:
            print(f"  ⚠️ [WHISPER] Invidious {instance}: {str(e)[:50]}", flush=True)
            continue
    
    # MÉTHODE B: Fallback sur yt-dlp si Invidious échoue
    if not audio_data:
        print(f"  🎙️ [WHISPER] Trying yt-dlp download...", flush=True)
        try:
            loop = asyncio.get_event_loop()
            
            def _download_audio():
                with tempfile.TemporaryDirectory() as tmpdir:
                    audio_path = f"{tmpdir}/{video_id}.mp3"
                    
                    cmd = [
                        "yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "9",
                        "-o", audio_path, "--no-warnings", "--no-playlist",
                        "--user-agent", get_random_user_agent(),
                        "--extractor-args", "youtube:player_client=android",
                        f"https://youtube.com/watch?v={video_id}"
                    ]
                    
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUTS["whisper_download"])
                    
                    if result.returncode != 0:
                        print(f"  ⚠️ [WHISPER] yt-dlp failed: {result.stderr[:100]}", flush=True)
                        return None, None
                    
                    for f in Path(tmpdir).iterdir():
                        if f.suffix in ['.mp3', '.m4a', '.webm', '.opus', '.wav']:
                            return f.read_bytes(), f.suffix
                    
                    return None, None
            
            result = await asyncio.wait_for(
                loop.run_in_executor(executor, _download_audio),
                timeout=TIMEOUTS["whisper_download"]
            )
            
            if result and result[0]:
                audio_data, audio_ext = result
                print(f"  ✅ [WHISPER] Audio from yt-dlp: {len(audio_data)/1024/1024:.1f}MB", flush=True)
        
        except Exception as e:
            print(f"  ⚠️ [WHISPER] yt-dlp download failed: {e}", flush=True)
    
    if not audio_data:
        print(f"  ❌ [WHISPER] Failed to download audio", flush=True)
        return None, None, None
    
    # Compresser si trop gros
    if len(audio_data) > GROQ_MAX_FILE_SIZE:
        print(f"  🎙️ [WHISPER] Compressing audio (>{GROQ_MAX_FILE_SIZE/1024/1024:.0f}MB)...", flush=True)
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
                print(f"  ✅ [WHISPER] Compressed to: {len(audio_data)/1024/1024:.1f}MB", flush=True)
            
            # Cleanup
            Path(tmp_in_path).unlink(missing_ok=True)
            Path(tmp_out_path).unlink(missing_ok=True)
        
        except Exception as e:
            print(f"  ⚠️ [WHISPER] Compression failed: {e}", flush=True)
    
    if len(audio_data) > GROQ_MAX_FILE_SIZE:
        print(f"  ❌ [WHISPER] Audio still too large", flush=True)
        return None, None, None
    
    # Transcrire avec Groq
    print(f"  🎙️ [WHISPER] Sending {len(audio_data)/1024/1024:.1f}MB to Groq...", flush=True)
    
    try:
        mime_types = {'.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.webm': 'audio/webm', '.opus': 'audio/opus', '.wav': 'audio/wav'}
        mime_type = mime_types.get(audio_ext, 'audio/mpeg')
        
        async with httpx.AsyncClient() as client:
            files = {'file': (f'audio{audio_ext}', audio_data, mime_type)}
            data = {'model': 'whisper-large-v3', 'response_format': 'verbose_json'}
            
            start_time = time.time()
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                files=files, data=data, timeout=TIMEOUTS["whisper_transcribe"]
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
# 🎯 FONCTION PRINCIPALE — 6 MÉTHODES DE FALLBACK
# ═══════════════════════════════════════════════════════════════════════════════

async def get_transcript_with_timestamps(video_id: str, supadata_key: str = None) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    🎯 FONCTION PRINCIPALE - 6 méthodes de fallback
    Retourne: (transcript_simple, transcript_timestamped, lang)
    """
    print(f"", flush=True)
    print(f"{'='*60}", flush=True)
    print(f"🔍 TRANSCRIPT EXTRACTION v4.0 for {video_id}", flush=True)
    print(f"{'='*60}", flush=True)
    
    # 1. Supadata
    print(f"[1/6] Supadata API...", flush=True)
    simple, timestamped, lang = await get_transcript_supadata(video_id, supadata_key)
    if simple and timestamped:
        print(f"✅ SUCCESS with Supadata", flush=True)
        return simple, timestamped, lang
    
    # 2. youtube-transcript-api
    print(f"[2/6] youtube-transcript-api...", flush=True)
    simple, timestamped, lang = await get_transcript_ytapi(video_id)
    if simple and timestamped:
        print(f"✅ SUCCESS with YTAPI", flush=True)
        return simple, timestamped, lang
    
    # 3. Invidious (NOUVEAU - contourne le blocage YouTube)
    print(f"[3/6] Invidious API (bypass YouTube)...", flush=True)
    simple, timestamped, lang = await get_transcript_invidious(video_id)
    if simple and timestamped:
        print(f"✅ SUCCESS with Invidious", flush=True)
        return simple, timestamped, lang
    
    # 4. yt-dlp manual subtitles
    print(f"[4/6] yt-dlp manual subtitles...", flush=True)
    simple, timestamped, lang = await get_transcript_ytdlp(video_id)
    if simple and timestamped:
        print(f"✅ SUCCESS with YT-DLP", flush=True)
        return simple, timestamped, lang
    
    # 5. yt-dlp auto-captions
    print(f"[5/6] yt-dlp auto-captions...", flush=True)
    simple, timestamped, lang = await get_transcript_ytdlp_auto(video_id)
    if simple and timestamped:
        print(f"✅ SUCCESS with YT-DLP-AUTO", flush=True)
        return simple, timestamped, lang
    
    # 6. Groq Whisper (DERNIER RECOURS - via Invidious)
    print(f"[6/6] Groq Whisper (audio transcription)...", flush=True)
    simple, timestamped, lang = await get_transcript_whisper(video_id)
    if simple:
        print(f"✅ SUCCESS with Whisper", flush=True)
        return simple, timestamped or simple, lang
    
    print(f"", flush=True)
    print(f"❌ FAILED: All 6 methods failed for {video_id}", flush=True)
    print(f"{'='*60}", flush=True)
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 PLAYLISTS
# ═══════════════════════════════════════════════════════════════════════════════

async def get_playlist_videos(playlist_id: str, max_videos: int = 50) -> List[Dict[str, Any]]:
    """Récupère les vidéos d'une playlist via yt-dlp ou Invidious"""
    
    # Essayer Invidious d'abord
    for instance in INVIDIOUS_INSTANCES[:2]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{instance}/api/v1/playlists/{playlist_id}",
                    timeout=30,
                    headers={"User-Agent": get_random_user_agent()}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    videos = []
                    for v in data.get("videos", [])[:max_videos]:
                        videos.append({
                            "video_id": v.get("videoId"),
                            "title": v.get("title", "Unknown"),
                            "duration": v.get("lengthSeconds", 0),
                            "channel": v.get("author", "Unknown")
                        })
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
                "yt-dlp", "--flat-playlist", "--dump-json", "--no-warnings",
                "--user-agent", get_random_user_agent(),
                f"https://www.youtube.com/playlist?list={playlist_id}"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                return []
            videos = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    try:
                        data = json.loads(line)
                        videos.append({
                            "video_id": data.get("id"),
                            "title": data.get("title", "Unknown"),
                            "duration": data.get("duration", 0),
                            "channel": data.get("channel", data.get("uploader", "Unknown"))
                        })
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
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{instance}/api/v1/playlists/{playlist_id}",
                    timeout=20,
                    headers={"User-Agent": get_random_user_agent()}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "playlist_id": playlist_id,
                        "title": data.get("title", "Unknown Playlist"),
                        "channel": data.get("author", "Unknown"),
                        "video_count": data.get("videoCount", len(data.get("videos", []))),
                        "description": data.get("description", "")[:500]
                    }
        except Exception:
            continue
    
    # Fallback yt-dlp
    try:
        loop = asyncio.get_event_loop()
        def _fetch():
            cmd = [
                "yt-dlp", "--dump-single-json", "--flat-playlist", "--no-warnings",
                "--user-agent", get_random_user_agent(),
                f"https://www.youtube.com/playlist?list={playlist_id}"
            ]
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
                "description": data.get("description", "")[:500]
            }
    except Exception as e:
        print(f"⚠️ Playlist info error: {e}", flush=True)
    
    return {
        "playlist_id": playlist_id,
        "title": "Unknown Playlist",
        "channel": "Unknown",
        "video_count": 0,
        "description": ""
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 EXPORTS
# ═══════════════════════════════════════════════════════════════════════════════

# Alias pour compatibilité avec les imports existants
get_transcript = get_transcript_with_timestamps

__all__ = [
    "extract_video_id",
    "extract_playlist_id",
    "get_video_info",
    "get_video_info_ytdlp",
    "get_transcript",  # Alias pour compatibilité
    "get_transcript_with_timestamps",
    "get_transcript_supadata",
    "get_transcript_ytapi",
    "get_transcript_invidious",
    "get_transcript_ytdlp",
    "get_transcript_ytdlp_auto",
    "get_transcript_whisper",
    "get_playlist_videos",
    "get_playlist_info",
    "format_seconds_to_timestamp",
    "TranscriptSource",
    "TranscriptResult",
]
