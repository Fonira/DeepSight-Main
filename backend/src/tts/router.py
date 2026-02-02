"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔊 TTS ROUTER — Text-to-Speech API endpoints                                      ║
║  v1.0 — Generate audio from summaries and text                                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import aiofiles

from db.database import get_session, User
from auth.dependencies import get_current_user
from videos.service import get_summary_by_id

from .schemas import (
    TTSGenerateRequest,
    TTSGenerateResponse,
    TTSStatusResponse,
    TTSVoice
)
from .service import (
    generate_tts,
    estimate_duration,
    is_tts_available,
    get_available_voices,
    get_cache_path,
    check_cache
)


router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 STATUS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status", response_model=TTSStatusResponse)
async def tts_status():
    """
    Check TTS service availability and configuration.
    """
    available, provider = is_tts_available()
    
    return TTSStatusResponse(
        available=available,
        provider=provider if available else None,
        voices=get_available_voices() if available else [],
        max_text_length=4096,
        supported_formats=["mp3", "opus", "aac", "flac"]
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ GENERATE TTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/generate", response_model=TTSGenerateResponse)
async def generate_audio(
    request: TTSGenerateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generate TTS audio from text.
    
    Returns a URL to the generated audio file.
    Audio is cached by content hash for efficiency.
    """
    # Check if TTS is available
    available, provider = is_tts_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="TTS service not configured. Please set OPENAI_API_KEY or ELEVENLABS_API_KEY."
        )
    
    # Validate text length
    if len(request.text) > 4096:
        raise HTTPException(
            status_code=400,
            detail="Text too long. Maximum 4096 characters."
        )
    
    # Generate TTS
    audio_path, cache_key, cached, error = await generate_tts(
        text=request.text,
        voice=request.voice.value,
        speed=request.speed,
        format=request.format
    )
    
    if error:
        raise HTTPException(status_code=500, detail=error)
    
    if not audio_path:
        raise HTTPException(status_code=500, detail="Failed to generate audio")
    
    # Build audio URL
    audio_url = f"/api/tts/audio/{cache_key}.{request.format}"
    
    return TTSGenerateResponse(
        success=True,
        audio_url=audio_url,
        cache_key=cache_key,
        duration_estimate=estimate_duration(request.text, request.speed),
        text_length=len(request.text),
        cached=cached
    )


@router.post("/generate/summary/{summary_id}", response_model=TTSGenerateResponse)
async def generate_summary_audio(
    summary_id: int,
    voice: TTSVoice = TTSVoice.NOVA,
    speed: float = Query(default=1.0, ge=0.25, le=4.0),
    format: str = Query(default="mp3", regex="^(mp3|opus|aac|flac)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Generate TTS audio from a saved summary.
    
    Automatically extracts the summary content and generates audio.
    """
    # Check if TTS is available
    available, provider = is_tts_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="TTS service not configured."
        )
    
    # Get the summary
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    # Extract text (summary content)
    text = summary.summary_content
    if not text:
        raise HTTPException(status_code=400, detail="Summary has no content")
    
    # Truncate if too long
    if len(text) > 4096:
        text = text[:4000] + "... (content truncated for audio)"
    
    # Generate TTS
    audio_path, cache_key, cached, error = await generate_tts(
        text=text,
        voice=voice.value,
        speed=speed,
        format=format
    )
    
    if error:
        raise HTTPException(status_code=500, detail=error)
    
    if not audio_path:
        raise HTTPException(status_code=500, detail="Failed to generate audio")
    
    # Build audio URL
    audio_url = f"/api/tts/audio/{cache_key}.{format}"
    
    return TTSGenerateResponse(
        success=True,
        audio_url=audio_url,
        cache_key=cache_key,
        duration_estimate=estimate_duration(text, speed),
        text_length=len(text),
        cached=cached
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔊 AUDIO STREAMING
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/audio/{filename}")
async def get_audio(filename: str):
    """
    Stream a cached audio file.
    
    The filename should be in the format: {cache_key}.{format}
    """
    # Parse filename
    if "." not in filename:
        raise HTTPException(status_code=400, detail="Invalid filename format")
    
    cache_key, format = filename.rsplit(".", 1)
    
    if format not in ["mp3", "opus", "aac", "flac"]:
        raise HTTPException(status_code=400, detail="Invalid audio format")
    
    # Get cached file path
    audio_path = await check_cache(cache_key, format)
    
    if not audio_path:
        raise HTTPException(status_code=404, detail="Audio not found or expired")
    
    # Get MIME type
    mime_types = {
        "mp3": "audio/mpeg",
        "opus": "audio/opus",
        "aac": "audio/aac",
        "flac": "audio/flac"
    }
    
    return FileResponse(
        path=str(audio_path),
        media_type=mime_types.get(format, "audio/mpeg"),
        filename=f"deepsight_tts.{format}",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400"
        }
    )


@router.get("/audio/{filename}/stream")
async def stream_audio(filename: str):
    """
    Stream audio with chunked transfer encoding.
    Better for mobile and progressive loading.
    """
    # Parse filename
    if "." not in filename:
        raise HTTPException(status_code=400, detail="Invalid filename format")
    
    cache_key, format = filename.rsplit(".", 1)
    
    if format not in ["mp3", "opus", "aac", "flac"]:
        raise HTTPException(status_code=400, detail="Invalid audio format")
    
    # Get cached file path
    audio_path = await check_cache(cache_key, format)
    
    if not audio_path:
        raise HTTPException(status_code=404, detail="Audio not found or expired")
    
    async def audio_streamer():
        async with aiofiles.open(audio_path, "rb") as f:
            while chunk := await f.read(8192):
                yield chunk
    
    mime_types = {
        "mp3": "audio/mpeg",
        "opus": "audio/opus",
        "aac": "audio/aac",
        "flac": "audio/flac"
    }
    
    return StreamingResponse(
        audio_streamer(),
        media_type=mime_types.get(format, "audio/mpeg"),
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400"
        }
    )
