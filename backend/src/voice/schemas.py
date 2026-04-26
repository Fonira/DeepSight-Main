"""
Voice Chat Schemas — Pydantic models for voice API endpoints.
"""

from datetime import datetime
from typing import Literal, Optional, List

from pydantic import BaseModel, Field, field_validator, model_validator


# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class VoiceSessionRequest(BaseModel):
    """Requête de création de session voice chat."""

    summary_id: Optional[int] = Field(
        default=None, description="ID de l'analyse vidéo (pour agents explorer/tutor/quiz)"
    )
    debate_id: Optional[int] = Field(default=None, description="ID du débat IA (pour agent debate_moderator)")
    language: str = Field(default="fr", description="Langue (fr, en)")
    agent_type: str = Field(
        default="explorer",
        description="Type d'agent vocal (explorer, tutor, debate_moderator, quiz_coach, onboarding, companion)",
    )

    @model_validator(mode="after")
    def _xor_source(self) -> "VoiceSessionRequest":
        if self.summary_id is not None and self.debate_id is not None:
            raise ValueError("Fournir summary_id OU debate_id, pas les deux")
        return self


# ── Spec #1, Task 7 — Transcript append (frontend persistence per voice turn) ──
class TranscriptAppendRequest(BaseModel):
    """Persist a single voice turn into chat_messages with source='voice'.

    Sent by the frontend after each ``onMessage`` callback so the unified
    text+voice timeline survives a page reload. Webhook reconciliation
    (Task 8) corrects any drift after the call ends.
    """

    voice_session_id: str = Field(..., min_length=1, max_length=64)
    speaker: Literal["user", "agent"]
    content: str = Field(..., min_length=1, max_length=8000)
    time_in_call_secs: float = Field(..., ge=0.0)


# ═══════════════════════════════════════════════════════════════════════════════
# RESPONSE SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class VoiceSessionResponse(BaseModel):
    """Reponse de creation de session voice chat."""

    session_id: str
    signed_url: str
    agent_id: str
    conversation_token: Optional[str] = None
    expires_at: datetime
    quota_remaining_minutes: float
    max_session_minutes: int
    input_mode: str = "ptt"
    ptt_key: str = " "  # Keyboard key for PTT
    playback_rate: float = 1.0  # Client-side playback rate multiplier


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
    stability: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Voice stability (0.0 variable → 1.0 stable)"
    )
    similarity_boost: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Similarity boost (0.0 diverse → 1.0 similar)"
    )
    style: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Style exaggeration (0.0 none → 1.0 exaggerated)"
    )
    use_speaker_boost: Optional[bool] = Field(default=None, description="High-quality speaker boost")
    tts_model: Optional[str] = Field(
        default=None, description="TTS model (eleven_multilingual_v2, eleven_turbo_v2_5, eleven_flash_v2_5)"
    )
    voice_chat_model: Optional[str] = Field(default=None, description="Voice chat model")
    language: Optional[str] = Field(default=None, description="Preferred language (fr, en)")
    gender: Optional[str] = Field(default=None, description="Preferred voice gender (male, female, neutral)")

    # ── Phase 1: PTT / Interaction ────────────────────────────────────────
    input_mode: Optional[str] = Field(default=None, description="Input mode: ptt or vad")
    ptt_key: Optional[str] = Field(
        default=None, description="Keyboard key for PTT (single char or name: Space, Shift, Control, Alt, etc.)"
    )
    interruptions_enabled: Optional[bool] = Field(default=None, description="Allow user to interrupt agent")
    turn_eagerness: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Turn eagerness 0.0 (patient) to 1.0 (eager) — VAD only"
    )

    # ── Phase 2: Voice chat speed ─────────────────────────────────────────
    voice_chat_speed_preset: Optional[str] = Field(
        default=None, description="Voice chat speed preset ID (1x, 1.5x, 2x, 3x, 4x)"
    )

    # ── Phase 4: Advanced params ──────────────────────────────────────────
    turn_timeout: Optional[int] = Field(default=None, ge=5, le=60, description="Silence timeout in seconds (5-60)")
    soft_timeout_seconds: Optional[int] = Field(
        default=None, ge=60, le=600, description="Soft session timeout warning in seconds (60-600)"
    )

    @field_validator("input_mode")
    @classmethod
    def validate_input_mode(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"ptt", "vad"}:
            raise ValueError(f"Invalid input_mode: {v}. Valid: ptt, vad")
        return v

    @field_validator("voice_chat_speed_preset")
    @classmethod
    def validate_voice_chat_speed_preset(cls, v: Optional[str]) -> Optional[str]:
        from voice.preferences import VALID_VOICE_CHAT_SPEED_IDS

        if v is not None and v not in VALID_VOICE_CHAT_SPEED_IDS:
            raise ValueError(
                f"Invalid voice_chat_speed_preset: {v}. Valid: {', '.join(sorted(VALID_VOICE_CHAT_SPEED_IDS))}"
            )
        return v

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
    voice_chat_model: str = "eleven_turbo_v2_5"
    language: str = "fr"
    gender: str = "female"
    # Phase 1
    input_mode: str = "ptt"
    ptt_key: str = " "
    interruptions_enabled: bool = True
    turn_eagerness: float = 0.5
    # Phase 2
    voice_chat_speed_preset: str = "1x"
    # Phase 4
    turn_timeout: int = 15
    soft_timeout_seconds: int = 300


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
    voice_chat_speed_presets: List[dict]
    models: List[dict]


# ═══════════════════════════════════════════════════════════════════════════════
# VOICE SESSION VISUAL CONTEXT (thumbnail for voice modal)
# ═══════════════════════════════════════════════════════════════════════════════


class VoiceThumbnailGradient(BaseModel):
    """Gradient DeepSight (indigo → violet → cyan) rendu par le frontend en secours."""

    from_: str = Field(alias="from", default="#6366f1")
    via: str = Field(default="#8b5cf6")
    to: str = Field(default="#06b6d4")

    model_config = {"populate_by_name": True}


class VoiceThumbnailResponse(BaseModel):
    """Contexte visuel pour le modal d'appel vocal.

    Le frontend utilise `thumbnail_url` en priorité (img YouTube HD, data: URL,
    R2, ou image générée). Si l'URL échoue à charger (CDN miss, réseau), il
    peut retomber sur `gradient` pour afficher un fond DeepSight cohérent.
    """

    thumbnail_url: Optional[str] = Field(
        default=None,
        description="URL directe de la miniature. None → gradient uniquement.",
    )
    source: str = Field(
        description=(
            "Provenance : youtube_hd | youtube_standard | tiktok_stored | stored | generated | generating | gradient"
        ),
    )
    video_id: str
    video_title: Optional[str] = None
    video_channel: Optional[str] = None
    platform: str = "youtube"
    gradient: VoiceThumbnailGradient = Field(
        default_factory=VoiceThumbnailGradient,
        description="Gradient DeepSight (toujours fourni comme secours CSS).",
    )
    alt_text: str = Field(description="Texte alternatif pour accessibilité.")
