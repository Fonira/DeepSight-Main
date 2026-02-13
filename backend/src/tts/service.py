"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔊 TTS SERVICE — Text-to-Speech generation with caching                           ║
║  v1.0 — Supports OpenAI TTS API and ElevenLabs                                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import hashlib
import aiofiles
import aiofiles.os
from pathlib import Path
from typing import Optional, Tuple
import httpx
from datetime import datetime, timedelta

from core.config import OPENAI_API_KEY


# ═══════════════════════════════════════════════════════════════════════════════
# ⚙️ CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# TTS Provider selection
TTS_PROVIDER = os.environ.get("TTS_PROVIDER", "openai")  # "openai" or "elevenlabs"
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

# Cache configuration
CACHE_DIR = Path(os.environ.get("TTS_CACHE_DIR", "/tmp/tts_cache"))
CACHE_MAX_AGE_HOURS = int(os.environ.get("TTS_CACHE_MAX_AGE_HOURS", "24"))
CACHE_MAX_SIZE_MB = int(os.environ.get("TTS_CACHE_MAX_SIZE_MB", "500"))

# OpenAI TTS config
OPENAI_TTS_MODEL = "tts-1"  # or "tts-1-hd" for higher quality
OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"

# ElevenLabs config
ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech"
ELEVENLABS_VOICES = {
    "alloy": "21m00Tcm4TlvDq8ikWAM",  # Rachel
    "echo": "AZnzlk1XvdvUeBnXmlld",   # Domi
    "fable": "EXAVITQu4vr4xnSDxMaL",  # Bella
    "onyx": "ErXwobaYiN019PkySvjV",   # Antoni
    "nova": "MF3mGyEYCl7XYWbV9V6O",   # Elli
    "shimmer": "jBpfuIE2acCO8z3wKNLl" # Gigi
}

# Ensure cache directory exists
CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 CACHE UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def generate_cache_key(text: str, voice: str, speed: float, format: str) -> str:
    """Generate a unique cache key based on input parameters"""
    content = f"{text}|{voice}|{speed}|{format}"
    return hashlib.sha256(content.encode()).hexdigest()[:32]


def get_cache_path(cache_key: str, format: str) -> Path:
    """Get the file path for a cached audio file"""
    return CACHE_DIR / f"{cache_key}.{format}"


async def check_cache(cache_key: str, format: str) -> Optional[Path]:
    """Check if a cached audio file exists and is valid"""
    cache_path = get_cache_path(cache_key, format)
    
    try:
        if await aiofiles.os.path.exists(cache_path):
            # Check file age
            stat = await aiofiles.os.stat(cache_path)
            file_age = datetime.now().timestamp() - stat.st_mtime
            max_age = CACHE_MAX_AGE_HOURS * 3600
            
            if file_age < max_age:
                return cache_path
            else:
                # Remove expired cache
                await aiofiles.os.remove(cache_path)
    except Exception:
        pass
    
    return None


async def save_to_cache(cache_key: str, format: str, audio_data: bytes) -> Path:
    """Save audio data to cache"""
    cache_path = get_cache_path(cache_key, format)
    
    async with aiofiles.open(cache_path, "wb") as f:
        await f.write(audio_data)
    
    return cache_path


async def cleanup_cache():
    """Remove old cache files to free up space"""
    try:
        total_size = 0
        files = []
        
        for file in CACHE_DIR.iterdir():
            if file.is_file():
                stat = await aiofiles.os.stat(file)
                files.append((file, stat.st_mtime, stat.st_size))
                total_size += stat.st_size
        
        # Sort by modification time (oldest first)
        files.sort(key=lambda x: x[1])
        
        max_size = CACHE_MAX_SIZE_MB * 1024 * 1024
        
        # Remove oldest files until under limit
        while total_size > max_size and files:
            file, _, size = files.pop(0)
            await aiofiles.os.remove(file)
            total_size -= size
            
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ TTS GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

async def generate_tts_openai(
    text: str,
    voice: str = "nova",
    speed: float = 1.0,
    format: str = "mp3"
) -> Tuple[bytes, Optional[str]]:
    """Generate TTS using OpenAI API"""
    
    if not OPENAI_API_KEY:
        return b"", "OpenAI API key not configured"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                OPENAI_TTS_URL,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": OPENAI_TTS_MODEL,
                    "input": text,
                    "voice": voice,
                    "speed": speed,
                    "response_format": format
                }
            )
            
            if response.status_code == 200:
                return response.content, None
            else:
                error_msg = f"OpenAI TTS error: {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        error_msg = error_data["error"].get("message", error_msg)
                except:
                    pass
                return b"", error_msg
                
        except httpx.TimeoutException:
            return b"", "TTS request timed out"
        except Exception as e:
            return b"", f"TTS error: {str(e)}"


async def generate_tts_elevenlabs(
    text: str,
    voice: str = "nova",
    speed: float = 1.0,
    format: str = "mp3"
) -> Tuple[bytes, Optional[str]]:
    """Generate TTS using ElevenLabs API"""
    
    if not ELEVENLABS_API_KEY:
        return b"", "ElevenLabs API key not configured"
    
    # Map voice name to ElevenLabs voice ID
    voice_id = ELEVENLABS_VOICES.get(voice, ELEVENLABS_VOICES["nova"])
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{ELEVENLABS_TTS_URL}/{voice_id}",
                headers={
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.0,
                        "use_speaker_boost": True
                    }
                },
                params={
                    "output_format": f"{format}_44100_128"
                }
            )
            
            if response.status_code == 200:
                return response.content, None
            else:
                error_msg = f"ElevenLabs TTS error: {response.status_code}"
                try:
                    error_data = response.json()
                    if "detail" in error_data:
                        error_msg = error_data["detail"].get("message", error_msg)
                except:
                    pass
                return b"", error_msg
                
        except httpx.TimeoutException:
            return b"", "TTS request timed out"
        except Exception as e:
            return b"", f"TTS error: {str(e)}"


async def generate_tts(
    text: str,
    voice: str = "nova",
    speed: float = 1.0,
    format: str = "mp3"
) -> Tuple[Optional[Path], str, bool, Optional[str]]:
    """
    Generate TTS audio with caching.
    
    Returns:
        - Path to audio file (or None if error)
        - Cache key
        - Whether served from cache
        - Error message (if any)
    """
    # Generate cache key
    cache_key = generate_cache_key(text, voice, speed, format)
    
    # Check cache first
    cached_path = await check_cache(cache_key, format)
    if cached_path:
        return cached_path, cache_key, True, None
    
    # Generate new audio
    if TTS_PROVIDER == "elevenlabs" and ELEVENLABS_API_KEY:
        audio_data, error = await generate_tts_elevenlabs(text, voice, speed, format)
    else:
        audio_data, error = await generate_tts_openai(text, voice, speed, format)
    
    if error:
        return None, cache_key, False, error
    
    if not audio_data:
        return None, cache_key, False, "No audio data generated"
    
    # Save to cache
    cache_path = await save_to_cache(cache_key, format, audio_data)
    
    # Cleanup old cache files in background
    await cleanup_cache()
    
    return cache_path, cache_key, False, None


def estimate_duration(text: str, speed: float = 1.0) -> float:
    """Estimate audio duration based on text length"""
    # Average speaking rate: ~150 words per minute = 2.5 words per second
    # Average word length: ~5 characters
    words = len(text) / 5
    base_duration = words / 2.5
    return base_duration / speed


def is_tts_available() -> Tuple[bool, str]:
    """Check if TTS is available and return the provider"""
    if TTS_PROVIDER == "elevenlabs" and ELEVENLABS_API_KEY:
        return True, "elevenlabs"
    elif OPENAI_API_KEY:
        return True, "openai"
    return False, ""


def get_available_voices() -> list[str]:
    """Get list of available voices"""
    return ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
