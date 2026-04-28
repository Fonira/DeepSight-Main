"""Tests for the agent_types registry (Quick Voice Call Task 2 contract).

These two tests are the canonical contract for the explorer_streaming agent
type as defined in the PR1 backend plan (Task 2). They are intentionally
minimal and test through the public API (get_agent_config, list_agent_types).

For more detailed assertions on the prompt content and registry mechanics,
see test_explorer_streaming_agent.py.
"""

from voice.agent_types import get_agent_config, list_agent_types


def test_explorer_streaming_agent_exists():
    config = get_agent_config("explorer_streaming")
    assert config.agent_type == "explorer_streaming"
    assert config.requires_summary is False
    assert "web_search" in config.tools
    # [CTX COMPLETE] is asserted in the detailed sibling file (test_explorer_streaming_agent.py)
    assert "[CTX UPDATE" in config.system_prompt_fr
    assert "[CTX UPDATE" in config.system_prompt_en
    assert "absorb" in config.system_prompt_en.lower() or "absorbe" in config.system_prompt_fr.lower()


def test_explorer_streaming_listed():
    types = list_agent_types()
    assert "explorer_streaming" in [t["type"] for t in types]
    # Catch API-surface regressions: requires_summary must be exposed correctly
    # for the streaming agent (mobile clients read this flag).
    entry = next(t for t in types if t["type"] == "explorer_streaming")
    assert entry["requires_summary"] is False
