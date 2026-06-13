"""Tests du mode privé (verrouillage admin-only) — 2026-06-10.

Couvre :
- core.config.is_private_mode() : résolution env > défaut prod-only.
- auth.dependencies.is_admin_user() : détection admin (flag DB ou email).
- auth.dependencies.enforce_private_mode() : 403 pour non-admin, no-op sinon.

Aucune dépendance DB : on monkeypatch les globals et on utilise des doubles.
"""

import pytest
from fastapi import HTTPException

import core.config as config
from auth import dependencies as deps


class _FakeSettings:
    def __init__(self, is_production: bool):
        self.is_production = is_production


class _FakeUser:
    def __init__(self, is_admin: bool = False, email: str = ""):
        self.is_admin = is_admin
        self.email = email


@pytest.fixture(autouse=True)
def _clean_private_mode_env(monkeypatch):
    # Garantit un état déterministe quel que soit l'environnement d'exécution.
    monkeypatch.delenv("PRIVATE_MODE", raising=False)
    monkeypatch.delenv("PRIVATE_MODE_ALLOWED_EMAILS", raising=False)


# --------------------------------------------------------------------------- #
# is_private_mode — résolution de l'état
# --------------------------------------------------------------------------- #
def test_env_override_true_wins_over_dev(monkeypatch):
    monkeypatch.setenv("PRIVATE_MODE", "true")
    monkeypatch.setattr(config, "_settings", _FakeSettings(is_production=False))
    assert config.is_private_mode() is True


def test_env_override_false_wins_over_prod(monkeypatch):
    monkeypatch.setenv("PRIVATE_MODE", "false")
    monkeypatch.setattr(config, "_settings", _FakeSettings(is_production=True))
    assert config.is_private_mode() is False


def test_lockdown_active_in_production_by_default(monkeypatch):
    monkeypatch.setattr(config, "PRIVATE_MODE_LOCKDOWN", True)
    monkeypatch.setattr(config, "_settings", _FakeSettings(is_production=True))
    assert config.is_private_mode() is True


def test_open_in_dev_even_with_lockdown(monkeypatch):
    # Protège la suite de tests : jamais verrouillé hors production.
    monkeypatch.setattr(config, "PRIVATE_MODE_LOCKDOWN", True)
    monkeypatch.setattr(config, "_settings", _FakeSettings(is_production=False))
    assert config.is_private_mode() is False


# --------------------------------------------------------------------------- #
# is_admin_user
# --------------------------------------------------------------------------- #
def test_is_admin_user_detection(monkeypatch):
    monkeypatch.setitem(config.ADMIN_CONFIG, "ADMIN_EMAIL", "boss@deepsight.com")
    assert deps.is_admin_user(_FakeUser(is_admin=True)) is True
    assert deps.is_admin_user(_FakeUser(email="BOSS@deepsight.com")) is True  # case-insensitive
    assert deps.is_admin_user(_FakeUser(email="rando@example.com")) is False
    assert deps.is_admin_user(None) is False


# --------------------------------------------------------------------------- #
# enforce_private_mode
# --------------------------------------------------------------------------- #
def test_enforce_blocks_non_admin_when_active(monkeypatch):
    monkeypatch.setattr(config, "is_private_mode", lambda: True)
    monkeypatch.setitem(config.ADMIN_CONFIG, "ADMIN_EMAIL", "boss@deepsight.com")

    with pytest.raises(HTTPException) as exc:
        deps.enforce_private_mode(_FakeUser(email="rando@example.com"))
    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "private_mode"

    with pytest.raises(HTTPException):
        deps.enforce_private_mode(None)


def test_enforce_allows_admin_when_active(monkeypatch):
    monkeypatch.setattr(config, "is_private_mode", lambda: True)
    monkeypatch.setitem(config.ADMIN_CONFIG, "ADMIN_EMAIL", "boss@deepsight.com")
    # Ne lève pas pour l'admin (par email ou par flag).
    deps.enforce_private_mode(_FakeUser(email="boss@deepsight.com"))
    deps.enforce_private_mode(_FakeUser(is_admin=True))


def test_enforce_noop_when_inactive(monkeypatch):
    monkeypatch.setattr(config, "is_private_mode", lambda: False)
    # Aucun blocage même pour un non-admin quand le mode est désactivé.
    deps.enforce_private_mode(_FakeUser(email="rando@example.com"))
    deps.enforce_private_mode(None)


# --------------------------------------------------------------------------- #
# Allowlist de sécurité (filet anti-lockout fondateur)
# --------------------------------------------------------------------------- #
def test_founder_email_always_in_allowlist():
    # Le fondateur est toujours autorisé, indépendamment d'ADMIN_EMAIL/env.
    # Accès réservé au seul compte pro (décision 2026-06-13, gmail retiré).
    assert "maxime@deepsightsynthesis.com" in config.private_mode_allowed_emails()


def test_allowlist_extendable_via_env(monkeypatch):
    monkeypatch.setenv("PRIVATE_MODE_ALLOWED_EMAILS", "tester@x.com, Other@X.com")
    allowed = config.private_mode_allowed_emails()
    assert "tester@x.com" in allowed
    assert "other@x.com" in allowed  # normalisé en minuscules


def test_founder_passes_private_mode_even_if_not_admin(monkeypatch):
    monkeypatch.setattr(config, "is_private_mode", lambda: True)
    monkeypatch.setitem(config.ADMIN_CONFIG, "ADMIN_EMAIL", "someone-else@deepsight.com")
    founder = _FakeUser(is_admin=False, email="maxime@deepsightsynthesis.com")
    assert deps.is_private_mode_allowed(founder) is True
    # Ne lève pas.
    deps.enforce_private_mode(founder)
