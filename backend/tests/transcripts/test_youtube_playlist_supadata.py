"""Liste des vidéos et métadonnées d'une playlist via Supadata.

L'IP du serveur est bloquée par YouTube : Supadata passe en premier, avec le
format documenté (docs.supadata.ai), un cache Redis par ID de playlist (chaque
appel coûte 1 crédit) et l'ancien chemin Invidious / yt-dlp en repli.

Aucun appel réseau réel : le client httpx partagé est remplacé par un faux.
"""

import importlib
import json
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import fakeredis.aioredis
import httpx
import pytest
import pytest_asyncio

youtube = importlib.import_module("transcripts.youtube")

PLAYLIST_ID = "PLlaN88a7y2_plecYoJxvRFTLHVbIVAOoc"


@pytest_asyncio.fixture
async def fake_redis():
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield client
    await client.flushall()
    await client.aclose()


@pytest_asyncio.fixture
async def redis_cache(fake_redis):
    """Branche cache_service sur un Redis factice (comme en prod)."""
    from core.cache import RedisCacheBackend, cache_service

    saved = cache_service.backend
    cache_service.backend = RedisCacheBackend(fake_redis)
    try:
        yield fake_redis
    finally:
        cache_service.backend = saved


def _response(status: int, payload: object, url: str = "https://api.supadata.ai") -> httpx.Response:
    return httpx.Response(status, json=payload, request=httpx.Request("GET", url))


def _fake_http(handler):
    """Remplace shared_http_client par un client dont .get délègue à `handler(url, **kw)`."""
    client = MagicMock()
    client.get = AsyncMock(side_effect=handler)

    @asynccontextmanager
    async def _ctx(**_kwargs):
        yield client

    return _ctx, client


@pytest.mark.unit
async def test_supadata_playlist_videos_parsed_and_cached(redis_cache):
    calls = []

    def handler(url, **kwargs):
        calls.append((url, kwargs))
        return _response(
            200,
            {
                "videoIds": ["aaaaaaaaaaa", "bbbbbbbbbbb", "not-an-id"],
                "shortIds": ["ccccccccccc", "aaaaaaaaaaa"],
                "liveIds": ["ddddddddddd"],
            },
        )

    ctx, _ = _fake_http(handler)
    with (
        patch.object(youtube, "shared_http_client", ctx),
        patch.object(youtube, "get_supadata_key", return_value="test-key"),
    ):
        videos = await youtube.get_playlist_videos(PLAYLIST_ID, max_videos=3)
        again = await youtube.get_playlist_videos(PLAYLIST_ID, max_videos=10)

    assert [v["video_id"] for v in videos] == ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]
    # Le second appel sort du cache : une seule requête (= 1 crédit Supadata).
    assert len(calls) == 1
    assert [v["video_id"] for v in again] == ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"]

    url, kwargs = calls[0]
    assert url == "https://api.supadata.ai/v1/youtube/playlist/videos"
    assert kwargs["params"] == {"id": PLAYLIST_ID, "limit": youtube.SUPADATA_PLAYLIST_FETCH_LIMIT}
    assert kwargs["headers"] == {"x-api-key": "test-key"}

    raw = await redis_cache.get(f"deepsight:playlist_videos:supadata:{PLAYLIST_ID}")
    assert raw is not None and len(json.loads(raw)) == 4
    assert await redis_cache.ttl(f"deepsight:playlist_videos:supadata:{PLAYLIST_ID}") > 0


@pytest.mark.unit
async def test_supadata_playlist_info_mapped_and_cached(redis_cache):
    calls = []

    def handler(url, **kwargs):
        calls.append(url)
        return _response(
            200,
            {
                "id": PLAYLIST_ID,
                "title": "Cours de philo",
                "description": "Introduction",
                "videoCount": 25,
                "viewCount": 1000,
                "lastUpdated": "2026-01-01T00:00:00.000Z",
                "channel": {"id": "UC123", "name": "Chaîne Philo"},
            },
        )

    ctx, _ = _fake_http(handler)
    with (
        patch.object(youtube, "shared_http_client", ctx),
        patch.object(youtube, "get_supadata_key", return_value="test-key"),
    ):
        info = await youtube.get_playlist_info(PLAYLIST_ID)
        await youtube.get_playlist_info(PLAYLIST_ID)

    assert info == {
        "playlist_id": PLAYLIST_ID,
        "title": "Cours de philo",
        "channel": "Chaîne Philo",
        "video_count": 25,
        "description": "Introduction",
    }
    assert calls == ["https://api.supadata.ai/v1/youtube/playlist"]


@pytest.mark.unit
async def test_supadata_failure_falls_back_to_invidious(redis_cache):
    def handler(url, **kwargs):
        if "supadata" in url:
            return _response(404, {"error": "not-found", "message": "Playlist not found"}, url)
        return _response(
            200,
            {"videos": [{"videoId": "eeeeeeeeeee", "title": "Vidéo", "lengthSeconds": 60, "author": "Auteur"}]},
            url,
        )

    ctx, client = _fake_http(handler)
    with (
        patch.object(youtube, "shared_http_client", ctx),
        patch.object(youtube, "get_supadata_key", return_value="test-key"),
    ):
        videos = await youtube.get_playlist_videos("PLfallback0000000", max_videos=5)

    assert videos == [{"video_id": "eeeeeeeeeee", "title": "Vidéo", "duration": 60, "channel": "Auteur"}]
    assert "supadata" in client.get.call_args_list[0].args[0]
    # Un échec n'est pas mis en cache : le prochain essai repassera par Supadata.
    assert await redis_cache.get("deepsight:playlist_videos:supadata:PLfallback0000000") is None


@pytest.mark.unit
async def test_supadata_skipped_without_api_key(redis_cache):
    ctx, client = _fake_http(lambda url, **kw: _response(500, {}, url))
    with (
        patch.object(youtube, "shared_http_client", ctx),
        patch.object(youtube, "get_supadata_key", return_value=""),
    ):
        assert await youtube.get_playlist_videos_supadata("PLnokey0000000000") is None
        assert await youtube.get_playlist_info_supadata("PLnokey0000000000") is None
    client.get.assert_not_called()
