"""Handoff vers Maxime via @Bobbykimifonibot (Telegram).

Envoie un message au chat Telegram de Maxime en utilisant le token du bot
Bobby + le chat_id (env vars). En cas d'erreur, on log et on stocke l'erreur
dans `BotHandoff.notification_error` — la conversation côté prospect continue
en mode "warm pending".

Sécurité : ne JAMAIS logger le token, ne JAMAIS exposer le chat_id dans les
réponses utilisateur. Le contenu du message est envoyé via Telegram Bot API
en plain HTTPS (Telegram fait son TLS standard).
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from ..config import bot_settings

logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org"


async def notify_maxime(
    summary: str,
    deep_link: Optional[str] = None,
    *,
    timeout: float = 10.0,
) -> Optional[str]:
    """Envoie une notification handoff. Retourne None si OK, sinon le message d'erreur.

    Non-fatal : ne raise jamais — l'appelant doit checker la valeur de retour
    et stocker l'erreur dans `BotHandoff.notification_error`.
    """
    if not bot_settings.handoff_active:
        msg = "handoff inactive (token ou chat_id manquant)"
        logger.warning("[bots.handoff] %s", msg)
        return msg

    text = summary
    if deep_link:
        text = f"{summary}\n\n🔗 Reprendre : {deep_link}"

    url = f"{TELEGRAM_API_BASE}/bot{bot_settings.HANDOFF_TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": bot_settings.HANDOFF_TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": False,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            err = f"telegram api {resp.status_code}: {resp.text[:200]}"
            logger.error("[bots.handoff] %s", err)
            return err
        data = resp.json()
        if not data.get("ok"):
            err = f"telegram not ok: {data.get('description', 'unknown')[:200]}"
            logger.error("[bots.handoff] %s", err)
            return err
    except httpx.TimeoutException:
        err = "telegram timeout"
        logger.error("[bots.handoff] %s", err)
        return err
    except httpx.HTTPError as exc:  # pragma: no cover - network errors hard to test
        err = f"telegram http error: {exc!r}"
        logger.exception("[bots.handoff] %s", err)
        return err

    logger.info("[bots.handoff] notification envoyée à Maxime")
    return None


def build_deep_link(platform: str, prospect_id: int) -> str:
    """Génère le deep-link pour reprendre la conversation depuis Telegram/Maxime."""
    bot_username = bot_settings.TELEGRAM_BOT_USERNAME.lstrip("@")
    if platform == "telegram":
        return f"https://t.me/{bot_username}?start=resume_{prospect_id}"
    return f"https://www.deepsightsynthesis.com/admin/bots/prospects/{prospect_id}"
