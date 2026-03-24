"""
Gamification router — /api/gamification endpoints.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User, Badge, UserBadge, UserStudyStats
from auth.dependencies import get_current_user
from gamification.service import (
    get_or_create_stats,
    get_video_mastery,
    get_heat_map,
    xp_for_next_level,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class StatsResponse(BaseModel):
    success: bool = True
    total_xp: int = 0
    level: int = 1
    xp_for_next_level: int = 500
    current_streak: int = 0
    longest_streak: int = 0
    total_cards_reviewed: int = 0
    total_cards_mastered: int = 0
    total_sessions: int = 0
    total_time_seconds: int = 0
    streak_freeze_available: int = 0


class HeatMapDay(BaseModel):
    date: str
    cards_reviewed: int = 0
    xp_earned: int = 0
    sessions_count: int = 0
    time_seconds: int = 0


class HeatMapResponse(BaseModel):
    success: bool = True
    days: List[HeatMapDay] = []


class BadgeItem(BaseModel):
    code: str
    name: str
    description: str
    icon: str
    rarity: str
    category: str
    earned: bool = False
    earned_at: Optional[str] = None
    progress: Optional[float] = None  # 0-1 for threshold badges


class BadgesResponse(BaseModel):
    success: bool = True
    badges: List[BadgeItem] = []
    earned_count: int = 0
    total_count: int = 0


class VideoMasteryItem(BaseModel):
    summary_id: int
    title: str = ""
    channel: str = ""
    thumbnail: Optional[str] = None
    total_cards: int = 0
    mastered_cards: int = 0
    due_cards: int = 0
    mastery_percent: float = 0.0
    last_studied: Optional[str] = None


class VideoMasteryResponse(BaseModel):
    success: bool = True
    videos: List[VideoMasteryItem] = []


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get user gamification stats (XP, level, streak, totals)."""
    try:
        stats = await get_or_create_stats(session, current_user.id)
        return StatsResponse(
            total_xp=stats.total_xp or 0,
            level=stats.level or 1,
            xp_for_next_level=xp_for_next_level(
                stats.total_xp or 0, stats.level or 1
            ),
            current_streak=stats.current_streak or 0,
            longest_streak=stats.longest_streak or 0,
            total_cards_reviewed=stats.total_cards_reviewed or 0,
            total_cards_mastered=stats.total_cards_mastered or 0,
            total_sessions=stats.total_sessions or 0,
            total_time_seconds=stats.total_time_seconds or 0,
            streak_freeze_available=stats.streak_freeze_available or 0,
        )
    except Exception as e:
        logger.exception("Failed to get gamification stats")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/heat-map", response_model=HeatMapResponse)
async def get_heat_map_endpoint(
    days: int = 35,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get daily activity heat-map data."""
    try:
        days = min(max(days, 7), 365)  # clamp between 7 and 365
        data = await get_heat_map(session, current_user.id, days)
        return HeatMapResponse(
            days=[HeatMapDay(**d) for d in data],
        )
    except Exception as e:
        logger.exception("Failed to get heat-map")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/badges", response_model=BadgesResponse)
async def get_badges(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get all badges with earned/locked status and progress."""
    try:
        # All badge definitions
        result = await session.execute(select(Badge))
        all_badges = result.scalars().all()

        # Earned badges
        result = await session.execute(
            select(UserBadge).where(UserBadge.user_id == current_user.id)
        )
        earned_map = {ub.badge_id: ub for ub in result.scalars().all()}

        # Stats for progress calculation
        stats = await get_or_create_stats(session, current_user.id)

        items = []
        for badge in all_badges:
            ub = earned_map.get(badge.id)
            earned = ub is not None

            # Calculate progress for threshold badges
            progress = None
            if badge.condition_type == "threshold" and not earned:
                progress = _calc_progress(badge, stats)

            items.append(BadgeItem(
                code=badge.code,
                name=badge.name,
                description=badge.description,
                icon=badge.icon,
                rarity=badge.rarity,
                category=badge.category,
                earned=earned,
                earned_at=ub.earned_at.isoformat() if earned and ub.earned_at else None,
                progress=progress,
            ))

        earned_count = sum(1 for i in items if i.earned)
        return BadgesResponse(
            badges=items,
            earned_count=earned_count,
            total_count=len(items),
        )
    except Exception as e:
        logger.exception("Failed to get badges")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/video-mastery", response_model=VideoMasteryResponse)
async def get_video_mastery_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get mastery percentage per video."""
    try:
        data = await get_video_mastery(session, current_user.id)
        return VideoMasteryResponse(
            videos=[VideoMasteryItem(**d) for d in data],
        )
    except Exception as e:
        logger.exception("Failed to get video mastery")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _calc_progress(badge: Badge, stats: UserStudyStats) -> Optional[float]:
    """Calculate 0-1 progress for threshold badges."""
    code = badge.code
    target = badge.condition_value or 1

    if code == "first_flip":
        current = stats.total_cards_reviewed or 0
    elif code.startswith("streak_"):
        current = stats.current_streak or 0
    elif code.startswith("cards_"):
        current = stats.total_cards_mastered or 0
    elif code == "multi_video":
        # We don't have distinct_videos in stats — leave None
        return None
    else:
        return None

    return min(round(current / target, 2), 1.0)
