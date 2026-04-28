"""Tests for the SSE endpoint GET /api/voice/context/stream (Quick Voice Call Task 5).

Following the existing voice tests pattern (see test_voice_session_companion.py),
the function is invoked directly with mocks rather than going through an HTTP
client — this avoids spinning up the full FastAPI app for unit tests.

What we verify:
  * Owner of the voice session can subscribe (200 + SSE Content-Type)
  * IDOR protection: another user gets 403 (not 404) for an existing session
  * Session not found → 404
  * The SSE stream forwards Redis pubsub messages as Server-Sent Events
    formatted ``event: <type>\\ndata: {...}\\n\\n``
  * The stream terminates after a ``ctx_complete`` event
"""

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException


def _make_user(user_id: int = 1, plan: str = "free"):
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    user.is_admin = False
    user.email = f"u{user_id}@test.fr"
    return user


def _make_session(session_id: str, user_id: int):
    sess = MagicMock()
    sess.id = session_id
    sess.user_id = user_id
    return sess


class _FakePubSub:
    """Minimal async-iterable pubsub stub for SSE listen()."""

    def __init__(self, messages: list[dict[str, Any]]):
        self._messages = messages
        self.subscribed_to: list[str] = []
        self.unsubscribed_from: list[str] = []

    async def subscribe(self, channel: str) -> None:
        self.subscribed_to.append(channel)

    async def unsubscribe(self, channel: str) -> None:
        self.unsubscribed_from.append(channel)

    async def listen(self):
        # The first message in real pubsub is the subscribe ack — emit one
        # of type "subscribe" first so the endpoint correctly skips it.
        yield {"type": "subscribe", "channel": "ack", "data": 1}
        for m in self._messages:
            yield m


def _make_redis(messages: list[dict[str, Any]]):
    pubsub = _FakePubSub(messages)
    redis = MagicMock()
    redis.pubsub = MagicMock(return_value=pubsub)
    return redis, pubsub


def _build_db_with_session(sess) -> AsyncMock:
    db = AsyncMock()

    async def _execute(_stmt):
        result = MagicMock()
        result.scalar_one_or_none = MagicMock(return_value=sess)
        return result

    db.execute = AsyncMock(side_effect=_execute)
    return db


@pytest.mark.asyncio
async def test_owner_gets_streaming_response_with_correct_media_type():
    from voice.router import stream_video_context

    user = _make_user(user_id=42)
    sess = _make_session("sess-A", user_id=42)
    db = _build_db_with_session(sess)
    redis, _ = _make_redis(
        messages=[
            {
                "type": "message",
                "channel": "voice:ctx:sess-A",
                "data": json.dumps(
                    {"type": "ctx_complete", "final_digest_summary": "D"}
                ),
            }
        ]
    )

    response = await stream_video_context(
        session_id="sess-A", user=user, db=db, redis=redis
    )
    assert response.media_type == "text/event-stream"
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_idor_other_user_session_rejected():
    from voice.router import stream_video_context

    user = _make_user(user_id=99)
    sess = _make_session("sess-B", user_id=42)  # owned by someone else
    db = _build_db_with_session(sess)
    redis, _ = _make_redis(messages=[])

    with pytest.raises(HTTPException) as exc_info:
        await stream_video_context(
            session_id="sess-B", user=user, db=db, redis=redis
        )
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_session_not_found_returns_404():
    from voice.router import stream_video_context

    user = _make_user(user_id=1)
    db = _build_db_with_session(sess=None)
    redis, _ = _make_redis(messages=[])

    with pytest.raises(HTTPException) as exc_info:
        await stream_video_context(
            session_id="nope", user=user, db=db, redis=redis
        )
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_stream_emits_sse_formatted_events_then_terminates():
    """Drain the StreamingResponse body and verify SSE format and termination."""
    from voice.router import stream_video_context

    user = _make_user(user_id=1)
    sess = _make_session("sess-X", user_id=1)
    db = _build_db_with_session(sess)

    fake_messages = [
        {
            "type": "message",
            "channel": "voice:ctx:sess-X",
            "data": json.dumps(
                {
                    "type": "transcript_chunk",
                    "chunk_index": 0,
                    "text": "hello",
                    "total_chunks": 1,
                }
            ),
        },
        {
            "type": "message",
            "channel": "voice:ctx:sess-X",
            "data": json.dumps({"type": "ctx_complete", "final_digest_summary": "D"}),
        },
        # Should never reach this — stream stops after ctx_complete
        {
            "type": "message",
            "channel": "voice:ctx:sess-X",
            "data": json.dumps({"type": "transcript_chunk", "text": "after_complete"}),
        },
    ]
    redis, pubsub = _make_redis(messages=fake_messages)

    response = await stream_video_context(
        session_id="sess-X", user=user, db=db, redis=redis
    )

    chunks = []
    async for chunk in response.body_iterator:
        if isinstance(chunk, bytes):
            chunks.append(chunk.decode("utf-8"))
        else:
            chunks.append(chunk)

    body = "".join(chunks)
    # Expect both events in SSE format
    assert "event: transcript_chunk\n" in body
    assert "event: ctx_complete\n" in body
    assert '"text": "hello"' in body
    # ctx_complete must terminate — the after_complete event MUST NOT appear
    assert "after_complete" not in body
    # Subscribe + unsubscribe were invoked on the right channel
    assert pubsub.subscribed_to == ["voice:ctx:sess-X"]
    assert pubsub.unsubscribed_from == ["voice:ctx:sess-X"]


@pytest.mark.asyncio
async def test_stream_emits_event_data_in_sse_format():
    """Each SSE event must be ``event: <type>\\ndata: <json>\\n\\n``."""
    from voice.router import stream_video_context

    user = _make_user(user_id=1)
    sess = _make_session("sess-Y", user_id=1)
    db = _build_db_with_session(sess)

    redis, _ = _make_redis(
        messages=[
            {
                "type": "message",
                "channel": "voice:ctx:sess-Y",
                "data": json.dumps({"type": "ctx_complete", "final_digest_summary": "F"}),
            }
        ]
    )

    response = await stream_video_context(
        session_id="sess-Y", user=user, db=db, redis=redis
    )

    body_parts = []
    async for chunk in response.body_iterator:
        if isinstance(chunk, bytes):
            body_parts.append(chunk.decode("utf-8"))
        else:
            body_parts.append(chunk)

    body = "".join(body_parts)
    # Each SSE record ends with double newline (separator)
    assert body.endswith("\n\n")
    # The stream now opens with an initial ``connected`` heartbeat (Task 8),
    # followed by the actual event records. Verify both records are well-formed.
    records = [r for r in body.split("\n\n") if r]
    # First record = connected heartbeat
    assert records[0].splitlines()[0] == "event: connected"
    assert records[0].splitlines()[1].startswith("data: {")
    # Last record = ctx_complete (terminator)
    assert records[-1].splitlines()[0] == "event: ctx_complete"
    assert records[-1].splitlines()[1].startswith("data: {")
