"""
Migrate existing thumbnails to Cloudflare R2.
Usage: cd backend/src && python -m scripts.migrate_thumbnails
"""

import asyncio
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary, async_session_maker
from storage.thumbnails import store_thumbnail_r2
from core.config import R2_CONFIG


async def migrate_existing_thumbnails(max_concurrent: int = 20, limit: int = 0):
    """Migrate all existing thumbnails to R2."""
    if not R2_CONFIG["ENABLED"]:
        print("❌ R2 is not enabled. Set R2_ENABLED=true and configure credentials.")
        return

    print(f"🔄 Starting thumbnail migration to R2...")
    print(f"   Bucket: {R2_CONFIG['BUCKET']}")
    print(f"   Domain: {R2_CONFIG['PUBLIC_DOMAIN']}")
    print(f"   Concurrency: {max_concurrent}")

    async with async_session_maker() as db:
        # Find summaries with non-R2 thumbnails
        domain = R2_CONFIG["PUBLIC_DOMAIN"]
        query = (
            select(Summary.id, Summary.video_id, Summary.thumbnail_url, Summary.platform)
            .where(Summary.thumbnail_url.isnot(None))
            .where(Summary.thumbnail_url != "")
            .where(Summary.platform != "text")
        )
        # Exclude already-migrated
        if domain:
            query = query.where(~Summary.thumbnail_url.like(f"%{domain}%"))

        if limit > 0:
            query = query.limit(limit)

        result = await db.execute(query)
        rows = result.all()

    total = len(rows)
    print(f"📊 Found {total} thumbnails to migrate")

    if total == 0:
        print("✅ Nothing to migrate!")
        return

    semaphore = asyncio.Semaphore(max_concurrent)
    success = 0
    failed = 0
    skipped = 0

    async def migrate_one(summary_id: int, video_id: str, original_url: str, platform: str):
        nonlocal success, failed, skipped
        async with semaphore:
            try:
                r2_url = await store_thumbnail_r2(video_id, original_url, platform or "youtube")
                if not r2_url:
                    skipped += 1
                    return

                # Update DB
                async with async_session_maker() as db:
                    await db.execute(
                        update(Summary)
                        .where(Summary.id == summary_id)
                        .values(thumbnail_url=r2_url)
                    )
                    await db.commit()

                success += 1
                if success % 50 == 0:
                    print(f"   ... {success}/{total} migrated")

            except Exception as e:
                failed += 1
                print(f"   ❌ Failed {video_id}: {e}")

    # Run all migrations
    tasks = [
        migrate_one(sid, vid, url, plat)
        for sid, vid, url, plat in rows
    ]
    await asyncio.gather(*tasks)

    print(f"\n✅ Migration complete!")
    print(f"   Success: {success}")
    print(f"   Skipped: {skipped}")
    print(f"   Failed:  {failed}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Migrate thumbnails to R2")
    parser.add_argument("--concurrent", type=int, default=20, help="Max concurrent uploads")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of thumbnails (0=all)")
    args = parser.parse_args()

    asyncio.run(migrate_existing_thumbnails(
        max_concurrent=args.concurrent,
        limit=args.limit,
    ))
