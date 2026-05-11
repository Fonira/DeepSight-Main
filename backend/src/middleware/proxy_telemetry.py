"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📡 PROXY TELEMETRY — Sprint E observability                                      ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Mesure la consommation du proxy Decodo (et tout autre provider proxifié) :       ║
║                                                                                    ║
║    • bytes_in  : payload téléchargé via le proxy (Content-Length response header) ║
║    • bytes_out : payload uploadé via le proxy (Content-Length request body)       ║
║    • requests_total : total requests routées via proxy                            ║
║    • requests_by_provider : ventilation par variant (default/sticky/geo_us/...)   ║
║                                                                                    ║
║  Pas un BaseHTTPMiddleware FastAPI : la consommation proxy se fait surtout dans    ║
║  des workers background (yt-dlp, httpx pour TikTok, etc.), pas dans le request    ║
║  cycle HTTP. Le module expose des helpers à appeler depuis chaque code path qui   ║
║  passe par le proxy :                                                             ║
║                                                                                    ║
║    record_yt_dlp_call(provider_variant, bytes_in=...)                             ║
║    record_httpx_response(provider_variant, response)                              ║
║                                                                                    ║
║  Best-effort : tout fail (DB down, JSON parse error, Content-Length absent) est   ║
║  swallowed. La télémétrie ne doit JAMAIS faire échouer un download.               ║
║                                                                                    ║
║  Persistance : daily upsert sur `proxy_usage_daily` via async_session_factory.    ║
║  Coalescing in-process via un dict + lock : on flush au plus toutes les 5s ou     ║
║  tous les 50 events (whichever first) pour éviter de marteler la DB.              ║
║                                                                                    ║
║  PostHog : best-effort fire-and-forget toutes les 100 MB cumulées dans la         ║
║  journée. Si network fail, swallow.                                               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from datetime import date, datetime
from typing import Any, Dict, Optional

import httpx

from core.config import PROXY_DISABLED, get_youtube_proxy

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

# Pricing reference — Decodo Pay-As-You-Go.
DECODO_COST_PER_GB_USD: float = 4.0

# PostHog event throttle — fire 1 event per 100 MB cumulative bandwidth today.
_POSTHOG_BANDWIDTH_STEP_BYTES: int = 100 * 1024 * 1024

# Coalescing thresholds (avoid hammering DB on every yt-dlp call).
_FLUSH_INTERVAL_SECONDS: float = 5.0
_FLUSH_THRESHOLD_EVENTS: int = 50


# ═══════════════════════════════════════════════════════════════════════════════
# 🧮 IN-PROCESS ACCUMULATOR (coalescing)
# ═══════════════════════════════════════════════════════════════════════════════


class _ProxyTelemetryAccumulator:
    """Per-process coalescing accumulator. Flushes async to DB.

    Threadsafe via asyncio.Lock — we never call from non-async paths (yt-dlp
    runs in an executor mais le record_yt_dlp_call wrapper est await-compatible).
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._pending: Dict[str, Any] = self._fresh_pending()
        self._last_flush_at: float = 0.0
        # Per-day bandwidth threshold tracking for PostHog throttle.
        # Map { iso_date: last_threshold_fired_in_bytes }.
        self._posthog_thresholds: Dict[str, int] = {}

    @staticmethod
    def _fresh_pending() -> Dict[str, Any]:
        return {
            "bytes_in": 0,
            "bytes_out": 0,
            "requests_total": 0,
            "requests_by_provider": {},  # { variant: {"requests": int, "bytes_in": int} }
            "events_buffered": 0,
        }

    async def record(
        self,
        provider_variant: str,
        bytes_in: int = 0,
        bytes_out: int = 0,
    ) -> None:
        """Stage one proxy event. May trigger a flush if thresholds reached."""
        async with self._lock:
            p = self._pending
            p["bytes_in"] += max(0, int(bytes_in))
            p["bytes_out"] += max(0, int(bytes_out))
            p["requests_total"] += 1
            p["events_buffered"] += 1

            variant_bucket = p["requests_by_provider"].setdefault(
                provider_variant, {"requests": 0, "bytes_in": 0}
            )
            variant_bucket["requests"] += 1
            variant_bucket["bytes_in"] += max(0, int(bytes_in))

            should_flush = (
                p["events_buffered"] >= _FLUSH_THRESHOLD_EVENTS
                or (asyncio.get_event_loop().time() - self._last_flush_at) >= _FLUSH_INTERVAL_SECONDS
            )

        if should_flush:
            await self.flush()

    async def flush(self) -> None:
        """Persist the in-process buffer to proxy_usage_daily (UPSERT today)."""
        async with self._lock:
            if self._pending["events_buffered"] == 0:
                return
            snapshot = self._pending
            self._pending = self._fresh_pending()
            self._last_flush_at = asyncio.get_event_loop().time()

        await self._persist_snapshot(snapshot)

    async def _persist_snapshot(self, snapshot: Dict[str, Any]) -> None:
        """Upsert today's row in proxy_usage_daily. Best-effort (swallow errors)."""
        try:
            # Lazy import to avoid circular dep at module load.
            from db.database import ProxyUsageDaily, async_session_factory
            from sqlalchemy import select

            today = date.today()
            async with async_session_factory() as session:
                result = await session.execute(
                    select(ProxyUsageDaily).where(ProxyUsageDaily.date == today)
                )
                row = result.scalar_one_or_none()

                if row is None:
                    row = ProxyUsageDaily(
                        date=today,
                        bytes_in=snapshot["bytes_in"],
                        bytes_out=snapshot["bytes_out"],
                        requests_total=snapshot["requests_total"],
                        requests_by_provider=snapshot["requests_by_provider"],
                    )
                    session.add(row)
                else:
                    row.bytes_in = (row.bytes_in or 0) + snapshot["bytes_in"]
                    row.bytes_out = (row.bytes_out or 0) + snapshot["bytes_out"]
                    row.requests_total = (row.requests_total or 0) + snapshot["requests_total"]

                    # Merge requests_by_provider (existing JSON dict + snapshot delta).
                    merged = dict(row.requests_by_provider or {})
                    for variant, delta in snapshot["requests_by_provider"].items():
                        bucket = merged.setdefault(variant, {"requests": 0, "bytes_in": 0})
                        bucket["requests"] = int(bucket.get("requests", 0)) + int(delta.get("requests", 0))
                        bucket["bytes_in"] = int(bucket.get("bytes_in", 0)) + int(delta.get("bytes_in", 0))
                    row.requests_by_provider = merged
                    row.updated_at = datetime.utcnow()

                await session.commit()

                # PostHog event (best-effort, after commit so the daily count is consistent).
                await self._maybe_fire_posthog(row.bytes_in, list(snapshot["requests_by_provider"].keys()))
        except Exception as exc:  # pragma: no cover - best-effort, never block
            logger.warning("proxy_telemetry flush failed (swallowed): %s", exc)

    async def _maybe_fire_posthog(self, total_bytes_today: int, variants: list) -> None:
        """Fire `proxy_bandwidth_used` event every 100 MB cumulative today."""
        today_iso = date.today().isoformat()
        last_fired = self._posthog_thresholds.get(today_iso, 0)

        # How many 100 MB thresholds did we cross since last fire?
        crossed = total_bytes_today // _POSTHOG_BANDWIDTH_STEP_BYTES
        last_crossed = last_fired // _POSTHOG_BANDWIDTH_STEP_BYTES
        if crossed <= last_crossed:
            return

        self._posthog_thresholds[today_iso] = total_bytes_today

        cost_estimate = (total_bytes_today / (1024**3)) * DECODO_COST_PER_GB_USD
        provider_label = ",".join(sorted(variants)) if variants else "unknown"
        with suppress(Exception):
            # core.analytics.track_event is fire-and-forget + best-effort (no-op
            # if POSTHOG_API_KEY is unset). See reference_posthog-deepsight-keys.
            from core.analytics import track_event

            track_event(
                "proxy_bandwidth_used",
                {
                    "bytes_today": total_bytes_today,
                    "provider": provider_label,
                    "estimated_cost_usd": round(cost_estimate, 4),
                },
            )


# Singleton — shared across the worker process.
_accumulator = _ProxyTelemetryAccumulator()


# ═══════════════════════════════════════════════════════════════════════════════
# 🪝 PUBLIC API — Hooks for code that uses the proxy
# ═══════════════════════════════════════════════════════════════════════════════


def is_proxy_enabled() -> bool:
    """True if proxy is configured AND not hard-disabled.

    Used by `_yt_dlp_extra_args` callers and httpx wrappers to decide whether
    to inject the `--proxy` flag / `http_proxy` httpx kwarg.

    PROXY_DISABLED=True force le bypass (graceful degradation : on tente le
    download direct depuis l'IP du backend, ce qui peut échouer mais évite la
    surconsommation du wallet Decodo).
    """
    if PROXY_DISABLED:
        logger.warning(
            "proxy_telemetry: PROXY_DISABLED=true — skipping proxy injection (graceful degradation)"
        )
        return False
    return bool(get_youtube_proxy())


async def record_proxy_request(
    provider_variant: str,
    *,
    bytes_in: int = 0,
    bytes_out: int = 0,
) -> None:
    """Record one proxy-routed request. Async, best-effort.

    Args:
        provider_variant: short variant name aligned with existing setting names
            (`default`, `sticky`, `geo_us`, `legacy`, ...). DO NOT create a new
            Literal — caller passes whatever the current proxy config exposes.
        bytes_in: response Content-Length (or len(body)) if known. 0 ok.
        bytes_out: request body size if known. 0 ok.

    Never raises — failures are logged and swallowed.
    """
    try:
        await _accumulator.record(
            provider_variant=provider_variant or "default",
            bytes_in=bytes_in,
            bytes_out=bytes_out,
        )
    except Exception as exc:  # pragma: no cover - best-effort
        logger.debug("proxy_telemetry record failed (swallowed): %s", exc)


def record_proxy_request_sync(
    provider_variant: str,
    *,
    bytes_in: int = 0,
    bytes_out: int = 0,
) -> None:
    """Synchronous wrapper — schedule the async record on the running loop.

    Useful for yt-dlp wrappers that are NOT awaited (subprocess-based). When
    called outside an event loop, the event is dropped (best-effort).
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running loop — drop the event (best-effort).
        return
    loop.create_task(
        record_proxy_request(
            provider_variant=provider_variant,
            bytes_in=bytes_in,
            bytes_out=bytes_out,
        )
    )


def extract_content_length(response: httpx.Response) -> int:
    """Pull Content-Length from an httpx response, falling back to body size.

    Returns 0 if unknown. Streaming responses without Content-Length and
    without `.content` loaded → 0 (best-effort).
    """
    try:
        cl = response.headers.get("Content-Length")
        if cl is not None:
            return max(0, int(cl))
    except Exception:
        pass

    # Fallback to actual body bytes if already loaded.
    try:
        if hasattr(response, "_content") and response._content is not None:
            return len(response._content)
    except Exception:
        pass
    return 0


async def record_httpx_response(
    provider_variant: str,
    response: httpx.Response,
) -> None:
    """Convenience wrapper : extract Content-Length from response and record."""
    bytes_in = extract_content_length(response)
    await record_proxy_request(
        provider_variant=provider_variant,
        bytes_in=bytes_in,
    )


async def flush() -> None:
    """Force a flush of the in-process buffer. Useful for tests and shutdown."""
    await _accumulator.flush()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 QUERY HELPERS (for admin endpoint)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_usage_summary(days: int = 30) -> Dict[str, Any]:
    """Aggregate proxy_usage_daily over the past N days.

    Returns dict with keys :
        period_days, total_bytes_in, total_bytes_out, total_requests,
        estimated_cost_usd, by_provider, daily (list of per-day rows).

    Caller (admin router) wraps this in the response payload.
    """
    from datetime import timedelta

    from db.database import ProxyUsageDaily, async_session_factory
    from sqlalchemy import select

    cutoff = date.today() - timedelta(days=max(1, int(days)))
    async with async_session_factory() as session:
        result = await session.execute(
            select(ProxyUsageDaily)
            .where(ProxyUsageDaily.date >= cutoff)
            .order_by(ProxyUsageDaily.date.desc())
        )
        rows = result.scalars().all()

    total_bytes_in = sum(r.bytes_in or 0 for r in rows)
    total_bytes_out = sum(r.bytes_out or 0 for r in rows)
    total_requests = sum(r.requests_total or 0 for r in rows)

    # Merge per-provider across all days.
    by_provider: Dict[str, Dict[str, int]] = {}
    for r in rows:
        for variant, bucket in (r.requests_by_provider or {}).items():
            agg = by_provider.setdefault(variant, {"requests": 0, "bytes_in": 0})
            agg["requests"] += int(bucket.get("requests", 0))
            agg["bytes_in"] += int(bucket.get("bytes_in", 0))

    estimated_cost_usd = (total_bytes_in / (1024**3)) * DECODO_COST_PER_GB_USD

    daily = [
        {
            "date": r.date.isoformat(),
            "bytes_in": int(r.bytes_in or 0),
            "bytes_out": int(r.bytes_out or 0),
            "requests_total": int(r.requests_total or 0),
            "requests_by_provider": r.requests_by_provider or {},
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]

    return {
        "period_days": int(days),
        "total_bytes_in": total_bytes_in,
        "total_bytes_out": total_bytes_out,
        "total_requests": total_requests,
        "estimated_cost_usd": round(estimated_cost_usd, 4),
        "by_provider": by_provider,
        "daily": daily,
    }
