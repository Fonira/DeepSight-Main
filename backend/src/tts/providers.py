"""
TTS PROVIDERS — Multi-provider abstraction with fallback
v2.0 — ElevenLabs primary + Voxtral (Mistral) secondary + OpenAI fallback

Architecture:
    get_tts_provider() → ElevenLabsTTSProvider (if circuit OK)
                       → VoxtralTTSProvider    (if voices configured)
                       → OpenAITTSProvider     (fallback)
                       → RuntimeError          (all down)
"""

import base64
import json
import logging
import time
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional

import httpx

from core.config import get_elevenlabs_key, get_mistral_key, get_voxtral_voice_id, is_voxtral_available
from tts.service import (
    get_voice_id,
    DEFAULT_MODEL_ID,
    elevenlabs_circuit,
)

logger = logging.getLogger(__name__)

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"


# ═══════════════════════════════════════════════════════════════════════════════
# Abstract Provider
# ═══════════════════════════════════════════════════════════════════════════════


class TTSProvider(ABC):
    """Abstract base class for TTS providers."""

    name: str = "base"

    @abstractmethod
    async def generate_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: str = "fr",
        gender: str = "female",
        speed: float = 1.0,
        model_id: Optional[str] = None,
    ) -> tuple[AsyncIterator[bytes], httpx.AsyncClient, str]:
        """
        Generate TTS audio stream.

        Returns:
            (stream_iterator, client_to_close, media_type)
        """
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this provider is currently available."""
        ...


# ═══════════════════════════════════════════════════════════════════════════════
# ElevenLabs — Primary Provider
# ═══════════════════════════════════════════════════════════════════════════════


class ElevenLabsTTSProvider(TTSProvider):
    """ElevenLabs TTS — primary provider. Uses eleven_multilingual_v2."""

    name = "elevenlabs"

    def is_available(self) -> bool:
        return bool(get_elevenlabs_key()) and elevenlabs_circuit.can_execute()

    async def generate_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: str = "fr",
        gender: str = "female",
        speed: float = 1.0,
        model_id: Optional[str] = None,
    ) -> tuple[AsyncIterator[bytes], httpx.AsyncClient, str]:
        api_key = get_elevenlabs_key()
        if not api_key:
            raise RuntimeError("ElevenLabs API key not configured")

        resolved_voice = voice_id or get_voice_id(language, gender)
        resolved_model = model_id or DEFAULT_MODEL_ID

        url = f"{ELEVENLABS_BASE_URL}/text-to-speech/{resolved_voice}"

        payload = {
            "text": text,
            "model_id": resolved_model,
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

        client = httpx.AsyncClient(timeout=60.0)

        try:
            req = client.build_request("POST", url, headers=headers, json=payload)
            response = await client.send(req, stream=True)
        except httpx.TimeoutException:
            await client.aclose()
            elevenlabs_circuit.record_failure()
            logger.error("ElevenLabs TTS timeout")
            raise
        except Exception as e:
            await client.aclose()
            elevenlabs_circuit.record_failure()
            logger.error("ElevenLabs TTS connection error: %s", e)
            raise

        # ── Validate response ────────────────────────────────────────────
        if response.status_code == 401:
            await response.aclose()
            await client.aclose()
            elevenlabs_circuit.record_failure()
            raise RuntimeError("ElevenLabs API key invalid (401)")

        if response.status_code != 200:
            error_body = (await response.aread()).decode(errors="replace")[:200]
            await response.aclose()
            await client.aclose()
            elevenlabs_circuit.record_failure()
            raise RuntimeError(
                f"ElevenLabs error {response.status_code}: {error_body}"
            )

        elevenlabs_circuit.record_success()

        async def _stream() -> AsyncIterator[bytes]:
            try:
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    yield chunk
            finally:
                await response.aclose()
                await client.aclose()

        return _stream(), client, "audio/mpeg"


# ═══════════════════════════════════════════════════════════════════════════════
# OpenAI — Fallback Provider
# ═══════════════════════════════════════════════════════════════════════════════


class OpenAITTSProvider(TTSProvider):
    """OpenAI TTS — fallback when ElevenLabs circuit breaker is open."""

    name = "openai"

    # Best French-speaking voices on OpenAI
    VOICE_MAP = {
        ("fr", "female"): "nova",
        ("fr", "male"): "onyx",
        ("en", "female"): "nova",
        ("en", "male"): "onyx",
    }

    def _get_api_key(self) -> Optional[str]:
        """Safely get OpenAI API key from config."""
        try:
            from core.config import settings
            return getattr(settings, "OPENAI_API_KEY", None) or None
        except Exception:
            return None

    def is_available(self) -> bool:
        return bool(self._get_api_key())

    async def generate_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: str = "fr",
        gender: str = "female",
        speed: float = 1.0,
        model_id: Optional[str] = None,
    ) -> tuple[AsyncIterator[bytes], httpx.AsyncClient, str]:
        api_key = self._get_api_key()
        if not api_key:
            raise RuntimeError("OpenAI API key not configured")

        # Resolve voice (ignore voice_id — OpenAI uses named voices)
        voice = self.VOICE_MAP.get((language, gender), "nova")

        # Clamp speed to OpenAI range
        openai_speed = max(0.25, min(4.0, speed))

        url = "https://api.openai.com/v1/audio/speech"

        payload = {
            "model": "tts-1",
            "input": text[:4096],  # OpenAI hard limit
            "voice": voice,
            "response_format": "mp3",
            "speed": openai_speed,
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        client = httpx.AsyncClient(timeout=60.0)

        try:
            req = client.build_request("POST", url, headers=headers, json=payload)
            response = await client.send(req, stream=True)
        except httpx.TimeoutException:
            await client.aclose()
            logger.error("OpenAI TTS timeout")
            raise
        except Exception as e:
            await client.aclose()
            logger.error("OpenAI TTS connection error: %s", e)
            raise

        if response.status_code != 200:
            error_body = (await response.aread()).decode(errors="replace")[:200]
            await response.aclose()
            await client.aclose()
            raise RuntimeError(
                f"OpenAI TTS error {response.status_code}: {error_body}"
            )

        async def _stream() -> AsyncIterator[bytes]:
            try:
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    yield chunk
            finally:
                await response.aclose()
                await client.aclose()

        return _stream(), client, "audio/mpeg"


# ═══════════════════════════════════════════════════════════════════════════════
# Voxtral (Mistral) — Secondary Provider
# ═══════════════════════════════════════════════════════════════════════════════

# Simple circuit breaker for Voxtral
_voxtral_failures: int = 0
_voxtral_last_failure: float = 0.0
_VOXTRAL_MAX_FAILURES: int = 3
_VOXTRAL_COOLDOWN: float = 120.0  # 2 minutes

VOXTRAL_API_URL = "https://api.mistral.ai/v1/audio/speech"


def _voxtral_circuit_ok() -> bool:
    """Check if Voxtral circuit breaker allows requests."""
    global _voxtral_failures, _voxtral_last_failure
    if _voxtral_failures < _VOXTRAL_MAX_FAILURES:
        return True
    if time.time() - _voxtral_last_failure > _VOXTRAL_COOLDOWN:
        _voxtral_failures = 0
        return True
    return False


def _voxtral_record_failure() -> None:
    global _voxtral_failures, _voxtral_last_failure
    _voxtral_failures += 1
    _voxtral_last_failure = time.time()


def _voxtral_record_success() -> None:
    global _voxtral_failures
    _voxtral_failures = 0


class VoxtralTTSProvider(TTSProvider):
    """
    Voxtral TTS (Mistral AI) — secondary provider.

    Uses Mistral's voxtral-mini-tts-2603 model.
    Requires voice_ids to be pre-created via the Voices API
    and configured in env vars (VOXTRAL_VOICE_FR_FEMALE, etc.).

    API returns base64-encoded audio, supports streaming SSE.
    """

    name = "voxtral"

    def is_available(self) -> bool:
        return is_voxtral_available() and _voxtral_circuit_ok()

    def _resolve_voice_id(self, language: str, gender: str, voice_id: Optional[str]) -> Optional[str]:
        """Resolve voice_id: explicit > config-based."""
        if voice_id:
            return voice_id
        return get_voxtral_voice_id(language, gender)

    async def generate_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: str = "fr",
        gender: str = "female",
        speed: float = 1.0,
        model_id: Optional[str] = None,
    ) -> tuple[AsyncIterator[bytes], httpx.AsyncClient, str]:
        api_key = get_mistral_key()
        if not api_key:
            raise RuntimeError("Mistral API key not configured for Voxtral TTS")

        resolved_voice = self._resolve_voice_id(language, gender, voice_id)
        if not resolved_voice:
            raise RuntimeError(
                f"No Voxtral voice configured for {language}/{gender}"
            )

        from core.config import settings as _settings
        resolved_model = model_id or _settings.VOXTRAL_MODEL

        payload = {
            "model": resolved_model,
            "input": text,
            "voice_id": resolved_voice,
            "response_format": "mp3",
            "stream": True,
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }

        client = httpx.AsyncClient(timeout=120.0)

        try:
            req = client.build_request("POST", VOXTRAL_API_URL, headers=headers, json=payload)
            response = await client.send(req, stream=True)
        except httpx.TimeoutException:
            await client.aclose()
            _voxtral_record_failure()
            logger.error("Voxtral TTS timeout")
            raise
        except Exception as e:
            await client.aclose()
            _voxtral_record_failure()
            logger.error("Voxtral TTS connection error: %s", e)
            raise

        if response.status_code != 200:
            error_body = (await response.aread()).decode(errors="replace")[:200]
            await response.aclose()
            await client.aclose()
            _voxtral_record_failure()
            raise RuntimeError(
                f"Voxtral TTS error {response.status_code}: {error_body}"
            )

        _voxtral_record_success()

        async def _stream() -> AsyncIterator[bytes]:
            """Parse SSE events, decode base64 audio chunks, yield raw bytes."""
            try:
                buffer = ""
                async for raw_chunk in response.aiter_text():
                    buffer += raw_chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()

                        if not line or line.startswith(":"):
                            continue

                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                return

                            try:
                                event_data = json.loads(data_str)
                                # speech.audio.delta → audio_data is base64
                                audio_b64 = event_data.get("audio_data", "")
                                if audio_b64:
                                    yield base64.b64decode(audio_b64)
                            except (json.JSONDecodeError, Exception) as e:
                                logger.debug("Voxtral SSE parse skip: %s", e)
                                continue
            finally:
                await response.aclose()
                await client.aclose()

        return _stream(), client, "audio/mpeg"

    async def generate_bytes(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: str = "fr",
        gender: str = "female",
        speed: float = 1.0,
    ) -> bytes:
        """
        Non-streaming generation — returns full audio bytes.
        Used by audio_summary.py for R2 upload.
        """
        api_key = get_mistral_key()
        if not api_key:
            raise RuntimeError("Mistral API key not configured for Voxtral TTS")

        resolved_voice = self._resolve_voice_id(language, gender, voice_id)
        if not resolved_voice:
            raise RuntimeError(f"No Voxtral voice configured for {language}/{gender}")

        from core.config import settings as _settings

        payload = {
            "model": _settings.VOXTRAL_MODEL,
            "input": text,
            "voice_id": resolved_voice,
            "response_format": "mp3",
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(VOXTRAL_API_URL, headers=headers, json=payload)
            except httpx.TimeoutException:
                _voxtral_record_failure()
                raise RuntimeError("Voxtral TTS timeout")

            if response.status_code != 200:
                _voxtral_record_failure()
                error_body = response.text[:200]
                raise RuntimeError(f"Voxtral TTS error {response.status_code}: {error_body}")

            _voxtral_record_success()

            data = response.json()
            audio_b64 = data.get("audio_data", "")
            if not audio_b64:
                raise RuntimeError("Voxtral TTS returned empty audio_data")

            return base64.b64decode(audio_b64)


# ═══════════════════════════════════════════════════════════════════════════════
# Provider Selection — Smart fallback
# ═══════════════════════════════════════════════════════════════════════════════


def get_tts_provider() -> TTSProvider:
    """
    Get the best available TTS provider.

    Priority:
        1. ElevenLabs (if API key present AND circuit breaker allows)
        2. Voxtral    (if Mistral key + voice IDs configured + circuit OK)
        3. OpenAI     (fallback)
        4. RuntimeError if all unavailable
    """
    elevenlabs = ElevenLabsTTSProvider()
    if elevenlabs.is_available():
        return elevenlabs

    logger.warning(
        "ElevenLabs TTS unavailable (circuit: %s), trying Voxtral",
        elevenlabs_circuit.state,
    )

    voxtral = VoxtralTTSProvider()
    if voxtral.is_available():
        logger.info("Using Voxtral TTS as secondary provider")
        return voxtral

    logger.warning("Voxtral TTS unavailable, trying OpenAI fallback")

    openai_provider = OpenAITTSProvider()
    if openai_provider.is_available():
        logger.info("Using OpenAI TTS as fallback provider")
        return openai_provider

    raise RuntimeError(
        "No TTS provider available — ElevenLabs circuit open, "
        "Voxtral not configured, OpenAI key missing"
    )
