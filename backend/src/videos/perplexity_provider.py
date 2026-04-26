"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔮 PERPLEXITY PROVIDER — sonar-pro web search avec citations natives             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  RÔLE :                                                                            ║
║  • Provider direct Perplexity (api.perplexity.ai)                                  ║
║  • Utilisé comme fallback intermédiaire entre Mistral Agent et Brave               ║
║  • Modèle sonar-pro : réponse synthétisée + citations natives                      ║
║  • Retourne un WebSearchResult compatible avec web_search_provider                 ║
║  • Timeout court (15s) — la chaîne complète doit rester sous 30s                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import json
import logging
from typing import Optional

import httpx

from core.config import get_perplexity_key

logger = logging.getLogger(__name__)


PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/chat/completions"
PERPLEXITY_DEFAULT_MODEL = "sonar-pro"
PERPLEXITY_DEFAULT_TIMEOUT = 15.0


def is_perplexity_provider_available() -> bool:
    """Check if a Perplexity API key is configured."""
    return bool(get_perplexity_key())


def _build_system_prompt(purpose: str, lang: str = "fr") -> str:
    """Build a purpose-aware system prompt for Perplexity."""
    is_fr = lang.lower().startswith("fr")

    base = (
        "Tu es un assistant de recherche web. Réponds de manière factuelle, "
        "concise (max 200 mots), et cite tes sources. "
        "Si la question demande des informations récentes, privilégie les sources de moins de 3 mois."
        if is_fr
        else "You are a web research assistant. Answer factually, concisely (max 200 words), "
        "and cite your sources. For time-sensitive questions, prefer sources less than 3 months old."
    )

    if purpose == "fact_check":
        addon = (
            " Évalue chaque affirmation : VRAIE / PARTIELLEMENT VRAIE / FAUSSE / NON VÉRIFIABLE."
            if is_fr
            else " Evaluate each claim: TRUE / PARTIALLY TRUE / FALSE / UNVERIFIABLE."
        )
    elif purpose == "deep_research":
        addon = (
            " Donne un panorama complet : consensus, désaccords, perspectives minoritaires."
            if is_fr
            else " Provide a complete overview: consensus, disagreements, minority views."
        )
    elif purpose == "debate":
        addon = (
            " Présente plusieurs angles de manière équilibrée."
            if is_fr
            else " Present multiple angles in a balanced way."
        )
    else:
        addon = ""

    return base + addon


async def perplexity_search(
    query: str,
    context: str = "",
    purpose: str = "chat",
    lang: str = "fr",
    model: Optional[str] = None,
    max_tokens: int = 1500,
    timeout: float = PERPLEXITY_DEFAULT_TIMEOUT,
) -> Optional["object"]:
    """
    Direct call to Perplexity sonar-pro for web-grounded answers.

    Returns a WebSearchResult-shaped object on success, None on failure
    (so the caller can fall back to the next provider in the chain).
    """
    # Late import to avoid circular dep with web_search_provider
    from videos.web_search_provider import WebSearchResult

    api_key = get_perplexity_key()
    if not api_key:
        logger.debug("[PERPLEXITY] No API key configured, skipping")
        return None

    model = model or PERPLEXITY_DEFAULT_MODEL
    system_prompt = _build_system_prompt(purpose, lang)

    user_content = query.strip()
    if context:
        user_content = f"Contexte : {context[:1500]}\n\nQuestion : {query.strip()}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "return_citations": True,
        "return_related_questions": False,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    logger.info(
        "[PERPLEXITY] Calling %s, query='%s', purpose=%s",
        model,
        query[:80],
        purpose,
    )

    try:
        async with httpx.AsyncClient(timeout=timeout, http2=True) as client:
            response = await client.post(PERPLEXITY_ENDPOINT, json=payload, headers=headers)

        if response.status_code != 200:
            logger.warning(
                "[PERPLEXITY] HTTP %s: %s",
                response.status_code,
                response.text[:300],
            )
            return None

        data = response.json()

        # Extract content
        choices = data.get("choices", [])
        if not choices:
            logger.warning("[PERPLEXITY] Empty choices")
            return None

        message = choices[0].get("message", {})
        content = (message.get("content") or "").strip()
        if not content:
            logger.warning("[PERPLEXITY] Empty content")
            return None

        # Extract citations — Perplexity returns them as a list of URLs
        citations = data.get("citations") or message.get("citations") or []
        sources = []
        for i, url in enumerate(citations[:10], 1):
            if isinstance(url, str):
                sources.append(
                    {
                        "title": f"Source {i}",
                        "url": url,
                        "snippet": "",
                    }
                )
            elif isinstance(url, dict):
                sources.append(
                    {
                        "title": url.get("title", f"Source {i}"),
                        "url": url.get("url", ""),
                        "snippet": url.get("snippet", ""),
                    }
                )

        # Token usage
        usage = data.get("usage", {}) or {}
        tokens_used = int(usage.get("total_tokens", 0))

        logger.info(
            "[PERPLEXITY] OK: %d chars, %d sources, %d tokens",
            len(content),
            len(sources),
            tokens_used,
        )

        return WebSearchResult(
            success=True,
            content=content,
            sources=sources,
            tokens_used=tokens_used,
            provider="perplexity",
        )

    except (httpx.TimeoutException, asyncio.TimeoutError):
        logger.warning("[PERPLEXITY] Timeout after %ss", timeout)
        return None
    except httpx.HTTPError as e:
        logger.warning("[PERPLEXITY] HTTP error: %s", e)
        return None
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning("[PERPLEXITY] Parse error: %s", e)
        return None
    except Exception as e:
        logger.warning("[PERPLEXITY] Unexpected exception: %s", e)
        return None


__all__ = [
    "perplexity_search",
    "is_perplexity_provider_available",
    "PERPLEXITY_DEFAULT_MODEL",
]
