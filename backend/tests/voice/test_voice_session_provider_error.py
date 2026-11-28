"""POST /api/voice/session quand ElevenLabs refuse l'agent.

L'API répond 503 comme avant ; un admin reçoit en plus la raison donnée par
ElevenLabs (statut, code, message), pour la voir sans lire les logs. L'agent
est nommé et créé sans ``turn.mode``, que le schéma actuel ne connaît plus.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import BackgroundTasks, HTTPException

from voice.elevenlabs import ElevenLabsAPIError


def _voice_prefs() -> MagicMock:
    prefs = MagicMock()
    prefs.voice_id = None
    prefs.input_mode = "ptt"
    prefs.ptt_key = " "
    prefs.turn_timeout = 15
    prefs.turn_eagerness = "normal"
    prefs.voice_chat_model = "eleven_turbo_v2_5"
    prefs.voice_chat_speed_preset = "1x"
    prefs.to_voice_settings = MagicMock(return_value={"speed": 1.0, "style": 0.0})
    return prefs


def _eleven(create: AsyncMock):
    client = AsyncMock()
    client.create_conversation_agent = create
    client.get_signed_url = AsyncMock(return_value=("wss://signed.test", "2026-11-28T20:00:00Z"))
    client.get_conversation_token = AsyncMock(return_value=("livekit-jwt", "2026-11-28T20:00:00Z"))
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


class _NoOembed:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        response = MagicMock()
        response.status_code = 404
        return response


def _user(*, admin: bool) -> MagicMock:
    user = MagicMock()
    user.id = 7
    user.email = "admin@deepsight.test" if admin else "someone@deepsight.test"
    user.plan = "expert"
    user.is_admin = admin
    user.voice_bonus_seconds = 0
    user.stripe_customer_id = None
    user.username = "user"
    return user


async def _start_session(mock_db_session, user, create: AsyncMock):
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest

    def _add(obj):
        if getattr(obj, "id", None) is None:
            obj.id = "1a2b3c4d-0000-4000-8000-000000000000"

    mock_db_session.add = MagicMock(side_effect=_add)
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    streaming_quota = MagicMock(allowed=True, is_trial=False, max_minutes=30.0, reason=None, cta=None)
    request = VoiceSessionRequest(
        agent_type="explorer_streaming",
        video_id="dQw4w9WgXcQ",
        video_title="Une vidéo",
        is_streaming=True,
        language="fr",
    )
    with (
        patch(
            "voice.router.check_voice_quota_streaming",
            new=AsyncMock(return_value=streaming_quota),
        ),
        patch(
            "voice.router.get_elevenlabs_client",
            return_value=_eleven(create),
        ),
        patch(
            "voice.preferences.get_user_voice_preferences",
            new=AsyncMock(return_value=_voice_prefs()),
        ),
        patch(
            "voice.router.httpx.AsyncClient",
            return_value=_NoOembed(),
        ),
        patch(
            "voice.router.create_production_orchestrator",
            return_value=MagicMock(run=AsyncMock()),
        ),
    ):
        return await create_voice_session(
            request,
            background_tasks=BackgroundTasks(),
            current_user=user,
            db=mock_db_session,
            redis=AsyncMock(),
        )


REFUSED = ElevenLabsAPIError(
    "create_agent",
    401,
    "missing_permissions",
    "The API key you used is missing the permission convai_write to execute this operation.",
)


@pytest.mark.asyncio
async def test_admin_gets_elevenlabs_reason(mock_db_session):
    with pytest.raises(HTTPException) as caught:
        await _start_session(mock_db_session, _user(admin=True), AsyncMock(side_effect=REFUSED))

    assert caught.value.status_code == 503
    detail = caught.value.detail
    assert detail["code"] == "voice_service_unavailable"
    assert detail["provider_error"] == {
        "operation": "create_agent",
        "status": 401,
        "code": "missing_permissions",
        "message": REFUSED.message,
    }


@pytest.mark.asyncio
async def test_other_users_get_the_generic_message(mock_db_session):
    server_error = ElevenLabsAPIError("create_agent", 500, None, "Internal error")
    with pytest.raises(HTTPException) as caught:
        await _start_session(mock_db_session, _user(admin=False), AsyncMock(side_effect=server_error))

    assert caught.value.status_code == 503
    assert caught.value.detail["code"] == "voice_service_error"
    assert "provider_error" not in caught.value.detail


@pytest.mark.asyncio
async def test_agent_is_named_and_sent_without_turn_mode(mock_db_session):
    create = AsyncMock(return_value="agent_ok")
    response = await _start_session(mock_db_session, _user(admin=True), create)

    assert response.signed_url == "wss://signed.test"
    kwargs = create.await_args.kwargs
    assert kwargs["name"] == "DeepSight explorer_streaming 1a2b3c4d"
    assert "mode" not in kwargs["turn_config"]
    assert kwargs["turn_config"]["turn_timeout"] == 15
