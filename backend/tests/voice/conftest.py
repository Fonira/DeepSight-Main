"""Voice-test-local fixtures.

Provides SQLite in-memory async DB + factory fixtures used by
``test_context_builder.py`` (Task 3 of merge-voice-chat-context).

The repo's global ``conftest.py`` only ships **mocked** sessions, so we set up
a real (in-memory) SQLAlchemy AsyncEngine here so we can persist real model
rows (User / Summary / VoiceSession / ChatMessage / ChatTextDigest) and run
the actual SELECT statements built by ``build_unified_context_block``.

Fixtures exported:
    * ``async_db_session`` — a fresh AsyncSession bound to a fresh schema
    * ``sample_user``      — a persisted User row
    * ``sample_summary``   — a persisted Summary row owned by sample_user
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Importing db.database registers every Base subclass on Base.metadata so
# create_all sees the full schema (User has relationships to FlashcardReview,
# StudySession, UserStudyStats, UserBadge etc., all defined in this module).
from db.database import Base, ChatMessage, Summary, User, VoiceSession  # noqa: F401


@pytest_asyncio.fixture
async def async_db_session():
    """Yield an AsyncSession backed by a fresh in-memory SQLite DB.

    Each test gets an isolated engine + schema, so digest/message rows from
    one test cannot leak into another.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        try:
            yield session
        finally:
            await session.close()
    await engine.dispose()


@pytest_asyncio.fixture
async def sample_user(async_db_session: AsyncSession) -> User:
    user = User(
        username="ctx_tester",
        email="ctx@test.fr",
        password_hash="x",
        plan="pro",
        email_verified=True,
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def sample_summary(async_db_session: AsyncSession, sample_user: User) -> Summary:
    summary = Summary(
        user_id=sample_user.id,
        video_id="vid-ctx-1",
        video_title="Test Video Context",
        platform="youtube",
        lang="fr",
    )
    async_db_session.add(summary)
    await async_db_session.commit()
    await async_db_session.refresh(summary)
    return summary
