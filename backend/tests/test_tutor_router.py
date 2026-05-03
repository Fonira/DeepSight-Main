"""Tests unit pour tutor.router — endpoint POST /api/tutor/session/start.

Pattern : monter l'app FastAPI complete avec dependency_overrides pour
get_current_user et get_session, puis patcher llm_complete au niveau
du router (tutor.router.llm_complete) + un fakeredis injecté via
cache_service.backend.redis.
"""
import os
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Setup environnement avant tout import du module main
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from httpx import AsyncClient, ASGITransport
import fakeredis.aioredis


def _make_mock_user(plan: str = "pro", uid: int = 1) -> MagicMock:
    """User mock minimal pour les dependency_overrides."""
    user = MagicMock()
    user.id = uid
    user.email = f"{plan}@test.fr"
    user.plan = plan
    user.is_admin = False
    user.first_name = "Test"
    return user


@pytest.fixture
def mock_session():
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def app(mock_session):
    """FastAPI app avec override de la session DB."""
    from main import app
    from db.database import get_session

    async def override_session():
        return mock_session

    app.dependency_overrides[get_session] = override_session
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def fake_redis():
    """Fake redis client + injection dans cache_service.backend.redis."""
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    from core.cache import cache_service

    saved_backend = cache_service.backend
    fake_backend = MagicMock()
    fake_backend.redis = client
    cache_service.backend = fake_backend
    try:
        yield client
    finally:
        cache_service.backend = saved_backend
        await client.flushall()
        await client.aclose()


@pytest.fixture
async def authenticated_pro_client(app, fake_redis):
    """Client avec un utilisateur Pro authentifié."""
    from auth.dependencies import get_current_user

    async def override_user():
        return _make_mock_user(plan="pro")

    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


@pytest.fixture
async def authenticated_free_client(app, fake_redis):
    """Client avec un utilisateur Free authentifié."""
    from auth.dependencies import get_current_user

    async def override_user():
        return _make_mock_user(plan="free", uid=2)

    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


@pytest.fixture
async def async_client(app, fake_redis):
    """Client sans authentification."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# TESTS
# ═══════════════════════════════════════════════════════════════════════════════


def _make_llm_result(content: str = "Comment formuleriez-vous le rasoir d'Occam avec vos propres mots ?"):
    """Construit un LLMResult mock pour patcher llm_complete."""
    from core.llm_provider import LLMResult

    return LLMResult(
        content=content,
        model_used="magistral-medium-2509",
        provider="mistral",
        tokens_input=120,
        tokens_output=20,
        tokens_total=140,
        fallback_used=False,
        attempts=1,
    )


@pytest.mark.asyncio
async def test_session_start_pro_user_text_mode(authenticated_pro_client):
    """Un user Pro peut demarrer une session text mode."""
    with patch(
        "tutor.router.llm_complete",
        new_callable=AsyncMock,
    ) as mock_llm:
        mock_llm.return_value = _make_llm_result()

        response = await authenticated_pro_client.post(
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
    assert data["audio_url"] is None  # text mode


@pytest.mark.asyncio
async def test_session_start_free_user_blocked(authenticated_free_client):
    """Un user Free recoit 403 (plan gating)."""
    response = await authenticated_free_client.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "X",
            "concept_def": "Y",
            "mode": "text",
            "lang": "fr",
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_session_start_unauthenticated(async_client):
    """Sans token : 401."""
    response = await async_client.post(
        "/api/tutor/session/start",
        json={"concept_term": "X", "concept_def": "Y"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_session_turn_text(authenticated_pro_client):
    """Un turn texte : POST avec user_input retourne ai_response."""
    with patch(
        "tutor.router.llm_complete",
        new_callable=AsyncMock,
    ) as mock_llm:
        mock_llm.return_value = _make_llm_result()

        # 1. Démarrer une session
        start_resp = await authenticated_pro_client.post(
            "/api/tutor/session/start",
            json={
                "concept_term": "Rasoir d'Occam",
                "concept_def": "Principe de parcimonie...",
                "mode": "text",
                "lang": "fr",
            },
        )
        session_id = start_resp.json()["session_id"]

        # 2. Envoyer un tour user
        turn_resp = await authenticated_pro_client.post(
            f"/api/tutor/session/{session_id}/turn",
            json={"user_input": "Choisir l'explication la plus simple."},
        )
    assert turn_resp.status_code == 200
    data = turn_resp.json()
    assert "ai_response" in data
    assert isinstance(data["ai_response"], str)
    assert data["turn_count"] == 3  # 1 assistant initial + 1 user + 1 assistant


@pytest.mark.asyncio
async def test_session_turn_invalid_session(authenticated_pro_client):
    """Session inexistante -> 404."""
    response = await authenticated_pro_client.post(
        "/api/tutor/session/tutor-doesnotexist/turn",
        json={"user_input": "test"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_session_turn_empty_input(authenticated_pro_client):
    """Ni user_input ni audio_blob -> 400."""
    with patch(
        "tutor.router.llm_complete",
        new_callable=AsyncMock,
    ) as mock_llm:
        mock_llm.return_value = _make_llm_result()

        start_resp = await authenticated_pro_client.post(
            "/api/tutor/session/start",
            json={"concept_term": "X", "concept_def": "Y", "mode": "text", "lang": "fr"},
        )
        session_id = start_resp.json()["session_id"]

        response = await authenticated_pro_client.post(
            f"/api/tutor/session/{session_id}/turn",
            json={},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_session_end(authenticated_pro_client):
    """Fermer une session retourne durée + turn count + supprime de Redis."""
    with patch(
        "tutor.router.llm_complete",
        new_callable=AsyncMock,
    ) as mock_llm:
        mock_llm.return_value = _make_llm_result()

        start_resp = await authenticated_pro_client.post(
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

        end_resp = await authenticated_pro_client.post(
            f"/api/tutor/session/{session_id}/end",
            json={},
        )
        assert end_resp.status_code == 200
        data = end_resp.json()
        assert data["turns_count"] >= 1
        assert data["duration_sec"] >= 0
        assert data["source_summary_url"] == "/dashboard?id=42"
        assert data["source_video_title"] == "Vidéo Test"

        # La session doit être supprimée
        turn_after_end = await authenticated_pro_client.post(
            f"/api/tutor/session/{session_id}/turn",
            json={"user_input": "still alive?"},
        )
        assert turn_after_end.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# V1.1 — TTS ElevenLabs (mode voice)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_session_start_voice_mode_returns_audio_url(authenticated_pro_client, monkeypatch):
    """Mode voice → audio_url est un data URL non-null (TTS appelé)."""
    fake_data_url = "data:audio/mpeg;base64,ZmFrZQ=="

    async def fake_synth(text, lang="fr", voice_id=None):
        return fake_data_url

    monkeypatch.setattr("tutor.router.synthesize_audio_data_url", fake_synth)

    with patch(
        "tutor.router.llm_complete",
        new_callable=AsyncMock,
    ) as mock_llm:
        mock_llm.return_value = _make_llm_result()

        response = await authenticated_pro_client.post(
            "/api/tutor/session/start",
            json={
                "concept_term": "X",
                "concept_def": "Y",
                "mode": "voice",
                "lang": "fr",
            },
        )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["audio_url"] == fake_data_url


@pytest.mark.asyncio
async def test_session_start_text_mode_audio_url_is_null(authenticated_pro_client):
    """Mode text → audio_url reste None (régression V1.0 préservée)."""
    with patch(
        "tutor.router.llm_complete",
        new_callable=AsyncMock,
    ) as mock_llm:
        mock_llm.return_value = _make_llm_result()

        response = await authenticated_pro_client.post(
            "/api/tutor/session/start",
            json={
                "concept_term": "X",
                "concept_def": "Y",
                "mode": "text",
                "lang": "fr",
            },
        )
    assert response.status_code == 200
    assert response.json()["audio_url"] is None


@pytest.mark.asyncio
async def test_session_turn_voice_mode_returns_audio_url(authenticated_pro_client, monkeypatch):
    """Mode voice → /turn renvoie aussi audio_url non-null."""
    fake_data_url = "data:audio/mpeg;base64,dHVybg=="

    async def fake_synth(text, lang="fr", voice_id=None):
        return fake_data_url

    monkeypatch.setattr("tutor.router.synthesize_audio_data_url", fake_synth)

    with patch(
        "tutor.router.llm_complete",
        new_callable=AsyncMock,
    ) as mock_llm:
        mock_llm.return_value = _make_llm_result()

        # Start in voice mode
        start_resp = await authenticated_pro_client.post(
            "/api/tutor/session/start",
            json={"concept_term": "X", "concept_def": "Y", "mode": "voice", "lang": "fr"},
        )
        session_id = start_resp.json()["session_id"]

        # Turn
        turn_resp = await authenticated_pro_client.post(
            f"/api/tutor/session/{session_id}/turn",
            json={"user_input": "Mon idée"},
        )
    assert turn_resp.status_code == 200
    assert turn_resp.json()["audio_url"] == fake_data_url
