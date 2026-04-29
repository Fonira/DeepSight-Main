"""Test that chat IA receives voice rows + voice digests in its prompt.

Verifies Task 7 of the merge-voice-chat-context spec: the chat router
calls ``build_unified_context_block`` and the unified history_text
(containing voice digests + verbatim voice rows) reaches the prompt
builder downstream.

Strategy: patch ``chat.service.generate_chat_response_v4`` to capture
the ``history_text`` kwarg passed to it by ``process_chat_message_v4``.
The kwarg is the unified context block that *will* be threaded through
``generate_chat_response`` → ``build_chat_prompt``. Asserting at this
level avoids needing a real Mistral key while still verifying that the
unified block content reaches the prompt construction layer.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_chat_prompt_includes_voice_digest_and_voice_messages(
    async_client, async_db_session, sample_user, sample_summary, auth_headers
):
    """Given: voice_session with digest + voice ChatMessages on summary S.
    When: user posts a chat message on S.
    Then: the unified context block (history_text passed downstream to
          build_chat_prompt) includes both the voice digest text and the
          voice verbatim row.
    """
    from db.database import ChatMessage, VoiceSession

    now = datetime.now(timezone.utc)
    vs = VoiceSession(
        id="sess-old",
        user_id=sample_user.id,
        summary_id=sample_summary.id,
        started_at=now - timedelta(days=1),
        duration_seconds=300,
        digest_text="- user a posé question Q\n- tu as répondu R",
        digest_generated_at=now - timedelta(days=1),
    )
    async_db_session.add(vs)
    async_db_session.add(
        ChatMessage(
            user_id=sample_user.id,
            summary_id=sample_summary.id,
            role="user",
            content="vocal question",
            source="voice",
            voice_session_id="sess-old",
            voice_speaker="user",
            created_at=now - timedelta(days=1),
        )
    )
    await async_db_session.commit()

    captured = {}

    async def fake_v4(*args, **kwargs):
        captured["history_text"] = kwargs.get("history_text", "")
        return ("answer", [], False)

    with patch(
        "chat.service.generate_chat_response_v4",
        new=AsyncMock(side_effect=fake_v4),
    ):
        response = await async_client.post(
            "/api/chat/ask",
            json={
                "summary_id": sample_summary.id,
                "question": "Suite ?",
                "mode": "standard",
            },
            headers=auth_headers,
        )

    assert response.status_code == 200, response.text
    history_text = captured.get("history_text", "")
    # Voice digest content present
    assert "user a posé question Q" in history_text, (
        f"voice digest missing from history_text: {history_text!r}"
    )
    # Voice verbatim row present (either the content or the [VOCAL...] label)
    assert "vocal question" in history_text or "[VOCAL" in history_text, (
        f"voice verbatim row missing from history_text: {history_text!r}"
    )
