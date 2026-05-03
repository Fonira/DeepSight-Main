"""Tests unit pour tutor.service — Redis store + Magistral orchestration."""
import pytest
from unittest.mock import AsyncMock, patch
from src.tutor.service import (
    create_session,
    load_session,
    append_turn,
    delete_session,
)
from src.tutor.schemas import TutorSessionState, TutorTurn


@pytest.mark.asyncio
async def test_create_and_load_session(redis_client_fixture):
    state = TutorSessionState(
        session_id="test-1",
        user_id=42,
        concept_term="Rasoir d'Occam",
        concept_def="Principe de parcimonie...",
        mode="text",
        lang="fr",
        started_at_ms=1700000000000,
    )
    await create_session(redis_client_fixture, state)

    loaded = await load_session(redis_client_fixture, "test-1")
    assert loaded is not None
    assert loaded.user_id == 42
    assert loaded.concept_term == "Rasoir d'Occam"
    assert loaded.turns == []


@pytest.mark.asyncio
async def test_append_turn(redis_client_fixture):
    state = TutorSessionState(
        session_id="test-2",
        user_id=42,
        concept_term="X",
        concept_def="Y",
        mode="text",
        lang="fr",
        started_at_ms=1700000000000,
    )
    await create_session(redis_client_fixture, state)

    await append_turn(
        redis_client_fixture,
        "test-2",
        TutorTurn(role="user", content="Hello", timestamp_ms=1700000001000),
    )

    loaded = await load_session(redis_client_fixture, "test-2")
    assert len(loaded.turns) == 1
    assert loaded.turns[0].role == "user"


@pytest.mark.asyncio
async def test_delete_session(redis_client_fixture):
    state = TutorSessionState(
        session_id="test-3",
        user_id=42,
        concept_term="X",
        concept_def="Y",
        mode="text",
        lang="fr",
        started_at_ms=1700000000000,
    )
    await create_session(redis_client_fixture, state)
    await delete_session(redis_client_fixture, "test-3")

    loaded = await load_session(redis_client_fixture, "test-3")
    assert loaded is None


# ═══════════════════════════════════════════════════════════════════════════════
# V1.1 — synthesize_audio_data_url (ElevenLabs TTS helper)
# ═══════════════════════════════════════════════════════════════════════════════
import base64
from unittest.mock import patch, AsyncMock, MagicMock
from src.tutor.service import synthesize_audio_data_url


@pytest.mark.asyncio
async def test_synthesize_audio_data_url_returns_data_url():
    """Quand ElevenLabs répond OK, renvoie un data URL base64 valide."""
    fake_audio_bytes = b"\xff\xfb\x90\x00fake mp3 data"

    # Mock httpx.AsyncClient context manager + post
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = fake_audio_bytes

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.tutor.service.httpx.AsyncClient", return_value=mock_client):
        with patch("src.tutor.service.get_elevenlabs_key", return_value="fake-key"):
            result = await synthesize_audio_data_url("Bonjour", lang="fr")

    assert result is not None
    assert result.startswith("data:audio/mpeg;base64,")
    decoded = base64.b64decode(result.split(",", 1)[1])
    assert decoded == fake_audio_bytes


@pytest.mark.asyncio
async def test_synthesize_audio_data_url_returns_none_on_error():
    """Quand ElevenLabs fail (500), renvoie None (graceful fallback)."""
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "internal error"

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.tutor.service.httpx.AsyncClient", return_value=mock_client):
        with patch("src.tutor.service.get_elevenlabs_key", return_value="fake-key"):
            result = await synthesize_audio_data_url("Bonjour", lang="fr")

    assert result is None


@pytest.mark.asyncio
async def test_synthesize_audio_data_url_no_api_key():
    """Sans clé API → None (no call attempted)."""
    with patch("src.tutor.service.get_elevenlabs_key", return_value=None):
        result = await synthesize_audio_data_url("Bonjour", lang="fr")
    assert result is None


@pytest.mark.asyncio
async def test_synthesize_audio_data_url_empty_text():
    """Texte vide → None (rien à synthétiser)."""
    with patch("src.tutor.service.get_elevenlabs_key", return_value="fake-key"):
        result = await synthesize_audio_data_url("   ", lang="fr")
    assert result is None
