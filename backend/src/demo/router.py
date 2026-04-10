"""
+============================================================================+
|  DEMO ROUTER v1.0 -- Landing Page Demo (No Auth)                          |
+============================================================================+
|  Endpoints publics pour la demo sur la landing page :                      |
|  - POST /api/demo/analyze  : Resume ultra-court + session ID              |
|  - POST /api/demo/chat     : Chat contextuel (3 messages max)             |
+============================================================================+
"""

import time
import logging
from uuid import uuid4
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Request

from .schemas import (
    DemoAnalyzeRequest, DemoAnalyzeResponse,
    DemoChatRequest, DemoChatResponse,
)
from .service import (
    generate_demo_summary, generate_demo_chat_response,
    generate_demo_suggestions,
    store_demo_session, get_demo_session,
    increment_demo_chat, append_demo_chat_history,
    MAX_DEMO_CHAT_MESSAGES,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════════
# IP RATE LIMITING (in-memory, 3 analyses / 24h)
# ═══════════════════════════════════════════════════════════════════════════════

MAX_DEMO_ANALYSES = 3
_demo_usage: Dict[str, List[float]] = {}


def _get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(client_ip: str) -> int:
    """Check and enforce rate limit. Returns remaining analyses."""
    now = time.time()

    # Clean expired timestamps
    timestamps = _demo_usage.get(client_ip, [])
    timestamps = [ts for ts in timestamps if now - ts < 86400]
    _demo_usage[client_ip] = timestamps

    remaining = MAX_DEMO_ANALYSES - len(timestamps)
    return remaining


def _record_usage(client_ip: str) -> int:
    """Record an analysis usage. Returns remaining after this one."""
    now = time.time()
    if client_ip not in _demo_usage:
        _demo_usage[client_ip] = []
    _demo_usage[client_ip].append(now)

    # Cleanup old IPs (avoid memory leak)
    expired_ips = [
        ip for ip, timestamps in _demo_usage.items()
        if all(now - ts > 86400 for ts in timestamps)
    ]
    for ip in expired_ips:
        del _demo_usage[ip]

    return MAX_DEMO_ANALYSES - len(_demo_usage[client_ip])


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/demo/analyze — Ultra-short demo analysis
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze", response_model=DemoAnalyzeResponse)
async def demo_analyze(request: DemoAnalyzeRequest, raw_request: Request):
    """
    Analyse demo pour la landing page.
    - Videos YouTube/TikTok < 5 min
    - 3 analyses par IP par 24h
    - Resume ultra-court (3-5 points cles + conclusion)
    - Retourne un demo_session_id pour le chat
    """
    # 1. Rate limit
    client_ip = _get_client_ip(raw_request)
    remaining = _check_rate_limit(client_ip)

    if remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail={
                "status": "error",
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Vous avez utilise vos 3 analyses gratuites. Creez un compte pour continuer !",
                }
            }
        )

    # 2. Import video utilities (same as guest endpoint)
    from transcripts import (
        extract_video_id, get_video_info, get_transcript_with_timestamps
    )
    from transcripts.tiktok import (
        extract_tiktok_video_id, get_tiktok_video_info, get_tiktok_transcript
    )
    from videos.analysis import detect_category

    MAX_VIDEO_DURATION = 300  # 5 minutes

    url = request.url.strip()

    # 3. Detect platform
    platform = "youtube"
    if "tiktok.com" in url:
        platform = "tiktok"

    # 4. Extract video info + transcript
    if platform == "tiktok":
        tiktok_id = extract_tiktok_video_id(url)
        if not tiktok_id:
            raise HTTPException(status_code=400, detail="URL TikTok invalide.")

        try:
            video_info = await get_tiktok_video_info(url)
            if not video_info:
                raise ValueError("No info")
        except Exception:
            raise HTTPException(status_code=400, detail="Impossible de recuperer les informations TikTok.")

        duration = video_info.get("duration", 0)
        if duration > MAX_VIDEO_DURATION:
            raise HTTPException(
                status_code=400,
                detail=f"La demo est limitee aux videos de moins de 5 minutes. Cette video dure {duration // 60}:{duration % 60:02d}."
            )

        try:
            transcript_text = await get_tiktok_transcript(url)
        except Exception:
            raise HTTPException(status_code=400, detail="Transcription TikTok indisponible.")

        thumbnail_url = video_info.get("thumbnail", video_info.get("thumbnail_url", ""))
    else:
        # YouTube
        video_id = extract_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail="URL YouTube ou TikTok invalide.")

        try:
            video_info = await get_video_info(video_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Impossible de recuperer les informations de la video.")

        duration = video_info.get("duration", 0)
        if duration > MAX_VIDEO_DURATION:
            raise HTTPException(
                status_code=400,
                detail=f"La demo est limitee aux videos de moins de 5 minutes. Cette video dure {duration // 60}:{duration % 60:02d}."
            )

        is_short = "/shorts/" in url or duration <= 90
        try:
            transcript_result = await get_transcript_with_timestamps(video_id, is_short=is_short, duration=duration)
            transcript_text = transcript_result[0] if isinstance(transcript_result, tuple) else transcript_result
        except Exception:
            raise HTTPException(status_code=400, detail="Transcription indisponible pour cette video.")

        thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    # 5. Validate transcript
    if not transcript_text or len(transcript_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="La transcription est trop courte ou indisponible.")

    # 6. Detect category (sync function — no await)
    try:
        category = detect_category(transcript_text[:2000])
    except Exception:
        category = "general"

    # 7. Generate ultra-short summary
    video_title = video_info.get("title", "Video")
    video_channel = video_info.get("channel", video_info.get("author", ""))

    try:
        key_points, conclusion, keywords = await generate_demo_summary(
            title=video_title,
            channel=video_channel,
            transcript=transcript_text,
        )
    except Exception as e:
        logger.error(f"[DEMO] Analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la generation du resume.")

    # 8. Create demo session for chat
    demo_session_id = str(uuid4())
    await store_demo_session(
        session_id=demo_session_id,
        transcript=transcript_text,
        video_title=video_title,
        video_channel=video_channel,
        key_points=key_points,
        conclusion=conclusion,
    )

    # 9. Record usage
    analyses_remaining = _record_usage(client_ip)

    logger.info(f"[DEMO] Analysis complete for IP {client_ip[:10]}... | session={demo_session_id[:8]} | remaining={analyses_remaining}")

    return DemoAnalyzeResponse(
        demo_session_id=demo_session_id,
        video_title=video_title,
        video_channel=video_channel,
        video_duration=duration,
        thumbnail_url=thumbnail_url,
        platform=platform,
        category=category,
        key_points=key_points,
        conclusion=conclusion,
        keywords=keywords,
        remaining_analyses=max(0, analyses_remaining),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/demo/chat — Demo chat (3 messages max)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/chat", response_model=DemoChatResponse)
async def demo_chat(request: DemoChatRequest):
    """
    Chat demo contextuel sur la video analysee.
    - 3 messages max par session
    - Reponses concises (3-5 phrases)
    - Pas d'auth requise
    """
    # 1. Get session
    session_data = await get_demo_session(request.demo_session_id)
    if not session_data:
        raise HTTPException(
            status_code=404,
            detail={
                "status": "error",
                "error": {
                    "code": "SESSION_EXPIRED",
                    "message": "Session demo expiree. Relancez une analyse.",
                }
            }
        )

    # 2. Check chat limit
    current_count = int(session_data.get("chat_count", 0))
    if current_count >= MAX_DEMO_CHAT_MESSAGES:
        raise HTTPException(
            status_code=429,
            detail={
                "status": "error",
                "error": {
                    "code": "DEMO_CHAT_LIMIT",
                    "message": "Vous avez utilise vos 3 questions demo. Creez un compte pour un chat illimite !",
                }
            }
        )

    # 3. Store user message
    await append_demo_chat_history(request.demo_session_id, "user", request.question)

    # 4. Generate response
    try:
        response_text = await generate_demo_chat_response(session_data, request.question)
    except Exception as e:
        logger.error(f"[DEMO] Chat failed: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la generation de la reponse.")

    # 5. Store assistant message + increment counter
    await append_demo_chat_history(request.demo_session_id, "assistant", response_text)
    new_count = await increment_demo_chat(request.demo_session_id)
    messages_remaining = max(0, MAX_DEMO_CHAT_MESSAGES - new_count)

    logger.info(f"[DEMO] Chat response | session={request.demo_session_id[:8]} | remaining={messages_remaining}")

    return DemoChatResponse(
        response=response_text,
        messages_remaining=messages_remaining,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/demo/suggestions — Pre-filled question chips
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/suggestions/{demo_session_id}")
async def get_demo_suggestions(demo_session_id: str):
    """
    Get 3 question suggestions for the demo chat.
    Called right after analysis to populate suggestion chips.
    """
    session_data = await get_demo_session(demo_session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session demo expiree.")

    import json
    key_points = json.loads(session_data.get("key_points", "[]"))
    conclusion = session_data.get("conclusion", "")

    suggestions = await generate_demo_suggestions(key_points, conclusion)

    return {"status": "success", "suggestions": suggestions}
