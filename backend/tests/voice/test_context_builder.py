"""Unit tests for voice.context_builder.

Tests the unified block format: header, digest section, verbatim section,
labels [VOCAL/TEXTE • Δt • speaker], language switch (fr/en), caps, exclusions.
"""
from datetime import datetime, timedelta, timezone

import pytest

from voice.context_builder import (
    _humanize_relative_time,
    _format_message_label,
    _render_block,
    VOICE_SYSTEM_PROMPT_CAP_BYTES,
    CHAT_HISTORY_CAP_BYTES,
    PER_MESSAGE_MAX_CHARS,
)


# ── _humanize_relative_time ──────────────────────────────────────────────────


def test_humanize_just_now():
    now = datetime.now(timezone.utc)
    assert _humanize_relative_time(now - timedelta(seconds=10), lang="fr") == "à l'instant"
    assert _humanize_relative_time(now - timedelta(seconds=10), lang="en") == "just now"


def test_humanize_minutes_hours_days():
    now = datetime.now(timezone.utc)
    assert _humanize_relative_time(now - timedelta(minutes=5), lang="fr") == "il y a 5 min"
    assert _humanize_relative_time(now - timedelta(hours=2), lang="fr") == "il y a 2h"
    assert _humanize_relative_time(now - timedelta(days=3), lang="fr") == "il y a 3j"
    assert _humanize_relative_time(now - timedelta(days=3), lang="en") == "3d ago"


# ── _format_message_label ────────────────────────────────────────────────────


def test_format_voice_user_message_fr():
    now = datetime.now(timezone.utc)
    label = _format_message_label(
        source="voice",
        role="user",
        created_at=now - timedelta(days=2),
        lang="fr",
    )
    assert label == "[VOCAL • il y a 2j • user]"


def test_format_text_assistant_message_fr():
    now = datetime.now(timezone.utc)
    label = _format_message_label(
        source="text",
        role="assistant",
        created_at=now - timedelta(hours=1),
        lang="fr",
    )
    assert label == "[TEXTE • il y a 1h • toi]"


def test_format_text_assistant_message_en():
    now = datetime.now(timezone.utc)
    label = _format_message_label(
        source="text",
        role="assistant",
        created_at=now - timedelta(hours=1),
        lang="en",
    )
    assert label == "[TEXT • 1h ago • you]"


# ── _render_block (empty cases) ──────────────────────────────────────────────


def test_render_block_empty_returns_empty_string():
    assert _render_block(
        lang="fr",
        voice_digests=[],
        chat_digests=[],
        recent=[],
        exclude_voice_session_id=None,
    ) == ""


# ── _render_block (digests + verbatim) ───────────────────────────────────────


def _make_voice_digest(session_id: str, days_ago: int, duration: int, digest_text: str):
    """Helper: returns a tuple matching the SELECT shape."""
    now = datetime.now(timezone.utc)
    return (session_id, now - timedelta(days=days_ago), duration, digest_text)


def _make_chat_message(role: str, source: str, content: str, hours_ago: int, voice_session_id=None):
    """Helper: returns a dict-like object matching ChatMessage."""
    now = datetime.now(timezone.utc)

    class _Msg:
        pass

    m = _Msg()
    m.role = role
    m.source = source
    m.content = content
    m.created_at = now - timedelta(hours=hours_ago)
    m.voice_session_id = voice_session_id
    return m


def test_render_block_with_digests_and_verbatim_fr():
    voice_digests = [
        _make_voice_digest(
            "sess-1", days_ago=2, duration=480,
            digest_text="- user a demandé X\n- tu as répondu via web_search",
        ),
    ]
    recent = [
        _make_chat_message("user", "voice", "Pourquoi il dit que les Russes vont sur Mars ?", 48, voice_session_id="sess-1"),
        _make_chat_message("assistant", "voice", "Selon ce que j'écoute, JPP affirme que…", 48, voice_session_id="sess-1"),
        _make_chat_message("user", "text", "Résume-moi en 1 phrase", 1),
        _make_chat_message("assistant", "text", "JPP est disruptif car…", 1),
    ]

    out = _render_block(
        lang="fr",
        voice_digests=voice_digests,
        chat_digests=[],
        recent=recent,
        exclude_voice_session_id=None,
    )

    assert "## Contexte conversation précédente" in out
    assert "### Résumé sessions antérieures" in out
    assert "(voice 8 min)" in out  # 480s = 8 min
    assert "user a demandé X" in out
    assert "### Derniers échanges" in out
    assert "[VOCAL • il y a 2j • user] Pourquoi il dit que les Russes vont sur Mars ?" in out
    assert "[TEXTE • il y a 1h • toi]  JPP est disruptif car…" in out or \
           "[TEXTE • il y a 1h • toi] JPP est disruptif car…" in out
    assert "Continue dans la lignée de cette conversation." in out


def test_render_block_excludes_active_voice_session():
    """Rows of the active (just-created) voice session must not be re-injected."""
    recent = [
        _make_chat_message("user", "voice", "msg from active session", 0, voice_session_id="sess-active"),
        _make_chat_message("user", "voice", "msg from old session", 48, voice_session_id="sess-old"),
        _make_chat_message("user", "text", "msg text", 1),
    ]
    out = _render_block(
        lang="fr",
        voice_digests=[],
        chat_digests=[],
        recent=recent,
        exclude_voice_session_id="sess-active",
    )
    assert "msg from active session" not in out
    assert "msg from old session" in out
    assert "msg text" in out
