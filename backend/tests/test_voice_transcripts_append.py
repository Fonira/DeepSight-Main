"""
Tests for Spec #1, Task 7 — POST /api/voice/transcripts/append.

The endpoint is invoked by the frontend after each voice turn so that the
unified text+voice timeline survives a page reload (and so that ChatPage,
Library, Study can re-display the conversation).

Auth: Bearer JWT (existing get_current_user dep).
IDOR: voice_session.user_id == current_user.id required.
Rate-limit: 60/min per voice_session_id (Redis INCR + TTL, in-mem fallback).
Persistence: 1 row in chat_messages with source='voice', voice_session_id,
voice_speaker, time_in_call_secs.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─────────────────────────────────────────────────────────────────────────────
# Schema validation (lightweight, no FastAPI bootstrapping required).
# ─────────────────────────────────────────────────────────────────────────────


def test_transcript_append_request_accepts_user_speaker():
    from voice.schemas import TranscriptAppendRequest

    req = TranscriptAppendRequest(
        voice_session_id="abc-123",
        speaker="user",
        content="Bonjour",
        time_in_call_secs=12.5,
    )
    assert req.voice_session_id == "abc-123"
    assert req.speaker == "user"
    assert req.content == "Bonjour"
    assert req.time_in_call_secs == 12.5


def test_transcript_append_request_accepts_agent_speaker():
    from voice.schemas import TranscriptAppendRequest

    req = TranscriptAppendRequest(
        voice_session_id="abc-123",
        speaker="agent",
        content="Salut !",
        time_in_call_secs=14.0,
    )
    assert req.speaker == "agent"


def test_transcript_append_request_rejects_invalid_speaker():
    from voice.schemas import TranscriptAppendRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        TranscriptAppendRequest(
            voice_session_id="abc-123",
            speaker="bystander",
            content="hello",
            time_in_call_secs=0.0,
        )


def test_transcript_append_request_rejects_empty_content():
    from voice.schemas import TranscriptAppendRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        TranscriptAppendRequest(
            voice_session_id="abc-123",
            speaker="user",
            content="",
            time_in_call_secs=0.0,
        )


def test_transcript_append_request_rejects_negative_time():
    from voice.schemas import TranscriptAppendRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        TranscriptAppendRequest(
            voice_session_id="abc-123",
            speaker="user",
            content="hi",
            time_in_call_secs=-1.0,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Rate limiting helper (per voice_session_id, 60/min).
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_transcript_append_rate_limit_increments():
    """The helper increments the counter for a given voice_session_id."""
    from voice.router import _increment_transcript_append_count

    with patch(
        "voice.router._redis_incr_with_ttl", new=AsyncMock(return_value=None)
    ):
        from voice.router import _transcript_append_counts
        _transcript_append_counts.clear()

        c1 = await _increment_transcript_append_count("session_X")
        c2 = await _increment_transcript_append_count("session_X")
        c3 = await _increment_transcript_append_count("session_Y")
        assert c1 == 1
        assert c2 == 2
        assert c3 == 1


@pytest.mark.asyncio
async def test_transcript_append_rate_limit_uses_redis_when_available():
    """When redis returns a count, the helper trusts it (no in-mem fallback)."""
    from voice.router import _increment_transcript_append_count

    with patch(
        "voice.router._redis_incr_with_ttl", new=AsyncMock(return_value=42)
    ):
        c = await _increment_transcript_append_count("session_X")
        assert c == 42


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint logic — IDOR, rate-limit, INSERT.
# ─────────────────────────────────────────────────────────────────────────────


def _make_voice_session(session_id, user_id, summary_id=None):
    """Build a stub VoiceSession-like object sufficient for the endpoint."""
    from db.database import VoiceSession

    s = MagicMock(spec=VoiceSession)
    s.id = session_id
    s.user_id = user_id
    s.summary_id = summary_id
    return s


def _make_db_with_session(voice_session_obj):
    """Build a stub AsyncSession returning the given voice_session on lookup."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=voice_session_obj)
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.mark.asyncio
async def test_append_transcript_inserts_chat_message_with_voice_metadata():
    """Happy path: matching user → INSERT row with source='voice' + metadata."""
    from voice.router import append_transcript
    from voice.schemas import TranscriptAppendRequest
    from db.database import ChatMessage

    voice_session = _make_voice_session("sess_1", user_id=7, summary_id=42)
    db = _make_db_with_session(voice_session)

    user = MagicMock()
    user.id = 7
    user.email = "u@x.fr"

    req = TranscriptAppendRequest(
        voice_session_id="sess_1",
        speaker="user",
        content="Bonjour",
        time_in_call_secs=3.5,
    )

    from voice.router import _transcript_append_counts
    _transcript_append_counts.clear()

    with patch(
        "voice.router._redis_incr_with_ttl", new=AsyncMock(return_value=None)
    ):
        resp = await append_transcript(req, current_user=user, db=db)

    assert resp.get("ok") is True

    db.add.assert_called_once()
    inserted = db.add.call_args.args[0]
    assert isinstance(inserted, ChatMessage)
    assert inserted.user_id == 7
    assert inserted.summary_id == 42
    assert inserted.role == "user"
    assert inserted.content == "Bonjour"
    assert inserted.source == "voice"
    assert inserted.voice_session_id == "sess_1"
    assert inserted.voice_speaker == "user"
    assert inserted.time_in_call_secs == 3.5
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_append_transcript_agent_speaker_maps_to_assistant_role():
    """speaker='agent' → role='assistant', voice_speaker='agent'."""
    from voice.router import append_transcript
    from voice.schemas import TranscriptAppendRequest

    voice_session = _make_voice_session("sess_2", user_id=8, summary_id=None)
    db = _make_db_with_session(voice_session)
    user = MagicMock()
    user.id = 8

    req = TranscriptAppendRequest(
        voice_session_id="sess_2",
        speaker="agent",
        content="Hello there!",
        time_in_call_secs=4.2,
    )
    from voice.router import _transcript_append_counts
    _transcript_append_counts.clear()

    with patch(
        "voice.router._redis_incr_with_ttl", new=AsyncMock(return_value=None)
    ):
        await append_transcript(req, current_user=user, db=db)

    inserted = db.add.call_args.args[0]
    assert inserted.role == "assistant"
    assert inserted.voice_speaker == "agent"
    # summary_id may be None for companion sessions — that must be preserved.
    assert inserted.summary_id is None


@pytest.mark.asyncio
async def test_append_transcript_returns_403_when_session_belongs_to_other_user():
    """IDOR: voice_session.user_id != current_user.id → 403."""
    from fastapi import HTTPException
    from voice.router import append_transcript
    from voice.schemas import TranscriptAppendRequest

    voice_session = _make_voice_session("sess_X", user_id=99, summary_id=None)
    db = _make_db_with_session(voice_session)
    user = MagicMock()
    user.id = 7

    req = TranscriptAppendRequest(
        voice_session_id="sess_X",
        speaker="user",
        content="hi",
        time_in_call_secs=1.0,
    )
    from voice.router import _transcript_append_counts
    _transcript_append_counts.clear()

    with patch(
        "voice.router._redis_incr_with_ttl", new=AsyncMock(return_value=None)
    ):
        with pytest.raises(HTTPException) as exc_info:
            await append_transcript(req, current_user=user, db=db)

    assert exc_info.value.status_code == 403
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_append_transcript_returns_404_when_session_not_found():
    """Unknown voice_session_id → 404 (not 403, to avoid info leak)."""
    from fastapi import HTTPException
    from voice.router import append_transcript
    from voice.schemas import TranscriptAppendRequest

    db = _make_db_with_session(None)
    user = MagicMock()
    user.id = 7

    req = TranscriptAppendRequest(
        voice_session_id="ghost",
        speaker="user",
        content="hi",
        time_in_call_secs=1.0,
    )
    from voice.router import _transcript_append_counts
    _transcript_append_counts.clear()

    with patch(
        "voice.router._redis_incr_with_ttl", new=AsyncMock(return_value=None)
    ):
        with pytest.raises(HTTPException) as exc_info:
            await append_transcript(req, current_user=user, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_append_transcript_blocks_at_61st_call():
    """61st call within the same minute → 429 Too Many Requests."""
    from fastapi import HTTPException
    from voice.router import append_transcript, _transcript_append_counts
    from voice.schemas import TranscriptAppendRequest

    voice_session = _make_voice_session("sess_R", user_id=7, summary_id=42)
    db = _make_db_with_session(voice_session)
    user = MagicMock()
    user.id = 7

    req = TranscriptAppendRequest(
        voice_session_id="sess_R",
        speaker="user",
        content="msg",
        time_in_call_secs=1.0,
    )

    _transcript_append_counts.clear()
    _transcript_append_counts["sess_R"] = 60

    with patch(
        "voice.router._redis_incr_with_ttl", new=AsyncMock(return_value=None)
    ):
        with pytest.raises(HTTPException) as exc_info:
            await append_transcript(req, current_user=user, db=db)

    assert exc_info.value.status_code == 429
    db.add.assert_not_called()
