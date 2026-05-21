"""
Decodo Web Scraping API wrapper — Phase 0.

Distinct from the Residential Proxy (gate.decodo.com:7000, env `YOUTUBE_PROXY`,
instrumented by `middleware/proxy_telemetry.py` / PR #466). This package wraps
the Web Scraping API tier ($49/mo, endpoint scraper-api.decodo.com/v2/scrape).

Public surface:
    DecodoScrapingClient — async client with retry + telemetry + budget guard
    ScrapeResult         — pydantic model of a scrape outcome
    Errors               — DecodoScrapingError + subclasses

Specs:
    01-Projects/DeepSight/Ideas/2026-05-21-decodo-scraping-phase1-quick-wins.md
    01-Projects/DeepSight/Ideas/2026-05-21-decodo-scraping-phase3-new-features.md
"""

from decodo.errors import (
    DecodoBudgetExceededError,
    DecodoConfigError,
    DecodoDisabledError,
    DecodoRequestError,
    DecodoResponseError,
    DecodoScrapingError,
    DecodoTimeoutError,
)
from decodo.scraping_client import (
    DECODO_SCRAPING_ENDPOINT,
    DEFAULT_TIMEOUT_S,
    DecodoScrapingClient,
    ScrapeResult,
)
from decodo.telemetry import (
    cost_estimate_usd,
    get_monthly_request_count,
    record_decodo_call,
)

__all__ = [
    # Client
    "DecodoScrapingClient",
    "ScrapeResult",
    "DECODO_SCRAPING_ENDPOINT",
    "DEFAULT_TIMEOUT_S",
    # Errors
    "DecodoScrapingError",
    "DecodoDisabledError",
    "DecodoBudgetExceededError",
    "DecodoConfigError",
    "DecodoRequestError",
    "DecodoTimeoutError",
    "DecodoResponseError",
    # Telemetry helpers
    "cost_estimate_usd",
    "get_monthly_request_count",
    "record_decodo_call",
]
