import pytest
from unittest.mock import AsyncMock, MagicMock
from voice.companion_recos import fetch_history_similarity_reco


@pytest.mark.asyncio
async def test_history_similarity_returns_top_match():
    """Renvoie video similaire à analyses passées, exclut déjà analysées."""
    db_mock = AsyncMock()
    embed_mock = AsyncMock()
    embed_mock.find_similar_videos.return_value = [
        {"video_id": "abc123", "title": "Sim Match", "channel": "Chan",
         "duration": 600, "score": 0.91, "thumbnail": "https://t/abc.jpg"},
    ]
    db_mock.embedding_service = embed_mock
    db_mock.fetch_user_analyzed_video_ids.return_value = {"existing1"}

    reco = await fetch_history_similarity_reco(
        user_id=1,
        db=db_mock,
        recent_summary_titles=["Vidéo X", "Vidéo Y"],
    )

    assert reco is not None
    assert reco.video_id == "abc123"
    assert reco.source == "history_similarity"
    assert "similaire" in reco.why.lower()


@pytest.mark.asyncio
async def test_history_similarity_excludes_already_analyzed():
    db_mock = AsyncMock()
    embed_mock = AsyncMock()
    embed_mock.find_similar_videos.return_value = [
        {"video_id": "existing1", "title": "Already", "channel": "C",
         "duration": 100, "score": 0.95, "thumbnail": None},
        {"video_id": "new1", "title": "New", "channel": "C",
         "duration": 200, "score": 0.85, "thumbnail": None},
    ]
    db_mock.embedding_service = embed_mock
    db_mock.fetch_user_analyzed_video_ids.return_value = {"existing1"}

    reco = await fetch_history_similarity_reco(
        user_id=1,
        db=db_mock,
        recent_summary_titles=["t"],
    )
    assert reco.video_id == "new1"


@pytest.mark.asyncio
async def test_history_similarity_no_match_returns_none():
    db_mock = AsyncMock()
    embed_mock = AsyncMock()
    embed_mock.find_similar_videos.return_value = []
    db_mock.embedding_service = embed_mock
    db_mock.fetch_user_analyzed_video_ids.return_value = set()

    reco = await fetch_history_similarity_reco(user_id=1, db=db_mock, recent_summary_titles=[])
    assert reco is None
