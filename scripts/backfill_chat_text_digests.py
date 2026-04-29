"""Backfill digests for chat texte buckets accumulated before the bucket hook
was deployed.

Iterates per (summary_id, user_id) tuple and calls maybe_generate_chat_text_digest
in a loop until no more buckets are produced.

Run: cd backend && python -m scripts.backfill_chat_text_digests
"""
import asyncio
import logging
from sqlalchemy import select, distinct

from db.database import ChatMessage, ChatTextDigest, async_session_factory
from voice.context_digest import maybe_generate_chat_text_digest, CHAT_TEXT_BUCKET_SIZE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backfill_chat_text")


async def main():
    async with async_session_factory() as db:
        pairs = (
            await db.execute(
                select(distinct(ChatMessage.summary_id), ChatMessage.user_id)
                .where(ChatMessage.source == "text")
            )
        ).all()
    logger.info("Found %d (summary_id, user_id) pairs to inspect", len(pairs))

    for summary_id, user_id in pairs:
        async with async_session_factory() as db:
            # Loop while buckets are produced
            while True:
                count_before = (
                    await db.execute(
                        select(ChatTextDigest)
                        .where(
                            ChatTextDigest.summary_id == summary_id,
                            ChatTextDigest.user_id == user_id,
                        )
                    )
                ).scalars().all()
                await maybe_generate_chat_text_digest(db, summary_id, user_id)
                count_after = (
                    await db.execute(
                        select(ChatTextDigest)
                        .where(
                            ChatTextDigest.summary_id == summary_id,
                            ChatTextDigest.user_id == user_id,
                        )
                    )
                ).scalars().all()
                if len(count_after) == len(count_before):
                    break
        await asyncio.sleep(0.5)

    logger.info("Backfill chat text digests complete.")


if __name__ == "__main__":
    asyncio.run(main())
