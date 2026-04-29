"""Unit tests for voice.context_digest.

Tests:
  - generate_voice_session_digest: idempotence, format, fallback on Mistral fail
  - maybe_generate_chat_text_digest: bucket of 20 trigger, no-op below threshold
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

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
    """If Mistral raises, log + skip (digest_generated_at stays NULL for retry).

    Must seed at least one ChatMessage so the function reaches the Mistral call
    (otherwise it short-circuits on the empty-session guard, masking the real
    branch we want to verify).
    """
    from db.database import ChatMessage, VoiceSession

    now = datetime.now(timezone.utc)
    vs = VoiceSession(
        id="sess-fail",
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
        role="user", content="seed message so Mistral path is reached",
        source="voice", voice_session_id="sess-fail", voice_speaker="user",
    ))
    await async_db_session.commit()

    with patch(
        "voice.context_digest._call_mistral_for_digest",
        new=AsyncMock(side_effect=RuntimeError("mistral down")),
    ) as mock_mistral:
        await generate_voice_session_digest(async_db_session, "sess-fail")
        mock_mistral.assert_called_once()  # proves we exercised the Mistral path

    await async_db_session.refresh(vs)
    assert vs.digest_text is None
    assert vs.digest_generated_at is None


@pytest.mark.asyncio
async def test_generate_voice_digest_empty_session_stamps_to_prevent_retries(async_db_session, sample_user, sample_summary):
    """Empty voice session (no ChatMessages) is stamped with empty digest_text + digest_generated_at,
    so future triggers short-circuit on the idempotency guard instead of re-running the SELECT chain."""
    from db.database import VoiceSession

    now = datetime.now(timezone.utc)
    vs = VoiceSession(
        id="sess-empty",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        started_at=now,
        duration_seconds=300,
        digest_text=None,
        digest_generated_at=None,
    )
    async_db_session.add(vs)
    await async_db_session.commit()

    with patch("voice.context_digest._call_mistral_for_digest", new=AsyncMock()) as mock_m:
        await generate_voice_session_digest(async_db_session, "sess-empty")
        mock_m.assert_not_called()  # empty session should never reach Mistral

    await async_db_session.refresh(vs)
    assert vs.digest_text == ""  # stamped to prevent retries
    assert vs.digest_generated_at is not None


@pytest.mark.asyncio
async def test_maybe_chat_text_digest_no_op_below_threshold(async_db_session, sample_user, sample_summary):
    """19 ungested text msgs → no digest."""
    from db.database import ChatMessage
    from voice.context_digest import maybe_generate_chat_text_digest

    for i in range(19):
        async_db_session.add(ChatMessage(
            user_id=sample_user.id, summary_id=sample_summary.id,
            role="user" if i % 2 == 0 else "assistant",
            content=f"msg {i}", source="text",
        ))
    await async_db_session.commit()

    with patch("voice.context_digest._call_mistral_for_digest", new=AsyncMock()) as mock_m:
        await maybe_generate_chat_text_digest(async_db_session, sample_summary.id, sample_user.id)
        mock_m.assert_not_called()


@pytest.mark.asyncio
async def test_maybe_chat_text_digest_creates_bucket_at_20(async_db_session, sample_user, sample_summary):
    """20 ungested text msgs → 1 digest row created with first/last msg ids set."""
    from db.database import ChatMessage, ChatTextDigest
    from voice.context_digest import maybe_generate_chat_text_digest

    msgs = []
    for i in range(20):
        m = ChatMessage(
            user_id=sample_user.id, summary_id=sample_summary.id,
            role="user" if i % 2 == 0 else "assistant",
            content=f"msg {i}", source="text",
        )
        async_db_session.add(m)
        msgs.append(m)
    await async_db_session.commit()
    for m in msgs:
        await async_db_session.refresh(m)

    fake_digest = "- user a posé 10 questions\n- tu as répondu sur le thème X"
    with patch("voice.context_digest._call_mistral_for_digest", new=AsyncMock(return_value=fake_digest)):
        await maybe_generate_chat_text_digest(async_db_session, sample_summary.id, sample_user.id)

    digests = (await async_db_session.execute(
        select(ChatTextDigest).where(ChatTextDigest.summary_id == sample_summary.id)
    )).scalars().all()
    assert len(digests) == 1
    assert digests[0].msg_count == 20
    assert digests[0].first_message_id == msgs[0].id
    assert digests[0].last_message_id == msgs[19].id
    assert digests[0].digest_text == fake_digest
