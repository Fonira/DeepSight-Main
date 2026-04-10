"""
Tests for VoxtralTTSProvider — Mistral Voxtral TTS integration.

Tests cover:
- Provider availability detection
- Circuit breaker behavior
- Non-streaming generate_bytes (audio_summary path)
- Streaming generate_stream (router path)
- Fallback chain ordering in get_tts_provider()
"""

import base64
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture(autouse=True)
def reset_voxtral_circuit():
    """Reset Voxtral circuit breaker between tests."""
    import tts.providers as mod
    mod._voxtral_failures = 0
    mod._voxtral_last_failure = 0.0
    yield
    mod._voxtral_failures = 0
    mod._voxtral_last_failure = 0.0


@pytest.fixture
def mock_voxtral_available():
    """Make Voxtral appear available."""
    with patch("tts.providers.is_voxtral_available", return_value=True), \
         patch("tts.providers.get_mistral_key", return_value="test-key"), \
         patch("tts.providers.get_voxtral_voice_id", return_value="voice-fr-001"):
        yield


@pytest.fixture
def mock_voxtral_unavailable():
    """Make Voxtral appear unavailable."""
    with patch("tts.providers.is_voxtral_available", return_value=False):
        yield


# =============================================================================
# AVAILABILITY
# =============================================================================

class TestVoxtralAvailability:

    def test_available_when_configured(self, mock_voxtral_available):
        from tts.providers import VoxtralTTSProvider
        provider = VoxtralTTSProvider()
        assert provider.is_available() is True

    def test_unavailable_when_no_voices(self, mock_voxtral_unavailable):
        from tts.providers import VoxtralTTSProvider
        provider = VoxtralTTSProvider()
        assert provider.is_available() is False

    def test_unavailable_when_circuit_open(self, mock_voxtral_available):
        from tts.providers import VoxtralTTSProvider, _VOXTRAL_MAX_FAILURES, _voxtral_record_failure
        for _ in range(_VOXTRAL_MAX_FAILURES):
            _voxtral_record_failure()

        provider = VoxtralTTSProvider()
        assert provider.is_available() is False


# =============================================================================
# CIRCUIT BREAKER
# =============================================================================

class TestVoxtralCircuitBreaker:

    def test_circuit_closed_initially(self):
        from tts.providers import _voxtral_circuit_ok
        assert _voxtral_circuit_ok() is True

    def test_circuit_opens_after_max_failures(self):
        from tts.providers import _voxtral_circuit_ok, _voxtral_record_failure, _VOXTRAL_MAX_FAILURES
        for _ in range(_VOXTRAL_MAX_FAILURES):
            _voxtral_record_failure()
        assert _voxtral_circuit_ok() is False

    def test_circuit_resets_on_success(self):
        from tts.providers import (
            _voxtral_circuit_ok, _voxtral_record_failure,
            _voxtral_record_success, _VOXTRAL_MAX_FAILURES,
        )
        for _ in range(_VOXTRAL_MAX_FAILURES):
            _voxtral_record_failure()
        assert _voxtral_circuit_ok() is False

        _voxtral_record_success()
        assert _voxtral_circuit_ok() is True

    def test_circuit_resets_after_cooldown(self):
        import time
        import tts.providers as mod
        from tts.providers import _voxtral_circuit_ok, _voxtral_record_failure, _VOXTRAL_MAX_FAILURES

        for _ in range(_VOXTRAL_MAX_FAILURES):
            _voxtral_record_failure()
        assert _voxtral_circuit_ok() is False

        # Simulate cooldown elapsed
        mod._voxtral_last_failure = time.time() - 200
        assert _voxtral_circuit_ok() is True


# =============================================================================
# GENERATE BYTES (non-streaming — audio_summary path)
# =============================================================================

class TestVoxtralGenerateBytes:

    @pytest.mark.asyncio
    async def test_successful_generation(self, mock_voxtral_available):
        from tts.providers import VoxtralTTSProvider

        fake_audio = b"fake-audio-mp3-data"
        fake_b64 = base64.b64encode(fake_audio).decode()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"audio_data": fake_b64}
        mock_response.text = ""

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            with patch("tts.providers.get_mistral_key", return_value="test-key"), \
                 patch("tts.providers.get_voxtral_voice_id", return_value="voice-fr-001"):
                provider = VoxtralTTSProvider()
                result = await provider.generate_bytes(
                    text="Bonjour, ceci est un test.",
                    language="fr",
                    gender="female",
                )

        assert result == fake_audio

    @pytest.mark.asyncio
    async def test_records_failure_on_error(self, mock_voxtral_available):
        from tts.providers import VoxtralTTSProvider
        import tts.providers as mod

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            with patch("tts.providers.get_mistral_key", return_value="test-key"), \
                 patch("tts.providers.get_voxtral_voice_id", return_value="voice-fr-001"):
                provider = VoxtralTTSProvider()
                with pytest.raises(RuntimeError, match="Voxtral TTS error 500"):
                    await provider.generate_bytes(text="test", language="fr")

        assert mod._voxtral_failures == 1

    @pytest.mark.asyncio
    async def test_raises_without_voice_id(self):
        from tts.providers import VoxtralTTSProvider

        with patch("tts.providers.get_mistral_key", return_value="test-key"), \
             patch("tts.providers.get_voxtral_voice_id", return_value=None):
            provider = VoxtralTTSProvider()
            with pytest.raises(RuntimeError, match="No Voxtral voice configured"):
                await provider.generate_bytes(text="test", language="fr")


# =============================================================================
# PROVIDER SELECTION (get_tts_provider)
# =============================================================================

class TestProviderSelection:

    def test_elevenlabs_first(self):
        from tts.providers import get_tts_provider, ElevenLabsTTSProvider

        with patch.object(ElevenLabsTTSProvider, "is_available", return_value=True):
            provider = get_tts_provider()
        assert provider.name == "elevenlabs"

    def test_voxtral_second(self):
        from tts.providers import get_tts_provider, ElevenLabsTTSProvider, VoxtralTTSProvider

        with patch.object(ElevenLabsTTSProvider, "is_available", return_value=False), \
             patch.object(VoxtralTTSProvider, "is_available", return_value=True):
            provider = get_tts_provider()
        assert provider.name == "voxtral"

    def test_openai_third(self):
        from tts.providers import get_tts_provider, ElevenLabsTTSProvider, VoxtralTTSProvider, OpenAITTSProvider

        with patch.object(ElevenLabsTTSProvider, "is_available", return_value=False), \
             patch.object(VoxtralTTSProvider, "is_available", return_value=False), \
             patch.object(OpenAITTSProvider, "is_available", return_value=True):
            provider = get_tts_provider()
        assert provider.name == "openai"

    def test_raises_when_all_unavailable(self):
        from tts.providers import get_tts_provider, ElevenLabsTTSProvider, VoxtralTTSProvider, OpenAITTSProvider

        with patch.object(ElevenLabsTTSProvider, "is_available", return_value=False), \
             patch.object(VoxtralTTSProvider, "is_available", return_value=False), \
             patch.object(OpenAITTSProvider, "is_available", return_value=False):
            with pytest.raises(RuntimeError, match="No TTS provider available"):
                get_tts_provider()


# =============================================================================
# CONFIG HELPERS
# =============================================================================

class TestVoxtralConfig:

    def test_get_voxtral_voice_id_returns_configured(self):
        with patch("core.config._settings") as mock_settings:
            mock_settings.VOXTRAL_VOICE_FR_FEMALE = "voice-fr-f-123"
            mock_settings.VOXTRAL_VOICE_FR_MALE = ""
            mock_settings.VOXTRAL_VOICE_EN_FEMALE = ""
            mock_settings.VOXTRAL_VOICE_EN_MALE = ""

            from core.config import get_voxtral_voice_id
            result = get_voxtral_voice_id("fr", "female")
            assert result == "voice-fr-f-123"

    def test_get_voxtral_voice_id_returns_none_when_empty(self):
        with patch("core.config._settings") as mock_settings:
            mock_settings.VOXTRAL_VOICE_FR_FEMALE = ""
            mock_settings.VOXTRAL_VOICE_FR_MALE = ""
            mock_settings.VOXTRAL_VOICE_EN_FEMALE = ""
            mock_settings.VOXTRAL_VOICE_EN_MALE = ""

            from core.config import get_voxtral_voice_id
            result = get_voxtral_voice_id("fr", "female")
            assert result is None

    def test_is_voxtral_available_needs_both_key_and_voice(self):
        with patch("core.config.get_mistral_key", return_value="key"), \
             patch("core.config.get_voxtral_voice_id", return_value="voice-123"):
            from core.config import is_voxtral_available
            assert is_voxtral_available() is True

    def test_is_voxtral_not_available_without_key(self):
        with patch("core.config.get_mistral_key", return_value=None):
            from core.config import is_voxtral_available
            assert is_voxtral_available() is False
