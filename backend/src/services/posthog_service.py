"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📊 POSTHOG SERVICE — server-side event capture (Launch J0 hub)                    ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  RÔLE                                                                              ║
║  • Wrapper async autour de `core.analytics.track_event` qui expose une API         ║
║    cohérente (`capture_event`) attendue par les routers (sub-agent Q Stripe        ║
║    `acquisition_channel` parallel PR).                                             ║
║  • Best-effort : toute exception est silencieusement avalée (jamais bloquant).     ║
║  • No-op si `POSTHOG_API_KEY` non configuré (cf. core.analytics).                  ║
║                                                                                    ║
║  USAGE                                                                             ║
║      from services.posthog_service import capture_event                            ║
║      await capture_event(                                                          ║
║          distinct_id=str(user.id),                                                 ║
║          event="payment_completed",                                                ║
║          properties={"plan": "pro", "acquisition_channel": "product_hunt"},        ║
║      )                                                                             ║
║                                                                                    ║
║  ÉVÉNEMENTS CONNUS LAUNCH J0                                                       ║
║  • signup_completed   (auth/router.py verify_email)                                ║
║  • payment_completed  (billing/router.py handle_checkout_completed)                ║
║  • churn_event        (billing/router.py handle_subscription_deleted)              ║
║  • analysis_started   (frontend uniquement, mais loggable server-side aussi)       ║
║                                                                                    ║
║  VOCABULAIRE SSOT (`acquisition_channel` / `signup_source`)                        ║
║  • product_hunt | twitter | reddit | linkedin | indiehackers |                     ║
║    hackernews | karim_inmail | mobile_deeplink | direct                            ║
║                                                                                    ║
║  BENEFITS                                                                          ║
║  • Découple les routers d'`asyncio.create_task` direct (testable plus facile)      ║
║  • Permet d'ajouter futur: rate limiting, batching, dedup local sans toucher       ║
║    aux call sites.                                                                 ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from core.analytics import track_event
from core.logging import logger


async def capture_event(
    distinct_id: str,
    event: str,
    properties: Optional[Dict[str, Any]] = None,
) -> None:
    """Capture un event PostHog server-side (fire-and-forget, non-bloquant).

    Args:
        distinct_id: PostHog distinct user id (string). Pour les events
            authentifiés, utiliser `str(user.id)`. Pour les events anonymes,
            "server" ou un identifiant de session (jamais d'email PII).
        event: Nom canonique snake_case (ex: "payment_completed").
        properties: Propriétés event-level. Pour les events launch, inclure
            `acquisition_channel` ou `signup_source` du vocabulaire SSOT
            pour permettre breakdown PostHog cohorts.

    Toutes les exceptions sont avalées à debug-level — never raises.
    No-op si `POSTHOG_API_KEY` vide.
    """
    try:
        track_event(name=event, properties=properties or {}, distinct_id=distinct_id)
    except Exception as e:
        # `track_event` est déjà best-effort (cf. core.analytics) mais on
        # ajoute un filet ici au cas où l'import lui-même casse.
        logger.debug(f"[POSTHOG_SERVICE] capture_event '{event}' failed: {e}")


__all__ = ["capture_event"]
