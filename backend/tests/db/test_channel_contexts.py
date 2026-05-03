"""Tests for the ChannelContext model (migration 014).

Vérifie le contrat du model :
  1. Insert + retrieve d'une ligne ChannelContext (CRUD basique).
  2. Upsert via SQLite ``INSERT ... ON CONFLICT (channel_id, platform)
     DO UPDATE`` : la PK composite est respectée et ``fetched_at`` est
     bien mis à jour lors d'un refresh.
  3. ``expires_at`` est strictement postérieur à ``fetched_at`` lors de
     l'insert (invariant TTL).

Stratégie : SQLite in-memory + ``Base.metadata.create_all`` pour
matérialiser le schéma sans dépendre d'Alembic (cf. pattern de
``test_user_preferences_column.py`` / ``test_voice_e2e_unified_timeline.py``).

Notes :
  - Le pattern upsert testé utilise ``sqlite_insert.on_conflict_do_update``
    (équivalent fonctionnel de ``INSERT ... ON CONFLICT`` PostgreSQL,
    cf. core upsert pattern utilisé en prod).
  - SQLite stocke ``DateTime(timezone=True)`` sans tz info native, donc
    on compare avec des datetimes naïfs (UTC) pour rester portable.
"""

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def test_session():
    """SQLite in-memory + tous les models créés via Base.metadata.create_all."""
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        yield session

    await engine.dispose()


def _sample_last_videos() -> list[dict]:
    """Échantillon réaliste — 2 vidéos avec la shape attendue par la feature."""
    return [
        {
            "title": "Comment l'IA change la science",
            "description": "Une vidéo de fond sur l'impact de l'IA en recherche.",
            "tags": ["ia", "science", "recherche"],
            "view_count": 12500,
            "upload_date": "20260415",
        },
        {
            "title": "Explorer Mars en 2030",
            "description": "Mission de la NASA prévue pour 2030.",
            "tags": ["espace", "mars", "nasa"],
            "view_count": 84200,
            "upload_date": "20260420",
        },
    ]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_channel_context(test_session: AsyncSession):
    """Insert basique + retrieve via PK composite."""
    from db.database import ChannelContext

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    expires = now + timedelta(days=7)

    ctx = ChannelContext(
        channel_id="UC_test_create_001",
        platform="youtube",
        name="Test Channel",
        description="A description",
        subscriber_count=1_500_000,
        video_count=420,
        tags=["science", "tech"],
        categories=["Education"],
        last_videos=_sample_last_videos(),
        fetched_at=now,
        expires_at=expires,
    )
    test_session.add(ctx)
    await test_session.commit()

    result = await test_session.execute(
        select(ChannelContext).where(
            ChannelContext.channel_id == "UC_test_create_001",
            ChannelContext.platform == "youtube",
        )
    )
    row = result.scalar_one()

    assert row.channel_id == "UC_test_create_001"
    assert row.platform == "youtube"
    assert row.name == "Test Channel"
    assert row.subscriber_count == 1_500_000
    assert row.video_count == 420
    assert row.tags == ["science", "tech"]
    assert row.categories == ["Education"]
    assert isinstance(row.last_videos, list)
    assert len(row.last_videos) == 2
    assert row.last_videos[0]["title"] == "Comment l'IA change la science"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_upsert_channel_context(test_session: AsyncSession):
    """Upsert pattern (ON CONFLICT) : refresh d'un contexte existant.

    Vérifie que :
      - l'insert initial passe ;
      - un second insert sur la même PK composite déclenche le DO UPDATE ;
      - les colonnes sont bien rafraîchies, dont ``fetched_at`` qui doit
        avancer dans le temps.
    """
    from db.database import ChannelContext

    t0 = datetime(2026, 5, 1, 10, 0, 0)
    t1 = datetime(2026, 5, 2, 10, 0, 0)  # +1 jour

    # ── Insert initial ────────────────────────────────────────────────
    stmt_insert = sqlite_insert(ChannelContext.__table__).values(
        channel_id="UC_upsert_001",
        platform="youtube",
        name="Initial Name",
        description="Initial description",
        subscriber_count=1000,
        video_count=10,
        tags=["initial"],
        categories=["Initial"],
        last_videos=[{"title": "v1", "description": "", "tags": [], "view_count": 1, "upload_date": "20260101"}],
        fetched_at=t0,
        expires_at=t0 + timedelta(days=7),
    )
    await test_session.execute(stmt_insert)
    await test_session.commit()

    # ── Refresh upsert ON CONFLICT DO UPDATE ──────────────────────────
    new_videos = [
        {"title": "v2", "description": "fresh", "tags": ["new"], "view_count": 999, "upload_date": "20260502"}
    ]
    stmt_upsert = sqlite_insert(ChannelContext.__table__).values(
        channel_id="UC_upsert_001",
        platform="youtube",
        name="Updated Name",
        description="Updated description",
        subscriber_count=2000,
        video_count=20,
        tags=["updated"],
        categories=["Updated"],
        last_videos=new_videos,
        fetched_at=t1,
        expires_at=t1 + timedelta(days=7),
    )
    stmt_upsert = stmt_upsert.on_conflict_do_update(
        index_elements=["channel_id", "platform"],
        set_={
            "name": stmt_upsert.excluded.name,
            "description": stmt_upsert.excluded.description,
            "subscriber_count": stmt_upsert.excluded.subscriber_count,
            "video_count": stmt_upsert.excluded.video_count,
            "tags": stmt_upsert.excluded.tags,
            "categories": stmt_upsert.excluded.categories,
            "last_videos": stmt_upsert.excluded.last_videos,
            "fetched_at": stmt_upsert.excluded.fetched_at,
            "expires_at": stmt_upsert.excluded.expires_at,
        },
    )
    await test_session.execute(stmt_upsert)
    await test_session.commit()

    # ── Vérification : single row, valeurs rafraîchies ────────────────
    rows = (
        await test_session.execute(
            select(ChannelContext).where(
                ChannelContext.channel_id == "UC_upsert_001",
                ChannelContext.platform == "youtube",
            )
        )
    ).scalars().all()
    assert len(rows) == 1, "PK composite violée — l'upsert a inséré une 2e ligne"

    row = rows[0]
    assert row.name == "Updated Name"
    assert row.description == "Updated description"
    assert row.subscriber_count == 2000
    assert row.video_count == 20
    assert row.tags == ["updated"]
    assert row.categories == ["Updated"]
    assert row.last_videos == new_videos
    # fetched_at avance bien dans le temps après le refresh
    assert row.fetched_at == t1
    assert row.fetched_at > t0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_expires_at_in_future(test_session: AsyncSession):
    """Invariant TTL : expires_at doit être strictement > fetched_at."""
    from db.database import ChannelContext

    fetched = datetime(2026, 5, 3, 12, 0, 0)
    expires = fetched + timedelta(days=7)

    ctx = ChannelContext(
        channel_id="UC_ttl_001",
        platform="tiktok",
        name="TTL Channel",
        last_videos=_sample_last_videos(),
        fetched_at=fetched,
        expires_at=expires,
    )
    test_session.add(ctx)
    await test_session.commit()
    await test_session.refresh(ctx)

    assert ctx.expires_at > ctx.fetched_at, (
        f"expires_at ({ctx.expires_at}) doit être > fetched_at ({ctx.fetched_at})"
    )
    # Marge raisonnable : au moins quelques minutes dans le futur
    assert (ctx.expires_at - ctx.fetched_at) >= timedelta(minutes=1)
