"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💬 COMMENTS SERVICE — Orchestration scraping + analyse Mistral                   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  API publique :                                                                    ║
║    fetch_comments(platform, video_id)                                              ║
║        → CommentsBatch (avec cache L1 Redis 24h cross-user)                       ║
║                                                                                    ║
║    generate_community_analysis(platform, video_id, plan, ...)                     ║
║        → CommunityTake | None (avec cache L1 par tier de plan)                    ║
║        Jamais bloquant : toute exception est catchée et loggée.                   ║
║                                                                                    ║
║    generate_community_analysis_with_timeout(...) ← wrapper 30s strict             ║
║        Utilisé par le pipeline v6/v2.1 dans le asyncio.gather.                    ║
║                                                                                    ║
║  Quota safety dédié : si MTD proxy > 700 MB, on skip le scrape silencieusement.   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
from typing import Optional

from core.logging import logger

from .cache import (
    cache_get_comments_batch,
    cache_get_take,
    cache_set_comments_batch,
    cache_set_take,
)
from .schemas import CommentsBatch, CommunityTake
from .take_generator import generate_community_take
from .tiktok_scraper import fetch_tiktok_comments as _fetch_tt
from .youtube_scraper import fetch_youtube_comments as _fetch_yt

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

COMMUNITY_TAKE_TIMEOUT_S = 30.0
COMMENTS_PROXY_SOFT_LIMIT_BYTES = 700 * 1024 * 1024  # 700 MB MTD soft limit (avant hard-stop 950 MB)

MIN_SAMPLED_FOR_TAKE = 10  # Sous ce seuil → insufficient_data


# ═══════════════════════════════════════════════════════════════════════════════
# 🧰 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def _plan_to_tier(plan: str) -> str:
    """Map user plan → tier de modèle Mistral (pour key cache + selection)."""
    return {"free": "small", "pro": "medium", "expert": "large"}.get(plan, "small")


async def _is_proxy_quota_exhausted() -> bool:
    """True si MTD proxy > 700 MB (soft limit dédié comments).

    Best-effort : si le check plante (DB indisponible) → False (fail-open,
    on tente le scrape, le hard-stop global 950 MB s'appliquera de toute façon).
    """
    try:
        from middleware.proxy_telemetry import get_mtd_bytes

        mtd = await get_mtd_bytes()
        return mtd > COMMENTS_PROXY_SOFT_LIMIT_BYTES
    except Exception as e:
        logger.debug(f"[COMMENTS] MTD check failed (fail-open): {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════


async def fetch_comments(
    platform: str,
    video_id: str,
    *,
    top_n: int = 100,
    random_n: int = 50,
) -> CommentsBatch:
    """Fetch + sampling avec cache cross-user L1 Redis (24h).

    Args:
        platform: "youtube" ou "tiktok".
        video_id: ID vidéo cross-platform.
        top_n: top likes.
        random_n: random bonus.

    Returns:
        CommentsBatch (peut être vide ou disabled).

    Note : si la quota proxy est dépassée → batch vide (disabled=False) pour
    laisser l'UI afficher "insufficient_data" plutôt qu'un faux "disabled".
    """
    # 1. Cache check
    cached = await cache_get_comments_batch(platform, video_id)
    if cached is not None:
        logger.info(f"[COMMENTS_CACHE_HIT] {platform}:{video_id} (sampled={len(cached.sampled)})")
        return cached

    # 2. Quota check
    if await _is_proxy_quota_exhausted():
        logger.warning(f"[COMMENTS] Proxy soft quota exceeded — skip scrape for {platform}:{video_id}")
        return CommentsBatch(
            platform=platform if platform in ("youtube", "tiktok") else "youtube",
            video_id=video_id,
            total_seen=0,
            sampled=[],
            disabled=False,
            bytes_used=0,
        )

    # 3. Dispatch scraper
    if platform == "youtube":
        batch = await _fetch_yt(video_id, top_n=top_n, random_n=random_n)
    elif platform == "tiktok":
        batch = await _fetch_tt(video_id, top_n=top_n, random_n=random_n)
    else:
        raise ValueError(f"Unsupported platform: {platform}")

    # 4. Cache write (best-effort, ne masque pas le résultat scrape).
    try:
        await cache_set_comments_batch(platform, video_id, batch)
    except Exception as e:
        logger.warning(f"[COMMENTS_CACHE_SET] failed for {platform}:{video_id}: {e}")

    return batch


async def generate_community_analysis(
    platform: str,
    video_id: str,
    *,
    plan: str,
    video_title: str,
    video_topic_hint: str = "",
    creator_stance: str = "",
    lang: str = "fr",
) -> Optional[CommunityTake]:
    """JAMAIS bloquant : toute exception est catchée et loggée → retourne None.

    Pipeline :
      1. fetch_comments(platform, video_id) → CommentsBatch
      2. Si disabled → CommunityTake(disabled=True)
      3. Si len(sampled) < MIN_SAMPLED_FOR_TAKE → CommunityTake(insufficient_data=True)
      4. cache check par tier de plan
      5. generate_community_take (Mistral JSON-mode)
      6. cache write par tier
    """
    try:
        batch = await fetch_comments(platform, video_id)

        if batch.disabled:
            return CommunityTake(
                agreement_signal="unclear",
                sentiment_distribution={"positive": 0.0, "neutral": 1.0, "negative": 0.0},
                controversies=[],
                community_summary="Les commentaires sont désactivés sur cette vidéo.",
                top_voices=[],
                comments_analyzed=0,
                model_used="none",
                disabled=True,
            )

        if len(batch.sampled) < MIN_SAMPLED_FOR_TAKE:
            return CommunityTake(
                agreement_signal="unclear",
                sentiment_distribution={
                    "positive": 0.34,
                    "neutral": 0.33,
                    "negative": 0.33,
                },
                controversies=[],
                community_summary=(f"Trop peu de commentaires ({len(batch.sampled)}) pour un verdict fiable."),
                top_voices=[],
                comments_analyzed=len(batch.sampled),
                model_used="none",
                insufficient_data=True,
            )

        plan_tier = _plan_to_tier(plan)

        cached_take = await cache_get_take(platform, video_id, plan_tier)
        if cached_take is not None:
            logger.info(f"[COMMUNITY_TAKE_CACHE_HIT] {platform}:{video_id}:{plan_tier}")
            return cached_take

        take = await generate_community_take(
            batch=batch,
            plan=plan,
            video_title=video_title,
            video_topic_hint=video_topic_hint,
            creator_stance=creator_stance,
            lang=lang,
        )

        if take is not None:
            try:
                await cache_set_take(platform, video_id, plan_tier, take)
            except Exception as e:
                logger.warning(f"[COMMUNITY_TAKE_CACHE_SET] failed for {platform}:{video_id}:{plan_tier}: {e}")

        return take

    except Exception as e:
        logger.error(
            f"[COMMUNITY_ANALYSIS] Failed for {platform}:{video_id}: {e}",
            exc_info=True,
        )
        return None


async def generate_community_analysis_with_timeout(
    platform: str,
    video_id: str,
    *,
    plan: str,
    video_title: str,
    video_topic_hint: str = "",
    creator_stance: str = "",
    lang: str = "fr",
    timeout_s: float = COMMUNITY_TAKE_TIMEOUT_S,
) -> Optional[CommunityTake]:
    """Wrapper non bloquant pour le pipeline v6/v2.1 — timeout strict 30s.

    Args:
        platform: "youtube" | "tiktok".
        video_id: ID vidéo.
        plan: "free" | "pro" | "expert".
        video_title: titre vidéo.
        video_topic_hint: extrait analyse pour grounding.
        creator_stance: position éventuelle du créateur.
        lang: "fr" | "en".
        timeout_s: timeout strict (défaut 30s).

    Returns:
        CommunityTake ou None si timeout / exception.
    """
    try:
        return await asyncio.wait_for(
            generate_community_analysis(
                platform=platform,
                video_id=video_id,
                plan=plan,
                video_title=video_title,
                video_topic_hint=video_topic_hint,
                creator_stance=creator_stance,
                lang=lang,
            ),
            timeout=timeout_s,
        )
    except asyncio.TimeoutError:
        logger.warning(f"[COMMUNITY_ANALYSIS] Timeout {timeout_s}s for {platform}:{video_id} — returning None")
        return None
    except Exception as e:
        logger.error(f"[COMMUNITY_ANALYSIS] Outer error for {platform}:{video_id}: {e}")
        return None


__all__ = [
    "COMMENTS_PROXY_SOFT_LIMIT_BYTES",
    "COMMUNITY_TAKE_TIMEOUT_S",
    "MIN_SAMPLED_FOR_TAKE",
    "fetch_comments",
    "generate_community_analysis",
    "generate_community_analysis_with_timeout",
]
