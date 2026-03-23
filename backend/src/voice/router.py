"""
Voice Chat Router — ElevenLabs Conversational AI Integration

Endpoints:
  GET  /quota                                    — Voice quota info
  POST /session                                  — Create voice session
  POST /webhook                                  — ElevenLabs webhook (public)
  GET  /history/{summary_id}                     — Voice session history
  GET  /history/{summary_id}/{session_id}/transcript — Session transcript
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_session, VoiceSession, Summary, User
from auth.dependencies import get_current_user
from core.config import VOICE_LIMITS, VOICE_CHAT_CONFIG

from voice.schemas import (
    VoiceSessionRequest,
    VoiceSessionResponse,
    VoiceQuotaResponse,
    VoiceWebhookPayload,
    WebhookAckResponse,
    VoiceHistoryResponse,
    VoiceTranscriptResponse,
)
from voice.quota import (
    get_voice_quota_info,
    check_voice_quota,
    deduct_voice_usage,
    get_or_create_voice_quota,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# GET /quota — Voice quota info
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/quota", response_model=VoiceQuotaResponse)
async def get_voice_quota(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Return voice chat quota information for the current user."""
    quota_info = await get_voice_quota_info(current_user.id, current_user.plan or "free", db)
    return quota_info


# ═══════════════════════════════════════════════════════════════════════════════
# POST /session — Create a voice session
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/session", response_model=VoiceSessionResponse)
async def create_voice_session(
    request: VoiceSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Create a new voice chat session linked to a video analysis."""
    plan = current_user.plan or "free"

    # Check plan has voice enabled
    plan_limits = VOICE_LIMITS.get(plan, VOICE_LIMITS.get("free", {}))
    if not plan_limits.get("enabled", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "voice_not_available",
                "message": "Voice chat is not available on your current plan.",
                "action": "upgrade",
            },
        )

    # Verify summary ownership
    result = await db.execute(
        select(Summary).where(
            Summary.id == request.summary_id,
            Summary.user_id == current_user.id,
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "summary_not_found",
                "message": "Analysis not found or does not belong to you.",
            },
        )

    # Check voice quota
    can_use, quota_info = await check_voice_quota(current_user.id, plan, db)
    if not can_use:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "voice_quota_exceeded",
                "message": "Voice chat quota exceeded for today.",
                **quota_info,
            },
        )

    # Create voice session in DB
    voice_session = VoiceSession(
        user_id=current_user.id,
        summary_id=request.summary_id,
        status="pending",
        started_at=datetime.now(timezone.utc),
    )
    db.add(voice_session)
    await db.commit()
    await db.refresh(voice_session)

    logger.info(
        "Voice session created",
        extra={
            "user_id": current_user.id,
            "summary_id": request.summary_id,
            "session_id": voice_session.id,
        },
    )

    # TODO: Phase 2 — Generate signed URL via ElevenLabs Conversational AI API
    signed_url = "TODO_ELEVENLABS_INTEGRATION"

    return VoiceSessionResponse(
        session_id=voice_session.id,
        signed_url=signed_url,
        status=voice_session.status,
        started_at=voice_session.started_at,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /webhook — ElevenLabs webhook (public, no auth)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/webhook", response_model=WebhookAckResponse)
async def voice_webhook(
    payload: VoiceWebhookPayload,
    db: AsyncSession = Depends(get_session),
):
    """
    Receive ElevenLabs webhook after a voice conversation ends.
    Public endpoint — no Bearer auth required.
    """
    # TODO: Phase 2 — Verify HMAC signature from ElevenLabs

    # Find the voice session by elevenlabs_conversation_id or metadata session_id
    session_query = None
    if payload.elevenlabs_conversation_id:
        session_query = select(VoiceSession).where(
            VoiceSession.elevenlabs_conversation_id == payload.elevenlabs_conversation_id
        )
    elif payload.metadata and payload.metadata.get("session_id"):
        session_query = select(VoiceSession).where(
            VoiceSession.id == int(payload.metadata["session_id"])
        )

    if session_query is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "missing_session_identifier",
                "message": "No conversation_id or session_id provided in webhook payload.",
            },
        )

    result = await db.execute(session_query)
    voice_session = result.scalar_one_or_none()

    if not voice_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "session_not_found",
                "message": "Voice session not found.",
            },
        )

    # Update session with webhook data
    voice_session.duration_seconds = payload.duration_seconds
    voice_session.status = payload.status or "completed"
    voice_session.ended_at = datetime.now(timezone.utc)
    if payload.conversation_transcript:
        voice_session.conversation_transcript = payload.conversation_transcript

    await db.commit()

    # Deduct voice usage
    await deduct_voice_usage(
        voice_session.user_id,
        duration_seconds=payload.duration_seconds or 0,
        db=db,
    )

    logger.info(
        "Voice webhook processed",
        extra={
            "session_id": voice_session.id,
            "duration": payload.duration_seconds,
            "status": voice_session.status,
        },
    )

    return WebhookAckResponse(status="ok", session_id=voice_session.id)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /history/{summary_id} — Voice session history
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/history/{summary_id}", response_model=VoiceHistoryResponse)
async def get_voice_history(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Get all voice sessions for a given analysis."""
    # Verify summary ownership
    result = await db.execute(
        select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "summary_not_found",
                "message": "Analysis not found or does not belong to you.",
            },
        )

    # Query voice sessions
    result = await db.execute(
        select(VoiceSession)
        .where(
            VoiceSession.user_id == current_user.id,
            VoiceSession.summary_id == summary_id,
        )
        .order_by(VoiceSession.started_at.desc())
    )
    sessions = result.scalars().all()

    return VoiceHistoryResponse(sessions=sessions)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /history/{summary_id}/{session_id}/transcript — Session transcript
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/history/{summary_id}/{session_id}/transcript",
    response_model=VoiceTranscriptResponse,
)
async def get_voice_transcript(
    summary_id: int,
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Get the transcript of a specific voice session."""
    # Verify summary ownership
    result = await db.execute(
        select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "summary_not_found",
                "message": "Analysis not found or does not belong to you.",
            },
        )

    # Get the voice session
    result = await db.execute(
        select(VoiceSession).where(
            VoiceSession.id == session_id,
            VoiceSession.user_id == current_user.id,
            VoiceSession.summary_id == summary_id,
        )
    )
    voice_session = result.scalar_one_or_none()

    if not voice_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "session_not_found",
                "message": "Voice session not found.",
            },
        )

    if not voice_session.conversation_transcript:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "transcript_not_found",
                "message": "No transcript available for this voice session.",
            },
        )

    return VoiceTranscriptResponse(
        session_id=voice_session.id,
        transcript=voice_session.conversation_transcript,
        duration_seconds=voice_session.duration_seconds,
    )
