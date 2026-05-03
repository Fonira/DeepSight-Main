"""Service de recherche sémantique globale (cross-source, filtré user_id).

Charge les embeddings depuis les 5 tables (summary/flashcard/quiz/chat/transcript),
calcule le cosine vs l'embedding de la query, retourne les top N triés.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from db.database import (
    async_session_maker,
    Summary,
    SummaryEmbedding,
    Flashcard,
    FlashcardEmbedding,
    QuizQuestion,
    QuizEmbedding,
    ChatMessage,
    ChatEmbedding,
    TranscriptEmbedding,
    TranscriptCache,
)
from .embedding_service import (
    generate_embedding,
    _cosine_similarity,
    MIN_SIMILARITY,
)

logger = logging.getLogger(__name__)

ALL_SOURCE_TYPES = ["summary", "flashcard", "quiz", "chat", "transcript"]


@dataclass
class SearchFilters:
    limit: int = 30
    source_types: list[str] = field(default_factory=lambda: list(ALL_SOURCE_TYPES))
    platform: Optional[str] = None
    lang: Optional[str] = None
    category: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    favorites_only: bool = False
    playlist_id: Optional[str] = None


@dataclass
class SearchResult:
    source_type: str  # summary|flashcard|quiz|chat|transcript
    source_id: int
    summary_id: Optional[int]
    score: float
    text_preview: str
    source_metadata: dict


async def search_global(
    user_id: int, query: str, filters: SearchFilters
) -> list[SearchResult]:
    """Recherche sémantique globale, filtrée par user_id et options."""
    if not query or len(query) < 2:
        return []

    query_embedding = await generate_embedding(query)
    if query_embedding is None:
        logger.error(f"[SEARCH-GLOBAL] Failed to embed query for user {user_id}")
        return []

    candidates: list[SearchResult] = []

    async with async_session_maker() as session:
        # ─── Summaries ──────────────────────────────────────────────────────
        if "summary" in filters.source_types:
            stmt = (
                select(SummaryEmbedding, Summary)
                .join(Summary, SummaryEmbedding.summary_id == Summary.id)
                .where(SummaryEmbedding.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            for emb, summary in (await session.execute(stmt)).all():
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                meta = json.loads(emb.source_metadata) if emb.source_metadata else {}
                candidates.append(
                    SearchResult(
                        source_type="summary",
                        source_id=emb.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            **meta,
                            "summary_title": summary.video_title,
                            "summary_thumbnail": summary.thumbnail_url,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "section_ref": emb.section_ref,
                        },
                    )
                )

        # ─── Flashcards ─────────────────────────────────────────────────────
        if "flashcard" in filters.source_types:
            stmt = (
                select(FlashcardEmbedding, Flashcard, Summary)
                .join(Flashcard, FlashcardEmbedding.flashcard_id == Flashcard.id)
                .join(Summary, FlashcardEmbedding.summary_id == Summary.id)
                .where(FlashcardEmbedding.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            for emb, fc, summary in (await session.execute(stmt)).all():
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                candidates.append(
                    SearchResult(
                        source_type="flashcard",
                        source_id=fc.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            "summary_title": summary.video_title,
                            "summary_thumbnail": summary.thumbnail_url,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "tab": "flashcards",
                            "flashcard_id": fc.id,
                            "position": fc.position,
                        },
                    )
                )

        # ─── Quiz ───────────────────────────────────────────────────────────
        if "quiz" in filters.source_types:
            stmt = (
                select(QuizEmbedding, QuizQuestion, Summary)
                .join(QuizQuestion, QuizEmbedding.quiz_question_id == QuizQuestion.id)
                .join(Summary, QuizEmbedding.summary_id == Summary.id)
                .where(QuizEmbedding.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            for emb, q, summary in (await session.execute(stmt)).all():
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                candidates.append(
                    SearchResult(
                        source_type="quiz",
                        source_id=q.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            "summary_title": summary.video_title,
                            "summary_thumbnail": summary.thumbnail_url,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "tab": "quiz",
                            "quiz_question_id": q.id,
                            "position": q.position,
                        },
                    )
                )

        # ─── Chat ───────────────────────────────────────────────────────────
        if "chat" in filters.source_types:
            stmt = (
                select(ChatEmbedding, Summary)
                .join(Summary, ChatEmbedding.summary_id == Summary.id)
                .where(ChatEmbedding.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            for emb, summary in (await session.execute(stmt)).all():
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                candidates.append(
                    SearchResult(
                        source_type="chat",
                        source_id=emb.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            "summary_title": summary.video_title,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "tab": "chat",
                            "turn_index": emb.turn_index,
                            "user_message_id": emb.user_message_id,
                            "agent_message_id": emb.agent_message_id,
                        },
                    )
                )

        # ─── Transcripts (filtré via JOIN summaries.user_id) ────────────────
        if "transcript" in filters.source_types:
            # Le transcript est cross-user mais on ne montre que si le user a une
            # Summary qui pointe sur ce video_id.
            stmt = (
                select(TranscriptEmbedding, TranscriptCache, Summary)
                .join(TranscriptCache, TranscriptEmbedding.video_id == TranscriptCache.video_id)
                .join(Summary, Summary.video_id == TranscriptCache.video_id)
                .where(Summary.user_id == user_id)
            )
            stmt = _apply_summary_filters(stmt, filters)
            seen_video_ids = set()
            for emb, tc, summary in (await session.execute(stmt)).all():
                if (emb.video_id, emb.chunk_index) in seen_video_ids:
                    continue
                seen_video_ids.add((emb.video_id, emb.chunk_index))
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                candidates.append(
                    SearchResult(
                        source_type="transcript",
                        source_id=emb.id,
                        summary_id=summary.id,
                        score=score,
                        text_preview=emb.text_preview or "",
                        source_metadata={
                            "summary_title": summary.video_title,
                            "summary_thumbnail": summary.thumbnail_url,
                            "video_id": summary.video_id,
                            "channel": summary.video_channel,
                            "tab": "transcript",
                            "chunk_index": emb.chunk_index,
                        },
                    )
                )

    candidates.sort(key=lambda r: -r.score)
    return candidates[: filters.limit]


def _apply_summary_filters(stmt, filters: SearchFilters):
    """Applique les filtres optionnels qui dépendent de la table Summary."""
    if filters.platform:
        stmt = stmt.where(Summary.platform == filters.platform)
    if filters.lang:
        stmt = stmt.where(Summary.lang == filters.lang)
    if filters.category:
        stmt = stmt.where(Summary.category == filters.category)
    if filters.date_from:
        stmt = stmt.where(Summary.created_at >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(Summary.created_at <= filters.date_to)
    if filters.favorites_only:
        stmt = stmt.where(Summary.is_favorite.is_(True))
    if filters.playlist_id:
        stmt = stmt.where(Summary.playlist_id == filters.playlist_id)
    return stmt
