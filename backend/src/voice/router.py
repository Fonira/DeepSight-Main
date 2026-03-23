"""
Voice Chat Router — ElevenLabs Conversational AI Integration

Endpoints:
  GET  /quota                                    — Voice quota info
  POST /session                                  — Create voice session
  POST /webhook                                  — ElevenLabs webhook (public)
  GET  /history/{summary_id}                     — Voice session history
  GET  /history/{summary_id}/{session_id}/transcript — Session transcript
"""

import hashlib
import hmac
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_session, VoiceSession, Summary, User
from auth.dependencies import get_current_user
from core.config import (
    VOICE_LIMITS,
    VOICE_CHAT_CONFIG,
    APP_URL,
)

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
from voice.elevenlabs import ElevenLabsClient, get_elevenlabs_client

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

    # Generate signed URL via ElevenLabs Conversational AI API
    try:
        # Load video context for the system prompt
        video_title = summary.video_title or "Vidéo sans titre"
        channel_name = summary.video_channel or "Chaîne inconnue"
        duration_secs = summary.video_duration or 0
        duration_str = f"{duration_secs // 60}min{duration_secs % 60:02d}s" if duration_secs else "inconnue"
        summary_content = summary.summary_content or ""

        # Truncate summary to avoid prompt overflow (keep first ~3000 chars)
        if len(summary_content) > 3000:
            summary_content = summary_content[:3000] + "\n\n[… résumé tronqué]"

        language = request.language or "fr"

        system_prompt = ElevenLabsClient.build_system_prompt(
            video_title=video_title,
            channel_name=channel_name,
            duration=duration_str,
            summary_content=summary_content,
            language=language,
        )

        # Build webhook tools — use APP_URL as the base for tool callbacks
        webhook_base_url = APP_URL.rstrip("/")
        tools_config = ElevenLabsClient.build_tools_config(
            webhook_base_url=webhook_base_url,
            api_token=str(request.summary_id),  # Session context for tool calls
        )

        # Get voice ID from config
        from core.config import _settings
        voice_id = _settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"  # Default: Rachel

        first_message = (
            f"Salut ! Je suis prêt à discuter de la vidéo « {video_title} ». "
            "Qu'est-ce que tu veux savoir ?"
        ) if language == "fr" else (
            f"Hi! I'm ready to discuss the video \"{video_title}\". "
            "What would you like to know?"
        )

        async with get_elevenlabs_client() as client:
            # Create the agent
            agent_id = await client.create_conversation_agent(
                system_prompt=system_prompt,
                tools=tools_config,
                voice_id=voice_id,
                first_message=first_message,
                language=language,
            )

            # Get the signed WebSocket URL
            signed_url, expires_at_iso = await client.get_signed_url(agent_id)

        # Update session with agent_id
        voice_session.elevenlabs_agent_id = agent_id
        voice_session.status = "active"
        await db.commit()

        logger.info(
            "Voice session started with ElevenLabs",
            extra={
                "session_id": voice_session.id,
                "agent_id": agent_id,
            },
        )

    except ValueError as exc:
        # Invalid API key or missing config
        logger.error("ElevenLabs config error: %s", exc)
        voice_session.status = "error"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "voice_service_unavailable",
                "message": "Voice service is not configured properly. Please try again later.",
            },
        )
    except Exception as exc:
        logger.error("ElevenLabs API error: %s", exc, exc_info=True)
        voice_session.status = "error"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "voice_service_error",
                "message": "Voice service is temporarily unavailable. Please try again later.",
            },
        )

    # Parse expires_at from ISO string, fallback to +10min
    try:
        from datetime import timedelta
        if expires_at_iso:
            expires_at = datetime.fromisoformat(expires_at_iso.replace("Z", "+00:00"))
        else:
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    except (ValueError, TypeError):
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    # Compute quota remaining
    max_session_minutes = plan_limits.get("max_session_minutes", 10)
    quota_remaining_minutes = quota_info.get("minutes_remaining", 0.0) if isinstance(quota_info, dict) else 0.0

    return VoiceSessionResponse(
        session_id=voice_session.id,
        signed_url=signed_url,
        expires_at=expires_at,
        quota_remaining_minutes=quota_remaining_minutes,
        max_session_minutes=max_session_minutes,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /webhook — ElevenLabs webhook (public, no auth)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/webhook", response_model=WebhookAckResponse)
async def voice_webhook(
    request: Request,
    db: AsyncSession = Depends(get_session),
):
    """
    Receive ElevenLabs webhook after a voice conversation ends.
    Public endpoint — no Bearer auth required.
    HMAC-SHA256 signature verification protects against spoofing.
    """
    # ── HMAC signature verification ──────────────────────────────────────
    from core.config import _settings
    webhook_secret = _settings.ELEVENLABS_WEBHOOK_SECRET

    raw_body = await request.body()

    if webhook_secret:
        signature_header = request.headers.get("X-ElevenLabs-Signature", "")
        if not signature_header:
            logger.warning("Voice webhook: missing X-ElevenLabs-Signature header")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "invalid_signature",
                    "message": "Missing webhook signature.",
                },
            )

        expected = hmac.new(
            webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, signature_header):
            logger.warning("Voice webhook: HMAC signature mismatch")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "invalid_signature",
                    "message": "Invalid webhook signature.",
                },
            )
    else:
        logger.debug("Voice webhook: HMAC verification skipped (no secret configured)")

    # ── Parse payload ────────────────────────────────────────────────────
    import json
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_payload",
                "message": "Invalid JSON payload.",
            },
        )

    payload = VoiceWebhookPayload(**body)

    # Find the voice session by conversation_id or metadata session_id
    session_query = None
    if payload.conversation_id:
        session_query = select(VoiceSession).where(
            VoiceSession.elevenlabs_conversation_id == payload.conversation_id
        )
    elif payload.metadata and payload.metadata.get("session_id"):
        session_query = select(VoiceSession).where(
            VoiceSession.id == payload.metadata["session_id"]
        )

    # Also try matching by agent_id if conversation_id didn't match
    if session_query is None and payload.agent_id:
        session_query = select(VoiceSession).where(
            VoiceSession.elevenlabs_agent_id == payload.agent_id,
            VoiceSession.status == "active",
        )

    if session_query is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "missing_session_identifier",
                "message": "No conversation_id, agent_id, or session_id provided in webhook payload.",
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
    voice_session.elevenlabs_conversation_id = payload.conversation_id
    voice_session.duration_seconds = payload.duration_seconds
    voice_session.status = payload.status or "completed"
    voice_session.ended_at = datetime.now(timezone.utc)
    if payload.transcript:
        voice_session.conversation_transcript = payload.transcript

    await db.commit()

    # Deduct voice usage
    minutes_deducted = (payload.duration_seconds or 0) / 60.0
    await deduct_voice_usage(
        voice_session.user_id,
        duration_seconds=payload.duration_seconds or 0,
        db=db,
    )

    logger.info(
        "Voice webhook processed",
        extra={
            "session_id": voice_session.id,
            "conversation_id": payload.conversation_id,
            "duration": payload.duration_seconds,
            "status": voice_session.status,
        },
    )

    return WebhookAckResponse(
        status="ok",
        session_id=voice_session.id,
        minutes_deducted=round(minutes_deducted, 2),
    )


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
    summary = result.scalar_one_or_none()
    if not summary:
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

    # Build session summaries
    from voice.schemas import VoiceSessionSummary
    session_summaries = [
        VoiceSessionSummary(
            session_id=s.id,
            started_at=s.started_at,
            ended_at=s.ended_at,
            duration_seconds=s.duration_seconds or 0,
            status=s.status or "unknown",
            has_transcript=bool(s.conversation_transcript),
        )
        for s in sessions
    ]

    total_seconds = sum(s.duration_seconds or 0 for s in sessions)

    return VoiceHistoryResponse(
        summary_id=summary_id,
        video_title=summary.video_title or "Vidéo sans titre",
        sessions=session_summaries,
        total_minutes=round(total_seconds / 60.0, 2),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /history/{summary_id}/{session_id}/transcript — Session transcript
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/history/{summary_id}/{session_id}/transcript",
    response_model=VoiceTranscriptResponse,
)
async def get_voice_transcript(
    summary_id: int,
    session_id: str,
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
        summary_id=summary_id,
        started_at=voice_session.started_at,
        duration_seconds=voice_session.duration_seconds or 0,
        transcript=voice_session.conversation_transcript,
    )
