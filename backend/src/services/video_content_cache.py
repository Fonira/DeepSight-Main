"""
VideoContentCacheService — Cache L1 (Redis) / L2 (PostgreSQL VPS)

Cache à 2 niveaux pour le contenu vidéo : transcripts, analyses,
studio content (flashcards/quiz/mindmap/factcheck/compare), et factcheck.

Pattern:
  get() → L1 hit → return | L2 hit → promote L1 → return | miss → None
  set() → store L1 + L2 simultanément
"""

import json
import asyncio
import logging
from typing import Optional

import redis.asyncio as aioredis
import asyncpg

logger = logging.getLogger("deepsight.video_cache")

# TTL Redis par type de contenu (en secondes)
REDIS_TTL: dict[str, int] = {
    "transcript": 7 * 86400,  # 7 jours
    "analysis": 3 * 86400,  # 3 jours
    "studio": 2 * 86400,  # 2 jours
    "factcheck": 5 * 86400,  # 5 jours
}


def _build_key(
    content_type: str,
    platform: str,
    video_id: str,
    mode: Optional[str] = None,
    language: Optional[str] = None,
) -> str:
    """Construit la clé de cache Redis/lookup."""
    key = f"vcache:{content_type}:{platform}:{video_id}"
    if mode:
        key += f":{mode}"
    if language:
        key += f":{language}"
    return key


def _serialize(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def _deserialize(raw: str | bytes) -> dict:
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)


class VideoContentCacheService:
    """Service de cache vidéo L1 (Redis) + L2 (PostgreSQL VPS)."""

    def __init__(self, redis_url: str, vps_database_url: str) -> None:
        self._redis_url = redis_url
        self._vps_database_url = vps_database_url
        self._redis: Optional[aioredis.Redis] = None
        self._pg_pool: Optional[asyncpg.Pool] = None

    # ─── Lifecycle ────────────────────────────────────────────────

    async def initialize(self) -> None:
        """Connecte Redis et crée le pool asyncpg."""
        # Redis L1
        try:
            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=False,
                socket_connect_timeout=5,
            )
            await self._redis.ping()
            logger.info("Redis L1 connected")
        except Exception as e:
            logger.warning("Redis L1 unavailable: %s", e)
            self._redis = None

        # PostgreSQL L2
        try:
            self._pg_pool = await asyncpg.create_pool(self._vps_database_url, min_size=2, max_size=10)
            logger.info("PostgreSQL L2 pool created")
        except Exception as e:
            logger.warning("PostgreSQL L2 unavailable: %s", e)
            self._pg_pool = None

    async def close(self) -> None:
        """Ferme proprement les connexions."""
        if self._redis:
            try:
                await self._redis.aclose()
            except Exception:
                pass
            self._redis = None
        if self._pg_pool:
            try:
                await self._pg_pool.close()
            except Exception:
                pass
            self._pg_pool = None
        logger.info("VideoContentCacheService closed")

    @property
    def is_healthy(self) -> dict:
        """Statut de chaque couche."""
        return {
            "l1_redis": self._redis is not None,
            "l2_postgres": self._pg_pool is not None,
        }

    # ─── Redis L1 helpers ─────────────────────────────────────────

    async def _redis_get(self, key: str) -> Optional[dict]:
        if not self._redis:
            return None
        try:
            raw = await self._redis.get(key)
            if raw is not None:
                return _deserialize(raw)
        except Exception as e:
            logger.warning("Redis GET error key=%s: %s", key, e)
        return None

    async def _redis_set(self, key: str, data: dict, content_type: str) -> None:
        if not self._redis:
            return
        try:
            ttl = REDIS_TTL.get(content_type, 3 * 86400)
            await self._redis.set(key, _serialize(data), ex=ttl)
        except Exception as e:
            logger.warning("Redis SET error key=%s: %s", key, e)

    # ─── Stats recording (non-bloquant) ──────────────────────────

    def _record_stat(self, content_type: str, hit_level: str) -> None:
        """Enregistre une stat de cache (fire-and-forget)."""
        if not self._pg_pool:
            return
        asyncio.get_event_loop().call_soon(
            lambda: asyncio.ensure_future(self._record_stat_async(content_type, hit_level))
        )

    async def _record_stat_async(self, content_type: str, hit_level: str) -> None:
        try:
            async with self._pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO video_cache_stats (content_type, hit_level, recorded_at)
                    VALUES ($1, $2, NOW())
                    """,
                    content_type,
                    hit_level,
                )
        except Exception as e:
            logger.debug("Stats recording failed: %s", e)

    # ═══════════════════════════════════════════════════════════════
    # TRANSCRIPT
    # ═══════════════════════════════════════════════════════════════

    async def get_transcript(self, platform: str, video_id: str) -> Optional[dict]:
        """Récupère un transcript depuis le cache L1/L2."""
        key = _build_key("transcript", platform, video_id)

        # L1
        data = await self._redis_get(key)
        if data is not None:
            logger.info("Cache HIT L1 transcript %s/%s", platform, video_id)
            self._record_stat("transcript", "l1")
            return data

        # L2
        data = await self._pg_get_transcript(platform, video_id)
        if data is not None:
            logger.info("Cache HIT L2 transcript %s/%s", platform, video_id)
            await self._redis_set(key, data, "transcript")
            self._record_stat("transcript", "l2")
            return data

        logger.info("Cache MISS transcript %s/%s", platform, video_id)
        self._record_stat("transcript", "miss")
        return None

    async def set_transcript(self, platform: str, video_id: str, data: dict) -> None:
        """Stocke un transcript dans L1 + L2."""
        key = _build_key("transcript", platform, video_id)
        await asyncio.gather(
            self._redis_set(key, data, "transcript"),
            self._pg_upsert_transcript(platform, video_id, data),
            return_exceptions=True,
        )

    async def _pg_get_transcript(self, platform: str, video_id: str) -> Optional[dict]:
        if not self._pg_pool:
            return None
        try:
            async with self._pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    UPDATE video_cache_transcripts
                    SET access_count = access_count + 1, last_accessed = NOW()
                    WHERE platform = $1 AND video_id = $2
                    RETURNING data
                    """,
                    platform,
                    video_id,
                )
                if row:
                    return _deserialize(row["data"])
        except Exception as e:
            logger.warning("PG GET transcript error: %s", e)
        return None

    async def _pg_upsert_transcript(self, platform: str, video_id: str, data: dict) -> None:
        if not self._pg_pool:
            return
        try:
            async with self._pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO video_cache_transcripts (platform, video_id, data, created_at, last_accessed, access_count)
                    VALUES ($1, $2, $3, NOW(), NOW(), 1)
                    ON CONFLICT (platform, video_id)
                    DO UPDATE SET data = $3, last_accessed = NOW(), access_count = video_cache_transcripts.access_count + 1
                    """,
                    platform,
                    video_id,
                    _serialize(data),
                )
        except Exception as e:
            logger.warning("PG UPSERT transcript error: %s", e)

    # ═══════════════════════════════════════════════════════════════
    # ANALYSIS
    # ═══════════════════════════════════════════════════════════════

    @staticmethod
    def _make_analysis_mode_key(mode: str, model: Optional[str], deep_research: bool) -> str:
        """Encode model + deep_research dans la clé `mode` pour différencier les analyses
        qui dépendent des paramètres user (plan/model/deep_research). Sans ça, deux users
        avec des paramètres différents partageraient la même analyse — faux conceptuellement.
        """
        return f"{mode}|m={model or 'default'}|dr={int(bool(deep_research))}"

    async def get_analysis(
        self,
        platform: str,
        video_id: str,
        mode: str,
        language: str,
        model: Optional[str] = None,
        deep_research: bool = False,
    ) -> Optional[dict]:
        """Récupère une analyse depuis le cache L1/L2.

        La clé inclut model + deep_research : deux users avec mêmes (mode, lang) mais
        modèles Mistral différents (small vs large) ou deep_research différent NE
        partagent PAS le cache.
        """
        mode_key = self._make_analysis_mode_key(mode, model, deep_research)
        key = _build_key("analysis", platform, video_id, mode=mode_key, language=language)

        data = await self._redis_get(key)
        if data is not None:
            logger.info("Cache HIT L1 analysis %s/%s mode=%s lang=%s", platform, video_id, mode_key, language)
            self._record_stat("analysis", "l1")
            return data

        data = await self._pg_get_analysis(platform, video_id, mode_key, language)
        if data is not None:
            logger.info("Cache HIT L2 analysis %s/%s mode=%s lang=%s", platform, video_id, mode_key, language)
            await self._redis_set(key, data, "analysis")
            self._record_stat("analysis", "l2")
            return data

        logger.info("Cache MISS analysis %s/%s mode=%s lang=%s", platform, video_id, mode_key, language)
        self._record_stat("analysis", "miss")
        return None

    async def set_analysis(
        self,
        platform: str,
        video_id: str,
        mode: str,
        language: str,
        data: dict,
        model: Optional[str] = None,
        deep_research: bool = False,
    ) -> None:
        """Stocke une analyse dans L1 + L2 sous une clé qui inclut model + deep_research."""
        mode_key = self._make_analysis_mode_key(mode, model, deep_research)
        key = _build_key("analysis", platform, video_id, mode=mode_key, language=language)
        await asyncio.gather(
            self._redis_set(key, data, "analysis"),
            self._pg_upsert_analysis(platform, video_id, mode_key, language, data),
            return_exceptions=True,
        )

    async def _pg_get_analysis(self, platform: str, video_id: str, mode: str, language: str) -> Optional[dict]:
        if not self._pg_pool:
            return None
        try:
            async with self._pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    UPDATE video_cache_analyses
                    SET access_count = access_count + 1, last_accessed = NOW()
                    WHERE platform = $1 AND video_id = $2 AND mode = $3 AND language = $4
                    RETURNING data
                    """,
                    platform,
                    video_id,
                    mode,
                    language,
                )
                if row:
                    return _deserialize(row["data"])
        except Exception as e:
            logger.warning("PG GET analysis error: %s", e)
        return None

    async def _pg_upsert_analysis(self, platform: str, video_id: str, mode: str, language: str, data: dict) -> None:
        if not self._pg_pool:
            return
        try:
            async with self._pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO video_cache_analyses (platform, video_id, mode, language, data, created_at, last_accessed, access_count)
                    VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 1)
                    ON CONFLICT (platform, video_id, mode, language)
                    DO UPDATE SET data = $5, last_accessed = NOW(), access_count = video_cache_analyses.access_count + 1
                    """,
                    platform,
                    video_id,
                    mode,
                    language,
                    _serialize(data),
                )
        except Exception as e:
            logger.warning("PG UPSERT analysis error: %s", e)

    # ═══════════════════════════════════════════════════════════════
    # STUDIO CONTENT (flashcards, quiz, mindmap, factcheck, compare)
    # ═══════════════════════════════════════════════════════════════

    async def get_studio_content(
        self, platform: str, video_id: str, content_type: str, language: str
    ) -> Optional[dict]:
        """Récupère du contenu studio depuis le cache L1/L2."""
        key = _build_key("studio", platform, video_id, mode=content_type, language=language)

        data = await self._redis_get(key)
        if data is not None:
            logger.info("Cache HIT L1 studio %s/%s type=%s lang=%s", platform, video_id, content_type, language)
            self._record_stat("studio", "l1")
            return data

        data = await self._pg_get_studio(platform, video_id, content_type, language)
        if data is not None:
            logger.info("Cache HIT L2 studio %s/%s type=%s lang=%s", platform, video_id, content_type, language)
            await self._redis_set(key, data, "studio")
            self._record_stat("studio", "l2")
            return data

        logger.info("Cache MISS studio %s/%s type=%s lang=%s", platform, video_id, content_type, language)
        self._record_stat("studio", "miss")
        return None

    async def set_studio_content(
        self, platform: str, video_id: str, content_type: str, language: str, data: dict
    ) -> None:
        """Stocke du contenu studio dans L1 + L2."""
        key = _build_key("studio", platform, video_id, mode=content_type, language=language)
        await asyncio.gather(
            self._redis_set(key, data, "studio"),
            self._pg_upsert_studio(platform, video_id, content_type, language, data),
            return_exceptions=True,
        )

    async def _pg_get_studio(self, platform: str, video_id: str, content_type: str, language: str) -> Optional[dict]:
        if not self._pg_pool:
            return None
        try:
            async with self._pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    UPDATE video_cache_studio
                    SET access_count = access_count + 1, last_accessed = NOW()
                    WHERE platform = $1 AND video_id = $2 AND content_type = $3 AND language = $4
                    RETURNING data
                    """,
                    platform,
                    video_id,
                    content_type,
                    language,
                )
                if row:
                    return _deserialize(row["data"])
        except Exception as e:
            logger.warning("PG GET studio error: %s", e)
        return None

    async def _pg_upsert_studio(
        self, platform: str, video_id: str, content_type: str, language: str, data: dict
    ) -> None:
        if not self._pg_pool:
            return
        try:
            async with self._pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO video_cache_studio (platform, video_id, content_type, language, data, created_at, last_accessed, access_count)
                    VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 1)
                    ON CONFLICT (platform, video_id, content_type, language)
                    DO UPDATE SET data = $5, last_accessed = NOW(), access_count = video_cache_studio.access_count + 1
                    """,
                    platform,
                    video_id,
                    content_type,
                    language,
                    _serialize(data),
                )
        except Exception as e:
            logger.warning("PG UPSERT studio error: %s", e)

    # ═══════════════════════════════════════════════════════════════
    # FACTCHECK
    # ═══════════════════════════════════════════════════════════════

    async def get_factcheck(self, platform: str, video_id: str, language: str) -> Optional[dict]:
        """Récupère un factcheck depuis le cache L1/L2."""
        key = _build_key("factcheck", platform, video_id, language=language)

        data = await self._redis_get(key)
        if data is not None:
            logger.info("Cache HIT L1 factcheck %s/%s lang=%s", platform, video_id, language)
            self._record_stat("factcheck", "l1")
            return data

        data = await self._pg_get_factcheck(platform, video_id, language)
        if data is not None:
            logger.info("Cache HIT L2 factcheck %s/%s lang=%s", platform, video_id, language)
            await self._redis_set(key, data, "factcheck")
            self._record_stat("factcheck", "l2")
            return data

        logger.info("Cache MISS factcheck %s/%s lang=%s", platform, video_id, language)
        self._record_stat("factcheck", "miss")
        return None

    async def set_factcheck(self, platform: str, video_id: str, language: str, data: dict) -> None:
        """Stocke un factcheck dans L1 + L2."""
        key = _build_key("factcheck", platform, video_id, language=language)
        await asyncio.gather(
            self._redis_set(key, data, "factcheck"),
            self._pg_upsert_factcheck(platform, video_id, language, data),
            return_exceptions=True,
        )

    async def _pg_get_factcheck(self, platform: str, video_id: str, language: str) -> Optional[dict]:
        if not self._pg_pool:
            return None
        try:
            async with self._pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    UPDATE video_cache_factchecks
                    SET access_count = access_count + 1, last_accessed = NOW()
                    WHERE platform = $1 AND video_id = $2 AND language = $3
                    RETURNING data
                    """,
                    platform,
                    video_id,
                    language,
                )
                if row:
                    return _deserialize(row["data"])
        except Exception as e:
            logger.warning("PG GET factcheck error: %s", e)
        return None

    async def _pg_upsert_factcheck(self, platform: str, video_id: str, language: str, data: dict) -> None:
        if not self._pg_pool:
            return
        try:
            async with self._pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO video_cache_factchecks (platform, video_id, language, data, created_at, last_accessed, access_count)
                    VALUES ($1, $2, $3, $4, NOW(), NOW(), 1)
                    ON CONFLICT (platform, video_id, language)
                    DO UPDATE SET data = $4, last_accessed = NOW(), access_count = video_cache_factchecks.access_count + 1
                    """,
                    platform,
                    video_id,
                    language,
                    _serialize(data),
                )
        except Exception as e:
            logger.warning("PG UPSERT factcheck error: %s", e)

    # ═══════════════════════════════════════════════════════════════
    # HAS_VIDEO — inventaire du cache pour une vidéo
    # ═══════════════════════════════════════════════════════════════

    async def has_video(self, platform: str, video_id: str) -> dict:
        """Retourne un dict décrivant tout ce qui est caché pour cette vidéo."""
        result: dict = {
            "platform": platform,
            "video_id": video_id,
            "cached": False,
            "transcript": False,
            "analyses": [],
            "studio": [],
            "factchecks": [],
        }
        if not self._pg_pool:
            return result

        try:
            async with self._pg_pool.acquire() as conn:
                # Transcript
                row = await conn.fetchrow(
                    "SELECT 1 FROM video_cache_transcripts WHERE platform = $1 AND video_id = $2",
                    platform,
                    video_id,
                )
                result["transcript"] = row is not None

                # Analyses
                rows = await conn.fetch(
                    "SELECT mode, language FROM video_cache_analyses WHERE platform = $1 AND video_id = $2",
                    platform,
                    video_id,
                )
                result["analyses"] = [{"mode": r["mode"], "language": r["language"]} for r in rows]

                # Studio
                rows = await conn.fetch(
                    "SELECT content_type, language FROM video_cache_studio WHERE platform = $1 AND video_id = $2",
                    platform,
                    video_id,
                )
                result["studio"] = [{"content_type": r["content_type"], "language": r["language"]} for r in rows]

                # Factchecks
                rows = await conn.fetch(
                    "SELECT language FROM video_cache_factchecks WHERE platform = $1 AND video_id = $2",
                    platform,
                    video_id,
                )
                result["factchecks"] = [r["language"] for r in rows]

                result["cached"] = (
                    result["transcript"]
                    or len(result["analyses"]) > 0
                    or len(result["studio"]) > 0
                    or len(result["factchecks"]) > 0
                )
        except Exception as e:
            logger.warning("has_video error: %s", e)

        return result

    # ═══════════════════════════════════════════════════════════════
    # STATS
    # ═══════════════════════════════════════════════════════════════

    async def get_cache_stats_summary(self) -> dict:
        """Statistiques des 24 dernières heures."""
        stats: dict = {
            "period": "last_24h",
            "healthy": self.is_healthy,
            "hits_l1": 0,
            "hits_l2": 0,
            "misses": 0,
            "hit_rate": 0.0,
            "by_type": {},
        }
        if not self._pg_pool:
            return stats

        try:
            async with self._pg_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT content_type, hit_level, COUNT(*) as cnt
                    FROM video_cache_stats
                    WHERE recorded_at >= NOW() - INTERVAL '24 hours'
                    GROUP BY content_type, hit_level
                    """
                )
                for row in rows:
                    ct = row["content_type"]
                    level = row["hit_level"]
                    cnt = row["cnt"]

                    if ct not in stats["by_type"]:
                        stats["by_type"][ct] = {"l1": 0, "l2": 0, "miss": 0}
                    stats["by_type"][ct][level] = cnt

                    if level == "l1":
                        stats["hits_l1"] += cnt
                    elif level == "l2":
                        stats["hits_l2"] += cnt
                    else:
                        stats["misses"] += cnt

                total = stats["hits_l1"] + stats["hits_l2"] + stats["misses"]
                if total > 0:
                    stats["hit_rate"] = round((stats["hits_l1"] + stats["hits_l2"]) / total * 100, 1)
        except Exception as e:
            logger.warning("get_cache_stats_summary error: %s", e)

        return stats
