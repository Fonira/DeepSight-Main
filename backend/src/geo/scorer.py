"""Algorithme de scoring GEO pour DeepSight.

Calcule un score GEO (0-100) en 5 dimensions à partir des données
d'analyse existantes (Summary). Aucun appel API supplémentaire.
"""

import json
import re
from datetime import datetime, timezone

from .citable_quotes import extract_citable_quotes
from .schemas import (
    CitableQuote,
    GeoRecommendation,
    GeoScoreBreakdown,
    GeoScoreResponse,
)

# Poids des dimensions
W_CITABILITY = 0.30
W_STRUCTURE = 0.25
W_AUTHORITY = 0.20
W_COVERAGE = 0.15
W_FRESHNESS = 0.10

# Regex marqueurs épistémiques (comptage)
_SOLID_COUNT_RE = re.compile(r"✅\s*(?:SOLIDE|SOLID)", re.IGNORECASE)
_ALL_MARKERS_RE = re.compile(r"[✅⚖️❓⚠️]\s*(?:SOLIDE|SOLID|PLAUSIBLE|INCERTAIN|UNCERTAIN|À VÉRIFIER|TO VERIFY)", re.IGNORECASE)


def _score_citability(summary_content: str, quotes: list[CitableQuote]) -> tuple[float, int, int]:
    """Score citabilité (0-100) basé sur les marqueurs épistémiques."""
    total_markers = len(_ALL_MARKERS_RE.findall(summary_content))
    solid_markers = len(_SOLID_COUNT_RE.findall(summary_content))

    if total_markers == 0:
        return 30.0, 0, 0  # Pas de marqueurs = score moyen-bas

    # Ratio SOLID / total
    solid_ratio = solid_markers / total_markers

    # Bonus pour les quotes avec stats
    stats_ratio = sum(1 for q in quotes if q.has_stats) / max(len(quotes), 1)

    # Bonus pour les quotes self-contained
    sc_ratio = sum(1 for q in quotes if q.is_self_contained) / max(len(quotes), 1)

    score = (solid_ratio * 50) + (stats_ratio * 25) + (sc_ratio * 25)
    return min(100.0, round(score, 1)), total_markers, solid_markers


def _score_structure(
    summary_content: str,
    word_count: int | None,
    structured_index: str | None,
    full_digest: str | None,
) -> float:
    """Score structure (0-100) basé sur l'organisation du contenu."""
    score = 0.0

    # Chapitres / structured_index (+30)
    if structured_index:
        try:
            chapters = json.loads(structured_index)
            if isinstance(chapters, list) and len(chapters) >= 3:
                score += 30
            elif isinstance(chapters, list) and len(chapters) >= 1:
                score += 15
        except (json.JSONDecodeError, TypeError):
            pass

    # Full digest (+20)
    if full_digest and len(full_digest) > 500:
        score += 20

    # Titres/sections dans le summary (## ou **) (+20)
    headings = len(re.findall(r"(?:^|\n)(?:#{1,3}\s|[*]{2}.+[*]{2})", summary_content))
    score += min(20, headings * 5)

    # Longueur adéquate (+15) — ni trop court ni trop long sans structure
    wc = word_count or len(summary_content.split())
    if 300 <= wc <= 2000:
        score += 15
    elif 100 <= wc < 300:
        score += 8
    elif wc > 2000 and headings >= 3:
        score += 12

    # Listes à puces (+15)
    bullets = len(re.findall(r"(?:^|\n)\s*[-•*]\s", summary_content))
    score += min(15, bullets * 3)

    return min(100.0, round(score, 1))


def _score_authority(
    reliability_score: float | None,
    fact_check_result: str | None,
    entities: dict | None,
) -> float:
    """Score autorité (0-100) basé sur fiabilité, fact-check et entités."""
    score = 0.0

    # Reliability score existant (+40)
    if reliability_score is not None:
        score += (reliability_score / 100) * 40

    # Fact-check réalisé (+30)
    if fact_check_result and len(fact_check_result) > 50:
        score += 30
    elif fact_check_result:
        score += 15

    # Entités nommées (+30) — experts, organisations = autorité
    if entities:
        entity_types = 0
        total_entities = 0
        if isinstance(entities, dict):
            for etype, elist in entities.items():
                if isinstance(elist, list) and len(elist) > 0:
                    entity_types += 1
                    total_entities += len(elist)
        # Diversité des types d'entités
        score += min(15, entity_types * 5)
        # Volume d'entités
        score += min(15, total_entities * 2)

    return min(100.0, round(score, 1))


def _score_coverage(
    entities: dict | None,
    category: str | None,
    category_confidence: float | None,
    word_count: int | None,
) -> float:
    """Score couverture thématique (0-100)."""
    score = 0.0

    # Catégorie identifiée avec confiance (+30)
    if category and category != "unknown":
        score += 15
        if category_confidence and category_confidence > 0.7:
            score += 15
        elif category_confidence and category_confidence > 0.4:
            score += 8

    # Richesse des entités = couverture du sujet (+40)
    if entities and isinstance(entities, dict):
        total = sum(len(v) for v in entities.values() if isinstance(v, list))
        score += min(40, total * 4)

    # Profondeur du contenu (+30)
    wc = word_count or 0
    if wc >= 1000:
        score += 30
    elif wc >= 500:
        score += 20
    elif wc >= 200:
        score += 10

    return min(100.0, round(score, 1))


def _score_freshness(
    video_upload_date: str | None,
    engagement_rate: float | None,
    view_count: int | None,
) -> float:
    """Score fraîcheur & engagement (0-100)."""
    score = 0.0

    # Fraîcheur (+50) — décroissance par mois
    if video_upload_date:
        try:
            upload = datetime.fromisoformat(video_upload_date.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            days_old = (now - upload).days
            if days_old <= 30:
                score += 50
            elif days_old <= 90:
                score += 40
            elif days_old <= 180:
                score += 30
            elif days_old <= 365:
                score += 20
            else:
                score += max(5, 20 - (days_old - 365) // 90)
        except (ValueError, TypeError):
            score += 15  # Date inconnue, score neutre

    # Engagement (+30)
    if engagement_rate and engagement_rate > 0:
        if engagement_rate >= 0.05:
            score += 30
        elif engagement_rate >= 0.02:
            score += 20
        elif engagement_rate >= 0.01:
            score += 10
        else:
            score += 5

    # Visibilité (+20)
    if view_count and view_count > 0:
        if view_count >= 1_000_000:
            score += 20
        elif view_count >= 100_000:
            score += 15
        elif view_count >= 10_000:
            score += 10
        elif view_count >= 1_000:
            score += 5

    return min(100.0, round(score, 1))


def _grade(score: float) -> str:
    """Convertit un score 0-100 en grade A/B/C/D/F."""
    if score >= 80:
        return "A"
    if score >= 65:
        return "B"
    if score >= 50:
        return "C"
    if score >= 35:
        return "D"
    return "F"


def _generate_recommendations(
    breakdown: GeoScoreBreakdown,
    total_claims: int,
    solid_claims: int,
    quotes: list[CitableQuote],
) -> list[GeoRecommendation]:
    """Génère des recommandations actionnables basées sur le scoring."""
    recs: list[GeoRecommendation] = []

    # Citabilité
    if breakdown.citability < 50:
        if total_claims == 0:
            recs.append(GeoRecommendation(
                category="citability",
                priority="high",
                message="La vidéo ne contient aucun claim marqué. Ajouter des affirmations factuelles sourcées améliorerait considérablement la citabilité IA.",
                impact_estimate=20,
            ))
        elif solid_claims < total_claims * 0.3:
            recs.append(GeoRecommendation(
                category="citability",
                priority="high",
                message=f"Seulement {solid_claims}/{total_claims} claims sont SOLID. Sourcer davantage les affirmations augmenterait la citabilité.",
                impact_estimate=15,
            ))

    quotes_without_stats = [q for q in quotes if q.marker == "SOLID" and not q.has_stats]
    if len(quotes_without_stats) >= 3:
        recs.append(GeoRecommendation(
            category="citability",
            priority="medium",
            message=f"{len(quotes_without_stats)} claims SOLID sans chiffres. Ajouter des statistiques précises les rendrait plus citables.",
            impact_estimate=10,
        ))

    # Structure
    if breakdown.structure < 50:
        recs.append(GeoRecommendation(
            category="structure",
            priority="high",
            message="Structurer le contenu en chapitres avec des réponses directes aux questions. Les IA préfèrent le contenu bien organisé.",
            impact_estimate=15,
        ))

    # Autorité
    if breakdown.authority < 40:
        recs.append(GeoRecommendation(
            category="sourcing",
            priority="high",
            message="Renforcer l'autorité : citer des experts nommés, référencer des études, ajouter des sources vérifiables.",
            impact_estimate=20,
        ))

    # Couverture
    if breakdown.coverage < 40:
        recs.append(GeoRecommendation(
            category="coverage",
            priority="medium",
            message="La couverture thématique est limitée. Approfondir le sujet avec des sous-thèmes et des exemples concrets.",
            impact_estimate=10,
        ))

    # Fraîcheur
    if breakdown.freshness < 30:
        recs.append(GeoRecommendation(
            category="freshness",
            priority="low",
            message="Le contenu est ancien ou peu engageant. Les IA privilégient le contenu frais et populaire.",
            impact_estimate=5,
        ))

    recs.sort(key=lambda r: r.impact_estimate, reverse=True)
    return recs[:6]


def compute_geo_score(
    summary_id: int,
    video_id: str,
    video_title: str,
    summary_content: str,
    word_count: int | None = None,
    reliability_score: float | None = None,
    fact_check_result: str | None = None,
    entities: dict | None = None,
    category: str | None = None,
    category_confidence: float | None = None,
    structured_index: str | None = None,
    full_digest: str | None = None,
    video_upload_date: str | None = None,
    engagement_rate: float | None = None,
    view_count: int | None = None,
) -> GeoScoreResponse:
    """Calcule le score GEO complet d'une vidéo à partir de son analyse."""

    # 1. Extraire les quotes citables
    quotes = extract_citable_quotes(summary_content)

    # 2. Scorer chaque dimension
    citability, total_claims, solid_claims = _score_citability(summary_content, quotes)
    structure = _score_structure(summary_content, word_count, structured_index, full_digest)
    authority = _score_authority(reliability_score, fact_check_result, entities)
    coverage = _score_coverage(entities, category, category_confidence, word_count)
    freshness = _score_freshness(video_upload_date, engagement_rate, view_count)

    # 3. Score global pondéré
    overall = (
        citability * W_CITABILITY
        + structure * W_STRUCTURE
        + authority * W_AUTHORITY
        + coverage * W_COVERAGE
        + freshness * W_FRESHNESS
    )
    overall = round(overall, 1)

    breakdown = GeoScoreBreakdown(
        citability=citability,
        structure=structure,
        authority=authority,
        coverage=coverage,
        freshness=freshness,
    )

    # 4. Recommandations
    recommendations = _generate_recommendations(breakdown, total_claims, solid_claims, quotes)

    return GeoScoreResponse(
        summary_id=summary_id,
        video_id=video_id,
        video_title=video_title,
        overall_score=overall,
        grade=_grade(overall),
        breakdown=breakdown,
        total_claims=total_claims,
        solid_claims=solid_claims,
        citable_quotes=quotes,
        recommendations=recommendations,
    )
