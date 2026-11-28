"""Durée maximale d'un appel, imposée par ElevenLabs.

Le minuteur du side panel ne fait qu'afficher le temps : sans limite sur
l'agent, un appel pouvait dépasser le quota restant. L'agent est donc créé
avec conversation_config.conversation.max_duration_seconds (60–7200 s).
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from voice.elevenlabs import ElevenLabsClient
from voice.router import _call_duration_cap_seconds


class TestCallDurationCap:
    def test_quick_voice_call_uses_the_remaining_quota(self):
        # VOICE_LIMITS (table historique) ne borne pas Quick Voice Call.
        quota = {"seconds_remaining": 4 * 60}
        assert _call_duration_cap_seconds(quota, {"max_session_minutes": 0}, is_streaming=True) == 240
        assert _call_duration_cap_seconds(quota, {"max_session_minutes": 1}, is_streaming=True) == 240

    def test_classic_voice_chat_is_also_bounded_per_session(self):
        limits = {"max_session_minutes": 15}
        assert _call_duration_cap_seconds({"seconds_remaining": 40 * 60}, limits, is_streaming=False) == 900
        assert _call_duration_cap_seconds({"seconds_remaining": 300}, limits, is_streaming=False) == 300

    def test_classic_voice_chat_without_per_session_limit_keeps_the_quota(self):
        assert _call_duration_cap_seconds({"seconds_remaining": 600}, {}, is_streaming=False) == 600


def _agent_response() -> MagicMock:
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"agent_id": "agent_cap"}
    response.raise_for_status.return_value = None
    return response


async def _created_body(max_duration_seconds):
    async with ElevenLabsClient(api_key="xi-test-key") as client:
        with patch.object(client._client, "post", new=AsyncMock(return_value=_agent_response())) as post:
            agent_id = await client.create_conversation_agent(
                system_prompt="p",
                tools=[],
                voice_id="voice",
                model_id="eleven_flash_v2_5",
                max_duration_seconds=max_duration_seconds,
            )
    assert agent_id == "agent_cap"
    return post.await_args.kwargs["json"]


class TestAgentMaxDuration:
    @pytest.mark.parametrize(
        ("requested", "sent"),
        [
            (125, 125),
            (30, 60),  # minimum accepté par ElevenLabs
            (0, 60),
            (3 * 3600, 7200),  # maximum accepté par ElevenLabs
        ],
    )
    async def test_cap_is_sent_on_the_agent_within_elevenlabs_bounds(self, requested, sent):
        body = await _created_body(requested)
        assert body["conversation_config"]["conversation"] == {"max_duration_seconds": sent}

    async def test_no_cap_keeps_elevenlabs_default(self):
        body = await _created_body(None)
        assert "conversation" not in body["conversation_config"]
