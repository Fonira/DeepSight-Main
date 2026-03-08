"""
+---------------------------------------------------------------------+
|  DB CACHE L2 -- Persistent transcript cache (cross-user)            |
|                                                                      |
|  Architecture:                                                       |
|    L1: Redis (24h TTL, volatile)                                     |
|    L2: PostgreSQL (persistent, this module)                          |
|                                                                      |
|  YouTube long (3h30+) -> several chunks of ~500K chars               |
|  TikTok (max 15min)   -> always 1 chunk                             |
+---------------------------------------------------------------------+
"""

import logging
from typing import Optional, Tuple

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import async_session_maker, TranscriptCache, TranscriptCacheChunk

logger = logging.getLogger(__name__)

# Max chars per chunk before splitting (covers ~5-6h of video transcript)
CHUNK_SIZE = 500_000


# -----------------------------------------------------------------------
# READ
# -----------------------------------------------------------------------

async def get_cached_transcript(
    video_id: str,
) -> Optional[Tuple[str, str, str]]:
    """
    Retrieve a cached transcript from the DB (L2).

    Returns:
        (simple, timestamped, lang) or None if not found.
    """
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(TranscriptCache).where(TranscriptCache.video_id == video_id)
            )
            entry = result.scalar_one_or_none()
            if not entry:
                return None

            # Fetch chunks ordered by index
            chunks_result = await session.execute(
                select(TranscriptCacheChunk)
                .where(TranscriptCacheChunk.cache_id == entry.id)
                .order_by(TranscriptCacheChunk.chunk_index)
            )
            chunks = chunks_result.scalars().all()

            if not chunks:
                return None

            # Reassemble from chunks
            simple_parts = []
            timestamped_parts = []
            for chunk in chunks:
                if chunk.transcript_simple:
                    simple_parts.append(chunk.transcript_simple)
                if chunk.transcript_timestamped:
                    timestamped_parts.append(chunk.transcript_timestamped)

            simple = "".join(simple_parts) if simple_parts else None
            timestamped = "".join(timestamped_parts) if timestamped_parts else None

            if not simple:
                return None

            logger.info(
                f"[DB-CACHE] HIT for {video_id} "
                f"({entry.char_count} chars, {entry.chunk_count} chunk(s), "
                f"platform={entry.platform})"
            )
            return simple, timestamped or simple, entry.lang

    except Exception as e:
        logger.warning(f"[DB-CACHE] Read error for {video_id}: {e}")
        return None


# -----------------------------------------------------------------------
# WRITE
# -----------------------------------------------------------------------

async def save_transcript_to_cache(
    video_id: str,
    simple: str,
    timestamped: Optional[str],
    lang: Optional[str],
    platform: str = "youtube",
    extraction_method: Optional[str] = None,
) -> bool:
    """
    Save (upsert) a transcript to the DB cache.

    For YouTube: splits into chunks of CHUNK_SIZE chars if transcript is
    very long (3h30+ videos). Split happens at newline boundaries.
    For TikTok: always 1 chunk.

    Upsert logic: keeps the longer transcript if one already exists.
    """
    if not simple:
        return False

    try:
        async with async_session_maker() as session:
            # Check if entry already exists
            result = await session.execute(
                select(TranscriptCache).where(TranscriptCache.video_id == video_id)
            )
            existing = result.scalar_one_or_none()

            # Upsert: keep the longer transcript
            if existing and existing.char_count >= len(simple):
                logger.info(
                    f"[DB-CACHE] SKIP save for {video_id} "
                    f"(existing {existing.char_count} chars >= new {len(simple)} chars)"
                )
                return True

            # Split into chunks
            simple_chunks = _split_text(simple, CHUNK_SIZE)
            ts_chunks = _split_text(timestamped, CHUNK_SIZE) if timestamped else [None] * len(simple_chunks)

            # Pad ts_chunks to match simple_chunks length
            while len(ts_chunks) < len(simple_chunks):
                ts_chunks.append(None)

            chunk_count = len(simple_chunks)

            if existing:
                # Update existing entry
                existing.platform = platform
                existing.lang = lang
                existing.char_count = len(simple)
                existing.extraction_method = extraction_method
                existing.chunk_count = chunk_count

                # Delete old chunks and insert new ones
                await session.execute(
                    delete(TranscriptCacheChunk).where(
                        TranscriptCacheChunk.cache_id == existing.id
                    )
                )
                await session.flush()

                for idx, (s_chunk, ts_chunk) in enumerate(zip(simple_chunks, ts_chunks)):
                    session.add(TranscriptCacheChunk(
                        cache_id=existing.id,
                        chunk_index=idx,
                        transcript_simple=s_chunk,
                        transcript_timestamped=ts_chunk,
                    ))
            else:
                # Create new entry
                entry = TranscriptCache(
                    video_id=video_id,
                    platform=platform,
                    lang=lang,
                    char_count=len(simple),
                    extraction_method=extraction_method,
                    chunk_count=chunk_count,
                )
                session.add(entry)
                await session.flush()  # Get entry.id

                for idx, (s_chunk, ts_chunk) in enumerate(zip(simple_chunks, ts_chunks)):
                    session.add(TranscriptCacheChunk(
                        cache_id=entry.id,
                        chunk_index=idx,
                        transcript_simple=s_chunk,
                        transcript_timestamped=ts_chunk,
                    ))

            await session.commit()

            logger.info(
                f"[DB-CACHE] SAVED {video_id} "
                f"({len(simple)} chars, {chunk_count} chunk(s), "
                f"platform={platform}, method={extraction_method})"
            )
            return True

    except Exception as e:
        logger.warning(f"[DB-CACHE] Write error for {video_id}: {e}")
        return False


# -----------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------

def _split_text(text: Optional[str], chunk_size: int) -> list:
    """
    Split text into chunks of approximately chunk_size chars.
    Splits at newline boundaries to avoid cutting mid-line.
    Returns a list with at least 1 element.
    """
    if not text:
        return [""]

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunks.append(text[start:])
            break

        # Find the last newline before the chunk boundary
        newline_pos = text.rfind("\n", start, end)
        if newline_pos > start:
            chunks.append(text[start:newline_pos + 1])
            start = newline_pos + 1
        else:
            # No newline found, cut at chunk_size
            chunks.append(text[start:end])
            start = end

    return chunks
