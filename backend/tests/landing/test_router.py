"""Tests pour le router landing public (stats homepage)."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def landing_app():
    """Instancie une app FastAPI minimaliste avec le router landing seul."""
    from fastapi import FastAPI
    from landing.router import router as landing_router

    app = FastAPI()
    app.include_router(landing_router)
    return app


@pytest.fixture
def client(landing_app):
    return TestClient(landing_app)


@pytest.mark.asyncio
async def test_landing_stats_endpoint_no_auth_required(client, monkeypatch):
    """L'endpoint doit répondre 200 sans header Authorization."""
    fake_stats = {
        "total_videos_analyzed": 1234,
        "total_words_synthesized": 56789012,
        "active_users_30d": 87,
    }

    async def fake_get_or_set(key, factory, ttl=None):
        return fake_stats

    from core import cache as cache_module
    monkeypatch.setattr(cache_module.cache_service, "get_or_set", fake_get_or_set)

    response = client.get("/api/public/landing-stats")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_videos_analyzed"] == 1234
    assert data["total_words_synthesized"] == 56789012
    assert data["active_users_30d"] == 87


@pytest.mark.asyncio
async def test_landing_stats_response_schema(client, monkeypatch):
    """Le payload doit contenir exactement les 3 champs typés int."""
    fake_stats = {
        "total_videos_analyzed": 0,
        "total_words_synthesized": 0,
        "active_users_30d": 0,
    }

    async def fake_get_or_set(key, factory, ttl=None):
        return fake_stats

    from core import cache as cache_module
    monkeypatch.setattr(cache_module.cache_service, "get_or_set", fake_get_or_set)

    response = client.get("/api/public/landing-stats")
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {
        "total_videos_analyzed",
        "total_words_synthesized",
        "active_users_30d",
    }
    assert isinstance(data["total_videos_analyzed"], int)
    assert isinstance(data["total_words_synthesized"], int)
    assert isinstance(data["active_users_30d"], int)


@pytest.mark.asyncio
async def test_landing_stats_uses_cache_with_ttl_3600(client, monkeypatch):
    """Vérifie que cache_service.get_or_set est appelé avec ttl=3600 et clé stable."""
    captured = {}

    async def fake_get_or_set(key, factory, ttl=None):
        captured["key"] = key
        captured["ttl"] = ttl
        return {
            "total_videos_analyzed": 1,
            "total_words_synthesized": 2,
            "active_users_30d": 3,
        }

    from core import cache as cache_module
    monkeypatch.setattr(cache_module.cache_service, "get_or_set", fake_get_or_set)

    response = client.get("/api/public/landing-stats")
    assert response.status_code == 200
    assert captured["key"] == "landing:public_stats"
    assert captured["ttl"] == 3600
