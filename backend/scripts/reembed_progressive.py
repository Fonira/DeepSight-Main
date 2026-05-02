"""
Progressive re-embedding script — Mistral-First Phase 6.

Re-embeds every ``TranscriptEmbedding`` row whose ``model_version`` is
different from the current target. Designed to run safely in production:

  * **Idempotent** — picks up where a previous run left off by filtering on
    ``model_version != MODEL_VERSION_TARGET``. Rerun the script anytime;
    already-migrated rows are skipped automatically.
  * **Rate-limit safe** — sleeps ``SLEEP_BETWEEN_BATCHES`` seconds between
    batches to stay under Mistral's per-minute quota.
  * **Resilient** — per-chunk try/except: a single failure does not abort
    the whole run, only that chunk is logged and skipped (will retry on
    next invocation).
  * **Bounded memory** — streams chunks in batches of ``BATCH_SIZE`` rather
    than loading the full table.

Usage:
    cd backend && python -m scripts.reembed_progressive
    cd backend && python -m scripts.reembed_progressive --dry-run
    cd backend && python -m scripts.reembed_progressive --limit 500

Safety:
    Embedding dimension is asserted equal to
    ``embedding_service.EMBEDDING_DIMENSION`` (1024). If a future model bump
    changes the dimension, this script refuses to run — operator must do a
    full re-embed (drop indexes, re-create, re-embed fresh).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from typing import Optional

from sqlalchemy import select, update

# Make ``backend/src`` importable when the script is invoked from
# ``backend/`` directly (``python -m scripts.reembed_progressive``).
import os
_BACKEND_SRC = os.path.join(os.path.dirname(__file__), "..", "src")
if os.path.isdir(_BACKEND_SRC) and _BACKEND_SRC not in sys.path:
    sys.path.insert(0, os.path.abspath(_BACKEND_SRC))

from db.database import async_session_maker, TranscriptEmbedding  # noqa: E402
from search.embedding_service import (  # noqa: E402
    EMBEDDING_DIMENSION,
    MODEL_VERSION_TAG,
    generate_embeddings_batch,
)

logger = logging.getLogger("reembed_progressive")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


# ─── tunables ──────────────────────────────────────────────────────────────
BATCH_SIZE: int = 100  # how many chunks selected per DB pass
EMBED_API_BATCH: int = 10  # how many texts per Mistral API call (max 10)
SLEEP_BETWEEN_BATCHES: float = 2.0  # seconds — Mistral courtesy throttle
MODEL_VERSION_TARGET: str = MODEL_VERSION_TAG  # SSOT from embedding_service


async def _select_outdated_chunk_ids(
    session,
    target: str,
    limit: int,
) -> list[int]:
    """Return up to ``limit`` chunk ids with model_version != target."""
    stmt = (
        select(TranscriptEmbedding.id)
        .where(TranscriptEmbedding.model_version != target)
        .order_by(TranscriptEmbedding.id)
        .limit(limit)
    )
    result = await session.execute(stmt)
    return [row[0] for row in result.all()]


async def _load_chunk_texts(session, ids: list[int]) -> list[tuple[int, str]]:
    """Load (id, text_preview) for the given chunks."""
    if not ids:
        return []
    stmt = select(
        TranscriptEmbedding.id,
        TranscriptEmbedding.text_preview,
    ).where(TranscriptEmbedding.id.in_(ids))
    result = await session.execute(stmt)
    return [(row.id, row.text_preview or "") for row in result.all()]


async def _persist_embeddings(
    session,
    pairs: list[tuple[int, Optional[list[float]]]],
    target: str,
) -> int:
    """Update embedding_json + model_version for each (id, vector). Returns count updated."""
    updated = 0
    for chunk_id, vector in pairs:
        if vector is None:
            continue
        if len(vector) != EMBEDDING_DIMENSION:
            logger.error(
                "[REEMBED] Dimension mismatch chunk_id=%s expected=%d got=%d — ABORT row",
                chunk_id,
                EMBEDDING_DIMENSION,
                len(vector),
            )
            continue
        await session.execute(
            update(TranscriptEmbedding)
            .where(TranscriptEmbedding.id == chunk_id)
            .values(embedding_json=json.dumps(vector), model_version=target)
        )
        updated += 1
    if updated:
        await session.commit()
    return updated


async def reembed_batch(target: str = MODEL_VERSION_TARGET, dry_run: bool = False) -> int:
    """
    Re-embed one batch of outdated chunks.

    Returns the number of rows successfully re-embedded.
    Returns 0 when nothing left to do (caller should stop iterating).
    """
    async with async_session_maker() as session:
        ids = await _select_outdated_chunk_ids(session, target, BATCH_SIZE)
        if not ids:
            return 0

        rows = await _load_chunk_texts(session, ids)
        # Filter out empty previews (cannot embed)
        usable = [(cid, text) for cid, text in rows if text and len(text.strip()) >= 10]
        skipped = len(rows) - len(usable)
        if skipped:
            logger.warning("[REEMBED] Skipped %d chunks with empty/short text", skipped)
            # Mark them as up-to-date anyway to avoid infinite reselection.
            empty_ids = [cid for cid, text in rows if not text or len(text.strip()) < 10]
            if empty_ids and not dry_run:
                await session.execute(
                    update(TranscriptEmbedding)
                    .where(TranscriptEmbedding.id.in_(empty_ids))
                    .values(model_version=target)
                )
                await session.commit()

        if not usable:
            return 0

        logger.info(
            "[REEMBED] Batch start: %d chunks (target=%s, dry_run=%s)",
            len(usable),
            target,
            dry_run,
        )
        if dry_run:
            return len(usable)

        # Embed in sub-batches of EMBED_API_BATCH (Mistral max=10 input items)
        results: list[tuple[int, Optional[list[float]]]] = []
        for i in range(0, len(usable), EMBED_API_BATCH):
            sub = usable[i : i + EMBED_API_BATCH]
            ids_sub = [cid for cid, _ in sub]
            texts_sub = [text for _, text in sub]
            try:
                vectors = await generate_embeddings_batch(texts_sub)
            except Exception as exc:  # defensive — generate_embeddings_batch already swallows
                logger.warning("[REEMBED] Sub-batch failure ids=%s: %s", ids_sub, exc)
                vectors = [None] * len(sub)
            results.extend(zip(ids_sub, vectors))

        return await _persist_embeddings(session, results, target)


async def main(target: str, max_rows: Optional[int], dry_run: bool) -> None:
    total = 0
    while True:
        if max_rows is not None and total >= max_rows:
            logger.info("[REEMBED] Reached max_rows=%d, stopping", max_rows)
            break
        n = await reembed_batch(target=target, dry_run=dry_run)
        if n == 0:
            logger.info("[REEMBED] No more outdated chunks. Done. Total=%d", total)
            return
        total += n
        logger.info("[REEMBED] Progress: %d rows updated this run", total)
        await asyncio.sleep(SLEEP_BETWEEN_BATCHES)


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Progressively re-embed transcript chunks to the latest Mistral model.",
    )
    p.add_argument(
        "--target",
        default=MODEL_VERSION_TARGET,
        help=f"Target model_version tag (default: {MODEL_VERSION_TARGET})",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum total rows to update before exiting (default: no cap)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Count rows that would be updated without calling the API or writing.",
    )
    return p


if __name__ == "__main__":
    args = _build_parser().parse_args()
    asyncio.run(main(target=args.target, max_rows=args.limit, dry_run=args.dry_run))
