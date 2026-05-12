"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📊 ANALYTICS HELPER — server-side PostHog capture (best-effort)                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  RÔLE:                                                                             ║
║  • track_event(name, properties) : capture un event PostHog côté serveur          ║
║  • Best-effort : toute exception est silencieusement avalée, jamais bloquant       ║
║  • Fire-and-forget : asyncio.create_task() pour ne pas attendre le réseau         ║
║  • Désactivé sans configuration (POSTHOG_API_KEY vide) : no-op                    ║
║                                                                                    ║
║  USAGE:                                                                            ║
║    from core.analytics import track_event                                          ║
║    track_event("web_search_provider_used", {                                       ║
║        "provider": "mistral_agent",                                                ║
║        "plan": "pro",                                                              ║
║    })                                                                              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, Optional

import httpx

from core.config import _settings
from core.logging import logger


def _is_enabled() -> bool:
    return bool(_settings.POSTHOG_API_KEY)


async def _send_event_async(
    name: str,
    properties: Dict[str, Any],
    distinct_id: Optional[str] = None,
) -> None:
    """Internal: actually fire the HTTPS request to PostHog /capture/."""
    if not _is_enabled():
        return

    payload = {
        "api_key": _settings.POSTHOG_API_KEY,
        "event": name,
        "distinct_id": distinct_id or "server",
        "properties": properties,
        "timestamp": time.time(),
    }
    url = f"{_settings.POSTHOG_HOST.rstrip('/')}/capture/"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code >= 400:
                logger.debug(
                    f"[ANALYTICS] PostHog returned {response.status_code} for event={name}: {response.text[:200]}"
                )
    except Exception as e:
        # Never block — log at debug only
        logger.debug(f"[ANALYTICS] track_event '{name}' failed: {e}")


def track_event(
    name: str,
    properties: Optional[Dict[str, Any]] = None,
    distinct_id: Optional[str] = None,
) -> None:
    """
    Fire-and-forget PostHog event capture.

    Safe to call from any sync or async context. Never raises, never blocks
    the calling coroutine on the network. If POSTHOG_API_KEY is empty the
    call is a no-op.

    Args:
        name: Event name (e.g. "web_search_provider_used"). Convention:
            snake_case, past tense or noun phrase.
        properties: Arbitrary properties attached to the event.
        distinct_id: PostHog distinct user id. Defaults to "server" for
            unauthenticated server-side events.
    """
    if not _is_enabled():
        return

    payload = dict(properties or {})

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Fire-and-forget on the running loop
            asyncio.create_task(_send_event_async(name, payload, distinct_id))
            return
    except RuntimeError:
        # No running loop — fall through to the synchronous path below
        pass

    # Synchronous fallback (rare — startup hooks, scripts)
    try:
        url = f"{_settings.POSTHOG_HOST.rstrip('/')}/capture/"
        body = {
            "api_key": _settings.POSTHOG_API_KEY,
            "event": name,
            "distinct_id": distinct_id or "server",
            "properties": payload,
            "timestamp": time.time(),
        }
        with httpx.Client(timeout=3.0) as client:
            client.post(url, json=body)
    except Exception as e:
        logger.debug(f"[ANALYTICS] track_event sync '{name}' failed: {e}")


__all__ = ["track_event"]
