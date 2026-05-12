"""
Pydantic v2 schemas pour le router /api/tutor/*.

Sessions sont stockées en Redis (TTL 1h, pas de table SQL).
"""

from typing import Literal, Optional, List
from pydantic import BaseModel, Field


TutorMode = Literal["text", "voice"]
TutorLang = Literal["fr", "en"]


class SessionStartRequest(BaseModel):
    """Body de POST /api/tutor/session/start."""

    concept_term: str = Field(..., min_length=1, max_length=200)
    # concept_def is optional: when the user types freely in the hub without a
    # pre-selected concept (sidebar entry vs. teaser amorce), we send "" and let
    # the tutor agent infer the topic from concept_term alone.
    concept_def: str = Field(default="", max_length=2000)
    summary_id: Optional[int] = Field(None, description="ID de l'analyse vidéo source si concept vient de l'historique")
    source_video_title: Optional[str] = Field(None, max_length=300)
    mode: TutorMode = "text"
    lang: TutorLang = "fr"


class SessionStartResponse(BaseModel):
    session_id: str
    first_prompt: str
    audio_url: Optional[str] = Field(None, description="Présent si mode='voice'")


class SessionTurnRequest(BaseModel):
    """Body de POST /api/tutor/session/{id}/turn.

    Soit user_input (texte) soit audio_blob (base64) doit être présent.
    """

    user_input: Optional[str] = Field(None, max_length=2000)
    audio_blob_b64: Optional[str] = Field(None, description="Audio user encodé base64 si mode voice")


class SessionTurnResponse(BaseModel):
    ai_response: str
    audio_url: Optional[str] = None
    turn_count: int


class SessionEndResponse(BaseModel):
    duration_sec: int
    turns_count: int
    source_summary_url: Optional[str] = None
    source_video_title: Optional[str] = None


class TutorTurn(BaseModel):
    """Représentation interne d'un tour, persistée en Redis."""

    role: Literal["user", "assistant"]
    content: str
    timestamp_ms: int


class TutorSessionState(BaseModel):
    """État interne de la session, persisté en Redis."""

    session_id: str
    user_id: int
    concept_term: str
    concept_def: str
    summary_id: Optional[int] = None
    source_video_title: Optional[str] = None
    mode: TutorMode
    lang: TutorLang
    started_at_ms: int
    turns: List[TutorTurn] = []
    persona_version: str = "v1"
