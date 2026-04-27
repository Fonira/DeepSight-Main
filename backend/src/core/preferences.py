"""Helpers for reading user-level preferences stored in User.preferences JSON column.

Used as feature gates throughout the backend (e.g. ambient lighting renderer
choice, future feature flags). Centralizes the parsing logic and default
values so they can't drift between callsites.
"""
from typing import Any, Optional

from db.database import User

AMBIENT_LIGHTING_DEFAULT = True  # opt-out par défaut


def get_ambient_lighting_enabled(user: Optional[User]) -> bool:
    """Returns whether ambient lighting is enabled for the given user.

    Defaults to AMBIENT_LIGHTING_DEFAULT (True) when:
    - user is None (anonymous / guest)
    - user.preferences is None or {}
    - the key is absent from the dict

    Returns False only if the key is explicitly set to a falsy value.

    Note: bool() coerces values, so non-empty strings ("false", "0") evaluate
    to True. UI/API callers must pass a real bool — see schemas validation.
    """
    if user is None or user.preferences is None:
        return AMBIENT_LIGHTING_DEFAULT
    prefs: dict[str, Any] = user.preferences or {}
    return bool(prefs.get("ambient_lighting_enabled", AMBIENT_LIGHTING_DEFAULT))
