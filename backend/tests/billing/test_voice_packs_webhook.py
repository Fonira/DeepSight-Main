"""Tests webhook handler voice_pack — idempotency + crédit.

Tests follow MagicMock pattern consistent with the rest of the billing test
suite — no real DB session.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from billing.router import _handle_voice_pack_checkout


def _make_db_session(existing_purchase=None, user=None, pack=None):
    """Build a mock AsyncSession.

    .execute(...) → returns a result whose .scalar_one_or_none() returns
                    ``existing_purchase`` (used by the idempotency check).
    .get(User, ...) → returns ``user``
    .get(VoiceCreditPack, ...) → returns ``pack``
    """
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=existing_purchase)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.flush = AsyncMock()

    # .get dispatches by model — first call User, second call VoiceCreditPack
    async def fake_get(model, _id):
        from db.database import User, VoiceCreditPack
        if model is User:
            return user
        if model is VoiceCreditPack:
            return pack
        return None

    db.get = AsyncMock(side_effect=fake_get)
    return db


@pytest.mark.asyncio
async def test_voice_pack_webhook_credits_user_and_records_purchase():
    """checkout.session.completed credits purchased_minutes + creates VoiceCreditPurchase."""
    user = MagicMock()
    user.id = 1
    user.plan = "pro"

    pack = MagicMock()
    pack.id = 10
    pack.slug = "voice-60"
    pack.price_cents = 499

    db = _make_db_session(existing_purchase=None, user=user, pack=pack)

    data = {
        "id": "cs_test_abc123",
        "payment_intent": "pi_test_xyz789",
        "amount_total": 499,
    }
    metadata = {
        "kind": "voice_pack",
        "pack_slug": "voice-60",
        "pack_id": "10",
        "user_id": "1",
        "minutes": "60",
    }

    with patch(
        "billing.router.add_purchased_minutes" if False else "billing.voice_packs_service.add_purchased_minutes",
        AsyncMock(),
    ) as mock_add:
        await _handle_voice_pack_checkout(db, data, metadata)

    # add_purchased_minutes called with (user_id=1, minutes=60.0, db)
    mock_add.assert_called_once()
    call_args = mock_add.call_args
    assert call_args.args[0] == 1
    assert call_args.args[1] == 60.0

    # VoiceCreditPurchase row added
    db.add.assert_called_once()
    purchase_row = db.add.call_args.args[0]
    assert purchase_row.user_id == 1
    assert purchase_row.pack_id == 10
    assert purchase_row.minutes_purchased == 60
    assert purchase_row.price_paid_cents == 499
    assert purchase_row.stripe_session_id == "cs_test_abc123"
    assert purchase_row.stripe_payment_intent_id == "pi_test_xyz789"
    assert purchase_row.status == "completed"
    assert purchase_row.completed_at is not None

    # Single commit at the end
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_voice_pack_webhook_idempotent_on_duplicate_session():
    """If stripe_session_id already in DB → no-op (no double credit)."""
    # An existing purchase row signals that this session_id was already processed
    existing = MagicMock()
    existing.stripe_session_id = "cs_dup_555"

    db = _make_db_session(existing_purchase=existing)

    data = {"id": "cs_dup_555", "payment_intent": "pi_dup_555"}
    metadata = {
        "kind": "voice_pack",
        "pack_slug": "voice-60",
        "pack_id": "10",
        "user_id": "1",
        "minutes": "60",
    }

    with patch(
        "billing.voice_packs_service.add_purchased_minutes",
        AsyncMock(),
    ) as mock_add:
        await _handle_voice_pack_checkout(db, data, metadata)

    # No credit applied, no new row added
    mock_add.assert_not_called()
    db.add.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_voice_pack_webhook_invalid_metadata_returns_silently():
    """Invalid (non-numeric) metadata → log warning + return without raising."""
    db = _make_db_session(existing_purchase=None)

    data = {"id": "cs_bad", "payment_intent": "pi_bad"}
    metadata = {
        "kind": "voice_pack",
        "user_id": "not-a-number",
        "pack_id": "10",
        "minutes": "60",
    }

    # Should NOT raise
    await _handle_voice_pack_checkout(db, data, metadata)

    db.add.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_voice_pack_webhook_zero_minutes_returns_silently():
    """Zero minutes (corrupt metadata) → log warning + return without raising."""
    db = _make_db_session(existing_purchase=None)

    data = {"id": "cs_zero", "payment_intent": "pi_zero"}
    metadata = {
        "kind": "voice_pack",
        "user_id": "1",
        "pack_id": "10",
        "minutes": "0",
    }

    await _handle_voice_pack_checkout(db, data, metadata)

    db.add.assert_not_called()
    db.commit.assert_not_called()
