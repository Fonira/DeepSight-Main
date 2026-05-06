"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST SUMMARY ENRICHMENT SERVICE — spike 2026-05-06                             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Tests unitaires pour generate_summary_extras + _validate_extras_shape.            ║
║  llm_complete mocké (AsyncMock) pour éviter tout appel Mistral réel.               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import os
import sys
import pytest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


def _make_summary(sid: int = 1, content: str = "Long content to enrich " * 50):
    """Stub Summary minimal avec full_digest exploitable."""
    from db.database import Summary

    return Summary(
        id=sid,
        user_id=1,
        video_id=f"vid{sid}",
        video_title="Test video",
        video_channel="Test channel",
        summary_content=content,
        full_digest=f"Hierarchical digest #{sid} — {content}",
    )


def _llm_result(content: str):
    from core.llm_provider import LLMResult

    return LLMResult(
        content=content,
        model_used="mistral-medium-2508",
        provider="mistral",
        attempts=1,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# _validate_extras_shape
# ═══════════════════════════════════════════════════════════════════════════════


def test_validate_extras_shape_full_v2_shape():
    from videos.summary_enrichment_service import _validate_extras_shape

    raw = {
        "key_quotes": [
            {"quote": "Citation 1", "context": "Contexte"},
            {"quote": "Citation 2"},  # context optionnel
        ],
        "key_takeaways": ["Takeaway A", "Takeaway B"],
        "chapter_themes": [
            {"theme": "Chapter 1", "summary": "Synthèse"},
            {"theme": "Chapter 2"},  # summary optionnel
        ],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    assert len(out["key_quotes"]) == 2
    assert out["key_quotes"][0]["quote"] == "Citation 1"
    assert out["key_quotes"][0]["context"] == "Contexte"
    assert "context" not in out["key_quotes"][1]
    assert out["key_takeaways"] == ["Takeaway A", "Takeaway B"]
    assert len(out["chapter_themes"]) == 2
    assert out["chapter_themes"][0]["summary"] == "Synthèse"
    assert "summary" not in out["chapter_themes"][1]


def test_validate_extras_shape_empty_returns_none():
    from videos.summary_enrichment_service import _validate_extras_shape

    raw = {"key_quotes": [], "key_takeaways": [], "chapter_themes": []}
    assert _validate_extras_shape(raw) is None


def test_validate_extras_shape_caps_quotes_at_5():
    from videos.summary_enrichment_service import (
        MAX_QUOTES,
        _validate_extras_shape,
    )

    raw = {
        "key_quotes": [{"quote": f"Q{i}"} for i in range(20)],
        "key_takeaways": [],
        "chapter_themes": [],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    assert len(out["key_quotes"]) == MAX_QUOTES


def test_validate_extras_shape_dedup_takeaways_case_insensitive():
    from videos.summary_enrichment_service import _validate_extras_shape

    raw = {
        "key_quotes": [],
        "key_takeaways": ["Takeaway A", "TAKEAWAY A", "  takeaway a  ", "Other"],
        "chapter_themes": [],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    assert out["key_takeaways"] == ["Takeaway A", "Other"]


def test_validate_extras_shape_rejects_non_dict_input():
    from videos.summary_enrichment_service import _validate_extras_shape

    assert _validate_extras_shape(None) is None
    assert _validate_extras_shape([]) is None
    assert _validate_extras_shape("string") is None


def test_validate_extras_shape_partial_fields_ok():
    """Only takeaways → still valid (les autres champs sont optionnels)."""
    from videos.summary_enrichment_service import _validate_extras_shape

    raw = {"key_quotes": [], "key_takeaways": ["just one"], "chapter_themes": []}
    out = _validate_extras_shape(raw)
    assert out is not None
    assert out["key_takeaways"] == ["just one"]
    assert out["key_quotes"] == []
    assert out["chapter_themes"] == []


# ═══════════════════════════════════════════════════════════════════════════════
# generate_summary_extras (Mistral mocked)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_generate_summary_extras_happy_path():
    summary = _make_summary()

    valid_json = json.dumps(
        {
            "key_quotes": [{"quote": "Marquante", "context": "Pourquoi"}],
            "key_takeaways": ["TK1", "TK2", "TK3", "TK4"],
            "chapter_themes": [
                {"theme": "Ch1", "summary": "S1"},
                {"theme": "Ch2"},
            ],
        }
    )

    with patch(
        "videos.summary_enrichment_service.llm_complete",
        new_callable=AsyncMock,
        return_value=_llm_result(valid_json),
    ):
        from videos.summary_enrichment_service import generate_summary_extras

        result = await generate_summary_extras(summary)

    assert result is not None
    assert len(result["key_quotes"]) == 1
    assert len(result["key_takeaways"]) == 4
    assert len(result["chapter_themes"]) == 2


@pytest.mark.asyncio
async def test_generate_summary_extras_returns_none_on_total_failure():
    summary = _make_summary()
    with patch(
        "videos.summary_enrichment_service.llm_complete",
        new_callable=AsyncMock,
        return_value=None,
    ):
        from videos.summary_enrichment_service import generate_summary_extras

        result = await generate_summary_extras(summary)
    assert result is None


@pytest.mark.asyncio
async def test_generate_summary_extras_returns_none_on_empty_input():
    """Summary sans full_digest, summary_content, ni transcript_context → None."""
    from db.database import Summary

    empty_summary = Summary(
        id=1,
        user_id=1,
        video_id="empty",
        video_title="Empty",
        summary_content=None,
        full_digest=None,
        transcript_context=None,
    )

    with patch(
        "videos.summary_enrichment_service.llm_complete",
        new_callable=AsyncMock,
    ) as mock:
        from videos.summary_enrichment_service import generate_summary_extras

        result = await generate_summary_extras(empty_summary)
        assert result is None
        mock.assert_not_called()


@pytest.mark.asyncio
async def test_generate_summary_extras_retries_on_invalid_json():
    summary = _make_summary()
    valid_json = json.dumps(
        {
            "key_quotes": [],
            "key_takeaways": ["A", "B"],
            "chapter_themes": [],
        }
    )
    mock = AsyncMock(
        side_effect=[
            _llm_result("not json {{{"),
            _llm_result(valid_json),
        ]
    )
    with patch("videos.summary_enrichment_service.llm_complete", new=mock):
        from videos.summary_enrichment_service import generate_summary_extras

        result = await generate_summary_extras(summary)

    assert result is not None
    assert mock.await_count == 2


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 OPTION A 2026-05-06 — synthesis + key_points + key_quote sur thème
# ═══════════════════════════════════════════════════════════════════════════════


def test_validate_extras_shape_v2_with_synthesis_and_key_points():
    """Payload v2 complet : synthesis + key_points + key_quote sur thème."""
    from videos.summary_enrichment_service import _validate_extras_shape

    raw = {
        "synthesis": "Vue d'ensemble en 4-6 phrases.",
        "key_quotes": [{"quote": "Q1"}],
        "key_takeaways": ["T1"],
        "chapter_themes": [
            {
                "theme": "Thème A",
                "summary": "Résumé du thème",
                "key_points": ["Point 1", "Point 2", "Point 3"],
                "key_quote": {
                    "quote": "Citation du thème",
                    "context": "Contexte mini",
                },
            }
        ],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    assert out["synthesis"] == "Vue d'ensemble en 4-6 phrases."
    assert out["chapter_themes"][0]["key_points"] == ["Point 1", "Point 2", "Point 3"]
    assert out["chapter_themes"][0]["key_quote"]["quote"] == "Citation du thème"
    assert out["chapter_themes"][0]["key_quote"]["context"] == "Contexte mini"


def test_validate_extras_shape_v1_backward_compat():
    """Payload v1 (sans synthesis ni key_points/key_quote) reste valide."""
    from videos.summary_enrichment_service import _validate_extras_shape

    raw = {
        "key_quotes": [{"quote": "Q1", "context": "C1"}],
        "key_takeaways": ["T1"],
        "chapter_themes": [{"theme": "Th1", "summary": "Sum1"}],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    # synthesis absent → clé non incluse dans le payload normalisé
    assert "synthesis" not in out
    # Thème v1 sans key_points / key_quote → clés absentes
    assert "key_points" not in out["chapter_themes"][0]
    assert "key_quote" not in out["chapter_themes"][0]
    assert out["chapter_themes"][0]["theme"] == "Th1"


def test_validate_extras_shape_synthesis_truncated_at_max():
    """synthesis dépassant MAX_SYNTHESIS_CHARS est tronqué avec ellipse."""
    from videos.summary_enrichment_service import (
        MAX_SYNTHESIS_CHARS,
        _validate_extras_shape,
    )

    long_synthesis = "A" * (MAX_SYNTHESIS_CHARS + 200)
    raw = {
        "synthesis": long_synthesis,
        "key_quotes": [],
        "key_takeaways": ["T1"],
        "chapter_themes": [],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    assert out["synthesis"].endswith("…")
    # ≤ MAX + 1 (ellipse char)
    assert len(out["synthesis"]) <= MAX_SYNTHESIS_CHARS + 1


def test_validate_extras_shape_synthesis_only_returns_payload():
    """Un payload avec uniquement `synthesis` (toutes autres sections vides) reste valide."""
    from videos.summary_enrichment_service import _validate_extras_shape

    raw = {
        "synthesis": "Overview seul.",
        "key_quotes": [],
        "key_takeaways": [],
        "chapter_themes": [],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    assert out["synthesis"] == "Overview seul."
    assert out["key_quotes"] == []
    assert out["key_takeaways"] == []
    assert out["chapter_themes"] == []


def test_validate_extras_shape_key_points_capped_per_theme():
    """key_points est cappé à MAX_KEY_POINTS_PER_THEME."""
    from videos.summary_enrichment_service import (
        MAX_KEY_POINTS_PER_THEME,
        _validate_extras_shape,
    )

    raw = {
        "key_quotes": [],
        "key_takeaways": ["T"],
        "chapter_themes": [
            {
                "theme": "Th",
                "key_points": [f"P{i}" for i in range(20)],
            }
        ],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    assert (
        len(out["chapter_themes"][0]["key_points"]) == MAX_KEY_POINTS_PER_THEME
    )


def test_validate_extras_shape_invalid_key_quote_omitted_silently():
    """key_quote sur thème mal formé (dict sans quote) est omis sans casser le thème."""
    from videos.summary_enrichment_service import _validate_extras_shape

    raw = {
        "key_quotes": [],
        "key_takeaways": ["T"],
        "chapter_themes": [
            {
                "theme": "Th",
                "key_points": ["P1"],
                "key_quote": {"context": "Manque le champ quote"},
            },
            {
                "theme": "Th2",
                "key_quote": "string-au-lieu-d-un-dict",
            },
        ],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    # Les deux thèmes existent mais sans key_quote
    assert len(out["chapter_themes"]) == 2
    assert "key_quote" not in out["chapter_themes"][0]
    assert "key_quote" not in out["chapter_themes"][1]
    # key_points préservés
    assert out["chapter_themes"][0]["key_points"] == ["P1"]


def test_validate_extras_shape_empty_key_points_list_omitted():
    """key_points vide → la clé n'est pas ajoutée (omission silencieuse)."""
    from videos.summary_enrichment_service import _validate_extras_shape

    raw = {
        "key_quotes": [],
        "key_takeaways": ["T"],
        "chapter_themes": [
            {"theme": "Th", "key_points": []},
            {"theme": "Th2", "key_points": ["", "  ", None]},  # tous invalides
        ],
    }
    out = _validate_extras_shape(raw)
    assert out is not None
    assert "key_points" not in out["chapter_themes"][0]
    assert "key_points" not in out["chapter_themes"][1]
