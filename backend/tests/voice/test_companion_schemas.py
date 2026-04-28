"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 COMPANION SCHEMAS — Tests for Coach Vocal Découverte (Task 1)                  ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Coverage:
  - RecoItem: minimal valid construction + invalid source rejection
  - CompanionContextResponse: full nested shape
  - StartAnalysisRequest: youtube URL accepted
  - GetMoreRecosRequest: optional source default = None
"""

import pytest
from pydantic import ValidationError

from voice.schemas import (
    CompanionContextResponse,
    GetMoreRecosRequest,
    ProfileBlock,
    RecoItem,
    StartAnalysisRequest,
)


def test_reco_item_minimal():
    item = RecoItem(
        video_id="dQw4w9WgXcQ",
        title="Test",
        channel="Chan",
        duration_seconds=120,
        source="tournesol",
        why="parce que",
    )
    assert item.video_id == "dQw4w9WgXcQ"


def test_reco_item_invalid_source():
    with pytest.raises(ValidationError):
        RecoItem(
            video_id="x",
            title="t",
            channel="c",
            duration_seconds=10,
            source="invalid_source",
            why="w",
        )


def test_companion_context_response_shape():
    resp = CompanionContextResponse(
        profile=ProfileBlock(
            prenom="Maxime",
            plan="pro",
            langue="fr",
            total_analyses=42,
            recent_titles=[],
            themes=["IA", "philo", "physique"],
            streak_days=5,
            flashcards_due_today=3,
        ),
        initial_recos=[],
        cache_hit=False,
    )
    assert resp.profile.prenom == "Maxime"


def test_start_analysis_request_youtube_url():
    req = StartAnalysisRequest(video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert "youtube" in req.video_url


def test_get_more_recos_request_default_source():
    req = GetMoreRecosRequest(topic="géopolitique")
    assert req.source is None
