"""
TTS SCHEMAS — Pydantic models for TTS endpoints
v3.0 — language, gender, speed support
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal


class TTSRequest(BaseModel):
    """Request body for TTS generation."""

    model_config = {"protected_namespaces": ()}

    text: str = Field(..., min_length=1, max_length=5000, description="Text to convert to speech")
    language: Literal["fr", "en"] = Field(default="fr", description="Language for voice accent")
    gender: Literal["male", "female"] = Field(default="female", description="Voice gender")
    speed: float = Field(default=1.0, ge=0.25, le=4.0, description="Playback speed (0.25 to 4.0)")
    strip_questions: bool = Field(default=True, description="Strip trailing questions from text")
    voice_id: Optional[str] = Field(default=None, description="Override voice ID (advanced)")
    model_id: Optional[str] = Field(default=None, description="Override model ID (advanced)")
    # Advanced ElevenLabs parameters (from user preferences)
    stability: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Voice stability")
    similarity_boost: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Similarity boost")
    style: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Style exaggeration")
    use_speaker_boost: Optional[bool] = Field(default=None, description="Speaker boost")
    use_preferences: bool = Field(default=True, description="Apply saved user preferences as defaults")

    @field_validator("voice_id")
    @classmethod
    def validate_voice_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            from tts.service import KNOWN_VOICE_IDS

            if v not in KNOWN_VOICE_IDS:
                raise ValueError(f"Voice ID inconnu: {v}. Utilisez GET /api/tts/voices pour la liste.")
        return v
