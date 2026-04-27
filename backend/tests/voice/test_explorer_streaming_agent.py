"""Tests for the EXPLORER_STREAMING agent (Quick Voice Call Task 3).

Verifies:
  * Registration in AGENT_REGISTRY under "explorer_streaming"
  * Agent does NOT require a summary (context streams during the call)
  * web_search is in the tool list (allows web grounding while waiting for
    the analysis to arrive)
  * Both FR + EN prompts mention [CTX UPDATE / [CTX COMPLETE markers
  * Both FR + EN prompts include the transparency phrase scaffolding
"""

from voice.agent_types import AGENT_REGISTRY, EXPLORER_STREAMING


def test_explorer_streaming_registered():
    assert "explorer_streaming" in AGENT_REGISTRY
    assert AGENT_REGISTRY["explorer_streaming"] is EXPLORER_STREAMING


def test_explorer_streaming_does_not_require_summary():
    assert EXPLORER_STREAMING.requires_summary is False


def test_explorer_streaming_has_web_tools():
    assert "web_search" in EXPLORER_STREAMING.tools
    # Spec lists 3 tools — make sure the others are there too
    assert "deep_research" in EXPLORER_STREAMING.tools
    assert "check_fact" in EXPLORER_STREAMING.tools


def test_explorer_streaming_prompt_mentions_ctx_update_fr():
    assert "[CTX UPDATE" in EXPLORER_STREAMING.system_prompt_fr
    assert "[CTX COMPLETE]" in EXPLORER_STREAMING.system_prompt_fr


def test_explorer_streaming_prompt_mentions_ctx_update_en():
    assert "[CTX UPDATE" in EXPLORER_STREAMING.system_prompt_en
    assert "[CTX COMPLETE]" in EXPLORER_STREAMING.system_prompt_en


def test_explorer_streaming_prompt_instructs_transparency_fr():
    assert "d'après ce que j'écoute" in EXPLORER_STREAMING.system_prompt_fr


def test_explorer_streaming_prompt_instructs_transparency_en():
    assert "what i'm hearing" in EXPLORER_STREAMING.system_prompt_en.lower()


def test_explorer_streaming_agent_type_field():
    """The agent_type attribute matches the registry key."""
    assert EXPLORER_STREAMING.agent_type == "explorer_streaming"
