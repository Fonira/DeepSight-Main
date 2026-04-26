"""Benchmark GEO — comparer le score GEO entre plusieurs vidéos.

Permet de situer une vidéo par rapport à ses concurrentes
sur le même sujet.
"""

import logging

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary
from .scorer import compute_geo_score

log = logging.getLogger("geo")


async def benchmark_geo(
    summary_id: int,
    user_id: int,
    db: AsyncSession,
    max_comparisons: int = 5,
) -> dict:
    """Compare le score GEO d'une vidéo avec les autres analyses du même user.

    Retourne le score de la vidéo cible + les scores des vidéos comparées,
    triées par score GEO décroissant.
    """
    # Récupérer la vidéo cible
    result = await db.execute(select(Summary).where(Summary.id == summary_id, Summary.user_id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise ValueError(f"Analyse {summary_id} introuvable")

    # Récupérer les autres analyses du même user (même catégorie si possible)
    query = (
        select(Summary)
        .where(
            Summary.user_id == user_id,
            Summary.id != summary_id,
            Summary.summary_content.isnot(None),
        )
        .order_by(desc(Summary.created_at))
        .limit(max_comparisons * 2)
    )

    # Prioriser la même catégorie
    if target.category:
        same_cat_query = query.where(Summary.category == target.category)
        same_cat_result = await db.execute(same_cat_query)
        comparisons = list(same_cat_result.scalars().all())

        if len(comparisons) < max_comparisons:
            other_result = await db.execute(query)
            all_others = list(other_result.scalars().all())
            existing_ids = {c.id for c in comparisons}
            for s in all_others:
                if s.id not in existing_ids and len(comparisons) < max_comparisons:
                    comparisons.append(s)
    else:
        comp_result = await db.execute(query)
        comparisons = list(comp_result.scalars().all())[:max_comparisons]

    # Calculer le score GEO pour chaque vidéo
    def _quick_score(s: Summary) -> dict:
        import json

        entities = None
        if s.entities_extracted:
            try:
                entities = (
                    json.loads(s.entities_extracted) if isinstance(s.entities_extracted, str) else s.entities_extracted
                )
            except (json.JSONDecodeError, TypeError):
                pass

        geo = compute_geo_score(
            summary_id=s.id,
            video_id=s.video_id,
            video_title=s.video_title or "Sans titre",
            summary_content=s.summary_content or "",
            word_count=s.word_count,
            reliability_score=s.reliability_score,
            fact_check_result=s.fact_check_result,
            entities=entities,
            category=s.category,
            category_confidence=s.category_confidence,
            structured_index=s.structured_index,
            full_digest=s.full_digest,
            video_upload_date=(s.video_upload_date if hasattr(s, "video_upload_date") else None),
            engagement_rate=s.engagement_rate if hasattr(s, "engagement_rate") else None,
            view_count=s.view_count if hasattr(s, "view_count") else None,
        )
        return {
            "summary_id": s.id,
            "video_id": s.video_id,
            "video_title": s.video_title or "Sans titre",
            "category": s.category,
            "overall_score": geo.overall_score,
            "grade": geo.grade,
            "breakdown": geo.breakdown.model_dump(),
        }

    target_score = _quick_score(target)
    comparison_scores = [_quick_score(s) for s in comparisons]
    comparison_scores.sort(key=lambda x: x["overall_score"], reverse=True)

    # Calculer le rang
    all_scores = [target_score["overall_score"]] + [c["overall_score"] for c in comparison_scores]
    all_scores.sort(reverse=True)
    rank = all_scores.index(target_score["overall_score"]) + 1

    return {
        "target": target_score,
        "comparisons": comparison_scores[:max_comparisons],
        "rank": rank,
        "total": len(comparison_scores) + 1,
        "percentile": round(((len(all_scores) - rank) / len(all_scores)) * 100, 1),
    }
