"""Monitoring de visibilité IA — Phase 3 GEO.

Vérifie si une vidéo/chaîne est citée par les moteurs IA
en simulant des requêtes de recherche sur Brave Search.
"""

import logging
import re
from datetime import datetime, timezone

import httpx

from core.config import get_brave_search_key

log = logging.getLogger("geo")

BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"


async def check_ai_visibility(
    video_title: str,
    video_channel: str,
    video_id: str,
    queries: list[str] | None = None,
) -> dict:
    """Vérifie la visibilité d'une vidéo dans les résultats de recherche.

    Recherche sur Brave Search si la vidéo ou la chaîne apparaît
    dans les résultats pour des requêtes pertinentes.
    """
    brave_key = get_brave_search_key()
    if not brave_key:
        return {
            "status": "unavailable",
            "reason": "Brave Search API key not configured",
            "results": [],
        }

    # Construire des requêtes de vérification
    if not queries:
        # Nettoyer le titre pour en faire une requête
        clean_title = re.sub(r"[^\w\s]", "", video_title).strip()
        words = clean_title.split()[:6]  # 6 premiers mots
        queries = [
            " ".join(words),
            f"{video_channel} {' '.join(words[:3])}",
        ]

    results = []
    youtube_url_pattern = re.compile(rf"youtube\.com/watch\?v={re.escape(video_id)}")
    channel_pattern = re.compile(re.escape(video_channel), re.IGNORECASE)

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": brave_key,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        for query in queries[:3]:  # Max 3 requêtes
            try:
                resp = await client.get(
                    BRAVE_SEARCH_URL,
                    headers=headers,
                    params={"q": query, "count": 10},
                )
                if resp.status_code != 200:
                    log.warning(f"Brave Search error {resp.status_code} for query: {query}")
                    continue

                data = resp.json()
                web_results = data.get("web", {}).get("results", [])

                found_video = False
                found_channel = False
                position = None

                for i, result in enumerate(web_results):
                    url = result.get("url", "")
                    title = result.get("title", "")
                    description = result.get("description", "")

                    if youtube_url_pattern.search(url):
                        found_video = True
                        position = i + 1

                    if channel_pattern.search(title) or channel_pattern.search(description):
                        found_channel = True
                        if position is None:
                            position = i + 1

                results.append(
                    {
                        "query": query,
                        "found_video": found_video,
                        "found_channel": found_channel,
                        "position": position,
                        "total_results": len(web_results),
                    }
                )

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                log.warning(f"Brave Search timeout for query '{query}': {e}")
                results.append(
                    {
                        "query": query,
                        "found_video": False,
                        "found_channel": False,
                        "position": None,
                        "error": str(e),
                    }
                )

    # Score de visibilité agrégé
    visibility_score = 0
    for r in results:
        if r.get("found_video"):
            visibility_score += 40
        if r.get("found_channel"):
            visibility_score += 20
        if r.get("position") and r["position"] <= 3:
            visibility_score += 20
        elif r.get("position") and r["position"] <= 5:
            visibility_score += 10

    visibility_score = min(100, visibility_score // max(len(results), 1))

    return {
        "status": "ok",
        "visibility_score": visibility_score,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "queries_checked": len(results),
        "results": results,
    }
