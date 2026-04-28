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
