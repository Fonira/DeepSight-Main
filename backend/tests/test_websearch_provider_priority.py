"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 Phase 5 — Mistral-First migration                                              ║
║  Tests pour la priorisation des providers web search en fonction du flag           ║
║  MISTRAL_AGENT_PRIMARY.                                                            ║
║                                                                                    ║
║  Comportement testé:                                                               ║
║   • flag OFF (default)  → [perplexity, mistral_agent, brave]                       ║
║   • flag ON             → [mistral_agent, perplexity, brave]                       ║
║   • Brave reste last-resort dans les deux cas.                                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from unittest.mock import patch, AsyncMock

import pytest


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _make_result(provider: str, content: str = "ok"):
    """Build a synthetic WebSearchResult for the given provider."""
    from videos.web_search_provider import WebSearchResult

    return WebSearchResult(
        success=True,
        content=content,
        sources=[{"title": "S", "url": f"https://example.com/{provider}", "snippet": ""}],
        tokens_used=100,
        provider=provider,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Flag default value
# ═══════════════════════════════════════════════════════════════════════════════


def test_mistral_agent_primary_flag_default_off():
    """Le flag MISTRAL_AGENT_PRIMARY doit exister et être False par défaut."""
    from core import config

    assert hasattr(config, "MISTRAL_AGENT_PRIMARY"), (
        "core.config.MISTRAL_AGENT_PRIMARY missing — Phase 5 feature flag not added"
    )
    assert config.MISTRAL_AGENT_PRIMARY is False, (
        "MISTRAL_AGENT_PRIMARY must default to False (no auto-rollout)"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Provider order — flag OFF (Perplexity first)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_perplexity_first_when_flag_off():
    """
    flag=False → la chaîne tente Perplexity AVANT Mistral Agent.
    Quand Perplexity réussit, Mistral Agent ne doit PAS être appelé.
    """
    from videos import web_search_provider

    pplx = _make_result("perplexity", "Réponse Perplexity")

    with patch("videos.web_search_provider.MISTRAL_AGENT_PRIMARY", False), patch(
        "videos.web_search_provider.is_perplexity_provider_available", return_value=True
    ), patch(
        "videos.web_search_provider.perplexity_search", AsyncMock(return_value=pplx)
    ), patch(
        "videos.web_search_provider._try_agent_search", AsyncMock(return_value=None)
    ) as agent_mock, patch(
        "videos.web_search_provider._brave_fallback_search", AsyncMock()
    ) as brave_mock:
        result = await web_search_provider.web_search_and_synthesize(
            query="test", context="", purpose="chat"
        )

    assert result.success is True
    assert result.provider == "perplexity"
    agent_mock.assert_not_called()
    brave_mock.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════════
# Provider order — flag ON (Mistral Agent first)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_mistral_agent_first_when_flag_on():
    """
    flag=True → la chaîne tente Mistral Agent AVANT Perplexity.
    Quand Agent réussit, Perplexity ne doit PAS être appelé.
    """
    from videos import web_search_provider

    agent_result = _make_result("agent", "Réponse Mistral Agent")

    with patch("videos.web_search_provider.MISTRAL_AGENT_PRIMARY", True), patch(
        "videos.web_search_provider._try_agent_search", AsyncMock(return_value=agent_result)
    ), patch(
        "videos.web_search_provider.is_perplexity_provider_available", return_value=True
    ), patch(
        "videos.web_search_provider.perplexity_search", AsyncMock()
    ) as pplx_mock, patch(
        "videos.web_search_provider._brave_fallback_search", AsyncMock()
    ) as brave_mock:
        result = await web_search_provider.web_search_and_synthesize(
            query="test", context="", purpose="chat"
        )

    assert result.success is True
    assert result.provider == "agent"
    pplx_mock.assert_not_called()
    brave_mock.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════════
# Fallback chains
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_fallback_chain_works_flag_off():
    """
    flag=False, Perplexity fail → Mistral Agent tenté → Agent fail → Brave appelé.
    """
    from videos import web_search_provider

    brave_result = _make_result("brave", "Brave answer")

    with patch("videos.web_search_provider.MISTRAL_AGENT_PRIMARY", False), patch(
        "videos.web_search_provider.is_perplexity_provider_available", return_value=True
    ), patch(
        "videos.web_search_provider.perplexity_search", AsyncMock(return_value=None)
    ) as pplx_mock, patch(
        "videos.web_search_provider._try_agent_search", AsyncMock(return_value=None)
    ) as agent_mock, patch(
        "videos.web_search_provider._brave_fallback_search", AsyncMock(return_value=brave_result)
    ) as brave_mock:
        result = await web_search_provider.web_search_and_synthesize(
            query="test", context="", purpose="chat"
        )

    assert result.success is True
    assert result.provider == "brave"
    pplx_mock.assert_called_once()
    agent_mock.assert_called_once()
    brave_mock.assert_called_once()


@pytest.mark.asyncio
async def test_fallback_chain_works_flag_on():
    """
    flag=True, Mistral Agent fail → Perplexity tenté → Perplexity fail → Brave appelé.
    """
    from videos import web_search_provider

    brave_result = _make_result("brave", "Brave answer")

    with patch("videos.web_search_provider.MISTRAL_AGENT_PRIMARY", True), patch(
        "videos.web_search_provider._try_agent_search", AsyncMock(return_value=None)
    ) as agent_mock, patch(
        "videos.web_search_provider.is_perplexity_provider_available", return_value=True
    ), patch(
        "videos.web_search_provider.perplexity_search", AsyncMock(return_value=None)
    ) as pplx_mock, patch(
        "videos.web_search_provider._brave_fallback_search", AsyncMock(return_value=brave_result)
    ) as brave_mock:
        result = await web_search_provider.web_search_and_synthesize(
            query="test", context="", purpose="chat"
        )

    assert result.success is True
    assert result.provider == "brave"
    agent_mock.assert_called_once()
    pplx_mock.assert_called_once()
    brave_mock.assert_called_once()


@pytest.mark.asyncio
async def test_perplexity_fallback_to_agent_when_flag_off():
    """
    flag=False, Perplexity returns None → la chaîne doit basculer sur Mistral Agent
    (Brave intervient seulement après l'échec d'Agent).
    """
    from videos import web_search_provider

    agent_result = _make_result("agent", "Agent fallback content")

    with patch("videos.web_search_provider.MISTRAL_AGENT_PRIMARY", False), patch(
        "videos.web_search_provider.is_perplexity_provider_available", return_value=True
    ), patch(
        "videos.web_search_provider.perplexity_search", AsyncMock(return_value=None)
    ), patch(
        "videos.web_search_provider._try_agent_search", AsyncMock(return_value=agent_result)
    ) as agent_mock, patch(
        "videos.web_search_provider._brave_fallback_search", AsyncMock()
    ) as brave_mock:
        result = await web_search_provider.web_search_and_synthesize(
            query="test", context="", purpose="chat"
        )

    assert result.success is True
    assert result.provider == "agent"
    agent_mock.assert_called_once()
    brave_mock.assert_not_called()


@pytest.mark.asyncio
async def test_agent_fallback_to_perplexity_when_flag_on():
    """
    flag=True, Mistral Agent fails → Perplexity prend le relais.
    Brave ne doit PAS être appelé si Perplexity réussit.
    """
    from videos import web_search_provider

    pplx = _make_result("perplexity", "Perplexity fallback content")

    with patch("videos.web_search_provider.MISTRAL_AGENT_PRIMARY", True), patch(
        "videos.web_search_provider._try_agent_search", AsyncMock(return_value=None)
    ), patch(
        "videos.web_search_provider.is_perplexity_provider_available", return_value=True
    ), patch(
        "videos.web_search_provider.perplexity_search", AsyncMock(return_value=pplx)
    ) as pplx_mock, patch(
        "videos.web_search_provider._brave_fallback_search", AsyncMock()
    ) as brave_mock:
        result = await web_search_provider.web_search_and_synthesize(
            query="test", context="", purpose="chat"
        )

    assert result.success is True
    assert result.provider == "perplexity"
    pplx_mock.assert_called_once()
    brave_mock.assert_not_called()
