"""
Tests for model resolution in `api_public/router.py::analyze_video_api`.

Sprint 2026-05-12 — before this fix, the public API `/api/v1/analyze` (used
by the DeepSight MCP `ds_analyze` tool) hardcoded `model="mistral-small-2603"`
when calling `_analyze_video_background_v6`. Result : ALL MCP-driven analyses
ran on the Free-tier model regardless of `user.plan`.

Observable : Summary 208/209/210/211 all had `model_used = "mistral-small-2603"`
despite `user.plan = "expert"` (which should resolve to `mistral-large-2512`).

PR #473 had already fixed the frontend path (`/api/videos/analyze`) by adding
the missing `EXPERT` key to the legacy `PLAN_LIMITS` shim. This PR closes
the parallel hole in the public API.

These tests verify :
1. The hardcoded `model="mistral-small-2603"` literal is GONE.
2. The endpoint now resolves the model via `billing.plan_config.get_limits`.
3. `get_limits("expert").default_model == "mistral-large-2512"`.
4. `get_limits("pro").default_model == "mistral-medium-2508"`.
5. `get_limits("free").default_model == "mistral-small-2603"`.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


class TestApiPublicModelResolution:
    """Source-level locks : `analyze_video_api` resolves model dynamically."""

    def test_no_hardcoded_small_model_in_analyze(self):
        """The literal `model="mistral-small-2603"` must NOT appear in the
        analyze endpoint anymore. Regression guard against future copies."""
        import inspect

        from api_public import router as api_public_router

        src = inspect.getsource(api_public_router)
        # Find the analyze_video_api function body
        idx = src.index("async def analyze_video_api")
        end_idx = src.index("\n@router.", idx) if "\n@router." in src[idx:] else len(src)
        analyze_body = src[idx:end_idx]

        assert 'model="mistral-small-2603"' not in analyze_body, (
            "analyze_video_api still hardcodes model='mistral-small-2603'. "
            "This forces Expert users onto the Free-tier model when calling "
            "via MCP (`ds_analyze`). Use get_limits(user.plan).default_model "
            "instead."
        )

    def test_get_limits_imported_in_analyze(self):
        """Verify the dynamic-resolution path is wired up."""
        import inspect

        from api_public import router as api_public_router

        src = inspect.getsource(api_public_router)
        # The fix imports `get_limits` inline before _analyze_video_background_v6
        # OR at module level. Either is acceptable.
        assert "get_limits" in src, (
            "api_public/router.py should call get_limits() to resolve the "
            "Mistral model from the user's plan instead of hardcoding."
        )

    def test_resolved_model_passed_to_background_task(self):
        """The kwarg `model=...` must reference a resolved variable, not a
        literal string."""
        import inspect

        from api_public import router as api_public_router

        src = inspect.getsource(api_public_router)
        idx = src.index("async def analyze_video_api")
        end_idx = src.index("\n@router.", idx) if "\n@router." in src[idx:] else len(src)
        analyze_body = src[idx:end_idx]

        # The fix uses `model=_resolved_model` (variable, not literal)
        assert "_resolved_model" in analyze_body or "default_model" in analyze_body, (
            "analyze_video_api should compute a resolved model variable from "
            "the plan limits and pass it as model=<variable>, not a literal."
        )


class TestPlanLimitsReturnShape:
    """Sanity check that get_limits returns the expected shape for our use case."""

    def test_free_default_model(self):
        from billing.plan_config import get_limits

        assert get_limits("free")["default_model"] == "mistral-small-2603"

    def test_pro_default_model(self):
        from billing.plan_config import get_limits

        # v2 PRO is intermediate tier (8.99€) → medium model
        assert get_limits("pro")["default_model"] == "mistral-medium-2508"

    def test_expert_default_model(self):
        from billing.plan_config import get_limits

        # v2 EXPERT is top tier (19.99€) → large model
        assert get_limits("expert")["default_model"] == "mistral-large-2512"

    def test_unknown_plan_falls_back_safely(self):
        from billing.plan_config import get_limits

        # Unknown / null-plan users should not crash ; get_limits should
        # return a sensible default (typically free).
        limits = get_limits("nonexistent_plan_xyz")
        assert "default_model" in limits
