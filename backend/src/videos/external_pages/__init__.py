"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📚 external_pages — Extraction des pages externes citées dans une vidéo          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pipeline 3 étapes :                                                               ║
║    1. extraction d'URLs (regex sur description / transcript)                       ║
║    2. nettoyage & filtrage (strip utm_*, blacklist youtube/tiktok, self-channel)   ║
║    3. résolution HEAD (follow_redirects, drop sur timeout / >5 hops, dedup)        ║
║                                                                                    ║
║  PR 1 (cette PR) : pas de scraping, pas de Mistral, pas de DB.                     ║
║  PR 2 (à venir)  : scraper + summarizer + storage colonne summaries.ext_pages.     ║
║  PR 3 (à venir)  : intégration dans videos/router.py.                              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from .constants import (
    BLACKLIST_HOSTS,
    SHORTENER_HOSTS,
    TRACKING_PARAMS,
    MAX_HOPS,
    TIMEOUTS,
    PLAN_CAPS,
)
from .url_extractor import (
    extract_urls_from_text,
    clean_url,
    is_blacklisted,
    clean_and_filter_urls,
)
from .url_resolver import (
    ResolvedURL,
    resolve_url,
    resolve_urls,
)

__all__ = [
    # constants
    "BLACKLIST_HOSTS",
    "SHORTENER_HOSTS",
    "TRACKING_PARAMS",
    "MAX_HOPS",
    "TIMEOUTS",
    "PLAN_CAPS",
    # extractor
    "extract_urls_from_text",
    "clean_url",
    "is_blacklisted",
    "clean_and_filter_urls",
    # resolver
    "ResolvedURL",
    "resolve_url",
    "resolve_urls",
]
