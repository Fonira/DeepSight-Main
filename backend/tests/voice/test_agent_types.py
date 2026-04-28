"""Tests for the agent_types registry (Quick Voice Call Task 2 contract).

These two tests are the canonical contract for the explorer_streaming agent
type as defined in the PR1 backend plan (Task 2). They are intentionally
minimal and test through the public API (get_agent_config, list_agent_types).

For more detailed assertions on the prompt content and registry mechanics,
see test_explorer_streaming_agent.py.
"""


def test_explorer_streaming_agent_exists():
    from voice.agent_types import get_agent_config

    config = get_agent_config("explorer_streaming")
    assert config.agent_type == "explorer_streaming"
    assert config.requires_summary is False
    assert "web_search" in config.tools
    assert "[CTX UPDATE" in config.system_prompt_fr
    assert "[CTX UPDATE" in config.system_prompt_en
    assert "absorb" in config.system_prompt_en.lower() or "absorbe" in config.system_prompt_fr.lower()


def test_explorer_streaming_listed():
    from voice.agent_types import list_agent_types

    types = list_agent_types()
    assert "explorer_streaming" in [t["type"] for t in types]
