"""
Pydantic schemas for Video Comparison "VS Mode".
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST
# ═══════════════════════════════════════════════════════════════════════════════

class ComparisonRequest(BaseModel):
    summary_a_id: int = Field(..., description="ID du premier résumé à comparer")
    summary_b_id: int = Field(..., description="ID du second résumé à comparer")
    lang: str = Field(default="fr", description="Langue de l'analyse")
    model: str = Field(default="mistral-small-2603", description="Modèle Mistral")


# ═══════════════════════════════════════════════════════════════════════════════
# RESPONSE — Structure JSON retournée par Mistral
# ═══════════════════════════════════════════════════════════════════════════════

class SimilarityItem(BaseModel):
    theme: str
    description: str
    evidence_a: str
    evidence_b: str
    strength: str  # "forte", "modérée", "faible"

class DifferenceItem(BaseModel):
    topic: str
    position_a: str
    position_b: str
    significance: str  # "majeure", "mineure", "contextuelle"

class ContradictionItem(BaseModel):
    topic: str
    claim_a: str
    claim_b: str
    severity: str  # "directe", "nuancée", "contextuelle"
    context: str

class ReliabilityAssessment(BaseModel):
    score_a: float = Field(..., ge=0, le=10)
    score_b: float = Field(..., ge=0, le=10)
    reasoning: str

class ComparisonResult(BaseModel):
    similarities: list[SimilarityItem] = []
    differences: list[DifferenceItem] = []
    contradictions: list[ContradictionItem] = []
    reliability: Optional[ReliabilityAssessment] = None
    verdict: str = ""  # Synthèse 3-5 phrases


# ═══════════════════════════════════════════════════════════════════════════════
# API RESPONSES
# ═══════════════════════════════════════════════════════════════════════════════

class ComparisonResponse(BaseModel):
    id: int
    video_a: dict  # {id, title, channel, thumbnail_url}
    video_b: dict
    result: ComparisonResult
    model_used: str
    credits_used: int
    lang: str
    created_at: datetime

class ComparisonHistoryItem(BaseModel):
    id: int
    video_a_title: str
    video_b_title: str
    video_a_thumbnail: Optional[str] = None
    video_b_thumbnail: Optional[str] = None
    model_used: str
    credits_used: int
    created_at: datetime
