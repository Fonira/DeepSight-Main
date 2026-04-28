"""Wire analysis-section streaming + final digest into the StreamingOrchestrator.

Used by Quick Voice Call mobile V3 : after the user pastes a video URL and the
voice session starts, the main analysis pipeline (videos/router.py) runs in
parallel. This module polls the Summary's ``full_digest`` and exposes its
sections to the orchestrator, which in turn publishes them as
``analysis_partial`` Redis pubsub events.

Both ``run_for_video`` and ``final_digest_for_video`` match the
``AnalysisRunner`` / ``DigestRunner`` type aliases from
``streaming_orchestrator.py``.

The internal helpers ``_query_summary``, ``_load_summary_with_full_digest``
and the constants ``_POLL_INTERVAL_SECS`` / ``_POLL_TIMEOUT_SECS`` are kept
at module level so unit tests can monkeypatch them without touching the real
DB session machinery.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary, async_session_maker

logger = logging.getLogger(__name__)

# Polling cadence : the main analysis pipeline (videos/router.py) typically
# completes in 10-40s for short YT videos, up to 90s+ for long ones. We poll
# every 2s and time out at 60s — past that the orchestrator falls back to an
# empty analysis dict and the agent uses ``web_search`` instead.
_POLL_INTERVAL_SECS = 2.0
_POLL_TIMEOUT_SECS = 60.0

# Per-section caps to keep analysis_partial events under Redis pubsub /
# ElevenLabs context-window limits.
_MAX_SECTION_CHARS = 1500
_MAX_KEYPOINTS_ITEMS = 10
_MAX_SOURCES_ITEMS = 5
_MAX_DIGEST_CHARS = 1000


async def _query_summary(
    video_id: str, user_id: int, db: AsyncSession
) -> Optional[Summary]:
    """One-shot query for the latest Summary matching ``(video_id, user_id)``.

    Returns the most recent row (highest ``id``) so retries / re-analyses pick
    the freshest record. Kept as a separate function so polling tests can
    monkeypatch it without spinning up a real DB.
    """
    result = await db.execute(
        select(Summary)
        .where(Summary.video_id == video_id, Summary.user_id == user_id)
        .order_by(Summary.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _load_summary_with_full_digest(
    video_id: str, user_id: int
) -> Optional[Summary]:
    """Poll the DB until ``Summary.full_digest`` is populated, or timeout.

    Returns ``None`` if the Summary never appears or never gets a full_digest
    within ``_POLL_TIMEOUT_SECS`` — caller is expected to gracefully fall back.
    """
    deadline = asyncio.get_event_loop().time() + _POLL_TIMEOUT_SECS
    async with async_session_maker() as db:
        while True:
            summary = await _query_summary(video_id, user_id, db)
            if summary is not None and summary.full_digest:
                return summary
            if asyncio.get_event_loop().time() >= deadline:
                return None
            await asyncio.sleep(_POLL_INTERVAL_SECS)


def _coerce_digest_to_dict(raw: Any) -> dict[str, Any]:
    """Normalize the ``full_digest`` column value to a dict.

    Production stores ``full_digest`` as ``Text`` — sometimes plain Mistral
    text, sometimes a JSON-encoded blob (see ``chat/context_builder.py:444``).
    Unit tests pass a dict directly. We accept both shapes.
    """
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {"summary": raw}
        if isinstance(parsed, dict):
            return parsed
        return {"summary": str(parsed)}
    return {}


def _serialize_keypoints(keypoints: Any) -> str:
    if isinstance(keypoints, list):
        items = [str(kp) for kp in keypoints[:_MAX_KEYPOINTS_ITEMS]]
        return "\n".join(f"- {kp}" for kp in items)
    return str(keypoints)[:_MAX_SECTION_CHARS]


def _serialize_sources(sources: Any) -> str:
    if isinstance(sources, list):
        parts: list[str] = []
        for src in sources[:_MAX_SOURCES_ITEMS]:
            if isinstance(src, dict):
                title = src.get("title") or src.get("url") or ""
                parts.append(f"- {title}")
            else:
                parts.append(f"- {src}")
        return "\n".join(parts)
    return str(sources)[:_MAX_SECTION_CHARS]


def _serialize_sections(digest: dict[str, Any]) -> dict[str, str]:
    """Convert the parsed digest into a flat ``{section: str}`` dict.

    Keys correspond to the ``[CTX UPDATE: analysis - <section>]`` SSE events
    the orchestrator emits (see streaming_orchestrator._stream_analysis).
    """
    result: dict[str, str] = {}
    if (summary_text := digest.get("summary")) is not None:
        result["summary"] = str(summary_text)[:_MAX_SECTION_CHARS]
    if (keypoints := digest.get("keypoints")) is not None:
        result["keypoints"] = _serialize_keypoints(keypoints)
    if (sources := digest.get("sources")) is not None:
        result["sources"] = _serialize_sources(sources)
    return result


async def run_for_video(video_id: str, user_id: int) -> dict[str, Any]:
    """Return a flat ``{section: content}`` dict for the orchestrator to publish.

    Returns an empty dict if the Summary is never found within the polling
    timeout — the orchestrator simply skips ``analysis_partial`` events and
    the agent uses ``web_search`` as fallback.
    """
    summary = await _load_summary_with_full_digest(video_id, user_id)
    if summary is None or not summary.full_digest:
        logger.info(
            "analysis_runner: no Summary.full_digest for video_id=%s user_id=%s",
            video_id,
            user_id,
        )
        return {}
    digest = _coerce_digest_to_dict(summary.full_digest)
    return _serialize_sections(digest)


async def final_digest_for_video(video_id: str, user_id: int) -> str:
    """Return a compact final digest string for ``[CTX COMPLETE]``.

    Falls back to a French human-readable hint when no analysis is available
    so the agent (and any downstream consumer) never receives an empty string.
    """
    summary = await _load_summary_with_full_digest(video_id, user_id)
    if summary is None or not summary.full_digest:
        return "Analyse non disponible — l'agent peut utiliser web_search"
    digest = _coerce_digest_to_dict(summary.full_digest)
    summary_text = digest.get("summary")
    if summary_text:
        return str(summary_text)[:_MAX_DIGEST_CHARS]
    # No "summary" key but digest exists — best-effort string representation.
    return (str(digest) if digest else "Analyse partielle")[:_MAX_DIGEST_CHARS]
