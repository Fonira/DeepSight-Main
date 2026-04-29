"""Test that a new voice session sees previous voice sessions' digests in
its system_prompt block.

The handler is called directly (no FastAPI HTTP layer) because the
existing voice tests in this folder use that pattern (see
test_voice_session_streaming.py). The system_prompt is asserted on the
``create_conversation_agent`` mock since the API response itself does not
echo the prompt back.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import BackgroundTasks


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


def _build_eleven_cm():
    """Return an async-context-manager-shaped mock yielding a fake client."""
    client = AsyncMock()
    client.create_conversation_agent = AsyncMock(return_value="agent_recall_123")
    client.get_signed_url = AsyncMock(
        return_value=("wss://signed.example.test", "2099-04-25T11:00:00Z")
    )
    client.get_conversation_token = AsyncMock(
        return_value=("livekit_token_xyz", "2099-04-25T11:00:00Z")
    )
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm, client


@pytest.mark.asyncio
async def test_new_voice_session_includes_prior_digests(
    async_db_session, sample_user, sample_summary
):
    """Given: a previous voice_session with digest_text on summary_id S.
    When: user starts a new voice session on the same S.
    Then: the system_prompt sent to ElevenLabs includes the prior digest.
    """
    from db.database import VoiceSession
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest

    # Make the user admin so quota / plan gating doesn't reject the call.
    sample_user.is_admin = True
    sample_user.voice_bonus_seconds = 0
    sample_user.stripe_customer_id = None
    await async_db_session.commit()

    now = datetime.now(timezone.utc)
    prev_session = VoiceSession(
        id="sess-prev",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        agent_type="explorer",
        status="completed",
        # NB: VoiceSession uses ``started_at`` (db/database.py:827), NOT
        # ``created_at``. The plan typo was caught in the task brief.
        started_at=now - timedelta(days=2),
        duration_seconds=480,
        digest_text="- user a parlé du modèle Janus\n- tu as répondu via web_search",
        digest_generated_at=now - timedelta(days=2),
    )
    async_db_session.add(prev_session)
    await async_db_session.commit()

    request = VoiceSessionRequest(
        summary_id=sample_summary.id,
        agent_type="explorer",
        language="fr",
    )

    eleven_cm, eleven_client = _build_eleven_cm()
    background_tasks = BackgroundTasks()

    # check_voice_quota is not awaited for admin users on non-streaming
    # sessions, but we patch it defensively in case the order changes.
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
            background_tasks=background_tasks,
            current_user=sample_user,
            db=async_db_session,
            redis=None,
        )

    assert response is not None
    assert response.session_id is not None

    eleven_client.create_conversation_agent.assert_awaited_once()
    call_kwargs = eleven_client.create_conversation_agent.await_args.kwargs
    system_prompt = call_kwargs.get("system_prompt", "")
    assert "modèle Janus" in system_prompt, (
        f"Expected prior digest in system_prompt, got: {system_prompt[:500]}"
    )
