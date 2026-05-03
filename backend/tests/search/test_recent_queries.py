"""Tests pour le service ``recent_queries``.

Strategie : on force ``_get_redis_client`` a renvoyer ``None`` via ``monkeypatch``
pour que TOUS les tests utilisent le fallback in-memory deterministe. Cela
evite la dependance a un Redis local et garantit l'isolation entre tests
(reset explicite du dict ``_recent_cache`` en fin de chaque test).
"""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _force_in_memory_backend(monkeypatch):
    """Force le fallback in-memory pour tous les tests de ce fichier.

    Par defaut, ``_get_redis_client`` interroge ``cache_service.is_redis`` ; en
    environnement de test, REDIS_URL n'est pas configure donc il renverrait deja
    None. On le force explicitement pour ne pas dependre de cet implicite, et on
    nettoie le dict module-level apres chaque test.
    """
    monkeypatch.setattr("search.recent_queries._get_redis_client", lambda: None)
    yield
    # Cleanup partage entre tests (le dict est module-level).
    from search.recent_queries import _recent_cache

    _recent_cache.clear()


@pytest.mark.asyncio
async def test_push_then_get_returns_in_order():
    """Push 3 queries -> get returns them in reverse order (most recent first)."""
    from search.recent_queries import (
        clear_recent_queries,
        get_recent_queries,
        push_recent_query,
    )

    user_id = 9999
    await clear_recent_queries(user_id)
    await push_recent_query(user_id, "alpha")
    await push_recent_query(user_id, "beta")
    await push_recent_query(user_id, "gamma")

    queries = await get_recent_queries(user_id)
    assert queries[:3] == ["gamma", "beta", "alpha"]


@pytest.mark.asyncio
async def test_push_dedupes():
    """Pushing same query twice doesn't duplicate ; bumps it back to the top."""
    from search.recent_queries import (
        clear_recent_queries,
        get_recent_queries,
        push_recent_query,
    )

    user_id = 9998
    await clear_recent_queries(user_id)
    await push_recent_query(user_id, "alpha")
    await push_recent_query(user_id, "beta")
    await push_recent_query(user_id, "alpha")  # duplicate -> remonte en tete

    queries = await get_recent_queries(user_id)
    # alpha re-push -> nouvelle tete ; beta reste en 2eme.
    assert queries == ["alpha", "beta"]


@pytest.mark.asyncio
async def test_clear_removes_all():
    """clear_recent_queries vide entierement la liste pour un user."""
    from search.recent_queries import (
        clear_recent_queries,
        get_recent_queries,
        push_recent_query,
    )

    user_id = 9997
    await push_recent_query(user_id, "to-clear")
    await clear_recent_queries(user_id)

    queries = await get_recent_queries(user_id)
    assert queries == []
