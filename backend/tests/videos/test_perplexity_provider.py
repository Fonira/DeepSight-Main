"""
Tests for videos.perplexity_provider — direct Perplexity API integration
with fallback semantics for the web_search_and_synthesize chain.
"""

import json
from unittest.mock import patch, AsyncMock, MagicMock

import pytest


# ═══════════════════════════════════════════════════════════════════════════════
# is_perplexity_provider_available
# ═══════════════════════════════════════════════════════════════════════════════


def test_is_perplexity_provider_available_with_key():
    from videos.perplexity_provider import is_perplexity_provider_available

    with patch("videos.perplexity_provider.get_perplexity_key", return_value="pplx-test-123"):
        assert is_perplexity_provider_available() is True


def test_is_perplexity_provider_available_without_key():
    from videos.perplexity_provider import is_perplexity_provider_available

    with patch("videos.perplexity_provider.get_perplexity_key", return_value=""):
        assert is_perplexity_provider_available() is False


# ═══════════════════════════════════════════════════════════════════════════════
# perplexity_search — return shape & graceful failure
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_perplexity_search_no_key_returns_none():
    from videos.perplexity_provider import perplexity_search

    with patch("videos.perplexity_provider.get_perplexity_key", return_value=""):
        result = await perplexity_search("test query")

    assert result is None


@pytest.mark.asyncio
async def test_perplexity_search_success_returns_websearchresult():
    from videos.perplexity_provider import perplexity_search

    fake_response_payload = {
        "choices": [
            {
                "message": {
                    "content": "Voici une réponse synthétisée avec faits récents.",
                }
            }
        ],
        "citations": [
            "https://example.com/article1",
            "https://example.com/article2",
        ],
        "usage": {"total_tokens": 350},
    }

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json = MagicMock(return_value=fake_response_payload)

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("videos.perplexity_provider.get_perplexity_key", return_value="pplx-fake"), patch(
        "videos.perplexity_provider.httpx.AsyncClient", return_value=mock_client
    ):
        result = await perplexity_search("dernières news IA")

    assert result is not None
    assert result.success is True
    assert result.provider == "perplexity"
    assert "synthétisée" in result.content
    assert len(result.sources) == 2
    assert result.sources[0]["url"] == "https://example.com/article1"
    assert result.tokens_used == 350


@pytest.mark.asyncio
async def test_perplexity_search_http_error_returns_none():
    from videos.perplexity_provider import perplexity_search

    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.text = "rate limited"

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("videos.perplexity_provider.get_perplexity_key", return_value="pplx-fake"), patch(
        "videos.perplexity_provider.httpx.AsyncClient", return_value=mock_client
    ):
        result = await perplexity_search("query")

    assert result is None


@pytest.mark.asyncio
async def test_perplexity_search_empty_choices_returns_none():
    from videos.perplexity_provider import perplexity_search

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json = MagicMock(return_value={"choices": []})

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("videos.perplexity_provider.get_perplexity_key", return_value="pplx-fake"), patch(
        "videos.perplexity_provider.httpx.AsyncClient", return_value=mock_client
    ):
        result = await perplexity_search("query")

    assert result is None


@pytest.mark.asyncio
async def test_perplexity_search_timeout_returns_none():
    import httpx
    from videos.perplexity_provider import perplexity_search

    mock_client = MagicMock()
    mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("videos.perplexity_provider.get_perplexity_key", return_value="pplx-fake"), patch(
        "videos.perplexity_provider.httpx.AsyncClient", return_value=mock_client
    ):
        result = await perplexity_search("query", timeout=1.0)

    assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# Fallback chain integration (web_search_provider)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_chain_uses_perplexity_when_agent_fails():
    """When Mistral Agent returns None, the chain should try Perplexity before Brave."""
    from videos import web_search_provider
    from videos.web_search_provider import WebSearchResult

    pplx_result = WebSearchResult(
        success=True,
        content="Réponse Perplexity",
        sources=[{"title": "S1", "url": "https://x.com", "snippet": ""}],
        tokens_used=200,
        provider="perplexity",
    )

    with patch(
        "videos.web_search_provider._try_agent_search", AsyncMock(return_value=None)
    ), patch(
        "videos.web_search_provider.is_perplexity_provider_available", return_value=True
    ), patch(
        "videos.web_search_provider.perplexity_search", AsyncMock(return_value=pplx_result)
    ), patch(
        "videos.web_search_provider._brave_fallback_search", AsyncMock()
    ) as brave_mock:
        result = await web_search_provider.web_search_and_synthesize(
            query="test",
            context="",
            purpose="chat",
        )

    assert result.success is True
    assert result.provider == "perplexity"
    brave_mock.assert_not_called()


@pytest.mark.asyncio
async def test_chain_falls_through_to_brave_when_perplexity_fails():
    """When Agent and Perplexity both return None, Brave fallback must run."""
    from videos import web_search_provider
    from videos.web_search_provider import WebSearchResult

    brave_result = WebSearchResult(
        success=True,
        content="Brave answer",
        sources=[],
        tokens_used=100,
        provider="brave",
    )

    with patch(
        "videos.web_search_provider._try_agent_search", AsyncMock(return_value=None)
    ), patch(
        "videos.web_search_provider.is_perplexity_provider_available", return_value=True
    ), patch(
        "videos.web_search_provider.perplexity_search", AsyncMock(return_value=None)
    ), patch(
        "videos.web_search_provider._brave_fallback_search", AsyncMock(return_value=brave_result)
    ) as brave_mock:
        result = await web_search_provider.web_search_and_synthesize(
            query="test",
            context="",
            purpose="chat",
        )

    assert result.success is True
    assert result.provider == "brave"
    brave_mock.assert_called_once()
