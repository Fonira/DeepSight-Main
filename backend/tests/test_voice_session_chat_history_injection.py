"""
Tests for Spec #1, Task 6 — Inject chat history into voice session system prompt.

The voice agent must continue the user's existing text-chat conversation when
a summary_id is provided. We expose a small `format_chat_history_block` helper
in voice.router so it is unit-testable without booting FastAPI / ElevenLabs.
"""

import pytest


def test_format_chat_history_block_empty_returns_empty_string():
    """No history → no extra block in the prompt (no spurious header)."""
    from voice.router import format_chat_history_block

    assert format_chat_history_block([], language="fr") == ""
    assert format_chat_history_block([], language="en") == ""


def test_format_chat_history_block_french_header():
    """FR: must use the French header + 'Utilisateur'/'Toi' role labels."""
    from voice.router import format_chat_history_block

    history = [
        {"role": "user", "content": "C'est quoi l'aripiprazole ?"},
        {"role": "assistant", "content": "Un antipsychotique de 2e génération."},
    ]
    block = format_chat_history_block(history, language="fr")

    assert "Historique récent du chat" in block
    assert "Utilisateur" in block
    assert "Toi" in block
    assert "C'est quoi l'aripiprazole ?" in block
    assert "antipsychotique" in block
    # Continuity instruction should be there.
    assert "lignée" in block or "continuité" in block.lower()


def test_format_chat_history_block_english_header():
    """EN: must use the English header + 'User'/'You' role labels."""
    from voice.router import format_chat_history_block

    history = [
        {"role": "user", "content": "What is aripiprazole?"},
        {"role": "assistant", "content": "A 2nd-gen antipsychotic."},
    ]
    block = format_chat_history_block(history, language="en")

    assert "Recent text chat history" in block or "recent chat" in block.lower()
    assert "User" in block
    assert "You" in block
    assert "What is aripiprazole?" in block


def test_format_chat_history_block_truncates_long_messages():
    """A single 5000-char message must be truncated to keep the prompt small."""
    from voice.router import format_chat_history_block

    long_content = "x" * 5000
    history = [{"role": "user", "content": long_content}]
    block = format_chat_history_block(history, language="fr")

    # Block stays bounded — keep below ~2000 chars even with a huge message.
    assert len(block) < 2500


def test_format_chat_history_block_caps_messages_count():
    """Even with 50 messages, block stays under a sane cap (last N kept)."""
    from voice.router import format_chat_history_block

    history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg-{i}"}
        for i in range(50)
    ]
    block = format_chat_history_block(history, language="fr")

    # We keep at most 10 messages (per spec), so msg-0..msg-39 should be dropped.
    assert "msg-0" not in block
    assert "msg-49" in block  # last message must be preserved


def test_format_chat_history_block_preserves_chronological_order():
    """Messages must appear in chronological order (oldest → newest)."""
    from voice.router import format_chat_history_block

    history = [
        {"role": "user", "content": "first-question"},
        {"role": "assistant", "content": "first-answer"},
        {"role": "user", "content": "second-question"},
    ]
    block = format_chat_history_block(history, language="fr")

    # first-question must appear before first-answer must appear before second-question
    pos_q1 = block.find("first-question")
    pos_a1 = block.find("first-answer")
    pos_q2 = block.find("second-question")
    assert 0 <= pos_q1 < pos_a1 < pos_q2
