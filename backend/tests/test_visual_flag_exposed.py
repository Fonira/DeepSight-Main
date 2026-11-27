"""Le frontend lit `visual_analysis_available` dans l'utilisateur (/me, login…)
pour masquer « Réanalyser avec le visuel » quand VISUAL_ANALYSIS_ENABLED est off."""

from datetime import UTC, datetime

import pytest

from auth.schemas import UserResponse


def _user() -> UserResponse:
    return UserResponse(
        id=1,
        username="u",
        email="u@test.fr",
        email_verified=True,
        plan="pro",
        credits=3,
        is_admin=False,
        default_lang="fr",
        default_mode="standard",
        default_model="mistral-small-2603",
        total_videos=0,
        total_words=0,
        total_playlists=0,
        created_at=datetime.now(UTC),
    )


@pytest.mark.parametrize(
    ("env_value", "expected"),
    [(None, False), ("false", False), ("true", True), ("1", True), (" ON ", True)],
)
def test_visual_analysis_available_follows_server_flag(monkeypatch, env_value, expected):
    if env_value is None:
        monkeypatch.delenv("VISUAL_ANALYSIS_ENABLED", raising=False)
    else:
        monkeypatch.setenv("VISUAL_ANALYSIS_ENABLED", env_value)

    assert _user().model_dump()["visual_analysis_available"] is expected
