"""
Tests POST /api/voice/session — companion agent_type, summary_id optional (Spec #1, Task 5).

The router already routes via ``agent_config.requires_summary``, so these tests
verify the existing behavior:

  1. ``companion`` (requires_summary=False) → summary_id=None must NOT raise 400
  2. ``explorer`` (requires_summary=True)  → summary_id=None MUST raise 400
                                              with detail.code == "summary_required"
  3. Pydantic XOR validator rejects (summary_id, debate_id) both set.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException


# ═══════════════════════════════════════════════════════════════════════════════
# Helper: build a fully-mocked VoicePreferences-like object
# ═══════════════════════════════════════════════════════════════════════════════


def _make_voice_prefs() -> MagicMock:
    """Return a VoicePreferences-shaped mock the router can consume."""
    prefs = MagicMock()
    prefs.voice_id = None  # Force fallback to default voice
    prefs.input_mode = "ptt"
    prefs.ptt_key = " "
    prefs.turn_timeout = 15
    prefs.turn_eagerness = "normal"
    prefs.voice_chat_model = "eleven_turbo_v2_5"
    prefs.voice_chat_speed_preset = "1x"
    prefs.to_voice_settings = MagicMock(return_value={"speed": 1.0})
    return prefs


# ═══════════════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestVoiceSessionCompanion:
    """Voice session creation with the companion agent (no summary required)."""

    @pytest.mark.asyncio
    async def test_companion_accepts_no_summary_id(self, mock_db_session, mock_pro_voice_user):
        """summary_id=None must NOT raise 400 for agent_type='companion'."""
        from voice.router import create_voice_session
        from voice.schemas import VoiceSessionRequest

        request = VoiceSessionRequest(summary_id=None, agent_type="companion", language="fr")

        # Build mocked ElevenLabs client (returned by the async-context-manager helper)
        eleven_client = AsyncMock()
        eleven_client.create_conversation_agent = AsyncMock(return_value="agent_companion_123")
        eleven_client.get_signed_url = AsyncMock(
            return_value=("wss://signed.example.test", "2026-04-25T11:00:00Z")
        )
        eleven_client.get_conversation_token = AsyncMock(
            return_value=("livekit_token_xyz", "2026-04-25T11:00:00Z")
        )

        # `get_elevenlabs_client()` returns an async context manager.
        eleven_cm = AsyncMock()
        eleven_cm.__aenter__ = AsyncMock(return_value=eleven_client)
        eleven_cm.__aexit__ = AsyncMock(return_value=False)

        # DB session: add() is sync, commit/refresh are async no-ops.
        # SQLAlchemy normally sets the default UUID at flush; in tests we mimic
        # this by assigning an id when the router calls db.add(voice_session).
        # Capture the persisted object to assert its fields after the call.
        captured = []

        def _fake_add(obj):
            captured.append(obj)
            if getattr(obj, "id", None) is None:
                import uuid as _uuid

                obj.id = str(_uuid.uuid4())

        mock_db_session.add = MagicMock(side_effect=_fake_add)
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        with patch(
            "voice.router.check_voice_quota",
            new=AsyncMock(return_value={"can_use": True, "seconds_remaining": 600}),
        ), patch(
            "voice.router.get_elevenlabs_client",
            return_value=eleven_cm,
        ), patch(
            "voice.preferences.get_user_voice_preferences",
            new=AsyncMock(return_value=_make_voice_prefs()),
        ):
            response = await create_voice_session(
                request,
                current_user=mock_pro_voice_user,
                db=mock_db_session,
            )

        # Companion took the no-summary path — session created successfully.
        assert response is not None
        assert response.agent_id == "agent_companion_123"
        assert response.session_id is not None

        # DB state: exactly one VoiceSession persisted with companion + summary_id=None.
        # Protects against future regressions where the route silently skips persistence.
        mock_db_session.add.assert_called_once()
        assert len(captured) == 1
        persisted = captured[0]
        assert persisted.agent_type == "companion"
        assert persisted.summary_id is None
        assert persisted.user_id == mock_pro_voice_user.id

    @pytest.mark.asyncio
    async def test_explorer_still_requires_summary(self, mock_db_session, mock_pro_voice_user):
        """summary_id=None must raise 400 for agent_type='explorer' (requires_summary=True).

        Uses pro user because the voice gating intercepts non-pro plans with 403
        before the summary_required check runs.
        """
        from voice.router import create_voice_session
        from voice.schemas import VoiceSessionRequest

        request = VoiceSessionRequest(summary_id=None, agent_type="explorer", language="fr")

        with patch(
            "voice.router.check_voice_quota",
            new=AsyncMock(return_value={"can_use": True, "seconds_remaining": 600}),
        ):
            with pytest.raises(HTTPException) as exc:
                await create_voice_session(
                    request,
                    current_user=mock_pro_voice_user,
                    db=mock_db_session,
                )

        assert exc.value.status_code == 400
        # detail is a dict — make the assertion robust to both dict and str shapes.
        assert "summary_required" in str(exc.value.detail)

    def test_request_validates_xor_summary_debate(self):
        """Cannot pass both summary_id and debate_id — Pydantic XOR rejects it."""
        from voice.schemas import VoiceSessionRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            VoiceSessionRequest(summary_id=1, debate_id=2, agent_type="explorer")
