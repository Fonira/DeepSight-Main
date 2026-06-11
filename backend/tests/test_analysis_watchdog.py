"""Tests du watchdog anti-gel des tâches d'analyse en arrière-plan.

Couvre `_run_analysis_with_watchdog` :
- sur dépassement du timeout → tâche `failed`, crédits libérés, user notifié ;
- en cas de succès → passe-plat transparent, aucune logique d'échec déclenchée.

Contexte : une BackgroundTask FastAPI sans borne temporelle peut rester figée
indéfiniment sur un `await` réseau non protégé. Le watchdog garantit qu'un gel
se termine en échec propre et diagnosticable au lieu de bloquer l'UI à 98 %.
"""

import asyncio
import importlib

import pytest
from unittest.mock import AsyncMock

_videos_router = importlib.import_module("videos.router")


class _FakeSession:
    """Faux async context manager pour court-circuiter async_session_maker()."""

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


@pytest.fixture
def isolate_task_store(monkeypatch):
    """Remplace le _task_store (sync Redis) par un dict en mémoire isolé."""
    store: dict = {}
    monkeypatch.setattr(_videos_router, "_task_store", store)
    return store


async def test_watchdog_timeout_marks_failed_and_releases_credits(isolate_task_store, monkeypatch):
    task_id = "abcdef123456task"
    user_id = 42

    # Timeout quasi-immédiat pour le test
    monkeypatch.setattr(_videos_router, "ANALYSIS_HARD_TIMEOUT_SEC", 0.05)
    monkeypatch.setattr(_videos_router, "SECURITY_AVAILABLE", True)

    release_mock = AsyncMock()
    update_mock = AsyncMock()
    notify_mock = AsyncMock()
    # raising=False : ces noms ne sont liés au niveau module que si l'import
    # core.security réussit (pattern SECURITY_AVAILABLE) ; absents en CI.
    monkeypatch.setattr(_videos_router, "release_reserved_credits", release_mock, raising=False)
    monkeypatch.setattr(_videos_router, "update_task_status", update_mock, raising=False)
    monkeypatch.setattr(_videos_router, "notify_analysis_failed", notify_mock, raising=False)
    # async_session_maker est ré-importé localement depuis db.database
    import db.database as _db

    monkeypatch.setattr(_db, "async_session_maker", lambda: _FakeSession())

    async def slow_analyze(**kwargs):
        # Plus long que le timeout → doit être interrompu par le watchdog
        await asyncio.sleep(5)

    await _videos_router._run_analysis_with_watchdog(
        slow_analyze, task_id=task_id, user_id=user_id, video_id="v123"
    )

    # Tâche marquée en échec avec le code d'erreur dédié
    assert isolate_task_store[task_id]["status"] == "failed"
    assert isolate_task_store[task_id]["error"] == "analysis_timeout"
    assert isolate_task_store[task_id]["user_id"] == user_id

    # Crédits réservés libérés + persistance DB + notification
    release_mock.assert_awaited_once_with(user_id, task_id)
    update_mock.assert_awaited_once()
    notify_mock.assert_awaited_once()


async def test_watchdog_success_is_transparent(isolate_task_store, monkeypatch):
    task_id = "successtask00001"
    user_id = 7

    monkeypatch.setattr(_videos_router, "ANALYSIS_HARD_TIMEOUT_SEC", 30)
    monkeypatch.setattr(_videos_router, "SECURITY_AVAILABLE", True)

    release_mock = AsyncMock()
    monkeypatch.setattr(_videos_router, "release_reserved_credits", release_mock, raising=False)

    analyze_mock = AsyncMock()

    await _videos_router._run_analysis_with_watchdog(
        analyze_mock, task_id=task_id, user_id=user_id, video_id="v999", lang="fr"
    )

    # La vraie fonction d'analyse est appelée avec TOUS les kwargs, inchangés
    analyze_mock.assert_awaited_once_with(
        task_id=task_id, user_id=user_id, video_id="v999", lang="fr"
    )
    # Aucune logique d'échec : pas de marquage failed, pas de libération de crédits
    assert task_id not in isolate_task_store
    release_mock.assert_not_awaited()
