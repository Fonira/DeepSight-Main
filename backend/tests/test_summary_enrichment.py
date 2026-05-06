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
