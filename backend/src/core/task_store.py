"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔴 REDIS-BACKED TASK STORE & GUEST LIMITER                                       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Remplace les dicts in-memory _task_store et _guest_usage par des structures      ║
║  Redis partagées entre tous les workers Uvicorn.                                  ║
║                                                                                    ║
║  • TaskStore    — Proxy dict → Redis HASH (TTL 24h, flush batché 50ms)            ║
║  • GuestLimiter — Redis ZSET par IP (fenêtre glissante 24h)                       ║
║  • Fallback in-memory transparent si Redis indisponible                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import time
import asyncio
from typing import Any, Dict, Optional, Set

from core.logging import logger


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 TASK STATUS DICT — dict subclass qui notifie le store parent
# ═══════════════════════════════════════════════════════════════════════════════


class TaskStatusDict(dict):
    """
    Dict subclass qui signale les mutations au TaskStore parent.
    Permet de garder la syntaxe existante:
        _task_store[task_id]["progress"] = 30
    tout en synchronisant automatiquement vers Redis.
    """

    def __init__(self, task_id: str, store: "TaskStore", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._task_id = task_id
        self._store = store

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        self._store._mark_dirty(self._task_id)

    def update(self, *args, **kwargs):
        super().update(*args, **kwargs)
        self._store._mark_dirty(self._task_id)


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ TASK STORE — Proxy dict avec sync Redis batché
# ═══════════════════════════════════════════════════════════════════════════════


class TaskStore:
    """
    Drop-in replacement pour le dict _task_store.

    Comportement:
    - __getitem__, __setitem__, get(), __contains__ fonctionnent de manière
      synchrone sur le cache local (identique au dict d'origine).
    - Chaque mutation marque la clé "dirty" et schedule un flush Redis
      dans ~50ms, ce qui batch les écritures séquentielles.
    - aget() est la méthode async pour lire depuis Redis (cross-worker).
    """

    TTL = 86400  # 24h — durée de vie d'une tâche
    FLUSH_DELAY = 0.05  # 50ms — fenêtre de batching
    PREFIX = "deepsight:task:"

    def __init__(self):
        self._local: Dict[str, TaskStatusDict] = {}
        self._redis = None
        self._dirty: Set[str] = set()
        self._flush_handle = None

    async def init_redis(self, redis_client):
        """Connecte le store au client Redis (appelé au startup)."""
        self._redis = redis_client
        if redis_client:
            logger.info("TaskStore Redis backend initialized")

    # ── Interface dict (synchrone, identique à l'ancien code) ──

    def __contains__(self, task_id: str) -> bool:
        return task_id in self._local

    def __getitem__(self, task_id: str) -> TaskStatusDict:
        return self._local[task_id]

    def __setitem__(self, task_id: str, data):
        if isinstance(data, TaskStatusDict):
            self._local[task_id] = data
        else:
            self._local[task_id] = TaskStatusDict(task_id, self, data)
        self._mark_dirty(task_id)

    def get(self, task_id: str, default=None):
        return self._local.get(task_id, default)

    # ── Async read (cross-worker) ──

    async def aget(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Lecture async: cache local d'abord, puis Redis si absent.
        Essentiel pour le polling cross-worker (Worker B lit un task créé par Worker A).
        """
        local = self._local.get(task_id)
        if local is not None:
            return local

        if self._redis:
            try:
                raw = await self._redis.get(f"{self.PREFIX}{task_id}")
                if raw:
                    parsed = json.loads(raw)
                    tracked = TaskStatusDict(task_id, self, parsed)
                    self._local[task_id] = tracked
                    return tracked
            except Exception as e:
                logger.warning("TaskStore Redis GET failed", task_id=task_id, error=str(e))

        return None

    # ── Dirty tracking & flush batché ──

    def _mark_dirty(self, task_id: str):
        """Marque un task_id pour sync Redis au prochain flush."""
        self._dirty.add(task_id)
        self._schedule_flush()

    def _schedule_flush(self):
        """Schedule un flush dans FLUSH_DELAY secondes (debounce)."""
        if self._redis is None:
            return
        try:
            loop = asyncio.get_running_loop()
            if self._flush_handle is None or self._flush_handle.cancelled():
                self._flush_handle = loop.call_later(self.FLUSH_DELAY, lambda: loop.create_task(self._flush()))
        except RuntimeError:
            pass  # Pas de loop active (tests unitaires, init)

    async def _flush(self):
        """Flush toutes les clés dirty vers Redis en un pipeline."""
        if not self._redis or not self._dirty:
            return

        dirty_ids = list(self._dirty)
        self._dirty.clear()
        self._flush_handle = None

        try:
            pipe = self._redis.pipeline()
            for task_id in dirty_ids:
                data = self._local.get(task_id)
                if data is not None:
                    key = f"{self.PREFIX}{task_id}"
                    serialized = json.dumps(dict(data), ensure_ascii=False, default=str)
                    pipe.setex(key, self.TTL, serialized)
            await pipe.execute()
        except Exception as e:
            logger.warning("TaskStore Redis flush failed", error=str(e))

    async def force_flush(self):
        """Force un flush immédiat (utile pour les tests)."""
        await self._flush()


# ═══════════════════════════════════════════════════════════════════════════════
# 🆓 GUEST LIMITER — Rate limiting par IP via Redis ZSET
# ═══════════════════════════════════════════════════════════════════════════════


class GuestLimiter:
    """
    Rate limiter pour les analyses guest (3 par IP par 24h).

    Utilise un Redis ZSET par IP:
    - Score = timestamp Unix
    - ZREMRANGEBYSCORE pour purger les entrées >24h
    - ZCARD pour compter les analyses restantes

    Fallback: dict in-memory (même comportement qu'avant).
    """

    PREFIX = "deepsight:guest:"
    WINDOW = 86400  # 24h
    MAX_ANALYSES = 3

    def __init__(self):
        self._local: Dict[str, list] = {}
        self._redis = None

    async def init_redis(self, redis_client):
        """Connecte le limiter au client Redis."""
        self._redis = redis_client
        if redis_client:
            logger.info("GuestLimiter Redis backend initialized")

    async def check(self, client_ip: str) -> tuple:
        """
        Vérifie si l'IP peut analyser.
        Returns: (allowed: bool, used_count: int)
        """
        now = time.time()
        cutoff = now - self.WINDOW

        if self._redis:
            try:
                key = f"{self.PREFIX}{client_ip}"
                pipe = self._redis.pipeline()
                pipe.zremrangebyscore(key, "-inf", cutoff)
                pipe.zcard(key)
                results = await pipe.execute()
                count = results[1]
                return count < self.MAX_ANALYSES, count
            except Exception as e:
                logger.warning("GuestLimiter Redis check failed", error=str(e))

        # Fallback in-memory
        timestamps = self._local.get(client_ip, [])
        timestamps = [ts for ts in timestamps if now - ts < self.WINDOW]
        self._local[client_ip] = timestamps
        return len(timestamps) < self.MAX_ANALYSES, len(timestamps)

    async def record(self, client_ip: str):
        """Enregistre une analyse réussie pour cette IP."""
        now = time.time()

        if self._redis:
            try:
                key = f"{self.PREFIX}{client_ip}"
                await self._redis.zadd(key, {str(now): now})
                await self._redis.expire(key, self.WINDOW)
                return
            except Exception as e:
                logger.warning("GuestLimiter Redis record failed", error=str(e))

        # Fallback in-memory
        if client_ip not in self._local:
            self._local[client_ip] = []
        self._local[client_ip].append(now)

    async def get_remaining(self, client_ip: str) -> int:
        """Retourne le nombre d'analyses restantes pour cette IP."""
        now = time.time()
        cutoff = now - self.WINDOW

        if self._redis:
            try:
                key = f"{self.PREFIX}{client_ip}"
                await self._redis.zremrangebyscore(key, "-inf", cutoff)
                count = await self._redis.zcard(key)
                return max(0, self.MAX_ANALYSES - count)
            except Exception as e:
                logger.warning("GuestLimiter Redis remaining failed", error=str(e))

        timestamps = self._local.get(client_ip, [])
        timestamps = [ts for ts in timestamps if now - ts < self.WINDOW]
        self._local[client_ip] = timestamps
        return max(0, self.MAX_ANALYSES - len(timestamps))

    def cleanup_local(self):
        """Purge les IPs expirées du cache local (optionnel, Redis gère ses TTLs)."""
        now = time.time()
        expired = [ip for ip, timestamps in self._local.items() if all(now - ts > self.WINDOW for ts in timestamps)]
        for ip in expired:
            del self._local[ip]


# ═══════════════════════════════════════════════════════════════════════════════
# 🌍 SINGLETONS
# ═══════════════════════════════════════════════════════════════════════════════

task_store = TaskStore()
guest_limiter = GuestLimiter()
