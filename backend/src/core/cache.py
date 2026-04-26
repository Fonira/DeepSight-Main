"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💾 CACHE SERVICE v1.0 — Redis avec fallback In-Memory                             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FONCTIONNALITÉS:                                                                  ║
║  • 🔴 Redis cache (production) - Si REDIS_URL est configuré                        ║
║  • 💾 In-memory cache (fallback) - TTLCache de cachetools                          ║
║  • ⏱️  TTL configurable par clé                                                     ║
║  • 🔑 Namespacing automatique des clés                                             ║
║  • 📊 Métriques de cache (hits/misses)                                             ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Usage:
    from core.cache import cache_service
    
    # Écrire
    await cache_service.set("transcript:abc123", data, ttl=86400)  # 24h
    
    # Lire
    data = await cache_service.get("transcript:abc123")
    
    # Pattern cache-aside
    data = await cache_service.get_or_set(
        key="perplexity:query_hash",
        factory=lambda: fetch_from_perplexity(query),
        ttl=3600  # 1h
    )
"""

import os
import json
import hashlib
import asyncio
from typing import Optional, Any, Callable, TypeVar, Union
from datetime import datetime
from dataclasses import dataclass

from core.logging import logger

# TTL Cache pour fallback in-memory
try:
    from cachetools import TTLCache
    CACHETOOLS_AVAILABLE = True
except ImportError:
    CACHETOOLS_AVAILABLE = False
    logger.warning("cachetools not installed, using basic dict cache")

T = TypeVar('T')

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# TTLs par défaut (en secondes)
DEFAULT_TTLS = {
    "transcript": 86400,      # 24h - Transcripts YouTube (stable)
    "analysis": 3600,         # 1h - Résultats d'analyse IA
    "factcheck": 1800,        # 30min - Fact-check results
    "perplexity": 3600,       # 1h - Résultats recherche web (actualités)
    "video_info": 43200,      # 12h - Métadonnées vidéo
    "user_quota": 300,        # 5min - Quotas utilisateur
    "default": 3600,          # 1h par défaut
}

# Taille max du cache in-memory (nombre d'entrées)
MAX_CACHE_SIZE = int(os.environ.get("CACHE_MAX_SIZE", "10000"))


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 MÉTRIQUES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class CacheStats:
    """Statistiques du cache"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    errors: int = 0
    
    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0
    
    def to_dict(self) -> dict:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "sets": self.sets,
            "deletes": self.deletes,
            "errors": self.errors,
            "hit_rate": f"{self.hit_rate:.1f}%",
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 CACHE BACKEND ABSTRAIT
# ═══════════════════════════════════════════════════════════════════════════════

class CacheBackend:
    """Interface abstraite pour les backends de cache"""
    
    async def get(self, key: str) -> Optional[Any]:
        raise NotImplementedError
    
    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        raise NotImplementedError
    
    async def delete(self, key: str) -> bool:
        raise NotImplementedError
    
    async def exists(self, key: str) -> bool:
        raise NotImplementedError
    
    async def clear_prefix(self, prefix: str) -> int:
        """Supprime toutes les clés avec ce préfixe"""
        raise NotImplementedError


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 IN-MEMORY CACHE (Fallback)
# ═══════════════════════════════════════════════════════════════════════════════

class InMemoryCacheBackend(CacheBackend):
    """
    Cache in-memory avec TTL.
    Utilise cachetools.TTLCache si disponible, sinon dict basique.
    """
    
    def __init__(self, maxsize: int = MAX_CACHE_SIZE):
        self._lock = asyncio.Lock()
        
        if CACHETOOLS_AVAILABLE:
            # TTLCache ne supporte qu'un seul TTL global, donc on stocke le TTL avec la valeur
            self._cache: dict = {}
            self._expiry: dict = {}  # Clé -> timestamp d'expiration
            self._maxsize = maxsize
        else:
            self._cache = {}
            self._expiry = {}
            self._maxsize = maxsize
    
    def _is_expired(self, key: str) -> bool:
        """Vérifie si une clé est expirée"""
        if key not in self._expiry:
            return True
        return datetime.now().timestamp() > self._expiry[key]
    
    def _cleanup_if_needed(self):
        """Nettoie les entrées expirées si le cache est trop grand"""
        if len(self._cache) >= self._maxsize:
            now = datetime.now().timestamp()
            expired_keys = [k for k, exp in self._expiry.items() if now > exp]
            for k in expired_keys:
                self._cache.pop(k, None)
                self._expiry.pop(k, None)
    
    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if key not in self._cache or self._is_expired(key):
                # Nettoyer l'entrée expirée
                self._cache.pop(key, None)
                self._expiry.pop(key, None)
                return None
            return self._cache[key]
    
    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        async with self._lock:
            self._cleanup_if_needed()
            self._cache[key] = value
            self._expiry[key] = datetime.now().timestamp() + ttl
            return True
    
    async def delete(self, key: str) -> bool:
        async with self._lock:
            removed = key in self._cache
            self._cache.pop(key, None)
            self._expiry.pop(key, None)
            return removed
    
    async def exists(self, key: str) -> bool:
        async with self._lock:
            return key in self._cache and not self._is_expired(key)
    
    async def clear_prefix(self, prefix: str) -> int:
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(prefix)]
            for k in keys_to_delete:
                self._cache.pop(k, None)
                self._expiry.pop(k, None)
            return len(keys_to_delete)
    
    @property
    def size(self) -> int:
        return len(self._cache)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔴 REDIS CACHE (Production)
# ═══════════════════════════════════════════════════════════════════════════════

class RedisCacheBackend(CacheBackend):
    """
    Cache Redis pour la production.
    Sérialise les valeurs en JSON.
    """
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self._prefix = "deepsight:"  # Namespace pour éviter les collisions
    
    def _full_key(self, key: str) -> str:
        return f"{self._prefix}{key}"
    
    async def get(self, key: str) -> Optional[Any]:
        try:
            value = await self.redis.get(self._full_key(key))
            if value is None:
                return None
            return json.loads(value)
        except Exception as e:
            logger.warning("Redis GET error", key=key, error=str(e))
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        try:
            serialized = json.dumps(value, ensure_ascii=False, default=str)
            await self.redis.setex(self._full_key(key), ttl, serialized)
            return True
        except Exception as e:
            logger.warning("Redis SET error", key=key, error=str(e))
            return False
    
    async def delete(self, key: str) -> bool:
        try:
            result = await self.redis.delete(self._full_key(key))
            return result > 0
        except Exception as e:
            logger.warning("Redis DELETE error", key=key, error=str(e))
            return False
    
    async def exists(self, key: str) -> bool:
        try:
            return await self.redis.exists(self._full_key(key)) > 0
        except Exception:
            return False
    
    async def clear_prefix(self, prefix: str) -> int:
        try:
            pattern = f"{self._prefix}{prefix}*"
            keys = await self.redis.keys(pattern)
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.warning("Redis CLEAR PREFIX error", prefix=prefix, error=str(e))
            return 0


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 CACHE SERVICE (API Principale)
# ═══════════════════════════════════════════════════════════════════════════════

class CacheService:
    """
    Service de cache unifié avec support Redis + fallback in-memory.
    
    Utilisation:
        from core.cache import cache_service
        
        # Simple get/set
        await cache_service.set("key", value, ttl=3600)
        value = await cache_service.get("key")
        
        # Pattern cache-aside (get or compute)
        value = await cache_service.get_or_set(
            "expensive_computation",
            factory=compute_value,
            ttl=3600
        )
    """
    
    _instance: Optional["CacheService"] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self.backend: CacheBackend = InMemoryCacheBackend()
        self.stats = CacheStats()
        self._redis_available = False
    
    async def init_redis(self, redis_url: Optional[str] = None):
        """
        Initialise le backend Redis si disponible.
        Appelé au démarrage de l'application.
        """
        redis_url = redis_url or os.environ.get("REDIS_URL")
        
        if not redis_url:
            logger.info("No REDIS_URL configured, using in-memory cache")
            return False

        try:
            import redis.asyncio as redis_lib
            client = redis_lib.from_url(redis_url, decode_responses=True)
            await client.ping()
            self.backend = RedisCacheBackend(client)
            self._redis_available = True
            logger.info("Redis backend initialized")
            return True
        except ImportError:
            logger.warning("redis package not installed, using in-memory cache")
            return False
        except Exception as e:
            logger.warning("Redis connection failed, using in-memory cache", error=str(e))
            return False
    
    @property
    def is_redis(self) -> bool:
        return self._redis_available
    
    async def get(self, key: str) -> Optional[Any]:
        """Récupère une valeur du cache"""
        try:
            value = await self.backend.get(key)
            if value is not None:
                self.stats.hits += 1
            else:
                self.stats.misses += 1
            return value
        except Exception as e:
            self.stats.errors += 1
            logger.warning("Cache GET error", error=str(e))
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Stocke une valeur dans le cache.
        
        Args:
            key: Clé de cache (ex: "transcript:abc123")
            value: Valeur à stocker (sera sérialisée en JSON)
            ttl: Time-to-live en secondes (défaut basé sur le préfixe de la clé)
        """
        try:
            # Déterminer le TTL basé sur le préfixe si non spécifié
            if ttl is None:
                prefix = key.split(":")[0] if ":" in key else "default"
                ttl = DEFAULT_TTLS.get(prefix, DEFAULT_TTLS["default"])
            
            result = await self.backend.set(key, value, ttl)
            if result:
                self.stats.sets += 1
            return result
        except Exception as e:
            self.stats.errors += 1
            logger.warning("Cache SET error", error=str(e))
            return False
    
    async def delete(self, key: str) -> bool:
        """Supprime une clé du cache"""
        try:
            result = await self.backend.delete(key)
            if result:
                self.stats.deletes += 1
            return result
        except Exception:
            self.stats.errors += 1
            return False
    
    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], T],
        ttl: Optional[int] = None
    ) -> Optional[T]:
        """
        Pattern cache-aside: récupère du cache ou calcule et stocke.
        
        Args:
            key: Clé de cache
            factory: Fonction (sync ou async) pour calculer la valeur si absente
            ttl: Time-to-live en secondes
        
        Returns:
            Valeur du cache ou calculée
        """
        # Essayer le cache d'abord
        cached = await self.get(key)
        if cached is not None:
            return cached
        
        # Cache miss - calculer la valeur
        try:
            if asyncio.iscoroutinefunction(factory):
                value = await factory()
            else:
                value = factory()
            
            if value is not None:
                await self.set(key, value, ttl)
            
            return value
        except Exception as e:
            logger.warning("Cache factory error", key=key, error=str(e))
            return None
    
    async def invalidate_prefix(self, prefix: str) -> int:
        """
        Invalide toutes les clés avec un préfixe donné.
        Utile pour invalider tout le cache d'une vidéo par exemple.
        """
        return await self.backend.clear_prefix(prefix)
    
    def get_stats(self) -> dict:
        """Retourne les statistiques du cache"""
        stats = self.stats.to_dict()
        stats["backend"] = "redis" if self._redis_available else "memory"
        if hasattr(self.backend, 'size'):
            stats["size"] = self.backend.size
        return stats


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 UTILITAIRES
# ═══════════════════════════════════════════════════════════════════════════════

def make_cache_key(*parts: str) -> str:
    """
    Crée une clé de cache à partir de plusieurs parties.
    
    Example:
        key = make_cache_key("transcript", video_id, language)
        # -> "transcript:abc123:fr"
    """
    return ":".join(str(p) for p in parts if p)


def hash_query(query: str) -> str:
    """
    Crée un hash court pour une requête (pour les clés de cache).
    Utile pour les recherches Perplexity.
    """
    return hashlib.md5(query.encode()).hexdigest()[:12]


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 INSTANCE SINGLETON
# ═══════════════════════════════════════════════════════════════════════════════

# Instance globale
cache_service = CacheService()


async def init_cache(redis_url: Optional[str] = None):
    """Initialise le cache (appeler au démarrage de l'app)"""
    await cache_service.init_redis(redis_url)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TRANSCRIPT CACHE METRICS (Redis-backed counters for Supadata cost tracking)
# ═══════════════════════════════════════════════════════════════════════════════

class TranscriptCacheMetrics:
    """
    Compteurs Redis dédiés aux métriques de cache transcript.
    Permet de tracker le hit rate et les économies Supadata.
    """

    KEYS = {
        "l1_hits": "stats:transcript_cache:l1_hits",
        "l2_hits": "stats:transcript_cache:l2_hits",
        "misses": "stats:transcript_cache:misses",
        "supadata_calls": "stats:transcript_cache:supadata_calls",
        "supadata_successes": "stats:transcript_cache:supadata_successes",
    }

    SUPADATA_COST_PER_CALL = 0.01  # $0.01 per Supadata API call

    async def increment(self, key: str, amount: int = 1) -> None:
        """Incrémente un compteur. Fonctionne en Redis ou fallback silencieux."""
        redis_key = self.KEYS.get(key)
        if not redis_key:
            return
        try:
            if cache_service.is_redis:
                await cache_service.backend.redis.incrby(
                    f"deepsight:{redis_key}", amount
                )
            else:
                # Fallback in-memory: store in cache_service
                current = await cache_service.get(redis_key) or 0
                await cache_service.set(redis_key, current + amount, ttl=86400 * 30)
        except Exception as e:
            logger.debug(f"Metrics increment error for {key}: {e}")

    async def get_all(self) -> dict:
        """Récupère toutes les métriques de cache transcript."""
        metrics = {}
        for name, redis_key in self.KEYS.items():
            try:
                if cache_service.is_redis:
                    val = await cache_service.backend.redis.get(
                        f"deepsight:{redis_key}"
                    )
                    metrics[name] = int(val) if val else 0
                else:
                    metrics[name] = await cache_service.get(redis_key) or 0
            except Exception:
                metrics[name] = 0

        # Computed metrics
        total_lookups = metrics["l1_hits"] + metrics["l2_hits"] + metrics["misses"]
        total_hits = metrics["l1_hits"] + metrics["l2_hits"]

        metrics["total_lookups"] = total_lookups
        metrics["total_hits"] = total_hits
        metrics["hit_rate_percent"] = round(
            (total_hits / total_lookups * 100) if total_lookups > 0 else 0, 1
        )
        metrics["supadata_calls_avoided"] = total_hits
        metrics["estimated_cost_saved_usd"] = round(
            total_hits * self.SUPADATA_COST_PER_CALL, 2
        )
        metrics["estimated_cost_spent_usd"] = round(
            metrics["supadata_calls"] * self.SUPADATA_COST_PER_CALL, 2
        )

        return metrics


# Instance singleton
transcript_metrics = TranscriptCacheMetrics()


# Export pour documentation
__all__ = [
    "cache_service",
    "init_cache", 
    "make_cache_key",
    "hash_query",
    "CacheService",
    "DEFAULT_TTLS",
    "transcript_metrics",
    "TranscriptCacheMetrics",
]
