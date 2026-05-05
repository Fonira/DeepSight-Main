"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎭 DEBATE SCHEMAS — Pydantic models for AI Debate feature                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 REQUEST SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class DebateCreateRequest(BaseModel):
    """Requête pour créer un débat IA"""

    url_a: str = Field(..., description="URL de la vidéo source (YouTube/TikTok)")
    url_b: Optional[str] = Field(None, description="URL de la vidéo opposée (optionnel, auto-recherche si absent)")
    lang: str = Field("fr", description="Langue de l'analyse")
    platform: str = Field("web", description="Plateforme source (web/mobile/extension)")


class DebateChatRequest(BaseModel):
    """Requête pour chatter dans le contexte d'un débat"""

    debate_id: int = Field(..., description="ID du débat")
    message: str = Field(..., min_length=1, max_length=2000, description="Message utilisateur")


class AddPerspectiveRequest(BaseModel):
    """Requête pour ajouter une perspective complémentaire ou nuance à un débat existant.

    Sprint Débat IA v2 — POST /api/debate/{debate_id}/add-perspective.
    """

    relation_type: Literal["complement", "nuance"] = Field(
        ...,
        description="Type de relation : 'complement' (autre angle, enrichissement) "
        "ou 'nuance' (ni pour ni contre, conditionnel)",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 RESPONSE SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class DebateCreateResponse(BaseModel):
    """Réponse après création d'un débat"""

    debate_id: int
    status: str


class DebateStatusResponse(BaseModel):
    """Réponse pour le polling de statut"""

    debate_id: int
    status: str
    progress_message: str
    video_a_id: Optional[str] = None
    video_b_id: Optional[str] = None
    video_a_title: Optional[str] = None
    video_b_title: Optional[str] = None
    video_a_channel: Optional[str] = None
    video_b_channel: Optional[str] = None
    video_a_thumbnail: Optional[str] = None
    video_b_thumbnail: Optional[str] = None


class DebatePerspectiveResponse(BaseModel):
    """Une perspective dans un débat v2 (B initiale + ajouts complément/nuance).

    position 0 = perspective B initiale (auto-search ou manuelle).
    position 1-2 = perspectives ajoutées via POST /add-perspective.
    """

    id: int
    position: int
    video_id: str
    platform: str = "youtube"
    video_title: Optional[str] = None
    video_channel: Optional[str] = None
    video_thumbnail: Optional[str] = None
    thesis: Optional[str] = None
    arguments: Optional[list] = None
    relation_type: Literal["opposite", "complement", "nuance"] = "opposite"
    channel_quality_score: float = 0.5
    audience_level: Literal["vulgarisation", "expert", "unknown"] = "unknown"
    fact_check_results: Optional[list] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DebateResultResponse(BaseModel):
    """Résultat complet d'un débat.

    v2 (2026-05-04) — `perspectives` est la SSOT pour les vidéos B/B'/B''.
    Les champs legacy `video_b_*`, `thesis_b`, `arguments_b` reflètent toujours
    la perspective `position=0` pour rétro-compat des clients v1.
    """

    id: int
    video_a_id: str
    video_b_id: Optional[str] = None
    platform_a: str = "youtube"
    platform_b: Optional[str] = None
    video_a_title: str
    video_b_title: Optional[str] = None
    video_a_channel: Optional[str] = None
    video_b_channel: Optional[str] = None
    video_a_thumbnail: Optional[str] = None
    video_b_thumbnail: Optional[str] = None
    detected_topic: Optional[str] = None
    thesis_a: Optional[str] = None
    thesis_b: Optional[str] = None
    arguments_a: Optional[list] = None
    arguments_b: Optional[list] = None
    convergence_points: Optional[list] = None
    divergence_points: Optional[list] = None
    fact_check_results: Optional[list] = None
    debate_summary: Optional[str] = None
    status: str
    mode: str
    model_used: Optional[str] = None
    credits_used: int = 0
    lang: str = "fr"
    relation_type_dominant: Literal["opposite", "complement", "nuance"] = "opposite"
    perspectives: list[DebatePerspectiveResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DebateChatResponse(BaseModel):
    """Réponse du chat débat"""

    response: str
    sources: list = Field(default_factory=list)


class DebateListItem(BaseModel):
    """Item dans la liste des débats"""

    id: int
    detected_topic: Optional[str] = None
    video_a_title: Optional[str] = None
    video_b_title: Optional[str] = None
    video_a_thumbnail: Optional[str] = None
    video_b_thumbnail: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DebateHistoryResponse(BaseModel):
    """Réponse paginée de l'historique des débats"""

    debates: list[DebateListItem]
    total: int


class DebateChatMessageResponse(BaseModel):
    """Message de chat dans un débat"""

    id: int
    debate_id: int
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
