"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🕸️ DECODO SCRAPING — Async wrapper for the Web Scraping API                       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  ENDPOINT                                                                          ║
║      POST https://scraper-api.decodo.com/v2/scrape                                 ║
║      Auth : Basic <base64(user:pass)> via header                                   ║
║                                                                                    ║
║  USAGE                                                                             ║
║      from decodo import DecodoScrapingClient                                       ║
║                                                                                    ║
║      client = DecodoScrapingClient()                                               ║
║      result = await client.scrape(                                                 ║
║          "https://scholar.google.com/scholar?q=transformers",                      ║
║          proxy_pool="premium",                                                     ║
║          headless=True,                                                            ║
║          output_format="markdown",                                                 ║
║      )                                                                             ║
║      print(result.content)         # HTML or markdown body                         ║
║      print(result.cost_estimate_usd)  # 0.00125 for premium+JS                     ║
║                                                                                    ║
║  GUARDS                                                                            ║
║  • DECODO_SCRAPING_DISABLED=true → DecodoDisabledError (kill-switch, no HTTP).     ║
║  • Monthly count >= DECODO_SCRAPING_MAX_MONTHLY_REQ (default 31360, 80% of         ║
║    Premium+JS 39 200/mo cap) → DecodoBudgetExceededError.                          ║
║  • Missing API key → DecodoConfigError at first call.                              ║
║                                                                                    ║
║  RETRY                                                                             ║
║  • 3 attempts with exponential backoff (0.5s → 1s → 2s).                           ║
║  • Retry only on 5xx, connection errors, and httpx.TimeoutException.               ║
║  • 4xx (including 401/403) bubble up immediately (no point retrying).              ║
║                                                                                    ║
║  TELEMETRY                                                                         ║
║  • Each call writes one row to `decodo_scraping_usage` (fire-and-forget,           ║
║    never blocks the return). Failure cases also recorded (status NULL +            ║
║    error text).                                                                    ║
║                                                                                    ║
║  TODO PHASE 1.2                                                                    ║
║  • The exact param name for Markdown output mode is NOT confirmed by Decodo       ║
║    public docs at time of writing. Current best guess: `"output_format":          ║
║    "markdown"` in the JSON body. To validate via the cURL playground before        ║
║    Phase 1 (Scholar feature) ships. If the param name turns out to be different   ║
║    (e.g. header `X-Output-Format`, `output` field, `markdown: true`), patch        ║
║    `_build_payload` accordingly. The wrapper still works for raw_html in the      ║
║    meantime.                                                                       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, Literal, Optional

import httpx
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import logger
from decodo.errors import (
    DecodoBudgetExceededError,
    DecodoConfigError,
    DecodoDisabledError,
    DecodoRequestError,
    DecodoResponseError,
    DecodoTimeoutError,
)
from decodo.telemetry import (
    cost_estimate_usd,
    get_monthly_request_count,
    record_decodo_call,
)


DECODO_SCRAPING_ENDPOINT = "https://scraper-api.decodo.com/v2/scrape"

# Default request timeout. JS rendering can be slow; 30s is the spec's default
# but specific call sites can override (e.g. 45s for YouTube watch pages).
DEFAULT_TIMEOUT_S = 30.0

# Retry policy.
MAX_ATTEMPTS = 3
BASE_BACKOFF_S = 0.5  # first retry waits 0.5s, then 1.0s, then 2.0s


ProxyPool = Literal["standard", "premium"]
OutputFormat = Literal["raw_html", "markdown"]


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 RESULT MODEL
# ═══════════════════════════════════════════════════════════════════════════════


class ScrapeResult(BaseModel):
    """One Decodo Web Scraping API result.

    Mirrors the shape of `response["results"][0]` plus metadata about the
    call itself (cost, duration, pool, format) for caller-side analytics.
    """

    status_code: int = Field(
        ...,
        description="HTTP status of the TARGET site (200 = page rendered, 404, etc.)",
    )
    content: str = Field(..., description="Scraped body (HTML or markdown)")
    headers: Dict[str, str] = Field(
        default_factory=dict,
        description="Response headers from the target site (lowercased keys)",
    )
    cost_estimate_usd: float = Field(
        ...,
        description="Cost of this call in USD (from cost_estimate_usd matrix)",
    )
    duration_s: float = Field(
        ...,
        description="Wall-clock time of the Decodo call in seconds",
    )
    proxy_pool: str = Field(..., description='Pool used: "standard" or "premium"')
    output_format: str = Field(..., description='Output mode: "raw_html" or "markdown"')


# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 CLIENT
# ═══════════════════════════════════════════════════════════════════════════════


class DecodoScrapingClient:
    """Async wrapper around the Decodo Web Scraping API.

    Construction reads `DECODO_SCRAPING_API_KEY` from settings by default, but
    accepts overrides for testing and multi-tenant scenarios.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        endpoint: str = DECODO_SCRAPING_ENDPOINT,
        db_session: Optional[AsyncSession] = None,
    ) -> None:
        """Initialize the client.

        Args:
            api_key: Full `Basic <base64>` header value. If None, reads from
                `settings.DECODO_SCRAPING_API_KEY`. If still empty, calls will
                raise DecodoConfigError.
            endpoint: Override the Decodo endpoint (for testing).
            db_session: Optional shared AsyncSession for telemetry writes. If
                None, telemetry opens its own ad-hoc session.
        """
        if api_key is None:
            # Env first (allows test overrides + runtime changes); config constant
            # fallback (cached at import time — project pattern, no `settings` object).
            import os

            api_key = os.environ.get("DECODO_SCRAPING_API_KEY", "") or ""
            if not api_key:
                try:
                    from core.config import DECODO_SCRAPING_API_KEY as _key

                    api_key = _key or ""
                except ImportError:
                    pass
        # Normalize: accept "Basic <b64>" or raw "<b64>".
        if api_key and not api_key.lower().startswith("basic "):
            api_key = f"Basic {api_key}"
        self._api_key = api_key.strip()
        self._endpoint = endpoint
        self._db_session = db_session

    # ── Public API ──────────────────────────────────────────────────────────

    async def scrape(
        self,
        url: str,
        *,
        proxy_pool: ProxyPool = "premium",
        headless: bool = True,
        device_type: str = "desktop_chrome",
        output_format: OutputFormat = "raw_html",
        timeout_s: float = DEFAULT_TIMEOUT_S,
    ) -> ScrapeResult:
        """Scrape a URL through the Decodo Web Scraping API.

        Args:
            url: target URL to scrape.
            proxy_pool: "standard" (cheap, no Cloudflare bypass) or "premium"
                (Premium pool, recommended for Cloudflare/CAPTCHA/anti-bot).
            headless: True to render JS via headless browser (paid surcharge),
                False to fetch raw HTML.
            device_type: "desktop_chrome", "mobile_chrome", etc. Forwarded to
                Decodo as-is.
            output_format: "raw_html" returns the page HTML. "markdown" asks
                Decodo to return an AI-optimized markdown version.
            timeout_s: per-attempt httpx timeout. The total wall-clock can be
                up to 3 × timeout_s + 3s of backoff.

        Returns:
            ScrapeResult with the scraped content + cost + duration.

        Raises:
            DecodoDisabledError: env kill-switch is on.
            DecodoBudgetExceededError: monthly cap reached.
            DecodoConfigError: API key missing.
            DecodoRequestError: HTTP non-200 after all retries.
            DecodoTimeoutError: timed out after all retries.
            DecodoResponseError: 200 but body cannot be parsed.
        """
        # ── 1. Hard kill-switch ─────────────────────────────────────────────
        if _is_disabled_env():
            raise DecodoDisabledError("DECODO_SCRAPING_DISABLED=true — kill switch active")

        # ── 2. Monthly budget guard ────────────────────────────────────────
        max_monthly = _max_monthly_req()
        if max_monthly > 0:
            current = await get_monthly_request_count(self._db_session)
            if current >= max_monthly:
                raise DecodoBudgetExceededError(current_count=current, max_count=max_monthly)

        # ── 3. Config check ────────────────────────────────────────────────
        if not self._api_key:
            raise DecodoConfigError("DECODO_SCRAPING_API_KEY missing from settings/env")

        # ── 4. Build payload + headers ─────────────────────────────────────
        payload = self._build_payload(
            url=url,
            proxy_pool=proxy_pool,
            headless=headless,
            device_type=device_type,
            output_format=output_format,
        )
        headers = {
            "Authorization": self._api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        cost = cost_estimate_usd(proxy_pool=proxy_pool, headless=headless)

        # ── 5. Send with retry policy ──────────────────────────────────────
        last_exc: Optional[Exception] = None
        decodo_status: Optional[int] = None
        t0 = time.monotonic()

        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout_s) as client:
                    resp = await client.post(self._endpoint, json=payload, headers=headers)
                decodo_status = resp.status_code

                if 500 <= resp.status_code < 600:
                    # Retryable 5xx
                    last_exc = DecodoRequestError(resp.status_code, resp.text or "")
                    logger.warning(
                        f"[DECODO_SCRAPE] attempt {attempt}/{MAX_ATTEMPTS} 5xx {resp.status_code} for {url[:80]}"
                    )
                    await self._maybe_backoff(attempt)
                    continue

                if resp.status_code != 200:
                    # 4xx — don't retry, surface immediately.
                    duration = time.monotonic() - t0
                    await self._record(
                        url=url,
                        proxy_pool=proxy_pool,
                        headless=headless,
                        output_format=output_format,
                        target_status_code=None,
                        decodo_http_status=resp.status_code,
                        cost=cost,
                        duration=duration,
                        error=f"HTTP {resp.status_code}: {(resp.text or '')[:200]}",
                    )
                    raise DecodoRequestError(resp.status_code, resp.text or "")

                # 200 OK — parse body.
                try:
                    body = resp.json()
                except Exception as e:
                    duration = time.monotonic() - t0
                    err = f"non-JSON body: {e}"
                    await self._record(
                        url=url,
                        proxy_pool=proxy_pool,
                        headless=headless,
                        output_format=output_format,
                        target_status_code=None,
                        decodo_http_status=200,
                        cost=cost,
                        duration=duration,
                        error=err,
                    )
                    raise DecodoResponseError(err)

                result = self._extract_result(
                    body=body,
                    proxy_pool=proxy_pool,
                    output_format=output_format,
                    cost=cost,
                    duration=time.monotonic() - t0,
                )

                # Telemetry — success.
                await self._record(
                    url=url,
                    proxy_pool=proxy_pool,
                    headless=headless,
                    output_format=output_format,
                    target_status_code=result.status_code,
                    decodo_http_status=200,
                    cost=cost,
                    duration=result.duration_s,
                    error=None,
                )
                return result

            except httpx.TimeoutException as e:
                last_exc = DecodoTimeoutError(f"timeout after {timeout_s}s: {e}")
                logger.warning(f"[DECODO_SCRAPE] attempt {attempt}/{MAX_ATTEMPTS} timeout for {url[:80]}")
                await self._maybe_backoff(attempt)
                continue
            except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError) as e:
                last_exc = DecodoRequestError(0, f"connection error: {e}")
                logger.warning(f"[DECODO_SCRAPE] attempt {attempt}/{MAX_ATTEMPTS} connection error: {e}")
                await self._maybe_backoff(attempt)
                continue
            except (DecodoRequestError, DecodoResponseError):
                # Already recorded above (4xx / non-JSON); bubble up.
                raise

        # All retries exhausted.
        duration = time.monotonic() - t0
        err_msg = str(last_exc) if last_exc else "all retries exhausted"
        await self._record(
            url=url,
            proxy_pool=proxy_pool,
            headless=headless,
            output_format=output_format,
            target_status_code=None,
            decodo_http_status=decodo_status,
            cost=cost,
            duration=duration,
            error=err_msg,
        )
        if last_exc:
            raise last_exc
        raise DecodoRequestError(0, "all retries exhausted with no captured exception")

    # ── Internal helpers ────────────────────────────────────────────────────

    @staticmethod
    def _build_payload(
        *,
        url: str,
        proxy_pool: str,
        headless: bool,
        device_type: str,
        output_format: str,
    ) -> Dict[str, Any]:
        """Build the JSON body for POST /v2/scrape.

        TODO Phase 1.2: the exact param name for Markdown output isn't 100%
        confirmed by Decodo docs. We send both `output_format` (best guess)
        and pass through downstream call sites for now. If the upstream
        contract clarifies (header / different field), update here only.
        """
        payload: Dict[str, Any] = {
            "url": url,
            "proxy_pool": proxy_pool,
            "device_type": device_type,
        }
        # `headless: "html"` triggers Decodo's headless browser. Setting it
        # to empty string or omitting it = raw fetch (no JS).
        if headless:
            payload["headless"] = "html"

        if output_format == "markdown":
            # Best-effort. TODO: validate via Decodo playground (spec § 9 Q1).
            payload["output_format"] = "markdown"
        # raw_html is the default Decodo behavior — no extra param needed.

        return payload

    @staticmethod
    def _extract_result(
        *,
        body: Dict[str, Any],
        proxy_pool: str,
        output_format: str,
        cost: float,
        duration: float,
    ) -> ScrapeResult:
        """Parse the Decodo response envelope and build a ScrapeResult.

        Expected shape (verified at smoke test J0 on Scholar/TikTok/YouTube):

            {
                "results": [
                    {
                        "status_code": 200,
                        "content": "<html>...",
                        "headers": {"content-type": "text/html; ..."}
                    }
                ]
            }
        """
        results = body.get("results")
        if not isinstance(results, list) or len(results) == 0:
            raise DecodoResponseError(f"response missing 'results' array (keys={list(body.keys())[:5]})")
        first = results[0]
        if not isinstance(first, dict):
            raise DecodoResponseError(f"results[0] is not a dict (got {type(first).__name__})")

        status = first.get("status_code")
        content = first.get("content")
        if status is None or content is None:
            raise DecodoResponseError(f"results[0] missing status_code/content (keys={list(first.keys())})")

        raw_headers = first.get("headers") or {}
        # Lowercase header keys for predictability across HTTP/2 vs HTTP/1.
        headers = {str(k).lower(): str(v) for k, v in (raw_headers.items() if isinstance(raw_headers, dict) else [])}

        return ScrapeResult(
            status_code=int(status),
            content=str(content),
            headers=headers,
            cost_estimate_usd=cost,
            duration_s=round(duration, 3),
            proxy_pool=proxy_pool,
            output_format=output_format,
        )

    @staticmethod
    async def _maybe_backoff(attempt: int) -> None:
        """Sleep with exponential backoff between retries.

        Skip the sleep after the LAST attempt — there's no point sleeping
        before raising.
        """
        if attempt >= MAX_ATTEMPTS:
            return
        delay = BASE_BACKOFF_S * (2 ** (attempt - 1))
        await asyncio.sleep(delay)

    async def _record(
        self,
        *,
        url: str,
        proxy_pool: str,
        headless: bool,
        output_format: str,
        target_status_code: Optional[int],
        decodo_http_status: Optional[int],
        cost: float,
        duration: float,
        error: Optional[str],
    ) -> None:
        """Wrapper around record_decodo_call that never raises."""
        try:
            await record_decodo_call(
                url=url,
                proxy_pool=proxy_pool,
                headless=headless,
                output_format=output_format,
                target_status_code=target_status_code,
                decodo_http_status=decodo_http_status,
                cost_estimate_usd_value=cost,
                duration_s=duration,
                error=error,
                session=self._db_session,
            )
        except Exception as e:
            logger.debug(f"[DECODO_SCRAPE] telemetry write failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 ENV READERS — settings-aware with raw env fallback
# ═══════════════════════════════════════════════════════════════════════════════


def _is_disabled_env() -> bool:
    """Read DECODO_SCRAPING_DISABLED — env first (runtime override), config fallback."""
    import os

    raw = os.environ.get("DECODO_SCRAPING_DISABLED", "").strip()
    if raw:
        return _truthy(raw)
    try:
        from core.config import DECODO_SCRAPING_DISABLED as _val

        return _truthy(_val) if _val is not None else False
    except ImportError:
        return False


def _max_monthly_req() -> int:
    """Read DECODO_SCRAPING_MAX_MONTHLY_REQ — settings first, raw env fallback.

    Returns 0 if not set (= no monthly cap enforced).
    Default in `core/config.py` is 31360 (80% of Premium+JS 39 200/mo).
    """
    import os

    raw = os.environ.get("DECODO_SCRAPING_MAX_MONTHLY_REQ", "").strip()
    if raw:
        try:
            return int(raw)
        except ValueError:
            pass
    try:
        from core.config import DECODO_SCRAPING_MAX_MONTHLY_REQ as _val

        if _val is not None:
            try:
                return int(_val)
            except (TypeError, ValueError):
                pass
    except ImportError:
        pass
    raw = ""  # ensure fallthrough returns 0
    try:
        return int(raw) if raw else 0
    except ValueError:
        return 0


def _truthy(val: Any) -> bool:
    """Coerce a settings/env value to bool."""
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    return s in ("true", "1", "yes", "on")
