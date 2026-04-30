"""Tests for the ``voice_call_quick`` plan capability matrix.

Pricing v2 (April 2026) — see ``backend/src/billing/plan_config.py`` and
``CLAUDE.md`` § "Pricing Plans". The capability tuple matrix is now:

  free       → ("trial_only",      3)    # 1-shot 3-min lifetime trial
  pro    v2  → ("monthly_minutes", 30)   # 30 min/mo  (intermediate paid tier)
  expert v2  → ("monthly_minutes", 120)  # 120 min/mo (premium tier)

Pricing v2 reshaped the tier names: the legacy v0 tier ``plus`` is now an
alias for ``pro`` v2 (same 30 min quota), and the legacy v0 ``pro`` is now
an alias for ``expert`` v2 — see ``PLAN_ALIASES`` and the
``VOICE_CALL_QUICK_CAPABILITY`` dict. There is no longer an ``upgrade_cta``
policy: every paid tier in v2 has voice access (only the ``free`` trial
is gated by lifetime usage). Pre-v2 spec § f had ``pro → upgrade_cta`` —
that branch was dropped when the pricing got reshuffled.

The existing ``is_feature_available(plan, feature, platform)`` returns a
boolean and is used by 70+ call sites — keeping its signature unchanged.
The helper ``get_voice_call_quick_capability(plan)`` exposes the v2 tuple.
"""

import pytest

from billing.plan_config import (
    is_feature_available,
    get_voice_call_quick_capability,
)


# ── Spec tuple matrix (Pricing v2, the canonical source of truth) ────────


def test_voice_call_quick_free_returns_trial_only_3():
    assert get_voice_call_quick_capability("free") == ("trial_only", 3)


def test_voice_call_quick_pro_v2_returns_monthly_minutes_30():
    """Pro v2 (intermediate paid tier, 8.99 €/mo) — 30 min/mo voice quota."""
    assert get_voice_call_quick_capability("pro") == ("monthly_minutes", 30)


def test_voice_call_quick_expert_v2_returns_monthly_minutes_120():
    """Expert v2 (premium tier, 19.99 €/mo) — 120 min/mo voice quota."""
    assert get_voice_call_quick_capability("expert") == ("monthly_minutes", 120)


def test_voice_call_quick_legacy_plus_alias_resolves_to_pro_30():
    """v0 ``plus`` is grandfathered as an alias of v2 ``pro`` (30 min/mo)."""
    assert get_voice_call_quick_capability("plus") == ("monthly_minutes", 30)


def test_voice_call_quick_unknown_plan_defaults_to_free():
    assert get_voice_call_quick_capability("nonexistent") == ("trial_only", 3)


# ── Boolean accessor parity (unchanged contract) ─────────────────────────


@pytest.mark.parametrize("platform", ["web", "mobile", "extension"])
def test_voice_call_quick_is_available_for_free_on_all_platforms(platform):
    """Free has the 1-shot trial — boolean accessor returns True."""
    assert is_feature_available("free", "voice_call_quick", platform) is True


@pytest.mark.parametrize("platform", ["web", "mobile", "extension"])
def test_voice_call_quick_is_available_for_pro_on_all_platforms(platform):
    """Pro v2 has voice access (30 min/mo) — boolean accessor returns True."""
    assert is_feature_available("pro", "voice_call_quick", platform) is True


@pytest.mark.parametrize("platform", ["web", "mobile", "extension"])
def test_voice_call_quick_is_available_for_expert_on_all_platforms(platform):
    """Expert v2 has voice access (120 min/mo) — boolean accessor returns True."""
    assert is_feature_available("expert", "voice_call_quick", platform) is True
