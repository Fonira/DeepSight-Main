"""Backfill digests for voice_sessions that ended before the digest hook
was deployed (digest_text IS NULL but messages exist).

Run: cd backend && python -m scripts.backfill_voice_session_digests

Batch by 50 sessions, sleep 1s between batches to respect Mistral rate limit.
"""
import asyncio
import logging
from sqlalchemy import select

from db.database import VoiceSession, async_session_factory, ChatMessage
from voice.context_digest import generate_voice_session_digest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backfill_voice")

BATCH_SIZE = 50
SLEEP_BETWEEN_BATCHES_S = 1.0


async def main():
    async with async_session_factory() as db:
        sessions_to_process = (
            await db.execute(
                select(VoiceSession.id)
                .where(VoiceSession.digest_text.is_(None))
                .where(
                    VoiceSession.id.in_(
                        select(ChatMessage.voice_session_id)
                        .where(ChatMessage.voice_session_id.isnot(None))
                        .distinct()
                    )
                )
            )
        ).scalars().all()
    logger.info("Found %d voice sessions to backfill", len(sessions_to_process))

    for i in range(0, len(sessions_to_process), BATCH_SIZE):
        batch = sessions_to_process[i : i + BATCH_SIZE]
        async with async_session_factory() as db:
            for sid in batch:
                try:
                    await generate_voice_session_digest(db, sid)
                except Exception as exc:
                    logger.warning("backfill skipped sid=%s err=%s", sid, exc)
        logger.info("Batch %d/%d done", i // BATCH_SIZE + 1, (len(sessions_to_process) + BATCH_SIZE - 1) // BATCH_SIZE)
        await asyncio.sleep(SLEEP_BETWEEN_BATCHES_S)

    logger.info("Backfill voice digests complete.")


if __name__ == "__main__":
    asyncio.run(main())
