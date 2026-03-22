"""
TTS SCHEMAS — Pydantic models for TTS endpoints
v3.0 — language, gender, speed support
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal


class TTSRequest(BaseModel):
    """Request body for TTS generation."""
    model_config = {"protected_namespaces": ()}

    text: str = Field(..., min_length=1, max_length=5000, description="Text to convert to speech")
    language: Literal["fr", "en"] = Field(default="fr", description="Language for voice accent")
    gender: Literal["male", "female"] = Field(default="female", description="Voice gender")
    speed: float = Field(default=1.0, ge=0.7, le=3.0, description="Playback speed (0.7 to 3.0)")
    strip_questions: bool = Field(default=True, description="Strip trailing questions from text")
    voice_id: Optional[str] = Field(default=None, description="Override voice ID (advanced)")
    model_id: Optional[str] = Field(default=None, description="Override model ID (advanced)")
