"""Tests for POST /api/voice/session with video_url (Quick Voice Call mobile V3 — Task 7).

Verifies the new ``video_url`` branch added in Task 7 :

  1. A valid YouTube/TikTok URL → 200 + Summary placeholder + VoiceSession
     created with explorer_streaming agent + summary_id surfaced in response.
  2. An unsupported URL → 400 with ``code='invalid_video_url'``.
  3. ``video_url`` AND ``summary_id`` both set → Pydantic XOR rejects (422-equivalent
     on direct Pydantic instantiation = ValidationError).
  4. ``video_url`` with ``agent_type != explorer_streaming`` → Pydantic rejects.

The tests follow the same direct-call pattern as
``test_voice_session_companion.py`` (no ``async_client`` HTTP fixture) — the
test suite has no async HTTP infrastructure, only mock-based unit tests that
invoke the route function directly.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from pydantic import ValidationError


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _make_voice_prefs() -> MagicMock:
    """Return a VoicePreferences-shaped mock the router can consume."""
    prefs = MagicMock()
    prefs.voice_id = None
    prefs.input_mode = "ptt"
    prefs.ptt_key = " "
    prefs.turn_timeout = 15
    prefs.turn_eagerness = "normal"
    prefs.voice_chat_model = "eleven_turbo_v2_5"
    prefs.voice_chat_speed_preset = "1x"
    prefs.to_voice_settings = MagicMock(return_value={"speed": 1.0})
    return prefs


def _make_streaming_quota_check(allowed: bool = True):
    """QuotaCheck mock for billing.voice_quota.check_voice_quota."""
    qc = MagicMock()
    qc.allowed = allowed
    qc.is_trial = False
    qc.max_minutes = 30.0
    qc.reason = None
    qc.cta = None
    return qc


def _setup_mock_db_capture(mock_db_session):
    """Wire mock_db_session.add to capture rows + assign IDs.

    Returns the captured list (mutated by side-effects). Summary rows get an
    auto-incremented int id; VoiceSession rows get a UUID-like string.
    """
    captured: list = []
    counter = {"summary_id": 100}

    def _fake_add(obj):
        captured.append(obj)
        # Auto-assign id depending on model type so refresh() doesn't need it.
        cls_name = type(obj).__name__
        if cls_name == "Summary" and getattr(obj, "id", None) is None:
            counter["summary_id"] += 1
            obj.id = counter["summary_id"]
        elif cls_name == "VoiceSession" and getattr(obj, "id", None) is None:
            import uuid as _uuid

            obj.id = str(_uuid.uuid4())

    mock_db_session.add = MagicMock(side_effect=_fake_add)
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()
    return captured


# ═══════════════════════════════════════════════════════════════════════════════
# Pydantic-level tests (XOR + agent_type constraints — no router call needed)
# ═══════════════════════════════════════════════════════════════════════════════


class TestVoiceSessionVideoUrlSchema:
    """Pydantic XOR + agent_type validators (Task 3 schema, exercised via Task 7)."""

    def test_video_url_with_summary_id_rejected(self):
        """video_url AND summary_id both set → ValidationError (XOR validator)."""
        from voice.schemas import VoiceSessionRequest

        with pytest.raises(ValidationError) as exc:
            VoiceSessionRequest(
                video_url="https://youtu.be/dQw4w9WgXcQ",
                summary_id=1,
                agent_type="explorer_streaming",
            )
        # XOR validator message includes "summary_id OU debate_id OU video_url"
        assert "video_url" in str(exc.value) or "summary_id" in str(exc.value)

    def test_video_url_with_wrong_agent_type_rejected(self):
        """video_url with agent_type != explorer_streaming → ValidationError."""
        from voice.schemas import VoiceSessionRequest

        with pytest.raises(ValidationError) as exc:
            VoiceSessionRequest(
                video_url="https://youtu.be/dQw4w9WgXcQ",
                agent_type="explorer",  # wrong
            )
        assert "explorer_streaming" in str(exc.value)


# ═══════════════════════════════════════════════════════════════════════════════
# Router-level tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestVoiceSessionVideoUrl:
    """Tests the new ``video_url`` branch in POST /api/voice/session."""

    @pytest.mark.asyncio
    async def test_valid_youtube_url_creates_summary_and_session(
        self, mock_db_session, mock_pro_voice_user
    ):
        """A valid YouTube URL → 200 + Summary placeholder + VoiceSession with summary_id."""
        from voice.router import create_voice_session
        from voice.schemas import VoiceSessionRequest

        request = VoiceSessionRequest(
            video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            agent_type="explorer_streaming",
            language="fr",
        )

        # ElevenLabs mocks
        eleven_client = AsyncMock()
        eleven_client.create_conversation_agent = AsyncMock(return_value="agent_v3_yt_001")
        eleven_client.get_signed_url = AsyncMock(
            return_value=("wss://signed.example.test", "2026-04-25T11:00:00Z")
        )
        eleven_client.get_conversation_token = AsyncMock(
            return_value=("livekit_token_v3", "2026-04-25T11:00:00Z")
        )
        eleven_cm = AsyncMock()
        eleven_cm.__aenter__ = AsyncMock(return_value=eleven_client)
        eleven_cm.__aexit__ = AsyncMock(return_value=False)

        # Capture rows persisted by the router
        captured = _setup_mock_db_capture(mock_db_session)

        # Background tasks recorder
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        with patch(
            "voice.router.check_voice_quota_streaming",
            new=AsyncMock(return_value=_make_streaming_quota_check()),
        ), patch(
            "voice.router.get_elevenlabs_client",
            return_value=eleven_cm,
        ), patch(
            "voice.preferences.get_user_voice_preferences",
            new=AsyncMock(return_value=_make_voice_prefs()),
        ):
            response = await create_voice_session(
                request,
                background_tasks=bg_tasks,
                current_user=mock_pro_voice_user,
                db=mock_db_session,
                redis=MagicMock(),  # truthy → orchestrator branch enabled
            )

        # Response sanity
        assert response is not None
        assert response.session_id is not None
        assert response.agent_id == "agent_v3_yt_001"
        assert response.summary_id is not None  # ← the V3 contract
        assert response.is_streaming is True

        # Both Summary + VoiceSession persisted
        from db.database import Summary, VoiceSession

        summaries = [c for c in captured if isinstance(c, Summary)]
        sessions = [c for c in captured if isinstance(c, VoiceSession)]
        assert len(summaries) == 1, f"Expected 1 Summary placeholder, got {len(summaries)}"
        assert len(sessions) == 1, f"Expected 1 VoiceSession, got {len(sessions)}"

        # Summary placeholder fields
        placeholder = summaries[0]
        assert placeholder.video_id == "dQw4w9WgXcQ"
        assert placeholder.platform == "youtube"
        assert placeholder.video_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert placeholder.user_id == mock_pro_voice_user.id

        # VoiceSession links to placeholder
        session = sessions[0]
        assert session.summary_id == placeholder.id
        assert session.agent_type == "explorer_streaming"
        assert session.is_streaming_session is True

        # Response.summary_id matches placeholder.id
        assert response.summary_id == placeholder.id

        # Background tasks were scheduled (orchestrator + analysis pipeline)
        assert bg_tasks.add_task.call_count >= 2

    @pytest.mark.asyncio
    async def test_invalid_url_returns_400(self, mock_db_session, mock_pro_voice_user):
        """An unsupported URL (e.g. Vimeo) → 400 with code='invalid_video_url'."""
        from voice.router import create_voice_session
        from voice.schemas import VoiceSessionRequest

        request = VoiceSessionRequest(
            video_url="https://vimeo.com/123456789",
            agent_type="explorer_streaming",
            language="fr",
        )

        with pytest.raises(HTTPException) as exc:
            await create_voice_session(
                request,
                background_tasks=MagicMock(),
                current_user=mock_pro_voice_user,
                db=mock_db_session,
                redis=MagicMock(),
            )

        assert exc.value.status_code == 400
        detail = exc.value.detail
        # detail is a dict per the router contract
        if isinstance(detail, dict):
            assert detail.get("code") == "invalid_video_url"
            assert "non supportée" in detail.get("message", "").lower() or "url" in detail.get("message", "").lower()
        else:
            assert "non supportée" in str(detail).lower() or "url" in str(detail).lower()

    @pytest.mark.asyncio
    async def test_valid_tiktok_url_creates_summary(
        self, mock_db_session, mock_pro_voice_user
    ):
        """A valid TikTok URL → Summary with platform='tiktok'."""
        from voice.router import create_voice_session
        from voice.schemas import VoiceSessionRequest

        request = VoiceSessionRequest(
            video_url="https://www.tiktok.com/@user/video/7123456789012345678",
            agent_type="explorer_streaming",
            language="fr",
        )

        eleven_client = AsyncMock()
        eleven_client.create_conversation_agent = AsyncMock(return_value="agent_v3_tt_001")
        eleven_client.get_signed_url = AsyncMock(
            return_value=("wss://signed.example.test", "2026-04-25T11:00:00Z")
        )
        eleven_client.get_conversation_token = AsyncMock(
            return_value=("livekit_token_v3", "2026-04-25T11:00:00Z")
        )
        eleven_cm = AsyncMock()
        eleven_cm.__aenter__ = AsyncMock(return_value=eleven_client)
        eleven_cm.__aexit__ = AsyncMock(return_value=False)

        captured = _setup_mock_db_capture(mock_db_session)
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        with patch(
            "voice.router.check_voice_quota_streaming",
            new=AsyncMock(return_value=_make_streaming_quota_check()),
        ), patch(
            "voice.router.get_elevenlabs_client",
            return_value=eleven_cm,
        ), patch(
            "voice.preferences.get_user_voice_preferences",
            new=AsyncMock(return_value=_make_voice_prefs()),
        ):
            response = await create_voice_session(
                request,
                background_tasks=bg_tasks,
                current_user=mock_pro_voice_user,
                db=mock_db_session,
                redis=MagicMock(),
            )

        from db.database import Summary

        summaries = [c for c in captured if isinstance(c, Summary)]
        assert len(summaries) == 1
        assert summaries[0].platform == "tiktok"
        assert summaries[0].video_id == "7123456789012345678"
        assert response.summary_id == summaries[0].id
