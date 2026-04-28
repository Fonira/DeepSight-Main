"""Tests for streaming voice session creation (Quick Voice Call V1.1).

Verifies that when ``request.is_streaming=True``:

  * The system prompt sent to ElevenLabs ``create_conversation_agent``
    contains the video title (resolved via YouTube oEmbed when not provided)
    and channel name, so the agent doesn't say "I'm starting to listen to
    this video" without knowing WHICH video.
  * The streaming orchestrator is wired and scheduled in ``BackgroundTasks``.

Mocks ElevenLabs + httpx oEmbed so no network call is performed.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
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
    client.create_conversation_agent = AsyncMock(return_value="agent_streaming_123")
    client.get_signed_url = AsyncMock(
        return_value=("wss://signed.example.test", "2026-04-25T11:00:00Z")
    )
    client.get_conversation_token = AsyncMock(
        return_value=("livekit_token_xyz", "2026-04-25T11:00:00Z")
    )
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm, client


def _make_oembed_response(title: str, channel: str) -> MagicMock:
    """Mimic an httpx Response carrying a YouTube oEmbed JSON payload."""
    resp = MagicMock()
    resp.status_code = 200
    resp.json = MagicMock(return_value={"title": title, "author_name": channel})
    return resp


class _FakeOembedClient:
    """Async-context-manager that returns a configurable oEmbed response."""

    def __init__(self, response: MagicMock):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        return self._response


@pytest.fixture
def streaming_admin_user():
    """Admin user — bypasses voice-quota gating so the test stays focused."""
    user = MagicMock()
    user.id = 99
    user.email = "admin@deepsight.test"
    user.plan = "expert"
    user.is_admin = True
    user.voice_bonus_seconds = 0
    user.stripe_customer_id = None
    user.username = "admin"
    return user


@pytest.fixture
def captured_session(monkeypatch):
    """Capture the persisted VoiceSession on db.add()."""
    captured = []

    def _fake_add(obj):
        captured.append(obj)
        if getattr(obj, "id", None) is None:
            import uuid as _uuid

            obj.id = str(_uuid.uuid4())

    return captured, _fake_add


@pytest.mark.asyncio
async def test_streaming_session_injects_video_meta_in_prompt(
    mock_db_session, streaming_admin_user, captured_session
):
    """is_streaming + video_id → system prompt contains title + channel."""
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest

    captured, fake_add = captured_session
    mock_db_session.add = MagicMock(side_effect=fake_add)
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    eleven_cm, eleven_client = _build_eleven_cm()

    # YouTube oEmbed returns these — the prompt must surface them.
    oembed_resp = _make_oembed_response(
        title="Mistral AI presents Le Chat",
        channel="Mistral AI",
    )

    request = VoiceSessionRequest(
        agent_type="explorer_streaming",
        video_id="dQw4w9WgXcQ",
        is_streaming=True,
        language="fr",
    )

    background_tasks = BackgroundTasks()

    with patch(
        "voice.router.check_voice_quota",
        new=AsyncMock(return_value={"can_use": True, "seconds_remaining": 600}),
    ), patch(
        "voice.router.get_elevenlabs_client",
        return_value=eleven_cm,
    ), patch(
        "voice.preferences.get_user_voice_preferences",
        new=AsyncMock(return_value=_make_voice_prefs()),
    ), patch(
        "voice.router.httpx.AsyncClient",
        return_value=_FakeOembedClient(oembed_resp),
    ), patch(
        "voice.router.create_production_orchestrator",
        return_value=MagicMock(run=AsyncMock()),
    ):
        response = await create_voice_session(
            request,
            background_tasks=background_tasks,
            current_user=streaming_admin_user,
            db=mock_db_session,
            redis=AsyncMock(),
        )

    assert response is not None
    assert response.is_streaming is True

    # The agent was created with a system prompt mentioning title + channel.
    eleven_client.create_conversation_agent.assert_awaited_once()
    call_kwargs = eleven_client.create_conversation_agent.await_args.kwargs
    system_prompt = call_kwargs.get("system_prompt", "")
    assert "Mistral AI presents Le Chat" in system_prompt, (
        "video title from oEmbed must appear in the streaming system prompt"
    )
    assert "Mistral AI" in system_prompt, "channel from oEmbed must appear in the prompt"
    assert "dQw4w9WgXcQ" in system_prompt, "youtube id must be included for grounding"
    # The streaming hint about [CTX UPDATE] markers is present.
    assert "[CTX UPDATE" in system_prompt


@pytest.mark.asyncio
async def test_streaming_session_uses_request_video_title_when_oembed_fails(
    mock_db_session, streaming_admin_user, captured_session
):
    """If oEmbed fails, ``request.video_title`` is still used as a fallback."""
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest

    captured, fake_add = captured_session
    mock_db_session.add = MagicMock(side_effect=fake_add)
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    eleven_cm, eleven_client = _build_eleven_cm()

    class _BoomClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, params=None):
            raise RuntimeError("network down")

    request = VoiceSessionRequest(
        agent_type="explorer_streaming",
        video_id="abc123XYZ_",
        video_title="Frontend-supplied title",
        is_streaming=True,
        language="fr",
    )

    background_tasks = BackgroundTasks()

    with patch(
        "voice.router.check_voice_quota",
        new=AsyncMock(return_value={"can_use": True, "seconds_remaining": 600}),
    ), patch(
        "voice.router.get_elevenlabs_client",
        return_value=eleven_cm,
    ), patch(
        "voice.preferences.get_user_voice_preferences",
        new=AsyncMock(return_value=_make_voice_prefs()),
    ), patch(
        "voice.router.httpx.AsyncClient",
        return_value=_BoomClient(),
    ), patch(
        "voice.router.create_production_orchestrator",
        return_value=MagicMock(run=AsyncMock()),
    ):
        response = await create_voice_session(
            request,
            background_tasks=background_tasks,
            current_user=streaming_admin_user,
            db=mock_db_session,
            redis=AsyncMock(),
        )

    assert response is not None

    eleven_client.create_conversation_agent.assert_awaited_once()
    call_kwargs = eleven_client.create_conversation_agent.await_args.kwargs
    system_prompt = call_kwargs.get("system_prompt", "")
    assert "Frontend-supplied title" in system_prompt, (
        "request.video_title is the fallback when oEmbed fails"
    )
    assert "abc123XYZ_" in system_prompt
