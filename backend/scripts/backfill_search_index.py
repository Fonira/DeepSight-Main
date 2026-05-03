"""Backfill the Semantic Search V1 index for existing summaries.

Usage::

    # Dry-run sur 1 user
    python -m scripts.backfill_search_index --user-id 42 --dry-run

    # Run réel batch 50 par 50, all users
    python -m scripts.backfill_search_index --all-users --batch-size 50

    # Filtrer pour ne backfiller que les summaries pas encore embeddées
    python -m scripts.backfill_search_index --all-users --only-missing

Idempotent : appel multiple safe (les helpers embed_* font delete-then-insert).
Rate-limited : 2 sec de pause entre batches Mistral.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Path hack pour rendre `src/` importable depuis backend/scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from sqlalchemy import select  # noqa: E402

from db.database import (  # noqa: E402
    async_session_maker,
    Summary,
    SummaryEmbedding,
    Flashcard,
    FlashcardEmbedding,
    QuizQuestion,
    QuizEmbedding,
    ChatMessage,
    ChatEmbedding,
)
from search.embedding_service import (  # noqa: E402
    embed_summary,
    embed_flashcards,
    embed_quiz,
    embed_chat_turn,
)

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s", level=logging.INFO
)
logger = logging.getLogger("backfill_search")

BATCH_SLEEP_SECONDS = 2.0


async def _summaries_missing_embeddings(user_id: int | None) -> list[int]:
    async with async_session_maker() as session:
        stmt = select(Summary.id).outerjoin(SummaryEmbedding, SummaryEmbedding.summary_id == Summary.id).where(SummaryEmbedding.id.is_(None))
        if user_id is not None:
            stmt = stmt.where(Summary.user_id == user_id)
        return [row[0] for row in (await session.execute(stmt)).all()]


async def _all_summary_ids(user_id: int | None) -> list[int]:
    async with async_session_maker() as session:
        stmt = select(Summary.id)
        if user_id is not None:
            stmt = stmt.where(Summary.user_id == user_id)
        return [row[0] for row in (await session.execute(stmt)).all()]


async def _flashcards_summary_ids(user_id: int | None) -> list[int]:
    async with async_session_maker() as session:
        stmt = select(Flashcard.summary_id).distinct()
        if user_id is not None:
            stmt = stmt.where(Flashcard.user_id == user_id)
        return [row[0] for row in (await session.execute(stmt)).all()]


async def _quiz_summary_ids(user_id: int | None) -> list[int]:
    async with async_session_maker() as session:
        stmt = select(QuizQuestion.summary_id).distinct()
        if user_id is not None:
            stmt = stmt.where(QuizQuestion.user_id == user_id)
        return [row[0] for row in (await session.execute(stmt)).all()]


async def _chat_turns(user_id: int | None) -> list[tuple[int, int]]:
    """Liste les paires (user_msg_id, agent_msg_id) consécutives par summary."""
    async with async_session_maker() as session:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.summary_id.is_not(None))
            .order_by(ChatMessage.summary_id, ChatMessage.created_at)
        )
        if user_id is not None:
            stmt = stmt.where(ChatMessage.user_id == user_id)
        msgs = (await session.execute(stmt)).scalars().all()

    pairs: list[tuple[int, int]] = []
    by_summary: dict[int, list[ChatMessage]] = {}
    for m in msgs:
        by_summary.setdefault(m.summary_id, []).append(m)
    for sid, lst in by_summary.items():
        i = 0
        while i < len(lst) - 1:
            if lst[i].role == "user" and lst[i + 1].role == "assistant":
                pairs.append((lst[i].id, lst[i + 1].id))
                i += 2
            else:
                i += 1
    return pairs


async def main(user_id: int | None, only_missing: bool, batch_size: int, dry_run: bool):
    # 1. Summaries
    summary_ids = (
        await _summaries_missing_embeddings(user_id) if only_missing
        else await _all_summary_ids(user_id)
    )
    logger.info(f"Summaries to embed: {len(summary_ids)}")
    if not dry_run:
        for i in range(0, len(summary_ids), batch_size):
            batch = summary_ids[i : i + batch_size]
            await asyncio.gather(*[embed_summary(sid) for sid in batch])
            logger.info(f"Summary batch {i//batch_size + 1} done ({len(batch)} items)")
            await asyncio.sleep(BATCH_SLEEP_SECONDS)

    # 2. Flashcards par summary
    fc_summary_ids = await _flashcards_summary_ids(user_id)
    logger.info(f"Summaries with flashcards to embed: {len(fc_summary_ids)}")
    if not dry_run:
        for i in range(0, len(fc_summary_ids), batch_size):
            batch = fc_summary_ids[i : i + batch_size]
            await asyncio.gather(*[embed_flashcards(sid) for sid in batch])
            logger.info(f"Flashcards batch {i//batch_size + 1} done")
            await asyncio.sleep(BATCH_SLEEP_SECONDS)

    # 3. Quiz par summary
    quiz_summary_ids = await _quiz_summary_ids(user_id)
    logger.info(f"Summaries with quiz to embed: {len(quiz_summary_ids)}")
    if not dry_run:
        for i in range(0, len(quiz_summary_ids), batch_size):
            batch = quiz_summary_ids[i : i + batch_size]
            await asyncio.gather(*[embed_quiz(sid) for sid in batch])
            logger.info(f"Quiz batch {i//batch_size + 1} done")
            await asyncio.sleep(BATCH_SLEEP_SECONDS)

    # 4. Chat turns
    chat_pairs = await _chat_turns(user_id)
    logger.info(f"Chat turns to embed: {len(chat_pairs)}")
    if not dry_run:
        for i in range(0, len(chat_pairs), batch_size):
            batch = chat_pairs[i : i + batch_size]
            await asyncio.gather(*[embed_chat_turn(u, a) for u, a in batch])
            logger.info(f"Chat batch {i//batch_size + 1} done")
            await asyncio.sleep(BATCH_SLEEP_SECONDS)

    logger.info("Backfill complete.")


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Backfill Semantic Search V1 index.")
    grp = p.add_mutually_exclusive_group(required=True)
    grp.add_argument("--user-id", type=int, help="Backfill only this user's content")
    grp.add_argument("--all-users", action="store_true", help="Backfill all users")
    p.add_argument("--only-missing", action="store_true",
                   help="Only summaries that have no SummaryEmbedding yet")
    p.add_argument("--batch-size", type=int, default=50)
    p.add_argument("--dry-run", action="store_true", help="Count only, don't embed")
    return p


if __name__ == "__main__":
    args = _build_parser().parse_args()
    user_id = None if args.all_users else args.user_id
    asyncio.run(main(user_id, args.only_missing, args.batch_size, args.dry_run))
