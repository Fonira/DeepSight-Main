"""Tests for ``voice.streaming_prompts`` v2 — Quick Voice Call protocol.

The two prompts (``EXPLORER_STREAMING_PROMPT_FR`` and
``EXPLORER_STREAMING_PROMPT_EN``) brief the voice agent on the new
3-phase ``[CTX UPDATE]`` envelope protocol used by the Quick Voice Call
streaming orchestrator.

These tests pin the prompt's contract:
  * the 3 lifecycle phases are documented (startup, streaming, complete);
  * the four event tags are mentioned by name;
  * the 30-second heartbeat → silent ``web_search`` fallback rule is in;
  * size budget < 5 KB per language;
  * the agent is forbidden from saying "no content" / "empty video";
  * the four tools (search_in_transcript, web_search, deep_research,
    check_fact) are listed.

All tests are synchronous and string-based — no DB / network involved.
"""

from __future__ import annotations

from voice.streaming_prompts import (
    EXPLORER_STREAMING_PROMPT_EN,
    EXPLORER_STREAMING_PROMPT_FR,
)


# ─────────────────────────────────────────────────────────────────────────────
# Lifecycle phases
# ─────────────────────────────────────────────────────────────────────────────


def test_streaming_prompt_fr_three_phases():
    """FR prompt explicitly documents the startup / streaming / complete phases."""
    block = EXPLORER_STREAMING_PROMPT_FR
    assert "PHASE startup" in block
    assert "PHASE streaming" in block
    assert "PHASE complete" in block


def test_streaming_prompt_en_three_phases():
    """EN prompt mirrors the 3-phase lifecycle."""
    block = EXPLORER_STREAMING_PROMPT_EN
    assert "PHASE startup" in block
    assert "PHASE streaming" in block
    assert "PHASE complete" in block


# ─────────────────────────────────────────────────────────────────────────────
# Envelope protocol tags
# ─────────────────────────────────────────────────────────────────────────────


def test_streaming_prompt_mentions_ctx_update_protocol():
    """Both prompts must describe the four envelope tags by name."""
    for name, block in (
        ("FR", EXPLORER_STREAMING_PROMPT_FR),
        ("EN", EXPLORER_STREAMING_PROMPT_EN),
    ):
        assert "[CTX UPDATE]" in block, f"{name} prompt missing [CTX UPDATE]"
        assert "[PHASE TRANSITION]" in block, f"{name} prompt missing [PHASE TRANSITION]"
        assert "[CTX HEARTBEAT]" in block, f"{name} prompt missing [CTX HEARTBEAT]"
        assert "[CTX COMPLETE]" in block, f"{name} prompt missing [CTX COMPLETE]"


# ─────────────────────────────────────────────────────────────────────────────
# Stalled-stream fallback
# ─────────────────────────────────────────────────────────────────────────────


def test_streaming_prompt_mentions_30s_fallback():
    """If last_event_age_seconds > 30 → silent web_search fallback."""
    for name, block in (
        ("FR", EXPLORER_STREAMING_PROMPT_FR),
        ("EN", EXPLORER_STREAMING_PROMPT_EN),
    ):
        assert "30" in block, f"{name} prompt missing the 30-second threshold"
        assert "web_search" in block, f"{name} prompt missing web_search fallback"


# ─────────────────────────────────────────────────────────────────────────────
# Size budget
# ─────────────────────────────────────────────────────────────────────────────


def test_streaming_prompt_size_under_5kb():
    """Each prompt stays under 5 KB to fit the 12 KB system_prompt budget."""
    assert len(EXPLORER_STREAMING_PROMPT_FR) < 5000, (
        f"FR streaming prompt is {len(EXPLORER_STREAMING_PROMPT_FR)} chars — too large"
    )
    assert len(EXPLORER_STREAMING_PROMPT_EN) < 5000, (
        f"EN streaming prompt is {len(EXPLORER_STREAMING_PROMPT_EN)} chars — too large"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Forbidden phrases
# ─────────────────────────────────────────────────────────────────────────────


def test_streaming_prompt_forbids_no_content_phrase():
    """FR prompt forbids 'no content' / 'empty video' messages in startup."""
    block = EXPLORER_STREAMING_PROMPT_FR
    assert "JAMAIS" in block
    # The forbidden phrases that must appear inside an interdiction context.
    assert "pas de contenu" in block
    assert "vidéo vide" in block


# ─────────────────────────────────────────────────────────────────────────────
# Tool roster
# ─────────────────────────────────────────────────────────────────────────────


def test_streaming_prompt_lists_all_4_tools():
    """All 4 tools must be discoverable in both prompts."""
    expected = ["search_in_transcript", "web_search", "deep_research", "check_fact"]
    for name, block in (
        ("FR", EXPLORER_STREAMING_PROMPT_FR),
        ("EN", EXPLORER_STREAMING_PROMPT_EN),
    ):
        for tool in expected:
            assert tool in block, f"{name} prompt is missing tool {tool!r}"
