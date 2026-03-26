"""
TTS PROVIDERS — Multi-provider abstraction with fallback
v1.0 — ElevenLabs primary + OpenAI fallback

Architecture:
    get_tts_provider() → ElevenLabsTTSProvider (if circuit OK)
                       → OpenAITTSProvider     (fallback)
                       → RuntimeError          (both down)
"""

import logging
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional

import httpx

from core.config import get_elevenlabs_key
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
# Provider Selection — Smart fallback
# ═══════════════════════════════════════════════════════════════════════════════


def get_tts_provider() -> TTSProvider:
    """
    Get the best available TTS provider.

    Priority:
        1. ElevenLabs (if API key present AND circuit breaker allows)
        2. OpenAI     (fallback)
        3. RuntimeError if both unavailable
    """
    elevenlabs = ElevenLabsTTSProvider()
    if elevenlabs.is_available():
        return elevenlabs

    logger.warning(
        "ElevenLabs TTS unavailable (circuit: %s), trying OpenAI fallback",
        elevenlabs_circuit.state,
    )

    openai_provider = OpenAITTSProvider()
    if openai_provider.is_available():
        logger.info("Using OpenAI TTS as fallback provider")
        return openai_provider

    raise RuntimeError(
        "No TTS provider available — ElevenLabs circuit open and OpenAI key missing"
    )
