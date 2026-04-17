"""Share-specific pytest fixtures.

Provides `client` (FastAPI TestClient with a stubbed DB session) and
`active_share_token` (registers a valid, non-revoked share row into the
stub so router queries resolve it).

The backend's global test DB infrastructure (`async_session` / `test_user`)
is not available, so we stub `get_session` in-place: a single in-memory
dict of tokens -> SharedAnalysis rows. Queries that mention a known token
return the row; otherwise `scalar_one_or_none` returns None (→ router 404).
"""
import json
import secrets
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient


# Module-level stub store: token -> SharedAnalysis instance.
# Reset per-test via autouse fixture below.
_STUB_SHARES: dict = {}


def _make_fake_get_session():
    """Build an async generator that yields a fake AsyncSession.

    The session's `execute()` inspects the compiled SQL to decide which
    (if any) SharedAnalysis row to return based on _STUB_SHARES.
    """

    async def _fake_get_session():
        session = AsyncMock()

        async def _execute(stmt):
            compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
            result = MagicMock()
            match = None
            for token, share in _STUB_SHARES.items():
                if token in compiled:
                    match = share
                    break
            if match is not None:
                result.scalar_one_or_none = MagicMock(return_value=match)
                result.scalars = MagicMock(
                    return_value=MagicMock(all=MagicMock(return_value=[match]))
                )
            else:
                result.scalar_one_or_none = MagicMock(return_value=None)
                result.scalars = MagicMock(
                    return_value=MagicMock(all=MagicMock(return_value=[]))
                )
            return result

        session.execute = _execute
        session.commit = AsyncMock()
        session.add = MagicMock()
        session.close = AsyncMock()
        yield session

    return _fake_get_session


@pytest.fixture
def client() -> TestClient:
    """Synchronous TestClient bound to the real FastAPI app, with a stubbed DB.

    Ensures every request to the share router resolves against the in-memory
    _STUB_SHARES dict instead of the real SQLite DB (which doesn't have the
    `shared_analyses` table in the test env).
    """
    from main import app
    from db.database import get_session

    _STUB_SHARES.clear()
    app.dependency_overrides[get_session] = _make_fake_get_session()
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_session, None)
        _STUB_SHARES.clear()


@pytest.fixture
def active_share_token(client: TestClient) -> str:
    """Register an active share with a minimal-but-complete snapshot.

    Returns the token string; the share is visible to the stubbed session
    until the `client` fixture tears down.
    """
    from db.database import SharedAnalysis

    token = secrets.token_urlsafe(8)[:10]
    snapshot = {
        "video_id": "JBaBAg4ny6U",
        "video_title": "Integration Test Video",
        "platform": "youtube",
        "video_thumbnail": "https://i.ytimg.com/vi/JBaBAg4ny6U/maxresdefault.jpg",
        "channel": "Test Channel",
        "synthesis_markdown": "## Test\n\nOK.",
    }
    share = SharedAnalysis(
        share_token=token,
        video_id="JBaBAg4ny6U",
        user_id=1,
        analysis_snapshot=json.dumps(snapshot),
        video_title="Integration Test Video",
        video_thumbnail="https://i.ytimg.com/vi/JBaBAg4ny6U/maxresdefault.jpg",
        is_active=True,
    )
    _STUB_SHARES[token] = share
    return token
