"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💾 COMMENTS CACHE — Redis L1 cross-user (24h)                                     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Clés Redis :                                                                      ║
║    vcache:comments:{platform}:{video_id}                  → CommentsBatch (24h)   ║
║    vcache:community_take:{platform}:{video_id}:{tier}     → CommunityTake (24h)   ║
║                                                                                    ║
║  Invariants :                                                                      ║
║    - CommentsBatch est cross-user (les commentaires sont identiques pour tous).   ║
║    - CommunityTake varie par plan tier (small/medium/large) → 3 versions max.     ║
║                                                                                    ║
║  Le L2 PG est implicite via Summary.community_analysis JSONB (alembic 029).       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

from core.cache import cache_service

from .schemas import CommentsBatch, CommunityTake

COMMENTS_TTL_S = 86400  # 24h L1
TAKE_TTL_S = 86400  # 24h L1


def _comments_key(platform: str, video_id: str) -> str:
    return f"vcache:comments:{platform}:{video_id}"


def _take_key(platform: str, video_id: str, tier: str) -> str:
    return f"vcache:community_take:{platform}:{video_id}:{tier}"


async def cache_get_comments_batch(platform: str, video_id: str) -> CommentsBatch | None:
    """Lit le CommentsBatch cross-user depuis le cache Redis."""
    raw = await cache_service.get(_comments_key(platform, video_id))
    if not raw:
        return None
    try:
        return CommentsBatch.model_validate(raw)
    except Exception:
        # Schéma incompatible (vieille forme cachée) → on traite comme un miss.
        return None


async def cache_set_comments_batch(platform: str, video_id: str, batch: CommentsBatch) -> None:
    """Écrit le CommentsBatch dans le cache (TTL 24h)."""
    await cache_service.set(
        _comments_key(platform, video_id),
        batch.model_dump(mode="json"),
        ttl=COMMENTS_TTL_S,
    )


async def cache_get_take(platform: str, video_id: str, tier: str) -> CommunityTake | None:
    """Lit la CommunityTake (par tier de plan) depuis le cache Redis."""
    raw = await cache_service.get(_take_key(platform, video_id, tier))
    if not raw:
        return None
    try:
        return CommunityTake.model_validate(raw)
    except Exception:
        return None


async def cache_set_take(platform: str, video_id: str, tier: str, take: CommunityTake) -> None:
    """Écrit la CommunityTake (par tier de plan) dans le cache (TTL 24h)."""
    await cache_service.set(
        _take_key(platform, video_id, tier),
        take.model_dump(mode="json"),
        ttl=TAKE_TTL_S,
    )


async def invalidate_community_cache(platform: str, video_id: str) -> int:
    """Admin endpoint helper : invalide comments + 3 tiers de take.

    Returns:
        Nombre de clés effectivement supprimées (0 à 4).
    """
    keys = [
        _comments_key(platform, video_id),
        _take_key(platform, video_id, "small"),
        _take_key(platform, video_id, "medium"),
        _take_key(platform, video_id, "large"),
    ]
    deleted = 0
    for k in keys:
        if await cache_service.delete(k):
            deleted += 1
    return deleted


__all__ = [
    "COMMENTS_TTL_S",
    "TAKE_TTL_S",
    "cache_get_comments_batch",
    "cache_set_comments_batch",
    "cache_get_take",
    "cache_set_take",
    "invalidate_community_cache",
]
