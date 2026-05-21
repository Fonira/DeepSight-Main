"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📊 DECODO SCRAPING — Telemetry (PG writes + monthly budget check)                 ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  RÔLE                                                                              ║
║  • record_decodo_call(...) : INSERT 1 row dans `decodo_scraping_usage` après       ║
║    chaque appel (fire-and-forget — toute exception est avalée à debug-level).      ║
║  • get_monthly_request_count() : COUNT(*) du mois en cours (utilisé par le         ║
║    hard-stop budget mensuel via `DECODO_SCRAPING_MAX_MONTHLY_REQ`).                ║
║  • cost_estimate_usd(...) : matrice proxy_pool × headless → coût/req en USD.       ║
║                                                                                    ║
║  Pattern miroir de `middleware/proxy_telemetry.py` (PR #466 Residential), mais     ║
║  table dédiée (grain = 1 row par call, pas aggregat journalier) car le volume      ║
║  attendu permet la granularité et on veut tracker URL / status / latence.          ║
║                                                                                    ║
║  Cache TTL 60s sur le count mensuel pour éviter de hammer la DB sur chaque         ║
║  call site.                                                                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime
from typing import Literal, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import logger


# ═══════════════════════════════════════════════════════════════════════════════
# 💰 COST MATRIX — Decodo Web Scraping API tier $49/mois
# ═══════════════════════════════════════════════════════════════════════════════
#
# Source : spec `2026-05-21-decodo-scraping-phase1-quick-wins.md` § 0
# +       fiche tarifaire Decodo (souscrit 2026-05-21).
#
#   pool / js     |  False (no JS)  |  True (JS render)
#   --------------+-----------------+-------------------
#   standard      |  $0.50 / 1K     |  $0.65 / 1K
#   premium       |  $0.90 / 1K     |  $1.25 / 1K
#
# Premium+JS = la combinaison la plus utilisée (Cloudflare bypass + Markdown
# AI-optimized). Tier $49 cap = 39 200 req/mois.
# ═══════════════════════════════════════════════════════════════════════════════

_COST_PER_REQ_USD: dict[tuple[str, bool], float] = {
    ("standard", False): 0.00050,
    ("standard", True): 0.00065,
    ("premium", False): 0.00090,
    ("premium", True): 0.00125,
}


def cost_estimate_usd(*, proxy_pool: str, headless: bool) -> float:
    """Coût estimé d'un appel Decodo Scraping en USD.

    Args:
        proxy_pool: "standard" ou "premium".
        headless: True si JS render activé (paye le surcoût JS), False sinon.

    Returns:
        Coût en USD par appel. Retourne 0.0 si la combinaison n'est pas connue
        (fail-open — on log une telemetry incomplete plutôt que crasher le call).
    """
    key = (proxy_pool, bool(headless))
    cost = _COST_PER_REQ_USD.get(key)
    if cost is None:
        logger.warning(f"[DECODO_TELEMETRY] unknown cost combo: pool={proxy_pool} headless={headless} — fallback 0")
        return 0.0
    return cost


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ MONTHLY COUNT CACHE — TTL 60s
# ═══════════════════════════════════════════════════════════════════════════════


class _CountState:
    """Per-process cache for the monthly request count."""

    def __init__(self) -> None:
        # (count, monotonic_ts_set)
        self.cache: Optional[tuple[int, float]] = None


_state = _CountState()
_CACHE_TTL_SECONDS = 60.0


def _reset_state_for_tests() -> None:
    """Reset the in-memory cache (helper test-only)."""
    global _state
    _state = _CountState()


def _invalidate_cache() -> None:
    """Invalidate the monthly count cache so the next call hits the DB."""
    _state.cache = None


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 MONTHLY COUNT — Hard-stop budget query
# ═══════════════════════════════════════════════════════════════════════════════


async def _fetch_monthly_count(session: AsyncSession) -> int:
    """Count rows in `decodo_scraping_usage` for the current month."""
    today = date.today()
    first_of_month = today.replace(day=1)

    result = await session.execute(
        text("SELECT COUNT(*) FROM decodo_scraping_usage WHERE created_at >= :first_of_month"),
        {"first_of_month": datetime(first_of_month.year, first_of_month.month, 1)},
    )
    return int(result.scalar() or 0)


async def get_monthly_request_count(
    session: Optional[AsyncSession] = None,
) -> int:
    """Return the count of Decodo Scraping requests for the current month.

    Uses a 60s in-memory cache to avoid hitting the DB on every wrapper call.
    Fails open (returns 0) if the DB is not reachable — never blocks the path.

    Args:
        session: optional AsyncSession. If provided and cache is stale, refresh
            the cache via this session. Otherwise open an ad-hoc session.
    """
    loop = asyncio.get_event_loop()
    now = loop.time()

    if _state.cache is not None:
        cached_count, cached_at = _state.cache
        if (now - cached_at) < _CACHE_TTL_SECONDS:
            return cached_count

    if session is None:
        try:
            from db.database import async_session_maker

            async with async_session_maker() as ad_hoc:
                total = await _fetch_monthly_count(ad_hoc)
        except Exception as e:
            logger.debug(f"[DECODO_TELEMETRY] get_monthly_request_count failed (ad-hoc): {e}")
            return 0
    else:
        try:
            total = await _fetch_monthly_count(session)
        except Exception as e:
            logger.debug(f"[DECODO_TELEMETRY] get_monthly_request_count failed: {e}")
            return 0

    _state.cache = (total, now)
    return total


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 INSERT — record_decodo_call
# ═══════════════════════════════════════════════════════════════════════════════


async def record_decodo_call(
    *,
    url: str,
    proxy_pool: Literal["standard", "premium"],
    headless: bool,
    output_format: Literal["raw_html", "markdown"],
    target_status_code: Optional[int],
    decodo_http_status: Optional[int],
    cost_estimate_usd_value: float,
    duration_s: float,
    error: Optional[str] = None,
    session: Optional[AsyncSession] = None,
) -> None:
    """Insert one row into `decodo_scraping_usage` describing a call.

    Best-effort : any exception is logged at debug-level and swallowed.
    The wrapper MUST NOT block its return value on telemetry success.

    Args:
        url: target URL we asked Decodo to scrape.
        proxy_pool: "standard" or "premium".
        headless: True if JS render was requested.
        output_format: "raw_html" or "markdown".
        target_status_code: HTTP status of the target site (200/404/etc), or
            None if the Decodo call failed before reaching the target.
        decodo_http_status: HTTP status from Decodo itself.
        cost_estimate_usd_value: precomputed cost via `cost_estimate_usd()`.
        duration_s: wall-clock time of the call in seconds.
        error: short error message if the call failed (None on success).
        session: optional AsyncSession.
    """
    try:
        if session is None:
            from db.database import async_session_maker

            async with async_session_maker() as ad_hoc:
                await _insert_row(
                    ad_hoc,
                    url=url,
                    proxy_pool=proxy_pool,
                    headless=headless,
                    output_format=output_format,
                    target_status_code=target_status_code,
                    decodo_http_status=decodo_http_status,
                    cost_estimate_usd_value=cost_estimate_usd_value,
                    duration_s=duration_s,
                    error=error,
                )
        else:
            await _insert_row(
                session,
                url=url,
                proxy_pool=proxy_pool,
                headless=headless,
                output_format=output_format,
                target_status_code=target_status_code,
                decodo_http_status=decodo_http_status,
                cost_estimate_usd_value=cost_estimate_usd_value,
                duration_s=duration_s,
                error=error,
            )
    except Exception as e:
        logger.debug(f"[DECODO_TELEMETRY] record_decodo_call INSERT failed: {e}")
        return

    # On successful insert, bump the cached count so the budget hard-stop
    # reacts without waiting for the 60s TTL to flush.
    if _state.cache is not None:
        count, ts = _state.cache
        _state.cache = (count + 1, ts)


async def _insert_row(
    session: AsyncSession,
    *,
    url: str,
    proxy_pool: str,
    headless: bool,
    output_format: str,
    target_status_code: Optional[int],
    decodo_http_status: Optional[int],
    cost_estimate_usd_value: float,
    duration_s: float,
    error: Optional[str],
) -> None:
    """Low-level INSERT helper. Commits before returning."""
    await session.execute(
        text(
            """
            INSERT INTO decodo_scraping_usage
                (url, proxy_pool, headless, output_format,
                 target_status_code, decodo_http_status,
                 cost_estimate_usd, duration_s, error)
            VALUES
                (:url, :proxy_pool, :headless, :output_format,
                 :target_status_code, :decodo_http_status,
                 :cost_estimate_usd, :duration_s, :error)
            """
        ),
        {
            "url": url[:2000],  # trim absurdly long URLs to avoid index bloat
            "proxy_pool": proxy_pool,
            "headless": bool(headless),
            "output_format": output_format,
            "target_status_code": target_status_code,
            "decodo_http_status": decodo_http_status,
            "cost_estimate_usd": cost_estimate_usd_value,
            "duration_s": duration_s,
            "error": (error[:2000] if error else None),
        },
    )
    await session.commit()
