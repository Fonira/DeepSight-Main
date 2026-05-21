"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🚫 DECODO SCRAPING — Custom exceptions                                            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Hierarchy :                                                                       ║
║                                                                                    ║
║      DecodoScrapingError              (base)                                       ║
║      ├── DecodoDisabledError          (hard kill-switch via env)                   ║
║      ├── DecodoBudgetExceededError    (monthly cap reached)                        ║
║      ├── DecodoConfigError            (missing API key, bad pool, etc.)            ║
║      ├── DecodoRequestError           (HTTP error from Decodo or target)           ║
║      ├── DecodoTimeoutError           (httpx timeout)                              ║
║      └── DecodoResponseError          (Decodo returned 200 but unexpected shape)   ║
║                                                                                    ║
║  Callers catch the base class for "any decodo failure" and let the specific ones   ║
║  fan out into telemetry / fallback logic.                                          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations


class DecodoScrapingError(Exception):
    """Base exception for all Decodo Web Scraping API errors."""


class DecodoDisabledError(DecodoScrapingError):
    """Raised when `DECODO_SCRAPING_DISABLED=true` (env kill-switch).

    The wrapper short-circuits before making any HTTP call. Callers should
    typically fall back to their non-decodo path (or fail soft).
    """


class DecodoBudgetExceededError(DecodoScrapingError):
    """Raised when the monthly request budget has been exceeded.

    Triggered when the count of rows in `decodo_scraping_usage` for the
    current month >= `DECODO_SCRAPING_MAX_MONTHLY_REQ` (default 31360 =
    80% of the Premium+JS tier 39 200/mo cap).
    """

    def __init__(self, current_count: int, max_count: int) -> None:
        self.current_count = current_count
        self.max_count = max_count
        super().__init__(f"Decodo Scraping monthly budget exceeded: {current_count} >= {max_count}")


class DecodoConfigError(DecodoScrapingError):
    """Raised when the wrapper is misconfigured (missing API key, etc.)."""


class DecodoRequestError(DecodoScrapingError):
    """Raised when Decodo returns a non-200 HTTP status (after all retries)."""

    def __init__(self, status_code: int, body: str = "") -> None:
        self.status_code = status_code
        self.body = body
        super().__init__(f"Decodo Scraping API HTTP {status_code}: {body[:200]}")


class DecodoTimeoutError(DecodoScrapingError):
    """Raised when the Decodo call times out (after all retries)."""


class DecodoResponseError(DecodoScrapingError):
    """Raised when Decodo returns 200 but the body cannot be parsed.

    Examples : missing `results` key, empty `results` array, missing `content`
    field in the first result. Indicates a contract drift from Decodo.
    """
