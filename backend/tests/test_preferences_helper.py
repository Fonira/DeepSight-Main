"""Tests for core/preferences.py — get_ambient_lighting_enabled feature gate.

The helper is pure (no DB access), so we use plain MagicMock User stubs.
"""
from unittest.mock import MagicMock

import pytest

from core.preferences import (
    AMBIENT_LIGHTING_DEFAULT,
    get_ambient_lighting_enabled,
)


def make_user(preferences=None):
    """Lightweight User mock — only the .preferences attribute is read."""
    user = MagicMock()
    user.preferences = preferences
    return user


# ── Default cases (opt-in: True) ──

def test_user_none_returns_default():
    assert get_ambient_lighting_enabled(None) is True
    assert AMBIENT_LIGHTING_DEFAULT is True


def test_preferences_none_returns_default():
    user = make_user(preferences=None)
    assert get_ambient_lighting_enabled(user) is True


def test_preferences_empty_dict_returns_default():
    user = make_user(preferences={})
    assert get_ambient_lighting_enabled(user) is True


def test_key_absent_returns_default():
    user = make_user(preferences={"other_key": "value", "voice_id": "abc"})
    assert get_ambient_lighting_enabled(user) is True


# ── Explicit values ──

def test_explicit_true_returns_true():
    user = make_user(preferences={"ambient_lighting_enabled": True})
    assert get_ambient_lighting_enabled(user) is True


def test_explicit_false_returns_false():
    user = make_user(preferences={"ambient_lighting_enabled": False})
    assert get_ambient_lighting_enabled(user) is False


# ── Edge case (documented behaviour) ──

def test_truthy_string_coerces_to_true():
    """bool() coerces non-empty strings to True. Documented; UI must pass bool."""
    user = make_user(preferences={"ambient_lighting_enabled": "truthy_string"})
    assert get_ambient_lighting_enabled(user) is True


def test_zero_int_coerces_to_false():
    """bool(0) is False — also documented edge case."""
    user = make_user(preferences={"ambient_lighting_enabled": 0})
    assert get_ambient_lighting_enabled(user) is False
