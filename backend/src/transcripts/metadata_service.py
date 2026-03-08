"""
Metadata Enrichment Service — Enrichit les entrées TranscriptCache
avec les métadonnées vidéo/chaîne (vues, likes, subscribers, etc.)

Triggered automatically after save_transcript_to_cache().
Also provides a backfill function for existing entries.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import async_session_maker, TranscriptCache

logger = logging.getLogger(__name__)

# Keys to strip from raw yt-dlp dump (too large / not useful)
_STRIP_KEYS = {
    "formats", "thumbnails", "automatic_captions", "subtitles",
    "requested_formats", "requested_subtitles", "requested_downloads",
    "url", "manifest_url", "fragment_base_url", "fragments",
}


def _clean_raw_data(data: dict) -> dict:
    """Strip large/useless keys from raw yt-dlp data for storage."""
    return {k: v for k, v in data.items() if k not in _STRIP_KEYS}


async def enrich_metadata(video_id: str, platform: str = "youtube") -> bool:
    """
    Enrich a cached transcript entry with video/channel metadata.

    Idempotent: skips if already enriched within the last 24 hours.
    Non-blocking: meant to be called via asyncio.create_task().

    Returns True if enriched, False if skipped or failed.
    """
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(TranscriptCache).where(TranscriptCache.video_id == video_id)
            )
            entry = result.scalar_one_or_none()
            if not entry:
                logger.warning(f"[METADATA] Entry not found for {video_id}")
                return False

            # Skip if already enriched < 24h ago
            if entry.metadata_enriched_at:
                age = datetime.utcnow() - entry.metadata_enriched_at
                if age < timedelta(hours=24):
                    logger.info(f"[METADATA] Skip {video_id} (enriched {age.total_seconds()/3600:.1f}h ago)")
                    return False

            # Fetch metadata based on platform
            info = await _fetch_metadata(video_id, platform)
            if not info:
                logger.warning(f"[METADATA] No metadata fetched for {video_id} ({platform})")
                return False

            # Update entry
            entry.view_count = info.get("view_count")
            entry.like_count = info.get("like_count")
            entry.comment_count = info.get("comment_count")
            entry.upload_date = info.get("upload_date")
            entry.description = (info.get("description") or "")[:2000] or None
            entry.language = info.get("language")
            entry.channel_id = info.get("channel_id")
            entry.channel_url = info.get("channel_url")
            entry.channel_follower_count = info.get("channel_follower_count")
            entry.metadata_enriched_at = datetime.utcnow()

            # Tags as JSON
            tags = info.get("tags")
            if tags and isinstance(tags, list):
                entry.tags_json = json.dumps(tags[:50], ensure_ascii=False)

            # Also update basic metadata if missing
            if info.get("title") and not entry.video_title:
                entry.video_title = info["title"][:500]
            if info.get("channel") and not entry.video_channel:
                entry.video_channel = info["channel"][:255]
            if info.get("thumbnail_url") and not entry.thumbnail_url:
                entry.thumbnail_url = info["thumbnail_url"]
            if info.get("duration") and not entry.video_duration:
                entry.video_duration = info["duration"]
            if info.get("categories") and not entry.category:
                cats = info["categories"]
                entry.category = cats[0] if isinstance(cats, list) and cats else None

            # Raw dump (cleaned)
            raw_data = info.get("_raw")
            if raw_data:
                entry.metadata_json = json.dumps(
                    _clean_raw_data(raw_data), ensure_ascii=False, default=str
                )[:50000]  # Cap at 50KB

            await session.commit()
            logger.info(
                f"[METADATA] Enriched {video_id}: "
                f"views={entry.view_count}, likes={entry.like_count}, "
                f"subscribers={entry.channel_follower_count}"
            )
            return True

    except Exception as e:
        logger.error(f"[METADATA] Error enriching {video_id}: {e}")
        return False


async def _fetch_metadata(video_id: str, platform: str) -> Optional[dict]:
    """Fetch metadata from the appropriate platform."""
    if platform == "tiktok" or video_id.startswith("tiktok_"):
        return await _fetch_tiktok_metadata(video_id)
    else:
        return await _fetch_youtube_metadata(video_id)


async def _fetch_youtube_metadata(video_id: str) -> Optional[dict]:
    """Fetch YouTube metadata via yt-dlp (rich) with Invidious fallback."""
    try:
        from transcripts.youtube import get_video_info_ytdlp, get_video_info

        # Primary: yt-dlp (richer data, includes channel_follower_count)
        info = await get_video_info_ytdlp(video_id)
        if info and info.get("title") != "Unknown Video":
            # Also get raw data for metadata_json
            raw = await _get_raw_ytdlp_data(video_id)
            if raw:
                info["_raw"] = raw
            return info

        # Fallback: Invidious
        info = await get_video_info(video_id)
        if info and info.get("title") != "Unknown Video":
            return info

    except Exception as e:
        logger.error(f"[METADATA] YouTube fetch error for {video_id}: {e}")

    return None


async def _fetch_tiktok_metadata(video_id: str) -> Optional[dict]:
    """Fetch TikTok metadata via yt-dlp."""
    try:
        from transcripts.tiktok import get_tiktok_video_info

        # Strip tiktok_ prefix for URL construction
        clean_id = video_id.replace("tiktok_", "")
        url = f"https://www.tiktok.com/video/{clean_id}"

        info = await get_tiktok_video_info(url)
        return info

    except Exception as e:
        logger.error(f"[METADATA] TikTok fetch error for {video_id}: {e}")

    return None


async def _get_raw_ytdlp_data(video_id: str) -> Optional[dict]:
    """Get raw yt-dlp JSON dump for storage (runs in executor)."""
    import subprocess

    try:
        loop = asyncio.get_event_loop()

        def _dump():
            cmd = [
                "yt-dlp", "--dump-json", "--no-warnings", "--skip-download",
                "--no-playlist",
                f"https://youtube.com/watch?v={video_id}"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                return json.loads(result.stdout)
            return None

        from concurrent.futures import ThreadPoolExecutor
        executor = ThreadPoolExecutor(max_workers=1)
        data = await loop.run_in_executor(executor, _dump)
        return data

    except Exception as e:
        logger.warning(f"[METADATA] Raw dump failed for {video_id}: {e}")
        return None


async def backfill_missing_metadata(
    limit: int = 50,
    platform: Optional[str] = None,
) -> dict:
    """
    Backfill metadata for cached entries that haven't been enriched yet.
    Admin endpoint helper.

    Args:
        limit: Max entries to process
        platform: Optional filter ("youtube" or "tiktok")

    Returns:
        {"processed": int, "enriched": int, "failed": int}
    """
    processed = 0
    enriched = 0
    failed = 0

    try:
        async with async_session_maker() as session:
            query = (
                select(TranscriptCache.video_id, TranscriptCache.platform)
                .where(TranscriptCache.metadata_enriched_at.is_(None))
                .order_by(TranscriptCache.created_at.desc())
                .limit(limit)
            )
            if platform:
                query = query.where(TranscriptCache.platform == platform)

            result = await session.execute(query)
            entries = result.all()

        for vid, plat in entries:
            processed += 1
            try:
                success = await enrich_metadata(vid, plat)
                if success:
                    enriched += 1
                else:
                    failed += 1
            except Exception as e:
                logger.error(f"[METADATA] Backfill error for {vid}: {e}")
                failed += 1

            # Sleep between requests to avoid rate limiting
            if processed < len(entries):
                await asyncio.sleep(2)

        logger.info(
            f"[METADATA] Backfill done: processed={processed}, "
            f"enriched={enriched}, failed={failed}"
        )

    except Exception as e:
        logger.error(f"[METADATA] Backfill error: {e}")

    return {"processed": processed, "enriched": enriched, "failed": failed}
