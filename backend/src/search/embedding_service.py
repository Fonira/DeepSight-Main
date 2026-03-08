"""
Embedding Service — Mistral AI embeddings for semantic search.

Generates embeddings for cached transcripts and performs
cosine similarity search across all stored embeddings.
"""

import json
import math
import logging
from typing import Optional

import httpx
from sqlalchemy import select, delete

from db.database import (
    async_session_maker, TranscriptCache, TranscriptCacheChunk, TranscriptEmbedding
)
from core.config import settings

logger = logging.getLogger(__name__)

MISTRAL_EMBED_URL = "https://api.mistral.ai/v1/embeddings"
MISTRAL_EMBED_MODEL = "mistral-embed"
CHUNK_WORDS = 500
BATCH_SIZE = 10
MIN_SIMILARITY = 0.3


async def generate_embedding(text: str) -> Optional[list]:
    """Generate a single embedding vector via Mistral API."""
    api_key = getattr(settings, "MISTRAL_API_KEY", None)
    if not api_key:
        logger.warning("[EMBED] No MISTRAL_API_KEY configured")
        return None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                MISTRAL_EMBED_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": MISTRAL_EMBED_MODEL, "input": [text[:8000]]},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]
    except Exception as e:
        logger.warning(f"[EMBED] API error: {e}")
        return None


async def generate_embeddings_batch(texts: list[str]) -> list[Optional[list]]:
    """Generate embeddings for a batch of texts (max 10)."""
    api_key = getattr(settings, "MISTRAL_API_KEY", None)
    if not api_key:
        return [None] * len(texts)

    try:
        truncated = [t[:8000] for t in texts]
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                MISTRAL_EMBED_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": MISTRAL_EMBED_MODEL, "input": truncated},
            )
            resp.raise_for_status()
            data = resp.json()
            return [item["embedding"] for item in data["data"]]
    except Exception as e:
        logger.warning(f"[EMBED] Batch API error: {e}")
        return [None] * len(texts)


def _chunk_text(text: str, words_per_chunk: int = CHUNK_WORDS) -> list[str]:
    """Split text into chunks of approximately words_per_chunk words."""
    words = text.split()
    if len(words) <= words_per_chunk:
        return [text]

    chunks = []
    for i in range(0, len(words), words_per_chunk):
        chunk = " ".join(words[i:i + words_per_chunk])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def _cosine_similarity(a: list, b: list) -> float:
    """Pure Python cosine similarity — no numpy needed."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def embed_transcript(video_id: str) -> bool:
    """
    Generate and store embeddings for a cached transcript.
    Called automatically after saving a transcript to cache.
    """
    try:
        async with async_session_maker() as session:
            # Check if already embedded
            existing = await session.execute(
                select(TranscriptEmbedding).where(
                    TranscriptEmbedding.video_id == video_id
                ).limit(1)
            )
            if existing.scalar_one_or_none():
                logger.info(f"[EMBED] Already embedded: {video_id}")
                return True

            # Get transcript from cache
            cache_entry = await session.execute(
                select(TranscriptCache).where(TranscriptCache.video_id == video_id)
            )
            entry = cache_entry.scalar_one_or_none()
            if not entry:
                return False

            # Fetch chunks
            chunks_result = await session.execute(
                select(TranscriptCacheChunk)
                .where(TranscriptCacheChunk.cache_id == entry.id)
                .order_by(TranscriptCacheChunk.chunk_index)
            )
            db_chunks = chunks_result.scalars().all()
            full_text = "".join(c.transcript_simple or "" for c in db_chunks)

            if not full_text or len(full_text) < 100:
                return False

            # Split into semantic chunks
            text_chunks = _chunk_text(full_text)
            logger.info(f"[EMBED] Processing {video_id}: {len(text_chunks)} chunks")

            # Generate embeddings in batches
            all_embeddings = []
            for i in range(0, len(text_chunks), BATCH_SIZE):
                batch = text_chunks[i:i + BATCH_SIZE]
                embeddings = await generate_embeddings_batch(batch)
                all_embeddings.extend(embeddings)

            # Store embeddings
            stored = 0
            for idx, (chunk_text, embedding) in enumerate(zip(text_chunks, all_embeddings)):
                if embedding is None:
                    continue
                session.add(TranscriptEmbedding(
                    video_id=video_id,
                    chunk_index=idx,
                    embedding_json=json.dumps(embedding),
                    text_preview=chunk_text[:500],
                    token_count=len(chunk_text.split()),
                ))
                stored += 1

            await session.commit()
            logger.info(f"[EMBED] Stored {stored} embeddings for {video_id}")
            return True

    except Exception as e:
        logger.error(f"[EMBED] Error embedding {video_id}: {e}")
        return False


async def search_similar(
    query: str,
    limit: int = 10,
    category: Optional[str] = None,
) -> list[dict]:
    """
    Search for transcripts similar to the query using cosine similarity.
    Returns top-N results with score > MIN_SIMILARITY.
    """
    query_embedding = await generate_embedding(query)
    if not query_embedding:
        return []

    try:
        async with async_session_maker() as session:
            # Load all embeddings (with optional category filter)
            stmt = (
                select(
                    TranscriptEmbedding.video_id,
                    TranscriptEmbedding.chunk_index,
                    TranscriptEmbedding.embedding_json,
                    TranscriptEmbedding.text_preview,
                    TranscriptCache.video_title,
                    TranscriptCache.video_channel,
                    TranscriptCache.thumbnail_url,
                    TranscriptCache.category,
                )
                .join(TranscriptCache, TranscriptEmbedding.video_id == TranscriptCache.video_id)
            )

            if category:
                stmt = stmt.where(TranscriptCache.category == category)

            result = await session.execute(stmt)
            rows = result.all()

            if not rows:
                return []

            # Compute similarities
            scored = []
            seen_videos = set()
            for row in rows:
                embedding = json.loads(row.embedding_json)
                score = _cosine_similarity(query_embedding, embedding)
                if score >= MIN_SIMILARITY:
                    scored.append({
                        "video_id": row.video_id,
                        "chunk_index": row.chunk_index,
                        "score": round(score, 4),
                        "text_preview": row.text_preview,
                        "video_title": row.video_title or "Unknown",
                        "video_channel": row.video_channel or "Unknown",
                        "thumbnail_url": row.thumbnail_url,
                        "category": row.category,
                    })

            # Sort by score descending
            scored.sort(key=lambda x: x["score"], reverse=True)

            # Deduplicate by video_id (keep best chunk per video)
            unique_results = []
            for item in scored:
                if item["video_id"] not in seen_videos:
                    seen_videos.add(item["video_id"])
                    unique_results.append(item)
                if len(unique_results) >= limit:
                    break

            return unique_results

    except Exception as e:
        logger.error(f"[EMBED] Search error: {e}")
        return []
