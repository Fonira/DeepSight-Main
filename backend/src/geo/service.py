"""Service GEO — orchestration du scoring, rapport et benchmark."""

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary
from .schemas import GeoScoreResponse, GeoReportResponse, GeoReportAction
from .scorer import compute_geo_score
from .report import generate_geo_report
from .benchmark import benchmark_geo

log = logging.getLogger("geo")


def _parse_entities(summary: Summary) -> dict | None:
    """Parse les entités JSON depuis le Summary."""
    if not summary.entities_extracted:
        return None
    try:
        return (
            json.loads(summary.entities_extracted)
            if isinstance(summary.entities_extracted, str)
            else summary.entities_extracted
        )
    except (json.JSONDecodeError, TypeError):
        return None


def _get_summary_field(summary: Summary, field: str, default=None):
    """Accès safe à un champ du Summary (certains sont optionnels)."""
    return getattr(summary, field, default)


async def _get_summary(summary_id: int, user_id: int, db: AsyncSession) -> Summary:
    """Récupère un Summary ou lève ValueError."""
    result = await db.execute(
        select(Summary).where(Summary.id == summary_id, Summary.user_id == user_id)
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise ValueError(f"Analyse {summary_id} introuvable")
    return summary


async def get_geo_score(summary_id: int, user_id: int, db: AsyncSession) -> GeoScoreResponse:
    """Calcule le score GEO pour une analyse existante. Aucun appel API."""
    summary = await _get_summary(summary_id, user_id, db)
    entities = _parse_entities(summary)

    return compute_geo_score(
        summary_id=summary.id,
        video_id=summary.video_id,
        video_title=summary.video_title or "Sans titre",
        summary_content=summary.summary_content or "",
        word_count=summary.word_count,
        reliability_score=summary.reliability_score,
        fact_check_result=summary.fact_check_result,
        entities=entities,
        category=summary.category,
        category_confidence=summary.category_confidence,
        structured_index=summary.structured_index,
        full_digest=summary.full_digest,
        video_upload_date=_get_summary_field(summary, "video_upload_date"),
        engagement_rate=_get_summary_field(summary, "engagement_rate"),
        view_count=_get_summary_field(summary, "view_count"),
    )


async def get_geo_report(
    summary_id: int, user_id: int, db: AsyncSession
) -> GeoReportResponse | None:
    """Génère un rapport GEO complet via Mistral. Consomme des crédits."""
    # 1. Calculer le score GEO d'abord
    geo = await get_geo_score(summary_id, user_id, db)
    summary = await _get_summary(summary_id, user_id, db)

    # 2. Préparer le texte des quotes pour le prompt
    quotes_text = "\n".join(
        f"- [{q.marker}] (score {q.score}) {q.text}" for q in geo.citable_quotes[:10]
    )

    # 3. Extraire un extrait du contenu
    content_excerpt = (summary.summary_content or "")[:2000]

    # 4. Appeler Mistral pour le rapport
    report_data = await generate_geo_report(
        video_title=summary.video_title or "Sans titre",
        category=summary.category,
        reliability_score=summary.reliability_score,
        geo_score=geo.overall_score,
        geo_grade=geo.grade,
        solid_claims=geo.solid_claims,
        total_claims=geo.total_claims,
        quotes_text=quotes_text,
        citability=geo.breakdown.citability,
        structure=geo.breakdown.structure,
        authority=geo.breakdown.authority,
        coverage=geo.breakdown.coverage,
        freshness=geo.breakdown.freshness,
        content_excerpt=content_excerpt,
    )

    if not report_data:
        return None

    # 5. Construire la réponse typée
    action_plan = []
    for action in report_data.get("action_plan", []):
        if isinstance(action, dict):
            action_plan.append(GeoReportAction(
                action=action.get("action", ""),
                impact=action.get("impact", "medium"),
                effort=action.get("effort", "medium"),
                expected_gain=action.get("expected_gain", 5),
            ))

    return GeoReportResponse(
        summary_id=summary_id,
        video_id=summary.video_id,
        video_title=summary.video_title or "Sans titre",
        geo_score=geo.overall_score,
        geo_grade=geo.grade,
        summary=report_data.get("summary", ""),
        strengths=report_data.get("strengths", []),
        weaknesses=report_data.get("weaknesses", []),
        action_plan=action_plan,
        optimized_description=report_data.get("optimized_description", ""),
        suggested_chapters=report_data.get("suggested_chapters", []),
        target_queries=report_data.get("target_queries", []),
    )


async def get_geo_benchmark(
    summary_id: int, user_id: int, db: AsyncSession
) -> dict:
    """Compare le score GEO avec les autres analyses du même utilisateur."""
    return await benchmark_geo(summary_id, user_id, db)


async def get_geo_visibility(
    summary_id: int, user_id: int, db: AsyncSession
) -> dict:
    """Vérifie la visibilité d'une vidéo dans les moteurs de recherche."""
    from .monitor import check_ai_visibility

    summary = await _get_summary(summary_id, user_id, db)

    return await check_ai_visibility(
        video_title=summary.video_title or "Sans titre",
        video_channel=summary.video_channel or "",
        video_id=summary.video_id,
    )
