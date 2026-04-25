"""
Trending Pre-cache -- Warm Redis with popular DeepSight trending combos.

Called by APScheduler every hour (same pattern as tournesol/trending_cache.py).
Pre-fetches the most common parameter combinations so the first request from
any Uvicorn worker is always a Redis hit instead of a slow DB query.

Cache keys: deepsight:trending:deepsight:{period}:{category}:{limit}
TTL: 1 hour (refresh every hour = always fresh)
"""

import logging
import time
from typing import Any, Dict

from core.cache import cache_service
from trending.router import (
    CACHE_TTL,
    _query_trending_from_db,
    build_trending_cache_key,
)

logger = logging.getLogger("deepsight.trending_precache")

# ═══════════════════════════════════════════════════════════════════════════════
# Pre-cache combinations (period, category, limit)
# ═══════════════════════════════════════════════════════════════════════════════

PRECACHE_COMBOS: list[tuple[str, str | None, int]] = [
    ("30d", None, 20),  # Default / most common request
    ("7d", None, 20),  # Weekly view
]


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


async def refresh_deepsight_trending() -> Dict[str, Any]:
    """
    Pre-fetch and cache popular trending parameter combinations.

    Returns stats about the refresh operation (for logging / admin).
    """
    start = time.time()
    stats: Dict[str, Any] = {"cached": 0, "errors": 0, "combos": []}

    for period, category, limit in PRECACHE_COMBOS:
        combo_label = f"{period}/{category or 'all'}/{limit}"
        try:
            response = await _query_trending_from_db(period, category, limit)
            cache_key = build_trending_cache_key(period, category, limit)
            await cache_service.set(cache_key, response.model_dump(), ttl=CACHE_TTL)

            stats["cached"] += 1
            stats["combos"].append(combo_label)
            logger.info(
                "[TRENDING_PRECACHE] Cached %d videos for %s",
                len(response.videos),
                combo_label,
            )
        except Exception as e:
            stats["errors"] += 1
            logger.error(
                "[TRENDING_PRECACHE] Error caching %s: %s",
                combo_label,
                e,
            )

    elapsed = time.time() - start
    logger.info(
        "[TRENDING_PRECACHE] Refresh complete in %.1fs — cached=%d errors=%d",
        elapsed,
        stats["cached"],
        stats["errors"],
    )

    return stats
