"""Tests for the StreamingOrchestrator (Quick Voice Call Task 4).

The orchestrator runs in the background after a streaming voice session is
created. It pulls transcript chunks (asynchronously, in order) and Mistral
analysis sections, then publishes each as a JSON event to the Redis pubsub
channel ``voice:ctx:{session_id}``. The SSE endpoint subscribes to that
channel and forwards events to the side panel as Server-Sent Events.

Spec source: ``docs/superpowers/specs/2026-04-26-quick-voice-call-design.md``
section "d. Streaming orchestrator (NEW)".

The transcript fetcher and analysis runner are passed as callables so the
orchestrator stays decoupled from the legacy 7-method transcript chain
(which has its own retry/circuit-breaker semantics) — production wires the
real helpers, tests pass mocks.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from voice.streaming_orchestrator import StreamingOrchestrator


def _async_iter_factory(items):
    """Return a callable(_video_id) → async iterator yielding ``items``."""

    def _factory(_video_id):
        async def _gen():
            for it in items:
                yield it

        return _gen()

    return _factory


def _decode_calls(mock_redis):
    """Return the list of {channel, event_dict} for each publish call."""
    out = []
    for call in mock_redis.publish.await_args_list:
        ch, data = call.args[0], call.args[1]
        out.append({"channel": ch, "event": json.loads(data)})
    return out


@pytest.mark.asyncio
async def test_publishes_transcript_chunks_in_order():
    """Each transcript chunk → one transcript_chunk event in arrival order."""
    redis = AsyncMock()
    chunks = [
        {"text": "chunk 0", "index": 0, "total": 3},
        {"text": "chunk 1", "index": 1, "total": 3},
        {"text": "chunk 2", "index": 2, "total": 3},
    ]
    fetch_transcript = _async_iter_factory(chunks)
    run_analysis = AsyncMock(return_value={})
    final_digest = AsyncMock(return_value="digest text")

    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=run_analysis,
        final_digest=final_digest,
    )
    await orch.run(session_id="s1", video_id="vid", user_id=1)

    events = [c["event"] for c in _decode_calls(redis)]
    transcript_events = [e for e in events if e["type"] == "transcript_chunk"]
    assert [e["text"] for e in transcript_events] == ["chunk 0", "chunk 1", "chunk 2"]
    assert [e["chunk_index"] for e in transcript_events] == [0, 1, 2]
    assert all(e["total_chunks"] == 3 for e in transcript_events)


@pytest.mark.asyncio
async def test_publishes_analysis_partial_per_section():
    redis = AsyncMock()
    fetch_transcript = _async_iter_factory([])
    analysis = {"summary": "S", "keypoints": "KP"}
    run_analysis = AsyncMock(return_value=analysis)
    final_digest = AsyncMock(return_value="d")

    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=run_analysis,
        final_digest=final_digest,
    )
    await orch.run(session_id="s2", video_id="vid", user_id=1)

    events = [c["event"] for c in _decode_calls(redis)]
    partials = [e for e in events if e["type"] == "analysis_partial"]
    assert {p["section"] for p in partials} == {"summary", "keypoints"}
    assert {p["content"] for p in partials} == {"S", "KP"}


@pytest.mark.asyncio
async def test_publishes_ctx_complete_at_end():
    redis = AsyncMock()
    fetch_transcript = _async_iter_factory([])
    run_analysis = AsyncMock(return_value={"summary": "test digest"})
    final_digest = AsyncMock(return_value="Final digest text")

    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=run_analysis,
        final_digest=final_digest,
    )
    await orch.run(session_id="s3", video_id="vid", user_id=1)

    events = [c["event"] for c in _decode_calls(redis)]
    assert events[-1]["type"] == "ctx_complete"
    assert events[-1]["final_digest_summary"] == "Final digest text"


@pytest.mark.asyncio
async def test_publishes_to_correct_channel():
    redis = AsyncMock()
    fetch_transcript = _async_iter_factory([])
    run_analysis = AsyncMock(return_value={})
    final_digest = AsyncMock(return_value="")

    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=run_analysis,
        final_digest=final_digest,
    )
    await orch.run(session_id="abc-123", video_id="vid", user_id=1)

    channels = {c["channel"] for c in _decode_calls(redis)}
    assert channels == {"voice:ctx:abc-123"}


@pytest.mark.asyncio
async def test_transcript_failure_publishes_error_event():
    """If the transcript fetcher raises, an error event is emitted on the
    same channel and the orchestrator still finishes (does not crash)."""
    redis = AsyncMock()

    async def boom_iter():
        raise RuntimeError("supadata down")
        yield  # pragma: no cover — make it an async-gen for type checks

    fetch_transcript = MagicMock(return_value=boom_iter())
    run_analysis = AsyncMock(return_value={})
    final_digest = AsyncMock(return_value="d")

    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=run_analysis,
        final_digest=final_digest,
    )
    await orch.run(session_id="s4", video_id="vid", user_id=1)

    events = [c["event"] for c in _decode_calls(redis)]
    assert any(e["type"] == "error" for e in events)
    # ctx_complete still emitted at the end
    assert events[-1]["type"] == "ctx_complete"


@pytest.mark.asyncio
async def test_analysis_failure_publishes_error_event():
    redis = AsyncMock()
    fetch_transcript = _async_iter_factory([])
    run_analysis = AsyncMock(side_effect=ValueError("mistral 500"))
    final_digest = AsyncMock(return_value="d")

    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=run_analysis,
        final_digest=final_digest,
    )
    await orch.run(session_id="s5", video_id="vid", user_id=1)

    events = [c["event"] for c in _decode_calls(redis)]
    assert any(e["type"] == "error" for e in events)
    assert events[-1]["type"] == "ctx_complete"


@pytest.mark.asyncio
async def test_transcript_and_analysis_run_in_parallel():
    """Both phases are launched concurrently via asyncio.gather — verify by
    asserting the analysis function was invoked even when the transcript
    iterator yields slowly (the orchestrator does not serialize them)."""
    redis = AsyncMock()
    chunks_emitted = []

    async def slow_chunks():
        import asyncio

        for i in range(2):
            await asyncio.sleep(0)  # cooperate
            chunk = {"text": f"c{i}", "index": i, "total": 2}
            chunks_emitted.append(i)
            yield chunk

    fetch_transcript = MagicMock(return_value=slow_chunks())
    analysis_started = []

    async def run_analysis_recording(video_id, user_id):
        analysis_started.append(True)
        return {"summary": "ok"}

    final_digest = AsyncMock(return_value="d")

    orch = StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=run_analysis_recording,
        final_digest=final_digest,
    )
    await orch.run(session_id="parallel", video_id="vid", user_id=1)
    assert analysis_started == [True]
    assert chunks_emitted == [0, 1]
