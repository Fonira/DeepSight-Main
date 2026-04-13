"""Schemas Pydantic pour le module GEO (Generative Engine Optimization)."""

from typing import Optional

from pydantic import BaseModel, Field


class CitableQuote(BaseModel):
    """Une phrase identifiée comme hautement citable par les moteurs IA."""

    text: str = Field(..., description="La phrase citable extraite")
    score: float = Field(..., ge=0.0, le=1.0, description="Score de citabilité (0-1)")
    marker: str = Field(..., description="Marqueur épistémique (SOLID/PLAUSIBLE/etc.)")
    has_stats: bool = Field(default=False, description="Contient des chiffres/statistiques")
    is_self_contained: bool = Field(
        default=False, description="Phrase autonome compréhensible hors contexte"
    )
    improvement_hint: Optional[str] = Field(
        default=None, description="Suggestion d'amélioration pour la citabilité"
    )


class GeoScoreBreakdown(BaseModel):
    """Décomposition du score GEO en 5 dimensions."""

    citability: float = Field(..., ge=0, le=100, description="Score citabilité des claims")
    structure: float = Field(..., ge=0, le=100, description="Score structure & lisibilité")
    authority: float = Field(..., ge=0, le=100, description="Score autorité & sourcing")
    coverage: float = Field(..., ge=0, le=100, description="Score couverture thématique")
    freshness: float = Field(..., ge=0, le=100, description="Score fraîcheur & engagement")


class GeoRecommendation(BaseModel):
    """Recommandation actionable pour améliorer le score GEO."""

    category: str = Field(..., description="sourcing | structure | citability | coverage | freshness")
    priority: str = Field(..., description="high | medium | low")
    message: str
    impact_estimate: float = Field(
        ..., ge=0, le=30, description="Gain potentiel en points GEO"
    )


class GeoScoreResponse(BaseModel):
    """Réponse complète du scoring GEO pour une vidéo analysée."""

    summary_id: int
    video_id: str
    video_title: str
    overall_score: float = Field(..., ge=0, le=100)
    grade: str = Field(..., description="A/B/C/D/F")
    breakdown: GeoScoreBreakdown
    total_claims: int
    solid_claims: int
    citable_quotes: list[CitableQuote]
    recommendations: list[GeoRecommendation]


class GeoScoreRequest(BaseModel):
    """Requête de scoring GEO."""

    summary_id: int


# ─── Phase 2: Rapport & Benchmark ────────────────────────────────────────────


class GeoReportAction(BaseModel):
    """Action concrète du plan d'amélioration GEO."""

    action: str
    impact: str = Field(..., description="high | medium | low")
    effort: str = Field(..., description="easy | medium | hard")
    expected_gain: float = Field(default=5, ge=0, le=30)


class GeoReportResponse(BaseModel):
    """Rapport GEO complet généré par Mistral."""

    summary_id: int
    video_id: str
    video_title: str
    geo_score: float
    geo_grade: str
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    action_plan: list[GeoReportAction]
    optimized_description: str
    suggested_chapters: list[str]
    target_queries: list[str]


class GeoBenchmarkEntry(BaseModel):
    """Score GEO d'une vidéo dans le benchmark."""

    summary_id: int
    video_id: str
    video_title: str
    category: Optional[str] = None
    overall_score: float
    grade: str
    breakdown: GeoScoreBreakdown


class GeoBenchmarkResponse(BaseModel):
    """Résultat du benchmark GEO entre plusieurs vidéos."""

    target: GeoBenchmarkEntry
    comparisons: list[GeoBenchmarkEntry]
    rank: int
    total: int
    percentile: float
