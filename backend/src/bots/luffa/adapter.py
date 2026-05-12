"""Adapter Luffa — wrap `luffa-bot-python-sdk`.

V1 : on traduit les envelopes du SDK en `ParsedMessage` neutres. Le SDK gère
le polling + déduplication + concurrence côté HTTP ; nous ne faisons que la
normalisation et le routage vers `ConversationEngine`.

Le SDK n'est importé qu'au boot du poller (lazy import) pour ne pas charger
`httpx` deux fois ou crasher si `luffa-bot-python-sdk` n'est pas installé en
dev. Tant que `LUFFA_ENABLED=false`, ce module n'est jamais utilisé.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from ..schemas import OutgoingMessage, ParsedMessage

logger = logging.getLogger(__name__)


def envelope_to_messages(envelope: Any) -> list[ParsedMessage]:
    """Convertit un `IncomingEnvelope` SDK en liste de `ParsedMessage`.

    Un envelope contient `count` messages du même expéditeur (ou groupe).
    On crée un `ParsedMessage` par item exploitable (text non vide).
    """
    parsed_list: list[ParsedMessage] = []
    is_group = getattr(envelope, "type", 0) == 1
    uid = str(getattr(envelope, "uid", "") or "")
    if not uid:
        return parsed_list

    for msg in getattr(envelope, "messages", []) or []:
        text = (getattr(msg, "text", "") or "").strip()
        url_link = getattr(msg, "urlLink", None)
        if not text and url_link:
            text = url_link.strip()
        if not text:
            continue
        sender_uid = getattr(msg, "uid", None) or uid
        parsed_list.append(
            ParsedMessage(
                platform="luffa",
                platform_user_id=str(sender_uid),
                platform_username=None,
                display_name=None,
                language_code=None,
                is_group=is_group,
                text=text,
                platform_msg_id=str(getattr(msg, "msgId", "")) or None,
            )
        )
    return parsed_list


async def send_outgoing(
    client: Any,
    *,
    uid: str,
    outgoing: OutgoingMessage,
    is_group: bool = False,
) -> Optional[str]:
    """Envoie un `OutgoingMessage` via le SDK Luffa. Retourne None si OK."""
    try:
        if outgoing.buttons:
            # Import local pour éviter dépendance dure quand Luffa off
            from luffa_bot.models import GroupMessagePayload, SimpleButton  # type: ignore

            payload = GroupMessagePayload(
                text=outgoing.text,
                button=[
                    SimpleButton(name=btn.label[:32], selector=btn.payload[:64])
                    for btn in outgoing.buttons[:3]
                ],
            )
            if is_group:
                await client.send_to_group(uid, payload, message_type=2)
            else:
                # Luffa SDK n'expose pas de "send_to_user with buttons" en DM
                # → on degrade en texte + listing inline
                fallback_text = outgoing.text + "\n\n" + " | ".join(
                    f"[{btn.label}]" for btn in outgoing.buttons
                )
                await client.send_to_user(uid, fallback_text)
        else:
            if is_group:
                await client.send_to_group(uid, outgoing.text)
            else:
                await client.send_to_user(uid, outgoing.text)
    except Exception as exc:
        err = f"luffa send error: {exc!r}"
        logger.error("[bots.luffa] %s", err)
        return err
    return None
