"""
Service Tutor : session storage Redis + orchestration LLM/STT/TTS.

V1 : sessions en Redis avec TTL 1h. Pas de table SQL.
V1.1 : ajout helper TTS ElevenLabs (synthesize_audio_data_url).
"""
import base64
import json
import uuid
import time
import logging
from typing import Optional
import httpx
import redis.asyncio as aioredis
from tutor.schemas import TutorSessionState, TutorTurn, TutorMode, TutorLang
from tutor.prompts import build_tutor_system_prompt, TUTOR_PERSONA_VERSION
from core.config import get_elevenlabs_key


logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 60 * 60  # 1 heure
ACTIVE_LOCK_TTL_SECONDS = 60 * 60

# ElevenLabs TTS config (V1.1)
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"
ELEVENLABS_DEFAULT_VOICE_ID_FR = "21m00Tcm4TlvDq8ikWAM"
ELEVENLABS_MODEL_ID = "eleven_multilingual_v2"


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
    await redis.set(_active_key(state.user_id), state.session_id, ex=ACTIVE_LOCK_TTL_SECONDS)
    logger.info(f"[tutor] created session {state.session_id} user={state.user_id}")


async def load_session(redis: aioredis.Redis, session_id: str) -> Optional[TutorSessionState]:
    raw = await redis.get(_session_key(session_id))
    if raw is None:
        return None
    return TutorSessionState.model_validate_json(raw)


async def append_turn(
    redis: aioredis.Redis,
    session_id: str,
    turn: TutorTurn,
) -> None:
    state = await load_session(redis, session_id)
    if state is None:
        raise ValueError(f"Session {session_id} not found or expired")
    state.turns.append(turn)
    await redis.set(_session_key(session_id), state.model_dump_json(), ex=SESSION_TTL_SECONDS)


async def delete_session(redis: aioredis.Redis, session_id: str) -> None:
    state = await load_session(redis, session_id)
    if state is not None:
        await redis.delete(_active_key(state.user_id))
    await redis.delete(_session_key(session_id))


def make_session_id() -> str:
    return f"tutor-{uuid.uuid4().hex[:12]}"


def now_ms() -> int:
    return int(time.time() * 1000)


# ═══════════════════════════════════════════════════════════════════════════════
# V1.1 — ElevenLabs TTS helper
# ═══════════════════════════════════════════════════════════════════════════════


async def synthesize_audio_data_url(
    text: str,
    lang: str = "fr",
    voice_id: Optional[str] = None,
) -> Optional[str]:
    """Synthétise l'audio via ElevenLabs et retourne un data URL base64.

    Returns None si la clé API est manquante, le texte est vide, ou l'API échoue
    (graceful fallback : le tuteur reste utilisable en mode texte si TTS down).
    """
    api_key = get_elevenlabs_key()
    if not api_key:
        logger.warning("[tutor] ELEVENLABS_API_KEY missing, skipping TTS")
        return None

    if not text.strip():
        return None

    resolved_voice = voice_id or ELEVENLABS_DEFAULT_VOICE_ID_FR
    url = f"{ELEVENLABS_BASE_URL}/text-to-speech/{resolved_voice}"

    payload = {
        "text": text,
        "model_id": ELEVENLABS_MODEL_ID,
        "language_code": lang,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.3,
            "use_speaker_boost": True,
            "speed": 1.0,
        },
    }
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            logger.warning(
                f"[tutor] ElevenLabs TTS failed status={response.status_code} body={response.text[:200]}"
            )
            return None
        b64 = base64.b64encode(response.content).decode("ascii")
        return f"data:audio/mpeg;base64,{b64}"
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        logger.warning(f"[tutor] ElevenLabs TTS exception: {exc}")
        return None
