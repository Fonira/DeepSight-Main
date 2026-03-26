"""
Voice Chat Schemas — Pydantic models for voice API endpoints.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class VoiceSessionRequest(BaseModel):
    """Requete de creation de session voice chat."""
    summary_id: Optional[int] = Field(default=None, description="ID de l'analyse video (optional for onboarding)")
    language: str = Field(default="fr", description="Langue (fr, en)")
    agent_type: str = Field(default="explorer", description="Type d'agent vocal (explorer, tutor, debate_moderator, quiz_coach, onboarding)")


# ═══════════════════════════════════════════════════════════════════════════════
# RESPONSE SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class VoiceSessionResponse(BaseModel):
    """Reponse de creation de session voice chat."""
    session_id: str
    signed_url: str
    expires_at: datetime
    quota_remaining_minutes: float
    max_session_minutes: int


class VoiceQuotaResponse(BaseModel):
    """Quota voice chat pour l'utilisateur."""
    plan: str
    voice_enabled: bool
    seconds_used: int
    seconds_limit: int
    minutes_remaining: float
    max_session_minutes: int
    sessions_this_month: int
    reset_date: str


# ═══════════════════════════════════════════════════════════════════════════════
# WEBHOOK SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class VoiceWebhookPayload(BaseModel):
    """Payload recu du provider voice (ElevenLabs)."""
    conversation_id: str
    agent_id: str
    status: str
    duration_seconds: int
    transcript: Optional[str] = None
    metadata: Optional[dict] = None


class WebhookAckResponse(BaseModel):
    """Reponse d'acquittement du webhook."""
    status: str = "ok"
    session_id: str
    minutes_deducted: float


# ═══════════════════════════════════════════════════════════════════════════════
# HISTORY & TRANSCRIPT SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class VoiceSessionSummary(BaseModel):
    """Resume d'une session voice chat."""
    session_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: int
    status: str
    has_transcript: bool


class VoiceHistoryResponse(BaseModel):
    """Historique des sessions voice pour une analyse."""
    summary_id: int
    video_title: str
    sessions: List[VoiceSessionSummary]
    total_minutes: float


class VoiceTranscriptResponse(BaseModel):
    """Transcript complet d'une session voice."""
    session_id: str
    summary_id: int
    started_at: datetime
    duration_seconds: int
    transcript: str


# ═══════════════════════════════════════════════════════════════════════════════
# VOICE PREFERENCES SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class VoicePreferencesRequest(BaseModel):
    """Requete de mise à jour des préférences vocales."""
    voice_id: Optional[str] = Field(default=None, description="ElevenLabs voice ID")
    voice_name: Optional[str] = Field(default=None, description="Display name for UI")
    speed: Optional[float] = Field(default=None, ge=0.25, le=4.0, description="Playback speed (0.25 to 4.0)")
    stability: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Voice stability (0.0 variable → 1.0 stable)")
    similarity_boost: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Similarity boost (0.0 diverse → 1.0 similar)")
    style: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Style exaggeration (0.0 none → 1.0 exaggerated)")
    use_speaker_boost: Optional[bool] = Field(default=None, description="High-quality speaker boost")
    tts_model: Optional[str] = Field(default=None, description="TTS model (eleven_multilingual_v2, eleven_turbo_v2_5, eleven_flash_v2_5)")
    voice_chat_model: Optional[str] = Field(default=None, description="Voice chat model")
    language: Optional[str] = Field(default=None, description="Preferred language (fr, en)")
    gender: Optional[str] = Field(default=None, description="Preferred voice gender (male, female, neutral)")

    @field_validator("tts_model")
    @classmethod
    def validate_tts_model(cls, v: Optional[str]) -> Optional[str]:
        valid_models = {"eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_flash_v2_5"}
        if v is not None and v not in valid_models:
            raise ValueError(f"Invalid TTS model: {v}. Valid: {', '.join(valid_models)}")
        return v

    @field_validator("voice_chat_model")
    @classmethod
    def validate_voice_chat_model(cls, v: Optional[str]) -> Optional[str]:
        valid_models = {"eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_flash_v2_5"}
        if v is not None and v not in valid_models:
            raise ValueError(f"Invalid voice chat model: {v}. Valid: {', '.join(valid_models)}")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"male", "female", "neutral"}:
            raise ValueError(f"Invalid gender: {v}. Valid: male, female, neutral")
        return v

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"fr", "en"}:
            raise ValueError(f"Invalid language: {v}. Valid: fr, en")
        return v


class VoicePreferencesResponse(BaseModel):
    """Réponse avec les préférences vocales de l'utilisateur."""
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    speed: float = 1.0
    stability: float = 0.5
    similarity_boost: float = 0.75
    style: float = 0.3
    use_speaker_boost: bool = True
    tts_model: str = "eleven_multilingual_v2"
    voice_chat_model: str = "eleven_flash_v2_5"
    language: str = "fr"
    gender: str = "female"


class VoiceCatalogEntry(BaseModel):
    """Une voix du catalogue ElevenLabs."""
    voice_id: str
    name: str
    description_fr: str
    description_en: str
    gender: str
    accent: str
    language: str
    use_case: str
    recommended: bool
    preview_url: str


class VoiceCatalogResponse(BaseModel):
    """Catalogue complet des voix disponibles."""
    voices: List[VoiceCatalogEntry]
    speed_presets: List[dict]
    models: List[dict]
