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


# ── Cap enforcement ──────────────────────────────────────────────────────────


def test_truncate_to_cap_keeps_recent_drops_old_digests():
    """When over cap, drop oldest digests first, keep recent verbatim."""
    from voice.context_builder import _truncate_to_cap

    big_digests_section = "### Résumé sessions antérieures\n" + "- old digest line\n" * 1000
    recent_section = "### Derniers échanges (2)\n[VOCAL] hi\n[TEXTE] hello"
    block = f"## Contexte conversation précédente\n\n{big_digests_section}\n{recent_section}\n\nContinue."

    out = _truncate_to_cap(block, cap=2_000, lang="fr")

    assert len(out.encode("utf-8")) <= 2_000
    assert "[VOCAL] hi" in out  # recent preserved
    assert "[TEXTE] hello" in out
    assert "[contexte tronqué]" in out  # truncation marker


def test_truncate_to_cap_no_orphan_top_level_bullets():
    """Multi-bullet digest_text must not leave orphan '- ...' lines at top level after truncation."""
    from voice.context_builder import _truncate_to_cap, _render_block
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    voice_digests = [
        (f"sess-{i}", now - timedelta(days=10 - i), 300,
         "- user a demandé X\n- tu as répondu Y\n- conclusion Z")
        for i in range(20)
    ]
    block = _render_block(
        lang="fr",
        voice_digests=voice_digests,
        chat_digests=[],
        recent=[],
        exclude_voice_session_id=None,
    )
    # Force truncation with a tight cap
    out = _truncate_to_cap(block, cap=500, lang="fr")
    # All remaining "- " lines must be parent date-bullets like "- 2026-XX-XX (voice N min) :"
    # NOT orphan "- user a demandé X" lines
    for line in out.split("\n"):
        if line.startswith("- "):
            assert "(voice" in line or "(chat" in line, \
                f"Orphan top-level bullet found: {line!r}"


# ── build_unified_context_block (DB integration) ─────────────────────────────


@pytest.mark.asyncio
async def test_build_unified_block_db_integration_voice_target(async_db_session, sample_user, sample_summary):
    """End-to-end with DB: voice_session digest + recent chat_messages."""
    from datetime import datetime, timedelta, timezone

    from db.database import ChatMessage, VoiceSession
    from voice.context_builder import build_unified_context_block

    now = datetime.now(timezone.utc)

    # Voice session terminée il y a 2 jours, avec digest
    vs = VoiceSession(
        id="sess-old",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        started_at=now - timedelta(days=2),
        duration_seconds=480,
        digest_text="- user demanded X\n- you answered via web_search",
        digest_generated_at=now - timedelta(days=2),
    )
    async_db_session.add(vs)

    # Recent verbatim text msg
    cm = ChatMessage(
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        role="user",
        content="Résume-moi en 1 phrase",
        source="text",
        created_at=now - timedelta(hours=1),
    )
    async_db_session.add(cm)
    await async_db_session.commit()

    out = await build_unified_context_block(
        async_db_session,
        summary_id=sample_summary.id,
        user_id=sample_user.id,
        lang="fr",
        target="voice",
    )

    assert "(voice 8 min)" in out
    assert "user demanded X" in out
    assert "[TEXTE • il y a 1h • user] Résume-moi en 1 phrase" in out


@pytest.mark.asyncio
async def test_build_unified_block_voice_cap_enforced(async_db_session, sample_user, sample_summary):
    """When the rendered block exceeds 12 KB, truncate to 12 KB."""
    from datetime import datetime, timedelta, timezone
    from db.database import VoiceSession
    from voice.context_builder import build_unified_context_block, VOICE_SYSTEM_PROMPT_CAP_BYTES

    now = datetime.now(timezone.utc)
    big_text = "X" * 5000
    for i in range(5):
        vs = VoiceSession(
            id=f"sess-{i}",
            user_id=sample_user.id,
            summary_id=sample_summary.id,
            started_at=now - timedelta(days=10 - i),
            duration_seconds=300,
            digest_text=big_text,
            digest_generated_at=now - timedelta(days=10 - i),
        )
        async_db_session.add(vs)
    await async_db_session.commit()

    out = await build_unified_context_block(
        async_db_session,
        summary_id=sample_summary.id,
        user_id=sample_user.id,
        lang="fr",
        target="voice",
    )

    assert len(out.encode("utf-8")) <= VOICE_SYSTEM_PROMPT_CAP_BYTES
    assert "[contexte tronqué]" in out


@pytest.mark.asyncio
async def test_build_unified_block_chat_target_uses_30kb_cap(async_db_session, sample_user, sample_summary):
    """target='chat' uses CHAT_HISTORY_CAP_BYTES, allows larger blocks than 'voice'."""
    from datetime import datetime, timedelta, timezone
    from db.database import ChatMessage
    from voice.context_builder import build_unified_context_block, CHAT_HISTORY_CAP_BYTES

    now = datetime.now(timezone.utc)
    # 35 messages is over the 30 verbatim limit but well under 30 KB
    for i in range(35):
        async_db_session.add(ChatMessage(
            user_id=sample_user.id, summary_id=sample_summary.id,
            role="user" if i % 2 == 0 else "assistant",
            content=f"message number {i} with some content",
            source="text",
            created_at=now - timedelta(hours=35 - i),
        ))
    await async_db_session.commit()

    out = await build_unified_context_block(
        async_db_session,
        summary_id=sample_summary.id,
        user_id=sample_user.id,
        lang="fr",
        target="chat",
    )
    assert len(out.encode("utf-8")) <= CHAT_HISTORY_CAP_BYTES
    assert "### Derniers échanges (30)" in out  # capped at RECENT_VERBATIM_LIMIT=30
