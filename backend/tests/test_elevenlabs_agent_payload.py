"""Création d'agent ElevenLabs conforme au schéma actuel de l'API.

Depuis juillet 2025, ElevenLabs refuse ``prompt.tools`` : les outils sont des
ressources autonomes (POST /convai/tools) référencées par ``prompt.tool_ids``.
Le schéma des agents n'a pas non plus de ``tts.style``, ni de ``turn.mode``.
Ces tests rejouent l'API sur un faux serveur httpx.
"""

from __future__ import annotations

import json

import httpx
import pytest

from voice.elevenlabs import ElevenLabsAPIError, ElevenLabsClient, _error_from_response

MISSING_WRITE = {
    "detail": {
        "status": "missing_permissions",
        "message": "The API key you used is missing the permission convai_write to execute this operation.",
    }
}


class FakeElevenLabs:
    """Faux serveur ElevenLabs : outils et agents en mémoire, requêtes gardées."""

    def __init__(self, *, failing_tool: str | None = None, agent_error: tuple[int, dict] | None = None) -> None:
        self.requests: list[httpx.Request] = []
        self.tools: dict[str, dict] = {}
        self.agents: dict[str, dict] = {}
        self.failing_tool = failing_tool
        self.agent_error = agent_error
        self._next_id = 0

    def _new_id(self, prefix: str) -> str:
        self._next_id += 1
        return f"{prefix}_{self._next_id}"

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        method = request.method
        if method == "POST" and path == "/v1/convai/tools":
            config = json.loads(request.content)["tool_config"]
            if config["name"] == self.failing_tool:
                return httpx.Response(
                    422,
                    json={
                        "detail": [
                            {
                                "loc": ["body", "tool_config", "api_schema", "url"],
                                "msg": "Field required",
                                "type": "missing",
                            }
                        ]
                    },
                )
            tool_id = self._new_id("tool")
            self.tools[tool_id] = config
            return httpx.Response(200, json={"id": tool_id, "tool_config": config})
        if method == "DELETE" and path.startswith("/v1/convai/tools/"):
            self.tools.pop(path.rsplit("/", 1)[1], None)
            return httpx.Response(200, json={})
        if method == "POST" and path == "/v1/convai/agents/create":
            if self.agent_error is not None:
                status, body = self.agent_error
                return httpx.Response(status, json=body)
            agent_id = self._new_id("agent")
            self.agents[agent_id] = json.loads(request.content)
            return httpx.Response(200, json={"agent_id": agent_id})
        if path.startswith("/v1/convai/agents/"):
            agent_id = path.rsplit("/", 1)[1]
            if agent_id not in self.agents:
                return httpx.Response(404, json={"detail": {"status": "agent_not_found", "message": "Not found"}})
            if method == "GET":
                return httpx.Response(200, json=self.agents[agent_id])
            if method == "DELETE":
                del self.agents[agent_id]
                return httpx.Response(200, json={})
        if method == "GET" and path == "/v1/convai/conversation/get-signed-url":
            return httpx.Response(403, json=MISSING_WRITE)
        return httpx.Response(404, json={"detail": "not mocked"})

    def client(self) -> ElevenLabsClient:
        client = ElevenLabsClient.__new__(ElevenLabsClient)
        client._api_key = "sk_test"
        client._client = httpx.AsyncClient(
            base_url=ElevenLabsClient.BASE_URL,
            transport=httpx.MockTransport(self.handler),
        )
        return client

    def sent(self, method: str, path: str) -> list[httpx.Request]:
        return [r for r in self.requests if r.method == method and r.url.path == path]


def _tool(name: str) -> dict:
    return {
        "type": "webhook",
        "name": name,
        "description": f"tool {name}",
        "api_schema": {
            "url": f"https://api.deepsightsynthesis.com/api/voice/tools/{name}",
            "method": "POST",
            "request_headers": {"Authorization": "Bearer 42"},
            "request_body_schema": {
                "type": "object",
                "properties": {"summary_id": {"type": "string", "constant_value": "42"}},
            },
        },
    }


async def _create(fake: FakeElevenLabs, **overrides) -> str:
    kwargs = {
        "system_prompt": "prompt",
        "tools": [_tool("search_in_transcript"), _tool("get_sources")],
        "voice_id": "voice",
        "model_id": "eleven_turbo_v2_5",
    }
    kwargs.update(overrides)
    async with fake.client() as client:
        return await client.create_conversation_agent(**kwargs)


class TestStandaloneTools:
    async def test_tools_are_created_apart_and_referenced_by_id(self):
        fake = FakeElevenLabs()
        agent_id = await _create(fake)

        assert len(fake.sent("POST", "/v1/convai/tools")) == 2
        prompt = fake.agents[agent_id]["conversation_config"]["agent"]["prompt"]
        assert "tools" not in prompt
        assert {fake.tools[tool_id]["name"] for tool_id in prompt["tool_ids"]} == {
            "search_in_transcript",
            "get_sources",
        }
        # Le tool_config envoyé est celui des builders, tel quel.
        created = json.loads(fake.sent("POST", "/v1/convai/tools")[0].content)
        assert set(created) == {"tool_config"}
        assert created["tool_config"]["api_schema"]["request_headers"] == {"Authorization": "Bearer 42"}

    async def test_no_tools_sends_no_tool_ids(self):
        fake = FakeElevenLabs()
        agent_id = await _create(fake, tools=[])
        assert fake.sent("POST", "/v1/convai/tools") == []
        assert fake.agents[agent_id]["conversation_config"]["agent"]["prompt"] == {"prompt": "prompt"}

    async def test_agent_refused_deletes_the_tools_and_keeps_elevenlabs_reason(self):
        fake = FakeElevenLabs(agent_error=(401, MISSING_WRITE))
        with pytest.raises(ElevenLabsAPIError) as caught:
            await _create(fake)

        error = caught.value
        assert (error.operation, error.status_code, error.code) == ("create_agent", 401, "missing_permissions")
        assert "convai_write" in error.message
        assert error.is_config_error
        assert fake.tools == {}
        assert len(fake.sent("POST", "/v1/convai/tools")) == 2

    async def test_tool_refused_deletes_the_others_and_skips_the_agent(self):
        fake = FakeElevenLabs(failing_tool="get_sources")
        with pytest.raises(ElevenLabsAPIError) as caught:
            await _create(fake)

        assert caught.value.status_code == 422
        assert caught.value.operation == "create_tool:get_sources"
        assert "tool_config.api_schema.url: Field required" in caught.value.message
        assert fake.tools == {}
        assert fake.sent("POST", "/v1/convai/agents/create") == []


class TestAgentSchema:
    async def test_payload_only_uses_fields_of_the_agent_schema(self):
        fake = FakeElevenLabs()
        agent_id = await _create(
            fake,
            voice_settings={
                "stability": 0.4,
                "similarity_boost": 0.9,
                "style": 0.3,
                "use_speaker_boost": True,
                "speed": 1.0,
            },
            turn_config={"mode": "turn", "turn_timeout": 15},
            name="DeepSight explorer 1a2b3c4d",
        )
        body = fake.agents[agent_id]

        assert body["conversation_config"]["tts"] == {
            "voice_id": "voice",
            "model_id": "eleven_turbo_v2_5",
            "stability": 0.4,
            "similarity_boost": 0.9,
            "speed": 1.0,
        }
        assert body["conversation_config"]["turn"] == {"turn_timeout": 15}
        assert body["platform_settings"] == {"auth": {"enable_auth": True}}
        assert body["name"] == "DeepSight explorer 1a2b3c4d"

    @pytest.mark.parametrize(("requested", "sent"), [(4.0, 1.2), (1.1, 1.1), (0.5, 0.7)])
    async def test_speed_stays_in_the_agent_range(self, requested, sent):
        fake = FakeElevenLabs()
        agent_id = await _create(fake, voice_settings={"speed": requested})
        assert fake.agents[agent_id]["conversation_config"]["tts"]["speed"] == sent

    async def test_turn_without_known_fields_is_omitted(self):
        fake = FakeElevenLabs()
        agent_id = await _create(fake, turn_config={"mode": "silence"})
        assert "turn" not in fake.agents[agent_id]["conversation_config"]


class TestCleanup:
    async def test_delete_agent_also_deletes_its_tools(self):
        fake = FakeElevenLabs()
        agent_id = await _create(fake)
        assert len(fake.tools) == 2

        async with fake.client() as client:
            assert await client.delete_agent(agent_id) is True

        assert fake.agents == {}
        assert fake.tools == {}

    async def test_agent_already_gone_counts_as_deleted(self):
        fake = FakeElevenLabs()
        async with fake.client() as client:
            assert await client.delete_agent("agent_missing") is True


class TestErrors:
    async def test_signed_url_refusal_is_typed(self):
        fake = FakeElevenLabs()
        async with fake.client() as client:
            with pytest.raises(ElevenLabsAPIError) as caught:
                await client.get_signed_url("agent_x")
        assert (caught.value.status_code, caught.value.code) == (403, "missing_permissions")

    def test_plain_text_body(self):
        request = httpx.Request("GET", "https://api.elevenlabs.io/v1/x")
        error = _error_from_response(httpx.Response(502, text="Bad Gateway", request=request), "op")
        assert (error.status_code, error.code, error.message) == (502, None, "Bad Gateway")
        assert not error.is_config_error

    def test_string_detail(self):
        request = httpx.Request("GET", "https://api.elevenlabs.io/v1/x")
        error = _error_from_response(httpx.Response(400, json={"detail": "Invalid agent"}, request=request), "op")
        assert error.message == "Invalid agent"
        assert str(error) == "ElevenLabs op failed (400): Invalid agent"
