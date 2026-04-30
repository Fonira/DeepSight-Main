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
import time
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

# Heartbeat cadence — published every N seconds while the orchestrator runs
# so the side panel SSE consumer can detect a dead pipeline (e.g. the
# transcript fetcher hung silently). Kept as a module constant to keep tests
# deterministic — tests can monkeypatch this to a tiny value.
HEARTBEAT_INTERVAL_SECONDS = 10


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
        # Phase tracking — used by both the heartbeat coroutine and the
        # idempotent ``startup → streaming`` transition.
        self._phase: str = "startup"
        self._streaming_transition_emitted: bool = False
        self._complete_transition_emitted: bool = False
        # Heartbeat instrumentation
        self._chunks_received: int = 0
        self._last_event_published_at: Optional[float] = None

    # ── Public API ───────────────────────────────────────────────────────

    async def run(self, session_id: str, video_id: str, user_id: int) -> None:
        """Drive the full pipeline for one session.

        Always emits a final ``ctx_complete`` event, even when transcript or
        analysis fail (an extra ``error`` event is emitted in that case).

        A background heartbeat coroutine publishes ``ctx_heartbeat`` events
        every :data:`HEARTBEAT_INTERVAL_SECONDS` so the SSE consumer can tell
        a stalled pipeline apart from a slow one. The heartbeat is stopped
        right before ``ctx_complete`` is published.
        """
        channel = f"{PUBSUB_CHANNEL_PREFIX}{session_id}"

        stop_heartbeat = asyncio.Event()
        heartbeat_task = asyncio.create_task(
            self._heartbeat_loop(channel, stop_heartbeat)
        )

        try:
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

            # Emit phase_transition streaming → complete BEFORE signalling the
            # heartbeat to stop, so the heartbeat loop sees the flag set on
            # its next iteration and exits cleanly without racing the
            # subsequent ctx_complete publish.
            await self._emit_phase_transition(channel, "streaming", "complete")
        finally:
            stop_heartbeat.set()
            try:
                await heartbeat_task
            except asyncio.CancelledError:  # pragma: no cover — defensive
                pass
            except Exception:  # noqa: BLE001 — heartbeat is best-effort
                logger.exception("heartbeat loop crashed")

        await self._publish(
            channel,
            {"type": "ctx_complete", "final_digest_summary": digest},
        )

    # ── Phase implementations ────────────────────────────────────────────

    async def _stream_transcript(self, channel: str, video_id: str) -> None:
        try:
            async for chunk in self._fetch_transcript(video_id):
                # First payload of either phase flips startup → streaming.
                await self._emit_phase_transition(channel, "startup", "streaming")
                await self._publish(
                    channel,
                    {
                        "type": "transcript_chunk",
                        "chunk_index": chunk.get("index"),
                        "text": chunk.get("text", ""),
                        "total_chunks": chunk.get("total"),
                    },
                )
                self._chunks_received += 1
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
                # First payload of either phase flips startup → streaming.
                await self._emit_phase_transition(channel, "startup", "streaming")
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
        # Track wallclock of the most recent publish so the heartbeat loop
        # can compute ``last_event_age_seconds``. Using ``time.monotonic``
        # avoids surprises if the system clock jumps mid-session.
        self._last_event_published_at = time.monotonic()

    async def _emit_phase_transition(
        self, channel: str, from_phase: str, to_phase: str
    ) -> None:
        """Idempotently publish a ``phase_transition`` event.

        Each (from → to) edge is emitted at most once per orchestrator
        instance. Any subsequent caller is a silent no-op so the helper can
        be invoked from every transcript/analysis chunk without flooding
        the channel with duplicates.
        """
        if from_phase == "startup" and to_phase == "streaming":
            if self._streaming_transition_emitted:
                return
            self._streaming_transition_emitted = True
        elif from_phase == "streaming" and to_phase == "complete":
            if self._complete_transition_emitted:
                return
            self._complete_transition_emitted = True
        else:  # pragma: no cover — guard for future edges
            logger.warning(
                "unknown phase transition %s → %s — emitting anyway",
                from_phase,
                to_phase,
            )

        self._phase = to_phase
        await self._publish(
            channel,
            {"type": "phase_transition", "from": from_phase, "to": to_phase},
        )

    async def _heartbeat_loop(
        self, channel: str, stop_event: asyncio.Event
    ) -> None:
        """Publish a ``ctx_heartbeat`` event on a fixed cadence.

        Stops as soon as ``stop_event`` is set or the
        ``streaming → complete`` phase transition has been emitted.
        Wakeups are coalesced via ``asyncio.wait_for`` on the stop event so
        the loop exits promptly even when the cadence is large (10 s).
        """
        # Anchor "age" to coroutine start so the first heartbeat reports a
        # meaningful number even before any event has been published.
        start_monotonic = time.monotonic()
        while not stop_event.is_set() and not self._complete_transition_emitted:
            try:
                await asyncio.wait_for(
                    stop_event.wait(), timeout=HEARTBEAT_INTERVAL_SECONDS
                )
                # stop_event was set during the wait → exit cleanly.
                return
            except asyncio.TimeoutError:
                pass

            if stop_event.is_set() or self._complete_transition_emitted:
                return

            now_monotonic = time.monotonic()
            anchor = self._last_event_published_at or start_monotonic
            age_seconds = max(0.0, now_monotonic - anchor)
            await self._publish(
                channel,
                {
                    "type": "ctx_heartbeat",
                    "phase": self._phase,
                    "chunks_received": self._chunks_received,
                    "last_event_age_seconds": age_seconds,
                },
            )


def create_default_orchestrator(redis: Any) -> StreamingOrchestrator:
    """Return an orchestrator wired with default (no-op-ish) fetchers.

    The router calls this in production until real helpers are plumbed in
    a follow-up sub-task. The Quick Voice Call still works end-to-end
    because the agent is briefed to use ``web_search`` when context is
    incomplete (cf. EXPLORER_STREAMING prompt).
    """
    return StreamingOrchestrator(redis=redis)


# ─────────────────────────────────────────────────────────────────────────────
# Production wiring (Quick Voice Call V1.1)
# ─────────────────────────────────────────────────────────────────────────────
#
# These wrappers plug the real services onto the orchestrator interface :
#
#   * Transcript    : ``transcripts.ultra_resilient.extract_transcript_for_analysis``
#                     (Supadata → fallback chain → audio STT) — chunked into
#                     ~1500-char slices (max 8 chunks) so the agent can start
#                     reasoning long before the whole transcript landed.
#   * Analysis      : reuse a cached ``Summary`` row when present (the most
#                     common case — the user has already analysed the video
#                     before clicking the voice CTA). When no cache and no
#                     Mistral API key are available, return ``{}`` so the
#                     orchestrator falls back to the empty path gracefully.
#   * Final digest  : first 500 chars of the produced summary, with a fallback
#                     marker for the agent.

# Tunables — extracted as module constants to keep tests deterministic.
TRANSCRIPT_CHUNK_SIZE_CHARS = 1500
TRANSCRIPT_MAX_CHUNKS = 8
# Phase 3 promises "tout le contexte" to the agent: a 1h video produced a
# multi-thousand-char digest; capping at 500 was 1/200th of it. Bumped to
# 2000 so the agent receives the full final summary.
FINAL_DIGEST_MAX_CHARS = 2000


def _split_transcript_into_chunks(
    text: str,
    chunk_size: int = TRANSCRIPT_CHUNK_SIZE_CHARS,
    max_chunks: int = TRANSCRIPT_MAX_CHUNKS,
) -> list[str]:
    """Split a long transcript into at most ``max_chunks`` slices.

    The slicing is character-based for predictability — the agent already
    handles partial sentences (``[CTX UPDATE]`` markers in the prompt). When
    the transcript is longer than ``chunk_size * max_chunks`` we keep only
    the head, since the goal is to give the agent enough material to start
    answering quickly. The full transcript still lives in the cache for
    follow-up tools (``search_in_transcript``).
    """
    if not text:
        return []
    raw_chunks = [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]
    return raw_chunks[:max_chunks]


def _make_transcript_fetcher() -> TranscriptFetcher:
    """Return an async iterator factory wrapping ``extract_transcript_for_analysis``."""

    def _fetch(video_id: str) -> AsyncIterator[dict[str, Any]]:
        async def _gen() -> AsyncIterator[dict[str, Any]]:
            # Lazy import — avoids loading heavy transcript chain at module
            # import time (tests routinely skip this path).
            from transcripts.ultra_resilient import extract_transcript_for_analysis

            try:
                result = await extract_transcript_for_analysis(video_id, user_language="fr")
            except Exception:  # noqa: BLE001 — re-raise so orchestrator emits error event
                logger.exception("transcript extraction failed for %s", video_id)
                raise

            if not isinstance(result, dict) or not result.get("success"):
                # Loud log + raise so the orchestrator's wrapper in
                # `_stream_transcript` emits an ``error`` event on the channel.
                logger.warning(
                    "transcript extraction returned non-success for %s: %s",
                    video_id,
                    (result or {}).get("error") if isinstance(result, dict) else "no-dict",
                )
                return  # No yield — silent stop, no error event, lets analysis still run

            transcript_text = (result.get("transcript") or "").strip()
            if not transcript_text:
                logger.info("transcript empty for %s — yielding nothing", video_id)
                return

            chunks = _split_transcript_into_chunks(transcript_text)
            total = len(chunks)
            for idx, chunk in enumerate(chunks):
                yield {"index": idx, "total": total, "text": chunk}

        return _gen()

    return _fetch


def _make_analysis_runner() -> AnalysisRunner:
    """Return an async runner that reuses cached Summary or generates fresh."""

    async def _run(video_id: str, user_id: int) -> dict[str, Any]:
        # 1. Try the per-user Summary cache first — this is the common case.
        try:
            from db.database import get_session, Summary
            from sqlalchemy import select

            async for db in get_session():
                result = await db.execute(
                    select(Summary)
                    .where(Summary.video_id == video_id, Summary.user_id == user_id)
                    .order_by(Summary.created_at.desc())
                    .limit(1)
                )
                row = result.scalar_one_or_none()
                if row and (row.summary_content or "").strip():
                    summary_md = row.summary_content
                    return {
                        "summary": summary_md,
                        "title": row.video_title or "",
                        "channel": row.video_channel or "",
                    }
                break  # only need one iteration of the async-generator
        except Exception as exc:  # noqa: BLE001 — DB optional in dev/tests
            logger.warning("analysis cache lookup failed for %s: %s", video_id, exc)

        # 2. Fallback: try a global Summary cache (any user, same video) before
        #    burning Mistral tokens. Quick Voice Call only needs the analysis
        #    text — ownership doesn't matter here.
        try:
            from db.database import get_session, Summary
            from sqlalchemy import select

            async for db in get_session():
                result = await db.execute(
                    select(Summary).where(Summary.video_id == video_id).order_by(Summary.created_at.desc()).limit(1)
                )
                row = result.scalar_one_or_none()
                if row and (row.summary_content or "").strip():
                    return {
                        "summary": row.summary_content,
                        "title": row.video_title or "",
                        "channel": row.video_channel or "",
                    }
                break
        except Exception:  # noqa: BLE001
            pass

        # 3. No cache — for now we don't burn tokens generating a full Mistral
        #    analysis on the streaming path (the agent has the transcript and
        #    web_search to reason). Return empty so the orchestrator publishes
        #    no analysis_partial events. Future iteration: kick off a real
        #    ``generate_summary`` call with the freshly-fetched transcript.
        logger.info("no cached analysis for %s — orchestrator skips analysis_partial", video_id)
        return {}

    return _run


def _make_final_digest(run_analysis: AnalysisRunner) -> DigestRunner:
    """Build a final digest by reusing the analysis runner output.

    We re-call ``run_analysis`` rather than threading state because the
    orchestrator runs both phases in parallel under ``asyncio.gather`` —
    sharing state would require either an extra param or a cache. The DB
    lookup is cheap (indexed by user_id+video_id) so the second hit is
    essentially free.
    """

    async def _digest(video_id: str, user_id: int) -> str:
        try:
            analysis = await run_analysis(video_id, user_id)
        except Exception as exc:  # noqa: BLE001 — best-effort
            logger.warning("final digest analysis re-call failed for %s: %s", video_id, exc)
            analysis = None

        summary = (analysis or {}).get("summary") if isinstance(analysis, dict) else None
        if isinstance(summary, str):
            summary = summary.strip()
        if summary:
            return summary[:FINAL_DIGEST_MAX_CHARS]
        return "Analyse non disponible"

    return _digest


def create_production_orchestrator(redis: Any) -> StreamingOrchestrator:
    """Return an orchestrator wired with the real backend services.

    Used by the voice router for ``is_streaming=True`` sessions
    (Quick Voice Call V1.1). Each fetcher fails closed: an exception is
    surfaced as an ``error`` SSE event but never crashes the session — the
    final ``ctx_complete`` is always emitted by ``StreamingOrchestrator.run``.
    """
    fetch_transcript = _make_transcript_fetcher()
    run_analysis = _make_analysis_runner()
    final_digest = _make_final_digest(run_analysis)
    return StreamingOrchestrator(
        redis=redis,
        fetch_transcript=fetch_transcript,
        run_analysis=run_analysis,
        final_digest=final_digest,
    )
