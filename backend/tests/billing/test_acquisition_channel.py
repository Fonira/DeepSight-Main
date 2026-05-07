"""Tests pour `acquisition_channel` Stripe metadata (launch J0 attribution).

Couvre :
  * `normalize_acquisition_channel()` — vocabulaire SSOT + aliases + invalides
  * Schéma Pydantic `CreateCheckoutByPlanId` accepte le champ optionnel
  * `get_or_create_stripe_customer()` :
    - pose `acquisition_channel` sur Customer.create
    - premier-touch immutable : ne SURCHARGE PAS si déjà présent
    - backfill défensif : ajoute si Customer existant n'a pas le champ
    - resilient si stripe.Customer.modify() raise StripeError

Vocabulaire SSOT (mêmes 10 valeurs côté frontend/mobile/PostHog) :
    product_hunt | twitter | reddit | linkedin | indiehackers | hackernews
    | karim_inmail | mobile_deeplink | test | direct
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import stripe

from billing.router import (
    ALLOWED_ACQUISITION_CHANNELS,
    CreateCheckoutByPlanId,
    get_or_create_stripe_customer,
    normalize_acquisition_channel,
)


# ──────────────────────────────────────────────────────────────────────────────
# Section 1 — `normalize_acquisition_channel` (parametrize matrice 14 cas)
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        # Cas vides / défaut
        (None, "direct"),
        ("", "direct"),
        ("   ", "direct"),
        # Valeurs SSOT directes
        ("product_hunt", "product_hunt"),
        ("twitter", "twitter"),
        ("reddit", "reddit"),
        ("karim_inmail", "karim_inmail"),
        ("mobile_deeplink", "mobile_deeplink"),
        ("test", "test"),
        ("direct", "direct"),
        # Aliases courants
        ("ph", "product_hunt"),
        ("PH", "product_hunt"),
        ("ProductHunt", "product_hunt"),
        ("Product Hunt", "product_hunt"),
        ("Product-Hunt", "product_hunt"),
        ("x", "twitter"),
        ("X", "twitter"),
        ("ih", "indiehackers"),
        ("indie", "indiehackers"),
        ("hn", "hackernews"),
        ("Y_Combinator", "hackernews"),
        ("ycombinator", "hackernews"),
        ("li", "linkedin"),
        ("LinkedIn", "linkedin"),
        # Casing & normalisation
        ("LINKEDIN", "linkedin"),
        ("  twitter  ", "twitter"),
        # Valeurs inconnues → fallback "direct" (pas de raise)
        ("tiktokk", "direct"),
        ("facebook", "direct"),
        ("unknown_source", "direct"),
        ("rick-roll", "direct"),
        # Type invalide → fallback "direct"
        (123, "direct"),
        ([], "direct"),
    ],
)
def test_normalize_acquisition_channel(raw, expected):
    """Vocabulaire SSOT : valid → mapped, invalid → 'direct' (jamais raise)."""
    assert normalize_acquisition_channel(raw) == expected


def test_allowed_channels_contains_ssot_vocabulary():
    """Garde-fou : la liste des channels reste alignée avec PostHog signup_source.

    Toute modif ici doit être coordonnée avec sub-agent P (PostHog tracking).
    """
    assert ALLOWED_ACQUISITION_CHANNELS == frozenset({
        "product_hunt",
        "twitter",
        "reddit",
        "linkedin",
        "indiehackers",
        "hackernews",
        "karim_inmail",
        "mobile_deeplink",
        "test",
        "direct",
    })


# ──────────────────────────────────────────────────────────────────────────────
# Section 2 — Pydantic schema accepte le champ optionnel
# ──────────────────────────────────────────────────────────────────────────────


def test_schema_acquisition_channel_optional():
    """Le champ est optionnel (default None) — pas de breaking change pour clients legacy."""
    req = CreateCheckoutByPlanId(plan="pro", cycle="monthly")
    assert req.acquisition_channel is None


def test_schema_acquisition_channel_provided():
    req = CreateCheckoutByPlanId(
        plan="pro", cycle="monthly", acquisition_channel="product_hunt"
    )
    assert req.acquisition_channel == "product_hunt"


def test_schema_acquisition_channel_passthrough_invalid():
    """Le schema NE valide PAS la valeur — c'est `normalize_acquisition_channel`
    qui gère le fallback. Permet de logger les valeurs raw avant normalisation
    pour analyse debug du tracking côté client."""
    req = CreateCheckoutByPlanId(
        plan="pro", cycle="monthly", acquisition_channel="tiktokk"
    )
    assert req.acquisition_channel == "tiktokk"  # raw, non-normalisé au schema
    # Mais après normalize, devient "direct"
    assert normalize_acquisition_channel(req.acquisition_channel) == "direct"


# ──────────────────────────────────────────────────────────────────────────────
# Section 3 — `get_or_create_stripe_customer` premier-touch + backfill
# ──────────────────────────────────────────────────────────────────────────────


def _make_user(stripe_customer_id=None):
    user = MagicMock()
    user.id = 42
    user.email = "test@example.com"
    user.username = "alice"
    user.stripe_customer_id = stripe_customer_id
    return user


@pytest.fixture
def mock_session():
    session = MagicMock()
    session.commit = AsyncMock(return_value=None)
    return session


@pytest.mark.asyncio
async def test_create_customer_pose_acquisition_channel(mock_session):
    """Nouveau Customer → metadata['acquisition_channel'] = canal normalisé."""
    user = _make_user(stripe_customer_id=None)

    fake_customer = MagicMock(id="cus_NEW_123")
    with patch.object(stripe.Customer, "create", return_value=fake_customer) as mock_create:
        cid = await get_or_create_stripe_customer(
            user, mock_session, acquisition_channel="product_hunt"
        )

    assert cid == "cus_NEW_123"
    assert mock_create.call_count == 1
    metadata = mock_create.call_args.kwargs["metadata"]
    assert metadata["acquisition_channel"] == "product_hunt"
    assert metadata["user_id"] == "42"
    assert "first_checkout_at" in metadata


@pytest.mark.asyncio
async def test_create_customer_invalid_channel_falls_back_direct(mock_session):
    """Canal invalide passé → normalisé en 'direct' avant pose Stripe."""
    user = _make_user(stripe_customer_id=None)

    fake_customer = MagicMock(id="cus_NEW_456")
    with patch.object(stripe.Customer, "create", return_value=fake_customer) as mock_create:
        await get_or_create_stripe_customer(
            user, mock_session, acquisition_channel="tiktokk"
        )

    metadata = mock_create.call_args.kwargs["metadata"]
    assert metadata["acquisition_channel"] == "direct"


@pytest.mark.asyncio
async def test_existing_customer_first_touch_immutable(mock_session):
    """Customer existant AVEC acquisition_channel='product_hunt' déjà posé.

    Un nouveau checkout depuis Twitter NE DOIT PAS écraser le canal originel.
    """
    user = _make_user(stripe_customer_id="cus_EXISTING_PH")

    existing_customer = MagicMock()
    existing_customer.get = lambda key, default=None: {
        "deleted": False,
        "metadata": {
            "user_id": "42",
            "acquisition_channel": "product_hunt",
            "first_checkout_at": "2026-04-01T10:00:00+00:00",
        },
    }.get(key, default)

    with (
        patch.object(stripe.Customer, "retrieve", return_value=existing_customer),
        patch.object(stripe.Customer, "modify") as mock_modify,
    ):
        cid = await get_or_create_stripe_customer(
            user, mock_session, acquisition_channel="twitter"
        )

    assert cid == "cus_EXISTING_PH"
    # Premier-touch immutable : modify() n'est PAS appelé puisque le champ existe.
    assert mock_modify.call_count == 0


@pytest.mark.asyncio
async def test_existing_customer_backfill_when_missing(mock_session):
    """Customer existant SANS acquisition_channel (legacy pre-sprint).

    Doit être backfillé avec le canal courant SANS écraser autre metadata.
    """
    user = _make_user(stripe_customer_id="cus_LEGACY_NO_CHANNEL")

    legacy_customer = MagicMock()
    legacy_customer.get = lambda key, default=None: {
        "deleted": False,
        "metadata": {
            "user_id": "42",
            "some_other_key": "preserve_me",
        },
    }.get(key, default)

    with (
        patch.object(stripe.Customer, "retrieve", return_value=legacy_customer),
        patch.object(stripe.Customer, "modify") as mock_modify,
    ):
        cid = await get_or_create_stripe_customer(
            user, mock_session, acquisition_channel="reddit"
        )

    assert cid == "cus_LEGACY_NO_CHANNEL"
    assert mock_modify.call_count == 1
    backfilled_metadata = mock_modify.call_args.kwargs["metadata"]
    assert backfilled_metadata["acquisition_channel"] == "reddit"
    # Préservation des autres metadata existantes
    assert backfilled_metadata["some_other_key"] == "preserve_me"
    assert backfilled_metadata["user_id"] == "42"


@pytest.mark.asyncio
async def test_backfill_resilient_to_stripe_error(mock_session):
    """Si stripe.Customer.modify() raise, on continue (audit non-bloquant)."""
    user = _make_user(stripe_customer_id="cus_LEGACY_FAIL_MODIFY")

    legacy_customer = MagicMock()
    legacy_customer.get = lambda key, default=None: {
        "deleted": False,
        "metadata": {"user_id": "42"},
    }.get(key, default)

    with (
        patch.object(stripe.Customer, "retrieve", return_value=legacy_customer),
        patch.object(
            stripe.Customer,
            "modify",
            side_effect=stripe.error.StripeError("simulated API failure"),
        ),
    ):
        # Ne raise PAS — la fonction retourne le customer_id existant
        cid = await get_or_create_stripe_customer(
            user, mock_session, acquisition_channel="reddit"
        )

    assert cid == "cus_LEGACY_FAIL_MODIFY"
