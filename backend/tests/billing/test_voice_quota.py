"""Tests for the A+D strict Quick Voice Call quota service (Task 2).

Cover the 5 paths of ``check_voice_quota`` plus ``consume_voice_minutes``:
  * Free user with no prior quota row → trial allowed (3 min)
  * Free user whose lifetime trial was used → blocked, cta=upgrade_expert
  * Pro user → always blocked, cta=upgrade_expert
  * Expert user with quota remaining → allowed, max_minutes = 30 - used
  * Expert user with quota exhausted → blocked, reason=monthly_quota

Mocks db.execute as in the existing voice quota tests (tests/test_voice.py)
to stay consistent with the project's fixture style — no live DB.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

from billing.voice_quota import (
    check_voice_quota,
    consume_voice_minutes,
    QuotaCheck,
    EXPERT_MONTHLY_MINUTES,
    FREE_TRIAL_MINUTES,
)


def _make_user(plan: str, user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    return user


def _make_db_session(quota_row):
    """Return a mock_db_session whose first execute() returns quota_row."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=quota_row)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_free_first_use_allowed():
    """Free user with no quota row → 3-min trial granted."""
    user = _make_user("free")
    db = _make_db_session(quota_row=None)
    result = await check_voice_quota(user, db)
    assert isinstance(result, QuotaCheck)
    assert result.allowed is True
    assert result.is_trial is True
    assert result.max_minutes == FREE_TRIAL_MINUTES
    assert result.cta is None
    assert result.reason is None
    db.add.assert_called_once()  # new VoiceQuotaStreaming row created


@pytest.mark.asyncio
async def test_free_after_trial_blocked():
    """Free user whose lifetime trial flag is set → blocked, cta=upgrade_expert."""
    quota = MagicMock()
    quota.plan = "free"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 0.0
    quota.lifetime_trial_used = True
    quota.lifetime_trial_used_at = datetime.now(timezone.utc)

    user = _make_user("free")
    db = _make_db_session(quota_row=quota)
    result = await check_voice_quota(user, db)
    assert result.allowed is False
    assert result.reason == "trial_used"
    assert result.cta == "upgrade_expert"
    assert result.max_minutes == 0.0


@pytest.mark.asyncio
async def test_pro_always_blocked_with_cta():
    """Pro plan never gets voice access — always blocked with CTA upgrade."""
    user = _make_user("pro")
    db = _make_db_session(quota_row=None)
    result = await check_voice_quota(user, db)
    assert result.allowed is False
    assert result.reason == "pro_no_voice"
    assert result.cta == "upgrade_expert"


@pytest.mark.asyncio
async def test_expert_with_remaining_minutes():
    """Expert user with 10/30 used → allowed, max = 20."""
    quota = MagicMock()
    quota.plan = "expert"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 10.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("expert")
    db = _make_db_session(quota_row=quota)
    result = await check_voice_quota(user, db)
    assert result.allowed is True
    assert result.max_minutes == EXPERT_MONTHLY_MINUTES - 10.0
    assert result.is_trial is False


@pytest.mark.asyncio
async def test_expert_quota_exhausted():
    """Expert user at 30/30 → blocked, reason=monthly_quota, no CTA."""
    quota = MagicMock()
    quota.plan = "expert"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 30.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("expert")
    db = _make_db_session(quota_row=quota)
    result = await check_voice_quota(user, db)
    assert result.allowed is False
    assert result.reason == "monthly_quota"
    assert result.cta is None


@pytest.mark.asyncio
async def test_expert_period_resets_after_30_days():
    """Expert quota auto-rolls over when monthly_period_start > 30 days old."""
    quota = MagicMock()
    quota.plan = "expert"
    quota.monthly_period_start = datetime.now(timezone.utc) - timedelta(days=31)
    quota.monthly_minutes_used = 30.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("expert")
    db = _make_db_session(quota_row=quota)
    result = await check_voice_quota(user, db)
    # After reset: 0 used → 30 remaining
    assert result.allowed is True
    assert result.max_minutes == EXPERT_MONTHLY_MINUTES
    assert quota.monthly_minutes_used == 0.0


@pytest.mark.asyncio
async def test_consume_marks_free_trial_used():
    """Consuming any minutes for a Free user flips lifetime_trial_used."""
    quota = MagicMock()
    quota.plan = "free"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 0.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("free")
    db = _make_db_session(quota_row=quota)
    await consume_voice_minutes(user, 1.5, db)
    assert quota.lifetime_trial_used is True
    assert quota.lifetime_trial_used_at is not None
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_consume_increments_expert_minutes():
    """Consuming for Expert adds to monthly_minutes_used."""
    quota = MagicMock()
    quota.plan = "expert"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 5.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("expert")
    db = _make_db_session(quota_row=quota)
    await consume_voice_minutes(user, 7.5, db)
    assert quota.monthly_minutes_used == 12.5
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_consume_pro_no_op():
    """Pro user has no quota counter to update — but still no-op safely."""
    quota = MagicMock()
    quota.plan = "pro"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 0.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("pro")
    db = _make_db_session(quota_row=quota)
    await consume_voice_minutes(user, 5.0, db)
    # Pro never accumulates against this counter
    assert quota.monthly_minutes_used == 0.0
    assert quota.lifetime_trial_used is False
