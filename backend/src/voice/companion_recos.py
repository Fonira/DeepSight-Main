"""Orchestration des 4 sources de recos pour COMPANION agent."""
import logging
from typing import Optional, Protocol
from voice.schemas import RecoItem

logger = logging.getLogger(__name__)


class _DBProto(Protocol):
    embedding_service: object
    async def fetch_user_analyzed_video_ids(self, user_id: int) -> set[str]: ...


async def fetch_history_similarity_reco(
    user_id: int,
    db: _DBProto,
    recent_summary_titles: list[str],
) -> Optional[RecoItem]:
    """Reco basée sur similarité embeddings avec analyses passées."""
    if not hasattr(db, "embedding_service"):
        return None

    try:
        candidates = await db.embedding_service.find_similar_videos(
            user_id=user_id,
            seed_titles=recent_summary_titles,
            limit=5,
        )
    except Exception as exc:
        logger.warning("history_similarity fetch failed: %s", exc)
        return None

    if not candidates:
        return None

    excluded = await db.fetch_user_analyzed_video_ids(user_id=user_id)
    for c in candidates:
        if c["video_id"] not in excluded:
            ref_title = recent_summary_titles[0] if recent_summary_titles else "ton historique"
            return RecoItem(
                video_id=c["video_id"],
                title=c["title"],
                channel=c["channel"],
                duration_seconds=c.get("duration", 0),
                source="history_similarity",
                why=f"Similaire à ton analyse « {ref_title} »",
                thumbnail_url=c.get("thumbnail"),
            )
    return None


async def fetch_trending_reco(
    theme: str,
    trending_service,
    excluded_video_ids: set[str],
) -> Optional[RecoItem]:
    """Reco issue du trending pre-cache Redis sur thème user."""
    try:
        items = await trending_service.get_trending(theme=theme, limit=5)
    except Exception as exc:
        logger.warning("trending fetch failed (theme=%s): %s", theme, exc)
        return None

    for item in items or []:
        if item["video_id"] not in excluded_video_ids:
            return RecoItem(
                video_id=item["video_id"],
                title=item["title"],
                channel=item["channel"],
                duration_seconds=item.get("duration", 0),
                source="trending",
                why="En ce moment ça cartonne sur DeepSight",
                thumbnail_url=item.get("thumbnail"),
            )
    return None


async def fetch_tournesol_reco(
    theme: str,
    tournesol_service,
    excluded_video_ids: set[str],
) -> Optional[RecoItem]:
    """Reco issue de l'API Tournesol sur thème user."""
    try:
        items = await tournesol_service.recommend(theme=theme, limit=5)
    except Exception as exc:
        logger.warning("tournesol fetch failed (theme=%s): %s", theme, exc)
        return None

    for item in items or []:
        if item["video_id"] not in excluded_video_ids:
            return RecoItem(
                video_id=item["video_id"],
                title=item["title"],
                channel=item["channel"],
                duration_seconds=item.get("duration", 0),
                source="tournesol",
                why=f"Top score Tournesol sur {theme}",
                thumbnail_url=item.get("thumbnail"),
            )
    return None
