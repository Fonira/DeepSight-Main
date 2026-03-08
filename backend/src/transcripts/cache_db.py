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

import json
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

async def check_transcript_cached(video_id: str) -> Optional[dict]:
    """
    Check if a transcript is cached and return metadata (without full text).
    Used by /api/videos/check-cache/{video_id}.
    """
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(TranscriptCache).where(TranscriptCache.video_id == video_id)
            )
            entry = result.scalar_one_or_none()
            if not entry:
                return None
            return {
                "video_id": entry.video_id,
                "platform": entry.platform,
                "lang": entry.lang,
                "char_count": entry.char_count,
                "chunk_count": entry.chunk_count,
                "video_title": entry.video_title,
                "video_channel": entry.video_channel,
                "thumbnail_url": entry.thumbnail_url,
                "video_duration": entry.video_duration,
                "category": entry.category,
                "cached_at": entry.created_at.isoformat() if entry.created_at else None,
                # Extended metadata
                "view_count": entry.view_count,
                "like_count": entry.like_count,
                "description": entry.description,
                "tags": json.loads(entry.tags_json) if entry.tags_json else None,
                "channel_id": entry.channel_id,
                "channel_follower_count": entry.channel_follower_count,
                "is_enriched": entry.metadata_enriched_at is not None,
            }
    except Exception as e:
        logger.warning(f"[DB-CACHE] Check error for {video_id}: {e}")
        return None


async def save_transcript_to_cache(
    video_id: str,
    simple: str,
    timestamped: Optional[str],
    lang: Optional[str],
    platform: str = "youtube",
    extraction_method: Optional[str] = None,
    video_title: Optional[str] = None,
    video_channel: Optional[str] = None,
    thumbnail_url: Optional[str] = None,
    video_duration: Optional[int] = None,
    category: Optional[str] = None,
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
                # Still update metadata if missing
                updated = False
                if video_title and not existing.video_title:
                    existing.video_title = video_title
                    updated = True
                if video_channel and not existing.video_channel:
                    existing.video_channel = video_channel
                    updated = True
                if thumbnail_url and not existing.thumbnail_url:
                    existing.thumbnail_url = thumbnail_url
                    updated = True
                if video_duration and not existing.video_duration:
                    existing.video_duration = video_duration
                    updated = True
                if category and not existing.category:
                    existing.category = category
                    updated = True
                if updated:
                    await session.commit()
                    logger.info(f"[DB-CACHE] Metadata updated for {video_id}")
                else:
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
                if video_title:
                    existing.video_title = video_title
                if video_channel:
                    existing.video_channel = video_channel
                if thumbnail_url:
                    existing.thumbnail_url = thumbnail_url
                if video_duration:
                    existing.video_duration = video_duration
                if category:
                    existing.category = category

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
                    video_title=video_title,
                    video_channel=video_channel,
                    thumbnail_url=thumbnail_url,
                    video_duration=video_duration,
                    category=category,
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

            # Trigger embedding generation (non-blocking)
            try:
                import asyncio
                from search.embedding_service import embed_transcript
                asyncio.create_task(embed_transcript(video_id))
            except ImportError:
                pass  # Search module not available
            except Exception as emb_err:
                logger.warning(f"[DB-CACHE] Embedding trigger failed for {video_id}: {emb_err}")

            # Trigger metadata enrichment (non-blocking)
            try:
                import asyncio
                from transcripts.metadata_service import enrich_metadata
                asyncio.create_task(enrich_metadata(video_id, platform))
            except ImportError:
                pass  # Metadata service not available
            except Exception as meta_err:
                logger.warning(f"[DB-CACHE] Metadata trigger failed for {video_id}: {meta_err}")

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
