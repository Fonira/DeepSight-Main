"""
Tests for Spec #1, Task 9 — ChatMessage schema enrichment.

The unified text+voice timeline requires the chat history endpoint to
expose the voice metadata (source, voice_speaker, voice_session_id,
time_in_call_secs) and web search context (web_search_used, sources)
so the frontend can render Voice/Text badges and source citations.
"""

from datetime import datetime


def test_chat_message_schema_supports_voice_fields():
    from chat.router import ChatMessage

    msg = ChatMessage(
        id=42,
        role="user",
        content="Hello",
        created_at=datetime(2026, 4, 25, 10, 0, 0),
        source="voice",
        voice_speaker="user",
        voice_session_id="sess_abc",
        time_in_call_secs=12.5,
    )

    assert msg.id == 42
    assert msg.source == "voice"
    assert msg.voice_speaker == "user"
    assert msg.voice_session_id == "sess_abc"
    assert msg.time_in_call_secs == 12.5


def test_chat_message_schema_defaults_to_text_source():
    """Backward compat: omitted source field → 'text'."""
    from chat.router import ChatMessage

    msg = ChatMessage(
        role="user",
        content="Hello",
        created_at=datetime.utcnow(),
    )
    assert msg.source == "text"
    assert msg.voice_speaker is None
    assert msg.voice_session_id is None
    assert msg.time_in_call_secs is None


def test_chat_message_schema_supports_web_search_metadata():
    from chat.router import ChatMessage

    msg = ChatMessage(
        role="assistant",
        content="Per the latest news…",
        created_at=datetime.utcnow(),
        web_search_used=True,
        sources=[{"title": "AFP", "url": "https://afp.example/x"}],
    )
    assert msg.web_search_used is True
    assert msg.sources == [{"title": "AFP", "url": "https://afp.example/x"}]


def test_chat_message_rejects_invalid_source_value():
    """source must be 'text' or 'voice'."""
    from chat.router import ChatMessage
    from pydantic import ValidationError
    import pytest

    with pytest.raises(ValidationError):
        ChatMessage(
            role="user",
            content="x",
            created_at=datetime.utcnow(),
            source="hologram",
        )
