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
from sqlalchemy import select

from db.database import async_session_maker, TranscriptCache, TranscriptCacheChunk, TranscriptEmbedding
from core.config import MISTRAL_API_KEY

logger = logging.getLogger(__name__)

MISTRAL_EMBED_URL = "https://api.mistral.ai/v1/embeddings"
# Mistral-First Phase 6 (2026-05-02) — bump checkpoint.
#
# State of Mistral embedding API at this date (verified via official docs +
# cookbook, https://docs.mistral.ai/getting-started/models/benchmark/ +
# https://github.com/mistralai/cookbook):
#   * Generic text  → ``mistral-embed`` (alias, internal v23.12, dim=1024)
#   * Code-only     → ``codestral-embed`` (v25.05, out of scope)
#   * No ``mistral-embed-2510``/``2602`` published yet — the alias IS latest.
#
# When Mistral ships a newer text-embed revision:
#   1. Verify dimension still equals ``EMBEDDING_DIMENSION`` (1024).
#      If different → migration: re-create indexes, re-embed everything fresh.
#      If equal     → just bump the constants below and run
#                     ``backend/scripts/reembed_progressive.py``.
#   2. Update ``MISTRAL_EMBED_MODEL`` and ``MODEL_VERSION_TAG`` together so
#      ``model_version`` rows reflect the actual upstream version.
MISTRAL_EMBED_MODEL = "mistral-embed"
MODEL_VERSION_TAG = "mistral-embed"  # written to TranscriptEmbedding.model_version
EMBEDDING_DIMENSION = 1024  # invariant — guarded by re-embedding script
CHUNK_WORDS = 500
BATCH_SIZE = 10
MIN_SIMILARITY = 0.3


async def generate_embedding(text: str) -> Optional[list]:
    """Generate a single embedding vector via Mistral API."""
    api_key = MISTRAL_API_KEY
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
    api_key = MISTRAL_API_KEY
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
        chunk = " ".join(words[i : i + words_per_chunk])
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
                select(TranscriptEmbedding).where(TranscriptEmbedding.video_id == video_id).limit(1)
            )
            if existing.scalar_one_or_none():
                logger.info(f"[EMBED] Already embedded: {video_id}")
                return True

            # Get transcript from cache
            cache_entry = await session.execute(select(TranscriptCache).where(TranscriptCache.video_id == video_id))
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
                batch = text_chunks[i : i + BATCH_SIZE]
                embeddings = await generate_embeddings_batch(batch)
                all_embeddings.extend(embeddings)

            # Store embeddings
            stored = 0
            for idx, (chunk_text, embedding) in enumerate(zip(text_chunks, all_embeddings)):
                if embedding is None:
                    continue
                session.add(
                    TranscriptEmbedding(
                        video_id=video_id,
                        chunk_index=idx,
                        embedding_json=json.dumps(embedding),
                        text_preview=chunk_text[:500],
                        token_count=len(chunk_text.split()),
                        model_version=MODEL_VERSION_TAG,
                    )
                )
                stored += 1

            await session.commit()
            logger.info(f"[EMBED] Stored {stored} embeddings for {video_id}")
            return True

    except Exception as e:
        logger.error(f"[EMBED] Error embedding {video_id}: {e}")
        return False


# ════════════════════════════════════════════════════════════════════════════════
# 🔍 SEMANTIC SEARCH V1 — embed helpers étendus
# ════════════════════════════════════════════════════════════════════════════════


async def embed_summary(summary_id: int) -> bool:
    """Embed un Summary par section du structured_index, fallback chunks full_digest.

    Idempotent : delete les SummaryEmbedding existants pour ce summary, puis insert.
    Returns True si succès, False si Summary introuvable ou échec embed.
    """
    from db.database import async_session_maker, Summary, SummaryEmbedding
    from sqlalchemy import select, delete as sa_delete

    async with async_session_maker() as session:
        summary = await session.get(Summary, summary_id)
        if summary is None:
            logger.warning(f"[EMBED-SUMMARY] Summary {summary_id} not found")
            return False

        # Parse structured_index si présent
        sections: list[dict] = []
        if summary.structured_index:
            try:
                parsed = json.loads(summary.structured_index)
                if isinstance(parsed, list):
                    sections = parsed
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(
                    f"[EMBED-SUMMARY] structured_index invalid JSON for {summary_id}: {e}"
                )

        # Fallback : chunks 500 mots du full_digest
        if not sections:
            text = summary.full_digest or summary.summary_content or ""
            if not text.strip():
                logger.info(f"[EMBED-SUMMARY] No content to embed for {summary_id}")
                return False
            chunks = _chunk_text(text, words_per_chunk=CHUNK_WORDS)
            sections = [
                {"ts": None, "title": f"Section {i + 1}", "summary": chunk, "kw": []}
                for i, chunk in enumerate(chunks)
            ]

        # Préparer les textes à embed
        texts = [
            f"{section.get('title', '')}\n\n{section.get('summary', '')}"
            for section in sections
        ]

        # Delete existants (idempotence)
        await session.execute(
            sa_delete(SummaryEmbedding).where(SummaryEmbedding.summary_id == summary_id)
        )

        # Embed par batches de 10
        all_embeddings: list = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            batch_embeddings = await generate_embeddings_batch(batch)
            all_embeddings.extend(batch_embeddings)

        # Insert
        inserted = 0
        for idx, (section, embedding) in enumerate(zip(sections, all_embeddings)):
            if embedding is None:
                logger.warning(f"[EMBED-SUMMARY] Embedding {idx} failed for {summary_id}")
                continue
            preview = (texts[idx] or "")[:497]
            if len(texts[idx]) > 500:
                preview += "..."
            session.add(
                SummaryEmbedding(
                    summary_id=summary_id,
                    user_id=summary.user_id,
                    section_index=idx,
                    section_ref=str(section.get("ts")) if section.get("ts") else None,
                    embedding_json=json.dumps(embedding),
                    text_preview=preview,
                    token_count=len(texts[idx].split()),
                    model_version=MODEL_VERSION_TAG,
                    source_metadata=json.dumps(
                        {
                            "tab": "synthesis" if summary.structured_index else "digest",
                            "ts": section.get("ts"),
                            "title": section.get("title"),
                            "kw": section.get("kw", []),
                        }
                    ),
                )
            )
            inserted += 1

        await session.commit()
        logger.info(
            f"[EMBED-SUMMARY] {summary_id}: {inserted}/{len(sections)} sections embedded"
        )
        return inserted > 0


async def embed_flashcards(summary_id: int) -> bool:
    """Embed toutes les flashcards d'un Summary (Q+A concaténés).

    Idempotent : delete les FlashcardEmbedding existants, puis insert.
    """
    from db.database import async_session_maker, Flashcard, FlashcardEmbedding
    from sqlalchemy import select, delete as sa_delete

    async with async_session_maker() as session:
        result = await session.execute(
            select(Flashcard)
            .where(Flashcard.summary_id == summary_id)
            .order_by(Flashcard.position)
        )
        flashcards = result.scalars().all()

        if not flashcards:
            logger.info(f"[EMBED-FLASHCARD] No flashcards for summary {summary_id}")
            return False

        # Texts : "Q: ...\n\nA: ..."
        texts = [f"Q: {f.front}\n\nA: {f.back}" for f in flashcards]

        # Delete existants
        await session.execute(
            sa_delete(FlashcardEmbedding).where(FlashcardEmbedding.summary_id == summary_id)
        )

        # Embed par batches
        all_embeddings: list = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            all_embeddings.extend(await generate_embeddings_batch(batch))

        user_id = flashcards[0].user_id
        inserted = 0
        for f, embedding, text in zip(flashcards, all_embeddings, texts):
            if embedding is None:
                continue
            session.add(
                FlashcardEmbedding(
                    flashcard_id=f.id,
                    summary_id=summary_id,
                    user_id=user_id,
                    embedding_json=json.dumps(embedding),
                    text_preview=text[:500],
                    model_version=MODEL_VERSION_TAG,
                )
            )
            inserted += 1

        await session.commit()
        logger.info(
            f"[EMBED-FLASHCARD] {summary_id}: {inserted}/{len(flashcards)} flashcards embedded"
        )
        return inserted > 0


async def embed_quiz(summary_id: int) -> bool:
    """Embed toutes les quiz questions d'un Summary (question + bonne réponse).

    Idempotent.
    """
    from db.database import async_session_maker, QuizQuestion, QuizEmbedding
    from sqlalchemy import select, delete as sa_delete

    async with async_session_maker() as session:
        result = await session.execute(
            select(QuizQuestion)
            .where(QuizQuestion.summary_id == summary_id)
            .order_by(QuizQuestion.position)
        )
        questions = result.scalars().all()

        if not questions:
            logger.info(f"[EMBED-QUIZ] No quiz questions for summary {summary_id}")
            return False

        # Texts : "Q: ...\n\nBonne réponse : ..."
        texts: list[str] = []
        for q in questions:
            try:
                options = json.loads(q.options_json)
                correct_text = (
                    options[q.correct_index]
                    if 0 <= q.correct_index < len(options)
                    else "?"
                )
            except (json.JSONDecodeError, IndexError, TypeError):
                correct_text = "?"
            texts.append(f"Q: {q.question}\n\nBonne réponse : {correct_text}")

        # Delete existants
        await session.execute(
            sa_delete(QuizEmbedding).where(QuizEmbedding.summary_id == summary_id)
        )

        # Embed par batches
        all_embeddings: list = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            all_embeddings.extend(await generate_embeddings_batch(batch))

        user_id = questions[0].user_id
        inserted = 0
        for q, embedding, text in zip(questions, all_embeddings, texts):
            if embedding is None:
                continue
            session.add(
                QuizEmbedding(
                    quiz_question_id=q.id,
                    summary_id=summary_id,
                    user_id=user_id,
                    embedding_json=json.dumps(embedding),
                    text_preview=text[:500],
                    model_version=MODEL_VERSION_TAG,
                )
            )
            inserted += 1

        await session.commit()
        logger.info(
            f"[EMBED-QUIZ] {summary_id}: {inserted}/{len(questions)} quiz embedded"
        )
        return inserted > 0


MIN_TURN_TOKENS = 30  # filtre turns trop courts (ok merci, etc.)


async def embed_chat_turn(user_msg_id: int, agent_msg_id: int) -> bool:
    """Embed une paire user+agent comme un seul turn searchable.

    Skip si tokens combinés < MIN_TURN_TOKENS (filtre noise).
    Idempotent par (summary_id, turn_index) — recompute le turn_index à partir
    de la position du user_msg dans la conversation.
    """
    from db.database import async_session_maker, ChatMessage, ChatEmbedding
    from sqlalchemy import select, func as sa_func, delete as sa_delete

    async with async_session_maker() as session:
        user_msg = await session.get(ChatMessage, user_msg_id)
        agent_msg = await session.get(ChatMessage, agent_msg_id)
        if user_msg is None or agent_msg is None:
            logger.warning(
                f"[EMBED-CHAT] Messages not found: user={user_msg_id} agent={agent_msg_id}"
            )
            return False

        if user_msg.summary_id != agent_msg.summary_id:
            logger.warning(
                f"[EMBED-CHAT] summary_id mismatch: {user_msg.summary_id} != {agent_msg.summary_id}"
            )
            return False

        summary_id = user_msg.summary_id
        if summary_id is None:
            logger.info("[EMBED-CHAT] Skipping orphan messages (no summary_id)")
            return False

        # Filtre noise — approx 1 token = 1 mot
        combined_tokens = len(user_msg.content.split()) + len(agent_msg.content.split())
        if combined_tokens < MIN_TURN_TOKENS:
            logger.debug(
                f"[EMBED-CHAT] Skip short turn ({combined_tokens} tokens) for summary {summary_id}"
            )
            return False

        # Compute turn_index : nb de paires user+assistant dans cette conversation
        # jusqu'à user_msg (basé sur created_at).
        result = await session.execute(
            select(sa_func.count())
            .select_from(ChatMessage)
            .where(
                ChatMessage.summary_id == summary_id,
                ChatMessage.role == "user",
                ChatMessage.created_at < user_msg.created_at,
            )
        )
        turn_index = result.scalar() or 0

        # Embed
        text = f"Q: {user_msg.content}\n\nA: {agent_msg.content}"
        embedding = await generate_embedding(text)
        if embedding is None:
            logger.warning(f"[EMBED-CHAT] Embedding failed for turn {turn_index}")
            return False

        # Idempotence : delete pour ce (summary_id, turn_index) puis insert
        await session.execute(
            sa_delete(ChatEmbedding).where(
                ChatEmbedding.summary_id == summary_id,
                ChatEmbedding.turn_index == turn_index,
            )
        )

        session.add(
            ChatEmbedding(
                summary_id=summary_id,
                user_id=user_msg.user_id,
                turn_index=turn_index,
                user_message_id=user_msg_id,
                agent_message_id=agent_msg_id,
                embedding_json=json.dumps(embedding),
                text_preview=text[:500],
                token_count=combined_tokens,
                model_version=MODEL_VERSION_TAG,
            )
        )

        await session.commit()
        logger.info(
            f"[EMBED-CHAT] summary {summary_id} turn {turn_index} embedded ({combined_tokens} tokens)"
        )
        return True


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
            stmt = select(
                TranscriptEmbedding.video_id,
                TranscriptEmbedding.chunk_index,
                TranscriptEmbedding.embedding_json,
                TranscriptEmbedding.text_preview,
                TranscriptCache.video_title,
                TranscriptCache.video_channel,
                TranscriptCache.thumbnail_url,
                TranscriptCache.category,
            ).join(TranscriptCache, TranscriptEmbedding.video_id == TranscriptCache.video_id)

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
                    scored.append(
                        {
                            "video_id": row.video_id,
                            "chunk_index": row.chunk_index,
                            "score": round(score, 4),
                            "text_preview": row.text_preview,
                            "video_title": row.video_title or "Unknown",
                            "video_channel": row.video_channel or "Unknown",
                            "thumbnail_url": row.thumbnail_url,
                            "category": row.category,
                        }
                    )

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
