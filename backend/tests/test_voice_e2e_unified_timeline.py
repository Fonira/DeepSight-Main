"""
End-to-end backend test for Spec #1 — unified text+voice timeline flow.

Plan Task 12: cover the full happy path that the frontend exercises:

  1. (Pre-existing chat history seeded directly in DB)
  2. /transcripts/append × N (live during the call)
  3. /webhook arrives → reconciliation INSERTs missing turns + UPDATEs drift
  4. get_chat_history returns a single chronological list (text + voice mixed)
     with all the expected metadata fields populated.

The test uses a real SQLite in-memory database with the same SQLAlchemy
models the production app uses. We exercise the *logic* of the endpoints
(``append_transcript``, ``_reconcile_voice_transcript``,
``get_chat_history``) directly — bypassing FastAPI HTTP / auth — so the
test is fast and deterministic but still verifies wire-up between layers.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from unittest.mock import AsyncMock, MagicMock, patch


@pytest_asyncio.fixture
async def memory_db():
    """Spin up an SQLite in-memory DB with the relevant tables."""
    from db.database import Base, User, Summary, VoiceSession, ChatMessage

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        # Seed: one user, one summary, one voice session.
        u = User(
            id=42,
            username="alice",
            email="alice@example.com",
            password_hash="x",
            plan="pro",
            is_admin=False,
        )
        session.add(u)
        await session.commit()

        s = Summary(id=99, user_id=42, video_id="vid_xyz", video_title="A video")
        session.add(s)
        await session.commit()

        vs = VoiceSession(
            id="sess_e2e",
            user_id=42,
            summary_id=99,
            status="active",
        )
        session.add(vs)

        # Pre-existing chat history (text mode).
        session.add(
            ChatMessage(
                user_id=42, summary_id=99,
                role="user", content="Question texte avant l'appel",
                source="text",
            )
        )
        session.add(
            ChatMessage(
                user_id=42, summary_id=99,
                role="assistant", content="Réponse texte avant l'appel",
                source="text",
            )
        )
        await session.commit()

    async with SessionLocal() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_e2e_unified_timeline_append_then_webhook_reconcile(memory_db):
    """Full happy-path flow: append × 2, webhook with extra canonical turn,
    final history reflects both live appends and the reconciled missing turn."""
    from voice.router import (
        append_transcript,
        _reconcile_voice_transcript,
        parse_transcript_canonical,
        _transcript_append_counts,
    )
    from voice.schemas import TranscriptAppendRequest
    from chat.service import get_chat_history

    _transcript_append_counts.clear()

    user = MagicMock()
    user.id = 42

    # ── 1. Frontend appends two voice turns during the call ──────────────
    with patch("voice.router._redis_incr_with_ttl", new=AsyncMock(return_value=None)):
        await append_transcript(
            TranscriptAppendRequest(
                voice_session_id="sess_e2e",
                speaker="user",
                content="Bonjour je teste",
                time_in_call_secs=2.0,
            ),
            current_user=user,
            db=memory_db,
        )
        await append_transcript(
            TranscriptAppendRequest(
                voice_session_id="sess_e2e",
                speaker="agent",
                content="Bonjour, comment puis-je aider ?",
                time_in_call_secs=4.5,
            ),
            current_user=user,
            db=memory_db,
        )

    # ── 2. Webhook arrives with the canonical transcript including a
    # third turn that the frontend dropped on a flaky network ──────────
    canonical_str = (
        "User: Bonjour je teste\n"
        "AI: Bonjour, comment puis-je aider ?\n"
        "User: Et bien je veux savoir l'heure"
    )
    canonical_turns = parse_transcript_canonical(canonical_str)
    assert len(canonical_turns) == 3

    report = await _reconcile_voice_transcript(
        memory_db,
        voice_session_id="sess_e2e",
        user_id=42,
        summary_id=99,
        canonical_turns=canonical_turns,
    )
    assert report["inserted"] == 1
    assert report["updated"] == 0

    # ── 3. get_chat_history returns the unified, chronologically-ordered
    # timeline with both text rows (pre-call) and voice rows (during call
    # + reconciled). The voice rows carry the full metadata. ─────────────
    history = await get_chat_history(memory_db, summary_id=99, user_id=42, limit=50)

    # 2 text rows + 2 appended voice rows + 1 reconciled voice row = 5.
    assert len(history) == 5

    voice_rows = [m for m in history if m.get("source") == "voice"]
    text_rows = [m for m in history if m.get("source") == "text"]
    assert len(voice_rows) == 3
    assert len(text_rows) == 2

    # All voice rows must carry voice_session_id + voice_speaker.
    for row in voice_rows:
        assert row["voice_session_id"] == "sess_e2e"
        assert row["voice_speaker"] in ("user", "agent")
        # role is the chat role mapping.
        assert row["role"] in ("user", "assistant")

    # The reconciled turn (last appended) is identifiable by content.
    assert any(
        "savoir l'heure" in row["content"] and row["voice_speaker"] == "user"
        for row in voice_rows
    )


@pytest.mark.asyncio
async def test_e2e_chat_quota_ignores_appended_voice_rows(memory_db):
    """check_chat_quota sees voice rows and must NOT count them.

    Seed plenty of voice rows then assert the quota check still permits
    one more text question.
    """
    from voice.router import append_transcript, _transcript_append_counts
    from voice.schemas import TranscriptAppendRequest
    from chat.service import check_chat_quota

    _transcript_append_counts.clear()

    user = MagicMock()
    user.id = 42

    # 50 voice turns from the user — would saturate the per-video quota
    # without the source='text' filter (free plan = 5 per video).
    with patch("voice.router._redis_incr_with_ttl", new=AsyncMock(return_value=None)):
        for i in range(50):
            await append_transcript(
                TranscriptAppendRequest(
                    voice_session_id="sess_e2e",
                    speaker="user",
                    content=f"voice turn {i}",
                    time_in_call_secs=float(i),
                ),
                current_user=user,
                db=memory_db,
            )

    can_ask, reason, info = await check_chat_quota(memory_db, user_id=42, summary_id=99)
    # video_used should remain 0 (only 'text' rows count); seeded text
    # rows have role='user' too, but role='user' source='text' = 1.
    assert info["video_used"] <= 1
    # Pro plan is unlimited per_video → can_ask=True regardless. The key
    # assertion is that voice rows are not counted.
    assert info["video_used"] != 50
