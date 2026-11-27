"""ensure_agent() réutilise l'agent « DeepSight Analyst » au lieu d'en recréer un.

Ordre attendu : ID configuré → agent du même nom sur le compte → création.
API Mistral entièrement mockée (aucun appel réseau).
"""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest

import core.mistral_agent as mod


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    monkeypatch.setattr(mod, "_agent_id", None)
    monkeypatch.setattr(mod, "get_mistral_key", lambda: "test-key")
    monkeypatch.setattr(mod, "get_mistral_analyst_agent_id", lambda: None)


def _response(status_code: int, payload) -> MagicMock:
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = payload
    response.text = str(payload)
    return response


@pytest.fixture
def client(monkeypatch) -> AsyncMock:
    fake = AsyncMock()
    fake.post.return_value = _response(201, {"id": "agent-created"})

    @asynccontextmanager
    async def _shared_http_client(**_kwargs):
        yield fake

    monkeypatch.setattr(mod, "shared_http_client", _shared_http_client)
    return fake


@pytest.mark.asyncio
async def test_configured_agent_id_is_used_without_api_call(client, monkeypatch):
    monkeypatch.setattr(mod, "get_mistral_analyst_agent_id", lambda: "agent-from-env")

    assert await mod.ensure_agent() == "agent-from-env"
    client.get.assert_not_called()
    client.post.assert_not_called()


@pytest.mark.asyncio
async def test_existing_agent_with_same_name_and_model_is_reused(client):
    client.get.return_value = _response(
        200,
        [
            {"id": "other", "name": "Autre agent", "model": mod.DEFAULT_AGENT_MODEL},
            {"id": "old-model", "name": mod.AGENT_NAME, "model": "mistral-large-2512"},
            {"id": "match", "name": mod.AGENT_NAME, "model": mod.DEFAULT_AGENT_MODEL},
        ],
    )

    assert await mod.ensure_agent() == "match"
    assert client.get.await_args.kwargs["params"]["name"] == mod.AGENT_NAME
    client.post.assert_not_called()
    # Mémorisé pour les appels suivants
    assert await mod.ensure_agent() == "match"
    assert client.get.await_count == 1


@pytest.mark.asyncio
async def test_existing_agent_with_other_model_is_reused_when_no_exact_match(client):
    client.get.return_value = _response(200, {"data": [{"id": "only", "name": mod.AGENT_NAME, "model": "x"}]})

    assert await mod.ensure_agent() == "only"
    client.post.assert_not_called()


@pytest.mark.asyncio
async def test_agent_is_created_when_none_exists(client):
    client.get.return_value = _response(200, [{"id": "other", "name": "Autre agent", "model": "x"}])

    assert await mod.ensure_agent() == "agent-created"
    assert client.post.await_args.kwargs["json"]["name"] == mod.AGENT_NAME


@pytest.mark.asyncio
async def test_agent_is_created_when_listing_fails(client):
    client.get.side_effect = RuntimeError("network down")

    assert await mod.ensure_agent() == "agent-created"
    client.post.assert_awaited_once()


@pytest.mark.asyncio
async def test_force_recreate_skips_lookup(client, monkeypatch):
    monkeypatch.setattr(mod, "get_mistral_analyst_agent_id", lambda: "agent-from-env")

    assert await mod.ensure_agent(force_recreate=True) == "agent-created"
    client.get.assert_not_called()
