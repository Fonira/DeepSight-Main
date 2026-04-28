"""Tests for COMPANION tool webhook endpoints."""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport


@pytest.fixture
async def client():
    """Unauthenticated test client (tools are public — bearer in body)."""
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_companion_recos_tool_missing_auth_returns_401(client):
    resp = await client.post(
        "/api/voice/tools/companion-recos",
        json={"topic": "ia"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_companion_recos_tool_missing_voice_session_id_returns_401(client):
    resp = await client.post(
        "/api/voice/tools/companion-recos",
        headers={"Authorization": "Bearer some-token"},
        json={"topic": "ia"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_companion_recos_tool_token_mismatch_returns_401(client):
    resp = await client.post(
        "/api/voice/tools/companion-recos",
        headers={"Authorization": "Bearer wrong-token"},
        json={"topic": "ia", "voice_session_id": "actual-session-id"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_companion_recos_tool_valid_token_returns_recos():
    """When token + voice_session_id match and session exists, returns reco list."""
    from main import app
    from voice import router as voice_router
    from db.database import get_session

    fake_session = AsyncMock()
    fake_session.id = "valid-session-id"
    fake_session.user_id = 42

    # Mock DB session that returns empty excluded set
    fake_db = AsyncMock()
    fake_excluded_result = AsyncMock()
    fake_excluded_result.all = lambda: []
    fake_db.execute = AsyncMock(return_value=fake_excluded_result)

    async def _override_session():
        yield fake_db

    app.dependency_overrides[get_session] = _override_session

    try:
        with patch.object(
            voice_router, "verify_companion_tool_request", new_callable=AsyncMock
        ) as mock_verify:
            mock_verify.return_value = (fake_session, {"topic": "philosophie"})

            with patch.object(
                voice_router, "get_more_recos_chain", new_callable=AsyncMock
            ) as mock_chain:
                from voice.schemas import RecoItem

                mock_chain.return_value = [
                    RecoItem(
                        video_id="v1",
                        title="T",
                        channel="C",
                        duration_seconds=100,
                        source="tournesol",
                        why="w",
                    )
                ]

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as ac:
                    resp = await ac.post(
                        "/api/voice/tools/companion-recos",
                        headers={"Authorization": "Bearer valid-session-id"},
                        json={"topic": "philosophie", "voice_session_id": "valid-session-id"},
                    )
                assert resp.status_code == 200
                body = resp.json()
                assert "result" in body
                assert len(body["result"]) == 1
                assert body["result"][0]["video_id"] == "v1"
    finally:
        app.dependency_overrides.pop(get_session, None)
