"""Tests for GET /api/voice/context/stream — SSE consumer of voice:ctx:{session_id}.

Two complementary patterns:
  1. Async-generator unit tests on the internal helper `_redis_pubsub_to_sse`
     (no HTTP, no fixture infrastructure required).
  2. IDOR & 404 checks via direct handler call (mocked auth + db).
"""
import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_redis_pubsub_to_sse_forwards_events():
    """The SSE generator yields properly formatted SSE for each pubsub message."""
    from voice.router import _redis_pubsub_to_sse

    # Mock pubsub stream
    fake_messages = [
        {"type": "subscribe", "channel": b"voice:ctx:sess1", "data": 1},
        {"type": "message", "channel": b"voice:ctx:sess1", "data": json.dumps({"type": "transcript_chunk", "chunk_index": 0, "text": "hi"}).encode()},
        {"type": "message", "channel": b"voice:ctx:sess1", "data": json.dumps({"type": "ctx_complete", "final_digest_summary": "ok"}).encode()},
    ]

    async def fake_listen():
        for m in fake_messages:
            yield m

    fake_pubsub = MagicMock()
    fake_pubsub.subscribe = AsyncMock()
    fake_pubsub.unsubscribe = AsyncMock()
    fake_pubsub.aclose = AsyncMock()  # if redis-py 5+; or .close() depending on version
    fake_pubsub.listen = fake_listen

    fake_redis = MagicMock()
    fake_redis.pubsub = MagicMock(return_value=fake_pubsub)

    output = []
    async for event in _redis_pubsub_to_sse(fake_redis, "sess1"):
        output.append(event)

    # Should yield at least: connected event + 1 transcript_chunk + 1 ctx_complete
    full = "".join(output)
    assert "event: transcript_chunk" in full
    assert "event: ctx_complete" in full
    assert '"chunk_index": 0' in full
    assert '"final_digest_summary": "ok"' in full
    # SSE format compliance
    assert "\n\n" in full  # event separator


@pytest.mark.asyncio
async def test_redis_pubsub_to_sse_terminates_on_ctx_complete():
    """Generator should close the pubsub after ctx_complete."""
    from voice.router import _redis_pubsub_to_sse

    fake_messages = [
        {"type": "message", "channel": b"voice:ctx:sess2", "data": json.dumps({"type": "ctx_complete", "final_digest_summary": "done"}).encode()},
        # Extra message that should NOT be forwarded (generator exited)
        {"type": "message", "channel": b"voice:ctx:sess2", "data": json.dumps({"type": "transcript_chunk", "chunk_index": 99}).encode()},
    ]

    async def fake_listen():
        for m in fake_messages:
            yield m

    fake_pubsub = MagicMock()
    fake_pubsub.subscribe = AsyncMock()
    fake_pubsub.unsubscribe = AsyncMock()
    fake_pubsub.aclose = AsyncMock()
    fake_pubsub.listen = fake_listen

    fake_redis = MagicMock()
    fake_redis.pubsub = MagicMock(return_value=fake_pubsub)

    output = []
    async for event in _redis_pubsub_to_sse(fake_redis, "sess2"):
        output.append(event)

    full = "".join(output)
    assert "event: ctx_complete" in full
    assert "chunk_index" not in full  # terminated before extra message


@pytest.mark.asyncio
async def test_stream_video_context_idor_other_user_session():
    """User A can't subscribe to user B's session_id → 403 or 404."""
    from voice.router import stream_video_context
    from fastapi import HTTPException

    fake_user_a = MagicMock(id=1)
    fake_session_b = MagicMock(user_id=2)  # owned by user B

    fake_db = AsyncMock()
    # Simulate the query returning the session owned by another user
    fake_result = MagicMock()
    fake_result.scalar_one_or_none = MagicMock(return_value=fake_session_b)
    fake_db.execute = AsyncMock(return_value=fake_result)

    with pytest.raises(HTTPException) as exc_info:
        await stream_video_context(
            session_id="sess_other_user",
            user=fake_user_a,
            db=fake_db,
        )
    assert exc_info.value.status_code in (403, 404)


@pytest.mark.asyncio
async def test_stream_video_context_unknown_session_returns_404():
    from voice.router import stream_video_context
    from fastapi import HTTPException

    fake_user = MagicMock(id=1)
    fake_db = AsyncMock()
    fake_result = MagicMock()
    fake_result.scalar_one_or_none = MagicMock(return_value=None)
    fake_db.execute = AsyncMock(return_value=fake_result)

    with pytest.raises(HTTPException) as exc_info:
        await stream_video_context(
            session_id="sess_does_not_exist",
            user=fake_user,
            db=fake_db,
        )
    assert exc_info.value.status_code == 404
