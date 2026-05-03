"""
Service Tutor : session storage Redis + orchestration LLM/STT/TTS.

V1 : sessions en Redis avec TTL 1h. Pas de table SQL.
"""
import json
import uuid
import time
import logging
from typing import Optional
import redis.asyncio as aioredis
from src.tutor.schemas import TutorSessionState, TutorTurn, TutorMode, TutorLang
from src.tutor.prompts import build_tutor_system_prompt, TUTOR_PERSONA_VERSION


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
