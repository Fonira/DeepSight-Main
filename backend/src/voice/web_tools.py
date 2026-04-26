"""
Voice Web Tools — Brave Search integration for voice agent.

Tools:
  web_search    — Quick web search (max 5 results)
  deep_research — Multi-query deep research
  check_fact    — Fact-check a specific claim
"""

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_brave_key
from voice.web_tools_cache import cached_brave_search

logger = logging.getLogger(__name__)


def _truncate(text: str, max_chars: int) -> str:
    """Truncate text to max_chars, cutting at last sentence boundary."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    # Try to cut at last period
    last_period = truncated.rfind(". ")
    if last_period > max_chars // 2:
        return truncated[: last_period + 1]
    return truncated.rstrip() + "..."


# ═══════════════════════════════════════════════════════════════════════════════
# web_search — Quick web search via Brave
# ═══════════════════════════════════════════════════════════════════════════════


async def web_search(
    summary_id: int,
    query: str,
    db: AsyncSession,
) -> str:
    """Search the web via Brave Search. Returns max 5 results formatted for voice."""
    logger.info("web_search called", extra={"summary_id": summary_id, "query": query})

    if not get_brave_key():
        return "La recherche web n'est pas disponible pour le moment."

    if not query or not query.strip():
        return "Aucune requête de recherche fournie."

    try:
        result = await cached_brave_search(query.strip(), count=5)

        if not result.success or not result.sources:
            return f"Aucun résultat trouvé pour la recherche : {query}"

        lines = []
        for src in result.sources:
            title = src.get("title", "")
            snippet = src.get("snippet", "")
            age = src.get("age", "")
            age_str = f" ({age})" if age else ""
            lines.append(f"{title}{age_str} : {snippet}")

        formatted = "Résultats de recherche web :\n" + "\n".join(lines)
        return _truncate(formatted, 1500)

    except Exception as e:
        logger.error("web_search error: %s", e, exc_info=True)
        return "Une erreur est survenue lors de la recherche web."


# ═══════════════════════════════════════════════════════════════════════════════
# deep_research — Multi-query deep web research
# ═══════════════════════════════════════════════════════════════════════════════


async def deep_research(
    summary_id: int,
    query: str,
    db: AsyncSession,
) -> str:
    """Deep web research combining multiple Brave queries."""
    logger.info("deep_research called", extra={"summary_id": summary_id, "query": query})

    if not get_brave_key():
        return "La recherche web n'est pas disponible pour le moment."

    if not query or not query.strip():
        return "Aucune requête de recherche fournie."

    try:
        q = query.strip()
        queries = [
            q,
            f"{q} analyse critique",
            f"{q} dernières nouvelles 2025 2026",
        ]

        results = await asyncio.gather(
            *[cached_brave_search(qr, count=5) for qr in queries],
            return_exceptions=True,
        )

        seen_urls: set[str] = set()
        lines: list[str] = []

        for res in results:
            if isinstance(res, Exception) or not res.success:
                continue
            for src in res.sources:
                url = src.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                title = src.get("title", "")
                snippet = src.get("snippet", "")
                age = src.get("age", "")
                age_str = f" ({age})" if age else ""
                lines.append(f"{title}{age_str} : {snippet}")

        if not lines:
            return f"Aucun résultat trouvé pour la recherche approfondie : {query}"

        formatted = "Recherche approfondie :\n" + "\n".join(lines)
        return _truncate(formatted, 2000)

    except Exception as e:
        logger.error("deep_research error: %s", e, exc_info=True)
        return "Une erreur est survenue lors de la recherche approfondie."


# ═══════════════════════════════════════════════════════════════════════════════
# check_fact — Fact-check a claim via web search
# ═══════════════════════════════════════════════════════════════════════════════


async def check_fact(
    summary_id: int,
    claim: str,
    db: AsyncSession,
) -> str:
    """Verify a factual claim via Brave web search."""
    logger.info("check_fact called", extra={"summary_id": summary_id, "claim": claim})

    if not get_brave_key():
        return "La vérification factuelle n'est pas disponible pour le moment."

    if not claim or not claim.strip():
        return "Aucune affirmation à vérifier."

    try:
        search_query = f"{claim.strip()} fact check verification"
        result = await cached_brave_search(search_query, count=5)

        if not result.success or not result.sources:
            return f"Aucune source trouvée pour vérifier cette affirmation : {claim}"

        lines = []
        for src in result.sources:
            title = src.get("title", "")
            snippet = src.get("snippet", "")
            lines.append(f"{title} : {snippet}")

        formatted = f'Vérification de l\'affirmation : "{claim}"\n\nSelon les sources trouvées :\n' + "\n".join(lines)
        return _truncate(formatted, 1500)

    except Exception as e:
        logger.error("check_fact error: %s", e, exc_info=True)
        return "Une erreur est survenue lors de la vérification factuelle."
