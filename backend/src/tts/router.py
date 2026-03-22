"""
TTS ROUTER — ElevenLabs Text-to-Speech
v2.1 — Non-streaming proxy with proper error propagation
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from typing import Optional
import httpx
import logging

from db.database import User
from auth.dependencies import get_current_user
from billing.permissions import require_feature
from core.config import get_elevenlabs_key

logger = logging.getLogger(__name__)

router = APIRouter()

# ElevenLabs config
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"
DEFAULT_VOICE_ID = "pMsXgVXv3BLzUgSXRplE"  # Voix française
DEFAULT_MODEL_ID = "eleven_flash_v2_5"       # 75ms latency, supports French
MAX_TEXT_LENGTH = 5000

# Voices cache
_voices_cache: dict = {"data": None, "expires": 0}


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ POST /api/tts — Generate TTS audio
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("")
async def tts_generate(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Generate TTS audio from ElevenLabs.

    Body: { text: string, voice_id?: string, model_id?: string }
    Returns: audio/mpeg response
    """
    # Feature check
    user_plan = current_user.plan or "free"
    platform = request.query_params.get("platform", "web")
    require_feature(user_plan, "tts", platform, label="Text-to-Speech")

    # Parse body
    body = await request.json()
    text = body.get("text", "").strip()
    voice_id = body.get("voice_id", DEFAULT_VOICE_ID)
    model_id = body.get("model_id", DEFAULT_MODEL_ID)

    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Text too long. Maximum {MAX_TEXT_LENGTH} characters, got {len(text)}."
        )

    # Get API key
    api_key = get_elevenlabs_key()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="TTS service not configured"
        )

    # Call ElevenLabs (non-streaming for proper error handling)
    elevenlabs_url = f"{ELEVENLABS_BASE_URL}/text-to-speech/{voice_id}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                elevenlabs_url,
                headers={
                    "xi-api-key": api_key,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json={
                    "text": text,
                    "model_id": model_id,
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
            )

            if response.status_code == 401:
                logger.error("ElevenLabs API key invalid (401)")
                raise HTTPException(
                    status_code=502,
                    detail="TTS provider authentication failed. Contact support.",
                )

            if response.status_code != 200:
                logger.error(
                    "ElevenLabs error: status=%d body=%s",
                    response.status_code,
                    response.text[:200],
                )
                raise HTTPException(
                    status_code=502,
                    detail=f"TTS provider error ({response.status_code})",
                )

            audio_bytes = response.content
            if len(audio_bytes) == 0:
                raise HTTPException(
                    status_code=502,
                    detail="TTS provider returned empty audio",
                )

            logger.info(
                "TTS generated: user=%s text_len=%d audio_bytes=%d",
                current_user.email, len(text), len(audio_bytes),
            )

            return Response(
                content=audio_bytes,
                media_type="audio/mpeg",
                headers={"Cache-Control": "no-cache"},
            )

    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error("ElevenLabs TTS timeout for user=%s", current_user.email)
        raise HTTPException(status_code=504, detail="TTS request timed out")
    except Exception as e:
        logger.error("ElevenLabs TTS error: %s", str(e))
        raise HTTPException(status_code=500, detail="TTS generation failed")


# ═══════════════════════════════════════════════════════════════════════════════
# 🗣️ GET /api/tts/voices — List available voices
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/voices")
async def list_voices(
    current_user: User = Depends(get_current_user),
):
    """
    Return available ElevenLabs voices (cached 1h).
    """
    import time

    now = time.time()

    # Return cached if valid
    if _voices_cache["data"] and _voices_cache["expires"] > now:
        return _voices_cache["data"]

    api_key = get_elevenlabs_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="TTS service not configured")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{ELEVENLABS_BASE_URL}/voices",
                headers={"xi-api-key": api_key},
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch voices from ElevenLabs"
                )

            data = response.json()
            voices = [
                {
                    "voice_id": v["voice_id"],
                    "name": v["name"],
                    "category": v.get("category", ""),
                    "labels": v.get("labels", {}),
                    "preview_url": v.get("preview_url", ""),
                }
                for v in data.get("voices", [])
            ]

            result = {"voices": voices, "default_voice_id": DEFAULT_VOICE_ID}

            # Cache for 1 hour
            _voices_cache["data"] = result
            _voices_cache["expires"] = now + 3600

            return result

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Voices request timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch ElevenLabs voices: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch voices")


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 GET /api/tts/status — TTS availability check
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def tts_status():
    """Check if TTS is available."""
    api_key = get_elevenlabs_key()
    return {
        "available": bool(api_key),
        "provider": "elevenlabs" if api_key else None,
        "model": DEFAULT_MODEL_ID,
        "default_voice_id": DEFAULT_VOICE_ID,
        "max_text_length": MAX_TEXT_LENGTH,
    }
