"""
Trending Router -- Most-analyzed videos on DeepSight
GET /api/trending  -> Public endpoint, aggregated data only
Privacy: Only shows video metadata + aggregated counts, never user-specific data.

Cache: Redis via cache_service (shared across all Uvicorn workers).
Fallback: on cache miss -> DB query -> cache result for 1 hour.
Pre-cache: see trending_precache.py (APScheduler job every hour).
"""

import logging
from typing import Optional, List
from datetime import datetime, timedelta

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc

from core.cache import cache_service, make_cache_key
from db.database import async_session_maker, Summary, TranscriptCache

logger = logging.getLogger("deepsight.trending")

router = APIRouter()

# Cache configuration
CACHE_TTL = 3600  # 1 hour
CACHE_PREFIX = "trending:deepsight"


class TrendingVideo(BaseModel):
    video_id: str
    title: str
    channel: str
    thumbnail_url: Optional[str] = None
    category: Optional[str] = None
    duration: Optional[int] = None
    view_count: Optional[int] = None
    upload_date: Optional[str] = None
    analysis_count: int
    unique_users: int
    avg_reliability_score: Optional[float] = None
    latest_analyzed_at: str
    is_cached: bool = True


class TrendingResponse(BaseModel):
    videos: List[TrendingVideo]
    period: str
    total_cached_videos: int
    generated_at: str


async def _query_trending_from_db(
    period: str,
    category: Optional[str],
    limit: int,
) -> TrendingResponse:
    """Execute the trending DB query. Extracted for reuse by precache job."""
    date_filter = None
    if period == "7d":
        date_filter = datetime.utcnow() - timedelta(days=7)
    elif period == "30d":
        date_filter = datetime.utcnow() - timedelta(days=30)

    async with async_session_maker() as session:
        query = (
            select(
                Summary.video_id,
                func.max(Summary.video_title).label("title"),
                func.max(Summary.video_channel).label("channel"),
                func.max(Summary.thumbnail_url).label("thumbnail_url"),
                func.max(Summary.category).label("category"),
                func.max(Summary.video_duration).label("duration"),
                func.count(Summary.id).label("analysis_count"),
                func.count(func.distinct(Summary.user_id)).label("unique_users"),
                func.avg(Summary.reliability_score).label("avg_reliability"),
                func.max(Summary.created_at).label("latest_at"),
                func.max(TranscriptCache.view_count).label("cache_view_count"),
                func.max(TranscriptCache.upload_date).label("cache_upload_date"),
            )
            .outerjoin(TranscriptCache, Summary.video_id == TranscriptCache.video_id)
            .where(Summary.video_id.isnot(None))
            .where(Summary.video_title.isnot(None))
        )

        if date_filter:
            query = query.where(Summary.created_at >= date_filter)
        if category:
            query = query.where(Summary.category == category)

        query = query.group_by(Summary.video_id).order_by(desc("analysis_count")).limit(limit)

        result = await session.execute(query)
        rows = result.all()

        total_cached = await session.execute(select(func.count(TranscriptCache.id)))
        total = total_cached.scalar() or 0

    videos = []
    for row in rows:
        # Use YouTube thumbnail URL if stored one looks like base64
        thumb = row.thumbnail_url
        if thumb and len(thumb) > 500:
            thumb = f"https://img.youtube.com/vi/{row.video_id}/mqdefault.jpg"

        videos.append(
            TrendingVideo(
                video_id=row.video_id,
                title=row.title or "Unknown",
                channel=row.channel or "Unknown",
                thumbnail_url=thumb,
                category=row.category,
                duration=row.duration,
                view_count=row.cache_view_count,
                upload_date=row.cache_upload_date,
                analysis_count=row.analysis_count,
                unique_users=row.unique_users,
                avg_reliability_score=round(row.avg_reliability, 1) if row.avg_reliability else None,
                latest_analyzed_at=row.latest_at.isoformat() if row.latest_at else "",
            )
        )

    return TrendingResponse(
        videos=videos,
        period=period,
        total_cached_videos=total,
        generated_at=datetime.utcnow().isoformat(),
    )


def build_trending_cache_key(period: str, category: Optional[str], limit: int) -> str:
    """Build a deterministic Redis cache key for a trending query."""
    cat = category or "all"
    return make_cache_key(CACHE_PREFIX, period, cat, str(limit))


@router.get("", response_model=TrendingResponse)
async def get_trending(
    period: str = Query("30d", pattern="^(7d|30d|all)$"),
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
) -> TrendingResponse:
    """
    Public endpoint -- no auth required.
    Returns most-analyzed videos aggregated from summaries.
    Only shows videos analyzed by 2+ distinct users.
    """
    cache_key = build_trending_cache_key(period, category, limit)

    # --- Redis cache lookup ---
    cached = await cache_service.get(cache_key)
    if cached is not None:
        logger.debug("[TRENDING] Cache hit key=%s", cache_key)
        return TrendingResponse(**cached)

    # --- Cache miss: query DB ---
    logger.info("[TRENDING] Cache miss key=%s — querying DB", cache_key)
    response = await _query_trending_from_db(period, category, limit)

    # Store in Redis (serialise via Pydantic .model_dump())
    await cache_service.set(cache_key, response.model_dump(), ttl=CACHE_TTL)

    return response
