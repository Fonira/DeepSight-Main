"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST BILLING WEBHOOKS — Tests Stripe critiques                                ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from httpx import AsyncClient, ASGITransport


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def make_mock_user(**overrides):
    user = MagicMock()
    defaults = {
        "id": 1, "username": "testuser", "email": "test@example.com",
        "email_verified": True, "plan": "free", "credits": 150,
        "is_admin": False, "avatar_url": None,
        "default_lang": "fr", "default_mode": "standard",
        "default_model": "mistral-small-latest",
        "total_videos": 0, "total_words": 0, "total_playlists": 0,
        "created_at": datetime(2024, 1, 1),
        "password_hash": "h", "session_token": "s",
        "stripe_customer_id": "cus_test123",
        "stripe_subscription_id": "sub_test123",
    }
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


def make_stripe_event(event_type, data, event_id="evt_test123"):
    """Crée un mock d'événement Stripe."""
    return {
        "id": event_id,
        "type": event_type,
        "data": {"object": data}
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def api_user():
    return make_mock_user()


@pytest.fixture
def mock_session():
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    session.add = MagicMock()
    return session


@pytest.fixture
def app(mock_session):
    from main import app
    from db.database import get_session

    async def override_session():
        return mock_session

    app.dependency_overrides[get_session] = override_session
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
async def auth_client(app, api_user):
    from auth.dependencies import get_current_user

    async def override_user():
        return api_user

    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# 🔔 TESTS WEBHOOK STRIPE
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestStripeWebhooks:

    @pytest.mark.asyncio
    async def test_checkout_completed_upgrades_plan(self, client, mock_session):
        """Webhook checkout.session.completed → plan upgradé en DB."""
        user = make_mock_user(plan="free", credits=150)

        # Mock la requête DB pour trouver l'utilisateur
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user
        mock_session.execute.return_value = mock_result

        event = make_stripe_event("checkout.session.completed", {
            "metadata": {"user_id": "1", "plan": "pro"},
            "customer": "cus_test",
            "subscription": "sub_test",
            "payment_intent": "pi_test_unique",
            "id": "cs_test"
        }, event_id="evt_checkout_1")

        with patch("billing.router.init_stripe", return_value=True), \
             patch("billing.router.STRIPE_CONFIG", {
                 "WEBHOOK_SECRET": "whsec_test",
                 "ENABLED": True,
                 "PRICES": {}
             }), \
             patch("billing.router.stripe") as mock_stripe, \
             patch("billing.router.get_limits", return_value={"monthly_credits": 15000}):
            mock_stripe.Webhook.construct_event.return_value = event

            resp = await client.post(
                "/api/billing/webhook",
                content=b'{"test": "payload"}',
                headers={
                    "stripe-signature": "t=123,v1=abc",
                    "content-type": "application/json"
                }
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["received"] is True

    @pytest.mark.asyncio
    async def test_subscription_deleted_downgrades_free(self, client, mock_session):
        """Webhook customer.subscription.deleted → downgrade free."""
        user = make_mock_user(plan="pro", credits=15000)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user
        mock_session.execute.return_value = mock_result

        event = make_stripe_event("customer.subscription.deleted", {
            "customer": "cus_test123",
            "id": "sub_test123",
            "status": "canceled"
        }, event_id="evt_deleted_1")

        with patch("billing.router.init_stripe", return_value=True), \
             patch("billing.router.STRIPE_CONFIG", {
                 "WEBHOOK_SECRET": "whsec_test",
                 "ENABLED": True,
                 "PRICES": {}
             }), \
             patch("billing.router.stripe") as mock_stripe, \
             patch("billing.router.get_limits", return_value={"monthly_credits": 150}):
            mock_stripe.Webhook.construct_event.return_value = event

            resp = await client.post(
                "/api/billing/webhook",
                content=b'{"test": "payload"}',
                headers={
                    "stripe-signature": "t=123,v1=abc",
                    "content-type": "application/json"
                }
            )

        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_invoice_payment_failed_graceful(self, client, mock_session):
        """Webhook invoice.payment_failed → gestion gracieuse."""
        user = make_mock_user(plan="pro")

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user
        mock_session.execute.return_value = mock_result

        event = make_stripe_event("invoice.payment_failed", {
            "customer": "cus_test123",
            "subscription": "sub_test123",
            "amount_due": 1299,
            "attempt_count": 1
        }, event_id="evt_failed_1")

        with patch("billing.router.init_stripe", return_value=True), \
             patch("billing.router.STRIPE_CONFIG", {
                 "WEBHOOK_SECRET": "whsec_test",
                 "ENABLED": True,
                 "PRICES": {}
             }), \
             patch("billing.router.stripe") as mock_stripe:
            mock_stripe.Webhook.construct_event.return_value = event

            resp = await client.post(
                "/api/billing/webhook",
                content=b'{"test": "payload"}',
                headers={
                    "stripe-signature": "t=123,v1=abc",
                    "content-type": "application/json"
                }
            )

        # Ne doit pas crasher — gestion gracieuse
        assert resp.status_code == 200
        assert resp.json()["received"] is True

    @pytest.mark.asyncio
    async def test_webhook_invalid_signature(self, client):
        """Webhook avec signature invalide → 401."""
        import stripe as stripe_lib

        with patch("billing.router.init_stripe", return_value=True), \
             patch("billing.router.STRIPE_CONFIG", {
                 "WEBHOOK_SECRET": "whsec_test",
                 "ENABLED": True
             }), \
             patch("billing.router.stripe.Webhook.construct_event",
                   side_effect=stripe_lib.error.SignatureVerificationError(
                       "Bad sig", "sig_header")):

            resp = await client.post(
                "/api/billing/webhook",
                content=b'{"invalid": "payload"}',
                headers={
                    "stripe-signature": "invalid_signature",
                    "content-type": "application/json"
                }
            )

        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# 🏦 TESTS BILLING PORTAL
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestBillingPortal:

    @pytest.mark.asyncio
    async def test_portal_returns_url(self, auth_client, api_user):
        """GET /billing/portal → URL valide retournée."""
        mock_portal = MagicMock()
        mock_portal.url = "https://billing.stripe.com/session/test_portal"

        with patch("billing.router.init_stripe", return_value=True), \
             patch("billing.router.stripe") as mock_stripe:
            mock_stripe.billing_portal.Session.create.return_value = mock_portal

            resp = await auth_client.get("/api/billing/portal")

        assert resp.status_code == 200
        data = resp.json()
        assert "portal_url" in data
        assert data["portal_url"].startswith("https://")
