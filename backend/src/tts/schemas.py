"""
TTS SCHEMAS — Pydantic models for TTS endpoints
v2.0 — Simplified for ElevenLabs streaming
"""

from pydantic import BaseModel, Field
from typing import Optional


class TTSRequest(BaseModel):
    """Request body for TTS streaming."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to convert to speech")
    voice_id: Optional[str] = Field(default=None, description="ElevenLabs voice ID")
    model_id: Optional[str] = Field(default=None, description="ElevenLabs model ID")
