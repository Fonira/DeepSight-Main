"""Orchestration des 4 sources de recos pour COMPANION agent."""

import asyncio
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


async def fetch_youtube_search_reco(
    topic: str,
    youtube_service,
    excluded_video_ids: set[str],
) -> Optional[RecoItem]:
    """Reco YouTube Search API — fallback du tool, pas pré-fetch."""
    try:
        items = await youtube_service.search(query=topic, limit=5)
    except Exception as exc:
        logger.warning("youtube search failed (topic=%s): %s", topic, exc)
        return None

    for item in items or []:
        if item["video_id"] not in excluded_video_ids:
            return RecoItem(
                video_id=item["video_id"],
                title=item["title"],
                channel=item["channel"],
                duration_seconds=item.get("duration", 0),
                source="youtube",
                why=f"Trouvé sur YouTube pour « {topic} »",
                thumbnail_url=item.get("thumbnail"),
            )
    return None


async def build_initial_recos(
    primary_theme: str,
    history_fn,
    trending_fn,
    tournesol_fn,
    timeout_seconds: float = 2.0,
) -> list[RecoItem]:
    """Run les 3 sources en parallèle avec timeout, drop les None."""

    async def _safe(fn):
        try:
            return await asyncio.wait_for(fn(), timeout=timeout_seconds)
        except (asyncio.TimeoutError, Exception) as exc:
            logger.warning("initial reco source timeout/error: %s", exc)
            return None

    results = await asyncio.gather(
        _safe(history_fn),
        _safe(trending_fn),
        _safe(tournesol_fn),
        return_exceptions=False,
    )
    return [r for r in results if r is not None]


async def get_more_recos_chain(
    topic: str,
    excluded: set[str],
    history_fn,
    tournesol_fn,
    youtube_fn,
    trending_fn,
    max_count: int = 3,
) -> list[RecoItem]:
    """Chaîne fallback : history → tournesol → youtube → trending. Stop quand max_count atteint."""
    accumulator: list[RecoItem] = []
    for fn in (history_fn, tournesol_fn, youtube_fn, trending_fn):
        if len(accumulator) >= max_count:
            break
        try:
            result = await fn()
        except Exception as exc:
            logger.warning("get_more_recos source failed: %s", exc)
            continue
        if result is not None and result.video_id not in excluded:
            accumulator.append(result)
            excluded = excluded | {result.video_id}
    return accumulator[:max_count]
