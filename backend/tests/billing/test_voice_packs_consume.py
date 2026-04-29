"""Tests consume_voice_minutes : ordre allowance-first puis purchased-fallback.

Tests follow the existing project style (MagicMock-based) like
``tests/billing/test_voice_quota.py``.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from billing.voice_quota import consume_voice_minutes, MONTHLY_MINUTES_BY_PLAN


def _make_user(plan: str, user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    return user


def _make_db_session(quota_row):
    """Mock DB session whose .execute() returns the given quota row."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=quota_row)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_consume_drains_allowance_first():
    """50 min consumed when 20 allowance + 60 purchased available
    → 0 allowance remaining + 30 purchased remaining (Pro: 30 cap, used 10
    leaves 20 allowance, then 30 spilled into purchased)."""
    quota = MagicMock()
    quota.plan = "pro"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 10.0  # allowance Pro: 30 - 10 = 20 remaining
    quota.purchased_minutes = 60.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("pro")
    db = _make_db_session(quota_row=quota)

    await consume_voice_minutes(user, 50.0, db)

    assert quota.monthly_minutes_used == 30.0  # 10 + 20 (full drain of allowance)
    assert quota.purchased_minutes == 30.0  # 60 - 30 (overflow into purchased)
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_consume_within_allowance_does_not_touch_purchased():
    """5 min consumed when 30 allowance + 100 purchased → only allowance hit."""
    quota = MagicMock()
    quota.plan = "pro"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 0.0
    quota.purchased_minutes = 100.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("pro")
    db = _make_db_session(quota_row=quota)

    await consume_voice_minutes(user, 5.0, db)

    assert quota.monthly_minutes_used == 5.0
    assert quota.purchased_minutes == 100.0  # unchanged
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_consume_expert_uses_120_min_cap():
    """Expert allowance is 120 min/month per VC-1, not 30."""
    quota = MagicMock()
    quota.plan = "expert"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 100.0  # allowance Expert: 120 - 100 = 20 left
    quota.purchased_minutes = 50.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("expert")
    db = _make_db_session(quota_row=quota)

    # Consume 30 min: 20 from allowance, 10 from purchased
    await consume_voice_minutes(user, 30.0, db)

    assert quota.monthly_minutes_used == 120.0  # 100 + 20 (drained)
    assert quota.purchased_minutes == 40.0  # 50 - 10 (overflow)


@pytest.mark.asyncio
async def test_consume_purchased_only_when_allowance_already_full():
    """If allowance is fully drained, all consumption hits purchased."""
    quota = MagicMock()
    quota.plan = "pro"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 30.0  # allowance Pro maxed
    quota.purchased_minutes = 50.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("pro")
    db = _make_db_session(quota_row=quota)

    await consume_voice_minutes(user, 15.0, db)

    assert quota.monthly_minutes_used == 30.0  # unchanged (already maxed)
    assert quota.purchased_minutes == 35.0  # 50 - 15
