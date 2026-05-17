"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📚 external_pages — Extraction des pages externes citées dans une vidéo          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pipeline 5 étapes :                                                               ║
║    1. extraction d'URLs (regex sur description / transcript)                       ║
║    2. nettoyage & filtrage (strip utm_*, blacklist youtube/tiktok, self-channel)   ║
║    3. résolution HEAD (follow_redirects, drop sur timeout / >5 hops, dedup)        ║
║    4. scraping HTML (direct → proxy fallback Cloudflare/403) + trafilatura         ║
║    5. résumé Mistral JSON-mode + cache Redis 7j (cross-user)                       ║
║                                                                                    ║
║  PR 1 (mergée) : steps 1-3 — extractor + resolver + constants.                     ║
║  PR 2 (cette PR) : steps 4-5 — scraper + summarizer + orchestrator + storage.      ║
║  PR 3 (à venir)  : intégration dans videos/router.py + UI web.                     ║
║  PR 4 (à venir)  : UI mobile + UI extension.                                       ║
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
from .scraper import (
    ScrapedPage,
    scrape_page,
)
from .summarizer import (
    PageSummary,
    summarize_page,
)
from .orchestrator import (
    extract_external_pages,
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
    # scraper
    "ScrapedPage",
    "scrape_page",
    # summarizer
    "PageSummary",
    "summarize_page",
    # orchestrator
    "extract_external_pages",
]
