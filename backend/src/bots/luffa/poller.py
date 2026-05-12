"""Poller Luffa — boucle async lancée dans le lifespan FastAPI.

Tant que `LUFFA_ENABLED=false` ou que le SDK n'est pas installé, la coroutine
`luffa_loop()` retourne immédiatement. Aucun import dur du SDK ailleurs dans
le code → backend fonctionne sans `luffa-bot-python-sdk`.

Pour activer en prod :
1. `pip install luffa-bot-python-sdk` (déjà dans requirements.txt)
2. `LUFFA_ROBOT_SECRET=...` dans `.env.production`
3. `LUFFA_ENABLED=true`
4. Restart du container backend
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from ..config import bot_settings
from ..schemas import ParsedMessage
from .adapter import envelope_to_messages, send_outgoing

logger = logging.getLogger(__name__)

_running_task: Optional[asyncio.Task] = None
_stop_event: Optional[asyncio.Event] = None


async def luffa_loop() -> None:
    """Boucle principale du poller Luffa. Idempotent : early-return si off."""
    global _stop_event

    if not bot_settings.luffa_active:
        logger.info("[bots.luffa] poller off (luffa_active=false)")
        return

    try:
        import luffa_bot  # type: ignore
        from luffa_bot.client import AsyncLuffaClient  # type: ignore
    except ImportError:
        logger.warning(
            "[bots.luffa] luffa-bot-python-sdk not installed — install or set LUFFA_ENABLED=false"
        )
        return

    luffa_bot.robot_key = bot_settings.LUFFA_ROBOT_SECRET
    client = AsyncLuffaClient(robot_key=bot_settings.LUFFA_ROBOT_SECRET)
    _stop_event = asyncio.Event()
    interval = max(0.5, bot_settings.LUFFA_POLL_INTERVAL)
    seen_msg_ids: set[str] = set()
    seen_order: list[str] = []
    max_dedup = 1024

    # Import différé pour casser la dépendance circulaire pendant les tests
    from ..router import _make_session_ctx  # noqa: WPS433
    from ..core.conversation import ConversationEngine  # noqa: WPS433

    engine = ConversationEngine(session_factory=_make_session_ctx)

    logger.info("[bots.luffa] poller started (interval=%.2fs)", interval)
    try:
        while not _stop_event.is_set():
            try:
                envelopes = await client.receive()
            except Exception as exc:  # pragma: no cover - réseau
                logger.exception("[bots.luffa] receive failed: %r", exc)
                await asyncio.sleep(min(interval * 5, 30))
                continue

            for env in envelopes or []:
                parsed_list = envelope_to_messages(env)
                for parsed in parsed_list:
                    if not parsed.platform_msg_id:
                        continue
                    if parsed.platform_msg_id in seen_msg_ids:
                        continue
                    seen_msg_ids.add(parsed.platform_msg_id)
                    seen_order.append(parsed.platform_msg_id)
                    if len(seen_order) > max_dedup:
                        old = seen_order.pop(0)
                        seen_msg_ids.discard(old)
                    asyncio.create_task(_dispatch(engine, client, parsed))

            try:
                await asyncio.wait_for(_stop_event.wait(), timeout=interval)
            except asyncio.TimeoutError:
                pass
    finally:
        await client.aclose()
        logger.info("[bots.luffa] poller stopped")


async def _dispatch(engine, client, parsed: ParsedMessage) -> None:
    try:
        result = await engine.handle(parsed)
        if not result.outgoing.text:
            return
        await send_outgoing(
            client,
            uid=parsed.platform_user_id,
            outgoing=result.outgoing,
            is_group=parsed.is_group,
        )
    except Exception:  # pragma: no cover
        logger.exception("[bots.luffa] dispatch crashed for %s", parsed.platform_user_id)


def start_background() -> None:
    """Démarre le poller en tâche asyncio.

    À appeler depuis le lifespan FastAPI. Idempotent : ne crée pas de second
    task si déjà lancé.
    """
    global _running_task
    if not bot_settings.luffa_active:
        return
    if _running_task is not None and not _running_task.done():
        return
    _running_task = asyncio.create_task(luffa_loop(), name="bots-luffa-poller")


async def stop_background() -> None:
    """Demande l'arrêt propre du poller (à appeler au shutdown FastAPI)."""
    global _stop_event, _running_task
    if _stop_event is not None:
        _stop_event.set()
    if _running_task is not None:
        try:
            await asyncio.wait_for(_running_task, timeout=10.0)
        except asyncio.TimeoutError:  # pragma: no cover
            _running_task.cancel()
        _running_task = None
        _stop_event = None
