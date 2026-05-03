"""
Router /api/tutor/* — Le Tuteur conversationnel (sessions Redis TTL 1h).

V1.0 : POST /session/start uniquement.
LLM = Magistral via llm_complete (auto-fallback). Voix V1.1 (audio_url=None).
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from db.database import User
from auth.dependencies import get_current_user
from core.plan_limits import check_feature_access
from core.llm_provider import llm_complete

from .schemas import (
    SessionStartRequest,
    SessionStartResponse,
    SessionTurnRequest,
    SessionTurnResponse,
    TutorSessionState,
    TutorTurn,
)
from .service import (
    create_session,
    append_turn,
    load_session,
    make_session_id,
    now_ms,
)
from .prompts import build_tutor_system_prompt, TUTOR_PERSONA_VERSION


logger = logging.getLogger(__name__)
router = APIRouter()


def _get_redis():
    """Get the shared Redis client from cache_service.

    Pattern actuel du projet : cache_service.backend.redis (cf. main.py:549).
    """
    from core.cache import cache_service

    if cache_service is None or cache_service.backend is None:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    redis = getattr(cache_service.backend, "redis", None)
    if redis is None:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    return redis


def _check_plan_access(user: User) -> None:
    """Bloque les users Free pour le Tuteur (companion_dialogue requis)."""
    allowed, _info = check_feature_access(user, "companion_dialogue", lang="fr")
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Cette fonctionnalité nécessite un plan Pro ou Expert.",
        )


def _select_magistral_model(user_plan: str) -> str:
    """Modèle Magistral selon plan. V1 : medium pour tous (large pas en config)."""
    # V1 simple : magistral-medium-2509 pour tous (Pro et Expert).
    # V2 : si magistral-large-* devient disponible, le router pour Expert.
    return "magistral-medium-2509"


def _extract_llm_content(llm_result) -> str:
    """Extrait le content du résultat llm_complete (LLMResult dataclass ou dict ou None)."""
    if llm_result is None:
        return ""
    # LLMResult dataclass : attribut .content
    content = getattr(llm_result, "content", None)
    if content is not None:
        return content
    # dict : clé "content"
    if isinstance(llm_result, dict):
        return llm_result.get("content", "")
    # fallback : str
    return str(llm_result)


@router.post("/session/start", response_model=SessionStartResponse)
async def session_start(
    body: SessionStartRequest,
    user: User = Depends(get_current_user),
):
    """Démarre une session Tutor : crée Redis + génère 1er prompt Magistral."""
    _check_plan_access(user)

    redis = _get_redis()

    # Créer la session
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

    # Générer 1er prompt Magistral via llm_complete
    system_prompt = build_tutor_system_prompt(
        concept_term=body.concept_term,
        concept_def=body.concept_def,
        source_video_title=body.source_video_title,
        lang=body.lang,
    )
    model = _select_magistral_model(user.plan)
    try:
        llm_result = await llm_complete(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "[START]"},  # signal pour générer le 1er prompt
            ],
            model=model,
            max_tokens=300,
            temperature=0.7,
        )
    except Exception as e:
        logger.exception("[tutor] llm_complete failed for session %s: %s", session_id, e)
        raise HTTPException(status_code=502, detail="LLM provider unavailable")

    first_prompt = _extract_llm_content(llm_result).strip()
    if not first_prompt:
        logger.error("[tutor] LLM returned empty content for session %s", session_id)
        raise HTTPException(status_code=502, detail="LLM returned empty response")

    # Persister le 1er turn assistant
    await append_turn(
        redis,
        session_id,
        TutorTurn(role="assistant", content=first_prompt, timestamp_ms=now_ms()),
    )

    # TTS V1.1 — placeholder None
    audio_url: Optional[str] = None
    if body.mode == "voice":
        # V1.1 : ElevenLabs TTS — pour l'instant on retourne None,
        # le client peut faire le TTS local s'il le souhaite.
        audio_url = None

    logger.info(
        "[tutor] session_start ok session_id=%s user_id=%s plan=%s mode=%s",
        session_id,
        user.id,
        user.plan,
        body.mode,
    )
    return SessionStartResponse(
        session_id=session_id,
        first_prompt=first_prompt,
        audio_url=audio_url,
    )


@router.post("/session/{session_id}/turn", response_model=SessionTurnResponse)
async def session_turn(
    session_id: str,
    body: SessionTurnRequest,
    user: User = Depends(get_current_user),
):
    """Un tour de conversation : user input -> IA response."""
    _check_plan_access(user)

    if not body.user_input and not body.audio_blob_b64:
        raise HTTPException(
            status_code=400,
            detail="user_input ou audio_blob_b64 requis",
        )

    redis = _get_redis()
    state = await load_session(redis, session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session non trouvée ou expirée")
    if state.user_id != user.id:
        raise HTTPException(status_code=403, detail="Session non autorisée")

    # STT si audio (V1.1)
    user_text = body.user_input
    if body.audio_blob_b64 and not user_text:
        # V1.1 : Voxtral STT
        raise HTTPException(
            status_code=501,
            detail="STT non implémenté V1.0 (use user_input)",
        )

    # Append user turn
    await append_turn(
        redis,
        session_id,
        TutorTurn(role="user", content=user_text, timestamp_ms=now_ms()),
    )

    # Reload to get full conversation
    state = await load_session(redis, session_id)
    system_prompt = build_tutor_system_prompt(
        concept_term=state.concept_term,
        concept_def=state.concept_def,
        source_video_title=state.source_video_title,
        lang=state.lang,
    )
    messages = [{"role": "system", "content": system_prompt}] + [
        {"role": t.role, "content": t.content} for t in state.turns
    ]
    model = _select_magistral_model(user.plan)

    try:
        llm_result = await llm_complete(
            messages=messages,
            model=model,
            max_tokens=300,
            temperature=0.7,
        )
    except Exception as e:
        logger.exception(
            "[tutor] llm_complete failed for turn session=%s: %s", session_id, e
        )
        raise HTTPException(status_code=502, detail="LLM provider unavailable")

    ai_response = _extract_llm_content(llm_result).strip()
    if not ai_response:
        logger.error(
            "[tutor] LLM returned empty content on turn session=%s", session_id
        )
        raise HTTPException(status_code=502, detail="LLM returned empty response")

    # Append assistant turn
    await append_turn(
        redis,
        session_id,
        TutorTurn(role="assistant", content=ai_response, timestamp_ms=now_ms()),
    )

    # TTS V1.1
    audio_url: Optional[str] = None

    # Reload pour avoir le turn count à jour
    state = await load_session(redis, session_id)

    logger.info(
        "[tutor] session_turn ok session_id=%s user_id=%s turns=%d",
        session_id,
        user.id,
        len(state.turns),
    )
    return SessionTurnResponse(
        ai_response=ai_response,
        audio_url=audio_url,
        turn_count=len(state.turns),
    )
