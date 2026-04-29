"""Chat-test-local fixtures.

Reuses the SQLite in-memory async DB pattern from ``tests/voice/conftest.py``
(Task 3 of merge-voice-chat-context) and adds an ``async_client`` HTTP fixture
backed by ``main.app`` with FastAPI dependency overrides for
``get_session`` and ``get_current_user``.

Fixtures exported:
    * ``async_db_session`` — fresh AsyncSession bound to a fresh schema
    * ``sample_user``      — persisted User row (plan='pro')
    * ``sample_summary``   — persisted Summary row owned by sample_user
    * ``async_client``     — httpx.AsyncClient hitting the real FastAPI app
    * ``auth_headers``     — empty dict (auth dependency is overridden)
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Importing db.database registers every Base subclass on Base.metadata so
# create_all sees the full schema (User has relationships to FlashcardReview,
# StudySession, UserStudyStats, UserBadge etc., all defined in this module).
from db.database import (  # noqa: F401
    Base,
    ChatMessage,
    ChatTextDigest,
    Summary,
    User,
    VoiceSession,
)


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
        username="chat_tester",
        email="chat@test.fr",
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
        video_id="vid-chat-1",
        video_title="Test Video Chat",
        platform="youtube",
        lang="fr",
        summary_content="Résumé de test pour chat.",
        transcript_context="Transcript de test.",
    )
    async_db_session.add(summary)
    await async_db_session.commit()
    await async_db_session.refresh(summary)
    return summary


@pytest_asyncio.fixture
async def async_client(async_db_session: AsyncSession, sample_user: User):
    """Yield an httpx.AsyncClient hitting the real FastAPI app.

    Overrides:
      - ``get_session`` → returns the test ``async_db_session``
      - ``get_current_user`` → returns ``sample_user``
    """
    from main import app
    from db.database import get_session
    from auth.dependencies import get_current_user

    async def override_session():
        yield async_db_session

    async def override_user():
        return sample_user

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    """Empty headers — auth is overridden via dependency_overrides."""
    return {}
