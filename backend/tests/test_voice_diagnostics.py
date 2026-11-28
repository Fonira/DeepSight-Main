"""Diagnostic des appels vocaux : python -m voice.diagnostics."""

from __future__ import annotations

import json
import time
from unittest.mock import AsyncMock

import httpx
import pytest

from core.config import _settings
from voice import diagnostics
from voice.diagnostics import FAIL, OK, SKIP, WARN, check_api_key, hint_for, render, run
from voice.elevenlabs import ElevenLabsAPIError, ElevenLabsClient

MISSING_WRITE = {
    "detail": {
        "status": "missing_permissions",
        "message": "The API key you used is missing the permission convai_write to execute this operation.",
    }
}
INVALID_KEY = {"detail": {"status": "invalid_api_key", "message": "Invalid API key"}}


class FakeAccount:
    """Faux compte ElevenLabs : abonnement, voix, outils, agents, URL signée, jeton."""

    def __init__(
        self,
        *,
        subscription: tuple[int, dict] = (200, {"tier": "starter", "status": "active"}),
        agent_error: tuple[int, dict] | None = None,
        listed_agents: list[dict] | None = None,
    ) -> None:
        self.subscription = subscription
        self.agent_error = agent_error
        self.tools: dict[str, dict] = {}
        self.agents: dict[str, dict] = {agent["agent_id"]: {} for agent in listed_agents or []}
        self.listed_agents = listed_agents or []
        self.requests: list[httpx.Request] = []
        self._next_id = 0

    def _new_id(self, prefix: str) -> str:
        self._next_id += 1
        return f"{prefix}_{self._next_id}"

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path, method = request.url.path, request.method
        if path == "/v1/user/subscription":
            status, body = self.subscription
            return httpx.Response(status, json=body)
        if path.startswith("/v1/voices/"):
            return httpx.Response(200, json={"voice_id": path.rsplit("/", 1)[1], "name": "Rachel"})
        if method == "POST" and path == "/v1/convai/tools":
            tool_id = self._new_id("tool")
            self.tools[tool_id] = json.loads(request.content)["tool_config"]
            return httpx.Response(200, json={"id": tool_id})
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
        if path == "/v1/convai/conversation/get-signed-url":
            return httpx.Response(200, json={"signed_url": "wss://signed.test", "expires_at": ""})
        if path == "/v1/convai/conversation/token":
            return httpx.Response(200, json={"token": "livekit-jwt"})
        if method == "GET" and path == "/v1/convai/agents":
            return httpx.Response(200, json={"agents": self.listed_agents, "has_more": False})
        if path.startswith("/v1/convai/agents/"):
            agent_id = path.rsplit("/", 1)[1]
            if agent_id not in self.agents:
                return httpx.Response(404, json={"detail": {"status": "agent_not_found", "message": "Not found"}})
            if method == "GET":
                return httpx.Response(200, json=self.agents[agent_id])
            del self.agents[agent_id]
            return httpx.Response(200, json={})
        return httpx.Response(404, json={"detail": "not mocked"})

    def client_factory(self, api_key: str) -> ElevenLabsClient:
        client = ElevenLabsClient.__new__(ElevenLabsClient)
        client._api_key = api_key
        client._client = httpx.AsyncClient(
            base_url=ElevenLabsClient.BASE_URL,
            transport=httpx.MockTransport(self.handler),
        )
        return client

    def sent(self, method: str, path: str) -> list[httpx.Request]:
        return [r for r in self.requests if r.method == method and r.url.path == path]


def public_http(tools_status: int = 401, webhook_status: int = 503):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/voice/tools/search-transcript":
            return httpx.Response(tools_status)
        if request.url.path == "/api/voice/webhook":
            return httpx.Response(webhook_status)
        return httpx.Response(404)

    return lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture
def container_env(monkeypatch):
    monkeypatch.setattr(_settings, "ELEVENLABS_API_KEY", "sk_" + "a" * 48)
    monkeypatch.setattr(_settings, "ELEVENLABS_WEBHOOK_SECRET", "")
    monkeypatch.setattr(_settings, "ELEVENLABS_VOICE_ID", "")
    monkeypatch.setattr(_settings, "APP_URL", "https://api.deepsightsynthesis.com")
    monkeypatch.setattr(_settings, "API_PUBLIC_URL", "https://api.deepsightsynthesis.com")
    monkeypatch.setattr(diagnostics, "VOICE_CALL_DISABLED", False)


def by_label(checks, start: str):
    return next(check for check in checks if check.label.startswith(start))


class TestRun:
    async def test_working_setup(self, container_env):
        account = FakeAccount()
        probe = AsyncMock(return_value="l'agent a parlé après 1.2 s")

        checks = await run(client_factory=account.client_factory, http_factory=public_http(), call_probe=probe)

        assert [c.status for c in checks if c.status == FAIL] == []
        assert by_label(checks, "Secret du webhook").status == WARN
        assert by_label(checks, "Création d'un agent").status == OK
        assert by_label(checks, "Jeton LiveKit").status == OK
        assert by_label(checks, "Appel de test").detail == "l'agent a parlé après 1.2 s"
        probe.assert_awaited_once_with("wss://signed.test")
        # L'agent de test et ses outils ne restent pas sur le compte.
        assert account.agents == {}
        assert account.tools == {}
        assert account.sent("POST", "/v1/convai/tools")
        assert "Bilan : les appels vocaux peuvent démarrer (1 avertissement(s))." in render(checks)

    async def test_missing_write_permission_points_to_the_key_settings(self, container_env):
        account = FakeAccount(agent_error=(401, MISSING_WRITE))

        checks = await run(client_factory=account.client_factory, http_factory=public_http(), call_probe=AsyncMock())

        agent = by_label(checks, "Création d'un agent")
        assert agent.status == FAIL
        assert "401 missing_permissions" in agent.detail
        assert "ElevenAgents en écriture" in agent.hint
        assert account.tools == {}  # outils supprimés quand l'agent est refusé
        assert "1 erreur(s) bloquante(s)" in render(checks)

    async def test_refused_key_stops_before_creating_anything(self, container_env):
        account = FakeAccount(subscription=(401, INVALID_KEY))

        checks = await run(client_factory=account.client_factory, http_factory=public_http(), call_probe=AsyncMock())

        assert by_label(checks, "Compte ElevenLabs").status == FAIL
        assert "Clé refusée" in by_label(checks, "Compte ElevenLabs").hint
        assert checks[-1].status == SKIP
        assert account.sent("POST", "/v1/convai/agents/create") == []

    async def test_missing_key_never_calls_elevenlabs(self, container_env, monkeypatch):
        monkeypatch.setattr(_settings, "ELEVENLABS_API_KEY", "")
        factory = AsyncMock()

        checks = await run(client_factory=factory, http_factory=public_http(), call_probe=AsyncMock())

        assert checks[0].status == FAIL
        assert checks[-1].status == SKIP
        factory.assert_not_called()

    async def test_unreachable_tool_url_is_flagged(self, container_env):
        account = FakeAccount()
        checks = await run(
            client_factory=account.client_factory,
            http_factory=public_http(tools_status=404),
            call_probe=AsyncMock(return_value="ok"),
        )
        tools_url = by_label(checks, "Outils de l'agent")
        assert tools_url.status == FAIL
        assert "APP_URL" in tools_url.hint

    async def test_failed_test_call_is_reported_and_the_agent_still_deleted(self, container_env):
        account = FakeAccount()
        probe = AsyncMock(side_effect=TimeoutError("l'agent n'a pas parlé en 15 s"))

        checks = await run(client_factory=account.client_factory, http_factory=public_http(), call_probe=probe)

        call = by_label(checks, "Appel de test")
        assert (call.status, call.detail) == (FAIL, "l'agent n'a pas parlé en 15 s")
        assert account.agents == {}

    async def test_no_call_skips_the_test_call(self, container_env):
        account = FakeAccount()
        probe = AsyncMock()
        checks = await run(
            call=False, client_factory=account.client_factory, http_factory=public_http(), call_probe=probe
        )
        assert by_label(checks, "Appel de test").status == SKIP
        probe.assert_not_awaited()

    async def test_cleanup_only_deletes_old_call_agents(self, container_env):
        old = int(time.time()) - 5 * 3600
        recent = int(time.time()) - 600
        account = FakeAccount(
            listed_agents=[
                {"agent_id": "a_old", "name": "DeepSight explorer 1a2b3c4d", "created_at_unix_secs": old},
                {"agent_id": "a_recent", "name": "DeepSight explorer 9f8e7d6c", "created_at_unix_secs": recent},
                {"agent_id": "a_diag", "name": "DeepSight diagnostic", "created_at_unix_secs": old},
                {"agent_id": "a_mine", "name": "DeepSight Support", "created_at_unix_secs": old},
            ]
        )

        checks = await run(
            call=False,
            cleanup=True,
            client_factory=account.client_factory,
            http_factory=public_http(),
            call_probe=AsyncMock(),
        )

        cleanup = by_label(checks, "Nettoyage")
        assert cleanup.status == OK
        assert cleanup.detail == "2 supprimé(s), 1 récent(s) gardé(s)"
        assert set(account.agents) == {"a_recent", "a_mine"}


class TestHelpers:
    @pytest.mark.parametrize(
        ("key", "status"),
        [
            ("sk_" + "b" * 48, OK),
            ("", FAIL),
            ('"sk_abc"', FAIL),
            ("sk_abc ", FAIL),
            ("abc123", WARN),
        ],
    )
    def test_key_format(self, key, status):
        check = check_api_key(key)
        assert check.status == status
        assert key.strip("\"' ") not in check.detail or not key  # la clé n'est jamais affichée

    @pytest.mark.parametrize(
        ("error", "expected"),
        [
            (ElevenLabsAPIError("create_agent", 401, "detected_unusual_activity", "Unusual activity"), "Starter"),
            (ElevenLabsAPIError("create_agent", 401, "quota_exceeded", "This request exceeds your quota"), "crédits"),
            (
                ElevenLabsAPIError("get_voice", 404, "voice_not_found", "A voice with id x was not found"),
                "ELEVENLABS_VOICE_ID",
            ),
            (ElevenLabsAPIError("create_agent", 401, "invalid_api_key", "Invalid API key"), "Clé refusée"),
            (ElevenLabsAPIError("create_agent", 422, "extra_forbidden", "tts.style: Extra inputs"), "copie-moi"),
        ],
    )
    def test_hints(self, error, expected):
        assert expected in hint_for(error)


class TestProbeCall:
    async def test_answers_pings_and_waits_for_the_agent(self):
        websockets = pytest.importorskip("websockets")
        received: list[dict] = []

        async def fake_conversation(ws):
            received.append(json.loads(await ws.recv()))
            await ws.send(
                json.dumps(
                    {
                        "type": "conversation_initiation_metadata",
                        "conversation_initiation_metadata_event": {"conversation_id": "conv_1"},
                    }
                )
            )
            await ws.send(json.dumps({"type": "ping", "ping_event": {"event_id": 7}}))
            received.append(json.loads(await ws.recv()))
            await ws.send(json.dumps({"type": "agent_response", "agent_response_event": {"agent_response": "Bonjour"}}))
            await ws.wait_closed()

        async with websockets.serve(fake_conversation, "127.0.0.1", 0) as server:
            port = next(iter(server.sockets)).getsockname()[1]
            summary = await diagnostics.probe_call(f"ws://127.0.0.1:{port}", timeout=5)

        assert "conversation conv_1" in summary
        assert received == [
            {"type": "conversation_initiation_client_data"},
            {"type": "pong", "event_id": 7},
        ]

    async def test_silent_agent_times_out(self):
        websockets = pytest.importorskip("websockets")

        async def silent(ws):
            await ws.recv()
            await ws.wait_closed()

        async with websockets.serve(silent, "127.0.0.1", 0) as server:
            port = next(iter(server.sockets)).getsockname()[1]
            with pytest.raises(TimeoutError):
                await diagnostics.probe_call(f"ws://127.0.0.1:{port}", timeout=0.5)
