"""Adapter for fetching video transcripts and chunking them for the
StreamingOrchestrator's TranscriptFetcher contract.

Used by the Quick Voice Call mobile V3 flow : router parses the user-pasted
video_url, this module dispatches to the existing transcript fetchers in
``transcripts.youtube`` and ``transcripts.tiktok``, then yields fixed-size
chunks for streaming via Redis pubsub to the ElevenLabs agent.

The module-level helpers ``_fetch_youtube`` and ``_fetch_tiktok`` are kept
as plain ``async def`` (not closures) so unit tests can monkeypatch them
without touching the heavy real implementations.
"""
from __future__ import annotations

import logging
from typing import AsyncIterator

from voice.url_validator import parse_video_url

logger = logging.getLogger(__name__)

CHUNK_SIZE_CHARS = 3000


async def _fetch_youtube(video_id: str) -> str:
    """Fetch full YouTube transcript via ``transcripts.youtube``.

    Wraps :func:`transcripts.youtube.get_transcript_with_timestamps` which
    returns ``(simple_text, timestamped_text, lang)``. We only need the
    plain text for the voice agent's context window.

    Returns an empty string on failure (orchestrator gracefully emits no
    chunks; agent uses ``web_search`` as fallback).
    """
    try:
        from transcripts.youtube import get_transcript_with_timestamps
        simple, _timestamped, _lang = await get_transcript_with_timestamps(video_id)
        return simple or ""
    except Exception as exc:  # noqa: BLE001 — best-effort fetcher
        logger.warning("YouTube transcript fetch failed for %s: %s", video_id, exc)
        return ""


async def _fetch_tiktok(video_id: str) -> str:
    """Fetch full TikTok transcript via ``transcripts.tiktok``.

    The real ``get_tiktok_transcript`` requires the full URL (used for
    yt-dlp downloads). We rebuild a canonical URL from the video_id —
    TikTok accepts the ``/v/<id>`` form as a valid video URL that
    yt-dlp/Supadata can resolve.

    Returns an empty string on failure.
    """
    try:
        from transcripts.tiktok import get_tiktok_transcript
        canonical_url = f"https://www.tiktok.com/v/{video_id}"
        simple, _timestamped, _lang = await get_tiktok_transcript(
            canonical_url, video_id=video_id
        )
        return simple or ""
    except Exception as exc:  # noqa: BLE001 — best-effort fetcher
        logger.warning("TikTok transcript fetch failed for %s: %s", video_id, exc)
        return ""


async def fetch_for_video_url(video_url: str) -> AsyncIterator[dict]:
    """Dispatch by platform, fetch full transcript, yield chunks ~3000 chars.

    Each chunk matches StreamingOrchestrator's ``TranscriptFetcher`` contract :
    ``{"index": int, "total": int, "text": str}``.

    Args:
        video_url: A YouTube or TikTok URL (validated via
            :func:`voice.url_validator.parse_video_url`).

    Yields:
        Per-chunk dict for the orchestrator to publish on the
        ``voice:ctx:{session_id}`` Redis pubsub channel.

    Raises:
        ValueError: If the URL doesn't match either platform (re-raised
            from ``parse_video_url`` with ``"non supportée"`` message).
    """
    platform, video_id = parse_video_url(video_url)

    if platform == "youtube":
        full = await _fetch_youtube(video_id)
    elif platform == "tiktok":
        full = await _fetch_tiktok(video_id)
    else:  # pragma: no cover — parse_video_url is exhaustive
        raise ValueError(f"Plateforme non supportée: {platform}")

    if not full:
        return

    # Split at word boundaries near CHUNK_SIZE_CHARS so we don't cut words
    # in half. The orchestrator forwards each chunk as-is to the agent.
    chunks: list[str] = []
    cursor = 0
    while cursor < len(full):
        end = min(cursor + CHUNK_SIZE_CHARS, len(full))
        if end < len(full):
            ws = full.rfind(" ", cursor, end)
            if ws > cursor:
                end = ws
        piece = full[cursor:end].strip()
        if piece:
            chunks.append(piece)
        cursor = end + 1

    total = len(chunks)
    for index, text in enumerate(chunks):
        yield {"index": index, "total": total, "text": text}
