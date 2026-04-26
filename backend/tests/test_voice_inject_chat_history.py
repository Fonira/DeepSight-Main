"""
Tests for Spec #1, Task 6 — Inject chat history into voice session system prompt.

The voice agent must continue the user's existing text-chat conversation when
a summary_id is provided. We expose a small `_build_chat_history_block_for_voice`
helper in voice.router so it is unit-testable without booting FastAPI / ElevenLabs.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def test_format_chat_history_block_empty_returns_empty_string():
    """No history → no extra block in the prompt (no spurious header)."""
    from voice.router import _build_chat_history_block_for_voice

    assert _build_chat_history_block_for_voice([], language="fr") == ""
    assert _build_chat_history_block_for_voice([], language="en") == ""


def test_format_chat_history_block_french_header():
    """FR: must use the French header + 'Utilisateur'/'Toi' role labels."""
    from voice.router import _build_chat_history_block_for_voice

    history = [
        {"role": "user", "content": "C'est quoi l'aripiprazole ?"},
        {"role": "assistant", "content": "Un antipsychotique de 2e génération."},
    ]
    block = _build_chat_history_block_for_voice(history, language="fr")

    assert "Historique récent du chat" in block
    assert "Utilisateur" in block
    assert "Toi" in block
    assert "C'est quoi l'aripiprazole ?" in block
    assert "antipsychotique" in block
    # Continuity instruction should be there.
    assert "lignée" in block or "continuité" in block.lower()


def test_format_chat_history_block_english_header():
    """EN: must use the English header + 'User'/'You' role labels."""
    from voice.router import _build_chat_history_block_for_voice

    history = [
        {"role": "user", "content": "What is aripiprazole?"},
        {"role": "assistant", "content": "A 2nd-gen antipsychotic."},
    ]
    block = _build_chat_history_block_for_voice(history, language="en")

    assert "Recent text chat history" in block or "recent chat" in block.lower()
    assert "User" in block
    assert "You" in block
    assert "What is aripiprazole?" in block


def test_format_chat_history_block_truncates_long_messages():
    """A single 5000-char message must be truncated to keep the prompt small."""
    from voice.router import _build_chat_history_block_for_voice

    long_content = "x" * 5000
    history = [{"role": "user", "content": long_content}]
    block = _build_chat_history_block_for_voice(history, language="fr")

    # Block stays bounded — keep below ~2000 chars even with a huge message.
    assert len(block) < 2500


def test_format_chat_history_block_caps_messages_count():
    """Even with 50 messages, block stays under a sane cap (last N kept)."""
    from voice.router import _build_chat_history_block_for_voice

    history = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"msg-{i}"} for i in range(50)]
    block = _build_chat_history_block_for_voice(history, language="fr")

    # We keep at most 10 messages (per spec), so msg-0..msg-39 should be dropped.
    assert "msg-0" not in block
    assert "msg-49" in block  # last message must be preserved


def test_format_chat_history_block_preserves_chronological_order():
    """Messages must appear in chronological order (oldest → newest)."""
    from voice.router import _build_chat_history_block_for_voice

    history = [
        {"role": "user", "content": "first-question"},
        {"role": "assistant", "content": "first-answer"},
        {"role": "user", "content": "second-question"},
    ]
    block = _build_chat_history_block_for_voice(history, language="fr")

    # first-question must appear before first-answer must appear before second-question
    pos_q1 = block.find("first-question")
    pos_a1 = block.find("first-answer")
    pos_q2 = block.find("second-question")
    assert 0 <= pos_q1 < pos_a1 < pos_q2


def test_chat_history_block_skips_voice_rows():
    """Rows with source='voice' must be skipped — already reflected in active voice session.

    Spec #1, Task 6 + Task 9: voice messages stored in chat_messages should
    not be re-injected into the voice agent's system prompt because the
    agent is already participating in that voice exchange. Only text-source
    messages (or rows with no `source` for legacy compatibility) belong here.
    """
    from voice.router import _build_chat_history_block_for_voice

    history = [
        {"role": "user", "content": "Texte 1", "source": "text"},
        {"role": "assistant", "content": "Voix 1", "source": "voice"},
        {"role": "user", "content": "Texte 2", "source": "text"},
    ]
    block = _build_chat_history_block_for_voice(history, language="fr")
    assert "Texte 1" in block
    assert "Texte 2" in block
    assert "Voix 1" not in block


# ═══════════════════════════════════════════════════════════════════════════════
# Integration test — verify create_voice_session injects history block
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def mock_voice_user():
    """User mock allowed on the pro plan (voice enabled, explorer requires pro)."""
    user = MagicMock()
    user.id = 1
    user.email = "voice@test.fr"
    user.plan = "pro"
    user.is_admin = False
    user.voice_bonus_seconds = 0
    user.stripe_customer_id = "cus_test123"
    user.username = "voice_tester"
    return user


def _make_voice_prefs() -> MagicMock:
    """Return a VoicePreferences-shaped mock the router can consume."""
    prefs = MagicMock()
    prefs.voice_id = None
    prefs.input_mode = "ptt"
    prefs.ptt_key = " "
    prefs.turn_timeout = 15
    prefs.turn_eagerness = "normal"
    prefs.voice_chat_model = "eleven_turbo_v2_5"
    prefs.voice_chat_speed_preset = "1x"
    prefs.to_voice_settings = MagicMock(return_value={"speed": 1.0})
    return prefs


@pytest.mark.asyncio
async def test_chat_history_injected_when_summary_id_present(mock_db_session, mock_voice_user):
    """When summary_id is set, recent chat history is appended to the voice system_prompt.

    Integration-style test: stub the Summary lookup, build_rich_context,
    chat.service.get_chat_history and the ElevenLabs client so we can
    inspect the system_prompt actually passed to create_conversation_agent.
    """
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest

    request = VoiceSessionRequest(summary_id=42, agent_type="explorer", language="fr")

    fake_history = [
        {"role": "user", "content": "Quelle est la thèse principale ?", "source": "text"},
        {"role": "assistant", "content": "L'auteur soutient que...", "source": "text"},
    ]

    # ── Summary lookup stub: db.execute(select(Summary)).scalar_one_or_none()
    # must return a truthy summary for the explorer agent to proceed.
    fake_summary = MagicMock()
    fake_summary.id = 42
    fake_summary.user_id = 1

    summary_result = MagicMock()
    summary_result.scalar_one_or_none = MagicMock(return_value=fake_summary)
    mock_db_session.execute = AsyncMock(return_value=summary_result)

    def _fake_add(obj):
        if getattr(obj, "id", None) is None:
            import uuid as _uuid

            obj.id = str(_uuid.uuid4())

    mock_db_session.add = MagicMock(side_effect=_fake_add)
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    # ── ElevenLabs client mock — capture create_conversation_agent kwargs ──
    captured: dict = {}

    async def fake_create_agent(**kwargs):
        captured["agent_kwargs"] = kwargs
        return "agent_history_test"

    eleven_client = AsyncMock()
    eleven_client.create_conversation_agent = fake_create_agent
    eleven_client.get_signed_url = AsyncMock(return_value=("wss://signed.example.test", "2026-04-25T11:00:00Z"))
    eleven_client.get_conversation_token = AsyncMock(return_value=("livekit_token_xyz", "2026-04-25T11:00:00Z"))
    eleven_cm = AsyncMock()
    eleven_cm.__aenter__ = AsyncMock(return_value=eleven_client)
    eleven_cm.__aexit__ = AsyncMock(return_value=False)

    # ── build_rich_context stub: return a minimal rich-context-like object ──
    fake_rich_ctx = MagicMock()
    fake_rich_ctx.video_title = "Test Video"
    fake_rich_ctx.channel_name = "Test Channel"
    fake_rich_ctx.duration_str = "10:00"
    fake_rich_ctx.transcript_strategy = "full"
    fake_rich_ctx.transcript = "transcript text"
    fake_rich_ctx.total_chars = 100
    fake_rich_ctx.format_for_voice = MagicMock(return_value="VIDEO_CTX_BLOCK")

    with (
        patch(
            "voice.router.check_voice_quota",
            new=AsyncMock(return_value={"can_use": True, "seconds_remaining": 600}),
        ),
        patch(
            "voice.router.get_elevenlabs_client",
            return_value=eleven_cm,
        ),
        patch(
            "voice.preferences.get_user_voice_preferences",
            new=AsyncMock(return_value=_make_voice_prefs()),
        ),
        patch(
            "chat.context_builder.build_rich_context",
            new=AsyncMock(return_value=fake_rich_ctx),
        ),
        patch(
            "chat.service.get_chat_history",
            new=AsyncMock(return_value=fake_history),
        ),
    ):
        await create_voice_session(
            request,
            current_user=mock_voice_user,
            db=mock_db_session,
        )

    # The helper must have been invoked with our fake_history and produced
    # a block that landed in the agent's system_prompt.
    sent_prompt = captured["agent_kwargs"].get("system_prompt", "")
    assert "Historique récent du chat texte" in sent_prompt
    assert "Quelle est la thèse principale" in sent_prompt
    assert "L'auteur soutient" in sent_prompt
