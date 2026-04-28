import pytest
from unittest.mock import AsyncMock, MagicMock
import json

from voice.companion_context import build_companion_context
from voice.schemas import CompanionContextResponse


@pytest.mark.asyncio
async def test_build_companion_context_cache_miss_full_pipeline():
    user = MagicMock(id=1, prenom="Maxime", first_name="Maxime",
                     plan="pro", language="fr", created_at="2024-01-01")
    db = AsyncMock()
    db.fetch_user_summary_count.return_value = 42
    db.fetch_recent_summaries.return_value = [
        MagicMock(title=f"Vidéo {i}", category="ia") for i in range(8)
    ]
    db.fetch_user_study_stats.return_value = MagicMock(
        current_streak_days=5, flashcards_due_today=3,
    )

    redis = AsyncMock()
    redis.get.return_value = None  # cache miss

    services = MagicMock()
    services.themes_fn = AsyncMock(return_value=["ia", "philo", "tech"])
    services.initial_recos_fn = AsyncMock(return_value=[])

    resp = await build_companion_context(
        user=user, db=db, redis=redis, services=services,
    )

    assert isinstance(resp, CompanionContextResponse)
    assert resp.profile.prenom == "Maxime"
    assert resp.profile.themes == ["ia", "philo", "tech"]
    assert resp.cache_hit is False
    redis.set.assert_called_once()  # write through


@pytest.mark.asyncio
async def test_build_companion_context_cache_hit_skips_pipeline():
    user = MagicMock(id=1, prenom="X", first_name="X", plan="pro", language="fr")
    db = AsyncMock()
    redis = AsyncMock()
    cached = {
        "profile": {
            "prenom": "Cached", "plan": "pro", "langue": "fr",
            "total_analyses": 1, "recent_titles": [],
            "themes": ["a", "b", "c"],
            "streak_days": 0, "flashcards_due_today": 0,
        },
        "initial_recos": [],
        "cache_hit": False,
    }
    redis.get.return_value = json.dumps(cached)

    services = MagicMock()
    services.themes_fn = AsyncMock()
    services.initial_recos_fn = AsyncMock()

    resp = await build_companion_context(user=user, db=db, redis=redis, services=services)
    assert resp.profile.prenom == "Cached"
    assert resp.cache_hit is True
    services.themes_fn.assert_not_called()
    services.initial_recos_fn.assert_not_called()


@pytest.mark.asyncio
async def test_build_companion_context_force_refresh():
    user = MagicMock(id=1, prenom="X", first_name="X", plan="pro", language="fr",
                     created_at="2024-01-01")
    db = AsyncMock()
    db.fetch_user_summary_count.return_value = 0
    db.fetch_recent_summaries.return_value = []
    db.fetch_user_study_stats.return_value = MagicMock(
        current_streak_days=0, flashcards_due_today=0,
    )

    redis = AsyncMock()
    redis.get.return_value = json.dumps({"any": "thing"})  # ignored

    services = MagicMock()
    services.themes_fn = AsyncMock(return_value=[])
    services.initial_recos_fn = AsyncMock(return_value=[])

    resp = await build_companion_context(
        user=user, db=db, redis=redis, services=services, force_refresh=True,
    )
    assert resp.cache_hit is False
    redis.get.assert_not_called()


@pytest.mark.asyncio
async def test_invalidate_companion_context_cache():
    from voice.companion_context import invalidate_companion_context_cache
    redis = AsyncMock()
    await invalidate_companion_context_cache(redis=redis, user_id=42)
    redis.delete.assert_called_once_with("companion_context:42")
