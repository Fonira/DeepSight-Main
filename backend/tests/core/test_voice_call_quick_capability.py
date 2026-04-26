"""Tests for the ``voice_call_quick`` plan capability matrix (Task 7).

Spec § f exposes a per-plan policy tuple :
  free   → ("trial_only",      3)
  pro    → ("upgrade_cta",     None)
  expert → ("monthly_minutes", 30)

The existing ``is_feature_available(plan, feature, platform)`` returns a
boolean and is used by 70+ call sites — keeping its signature unchanged.
A NEW helper ``get_voice_call_quick_capability(plan)`` exposes the spec
tuple. The boolean accessor still returns True for plans where the call
type is reachable (Free trial, Expert monthly) and False otherwise (Pro
gets the CTA upgrade-only path, treated as "not available").
"""

import pytest

from billing.plan_config import (
    is_feature_available,
    get_voice_call_quick_capability,
)


# ── Spec tuple matrix (the canonical source of truth) ────────────────────


def test_voice_call_quick_free_returns_trial_only_3():
    assert get_voice_call_quick_capability("free") == ("trial_only", 3)


def test_voice_call_quick_pro_returns_upgrade_cta_none():
    """In the spec, 'pro' is the intermediate paid tier blocked from voice
    (always sees CTA upgrade to expert). Here it maps to the actual `plus`
    tier for compatibility — `pro` (Spec) ≡ `plus` (current SSOT) since
    the code's `pro` IS the premium tier."""
    assert get_voice_call_quick_capability("plus") == ("upgrade_cta", None)


def test_voice_call_quick_expert_returns_monthly_minutes_30():
    """`expert` (Spec) ≡ `pro` (current SSOT premium tier)."""
    assert get_voice_call_quick_capability("pro") == ("monthly_minutes", 30)


def test_voice_call_quick_capability_with_legacy_expert_alias():
    """The literal `expert` alias still resolves to the premium policy."""
    assert get_voice_call_quick_capability("expert") == ("monthly_minutes", 30)


def test_voice_call_quick_unknown_plan_defaults_to_free():
    assert get_voice_call_quick_capability("nonexistent") == ("trial_only", 3)


# ── Boolean accessor parity (unchanged contract) ─────────────────────────


@pytest.mark.parametrize("platform", ["web", "mobile", "extension"])
def test_voice_call_quick_is_available_for_free_on_all_platforms(platform):
    """Free has the 1-shot trial — boolean accessor returns True."""
    assert is_feature_available("free", "voice_call_quick", platform) is True


@pytest.mark.parametrize("platform", ["web", "mobile", "extension"])
def test_voice_call_quick_is_available_for_expert_on_all_platforms(platform):
    """Expert (== `pro` SSOT premium) gets 30 min monthly — True."""
    assert is_feature_available("pro", "voice_call_quick", platform) is True


@pytest.mark.parametrize("platform", ["web", "mobile", "extension"])
def test_voice_call_quick_is_blocked_for_pro_intermediate(platform):
    """Spec's `pro` (== `plus` SSOT intermediate) sees CTA only — False."""
    assert is_feature_available("plus", "voice_call_quick", platform) is False
