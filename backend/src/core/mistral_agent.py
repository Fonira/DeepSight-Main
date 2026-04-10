"""
Mistral Agent — Web Search via Agents + Conversations API.

Uses Mistral's built-in web_search tool to replace the 2-step
Brave Search → Mistral synthesis pipeline with a single API call.

Fallback: If the Agent API fails, callers should fall back to the
existing Brave + Mistral pipeline in web_search_provider.py.

Usage:
    from core.mistral_agent import agent_web_search, agent_web_search_stream

    # One-shot search + synthesis
    result = await agent_web_search(
        query="Impact de l'IA sur l'éducation",
        context="Vidéo sur l'IA en classe",
        purpose="enrichment",
    )
    if result:
        print(result.content, result.sources)

    # Streaming for chat
    async for chunk in agent_web_search_stream(
        query="Est-ce que GPT-5 existe ?",
        context="Discussion IA",
        purpose="chat",
    ):
        print(chunk, end="")
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import AsyncGenerator, Dict, List, Literal, Optional

from core.http_client import shared_http_client
from core.config import get_mistral_key

logger = logging.getLogger(__name__)

# =============================================================================
# CONSTANTS
# =============================================================================

MISTRAL_AGENTS_URL = "https://api.mistral.ai/v1/agents"
MISTRAL_CONVERSATIONS_URL = "https://api.mistral.ai/v1/conversations"

# Default model for the Agent — configurable via ensure_agent()
DEFAULT_AGENT_MODEL = "mistral-small-2603"

# Agent singleton state
_agent_id: Optional[str] = None
_agent_lock = asyncio.Lock()

# Circuit breaker for Agent API
_agent_failures: int = 0
_agent_last_failure: float = 0.0
_AGENT_COOLDOWN: float = 60.0  # seconds before retrying after 3+ failures
_AGENT_MAX_FAILURES: int = 3


# =============================================================================
# DATA TYPES
# =============================================================================

@dataclass
class AgentSearchResult:
    """Result from an Agent web search call."""
    success: bool
    content: str
    sources: List[Dict[str, str]] = field(default_factory=list)
    tokens_used: int = 0
    error: Optional[str] = None
    latency_ms: int = 0


# =============================================================================
# CIRCUIT BREAKER
# =============================================================================

def _is_agent_circuit_open() -> bool:
    """Check if the Agent API circuit breaker is open (should skip)."""
    global _agent_failures, _agent_last_failure
    if _agent_failures < _AGENT_MAX_FAILURES:
        return False
    elapsed = time.time() - _agent_last_failure
    if elapsed > _AGENT_COOLDOWN:
        _agent_failures = 0
        return False
    return True


def _record_agent_failure():
    global _agent_failures, _agent_last_failure
    _agent_failures += 1
    _agent_last_failure = time.time()


def _record_agent_success():
    global _agent_failures
    _agent_failures = 0


# =============================================================================
# AGENT INSTRUCTIONS BY PURPOSE
# =============================================================================

_INSTRUCTIONS_BY_PURPOSE: Dict[str, str] = {
    "enrichment": (
        "Tu es un expert en recherche web pour enrichir des analyses vidéo. "
        "Quand l'utilisateur te donne un sujet, recherche des informations récentes et pertinentes. "
        "Synthétise en 150-250 mots. Cite toujours tes sources."
    ),
    "fact_check": (
        "Tu es un fact-checker expert. Vérifie les affirmations avec des sources web fiables. "
        "Pour chaque affirmation, indique : VRAIE, PARTIELLEMENT VRAIE, FAUSSE, ou NON VÉRIFIABLE. "
        "Cite toujours tes sources avec précision."
    ),
    "chat": (
        "Tu es un assistant conversationnel avec accès web. "
        "Réponds de manière claire, nuancée et bien sourcée. "
        "Cite tes sources quand l'information vient du web."
    ),
    "debate": (
        "Tu es un expert en analyse de débats. Compare les arguments présentés "
        "contre les faits disponibles en ligne. Sois équitable et factuel. "
        "Cite toujours tes sources."
    ),
    "deep_research": (
        "Tu es un chercheur expert. Analyse les sources web pour dresser un panorama complet. "
        "Identifie les consensus, désaccords et perspectives minoritaires. "
        "Synthétise en 200-400 mots avec citations."
    ),
}

# Generic instructions used when creating the persistent Agent
_AGENT_SYSTEM_INSTRUCTIONS = (
    "Tu es DeepSight Analyst, un assistant IA spécialisé dans l'analyse de contenu vidéo. "
    "Tu disposes d'un outil de recherche web pour vérifier des faits, enrichir des analyses, "
    "et fournir des informations à jour. "
    "Règles : "
    "1. Cite TOUJOURS tes sources web. "
    "2. Sois factuel, nuancé et précis. "
    "3. Réponds dans la langue de la question (français par défaut). "
    "4. Distingue faits vérifiés, opinions et informations non confirmées."
)


# =============================================================================
# AGENT LIFECYCLE — Create once, reuse
# =============================================================================

async def ensure_agent(
    model: str = DEFAULT_AGENT_MODEL,
    force_recreate: bool = False,
) -> Optional[str]:
    """
    Ensure the DeepSight Analyst agent exists. Creates it if needed.
    Returns the agent_id or None on failure.

    Thread-safe via asyncio.Lock.
    """
    global _agent_id

    if _agent_id and not force_recreate:
        return _agent_id

    async with _agent_lock:
        # Double-check after acquiring lock
        if _agent_id and not force_recreate:
            return _agent_id

        api_key = get_mistral_key()
        if not api_key:
            logger.error("[AGENT] No MISTRAL_API_KEY configured")
            return None

        try:
            async with shared_http_client() as client:
                response = await client.post(
                    MISTRAL_AGENTS_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "name": "DeepSight Analyst",
                        "description": "Agent d'analyse et de fact-checking pour DeepSight",
                        "instructions": _AGENT_SYSTEM_INSTRUCTIONS,
                        "tools": [{"type": "web_search"}],
                        "completion_args": {
                            "temperature": 0.3,
                            "top_p": 0.95,
                        },
                    },
                    timeout=30
                )

                if response.status_code in (200, 201):
                    data = response.json()
                    _agent_id = data.get("id")
                    logger.info(
                        f"[AGENT] Created DeepSight Analyst agent: {_agent_id} "
                        f"(model={model})"
                    )
                    return _agent_id
                else:
                    logger.error(
                        f"[AGENT] Failed to create agent: {response.status_code} "
                        f"{response.text[:300]}"
                    )
                    return None

        except Exception as e:
            logger.error(f"[AGENT] Exception creating agent: {e}")
            return None


# =============================================================================
# RESPONSE PARSING
# =============================================================================

def _parse_conversation_response(data: dict) -> AgentSearchResult:
    """
    Parse a Conversations API response into an AgentSearchResult.

    The response contains outputs with entries of type:
    - "message.output" → content chunks (text + tool_reference)
    - "tool.execution" → metadata about tool usage
    """
    text_parts: List[str] = []
    sources: List[Dict[str, str]] = []
    seen_urls: set = set()

    outputs = data.get("outputs", [])
    for entry in outputs:
        entry_type = entry.get("type", "")

        if entry_type == "message.output":
            content = entry.get("content", "")

            # Content can be a string or a list of chunks
            if isinstance(content, str):
                text_parts.append(content)
            elif isinstance(content, list):
                for chunk in content:
                    chunk_type = chunk.get("type", "")
                    if chunk_type == "text":
                        text_parts.append(chunk.get("text", ""))
                    elif chunk_type == "tool_reference":
                        url = chunk.get("url", "")
                        if url and url not in seen_urls:
                            seen_urls.add(url)
                            sources.append({
                                "title": chunk.get("title", ""),
                                "url": url,
                                "snippet": chunk.get("snippet", ""),
                                "source": chunk.get("source", "web"),
                            })

    usage = data.get("usage", {})
    tokens = usage.get("total_tokens", 0)

    content = "\n".join(text_parts).strip()

    return AgentSearchResult(
        success=bool(content),
        content=content,
        sources=sources,
        tokens_used=tokens,
        error=None if content else "Empty response from agent",
    )


# =============================================================================
# PUBLIC: agent_web_search — One-shot search + synthesis
# =============================================================================

async def agent_web_search(
    query: str,
    context: str,
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    lang: str = "fr",
    model: str = DEFAULT_AGENT_MODEL,
    timeout: float = 45.0,
) -> Optional[AgentSearchResult]:
    """
    Execute a web search via Mistral Agent (one API call).

    Args:
        query: Search query or question
        context: Additional context (video title, claims to verify, etc.)
        purpose: Type of search — affects the user prompt
        lang: Response language
        model: Mistral model for the agent
        timeout: Request timeout

    Returns:
        AgentSearchResult or None if circuit breaker is open / total failure
    """
    # Circuit breaker check
    if _is_agent_circuit_open():
        logger.warning("[AGENT] Circuit breaker OPEN, skipping agent search")
        return None

    api_key = get_mistral_key()
    if not api_key:
        logger.error("[AGENT] No MISTRAL_API_KEY")
        return None

    # Ensure agent exists
    agent_id = await ensure_agent(model=model)
    if not agent_id:
        _record_agent_failure()
        return None

    # Build purpose-specific user message
    purpose_hint = _INSTRUCTIONS_BY_PURPOSE.get(purpose, "")
    lang_hint = "Réponds en français." if lang.lower().startswith("fr") else f"Reply in {lang}."

    user_message = (
        f"{purpose_hint}\n\n"
        f"Contexte : {context}\n\n"
        f"Requête : {query}\n\n"
        f"{lang_hint}"
    )

    start_time = time.time()

    try:
        async with shared_http_client() as client:
            response = await client.post(
                MISTRAL_CONVERSATIONS_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "agent_id": agent_id,
                    "inputs": user_message,
                    "store": False,  # Don't persist conversation in Mistral cloud
                },
                timeout=timeout
            )

            latency_ms = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                data = response.json()
                result = _parse_conversation_response(data)
                result.latency_ms = latency_ms

                _record_agent_success()
                logger.info(
                    f"[AGENT] Search OK: {len(result.content)} chars, "
                    f"{len(result.sources)} sources, {result.tokens_used} tokens, "
                    f"{latency_ms}ms, purpose={purpose}"
                )
                return result

            elif response.status_code == 429:
                _record_agent_failure()
                logger.warning(f"[AGENT] 429 rate limited ({latency_ms}ms)")
                return None

            elif response.status_code >= 500:
                _record_agent_failure()
                logger.error(
                    f"[AGENT] Server error {response.status_code} ({latency_ms}ms): "
                    f"{response.text[:200]}"
                )
                return None

            else:
                # 4xx (not 429) — log but don't trigger circuit breaker heavily
                logger.error(
                    f"[AGENT] Error {response.status_code}: {response.text[:300]}"
                )
                return None

    except httpx.TimeoutException:
        _record_agent_failure()
        latency_ms = int((time.time() - start_time) * 1000)
        logger.error(f"[AGENT] Timeout after {latency_ms}ms")
        return None

    except Exception as e:
        _record_agent_failure()
        logger.error(f"[AGENT] Exception: {e}")
        return None


# =============================================================================
# PUBLIC: agent_web_search_stream — Streaming SSE
# =============================================================================

async def agent_web_search_stream(
    query: str,
    context: str,
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    lang: str = "fr",
    model: str = DEFAULT_AGENT_MODEL,
    timeout: float = 60.0,
) -> AsyncGenerator[str, None]:
    """
    Stream a web search response via Mistral Agent (SSE).

    Yields text chunks as they arrive. Sources are collected and yielded
    as a final JSON block prefixed with [SOURCES] for the caller to parse.

    Args:
        query, context, purpose, lang, model, timeout: Same as agent_web_search

    Yields:
        Text content chunks, then optionally "[SOURCES]{json}" at the end
    """
    # Circuit breaker check
    if _is_agent_circuit_open():
        logger.warning("[AGENT-STREAM] Circuit breaker OPEN")
        return

    api_key = get_mistral_key()
    if not api_key:
        logger.error("[AGENT-STREAM] No MISTRAL_API_KEY")
        return

    agent_id = await ensure_agent(model=model)
    if not agent_id:
        _record_agent_failure()
        return

    purpose_hint = _INSTRUCTIONS_BY_PURPOSE.get(purpose, "")
    lang_hint = "Réponds en français." if lang.lower().startswith("fr") else f"Reply in {lang}."

    user_message = (
        f"{purpose_hint}\n\n"
        f"Contexte : {context}\n\n"
        f"Requête : {query}\n\n"
        f"{lang_hint}"
    )

    sources: List[Dict[str, str]] = []
    seen_urls: set = set()

    try:
        async with shared_http_client() as client:
            async with client.stream(
                "POST",
                MISTRAL_CONVERSATIONS_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "agent_id": agent_id,
                    "inputs": user_message,
                    "store": False,
                    "stream": True,
                },
                timeout=timeout
            ) as response:
                if response.status_code == 429:
                    _record_agent_failure()
                    logger.warning("[AGENT-STREAM] 429 rate limited")
                    await response.aread()
                    return

                if response.status_code >= 500:
                    _record_agent_failure()
                    logger.error(f"[AGENT-STREAM] Server error {response.status_code}")
                    await response.aread()
                    return

                if response.status_code != 200:
                    body = await response.aread()
                    logger.error(
                        f"[AGENT-STREAM] Error {response.status_code}: "
                        f"{body.decode()[:200]}"
                    )
                    return

                _record_agent_success()

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue

                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break

                    try:
                        event = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    # Parse streaming events
                    event_type = event.get("type", "")

                    if event_type == "conversation.response.chunk":
                        # Delta content
                        delta = event.get("delta", {})
                        content = delta.get("content", "")

                        if isinstance(content, str) and content:
                            yield content
                        elif isinstance(content, list):
                            for chunk in content:
                                chunk_type = chunk.get("type", "")
                                if chunk_type == "text":
                                    text = chunk.get("text", "")
                                    if text:
                                        yield text
                                elif chunk_type == "tool_reference":
                                    url = chunk.get("url", "")
                                    if url and url not in seen_urls:
                                        seen_urls.add(url)
                                        sources.append({
                                            "title": chunk.get("title", ""),
                                            "url": url,
                                            "snippet": chunk.get("snippet", ""),
                                        })

                    elif event_type == "conversation.response.completed":
                        # Final event with usage stats
                        usage = event.get("usage", {})
                        tokens = usage.get("total_tokens", 0)
                        logger.info(
                            f"[AGENT-STREAM] Complete: {tokens} tokens, "
                            f"{len(sources)} sources"
                        )

        # Yield sources as final block if any were collected
        if sources:
            yield f"\n[SOURCES]{json.dumps(sources, ensure_ascii=False)}"

    except httpx.TimeoutException:
        _record_agent_failure()
        logger.error("[AGENT-STREAM] Timeout")

    except Exception as e:
        _record_agent_failure()
        logger.error(f"[AGENT-STREAM] Exception: {e}")


# =============================================================================
# UTILITY: Delete agent (cleanup)
# =============================================================================

async def delete_agent() -> bool:
    """Delete the current DeepSight Analyst agent. Useful for cleanup/recreation."""
    global _agent_id

    if not _agent_id:
        return True

    api_key = get_mistral_key()
    if not api_key:
        return False

    try:
        async with shared_http_client() as client:
            response = await client.delete(
                f"{MISTRAL_AGENTS_URL}/{_agent_id}",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=15
            )
            if response.status_code in (200, 204, 404):
                logger.info(f"[AGENT] Deleted agent {_agent_id}")
                _agent_id = None
                return True
            else:
                logger.error(f"[AGENT] Delete failed: {response.status_code}")
                return False
    except Exception as e:
        logger.error(f"[AGENT] Delete exception: {e}")
        return False


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    "AgentSearchResult",
    "agent_web_search",
    "agent_web_search_stream",
    "ensure_agent",
    "delete_agent",
]
