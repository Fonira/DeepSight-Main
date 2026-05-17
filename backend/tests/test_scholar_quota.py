"""Tests for `core.scholar_quota` — daily Scholar query quota helper.

Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md § 6.4, § 9.

Uses an in-memory SQLite engine with the production SQLAlchemy models. No
mocks for the DB layer — the goal is to lock the actual UPSERT/SELECT logic
against the `daily_quotas` table.
"""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from db.database import Base, DailyQuota, User


@pytest_asyncio.fixture
async def db_session():
    """In-memory async SQLite session with all tables created."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
    await engine.dispose()


def _make_user(plan: str, user_id: int = 1) -> SimpleNamespace:
    """Lightweight User stand-in — quota helpers only read `.id` and `.plan`."""
    return SimpleNamespace(id=user_id, plan=plan)


@pytest.mark.asyncio
async def test_get_scholar_daily_usage_zero_for_new_user(db_session):
    """Without any DailyQuota row, usage is 0 (no implicit row creation)."""
    from core.scholar_quota import get_scholar_daily_usage

    usage = await get_scholar_daily_usage(db_session, user_id=42)
    assert usage == 0


@pytest.mark.asyncio
async def test_free_plan_blocked(db_session):
    """Free plan has limit 0 → check_and_increment returns False with scholar_not_allowed."""
    from core.scholar_quota import check_and_increment_scholar_quota

    user = _make_user("free")
    allowed, payload = await check_and_increment_scholar_quota(db_session, user)

    assert allowed is False
    assert payload is not None
    assert payload["code"] == "scholar_not_allowed"


@pytest.mark.asyncio
async def test_pro_under_quota_allows_and_increments(db_session):
    """Pro user under 5/day → allowed, counter incremented, row created."""
    from core.scholar_quota import check_and_increment_scholar_quota, get_scholar_daily_usage

    user = _make_user("pro", user_id=7)

    allowed, payload = await check_and_increment_scholar_quota(db_session, user)
    assert allowed is True
    assert payload is None

    usage = await get_scholar_daily_usage(db_session, user_id=7)
    assert usage == 1


@pytest.mark.asyncio
async def test_pro_at_limit_blocked(db_session):
    """Pro user with 5 queries today → blocked with scholar_daily_limit_reached."""
    from core.scholar_quota import check_and_increment_scholar_quota

    # Pre-seed today's row at limit
    today = date.today().isoformat()
    db_session.add(
        DailyQuota(user_id=11, quota_date=today, videos_used=0, scholar_queries=5)
    )
    await db_session.commit()

    user = _make_user("pro", user_id=11)
    allowed, payload = await check_and_increment_scholar_quota(db_session, user)

    assert allowed is False
    assert payload["code"] == "scholar_daily_limit_reached"
    assert payload["current_usage"] == 5
    assert payload["daily_limit"] == 5


@pytest.mark.asyncio
async def test_expert_higher_limit(db_session):
    """Expert plan has 30/day → 6th query (which would block Pro) still allowed."""
    from core.scholar_quota import check_and_increment_scholar_quota, get_scholar_daily_usage

    today = date.today().isoformat()
    db_session.add(
        DailyQuota(user_id=99, quota_date=today, videos_used=0, scholar_queries=5)
    )
    await db_session.commit()

    user = _make_user("expert", user_id=99)
    allowed, _ = await check_and_increment_scholar_quota(db_session, user)
    assert allowed is True

    usage = await get_scholar_daily_usage(db_session, user_id=99)
    assert usage == 6


@pytest.mark.asyncio
async def test_legacy_plan_id_normalized(db_session):
    """Legacy plan alias `plus` → maps to `pro` → 5/day."""
    from core.scholar_quota import check_and_increment_scholar_quota, get_scholar_daily_limit

    assert get_scholar_daily_limit("plus") == 5
    user = _make_user("plus", user_id=22)
    allowed, _ = await check_and_increment_scholar_quota(db_session, user)
    assert allowed is True
