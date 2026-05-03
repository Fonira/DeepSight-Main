"""Tests for ``services/channel_content_cache.py``.

Stratégie :
  - SQLite in-memory pour PG L2 (cf. pattern de ``test_channel_contexts.py``).
  - Monkeypatch des helpers Redis L1 (``get_/set_channel_context_from_redis``)
    pour ne pas dépendre d'un Redis réel ni du singleton ``cache_service``.
  - Monkeypatch des fetchers (``get_channel_context``, ``get_tiktok_account_context``)
    pour contrôler ce que le cache reçoit en miss.

Couvre :
  1. Redis L1 hit → return direct, jamais de PG ni service touché.
  2. Redis miss + PG hit → populate L1 + return.
  3. Redis miss + PG row expirée → fall through service.
  4. Full miss → service appelé → upsert PG + set L1.
  5. Full miss + service None → ni écriture PG ni Redis.
  6. force_refresh=True → skip L1 et L2 même si HIT.
  7. platform="youtube" routes vers ``get_channel_context``.
  8. platform="tiktok" routes vers ``get_tiktok_account_context``.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


# ───────────────────────────────────────────────────────────────────────────
# Fixtures
# ───────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def test_engine():
    """SQLite in-memory engine (file: shared :memory:) avec tous les models créés."""
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncSession:
    """Session SQLAlchemy ouverte sur l'engine in-memory."""
    SessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session


def _sample_ctx(channel_id: str = "UC_test_001", platform: str = "youtube") -> Dict[str, Any]:
    """Dict au shape unifié — utilisé comme entrée valide du fetcher."""
    return {
        "channel_id": channel_id,
        "platform": platform,
        "name": "Channel " + channel_id,
        "description": "A description",
        "subscriber_count": 1234,
        "video_count": 56,
        "tags": ["tag1", "tag2"],
        "categories": ["Education"],
        "last_videos": [
            {
                "title": "v1",
                "description": "d1",
                "tags": ["a"],
                "view_count": 10,
                "upload_date": "20260501",
            }
        ],
    }


class _RedisStub:
    """Mini Redis fake : in-memory dict, async API alignée sur core.cache."""

    def __init__(self) -> None:
        self.store: Dict[str, Any] = {}
        self.get_calls: List[str] = []
        self.set_calls: List[tuple] = []

    async def get(self, key: str) -> Optional[Any]:
        self.get_calls.append(key)
        return self.store.get(key)

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        self.set_calls.append((key, value, ttl))
        self.store[key] = value

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)


@pytest.fixture
def redis_stub(monkeypatch) -> _RedisStub:
    """Patche les helpers Redis du module pour utiliser un stub in-memory.

    On patche directement les fonctions exposées (``get_channel_context_from_redis``
    / ``set_channel_context_to_redis``) : c'est plus simple et plus robuste que
    de monter un faux ``core.cache.cache_service``.
    """
    from services import channel_content_cache as ccc

    stub = _RedisStub()

    async def fake_get(platform: str, channel_id: str):
        return await stub.get(ccc.build_channel_cache_key(platform, channel_id))

    async def fake_set(platform: str, channel_id: str, ctx: Dict[str, Any]):
        await stub.set(
            ccc.build_channel_cache_key(platform, channel_id),
            ctx,
            ttl=ccc.CHANNEL_CONTEXT_TTL_SECONDS,
        )

    monkeypatch.setattr(ccc, "get_channel_context_from_redis", fake_get)
    monkeypatch.setattr(ccc, "set_channel_context_to_redis", fake_set)
    return stub


@pytest.fixture
def patched_session(monkeypatch, test_engine):
    """Patche ``async_session_maker`` du module pour pointer sur l'engine in-memory.

    Utile pour tester ``get_or_fetch_channel_context()`` sans devoir injecter
    une session manuellement à chaque appel.
    """
    from services import channel_content_cache as ccc

    SessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(ccc, "async_session_maker", SessionLocal)
    return SessionLocal


# ───────────────────────────────────────────────────────────────────────────
# Helpers d'écriture directe en DB pour pré-conditionner les tests
# ───────────────────────────────────────────────────────────────────────────


async def _insert_db_row(
    session: AsyncSession,
    *,
    channel_id: str,
    platform: str,
    expires_at: datetime,
    fetched_at: Optional[datetime] = None,
    name: str = "From DB",
):
    """Insert direct via le model ChannelContext (pour pré-conditionner les tests)."""
    from db.database import ChannelContext

    fetched_at = fetched_at or (expires_at - timedelta(days=1))
    row = ChannelContext(
        channel_id=channel_id,
        platform=platform,
        name=name,
        description="from DB",
        subscriber_count=999,
        video_count=42,
        tags=["from_db"],
        categories=["DB"],
        last_videos=[
            {
                "title": "db-v1",
                "description": "db-d1",
                "tags": ["db"],
                "view_count": 1,
                "upload_date": "20260101",
            }
        ],
        fetched_at=fetched_at,
        expires_at=expires_at,
    )
    session.add(row)
    await session.commit()


# ───────────────────────────────────────────────────────────────────────────
# Tests
# ───────────────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.asyncio
async def test_redis_hit_returns_directly(monkeypatch, redis_stub, patched_session):
    """Redis L1 HIT : retourne directement, sans toucher PG ni service."""
    from services import channel_content_cache as ccc

    expected = _sample_ctx("UC_redis_hit_001", "youtube")
    redis_stub.store[ccc.build_channel_cache_key("youtube", "UC_redis_hit_001")] = expected

    # Sentinelle : si PG ou service est appelé, on rate le test
    pg_called = False
    service_called = False

    async def fake_pg_get(platform, channel_id, *, session=None):
        nonlocal pg_called
        pg_called = True
        return None

    async def fake_fetch(platform, channel_id, *, limit):
        nonlocal service_called
        service_called = True
        return None

    monkeypatch.setattr(ccc, "get_channel_context_from_db", fake_pg_get)
    monkeypatch.setattr(ccc, "_fetch_from_service", fake_fetch)

    result = await ccc.get_or_fetch_channel_context("youtube", "UC_redis_hit_001")

    assert result == expected, "Le résultat doit être l'objet stocké en Redis L1"
    assert pg_called is False, "PG ne doit PAS être touché en cas de L1 HIT"
    assert service_called is False, "Service ne doit PAS être appelé en cas de L1 HIT"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_redis_miss_pg_hit_populates_redis(
    monkeypatch, redis_stub, patched_session, test_session: AsyncSession
):
    """Redis MISS + PG HIT (non expiré) → return + Redis L1 populated."""
    from services import channel_content_cache as ccc

    channel_id = "UC_pg_hit_001"
    platform = "youtube"
    future = datetime.utcnow() + timedelta(days=3)
    await _insert_db_row(
        test_session,
        channel_id=channel_id,
        platform=platform,
        expires_at=future,
        name="Channel From DB",
    )

    # Sentinelle : service ne doit pas être appelé en cas de L2 HIT
    service_called = False

    async def fake_fetch(p, c, *, limit):
        nonlocal service_called
        service_called = True
        return None

    monkeypatch.setattr(ccc, "_fetch_from_service", fake_fetch)

    result = await ccc.get_or_fetch_channel_context(platform, channel_id)

    assert result is not None
    assert result["channel_id"] == channel_id
    assert result["name"] == "Channel From DB"
    assert service_called is False
    # Redis L1 doit être populé
    key = ccc.build_channel_cache_key(platform, channel_id)
    assert key in redis_stub.store
    assert redis_stub.store[key]["channel_id"] == channel_id


@pytest.mark.unit
@pytest.mark.asyncio
async def test_redis_miss_pg_expired_falls_through(
    monkeypatch, redis_stub, patched_session, test_session: AsyncSession
):
    """PG row avec expires_at < now → considéré comme miss → service appelé."""
    from services import channel_content_cache as ccc

    channel_id = "UC_pg_expired_001"
    platform = "youtube"
    past = datetime.utcnow() - timedelta(days=1)
    await _insert_db_row(
        test_session,
        channel_id=channel_id,
        platform=platform,
        expires_at=past,  # expirée
        fetched_at=past - timedelta(days=8),
        name="Old Cached",
    )

    fresh = _sample_ctx(channel_id, platform)
    fresh["name"] = "Fresh from service"
    fetch_calls: List[tuple] = []

    async def fake_fetch(p, c, *, limit):
        fetch_calls.append((p, c, limit))
        return fresh

    monkeypatch.setattr(ccc, "_fetch_from_service", fake_fetch)

    result = await ccc.get_or_fetch_channel_context(platform, channel_id)

    assert result is not None
    assert result["name"] == "Fresh from service", "Doit venir du service, pas de la DB expirée"
    assert len(fetch_calls) == 1, "Le service doit avoir été appelé exactement une fois"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_full_miss_calls_service_and_populates_both_layers(
    monkeypatch, redis_stub, patched_session, test_session: AsyncSession
):
    """Full miss : service appelé → PG row créée + Redis L1 set."""
    from services import channel_content_cache as ccc
    from db.database import ChannelContext

    channel_id = "UC_full_miss_001"
    platform = "youtube"
    fresh = _sample_ctx(channel_id, platform)

    fetch_calls: List[tuple] = []

    async def fake_fetch(p, c, *, limit):
        fetch_calls.append((p, c, limit))
        return fresh

    monkeypatch.setattr(ccc, "_fetch_from_service", fake_fetch)

    result = await ccc.get_or_fetch_channel_context(platform, channel_id)

    assert result == fresh
    assert fetch_calls == [(platform, channel_id, 50)]

    # Vérifier qu'une row a bien été créée en PG
    db_row = (
        await test_session.execute(
            select(ChannelContext).where(
                ChannelContext.channel_id == channel_id,
                ChannelContext.platform == platform,
            )
        )
    ).scalar_one()
    assert db_row.name == fresh["name"]
    assert db_row.subscriber_count == fresh["subscriber_count"]
    assert db_row.last_videos == fresh["last_videos"]
    # expires_at doit être strictement futur
    expires = db_row.expires_at
    if expires.tzinfo is not None:
        expires = expires.astimezone(timezone.utc).replace(tzinfo=None)
    assert expires > datetime.utcnow()

    # Vérifier Redis L1
    key = ccc.build_channel_cache_key(platform, channel_id)
    assert key in redis_stub.store
    assert redis_stub.store[key] == fresh


@pytest.mark.unit
@pytest.mark.asyncio
async def test_full_miss_service_returns_none_no_cache_write(
    monkeypatch, redis_stub, patched_session, test_session: AsyncSession
):
    """Service retourne None → ni PG ni Redis ne doit être écrit."""
    from services import channel_content_cache as ccc
    from db.database import ChannelContext

    channel_id = "UC_service_fail_001"
    platform = "youtube"

    async def fake_fetch(p, c, *, limit):
        return None  # échec

    monkeypatch.setattr(ccc, "_fetch_from_service", fake_fetch)

    result = await ccc.get_or_fetch_channel_context(platform, channel_id)

    assert result is None

    # PG : pas de row
    db_row = (
        await test_session.execute(
            select(ChannelContext).where(
                ChannelContext.channel_id == channel_id,
                ChannelContext.platform == platform,
            )
        )
    ).scalar_one_or_none()
    assert db_row is None, "Aucune row PG ne doit être créée si le service échoue"

    # Redis : pas de set
    key = ccc.build_channel_cache_key(platform, channel_id)
    assert key not in redis_stub.store, "Aucune écriture Redis ne doit avoir lieu"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_force_refresh_skips_redis_and_pg(
    monkeypatch, redis_stub, patched_session, test_session: AsyncSession
):
    """force_refresh=True : ignore L1 et L2 même quand les deux sont HIT."""
    from services import channel_content_cache as ccc

    channel_id = "UC_force_001"
    platform = "youtube"

    # Pré-condition : Redis L1 HIT
    stale = _sample_ctx(channel_id, platform)
    stale["name"] = "stale from redis"
    redis_stub.store[ccc.build_channel_cache_key(platform, channel_id)] = stale

    # Pré-condition : PG L2 HIT (non expiré)
    future = datetime.utcnow() + timedelta(days=3)
    await _insert_db_row(
        test_session,
        channel_id=channel_id,
        platform=platform,
        expires_at=future,
        name="stale from pg",
    )

    # Sentinelles : on doit appeler le service même si caches HIT
    fresh = _sample_ctx(channel_id, platform)
    fresh["name"] = "fresh refreshed"
    fetch_calls: List[tuple] = []

    async def fake_fetch(p, c, *, limit):
        fetch_calls.append((p, c, limit))
        return fresh

    monkeypatch.setattr(ccc, "_fetch_from_service", fake_fetch)

    result = await ccc.get_or_fetch_channel_context(
        platform, channel_id, force_refresh=True
    )

    assert result == fresh, "force_refresh doit retourner le fresh, PAS le stale L1/L2"
    assert len(fetch_calls) == 1, "Le service doit être appelé même si caches HIT"

    # Le L1 doit avoir été remis à jour avec le fresh
    key = ccc.build_channel_cache_key(platform, channel_id)
    assert redis_stub.store[key]["name"] == "fresh refreshed"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_youtube_routes_to_youtube_channel_service(
    monkeypatch, redis_stub, patched_session
):
    """platform="youtube" → ``transcripts.youtube_channel.get_channel_context`` appelé."""
    from services import channel_content_cache as ccc

    channel_id = "UC_route_yt_001"
    fresh = _sample_ctx(channel_id, "youtube")

    yt_calls: List[tuple] = []
    tt_calls: List[tuple] = []

    async def fake_yt(channel_id_arg, limit=50):
        yt_calls.append((channel_id_arg, limit))
        return fresh

    async def fake_tt(username_arg, limit=50):
        tt_calls.append((username_arg, limit))
        return None

    # Patch via les modules cibles (ce que ``_fetch_from_service`` importe lazy)
    import transcripts.youtube_channel as yt_mod
    import transcripts.tiktok as tt_mod

    monkeypatch.setattr(yt_mod, "get_channel_context", fake_yt)
    monkeypatch.setattr(tt_mod, "get_tiktok_account_context", fake_tt)

    result = await ccc.get_or_fetch_channel_context("youtube", channel_id)

    assert result == fresh
    assert yt_calls == [(channel_id, 50)], "YouTube service doit avoir été appelé"
    assert tt_calls == [], "TikTok service ne doit PAS avoir été appelé"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_tiktok_routes_to_tiktok_account_service(
    monkeypatch, redis_stub, patched_session
):
    """platform="tiktok" → ``transcripts.tiktok.get_tiktok_account_context`` appelé."""
    from services import channel_content_cache as ccc

    username = "charlidamelio"
    fresh = _sample_ctx(username, "tiktok")

    yt_calls: List[tuple] = []
    tt_calls: List[tuple] = []

    async def fake_yt(channel_id_arg, limit=50):
        yt_calls.append((channel_id_arg, limit))
        return None

    async def fake_tt(username_arg, limit=50):
        tt_calls.append((username_arg, limit))
        return fresh

    import transcripts.youtube_channel as yt_mod
    import transcripts.tiktok as tt_mod

    monkeypatch.setattr(yt_mod, "get_channel_context", fake_yt)
    monkeypatch.setattr(tt_mod, "get_tiktok_account_context", fake_tt)

    result = await ccc.get_or_fetch_channel_context("tiktok", username)

    assert result == fresh
    assert tt_calls == [(username, 50)], "TikTok service doit avoir été appelé"
    assert yt_calls == [], "YouTube service ne doit PAS avoir été appelé"
