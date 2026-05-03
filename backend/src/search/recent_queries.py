"""Service recent queries — stocke les 10 dernieres queries d'un user.

Backend prefere : Redis (via ``core.cache.cache_service.backend.redis``) lorsqu'il
est disponible (production Hetzner, REDIS_URL configure). Cle Redis :
``search:recent:{user_id}`` (LIST, max length 10, TTL 90 jours).

Fallback : dictionnaire in-memory module-level (``_recent_cache``). Les queries
sont perdues au restart du process. Acceptable pour V1 si Redis indisponible
(dev, tests, ou degradation prod). Le plan Phase 1 documente ce fallback.

Note d'implementation : le plan original referencait ``core.redis_client.get_redis_client``
qui n'existe pas dans la codebase. On utilise ``core.cache.cache_service`` (le seul
singleton Redis-aware exporte par ``core/``) ; quand ``cache_service.is_redis`` est
False, on bascule automatiquement sur ``_recent_cache`` (in-memory dict).

# TODO Redis when client available : si un module ``core.redis_client`` dedie est
# introduit plus tard (decouple du CacheService), preferer cet import direct pour
# eviter la dependance au CacheService.
"""

from __future__ import annotations

import logging
from typing import List

logger = logging.getLogger(__name__)

MAX_RECENT = 10
TTL_SECONDS = 90 * 24 * 3600  # 90 jours

# Fallback in-memory (process-local). Reset au restart.
_recent_cache: dict[int, list[str]] = {}


def _key(user_id: int) -> str:
    return f"search:recent:{user_id}"


def _get_redis_client():
    """Renvoie le client Redis async si dispo, sinon None.

    Encapsule l'acces au singleton ``cache_service`` pour permettre aux tests de
    le monkeypatcher facilement (``monkeypatch.setattr(
    "search.recent_queries._get_redis_client", lambda: None)``).
    """
    try:
        from core.cache import cache_service

        if cache_service.is_redis:
            return cache_service.backend.redis
        return None
    except Exception as e:  # pragma: no cover - defensive
        logger.warning(f"[RECENT] cache_service unavailable: {e}")
        return None


async def get_recent_queries(user_id: int) -> List[str]:
    """Retourne jusqu'a MAX_RECENT queries (most recent first).

    En cas d'erreur Redis ou d'absence de client : utilise le fallback in-memory
    si dispo, sinon liste vide. Ne leve jamais d'exception (best-effort cache).
    """
    redis = _get_redis_client()
    if redis is None:
        return list(_recent_cache.get(user_id, []))[:MAX_RECENT]
    try:
        items = await redis.lrange(_key(user_id), 0, MAX_RECENT - 1)
        # ``cache_service`` configure ``decode_responses=True`` (cf. core/cache.py
        # line ~322), donc les items sont deja des str. On garde le decode defensif
        # au cas ou un autre client Redis brut serait branche.
        return [item.decode() if isinstance(item, bytes) else item for item in items]
    except Exception as e:
        logger.warning(f"[RECENT] get failed for user {user_id}: {e}")
        return []


async def push_recent_query(user_id: int, query: str) -> None:
    """Ajoute ``query`` en tete, dedupe, trim a MAX_RECENT, refresh TTL."""
    if not query:
        return
    redis = _get_redis_client()
    if redis is None:
        # In-memory fallback : LREM dedupe + LPUSH + LTRIM equivalents.
        bucket = _recent_cache.setdefault(user_id, [])
        # Remove existing duplicates.
        bucket[:] = [q for q in bucket if q != query]
        bucket.insert(0, query)
        del bucket[MAX_RECENT:]
        return
    try:
        # LREM 0 supprime TOUTES les occurrences du query (count=0 = unbounded).
        await redis.lrem(_key(user_id), 0, query)
        await redis.lpush(_key(user_id), query)
        await redis.ltrim(_key(user_id), 0, MAX_RECENT - 1)
        await redis.expire(_key(user_id), TTL_SECONDS)
    except Exception as e:
        logger.warning(f"[RECENT] push failed for user {user_id}: {e}")


async def clear_recent_queries(user_id: int) -> None:
    """Efface toutes les queries d'un user."""
    redis = _get_redis_client()
    if redis is None:
        _recent_cache.pop(user_id, None)
        return
    try:
        await redis.delete(_key(user_id))
    except Exception as e:
        logger.warning(f"[RECENT] clear failed for user {user_id}: {e}")
