"""
Suivi des tâches d'analyse de playlist / corpus, partagé entre workers.

Reprend la mécanique de ``core.task_store.TaskStore`` (copie locale + flush
Redis batché, relecture Redis pour les tâches d'un autre worker) avec un
préfixe de clé dédié, pour que le poll ``GET /api/playlists/task/{id}``
réponde quel que soit le worker qui le reçoit.

La connexion Redis est celle du task store principal, branchée au démarrage
par ``main.py`` : on la réutilise au lieu d'ajouter un second branchement.
Sans Redis (dev, tests), le store reste en mémoire comme avant.
"""

from typing import Any

from core.task_store import TaskStore
from core.task_store import task_store as core_task_store


class PlaylistTaskStore(TaskStore):
    """TaskStore des tâches playlist, sous le préfixe ``deepsight:playlist_task:``."""

    PREFIX = "deepsight:playlist_task:"

    @property
    def _redis(self) -> Any:
        own = self.__dict__.get("_own_redis")
        if own is not None:
            return own
        return core_task_store._redis

    @_redis.setter
    def _redis(self, value: Any) -> None:
        self.__dict__["_own_redis"] = value


playlist_task_store = PlaylistTaskStore()
