"""
+---------------------------------------------------------------------+
|  Transcript Cache Service — L1 (Redis) + L2 (PostgreSQL)            |
|                                                                      |
|  L1: Redis via core.cache.cache_service (TTL 24h, volatile)         |
|  L2: PostgreSQL via transcripts.cache_db (persistent, cross-user)   |
|                                                                      |
|  Flow:                                                               |
|    GET:                                                              |
|      - Try L1 (Redis) → hit: return payload                          |
|      - Miss → try L2 (DB) → hit: warm L1, return payload             |
|      - Miss → None                                                   |
|    SET:                                                              |
|      - Write DB (L2, authoritative) via cache_db.save_transcript…    |
|      - Write Redis (L1, best-effort) via cache_service.set           |
|    INVALIDATE:                                                       |
|      - DEL Redis (L1)                                                |
|      - DELETE row in DB (L2)                                         |
|                                                                      |
|  This service is a thin orchestrator: it DOES NOT duplicate the     |
|  chunked-storage logic of cache_db.py. TranscriptCacheChunk remains  |
|  entirely managed by cache_db.save_transcript_to_cache.              |
+---------------------------------------------------------------------+
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Literal, Optional, Tuple

logger = logging.getLogger(__name__)

# L1 TTL — 24h matches DEFAULT_TTLS["transcript"] in core.cache
L1_TTL_SECONDS = 86400

Platform = Literal["youtube", "tiktok"]


# ---------------------------------------------------------------------------
# Lazy imports (core.cache + cache_db may be unavailable in minimal envs)
# ---------------------------------------------------------------------------

def _get_cache_service():
    """Return (cache_service, make_cache_key, transcript_metrics) or (None, None, None)."""
    try:
        from core.cache import cache_service, make_cache_key, transcript_metrics
        return cache_service, make_cache_key, transcript_metrics
    except ImportError:
        return None, None, None


def _get_db_cache():
    """Return (get_cached_transcript, save_transcript_to_cache) or (None, None)."""
    try:
        from transcripts.cache_db import get_cached_transcript, save_transcript_to_cache
        return get_cached_transcript, save_transcript_to_cache
    except ImportError:
        return None, None


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class TranscriptCacheService:
    """
    Orchestrator for L1 (Redis) + L2 (PostgreSQL) transcript cache.

    Usage:
        service = TranscriptCacheService()
        payload = await service.get(video_id, platform="youtube")
        if payload is None:
            simple, timestamped, lang = await extract_transcript(...)
            await service.set(video_id, simple, timestamped, lang, platform="youtube")
    """

    #: L1 key namespace (flat key, `cache_service` prefixes with `deepsight:` in Redis)
    L1_NAMESPACE = "transcript"

    # -----------------------------------------------------------------
    # Key helpers
    # -----------------------------------------------------------------

    @classmethod
    def _l1_key(cls, video_id: str, platform: str) -> str:
        """
        Build the L1 cache key.

        Historical compat: youtube videos use key `transcript:<video_id>` (no
        platform segment) because that is how the pre-existing inline cache
        stored them. TikTok uses a prefixed id (`tiktok_<vid>`) upstream so the
        key remains `transcript:tiktok_<vid>`.
        """
        _, make_cache_key, _ = _get_cache_service()
        if make_cache_key is not None:
            return make_cache_key(cls.L1_NAMESPACE, video_id)
        # Fallback string form (used only if core.cache is unimportable)
        return f"{cls.L1_NAMESPACE}:{video_id}"

    @staticmethod
    def _db_key(video_id: str, platform: str) -> str:
        """
        The DB cache keys TikTok entries with a `tiktok_` prefix on `video_id`
        (see cache_db.py usage in transcripts/tiktok.py). Callers are expected
        to pass that prefixed id already (historical behaviour preserved).
        """
        return video_id

    # -----------------------------------------------------------------
    # GET
    # -----------------------------------------------------------------

    async def get(
        self,
        video_id: str,
        platform: Platform = "youtube",
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve a cached transcript.

        Returns a dict `{simple, timestamped, lang}` or `None` on cache miss.
        """
        cache_service, _, metrics = _get_cache_service()
        get_cached_transcript, _ = _get_db_cache()

        l1_key = self._l1_key(video_id, platform)

        # ── L1 ────────────────────────────────────────────────────────
        if cache_service is not None:
            try:
                payload = await cache_service.get(l1_key)
                if payload and isinstance(payload, dict) and payload.get("simple"):
                    logger.debug(f"[TRANSCRIPT-CACHE] L1 hit for {video_id}")
                    if metrics is not None:
                        try:
                            await metrics.increment("l1_hits")
                        except Exception:
                            pass
                    return {
                        "simple": payload.get("simple"),
                        "timestamped": payload.get("timestamped"),
                        "lang": payload.get("lang"),
                    }
            except Exception as exc:
                logger.warning(f"[TRANSCRIPT-CACHE] L1 read failed for {video_id}: {exc}")

        # ── L2 ────────────────────────────────────────────────────────
        if get_cached_transcript is None:
            return None

        try:
            db_hit = await get_cached_transcript(self._db_key(video_id, platform))
        except Exception as exc:
            logger.warning(f"[TRANSCRIPT-CACHE] L2 read failed for {video_id}: {exc}")
            return None

        if not db_hit:
            if metrics is not None:
                try:
                    await metrics.increment("misses")
                except Exception:
                    pass
            return None

        simple, timestamped, lang = db_hit
        payload = {"simple": simple, "timestamped": timestamped, "lang": lang}

        if metrics is not None:
            try:
                await metrics.increment("l2_hits")
            except Exception:
                pass

        # ── Warm L1 (best-effort) ────────────────────────────────────
        if cache_service is not None:
            try:
                await cache_service.set(l1_key, payload, ttl=L1_TTL_SECONDS)
                logger.debug(f"[TRANSCRIPT-CACHE] L1 warmed from L2 for {video_id}")
            except Exception as exc:
                logger.warning(f"[TRANSCRIPT-CACHE] L1 warm failed for {video_id}: {exc}")

        return payload

    # -----------------------------------------------------------------
    # SET
    # -----------------------------------------------------------------

    async def set(
        self,
        video_id: str,
        simple: str,
        timestamped: Optional[str],
        lang: Optional[str],
        platform: Platform = "youtube",
        extraction_method: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        video_title: Optional[str] = None,
        video_channel: Optional[str] = None,
        video_duration: Optional[int] = None,
        category: Optional[str] = None,
    ) -> bool:
        """
        Persist a transcript in L2 (DB, authoritative) and L1 (Redis, best-effort).

        Returns True if the DB write succeeded, False otherwise. L1 write
        failures never fail the call.
        """
        if not simple:
            return False

        cache_service, _, _ = _get_cache_service()
        _, save_transcript_to_cache = _get_db_cache()

        # ── L2 (authoritative) ───────────────────────────────────────
        db_ok = False
        if save_transcript_to_cache is not None:
            try:
                db_ok = await save_transcript_to_cache(
                    video_id=video_id,
                    simple=simple,
                    timestamped=timestamped,
                    lang=lang,
                    platform=platform,
                    extraction_method=extraction_method,
                    thumbnail_url=thumbnail_url,
                    video_title=video_title,
                    video_channel=video_channel,
                    video_duration=video_duration,
                    category=category,
                )
            except Exception as exc:
                logger.warning(f"[TRANSCRIPT-CACHE] L2 write failed for {video_id}: {exc}")
                db_ok = False

        # ── L1 (best-effort) ─────────────────────────────────────────
        if cache_service is not None:
            try:
                l1_key = self._l1_key(video_id, platform)
                payload = {"simple": simple, "timestamped": timestamped, "lang": lang}
                await cache_service.set(l1_key, payload, ttl=L1_TTL_SECONDS)
                logger.debug(f"[TRANSCRIPT-CACHE] L1 written for {video_id}")
            except Exception as exc:
                logger.warning(f"[TRANSCRIPT-CACHE] L1 write failed for {video_id}: {exc}")

        return db_ok

    # -----------------------------------------------------------------
    # INVALIDATE
    # -----------------------------------------------------------------

    async def invalidate(
        self,
        video_id: str,
        platform: Platform = "youtube",
    ) -> None:
        """
        Invalidate both cache tiers for a given video.
        Used when a forced re-extraction is requested.
        """
        cache_service, _, _ = _get_cache_service()

        # L1 invalidation (best-effort)
        if cache_service is not None:
            try:
                await cache_service.delete(self._l1_key(video_id, platform))
                logger.debug(f"[TRANSCRIPT-CACHE] L1 invalidated for {video_id}")
            except Exception as exc:
                logger.warning(f"[TRANSCRIPT-CACHE] L1 invalidate failed for {video_id}: {exc}")

        # L2 invalidation (authoritative)
        try:
            from sqlalchemy import select, delete
            from db.database import (
                async_session_maker,
                TranscriptCache,
                TranscriptCacheChunk,
            )
        except ImportError:
            return

        try:
            async with async_session_maker() as session:
                result = await session.execute(
                    select(TranscriptCache).where(TranscriptCache.video_id == video_id)
                )
                entry = result.scalar_one_or_none()
                if entry is None:
                    return
                await session.execute(
                    delete(TranscriptCacheChunk).where(
                        TranscriptCacheChunk.cache_id == entry.id
                    )
                )
                await session.delete(entry)
                await session.commit()
                logger.info(f"[TRANSCRIPT-CACHE] L2 row deleted for {video_id}")
        except Exception as exc:
            logger.warning(f"[TRANSCRIPT-CACHE] L2 invalidate failed for {video_id}: {exc}")


# -----------------------------------------------------------------------------
# Singleton — usage pattern: `from transcripts.cache import transcript_cache`
# -----------------------------------------------------------------------------

transcript_cache = TranscriptCacheService()


# -----------------------------------------------------------------------------
# Back-compat convenience functions (tuple-returning, mirror cache_db API)
# -----------------------------------------------------------------------------

async def get_transcript_cached(
    video_id: str,
    platform: Platform = "youtube",
) -> Optional[Tuple[str, str, str]]:
    """
    Tuple-style wrapper mirroring `cache_db.get_cached_transcript` for call
    sites that prefer the legacy shape. Returns (simple, timestamped, lang)
    or None.
    """
    payload = await transcript_cache.get(video_id, platform=platform)
    if payload is None:
        return None
    simple = payload.get("simple")
    if not simple:
        return None
    timestamped = payload.get("timestamped") or simple
    lang = payload.get("lang")
    return simple, timestamped, lang


async def save_transcript_cached(
    video_id: str,
    simple: str,
    timestamped: Optional[str],
    lang: Optional[str],
    platform: Platform = "youtube",
    extraction_method: Optional[str] = None,
    thumbnail_url: Optional[str] = None,
) -> bool:
    """Tuple-style wrapper mirroring `cache_db.save_transcript_to_cache`."""
    return await transcript_cache.set(
        video_id=video_id,
        simple=simple,
        timestamped=timestamped,
        lang=lang,
        platform=platform,
        extraction_method=extraction_method,
        thumbnail_url=thumbnail_url,
    )


__all__ = [
    "TranscriptCacheService",
    "transcript_cache",
    "get_transcript_cached",
    "save_transcript_cached",
    "L1_TTL_SECONDS",
]
