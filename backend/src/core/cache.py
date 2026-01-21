"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💾 CACHE SERVICE v2.0 — Redis Cache avec Fallback Graceful                        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FONCTIONNALITÉS:                                                                  ║
║  • 🔴 Redis comme cache principal (millisecondes de latence)                       ║
║  • 💾 Fallback in-memory si Redis indisponible                                     ║
║  • 🔒 TTL configurable par type de données                                         ║
║  • 📊 Métriques de cache (hits, misses, errors)                                   ║
║  • 🎯 Invalidation par pattern (wildcards)                                        ║
║  • 🚦 Rate limiting intégré                                                       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import asyncio
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Any, TypeVar, Callable, Dict, List, Union
from functools import wraps
from collections import OrderedDict
import os

# ═══════════════════════════════════════════════════════════════════════════════
# 📦 IMPORTS OPTIONNELS (avec fallback)
# ═══════════════════════════════════════════════════════════════════════════════

try:
    import redis.asyncio as redis
    from redis.exceptions import RedisError
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("⚠️ [CACHE] redis package not installed, using in-memory fallback", flush=True)

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# TTL par défaut pour différents types de données
TTL_CONFIG = {
    "analysis": 7 * 24 * 60 * 60,      # 7 jours - analyses de vidéos
    "transcript": 24 * 60 * 60,         # 1 jour - transcriptions
    "user_history": 5 * 60,             # 5 minutes - historique utilisateur
    "chat_context": 30 * 60,            # 30 minutes - contexte de chat
    "quota": 60,                        # 1 minute - quotas
    "rate_limit": 60,                   # 1 minute - rate limiting
    "default": 5 * 60,                  # 5 minutes - par défaut
}

# Taille max du cache in-memory fallback
MAX_MEMORY_CACHE_SIZE = 1000

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TYPES
# ═══════════════════════════════════════════════════════════════════════════════

T = TypeVar('T')

class CacheMetrics:
    """Métriques du cache pour monitoring"""
    def __init__(self):
        self.hits = 0
        self.misses = 0
        self.errors = 0
        self.sets = 0
        self.deletes = 0
        self.started_at = datetime.utcnow()
    
    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "errors": self.errors,
            "sets": self.sets,
            "deletes": self.deletes,
            "hit_rate": f"{self.hit_rate:.2f}%",
            "uptime_seconds": (datetime.utcnow() - self.started_at).total_seconds(),
        }

# ═══════════════════════════════════════════════════════════════════════════════
# 💾 IN-MEMORY CACHE (Fallback)
# ═══════════════════════════════════════════════════════════════════════════════

class LRUCache:
    """Cache LRU en mémoire avec TTL"""
    
    def __init__(self, max_size: int = MAX_MEMORY_CACHE_SIZE):
        self.max_size = max_size
        self.cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if key not in self.cache:
                return None
            
            value, expires_at = self.cache[key]
            
            # Vérifier expiration
            if datetime.utcnow().timestamp() > expires_at:
                del self.cache[key]
                return None
            
            # Move to end (most recently used)
            self.cache.move_to_end(key)
            return value
    
    async def set(self, key: str, value: Any, ttl: int) -> bool:
        async with self._lock:
            expires_at = datetime.utcnow().timestamp() + ttl
            
            # Si la clé existe déjà, la supprimer d'abord
            if key in self.cache:
                del self.cache[key]
            
            # Éviction si nécessaire
            while len(self.cache) >= self.max_size:
                self.cache.popitem(last=False)  # Remove oldest
            
            self.cache[key] = (value, expires_at)
            return True
    
    async def delete(self, key: str) -> bool:
        async with self._lock:
            if key in self.cache:
                del self.cache[key]
                return True
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Supprime les clés correspondant au pattern (simple wildcard *)"""
        import re
        regex = re.compile(pattern.replace("*", ".*"))
        
        async with self._lock:
            keys_to_delete = [k for k in self.cache.keys() if regex.match(k)]
            for key in keys_to_delete:
                del self.cache[key]
            return len(keys_to_delete)
    
    async def clear(self) -> None:
        async with self._lock:
            self.cache.clear()
    
    @property
    def size(self) -> int:
        return len(self.cache)

# ═══════════════════════════════════════════════════════════════════════════════
# 🔴 CACHE SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class CacheService:
    """
    Service de cache avec Redis et fallback in-memory.
    
    Usage:
        cache = CacheService()
        await cache.connect()
        
        # Get/Set
        await cache.set("key", {"data": "value"}, ttl=3600)
        data = await cache.get("key")
        
        # Cache avec décorateur
        @cache.cached(ttl=3600, key_prefix="my_func")
        async def my_expensive_function(arg1, arg2):
            ...
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
        self.redis_client: Optional[Any] = None
        self.memory_cache = LRUCache()
        self.metrics = CacheMetrics()
        self._connected = False
    
    async def connect(self) -> bool:
        """Connecte au serveur Redis"""
        if self._connected:
            return True
        
        if not REDIS_AVAILABLE:
            print("⚠️ [CACHE] Redis not available, using memory fallback", flush=True)
            return False
        
        try:
            self.redis_client = redis.from_url(
                REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            
            # Test connection
            await self.redis_client.ping()
            self._connected = True
            print("✅ [CACHE] Redis connected", flush=True)
            return True
            
        except Exception as e:
            print(f"⚠️ [CACHE] Redis connection failed: {e}", flush=True)
            self.redis_client = None
            return False
    
    async def disconnect(self) -> None:
        """Ferme la connexion Redis"""
        if self.redis_client:
            await self.redis_client.close()
            self._connected = False
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📖 GET
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Récupère une valeur du cache.
        Essaie Redis d'abord, puis le cache mémoire.
        """
        try:
            # Essayer Redis
            if self.redis_client:
                try:
                    data = await self.redis_client.get(key)
                    if data:
                        self.metrics.hits += 1
                        return json.loads(data)
                except Exception as e:
                    self.metrics.errors += 1
                    print(f"⚠️ [CACHE] Redis get error: {e}", flush=True)
            
            # Fallback mémoire
            data = await self.memory_cache.get(key)
            if data:
                self.metrics.hits += 1
                return data
            
            self.metrics.misses += 1
            return None
            
        except Exception as e:
            self.metrics.errors += 1
            print(f"❌ [CACHE] Get error for {key}: {e}", flush=True)
            return None
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📝 SET
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None,
        cache_type: str = "default"
    ) -> bool:
        """
        Stocke une valeur dans le cache.
        
        Args:
            key: Clé de cache
            value: Valeur à stocker (sera sérialisée en JSON)
            ttl: Time-to-live en secondes (optionnel)
            cache_type: Type de cache pour TTL automatique
        """
        if ttl is None:
            ttl = TTL_CONFIG.get(cache_type, TTL_CONFIG["default"])
        
        try:
            serialized = json.dumps(value, default=str)
            
            # Stocker dans Redis
            if self.redis_client:
                try:
                    await self.redis_client.setex(key, ttl, serialized)
                except Exception as e:
                    self.metrics.errors += 1
                    print(f"⚠️ [CACHE] Redis set error: {e}", flush=True)
            
            # Toujours stocker en mémoire (L1 cache)
            await self.memory_cache.set(key, value, ttl)
            
            self.metrics.sets += 1
            return True
            
        except Exception as e:
            self.metrics.errors += 1
            print(f"❌ [CACHE] Set error for {key}: {e}", flush=True)
            return False
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🗑️ DELETE
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def delete(self, key: str) -> bool:
        """Supprime une clé du cache"""
        try:
            # Supprimer de Redis
            if self.redis_client:
                try:
                    await self.redis_client.delete(key)
                except Exception as e:
                    print(f"⚠️ [CACHE] Redis delete error: {e}", flush=True)
            
            # Supprimer de la mémoire
            await self.memory_cache.delete(key)
            
            self.metrics.deletes += 1
            return True
            
        except Exception as e:
            self.metrics.errors += 1
            print(f"❌ [CACHE] Delete error for {key}: {e}", flush=True)
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Supprime les clés correspondant au pattern.
        
        Args:
            pattern: Pattern avec wildcards (*), ex: "user:123:*"
        """
        deleted = 0
        
        try:
            # Redis SCAN + DELETE
            if self.redis_client:
                try:
                    cursor = 0
                    while True:
                        cursor, keys = await self.redis_client.scan(
                            cursor, 
                            match=pattern, 
                            count=100
                        )
                        if keys:
                            await self.redis_client.delete(*keys)
                            deleted += len(keys)
                        if cursor == 0:
                            break
                except Exception as e:
                    print(f"⚠️ [CACHE] Redis pattern delete error: {e}", flush=True)
            
            # Memory cache
            deleted += await self.memory_cache.delete_pattern(pattern)
            
            self.metrics.deletes += deleted
            return deleted
            
        except Exception as e:
            self.metrics.errors += 1
            print(f"❌ [CACHE] Pattern delete error: {e}", flush=True)
            return deleted
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🎯 SPECIALIZED METHODS
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def cache_analysis(
        self, 
        video_id: str, 
        user_id: int,
        analysis: Dict[str, Any]
    ) -> bool:
        """Cache une analyse de vidéo"""
        key = f"analysis:{video_id}:{user_id}"
        return await self.set(key, analysis, cache_type="analysis")
    
    async def get_analysis(
        self, 
        video_id: str, 
        user_id: int
    ) -> Optional[Dict[str, Any]]:
        """Récupère une analyse cachée"""
        key = f"analysis:{video_id}:{user_id}"
        return await self.get(key)
    
    async def cache_transcript(
        self, 
        video_id: str, 
        transcript: str
    ) -> bool:
        """Cache une transcription YouTube"""
        key = f"transcript:{video_id}"
        return await self.set(key, {"text": transcript}, cache_type="transcript")
    
    async def get_transcript(self, video_id: str) -> Optional[str]:
        """Récupère une transcription cachée"""
        key = f"transcript:{video_id}"
        data = await self.get(key)
        return data.get("text") if data else None
    
    async def invalidate_user_cache(self, user_id: int) -> int:
        """Invalide tout le cache d'un utilisateur"""
        patterns = [
            f"analysis:*:{user_id}",
            f"history:{user_id}:*",
            f"quota:{user_id}",
        ]
        deleted = 0
        for pattern in patterns:
            deleted += await self.delete_pattern(pattern)
        return deleted
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🚦 RATE LIMITING
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def check_rate_limit(
        self, 
        key: str, 
        max_requests: int, 
        window_seconds: int = 60
    ) -> tuple[bool, int]:
        """
        Vérifie le rate limit avec sliding window.
        
        Returns:
            (is_allowed, remaining_requests)
        """
        rate_key = f"rate_limit:{key}"
        
        try:
            if self.redis_client:
                # Utiliser Redis pour le rate limiting précis
                pipe = self.redis_client.pipeline()
                now = datetime.utcnow().timestamp()
                window_start = now - window_seconds
                
                # Nettoyer les anciennes entrées
                await pipe.zremrangebyscore(rate_key, 0, window_start)
                
                # Compter les requêtes actuelles
                await pipe.zcount(rate_key, window_start, now)
                
                # Ajouter la requête actuelle
                await pipe.zadd(rate_key, {str(now): now})
                
                # Définir l'expiration
                await pipe.expire(rate_key, window_seconds)
                
                results = await pipe.execute()
                current_count = results[1]
                
                if current_count < max_requests:
                    return True, max_requests - current_count - 1
                return False, 0
                
            else:
                # Fallback simple en mémoire
                data = await self.memory_cache.get(rate_key) or {"count": 0}
                
                if data["count"] < max_requests:
                    data["count"] += 1
                    await self.memory_cache.set(rate_key, data, window_seconds)
                    return True, max_requests - data["count"]
                return False, 0
                
        except Exception as e:
            self.metrics.errors += 1
            print(f"⚠️ [CACHE] Rate limit error: {e}", flush=True)
            # En cas d'erreur, autoriser la requête
            return True, max_requests
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🎨 DECORATOR
    # ═══════════════════════════════════════════════════════════════════════════
    
    def cached(
        self,
        ttl: Optional[int] = None,
        cache_type: str = "default",
        key_prefix: str = "",
        key_builder: Optional[Callable[..., str]] = None,
    ):
        """
        Décorateur pour cacher automatiquement le résultat d'une fonction.
        
        Usage:
            @cache.cached(ttl=3600, key_prefix="my_func")
            async def expensive_function(user_id: int):
                ...
        """
        def decorator(func: Callable[..., T]) -> Callable[..., T]:
            @wraps(func)
            async def wrapper(*args, **kwargs) -> T:
                # Construire la clé de cache
                if key_builder:
                    cache_key = key_builder(*args, **kwargs)
                else:
                    # Clé par défaut basée sur les arguments
                    key_parts = [key_prefix or func.__name__]
                    key_parts.extend(str(arg) for arg in args)
                    key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
                    cache_key = ":".join(key_parts)
                
                # Vérifier le cache
                cached_value = await self.get(cache_key)
                if cached_value is not None:
                    return cached_value
                
                # Exécuter la fonction
                result = await func(*args, **kwargs)
                
                # Stocker le résultat
                await self.set(cache_key, result, ttl, cache_type)
                
                return result
            
            return wrapper
        return decorator
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📊 METRICS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_metrics(self) -> Dict[str, Any]:
        """Retourne les métriques du cache"""
        return {
            **self.metrics.to_dict(),
            "redis_connected": self._connected,
            "memory_cache_size": self.memory_cache.size,
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Vérifie la santé du service de cache"""
        result = {
            "status": "healthy",
            "redis": "disconnected",
            "memory_cache": "ok",
        }
        
        if self.redis_client:
            try:
                await self.redis_client.ping()
                result["redis"] = "connected"
            except:
                result["redis"] = "error"
                result["status"] = "degraded"
        
        return result


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 SINGLETON INSTANCE
# ═══════════════════════════════════════════════════════════════════════════════

cache = CacheService()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 FASTAPI INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

async def get_cache() -> CacheService:
    """Dependency injection pour FastAPI"""
    if not cache._connected:
        await cache.connect()
    return cache


async def init_cache() -> None:
    """Initialise le cache au démarrage de l'application"""
    await cache.connect()


async def close_cache() -> None:
    """Ferme le cache à l'arrêt de l'application"""
    await cache.disconnect()
