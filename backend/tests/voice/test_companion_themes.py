import pytest
from unittest.mock import AsyncMock, MagicMock
from voice.companion_themes import extract_top3_themes


@pytest.mark.asyncio
async def test_themes_fallback_category_majority():
    """Si > 70% des Summary ont category populé → fallback no-LLM."""
    summaries = [
        MagicMock(title=f"v{i}", category="philosophie") for i in range(8)
    ] + [
        MagicMock(title=f"v{i+8}", category="géopolitique") for i in range(7)
    ] + [
        MagicMock(title=f"v{i+15}", category="ia") for i in range(5)
    ] + [
        MagicMock(title="x", category=None) for _ in range(2)  # 22 with cat / 24 = 91%
    ]
    db_mock = AsyncMock()
    db_mock.fetch_recent_summaries.return_value = summaries

    themes = await extract_top3_themes(user_id=1, db=db_mock, llm_client=None)

    assert themes == ["philosophie", "géopolitique", "ia"]
    db_mock.fetch_recent_summaries.assert_called_once_with(user_id=1, limit=30)


@pytest.mark.asyncio
async def test_themes_empty_returns_default():
    db_mock = AsyncMock()
    db_mock.fetch_recent_summaries.return_value = []
    themes = await extract_top3_themes(user_id=1, db=db_mock, llm_client=None)
    assert themes == []


@pytest.mark.asyncio
async def test_themes_llm_path_low_category_coverage():
    """Si < 70% des Summary ont category → appel Mistral small."""
    summaries = [MagicMock(title=f"Vidéo sur IA {i}", category=None) for i in range(20)]
    summaries += [MagicMock(title="Politique", category="politique") for _ in range(5)]

    db_mock = AsyncMock()
    db_mock.fetch_recent_summaries.return_value = summaries

    llm_mock = AsyncMock()
    llm_mock.complete_json.return_value = {"themes": ["intelligence artificielle", "tech", "politique"]}

    themes = await extract_top3_themes(user_id=1, db=db_mock, llm_client=llm_mock)

    assert themes == ["intelligence artificielle", "tech", "politique"]
    llm_mock.complete_json.assert_called_once()
    # Le prompt doit contenir les titres
    prompt_call = llm_mock.complete_json.call_args
    assert "Vidéo sur IA 0" in str(prompt_call)


@pytest.mark.asyncio
async def test_themes_llm_returns_invalid_json_fallback_empty():
    summaries = [MagicMock(title="t", category=None) for _ in range(10)]
    db_mock = AsyncMock()
    db_mock.fetch_recent_summaries.return_value = summaries
    llm_mock = AsyncMock()
    llm_mock.complete_json.side_effect = ValueError("invalid json")

    themes = await extract_top3_themes(user_id=1, db=db_mock, llm_client=llm_mock)
    assert themes == []
