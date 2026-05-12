"""Script — auto-détecte le chat_id de Maxime côté @Bobbykimifonibot.

Comment ça marche :
1. Tu lances le script avec `HANDOFF_TELEGRAM_BOT_TOKEN` (token Bobby).
2. Tu envoies un message court à @Bobbykimifonibot depuis ton compte Telegram.
3. Le script poll `getUpdates`, repère le dernier message reçu, extrait `chat.id`.
4. Il affiche la valeur à coller dans `HANDOFF_TELEGRAM_CHAT_ID`.

Pas de stockage automatique — Maxime copie la valeur dans `.env.production`.

Usage :
    cd backend
    HANDOFF_TELEGRAM_BOT_TOKEN=<bobby_token> python scripts/discover_handoff_chat_id.py

Si Bobby est en mode webhook actif, le script propose de désactiver le webhook
temporairement (revert manuel après).
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from typing import Any, Optional

import httpx


async def get_webhook_info(token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"https://api.telegram.org/bot{token}/getWebhookInfo")
    return resp.json()


async def delete_webhook(token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{token}/deleteWebhook",
            json={"drop_pending_updates": False},
        )
    return resp.json()


async def get_updates(token: str, offset: Optional[int] = None) -> dict[str, Any]:
    params: dict[str, Any] = {"timeout": 5}
    if offset is not None:
        params["offset"] = offset
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"https://api.telegram.org/bot{token}/getUpdates",
            params=params,
        )
    return resp.json()


def _extract_chat_id(update: dict[str, Any]) -> Optional[tuple[int, str]]:
    """Retourne (chat_id, display) si l'update est un DM exploitable."""
    msg = update.get("message") or update.get("channel_post") or update.get("edited_message")
    if not msg:
        return None
    chat = msg.get("chat") or {}
    if chat.get("type") != "private":
        return None
    chat_id = chat.get("id")
    if chat_id is None:
        return None
    first = chat.get("first_name", "")
    last = chat.get("last_name", "")
    username = chat.get("username")
    display_parts = [p for p in (first, last) if p]
    display = " ".join(display_parts) or (f"@{username}" if username else f"chat {chat_id}")
    return chat_id, display


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=120,
        help="Combien de temps poll getUpdates avant d'abandonner.",
    )
    parser.add_argument(
        "--force-delete-webhook",
        action="store_true",
        help="Supprime le webhook actif sans demander (à éviter si Bobby est utilisé en prod).",
    )
    args = parser.parse_args()

    token = os.environ.get("HANDOFF_TELEGRAM_BOT_TOKEN", "")
    if not token:
        print("❌ HANDOFF_TELEGRAM_BOT_TOKEN missing", file=sys.stderr)
        return 1

    info = await get_webhook_info(token)
    webhook_url = (info.get("result") or {}).get("url", "")
    if webhook_url:
        if not args.force_delete_webhook:
            print(
                f"⚠️ Bobby a un webhook actif ({webhook_url}). "
                f"Relance avec --force-delete-webhook si tu acceptes de le couper "
                f"temporairement (n'oublie pas de le re-set ensuite).",
                file=sys.stderr,
            )
            return 2
        print("→ deleteWebhook (temporaire)")
        await delete_webhook(token)

    print(
        "→ Envoie maintenant n'importe quel message à @Bobbykimifonibot "
        "depuis ton compte Telegram. J'écoute jusqu'à",
        args.timeout_seconds,
        "secondes.",
    )

    deadline = time.monotonic() + args.timeout_seconds
    last_update_id: Optional[int] = None
    while time.monotonic() < deadline:
        data = await get_updates(token, offset=last_update_id + 1 if last_update_id else None)
        if not data.get("ok"):
            print(f"❌ getUpdates not ok: {data}", file=sys.stderr)
            return 3
        for update in data.get("result", []):
            last_update_id = update.get("update_id")
            extracted = _extract_chat_id(update)
            if extracted is None:
                continue
            chat_id, display = extracted
            print()
            print("✅ Chat détecté :")
            print(f"    Nom : {display}")
            print(f"    HANDOFF_TELEGRAM_CHAT_ID={chat_id}")
            print()
            print("Colle cette ligne dans .env.production puis recharge le backend.")
            return 0
        await asyncio.sleep(2)

    print("⏰ Timeout — aucun message DM reçu. Réessaye.", file=sys.stderr)
    return 4


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
