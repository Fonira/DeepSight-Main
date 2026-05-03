"""
+---------------------------------------------------------------------+
|  ChannelContentCacheService — Cache 2-tiers L1 (Redis) + L2 (PG)    |
|                                                                      |
|  Cache du contexte de chaîne (YouTube/TikTok), cross-user.          |
|                                                                      |
|  Pattern (cf. ``transcripts/cache.py`` pour l'inspiration) :        |
|    GET:                                                              |
|      - Try L1 (Redis via core.cache.cache_service) → hit: return    |
|      - Miss → try L2 (table channel_contexts via async_session_maker)|
|        - HIT + expires_at > now → warm L1, return                   |
|        - HIT + expires_at <= now → fall through                     |
|      - Miss → call get_channel_context / get_tiktok_account_context |
|      - Service OK (dict) → upsert L2 + L1 → return                  |
|      - Service KO (None) → return None (NE PAS cacher les échecs)   |
|                                                                      |
|  Clé Redis L1 : ``vcache:channel_context:{platform}:{channel_id}``  |
|  TTL Redis L1 + PG L2 : 7 jours.                                    |
|                                                                      |
|  Note ``CACHE_KEY_PREFIX`` : on garde le préfixe ``vcache:`` cohérent|
|  avec ``video_content_cache.py`` et la note de cache cross-user.    |
+---------------------------------------------------------------------+
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import ChannelContext, async_session_maker

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constantes publiques
# ---------------------------------------------------------------------------

#: TTL appliqué à la fois sur Redis L1 et sur la colonne ``expires_at`` (PG L2).
CHANNEL_CONTEXT_TTL_SECONDS: int = 7 * 24 * 3600  # 7 jours

#: Préfixe de clé cohérent avec ``video_content_cache.py`` (``vcache:...``).
CACHE_KEY_PREFIX: str = "vcache:channel_context"

#: Plateformes supportées (alignées sur ``CHECK`` constraint en DB).
_SUPPORTED_PLATFORMS = ("youtube", "tiktok")


# ---------------------------------------------------------------------------
# Helpers de clé
# ---------------------------------------------------------------------------


def build_channel_cache_key(platform: str, channel_id: str) -> str:
    """Construit la clé Redis L1 pour un (platform, channel_id).

    Exemple :
        >>> build_channel_cache_key("youtube", "UCabc")
        'vcache:channel_context:youtube:UCabc'
    """
    return f"{CACHE_KEY_PREFIX}:{platform}:{channel_id}"


# ---------------------------------------------------------------------------
# Lazy imports — Redis (core.cache) + services fetch
#
# On importe lazy pour :
#   - éviter les circular imports (transcripts/* dépendent déjà de core/*) ;
#   - permettre aux tests de monkeypatch facilement les helpers ci-dessous
#     sans devoir patcher ``core.cache.cache_service`` au global.
# ---------------------------------------------------------------------------


def _get_cache_service():
    """Retourne ``core.cache.cache_service`` ou ``None`` si indispo."""
    try:
        from core.cache import cache_service

        return cache_service
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Redis L1 helpers
# ---------------------------------------------------------------------------


async def get_channel_context_from_redis(
    platform: str, channel_id: str
) -> Optional[Dict[str, Any]]:
    """Lit le contexte chaîne depuis Redis L1.

    Retourne ``None`` sur miss, sur erreur Redis, ou si la valeur stockée
    n'est pas un dict valide.
    """
    cache_service = _get_cache_service()
    if cache_service is None:
        return None

    key = build_channel_cache_key(platform, channel_id)
    try:
        value = await cache_service.get(key)
    except Exception as exc:  # noqa: BLE001 — best-effort cache layer
        logger.warning("[CHANNEL-CACHE] Redis GET failed key=%s: %s", key, exc)
        return None

    if value is None:
        return None
    if not isinstance(value, dict):
        logger.warning(
            "[CHANNEL-CACHE] Redis stored a non-dict value at key=%s (type=%s) — ignoring",
            key,
            type(value).__name__,
        )
        return None
    return value


async def set_channel_context_to_redis(
    platform: str, channel_id: str, ctx: Dict[str, Any]
) -> None:
    """Écrit le contexte chaîne dans Redis L1 avec TTL 7 jours."""
    cache_service = _get_cache_service()
    if cache_service is None:
        return

    key = build_channel_cache_key(platform, channel_id)
    try:
        await cache_service.set(key, ctx, ttl=CHANNEL_CONTEXT_TTL_SECONDS)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[CHANNEL-CACHE] Redis SET failed key=%s: %s", key, exc)


# ---------------------------------------------------------------------------
# PostgreSQL L2 helpers (via SQLAlchemy + ChannelContext model)
# ---------------------------------------------------------------------------


def _row_to_dict(row: ChannelContext) -> Dict[str, Any]:
    """Convertit une ligne ``ChannelContext`` en dict au shape unifié.

    Aligné avec ``transcripts/youtube_channel.get_channel_context`` et
    ``transcripts/tiktok.get_tiktok_account_context``.
    """
    return {
        "channel_id": row.channel_id,
        "platform": row.platform,
        "name": row.name,
        "description": row.description,
        "subscriber_count": row.subscriber_count,
        "video_count": row.video_count,
        "tags": list(row.tags) if row.tags is not None else [],
        "categories": list(row.categories) if row.categories is not None else [],
        "last_videos": list(row.last_videos) if row.last_videos is not None else [],
    }


def _utcnow_naive() -> datetime:
    """``datetime.utcnow()`` sans tz (cohérent avec le pattern test_channel_contexts).

    SQLite stocke ``DateTime(timezone=True)`` sans tz info native ; on
    travaille donc en UTC naïf pour rester portable PG / SQLite dans le
    cadre des tests.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def get_channel_context_from_db(
    platform: str,
    channel_id: str,
    *,
    session: Optional[AsyncSession] = None,
) -> Optional[Dict[str, Any]]:
    """Lit le contexte chaîne depuis PG L2 (table ``channel_contexts``).

    Retourne le dict reconstruit si :
        - la ligne existe
        - ``expires_at > now``  (TTL non expiré)

    Retourne ``None`` sinon (miss / expiré / erreur DB).

    ``session`` peut être injectée (utile pour les tests). Sinon une
    nouvelle session est ouverte via ``async_session_maker()``.
    """

    async def _read(s: AsyncSession) -> Optional[Dict[str, Any]]:
        result = await s.execute(
            select(ChannelContext).where(
                ChannelContext.channel_id == channel_id,
                ChannelContext.platform == platform,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None

        # TTL check — expires_at > now ?
        expires = row.expires_at
        if expires is None:
            return None
        # Normaliser en datetime naïf UTC pour comparaison portable
        if isinstance(expires, datetime) and expires.tzinfo is not None:
            expires = expires.astimezone(timezone.utc).replace(tzinfo=None)

        if expires <= _utcnow_naive():
            logger.debug(
                "[CHANNEL-CACHE] L2 expired for %s/%s (expires_at=%s)",
                platform,
                channel_id,
                expires,
            )
            return None

        return _row_to_dict(row)

    try:
        if session is not None:
            return await _read(session)
        async with async_session_maker() as s:
            return await _read(s)
    except Exception as exc:  # noqa: BLE001 — défense en profondeur
        logger.warning(
            "[CHANNEL-CACHE] L2 read failed for %s/%s: %s", platform, channel_id, exc
        )
        return None


async def upsert_channel_context_to_db(
    platform: str,
    channel_id: str,
    ctx: Dict[str, Any],
    ttl_seconds: int = CHANNEL_CONTEXT_TTL_SECONDS,
    *,
    session: Optional[AsyncSession] = None,
) -> None:
    """Upsert atomique dans la table ``channel_contexts``.

    Pattern ``INSERT ... ON CONFLICT (channel_id, platform) DO UPDATE`` via
    ``sqlalchemy.dialects.sqlite.insert`` (compatible avec le pattern de
    ``test_channel_contexts.py``). Sur PostgreSQL en prod, l'identifiant de
    conflit ``(channel_id, platform)`` correspond à la PK composite — un
    upsert via ``sqlite_insert`` produit du SQL incorrect sous PG, donc on
    branche selon le dialecte de la session.

    ``fetched_at`` et ``expires_at`` sont **toujours explicitement** posés
    par cette fonction (jamais laissés au server_default), pour rester
    déterministes vis-à-vis du TTL caller-controlled.
    """
    now = _utcnow_naive()
    expires = now + timedelta(seconds=ttl_seconds)

    values = {
        "channel_id": channel_id,
        "platform": platform,
        "name": ctx.get("name"),
        "description": ctx.get("description"),
        "subscriber_count": ctx.get("subscriber_count"),
        "video_count": ctx.get("video_count"),
        "tags": ctx.get("tags") or [],
        "categories": ctx.get("categories") or [],
        "last_videos": ctx.get("last_videos") or [],
        "fetched_at": now,
        "expires_at": expires,
    }

    async def _write(s: AsyncSession) -> None:
        dialect_name = s.bind.dialect.name if s.bind is not None else "sqlite"

        if dialect_name == "postgresql":
            from sqlalchemy.dialects.postgresql import insert as pg_insert

            stmt = pg_insert(ChannelContext.__table__).values(**values)
            stmt = stmt.on_conflict_do_update(
                index_elements=["channel_id", "platform"],
                set_={
                    "name": stmt.excluded.name,
                    "description": stmt.excluded.description,
                    "subscriber_count": stmt.excluded.subscriber_count,
                    "video_count": stmt.excluded.video_count,
                    "tags": stmt.excluded.tags,
                    "categories": stmt.excluded.categories,
                    "last_videos": stmt.excluded.last_videos,
                    "fetched_at": stmt.excluded.fetched_at,
                    "expires_at": stmt.excluded.expires_at,
                },
            )
        else:
            # SQLite (tests + dev local) — même API ON CONFLICT
            stmt = sqlite_insert(ChannelContext.__table__).values(**values)
            stmt = stmt.on_conflict_do_update(
                index_elements=["channel_id", "platform"],
                set_={
                    "name": stmt.excluded.name,
                    "description": stmt.excluded.description,
                    "subscriber_count": stmt.excluded.subscriber_count,
                    "video_count": stmt.excluded.video_count,
                    "tags": stmt.excluded.tags,
                    "categories": stmt.excluded.categories,
                    "last_videos": stmt.excluded.last_videos,
                    "fetched_at": stmt.excluded.fetched_at,
                    "expires_at": stmt.excluded.expires_at,
                },
            )

        await s.execute(stmt)
        await s.commit()

    try:
        if session is not None:
            await _write(session)
            return
        async with async_session_maker() as s:
            await _write(s)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[CHANNEL-CACHE] L2 upsert failed for %s/%s: %s",
            platform,
            channel_id,
            exc,
        )


# ---------------------------------------------------------------------------
# Service fetch (lazy import — évite cycles + accélère startup)
# ---------------------------------------------------------------------------


async def _fetch_from_service(
    platform: str, channel_id: str, *, limit: int
) -> Optional[Dict[str, Any]]:
    """Appelle le service fetch sous-jacent selon la plateforme."""
    if platform == "youtube":
        from transcripts.youtube_channel import get_channel_context  # lazy

        return await get_channel_context(channel_id, limit=limit)
    if platform == "tiktok":
        from transcripts.tiktok import get_tiktok_account_context  # lazy

        return await get_tiktok_account_context(channel_id, limit=limit)

    logger.warning("[CHANNEL-CACHE] Unsupported platform=%s", platform)
    return None


# ---------------------------------------------------------------------------
# API publique — get_or_fetch_channel_context
# ---------------------------------------------------------------------------


async def get_or_fetch_channel_context(
    platform: str,
    channel_id: str,
    *,
    force_refresh: bool = False,
    limit: int = 50,
    session: Optional[AsyncSession] = None,
) -> Optional[Dict[str, Any]]:
    """Récupère le contexte chaîne avec cache 2-tiers Redis L1 + PG L2.

    Stratégie :
        1. Si ``force_refresh=False`` → check Redis L1
            - HIT → return dict
        2. Check PG L2 (table ``channel_contexts``)
            - HIT + ``expires_at > now`` → populate Redis L1 + return
            - HIT + ``expires_at <= now`` → considéré comme miss
        3. Miss complet → appelle ``get_channel_context`` (yt) ou
           ``get_tiktok_account_context`` (tt)
            - Service OK (dict) → upsert PG L2 + set Redis L1 → return
            - Service KO (None) → return None (PAS de cache négatif)

    Si ``force_refresh=True``, on saute L1 ET L2 et on tape directement le
    service pour rafraîchir le cache.

    Args:
        platform: ``"youtube"`` ou ``"tiktok"``.
        channel_id: ID YouTube canonique (``UCxxx``) / handle (``@xxx``)
            pour YouTube, OU username TikTok pour TikTok.
        force_refresh: si ``True``, ignore les caches et rafraîchit.
        limit: nombre max de vidéos récentes à fetcher (défaut 50).
        session: session DB optionnelle (utile pour tests).

    Returns:
        Le dict au shape unifié ou ``None`` si fetch raté.
    """
    if not platform or platform not in _SUPPORTED_PLATFORMS:
        logger.warning("[CHANNEL-CACHE] Invalid platform=%r", platform)
        return None
    if not channel_id or not isinstance(channel_id, str):
        logger.warning("[CHANNEL-CACHE] Invalid channel_id=%r", channel_id)
        return None

    # ── 1) Redis L1 ──────────────────────────────────────────────────────
    if not force_refresh:
        cached = await get_channel_context_from_redis(platform, channel_id)
        if cached is not None:
            logger.debug(
                "[CHANNEL-CACHE] L1 HIT %s/%s", platform, channel_id
            )
            return cached

    # ── 2) PG L2 ────────────────────────────────────────────────────────
    if not force_refresh:
        db_cached = await get_channel_context_from_db(
            platform, channel_id, session=session
        )
        if db_cached is not None:
            logger.debug(
                "[CHANNEL-CACHE] L2 HIT %s/%s — warming L1", platform, channel_id
            )
            # Warm L1 best-effort
            await set_channel_context_to_redis(platform, channel_id, db_cached)
            return db_cached

    # ── 3) Full miss → service fetch ────────────────────────────────────
    logger.debug(
        "[CHANNEL-CACHE] MISS %s/%s — calling underlying service (force_refresh=%s)",
        platform,
        channel_id,
        force_refresh,
    )
    fresh = await _fetch_from_service(platform, channel_id, limit=limit)
    if fresh is None:
        logger.info(
            "[CHANNEL-CACHE] Service returned None for %s/%s — not caching",
            platform,
            channel_id,
        )
        return None

    # Populate L2 puis L1 (L2 d'abord car authoritative)
    await upsert_channel_context_to_db(platform, channel_id, fresh, session=session)
    await set_channel_context_to_redis(platform, channel_id, fresh)
    return fresh


__all__ = [
    "CHANNEL_CONTEXT_TTL_SECONDS",
    "CACHE_KEY_PREFIX",
    "build_channel_cache_key",
    "get_channel_context_from_redis",
    "set_channel_context_to_redis",
    "get_channel_context_from_db",
    "upsert_channel_context_to_db",
    "get_or_fetch_channel_context",
]
