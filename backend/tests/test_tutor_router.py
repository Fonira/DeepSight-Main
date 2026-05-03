"""
Tests unit pour tutor.router — 3 endpoints + plan gating.

Mocks : Redis (in-memory dict), llm_complete, get_current_user (override deps).

Couverture : P2.4 start (3 tests), P2.5 turn (3 tests), P2.6 end (1 test).
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from auth.dependencies import get_current_user


def _make_user(plan: str = "pro", user_id: int = 42):
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    user.email = "test@deepsight.test"
    user.is_admin = False
    return user


@pytest.fixture
def fake_redis_store():
    """In-memory dict mimant Redis. Retourne (mock_redis_client, store_dict)."""
    store: dict[str, str] = {}

    async def fake_get(key):
        return store.get(key)

    async def fake_set(key, value, ex=None):
        store[key] = value
        return True

    async def fake_delete(*keys):
        n = 0
        for k in keys:
            if k in store:
                del store[k]
                n += 1
        return n

    redis = MagicMock()
    redis.get = AsyncMock(side_effect=fake_get)
    redis.set = AsyncMock(side_effect=fake_set)
    redis.delete = AsyncMock(side_effect=fake_delete)
    return redis, store


@pytest.fixture
def mock_llm_response():
    """Mock llm_complete avec une réponse Magistral fixe."""
    result = MagicMock()
    result.content = "Voyons ensemble : pourriez-vous formuler ce concept avec vos propres mots ?"
    result.tokens_total = 42
    result.model_used = "magistral-medium-2509"
    return AsyncMock(return_value=result)


@pytest.fixture
def client_pro(fake_redis_store, mock_llm_response):
    """TestClient avec deps override pour user Pro + Redis fake + LLM mocké."""
    redis, _ = fake_redis_store

    app.dependency_overrides[get_current_user] = lambda: _make_user("pro")

    with patch("tutor.router._get_redis", return_value=redis), \
         patch("tutor.router.llm_complete", mock_llm_response):
        yield TestClient(app)

    app.dependency_overrides.clear()


@pytest.fixture
def client_free(fake_redis_store, mock_llm_response):
    """TestClient avec user Free (doit recevoir 403)."""
    redis, _ = fake_redis_store
    app.dependency_overrides[get_current_user] = lambda: _make_user("free")

    with patch("tutor.router._get_redis", return_value=redis), \
         patch("tutor.router.llm_complete", mock_llm_response):
        yield TestClient(app)

    app.dependency_overrides.clear()


# ─── P2.4 — POST /session/start ───────────────────────────────────────────────


def test_session_start_pro_user_text_mode(client_pro):
    """Pro user peut démarrer une session text mode."""
    response = client_pro.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "Rasoir d'Occam",
            "concept_def": "Principe de parcimonie : la plus simple explication est la plus probable.",
            "summary_id": None,
            "mode": "text",
            "lang": "fr",
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "session_id" in data
    assert data["session_id"].startswith("tutor-")
    assert isinstance(data["first_prompt"], str)
    assert len(data["first_prompt"]) > 10
    assert data["audio_url"] is None  # V1.0 text-only


def test_session_start_free_user_blocked(client_free):
    """Free user reçoit 403 (plan gating)."""
    response = client_free.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "X",
            "concept_def": "Y",
            "mode": "text",
            "lang": "fr",
        },
    )
    assert response.status_code == 403


# ─── P2.5 — POST /session/{id}/turn ────────────────────────────────────────────


def test_session_turn_text(client_pro):
    """Un turn texte : POST avec user_input retourne ai_response + turn_count."""
    start_resp = client_pro.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "Rasoir d'Occam",
            "concept_def": "Principe de parcimonie",
            "mode": "text",
            "lang": "fr",
        },
    )
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    turn_resp = client_pro.post(
        f"/api/tutor/session/{session_id}/turn",
        json={"user_input": "Choisir l'explication la plus simple."},
    )
    assert turn_resp.status_code == 200, turn_resp.text
    data = turn_resp.json()
    assert "ai_response" in data
    assert isinstance(data["ai_response"], str)
    # 1 assistant initial + 1 user + 1 assistant = 3
    assert data["turn_count"] == 3


def test_session_turn_invalid_session(client_pro):
    """Session inexistante → 404."""
    response = client_pro.post(
        "/api/tutor/session/tutor-doesnotexist/turn",
        json={"user_input": "test"},
    )
    assert response.status_code == 404


def test_session_turn_empty_input(client_pro):
    """Ni user_input ni audio_blob_b64 → 400."""
    start_resp = client_pro.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "X",
            "concept_def": "Y",
            "mode": "text",
            "lang": "fr",
        },
    )
    session_id = start_resp.json()["session_id"]

    response = client_pro.post(
        f"/api/tutor/session/{session_id}/turn",
        json={},
    )
    assert response.status_code == 400


# ─── P2.6 — POST /session/{id}/end ─────────────────────────────────────────────


def test_session_end(client_pro):
    """Fermer une session : retourne durée + turns + supprime de Redis."""
    start_resp = client_pro.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "X",
            "concept_def": "Y",
            "summary_id": 42,
            "source_video_title": "Vidéo Test",
            "mode": "text",
            "lang": "fr",
        },
    )
    session_id = start_resp.json()["session_id"]

    end_resp = client_pro.post(f"/api/tutor/session/{session_id}/end", json={})
    assert end_resp.status_code == 200, end_resp.text
    data = end_resp.json()
    assert data["turns_count"] >= 1
    assert data["duration_sec"] >= 0
    assert data["source_summary_url"] == "/dashboard?id=42"
    assert data["source_video_title"] == "Vidéo Test"

    # La session doit être supprimée de Redis : un nouveau turn → 404
    turn_after_end = client_pro.post(
        f"/api/tutor/session/{session_id}/turn",
        json={"user_input": "still alive?"},
    )
    assert turn_after_end.status_code == 404
