"""Conversation digest generator for voice sessions and chat text buckets.

Generates 2-3 bullet summaries via Mistral-small to amortize the cost of
context recall (cf. spec 2026-04-29-merge-voice-chat-context-design).

Hooks:
  - voice/router.py on voice session end → generate_voice_session_digest
  - chat/service.py:save_chat_message after commit → maybe_generate_chat_text_digest
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select, update

from db.database import ChatMessage, ChatTextDigest, VoiceSession

logger = logging.getLogger(__name__)

DIGEST_MODEL = "mistral-small-2603"
DIGEST_MAX_OUTPUT_CHARS = 800
CHAT_TEXT_BUCKET_SIZE = 20

_DIGEST_PROMPT_FR = (
    "Tu es un digest writer concis. On te donne un échange (voice ou texte) entre "
    "un utilisateur et l'assistant DeepSight à propos d'une vidéo YouTube. Produis "
    "2 à 3 puces très courtes (max 80 caractères chacune) résumant : (1) ce que "
    "l'utilisateur a demandé, (2) ce que tu as répondu / les conclusions clés.\n\n"
    "Format strict :\n- [puce 1]\n- [puce 2]\n- [puce 3 si nécessaire]\n\n"
    "Aucune introduction, aucun commentaire, aucune phrase complète. Pas de markdown "
    "autre que les puces."
)


async def _call_mistral_for_digest(transcript: str, lang: str = "fr") -> str:
    """Single Mistral-small call. Returns digest text, raises on failure."""
    try:
        from mistralai import Mistral
    except ImportError:
        from mistralai.client import Mistral

    from core.config import get_mistral_key

    client = Mistral(api_key=get_mistral_key())
    response = await client.chat.complete_async(
        model=DIGEST_MODEL,
        messages=[
            {"role": "system", "content": _DIGEST_PROMPT_FR},
            {"role": "user", "content": transcript},
        ],
        max_tokens=300,
        temperature=0.3,
    )
    text = (response.choices[0].message.content or "").strip()
    return text[:DIGEST_MAX_OUTPUT_CHARS]


async def generate_voice_session_digest(db, voice_session_id: str) -> None:
    """Generate and persist a digest of a voice session.

    Idempotent : skip if `digest_generated_at IS NOT NULL`.
    Failure is non-fatal (logged via Sentry).
    """
    vs = (
        await db.execute(
            select(VoiceSession).where(VoiceSession.id == voice_session_id)
        )
    ).scalar_one_or_none()

    if vs is None:
        logger.warning("generate_voice_digest: voice_session not found", extra={"voice_session_id": voice_session_id})
        return

    if vs.digest_generated_at is not None:
        logger.debug("generate_voice_digest: idempotent skip", extra={"voice_session_id": voice_session_id})
        return

    # Fetch all voice rows for this session, ordered chronologically
    msgs = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.voice_session_id == voice_session_id)
            .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        )
    ).scalars().all()

    if not msgs:
        logger.info("generate_voice_digest: empty session", extra={"id": voice_session_id})
        return

    transcript = "\n".join(
        f"{m.voice_speaker or m.role}: {m.content}"
        for m in msgs
        if m.content
    )

    try:
        digest_text = await _call_mistral_for_digest(transcript)
    except Exception as exc:
        logger.warning(
            "generate_voice_digest: Mistral failed (non-fatal)",
            extra={"id": voice_session_id, "error": str(exc)},
        )
        return

    # Atomic UPDATE WHERE digest_generated_at IS NULL (race-safe)
    await db.execute(
        update(VoiceSession)
        .where(
            VoiceSession.id == voice_session_id,
            VoiceSession.digest_generated_at.is_(None),
        )
        .values(
            digest_text=digest_text,
            digest_generated_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()
