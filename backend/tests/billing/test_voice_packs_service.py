"""Tests pure logic du service voice packs (sans Stripe).

Tests follow the existing project style (MagicMock-based) to stay consistent
with ``tests/billing/test_voice_quota.py``. They verify the pure DB-touching
helpers without spinning up a real DB.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from billing.voice_packs_service import (
    list_active_packs,
    get_pack_by_slug,
    add_purchased_minutes,
    get_user_credit_status,
)
from billing.voice_quota import (
    FREE_TRIAL_MINUTES,
    MONTHLY_MINUTES_BY_PLAN,
)


def _make_user(plan: str, user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    return user


def _make_db_session_for_quota(quota_row):
    """Mock DB session whose .execute() returns the given quota row."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=quota_row)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.get = AsyncMock(return_value=None)
    return db


def _make_pack(slug: str, name: str, minutes: int, price_cents: int, is_active: bool = True, display_order: int = 0):
    pack = MagicMock()
    pack.slug = slug
    pack.name = name
    pack.minutes = minutes
    pack.price_cents = price_cents
    pack.is_active = is_active
    pack.display_order = display_order
    return pack


@pytest.mark.asyncio
async def test_list_active_packs_returns_only_active_ordered():
    """list_active_packs filtre is_active et ordonne par display_order."""
    pack1 = _make_pack("voice-30", "30 min", 30, 299, True, 1)
    pack2 = _make_pack("voice-60", "60 min", 60, 499, True, 2)

    mock_scalars = MagicMock()
    mock_scalars.all = MagicMock(return_value=[pack1, pack2])
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=mock_scalars)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)

    packs = await list_active_packs(db)

    assert len(packs) == 2
    assert [p.slug for p in packs] == ["voice-30", "voice-60"]


@pytest.mark.asyncio
async def test_get_pack_by_slug_returns_none_for_unknown():
    """get_pack_by_slug retourne None pour slug inexistant."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)

    pack = await get_pack_by_slug("nonexistent-slug", db)
    assert pack is None


@pytest.mark.asyncio
async def test_get_pack_by_slug_returns_pack_when_found():
    """get_pack_by_slug retourne le pack si trouvé."""
    expected = _make_pack("voice-60", "60 min", 60, 499)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=expected)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)

    pack = await get_pack_by_slug("voice-60", db)
    assert pack is expected
    assert pack.slug == "voice-60"


@pytest.mark.asyncio
async def test_add_purchased_minutes_creates_quota_row_if_missing():
    """add_purchased_minutes crée la row voice_quota si absente, puis crédite."""
    # quota row missing → _get_or_create_quota inserts a new one
    db = _make_db_session_for_quota(quota_row=None)

    pro_user = MagicMock()
    pro_user.id = 1
    pro_user.plan = "pro"
    db.get = AsyncMock(return_value=pro_user)

    await add_purchased_minutes(pro_user.id, 60.0, db)

    # Verify a row was added with purchased_minutes set to 60.0 after credit
    assert db.add.call_count == 1
    new_quota = db.add.call_args[0][0]
    assert new_quota.purchased_minutes == 60.0


@pytest.mark.asyncio
async def test_add_purchased_minutes_increments_existing_balance():
    """add_purchased_minutes additionne au solde existant."""
    quota = MagicMock()
    quota.plan = "pro"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 0.0
    quota.purchased_minutes = 30.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    db = _make_db_session_for_quota(quota_row=quota)
    pro_user = MagicMock()
    pro_user.id = 1
    pro_user.plan = "pro"
    db.get = AsyncMock(return_value=pro_user)

    await add_purchased_minutes(pro_user.id, 60.0, db)

    assert quota.purchased_minutes == 90.0


@pytest.mark.asyncio
async def test_get_user_credit_status_pro_snapshot():
    """get_user_credit_status retourne le snapshot allowance + purchased pour Pro."""
    quota = MagicMock()
    quota.plan = "pro"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 10.0
    quota.purchased_minutes = 45.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("pro")
    db = _make_db_session_for_quota(quota_row=quota)

    status = await get_user_credit_status(user, db)

    assert status["allowance_total"] == MONTHLY_MINUTES_BY_PLAN["pro"]  # 30
    assert status["allowance_used"] == 10.0
    assert status["allowance_remaining"] == 20.0
    assert status["purchased_minutes"] == 45.0
    assert status["total_minutes_available"] == 65.0
    assert status["is_trial"] is False


@pytest.mark.asyncio
async def test_get_user_credit_status_expert_120_min_allowance():
    """get_user_credit_status returns 120 allowance_total for Expert (VC-1)."""
    quota = MagicMock()
    quota.plan = "expert"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 20.0
    quota.purchased_minutes = 0.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("expert")
    db = _make_db_session_for_quota(quota_row=quota)

    status = await get_user_credit_status(user, db)

    assert status["allowance_total"] == 120.0  # Expert VC-1
    assert status["allowance_used"] == 20.0
    assert status["allowance_remaining"] == 100.0
    assert status["is_trial"] is False


@pytest.mark.asyncio
async def test_get_user_credit_status_free_trial_unused():
    """Free plan with trial unused → allowance_total = 3 (trial), is_trial=True."""
    quota = MagicMock()
    quota.plan = "free"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 0.0
    quota.purchased_minutes = 0.0
    quota.lifetime_trial_used = False
    quota.lifetime_trial_used_at = None

    user = _make_user("free")
    db = _make_db_session_for_quota(quota_row=quota)

    status = await get_user_credit_status(user, db)

    assert status["allowance_total"] == FREE_TRIAL_MINUTES  # 3
    assert status["purchased_minutes"] == 0.0
    assert status["is_trial"] is True


@pytest.mark.asyncio
async def test_get_user_credit_status_free_trial_used_zero_allowance():
    """Free plan with trial USED → allowance_total = 0."""
    quota = MagicMock()
    quota.plan = "free"
    quota.monthly_period_start = datetime.now(timezone.utc)
    quota.monthly_minutes_used = 0.0
    quota.purchased_minutes = 0.0
    quota.lifetime_trial_used = True
    quota.lifetime_trial_used_at = datetime.now(timezone.utc)

    user = _make_user("free")
    db = _make_db_session_for_quota(quota_row=quota)

    status = await get_user_credit_status(user, db)

    assert status["allowance_total"] == 0.0
    assert status["is_trial"] is False
