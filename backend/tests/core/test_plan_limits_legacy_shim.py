"""
Tests for the legacy `PLAN_LIMITS` shim in `core/config.py`.

Sprint 2026-05-12 — `_build_legacy_plan_limits()` was missing `PlanId.EXPERT`
in its iteration, so `PLAN_LIMITS["expert"]` didn't exist. All call sites
doing `PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])` with `plan="expert"`
fell back to FREE limits — wrong model, blocked features, low credits.

Observable impact : Summaries 208/209/210 (post-migration v2) all had
`model_used = "mistral-small-2603"` (Free model) instead of
`"mistral-large-2512"` (Expert model). These tests lock the fix.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


class TestPlanLimitsExpertKey:
    """The key v2 plan `expert` must exist with proper Expert-tier limits."""

    def test_expert_key_present(self):
        from core.config import PLAN_LIMITS
        assert "expert" in PLAN_LIMITS, (
            "PLAN_LIMITS missing 'expert' key. Users on plan=expert (v2) "
            "fall back to FREE limits, causing model_used=mistral-small-2603 "
            "and blocked features. Cf. _build_legacy_plan_limits() iteration."
        )

    def test_expert_default_model_is_large(self):
        from core.config import PLAN_LIMITS
        assert PLAN_LIMITS["expert"]["default_model"] == "mistral-large-2512"

    def test_expert_models_include_all_tiers(self):
        from core.config import PLAN_LIMITS
        models = PLAN_LIMITS["expert"]["models"]
        assert "mistral-large-2512" in models
        assert "mistral-medium-2508" in models
        assert "mistral-small-2603" in models

    def test_expert_no_blocked_features(self):
        from core.config import PLAN_LIMITS
        assert PLAN_LIMITS["expert"]["blocked_features"] == []

    def test_expert_deep_research_enabled(self):
        from core.config import PLAN_LIMITS
        assert PLAN_LIMITS["expert"]["deep_research_enabled"] is True

    def test_expert_web_search_enabled(self):
        from core.config import PLAN_LIMITS
        assert PLAN_LIMITS["expert"]["web_search_enabled"] is True

    def test_expert_voice_chat_enabled(self):
        from core.config import PLAN_LIMITS
        assert PLAN_LIMITS["expert"]["voice_chat_enabled"] is True


class TestPlanLimitsRegressionGuard:
    """Other plans must remain intact (no regression on legacy semantics)."""

    def test_free_present(self):
        from core.config import PLAN_LIMITS
        assert "free" in PLAN_LIMITS
        assert PLAN_LIMITS["free"]["default_model"] == "mistral-small-2603"

    def test_pro_v2_default_model_is_medium(self):
        """v2 PRO is the intermediate tier (8.99€/mo) — medium model."""
        from core.config import PLAN_LIMITS
        assert "pro" in PLAN_LIMITS
        # v2 pro = intermediate ; medium-2508 is the default per plan_config.py
        assert PLAN_LIMITS["pro"]["default_model"] == "mistral-medium-2508"

    def test_unlimited_admin_uses_large_model(self):
        """Admin 'unlimited' must use the TOP model (large), not medium.
        Sprint 2026-05-12 : was copying `pro` (medium in v2) — now copies
        `expert` (large) so admin always has the most capable model."""
        from core.config import PLAN_LIMITS
        assert "unlimited" in PLAN_LIMITS
        assert PLAN_LIMITS["unlimited"]["default_model"] == "mistral-large-2512"
        assert PLAN_LIMITS["unlimited"]["blocked_features"] == []

    def test_plus_legacy_still_present(self):
        """Grandfathered users on `plus` (v0) must still resolve."""
        from core.config import PLAN_LIMITS
        assert "plus" in PLAN_LIMITS


class TestRouterModelSelectionForExpert:
    """End-to-end regression : `videos/router.py:877` pattern resolves
    Expert user → large-2512, not small-2603."""

    def test_expert_resolves_to_large_via_legacy_pattern(self):
        """Mirrors the pattern at videos/router.py:877 + similar lines."""
        from core.config import PLAN_LIMITS

        # Simulate request.model = None (MCP / no explicit model)
        request_model = None
        user_plan = "expert"

        plan_limits = PLAN_LIMITS.get(user_plan, PLAN_LIMITS["free"])
        model = request_model or plan_limits.get("default_model", "mistral-small-2603")
        allowed_models = plan_limits.get("models", ["mistral-small-2603"])
        if model not in allowed_models:
            model = allowed_models[0]

        assert model == "mistral-large-2512", (
            f"Expert user should resolve to mistral-large-2512, got {model!r}. "
            f"Bug : PLAN_LIMITS.get('expert', ...) fell back to FREE limits "
            f"because the 'expert' key was missing."
        )
