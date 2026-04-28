"""DB helpers for the COMPANION agent context builder.

These functions wrap raw SQLAlchemy `select()` calls so the higher-level
companion_context / companion_themes modules can stay framework-free and
testable with simple Protocol-based mocks.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary, User

logger = logging.getLogger(__name__)


@dataclass
class StudyStats:
    """Lightweight DTO for study stats injected in the COMPANION profile."""

    current_streak_days: int = 0
    flashcards_due_today: int = 0


async def fetch_user_summary_count(*, db: AsyncSession, user_id: int) -> int:
    """Total number of Summary rows owned by the user."""
    result = await db.execute(
        select(func.count(Summary.id)).where(Summary.user_id == user_id)
    )
    return int(result.scalar() or 0)


async def fetch_recent_summaries(
    *, db: AsyncSession, user_id: int, limit: int = 5
) -> list[Summary]:
    """Most recently created Summary rows for the user (newest first)."""
    result = await db.execute(
        select(Summary)
        .where(Summary.user_id == user_id)
        .order_by(Summary.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def fetch_user_analyzed_video_ids(
    *, db: AsyncSession, user_id: int
) -> set[str]:
    """Set of YouTube video_ids already analysed by the user — used to dedupe recos."""
    result = await db.execute(
        select(Summary.video_id).where(
            Summary.user_id == user_id, Summary.video_id.is_not(None)
        )
    )
    return {v for (v,) in result.all() if v}


async def fetch_user_study_stats(
    *, db: AsyncSession, user_id: int  # noqa: ARG001 — db unused for now
) -> StudyStats:
    """Lightweight study stats for COMPANION profile.

    V1: returns zeros (UserStudyStats / FlashcardReview tables exist in newer
    schema versions but not in every deployment). Real wiring is a follow-up
    once the gamification module is confirmed populated for all envs.
    """
    return StudyStats(current_streak_days=0, flashcards_due_today=0)


async def fetch_user_by_id(*, db: AsyncSession, user_id: int) -> Optional[User]:
    """Fetch a User row by primary key."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


class CompanionDBAdapter:
    """Adapter exposing the companion DB helpers as bound methods.

    The companion_context builder calls e.g. ``db.fetch_recent_summaries(...)``
    on the object it receives. Passing this adapter lets the builder remain
    decoupled from raw SQLAlchemy while still hitting the real database in
    production. Tests pass an AsyncMock with the same shape.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def fetch_user_summary_count(self, *, user_id: int) -> int:
        return await fetch_user_summary_count(db=self._session, user_id=user_id)

    async def fetch_recent_summaries(self, *, user_id: int, limit: int = 5):
        return await fetch_recent_summaries(
            db=self._session, user_id=user_id, limit=limit
        )

    async def fetch_user_analyzed_video_ids(self, *, user_id: int) -> set[str]:
        return await fetch_user_analyzed_video_ids(
            db=self._session, user_id=user_id
        )

    async def fetch_user_study_stats(self, *, user_id: int) -> StudyStats:
        return await fetch_user_study_stats(db=self._session, user_id=user_id)
