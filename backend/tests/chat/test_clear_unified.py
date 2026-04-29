"""Test the unified clear endpoint: text + voice + digests.

Verifies Task 7 of the merge-voice-chat-context spec:
    DELETE /api/chat/history/{summary_id}?include_voice=<bool>

Default include_voice=True wipes:
  - all chat_messages (text + voice) for (summary_id, user_id)
  - all chat_text_digests for (summary_id, user_id)
  - voice_sessions: digest_text=NULL, digest_generated_at=NULL (row kept)

include_voice=False only wipes:
  - chat_messages WHERE source='text' AND (summary_id, user_id)
  - chat_text_digests for (summary_id, user_id)
"""
from datetime import datetime, timezone

import pytest


@pytest.mark.asyncio
async def test_clear_history_include_voice_default_true(
    async_client, async_db_session, sample_user, sample_summary, auth_headers
):
    """DELETE /api/chat/history/{id} default include_voice=true → wipes everything."""
    from sqlalchemy import select

    from db.database import ChatMessage, ChatTextDigest, VoiceSession

    now = datetime.now(timezone.utc)
    async_db_session.add(
        ChatMessage(
            user_id=sample_user.id,
            summary_id=sample_summary.id,
            role="user",
            content="text msg",
            source="text",
        )
    )
    async_db_session.add(
        ChatMessage(
            user_id=sample_user.id,
            summary_id=sample_summary.id,
            role="user",
            content="voice msg",
            source="voice",
            voice_session_id="sess-x",
            voice_speaker="user",
        )
    )
    vs = VoiceSession(
        id="sess-x",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        started_at=now,
        digest_text="digest content",
        digest_generated_at=now,
    )
    async_db_session.add(vs)
    cd = ChatTextDigest(
        summary_id=sample_summary.id,
        user_id=sample_user.id,
        digest_text="text digest",
        msg_count=20,
    )
    async_db_session.add(cd)
    await async_db_session.commit()

    response = await async_client.delete(
        f"/api/chat/history/{sample_summary.id}",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    # All chat messages gone
    msgs = (
        await async_db_session.execute(
            select(ChatMessage).where(ChatMessage.summary_id == sample_summary.id)
        )
    ).scalars().all()
    assert len(msgs) == 0

    # Chat digests gone
    cds = (
        await async_db_session.execute(
            select(ChatTextDigest).where(
                ChatTextDigest.summary_id == sample_summary.id
            )
        )
    ).scalars().all()
    assert len(cds) == 0

    # Voice session still exists (audit billing) but digest cleared
    await async_db_session.refresh(vs)
    assert vs.digest_text is None
    assert vs.digest_generated_at is None


@pytest.mark.asyncio
async def test_clear_history_include_voice_false_keeps_voice(
    async_client, async_db_session, sample_user, sample_summary, auth_headers
):
    """DELETE /api/chat/history/{id}?include_voice=false → text + chat digests only."""
    from sqlalchemy import select

    from db.database import ChatMessage

    async_db_session.add(
        ChatMessage(
            user_id=sample_user.id,
            summary_id=sample_summary.id,
            role="user",
            content="text",
            source="text",
        )
    )
    async_db_session.add(
        ChatMessage(
            user_id=sample_user.id,
            summary_id=sample_summary.id,
            role="user",
            content="voice",
            source="voice",
            voice_session_id="vs-1",
            voice_speaker="user",
        )
    )
    await async_db_session.commit()

    response = await async_client.delete(
        f"/api/chat/history/{sample_summary.id}?include_voice=false",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text

    rows = (
        await async_db_session.execute(
            select(ChatMessage).where(ChatMessage.summary_id == sample_summary.id)
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].source == "voice"
