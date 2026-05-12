"""Adapter Telegram — parse Update + send_message via aiogram.

aiogram 3.x est async-first et expose une classe `Bot` minimaliste. On
n'utilise PAS son `Dispatcher` car FastAPI gère déjà le routing webhook ; on
parse l'Update à la main pour rester en contrôle total du flow async.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from ..config import bot_settings
from ..schemas import OutgoingMessage, ParsedMessage

logger = logging.getLogger(__name__)


def parse_update(payload: dict[str, Any]) -> Optional[ParsedMessage]:
    """Convertit un Telegram Update en `ParsedMessage` neutre.

    Retourne `None` pour les updates non gérés (edited_message, channel_post,
    inline_query, etc.). Supporte :
    - `message` avec `text` (DM ou /start)
    - `callback_query` (clic sur InlineKeyboardButton)
    """
    if not isinstance(payload, dict):
        return None

    if "callback_query" in payload:
        cb = payload["callback_query"] or {}
        message = cb.get("message") or {}
        chat = message.get("chat") or {}
        from_user = cb.get("from") or {}
        chat_id = chat.get("id") or from_user.get("id")
        if chat_id is None:
            return None
        return ParsedMessage(
            platform="telegram",
            platform_user_id=str(chat_id),
            platform_username=from_user.get("username"),
            display_name=_build_display_name(from_user),
            language_code=from_user.get("language_code"),
            is_group=chat.get("type") not in (None, "private"),
            text=cb.get("data") or "",
            platform_msg_id=str(cb.get("id")) if cb.get("id") else None,
            callback_data=cb.get("data"),
            raw=payload,
        )

    msg = payload.get("message") or payload.get("edited_message")
    if not msg:
        return None
    if payload.get("edited_message"):
        # On ignore les edits pour V1 (pas de cas d'usage prospection)
        return None

    chat = msg.get("chat") or {}
    from_user = msg.get("from") or {}
    text = msg.get("text") or msg.get("caption")
    if not text:
        return None  # photos sans légende, stickers, etc.

    chat_id = chat.get("id")
    if chat_id is None:
        return None

    # Strip /start payload pour qualif uniforme
    cleaned_text = text
    if text.startswith("/start"):
        cleaned_text = text[len("/start") :].strip() or "Salut"
    elif text.startswith("/"):
        cleaned_text = text  # autres commandes : on les passe au LLM tel quel

    return ParsedMessage(
        platform="telegram",
        platform_user_id=str(chat_id),
        platform_username=from_user.get("username"),
        display_name=_build_display_name(from_user),
        language_code=from_user.get("language_code"),
        is_group=chat.get("type") not in (None, "private"),
        text=cleaned_text,
        platform_msg_id=str(msg.get("message_id")) if msg.get("message_id") else None,
        raw=payload,
    )


def _build_display_name(user: dict[str, Any]) -> Optional[str]:
    first = user.get("first_name") or ""
    last = user.get("last_name") or ""
    name = f"{first} {last}".strip()
    return name or None


async def send_message(
    chat_id: str,
    outgoing: OutgoingMessage,
    *,
    timeout: float = 10.0,
) -> Optional[str]:
    """Envoie un message Telegram. Retourne None si OK, sinon l'erreur."""
    import httpx  # import local pour éviter coût au boot quand bot off

    if not bot_settings.telegram_active:
        return "telegram inactive (BOTS_ENABLED or TELEGRAM_ENABLED false)"

    url = f"https://api.telegram.org/bot{bot_settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": outgoing.text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": False,
    }
    if outgoing.buttons:
        payload["reply_markup"] = {
            "inline_keyboard": [[{"text": btn.label, "callback_data": btn.payload} for btn in outgoing.buttons]]
        }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            err = f"telegram send {resp.status_code}: {resp.text[:200]}"
            logger.error("[bots.telegram] %s", err)
            return err
        data = resp.json()
        if not data.get("ok"):
            err = f"telegram send not ok: {data.get('description', '')[:200]}"
            logger.error("[bots.telegram] %s", err)
            return err
    except httpx.TimeoutException:
        err = "telegram send timeout"
        logger.error("[bots.telegram] %s", err)
        return err
    except httpx.HTTPError as exc:  # pragma: no cover
        err = f"telegram send http error: {exc!r}"
        logger.exception("[bots.telegram] %s", err)
        return err

    return None


async def set_webhook(
    webhook_url: str,
    secret_token: str,
    *,
    drop_pending_updates: bool = True,
    timeout: float = 10.0,
) -> dict[str, Any]:
    """Configure le webhook Telegram. Retourne la réponse JSON brute."""
    import httpx

    if not bot_settings.TELEGRAM_BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN missing")

    url = f"https://api.telegram.org/bot{bot_settings.TELEGRAM_BOT_TOKEN}/setWebhook"
    payload = {
        "url": webhook_url,
        "secret_token": secret_token,
        "drop_pending_updates": drop_pending_updates,
        "allowed_updates": ["message", "callback_query"],
        "max_connections": 40,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload)
    return resp.json()


async def delete_webhook(*, timeout: float = 10.0) -> dict[str, Any]:
    """Supprime le webhook actif (utile pour passer en polling local)."""
    import httpx

    url = f"https://api.telegram.org/bot{bot_settings.TELEGRAM_BOT_TOKEN}/deleteWebhook"
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json={"drop_pending_updates": True})
    return resp.json()
