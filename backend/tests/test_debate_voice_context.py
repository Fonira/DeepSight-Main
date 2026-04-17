"""Tests for debate voice context assembly."""
import json
import pytest
import pytest_asyncio
from datetime import datetime
from unittest.mock import AsyncMock

from voice.debate_context import build_debate_rich_context, DebateRichContext
from db.database import DebateAnalysis


def _make_debate(**overrides) -> DebateAnalysis:
    """Factory for a fully-populated DebateAnalysis."""
    defaults = dict(
        id=1,
        user_id=1,
        video_a_id="abc123DEF45",
        platform_a="youtube",
        video_a_title="AirPods Max 2 critique",
        video_a_channel="Les Numériques",
        video_a_thumbnail="https://img.youtube.com/vi/abc123DEF45/maxresdefault.jpg",
        video_b_id="xyz789GHI01",
        platform_b="youtube",
        video_b_title="AirPods Max 2 test complet",
        video_b_channel="iBordelais",
        video_b_thumbnail="https://img.youtube.com/vi/xyz789GHI01/maxresdefault.jpg",
        detected_topic="Lancement et évaluation du casque Apple AirPods Max 2",
        thesis_a="Apple a manqué une opportunité majeure avec l'AirPods Max 2",
        thesis_b="Le AirPods Max 2 représente une évolution significative",
        arguments_a=json.dumps([{"claim": "A1", "evidence": "E1", "strength": "strong"}]),
        arguments_b=json.dumps([{"claim": "B1", "evidence": "E1b", "strength": "strong"}]),
        convergence_points=json.dumps(["Même design", "Même poids"]),
        divergence_points=json.dumps([
            {"topic": "Prix", "position_a": "trop cher", "position_b": "justifié"}
        ]),
        fact_check_results=json.dumps([
            {"claim": "387g poids", "verdict": "confirmed", "source": "Apple", "explanation": "OK"}
        ]),
        debate_summary="Synthèse courte du débat entre Apple et les testeurs.",
        status="completed",
        mode="auto",
        lang="fr",
        created_at=datetime.utcnow(),
    )
    defaults.update(overrides)
    return DebateAnalysis(**defaults)


@pytest.mark.asyncio
async def test_build_debate_rich_context_populates_all_fields():
    db = AsyncMock()
    debate = _make_debate()

    ctx = await build_debate_rich_context(debate, db, include_transcripts=False)

    assert isinstance(ctx, DebateRichContext)
    assert ctx.topic == "Lancement et évaluation du casque Apple AirPods Max 2"
    assert ctx.video_a_title == "AirPods Max 2 critique"
    assert ctx.video_b_title == "AirPods Max 2 test complet"
    assert ctx.thesis_a.startswith("Apple a manqué")
    assert ctx.thesis_b.startswith("Le AirPods Max 2")
    assert len(ctx.arguments_a) == 1
    assert ctx.arguments_a[0]["claim"] == "A1"
    assert len(ctx.convergence_points) == 2
    assert ctx.divergence_points[0]["topic"] == "Prix"
    assert ctx.fact_check[0]["verdict"] == "confirmed"
    assert ctx.debate_summary.startswith("Synthèse")


@pytest.mark.asyncio
async def test_format_for_voice_respects_max_chars():
    db = AsyncMock()
    debate = _make_debate(debate_summary="X" * 100_000)
    ctx = await build_debate_rich_context(debate, db, include_transcripts=False)

    formatted = ctx.format_for_voice(language="fr", max_chars=12_000)

    assert len(formatted) <= 12_000
    assert "VIDÉO A" in formatted
    assert "VIDÉO B" in formatted
    assert "Les Numériques" in formatted
    assert "iBordelais" in formatted


@pytest.mark.asyncio
async def test_format_for_voice_english():
    db = AsyncMock()
    ctx = await build_debate_rich_context(_make_debate(lang="en"), db, include_transcripts=False)
    formatted = ctx.format_for_voice(language="en", max_chars=12_000)
    assert "VIDEO A" in formatted
    assert "VIDEO B" in formatted
    assert "Thesis" in formatted or "THESIS" in formatted
