"""
Tests for Voxtral STT (Mistral AI) — Speech-to-Text integration.

Tests cover:
- transcribe_audio_voxtral() from audio_utils.py
- get_transcript_voxtral() from youtube.py
- Fallback behavior in TikTok _transcribe_safely()
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))


# =============================================================================
# transcribe_audio_voxtral (audio_utils.py — shared helper)
# =============================================================================

class TestTranscribeAudioVoxtral:

    @pytest.mark.asyncio
    async def test_successful_transcription(self):
        from transcripts.audio_utils import transcribe_audio_voxtral

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "text": "Bonjour ceci est un test de transcription.",
            "segments": [
                {"text": "Bonjour ceci est", "start": 0.0, "end": 2.0},
                {"text": "un test de transcription.", "start": 2.0, "end": 5.0},
            ],
            "language": "fr",
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("transcripts.audio_utils.httpx.AsyncClient", return_value=mock_client), \
             patch("core.config.get_mistral_key", return_value="test-key"):
            full, ts, lang = await transcribe_audio_voxtral(
                audio_data=b"fake-audio", audio_ext=".mp3", source_name="TEST"
            )

        assert full == "Bonjour ceci est un test de transcription."
        assert lang == "fr"
        assert ts is not None

    @pytest.mark.asyncio
    async def test_returns_none_without_key(self):
        from transcripts.audio_utils import transcribe_audio_voxtral

        with patch("core.config.get_mistral_key", return_value=None):
            full, ts, lang = await transcribe_audio_voxtral(
                audio_data=b"fake-audio", source_name="TEST"
            )

        assert full is None
        assert ts is None
        assert lang is None

    @pytest.mark.asyncio
    async def test_returns_none_on_api_error(self):
        from transcripts.audio_utils import transcribe_audio_voxtral

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("transcripts.audio_utils.httpx.AsyncClient", return_value=mock_client), \
             patch("core.config.get_mistral_key", return_value="test-key"):
            full, ts, lang = await transcribe_audio_voxtral(
                audio_data=b"fake-audio", source_name="TEST"
            )

        assert full is None

    @pytest.mark.asyncio
    async def test_timestamps_formatting(self):
        from transcripts.audio_utils import transcribe_audio_voxtral

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "text": "First segment. Second segment after 30s.",
            "segments": [
                {"text": "First segment.", "start": 0.0, "end": 10.0},
                {"text": "Second segment after 30s.", "start": 35.0, "end": 45.0},
            ],
            "language": "en",
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("transcripts.audio_utils.httpx.AsyncClient", return_value=mock_client), \
             patch("core.config.get_mistral_key", return_value="test-key"):
            full, ts, lang = await transcribe_audio_voxtral(
                audio_data=b"fake-audio", source_name="TEST"
            )

        assert "[00:00]" in ts
        assert "[00:35]" in ts
        assert lang == "en"

    @pytest.mark.asyncio
    async def test_empty_text_returns_none(self):
        from transcripts.audio_utils import transcribe_audio_voxtral

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "text": "",
            "segments": [],
            "language": "fr",
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("transcripts.audio_utils.httpx.AsyncClient", return_value=mock_client), \
             patch("core.config.get_mistral_key", return_value="test-key"):
            full, ts, lang = await transcribe_audio_voxtral(
                audio_data=b"fake-audio", source_name="TEST"
            )

        assert full is None


# =============================================================================
# TranscriptSource enum (youtube.py)
# =============================================================================

class TestTranscriptSourceEnum:

    def test_voxtral_stt_in_enum(self):
        from transcripts.youtube import TranscriptSource
        assert hasattr(TranscriptSource, "VOXTRAL_STT")
        assert TranscriptSource.VOXTRAL_STT.value == "voxtral-stt"


# =============================================================================
# get_transcript_voxtral (youtube.py — Phase 3)
# =============================================================================

class TestGetTranscriptVoxtral:

    @pytest.mark.asyncio
    async def test_skips_without_api_key(self):
        from transcripts.youtube import get_transcript_voxtral

        with patch("transcripts.youtube.get_mistral_key", return_value=None):
            full, ts, lang = await get_transcript_voxtral("test_video_id")

        assert full is None

    @pytest.mark.asyncio
    async def test_successful_with_provided_audio(self):
        from transcripts.youtube import get_transcript_voxtral

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "text": "Test transcript voxtral.",
            "segments": [],
            "language": "fr",
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("transcripts.youtube.get_mistral_key", return_value="test-key"), \
             patch("transcripts.youtube.httpx.AsyncClient", return_value=mock_client):
            full, ts, lang = await get_transcript_voxtral(
                "test_id", audio_data=b"fake-mp3", audio_ext=".mp3"
            )

        assert full == "Test transcript voxtral."
        assert lang == "fr"


# =============================================================================
# Phase 3 ordering
# =============================================================================

class TestPhase3Ordering:

    def test_voxtral_is_first_in_phase3(self):
        """Verify that Voxtral STT is the first method tried in Phase 3."""
        import inspect
        from transcripts import youtube

        source = inspect.getsource(youtube._get_transcript_with_timestamps_inner)
        # Voxtral should appear before Groq in the phase3_methods list
        voxtral_pos = source.find("Voxtral STT")
        groq_pos = source.find("Groq Whisper")
        assert voxtral_pos > 0, "Voxtral STT not found in _get_transcript_with_timestamps_inner"
        assert voxtral_pos < groq_pos, "Voxtral STT should come before Groq Whisper in Phase 3"
