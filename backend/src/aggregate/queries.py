"""
DB queries for aggregator pages.

Joins SharedAnalysis (is_active=true) with Summary on (user_id, video_id) to
expose channel + category metadata that SharedAnalysis itself doesn't store.
The JOIN is covered by `idx_shared_analyses_user_video` and
`idx_summaries_user_video`.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import SharedAnalysis, Summary
from aggregate.slug import to_slug


# ─── Models for templating ───────────────────────────────────────────────────


class ChannelInfo:
    """Lightweight DTO consumed by the Jinja2 template."""

    __slots__ = ("name", "slug", "analyses_count", "total_views")

    def __init__(self, name: str, slug: str, analyses_count: int, total_views: int) -> None:
        self.name = name
        self.slug = slug
        self.analyses_count = analyses_count
        self.total_views = total_views


class AnalysisRef:
    __slots__ = (
        "share_token",
        "video_id",
        "video_title",
        "video_thumbnail",
        "verdict",
        "view_count",
        "channel",
        "category",
        "platform",
        "created_at",
    )

    def __init__(
        self,
        share_token: str,
        video_id: str,
        video_title: Optional[str],
        video_thumbnail: Optional[str],
        verdict: Optional[str],
        view_count: int,
        channel: Optional[str],
        category: Optional[str],
        platform: Optional[str],
        created_at,
    ) -> None:
        self.share_token = share_token
        self.video_id = video_id
        self.video_title = video_title
        self.video_thumbnail = video_thumbnail
        self.verdict = verdict
        self.view_count = view_count
        self.channel = channel
        self.category = category
        self.platform = platform
        self.created_at = created_at


# ─── Channels ────────────────────────────────────────────────────────────────


async def list_channels(db: AsyncSession, *, min_analyses: int = 1, limit: int = 200) -> list[ChannelInfo]:
    """List public channels ranked by number of public analyses, then views.

    Only channels with `is_active=true` SharedAnalysis are returned.
    Channels with fewer than `min_analyses` public analyses are filtered out
    (low-signal pages).
    """
    stmt = (
        select(
            Summary.video_channel.label("channel"),
            func.count(SharedAnalysis.id).label("analyses_count"),
            func.coalesce(func.sum(SharedAnalysis.view_count), 0).label("total_views"),
        )
        .select_from(SharedAnalysis)
        .join(
            Summary,
            and_(
                Summary.user_id == SharedAnalysis.user_id,
                Summary.video_id == SharedAnalysis.video_id,
            ),
        )
        .where(SharedAnalysis.is_active.is_(True))
        .where(Summary.video_channel.isnot(None))
        .where(Summary.video_channel != "")
        .group_by(Summary.video_channel)
        .having(func.count(SharedAnalysis.id) >= min_analyses)
        .order_by(desc("analyses_count"), desc("total_views"))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        ChannelInfo(
            name=row.channel,
            slug=to_slug(row.channel),
            analyses_count=int(row.analyses_count),
            total_views=int(row.total_views or 0),
        )
        for row in rows
    ]


async def find_channel_by_slug(db: AsyncSession, slug: str) -> Optional[ChannelInfo]:
    """Resolve a slug to a channel (slug is computed on the fly, not stored)."""
    if not slug:
        return None
    channels = await list_channels(db, min_analyses=1, limit=10000)
    for ch in channels:
        if ch.slug == slug:
            return ch
    return None


async def list_analyses_for_channel(db: AsyncSession, channel_name: str, *, limit: int = 50) -> list[AnalysisRef]:
    """List public analyses for a given channel, sorted by view_count desc."""
    stmt = (
        select(
            SharedAnalysis.share_token,
            SharedAnalysis.video_id,
            SharedAnalysis.video_title,
            SharedAnalysis.video_thumbnail,
            SharedAnalysis.verdict,
            SharedAnalysis.view_count,
            Summary.video_channel.label("channel"),
            Summary.category,
            Summary.platform,
            SharedAnalysis.created_at,
        )
        .select_from(SharedAnalysis)
        .join(
            Summary,
            and_(
                Summary.user_id == SharedAnalysis.user_id,
                Summary.video_id == SharedAnalysis.video_id,
            ),
        )
        .where(SharedAnalysis.is_active.is_(True))
        .where(Summary.video_channel == channel_name)
        .order_by(desc(SharedAnalysis.view_count), desc(SharedAnalysis.created_at))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        AnalysisRef(
            share_token=row.share_token,
            video_id=row.video_id,
            video_title=row.video_title,
            video_thumbnail=row.video_thumbnail,
            verdict=row.verdict,
            view_count=int(row.view_count or 0),
            channel=row.channel,
            category=row.category,
            platform=row.platform,
            created_at=row.created_at,
        )
        for row in rows
    ]


# ─── Categories ──────────────────────────────────────────────────────────────


class CategoryInfo:
    __slots__ = ("name", "slug", "analyses_count", "total_views")

    def __init__(self, name: str, slug: str, analyses_count: int, total_views: int) -> None:
        self.name = name
        self.slug = slug
        self.analyses_count = analyses_count
        self.total_views = total_views


async def list_categories(db: AsyncSession, *, min_analyses: int = 1, limit: int = 100) -> list[CategoryInfo]:
    stmt = (
        select(
            Summary.category.label("category"),
            func.count(SharedAnalysis.id).label("analyses_count"),
            func.coalesce(func.sum(SharedAnalysis.view_count), 0).label("total_views"),
        )
        .select_from(SharedAnalysis)
        .join(
            Summary,
            and_(
                Summary.user_id == SharedAnalysis.user_id,
                Summary.video_id == SharedAnalysis.video_id,
            ),
        )
        .where(SharedAnalysis.is_active.is_(True))
        .where(Summary.category.isnot(None))
        .where(Summary.category != "")
        .group_by(Summary.category)
        .having(func.count(SharedAnalysis.id) >= min_analyses)
        .order_by(desc("analyses_count"), desc("total_views"))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        CategoryInfo(
            name=row.category,
            slug=to_slug(row.category),
            analyses_count=int(row.analyses_count),
            total_views=int(row.total_views or 0),
        )
        for row in rows
    ]


async def find_category_by_slug(db: AsyncSession, slug: str) -> Optional[CategoryInfo]:
    if not slug:
        return None
    categories = await list_categories(db, min_analyses=1, limit=1000)
    for cat in categories:
        if cat.slug == slug:
            return cat
    return None


async def list_analyses_for_category(db: AsyncSession, category_name: str, *, limit: int = 50) -> list[AnalysisRef]:
    stmt = (
        select(
            SharedAnalysis.share_token,
            SharedAnalysis.video_id,
            SharedAnalysis.video_title,
            SharedAnalysis.video_thumbnail,
            SharedAnalysis.verdict,
            SharedAnalysis.view_count,
            Summary.video_channel.label("channel"),
            Summary.category,
            Summary.platform,
            SharedAnalysis.created_at,
        )
        .select_from(SharedAnalysis)
        .join(
            Summary,
            and_(
                Summary.user_id == SharedAnalysis.user_id,
                Summary.video_id == SharedAnalysis.video_id,
            ),
        )
        .where(SharedAnalysis.is_active.is_(True))
        .where(Summary.category == category_name)
        .order_by(desc(SharedAnalysis.view_count), desc(SharedAnalysis.created_at))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        AnalysisRef(
            share_token=row.share_token,
            video_id=row.video_id,
            video_title=row.video_title,
            video_thumbnail=row.video_thumbnail,
            verdict=row.verdict,
            view_count=int(row.view_count or 0),
            channel=row.channel,
            category=row.category,
            platform=row.platform,
            created_at=row.created_at,
        )
        for row in rows
    ]
