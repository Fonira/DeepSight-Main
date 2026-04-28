"""End-to-end pipeline test for the Quick Voice Call (V1.1) streaming session.

Spec source: ``docs/superpowers/specs/2026-04-26-quick-voice-call-design.md``
section "d. Streaming orchestrator" + the V1.1 follow-up
``docs/superpowers/specs/2026-04-28-quick-voice-call-v1.1-fixes.md``.

Scope
-----
This test wires the **production** orchestrator factory
(``create_production_orchestrator``) end-to-end with mocked transcript +
analysis layers and a fake Redis pubsub, then asserts the full event
sequence published on ``voice:ctx:{session_id}``:

  1. ≥ 1 ``transcript_chunk`` event   (transcript split into chunks)
  2. ≥ 1 ``analysis_partial`` event   (one per Mistral section)
  3. exactly 1 ``ctx_complete`` event (final digest)

This complements the unit tests in ``test_streaming_orchestrator.py``
(which test the orchestrator in isolation with hand-crafted callables) by
exercising the real ``_make_transcript_fetcher`` / ``_make_analysis_runner``
wrappers — the layer most likely to drift when refactoring. It also doubles
as a regression net for the orchestrator-no-op root cause documented in the
V1.1 fixes spec.

Tests must NOT hit the real transcript chain, Mistral, or Redis: every
external dependency is patched.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ─────────────────────────────────────────────────────────────────────────────
# Fakes
# ─────────────────────────────────────────────────────────────────────────────


class FakeRedis:
    """Minimal Redis pubsub double — captures every ``publish`` call.

    The orchestrator only calls ``await redis.publish(channel, payload)``.
    We don't bother with ``pubsub()``/``subscribe()`` because the
    StreamingOrchestrator never reads from Redis itself (only the SSE
    endpoint does).
    """

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    async def publish(self, channel: str, data: str) -> int:
        self.calls.append((channel, data))
        return 1


class FakeSummaryRow:
    """Lightweight stand-in for ``db.database.Summary`` used by the
    cached-analysis branch in ``_make_analysis_runner``."""

    def __init__(
        self,
        summary_content: str,
        title: str = "Doctors panicking…",
        channel: str = "Health Channel",
    ) -> None:
        self.summary_content = summary_content
        self.video_title = title
        self.video_channel = channel


def _decode_events(redis: FakeRedis) -> list[dict[str, Any]]:
    """Decode the JSON payloads captured by FakeRedis into dicts."""
    return [json.loads(payload) for _channel, payload in redis.calls]


def _make_db_with_summary(summary_row: FakeSummaryRow) -> AsyncMock:
    """Build an async-context DB mock whose ``execute().scalar_one_or_none``
    returns ``summary_row``. Mirrors the SQLAlchemy 2.0 async pattern used in
    ``_make_analysis_runner``."""

    db = AsyncMock()
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none = MagicMock(return_value=summary_row)
    db.execute = AsyncMock(return_value=scalar_result)
    return db


async def _fake_get_session_factory(db: AsyncMock):
    """Return an async-generator-shaped object compatible with the orchestrator's
    ``async for db in get_session()`` consumption pattern."""

    async def _agen():
        yield db

    return _agen


# ─────────────────────────────────────────────────────────────────────────────
# Test
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_streaming_session_full_pipeline_publishes_events() -> None:
    """Run the production orchestrator end-to-end with mocked dependencies and
    verify the full event sequence on the pubsub channel.

    Pipeline mocked:
      * ``extract_transcript_for_analysis`` → 5000-char synthetic transcript
        (will be sliced into ~4 chunks by ``_split_transcript_into_chunks``)
      * Cached ``Summary`` row → triggers the cache hit branch in
        ``_make_analysis_runner``, producing one ``analysis_partial`` per
        section returned by the runner.
      * Fake Redis → captures every ``publish`` call.

    Asserts (per spec § c — streaming events) :
      * channel format is ``voice:ctx:{session_id}``
      * ≥ 1 transcript_chunk
      * ≥ 1 analysis_partial
      * exactly 1 ctx_complete (carries ``final_digest_summary``)
      * transcript chunk indices are 0-based and contiguous
      * total_chunks is constant across all transcript_chunk events
    """
    from voice.streaming_orchestrator import create_production_orchestrator

    session_id = "e2e-session-abc123"
    video_id = "kBX4WgajxW8"
    user_id = 42

    # ── 1. Build fake transcript (5000 chars) — split into 4 chunks at 1500c ──
    fake_transcript_text = ("benzodiazepines and dependence; " * 200)[:5000]
    fake_transcript_payload = {
        "success": True,
        "transcript": fake_transcript_text,
        "language": "fr",
    }

    # ── 2. Build fake cached Summary so analysis runner returns sections ─────
    fake_summary = FakeSummaryRow(
        summary_content=(
            "## Résumé\nLes benzodiazépines sont prescrites pour l'anxiété.\n\n"
            "## Points clés\n- A: dépendance physique\n- B: sevrage difficile\n"
        ),
        title="Doctors panicking about benzodiazepines",
        channel="Health Channel",
    )

    fake_db = _make_db_with_summary(fake_summary)
    fake_session_gen = await _fake_get_session_factory(fake_db)

    # ── 3. Patch the lazy imports inside the orchestrator's wrappers ─────────
    # ``extract_transcript_for_analysis`` is imported inside the async-gen, so
    # we patch it at its source module path.
    redis = FakeRedis()

    with patch(
        "transcripts.ultra_resilient.extract_transcript_for_analysis",
        new=AsyncMock(return_value=fake_transcript_payload),
    ), patch(
        "db.database.get_session",
        new=fake_session_gen,
    ):
        orchestrator = create_production_orchestrator(redis=redis)
        await orchestrator.run(
            session_id=session_id,
            video_id=video_id,
            user_id=user_id,
        )

    # ── 4. Decode + assert event sequence ────────────────────────────────────
    events = _decode_events(redis)

    # All events publish on the same per-session channel
    channels = {channel for channel, _payload in redis.calls}
    assert channels == {f"voice:ctx:{session_id}"}, (
        f"Expected single channel voice:ctx:{session_id}, got {channels!r}"
    )

    transcript_events = [e for e in events if e.get("type") == "transcript_chunk"]
    analysis_events = [e for e in events if e.get("type") == "analysis_partial"]
    complete_events = [e for e in events if e.get("type") == "ctx_complete"]

    # ≥ 1 transcript_chunk (5000 chars / 1500c chunk → 4 chunks expected)
    assert len(transcript_events) >= 1, (
        f"Expected ≥ 1 transcript_chunk event, got {len(transcript_events)}. "
        f"Full event log: {events!r}"
    )
    # 5000 chars at 1500-char chunks rounds up to ceil(5000/1500) = 4 chunks
    assert len(transcript_events) == 4, (
        f"5000-char transcript should produce 4 chunks of size 1500, "
        f"got {len(transcript_events)}"
    )

    # Chunk indices are 0-based, contiguous, and total_chunks is constant
    indices = [e["chunk_index"] for e in transcript_events]
    totals = {e["total_chunks"] for e in transcript_events}
    assert indices == list(range(len(transcript_events))), (
        f"transcript_chunk indices should be 0..N-1 contiguous, got {indices!r}"
    )
    assert totals == {len(transcript_events)}, (
        f"All transcript_chunk events should report the same total_chunks, "
        f"got {totals!r}"
    )

    # ≥ 1 analysis_partial — the cached summary produces summary/title/channel sections
    assert len(analysis_events) >= 1, (
        f"Expected ≥ 1 analysis_partial event, got 0. Full event log: {events!r}"
    )

    # Exactly 1 ctx_complete, with a non-empty final_digest_summary
    assert len(complete_events) == 1, (
        f"Expected exactly 1 ctx_complete event, got {len(complete_events)}. "
        f"Full event log: {events!r}"
    )
    digest = complete_events[0].get("final_digest_summary")
    assert isinstance(digest, str) and digest, (
        f"ctx_complete should carry a non-empty final_digest_summary string, "
        f"got {digest!r}"
    )

    # ctx_complete is the LAST event published (orchestrator contract)
    assert events[-1]["type"] == "ctx_complete", (
        f"ctx_complete must be the last published event, got order: "
        f"{[e['type'] for e in events]}"
    )
