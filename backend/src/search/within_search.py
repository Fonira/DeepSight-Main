"""Service de recherche sémantique intra-analyse."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select

from db.database import (
    async_session_maker,
    Summary,
    SummaryEmbedding,
    Flashcard,
    FlashcardEmbedding,
    QuizQuestion,
    QuizEmbedding,
    ChatEmbedding,
    TranscriptEmbedding,
    TranscriptCache,
)
from .embedding_service import generate_embedding, _cosine_similarity, MIN_SIMILARITY

logger = logging.getLogger(__name__)


class NotOwnerError(Exception):
    """User n'est pas propriétaire du summary demandé."""


@dataclass
class WithinMatch:
    source_type: str
    source_id: int
    summary_id: int
    text: str
    text_html: str  # avec <mark>
    tab: str
    score: float
    passage_id: str  # hash stable pour deeplink
    metadata: dict


async def search_within(
    summary_id: int,
    user_id: int,
    query: str,
    source_types: Optional[list[str]] = None,
) -> list[WithinMatch]:
    """Recherche sémantique limitée à un summary, vérifie ownership."""
    if not query or len(query) < 2:
        return []

    source_types = source_types or ["summary", "flashcard", "quiz", "chat", "transcript"]

    async with async_session_maker() as session:
        summary = await session.get(Summary, summary_id)
        if summary is None:
            raise NotOwnerError(f"Summary {summary_id} not found")
        if summary.user_id != user_id:
            raise NotOwnerError(f"User {user_id} not owner of summary {summary_id}")

        query_embedding = await generate_embedding(query)
        if query_embedding is None:
            return []

        matches: list[WithinMatch] = []

        if "summary" in source_types:
            rows = (
                (await session.execute(select(SummaryEmbedding).where(SummaryEmbedding.summary_id == summary_id)))
                .scalars()
                .all()
            )
            for emb in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                meta = json.loads(emb.source_metadata) if emb.source_metadata else {}
                matches.append(
                    WithinMatch(
                        source_type="summary",
                        source_id=emb.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab=meta.get("tab", "synthesis"),
                        score=score,
                        passage_id=f"summary:{emb.id}",
                        metadata=meta,
                    )
                )

        if "flashcard" in source_types:
            rows = (
                await session.execute(
                    select(FlashcardEmbedding, Flashcard)
                    .join(Flashcard, FlashcardEmbedding.flashcard_id == Flashcard.id)
                    .where(FlashcardEmbedding.summary_id == summary_id)
                )
            ).all()
            for emb, fc in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                matches.append(
                    WithinMatch(
                        source_type="flashcard",
                        source_id=fc.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab="flashcards",
                        score=score,
                        passage_id=f"flashcard:{fc.id}",
                        metadata={"position": fc.position},
                    )
                )

        if "quiz" in source_types:
            rows = (
                await session.execute(
                    select(QuizEmbedding, QuizQuestion)
                    .join(QuizQuestion, QuizEmbedding.quiz_question_id == QuizQuestion.id)
                    .where(QuizEmbedding.summary_id == summary_id)
                )
            ).all()
            for emb, q in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                matches.append(
                    WithinMatch(
                        source_type="quiz",
                        source_id=q.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab="quiz",
                        score=score,
                        passage_id=f"quiz:{q.id}",
                        metadata={"position": q.position},
                    )
                )

        if "chat" in source_types:
            rows = (
                (await session.execute(select(ChatEmbedding).where(ChatEmbedding.summary_id == summary_id)))
                .scalars()
                .all()
            )
            for emb in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                matches.append(
                    WithinMatch(
                        source_type="chat",
                        source_id=emb.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab="chat",
                        score=score,
                        passage_id=f"chat:{emb.id}",
                        metadata={"turn_index": emb.turn_index},
                    )
                )

        if "transcript" in source_types:
            rows = (
                (
                    await session.execute(
                        select(TranscriptEmbedding)
                        .join(TranscriptCache, TranscriptEmbedding.video_id == TranscriptCache.video_id)
                        .where(TranscriptCache.video_id == summary.video_id)
                    )
                )
                .scalars()
                .all()
            )
            for emb in rows:
                vec = json.loads(emb.embedding_json)
                score = _cosine_similarity(query_embedding, vec)
                if score < MIN_SIMILARITY:
                    continue
                matches.append(
                    WithinMatch(
                        source_type="transcript",
                        source_id=emb.id,
                        summary_id=summary_id,
                        text=emb.text_preview or "",
                        text_html=_wrap_query_in_mark(emb.text_preview or "", query),
                        tab="transcript",
                        score=score,
                        passage_id=f"transcript:{emb.id}",
                        metadata={"chunk_index": emb.chunk_index},
                    )
                )

    matches.sort(key=lambda m: -m.score)
    return matches


def _wrap_query_in_mark(text: str, query: str) -> str:
    """Wrap les occurrences de la query dans <mark>. Naïf (case-insensitive substring)."""
    if not text or not query:
        return text
    import re

    pattern = re.compile(re.escape(query), re.IGNORECASE)
    return pattern.sub(lambda m: f"<mark>{m.group(0)}</mark>", text)
