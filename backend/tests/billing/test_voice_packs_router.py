"""Tests pour les endpoints REST voice packs.

Following the existing project test style: route handlers tested directly via
their FastAPI signature with mocked dependencies, NOT via TestClient (which
would require a fully booted FastAPI app — overkill for these unit tests and
inconsistent with the rest of the suite).

Coverage:
  * list_packs : returns active packs from service
  * my_credits : returns CreditStatusOut snapshot
  * create_checkout : Free user → 402 upgrade_required
  * create_checkout : Pro user with unknown slug → 404
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from billing.voice_packs_router import (
    create_checkout,
    list_packs,
    my_credits,
)


def _make_user(plan: str, user_id: int = 1, customer_id: str = "cus_test"):
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    user.email = "u@test.fr"
    user.stripe_customer_id = customer_id
    return user


def _make_pack(
    pack_id: int,
    slug: str,
    name: str,
    minutes: int,
    price_cents: int,
    is_active: bool = True,
    display_order: int = 0,
    description: str | None = None,
    stripe_price_id: str | None = None,
):
    pack = MagicMock()
    pack.id = pack_id
    pack.slug = slug
    pack.name = name
    pack.minutes = minutes
    pack.price_cents = price_cents
    pack.description = description
    pack.is_active = is_active
    pack.display_order = display_order
    pack.stripe_price_id = stripe_price_id
    return pack


@pytest.mark.asyncio
async def test_list_packs_returns_active_catalog():
    """GET /list returns 2 active packs from the service."""
    pack1 = _make_pack(1, "voice-30", "30 min", 30, 299, display_order=1)
    pack2 = _make_pack(2, "voice-60", "60 min", 60, 499, display_order=2)

    db = AsyncMock()

    with patch("billing.voice_packs_router.list_active_packs", AsyncMock(return_value=[pack1, pack2])):
        result = await list_packs(db)

    assert len(result) == 2
    assert result[0].slug == "voice-30"
    assert result[0].price_cents == 299
    assert result[1].slug == "voice-60"


@pytest.mark.asyncio
async def test_my_credits_returns_pro_snapshot():
    """GET /my-credits returns CreditStatusOut for Pro user."""
    user = _make_user("pro")
    db = AsyncMock()

    snapshot = {
        "allowance_total": 30.0,
        "allowance_used": 5.0,
        "allowance_remaining": 25.0,
        "purchased_minutes": 0.0,
        "total_minutes_available": 25.0,
        "is_trial": False,
    }

    with patch(
        "billing.voice_packs_router.get_user_credit_status",
        AsyncMock(return_value=snapshot),
    ):
        result = await my_credits(current_user=user, db=db)

    assert result.plan == "pro"
    assert result.allowance_total == 30.0
    assert result.allowance_remaining == 25.0
    assert result.is_trial is False


@pytest.mark.asyncio
async def test_checkout_blocks_free_plan_with_402():
    """VC-2 : Free plan receives HTTP 402 upgrade_required."""
    user = _make_user("free")
    db = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        await create_checkout(slug="voice-30", current_user=user, db=db)

    assert exc.value.status_code == 402
    detail = exc.value.detail
    assert detail["code"] == "upgrade_required"
    assert detail["cta"] == "upgrade_pro"


@pytest.mark.asyncio
async def test_checkout_returns_404_for_unknown_pack():
    """Pro user requesting unknown slug → 404 pack_not_found."""
    user = _make_user("pro")
    db = AsyncMock()

    with patch(
        "billing.voice_packs_router.get_pack_by_slug",
        AsyncMock(return_value=None),
    ):
        with pytest.raises(HTTPException) as exc:
            await create_checkout(slug="nonexistent", current_user=user, db=db)

    assert exc.value.status_code == 404
    detail = exc.value.detail
    assert detail["code"] == "pack_not_found"


@pytest.mark.asyncio
async def test_checkout_returns_400_when_stripe_disabled():
    """When STRIPE_CONFIG.ENABLED is False → 400 stripe_disabled."""
    user = _make_user("pro")
    db = AsyncMock()
    pack = _make_pack(1, "voice-30", "30 min", 30, 299)

    with patch(
        "billing.voice_packs_router.get_pack_by_slug",
        AsyncMock(return_value=pack),
    ), patch.dict(
        "billing.voice_packs_router.STRIPE_CONFIG",
        {"ENABLED": False},
        clear=False,
    ):
        with pytest.raises(HTTPException) as exc:
            await create_checkout(slug="voice-30", current_user=user, db=db)

    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "stripe_disabled"


@pytest.mark.asyncio
async def test_checkout_creates_stripe_session_for_pro_user():
    """Pro user with valid pack and Stripe enabled → returns checkout_url."""
    user = _make_user("pro")
    db = AsyncMock()
    db.commit = AsyncMock()
    pack = _make_pack(1, "voice-30", "30 min", 30, 299)

    fake_session = MagicMock()
    fake_session.id = "cs_test_xyz"
    fake_session.url = "https://checkout.stripe.com/test_xyz"

    fake_customer = MagicMock()
    fake_customer.id = "cus_test"

    with patch(
        "billing.voice_packs_router.get_pack_by_slug",
        AsyncMock(return_value=pack),
    ), patch.dict(
        "billing.voice_packs_router.STRIPE_CONFIG",
        {"ENABLED": True, "TEST_MODE": True, "SECRET_KEY_TEST": "sk_test_fake"},
        clear=False,
    ), patch(
        "billing.voice_packs_router.get_stripe_key",
        return_value="sk_test_fake",
    ), patch(
        "billing.voice_packs_router.stripe"
    ) as mock_stripe:
        mock_stripe.Customer.retrieve = MagicMock(return_value=fake_customer)
        mock_stripe.checkout.Session.create = MagicMock(return_value=fake_session)
        # Mock error namespace so isinstance checks pass if raised
        mock_stripe.error = MagicMock()

        result = await create_checkout(slug="voice-30", current_user=user, db=db)

    assert result.checkout_url == "https://checkout.stripe.com/test_xyz"
    assert result.session_id == "cs_test_xyz"
    # Verify metadata contains kind=voice_pack and the pack info
    call_kwargs = mock_stripe.checkout.Session.create.call_args.kwargs
    metadata = call_kwargs["metadata"]
    assert metadata["kind"] == "voice_pack"
    assert metadata["pack_slug"] == "voice-30"
    assert metadata["pack_id"] == "1"
    assert metadata["minutes"] == "30"
