"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔊 TTS SCHEMAS — Pydantic models for TTS endpoints                                ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


class TTSProvider(str, Enum):
    """Available TTS providers"""
    OPENAI = "openai"
    ELEVENLABS = "elevenlabs"


class TTSVoice(str, Enum):
    """Available voices (OpenAI)"""
    ALLOY = "alloy"
    ECHO = "echo"
    FABLE = "fable"
    ONYX = "onyx"
    NOVA = "nova"
    SHIMMER = "shimmer"


class TTSSpeed(str, Enum):
    """Playback speed presets"""
    SLOW = "0.75"
    NORMAL = "1.0"
    FAST = "1.25"
    FASTER = "1.5"


class TTSGenerateRequest(BaseModel):
    """Request to generate TTS audio"""
    text: str = Field(..., min_length=1, max_length=4096, description="Text to convert to speech")
    voice: TTSVoice = Field(default=TTSVoice.NOVA, description="Voice to use")
    speed: float = Field(default=1.0, ge=0.25, le=4.0, description="Playback speed (0.25-4.0)")
    format: Literal["mp3", "opus", "aac", "flac"] = Field(default="mp3", description="Audio format")
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "This is a summary of the video content...",
                "voice": "nova",
                "speed": 1.0,
                "format": "mp3"
            }
        }


class TTSGenerateResponse(BaseModel):
    """Response with generated audio URL"""
    success: bool
    audio_url: str = Field(..., description="URL to the generated audio file")
    cache_key: str = Field(..., description="Cache key for this audio")
    duration_estimate: Optional[float] = Field(None, description="Estimated duration in seconds")
    text_length: int = Field(..., description="Length of input text")
    cached: bool = Field(default=False, description="Whether this was served from cache")


class TTSStatusResponse(BaseModel):
    """TTS service status"""
    available: bool
    provider: Optional[str] = None
    voices: list[str] = []
    max_text_length: int = 4096
    supported_formats: list[str] = ["mp3", "opus", "aac", "flac"]
