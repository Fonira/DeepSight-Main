"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🌻 TRENDING CACHE — Pre-cache Tournesol recommendations                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Toutes les heures, pré-fetche les recommandations Tournesol par langue           ║
║  et les stocke dans Redis. Le frontend sert depuis le cache au lieu de            ║
║  proxyer chaque requête live vers api.tournesol.app.                              ║
║                                                                                    ║
║  Cache keys: deepsight:trending:tournesol:{lang}:{offset_bucket}                  ║
║  TTL: 2 heures (refresh toutes les heures = toujours frais)                       ║
║  Fallback: si cache miss → appel live Tournesol (comportement actuel)             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import logging
import random
import time
from typing import Any, Dict, Optional

import httpx

from core.cache import cache_service, make_cache_key

logger = logging.getLogger("deepsight.trending_cache")

# ═══════════════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════════════

TOURNESOL_API_URL = "https://api.tournesol.app/polls/videos/recommendations/"
TOURNESOL_TIMEOUT = 20.0
TOURNESOL_USER_AGENT = "DeepSight/1.0 (tournesol-precache)"

# Languages to pre-cache
PRECACHE_LANGUAGES = ["fr", "en"]

# Number of results to pre-cache per language
PRECACHE_LIMIT = 50

# Number of offset buckets to pre-cache (for random shuffle on frontend)
# Frontend uses random offset (0, 50, 100, ...) to get variety
PRECACHE_OFFSETS = [0, 50, 100]

# Cache TTL: 2 hours (job runs every hour → always fresh)
CACHE_TTL = 7200

# Cache key prefix
CACHE_PREFIX = "trending:tournesol"


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


async def get_cached_trending(
    language: str = "fr",
    limit: int = 20,
    offset: int = 0,
) -> Optional[Dict[str, Any]]:
    """
    Get pre-cached Tournesol trending results.

    Returns the raw Tournesol API format (count, next, previous, results)
    so the frontend doesn't need any changes.

    Returns None on cache miss → caller should fallback to live API.
    """
    # Snap offset to nearest bucket
    bucket = _snap_to_bucket(offset)
    cache_key = make_cache_key(CACHE_PREFIX, language, str(bucket))

    cached = await cache_service.get(cache_key)
    if cached is None:
        logger.debug("[TRENDING_CACHE] Miss for lang=%s offset=%d", language, bucket)
        return None

    logger.debug("[TRENDING_CACHE] Hit for lang=%s offset=%d", language, bucket)

    # Slice results to match requested limit/offset within the bucket
    results = cached.get("results", [])
    inner_offset = offset - bucket
    if inner_offset > 0:
        results = results[inner_offset:]
    if limit < len(results):
        results = results[:limit]

    return {
        "count": cached.get("count", len(results)),
        "next": cached.get("next"),
        "previous": cached.get("previous"),
        "results": results,
        "_cached": True,
        "_cache_age": int(time.time() - cached.get("_cached_at", 0)),
    }


async def refresh_trending_cache() -> Dict[str, Any]:
    """
    Refresh all trending cache buckets. Called by APScheduler every hour.

    Pre-fetches Tournesol recommendations for each language × offset combination.
    Returns stats about the refresh operation.
    """
    start = time.time()
    stats = {"fetched": 0, "cached": 0, "errors": 0, "languages": []}

    for lang in PRECACHE_LANGUAGES:
        lang_fetched = 0
        for offset in PRECACHE_OFFSETS:
            try:
                data = await _fetch_tournesol_recommendations(
                    language=lang,
                    limit=PRECACHE_LIMIT,
                    offset=offset,
                )
                if data and data.get("results"):
                    # Add cache metadata
                    data["_cached_at"] = int(time.time())

                    # Shuffle results slightly for variety
                    results = data.get("results", [])
                    if len(results) > 5:
                        # Keep top 3 fixed, shuffle rest
                        top = results[:3]
                        rest = results[3:]
                        random.shuffle(rest)
                        data["results"] = top + rest

                    cache_key = make_cache_key(CACHE_PREFIX, lang, str(offset))
                    await cache_service.set(cache_key, data, ttl=CACHE_TTL)

                    stats["cached"] += 1
                    lang_fetched += len(results)
                    logger.info(
                        "[TRENDING_CACHE] Cached %d results for lang=%s offset=%d",
                        len(results),
                        lang,
                        offset,
                    )
                else:
                    logger.warning(
                        "[TRENDING_CACHE] Empty response for lang=%s offset=%d",
                        lang,
                        offset,
                    )
                stats["fetched"] += 1

            except Exception as e:
                stats["errors"] += 1
                logger.error(
                    "[TRENDING_CACHE] Error fetching lang=%s offset=%d: %s",
                    lang,
                    offset,
                    e,
                )

        if lang_fetched > 0:
            stats["languages"].append(lang)

    elapsed = time.time() - start
    logger.info(
        "[TRENDING_CACHE] Refresh complete in %.1fs — cached=%d errors=%d languages=%s",
        elapsed,
        stats["cached"],
        stats["errors"],
        stats["languages"],
    )

    return stats


async def get_cache_stats() -> Dict[str, Any]:
    """Get trending cache statistics for admin dashboard."""
    stats = {"entries": 0, "languages": {}, "total_results": 0}

    for lang in PRECACHE_LANGUAGES:
        lang_total = 0
        for offset in PRECACHE_OFFSETS:
            cache_key = make_cache_key(CACHE_PREFIX, lang, str(offset))
            cached = await cache_service.get(cache_key)
            if cached:
                stats["entries"] += 1
                count = len(cached.get("results", []))
                lang_total += count
                age = int(time.time() - cached.get("_cached_at", 0))
                if lang not in stats["languages"]:
                    stats["languages"][lang] = {
                        "results": 0,
                        "buckets": 0,
                        "max_age_s": 0,
                    }
                stats["languages"][lang]["results"] += count
                stats["languages"][lang]["buckets"] += 1
                stats["languages"][lang]["max_age_s"] = max(
                    stats["languages"][lang]["max_age_s"], age
                )
        stats["total_results"] += lang_total

    return stats


# ═══════════════════════════════════════════════════════════════════════════════
# Internal
# ═══════════════════════════════════════════════════════════════════════════════


def _snap_to_bucket(offset: int) -> int:
    """Snap an offset to the nearest pre-cached bucket."""
    for bucket in sorted(PRECACHE_OFFSETS, reverse=True):
        if offset >= bucket:
            return bucket
    return 0


async def _fetch_tournesol_recommendations(
    language: str,
    limit: int = PRECACHE_LIMIT,
    offset: int = 0,
) -> Optional[Dict[str, Any]]:
    """Fetch recommendations from Tournesol API."""
    params: Dict[str, Any] = {
        "limit": limit,
        "offset": offset,
        "unsafe": "false",
    }
    if language:
        params["language"] = language

    try:
        async with httpx.AsyncClient(timeout=TOURNESOL_TIMEOUT) as client:
            response = await client.get(
                TOURNESOL_API_URL,
                params=params,
                headers={
                    "Accept": "application/json",
                    "User-Agent": TOURNESOL_USER_AGENT,
                },
            )

            if response.status_code != 200:
                logger.warning(
                    "[TRENDING_CACHE] Tournesol API error: %d",
                    response.status_code,
                )
                return None

            return response.json()

    except httpx.TimeoutException:
        logger.warning("[TRENDING_CACHE] Tournesol API timeout")
        return None
    except Exception as e:
        logger.error("[TRENDING_CACHE] Tournesol API error: %s", e)
        return None
