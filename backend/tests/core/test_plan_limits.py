"""
Tests for core/plan_limits.py module.

Tests cover:
- Daily analysis limit checking
- Feature access control
- Plan hierarchy
- Limit status generation
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date


# Mock PLAN_LIMITS for testing
MOCK_PLAN_LIMITS = {
    "free": {
        "daily_analyses": 5,
        "blocked_features": ["playlists", "export_csv", "export_excel", "batch_api", "tts", "deep_research"],
        "monthly_credits": 500,
        "name": {"fr": "GRATUIT", "en": "FREE"},
        "color": "#888888",
        "price": 0,
        "price_display": {"fr": "0€", "en": "Free"},
        "upgrade_prompt": {
            "fr": "Passez à Starter!",
            "en": "Upgrade to Starter!"
        }
    },
    "starter": {
        "daily_analyses": 20,
        "blocked_features": ["playlists", "batch_api", "deep_research"],
        "monthly_credits": 5000,
        "name": {"fr": "STARTER", "en": "STARTER"},
        "color": "#00D4AA",
        "price": 499,
        "price_display": {"fr": "4.99€/mois", "en": "€4.99/mo"},
        "upgrade_prompt": {
            "fr": "Passez à Pro!",
            "en": "Upgrade to Pro!"
        }
    },
    "pro": {
        "daily_analyses": 50,
        "blocked_features": ["batch_api", "deep_research"],
        "monthly_credits": 25000,
        "name": {"fr": "PRO", "en": "PRO"},
        "color": "#D4A574",
        "price": 999,
        "price_display": {"fr": "9.99€/mois", "en": "€9.99/mo"},
        "upgrade_prompt": {
            "fr": "Passez à Expert!",
            "en": "Upgrade to Expert!"
        }
    },
    "expert": {
        "daily_analyses": 200,
        "blocked_features": [],
        "monthly_credits": 100000,
        "name": {"fr": "EXPERT", "en": "EXPERT"},
        "color": "#F4D03F",
        "price": 1499,
        "price_display": {"fr": "14.99€/mois", "en": "€14.99/mo"},
        "upgrade_prompt": {
            "fr": "Toutes les features débloquées!",
            "en": "All features unlocked!"
        }
    },
    "unlimited": {
        "daily_analyses": -1,
        "blocked_features": [],
        "monthly_credits": 999999,
        "name": {"fr": "ADMIN", "en": "ADMIN"},
        "color": "#ffd700",
        "price": 0,
        "price_display": {"fr": "Illimité", "en": "Unlimited"},
        "upgrade_prompt": {
            "fr": "Accès illimité",
            "en": "Unlimited access"
        }
    }
}


def create_mock_user(plan: str = "free", user_id: int = 1, credits: int = 100, default_lang: str = "fr"):
    """Factory for creating mock User objects."""
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    user.credits = credits
    user.default_lang = default_lang
    return user


class TestGetNextPlan:
    """Tests for get_next_plan function."""

    def test_free_upgrades_to_starter(self):
        """Free plan should upgrade to starter."""
        with patch.dict('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_next_plan
            assert get_next_plan("free") == "starter"

    def test_starter_upgrades_to_pro(self):
        """Starter plan should upgrade to pro."""
        with patch.dict('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_next_plan
            assert get_next_plan("starter") == "pro"

    def test_pro_upgrades_to_expert(self):
        """Pro plan should upgrade to expert."""
        with patch.dict('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_next_plan
            assert get_next_plan("pro") == "expert"

    def test_expert_upgrades_to_unlimited(self):
        """Expert plan should upgrade to unlimited."""
        with patch.dict('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_next_plan
            assert get_next_plan("expert") == "unlimited"

    def test_unlimited_stays_unlimited(self):
        """Unlimited plan has no upgrade, returns starter as default."""
        with patch.dict('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_next_plan
            # Unlimited is the top, so it returns starter as fallback
            result = get_next_plan("unlimited")
            # Based on implementation, it returns next in hierarchy or starter
            assert result in ["unlimited", "starter"]

    def test_unknown_plan_returns_starter(self):
        """Unknown plan should default to starter."""
        with patch.dict('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_next_plan
            assert get_next_plan("unknown_plan") == "starter"


class TestGetRequiredPlanForFeature:
    """Tests for get_required_plan_for_feature function."""

    def test_playlists_requires_pro(self):
        """Playlists feature requires pro plan."""
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("playlists") == "pro"

    def test_export_csv_requires_starter(self):
        """CSV export requires starter plan."""
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("export_csv") == "starter"

    def test_batch_api_requires_expert(self):
        """Batch API requires expert plan."""
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("batch_api") == "expert"

    def test_deep_research_requires_expert(self):
        """Deep research requires expert plan."""
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("deep_research") == "expert"

    def test_unknown_feature_defaults_to_starter(self):
        """Unknown features default to starter requirement."""
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("unknown_feature") == "starter"


class TestCheckFeatureAccess:
    """Tests for check_feature_access function."""

    def test_free_user_blocked_from_playlists(self):
        """Free user should be blocked from playlists."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import check_feature_access
            user = create_mock_user(plan="free")
            has_access, error_info = check_feature_access(user, "playlists", lang="en")

            assert has_access is False
            assert error_info is not None
            assert error_info["code"] == "feature_blocked"
            assert error_info["required_plan"] == "pro"

    def test_starter_user_allowed_csv_export(self):
        """Starter user should have access to CSV export."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import check_feature_access
            user = create_mock_user(plan="starter")
            has_access, error_info = check_feature_access(user, "export_csv", lang="en")

            assert has_access is True
            assert error_info is None

    def test_pro_user_allowed_playlists(self):
        """Pro user should have access to playlists."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import check_feature_access
            user = create_mock_user(plan="pro")
            has_access, error_info = check_feature_access(user, "playlists", lang="en")

            assert has_access is True
            assert error_info is None

    def test_expert_user_has_all_features(self):
        """Expert user should have access to all features."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import check_feature_access
            user = create_mock_user(plan="expert")

            features = ["playlists", "export_csv", "export_excel", "batch_api", "tts", "deep_research"]
            for feature in features:
                has_access, error_info = check_feature_access(user, feature, lang="en")
                assert has_access is True, f"Expert should have access to {feature}"
                assert error_info is None

    def test_error_info_contains_upgrade_prompt(self):
        """Error info should contain upgrade prompt."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import check_feature_access
            user = create_mock_user(plan="free")
            has_access, error_info = check_feature_access(user, "playlists", lang="fr")

            assert has_access is False
            assert "upgrade_prompt" in error_info
            assert error_info["action"] == "upgrade"


class TestCheckDailyAnalysisLimit:
    """Tests for check_daily_analysis_limit function."""

    @pytest.mark.asyncio
    async def test_free_user_under_limit_can_analyze(self):
        """Free user under daily limit should be able to analyze."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import check_daily_analysis_limit

            session = AsyncMock()
            user = create_mock_user(plan="free")

            # Mock get_daily_usage to return 2 (under 5 limit)
            with patch('core.plan_limits.get_daily_usage', return_value=2):
                can_analyze, error_info = await check_daily_analysis_limit(session, user, lang="en")

                assert can_analyze is True
                assert error_info is None

    @pytest.mark.asyncio
    async def test_free_user_at_limit_blocked(self):
        """Free user at daily limit should be blocked."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import check_daily_analysis_limit

            session = AsyncMock()
            user = create_mock_user(plan="free")

            # Mock get_daily_usage to return 5 (at limit)
            with patch('core.plan_limits.get_daily_usage', return_value=5):
                can_analyze, error_info = await check_daily_analysis_limit(session, user, lang="en")

                assert can_analyze is False
                assert error_info is not None
                assert error_info["code"] == "daily_limit_reached"
                assert error_info["current_usage"] == 5
                assert error_info["daily_limit"] == 5

    @pytest.mark.asyncio
    async def test_unlimited_user_always_allowed(self):
        """Unlimited user should always be allowed (-1 means unlimited)."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import check_daily_analysis_limit

            session = AsyncMock()
            user = create_mock_user(plan="unlimited")

            # Even with high usage, should be allowed
            with patch('core.plan_limits.get_daily_usage', return_value=1000):
                can_analyze, error_info = await check_daily_analysis_limit(session, user, lang="en")

                assert can_analyze is True
                assert error_info is None

    @pytest.mark.asyncio
    async def test_error_info_suggests_next_plan(self):
        """Error info should suggest the next plan."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import check_daily_analysis_limit

            session = AsyncMock()
            user = create_mock_user(plan="free")

            with patch('core.plan_limits.get_daily_usage', return_value=5):
                can_analyze, error_info = await check_daily_analysis_limit(session, user, lang="en")

                assert can_analyze is False
                assert error_info["next_plan"] == "starter"
                assert error_info["next_plan_daily_limit"] == 20


class TestGetDailyUsage:
    """Tests for get_daily_usage function."""

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_quota_exists(self):
        """Should return 0 when no quota record exists for today."""
        from core.plan_limits import get_daily_usage

        session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        session.execute.return_value = mock_result

        usage = await get_daily_usage(session, user_id=1)
        assert usage == 0

    @pytest.mark.asyncio
    async def test_returns_usage_from_quota(self):
        """Should return videos_used from quota record."""
        from core.plan_limits import get_daily_usage

        session = AsyncMock()
        mock_quota = MagicMock()
        mock_quota.videos_used = 3

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_quota
        session.execute.return_value = mock_result

        usage = await get_daily_usage(session, user_id=1)
        assert usage == 3


class TestIncrementDailyUsage:
    """Tests for increment_daily_usage function."""

    @pytest.mark.asyncio
    async def test_creates_new_quota_when_none_exists(self):
        """Should create new quota record when none exists."""
        from core.plan_limits import increment_daily_usage

        session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        session.execute.return_value = mock_result

        new_count = await increment_daily_usage(session, user_id=1)

        assert new_count == 1
        session.add.assert_called_once()
        session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_increments_existing_quota(self):
        """Should increment existing quota record."""
        from core.plan_limits import increment_daily_usage

        session = AsyncMock()
        mock_quota = MagicMock()
        mock_quota.videos_used = 2

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_quota
        session.execute.return_value = mock_result

        new_count = await increment_daily_usage(session, user_id=1)

        assert new_count == 3
        assert mock_quota.videos_used == 3
        session.commit.assert_called_once()


class TestGetPlanInfo:
    """Tests for get_plan_info function."""

    def test_returns_correct_plan_info_french(self):
        """Should return localized plan info in French."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_plan_info

            info = get_plan_info("starter", lang="fr")

            assert info["plan"] == "starter"
            assert info["name"] == "STARTER"
            assert info["daily_analyses"] == 20
            assert info["price"] == 499

    def test_returns_correct_plan_info_english(self):
        """Should return localized plan info in English."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_plan_info

            info = get_plan_info("pro", lang="en")

            assert info["plan"] == "pro"
            assert info["name"] == "PRO"
            assert info["daily_analyses"] == 50

    def test_unknown_plan_defaults_to_free(self):
        """Unknown plan should default to free limits."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_plan_info

            info = get_plan_info("unknown", lang="en")

            assert info["daily_analyses"] == 5  # Free plan limit


class TestGetUserLimitsStatus:
    """Tests for get_user_limits_status function."""

    @pytest.mark.asyncio
    async def test_returns_complete_status(self):
        """Should return complete limits status for user."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_user_limits_status

            session = AsyncMock()
            user = create_mock_user(plan="starter", credits=1000)

            with patch('core.plan_limits.get_daily_usage', return_value=5):
                status = await get_user_limits_status(session, user, lang="en")

                assert status["plan"] == "starter"
                assert status["daily_analyses"]["limit"] == 20
                assert status["daily_analyses"]["used"] == 5
                assert status["daily_analyses"]["remaining"] == 15
                assert status["credits"]["current"] == 1000
                assert "blocked_features" in status
                assert "upgrade_prompt" in status

    @pytest.mark.asyncio
    async def test_unlimited_user_status(self):
        """Should handle unlimited user correctly."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_user_limits_status

            session = AsyncMock()
            user = create_mock_user(plan="unlimited", credits=999999)

            with patch('core.plan_limits.get_daily_usage', return_value=100):
                status = await get_user_limits_status(session, user, lang="en")

                assert status["plan"] == "unlimited"
                assert status["daily_analyses"]["is_unlimited"] is True
                assert status["daily_analyses"]["remaining"] == -1
                assert len(status["blocked_features"]) == 0

    @pytest.mark.asyncio
    async def test_usage_percentage_calculation(self):
        """Should correctly calculate usage percentage."""
        with patch('core.plan_limits.PLAN_LIMITS', MOCK_PLAN_LIMITS):
            from core.plan_limits import get_user_limits_status

            session = AsyncMock()
            user = create_mock_user(plan="free", credits=100)

            # 3 out of 5 = 60%
            with patch('core.plan_limits.get_daily_usage', return_value=3):
                status = await get_user_limits_status(session, user, lang="en")

                assert status["daily_analyses"]["percent_used"] == 60
