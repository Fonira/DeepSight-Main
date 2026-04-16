"""
Tests for core/mistral_agent.py — Mistral Agent web search wrapper.

Tests cover:
- Agent creation (ensure_agent)
- Response parsing (_parse_conversation_response)
- Web search (agent_web_search) with mock HTTP
- Circuit breaker behavior
- Fallback integration in web_search_provider
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import asdict

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture(autouse=True)
def reset_agent_state():
    """Reset agent singleton and circuit breaker between tests."""
    import core.mistral_agent as mod
    mod._agent_id = None
    mod._agent_failures = 0
    mod._agent_last_failure = 0.0
    yield
    mod._agent_id = None
    mod._agent_failures = 0
    mod._agent_last_failure = 0.0


@pytest.fixture
def mock_mistral_key():
    with patch("core.mistral_agent.get_mistral_key", return_value="test-key-123"):
        yield


@pytest.fixture
def mock_agent_created():
    """Pre-set agent ID so ensure_agent is skipped."""
    import core.mistral_agent as mod
    mod._agent_id = "agent-test-id-456"
    yield "agent-test-id-456"


# =============================================================================
# RESPONSE PARSING
# =============================================================================

class TestParseConversationResponse:
    """Test _parse_conversation_response with various response shapes."""

    def test_simple_text_response(self):
        from core.mistral_agent import _parse_conversation_response

        data = {
            "outputs": [
                {
                    "type": "message.output",
                    "content": "Voici la synthèse des résultats.",
                }
            ],
            "usage": {"total_tokens": 150},
        }

        result = _parse_conversation_response(data)
        assert result.success is True
        assert "synthèse" in result.content
        assert result.tokens_used == 150
        assert result.sources == []

    def test_mixed_text_and_references(self):
        from core.mistral_agent import _parse_conversation_response

        data = {
            "outputs": [
                {
                    "type": "message.output",
                    "content": [
                        {"type": "text", "text": "L'IA progresse rapidement. "},
                        {
                            "type": "tool_reference",
                            "tool": "web_search",
                            "title": "AI Progress 2026",
                            "url": "https://example.com/ai",
                            "source": "brave",
                        },
                        {"type": "text", "text": "Selon les experts..."},
                        {
                            "type": "tool_reference",
                            "tool": "web_search",
                            "title": "Expert Opinion",
                            "url": "https://example.com/expert",
                            "source": "brave",
                        },
                    ],
                }
            ],
            "usage": {"total_tokens": 300},
        }

        result = _parse_conversation_response(data)
        assert result.success is True
        assert "progresse rapidement" in result.content
        assert "experts" in result.content
        assert len(result.sources) == 2
        assert result.sources[0]["url"] == "https://example.com/ai"
        assert result.sources[1]["title"] == "Expert Opinion"
        assert result.tokens_used == 300

    def test_dedup_sources(self):
        from core.mistral_agent import _parse_conversation_response

        data = {
            "outputs": [
                {
                    "type": "message.output",
                    "content": [
                        {"type": "text", "text": "Info."},
                        {"type": "tool_reference", "url": "https://dup.com", "title": "A"},
                        {"type": "tool_reference", "url": "https://dup.com", "title": "B"},
                    ],
                }
            ],
            "usage": {},
        }

        result = _parse_conversation_response(data)
        assert len(result.sources) == 1  # Deduped by URL

    def test_empty_response(self):
        from core.mistral_agent import _parse_conversation_response

        data = {"outputs": [], "usage": {}}
        result = _parse_conversation_response(data)
        assert result.success is False
        assert result.content == ""

    def test_tool_execution_entry_ignored(self):
        from core.mistral_agent import _parse_conversation_response

        data = {
            "outputs": [
                {"type": "tool.execution", "tool": "web_search"},
                {"type": "message.output", "content": "Résultat final."},
            ],
            "usage": {"total_tokens": 50},
        }

        result = _parse_conversation_response(data)
        assert result.success is True
        assert result.content == "Résultat final."


# =============================================================================
# AGENT CREATION
# =============================================================================

class TestEnsureAgent:

    @pytest.mark.asyncio
    async def test_creates_agent_on_first_call(self, mock_mistral_key):
        from core.mistral_agent import ensure_agent
        import core.mistral_agent as mod

        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"id": "agent-new-789"}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            agent_id = await ensure_agent()

        assert agent_id == "agent-new-789"
        assert mod._agent_id == "agent-new-789"

    @pytest.mark.asyncio
    async def test_returns_cached_agent(self, mock_mistral_key, mock_agent_created):
        from core.mistral_agent import ensure_agent

        # Should NOT call the API
        agent_id = await ensure_agent()
        assert agent_id == "agent-test-id-456"

    @pytest.mark.asyncio
    async def test_returns_none_on_api_error(self, mock_mistral_key):
        from core.mistral_agent import ensure_agent

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            agent_id = await ensure_agent()

        assert agent_id is None

    @pytest.mark.asyncio
    async def test_returns_none_without_api_key(self):
        from core.mistral_agent import ensure_agent

        with patch("core.mistral_agent.get_mistral_key", return_value=""):
            agent_id = await ensure_agent()
        assert agent_id is None


# =============================================================================
# CIRCUIT BREAKER
# =============================================================================

class TestCircuitBreaker:

    def test_circuit_closed_initially(self):
        from core.mistral_agent import _is_agent_circuit_open
        assert _is_agent_circuit_open() is False

    def test_circuit_opens_after_max_failures(self):
        from core.mistral_agent import (
            _is_agent_circuit_open, _record_agent_failure, _AGENT_MAX_FAILURES,
        )
        for _ in range(_AGENT_MAX_FAILURES):
            _record_agent_failure()
        assert _is_agent_circuit_open() is True

    def test_circuit_resets_on_success(self):
        from core.mistral_agent import (
            _is_agent_circuit_open, _record_agent_failure,
            _record_agent_success, _AGENT_MAX_FAILURES,
        )
        for _ in range(_AGENT_MAX_FAILURES):
            _record_agent_failure()
        assert _is_agent_circuit_open() is True

        _record_agent_success()
        assert _is_agent_circuit_open() is False


# =============================================================================
# AGENT WEB SEARCH
# =============================================================================

class TestAgentWebSearch:

    @pytest.mark.asyncio
    async def test_successful_search(self, mock_mistral_key, mock_agent_created):
        from core.mistral_agent import agent_web_search

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "outputs": [
                {
                    "type": "message.output",
                    "content": [
                        {"type": "text", "text": "L'IA a un impact majeur sur l'éducation."},
                        {
                            "type": "tool_reference",
                            "title": "UNESCO Report",
                            "url": "https://unesco.org/ai-education",
                        },
                    ],
                }
            ],
            "usage": {"total_tokens": 200},
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await agent_web_search(
                query="Impact IA éducation",
                context="Vidéo sur l'IA en classe",
                purpose="enrichment",
            )

        assert result is not None
        assert result.success is True
        assert "éducation" in result.content
        assert len(result.sources) == 1
        assert result.sources[0]["url"] == "https://unesco.org/ai-education"

    @pytest.mark.asyncio
    async def test_returns_none_on_429(self, mock_mistral_key, mock_agent_created):
        from core.mistral_agent import agent_web_search

        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Rate limited"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await agent_web_search(
                query="test", context="test", purpose="chat",
            )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_circuit_open(self, mock_mistral_key, mock_agent_created):
        from core.mistral_agent import agent_web_search, _record_agent_failure, _AGENT_MAX_FAILURES

        # Open the circuit breaker
        for _ in range(_AGENT_MAX_FAILURES):
            _record_agent_failure()

        result = await agent_web_search(
            query="test", context="test", purpose="chat",
        )
        assert result is None


# =============================================================================
# WEB SEARCH PROVIDER INTEGRATION
# =============================================================================

class TestWebSearchProviderIntegration:
    """Test that web_search_provider correctly uses Agent primary → Brave fallback."""

    @pytest.mark.asyncio
    async def test_uses_agent_when_available(self):
        """When agent succeeds, provider returns agent result."""
        from videos.web_search_provider import _try_agent_search
        from core.mistral_agent import AgentSearchResult

        mock_result = AgentSearchResult(
            success=True,
            content="Agent synthesis content",
            sources=[{"title": "Test", "url": "https://test.com", "snippet": "..."}],
            tokens_used=100,
            latency_ms=500,
        )

        with patch("videos.web_search_provider.is_mistral_agent_available", return_value=True), \
             patch("core.mistral_agent.agent_web_search", new_callable=AsyncMock, return_value=mock_result):

            result = await _try_agent_search(
                query="test query", context="video context",
                purpose="enrichment", lang="fr",
            )

        assert result is not None
        assert result.success is True
        assert result.provider == "agent"
        assert "Agent synthesis" in result.content

    @pytest.mark.asyncio
    async def test_returns_none_when_agent_disabled(self):
        """When agent is disabled, _try_agent_search returns None."""
        from videos.web_search_provider import _try_agent_search

        with patch("videos.web_search_provider.is_mistral_agent_available", return_value=False):
            result = await _try_agent_search(
                query="test", context="test", purpose="chat",
            )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_agent_fails(self):
        """When agent raises exception, returns None (caller falls back to Brave)."""
        from videos.web_search_provider import _try_agent_search

        with patch("videos.web_search_provider.is_mistral_agent_available", return_value=True), \
             patch("core.mistral_agent.agent_web_search", new_callable=AsyncMock, side_effect=Exception("API down")):

            result = await _try_agent_search(
                query="test", context="test", purpose="chat",
            )

        assert result is None
