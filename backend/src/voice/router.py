"""
Voice Chat Router — ElevenLabs Conversational AI Integration

Endpoints:
  GET  /quota                                    — Voice quota info
  POST /session                                  — Create voice session
  POST /transcripts/append                       — Persist one voice turn (Spec #1)
  POST /webhook                                  — ElevenLabs webhook (public)
  GET  /history/{summary_id}                     — Voice session history
  GET  /history/{summary_id}/{session_id}/transcript — Session transcript
"""

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime

import stripe
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_session, VoiceSession, Summary, User, DebateAnalysis
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
    VoicePreferencesRequest,
    VoicePreferencesResponse,
    VoiceCatalogResponse,
    VoiceCatalogEntry,
    VoiceThumbnailResponse,
    VoiceThumbnailGradient,
    TranscriptAppendRequest,
    TranscriptAppendResponse,
)
from voice.quota import (
    get_voice_quota_info,
    check_voice_quota,
    deduct_voice_usage,
)
from voice.elevenlabs import ElevenLabsClient, get_elevenlabs_client
from voice.streaming_orchestrator import (
    create_default_orchestrator,
    PUBSUB_CHANNEL_PREFIX,
)
from billing.voice_quota import (
    check_voice_quota as check_voice_quota_streaming,
)
from voice.tools import search_in_transcript, get_analysis_section, get_sources, get_flashcards
from voice.web_tools import web_search, deep_research, check_fact
from voice.agent_types import get_agent_config, list_agent_types
from voice.debate_tools import (
    get_debate_overview,
    get_video_thesis,
    get_argument_comparison,
    search_in_debate_transcript,
    get_debate_fact_check,
)
from voice.avatar import (
    get_debate_avatar_url,
    ensure_debate_avatar,
    generate_debate_avatar,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Rate limiting (Spec #0): per-summary AND per-user caps with Redis INCR + TTL.
# In-memory dicts are used when Redis is unavailable.
_web_search_counts: dict[str, int] = {}
_user_web_search_counts: dict[int, int] = {}
_WEB_SEARCH_MAX = 15  # per summary_id per hour (raised from 5 in Spec #0)
_WEB_SEARCH_USER_MAX = 60  # per user_id per hour (Spec #0 global cap)
_WEB_SEARCH_TTL = 3600  # 1 hour


async def _redis_incr_with_ttl(redis_key: str, ttl: int) -> int | None:
    """Run an INCR + EXPIRE pair on the shared Redis backend.

    Returns the post-increment count or ``None`` if Redis is unavailable
    (callers should fall back to their in-memory dict).
    """
    try:
        from core.cache import cache_service

        if not cache_service._redis_available:
            return None
        redis_client = cache_service.backend.redis
        full_key = f"deepsight:{redis_key}"
        count = await redis_client.incr(full_key)
        if count == 1:
            await redis_client.expire(full_key, ttl)
        return count
    except Exception as exc:
        logger.warning("Redis INCR failed for %s, falling back to in-memory: %s", redis_key, exc)
        return None


async def _increment_web_search_count(summary_id: str) -> int:
    """Increment and return the web search count for a summary_id.

    Uses Redis INCR with TTL when available, falls back to the in-memory dict.
    Returns the count *after* incrementing.
    """
    count = await _redis_incr_with_ttl(f"voice:websearch:{summary_id}", _WEB_SEARCH_TTL)
    if count is not None:
        return count

    # In-memory fallback
    current = _web_search_counts.get(summary_id, 0) + 1
    _web_search_counts[summary_id] = current
    return current


async def _increment_user_web_search_count(user_id: int) -> int:
    """Increment and return the per-user web search count.

    Independent of summary_id so a user can't fan out across many videos.
    """
    count = await _redis_incr_with_ttl(f"voice:websearch:user:{user_id}", _WEB_SEARCH_TTL)
    if count is not None:
        return count

    current = _user_web_search_counts.get(user_id, 0) + 1
    _user_web_search_counts[user_id] = current
    return current


# ═══════════════════════════════════════════════════════════════════════════════
# Quick Voice Call (V1) — Streaming context SSE + Redis pubsub plumbing
# ═══════════════════════════════════════════════════════════════════════════════
#
# `get_streaming_redis` returns the shared async Redis client used as pubsub
# fan-out for `voice:ctx:{session_id}` events. Falls back to None when Redis
# isn't configured (local dev) — the SSE endpoint surfaces a 503 in that
# case so the side panel can decide how to degrade.


async def get_streaming_redis() -> "object | None":
    """Return the shared async Redis client (or None when unavailable).

    Used by the Quick Voice Call streaming endpoints. Distinct from the
    legacy `cache_service` accessor pattern so this dependency stays
    overridable in tests via FastAPI dependency_overrides.
    """
    try:
        from core.cache import cache_service

        if cache_service._redis_available and cache_service.backend is not None:
            return cache_service.backend.redis
    except Exception as exc:  # noqa: BLE001
        logger.warning("Quick Voice Call: Redis unavailable for SSE pubsub: %s", exc)
    return None


async def _get_voice_session(session_id: str, db: AsyncSession) -> VoiceSession | None:
    """Fetch a voice session by ID (None if not found)."""
    result = await db.execute(select(VoiceSession).where(VoiceSession.id == session_id))
    return result.scalar_one_or_none()


@router.get("/context/stream")
async def stream_video_context(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    redis=Depends(get_streaming_redis),
) -> StreamingResponse:
    """Server-Sent Events stream of progressive video context for a Quick
    Voice Call session.

    Subscribes to Redis pubsub channel ``voice:ctx:{session_id}`` and
    forwards every event as ``event: <type>\\ndata: <json>\\n\\n``. The
    stream terminates after a ``ctx_complete`` event is forwarded.

    Auth + IDOR :
      * 401 if no JWT (handled by `get_current_user`)
      * 404 if session does not exist
      * 403 if session.user_id != user.id (no info leak via 404 vs 403)

    Events emitted (per spec § c) :
      * transcript_chunk : {chunk_index, text, total_chunks}
      * analysis_partial : {section, content}
      * error            : {phase, message}
      * ctx_complete     : {final_digest_summary}
    """
    session = await _get_voice_session(session_id, db)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice session not found")
    if session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if redis is None:
        # Streaming context requires Redis pubsub; fail loud so the side
        # panel can fall back to web_search-only mode (per spec risk table).
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Streaming context backend (Redis pubsub) is unavailable",
        )

    channel = f"{PUBSUB_CHANNEL_PREFIX}{session_id}"

    async def event_generator():
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                # Skip the subscribe ack and any non-message entries
                if message.get("type") != "message":
                    continue
                raw = message.get("data")
                if isinstance(raw, (bytes, bytearray)):
                    raw = raw.decode("utf-8", errors="replace")
                try:
                    event = json.loads(raw)
                except (TypeError, ValueError):
                    logger.warning("Voice ctx stream: dropped malformed pubsub payload on %s", channel)
                    continue
                event_type = event.get("type", "message")
                yield f"event: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event_type == "ctx_complete":
                    break
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception as unsub_exc:  # noqa: BLE001 — unsub is best-effort
                logger.debug("Voice ctx stream unsubscribe failed for %s: %s", channel, unsub_exc)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Spec #1, Task 7 — Rate limit for /transcripts/append ───────────────────
# 60 calls / minute per voice_session_id. The cap is generous: a single voice
# turn is short, but the frontend may emit several events per turn (interim,
# final, agent reply). The Redis TTL guarantees per-minute reset.
_transcript_append_counts: dict[str, int] = {}
_TRANSCRIPT_APPEND_MAX = 60
_TRANSCRIPT_APPEND_TTL = 60  # 1 minute


async def _increment_transcript_append_count(voice_session_id: str) -> int:
    """Increment and return the count of /transcripts/append calls for a session.

    Uses Redis INCR with TTL when available, falls back to the in-memory dict.
    """
    count = await _redis_incr_with_ttl(
        f"voice:transcript_append:{voice_session_id}",
        _TRANSCRIPT_APPEND_TTL,
    )
    if count is not None:
        return count

    current = _transcript_append_counts.get(voice_session_id, 0) + 1
    _transcript_append_counts[voice_session_id] = current
    return current


# ── Spec #1, Task 8 — Webhook reconciliation post-call ─────────────────────
# Drift threshold: a row is considered drifted (and gets UPDATEd) when the
# normalised character-length difference exceeds 10% of the longer string.
_RECONCILE_DRIFT_THRESHOLD = 0.10


def parse_transcript_canonical(transcript) -> list[dict]:
    """Parse the ElevenLabs canonical transcript payload into structured turns.

    Accepts:
      - str  → "User: ...\\nAI: ..." multi-line format (older payloads)
      - list → [{"role": "user", "message": "..."}, ...]   (newer payloads)
      - None or empty → []

    Returns: ``[{"speaker": "user"|"agent", "content": str}, ...]``
    """
    if not transcript:
        return []

    # ── Newer ElevenLabs payloads ship the transcript as a list of dicts ──
    if isinstance(transcript, list):
        out: list[dict] = []
        for item in transcript:
            if not isinstance(item, dict):
                continue
            role = (item.get("role") or item.get("speaker") or "").lower()
            content = (item.get("message") or item.get("content") or "").strip()
            if not content:
                continue
            speaker = "agent" if role in ("agent", "assistant", "ai") else "user"
            out.append({"speaker": speaker, "content": content})
        return out

    if not isinstance(transcript, str):
        return []

    if not transcript.strip():
        return []

    # ── Legacy text format: 'User:' / 'AI:' / 'Assistant:' line prefixes ──
    out: list[dict] = []
    for raw_line in transcript.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        prefix, _, content = line.partition(":")
        prefix_norm = prefix.strip().lower()
        content = content.strip()
        if not content:
            continue
        if prefix_norm in ("ai", "assistant", "agent"):
            speaker = "agent"
        elif prefix_norm in ("user", "human"):
            speaker = "user"
        else:
            continue  # Unknown prefix → skip rather than misclassify.
        out.append({"speaker": speaker, "content": content})
    return out


def _content_drift_above_threshold(a: str, b: str) -> bool:
    """Return True iff the two strings differ enough to warrant an UPDATE.

    Heuristic (deliberately simple): normalised character-length difference
    above 10% of the longer string.
    """
    if a == b:
        return False
    longer = max(len(a), len(b))
    if longer == 0:
        return False
    diff = abs(len(a) - len(b))
    return (diff / longer) > _RECONCILE_DRIFT_THRESHOLD


async def reconcile_voice_transcript(
    db,
    *,
    voice_session_id: str,
    user_id: int,
    summary_id: int | None,
    canonical_turns: list[dict],
) -> dict:
    """Reconcile the canonical transcript with already-persisted rows.

    Strategy (positional alignment):
      - INSERT any canonical turn beyond what was persisted live.
      - UPDATE in-place when content drift exceeds the threshold.
      - Otherwise: leave the row as-is (no spurious writes).

    Returns ``{"inserted": int, "updated": int}``.
    """
    if not canonical_turns:
        return {"inserted": 0, "updated": 0}

    from db.database import ChatMessage

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.voice_session_id == voice_session_id)
        .order_by(
            ChatMessage.time_in_call_secs.asc().nulls_last()
            if hasattr(ChatMessage.time_in_call_secs, "asc")
            else ChatMessage.time_in_call_secs,
            ChatMessage.created_at.asc(),
        )
    )
    existing = list(result.scalars().all())

    inserted = 0
    updated = 0

    for idx, turn in enumerate(canonical_turns):
        speaker = turn.get("speaker", "user")
        content = (turn.get("content") or "").strip()
        if not content:
            continue

        if idx < len(existing):
            row = existing[idx]
            if _content_drift_above_threshold(row.content or "", content):
                row.content = content
                row.voice_speaker = speaker
                row.role = "user" if speaker == "user" else "assistant"
                updated += 1
        else:
            db.add(
                ChatMessage(
                    user_id=user_id,
                    summary_id=summary_id,
                    role="user" if speaker == "user" else "assistant",
                    content=content,
                    source="voice",
                    voice_session_id=voice_session_id,
                    voice_speaker=speaker,
                    time_in_call_secs=None,  # canonical does not carry timing
                )
            )
            inserted += 1

    if inserted or updated:
        try:
            await db.commit()
        except Exception as exc:
            logger.warning(
                "reconcile_voice_transcript: commit failed (non-fatal)",
                extra={
                    "voice_session_id": voice_session_id,
                    "inserted": inserted,
                    "updated": updated,
                    "error": str(exc),
                },
            )
            try:
                await db.rollback()
            except Exception:
                pass

    return {"inserted": inserted, "updated": updated}


# ── Spec #1, Task 6 — Chat history injection into voice system_prompt ──────
# v4.0 : élargi pour donner plus de continuité conversationnelle au voice agent.
#   max 20 messages, max 600 chars per message → ~12 KB block worst case.
_CHAT_HISTORY_MAX_MESSAGES = 20
_CHAT_HISTORY_MAX_CHARS_PER_MSG = 600


def _build_chat_history_block_for_voice(history_msgs: list[dict], language: str = "fr") -> str:
    """Format the recent text-chat history as a block injectable into the
    voice agent's system prompt.

    The block lets the voice agent continue an in-progress text conversation
    instead of starting fresh ("Spec #1, Task 6 — chat history injection").

    Voice rows (``msg.get("source") == "voice"``) are skipped because they
    are already reflected in the active voice session — re-injecting them
    would duplicate context. When ``source`` is missing (legacy rows), the
    row is kept (defensive default before Task 9 backfills the column).

    Returns "" when there are no usable rows so callers can `+= block` safely.
    """
    if not history_msgs:
        return ""

    # Keep the last N messages only (chronological order — list assumed sorted
    # oldest → newest by chat.service.get_chat_history's `reversed(...)`).
    trimmed = history_msgs[-_CHAT_HISTORY_MAX_MESSAGES:]

    # Drop voice rows: they belong to the active voice session, not the
    # text-chat continuity we're re-injecting (Spec #1, Task 6 + Task 9).
    trimmed = [m for m in trimmed if m.get("source") != "voice"]
    if not trimmed:
        return ""

    if language == "en":
        header = "## Recent text chat history\n"
        user_label = "User"
        assistant_label = "You"
        footer = "\nContinue this conversation in the same vein.\n"
    else:
        header = "## Historique récent du chat texte\n"
        user_label = "Utilisateur"
        assistant_label = "Toi"
        footer = "\nContinue dans la lignée de cette conversation.\n"

    lines: list[str] = [header]
    for msg in trimmed:
        role = msg.get("role", "user")
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        if len(content) > _CHAT_HISTORY_MAX_CHARS_PER_MSG:
            content = content[: _CHAT_HISTORY_MAX_CHARS_PER_MSG - 1] + "…"
        label = assistant_label if role == "assistant" else user_label
        lines.append(f"- {label}: {content}")
    lines.append(footer)
    return "\n".join(lines)


async def record_web_search_usage(
    db: AsyncSession,
    *,
    user_id: int,
    summary_id: int,
    source: str,
    query: str,
) -> None:
    """Track a successful web_search invocation in WebSearchUsage.

    Mirrors the chat router pattern (see videos/service.py:increment_web_search_usage)
    and adds a structured log line so we can attribute calls to voice vs chat.
    """
    from videos.service import increment_web_search_usage

    try:
        await increment_web_search_usage(db, user_id)
    except Exception as exc:
        logger.warning(
            "record_web_search_usage failed",
            extra={
                "user_id": user_id,
                "summary_id": summary_id,
                "source": source,
                "error": str(exc),
            },
        )

    logger.info(
        "web_search_usage_recorded",
        extra={
            "user_id": user_id,
            "summary_id": summary_id,
            "source": source,
            "query": query[:200],
        },
    )


async def _check_monthly_web_quota(db: AsyncSession, user_id: int) -> tuple[bool, int, int]:
    """Check the shared monthly web_search quota (chat + voice).

    Returns (can_search, used, limit). On any DB error, fails open (True, 0, -1)
    so a transient hiccup doesn't break a live voice session.
    """
    try:
        from chat.service import check_web_search_quota

        return await check_web_search_quota(db, user_id)
    except Exception as exc:
        logger.warning(
            "monthly web_search quota check failed — failing open",
            extra={"user_id": user_id, "error": str(exc)},
        )
        return True, 0, -1


async def verify_tool_request(request: Request, db: AsyncSession) -> tuple[Summary, dict]:
    """Verify an ElevenLabs tool webhook request.

    Checks:
    1. Authorization header is present with a Bearer token.
    2. The request body contains a summary_id.
    3. The Bearer token matches the summary_id (ElevenLabs sends summary_id as token).
    4. The summary exists in the database.

    Returns (Summary, parsed_body) or raises HTTPException 401/404.
    """
    # 1. Extract Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_auth", "message": "Missing or invalid Authorization header."},
        )
    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_auth", "message": "Empty Bearer token."},
        )

    # 2. Parse body and extract summary_id
    body = await request.json()
    summary_id = body.get("summary_id") or body.get("parameters", {}).get("summary_id")
    if not summary_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_summary_id", "message": "No summary_id in request body."},
        )

    # 3. Token must match summary_id
    if str(summary_id) != str(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_mismatch", "message": "Bearer token does not match summary_id."},
        )

    # 4. Summary must exist in DB
    result = await db.execute(select(Summary).where(Summary.id == int(summary_id)))
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "summary_not_found", "message": "Summary not found."},
        )

    return summary, body


async def verify_debate_tool_request(request: Request, db: AsyncSession) -> tuple[DebateAnalysis, dict]:
    """Verify an ElevenLabs webhook request targeting a DebateAnalysis.

    Same contract as verify_tool_request but for debate_id tokens.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_auth", "message": "Missing or invalid Authorization header."},
        )
    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_auth", "message": "Empty Bearer token."},
        )

    body = await request.json()
    debate_id = body.get("debate_id") or body.get("parameters", {}).get("debate_id")
    if not debate_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_debate_id", "message": "No debate_id in request body."},
        )

    if str(debate_id) != str(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_mismatch", "message": "Bearer token does not match debate_id."},
        )

    result = await db.execute(select(DebateAnalysis).where(DebateAnalysis.id == int(debate_id)))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "debate_not_found", "message": "Debate not found."},
        )

    return debate, body


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
# GET /preferences — Get user voice preferences
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/preferences", response_model=VoicePreferencesResponse)
async def get_voice_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Return the current user's voice preferences (speed, voice, model, etc.)."""
    from voice.preferences import get_user_voice_preferences

    prefs = await get_user_voice_preferences(current_user.id, db)
    return VoicePreferencesResponse(
        voice_id=prefs.voice_id,
        voice_name=prefs.voice_name,
        speed=prefs.speed,
        stability=prefs.stability,
        similarity_boost=prefs.similarity_boost,
        style=prefs.style,
        use_speaker_boost=prefs.use_speaker_boost,
        tts_model=prefs.tts_model,
        voice_chat_model=prefs.voice_chat_model,
        language=prefs.language,
        gender=prefs.gender,
        input_mode=prefs.input_mode,
        ptt_key=prefs.ptt_key,
        interruptions_enabled=prefs.interruptions_enabled,
        turn_eagerness=prefs.turn_eagerness,
        voice_chat_speed_preset=prefs.voice_chat_speed_preset,
        turn_timeout=prefs.turn_timeout,
        soft_timeout_seconds=prefs.soft_timeout_seconds,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PUT /preferences — Update user voice preferences
# ═══════════════════════════════════════════════════════════════════════════════


@router.put("/preferences", response_model=VoicePreferencesResponse)
async def update_voice_preferences(
    request: VoicePreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Update the current user's voice preferences. Only provided fields are updated."""
    from voice.preferences import get_user_voice_preferences, save_user_voice_preferences, CATALOG_VOICE_IDS

    # Load current preferences
    prefs = await get_user_voice_preferences(current_user.id, db)

    # Validate voice_id against catalog if provided
    if request.voice_id is not None and request.voice_id not in CATALOG_VOICE_IDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_voice_id",
                "message": "Voice ID inconnu. Utilisez GET /api/voice/catalog pour la liste.",
            },
        )

    # Apply only non-None fields (partial update)
    update_data = request.model_dump(exclude_none=True)
    for field_name, value in update_data.items():
        setattr(prefs, field_name, value)

    # Save
    await save_user_voice_preferences(current_user.id, prefs, db)

    logger.info(
        "Voice preferences updated",
        extra={
            "user_id": current_user.id,
            "updated_fields": list(update_data.keys()),
        },
    )

    return VoicePreferencesResponse(
        voice_id=prefs.voice_id,
        voice_name=prefs.voice_name,
        speed=prefs.speed,
        stability=prefs.stability,
        similarity_boost=prefs.similarity_boost,
        style=prefs.style,
        use_speaker_boost=prefs.use_speaker_boost,
        tts_model=prefs.tts_model,
        voice_chat_model=prefs.voice_chat_model,
        language=prefs.language,
        gender=prefs.gender,
        input_mode=prefs.input_mode,
        ptt_key=prefs.ptt_key,
        interruptions_enabled=prefs.interruptions_enabled,
        turn_eagerness=prefs.turn_eagerness,
        voice_chat_speed_preset=prefs.voice_chat_speed_preset,
        turn_timeout=prefs.turn_timeout,
        soft_timeout_seconds=prefs.soft_timeout_seconds,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /catalog — Voice catalog (available voices + speed presets + models)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/catalog", response_model=VoiceCatalogResponse)
async def get_voice_catalog():
    """Return the full ElevenLabs voice catalog, speed presets, and available models."""
    from voice.preferences import VOICE_CATALOG, SPEED_PRESETS, VOICE_CHAT_SPEED_PRESETS

    voices = [VoiceCatalogEntry(**v) for v in VOICE_CATALOG]

    models = [
        {
            "id": "eleven_multilingual_v2",
            "name": "Multilingual v2",
            "description_fr": "Qualité maximale — toutes les langues",
            "description_en": "Highest quality — all languages",
            "latency": "high",
            "recommended_for": "tts",
        },
        {
            "id": "eleven_flash_v2_5",
            "name": "Flash v2.5",
            "description_fr": "Équilibré — bonne qualité, faible latence",
            "description_en": "Balanced — good quality, low latency",
            "latency": "low",
            "recommended_for": "voice_chat",
        },
        {
            "id": "eleven_turbo_v2_5",
            "name": "Turbo v2.5",
            "description_fr": "Ultra-rapide — ~300ms, idéal voice chat",
            "description_en": "Ultra-fast — ~300ms, ideal for voice chat",
            "latency": "lowest",
            "recommended_for": "voice_chat",
        },
    ]

    return VoiceCatalogResponse(
        voices=voices,
        speed_presets=SPEED_PRESETS,
        voice_chat_speed_presets=VOICE_CHAT_SPEED_PRESETS,
        models=models,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /session — Create a voice session
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/session", response_model=VoiceSessionResponse)
async def create_voice_session(
    request: VoiceSessionRequest,
    background_tasks: BackgroundTasks = None,  # type: ignore[assignment]
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    redis=Depends(get_streaming_redis),
):
    """Create a new voice chat session linked to a video analysis.

    Supports multiple agent types: explorer, tutor, debate_moderator, quiz_coach, onboarding.
    Agent type determines the system prompt, tools, and voice style.

    Quick Voice Call (V1) — when ``request.is_streaming=True``:
      * ``video_id`` is required (the YouTube ID being explored).
      * Voice quota uses the A+D strict matrix (Free 1-shot trial / Pro CTA
        upgrade / Expert 30 min monthly) instead of the legacy seconds counter.
      * The streaming orchestrator is launched as a background task to push
        transcript + analysis events onto the Redis pubsub channel
        ``voice:ctx:{session_id}``.
    """
    plan = current_user.plan or "free"

    # ── Admin bypass — skip all plan/quota checks ────────────────────────
    from core.config import ADMIN_CONFIG

    admin_email = ADMIN_CONFIG.get("ADMIN_EMAIL", "").lower()
    is_admin = current_user.is_admin or (current_user.email or "").lower() == admin_email

    # ── Resolve agent configuration ──────────────────────────────────────
    agent_config = get_agent_config(request.agent_type)

    # ── Quick Voice Call (V1) — streaming session quota branch ──────────
    streaming_quota = None
    if request.is_streaming:
        if not request.video_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "video_id_required",
                    "message": "video_id required for streaming sessions",
                },
            )
        if not is_admin:
            streaming_quota = await check_voice_quota_streaming(current_user, db)
            if not streaming_quota.allowed:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail={
                        "code": "voice_quota_blocked",
                        "reason": streaming_quota.reason,
                        "cta": streaming_quota.cta,
                        "message": (
                            "Voice call not available on your plan."
                            if streaming_quota.reason == "pro_no_voice"
                            else "Voice trial already used — upgrade to continue."
                            if streaming_quota.reason == "trial_used"
                            else "Monthly voice quota exhausted."
                        ),
                    },
                )

    # Check plan minimum for this agent type — skip for streaming because
    # the A+D quota above already enforced plan gating with a structured 402.
    if not is_admin and not request.is_streaming:
        plan_order = {
            "free": 0,
            "etudiant": 1,
            "starter": 1,
            "student": 1,  # Legacy aliases → pro
            "pro": 1,
            "equipe": 1,
            "team": 1,
            "unlimited": 1,  # Legacy aliases → pro
            "expert": 1,  # Maps to pro
        }
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

    # Check plan has voice enabled — skip for streaming sessions which use
    # the new A+D quota model (legacy VOICE_LIMITS doesn't know about the
    # Free 1-shot trial).
    plan_limits = VOICE_LIMITS.get(plan, VOICE_LIMITS.get("free", {}))
    if not is_admin and not request.is_streaming:
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

    # Verify debate ownership (for agents requiring a debate)
    debate = None
    if getattr(agent_config, "requires_debate", False):
        if not request.debate_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "debate_required",
                    "message": f"L'agent '{agent_config.display_name_fr}' nécessite un debate_id.",
                },
            )
        result = await db.execute(
            select(DebateAnalysis).where(
                DebateAnalysis.id == request.debate_id,
                DebateAnalysis.user_id == current_user.id,
            )
        )
        debate = result.scalar_one_or_none()
        if not debate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "debate_not_found",
                    "message": "Debate not found or does not belong to you.",
                },
            )

    # Check voice quota — legacy seconds counter for non-streaming sessions
    # only; streaming sessions are gated above by check_voice_quota_streaming.
    if request.is_streaming:
        quota_info = {
            "can_use": True,
            "seconds_remaining": int((streaming_quota.max_minutes if streaming_quota else 30.0) * 60),
            "seconds_used": 0,
            "seconds_limit": int((streaming_quota.max_minutes if streaming_quota else 30.0) * 60),
            "bonus_seconds": 0,
            "warning_level": None,
        }
    else:
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
        debate_id=request.debate_id,
        agent_type=agent_config.agent_type,
        is_streaming_session=bool(request.is_streaming),
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
            "is_streaming": bool(request.is_streaming),
        },
    )

    # ── Quick Voice Call (V1) — launch streaming orchestrator ────────────
    # Background task fans out transcript + Mistral analysis events on
    # voice:ctx:{session_id} for the SSE endpoint to forward.
    if request.is_streaming and request.video_id and background_tasks is not None and redis is not None:
        orchestrator = create_default_orchestrator(redis=redis)
        background_tasks.add_task(
            orchestrator.run,
            session_id=voice_session.id,
            video_id=request.video_id,
            user_id=current_user.id,
        )
        logger.info(
            "Quick Voice Call orchestrator scheduled",
            extra={
                "session_id": voice_session.id,
                "video_id": request.video_id,
                "user_id": current_user.id,
            },
        )

    # Generate signed URL via ElevenLabs Conversational AI API
    try:
        language = request.language or "fr"

        # ── Build context depending on agent type ────────────────────────
        context_block = ""
        rich_ctx = None
        debate_ctx = None

        if debate:
            from voice.debate_context import build_debate_rich_context, MAX_CONTEXT_DEBATE_VOICE

            debate_ctx = await build_debate_rich_context(debate, db, include_transcripts=True)
            context_block = debate_ctx.format_for_voice(language=language, max_chars=MAX_CONTEXT_DEBATE_VOICE)

            logger.info(
                "Voice session: debate context assembled",
                extra={
                    "debate_id": debate.id,
                    "agent_type": agent_config.agent_type,
                    "topic": (debate_ctx.topic or "")[:60],
                    "formatted_chars": len(context_block),
                    "transcript_a_chars": len(debate_ctx.transcript_a),
                    "transcript_b_chars": len(debate_ctx.transcript_b),
                },
            )
        elif summary:
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

        # ── Build system prompt ──
        agent_prompt = agent_config.get_system_prompt(language)

        if debate_ctx:
            ctx_label = "CONTEXTE DU DÉBAT" if language == "fr" else "DEBATE CONTEXT"
            system_prompt = f"{agent_prompt}\n\n--- {ctx_label} ---\n{context_block}"
        elif rich_ctx:
            ctx_label = "CONTEXTE VIDÉO" if language == "fr" else "VIDEO CONTEXT"
            title_label = "Titre" if language == "fr" else "Title"
            channel_label = "Chaîne" if language == "fr" else "Channel"
            duration_label = "Durée" if language == "fr" else "Duration"
            system_prompt = (
                f"{agent_prompt}\n\n"
                f"--- {ctx_label} ---\n"
                f"{title_label} : {rich_ctx.video_title}\n"
                f"{channel_label} : {rich_ctx.channel_name}\n"
                f"{duration_label} : {rich_ctx.duration_str}\n\n"
                f"{context_block}"
            )
        else:
            system_prompt = agent_prompt

        # ── Spec #1, Task 6 — Inject recent text-chat history when relevant ──
        # The voice agent picks up where the text chat left off (cross-surface
        # continuity). Skipped for debate (uses its own context block) and when
        # there is no summary_id (companion mode without active video).
        if request.summary_id and not debate_ctx:
            try:
                from chat.service import get_chat_history as _get_chat_history

                _chat_history = await _get_chat_history(
                    db,
                    summary_id=request.summary_id,
                    user_id=current_user.id,
                    limit=_CHAT_HISTORY_MAX_MESSAGES,
                )
                _history_block = _build_chat_history_block_for_voice(_chat_history, language=language)
                if _history_block:
                    system_prompt = f"{system_prompt}\n\n{_history_block}"
                    logger.info(
                        "Voice session: chat history injected",
                        extra={
                            "summary_id": request.summary_id,
                            "user_id": current_user.id,
                            "messages_kept": min(_CHAT_HISTORY_MAX_MESSAGES, len(_chat_history)),
                            "block_chars": len(_history_block),
                        },
                    )
            except Exception as _hist_exc:
                # Non-fatal: voice session still works without chat continuity.
                logger.warning(
                    "Voice session: failed to inject chat history (non-fatal)",
                    extra={
                        "summary_id": request.summary_id,
                        "error": str(_hist_exc),
                    },
                )

        # ── Build webhook tools (source-aware) ──
        webhook_base_url = APP_URL.rstrip("/")
        if agent_config.requires_debate and debate:
            tools_config = ElevenLabsClient.build_debate_tools_config(
                webhook_base_url=webhook_base_url,
                api_token=str(debate.id),
            )
        else:
            tools_config = ElevenLabsClient.build_tools_config(
                webhook_base_url=webhook_base_url,
                api_token=str(request.summary_id or 0),
            )
        # Filter tools to only those allowed for this agent type
        if agent_config.tools:
            allowed_tool_names = set(agent_config.tools)
            tools_config = [t for t in tools_config if t.get("name", "") in allowed_tool_names]

        # Get voice ID from user preferences (fallback to config)
        from voice.preferences import get_user_voice_preferences

        user_prefs = await get_user_voice_preferences(current_user.id, db)

        if user_prefs.voice_id:
            voice_id = user_prefs.voice_id
        else:
            from core.config import _settings

            voice_id = _settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"  # Default: Rachel

        # ── FR accent check: warn if voice is not FR-safe ────────────────
        # Multilingual voices (Lily, Sarah, Liam, etc.) can produce an accent
        # when speaking French. FR-safe voices are native French speakers.
        FR_SAFE_VOICE_IDS = {
            "5jCmrHdxbpU36l1wb3Ke",  # Sébas
            "ThT5KcBeYPX3keUQqHPh",  # Charlotte
            "XrExE9yKIg1WjnnlVkGX",  # Matilda
            "bIHbv24MWmeRgasZH58o",  # Will
        }
        if language == "fr" and voice_id not in FR_SAFE_VOICE_IDS:
            logger.warning(
                "Voice %s is not FR-native — may produce accent in French",
                voice_id,
                extra={
                    "user_id": current_user.id,
                    "voice_id": voice_id,
                    "language": language,
                },
            )

        # ── Build first message ──
        if language == "fr":
            first_message = agent_config.first_message_fr
        else:
            first_message = agent_config.first_message

        # Support {topic} placeholder for debate agent, {video_title} for explorer
        if debate_ctx and debate_ctx.topic:
            first_message = first_message.replace("{topic}", debate_ctx.topic)
        if rich_ctx and rich_ctx.video_title and "{video_title}" not in first_message:
            if agent_config.agent_type == "explorer":
                first_message = (
                    (
                        f"Salut ! Je suis prêt à discuter de la vidéo « {rich_ctx.video_title} ». "
                        "Qu'est-ce que tu veux savoir ?"
                    )
                    if language == "fr"
                    else (f'Hi! I\'m ready to discuss the video "{rich_ctx.video_title}". What would you like to know?')
                )

        # Build voice settings from user preferences
        voice_settings = user_prefs.to_voice_settings()
        voice_chat_model = user_prefs.voice_chat_model or "eleven_turbo_v2_5"

        # ── Build turn configuration from user preferences (Phase 1: PTT) ──
        from voice.preferences import get_voice_chat_speed_preset, CONCISENESS_INJECTION_FR, CONCISENESS_INJECTION_EN

        # ElevenLabs turn config — API April 2026: mode is "turn" or "silence"
        # "turn" = PTT-style (wait for user turn), "silence" = VAD auto-detect
        # eagerness renamed to turn_eagerness enum: "patient"|"normal"|"eager"
        eagerness_map = {"low": "patient", "medium": "normal", "high": "eager"}
        mapped_eagerness = eagerness_map.get(user_prefs.turn_eagerness, user_prefs.turn_eagerness)
        if user_prefs.input_mode == "ptt":
            turn_config = {
                "mode": "turn",
                "turn_timeout": user_prefs.turn_timeout,
            }
        else:
            turn_config = {
                "mode": "silence",
                "turn_eagerness": mapped_eagerness if mapped_eagerness in ("patient", "normal", "eager") else "normal",
                "turn_timeout": user_prefs.turn_timeout,
            }

        # ── Speed preset: override api_speed + inject conciseness prompt (Phase 2) ──
        speed_preset = get_voice_chat_speed_preset(user_prefs.voice_chat_speed_preset)
        playback_rate = 1.0
        if speed_preset:
            voice_settings["speed"] = speed_preset["api_speed"]
            playback_rate = speed_preset["playback_rate"]
            if speed_preset["concise"]:
                concise_block = CONCISENESS_INJECTION_FR if language == "fr" else CONCISENESS_INJECTION_EN
                system_prompt += concise_block

        conversation_token: str | None = None

        async with get_elevenlabs_client() as client:
            # Create the agent with user's preferred voice settings
            agent_id = await client.create_conversation_agent(
                system_prompt=system_prompt,
                tools=tools_config,
                voice_id=voice_id,
                first_message=first_message,
                language=language,
                model_id=voice_chat_model,
                voice_settings=voice_settings,
                turn_config=turn_config,
            )

            # Get the signed WebSocket URL (legacy web / JS SDK transport)
            signed_url, expires_at_iso = await client.get_signed_url(agent_id)

            # Also fetch a LiveKit JWT conversation token for WebRTC clients
            # (ElevenLabs React Native SDK, iOS/Android). If this fails we
            # still return signed_url so web clients keep working.
            try:
                conversation_token, token_expires_iso = await client.get_conversation_token(agent_id)
                if token_expires_iso and not expires_at_iso:
                    expires_at_iso = token_expires_iso
            except Exception as token_exc:
                logger.warning(
                    "Failed to fetch LiveKit conversation token (falling back to signed_url only)",
                    extra={"agent_id": agent_id, "error": str(token_exc)},
                )
                conversation_token = None

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
        agent_id=agent_id,
        conversation_token=conversation_token,
        expires_at=expires_at,
        quota_remaining_minutes=quota_remaining_minutes,
        max_session_minutes=max_session_minutes,
        input_mode=user_prefs.input_mode,
        ptt_key=user_prefs.ptt_key,
        playback_rate=playback_rate,
        is_streaming=bool(request.is_streaming),
        is_trial=bool(streaming_quota.is_trial) if streaming_quota else False,
        max_minutes=streaming_quota.max_minutes if streaming_quota else None,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /transcripts/append — Persist a single voice turn (Spec #1, Task 7)
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/transcripts/append", response_model=TranscriptAppendResponse)
async def append_transcript(
    request: TranscriptAppendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> TranscriptAppendResponse:
    """Persist one voice turn into the unified chat_messages timeline.

    Auth: Bearer JWT (user). IDOR: voice_session.user_id must equal
    current_user.id (returns 404 — same code as a missing session — to
    avoid leaking ownership info). Rate limit: 60 / min / voice_session_id
    (Spec #1).

    Dedup: a 60-second window per (voice_session_id, role, content) returns
    the existing row id with ``created=False``. This guards against
    network retries that emit the same payload twice; the webhook
    reconciler (Task 8) handles content drift across the whole call.
    """
    # ── Rate limit: 60 / min / voice_session_id ─────────────────────────────
    count = await _increment_transcript_append_count(request.voice_session_id)
    if count > _TRANSCRIPT_APPEND_MAX:
        logger.warning(
            "Transcript append rate limit exceeded",
            extra={
                "voice_session_id": request.voice_session_id,
                "user_id": current_user.id,
                "count": count,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "transcript_append_rate_limited",
                "message": (
                    f"Too many transcript append calls for this voice session (limit: {_TRANSCRIPT_APPEND_MAX}/min)."
                ),
            },
        )

    # ── Lookup voice_session ─────────────────────────────────────────────────
    result = await db.execute(select(VoiceSession).where(VoiceSession.id == request.voice_session_id))
    voice_session = result.scalar_one_or_none()
    if voice_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "voice_session_not_found",
                "message": "Voice session does not exist.",
            },
        )

    # ── IDOR: caller must own the session ────────────────────────────────────
    # Return 404 (not 403) so an attacker cannot distinguish "session does
    # not exist" from "session exists but belongs to another user".
    if voice_session.user_id != current_user.id:
        logger.warning(
            "Transcript append IDOR attempt",
            extra={
                "voice_session_id": request.voice_session_id,
                "session_user_id": voice_session.user_id,
                "caller_user_id": current_user.id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "voice_session_not_found",
                "message": "Voice session does not exist.",
            },
        )

    # ── Persist into chat_messages with source='voice' ──────────────────────
    from datetime import timedelta

    from db.database import ChatMessage

    role = "user" if request.speaker == "user" else "assistant"

    # ── Dedup window: 60s per (voice_session_id, role, content) ─────────────
    # A retry on the same call (e.g. network timeout, frontend re-fire) must
    # not insert a duplicate row. The 60s window is generous enough to absorb
    # mobile reconnects yet short enough that legitimate user repetition is
    # preserved.
    dedup_cutoff = datetime.utcnow() - timedelta(seconds=60)
    dedup_result = await db.execute(
        select(ChatMessage)
        .where(
            ChatMessage.voice_session_id == request.voice_session_id,
            ChatMessage.role == role,
            ChatMessage.content == request.content,
            ChatMessage.created_at > dedup_cutoff,
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )
    existing = dedup_result.scalar_one_or_none()
    if existing is not None:
        logger.debug(
            "Transcript append dedup hit",
            extra={
                "voice_session_id": request.voice_session_id,
                "user_id": current_user.id,
                "existing_id": existing.id,
            },
        )
        return TranscriptAppendResponse(
            id=existing.id,
            created=False,
            voice_session_id=request.voice_session_id,
        )

    msg = ChatMessage(
        user_id=current_user.id,
        summary_id=voice_session.summary_id,  # may be None for companion
        role=role,
        content=request.content,
        source="voice",
        voice_session_id=request.voice_session_id,
        voice_speaker=request.speaker,
        time_in_call_secs=request.time_in_call_secs,
    )
    db.add(msg)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error(
            "Transcript append: DB commit failed",
            extra={
                "voice_session_id": request.voice_session_id,
                "user_id": current_user.id,
                "error": str(exc),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "transcript_append_failed",
                "message": "Failed to persist transcript turn.",
            },
        )

    # SQLAlchemy populates msg.id after commit (autoincrement PK).
    await db.refresh(msg)
    return TranscriptAppendResponse(
        id=msg.id,
        created=True,
        voice_session_id=request.voice_session_id,
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
        session_query = select(VoiceSession).where(VoiceSession.elevenlabs_conversation_id == payload.conversation_id)
    elif payload.metadata and payload.metadata.get("session_id"):
        session_query = select(VoiceSession).where(VoiceSession.id == payload.metadata["session_id"])

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

    # ── Spec #1, Task 8 — Reconcile transcript with chat_messages rows ──
    # The frontend POSTs each turn live via /transcripts/append, but events
    # may have been dropped on a flaky network. The webhook payload carries
    # the canonical, server-side transcript: we INSERT what was missed and
    # UPDATE rows whose live content drifted from the canonical version.
    try:
        canonical_payload = body.get("data", {}).get("transcript") if isinstance(body, dict) else None
        if canonical_payload is None:
            canonical_payload = payload.transcript
        canonical_turns = parse_transcript_canonical(canonical_payload)
        if canonical_turns:
            report = await reconcile_voice_transcript(
                db,
                voice_session_id=voice_session.id,
                user_id=voice_session.user_id,
                summary_id=voice_session.summary_id,
                canonical_turns=canonical_turns,
            )
            logger.info(
                "Voice webhook: transcript reconciled",
                extra={
                    "session_id": voice_session.id,
                    "canonical_turns": len(canonical_turns),
                    **report,
                },
            )
    except Exception as reconcile_exc:
        # Non-fatal — webhook still acks so ElevenLabs won't retry.
        logger.warning(
            "Voice webhook: transcript reconciliation failed (non-fatal)",
            extra={
                "session_id": voice_session.id,
                "error": str(reconcile_exc),
            },
        )

    # ── Cleanup: delete the ElevenLabs agent (fire-and-forget) ────────
    if voice_session.elevenlabs_agent_id:
        try:
            async with get_elevenlabs_client() as client:
                deleted = await client.delete_agent(voice_session.elevenlabs_agent_id)
                if deleted:
                    logger.info(
                        "Voice agent cleaned up",
                        extra={"agent_id": voice_session.elevenlabs_agent_id},
                    )
        except Exception as cleanup_err:
            logger.warning(
                "Failed to cleanup ElevenLabs agent (non-critical)",
                extra={
                    "agent_id": voice_session.elevenlabs_agent_id,
                    "error": str(cleanup_err),
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
# GET /history/debate/{debate_id} — Voice session history for a debate
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/history/debate/{debate_id}", response_model=VoiceHistoryResponse)
async def get_debate_voice_history(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Get all voice sessions for a given debate."""
    result = await db.execute(
        select(DebateAnalysis).where(
            DebateAnalysis.id == debate_id,
            DebateAnalysis.user_id == current_user.id,
        )
    )
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "debate_not_found", "message": "Debate not found."},
        )

    result = await db.execute(
        select(VoiceSession)
        .where(
            VoiceSession.user_id == current_user.id,
            VoiceSession.debate_id == debate_id,
        )
        .order_by(VoiceSession.started_at.desc())
    )
    sessions = result.scalars().all()

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
        summary_id=debate_id,
        video_title=debate.detected_topic or "Débat sans sujet",
        sessions=session_summaries,
        total_minutes=round(total_seconds / 60.0, 2),
    )


@router.get(
    "/history/debate/{debate_id}/{session_id}/transcript",
    response_model=VoiceTranscriptResponse,
)
async def get_debate_voice_transcript(
    debate_id: int,
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Get the transcript of a specific debate voice session."""
    result = await db.execute(
        select(DebateAnalysis).where(
            DebateAnalysis.id == debate_id,
            DebateAnalysis.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "debate_not_found", "message": "Debate not found."},
        )

    result = await db.execute(
        select(VoiceSession).where(
            VoiceSession.id == session_id,
            VoiceSession.user_id == current_user.id,
            VoiceSession.debate_id == debate_id,
        )
    )
    voice_session = result.scalar_one_or_none()
    if not voice_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": "Voice session not found."},
        )
    if not voice_session.conversation_transcript:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "transcript_not_found", "message": "No transcript available."},
        )

    return VoiceTranscriptResponse(
        session_id=voice_session.id,
        summary_id=debate_id,
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
    packs = [{"id": pack_id, **pack_info} for pack_id, pack_info in VOICE_ADDON_PACKS.items()]
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
            line_items=[
                {
                    "price_data": {
                        "currency": pack["currency"],
                        "unit_amount": pack["price_cents"],
                        "product_data": {
                            "name": f"DeepSight — {pack['name']}",
                            "description": f"{pack['minutes']} minutes de chat vocal",
                        },
                    },
                    "quantity": 1,
                }
            ],
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
    summary, body = await verify_tool_request(request, db)
    query = body.get("query") or body.get("parameters", {}).get("query", "")
    result = await search_in_transcript(summary.id, query, db)
    return {"result": result}


@router.post("/tools/analysis-section")
async def tool_analysis_section(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: get a specific analysis section."""
    summary, body = await verify_tool_request(request, db)
    section = body.get("section") or body.get("parameters", {}).get("section", "resume")
    result = await get_analysis_section(summary.id, section, db)
    return {"result": result}


@router.post("/tools/sources")
async def tool_sources(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: get sources and fact-check info."""
    summary, _body = await verify_tool_request(request, db)
    result = await get_sources(summary.id, db)
    return {"result": result}


@router.post("/tools/flashcards")
async def tool_flashcards(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: get flashcards for a video."""
    summary, body = await verify_tool_request(request, db)
    count = body.get("count") or body.get("parameters", {}).get("count", 5)
    result = await get_flashcards(summary.id, int(count), db)
    return {"result": result}


@router.post("/tools/web-search")
async def tool_web_search(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: web search via Brave.

    Quotas (cumulés avec le chat texte — table WebSearchUsage partagée) :
      - Mensuel par plan (web_search_monthly: 0 free / 20 plus / 60 pro)
      - Rate-limit horaire 15 calls / summary_id (anti spam session)
      - Rate-limit horaire 60 calls / user_id   (cap global anti fan-out)
    """
    summary, body = await verify_tool_request(request, db)
    query = body.get("query") or body.get("parameters", {}).get("query", "")

    # Monthly quota (shared with text chat)
    can_search, used, limit = await _check_monthly_web_quota(db, int(summary.user_id))
    if not can_search:
        return {
            "result": (
                f"Quota mensuel de recherches web atteint ({used}/{limit}). "
                "Réponds avec les informations déjà disponibles dans le contexte vidéo."
            )
        }

    # Per-summary rate limit (Spec #0 — raised from 5 to 15)
    summary_count = await _increment_web_search_count(str(summary.id))
    if summary_count > _WEB_SEARCH_MAX:
        return {
            "result": "Limite de recherches web atteinte pour cette session. "
            "Utilisez les informations déjà disponibles."
        }

    # Per-user global cap (Spec #0)
    user_count = await _increment_user_web_search_count(int(summary.user_id))
    if user_count > _WEB_SEARCH_USER_MAX:
        return {"result": "Limite horaire de recherches web atteinte pour ton compte. Réessaie dans quelques minutes."}

    result = await web_search(summary.id, query, db)

    # Track usage for monthly quota + voice attribution
    await record_web_search_usage(
        db,
        user_id=int(summary.user_id),
        summary_id=int(summary.id),
        source="voice",
        query=query,
    )

    return {"result": result}


@router.post("/tools/deep-research")
async def tool_deep_research(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: deep web research (3 Brave queries fan-out).

    Compté comme 1 appel dans le quota mensuel partagé (l'utilisateur a fait 1 demande),
    mais consomme 1 slot du rate-limit horaire summary + user (anti spam).
    """
    summary, body = await verify_tool_request(request, db)
    query = body.get("query") or body.get("parameters", {}).get("query", "")

    # Monthly quota (shared with text chat)
    can_search, used, limit = await _check_monthly_web_quota(db, int(summary.user_id))
    if not can_search:
        return {
            "result": (
                f"Quota mensuel de recherches web atteint ({used}/{limit}). "
                "Réponds avec les informations déjà disponibles dans le contexte vidéo."
            )
        }

    # Per-summary rate limit
    summary_count = await _increment_web_search_count(str(summary.id))
    if summary_count > _WEB_SEARCH_MAX:
        return {
            "result": "Limite de recherches web atteinte pour cette session. "
            "Utilisez les informations déjà disponibles."
        }

    # Per-user global cap
    user_count = await _increment_user_web_search_count(int(summary.user_id))
    if user_count > _WEB_SEARCH_USER_MAX:
        return {"result": "Limite horaire de recherches web atteinte pour ton compte. Réessaie dans quelques minutes."}

    result = await deep_research(summary.id, query, db)

    await record_web_search_usage(
        db,
        user_id=int(summary.user_id),
        summary_id=int(summary.id),
        source="voice_deep",
        query=query,
    )

    return {"result": result}


@router.post("/tools/check-fact")
async def tool_check_fact(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: fact-check a claim (1 Brave query).

    Compté dans le quota mensuel partagé chat+voice et dans les rate-limits horaires
    pour préserver l'équité d'usage entre les deux surfaces.
    """
    summary, body = await verify_tool_request(request, db)
    claim = body.get("claim") or body.get("parameters", {}).get("claim", "")

    # Monthly quota (shared with text chat)
    can_search, used, limit = await _check_monthly_web_quota(db, int(summary.user_id))
    if not can_search:
        return {
            "result": (
                f"Quota mensuel de vérification web atteint ({used}/{limit}). "
                "Réponds avec les informations disponibles dans le contexte vidéo."
            )
        }

    # Per-summary rate limit
    summary_count = await _increment_web_search_count(str(summary.id))
    if summary_count > _WEB_SEARCH_MAX:
        return {
            "result": "Limite de vérifications web atteinte pour cette session. "
            "Utilisez les informations déjà disponibles."
        }

    # Per-user global cap
    user_count = await _increment_user_web_search_count(int(summary.user_id))
    if user_count > _WEB_SEARCH_USER_MAX:
        return {
            "result": "Limite horaire de vérifications web atteinte pour ton compte. Réessaie dans quelques minutes."
        }

    result = await check_fact(summary.id, claim, db)

    await record_web_search_usage(
        db,
        user_id=int(summary.user_id),
        summary_id=int(summary.id),
        source="voice_factcheck",
        query=claim,
    )

    return {"result": result}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /tools/debate-* — Debate moderator agent tools (public, bearer=debate_id)
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/tools/debate-overview")
async def tool_debate_overview(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: debate overview (topic + theses + summary)."""
    debate, _body = await verify_debate_tool_request(request, db)
    result = await get_debate_overview(debate.id, db)
    return {"result": result}


@router.post("/tools/debate-thesis")
async def tool_debate_thesis(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: thesis + arguments for video A or B."""
    debate, body = await verify_debate_tool_request(request, db)
    side = body.get("side") or body.get("parameters", {}).get("side", "video_a")
    result = await get_video_thesis(debate.id, side, db)
    return {"result": result}


@router.post("/tools/debate-compare")
async def tool_debate_compare(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: compare arguments on a sub-topic."""
    debate, body = await verify_debate_tool_request(request, db)
    topic = body.get("topic") or body.get("parameters", {}).get("topic", "")
    result = await get_argument_comparison(debate.id, topic, db)
    return {"result": result}


@router.post("/tools/debate-search")
async def tool_debate_search(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: search in one or both transcripts."""
    debate, body = await verify_debate_tool_request(request, db)
    query = body.get("query") or body.get("parameters", {}).get("query", "")
    side = body.get("side") or body.get("parameters", {}).get("side", "both")
    result = await search_in_debate_transcript(debate.id, query, side, db)
    return {"result": result}


@router.post("/tools/debate-fact-check")
async def tool_debate_fact_check(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: fact-check verdicts."""
    debate, _body = await verify_debate_tool_request(request, db)
    result = await get_debate_fact_check(debate.id, db)
    return {"result": result}


@router.post("/tools/debate-web-search")
async def tool_debate_web_search(request: Request, db: AsyncSession = Depends(get_session)):
    """ElevenLabs tool webhook: web search for debate moderator agents.

    Same multi-provider chain as /tools/web-search (Mistral Agent → Perplexity → Brave),
    but authenticates against debate_id instead of summary_id since debate agents
    are not bound to a single video summary.

    Rate-limited:
      - 15 calls / hour / debate_id (anti spam)
      - 60 calls / hour / user_id   (global cap, anti fan-out)
    """
    debate, body = await verify_debate_tool_request(request, db)
    query = body.get("query") or body.get("parameters", {}).get("query", "")

    if not query or not query.strip():
        return {"result": "Aucune requête de recherche fournie."}

    # Per-debate rate limit (reuse summary counter pool with namespaced key)
    debate_count = await _increment_web_search_count(f"debate:{debate.id}")
    if debate_count > _WEB_SEARCH_MAX:
        return {"result": "Limite de recherches web atteinte pour ce débat. Utilise les informations déjà disponibles."}

    # Per-user global cap
    user_count = await _increment_user_web_search_count(int(debate.user_id))
    if user_count > _WEB_SEARCH_USER_MAX:
        return {"result": "Limite horaire de recherches web atteinte pour ton compte. Réessaie dans quelques minutes."}

    # Build context from the debate topic so Perplexity/Brave search is well-grounded
    debate_topic = (debate.detected_topic or "").strip()
    context_str = f"Débat sur : {debate_topic}" if debate_topic else ""

    try:
        from videos.web_search_provider import web_search_and_synthesize

        result = await web_search_and_synthesize(
            query=query.strip(),
            context=context_str,
            purpose="debate",
            lang="fr",
            max_sources=5,
            max_tokens=1500,
            timeout=20.0,
        )
        if result.success:
            answer = result.content
            # Include up to 3 source URLs in plain text for the agent to mention briefly
            if result.sources:
                src_lines = []
                for src in result.sources[:3]:
                    title = src.get("title", "")
                    url = src.get("url", "")
                    if title or url:
                        src_lines.append(f"• {title} — {url}")
                if src_lines:
                    answer = answer + "\n\nSources :\n" + "\n".join(src_lines)
            await record_web_search_usage(
                db,
                user_id=int(debate.user_id),
                summary_id=0,  # debate context, no summary
                source="voice_debate",
                query=query.strip(),
            )
            return {"result": answer[:2000]}
        return {"result": f"Aucun résultat trouvé pour la recherche : {query[:100]}"}
    except Exception as e:
        logger.error("debate-web-search error: %s", e, exc_info=True)
        return {"result": "Une erreur est survenue lors de la recherche web."}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /debate/{debate_id}/avatar — Dynamic avatar for the debate moderator agent
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/debate/{debate_id}/avatar")
async def get_debate_voice_avatar(
    debate_id: int,
    regenerate: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Return the dynamic avatar URL for the debate moderator voice agent.

    Response shape:
      { "status": "ready" | "generating" | "unavailable",
        "url": str | None,
        "topic": str | None }

    Strategy:
      - status="ready"      → image cached, URL returned.
      - status="generating" → no cache yet, generation fired in background;
                              client should poll in a few seconds.
      - status="unavailable"→ image pipeline disabled or debate has no topic.
    """
    result = await db.execute(
        select(DebateAnalysis).where(
            DebateAnalysis.id == debate_id,
            DebateAnalysis.user_id == current_user.id,
        )
    )
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "debate_not_found", "message": "Debate not found."},
        )

    topic = (debate.detected_topic or "").strip()
    if not topic:
        return {"status": "unavailable", "url": None, "topic": None}

    # Admin override: force regeneration (bypass cache)
    if regenerate and current_user.is_admin:
        url = await generate_debate_avatar(debate)
        return {
            "status": "ready" if url else "unavailable",
            "url": url,
            "topic": topic,
        }

    # Cache lookup
    url = await get_debate_avatar_url(debate)
    if url:
        return {"status": "ready", "url": url, "topic": topic}

    # Not cached → fire background generation, return placeholder
    ensure_debate_avatar(debate)
    return {"status": "generating", "url": None, "topic": topic}


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


# ═══════════════════════════════════════════════════════════════════════════════
# GET /session/{summary_id}/thumbnail — Visual context for the voice modal
# ═══════════════════════════════════════════════════════════════════════════════

_VOICE_THUMB_GRADIENT = VoiceThumbnailGradient()  # indigo → violet → cyan


def _build_voice_thumb_term(summary: Summary) -> str:
    """Deterministic cache key for a generated voice thumbnail (per video)."""
    title = (summary.video_title or "").strip().lower()[:160]
    channel = (summary.video_channel or "").strip().lower()[:80]
    return f"voice-thumb:{summary.video_id}:{title}:{channel}"


def _is_youtube_cdn_url(url: str) -> bool:
    return url.startswith(("https://i.ytimg.com/", "https://img.youtube.com/"))


async def _kick_voice_thumb_generation(summary: Summary, term: str, pool) -> None:
    """Fire-and-forget generation of a voice thumbnail via the image pipeline."""
    try:
        from images.keyword_images import generate_keyword_image

        definition = (
            f"Illustration pour une conversation vocale au sujet de la vidéo "
            f"« {summary.video_title or 'sans titre'} » "
            f"de la chaîne « {summary.video_channel or 'chaîne inconnue'} ». "
            f"Style : symbolique, moderne, cosmic DeepSight — palette indigo, "
            f"violet et cyan sur fond sombre, sans texte."
        )
        await generate_keyword_image(
            term=term,
            definition=definition,
            category="voice-thumb",
            premium=False,
            pool=pool,
        )
    except Exception as exc:
        logger.warning(
            "voice.thumbnail.generation_failed",
            extra={"summary_id": summary.id, "error": str(exc)},
        )


async def _resolve_voice_thumbnail(summary: Summary) -> tuple[str | None, str]:
    """Return `(url, source)` for the best available thumbnail.

    Resolution order:
      1. YouTube video_id → `img.youtube.com/.../maxresdefault.jpg` (HD).
      2. Stored `summary.thumbnail_url` (TikTok CDN, R2, data:, etc.).
      3. Cached generated image from the `keyword_images` pipeline.
      4. Fire-and-forget generation + gradient-only response.
    """
    stored = (summary.thumbnail_url or "").strip()
    platform = (summary.platform or "youtube").lower()

    # 1. YouTube: CDN is free, cached worldwide, and `maxresdefault` is 1280x720.
    if platform == "youtube" and summary.video_id:
        return (
            f"https://img.youtube.com/vi/{summary.video_id}/maxresdefault.jpg",
            "youtube_hd",
        )

    # 2. Non-YouTube: use whatever we stored (TikTok thumb, R2 URL, data: URL…).
    if stored:
        source = "tiktok_stored" if platform == "tiktok" else "stored"
        # If a non-YouTube platform somehow points at the YouTube CDN, tag it.
        if _is_youtube_cdn_url(stored):
            source = "youtube_standard"
        return (stored, source)

    # 3. No stored image → check the generated cache, kick generation if missing.
    try:
        from images.keyword_images import get_image_url, _get_pool

        term = _build_voice_thumb_term(summary)
        pool = await _get_pool()
        cached = await get_image_url(term, pool=pool)
        if cached:
            return (cached, "generated")

        # Not cached — fire generation in the background (non-blocking).
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_kick_voice_thumb_generation(summary, term, pool))
            return (None, "generating")
        except RuntimeError:
            # No running loop (unlikely inside FastAPI) — skip silently.
            pass
    except Exception as exc:
        logger.debug(
            "voice.thumbnail.cache_lookup_failed",
            extra={"summary_id": summary.id, "error": str(exc)},
        )

    # 4. Nothing usable → gradient-only fallback.
    return (None, "gradient")


@router.get(
    "/session/{summary_id}/thumbnail",
    response_model=VoiceThumbnailResponse,
)
async def get_voice_session_thumbnail(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Return the visual context for a voice session (video thumbnail + fallback).

    The voice modal uses this to display the video's thumbnail in HD next to
    the call UI. If no image can be resolved, the frontend falls back to a
    DeepSight gradient (indigo → violet → cyan).

    Resolution cascade:
      1. YouTube → `img.youtube.com/vi/{video_id}/maxresdefault.jpg` (1280×720).
      2. TikTok / others → `summary.thumbnail_url` (may be R2 URL or data: URL).
      3. No stored image → generated image cache (fire-and-forget if absent).
      4. Last resort → gradient-only (frontend renders indigo→violet→cyan).

    The `gradient` field is ALWAYS included so the frontend can show something
    even if the returned URL fails to load (CDN miss, network error, CORS).
    """
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
            detail={"code": "summary_not_found", "message": "Analyse introuvable."},
        )

    thumbnail_url, source = await _resolve_voice_thumbnail(summary)

    alt_text = f"Miniature de la vidéo « {summary.video_title or 'sans titre'} »" + (
        f" — chaîne {summary.video_channel}" if summary.video_channel else ""
    )

    logger.info(
        "voice.thumbnail.resolved",
        extra={
            "user_id": current_user.id,
            "summary_id": summary.id,
            "video_id": summary.video_id,
            "platform": summary.platform or "youtube",
            "source": source,
            "has_url": thumbnail_url is not None,
        },
    )

    return VoiceThumbnailResponse(
        thumbnail_url=thumbnail_url,
        source=source,
        video_id=summary.video_id,
        video_title=summary.video_title,
        video_channel=summary.video_channel,
        platform=summary.platform or "youtube",
        gradient=_VOICE_THUMB_GRADIENT,
        alt_text=alt_text,
    )
