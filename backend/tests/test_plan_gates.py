"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST PLAN GATES — Tests des gates d'accès par plan                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
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
        "stripe_customer_id": None, "stripe_subscription_id": None,
    }
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 TESTS require_plan DEPENDENCY
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestRequirePlan:
    """Test la factory require_plan() de auth/dependencies.py."""

    @pytest.mark.asyncio
    async def test_free_user_accesses_free_endpoint(self):
        """User free accède feature free → OK."""
        from auth.dependencies import require_plan

        free_user = make_mock_user(plan="free")
        check_fn = require_plan("free")

        # require_plan retourne un callable qui prend current_user (via get_verified_user)
        # On simule l'appel direct en passant le user
        with patch("auth.dependencies.get_verified_user") as m:
            m.return_value = free_user
            # Le check_plan interne attend un User (via Depends)
            # On l'appelle directement pour tester la logique
            result = await check_fn(current_user=free_user)

        assert result == free_user

    @pytest.mark.asyncio
    async def test_free_user_blocked_from_pro(self):
        """User free accède feature pro → 403."""
        from fastapi import HTTPException
        from auth.dependencies import require_plan

        free_user = make_mock_user(plan="free")
        check_fn = require_plan("pro")

        with pytest.raises(HTTPException) as exc_info:
            await check_fn(current_user=free_user)

        assert exc_info.value.status_code == 403
        assert "plan_required" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_starter_user_accesses_starter(self):
        """User starter accède feature starter → OK."""
        from auth.dependencies import require_plan

        starter_user = make_mock_user(plan="starter")
        check_fn = require_plan("starter")

        result = await check_fn(current_user=starter_user)
        assert result == starter_user

    @pytest.mark.asyncio
    async def test_pro_user_accesses_starter(self):
        """User pro accède feature starter → OK (plan supérieur)."""
        from auth.dependencies import require_plan

        pro_user = make_mock_user(plan="pro")
        check_fn = require_plan("starter")

        result = await check_fn(current_user=pro_user)
        assert result == pro_user

    @pytest.mark.asyncio
    async def test_plan_alias_expert_resolves_to_pro(self):
        """User expert (alias → pro) accède feature pro → OK."""
        from auth.dependencies import require_plan

        expert_user = make_mock_user(plan="expert")
        check_fn = require_plan("pro")

        result = await check_fn(current_user=expert_user)
        assert result == expert_user


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 TESTS require_credits DEPENDENCY
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestRequireCredits:

    @pytest.mark.asyncio
    async def test_enough_credits(self):
        """User avec crédits suffisants → OK."""
        from auth.dependencies import require_credits

        user = make_mock_user(credits=50)
        mock_session = AsyncMock()
        check_fn = require_credits(min_credits=3)

        result = await check_fn(current_user=user, session=mock_session)
        assert result == user

    @pytest.mark.asyncio
    async def test_insufficient_credits(self):
        """User avec crédits insuffisants → 403."""
        from fastapi import HTTPException
        from auth.dependencies import require_credits

        user = make_mock_user(credits=0)
        mock_session = AsyncMock()
        check_fn = require_credits(min_credits=3)

        with pytest.raises(HTTPException) as exc_info:
            await check_fn(current_user=user, session=mock_session)

        assert exc_info.value.status_code == 403
        assert "insufficient_credits" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_admin_bypasses_credits(self):
        """Admin user bypasses credit checks."""
        from auth.dependencies import require_credits

        user = make_mock_user(plan="free", credits=0, is_admin=True)
        mock_session = AsyncMock()
        check_fn = require_credits(min_credits=100)

        result = await check_fn(current_user=user, session=mock_session)
        assert result == user


# ═══════════════════════════════════════════════════════════════════════════════
# 🎫 TESTS check_feature_access (core/plan_limits.py)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestFeatureAccess:

    def test_feature_available_for_plan(self):
        """Pro user a accès aux playlists → True."""
        from core.plan_limits import check_feature_access

        pro_user = make_mock_user(plan="pro")
        pro_limits = {"playlists_enabled": True, "deep_research_enabled": True}
        mock_plan = {"name": "Pro", "name_en": "Pro", "color": "#8B5CF6",
                     "price_monthly_cents": 999, "limits": pro_limits}

        with patch("core.plan_limits.get_limits", return_value=pro_limits), \
             patch("core.plan_limits.get_plan", return_value=mock_plan):
            has_access, error = check_feature_access(pro_user, "playlists")

        assert has_access is True
        assert error is None

    def test_feature_blocked_for_free(self):
        """Free user bloqué pour playlists → False."""
        from core.plan_limits import check_feature_access

        free_user = make_mock_user(plan="free")
        free_limits = {"playlists_enabled": False}
        mock_plan = {"name": "Pro", "name_en": "Pro", "color": "#8B5CF6",
                     "price_monthly_cents": 999, "limits": {}}

        with patch("core.plan_limits.get_limits", return_value=free_limits), \
             patch("core.plan_limits.get_plan", return_value=mock_plan):
            has_access, error = check_feature_access(free_user, "playlists")

        assert has_access is False
        assert error is not None
        assert error["code"] == "feature_blocked"

    def test_web_search_for_plus(self):
        """Plus (ex-starter) accède à web_search → True."""
        from core.plan_limits import check_feature_access

        plus_user = make_mock_user(plan="plus")
        plus_limits = {"web_search_enabled": True, "web_search_monthly": 20}
        mock_plan = {"name": "Plus", "limits": plus_limits}

        with patch("core.plan_limits.get_limits", return_value=plus_limits), \
             patch("core.plan_limits.get_plan", return_value=mock_plan):
            has_access, error = check_feature_access(plus_user, "web_search")

        assert has_access is True

    def test_batch_api_blocked_for_plus(self):
        """Plus n'accède pas à batch_api → False."""
        from core.plan_limits import check_feature_access

        plus_user = make_mock_user(plan="plus")
        plus_limits = {"batch_api_enabled": False}
        mock_plan = {"name": "Pro", "limits": {}}

        with patch("core.plan_limits.get_limits", return_value=plus_limits), \
             patch("core.plan_limits.get_plan", return_value=mock_plan):
            has_access, error = check_feature_access(plus_user, "batch_api")

        assert has_access is False
        assert error["required_plan"] == "pro"
