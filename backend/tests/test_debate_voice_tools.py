"""Tests for debate voice webhook tools."""
import json
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from voice.debate_tools import (
    get_debate_overview,
    get_video_thesis,
    get_argument_comparison,
    get_debate_fact_check,
)
from db.database import DebateAnalysis


def _make_debate(**overrides) -> DebateAnalysis:
    defaults = dict(
        id=42, user_id=1,
        video_a_id="vidA", platform_a="youtube",
        video_a_title="Vidéo A title", video_a_channel="Channel A",
        video_b_id="vidB", platform_b="youtube",
        video_b_title="Vidéo B title", video_b_channel="Channel B",
        detected_topic="Sujet test",
        thesis_a="Thèse A détaillée", thesis_b="Thèse B détaillée",
        arguments_a=json.dumps([
            {"claim": "Arg A1", "evidence": "E1", "strength": "strong"},
            {"claim": "Arg A2", "evidence": "E2", "strength": "moderate"},
        ]),
        arguments_b=json.dumps([
            {"claim": "Arg B1", "evidence": "E1b", "strength": "strong"},
        ]),
        convergence_points=json.dumps(["conv1"]),
        divergence_points=json.dumps([
            {"topic": "Prix", "position_a": "cher", "position_b": "OK"}
        ]),
        fact_check_results=json.dumps([
            {"claim": "test claim", "verdict": "confirmed", "explanation": "OK"}
        ]),
        debate_summary="Synthèse test",
        status="completed", lang="fr", created_at=datetime.utcnow(),
    )
    defaults.update(overrides)
    return DebateAnalysis(**defaults)


@pytest.fixture
def mock_db_with_debate():
    debate = _make_debate()
    db = AsyncMock(spec=AsyncSession)
    result = MagicMock()
    result.scalar_one_or_none.return_value = debate
    db.execute = AsyncMock(return_value=result)
    return db, debate


@pytest.mark.asyncio
async def test_get_debate_overview_returns_topic_and_theses(mock_db_with_debate):
    db, _ = mock_db_with_debate
    out = await get_debate_overview(42, db)
    assert "Sujet test" in out
    assert "Thèse A détaillée" in out
    assert "Thèse B détaillée" in out
    assert "Synthèse test" in out


@pytest.mark.asyncio
async def test_get_debate_overview_handles_missing_debate():
    db = AsyncMock(spec=AsyncSession)
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=result)
    out = await get_debate_overview(999, db)
    assert "introuvable" in out.lower()


@pytest.mark.asyncio
async def test_get_video_thesis_video_a(mock_db_with_debate):
    db, _ = mock_db_with_debate
    out = await get_video_thesis(42, "video_a", db)
    assert "Vidéo A title" in out
    assert "Thèse A détaillée" in out
    assert "Arg A1" in out
    assert "Arg A2" in out


@pytest.mark.asyncio
async def test_get_video_thesis_video_b(mock_db_with_debate):
    db, _ = mock_db_with_debate
    out = await get_video_thesis(42, "video_b", db)
    assert "Vidéo B title" in out
    assert "Thèse B détaillée" in out
    assert "Arg B1" in out
    assert "Arg A1" not in out


@pytest.mark.asyncio
async def test_get_video_thesis_invalid_side(mock_db_with_debate):
    db, _ = mock_db_with_debate
    out = await get_video_thesis(42, "video_c", db)
    assert "video_a" in out.lower() or "video_b" in out.lower()


@pytest.mark.asyncio
async def test_get_argument_comparison_finds_topic(mock_db_with_debate):
    db, _ = mock_db_with_debate
    out = await get_argument_comparison(42, "Prix", db)
    assert "Prix" in out
    assert "cher" in out
    assert "OK" in out


@pytest.mark.asyncio
async def test_get_argument_comparison_no_topic_returns_all(mock_db_with_debate):
    db, _ = mock_db_with_debate
    out = await get_argument_comparison(42, "", db)
    assert "Prix" in out


@pytest.mark.asyncio
async def test_get_debate_fact_check_returns_verdicts(mock_db_with_debate):
    db, _ = mock_db_with_debate
    out = await get_debate_fact_check(42, db)
    assert "confirmed" in out.lower() or "confirmé" in out.lower()
    assert "test claim" in out
