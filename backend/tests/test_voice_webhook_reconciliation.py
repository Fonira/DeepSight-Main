"""
Tests for Spec #1, Task 8 — Webhook reconciliation post-call.

After ElevenLabs sends the canonical transcript via webhook, we compare it
to what /transcripts/append already persisted during the call:
- INSERT missing turns (frontend dropped events / network drop)
- UPDATE drifted turns (content differs > threshold)
- No-op if everything matches

The reconcile function lives in voice.router and is unit-testable without
HTTP / signature verification.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock


# ─────────────────────────────────────────────────────────────────────────────
# Helper: parse the canonical transcript string into structured turns.
# ─────────────────────────────────────────────────────────────────────────────


def test_parse_transcript_canonical_handles_user_ai_format():
    """Default ElevenLabs format: 'User: ...\\nAI: ...\\nUser: ...'."""
    from voice.router import parse_transcript_canonical

    transcript = "User: Bonjour\nAI: Salut !\nUser: Ça va ?"
    turns = parse_transcript_canonical(transcript)
    assert len(turns) == 3
    assert turns[0]["speaker"] == "user"
    assert turns[0]["content"] == "Bonjour"
    assert turns[1]["speaker"] == "agent"
    assert turns[1]["content"] == "Salut !"
    assert turns[2]["speaker"] == "user"


def test_parse_transcript_canonical_accepts_assistant_label():
    """ElevenLabs sometimes uses 'Assistant:' instead of 'AI:'."""
    from voice.router import parse_transcript_canonical

    transcript = "User: hi\nAssistant: hello"
    turns = parse_transcript_canonical(transcript)
    assert len(turns) == 2
    assert turns[1]["speaker"] == "agent"


def test_parse_transcript_canonical_returns_empty_on_none():
    from voice.router import parse_transcript_canonical

    assert parse_transcript_canonical(None) == []
    assert parse_transcript_canonical("") == []
    assert parse_transcript_canonical("   ") == []


def test_parse_transcript_canonical_strips_empty_lines():
    from voice.router import parse_transcript_canonical

    transcript = "\n\nUser: hi\n\nAI: hello\n\n"
    turns = parse_transcript_canonical(transcript)
    assert len(turns) == 2


def test_parse_transcript_canonical_supports_list_payload():
    """ElevenLabs newer payloads: payload.transcript is already a list of dicts."""
    from voice.router import parse_transcript_canonical

    payload_list = [
        {"role": "user", "message": "first"},
        {"role": "agent", "message": "second"},
    ]
    turns = parse_transcript_canonical(payload_list)
    assert len(turns) == 2
    assert turns[0]["speaker"] == "user"
    assert turns[0]["content"] == "first"
    assert turns[1]["speaker"] == "agent"


# ─────────────────────────────────────────────────────────────────────────────
# Drift detection — float-based metric (SequenceMatcher).
# ─────────────────────────────────────────────────────────────────────────────


def test_drift_ratio_identical_returns_zero():
    from voice.router import _content_drift_ratio

    assert _content_drift_ratio("foo", "foo") == 0.0


def test_drift_ratio_both_empty_returns_zero():
    from voice.router import _content_drift_ratio

    assert _content_drift_ratio("", "") == 0.0


def test_drift_ratio_one_empty_returns_one():
    from voice.router import _content_drift_ratio

    assert _content_drift_ratio("foo", "") == 1.0
    assert _content_drift_ratio("", "bar") == 1.0


def test_drift_ratio_catches_reordering():
    """Pure length-diff would return 0 (same length), but SequenceMatcher catches
    the reordering — this is the key reason we use difflib instead of length-only.
    """
    from voice.router import _content_drift_ratio

    drift = _content_drift_ratio("hello world", "world hello")
    assert drift > 0.0  # Not identical despite same length.
    assert drift < 1.0


def test_drift_ratio_minor_edit_below_threshold():
    """Minor punctuation edit → drift well under 30%."""
    from voice.router import _content_drift_ratio, _VOICE_TRANSCRIPT_DRIFT_THRESHOLD

    drift = _content_drift_ratio("Hello there!", "Hello there")
    assert drift < _VOICE_TRANSCRIPT_DRIFT_THRESHOLD


def test_drift_ratio_major_change_above_threshold():
    """Substantial expansion → drift well above 30%."""
    from voice.router import _content_drift_ratio, _VOICE_TRANSCRIPT_DRIFT_THRESHOLD

    drift = _content_drift_ratio(
        "Hello there!",
        "Hello there, my friend, how are you doing today?",
    )
    assert drift > _VOICE_TRANSCRIPT_DRIFT_THRESHOLD


def test_drift_threshold_is_thirty_percent():
    """Spec #1 Task 8: drift threshold must be 30% (was 10% — too noisy)."""
    from voice.router import _VOICE_TRANSCRIPT_DRIFT_THRESHOLD

    assert _VOICE_TRANSCRIPT_DRIFT_THRESHOLD == 0.30


# ─────────────────────────────────────────────────────────────────────────────
# Drift detection — bool wrapper used by reconcile loop.
# ─────────────────────────────────────────────────────────────────────────────


def test_drift_above_threshold_returns_true():
    """Two strings differing substantially → drift detected."""
    from voice.router import _content_drift_above_threshold

    a = "Hello there!"
    b = "Hello there, my friend, how are you doing today?"
    assert _content_drift_above_threshold(a, b) is True


def test_drift_below_threshold_returns_false():
    """Two strings nearly identical → no drift (e.g. trailing punctuation)."""
    from voice.router import _content_drift_above_threshold

    a = "Hello there!"
    b = "Hello there"
    assert _content_drift_above_threshold(a, b) is False


def test_drift_identical_returns_false():
    from voice.router import _content_drift_above_threshold

    assert _content_drift_above_threshold("foo", "foo") is False


# ─────────────────────────────────────────────────────────────────────────────
# Reconciliation logic.
# ─────────────────────────────────────────────────────────────────────────────


def _make_db_with_existing_rows(rows):
    """Build a stub AsyncSession returning the given existing rows on lookup."""
    db = AsyncMock()
    result = MagicMock()
    result.scalars = MagicMock()
    result.scalars.return_value = MagicMock(all=MagicMock(return_value=rows))
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()
    db.commit = AsyncMock()
    return db


def _make_existing_row(speaker, content, time_offset, msg_id=1):
    from db.database import ChatMessage

    m = MagicMock(spec=ChatMessage)
    m.id = msg_id
    m.role = "user" if speaker == "user" else "assistant"
    m.content = content
    m.voice_speaker = speaker
    m.time_in_call_secs = time_offset
    m.source = "voice"
    return m


@pytest.mark.asyncio
async def test_reconcile_inserts_missing_turns():
    """Existing has 1 turn, canonical has 3 → INSERT 2 missing."""
    from voice.router import _reconcile_voice_transcript

    existing = [_make_existing_row("user", "Bonjour", 0.0, msg_id=10)]
    db = _make_db_with_existing_rows(existing)

    canonical = [
        {"speaker": "user", "content": "Bonjour"},
        {"speaker": "agent", "content": "Salut !"},
        {"speaker": "user", "content": "Ça va ?"},
    ]

    result = await _reconcile_voice_transcript(
        db,
        voice_session_id="sess_1",
        user_id=7,
        summary_id=42,
        canonical_turns=canonical,
    )

    assert result["inserted"] == 2
    assert result["updated"] == 0
    assert db.add.call_count == 2
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_reconcile_updates_drifted_turns():
    """Existing differs from canonical above the threshold → UPDATE existing.content."""
    from voice.router import _reconcile_voice_transcript

    drifted = _make_existing_row("user", "He", 0.0, msg_id=11)
    existing = [drifted]
    db = _make_db_with_existing_rows(existing)

    canonical = [
        {"speaker": "user", "content": "Hello there my friend!"},
    ]

    result = await _reconcile_voice_transcript(
        db,
        voice_session_id="sess_1",
        user_id=7,
        summary_id=None,
        canonical_turns=canonical,
    )

    assert result["updated"] == 1
    assert result["inserted"] == 0
    # The mock's content attribute should have been updated.
    assert drifted.content == "Hello there my friend!"
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_reconcile_noop_when_everything_matches():
    """Existing == canonical → no INSERT, no UPDATE, no commit needed."""
    from voice.router import _reconcile_voice_transcript

    existing = [
        _make_existing_row("user", "Hello", 0.0, msg_id=20),
        _make_existing_row("agent", "Hi there!", 1.5, msg_id=21),
    ]
    db = _make_db_with_existing_rows(existing)

    canonical = [
        {"speaker": "user", "content": "Hello"},
        {"speaker": "agent", "content": "Hi there!"},
    ]

    result = await _reconcile_voice_transcript(
        db,
        voice_session_id="sess_2",
        user_id=8,
        summary_id=None,
        canonical_turns=canonical,
    )

    assert result["inserted"] == 0
    assert result["updated"] == 0
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_reconcile_skips_when_canonical_empty():
    """No canonical turns → do nothing (no DB writes)."""
    from voice.router import _reconcile_voice_transcript

    existing = [_make_existing_row("user", "x", 0.0, msg_id=30)]
    db = _make_db_with_existing_rows(existing)

    result = await _reconcile_voice_transcript(
        db,
        voice_session_id="sess_3",
        user_id=9,
        summary_id=None,
        canonical_turns=[],
    )

    assert result["inserted"] == 0
    assert result["updated"] == 0
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_reconcile_inserted_rows_carry_voice_metadata():
    """Newly inserted rows must have source='voice' + voice_session_id set."""
    from voice.router import _reconcile_voice_transcript
    from db.database import ChatMessage

    db = _make_db_with_existing_rows([])
    canonical = [
        {"speaker": "agent", "content": "first turn missed by frontend"},
    ]

    await _reconcile_voice_transcript(
        db,
        voice_session_id="sess_4",
        user_id=10,
        summary_id=99,
        canonical_turns=canonical,
    )

    db.add.assert_called_once()
    inserted = db.add.call_args.args[0]
    assert isinstance(inserted, ChatMessage)
    assert inserted.user_id == 10
    assert inserted.summary_id == 99
    assert inserted.role == "assistant"
    assert inserted.source == "voice"
    assert inserted.voice_session_id == "sess_4"
    assert inserted.voice_speaker == "agent"


@pytest.mark.asyncio
async def test_reconcile_idempotent():
    """Running reconcile twice produces the same DB state — second call is a no-op.

    Spec #1 Task 8 requires idempotency: the webhook may be retried by
    ElevenLabs (network blip, 5xx from us), and we must not duplicate rows
    or re-UPDATE on the second run. The contract: 1st call inserts N rows;
    2nd call (same canonical, same DB state) inserts 0 and updates 0.
    """
    from voice.router import _reconcile_voice_transcript
    from db.database import ChatMessage

    canonical = [
        {"speaker": "user", "content": "Bonjour"},
        {"speaker": "agent", "content": "Salut, comment puis-je aider ?"},
        {"speaker": "user", "content": "Quelle heure est-il ?"},
    ]

    # ── 1st call: empty DB → INSERT all 3 turns ──────────────────────────
    db_first = _make_db_with_existing_rows([])
    first = await _reconcile_voice_transcript(
        db_first,
        voice_session_id="sess_idem",
        user_id=1,
        summary_id=42,
        canonical_turns=canonical,
    )
    assert first["inserted"] == 3
    assert first["updated"] == 0
    assert db_first.add.call_count == 3

    # Capture the rows the first call would have committed — these become
    # the "already-persisted" state for the second call.
    persisted_rows = []
    for idx, call_args in enumerate(db_first.add.call_args_list):
        added: ChatMessage = call_args.args[0]
        # Build a MagicMock mirror so the second call's reconcile loop sees
        # the same content / speaker layout it would have on a real DB.
        speaker = added.voice_speaker
        persisted_rows.append(_make_existing_row(speaker, added.content, None, msg_id=100 + idx))

    # ── 2nd call: DB now reflects the first call's writes → no-op ────────
    db_second = _make_db_with_existing_rows(persisted_rows)
    second = await _reconcile_voice_transcript(
        db_second,
        voice_session_id="sess_idem",
        user_id=1,
        summary_id=42,
        canonical_turns=canonical,
    )
    assert second["inserted"] == 0, "2nd reconcile must not re-insert"
    assert second["updated"] == 0, "2nd reconcile must not re-update unchanged rows"
    db_second.add.assert_not_called()
    db_second.commit.assert_not_awaited()
