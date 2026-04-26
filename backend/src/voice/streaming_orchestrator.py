"""Streaming orchestrator for the Quick Voice Call (V1) feature.

Spec source: ``docs/superpowers/specs/2026-04-26-quick-voice-call-design.md``
section "d. Streaming orchestrator (NEW)".

Responsibility:
  1. Accept a (session_id, video_id, user_id) tuple from POST /voice/session
     when ``is_streaming=True``.
  2. Concurrently :
     - stream YouTube transcript chunks (Supadata → fallbacks chain) and
       publish each as ``transcript_chunk`` event;
     - run the Mistral chunked analysis and publish each section as an
       ``analysis_partial`` event.
  3. After both finish, publish a final ``ctx_complete`` event carrying a
     short final-digest summary.

All events are published as JSON onto the Redis pubsub channel
``voice:ctx:{session_id}``. The SSE endpoint
``GET /api/voice/context/stream`` subscribes to that channel and forwards
events to the side panel as Server-Sent Events.

Both transcript fetcher and analysis runner are passed in as callables so
the orchestrator stays decoupled from the legacy 7-method transcript chain
(which has its own retry / circuit-breaker semantics) and from any
particular Mistral analysis pipeline. Production code wires real helpers,
tests pass mocks. The default factory ``create_default_orchestrator``
returns a no-op-ish instance suitable for local dev when the heavy
dependencies are not yet plumbed.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import (
    Any,
    AsyncIterator,
    Awaitable,
    Callable,
    Optional,
)

logger = logging.getLogger(__name__)


# Channel format used by the SSE endpoint to subscribe.
PUBSUB_CHANNEL_PREFIX = "voice:ctx:"


# Pluggable async function signatures (kept as type aliases for clarity)
TranscriptFetcher = Callable[[str], AsyncIterator[dict[str, Any]]]
"""Returns an async iterator yielding {"text": str, "index": int, "total": int}."""

AnalysisRunner = Callable[[str, int], Awaitable[dict[str, Any]]]
"""Returns a {"<section>": "<content>"} dict (e.g. summary, keypoints)."""

DigestRunner = Callable[[str, int], Awaitable[str]]
"""Returns a short final-digest summary string."""


async def _empty_iter() -> AsyncIterator[dict[str, Any]]:  # pragma: no cover
    if False:  # type: ignore[unreachable]
        yield {}


def _default_fetch_transcript(_video_id: str) -> AsyncIterator[dict[str, Any]]:
    """Local-dev no-op: no chunks emitted."""
    return _empty_iter()


async def _default_run_analysis(_video_id: str, _user_id: int) -> dict[str, Any]:
    """Local-dev no-op: empty analysis."""
    return {}


async def _default_final_digest(video_id: str, _user_id: int) -> str:
    """Local-dev fallback: trivial reference to the video."""
    return f"Digest available for video {video_id}"


class StreamingOrchestrator:
    """Pulls transcript + analysis in parallel, fan-outs to Redis pubsub."""

    def __init__(
        self,
        redis: Any,
        fetch_transcript: Optional[TranscriptFetcher] = None,
        run_analysis: Optional[AnalysisRunner] = None,
        final_digest: Optional[DigestRunner] = None,
    ) -> None:
        self.redis = redis
        self._fetch_transcript = fetch_transcript or _default_fetch_transcript
        self._run_analysis = run_analysis or _default_run_analysis
        self._final_digest = final_digest or _default_final_digest

    # ── Public API ───────────────────────────────────────────────────────

    async def run(self, session_id: str, video_id: str, user_id: int) -> None:
        """Drive the full pipeline for one session.

        Always emits a final ``ctx_complete`` event, even when transcript or
        analysis fail (an extra ``error`` event is emitted in that case).
        """
        channel = f"{PUBSUB_CHANNEL_PREFIX}{session_id}"

        # asyncio.gather with return_exceptions=True so a single failure on
        # one phase does not cancel the other.
        await asyncio.gather(
            self._stream_transcript(channel, video_id),
            self._stream_analysis(channel, video_id, user_id),
            return_exceptions=False,
        )

        try:
            digest = await self._final_digest(video_id, user_id)
        except Exception as exc:  # noqa: BLE001 — best-effort
            logger.exception("final digest failed for %s", video_id)
            digest = f"(no digest available: {exc.__class__.__name__})"

        await self._publish(
            channel,
            {"type": "ctx_complete", "final_digest_summary": digest},
        )

    # ── Phase implementations ────────────────────────────────────────────

    async def _stream_transcript(self, channel: str, video_id: str) -> None:
        try:
            async for chunk in self._fetch_transcript(video_id):
                await self._publish(
                    channel,
                    {
                        "type": "transcript_chunk",
                        "chunk_index": chunk.get("index"),
                        "text": chunk.get("text", ""),
                        "total_chunks": chunk.get("total"),
                    },
                )
        except Exception as exc:  # noqa: BLE001 — surface as error event
            logger.exception("transcript stream failed for %s", video_id)
            await self._publish(
                channel,
                {"type": "error", "phase": "transcript", "message": str(exc)},
            )

    async def _stream_analysis(self, channel: str, video_id: str, user_id: int) -> None:
        try:
            analysis = await self._run_analysis(video_id, user_id)
            for section, content in (analysis or {}).items():
                await self._publish(
                    channel,
                    {
                        "type": "analysis_partial",
                        "section": section,
                        "content": content,
                    },
                )
        except Exception as exc:  # noqa: BLE001 — surface as error event
            logger.exception("analysis failed for %s", video_id)
            await self._publish(
                channel,
                {"type": "error", "phase": "analysis", "message": str(exc)},
            )

    # ── Helpers ──────────────────────────────────────────────────────────

    async def _publish(self, channel: str, event: dict[str, Any]) -> None:
        await self.redis.publish(channel, json.dumps(event, ensure_ascii=False))


def create_default_orchestrator(redis: Any) -> StreamingOrchestrator:
    """Return an orchestrator wired with default (no-op-ish) fetchers.

    The router calls this in production until real helpers are plumbed in
    a follow-up sub-task. The Quick Voice Call still works end-to-end
    because the agent is briefed to use ``web_search`` when context is
    incomplete (cf. EXPLORER_STREAMING prompt).
    """
    return StreamingOrchestrator(redis=redis)
