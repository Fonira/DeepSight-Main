"""
AUDIO SUMMARY SERVICE — Generate podcast-style audio from video analyses
v1.0 — ElevenLabs TTS + R2 storage + Redis cache

Architecture:
    1. Extract key sections from Summary (points clés, analyse critique, conclusion)
    2. Reformat into a natural "podcast script" for voice reading
    3. Generate audio via ElevenLabs TTS (multi_v2)
    4. Upload to Cloudflare R2 for persistent storage
    5. Cache URL in Redis for fast retrieval

Costs: ~3000-5000 chars per summary → ~$1-1.50 per audio generation
Mitigation: aggressive caching (R2 persistent + Redis), plan-based quotas
"""

import hashlib
import io
import logging
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import get_elevenlabs_key
from db.database import Summary
from storage.r2 import upload_to_r2, check_exists_r2, get_r2_public_url
from tts.service import (
    clean_text_for_tts,
    get_voice_id,
    DEFAULT_MODEL_ID,
    elevenlabs_circuit,
)

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════════════

R2_AUDIO_PREFIX = "audio-summaries"
MAX_SCRIPT_CHARS = 5000  # ElevenLabs limit per request
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

# Quotas per plan (monthly)
AUDIO_SUMMARY_LIMITS = {
    "free": 0,
    "pro": 10,
    "expert": 50,
    "unlimited": 10000,
}


# ═══════════════════════════════════════════════════════════════════════════════
# Script Builder — Transform analysis markdown into podcast script
# ═══════════════════════════════════════════════════════════════════════════════


def _extract_section(content: str, keywords: list[str]) -> str:
    """Extract a section from markdown content by header keywords."""
    lines = content.split("\n")
    capturing = False
    captured: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("##"):
            if capturing:
                break
            header_text = stripped.lstrip("#").strip().lower()
            if any(kw in header_text for kw in keywords):
                capturing = True
                continue
        elif capturing:
            captured.append(line)

    return "\n".join(captured).strip()


def build_podcast_script(
    summary: Summary,
    language: str = "fr",
) -> str:
    """
    Transform a Summary's markdown analysis into a natural podcast script.

    Structure:
        1. Introduction (title + channel)
        2. Points clés (key takeaways)
        3. Analyse critique (critical analysis)
        4. Conclusion

    Returns cleaned text ready for TTS (no markdown, no emojis).
    """
    content = summary.summary_content or ""
    if not content.strip():
        return ""

    parts: list[str] = []

    # ── 1. Introduction ──────────────────────────────────────────────────
    title = getattr(summary, 'video_title', None) or getattr(summary, 'title', None) or "cette vidéo"
    channel = getattr(summary, 'video_channel', None) or getattr(summary, 'channel_name', None) or "un créateur"

    if language == "fr":
        parts.append(
            f"Voici la synthèse audio de la vidéo « {title} » "
            f"par {channel}."
        )
    else:
        parts.append(
            f"Here's the audio summary of the video \"{title}\" "
            f"by {channel}."
        )

    # ── 2. Points clés ───────────────────────────────────────────────────
    key_points = _extract_section(content, [
        "points clés", "key points", "points essentiels",
        "idées principales", "résumé", "summary", "vue d'ensemble",
    ])
    if key_points:
        transition = "Commençons par les points essentiels." if language == "fr" else "Let's start with the key points."
        parts.append(transition)
        parts.append(key_points)

    # ── 3. Analyse critique ──────────────────────────────────────────────
    critical = _extract_section(content, [
        "analyse critique", "critical analysis", "évaluation",
        "limites", "nuances", "strengths", "weaknesses",
    ])
    if critical:
        transition = "Passons à l'analyse critique." if language == "fr" else "Now for the critical analysis."
        parts.append(transition)
        parts.append(critical)

    # ── 4. Conclusion ────────────────────────────────────────────────────
    conclusion = _extract_section(content, [
        "conclusion", "en résumé", "takeaways", "pour conclure",
        "en bref", "to summarize",
    ])
    if conclusion:
        transition = "Pour conclure." if language == "fr" else "To wrap up."
        parts.append(transition)
        parts.append(conclusion)

    # ── 5. Outro ─────────────────────────────────────────────────────────
    if language == "fr":
        parts.append("C'était la synthèse audio DeepSight. Bonne exploration !")
    else:
        parts.append("That was the DeepSight audio summary. Happy exploring!")

    # Assemble and clean
    raw_script = "\n\n".join(parts)
    cleaned = clean_text_for_tts(raw_script, strip_questions=True)

    return cleaned


# ═══════════════════════════════════════════════════════════════════════════════
# R2 Key Generation — Deterministic for cache hits
# ═══════════════════════════════════════════════════════════════════════════════


def _build_r2_key(
    summary_id: int,
    language: str,
    gender: str,
    voice_id: Optional[str] = None,
) -> str:
    """
    Build a deterministic R2 object key for an audio summary.
    Format: audio-summaries/{summary_id}/{hash}.mp3
    """
    hash_input = f"{summary_id}:{language}:{gender}:{voice_id or 'default'}"
    short_hash = hashlib.md5(hash_input.encode()).hexdigest()[:12]
    return f"{R2_AUDIO_PREFIX}/{summary_id}/{short_hash}.mp3"


# ═══════════════════════════════════════════════════════════════════════════════
# Audio Generation — ElevenLabs TTS → bytes
# ═══════════════════════════════════════════════════════════════════════════════


async def _generate_audio_bytes(
    text: str,
    language: str = "fr",
    gender: str = "female",
    voice_id: Optional[str] = None,
    speed: float = 1.0,
) -> bytes:
    """
    Call ElevenLabs TTS API and collect all audio bytes.

    Raises RuntimeError if generation fails.
    """
    api_key = get_elevenlabs_key()
    if not api_key:
        raise RuntimeError("ElevenLabs API key not configured")

    if not elevenlabs_circuit.can_execute():
        raise RuntimeError("ElevenLabs circuit breaker is open")

    resolved_voice = voice_id or get_voice_id(language, gender)

    url = f"{ELEVENLABS_BASE_URL}/text-to-speech/{resolved_voice}"

    payload = {
        "text": text,
        "model_id": DEFAULT_MODEL_ID,
        "language_code": language,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.3,
            "use_speaker_boost": True,
            "speed": speed,
        },
    }

    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException:
            elevenlabs_circuit.record_failure()
            raise RuntimeError("ElevenLabs TTS timeout during audio summary generation")

        if response.status_code != 200:
            elevenlabs_circuit.record_failure()
            error_body = response.text[:200]
            raise RuntimeError(
                f"ElevenLabs TTS error {response.status_code}: {error_body}"
            )

        elevenlabs_circuit.record_success()
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════
# Main Service — Get or Generate Audio Summary
# ═══════════════════════════════════════════════════════════════════════════════


async def get_or_generate_audio_summary(
    summary_id: int,
    db: AsyncSession,
    language: str = "fr",
    gender: str = "female",
    voice_id: Optional[str] = None,
    speed: float = 1.0,
    force_regenerate: bool = False,
) -> dict:
    """
    Get (from cache) or generate an audio summary for a video analysis.

    Returns:
        {
            "audio_url": str,       # Public R2 URL
            "duration_estimate": int, # Estimated duration in seconds
            "script_chars": int,     # Number of characters in the script
            "cached": bool,          # Whether the audio was served from cache
            "language": str,
            "gender": str,
        }

    Raises:
        ValueError: if summary not found or content empty
        RuntimeError: if TTS generation fails
    """
    # ── 1. Load summary ──────────────────────────────────────────────────
    result = await db.execute(
        select(Summary).where(Summary.id == summary_id)
    )
    summary = result.scalar_one_or_none()

    if not summary:
        raise ValueError(f"Summary {summary_id} not found")

    if not summary.summary_content or not summary.summary_content.strip():
        raise ValueError(f"Summary {summary_id} has no content")

    # ── 2. Check R2 cache ────────────────────────────────────────────────
    r2_key = _build_r2_key(summary_id, language, gender, voice_id)

    if not force_regenerate:
        try:
            exists = await check_exists_r2(r2_key)
            if exists:
                audio_url = get_r2_public_url(r2_key)
                logger.info(
                    "Audio summary cache hit",
                    extra={"summary_id": summary_id, "r2_key": r2_key},
                )
                return {
                    "audio_url": audio_url,
                    "duration_estimate": _estimate_duration(summary.summary_content),
                    "script_chars": 0,  # Not computed on cache hit
                    "cached": True,
                    "language": language,
                    "gender": gender,
                }
        except Exception as e:
            logger.warning("R2 cache check failed: %s", e)

    # ── 3. Build podcast script ──────────────────────────────────────────
    script = build_podcast_script(summary, language=language)

    if not script:
        raise ValueError("Could not build audio script from analysis content")

    logger.info(
        "Audio summary script built",
        extra={
            "summary_id": summary_id,
            "script_chars": len(script),
            "language": language,
        },
    )

    # ── 4. Generate audio ────────────────────────────────────────────────
    audio_bytes = await _generate_audio_bytes(
        text=script,
        language=language,
        gender=gender,
        voice_id=voice_id,
        speed=speed,
    )

    logger.info(
        "Audio summary generated",
        extra={
            "summary_id": summary_id,
            "audio_bytes": len(audio_bytes),
        },
    )

    # ── 5. Upload to R2 ─────────────────────────────────────────────────
    try:
        audio_url = await upload_to_r2(
            image_bytes=audio_bytes,  # reusing the same upload function
            key=r2_key,
            content_type="audio/mpeg",
        )
    except Exception as e:
        logger.error("R2 upload failed for audio summary: %s", e)
        raise RuntimeError(f"Failed to store audio summary: {e}")

    # ── 6. Return result ─────────────────────────────────────────────────
    duration_estimate = _estimate_duration(script)

    return {
        "audio_url": audio_url,
        "duration_estimate": duration_estimate,
        "script_chars": len(script),
        "cached": False,
        "language": language,
        "gender": gender,
    }


def _estimate_duration(text: str) -> int:
    """
    Estimate audio duration in seconds from text length.
    Average speaking rate: ~150 words/minute in French, ~160 in English.
    """
    word_count = len(text.split())
    # ~2.5 words per second average
    return max(10, int(word_count / 2.5))


# ═══════════════════════════════════════════════════════════════════════════════
# DUBBING — Translate + generate audio in another language (Feature #4)
# ═══════════════════════════════════════════════════════════════════════════════

# Monthly quotas for dubbing
DUBBING_LIMITS = {
    "free": 0,
    "pro": 0,
    "expert": 5,
    "unlimited": 10000,
}

SUPPORTED_DUBBING_LANGUAGES = {
    "fr": "Français",
    "en": "English",
    "es": "Español",
    "de": "Deutsch",
    "it": "Italiano",
    "pt": "Português",
}


async def _translate_text_with_mistral(
    text: str,
    source_language: str,
    target_language: str,
) -> str:
    """
    Translate text using Mistral AI (ministral-8b for cost efficiency).

    Uses the internal Mistral model to translate the podcast script
    while preserving the natural conversational tone.
    """
    from core.config import get_mistral_key

    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("Mistral API key not configured for translation")

    source_name = SUPPORTED_DUBBING_LANGUAGES.get(source_language, source_language)
    target_name = SUPPORTED_DUBBING_LANGUAGES.get(target_language, target_language)

    system_prompt = (
        f"Tu es un traducteur professionnel. Traduis le texte suivant "
        f"du {source_name} vers le {target_name}. "
        f"Conserve le ton naturel et conversationnel (c'est un script audio). "
        f"Ne traduis pas les noms propres ni les titres de vidéos entre guillemets. "
        f"Retourne UNIQUEMENT la traduction, sans commentaire."
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "ministral-8b-2412",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ],
                "temperature": 0.3,
                "max_tokens": 8000,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Mistral translation failed: {response.status_code}")

        data = response.json()
        translated = data["choices"][0]["message"]["content"].strip()

    logger.info(
        "Dubbing translation completed",
        extra={
            "source": source_language,
            "target": target_language,
            "source_chars": len(text),
            "translated_chars": len(translated),
        },
    )

    return translated


async def get_or_generate_dubbed_audio(
    summary_id: int,
    db: AsyncSession,
    target_language: str = "en",
    gender: str = "female",
    voice_id: Optional[str] = None,
    speed: float = 1.0,
    force_regenerate: bool = False,
) -> dict:
    """
    Generate a dubbed (translated) audio summary.

    Flow:
        1. Build podcast script in source language (from Summary)
        2. Translate script to target_language via Mistral
        3. Generate TTS audio in target language
        4. Upload to R2

    Returns same dict as get_or_generate_audio_summary + target_language field.
    """
    # ── 1. Load summary ──────────────────────────────────────────────────
    result = await db.execute(
        select(Summary).where(Summary.id == summary_id)
    )
    summary = result.scalar_one_or_none()

    if not summary:
        raise ValueError(f"Summary {summary_id} not found")

    if not summary.summary_content or not summary.summary_content.strip():
        raise ValueError(f"Summary {summary_id} has no content")

    # ── 2. Check R2 cache (dubbed version) ───────────────────────────────
    r2_key = f"{R2_AUDIO_PREFIX}/{summary_id}/dubbed_{target_language}_{gender}.mp3"

    if not force_regenerate:
        try:
            exists = await check_exists_r2(r2_key)
            if exists:
                audio_url = get_r2_public_url(r2_key)
                logger.info(
                    "Dubbed audio cache hit",
                    extra={"summary_id": summary_id, "target": target_language},
                )
                return {
                    "audio_url": audio_url,
                    "duration_estimate": _estimate_duration(summary.summary_content),
                    "script_chars": 0,
                    "cached": True,
                    "language": target_language,
                    "gender": gender,
                    "dubbed": True,
                    "source_language": summary.lang or "fr",
                    "target_language": target_language,
                }
        except Exception as e:
            logger.warning("R2 cache check failed for dubbed audio: %s", e)

    # ── 3. Build source script ───────────────────────────────────────────
    source_language = summary.lang or "fr"
    source_script = build_podcast_script(summary, language=source_language)

    if not source_script:
        raise ValueError("Could not build audio script from analysis content")

    # ── 4. Translate if needed ───────────────────────────────────────────
    if target_language != source_language:
        translated_script = await _translate_text_with_mistral(
            text=source_script,
            source_language=source_language,
            target_language=target_language,
        )
    else:
        translated_script = source_script

    # ── 5. Generate audio in target language ─────────────────────────────
    audio_bytes = await _generate_audio_bytes(
        text=translated_script,
        language=target_language,
        gender=gender,
        voice_id=voice_id,
        speed=speed,
    )

    # ── 6. Upload to R2 ─────────────────────────────────────────────────
    try:
        audio_url = await upload_to_r2(
            image_bytes=audio_bytes,
            key=r2_key,
            content_type="audio/mpeg",
        )
    except Exception as e:
        raise RuntimeError(f"Failed to store dubbed audio: {e}")

    duration_estimate = _estimate_duration(translated_script)

    logger.info(
        "Dubbed audio generated",
        extra={
            "summary_id": summary_id,
            "source": source_language,
            "target": target_language,
            "audio_bytes": len(audio_bytes),
        },
    )

    return {
        "audio_url": audio_url,
        "duration_estimate": duration_estimate,
        "script_chars": len(translated_script),
        "cached": False,
        "language": target_language,
        "gender": gender,
        "dubbed": True,
        "source_language": source_language,
        "target_language": target_language,
    }
