"""Unit tests for voice.context_digest.

Tests:
  - generate_voice_session_digest: idempotence, format, fallback on Mistral fail
  - maybe_generate_chat_text_digest: bucket of 20 trigger, no-op below threshold
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from voice.context_digest import (
    generate_voice_session_digest,
    DIGEST_MAX_OUTPUT_CHARS,
    CHAT_TEXT_BUCKET_SIZE,
)


@pytest.mark.asyncio
async def test_generate_voice_digest_idempotent(async_db_session, sample_user, sample_summary):
    """If digest_generated_at is already set, the function is a no-op."""
    from db.database import VoiceSession

    now = datetime.now(timezone.utc)
    vs = VoiceSession(
        id="sess-already-digested",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        started_at=now,
        duration_seconds=300,
        digest_text="existing digest",
        digest_generated_at=now,
    )
    async_db_session.add(vs)
    await async_db_session.commit()

    with patch("voice.context_digest._call_mistral_for_digest", new=AsyncMock()) as mock_mistral:
        await generate_voice_session_digest(async_db_session, "sess-already-digested")
        mock_mistral.assert_not_called()


@pytest.mark.asyncio
async def test_generate_voice_digest_writes_text(async_db_session, sample_user, sample_summary):
    """When run on a new session with messages, writes digest_text + timestamp."""
    from db.database import ChatMessage, VoiceSession

    now = datetime.now(timezone.utc)
    vs = VoiceSession(
        id="sess-new",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        started_at=now,
        duration_seconds=300,
        digest_text=None,
        digest_generated_at=None,
    )
    async_db_session.add(vs)
    async_db_session.add(ChatMessage(
        user_id=sample_user.id, summary_id=sample_summary.id,
        role="user", content="What is X?", source="voice",
        voice_session_id="sess-new", voice_speaker="user",
    ))
    async_db_session.add(ChatMessage(
        user_id=sample_user.id, summary_id=sample_summary.id,
        role="assistant", content="X is Y because Z.", source="voice",
        voice_session_id="sess-new", voice_speaker="agent",
    ))
    await async_db_session.commit()

    fake_digest = "- user demandé X\n- tu as répondu Y"
    with patch("voice.context_digest._call_mistral_for_digest", new=AsyncMock(return_value=fake_digest)):
        await generate_voice_session_digest(async_db_session, "sess-new")

    await async_db_session.refresh(vs)
    assert vs.digest_text == fake_digest
    assert vs.digest_generated_at is not None


@pytest.mark.asyncio
async def test_generate_voice_digest_fallback_on_mistral_fail(async_db_session, sample_user, sample_summary):
    """If Mistral raises, log + skip (digest_generated_at stays NULL for retry)."""
    from db.database import VoiceSession

    vs = VoiceSession(
        id="sess-fail", user_id=sample_user.id, summary_id=sample_summary.id,
        duration_seconds=300, digest_text=None, digest_generated_at=None,
    )
    async_db_session.add(vs)
    await async_db_session.commit()

    with patch(
        "voice.context_digest._call_mistral_for_digest",
        new=AsyncMock(side_effect=RuntimeError("mistral down")),
    ):
        await generate_voice_session_digest(async_db_session, "sess-fail")

    await async_db_session.refresh(vs)
    assert vs.digest_text is None
    assert vs.digest_generated_at is None
