"""Relance de l'analyse de playlists (web) — suivi Redis, accès, parcours complet.

Couvre :
  1. PlaylistTaskStore : écriture par un worker, lecture par un autre (Redis).
  2. Endpoints : création d'analyse (plan, admin, crédits), poll de statut
     authentifié et réservé au propriétaire, page détail, chat corpus.

Aucun appel réseau réel : récupération de la playlist, pipeline et Mistral
sont mockés. La partie Supadata est testée dans
tests/transcripts/test_youtube_playlist_supadata.py.
"""

import importlib
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import fakeredis.aioredis
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# `playlists.router` désigne l'APIRouter (ré-export du package) : on passe par le module.
router_mod = importlib.import_module("playlists.router")

from playlists.task_store import PlaylistTaskStore

PLAYLIST_ID = "PLlaN88a7y2_plecYoJxvRFTLHVbIVAOoc"


# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def fake_redis():
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield client
    await client.flushall()
    await client.aclose()


@pytest_asyncio.fixture
async def db_sessionmaker():
    from db.database import Base

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    await engine.dispose()


def _user(uid: int, plan: str = "expert", *, is_admin: bool = False, credits: int = 500) -> SimpleNamespace:
    return SimpleNamespace(
        id=uid,
        email=f"user{uid}@example.com",
        plan=plan,
        is_admin=is_admin,
        credits=credits,
        default_lang="fr",
    )


@pytest.fixture
def current():
    """Utilisateur courant, modifiable en cours de test."""
    return {"user": _user(1)}


@pytest_asyncio.fixture
async def api(db_sessionmaker, current):
    from auth.dependencies import get_current_user
    from db.database import get_session

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api/playlists")

    async def _session():
        async with db_sessionmaker() as session:
            yield session

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[get_current_user] = lambda: current["user"]
    router_mod._chat_cache.clear()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.fixture
def worker_a(fake_redis):
    """Store du worker qui reçoit la création de tâche (et exécute la tâche de fond)."""
    store = PlaylistTaskStore()
    store._redis = fake_redis
    with patch.object(router_mod, "_playlist_task_store", store):
        yield store


# ═══════════════════════════════════════════════════════════════════════════════
# 1. PlaylistTaskStore — partage entre workers via Redis
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
async def test_task_store_is_shared_across_workers(fake_redis):
    worker_1 = PlaylistTaskStore()
    worker_2 = PlaylistTaskStore()
    worker_1._redis = fake_redis
    worker_2._redis = fake_redis

    worker_1["t1"] = {"user_id": 7, "status": "pending", "progress": 0}
    worker_1["t1"]["progress"] = 40
    await worker_1.force_flush()

    raw = await fake_redis.get("deepsight:playlist_task:t1")
    assert json.loads(raw)["progress"] == 40
    assert (await worker_2.aget("t1"))["progress"] == 40

    # Le second worker relit Redis à chaque poll : il voit la suite de la tâche.
    worker_1["t1"].update({"status": "completed", "progress": 100})
    await worker_1.force_flush()
    task = await worker_2.aget("t1")
    assert task["status"] == "completed" and task["progress"] == 100


@pytest.mark.unit
def test_task_store_reuses_core_redis_connection():
    from core.task_store import task_store as core_task_store

    sentinel = object()
    store = PlaylistTaskStore()
    with patch.object(core_task_store, "_redis", sentinel):
        assert store._redis is sentinel
    own = object()
    store._redis = own
    assert store._redis is own


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


def _pipeline_result(num_videos: int) -> SimpleNamespace:
    return SimpleNamespace(
        corpus_id=PLAYLIST_ID,
        num_processed=num_videos,
        total_duration=600,
        total_words=1200,
        num_skipped=0,
        processing_time_seconds=12.5,
    )


@pytest.mark.unit
async def test_analyze_then_poll_from_another_worker(api, current, fake_redis, worker_a):
    from playlists.pipeline import PipelineProgress

    async def fake_pipeline(**kwargs):
        await kwargs["on_progress"](
            PipelineProgress(
                total_videos=2,
                completed_videos=1,
                current_step="summary",
                current_video_title="Vidéo 1",
                percent=50,
                message="1/2",
            )
        )
        return _pipeline_result(2)

    videos = [{"video_id": "aaaaaaaaaaa"}, {"video_id": "bbbbbbbbbbb"}]
    with (
        patch.object(router_mod, "get_playlist_info", AsyncMock(return_value={"title": "Cours de philo"})),
        patch.object(router_mod, "get_playlist_videos", AsyncMock(return_value=videos)) as get_videos,
        patch("playlists.pipeline.run_playlist_pipeline", AsyncMock(side_effect=fake_pipeline)) as pipeline,
    ):
        resp = await api.post(
            "/api/playlists/analyze",
            json={"url": f"https://www.youtube.com/playlist?list={PLAYLIST_ID}", "max_videos": 50},
        )

    assert resp.status_code == 200, resp.text
    task_id = resp.json()["task_id"]
    # Expert : 20 vidéos max (plan_config), même si 50 sont demandées.
    get_videos.assert_awaited_once_with(PLAYLIST_ID, 20)
    assert pipeline.await_args.kwargs["urls"] == [
        "https://www.youtube.com/watch?v=aaaaaaaaaaa",
        "https://www.youtube.com/watch?v=bbbbbbbbbbb",
    ]
    await worker_a.force_flush()

    # Le poll arrive sur un autre worker : il lit la tâche dans Redis.
    worker_b = PlaylistTaskStore()
    worker_b._redis = fake_redis
    with patch.object(router_mod, "_playlist_task_store", worker_b):
        status = await api.get(f"/api/playlists/task/{task_id}")
        current["user"] = _user(2)
        other = await api.get(f"/api/playlists/task/{task_id}")

    assert status.status_code == 200, status.text
    body = status.json()
    assert body["status"] == "completed"
    assert body["progress"] == 100
    assert body["playlist_title"] == "Cours de philo"
    assert body["result"]["playlist_id"] == PLAYLIST_ID
    assert body["result"]["num_videos"] == 2
    # Une tâche d'un autre utilisateur est introuvable (pas de fuite d'existence).
    assert other.status_code == 404


@pytest.mark.unit
async def test_failed_analysis_exposes_error(api, worker_a):
    with (
        patch.object(router_mod, "get_playlist_info", AsyncMock(return_value={"title": "Vide"})),
        patch.object(router_mod, "get_playlist_videos", AsyncMock(return_value=[])),
    ):
        resp = await api.post(
            "/api/playlists/analyze", json={"url": f"https://youtube.com/playlist?list={PLAYLIST_ID}"}
        )
    assert resp.status_code == 200
    status = await api.get(f"/api/playlists/task/{resp.json()['task_id']}")
    body = status.json()
    assert body["status"] == "failed"
    assert body["error"] == "Aucune vidéo trouvée dans la playlist"


@pytest.mark.unit
async def test_poll_requires_authentication(db_sessionmaker, worker_a):
    from db.database import get_session

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api/playlists")

    async def _session():
        async with db_sessionmaker() as session:
            yield session

    app.dependency_overrides[get_session] = _session
    worker_a["t-anon"] = {"user_id": 1, "status": "processing"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/playlists/task/t-anon")
    assert resp.status_code == 401


@pytest.mark.unit
async def test_poll_unknown_task_returns_404(api, worker_a):
    resp = await api.get("/api/playlists/task/does-not-exist")
    assert resp.status_code == 404


@pytest.mark.unit
@pytest.mark.parametrize("plan", ["free", "pro"])
async def test_analyze_blocked_without_playlist_feature(api, current, worker_a, plan):
    current["user"] = _user(3, plan=plan)
    with patch.object(router_mod, "_analyze_playlist_background", AsyncMock()) as background:
        resp = await api.post(
            "/api/playlists/analyze", json={"url": f"https://youtube.com/playlist?list={PLAYLIST_ID}"}
        )
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "feature_blocked"
    background.assert_not_awaited()


@pytest.mark.unit
async def test_admin_is_treated_as_expert(api, current, worker_a):
    # Plan stocké « unlimited » ou même « free » : l'admin a les limites Expert,
    # sans contrôle de crédits.
    current["user"] = _user(9, plan="free", is_admin=True, credits=0)
    with patch.object(router_mod, "_analyze_playlist_background", AsyncMock()) as background:
        resp = await api.post(
            "/api/playlists/analyze",
            json={"url": f"https://youtube.com/playlist?list={PLAYLIST_ID}", "max_videos": 100},
        )
    assert resp.status_code == 200, resp.text
    kwargs = background.await_args.kwargs
    assert kwargs["max_videos"] == 20
    assert kwargs["model"] == router_mod.PLAN_MODELS["expert"]
    assert worker_a.get(resp.json()["task_id"])["user_id"] == 9


@pytest.mark.unit
@pytest.mark.parametrize("field", ["max_videos", "maxVideos"])
async def test_analyze_honours_requested_video_count(api, worker_a, field):
    # Le client web envoie `maxVideos` ; l'API publique documente `max_videos`.
    with patch.object(router_mod, "_analyze_playlist_background", AsyncMock()) as background:
        resp = await api.post(
            "/api/playlists/analyze",
            json={"url": f"https://youtube.com/playlist?list={PLAYLIST_ID}", field: 5},
        )
    assert resp.status_code == 200, resp.text
    assert background.await_args.kwargs["max_videos"] == 5


@pytest.mark.unit
async def test_analyze_rejects_insufficient_credits(api, current, worker_a):
    current["user"] = _user(4, plan="expert", credits=3)
    resp = await api.post(
        "/api/playlists/analyze", json={"url": f"https://youtube.com/playlist?list={PLAYLIST_ID}", "max_videos": 10}
    )
    assert resp.status_code == 403
    assert "Crédits insuffisants" in resp.json()["detail"]


@pytest.mark.unit
async def test_corpus_analysis_gated_and_tracked(api, current, worker_a):
    urls = [f"https://www.youtube.com/watch?v={c * 11}" for c in "abc"]
    with patch.object(router_mod, "_analyze_corpus_background", AsyncMock()) as background:
        resp = await api.post("/api/playlists/analyze-corpus", json={"urls": urls, "name": "Mon corpus"})
        current["user"] = _user(5, plan="pro")
        blocked = await api.post("/api/playlists/corpus/analyze", json={"urls": urls})

    assert resp.status_code == 200, resp.text
    task = worker_a.get(resp.json()["task_id"])
    assert task["user_id"] == 1 and task["playlist_title"] == "Mon corpus"
    assert background.await_count == 1
    assert blocked.status_code == 403


async def _seed_playlist(sessionmaker, user_id: int, title: str = "Cours de philo") -> None:
    from db.database import PlaylistAnalysis, Summary, User

    async with sessionmaker() as session:
        if await session.get(User, user_id) is None:
            session.add(User(id=user_id, username=f"u{user_id}", email=f"u{user_id}@example.com", password_hash="x"))
        session.add(
            PlaylistAnalysis(
                user_id=user_id,
                playlist_id=PLAYLIST_ID,
                playlist_title=title,
                num_videos=2,
                num_processed=2,
                total_duration=600,
                total_words=1200,
                meta_analysis="## Synthèse",
                status="completed",
            )
        )
        for position, video_id in enumerate(["aaaaaaaaaaa", "bbbbbbbbbbb"], start=1):
            session.add(
                Summary(
                    user_id=user_id,
                    video_id=video_id,
                    video_title=f"Vidéo {position}",
                    video_channel="Chaîne",
                    video_duration=300,
                    summary_content=f"Résumé {position} sur la morale",
                    playlist_id=PLAYLIST_ID,
                    playlist_position=position,
                )
            )
        await session.commit()


@pytest.mark.unit
async def test_list_and_detail_are_scoped_to_owner(api, current, db_sessionmaker):
    await _seed_playlist(db_sessionmaker, user_id=1)

    listing = await api.get("/api/playlists")
    detail = await api.get(f"/api/playlists/{PLAYLIST_ID}")
    current["user"] = _user(2)
    other_listing = await api.get("/api/playlists")
    other_detail = await api.get(f"/api/playlists/{PLAYLIST_ID}")

    assert listing.status_code == 200
    assert [p["playlist_title"] for p in listing.json()] == ["Cours de philo"]
    assert detail.status_code == 200
    body = detail.json()
    assert body["meta_analysis"] == "## Synthèse"
    assert [v["video_title"] for v in body["videos"]] == ["Vidéo 1", "Vidéo 2"]
    assert other_listing.json() == []
    assert other_detail.status_code == 404


@pytest.mark.unit
async def test_corpus_chat_answers_and_never_shares_cache(api, current, db_sessionmaker):
    from sqlalchemy import select

    from db.database import PlaylistChatMessage

    await _seed_playlist(db_sessionmaker, user_id=1)
    await _seed_playlist(db_sessionmaker, user_id=2, title="Même playlist, autre compte")
    mistral = AsyncMock(side_effect=["Réponse pour l'utilisateur 1", "Réponse pour l'utilisateur 2"])
    question = {"message": "Que disent les vidéos sur la morale ?", "mode": "standard", "lang": "fr"}

    with patch.object(router_mod, "_chat_with_mistral_corpus_v4", mistral):
        first = await api.post(f"/api/playlists/{PLAYLIST_ID}/chat", json=question)
        current["user"] = _user(2)
        second = await api.post(f"/api/playlists/{PLAYLIST_ID}/chat", json=question)
        current["user"] = _user(3)
        stranger = await api.post(f"/api/playlists/{PLAYLIST_ID}/chat", json=question)

    assert first.status_code == 200, first.text
    assert first.json()["response"].startswith("Réponse pour l'utilisateur 1")
    # Même ID de playlist YouTube, même question : l'autre compte n'hérite pas du cache.
    assert second.json()["response"].startswith("Réponse pour l'utilisateur 2")
    assert mistral.await_count == 2
    assert stranger.status_code == 404

    async with db_sessionmaker() as session:
        rows = (await session.execute(select(PlaylistChatMessage).where(PlaylistChatMessage.user_id == 1))).scalars()
        assert [m.role for m in rows] == ["user", "assistant"]
