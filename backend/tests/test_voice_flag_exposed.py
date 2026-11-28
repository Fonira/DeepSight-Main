"""L'extension lit `voice_available` dans l'utilisateur (/me, login, refresh)
pour n'afficher ses boutons d'appel que si ElevenLabs est branché sur l'API."""

from datetime import UTC, datetime

import pytest

import core.config as core_config
from auth.schemas import UserResponse

ADMIN_EMAIL = "fondateur@deepsight.test"


def _user(*, is_admin: bool, email: str = "u@test.fr") -> UserResponse:
    return UserResponse(
        id=1,
        username="u",
        email=email,
        email_verified=True,
        plan="pro",
        credits=3,
        is_admin=is_admin,
        default_lang="fr",
        default_mode="standard",
        default_model="mistral-small-2603",
        total_videos=0,
        total_words=0,
        total_playlists=0,
        created_at=datetime.now(UTC),
    )


@pytest.fixture(autouse=True)
def _admin_email(monkeypatch):
    monkeypatch.setitem(core_config.ADMIN_CONFIG, "ADMIN_EMAIL", ADMIN_EMAIL)


@pytest.mark.parametrize(
    ("api_key", "kill_switch", "is_admin", "expected"),
    [
        ("", False, False, False),  # pas de clé : /voice/session répondrait 503
        ("", False, True, False),  # même pour l'admin
        ("xi-test-key", False, False, True),
        ("xi-test-key", True, False, False),  # kill switch : coupé pour les utilisateurs…
        ("xi-test-key", True, True, True),  # … mais l'admin peut toujours appeler
    ],
)
def test_voice_available_follows_key_and_kill_switch(monkeypatch, api_key, kill_switch, is_admin, expected):
    monkeypatch.setattr(core_config._settings, "ELEVENLABS_API_KEY", api_key)
    monkeypatch.setattr(core_config, "VOICE_CALL_DISABLED", kill_switch)

    assert _user(is_admin=is_admin).model_dump()["voice_available"] is expected


@pytest.mark.parametrize(
    ("email", "expected"),
    [
        ("Fondateur@DeepSight.test", True),  # admin par ADMIN_EMAIL, comme /voice/session
        ("autre@deepsight.test", False),
    ],
)
def test_kill_switch_spares_the_admin_email_like_the_session_endpoint(monkeypatch, email, expected):
    monkeypatch.setattr(core_config._settings, "ELEVENLABS_API_KEY", "xi-test-key")
    monkeypatch.setattr(core_config, "VOICE_CALL_DISABLED", True)

    assert _user(is_admin=False, email=email).model_dump()["voice_available"] is expected
