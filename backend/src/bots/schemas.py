"""Schémas Pydantic v2 — messages normalisés cross-platform.

Le `ConversationEngine` consomme et émet uniquement des objets Pydantic ;
les adapters (Telegram, Luffa) sont responsables de la traduction
plateforme-spécifique ⇄ schémas neutres.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


PlatformLiteral = Literal["telegram", "luffa"]
StateLiteral = Literal[
    "hello",
    "discover",
    "demo",
    "objections",
    "handoff",
    "done",
]
LeadStatusLiteral = Literal[
    "new",
    "qualifying",
    "demo_shown",
    "warm",
    "converted",
    "cold",
    "blocked",
]


class ParsedMessage(BaseModel):
    """Message entrant normalisé après adapter."""

    platform: PlatformLiteral
    platform_user_id: str
    platform_username: Optional[str] = None
    display_name: Optional[str] = None
    language_code: Optional[str] = None
    is_group: bool = False
    text: str
    platform_msg_id: Optional[str] = None
    callback_data: Optional[str] = None
    raw: Optional[dict[str, Any]] = None


class OutgoingButton(BaseModel):
    label: str
    payload: str


class OutgoingMessage(BaseModel):
    text: str
    buttons: list[OutgoingButton] = Field(default_factory=list)


class ProspectQualification(BaseModel):
    """Snapshot extrait par le LLM à chaque tour."""

    business_type: Optional[str] = None
    business_name: Optional[str] = None
    audience_size: Optional[str] = None
    current_pain: Optional[str] = None
    interest_signals: list[str] = Field(default_factory=list)
    score_delta: int = 0
    intent_detected: Optional[str] = None


class LLMTurnResult(BaseModel):
    """Sortie JSON structurée du LLM pour un tour de conversation."""

    text: str
    buttons: list[OutgoingButton] = Field(default_factory=list)
    next_state: StateLiteral = "hello"
    score_delta: int = 0
    intent_detected: Optional[str] = None
    extracted: ProspectQualification = Field(default_factory=ProspectQualification)
    ready_for_handoff: bool = False
    cold_close: bool = False


class HandoffPayload(BaseModel):
    """Données utilisées pour notifier Maxime via @Bobbykimifonibot."""

    prospect_id: int
    platform: PlatformLiteral
    platform_username: Optional[str] = None
    display_name: Optional[str] = None
    business_summary: str
    qualification_score: int
    deep_link: Optional[str] = None
    last_messages: list[str] = Field(default_factory=list)


class BotProspectRead(BaseModel):
    """Vue lecture seule d'un prospect — pour debug et admin."""

    id: int
    platform: PlatformLiteral
    platform_user_id: str
    platform_username: Optional[str] = None
    display_name: Optional[str] = None
    lead_status: LeadStatusLiteral
    state: StateLiteral
    qualification_score: int
    business_type: Optional[str] = None
    audience_size: Optional[str] = None
    current_pain: Optional[str] = None
    created_at: datetime
    last_message_at: datetime
    handoff_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
