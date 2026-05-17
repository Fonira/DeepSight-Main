"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — comments/take_generator.py (Mistral JSON-mode + anti-sycophancy)      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from comments.schemas import Comment, CommentsBatch, CommunityTake
from comments import take_generator as tg
from core.llm_provider import LLMResult


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def sample_batch():
    return CommentsBatch(
        platform="youtube",
        video_id="abc123",
        total_seen=200,
        sampled=[
            Comment(
                comment_id=f"c{i}",
                author=f"user{i}",
                text=f"Comment text {i}",
                like_count=100 - i,
            )
            for i in range(50)
        ],
    )


def _mock_llm_response(payload: dict, model: str = "mistral-medium-2508") -> LLMResult:
    return LLMResult(
        content=json.dumps(payload),
        model_used=model,
        provider="mistral",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — happy path
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_generate_take_happy_path(sample_batch):
    mock_payload = {
        "agreement_signal": "mixed",
        "sentiment_distribution": {
            "positive": 0.5,
            "neutral": 0.3,
            "negative": 0.2,
        },
        "controversies": ["Désaccord sur le point X", "Méthodologie contestée"],
        "community_summary": (
            "La communauté est divisée. Beaucoup saluent l'effort mais critiquent le manque de sources."
        ),
        "top_voices": [
            {
                "author": "Un commentateur populaire",
                "excerpt": "Vidéo très claire merci !",
                "stance": "agree",
                "like_count": 1200,
            },
            {
                "author": "Une réponse récente",
                "excerpt": "Mais où sont les sources ?",
                "stance": "disagree",
                "like_count": 340,
            },
        ],
    }

    with patch.object(tg, "llm_complete", AsyncMock(return_value=_mock_llm_response(mock_payload))):
        take = await tg.generate_community_take(
            batch=sample_batch,
            plan="pro",
            video_title="Test Video",
            video_topic_hint="Tech",
            creator_stance="",
            lang="fr",
        )

    assert isinstance(take, CommunityTake)
    assert take.agreement_signal == "mixed"
    assert take.comments_analyzed == 50
    assert take.model_used == "mistral-medium-2508"
    assert len(take.top_voices) == 2
    assert take.sentiment_distribution["positive"] == 0.5


@pytest.mark.asyncio
async def test_generate_take_uses_correct_model_per_plan(sample_batch):
    """plan → model mapping respecté."""
    matrix = [
        ("free", "mistral-small-2603"),
        ("pro", "mistral-medium-2508"),
        ("expert", "mistral-large-2512"),
    ]
    payload = {
        "agreement_signal": "unclear",
        "sentiment_distribution": {"positive": 0.4, "neutral": 0.4, "negative": 0.2},
        "controversies": [],
        "community_summary": "Test",
        "top_voices": [],
    }

    for plan, expected_model in matrix:
        with patch.object(
            tg, "llm_complete", AsyncMock(return_value=_mock_llm_response(payload, model=expected_model))
        ) as mock_complete:
            await tg.generate_community_take(
                batch=sample_batch,
                plan=plan,
                video_title="x",
                video_topic_hint="",
                creator_stance="",
                lang="fr",
            )
            assert mock_complete.call_args.kwargs["model"] == expected_model


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — anti-sycophancy floor
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_anti_sycophancy_floor_forces_mixed_when_no_dominant(sample_batch):
    """Si Mistral dit 'agree' mais max sentiment < 0.5 → on force 'mixed'."""
    payload = {
        "agreement_signal": "agree",  # Mistral fait du sycophancy
        "sentiment_distribution": {
            "positive": 0.45,  # < 0.5
            "neutral": 0.30,
            "negative": 0.25,
        },
        "controversies": [],
        "community_summary": "Bof.",
        "top_voices": [],
    }
    with patch.object(tg, "llm_complete", AsyncMock(return_value=_mock_llm_response(payload))):
        take = await tg.generate_community_take(
            batch=sample_batch,
            plan="pro",
            video_title="x",
            video_topic_hint="",
            creator_stance="",
            lang="fr",
        )

    assert take is not None
    assert take.agreement_signal == "mixed", "Anti-sycophancy floor should force mixed"


@pytest.mark.asyncio
async def test_anti_sycophancy_floor_keeps_agree_when_dominant(sample_batch):
    """Si max sentiment >= 0.5 et signal='agree' → on conserve 'agree'."""
    payload = {
        "agreement_signal": "agree",
        "sentiment_distribution": {
            "positive": 0.7,  # >= 0.5
            "neutral": 0.2,
            "negative": 0.1,
        },
        "controversies": [],
        "community_summary": "Globalement d'accord.",
        "top_voices": [],
    }
    with patch.object(tg, "llm_complete", AsyncMock(return_value=_mock_llm_response(payload))):
        take = await tg.generate_community_take(
            batch=sample_batch,
            plan="pro",
            video_title="x",
            video_topic_hint="",
            creator_stance="",
            lang="fr",
        )

    assert take.agreement_signal == "agree"


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — error cases
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_generate_take_empty_batch_returns_none():
    """sampled vide → return None (pas d'appel Mistral)."""
    empty = CommentsBatch(platform="youtube", video_id="x", sampled=[], total_seen=0)
    with patch.object(tg, "llm_complete", AsyncMock()) as mock:
        take = await tg.generate_community_take(
            batch=empty,
            plan="pro",
            video_title="x",
            video_topic_hint="",
            creator_stance="",
            lang="fr",
        )
    assert take is None
    assert not mock.called


@pytest.mark.asyncio
async def test_generate_take_llm_none_returns_none(sample_batch):
    """llm_complete returns None → return None."""
    with patch.object(tg, "llm_complete", AsyncMock(return_value=None)):
        take = await tg.generate_community_take(
            batch=sample_batch,
            plan="pro",
            video_title="x",
            video_topic_hint="",
            creator_stance="",
            lang="fr",
        )
    assert take is None


@pytest.mark.asyncio
async def test_generate_take_invalid_json_returns_none(sample_batch):
    """llm_complete returns garbage → return None."""
    bad = LLMResult(content="not a json at all !!", model_used="x", provider="mistral")
    with patch.object(tg, "llm_complete", AsyncMock(return_value=bad)):
        take = await tg.generate_community_take(
            batch=sample_batch,
            plan="pro",
            video_title="x",
            video_topic_hint="",
            creator_stance="",
            lang="fr",
        )
    assert take is None


@pytest.mark.asyncio
async def test_generate_take_strips_code_fences(sample_batch):
    """Mistral peut wrapper la réponse en ```json ... ``` → on retire."""
    payload = {
        "agreement_signal": "agree",
        "sentiment_distribution": {"positive": 0.8, "neutral": 0.1, "negative": 0.1},
        "controversies": [],
        "community_summary": "OK.",
        "top_voices": [],
    }
    fenced = LLMResult(
        content="```json\n" + json.dumps(payload) + "\n```",
        model_used="mistral-medium-2508",
        provider="mistral",
    )
    with patch.object(tg, "llm_complete", AsyncMock(return_value=fenced)):
        take = await tg.generate_community_take(
            batch=sample_batch,
            plan="pro",
            video_title="x",
            video_topic_hint="",
            creator_stance="",
            lang="fr",
        )
    assert take is not None
    assert take.agreement_signal == "agree"


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — helpers internes
# ═══════════════════════════════════════════════════════════════════════════════


def test_pseudonymize():
    assert tg._pseudonymize("Maxime") == "M***"
    assert tg._pseudonymize("") == "anon"
    assert tg._pseudonymize(None) == "anon"
    assert tg._pseudonymize("   ") == "anon"


def test_normalize_sentiment_renormalizes_to_one():
    sd = {"positive": 1.0, "neutral": 1.0, "negative": 0.0}
    out = tg._normalize_sentiment(sd)
    assert abs(sum(out.values()) - 1.0) < 1e-6
    assert out["positive"] == 0.5


def test_normalize_sentiment_handles_zero():
    """Toutes les valeurs à 0 → default neutre 1.0."""
    sd = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
    out = tg._normalize_sentiment(sd)
    assert out["neutral"] == 1.0


def test_normalize_sentiment_handles_none():
    out = tg._normalize_sentiment(None)
    assert out["neutral"] == 1.0


def test_strip_code_fences():
    assert tg._strip_code_fences("```json\n{}\n```") == "{}"
    assert tg._strip_code_fences("```\n{}\n```") == "{}"
    assert tg._strip_code_fences("{}") == "{}"
    assert tg._strip_code_fences("  {}  ") == "{}"


def test_build_user_prompt_fr_contains_marker(sample_batch):
    p = tg._build_user_prompt(
        sample_batch,
        video_title="My Video",
        video_topic_hint="tech",
        creator_stance="",
        lang="fr",
    )
    assert "VIDEO" in p
    assert "PLATEFORME" in p
    assert "user0" not in p  # pseudo doit être tronqué
    assert "@u***" in p


def test_build_user_prompt_en(sample_batch):
    p = tg._build_user_prompt(
        sample_batch,
        video_title="My Video",
        video_topic_hint="tech",
        creator_stance="",
        lang="en",
    )
    assert "PLATFORM" in p
    assert "TOPIC" in p
