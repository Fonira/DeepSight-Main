"""Routes FastAPI pour les bots prospection.

- POST /api/bots/telegram/webhook  : reçoit les updates Telegram (auth header)
- POST /api/bots/_internal/test-handoff : envoie un message test à Bobby (admin)
- GET  /api/bots/_status            : statut feature flags
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request

from auth.dependencies import get_current_admin
from db.database import User, get_session

from .config import bot_settings
from .core.conversation import ConversationEngine
from .core.handoff import notify_maxime
from .schemas import ParsedMessage
from .telegram.adapter import parse_update, send_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bots", tags=["bots"])


@router.get("/_status")
async def status() -> dict[str, Any]:
    return {
        "bots_enabled": bot_settings.BOTS_ENABLED,
        "telegram_active": bot_settings.telegram_active,
        "luffa_active": bot_settings.luffa_active,
        "handoff_active": bot_settings.handoff_active,
        "model": bot_settings.BOTS_MISTRAL_MODEL,
        "warm_threshold": bot_settings.WARM_LEAD_SCORE_THRESHOLD,
    }


@router.post("/telegram/webhook", status_code=200)
async def telegram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: Optional[str] = Header(
        default=None, alias="X-Telegram-Bot-Api-Secret-Token"
    ),
) -> dict[str, str]:
    """Endpoint webhook Telegram.

    Telegram retry pendant 24h sur non-200 → on répond TOUJOURS 200 sauf si
    auth invalide ou bot désactivé.
    """
    if not bot_settings.telegram_active:
        # 404 plutôt que 503 pour ne pas crier au monde qu'on a un bot off
        raise HTTPException(status_code=404, detail="not found")

    if (
        not bot_settings.TELEGRAM_WEBHOOK_SECRET
        or x_telegram_bot_api_secret_token != bot_settings.TELEGRAM_WEBHOOK_SECRET
    ):
        raise HTTPException(status_code=403, detail="invalid secret token")

    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored", "reason": "invalid_json"}

    parsed = parse_update(payload)
    if parsed is None:
        return {"status": "ignored"}

    # Traitement asynchrone — on rend la main vite à Telegram (< 1s)
    background_tasks.add_task(_handle_telegram_message, parsed)
    return {"status": "ok"}


async def _handle_telegram_message(parsed: ParsedMessage) -> None:
    """Task background : passe par ConversationEngine puis renvoie sur Telegram.

    En cas d'erreur, on log et on ignore — le prospect ne saura pas qu'on a
    planté (UX choice : éviter les messages d'erreur cryptiques).
    """
    try:
        engine = ConversationEngine(session_factory=_make_session_ctx)
        result = await engine.handle(parsed)
        if not result.outgoing.text:
            return
        err = await send_message(parsed.platform_user_id, result.outgoing)
        if err:
            logger.error(
                "[bots.router] send_message failed for prospect %s: %s",
                result.prospect_id,
                err,
            )
        if result.handoff_triggered:
            logger.info(
                "[bots.router] handoff triggered prospect=%s err=%s",
                result.prospect_id,
                result.handoff_error,
            )
    except Exception:  # pragma: no cover - we never want a background task to crash silently
        logger.exception("[bots.router] _handle_telegram_message crashed")


def _make_session_ctx():
    """Wrap get_session async generator into an `async with` context manager.

    `get_session` est un `async def` *generator* (yield) ; on construit un
    contextmanager léger compatible avec `ConversationEngine`.
    """
    from contextlib import asynccontextmanager
    from db.database import async_session_maker

    @asynccontextmanager
    async def _ctx():
        async with async_session_maker() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    return _ctx()


@router.post("/_internal/test-handoff")
async def test_handoff(
    admin: User = Depends(get_current_admin),
) -> dict[str, str]:
    """Endpoint admin pour valider le canal handoff sans vrai lead."""
    _ = admin  # silence linter
    err = await notify_maxime(
        summary=(
            "🧪 *Test handoff DeepSight*\n\n"
            "Ceci est un message déclenché par `POST /api/bots/_internal/test-handoff`.\n"
            "Si tu lis ça côté Bobby, la chaîne handoff est OK."
        ),
        deep_link=None,
    )
    if err:
        raise HTTPException(
            status_code=500,
            detail={"code": "HANDOFF_ERROR", "message": err},
        )
    return {"status": "sent"}
