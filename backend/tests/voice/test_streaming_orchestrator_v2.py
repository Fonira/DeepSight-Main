"""Tests for ``voice.streaming_orchestrator`` v2 — phase + heartbeat protocol.

The v2 orchestrator emits, in addition to the legacy ``transcript_chunk``
/ ``analysis_partial`` / ``ctx_complete`` events:

  * ``phase_transition`` (startup → streaming) on the FIRST published
    transcript or analysis chunk — idempotent;
  * ``phase_transition`` (streaming → complete) right before
    ``ctx_complete`` is published — idempotent;
  * ``ctx_heartbeat`` every ``HEARTBEAT_INTERVAL_SECONDS`` carrying
    ``phase``, ``chunks_received`` and ``last_event_age_seconds``.

The ``FINAL_DIGEST_MAX_CHARS`` cap was bumped from 500 → 2000 so the
agent receives the full final summary in phase complete.

Constants are re-imported per test so any future refactor that changes
the source of truth still trips a failure.
"""

from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator
from unittest.mock import AsyncMock, MagicMock

import pytest

from voice.streaming_orchestrator import (
    FINAL_DIGEST_MAX_CHARS,
    HEARTBEAT_INTERVAL_SECONDS,
    StreamingOrchestrator,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _async_iter_factory(items):
    """Return a callable(_video_id) → async iterator yielding ``items``."""

    def _factory(_video_id):
        async def _gen() -> AsyncIterator[dict]:
            for it in items:
                yield it

        return _gen()

    return _factory


def _decoded_events(mock_redis) -> list[dict]:
    """Return the JSON-decoded payload of every ``redis.publish`` call."""
    out = []
    for call in mock_redis.publish.await_args_list:
        _ch, data = call.args[0], call.args[1]
        out.append(json.loads(data))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Constants are pinned at the documented values
# ─────────────────────────────────────────────────────────────────────────────


def test_final_digest_max_chars_is_2000():
    """The new cap (was 500) is set to 2000 so the agent gets the full digest."""
    assert FINAL_DIGEST_MAX_CHARS == 2000


def test_heartbeat_interval_is_10s():
    """Heartbeat cadence is 10 seconds per the spec."""
    assert HEARTBEAT_INTERVAL_SECONDS == 10


# ─────────────────────────────────────────────────────────────────────────────
# phase_transition: startup → streaming (idempotent)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_emits_phase_transition_startup_to_streaming_once():
    """Even with 3 chunks, only ONE startup → streaming transition is emitted."""
    redis = AsyncMock()
    chunks = [
        {"text": "A", "index": 0, "total": 3},
        {"text": "B", "index": 1, "total": 3},
        {"text": "C", "index": 2, "total": 3},
    ]
    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=_async_iter_factory(chunks),
        run_analysis=AsyncMock(return_value={}),
        final_digest=AsyncMock(return_value="d"),
    )
    await orch.run(session_id="s-startup", video_id="vid", user_id=1)

    transitions = [
        e
        for e in _decoded_events(redis)
        if e.get("type") == "phase_transition"
        and e.get("from") == "startup"
        and e.get("to") == "streaming"
    ]
    assert len(transitions) == 1, (
        f"expected exactly one startup → streaming transition, got {len(transitions)}"
    )


@pytest.mark.asyncio
async def test_phase_transition_idempotent_on_multiple_chunks():
    """5 transcript chunks → still a single startup → streaming transition."""
    redis = AsyncMock()
    chunks = [{"text": str(i), "index": i, "total": 5} for i in range(5)]
    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=_async_iter_factory(chunks),
        run_analysis=AsyncMock(return_value={"summary": "S"}),
        final_digest=AsyncMock(return_value="d"),
    )
    await orch.run(session_id="s-idem", video_id="vid", user_id=1)

    transitions = [
        e
        for e in _decoded_events(redis)
        if e.get("type") == "phase_transition" and e.get("to") == "streaming"
    ]
    assert len(transitions) == 1


# ─────────────────────────────────────────────────────────────────────────────
# phase_transition: streaming → complete (idempotent + happens before ctx_complete)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_emits_phase_transition_streaming_to_complete_once():
    """Exactly one streaming → complete transition, emitted before ctx_complete."""
    redis = AsyncMock()
    chunks = [{"text": "x", "index": 0, "total": 1}]
    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=_async_iter_factory(chunks),
        run_analysis=AsyncMock(return_value={}),
        final_digest=AsyncMock(return_value="final"),
    )
    await orch.run(session_id="s-end", video_id="vid", user_id=1)

    events = _decoded_events(redis)
    transitions = [
        (i, e)
        for i, e in enumerate(events)
        if e.get("type") == "phase_transition"
        and e.get("from") == "streaming"
        and e.get("to") == "complete"
    ]
    assert len(transitions) == 1, "expected exactly one streaming → complete transition"

    # ``ctx_complete`` must come after the streaming → complete transition.
    transition_idx = transitions[0][0]
    completes = [i for i, e in enumerate(events) if e.get("type") == "ctx_complete"]
    assert completes, "ctx_complete must always be emitted"
    assert transition_idx < completes[-1], (
        "phase_transition (streaming → complete) must precede ctx_complete"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Heartbeat — best-effort: pause the cadence via monkeypatch
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_emits_heartbeat_during_streaming(monkeypatch):
    """At least one ctx_heartbeat is emitted when the pipeline lingers.

    We monkeypatch ``HEARTBEAT_INTERVAL_SECONDS`` to a sub-second value
    BEFORE constructing the orchestrator. The transcript fetcher sleeps a
    few cadence ticks while yielding a single chunk, which is enough for
    at least one heartbeat to fire.
    """
    # Speed the cadence up — must happen before _heartbeat_loop reads the
    # constant. The loop captures it via module-level lookup, so patching
    # the attribute on the module is what actually counts here.
    monkeypatch.setattr(
        "voice.streaming_orchestrator.HEARTBEAT_INTERVAL_SECONDS", 0.05
    )

    redis = AsyncMock()

    async def slow_chunks():
        # Sleep through several heartbeat ticks before yielding.
        await asyncio.sleep(0.25)
        yield {"text": "single", "index": 0, "total": 1}

    fetch_transcript = MagicMock(return_value=slow_chunks())

    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=AsyncMock(return_value={}),
        final_digest=AsyncMock(return_value="d"),
    )
    await orch.run(session_id="s-hb", video_id="vid", user_id=1)

    heartbeats = [
        e for e in _decoded_events(redis) if e.get("type") == "ctx_heartbeat"
    ]
    assert heartbeats, "expected at least one ctx_heartbeat during a slow run"
    # Each heartbeat must carry the 3 documented fields.
    for hb in heartbeats:
        assert "phase" in hb
        assert "chunks_received" in hb
        assert "last_event_age_seconds" in hb


# ─────────────────────────────────────────────────────────────────────────────
# A finalize event (ctx_complete OR ctx_failed) is always emitted —
# even on transcript failure. V2: ctx_failed when degraded.
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_still_emits_finalize_when_transcript_fails():
    """A crashing transcript fetcher does NOT prevent a finalize event.

    V2: when both transcript fails AND analysis is empty, the orchestrator
    emits ``ctx_failed`` (degraded) rather than ``ctx_complete`` so the agent
    falls back to pretrained + web_search transparently. The SSE consumer
    still gets a clean close signal either way.
    """
    redis = AsyncMock()

    async def boom_iter():
        raise RuntimeError("supadata 503")
        yield  # pragma: no cover — make it an async-gen syntactically

    fetch_transcript = MagicMock(return_value=boom_iter())

    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=AsyncMock(return_value={}),
        final_digest=AsyncMock(return_value="fallback digest"),
    )
    await orch.run(session_id="s-err", video_id="vid", user_id=1)

    events = _decoded_events(redis)
    assert events[-1].get("type") in {"ctx_complete", "ctx_failed"}, (
        "a finalize event (ctx_complete or ctx_failed) must close the stream"
    )
    # An ``error`` event must be present too — surface the failure to the SSE consumer.
    assert any(e.get("type") == "error" for e in events)
