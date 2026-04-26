"""
Gamification service — XP, streaks, mastery, heat-map.
"""

import logging
import math
from datetime import date, timedelta
from typing import List, Dict, Any, Tuple

from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import (
    UserStudyStats,
    StudyDailyActivity,
    FlashcardReview,
    Summary,
)

logger = logging.getLogger(__name__)

XP_PER_LEVEL = 500


# ═══════════════════════════════════════════════════════════════════════════════
# STATS
# ═══════════════════════════════════════════════════════════════════════════════

async def get_or_create_stats(
    session: AsyncSession,
    user_id: int,
) -> UserStudyStats:
    """Get or create the singleton UserStudyStats row for a user."""
    result = await session.execute(
        select(UserStudyStats).where(UserStudyStats.user_id == user_id)
    )
    stats = result.scalar_one_or_none()

    if stats is None:
        stats = UserStudyStats(user_id=user_id)
        session.add(stats)
        await session.flush()

    return stats


# ═══════════════════════════════════════════════════════════════════════════════
# STREAK
# ═══════════════════════════════════════════════════════════════════════════════

async def update_streak(
    session: AsyncSession,
    user_id: int,
) -> Tuple[int, bool]:
    """
    Update the user's streak based on last_study_date.

    Returns:
        (current_streak, streak_was_updated)
    """
    stats = await get_or_create_stats(session, user_id)
    today = date.today()

    if stats.last_study_date == today:
        # Already studied today — no change
        return stats.current_streak, False

    if stats.last_study_date == today - timedelta(days=1):
        # Consecutive day
        stats.current_streak += 1
    elif (
        stats.last_study_date == today - timedelta(days=2)
        and (stats.streak_freeze_available or 0) > 0
    ):
        # Streak freeze — gap of 2 days, use a freeze
        stats.streak_freeze_available -= 1
        stats.current_streak += 1
        logger.info(
            "Streak freeze used",
            extra={"user_id": user_id, "remaining": stats.streak_freeze_available},
        )
    else:
        # Streak broken
        stats.current_streak = 1

    # Update longest streak
    if stats.current_streak > (stats.longest_streak or 0):
        stats.longest_streak = stats.current_streak

    stats.last_study_date = today
    await session.flush()

    return stats.current_streak, True


# ═══════════════════════════════════════════════════════════════════════════════
# XP & LEVEL
# ═══════════════════════════════════════════════════════════════════════════════

async def add_xp(
    session: AsyncSession,
    user_id: int,
    xp_amount: int,
) -> Tuple[int, int, bool]:
    """
    Add XP to user's stats.

    Returns:
        (total_xp, new_level, leveled_up)
    """
    stats = await get_or_create_stats(session, user_id)

    old_level = stats.level or 1
    stats.total_xp = (stats.total_xp or 0) + xp_amount
    new_level = math.floor(stats.total_xp / XP_PER_LEVEL) + 1
    stats.level = new_level

    await session.flush()

    return stats.total_xp, new_level, new_level > old_level


def xp_for_next_level(total_xp: int, level: int) -> int:
    """XP remaining until next level."""
    return (level * XP_PER_LEVEL) - total_xp


# ═══════════════════════════════════════════════════════════════════════════════
# VIDEO MASTERY
# ═══════════════════════════════════════════════════════════════════════════════

async def get_video_mastery(
    session: AsyncSession,
    user_id: int,
) -> List[Dict[str, Any]]:
    """
    Return all analyzed videos for the user with their mastery data.
    Includes videos with NO flashcard reviews (mastery = 0%).
    A card is "mastered" if state >= 2 (Review or above).
    """

    # ── Subquery: flashcard stats per summary ──
    review_stats = (
        select(
            FlashcardReview.summary_id,
            func.count(FlashcardReview.id).label("total_cards"),
            func.sum(
                case(
                    (FlashcardReview.state >= 2, 1),
                    else_=0,
                )
            ).label("mastered_cards"),
            func.sum(
                case(
                    (FlashcardReview.due_date <= func.now(), 1),
                    else_=0,
                )
            ).label("due_cards"),
            func.max(FlashcardReview.last_review).label("last_studied"),
        )
        .where(FlashcardReview.user_id == user_id)
        .group_by(FlashcardReview.summary_id)
        .subquery("review_stats")
    )

    # ── Main query: all user summaries LEFT JOIN review stats ──
    result = await session.execute(
        select(
            Summary.id.label("summary_id"),
            Summary.video_title,
            Summary.video_channel,
            Summary.thumbnail_url,
            Summary.created_at,
            review_stats.c.total_cards,
            review_stats.c.mastered_cards,
            review_stats.c.due_cards,
            review_stats.c.last_studied,
        )
        .outerjoin(review_stats, Summary.id == review_stats.c.summary_id)
        .where(Summary.user_id == user_id)
        .order_by(Summary.created_at.desc())
    )

    rows = result.all()
    mastery = []
    for row in rows:
        total = row.total_cards or 0
        mastered = row.mastered_cards or 0
        due = row.due_cards or 0
        pct = round((mastered / total) * 100, 1) if total > 0 else 0.0

        last_studied = None
        if row.last_studied:
            last_studied = (
                row.last_studied.isoformat()
                if hasattr(row.last_studied, "isoformat")
                else str(row.last_studied)
            )

        mastery.append({
            "summary_id": row.summary_id,
            "title": row.video_title or f"Vidéo #{row.summary_id}",
            "channel": row.video_channel or "",
            "thumbnail": row.thumbnail_url,
            "total_cards": total,
            "mastered_cards": mastered,
            "due_cards": due,
            "mastery_percent": pct,
            "last_studied": last_studied,
        })

    return mastery


# ═══════════════════════════════════════════════════════════════════════════════
# HEAT MAP
# ═══════════════════════════════════════════════════════════════════════════════

async def get_heat_map(
    session: AsyncSession,
    user_id: int,
    days: int = 35,
) -> List[Dict[str, Any]]:
    """
    Return daily activity for the last N days (for heat-map rendering).
    """
    since = date.today() - timedelta(days=days)

    result = await session.execute(
        select(StudyDailyActivity)
        .where(
            and_(
                StudyDailyActivity.user_id == user_id,
                StudyDailyActivity.date >= since,
            )
        )
        .order_by(StudyDailyActivity.date)
    )

    rows = result.scalars().all()
    return [
        {
            "date": row.date.isoformat(),
            "cards_reviewed": row.cards_reviewed or 0,
            "xp_earned": row.xp_earned or 0,
            "sessions_count": row.sessions_count or 0,
            "time_seconds": row.time_seconds or 0,
        }
        for row in rows
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# DAILY ACTIVITY
# ═══════════════════════════════════════════════════════════════════════════════

async def record_daily_activity(
    session: AsyncSession,
    user_id: int,
    cards: int,
    xp: int,
    time_s: int,
) -> None:
    """
    Upsert daily activity row for today.
    Increments counters if already exists.
    """
    today = date.today()

    result = await session.execute(
        select(StudyDailyActivity).where(
            and_(
                StudyDailyActivity.user_id == user_id,
                StudyDailyActivity.date == today,
            )
        )
    )
    row = result.scalar_one_or_none()

    if row is None:
        row = StudyDailyActivity(
            user_id=user_id,
            date=today,
            cards_reviewed=cards,
            xp_earned=xp,
            sessions_count=1,
            time_seconds=time_s,
        )
        session.add(row)
    else:
        row.cards_reviewed = (row.cards_reviewed or 0) + cards
        row.xp_earned = (row.xp_earned or 0) + xp
        row.sessions_count = (row.sessions_count or 0) + 1
        row.time_seconds = (row.time_seconds or 0) + time_s

    await session.flush()
