"""External-source services for the COMPANION agent's reco fetchers.

These thin wrappers expose `recommend(theme, limit)` and `get_trending(
theme, limit)` async methods consumed by `companion_recos.fetch_*_reco`.

Tournesol → public API at api.tournesol.app/polls/videos/recommendations/
Trending  → in-house DeepSight aggregate (Summary table) via the existing
            trending router helper.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


class TournesolService:
    """Async client for Tournesol's public recommendations endpoint.

    No auth, public read-only API. Timeouts at 5s to keep the COMPANION
    pre-fetch parallel gather within its 2s envelope (we let it occasionally
    miss the wider gather rather than block it).
    """

    BASE_URL = "https://api.tournesol.app/polls/videos/recommendations/"
    TIMEOUT_SECONDS = 5.0

    @staticmethod
    async def recommend(theme: str, limit: int = 5) -> list[dict[str, Any]]:
        """Return up to `limit` Tournesol videos matching the given theme.

        Items are shaped for `companion_recos.fetch_tournesol_reco`:
            {video_id, title, channel, duration, thumbnail}
        Returns [] on any error or empty payload — callers should fall
        through gracefully.
        """
        if not theme:
            return []

        params = {
            "search": theme,
            "limit": min(int(limit), 20),
            "unsafe": "false",
        }
        headers = {
            "Accept": "application/json",
            "User-Agent": "DeepSight/1.0 (companion-agent)",
        }

        try:
            async with httpx.AsyncClient(timeout=TournesolService.TIMEOUT_SECONDS) as client:
                response = await client.get(TournesolService.BASE_URL, params=params, headers=headers)
        except (httpx.TimeoutException, httpx.HTTPError) as exc:
            logger.warning("tournesol companion recommend timeout/error: %s", exc)
            return []

        if response.status_code != 200:
            logger.warning("tournesol companion recommend non-200: %s", response.status_code)
            return []

        try:
            payload = response.json()
        except (ValueError, TypeError) as exc:
            logger.warning("tournesol companion recommend decode failed: %s", exc)
            return []

        results: list[dict[str, Any]] = []
        for item in payload.get("results", []):
            entity = item.get("entity", item)
            uid = entity.get("uid", "")
            video_id = uid.replace("yt:", "") if uid else None
            if not video_id:
                continue
            metadata = entity.get("metadata", {}) or {}
            results.append(
                {
                    "video_id": video_id,
                    "title": metadata.get("name") or entity.get("name") or "Untitled",
                    "channel": (metadata.get("uploader") or entity.get("uploader") or "Unknown"),
                    "duration": metadata.get("duration") or 0,
                    "thumbnail": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
                }
            )

        return results


class TrendingService:
    """Adapter around the in-house trending helper.

    Filters by Summary.category when available — the COMPANION builder
    passes the user's primary theme, which often (but not always) matches
    the category column. Empty result is fine; the orchestrator drops it.
    """

    @staticmethod
    async def get_trending(theme: str, limit: int = 5) -> list[dict[str, Any]]:
        """Return up to `limit` trending DeepSight videos for the given theme.

        Tries category-filtered first, then falls back to no-filter (period 7d).
        """
        from trending.router import _query_trending_from_db

        async def _query(category: Optional[str]) -> list[dict[str, Any]]:
            try:
                resp = await _query_trending_from_db(period="7d", category=category, limit=limit)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "trending companion get_trending failed (category=%s): %s",
                    category,
                    exc,
                )
                return []

            return [
                {
                    "video_id": v.video_id,
                    "title": v.title,
                    "channel": v.channel,
                    "duration": v.duration or 0,
                    "thumbnail": v.thumbnail_url,
                }
                for v in resp.videos
            ]

        # First try with the theme as a category filter
        items = await _query(theme.lower() if theme else None)
        if items:
            return items

        # Fall back to top trending overall (no category filter)
        return await _query(None)
