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
async def test_start_analysis_tool_invalid_url_returns_400():
    from main import app
    from voice import router as voice_router

    fake_session = AsyncMock(id="s1", user_id=42)

    with patch.object(
        voice_router, "verify_companion_tool_request", new_callable=AsyncMock
    ) as mock_verify:
        mock_verify.return_value = (fake_session, {"video_url": "https://twitter.com/x"})

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post(
                "/api/voice/tools/start-analysis",
                headers={"Authorization": "Bearer s1"},
                json={"video_url": "https://twitter.com/x", "voice_session_id": "s1"},
            )
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_analysis_tool_valid_url_returns_queued():
    from main import app
    from voice import router as voice_router

    fake_session = AsyncMock(id="s2", user_id=42)
    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value=None)
    fake_redis.set = AsyncMock(return_value=True)

    with patch.object(
        voice_router, "verify_companion_tool_request", new_callable=AsyncMock
    ) as mock_verify:
        mock_verify.return_value = (
            fake_session,
            {"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        )

        with patch.object(
            voice_router, "_resolve_redis_client", return_value=fake_redis
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.post(
                    "/api/voice/tools/start-analysis",
                    headers={"Authorization": "Bearer s2"},
                    json={
                        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                        "voice_session_id": "s2",
                    },
                )
            assert resp.status_code == 200
            body = resp.json()
            assert body["result"]["video_id"] == "dQw4w9WgXcQ"
            assert body["result"]["status"] == "queued"


@pytest.mark.asyncio
async def test_start_analysis_tool_rate_limit_returns_429():
    from main import app
    from voice import router as voice_router

    fake_session = AsyncMock(id="s3", user_id=42)
    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value="3")  # already at limit

    with patch.object(
        voice_router, "verify_companion_tool_request", new_callable=AsyncMock
    ) as mock_verify:
        mock_verify.return_value = (
            fake_session,
            {"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        )

        with patch.object(
            voice_router, "_resolve_redis_client", return_value=fake_redis
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.post(
                    "/api/voice/tools/start-analysis",
                    headers={"Authorization": "Bearer s3"},
                    json={
                        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                        "voice_session_id": "s3",
                    },
                )
            assert resp.status_code == 429


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
