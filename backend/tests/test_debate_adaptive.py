"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST DEBATE ADAPTIVE V2 — Mode 1-N + Magistral + add-perspective              ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Couverture (Sprint Débat IA v2 — Wave 2 B'') :

  1. Schema DebatePerspective : création row, FK CASCADE, position UNIQUE par debate.
  2. Endpoint POST /api/debate/{id}/add-perspective :
     - 200 nominal (lance background task)
     - 400 si relation_type = 'opposite'  (Pydantic Literal le bloque déjà)
     - 403 si user.plan = 'free'
     - 402 si user.credits < ADD_PERSPECTIVE_CREDITS
     - 404 si debate not found / pas owner
     - 409 si déjà MAX_PERSPECTIVES_PER_DEBATE perspectives
  3. _run_debate_pipeline refactoré : vidéo B persistée comme
     DebatePerspective(position=0, relation_type='opposite').
  4. Backfill migration 017 (idempotence + reverse).
  5. Backward-compat GET response : video_b_* à la racine ET perspectives[].
"""

import json
import os
import sys
import pytest
import pytest_asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

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
# 🔧 FIXTURES — SQLite in-memory + User réel + Debate réel
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


@pytest_asyncio.fixture
async def existing_user(db_session):
    """User Pro avec assez de crédits."""
    from db.database import User

    user = User(
        username="adaptive_user",
        email="adaptive_user@example.com",
        password_hash="hashed_pw",
        plan="pro",
        credits=100,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def free_user(db_session):
    """User Free → doit être bloqué sur add-perspective."""
    from db.database import User

    user = User(
        username="free_user",
        email="free@example.com",
        password_hash="hashed_pw",
        plan="free",
        credits=100,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def existing_debate(db_session, existing_user):
    """Debate completed avec une perspective B initiale (position=0)."""
    from db.database import DebateAnalysis, DebatePerspective

    debate = DebateAnalysis(
        user_id=existing_user.id,
        video_a_id="vidA00000ID",
        video_b_id="vidB00000ID",
        video_a_title="Vidéo A — pour",
        video_b_title="Vidéo B — contre",
        video_a_channel="Channel A",
        video_b_channel="Channel B",
        thesis_a="A is good",
        thesis_b="A is bad",
        arguments_a=json.dumps([{"claim": "A1", "evidence": "E1", "strength": "strong"}]),
        arguments_b=json.dumps([{"claim": "B1", "evidence": "E1b", "strength": "strong"}]),
        detected_topic="Test topic",
        status="completed",
        mode="auto",
        lang="fr",
        platform="web",
        relation_type_dominant="opposite",
        created_at=datetime.utcnow(),
    )
    db_session.add(debate)
    await db_session.commit()
    await db_session.refresh(debate)

    # Perspective initiale position=0
    persp = DebatePerspective(
        debate_id=debate.id,
        position=0,
        video_id="vidB00000ID",
        platform="youtube",
        video_title="Vidéo B — contre",
        video_channel="Channel B",
        video_thumbnail="https://img.youtube.com/vi/vidB00000ID/maxresdefault.jpg",
        thesis="A is bad",
        arguments=json.dumps([{"claim": "B1", "evidence": "E1b", "strength": "strong"}]),
        relation_type="opposite",
        channel_quality_score=0.5,
        audience_level="unknown",
    )
    db_session.add(persp)
    await db_session.commit()
    await db_session.refresh(debate)
    return debate


# ═══════════════════════════════════════════════════════════════════════════════
# 1. ✅ TEST SCHEMA DebatePerspective — FK CASCADE, position UNIQUE
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_perspective_creation_basic(db_session, existing_debate):
    """Une perspective peut être créée et liée à un debate."""
    from db.database import DebatePerspective

    p = DebatePerspective(
        debate_id=existing_debate.id,
        position=1,
        video_id="vidC11111ID",
        platform="youtube",
        video_title="Perspective C",
        video_channel="C",
        thesis="A nuance",
        arguments=json.dumps([{"claim": "C1"}]),
        relation_type="complement",
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    assert p.id is not None
    assert p.debate_id == existing_debate.id
    assert p.relation_type == "complement"
    assert p.position == 1


@pytest.mark.asyncio
async def test_perspective_unique_position_per_debate(db_session, existing_debate):
    """UniqueConstraint(debate_id, position) interdit 2 rows même position."""
    from db.database import DebatePerspective
    from sqlalchemy.exc import IntegrityError

    # existing_debate a déjà position=0 via fixture
    duplicate = DebatePerspective(
        debate_id=existing_debate.id,
        position=0,  # ← collision
        video_id="dupVid000ID",
        platform="youtube",
        relation_type="opposite",
    )
    db_session.add(duplicate)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_perspective_cascade_on_debate_delete(db_session, existing_debate):
    """Supprimer un debate cascade-delete ses perspectives."""
    from db.database import DebateAnalysis, DebatePerspective

    debate_id = existing_debate.id
    # Vérifier : la perspective fixture existe
    res = await db_session.execute(
        select(DebatePerspective).where(DebatePerspective.debate_id == debate_id)
    )
    assert len(list(res.scalars().all())) == 1

    # Delete debate via ORM (cascade triggered par relationship)
    await db_session.delete(existing_debate)
    await db_session.commit()

    res = await db_session.execute(
        select(DebatePerspective).where(DebatePerspective.debate_id == debate_id)
    )
    assert list(res.scalars().all()) == []


# ═══════════════════════════════════════════════════════════════════════════════
# 2. ✅ TESTS ENDPOINT POST /api/debate/{id}/add-perspective
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def app_with_overrides(db_session, existing_user):
    """FastAPI app avec dependency_overrides pour DB + auth."""
    from main import app
    from db.database import get_session
    from auth.dependencies import (
        get_current_user,
        get_verified_user,
        require_credits,
        require_plan,
    )

    async def override_session():
        return db_session

    async def override_user():
        return existing_user

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_verified_user] = override_user
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app_with_overrides):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_overrides), base_url="http://test"
    ) as c:
        yield c


@pytest.mark.asyncio
async def test_add_perspective_400_invalid_relation_type(client, existing_debate):
    """relation_type='opposite' rejeté : doit utiliser /create."""
    resp = await client.post(
        f"/api/debate/{existing_debate.id}/add-perspective",
        json={"relation_type": "opposite"},
    )
    # Pydantic Literal["complement","nuance"] → 422 (validation)
    # ou notre check explicite → 400. Les deux sont valides.
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_add_perspective_404_not_found(client):
    resp = await client.post(
        "/api/debate/999999/add-perspective",
        json={"relation_type": "complement"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_perspective_404_not_owner(
    db_session, existing_debate, app_with_overrides
):
    """Un autre user ne peut pas ajouter de perspective sur un débat tiers."""
    from db.database import User
    from auth.dependencies import get_current_user, get_verified_user

    other = User(
        username="other_user",
        email="other@example.com",
        password_hash="x",
        plan="pro",
        credits=100,
    )
    db_session.add(other)
    await db_session.commit()
    await db_session.refresh(other)

    async def override_other():
        return other

    app_with_overrides.dependency_overrides[get_current_user] = override_other
    app_with_overrides.dependency_overrides[get_verified_user] = override_other

    async with AsyncClient(
        transport=ASGITransport(app=app_with_overrides), base_url="http://test"
    ) as c:
        resp = await c.post(
            f"/api/debate/{existing_debate.id}/add-perspective",
            json={"relation_type": "complement"},
        )
    # _get_debate_owned raises 403 if not owner (current implementation)
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_add_perspective_403_free_plan(
    db_session, existing_debate, app_with_overrides, free_user
):
    """Plan free → 403."""
    from auth.dependencies import get_current_user, get_verified_user

    # Re-route le debate au free_user pour qu'il en soit owner
    existing_debate.user_id = free_user.id
    await db_session.commit()

    async def override_free():
        return free_user

    app_with_overrides.dependency_overrides[get_current_user] = override_free
    app_with_overrides.dependency_overrides[get_verified_user] = override_free

    async with AsyncClient(
        transport=ASGITransport(app=app_with_overrides), base_url="http://test"
    ) as c:
        resp = await c.post(
            f"/api/debate/{existing_debate.id}/add-perspective",
            json={"relation_type": "complement"},
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_add_perspective_402_insufficient_credits(
    db_session, existing_debate, existing_user, app_with_overrides
):
    """Crédits < ADD_PERSPECTIVE_CREDITS → 402."""
    existing_user.credits = 1  # < 3
    db_session.add(existing_user)
    await db_session.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app_with_overrides), base_url="http://test"
    ) as c:
        resp = await c.post(
            f"/api/debate/{existing_debate.id}/add-perspective",
            json={"relation_type": "complement"},
        )
    assert resp.status_code == 402


@pytest.mark.asyncio
async def test_add_perspective_409_max_perspectives(
    db_session, existing_debate, app_with_overrides
):
    """Si déjà MAX_PERSPECTIVES_PER_DEBATE perspectives → 409."""
    from db.database import DebatePerspective
    from debate.router import MAX_PERSPECTIVES_PER_DEBATE

    # Fixture en a déjà 1 (position=0). Ajouter jusqu'à MAX-1 de plus.
    for pos in range(1, MAX_PERSPECTIVES_PER_DEBATE):
        db_session.add(
            DebatePerspective(
                debate_id=existing_debate.id,
                position=pos,
                video_id=f"vid{pos:08d}ID",
                platform="youtube",
                relation_type="complement",
            )
        )
    await db_session.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app_with_overrides), base_url="http://test"
    ) as c:
        resp = await c.post(
            f"/api/debate/{existing_debate.id}/add-perspective",
            json={"relation_type": "complement"},
        )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_add_perspective_200_nominal(
    db_session, existing_debate, app_with_overrides
):
    """Cas nominal : lance background task + retour 200 avec perspectives[]."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_overrides), base_url="http://test"
    ) as c:
        resp = await c.post(
            f"/api/debate/{existing_debate.id}/add-perspective",
            json={"relation_type": "complement"},
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["id"] == existing_debate.id
    # status passe à adding_perspective immédiatement
    assert body["status"] in ("adding_perspective", "completed")
    # Les perspectives existantes (position 0) restent visibles
    assert isinstance(body["perspectives"], list)
    assert len(body["perspectives"]) >= 1
    assert body["perspectives"][0]["position"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# 3. ✅ TEST PIPELINE REFACTORED — vidéo B persistée comme DebatePerspective
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_pipeline_persists_video_b_as_perspective_position_0(
    db_session, existing_user, monkeypatch
):
    """_run_debate_pipeline persiste B en DebatePerspective(position=0, opposite)."""
    from db.database import DebateAnalysis, DebatePerspective
    import debate.router as debate_router

    # ── 1. Setup minimal debate (status=pending) ──
    debate = DebateAnalysis(
        user_id=existing_user.id,
        video_a_id="vidA_pipeline",
        status="pending",
        mode="manual",
        lang="fr",
        created_at=datetime.utcnow(),
    )
    db_session.add(debate)
    await db_session.commit()
    await db_session.refresh(debate)

    # ── 2. Patch async_session_maker pour utiliser notre db_session in-memory ──
    # Le pipeline crée son propre context manager — on retourne db_session via factory.
    class _FakeSessionMakerCtx:
        def __init__(self, sess):
            self._sess = sess

        async def __aenter__(self):
            return self._sess

        async def __aexit__(self, *args):
            return False

    def _fake_session_maker():
        return _FakeSessionMakerCtx(db_session)

    monkeypatch.setattr(debate_router, "async_session_maker", _fake_session_maker)

    # ── 3. Mock external IO ──
    async def mock_video_info(vid):
        return {
            "title": f"Title {vid}",
            "channel": f"Channel {vid}",
            "thumbnail_url": f"https://img/{vid}.jpg",
        }

    async def mock_transcript(vid):
        return (f"Transcript for {vid}", [], "fr")

    monkeypatch.setattr(debate_router, "get_video_info", mock_video_info)
    monkeypatch.setattr(
        debate_router, "get_transcript_with_timestamps", mock_transcript
    )

    # Mock Mistral / Magistral / Perplexity
    call_log = []

    async def mock_mistral(messages, model="mistral-small-2603", **kwargs):
        call_log.append(("mistral", model))
        # Topic detection prompt → respond with topic+thesis JSON
        sys_prompt = messages[0].get("content", "") if messages else ""
        if "Extrais le sujet" in sys_prompt:
            return json.dumps(
                {
                    "topic": "Topic detected",
                    "thesis": "Thesis A detected",
                    "key_arguments": [{"claim": "ka1", "evidence": "e1", "strength": "strong"}],
                }
            )
        # Search query generation
        if "expert en recherche YouTube" in sys_prompt:
            return json.dumps(
                {"query_primary": "test query", "query_alternative": "alt query"}
            )
        # Fallback → empty array for fact-check
        return "[]"

    async def mock_magistral(messages, **kwargs):
        call_log.append(("magistral", kwargs.get("temperature", "?")))
        return json.dumps(
            {
                "thesis_b": "Thesis B from Magistral",
                "arguments_b": [{"claim": "B1", "evidence": "Be1", "strength": "moderate"}],
                "convergence_points": ["common"],
                "divergence_points": [{"topic": "x", "position_a": "a", "position_b": "b"}],
                "summary": "A vs B summary",
            }
        )

    async def mock_perplexity(query, context=""):
        return None  # disable web search

    async def mock_search_opposing(*args, **kwargs):
        # Simulate a found opposing video
        return {
            "url": "https://www.youtube.com/watch?v=vidB_found",
            "title": "Opposing",
            "channel": "Opp Ch",
        }

    monkeypatch.setattr(debate_router, "_call_mistral", mock_mistral)
    monkeypatch.setattr(debate_router, "_call_magistral", mock_magistral)
    monkeypatch.setattr(debate_router, "_call_perplexity", mock_perplexity)
    monkeypatch.setattr(
        debate_router, "_search_opposing_video", mock_search_opposing
    )

    # Disable web search (avoids extra calls)
    from core import config as core_config

    monkeypatch.setattr(core_config, "is_web_search_available", lambda: False)

    # Avatar fire-and-forget — disable to keep test fast
    import voice.avatar as voice_avatar

    monkeypatch.setattr(voice_avatar, "ensure_debate_avatar", lambda *_a, **_k: None)

    # deduct_credits noop
    async def mock_deduct(*args, **kwargs):
        return (True, 0)

    monkeypatch.setattr(debate_router, "deduct_credits", mock_deduct)

    # ── 4. Run pipeline ──
    await debate_router._run_debate_pipeline(
        debate_id=debate.id,
        video_a_id="vidA_pipeline",
        video_b_id=None,
        platform_a="youtube",
        platform_b=None,
        user_id=existing_user.id,
        user_plan="pro",
        lang="fr",
        mode="auto",
    )

    # ── 5. Assertions ──
    # Reload debate (different session instance)
    await db_session.refresh(debate)
    assert debate.status == "completed"

    # Magistral was called for comparison
    assert any(c[0] == "magistral" for c in call_log), (
        "Expected at least one Magistral call in comparison step"
    )

    # Vidéo B persistée comme DebatePerspective(position=0)
    res = await db_session.execute(
        select(DebatePerspective).where(DebatePerspective.debate_id == debate.id)
    )
    perspectives = list(res.scalars().all())
    assert len(perspectives) == 1
    p0 = perspectives[0]
    assert p0.position == 0
    assert p0.relation_type == "opposite"
    assert p0.video_id == "vidB_found"
    assert p0.thesis == "Thesis B from Magistral"


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ✅ TEST BACKWARD-COMPAT GET RESPONSE — video_b_* à la racine ET perspectives[]
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_debate_response_keeps_legacy_fields(
    db_session, existing_debate, app_with_overrides
):
    """GET /api/debate/{id} retourne video_b_* legacy ET perspectives[] v2."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_overrides), base_url="http://test"
    ) as c:
        resp = await c.get(f"/api/debate/{existing_debate.id}")

    assert resp.status_code == 200, resp.text
    body = resp.json()

    # Legacy v1 fields à la racine
    assert body["video_b_id"] == "vidB00000ID"
    assert body["video_b_title"] == "Vidéo B — contre"
    assert body["video_b_channel"] == "Channel B"
    assert body["thesis_b"] == "A is bad"
    assert isinstance(body["arguments_b"], list)

    # Nouveaux champs v2
    assert "perspectives" in body
    assert isinstance(body["perspectives"], list)
    assert len(body["perspectives"]) == 1
    p0 = body["perspectives"][0]
    assert p0["position"] == 0
    assert p0["relation_type"] == "opposite"
    assert p0["video_id"] == "vidB00000ID"
    assert "relation_type_dominant" in body
    assert body["relation_type_dominant"] == "opposite"


# ═══════════════════════════════════════════════════════════════════════════════
# 5. ✅ TEST RECOMPUTE relation_type_dominant
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_recompute_relation_type_dominant(db_session, existing_debate):
    """Avec 1 opposite + 2 complement → dominant = complement."""
    from db.database import DebatePerspective
    from debate.router import _recompute_relation_type_dominant

    # Fixture has position=0 opposite. Add 2 complement.
    for pos, rel in [(1, "complement"), (2, "complement")]:
        db_session.add(
            DebatePerspective(
                debate_id=existing_debate.id,
                position=pos,
                video_id=f"vid{pos:08d}",
                platform="youtube",
                relation_type=rel,
            )
        )
    await db_session.commit()

    dominant = await _recompute_relation_type_dominant(db_session, existing_debate.id)
    assert dominant == "complement"

    # And persisted on debate
    await db_session.refresh(existing_debate)
    assert existing_debate.relation_type_dominant == "complement"


# ═══════════════════════════════════════════════════════════════════════════════
# 6. ✅ TEST BACKFILL MIGRATION 017 — idempotence + reverse propre
# ═══════════════════════════════════════════════════════════════════════════════


def test_migration_017_upgrade_downgrade_idempotent(tmp_path, monkeypatch):
    """Test direct des fonctions upgrade()/downgrade() de la migration 017.

    On évite l'invocation `alembic upgrade head` (la chaîne complète plante sur
    SQLite, bug pré-existant unrelated dans 003_add_transcript_cache). À la
    place, on charge dynamiquement le module 017, on lui injecte un alembic
    op binding sur une connexion SQLite vierge, on seede manuellement les
    rows debate_analyses, puis on appelle upgrade() / upgrade() (idempotent)
    / downgrade().
    """
    import sqlite3
    import importlib

    # Workaround module shadowing : `backend/alembic/` overshadow le package
    # `alembic` quand pytest tourne avec cwd=backend. On force l'unload du
    # cached module shadow (s'il existe) puis on insère le site-packages path.
    # Méthode robuste : récupérer le path site-packages réel.
    import site

    # Purger les imports alembic locaux pollués
    for name in list(sys.modules.keys()):
        if name == "alembic" or name.startswith("alembic."):
            del sys.modules[name]

    # Pour forcer le bon import, on désactive temporairement le path local
    backend_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..")
    )
    saved_path = list(sys.path)
    # Retirer toute entrée du backend_dir et insérer site-packages en tête
    for sp in site.getsitepackages():
        if sp not in sys.path:
            sys.path.insert(0, sp)
    sys.path = [p for p in sys.path if p != backend_dir and p != "."]

    try:
        from alembic.runtime.migration import MigrationContext
        from alembic.operations import Operations
        from sqlalchemy import create_engine, text as sa_text

        # Importer le module migration 017 manuellement
        import importlib.util

        mig_path = os.path.join(
            backend_dir, "alembic", "versions", "017_debate_v2_perspectives.py"
        )
        spec = importlib.util.spec_from_file_location("mig017_test", mig_path)
        mig017 = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mig017)

        db_file = tmp_path / "test_017.db"
        db_url = f"sqlite:///{db_file}"
        engine = create_engine(db_url)

        with engine.connect() as conn:
            # Table debate_analyses minimaliste pour le backfill
            conn.execute(
                sa_text(
                    """
                    CREATE TABLE debate_analyses (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        video_a_id VARCHAR(100) NOT NULL,
                        platform_a VARCHAR(20) DEFAULT 'youtube',
                        video_a_title VARCHAR(500),
                        video_a_channel VARCHAR(255),
                        video_a_thumbnail TEXT,
                        video_b_id VARCHAR(100),
                        platform_b VARCHAR(20),
                        video_b_title VARCHAR(500),
                        video_b_channel VARCHAR(255),
                        video_b_thumbnail TEXT,
                        detected_topic VARCHAR(500),
                        thesis_a TEXT,
                        thesis_b TEXT,
                        arguments_a TEXT,
                        arguments_b TEXT,
                        convergence_points TEXT,
                        divergence_points TEXT,
                        fact_check_results TEXT,
                        debate_summary TEXT,
                        status VARCHAR(50),
                        mode VARCHAR(20),
                        platform VARCHAR(20),
                        model_used VARCHAR(50),
                        credits_used INTEGER DEFAULT 0,
                        lang VARCHAR(5) DEFAULT 'fr',
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """
                )
            )
            conn.execute(
                sa_text(
                    """
                    INSERT INTO debate_analyses
                      (id, user_id, video_a_id, video_b_id, platform_b,
                       video_b_title, video_b_channel, video_b_thumbnail,
                       thesis_b, arguments_b, fact_check_results,
                       status, mode, lang, created_at)
                    VALUES
                      (1, 1, 'vidA1', 'vidB1', 'youtube', 'B1 title', 'B1 ch',
                       'thumb1', 'B1 thesis', '[]', '[]',
                       'completed', 'auto', 'fr', '2026-01-01 00:00:00'),
                      (2, 1, 'vidA2', 'vidB2', 'youtube', 'B2 title', 'B2 ch',
                       'thumb2', 'B2 thesis', '[]', '[]',
                       'completed', 'manual', 'fr', '2026-01-02 00:00:00'),
                      (3, 1, 'vidA3', NULL, NULL, NULL, NULL, NULL, NULL,
                       NULL, NULL, 'failed', 'auto', 'fr', '2026-01-03 00:00:00')
                    """
                )
            )
            conn.commit()

        # Helper : run mig017.upgrade()/downgrade() dans le contexte alembic
        def _run_mig(fn_name: str):
            with engine.connect() as conn:
                ctx = MigrationContext.configure(conn)
                with Operations.context(ctx):
                    getattr(mig017, fn_name)()
                conn.commit()

        # ── 1. Upgrade ──
        _run_mig("upgrade")

        sync = sqlite3.connect(str(db_file))
        cur = sync.cursor()
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='debate_perspectives'"
        )
        assert cur.fetchone() is not None, "debate_perspectives missing after upgrade"

        cur.execute("SELECT COUNT(*) FROM debate_perspectives")
        assert cur.fetchone()[0] == 2

        cur.execute(
            "SELECT debate_id, position, relation_type, video_id "
            "FROM debate_perspectives ORDER BY debate_id"
        )
        rows = cur.fetchall()
        assert rows[0] == (1, 0, "opposite", "vidB1")
        assert rows[1] == (2, 0, "opposite", "vidB2")

        cur.execute("PRAGMA table_info(debate_analyses)")
        cols = {r[1] for r in cur.fetchall()}
        assert {"miro_board_url", "miro_board_id", "relation_type_dominant"} <= cols
        sync.close()

        # ── 2. Idempotence ──
        _run_mig("upgrade")
        sync = sqlite3.connect(str(db_file))
        cur = sync.cursor()
        cur.execute("SELECT COUNT(*) FROM debate_perspectives")
        assert cur.fetchone()[0] == 2, "Backfill not idempotent"
        sync.close()

        # ── 3. Downgrade ──
        _run_mig("downgrade")
        sync = sqlite3.connect(str(db_file))
        cur = sync.cursor()
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='debate_perspectives'"
        )
        assert cur.fetchone() is None, "Table not dropped on downgrade"
        sync.close()

        engine.dispose()
    finally:
        # Restore original sys.path
        sys.path = saved_path
        # Purger à nouveau pour ne pas polluer les autres tests
        for name in list(sys.modules.keys()):
            if name == "alembic" or name.startswith("alembic."):
                del sys.modules[name]
