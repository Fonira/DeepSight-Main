"""Webhook post-appel ElevenLabs : vérification de signature et transcript.

Format documenté par ElevenLabs (post-call webhooks, authentification HMAC) :

* en-tête ``ElevenLabs-Signature: t=<timestamp unix>,v0=<hex>`` ;
* ``v0`` = HMAC-SHA256(secret, ``"<timestamp>.<corps brut>"``) en hexadécimal ;
* un timestamp à plus de 30 minutes de l'heure courante est refusé (rejeu).

Le secret est celui que le dashboard ElevenLabs génère à la création du
webhook (variable ``ELEVENLABS_WEBHOOK_SECRET``).
"""

from __future__ import annotations

import hashlib
import hmac
import time
from collections.abc import Iterable

from voice.schemas import ElevenLabsTranscriptTurn

SIGNATURE_TOLERANCE_SECONDS: int = 30 * 60

# Libellés compris par parse_transcript_canonical et affichés dans l'historique.
_ROLE_LABELS: dict[str, str] = {"user": "User", "agent": "AI"}


class WebhookSignatureError(Exception):
    """Signature absente, mal formée, expirée ou fausse.

    ``code`` est renvoyé tel quel dans le détail de la réponse 401.
    """

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def verify_elevenlabs_signature(
    raw_body: bytes,
    signature_header: str | None,
    secret: str,
    *,
    now: float | None = None,
    tolerance_seconds: int = SIGNATURE_TOLERANCE_SECONDS,
) -> None:
    """Lève ``WebhookSignatureError`` si ``signature_header`` ne signe pas ``raw_body``.

    Accepte plusieurs ``v0`` dans l'en-tête (rotation de secret côté ElevenLabs).
    """
    if not signature_header:
        raise WebhookSignatureError("missing_signature")

    timestamp: str | None = None
    signatures: list[str] = []
    for item in signature_header.split(","):
        key, separator, value = item.strip().partition("=")
        if not separator:
            continue
        if key == "t":
            timestamp = value
        elif key == "v0" and value:
            signatures.append(value)

    if not timestamp or not timestamp.isdigit() or not signatures:
        raise WebhookSignatureError("malformed_signature")

    current = time.time() if now is None else now
    if abs(current - int(timestamp)) > tolerance_seconds:
        raise WebhookSignatureError("stale_signature")

    expected = hmac.new(
        secret.encode(),
        f"{timestamp}.".encode() + raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not any(hmac.compare_digest(expected.encode(), sig.encode()) for sig in signatures):
        raise WebhookSignatureError("invalid_signature")


def transcript_to_text(turns: Iterable[ElevenLabsTranscriptTurn]) -> str:
    """Transcript ElevenLabs → texte « User: … / AI: … », une ligne par tour.

    Les tours sans message (appels d'outils) sont ignorés ; les retours à la
    ligne d'un message sont aplatis pour garder une ligne par tour.
    """
    lines: list[str] = []
    for turn in turns:
        message = " ".join((turn.message or "").split())
        if not message:
            continue
        label = _ROLE_LABELS.get(turn.role, turn.role.capitalize() or "Unknown")
        lines.append(f"{label}: {message}")
    return "\n".join(lines)
