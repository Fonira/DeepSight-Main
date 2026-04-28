import pytest
from unittest.mock import AsyncMock, MagicMock
from voice.companion_recos import fetch_history_similarity_reco
from voice.schemas import RecoItem


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


@pytest.mark.asyncio
async def test_trending_returns_first_match_for_theme():
    trending_mock = AsyncMock()
    trending_mock.get_trending.return_value = [
        {"video_id": "tr1", "title": "Top Trend", "channel": "Channel",
         "duration": 300, "thumbnail": "https://t/tr1.jpg"},
        {"video_id": "tr2", "title": "Other", "channel": "C2",
         "duration": 400, "thumbnail": None},
    ]

    from voice.companion_recos import fetch_trending_reco
    reco = await fetch_trending_reco(
        theme="géopolitique",
        trending_service=trending_mock,
        excluded_video_ids=set(),
    )

    assert reco.video_id == "tr1"
    assert reco.source == "trending"
    assert "cartonne" in reco.why.lower() or "tendance" in reco.why.lower()
    trending_mock.get_trending.assert_called_once_with(theme="géopolitique", limit=5)


@pytest.mark.asyncio
async def test_trending_skips_excluded():
    from voice.companion_recos import fetch_trending_reco
    trending_mock = AsyncMock()
    trending_mock.get_trending.return_value = [
        {"video_id": "ex", "title": "X", "channel": "C", "duration": 1, "thumbnail": None},
        {"video_id": "ok", "title": "OK", "channel": "C", "duration": 1, "thumbnail": None},
    ]
    reco = await fetch_trending_reco(
        theme="t", trending_service=trending_mock, excluded_video_ids={"ex"}
    )
    assert reco.video_id == "ok"


@pytest.mark.asyncio
async def test_tournesol_returns_top_score():
    tournesol_mock = AsyncMock()
    tournesol_mock.recommend.return_value = [
        {"video_id": "to1", "title": "Top Tournesol", "channel": "C",
         "duration": 600, "score": 89.4, "thumbnail": "https://t.jpg"},
    ]
    from voice.companion_recos import fetch_tournesol_reco
    reco = await fetch_tournesol_reco(
        theme="philosophie",
        tournesol_service=tournesol_mock,
        excluded_video_ids=set(),
    )
    assert reco.video_id == "to1"
    assert reco.source == "tournesol"
    assert "tournesol" in reco.why.lower() or "top" in reco.why.lower()


@pytest.mark.asyncio
async def test_tournesol_api_error_returns_none():
    from voice.companion_recos import fetch_tournesol_reco
    tournesol_mock = AsyncMock()
    tournesol_mock.recommend.side_effect = Exception("API down")
    reco = await fetch_tournesol_reco(
        theme="t", tournesol_service=tournesol_mock, excluded_video_ids=set()
    )
    assert reco is None


@pytest.mark.asyncio
async def test_youtube_search_returns_first_relevant():
    yt_mock = AsyncMock()
    yt_mock.search.return_value = [
        {"video_id": "yt1", "title": "Hit", "channel": "C", "duration": 200, "thumbnail": "u"},
    ]
    from voice.companion_recos import fetch_youtube_search_reco
    reco = await fetch_youtube_search_reco(
        topic="quantum",
        youtube_service=yt_mock,
        excluded_video_ids=set(),
    )
    assert reco.video_id == "yt1"
    assert reco.source == "youtube"


@pytest.mark.asyncio
async def test_youtube_search_no_results():
    from voice.companion_recos import fetch_youtube_search_reco
    yt_mock = AsyncMock()
    yt_mock.search.return_value = []
    reco = await fetch_youtube_search_reco(
        topic="x", youtube_service=yt_mock, excluded_video_ids=set()
    )
    assert reco is None


@pytest.mark.asyncio
async def test_build_initial_recos_three_sources_parallel():
    """3 recos = 1 history_similarity + 1 trending + 1 tournesol."""
    services = MagicMock()
    services.history = AsyncMock(return_value=RecoItem(
        video_id="h1", title="H", channel="HC", duration_seconds=1,
        source="history_similarity", why="w",
    ))
    services.trending = AsyncMock(return_value=RecoItem(
        video_id="t1", title="T", channel="TC", duration_seconds=1,
        source="trending", why="w",
    ))
    services.tournesol = AsyncMock(return_value=RecoItem(
        video_id="o1", title="O", channel="OC", duration_seconds=1,
        source="tournesol", why="w",
    ))

    from voice.companion_recos import build_initial_recos
    recos = await build_initial_recos(
        primary_theme="ia",
        history_fn=services.history,
        trending_fn=services.trending,
        tournesol_fn=services.tournesol,
    )

    assert len(recos) == 3
    assert {r.source for r in recos} == {"history_similarity", "trending", "tournesol"}


@pytest.mark.asyncio
async def test_build_initial_recos_skips_failed_sources():
    """Si une source retourne None, le résultat ne contient que les autres."""
    from voice.companion_recos import build_initial_recos
    history_fn = AsyncMock(return_value=None)
    trending_fn = AsyncMock(return_value=RecoItem(
        video_id="t1", title="T", channel="TC", duration_seconds=1,
        source="trending", why="w",
    ))
    tournesol_fn = AsyncMock(return_value=None)

    recos = await build_initial_recos(
        primary_theme="x",
        history_fn=history_fn, trending_fn=trending_fn, tournesol_fn=tournesol_fn,
    )
    assert len(recos) == 1
    assert recos[0].source == "trending"
