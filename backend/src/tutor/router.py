"""
Router /api/tutor/* — 3 endpoints pour le Tuteur conversationnel (Le Tuteur V1.0).

V1.0 : mode TEXTE only (Magistral). STT/TTS Voxtral/ElevenLabs reportés V1.1.
Sessions Redis TTL 1h. Plan gating: Pro+ uniquement (Free → 403).

Tasks couvertes : P2.4 (start), P2.5 (turn), P2.6 (end).
"""
import logging
import os
from typing import Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException

from auth.dependencies import get_current_user
from core.config import MAGISTRAL_EPISTEMIC_MODEL
from core.llm_provider import llm_complete
from db.database import User

from tutor.prompts import build_tutor_system_prompt, TUTOR_PERSONA_VERSION
from tutor.schemas import (
    SessionEndResponse,
    SessionStartRequest,
    SessionStartResponse,
    SessionTurnRequest,
    SessionTurnResponse,
    TutorSessionState,
    TutorTurn,
)
from tutor.service import (
    append_turn,
    create_session,
    delete_session,
    load_session,
    make_session_id,
    now_ms,
)


logger = logging.getLogger(__name__)
router = APIRouter()


_redis_client: Optional[aioredis.Redis] = None


async def _get_redis() -> aioredis.Redis:
    """Lazy singleton Redis client. Pattern repris de core/cache.py."""
    global _redis_client
    if _redis_client is None:
        redis_url = os.environ.get("REDIS_URL", "")
        if not redis_url:
            raise HTTPException(
                status_code=503,
                detail="Redis non configuré (REDIS_URL manquant)",
            )
        _redis_client = aioredis.from_url(redis_url, decode_responses=True)
    return _redis_client


def _check_plan_access(user: User) -> None:
    """Bloque les users Free. TODO: migrer vers is_feature_available SSOT."""
    plan = (user.plan or "").lower()
    if plan not in {"pro", "expert", "plus", "etudiant", "starter", "student", "equipe", "team", "unlimited"}:
        raise HTTPException(
            status_code=403,
            detail="Cette fonctionnalité nécessite un plan Pro ou Expert.",
        )


def _select_magistral_model(user_plan: str) -> str:
    """Magistral medium pour Pro, large pour Expert (V1 : même modèle)."""
    return MAGISTRAL_EPISTEMIC_MODEL or "magistral-medium-2509"


async def _call_magistral(
    system_prompt: str,
    history_turns: list,
    model: str,
) -> str:
    """Appelle Magistral via llm_complete et retourne le texte de réponse."""
    messages = [{"role": "system", "content": system_prompt}]
    for turn in history_turns:
        messages.append({"role": turn.role, "content": turn.content})

    result = await llm_complete(
        messages=messages,
        model=model,
        max_tokens=300,
        temperature=0.7,
        timeout=60.0,
    )
    if result is None or not result.content:
        raise HTTPException(
            status_code=502,
            detail="Échec appel Magistral (aucune réponse)",
        )
    return result.content.strip()


@router.post("/session/start", response_model=SessionStartResponse)
async def session_start(
    body: SessionStartRequest,
    user: User = Depends(get_current_user),
):
    """P2.4 — Démarre une session : crée Redis + génère 1er prompt Magistral."""
    _check_plan_access(user)

    redis = await _get_redis()
    session_id = make_session_id()
    state = TutorSessionState(
        session_id=session_id,
        user_id=user.id,
        concept_term=body.concept_term,
        concept_def=body.concept_def,
        summary_id=body.summary_id,
        source_video_title=body.source_video_title,
        mode=body.mode,
        lang=body.lang,
        started_at_ms=now_ms(),
        persona_version=TUTOR_PERSONA_VERSION,
    )
    await create_session(redis, state)

    system_prompt = build_tutor_system_prompt(
        concept_term=body.concept_term,
        concept_def=body.concept_def,
        source_video_title=body.source_video_title,
        lang=body.lang,
    )
    model = _select_magistral_model(user.plan)
    first_prompt = await _call_magistral(system_prompt, [], model)

    await append_turn(
        redis,
        session_id,
        TutorTurn(role="assistant", content=first_prompt, timestamp_ms=now_ms()),
    )

    # V1.0 : audio_url toujours None (TTS reporté V1.1)
    return SessionStartResponse(
        session_id=session_id,
        first_prompt=first_prompt,
        audio_url=None,
    )


@router.post("/session/{session_id}/turn", response_model=SessionTurnResponse)
async def session_turn(
    session_id: str,
    body: SessionTurnRequest,
    user: User = Depends(get_current_user),
):
    """P2.5 — Tour de conversation : user input → IA response."""
    _check_plan_access(user)

    if not body.user_input and not body.audio_blob_b64:
        raise HTTPException(
            status_code=400,
            detail="user_input ou audio_blob_b64 requis",
        )

    redis = await _get_redis()
    state = await load_session(redis, session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session non trouvée ou expirée")
    if state.user_id != user.id:
        raise HTTPException(status_code=403, detail="Session non autorisée")

    user_text = body.user_input
    if body.audio_blob_b64 and not user_text:
        # V1.1 : Voxtral STT — non implémenté V1.0
        raise HTTPException(
            status_code=501,
            detail="STT non implémenté V1.0 (utilisez user_input)",
        )

    await append_turn(
        redis,
        session_id,
        TutorTurn(role="user", content=user_text, timestamp_ms=now_ms()),
    )

    state = await load_session(redis, session_id)
    system_prompt = build_tutor_system_prompt(
        concept_term=state.concept_term,
        concept_def=state.concept_def,
        source_video_title=state.source_video_title,
        lang=state.lang,
    )
    model = _select_magistral_model(user.plan)
    ai_response = await _call_magistral(system_prompt, state.turns, model)

    await append_turn(
        redis,
        session_id,
        TutorTurn(role="assistant", content=ai_response, timestamp_ms=now_ms()),
    )

    state = await load_session(redis, session_id)
    return SessionTurnResponse(
        ai_response=ai_response,
        audio_url=None,  # V1.1
        turn_count=len(state.turns),
    )


@router.post("/session/{session_id}/end", response_model=SessionEndResponse)
async def session_end(
    session_id: str,
    user: User = Depends(get_current_user),
):
    """P2.6 — Termine une session : durée, log analytics, supprime Redis."""
    _check_plan_access(user)

    redis = await _get_redis()
    state = await load_session(redis, session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session non trouvée ou expirée")
    if state.user_id != user.id:
        raise HTTPException(status_code=403, detail="Session non autorisée")

    duration_sec = max(0, (now_ms() - state.started_at_ms) // 1000)
    source_summary_url = (
        f"/dashboard?id={state.summary_id}" if state.summary_id else None
    )

    # TODO V1.1 : log AnalyticsEvent (tutor_session_ended, duration, turns, concept)
    logger.info(
        "[tutor] session %s ended user=%s duration=%ds turns=%d",
        session_id,
        user.id,
        duration_sec,
        len(state.turns),
    )

    await delete_session(redis, session_id)

    return SessionEndResponse(
        duration_sec=duration_sec,
        turns_count=len(state.turns),
        source_summary_url=source_summary_url,
        source_video_title=state.source_video_title,
    )
