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

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_session, VoiceSession, Summary, User
from auth.dependencies import get_current_user
from core.config import (
    VOICE_LIMITS,
    APP_URL,
    STRIPE_CONFIG,
    FRONTEND_URL,
    get_stripe_key,
)

from pydantic import BaseModel

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
)
from voice.elevenlabs import ElevenLabsClient, get_elevenlabs_client
from voice.tools import search_in_transcript, get_analysis_section, get_sources, get_flashcards
from voice.agent_types import get_agent_config, list_agent_types, AGENT_REGISTRY

logger = logging.getLogger(__name__)

router = APIRouter()


class AddonCheckoutRequest(BaseModel):
    pack_id: str


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
    """Create a new voice chat session linked to a video analysis.

    Supports multiple agent types: explorer, tutor, debate_moderator, quiz_coach, onboarding.
    Agent type determines the system prompt, tools, and voice style.
    """
    plan = current_user.plan or "free"

    # ── Resolve agent configuration ──────────────────────────────────────
    agent_config = get_agent_config(request.agent_type)

    # Check plan minimum for this agent type
    plan_order = {"free": 0, "pro": 1, "expert": 2}
    user_plan_level = plan_order.get(plan, 0)
    required_level = plan_order.get(agent_config.plan_minimum, 0)
    if user_plan_level < required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "agent_plan_required",
                "message": f"L'agent '{agent_config.display_name_fr}' nécessite le plan {agent_config.plan_minimum}+.",
                "action": "upgrade",
                "required_plan": agent_config.plan_minimum,
            },
        )

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

    # ── Verify summary ownership (skip for onboarding which has no summary) ──
    summary = None
    if agent_config.requires_summary:
        if not request.summary_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "summary_required",
                    "message": f"L'agent '{agent_config.display_name_fr}' nécessite un summary_id.",
                },
            )
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
    quota_info = await check_voice_quota(current_user.id, plan, db)
    if not quota_info["can_use"]:
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
        started_at=datetime.utcnow(),
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
        language = request.language or "fr"

        # ── Build context depending on agent type ────────────────────────
        context_block = ""
        rich_ctx = None

        if summary:
            from chat.context_builder import build_rich_context

            rich_ctx = await build_rich_context(summary, db, include_transcript=True, include_academic=True)
            context_block = rich_ctx.format_for_voice(language=language)

            logger.info(
                "Voice session: rich context assembled",
                extra={
                    "summary_id": request.summary_id,
                    "agent_type": agent_config.agent_type,
                    "transcript_strategy": rich_ctx.transcript_strategy,
                    "transcript_chars": len(rich_ctx.transcript),
                    "total_context_chars": rich_ctx.total_chars,
                    "formatted_chars": len(context_block),
                },
            )

        # ── Build system prompt from agent config + video context ────────
        if rich_ctx:
            # Agent with video context: combine agent prompt + video data
            system_prompt = (
                f"{agent_config.system_prompt}\n\n"
                f"--- CONTEXTE VIDÉO ---\n"
                f"Titre : {rich_ctx.video_title}\n"
                f"Chaîne : {rich_ctx.channel_name}\n"
                f"Durée : {rich_ctx.duration_str}\n\n"
                f"{context_block}"
            )
        else:
            # Agent without video context (onboarding)
            system_prompt = agent_config.system_prompt

        # Build webhook tools — filter to agent's allowed tools
        webhook_base_url = APP_URL.rstrip("/")
        tools_config = ElevenLabsClient.build_tools_config(
            webhook_base_url=webhook_base_url,
            api_token=str(request.summary_id or 0),
        )
        # Filter tools to only those allowed for this agent type
        if agent_config.tools:
            allowed_tool_names = set(agent_config.tools)
            tools_config = [
                t for t in tools_config
                if t.get("name", "") in allowed_tool_names
            ]

        # Get voice ID from config
        from core.config import _settings
        voice_id = _settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"  # Default: Rachel

        # ── Build first message from agent config ────────────────────────
        if language == "fr":
            first_message = agent_config.first_message_fr
        else:
            first_message = agent_config.first_message

        # Inject video title into first message if available
        if rich_ctx and rich_ctx.video_title and "{video_title}" not in first_message:
            # For explorer agent, personalize with video title
            if agent_config.agent_type == "explorer":
                first_message = (
                    f"Salut ! Je suis prêt à discuter de la vidéo « {rich_ctx.video_title} ». "
                    "Qu'est-ce que tu veux savoir ?"
                ) if language == "fr" else (
                    f"Hi! I'm ready to discuss the video \"{rich_ctx.video_title}\". "
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
            expires_at = datetime.fromisoformat(expires_at_iso.replace("Z", "+00:00")).replace(tzinfo=None)
        else:
            expires_at = datetime.utcnow() + timedelta(minutes=10)
    except (ValueError, TypeError):
        from datetime import timedelta
        expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Compute quota remaining
    max_session_minutes = plan_limits.get("max_session_minutes", 10)
    quota_remaining_seconds = quota_info.get("seconds_remaining", 0) if isinstance(quota_info, dict) else 0
    quota_remaining_minutes = round(quota_remaining_seconds / 60.0, 2)

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
    voice_session.ended_at = datetime.utcnow()
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


# ═══════════════════════════════════════════════════════════════════════════════
# GET /addon/packs — Available voice minute packs
# ═══════════════════════════════════════════════════════════════════════════════

# Pack definitions (id → {name, minutes, price_cents, currency})
VOICE_ADDON_PACKS = {
    "voice_10": {"name": "Pack Découverte", "minutes": 10, "price_cents": 199, "currency": "eur"},
    "voice_30": {"name": "Pack Standard", "minutes": 30, "price_cents": 499, "currency": "eur"},
    "voice_60": {"name": "Pack Pro", "minutes": 60, "price_cents": 899, "currency": "eur"},
}


@router.get("/addon/packs")
async def get_voice_addon_packs(
    current_user: User = Depends(get_current_user),
):
    """Retourne les packs de minutes vocales disponibles."""
    packs = [
        {"id": pack_id, **pack_info}
        for pack_id, pack_info in VOICE_ADDON_PACKS.items()
    ]
    return {"packs": packs}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /addon/checkout — Create Stripe checkout for voice pack
# ═══════════════════════════════════════════════════════════════════════════════

def _init_stripe() -> bool:
    """Initialise Stripe avec la bonne clé."""
    key = get_stripe_key()
    if key:
        stripe.api_key = key
        return True
    return False


@router.post("/addon/checkout")
async def create_voice_addon_checkout(
    request: AddonCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Crée une session Stripe Checkout pour l'achat d'un pack vocal."""
    pack_id = request.pack_id
    # Validate pack_id
    pack = VOICE_ADDON_PACKS.get(pack_id)
    if not pack:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_pack",
                "message": f"Unknown voice pack: {pack_id}. Valid packs: {', '.join(VOICE_ADDON_PACKS.keys())}",
            },
        )

    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "stripe_disabled", "message": "Stripe is not enabled."},
        )

    if not _init_stripe():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "stripe_not_configured", "message": "Stripe is not configured."},
        )

    # Create or retrieve Stripe customer
    if current_user.stripe_customer_id:
        customer_id = current_user.stripe_customer_id
    else:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.username or current_user.email,
            metadata={"user_id": str(current_user.id)},
        )
        customer_id = customer.id
        current_user.stripe_customer_id = customer_id
        await db.commit()

    success_url = f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&type=voice_addon&pack={pack_id}"
    cancel_url = f"{FRONTEND_URL}/payment/cancel"

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": pack["currency"],
                    "unit_amount": pack["price_cents"],
                    "product_data": {
                        "name": f"DeepSight — {pack['name']}",
                        "description": f"{pack['minutes']} minutes de chat vocal",
                    },
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "type": "voice_addon",
                "minutes": str(pack["minutes"]),
                "user_id": str(current_user.id),
                "pack_id": pack_id,
            },
        )

        logger.info(
            "Voice addon checkout created",
            extra={
                "user_id": current_user.id,
                "pack_id": pack_id,
                "minutes": pack["minutes"],
                "session_id": checkout_session.id,
            },
        )

        return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}

    except stripe.error.StripeError as e:
        logger.error("Stripe error creating voice addon checkout: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "stripe_error", "message": str(e)},
        )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /tools/* — ElevenLabs webhook tool endpoints (public, no auth)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/tools/search-transcript")
async def tool_search_transcript(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: search in video transcript."""
    body = await request.json()
    summary_id = body.get("summary_id") or body.get("parameters", {}).get("summary_id")
    query = body.get("query") or body.get("parameters", {}).get("query", "")
    result = await search_in_transcript(summary_id, query, db)
    return {"result": result}


@router.post("/tools/analysis-section")
async def tool_analysis_section(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: get a specific analysis section."""
    body = await request.json()
    summary_id = body.get("summary_id") or body.get("parameters", {}).get("summary_id")
    section = body.get("section") or body.get("parameters", {}).get("section", "resume")
    result = await get_analysis_section(summary_id, section, db)
    return {"result": result}


@router.post("/tools/sources")
async def tool_sources(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: get sources and fact-check info."""
    body = await request.json()
    summary_id = body.get("summary_id") or body.get("parameters", {}).get("summary_id")
    result = await get_sources(summary_id, db)
    return {"result": result}


@router.post("/tools/flashcards")
async def tool_flashcards(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: get flashcards for a video."""
    body = await request.json()
    summary_id = body.get("summary_id") or body.get("parameters", {}).get("summary_id")
    count = body.get("count") or body.get("parameters", {}).get("count", 5)
    result = await get_flashcards(summary_id, int(count), db)
    return {"result": result}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /agents/types — List available agent types
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/agents/types")
async def get_agent_types():
    """Return all available voice agent types with their descriptions and plan requirements."""
    return {
        "agent_types": list_agent_types(),
        "default": "explorer",
    }