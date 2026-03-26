"""
Voice Chat Schemas — Pydantic models for voice API endpoints.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


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
