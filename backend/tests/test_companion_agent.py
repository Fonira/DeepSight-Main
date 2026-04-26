"""
Tests for the COMPANION agent (Spec #1, sub-task b).
"""

import os
import pytest


def test_companion_registered_and_has_no_summary_requirement():
    """COMPANION must live in the registry and not require a summary_id."""
    from voice.agent_types import AGENT_REGISTRY, COMPANION

    assert "companion" in AGENT_REGISTRY
    assert AGENT_REGISTRY["companion"] is COMPANION
    assert COMPANION.agent_type == "companion"
    assert COMPANION.requires_summary is False
    assert COMPANION.requires_debate is False


def test_companion_has_web_tools_only():
    """Companion has no transcript / no analysis section — only web tools."""
    from voice.agent_types import COMPANION

    assert "web_search" in COMPANION.tools
    assert "deep_research" in COMPANION.tools
    assert "check_fact" in COMPANION.tools
    # No video tools (would be useless without a summary).
    for forbidden in ("search_in_transcript", "get_analysis_section",
                       "get_sources", "get_flashcards"):
        assert forbidden not in COMPANION.tools


def test_companion_prompts_mention_web_search_grounding():
    """Both FR and EN prompts must instruct to use web_search."""
    from voice.agent_types import COMPANION

    assert "web_search" in COMPANION.system_prompt_fr
    assert "web_search" in COMPANION.system_prompt_en
    # Spec requirement: emphasize grounding via web_search.
    assert "web_search" in COMPANION.system_prompt_fr.lower()
    assert "ground" in COMPANION.system_prompt_en.lower() \
        or "search" in COMPANION.system_prompt_en.lower()


def test_companion_voice_id_env_override(monkeypatch):
    """ELEVENLABS_COMPANION_VOICE_ID overrides via resolve_agent_voice_id."""
    from voice.agent_types import COMPANION, resolve_agent_voice_id

    monkeypatch.delenv("ELEVENLABS_COMPANION_VOICE_ID", raising=False)
    assert resolve_agent_voice_id(COMPANION) is None  # Falls back to prefs.

    monkeypatch.setenv("ELEVENLABS_COMPANION_VOICE_ID", "voice_xyz_123")
    assert resolve_agent_voice_id(COMPANION) == "voice_xyz_123"


def test_companion_listed_by_list_agent_types():
    """Companion must show up in the public list for the API."""
    from voice.agent_types import list_agent_types

    types = list_agent_types()
    by_type = {t["type"]: t for t in types}
    assert "companion" in by_type
    assert by_type["companion"]["requires_summary"] is False


def test_get_agent_config_returns_companion():
    """Lookup by 'companion' returns the COMPANION config (no fallback)."""
    from voice.agent_types import get_agent_config, COMPANION

    cfg = get_agent_config("companion")
    assert cfg is COMPANION
