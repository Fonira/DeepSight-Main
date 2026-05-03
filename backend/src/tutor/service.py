"""
Service Tutor : session storage Redis + orchestration LLM.

V1.0 : sessions en Redis avec TTL 1h. Pas de table SQL.
STT/TTS Voxtral/ElevenLabs reportés V1.1 (mode TEXTE only V1.0).
"""
import logging
import time
import uuid
from typing import Optional

import redis.asyncio as aioredis

from tutor.schemas import TutorSessionState, TutorTurn


logger = logging.getLogger(__name__)


SESSION_TTL_SECONDS = 60 * 60  # 1 heure
ACTIVE_LOCK_TTL_SECONDS = 60 * 60


def _session_key(session_id: str) -> str:
    return f"tutor:session:{session_id}"


def _active_key(user_id: int) -> str:
    return f"tutor:session:user:{user_id}:active"


async def create_session(
    redis: aioredis.Redis,
    state: TutorSessionState,
) -> None:
    """Persiste une nouvelle session avec TTL 1h."""
    payload = state.model_dump_json()
    await redis.set(_session_key(state.session_id), payload, ex=SESSION_TTL_SECONDS)
    await redis.set(
        _active_key(state.user_id),
        state.session_id,
        ex=ACTIVE_LOCK_TTL_SECONDS,
    )
    logger.info(
        "[tutor] created session %s user=%s mode=%s",
        state.session_id,
        state.user_id,
        state.mode,
    )


async def load_session(
    redis: aioredis.Redis,
    session_id: str,
) -> Optional[TutorSessionState]:
    """Récupère une session par ID. Retourne None si expiré/absent."""
    raw = await redis.get(_session_key(session_id))
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return TutorSessionState.model_validate_json(raw)


async def append_turn(
    redis: aioredis.Redis,
    session_id: str,
    turn: TutorTurn,
) -> None:
    """Ajoute un turn (user ou assistant) à la session existante.

    Refresh le TTL à 1h à chaque turn.
    """
    state = await load_session(redis, session_id)
    if state is None:
        raise ValueError(f"Session {session_id} not found or expired")
    state.turns.append(turn)
    await redis.set(
        _session_key(session_id),
        state.model_dump_json(),
        ex=SESSION_TTL_SECONDS,
    )


async def delete_session(redis: aioredis.Redis, session_id: str) -> None:
    """Supprime la session + le lock active du user."""
    state = await load_session(redis, session_id)
    if state is not None:
        await redis.delete(_active_key(state.user_id))
    await redis.delete(_session_key(session_id))


def make_session_id() -> str:
    """Génère un session_id unique préfixé."""
    return f"tutor-{uuid.uuid4().hex[:12]}"


def now_ms() -> int:
    """Timestamp courant en millisecondes."""
    return int(time.time() * 1000)


# ─── STT/TTS stubs (V1.1) ───────────────────────────────────────────────────────
# V1.0 : mode TEXTE uniquement. Ces stubs garantissent l'API future
# sans appel effectif à Voxtral/ElevenLabs.


async def transcribe_user_audio(audio_blob_b64: str, lang: str = "fr") -> Optional[str]:
    """Stub V1.1 — Voxtral STT. Retourne None en V1.0 (non supporté)."""
    logger.warning(
        "[tutor] transcribe_user_audio() called but STT not implemented in V1.0"
    )
    return None


async def synthesize_tutor_voice(
    text: str,
    voice_id: Optional[str] = None,
    lang: str = "fr",
) -> Optional[str]:
    """Stub V1.1 — ElevenLabs TTS. Retourne None en V1.0 (non supporté)."""
    logger.warning(
        "[tutor] synthesize_tutor_voice() called but TTS not implemented in V1.0"
    )
    return None
