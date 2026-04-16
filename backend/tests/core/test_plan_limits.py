"""Tests for core/plan_limits.py — April 2026 plan structure (free/plus/pro)."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date


# ── Helpers ──

def make_user(plan="free", is_admin=False, credits=100):
    user = MagicMock()
    user.id = 1
    user.plan = plan
    user.is_admin = is_admin
    user.credits = credits
    user.email = "test@example.com"
    return user


MOCK_FREE_LIMITS = {
    "monthly_analyses": 5,
    "monthly_credits": 250,
    "playlists_enabled": False,
    "web_search_enabled": False,
    "deep_research_enabled": False,
    "export_pdf": False,
    "batch_api_enabled": False,
    "flashcards_enabled": True,
    "quiz_enabled": True,
    "tts_enabled": False,
    "allowed_models": ["mistral-small-2603"],
    "default_model": "mistral-small-2603",
}

MOCK_PLUS_LIMITS = {
    "monthly_analyses": 25,
    "monthly_credits": 3000,
    "playlists_enabled": False,
    "web_search_enabled": True,
    "web_search_monthly": 20,
    "deep_research_enabled": False,
    "export_pdf": True,
    "batch_api_enabled": False,
    "flashcards_enabled": True,
    "quiz_enabled": True,
    "tts_enabled": False,
    "allowed_models": ["mistral-small-2603", "mistral-medium-2508"],
    "default_model": "mistral-medium-2508",
}

MOCK_PRO_LIMITS = {
    "monthly_analyses": -1,  # unlimited
    "monthly_credits": 15000,
    "playlists_enabled": True,
    "max_playlists": 10,
    "web_search_enabled": True,
    "web_search_monthly": 60,
    "deep_research_enabled": True,
    "export_pdf": True,
    "batch_api_enabled": True,
    "flashcards_enabled": True,
    "quiz_enabled": True,
    "tts_enabled": True,
    "allowed_models": ["mistral-small-2603", "mistral-medium-2508", "mistral-large-2512"],
    "default_model": "mistral-large-2512",
}

MOCK_PRO_PLAN = {
    "name": "Pro", "name_en": "Pro",
    "color": "#8B5CF6", "price_monthly_cents": 999,
    "limits": MOCK_PRO_LIMITS,
}


def _limits_for(plan):
    return {"free": MOCK_FREE_LIMITS, "plus": MOCK_PLUS_LIMITS, "pro": MOCK_PRO_LIMITS}[plan]


# ── TestGetNextPlan ──

class TestGetNextPlan:
    def test_free_upgrades_to_pro(self):
        from core.plan_limits import get_next_plan
        assert get_next_plan("free") == "pro"

    def test_plus_upgrades_to_pro(self):
        from core.plan_limits import get_next_plan
        assert get_next_plan("plus") == "pro"

    def test_pro_stays_pro(self):
        from core.plan_limits import get_next_plan
        assert get_next_plan("pro") == "pro"

    def test_legacy_starter_resolves(self):
        from core.plan_limits import get_next_plan
        # starter → plus (via normalize), plus → pro
        assert get_next_plan("starter") == "pro"

    def test_legacy_expert_resolves(self):
        from core.plan_limits import get_next_plan
        # expert → pro (via normalize), pro → pro
        assert get_next_plan("expert") == "pro"

    def test_unknown_plan_resolves_to_free(self):
        from core.plan_limits import get_next_plan
        # unknown → free (via normalize), free → pro
        assert get_next_plan("nonexistent") == "pro"


# ── TestGetRequiredPlanForFeature ──

class TestGetRequiredPlanForFeature:
    def test_flashcards_is_free(self):
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("flashcards") == "free"

    def test_quiz_is_free(self):
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("quiz") == "free"

    def test_playlists_requires_pro(self):
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("playlists") == "pro"

    def test_deep_research_requires_pro(self):
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("deep_research") == "pro"

    def test_batch_api_requires_pro(self):
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("batch_api") == "pro"

    def test_unknown_feature_defaults_to_pro(self):
        from core.plan_limits import get_required_plan_for_feature
        assert get_required_plan_for_feature("nonexistent_feature") == "pro"


# ── TestCheckFeatureAccess ──

class TestCheckFeatureAccess:
    def test_free_user_blocked_from_playlists(self):
        from core.plan_limits import check_feature_access
        user = make_user(plan="free")
        with patch("core.plan_limits.get_limits", return_value=MOCK_FREE_LIMITS), \
             patch("core.plan_limits.get_plan", return_value=MOCK_PRO_PLAN):
            has_access, error = check_feature_access(user, "playlists")
        assert has_access is False
        assert error["code"] == "feature_blocked"

    def test_pro_user_allowed_playlists(self):
        from core.plan_limits import check_feature_access
        user = make_user(plan="pro")
        with patch("core.plan_limits.get_limits", return_value=MOCK_PRO_LIMITS), \
             patch("core.plan_limits.get_plan", return_value=MOCK_PRO_PLAN):
            has_access, error = check_feature_access(user, "playlists")
        assert has_access is True
        assert error is None

    def test_plus_user_allowed_web_search(self):
        from core.plan_limits import check_feature_access
        user = make_user(plan="plus")
        with patch("core.plan_limits.get_limits", return_value=MOCK_PLUS_LIMITS), \
             patch("core.plan_limits.get_plan", return_value=MOCK_PRO_PLAN):
            has_access, error = check_feature_access(user, "web_search")
        assert has_access is True

    def test_expert_alias_has_pro_access(self):
        from core.plan_limits import check_feature_access
        user = make_user(plan="expert")
        with patch("core.plan_limits.get_limits", return_value=MOCK_PRO_LIMITS), \
             patch("core.plan_limits.get_plan", return_value=MOCK_PRO_PLAN):
            has_access, error = check_feature_access(user, "deep_research")
        assert has_access is True

    def test_error_info_contains_upgrade_prompt(self):
        from core.plan_limits import check_feature_access
        user = make_user(plan="free")
        with patch("core.plan_limits.get_limits", return_value=MOCK_FREE_LIMITS), \
             patch("core.plan_limits.get_plan", return_value=MOCK_PRO_PLAN):
            has_access, error = check_feature_access(user, "playlists")
        assert error["required_plan"] == "pro"
        assert error["action"] == "upgrade"


# ── TestCheckDailyAnalysisLimit ──

class TestCheckDailyAnalysisLimit:
    @pytest.mark.asyncio
    async def test_free_user_under_limit_can_analyze(self):
        from core.plan_limits import check_daily_analysis_limit
        user = make_user(plan="free")
        session = AsyncMock()
        with patch("core.plan_limits.get_limits", return_value=MOCK_FREE_LIMITS), \
             patch("core.plan_limits.get_daily_usage", return_value=2):
            can, error = await check_daily_analysis_limit(session, user)
        assert can is True
        assert error is None

    @pytest.mark.asyncio
    async def test_free_user_at_limit_blocked(self):
        from core.plan_limits import check_daily_analysis_limit
        user = make_user(plan="free")
        session = AsyncMock()
        with patch("core.plan_limits.get_limits", return_value=MOCK_FREE_LIMITS), \
             patch("core.plan_limits.get_daily_usage", return_value=5), \
             patch("core.plan_limits.get_plan", return_value=MOCK_PRO_PLAN):
            can, error = await check_daily_analysis_limit(session, user)
        assert can is False
        assert error["code"] == "daily_limit_reached"

    @pytest.mark.asyncio
    async def test_unlimited_user_always_allowed(self):
        from core.plan_limits import check_daily_analysis_limit
        user = make_user(plan="pro")
        session = AsyncMock()
        with patch("core.plan_limits.get_limits", return_value=MOCK_PRO_LIMITS), \
             patch("core.plan_limits.get_daily_usage", return_value=999):
            can, error = await check_daily_analysis_limit(session, user)
        assert can is True  # monthly_analyses=-1 means unlimited

    @pytest.mark.asyncio
    async def test_error_info_suggests_next_plan(self):
        from core.plan_limits import check_daily_analysis_limit
        user = make_user(plan="free")
        session = AsyncMock()
        with patch("core.plan_limits.get_limits", return_value=MOCK_FREE_LIMITS), \
             patch("core.plan_limits.get_daily_usage", return_value=5), \
             patch("core.plan_limits.get_plan", return_value=MOCK_PRO_PLAN):
            can, error = await check_daily_analysis_limit(session, user)
        assert error["next_plan"] == "pro"


# ── TestGetDailyUsage ──

class TestGetDailyUsage:
    @pytest.mark.asyncio
    async def test_returns_zero_when_no_quota_exists(self):
        from core.plan_limits import get_daily_usage
        session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        session.execute.return_value = mock_result
        usage = await get_daily_usage(session, user_id=1)
        assert usage == 0

    @pytest.mark.asyncio
    async def test_returns_usage_from_quota(self):
        from core.plan_limits import get_daily_usage
        session = AsyncMock()
        mock_quota = MagicMock()
        mock_quota.videos_used = 3
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_quota
        session.execute.return_value = mock_result
        usage = await get_daily_usage(session, user_id=1)
        assert usage == 3


# ── TestIncrementDailyUsage ──

class TestIncrementDailyUsage:
    @pytest.mark.asyncio
    async def test_creates_new_quota_when_none_exists(self):
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


# ── TestGetPlanInfo ──

class TestGetPlanInfo:
    def test_returns_correct_plan_info_french(self):
        from core.plan_limits import get_plan_info
        mock_plan = {"name": "Gratuit", "name_en": "Free", "color": "#6B7280",
                     "price_monthly_cents": 0, "limits": MOCK_FREE_LIMITS}
        with patch("core.plan_limits.get_plan", return_value=mock_plan):
            info = get_plan_info("free", lang="fr")
        assert info["plan"] == "free"
        assert info["name"] == "Gratuit"
        assert info["monthly_analyses"] == 5

    def test_returns_correct_plan_info_english(self):
        from core.plan_limits import get_plan_info
        mock_plan = {"name": "Gratuit", "name_en": "Free", "color": "#6B7280",
                     "price_monthly_cents": 0, "limits": MOCK_FREE_LIMITS}
        with patch("core.plan_limits.get_plan", return_value=mock_plan):
            info = get_plan_info("free", lang="en")
        assert info["name"] == "Free"

    def test_unknown_plan_defaults_to_free(self):
        from core.plan_limits import get_plan_info
        mock_plan = {"name": "Gratuit", "name_en": "Free", "color": "#6B7280",
                     "price_monthly_cents": 0, "limits": MOCK_FREE_LIMITS}
        with patch("core.plan_limits.get_plan", return_value=mock_plan):
            info = get_plan_info("nonexistent", lang="fr")
        assert info["plan"] == "free"


# ── TestGetUserLimitsStatus ──

class TestGetUserLimitsStatus:
    @pytest.mark.asyncio
    async def test_returns_complete_status(self):
        from core.plan_limits import get_user_limits_status
        user = make_user(plan="free", credits=100)
        session = AsyncMock()
        mock_plan = {"name": "Gratuit", "name_en": "Free", "color": "#6B7280",
                     "price_monthly_cents": 0, "limits": MOCK_FREE_LIMITS}
        with patch("core.plan_limits.get_limits", return_value=MOCK_FREE_LIMITS), \
             patch("core.plan_limits.get_plan", return_value=mock_plan), \
             patch("core.plan_limits.get_daily_usage", return_value=2):
            status = await get_user_limits_status(session, user)
        assert "daily_analyses" in status
        assert status["daily_analyses"]["limit"] == 5
        assert status["daily_analyses"]["used"] == 2
        assert status["credits"]["current"] == 100

    @pytest.mark.asyncio
    async def test_unlimited_user_status(self):
        from core.plan_limits import get_user_limits_status
        user = make_user(plan="pro", credits=5000)
        session = AsyncMock()
        with patch("core.plan_limits.get_limits", return_value=MOCK_PRO_LIMITS), \
             patch("core.plan_limits.get_plan", return_value=MOCK_PRO_PLAN), \
             patch("core.plan_limits.get_daily_usage", return_value=50):
            status = await get_user_limits_status(session, user)
        assert status["daily_analyses"]["is_unlimited"] is True
        assert status["daily_analyses"]["remaining"] == -1

    @pytest.mark.asyncio
    async def test_usage_percentage_calculation(self):
        from core.plan_limits import get_user_limits_status
        user = make_user(plan="free", credits=100)
        session = AsyncMock()
        mock_plan = {"name": "Gratuit", "name_en": "Free", "color": "#6B7280",
                     "price_monthly_cents": 0, "limits": MOCK_FREE_LIMITS}
        with patch("core.plan_limits.get_limits", return_value=MOCK_FREE_LIMITS), \
             patch("core.plan_limits.get_plan", return_value=mock_plan), \
             patch("core.plan_limits.get_daily_usage", return_value=3):
            status = await get_user_limits_status(session, user)
        assert status["daily_analyses"]["percent_used"] == 60  # 3/5 = 60%
