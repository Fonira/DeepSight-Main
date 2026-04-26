"""
Voice Web Tools Cache — Redis-backed wrapper around Brave Search.

Spec #0 (express fix): every Brave call from the voice agent goes through this
wrapper so identical queries within an hour reuse the previous payload.

Cache key: brave:search:{sha1(query|count)}
TTL: 3600s (1 hour)

The `cache_service` is the project's unified Redis/in-memory backend. When
Redis is unavailable the wrapper degrades silently to direct Brave calls.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

from core.cache import cache_service
from videos.brave_search import BraveSearchResult, _call_brave_api

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 3600  # 1 hour, per spec L99


def _make_cache_key(query: str, count: int) -> str:
    """Derive the cache key for a Brave query.

    Format mandated by spec #0 (L94): ``brave:search:{sha1(query|count)}``.
    """
    digest = hashlib.sha1(f"{query}|{count}".encode("utf-8")).hexdigest()
    return f"brave:search:{digest}"


def _result_to_dict(result: BraveSearchResult) -> dict[str, Any]:
    """Serialize a BraveSearchResult to a JSON-friendly dict for Redis."""
    return {
        "success": result.success,
        "snippets": result.snippets,
        "sources": result.sources,
        "query": result.query,
        "error": result.error,
    }


def _result_from_dict(payload: dict[str, Any]) -> BraveSearchResult:
    """Rehydrate a BraveSearchResult from a cached dict."""
    return BraveSearchResult(
        success=bool(payload.get("success", False)),
        snippets=payload.get("snippets", "") or "",
        sources=payload.get("sources", []) or [],
        query=payload.get("query", "") or "",
        error=payload.get("error"),
    )


async def cached_brave_search(query: str, count: int = 5) -> BraveSearchResult:
    """Cache-aware Brave Search wrapper used by the voice agent tools.

    Args:
        query: Free-text search query.
        count: Maximum number of results requested to Brave (default 5).

    Returns:
        BraveSearchResult — same shape as :func:`videos.brave_search._call_brave_api`.

    Notes:
        - Successful results are cached for 1 hour.
        - Failed results are NEVER cached (avoid persisting transient errors).
        - Cache backend errors are logged but never propagated.
    """
    if not query or not query.strip():
        # Don't bother cache lookups for empty queries — let Brave handle it.
        return await _call_brave_api(query, count=count)

    key = _make_cache_key(query, count)

    try:
        cached = await cache_service.get(key)
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("cached_brave_search GET failed: %s", exc)
        cached = None

    if cached is not None:
        try:
            return _result_from_dict(cached)
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning("cached_brave_search payload corrupted: %s", exc)

    result = await _call_brave_api(query, count=count)

    if result.success:
        try:
            await cache_service.set(key, _result_to_dict(result), ttl=_CACHE_TTL_SECONDS)
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning("cached_brave_search SET failed: %s", exc)

    return result


__all__ = ["cached_brave_search"]
