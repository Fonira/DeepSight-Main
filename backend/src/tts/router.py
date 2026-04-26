"""
TTS ROUTER — Multi-Provider Text-to-Speech
v5.0 — ElevenLabs primary + OpenAI fallback, rate limiting, streaming, plan gating
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx
import logging

from db.database import User, get_session
from sqlalchemy.ext.asyncio import AsyncSession
from auth.dependencies import get_current_user
from billing.permissions import require_feature
from core.config import get_elevenlabs_key
from middleware.rate_limiter import InMemoryBackend
from tts.schemas import TTSRequest
from tts.service import clean_text_for_tts, get_voice_id
from tts.providers import get_tts_provider

logger = logging.getLogger(__name__)

router = APIRouter()

# ElevenLabs config (for /voices endpoint)
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"
MAX_TEXT_LENGTH = 5000

# Voices cache
_voices_cache: dict = {"data": None, "expires": 0}


# ═══════════════════════════════════════════════════════════════════════════════
# 🚦 TTS DAILY RATE LIMITER
# ═══════════════════════════════════════════════════════════════════════════════

TTS_DAILY_LIMITS = {
    "free": 0,
    "etudiant": 20,
    "starter": 50,
    "pro": 200,
    "expert": 500,
    "unlimited": 10000,
}

_tts_daily_backend = InMemoryBackend()


async def check_tts_rate_limit(current_user: User = Depends(get_current_user)):
    """Dependency: enforce TTS daily rate limit per plan."""
    user_plan = current_user.plan or "free"
    limit = TTS_DAILY_LIMITS.get(user_plan, 0)

    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail="TTS non disponible pour votre plan",
        )

    key = f"tts_daily:user:{current_user.id}"
    result = await _tts_daily_backend.check_and_increment(key, limit, 86400)

    if not result.allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Limite TTS quotidienne atteinte ({limit}/jour). Reessayez demain.",
            headers={"Retry-After": str(result.retry_after)},
        )
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/tts — Generate TTS audio (v5 — multi-provider)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("")
async def tts_generate(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    _rate: None = Depends(check_tts_rate_limit),
):
    """
    Generate TTS audio with automatic provider fallback.

    Primary: ElevenLabs (eleven_multilingual_v2)
    Fallback: OpenAI TTS (tts-1) — activated when ElevenLabs circuit breaker is open

    Body: { text, language?, gender?, speed?, strip_questions?, use_preferences? }
    Returns: streaming audio/mpeg response
    Headers: X-TTS-Provider indicates which provider served the request
    """
    # Feature check — premium only
    user_plan = current_user.plan or "free"
    platform = request.query_params.get("platform", "web")
    require_feature(user_plan, "tts", platform, label="Text-to-Speech")

    # Parse body
    body = await request.json()
    try:
        tts_req = TTSRequest(**body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # ── Apply user voice preferences as defaults ──────────────────────────
    if tts_req.use_preferences:
        try:
            from voice.preferences import get_user_voice_preferences
            user_prefs = await get_user_voice_preferences(current_user.id, db)

            # Only apply pref if request didn't explicitly override
            if tts_req.voice_id is None and user_prefs.voice_id:
                tts_req.voice_id = user_prefs.voice_id
            if tts_req.speed == 1.0 and user_prefs.speed != 1.0:
                tts_req.speed = user_prefs.speed
            if tts_req.model_id is None and user_prefs.tts_model:
                tts_req.model_id = user_prefs.tts_model
            if tts_req.language == "fr" and user_prefs.language:
                tts_req.language = user_prefs.language
            if tts_req.gender == "female" and user_prefs.gender in ("male", "female"):
                tts_req.gender = user_prefs.gender
        except Exception as e:
            logger.warning("Failed to load voice preferences: %s", e)

    # Clean text for TTS
    cleaned_text = clean_text_for_tts(tts_req.text, strip_questions=tts_req.strip_questions)

    if not cleaned_text:
        raise HTTPException(status_code=400, detail="Text is required (empty after cleanup)")

    # ── Get provider (ElevenLabs → OpenAI fallback) ──────────────────────
    try:
        provider = get_tts_provider()
    except RuntimeError as e:
        logger.error("No TTS provider available: %s", e)
        raise HTTPException(
            status_code=503,
            detail="TTS service temporarily unavailable. Retry in 60s.",
            headers={"Retry-After": "60"},
        )

    # ── Generate audio stream ────────────────────────────────────────────
    try:
        audio_stream, _client, media_type = await provider.generate_stream(
            text=cleaned_text,
            voice_id=tts_req.voice_id,
            language=tts_req.language,
            gender=tts_req.gender,
            speed=tts_req.speed,
            model_id=tts_req.model_id,
        )
    except httpx.TimeoutException:
        logger.error("TTS timeout (provider=%s, user=%s)", provider.name, current_user.email)
        raise HTTPException(status_code=504, detail="TTS request timed out")
    except RuntimeError as e:
        logger.error("TTS provider error (provider=%s): %s", provider.name, e)
        raise HTTPException(
            status_code=502,
            detail=f"TTS provider error ({provider.name})",
        )
    except Exception as e:
        logger.error("TTS unexpected error (provider=%s): %s", provider.name, e)
        raise HTTPException(status_code=500, detail="TTS generation failed")

    logger.info("TTS generated", extra={
        "user_id": current_user.id,
        "plan": current_user.plan,
        "provider": provider.name,
        "text_length": len(tts_req.text),
        "language": tts_req.language,
        "estimated_chars": len(cleaned_text),
    })

    return StreamingResponse(
        audio_stream,
        media_type=media_type,
        headers={
            "Cache-Control": "no-cache",
            "X-TTS-Provider": provider.name,
        },
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/tts/summary/{summary_id} — Generate Audio Summary (Podcast Mode)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/summary/{summary_id}")
async def generate_audio_summary(
    summary_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Generate (or retrieve cached) audio summary for a video analysis.

    This creates a podcast-style audio from the analysis content:
    - Intro + key points + critical analysis + conclusion + outro
    - Cached on Cloudflare R2 for instant replay

    Body (optional): { language?, gender?, speed?, force_regenerate? }
    Returns: { audio_url, duration_estimate, script_chars, cached, language, gender }
    """
    from tts.audio_summary import (
        get_or_generate_audio_summary,
        AUDIO_SUMMARY_LIMITS,
    )

    user_plan = current_user.plan or "free"
    request.query_params.get("platform", "web")

    # ── Plan gating ──────────────────────────────────────────────────────
    limit = AUDIO_SUMMARY_LIMITS.get(user_plan, 0)
    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "audio_summary_not_available",
                "message": "Les résumés audio ne sont pas disponibles sur votre plan.",
                "action": "upgrade",
            },
        )

    # ── Parse optional body ──────────────────────────────────────────────
    try:
        body = await request.json()
        # Handle double-stringified JSON from frontend
        if isinstance(body, str):
            import json as json_module
            body = json_module.loads(body)
    except Exception:
        body = {}

    if not isinstance(body, dict):
        body = {}

    language = body.get("language", "fr")
    gender = body.get("gender", "female")
    speed = body.get("speed", 1.0)
    force_regenerate = body.get("force_regenerate", False)

    # Validate
    if language not in ("fr", "en"):
        language = "fr"
    if gender not in ("male", "female"):
        gender = "female"
    speed = max(0.25, min(4.0, float(speed)))

    # ── Verify summary ownership ─────────────────────────────────────────

    # We need a DB session — use the same dependency pattern

    # Direct session creation for this endpoint
    from db.database import async_session_maker
    async with async_session_maker() as db:
        from sqlalchemy import select as _select
        from db.database import Summary

        result = await db.execute(
            _select(Summary).where(
                Summary.id == summary_id,
                Summary.user_id == current_user.id,
            )
        )
        summary = result.scalar_one_or_none()

        if not summary:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "summary_not_found",
                    "message": "Analyse introuvable ou ne vous appartient pas.",
                },
            )

        # ── Generate or retrieve ─────────────────────────────────────────
        try:
            result = await get_or_generate_audio_summary(
                summary_id=summary_id,
                db=db,
                language=language,
                gender=gender,
                speed=speed,
                force_regenerate=force_regenerate,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except RuntimeError as e:
            logger.error("Audio summary generation failed: %s", e)
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "audio_summary_failed",
                    "message": "La génération du résumé audio a échoué. Réessayez.",
                },
            )

    logger.info("Audio summary served", extra={
        "user_id": current_user.id,
        "summary_id": summary_id,
        "cached": result["cached"],
        "language": language,
    })

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/tts/dub/{summary_id} — Dubbed Audio (translated summary)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/dub/{summary_id}")
async def generate_dubbed_audio(
    summary_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Generate a dubbed (translated) audio summary — Expert plan only.

    Translates the analysis into the target language via Mistral AI,
    then generates TTS audio in that language.

    Body: { target_language, gender?, speed?, force_regenerate? }
    Returns: { audio_url, duration_estimate, dubbed: true, ... }
    """
    from tts.audio_summary import (
        get_or_generate_dubbed_audio,
        DUBBING_LIMITS,
        SUPPORTED_DUBBING_LANGUAGES,
    )

    user_plan = current_user.plan or "free"

    # ── Plan gating (Expert only) ────────────────────────────────────────
    limit = DUBBING_LIMITS.get(user_plan, 0)
    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "dubbing_not_available",
                "message": "La traduction audio est réservée au plan Expert.",
                "action": "upgrade",
            },
        )

    # ── Parse body ───────────────────────────────────────────────────────
    try:
        body = await request.json()
    except Exception:
        body = {}

    target_language = body.get("target_language", "en")
    gender = body.get("gender", "female")
    speed = body.get("speed", 1.0)
    force_regenerate = body.get("force_regenerate", False)

    if target_language not in SUPPORTED_DUBBING_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "unsupported_language",
                "message": f"Langue non supportée. Langues disponibles : {list(SUPPORTED_DUBBING_LANGUAGES.keys())}",
            },
        )

    # ── Verify summary ownership ─────────────────────────────────────────
    from db.database import async_session_maker, Summary as SummaryModel
    from sqlalchemy import select as _select

    async with async_session_maker() as db:
        result = await db.execute(
            _select(SummaryModel).where(
                SummaryModel.id == summary_id,
                SummaryModel.user_id == current_user.id,
            )
        )
        summary = result.scalar_one_or_none()

        if not summary:
            raise HTTPException(status_code=404, detail="Analyse introuvable.")

        try:
            result = await get_or_generate_dubbed_audio(
                summary_id=summary_id,
                db=db,
                target_language=target_language,
                gender=gender,
                speed=speed,
                force_regenerate=force_regenerate,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except RuntimeError as e:
            logger.error("Dubbing generation failed: %s", e)
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "dubbing_failed",
                    "message": "La traduction audio a échoué. Réessayez.",
                },
            )

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/tts/dub/languages — List supported dubbing languages
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dub/languages")
async def list_dubbing_languages():
    """Return supported languages for audio dubbing."""
    from tts.audio_summary import SUPPORTED_DUBBING_LANGUAGES
    return {
        "languages": [
            {"code": code, "name": name}
            for code, name in SUPPORTED_DUBBING_LANGUAGES.items()
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/tts/voices — List available voices (plan-gated)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/voices")
async def list_voices(
    current_user: User = Depends(get_current_user),
):
    """Return available ElevenLabs voices (cached 1h). Free users get empty list."""
    import time

    # Plan gating — free users cannot access TTS
    user_plan = current_user.plan or "free"
    if user_plan == "free":
        return {
            "voices": [],
            "default_voices": {},
            "message": "TTS non disponible pour le plan gratuit. Passez au plan Etudiant+.",
        }

    now = time.time()

    if _voices_cache["data"] and _voices_cache["expires"] > now:
        return _voices_cache["data"]

    api_key = get_elevenlabs_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="TTS service not configured")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{ELEVENLABS_BASE_URL}/voices",
                headers={"xi-api-key": api_key},
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch voices from ElevenLabs"
                )

            data = response.json()
            voices = [
                {
                    "voice_id": v["voice_id"],
                    "name": v["name"],
                    "category": v.get("category", ""),
                    "labels": v.get("labels", {}),
                    "preview_url": v.get("preview_url", ""),
                }
                for v in data.get("voices", [])
            ]

            result = {
                "voices": voices,
                "default_voices": {
                    "fr": {"male": get_voice_id("fr", "male"), "female": get_voice_id("fr", "female")},
                    "en": {"male": get_voice_id("en", "male"), "female": get_voice_id("en", "female")},
                },
            }

            _voices_cache["data"] = result
            _voices_cache["expires"] = now + 3600

            return result

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Voices request timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch ElevenLabs voices: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch voices")


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/tts/status — TTS availability check (v5 — multi-provider)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def tts_status():
    """Check TTS availability and active provider."""
    from tts.providers import ElevenLabsTTSProvider, VoxtralTTSProvider, OpenAITTSProvider
    from core.config import settings as _settings

    elevenlabs_available = ElevenLabsTTSProvider().is_available()
    voxtral_available = VoxtralTTSProvider().is_available()
    openai_available = OpenAITTSProvider().is_available()

    # Determine active provider (same priority as get_tts_provider)
    if elevenlabs_available:
        active_provider = "elevenlabs"
    elif voxtral_available:
        active_provider = "voxtral"
    elif openai_available:
        active_provider = "openai"
    else:
        active_provider = None

    return {
        "available": active_provider is not None,
        "active_provider": active_provider,
        "providers": {
            "elevenlabs": {
                "available": elevenlabs_available,
                "model": "eleven_multilingual_v2",
            },
            "voxtral": {
                "available": voxtral_available,
                "model": _settings.VOXTRAL_MODEL,
            },
            "openai": {
                "available": openai_available,
                "model": "tts-1",
            },
        },
        "max_text_length": MAX_TEXT_LENGTH,
        "supported_languages": ["fr", "en"],
        "supported_genders": ["male", "female"],
        "speed_range": {"min": 0.7, "max": 3.0, "default": 1.0},
    }
           