"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🚩 TEST POSTHOG CLIENT — Feature Flags + Fallback                                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couverture:                                                                       ║
║  • PostHog client returns True  → helper renvoie True                             ║
║  • PostHog client returns False → helper renvoie False                            ║
║  • PostHog timeout/exception    → fallback env var (truthy)                       ║
║  • PostHog timeout + env unset  → fallback default                                ║
║  • PostHog returns None (flag unknown) → fallback env var                         ║
║  • SDK absent / clé absente     → fallback direct                                 ║
║  • Truthy values acceptées      → "1", "true", "yes", "on"                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock, patch

import pytest


# Configuration env minimale pour pouvoir importer config + service
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


@pytest.fixture(autouse=True)
def _reset_singleton():
    """Réinitialise le singleton PostHog avant + après chaque test."""
    from core.posthog_client import _reset_for_tests

    _reset_for_tests()
    yield
    _reset_for_tests()


@pytest.fixture
def _fake_settings():
    """Settings PostHog 'configurées' (clé fournie)."""
    fake = MagicMock()
    fake.POSTHOG_API_KEY = "phc_test_fake_key_for_unit_tests"
    fake.POSTHOG_HOST = "https://eu.i.posthog.com"
    return fake


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 1 — PostHog dit True → helper renvoie True
# ═══════════════════════════════════════════════════════════════════════════════


def test_posthog_returns_true_helper_returns_true(_fake_settings):
    """Si PostHog renvoie True pour le flag, le helper renvoie True
    et n'utilise PAS le fallback env var."""
    from core import posthog_client

    mock_client = MagicMock()
    mock_client.feature_enabled.return_value = True

    with patch.object(posthog_client, "_settings", _fake_settings), patch(
        "posthog.Posthog", return_value=mock_client
    ):
        # Env var = absent → si PostHog échouait, le fallback serait False
        # (default), donc on prouve bien que c'est PostHog qui répond True.
        result = posthog_client.feature_enabled_with_fallback(
            flag_key="semantic-search-v1",
            distinct_id="user-42",
            env_var_fallback="SEMANTIC_SEARCH_V1_ENABLED",
            default=False,
        )

    assert result is True
    mock_client.feature_enabled.assert_called_once_with(
        "semantic-search-v1", "user-42"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 2 — PostHog dit False → helper renvoie False
# ═══════════════════════════════════════════════════════════════════════════════


def test_posthog_returns_false_helper_returns_false(_fake_settings, monkeypatch):
    """PostHog explicit False écrase l'env var truthy : c'est PostHog la
    source de vérité quand il répond."""
    from core import posthog_client

    mock_client = MagicMock()
    mock_client.feature_enabled.return_value = False

    # Env var truthy mais PostHog dit False → résultat = False
    monkeypatch.setenv("SEMANTIC_SEARCH_V1_ENABLED", "true")

    with patch.object(posthog_client, "_settings", _fake_settings), patch(
        "posthog.Posthog", return_value=mock_client
    ):
        result = posthog_client.feature_enabled_with_fallback(
            flag_key="semantic-search-v1",
            distinct_id="user-42",
            env_var_fallback="SEMANTIC_SEARCH_V1_ENABLED",
            default=False,
        )

    assert result is False


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 3 — PostHog timeout → fallback env var (truthy)
# ═══════════════════════════════════════════════════════════════════════════════


def test_posthog_timeout_falls_back_to_env_var(_fake_settings, monkeypatch):
    """Si PostHog throw (timeout, network error, etc.), on lit l'env var."""
    from core import posthog_client

    mock_client = MagicMock()
    mock_client.feature_enabled.side_effect = TimeoutError("PostHog /decide timeout")

    # Env var = "true" → fallback doit donner True
    monkeypatch.setenv("MISTRAL_AGENT_ENABLED", "true")

    with patch.object(posthog_client, "_settings", _fake_settings), patch(
        "posthog.Posthog", return_value=mock_client
    ):
        result = posthog_client.feature_enabled_with_fallback(
            flag_key="mistral-agent",
            distinct_id="server",
            env_var_fallback="MISTRAL_AGENT_ENABLED",
            default=False,
        )

    assert result is True


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 4 — PostHog timeout + env unset → default
# ═══════════════════════════════════════════════════════════════════════════════


def test_posthog_timeout_and_no_env_returns_default(_fake_settings, monkeypatch):
    """Aucun fallback dispo → on respecte le `default` passé."""
    from core import posthog_client

    mock_client = MagicMock()
    mock_client.feature_enabled.side_effect = Exception("API unreachable")

    # S'assurer que l'env var n'existe pas
    monkeypatch.delenv("MAGISTRAL_EPISTEMIC_ENABLED", raising=False)

    with patch.object(posthog_client, "_settings", _fake_settings), patch(
        "posthog.Posthog", return_value=mock_client
    ):
        result_default_true = posthog_client.feature_enabled_with_fallback(
            flag_key="magistral",
            distinct_id="user-1",
            env_var_fallback="MAGISTRAL_EPISTEMIC_ENABLED",
            default=True,
        )
        result_default_false = posthog_client.feature_enabled_with_fallback(
            flag_key="magistral",
            distinct_id="user-2",
            env_var_fallback="MAGISTRAL_EPISTEMIC_ENABLED",
            default=False,
        )

    assert result_default_true is True
    assert result_default_false is False


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 5 — Flag inconnu (None) → fallback env var
# ═══════════════════════════════════════════════════════════════════════════════


def test_posthog_unknown_flag_falls_back(_fake_settings, monkeypatch):
    """Si PostHog renvoie None (flag pas configuré côté PostHog), on tombe
    sur le fallback env var."""
    from core import posthog_client

    mock_client = MagicMock()
    mock_client.feature_enabled.return_value = None  # flag inconnu

    monkeypatch.setenv("MODERATION_ENFORCE", "1")

    with patch.object(posthog_client, "_settings", _fake_settings), patch(
        "posthog.Posthog", return_value=mock_client
    ):
        result = posthog_client.feature_enabled_with_fallback(
            flag_key="moderation-enforce",
            distinct_id="user-99",
            env_var_fallback="MODERATION_ENFORCE",
            default=False,
        )

    assert result is True


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 6 — Pas de POSTHOG_API_KEY → fallback direct
# ═══════════════════════════════════════════════════════════════════════════════


def test_no_posthog_key_uses_env_fallback(monkeypatch):
    """Sans clé PostHog configurée, on n'init pas le SDK et on lit
    directement l'env var."""
    from core import posthog_client

    fake = MagicMock()
    fake.POSTHOG_API_KEY = ""  # absente
    fake.POSTHOG_HOST = "https://eu.i.posthog.com"

    monkeypatch.setenv("SEMANTIC_SEARCH_V1_ENABLED", "yes")

    with patch.object(posthog_client, "_settings", fake):
        result = posthog_client.feature_enabled_with_fallback(
            flag_key="semantic-search-v1",
            distinct_id="server",
            env_var_fallback="SEMANTIC_SEARCH_V1_ENABLED",
            default=False,
        )

    assert result is True


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 7 — Truthy values reconnus pour env var
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "raw_value,expected",
    [
        ("1", True),
        ("true", True),
        ("True", True),
        ("TRUE", True),
        ("yes", True),
        ("on", True),
        ("0", False),
        ("false", False),
        ("no", False),
        ("off", False),
        ("anything-else", False),
        ("", False),
    ],
)
def test_env_fallback_truthy_values(monkeypatch, raw_value, expected):
    """Vérifie que `_read_env_fallback` accepte 1/true/yes/on
    (case-insensitive) comme truthy."""
    from core import posthog_client

    fake = MagicMock()
    fake.POSTHOG_API_KEY = ""  # désactivé → fallback systématique
    fake.POSTHOG_HOST = "https://eu.i.posthog.com"

    if raw_value == "":
        monkeypatch.delenv("TEST_FLAG_X", raising=False)
    else:
        monkeypatch.setenv("TEST_FLAG_X", raw_value)

    with patch.object(posthog_client, "_settings", fake):
        result = posthog_client.feature_enabled_with_fallback(
            flag_key="test-flag",
            distinct_id="server",
            env_var_fallback="TEST_FLAG_X",
            default=False,
        )

    assert result is expected


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 8 — Singleton ne se réinitialise pas après échec
# ═══════════════════════════════════════════════════════════════════════════════


def test_singleton_stays_disabled_after_init_failure(_fake_settings):
    """Si l'init du SDK échoue (ex: ImportError simulée), on ne réessaie pas
    indéfiniment — _init_failed est sticky."""
    from core import posthog_client

    # Simule l'absence du SDK : import_module échoue
    with patch.object(posthog_client, "_settings", _fake_settings), patch.dict(
        sys.modules, {"posthog": None}
    ):
        # Premier appel → init échoue, fallback retourne default
        result_1 = posthog_client.feature_enabled_with_fallback(
            flag_key="x",
            distinct_id="a",
            env_var_fallback="UNSET_VAR",
            default=False,
        )
        # Deuxième appel → ne doit PAS retenter le SDK (rapide, silencieux)
        result_2 = posthog_client.feature_enabled_with_fallback(
            flag_key="x",
            distinct_id="b",
            env_var_fallback="UNSET_VAR",
            default=False,
        )

    assert result_1 is False
    assert result_2 is False
