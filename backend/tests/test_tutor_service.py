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
