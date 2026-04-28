"""Integration smoke for the Coach Vocal Découverte sprint.

This module is a meta-test that exercises the Companion stack end-to-end
by composing the unit tests already validated in:

  - test_companion_schemas.py        (Pydantic shapes)
  - test_companion_themes.py         (top-3 themes — fallback + LLM)
  - test_companion_recos.py          (4 sources + initial-3 + fallback chain)
  - test_companion_context.py        (build + cache Redis + invalidation)
  - test_companion_endpoint.py       (GET /api/voice/companion-context)
  - test_companion_prompt.py         (template + injection at /voice/session)
  - test_companion_tools.py          (tools/companion-recos + tools/start-analysis)

It also does a single end-to-end smoke that wires render_companion_prompt
against a live build_companion_context call (in-memory mocks) to verify
the prompt produced when the full pipeline runs is non-empty and contains
the user's prénom and the 'get_more_recos' / 'start_analysis' tool refs.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock

from voice.companion_context import build_companion_context
from voice.companion_prompt import render_companion_prompt
from voice.schemas import RecoItem


@pytest.mark.asyncio
async def test_companion_full_pipeline_smoke():
    """Smoke: build context → render prompt — both succeed with realistic mocks."""
    user = MagicMock(
        id=1,
        prenom="Maxime",
        first_name="Maxime",
        plan="pro",
        language="fr",
        created_at="2024-01-01",
    )
    db = AsyncMock()
    db.fetch_user_summary_count.return_value = 42
    db.fetch_recent_summaries.return_value = [
        MagicMock(title="IA et conscience", category="ia"),
        MagicMock(title="Géopolitique 2026", category="géopolitique"),
    ]
    db.fetch_user_study_stats.return_value = MagicMock(
        current_streak_days=12, flashcards_due_today=8
    )

    redis = AsyncMock()
    redis.get.return_value = None  # cache miss

    services = MagicMock()
    services.themes_fn = AsyncMock(return_value=["IA", "philo", "géopolitique"])
    services.initial_recos_fn = AsyncMock(
        return_value=[
            RecoItem(
                video_id="abc123",
                title="Reco 1",
                channel="C1",
                duration_seconds=600,
                source="history_similarity",
                why="Similaire à ton analyse 'IA et conscience'",
            ),
            RecoItem(
                video_id="def456",
                title="Reco 2",
                channel="C2",
                duration_seconds=400,
                source="trending",
                why="Cartonne en ce moment sur DeepSight",
            ),
        ]
    )

    ctx = await build_companion_context(
        user=user, db=db, redis=redis, services=services
    )

    # Assertions on context
    assert ctx.profile.prenom == "Maxime"
    assert ctx.profile.themes == ["IA", "philo", "géopolitique"]
    assert ctx.profile.streak_days == 12
    assert len(ctx.initial_recos) == 2
    assert ctx.cache_hit is False

    # Render the prompt
    prompt = render_companion_prompt(ctx)

    # Assertions on rendered prompt — full pipeline is wired
    assert "Maxime" in prompt
    assert "IA" in prompt
    assert "Reco 1" in prompt
    assert "Reco 2" in prompt
    assert "12" in prompt  # streak
    assert "get_more_recos" in prompt  # tool ref
    assert "start_analysis" in prompt  # tool ref
    assert "DeepSight Companion" in prompt
