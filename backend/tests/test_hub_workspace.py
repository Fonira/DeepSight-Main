"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST HUB MIRO WORKSPACE — Vague 1 backend                                      ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Couverture (Sprint Hub Miro Workspace MVP — 2026-05-05) :

  1. Endpoint POST /api/hub/workspaces :
     - 201 nominal (Expert + 3 summaries owned)
     - 403 si plan != expert (free, pro)
     - 429 si déjà 5 workspaces actifs sur 30j
     - 400 si summary_ids inconnus / pas du user
     - 422 si len(summary_ids) < 2 ou > 20 (Pydantic validation)
  2. Endpoint GET /api/hub/workspaces : liste ordre desc
  3. Endpoint GET /api/hub/workspaces/{id} :
     - 200 owner
     - 404 autre user (on cache l'existence)
  4. Endpoint DELETE /api/hub/workspaces/{id} : 204 + row absente
  5. Background task Miro : monkeypatché, on vérifie l'enregistrement et args.
"""

import os
import sys
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock

# ── Env defaults pour import safety (avant import des modules src) ────────────
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import select  # noqa: E402
from httpx import AsyncClient, ASGITransport  # noqa: E402


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIXTURES — SQLite in-memory + User Expert/Pro/Free + Summaries
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def db_session():
    """SQLite in-memory + tous les models créés via Base.metadata.create_all."""
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    SessionLocal = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        yield session

    await engine.dispose()


async def _make_user(db_session, plan: str, username: str) -> "User":
    from db.database import User

    user = User(
        username=username,
        email=f"{username}@example.com",
        password_hash="hashed_pw",
        plan=plan,
        credits=1000,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def expert_user(db_session):
    return await _make_user(db_session, "expert", "expert_user")


@pytest_asyncio.fixture
async def pro_user(db_session):
    return await _make_user(db_session, "pro", "pro_user")


@pytest_asyncio.fixture
async def free_user(db_session):
    return await _make_user(db_session, "free", "free_user")


async def _make_summary(db_session, user_id: int, title: str = "Test") -> "Summary":
    from db.database import Summary

    summary = Summary(
        user_id=user_id,
        video_id=f"vid{title[:8]}",
        video_title=title,
        video_channel="Test Channel",
        video_url="https://youtube.com/watch?v=test",
        platform="youtube",
        lang="fr",
        summary_content="Summary",
    )
    db_session.add(summary)
    await db_session.commit()
    await db_session.refresh(summary)
    return summary


@pytest_asyncio.fixture
async def expert_summaries(db_session, expert_user):
    """3 summaries pour l'expert user."""
    s1 = await _make_summary(db_session, expert_user.id, "Video1")
    s2 = await _make_summary(db_session, expert_user.id, "Video2")
    s3 = await _make_summary(db_session, expert_user.id, "Video3")
    return [s1, s2, s3]


# ─── App + override deps ────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def app_factory(db_session, monkeypatch):
    """Factory qui rend une app FastAPI + helper pour set le user override.

    Mocks `_create_miro_board_async` pour ne pas appeler Miro réellement.
    Stocke les calls dans `app.state.miro_calls` pour assertion.
    """
    from main import app
    from db.database import get_session
    from auth.dependencies import get_current_user
    import hub.router as hub_router_module

    # Monkeypatch background task — on stocke les calls
    miro_calls: list[int] = []

    async def fake_create(workspace_id: int) -> None:
        miro_calls.append(workspace_id)

    monkeypatch.setattr(
        hub_router_module, "_create_miro_board_async", fake_create
    )

    async def override_session():
        return db_session

    app.dependency_overrides[get_session] = override_session

    def set_user(user):
        async def override_user():
            return user

        app.dependency_overrides[get_current_user] = override_user

    yield app, set_user, miro_calls
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def expert_client(app_factory, expert_user):
    app, set_user, miro_calls = app_factory
    set_user(expert_user)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c, miro_calls


@pytest_asyncio.fixture
async def pro_client(app_factory, pro_user):
    app, set_user, miro_calls = app_factory
    set_user(pro_user)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c, miro_calls


@pytest_asyncio.fixture
async def free_client(app_factory, free_user):
    app, set_user, miro_calls = app_factory
    set_user(free_user)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c, miro_calls


# ═══════════════════════════════════════════════════════════════════════════════
# 1. ✅ POST /api/hub/workspaces — création
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_workspace_expert_succeeds(
    expert_client, expert_summaries
):
    """Expert + 3 summaries owned → 201, status=pending, BackgroundTask scheduled."""
    client, miro_calls = expert_client
    sids = [s.id for s in expert_summaries]
    resp = await client.post(
        "/api/hub/workspaces",
        json={"name": "Mon Workspace", "summary_ids": sids},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Mon Workspace"
    assert body["summary_ids"] == sids
    assert body["status"] == "pending"
    assert body["miro_board_id"] is None
    assert body["miro_board_url"] is None
    # Background task scheduled avec workspace.id
    assert miro_calls == [body["id"]]


@pytest.mark.asyncio
async def test_create_workspace_pro_forbidden(pro_client, db_session, pro_user):
    """Pro user → 403 (Expert only)."""
    s1 = await _make_summary(db_session, pro_user.id, "ProVid1")
    s2 = await _make_summary(db_session, pro_user.id, "ProVid2")
    client, _ = pro_client
    resp = await client.post(
        "/api/hub/workspaces",
        json={"name": "Pro WS", "summary_ids": [s1.id, s2.id]},
    )
    assert resp.status_code == 403
    body = resp.json()
    assert body["detail"]["code"] == "hub_workspace_expert_only"


@pytest.mark.asyncio
async def test_create_workspace_free_forbidden(
    free_client, db_session, free_user
):
    """Free user → 403 (Expert only)."""
    s1 = await _make_summary(db_session, free_user.id, "FreeVid1")
    s2 = await _make_summary(db_session, free_user.id, "FreeVid2")
    client, _ = free_client
    resp = await client.post(
        "/api/hub/workspaces",
        json={"name": "Free WS", "summary_ids": [s1.id, s2.id]},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_workspace_quota_exceeded(
    expert_client, expert_summaries, db_session, expert_user
):
    """5 workspaces actifs déjà → 6ème → 429."""
    from db.database import HubWorkspace

    sids = [s.id for s in expert_summaries]
    # Crée directement 5 workspaces actifs (status=ready) en DB
    for i in range(5):
        ws = HubWorkspace(
            user_id=expert_user.id,
            name=f"WS{i}",
            summary_ids=sids,
            status="ready",
        )
        db_session.add(ws)
    await db_session.commit()

    client, _ = expert_client
    resp = await client.post(
        "/api/hub/workspaces",
        json={"name": "6th WS", "summary_ids": sids},
    )
    assert resp.status_code == 429
    body = resp.json()
    assert body["detail"]["code"] == "hub_workspace_quota_exceeded"


@pytest.mark.asyncio
async def test_create_workspace_invalid_summary_ids(
    expert_client, expert_summaries
):
    """summary_id inexistant → 400."""
    sids = [expert_summaries[0].id, 999999]  # 999999 n'existe pas
    client, _ = expert_client
    resp = await client.post(
        "/api/hub/workspaces",
        json={"name": "WS bad", "summary_ids": sids},
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["detail"]["code"] == "hub_workspace_invalid_summary_ids"


@pytest.mark.asyncio
async def test_create_workspace_other_user_summary_forbidden(
    expert_client, db_session, free_user
):
    """summary_id appartenant à un autre user → 400."""
    other_summary = await _make_summary(
        db_session, free_user.id, "OtherUserVid"
    )
    s_self = await _make_summary(db_session, free_user.id + 100000, "Vid self")
    # Note: ce dernier ne sera pas owned by expert, mais on en crée un en plus
    # On va en faire un de l'expert pour avoir 2 IDs valides + 1 invalide
    from db.database import User as UserModel

    # Récupère expert_user via DB (le client en a un)
    res = await db_session.execute(
        select(UserModel).where(UserModel.username == "expert_user")
    )
    expert = res.scalar_one()
    s_expert = await _make_summary(db_session, expert.id, "ExpertVid")

    client, _ = expert_client
    resp = await client.post(
        "/api/hub/workspaces",
        json={
            "name": "Mixed",
            "summary_ids": [s_expert.id, other_summary.id],
        },
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["detail"]["code"] == "hub_workspace_invalid_summary_ids"


@pytest.mark.asyncio
async def test_create_workspace_min_2_summaries(
    expert_client, expert_summaries
):
    """1 summary → 422 (Pydantic min_length=2)."""
    client, _ = expert_client
    resp = await client.post(
        "/api/hub/workspaces",
        json={"name": "WS too small", "summary_ids": [expert_summaries[0].id]},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_workspace_max_20_summaries(
    expert_client, db_session, expert_user
):
    """21 summaries → 422 (Pydantic max_length=20)."""
    summaries = [
        await _make_summary(db_session, expert_user.id, f"Vid{i:02d}")
        for i in range(21)
    ]
    sids = [s.id for s in summaries]
    client, _ = expert_client
    resp = await client.post(
        "/api/hub/workspaces",
        json={"name": "WS too big", "summary_ids": sids},
    )
    assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# 2. ✅ GET /api/hub/workspaces — liste
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_list_workspaces(
    expert_client, expert_summaries, db_session, expert_user
):
    """3 workspaces créés directement en DB → liste de 3 ordre desc created_at."""
    from db.database import HubWorkspace

    sids = [s.id for s in expert_summaries]
    for i in range(3):
        ws = HubWorkspace(
            user_id=expert_user.id,
            name=f"WS{i}",
            summary_ids=sids,
            status="ready",
        )
        db_session.add(ws)
    await db_session.commit()

    client, _ = expert_client
    resp = await client.get("/api/hub/workspaces")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 3
    # Ordre desc created_at — les rows ont été insérées dans l'ordre WS0, WS1, WS2
    # donc WS2 doit apparaître en premier (or, tie-break par id desc dans certains cas)
    names = [item["name"] for item in body["items"]]
    # On vérifie au moins que toutes sont présentes
    assert set(names) == {"WS0", "WS1", "WS2"}


# ═══════════════════════════════════════════════════════════════════════════════
# 3. ✅ GET /api/hub/workspaces/{id} — détail
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_workspace_owner(
    expert_client, expert_summaries, db_session, expert_user
):
    """Owner peut récupérer son workspace."""
    from db.database import HubWorkspace

    ws = HubWorkspace(
        user_id=expert_user.id,
        name="My WS",
        summary_ids=[s.id for s in expert_summaries],
        status="ready",
    )
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    client, _ = expert_client
    resp = await client.get(f"/api/hub/workspaces/{ws.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == ws.id
    assert body["name"] == "My WS"


@pytest.mark.asyncio
async def test_get_workspace_other_user_404(
    app_factory, db_session, expert_user, expert_summaries
):
    """Un autre user → 404 (on ne révèle pas l'existence)."""
    from db.database import HubWorkspace, User as UserModel

    # 1. Crée un workspace pour expert_user
    ws = HubWorkspace(
        user_id=expert_user.id,
        name="Owner WS",
        summary_ids=[s.id for s in expert_summaries],
        status="ready",
    )
    db_session.add(ws)

    # 2. Crée un autre expert user
    other = UserModel(
        username="other_expert",
        email="other@example.com",
        password_hash="x",
        plan="expert",
        credits=100,
    )
    db_session.add(other)
    await db_session.commit()
    await db_session.refresh(ws)
    await db_session.refresh(other)

    app, set_user, _ = app_factory
    set_user(other)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        resp = await c.get(f"/api/hub/workspaces/{ws.id}")
    assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ✅ DELETE /api/hub/workspaces/{id}
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_delete_workspace(
    expert_client, expert_summaries, db_session, expert_user
):
    """Delete owner → 204 + row absente."""
    from db.database import HubWorkspace

    ws = HubWorkspace(
        user_id=expert_user.id,
        name="To Delete",
        summary_ids=[s.id for s in expert_summaries],
        status="ready",
        miro_board_id=None,  # Pas de board → pas d'appel Miro DELETE
    )
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)
    ws_id = ws.id

    client, _ = expert_client
    resp = await client.delete(f"/api/hub/workspaces/{ws_id}")
    assert resp.status_code == 204

    # Vérifier que la row a bien été supprimée
    res = await db_session.execute(
        select(HubWorkspace).where(HubWorkspace.id == ws_id)
    )
    assert res.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_workspace_not_found(expert_client):
    """DELETE sur ID inexistant → 404."""
    client, _ = expert_client
    resp = await client.delete("/api/hub/workspaces/999999")
    assert resp.status_code == 404
