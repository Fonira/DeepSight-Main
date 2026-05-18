"""Tests pour le carrousel concepts Tuteur (sprint 2026-05-18).

Couvre:
- tutor.concepts_schemas (DTOs Pydantic)
- tutor.concepts_service (extraction, dédup, cap Redis)
- tutor.concepts_router (endpoints REST + plan gating Expert)

Pattern conftest:
- DATABASE_URL = sqlite (jamais touché en pratique, dependencies overridées)
- get_session override -> AsyncMock
- get_current_user override -> mock User
- cache_service.backend.redis = fakeredis pour le cap quotidien
- _get_image_pool / DB lookup mockés via monkeypatch / AsyncMock
"""

import os
import sys
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Setup env avant tout import
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from httpx import AsyncClient, ASGITransport
import fakeredis.aioredis


# ═══════════════════════════════════════════════════════════════════════════════
# Module-level imports (after path setup) — tests unitaires purs
# ═══════════════════════════════════════════════════════════════════════════════


def test_module_imports_ok():
    """Smoke test: les modules s'importent sans crash."""
    from tutor import concepts_schemas, concepts_service, concepts_router  # noqa: F401

    assert hasattr(concepts_service, "collect_user_concepts")
    assert hasattr(concepts_service, "consume_daily_cap")
    assert hasattr(concepts_router, "router")


def test_schemas_status_literal_values():
    """ConceptStatus accepte les 5 valeurs attendues."""
    from tutor.concepts_schemas import TutorConceptItem

    for status in ("ready", "pending", "failed", "throttled", "missing"):
        item = TutorConceptItem(term="x", term_hash="abc", status=status)
        assert item.status == status

    # Status invalide -> ValidationError
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        TutorConceptItem(term="x", term_hash="abc", status="bogus")


def test_schemas_generate_request_validates_lengths():
    """term min=1 max=200, definition max=600, category max=50."""
    from pydantic import ValidationError

    from tutor.concepts_schemas import GenerateConceptRequest

    # OK
    req = GenerateConceptRequest(term="ok")
    assert req.definition == ""
    assert req.category is None

    # term vide -> erreur
    with pytest.raises(ValidationError):
        GenerateConceptRequest(term="")

    # term trop long
    with pytest.raises(ValidationError):
        GenerateConceptRequest(term="x" * 201)

    # definition trop longue
    with pytest.raises(ValidationError):
        GenerateConceptRequest(term="x", definition="d" * 601)


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers d'extraction (purs, pas d'I/O)
# ═══════════════════════════════════════════════════════════════════════════════


def test_extract_key_topics_simple():
    from tutor.concepts_service import _extract_key_topics

    md = """# Title

## Premier concept
some content

## Deuxième concept
more

### Sub heading (ignored, 3 hashes)

## Third-One"""
    out = _extract_key_topics(md)
    assert out == ["Premier concept", "Deuxième concept", "Third-One"]


def test_extract_key_topics_ignores_empty_and_short():
    from tutor.concepts_service import _extract_key_topics

    md = """##
## a
## ok"""
    # "" filtré, "a" filtré (len<2 après strip), "ok" garde
    assert _extract_key_topics(md) == ["ok"]


def test_extract_key_topics_handles_none_and_empty():
    from tutor.concepts_service import _extract_key_topics

    assert _extract_key_topics("") == []
    assert _extract_key_topics(None) == []


def test_extract_key_topics_accents():
    from tutor.concepts_service import _extract_key_topics

    md = "## Phénoménologie\n## Hégémonie culturelle"
    assert _extract_key_topics(md) == ["Phénoménologie", "Hégémonie culturelle"]


def test_extract_entities_concepts_dict_strings():
    from tutor.concepts_service import _extract_entities_concepts

    entities = {"concepts": ["IA", "Algorithme", "x"]}  # "x" filtré (len<2 ok mais len("x")==1 filtré)
    out = _extract_entities_concepts(entities)
    assert out == ["IA", "Algorithme"]


def test_extract_entities_concepts_dict_objects():
    from tutor.concepts_service import _extract_entities_concepts

    entities = {
        "concepts": [
            {"term": "Biais cognitif", "definition": "..."},
            {"term": "  Heuristique  "},  # trimmé
            {"no_term_field": "x"},  # ignoré
        ]
    }
    out = _extract_entities_concepts(entities)
    assert out == ["Biais cognitif", "Heuristique"]


def test_extract_entities_concepts_fallback_keys():
    from tutor.concepts_service import _extract_entities_concepts

    # "concepts" absent → fallback "keywords"
    entities = {"keywords": ["KW1", "KW2"]}
    assert _extract_entities_concepts(entities) == ["KW1", "KW2"]
    # "keywords" absent → fallback "entities"
    entities = {"entities": ["E1"]}
    assert _extract_entities_concepts(entities) == ["E1"]


def test_extract_entities_concepts_string_json():
    from tutor.concepts_service import _extract_entities_concepts

    s = json.dumps({"concepts": ["Alpha", "Beta"]})
    assert _extract_entities_concepts(s) == ["Alpha", "Beta"]


def test_extract_entities_concepts_invalid_json():
    from tutor.concepts_service import _extract_entities_concepts

    assert _extract_entities_concepts("not json") == []
    assert _extract_entities_concepts(None) == []
    assert _extract_entities_concepts("") == []
    assert _extract_entities_concepts([]) == []


def test_normalize_concept():
    from tutor.concepts_service import _normalize_concept

    assert _normalize_concept("Foo Bar") == "foo bar"
    assert _normalize_concept("  foo   bar  ") == "foo bar"
    assert _normalize_concept("FOO\tBAR") == "foo bar"
    assert _normalize_concept("Phénoménologie") == "phénoménologie"


# ═══════════════════════════════════════════════════════════════════════════════
# Plan gating
# ═══════════════════════════════════════════════════════════════════════════════


def _make_mock_user(plan: str = "expert", uid: int = 1, is_admin: bool = False):
    u = MagicMock()
    u.id = uid
    u.email = f"{plan}@test.fr"
    u.plan = plan
    u.is_admin = is_admin
    return u


def test_check_expert_gating_free_raises_403():
    from fastapi import HTTPException

    from tutor.concepts_router import _check_expert_gating

    with pytest.raises(HTTPException) as exc:
        _check_expert_gating(_make_mock_user(plan="free"))
    assert exc.value.status_code == 403
    assert exc.value.detail.get("required_plan") == "expert"


def test_check_expert_gating_pro_raises_403():
    from fastapi import HTTPException

    from tutor.concepts_router import _check_expert_gating

    with pytest.raises(HTTPException):
        _check_expert_gating(_make_mock_user(plan="pro"))


def test_check_expert_gating_expert_passes():
    from tutor.concepts_router import _check_expert_gating

    # Pas d'exception = succès
    _check_expert_gating(_make_mock_user(plan="expert"))


def test_check_expert_gating_admin_bypass():
    from tutor.concepts_router import _check_expert_gating

    _check_expert_gating(_make_mock_user(plan="free", is_admin=True))


def test_check_expert_gating_none_plan():
    """plan=None → 403 (traité comme free)."""
    from fastapi import HTTPException

    from tutor.concepts_router import _check_expert_gating

    user = _make_mock_user(plan="expert")
    user.plan = None
    with pytest.raises(HTTPException):
        _check_expert_gating(user)


# ═══════════════════════════════════════════════════════════════════════════════
# Service: collect_user_concepts (dédup, limit)
# ═══════════════════════════════════════════════════════════════════════════════


def _make_db_with_rows(rows: list[tuple]):
    """Construit un AsyncMock de db.execute().all() retournant les rows fournies."""
    db = AsyncMock()
    exec_result = MagicMock()
    exec_result.all.return_value = rows
    db.execute.return_value = exec_result
    return db


@pytest.mark.asyncio
async def test_collect_user_concepts_dedup_across_summaries():
    from tutor.concepts_service import collect_user_concepts

    rows = [
        (101, "## Concept A\n## Concept B\n", None),
        (102, "## concept a\n## Concept C\n", None),  # "concept a" dup
    ]
    db = _make_db_with_rows(rows)
    out = await collect_user_concepts(user_id=1, db=db, limit=10)
    terms = [c["term"] for c in out]
    assert "Concept A" in terms
    assert "Concept B" in terms
    assert "Concept C" in terms
    # Dédup → la 2nde occurrence "concept a" (lowercase) doit être skipped
    assert sum(1 for t in terms if t.lower() == "concept a") == 1


@pytest.mark.asyncio
async def test_collect_user_concepts_respects_limit():
    from tutor.concepts_service import collect_user_concepts

    rows = [
        (101, "## Alpha\n## Beta\n## Gamma\n## Delta\n## Epsilon\n", None),
    ]
    db = _make_db_with_rows(rows)
    out = await collect_user_concepts(user_id=1, db=db, limit=3)
    assert len(out) == 3
    assert [c["term"] for c in out] == ["Alpha", "Beta", "Gamma"]


@pytest.mark.asyncio
async def test_collect_user_concepts_merges_headings_and_entities():
    from tutor.concepts_service import collect_user_concepts

    rows = [
        (101, "## H1\n", {"concepts": ["E1", "E2"]}),
    ]
    db = _make_db_with_rows(rows)
    out = await collect_user_concepts(user_id=1, db=db, limit=10)
    terms = [c["term"] for c in out]
    assert terms == ["H1", "E1", "E2"]


@pytest.mark.asyncio
async def test_collect_user_concepts_empty_rows():
    from tutor.concepts_service import collect_user_concepts

    db = _make_db_with_rows([])
    out = await collect_user_concepts(user_id=1, db=db, limit=10)
    assert out == []


@pytest.mark.asyncio
async def test_collect_user_concepts_term_hash_uses_tutor_style():
    """Le term_hash retourné doit utiliser style='tutor_doodle' (pas le legacy 'photo')."""
    import hashlib

    from tutor.concepts_service import collect_user_concepts

    rows = [(101, "## Test\n", None)]
    db = _make_db_with_rows(rows)
    out = await collect_user_concepts(user_id=1, db=db, limit=10)
    expected = hashlib.sha256("tutor_doodle:test".encode("utf-8")).hexdigest()
    assert out[0]["term_hash"] == expected


# ═══════════════════════════════════════════════════════════════════════════════
# Service: consume_daily_cap (Redis)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
async def fake_redis_in_cache():
    """Injecte fakeredis dans cache_service.backend.redis (cleanup automatique)."""
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    from core.cache import cache_service

    saved = cache_service.backend
    fake_backend = MagicMock()
    fake_backend.redis = client
    cache_service.backend = fake_backend
    try:
        yield client
    finally:
        cache_service.backend = saved
        await client.flushall()
        await client.aclose()


@pytest.mark.asyncio
async def test_consume_daily_cap_first_call_succeeds(fake_redis_in_cache):
    from core.config import TUTOR_DOODLE_DAILY_CAP
    from tutor.concepts_service import consume_daily_cap

    allowed, remaining = await consume_daily_cap(n=1)
    assert allowed is True
    assert remaining == TUTOR_DOODLE_DAILY_CAP - 1


@pytest.mark.asyncio
async def test_consume_daily_cap_blocks_when_exceeded(fake_redis_in_cache, monkeypatch):
    """Mock un cap très bas et vérifie le rollback quand dépassé."""
    monkeypatch.setattr("tutor.concepts_service.TUTOR_DOODLE_DAILY_CAP", 3)
    from tutor.concepts_service import consume_daily_cap

    # 3 consommations OK
    for i in range(3):
        allowed, _ = await consume_daily_cap(n=1)
        assert allowed is True
    # 4ème → bloqué
    allowed, remaining = await consume_daily_cap(n=1)
    assert allowed is False
    assert remaining == 0


@pytest.mark.asyncio
async def test_consume_daily_cap_redis_unavailable_allows():
    """Si Redis est down (cache_service.backend = None), on autorise."""
    from core.cache import cache_service
    from core.config import TUTOR_DOODLE_DAILY_CAP
    from tutor.concepts_service import consume_daily_cap

    saved = cache_service.backend
    cache_service.backend = None
    try:
        allowed, remaining = await consume_daily_cap(n=1)
        assert allowed is True
        assert remaining == TUTOR_DOODLE_DAILY_CAP
    finally:
        cache_service.backend = saved


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints (FastAPI TestClient)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def mock_session():
    s = AsyncMock()
    s.execute = AsyncMock()
    s.commit = AsyncMock()
    s.rollback = AsyncMock()
    s.close = AsyncMock()
    return s


@pytest.fixture
def app(mock_session):
    """FastAPI app avec override get_session."""
    from main import app
    from db.database import get_session

    async def override_session():
        return mock_session

    app.dependency_overrides[get_session] = override_session
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def authenticated_expert_client(app, fake_redis_in_cache):
    from auth.dependencies import get_current_user

    async def override_user():
        return _make_mock_user(plan="expert", uid=1)

    app.dependency_overrides[get_current_user] = override_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def authenticated_pro_client(app, fake_redis_in_cache):
    """Pro user — devrait être bloqué (403)."""
    from auth.dependencies import get_current_user

    async def override_user():
        return _make_mock_user(plan="pro", uid=2)

    app.dependency_overrides[get_current_user] = override_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def authenticated_free_client(app, fake_redis_in_cache):
    from auth.dependencies import get_current_user

    async def override_user():
        return _make_mock_user(plan="free", uid=3)

    app.dependency_overrides[get_current_user] = override_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def unauthenticated_client(app, fake_redis_in_cache):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# --- GET /api/tutor/concepts ---


@pytest.mark.asyncio
async def test_list_concepts_free_user_403(authenticated_free_client):
    resp = await authenticated_free_client.get("/api/tutor/concepts")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_concepts_pro_user_403(authenticated_pro_client):
    resp = await authenticated_pro_client.get("/api/tutor/concepts")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_concepts_unauthenticated_401(unauthenticated_client):
    resp = await unauthenticated_client.get("/api/tutor/concepts")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_concepts_expert_empty(authenticated_expert_client, monkeypatch):
    """Expert user, 0 concepts → response avec listes vides."""

    async def fake_collect(user_id, db, limit=20):
        return []

    monkeypatch.setattr("tutor.concepts_router.collect_user_concepts", fake_collect)
    resp = await authenticated_expert_client.get("/api/tutor/concepts")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["concepts"] == []
    assert data["total"] == 0
    assert data["ready_count"] == 0
    assert data["pending_count"] == 0


@pytest.mark.asyncio
async def test_list_concepts_expert_with_mocked_concepts(
    authenticated_expert_client, monkeypatch
):
    """Expert user, 3 concepts (1 ready, 1 pending, 1 missing) → response cohérente."""
    from images.keyword_images import _term_hash

    fake_concepts = [
        {"term": "Alpha", "term_hash": _term_hash("Alpha", style="tutor_doodle"), "category": "concept"},
        {"term": "Beta", "term_hash": _term_hash("Beta", style="tutor_doodle"), "category": "concept"},
        {"term": "Gamma", "term_hash": _term_hash("Gamma", style="tutor_doodle"), "category": "concept"},
    ]

    async def fake_collect(user_id, db, limit=20):
        # Copie défensive
        return [dict(c) for c in fake_concepts]

    async def fake_attach(concepts):
        # Alpha ready, Beta+Gamma missing
        for c in concepts:
            if c["term"] == "Alpha":
                c["image_url"] = "https://r2.example/alpha.webp"
                c["status"] = "ready"
            else:
                c["image_url"] = None
                c["status"] = "missing"
        return concepts

    async def fake_pending(concepts):
        # Beta becomes pending, Gamma stays missing
        for c in concepts:
            if c["term"] == "Beta":
                c["status"] = "pending"
        return concepts

    monkeypatch.setattr("tutor.concepts_router.collect_user_concepts", fake_collect)
    monkeypatch.setattr("tutor.concepts_router.attach_image_urls", fake_attach)
    monkeypatch.setattr("tutor.concepts_router.check_lookup_pending", fake_pending)

    resp = await authenticated_expert_client.get("/api/tutor/concepts")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] == 3
    assert data["ready_count"] == 1
    assert data["pending_count"] == 2  # Beta(pending) + Gamma(missing)
    statuses = {c["term"]: c["status"] for c in data["concepts"]}
    assert statuses == {"Alpha": "ready", "Beta": "pending", "Gamma": "missing"}


@pytest.mark.asyncio
async def test_list_concepts_admin_bypass(app, fake_redis_in_cache, monkeypatch):
    """Admin avec plan=free passe le gating."""
    from auth.dependencies import get_current_user

    async def override_user():
        return _make_mock_user(plan="free", uid=99, is_admin=True)

    app.dependency_overrides[get_current_user] = override_user

    async def fake_collect(user_id, db, limit=20):
        return []

    monkeypatch.setattr("tutor.concepts_router.collect_user_concepts", fake_collect)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/api/tutor/concepts")
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_list_concepts_limit_clamped(authenticated_expert_client, monkeypatch):
    """limit=1000 doit être clampé à 50 max."""
    captured = {}

    async def fake_collect(user_id, db, limit=20):
        captured["limit"] = limit
        return []

    monkeypatch.setattr("tutor.concepts_router.collect_user_concepts", fake_collect)
    resp = await authenticated_expert_client.get("/api/tutor/concepts?limit=1000")
    assert resp.status_code == 200
    assert captured["limit"] == 50

    # limit=0 → clamp à 1
    resp = await authenticated_expert_client.get("/api/tutor/concepts?limit=0")
    assert resp.status_code == 200
    assert captured["limit"] == 1


# --- POST /api/tutor/concepts/generate ---


@pytest.mark.asyncio
async def test_generate_concept_idempotent_when_ready(
    authenticated_expert_client, monkeypatch
):
    """Si get_doodle_url retourne déjà une URL → status='ready' sans consommer cap."""

    async def fake_get_url(term, pool=None):
        return "https://r2.example/term.webp"

    monkeypatch.setattr("tutor.concepts_router.get_doodle_url", fake_get_url)

    resp = await authenticated_expert_client.post(
        "/api/tutor/concepts/generate",
        json={"term": "MyTerm", "definition": "", "category": None},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "ready"
    assert data["image_url"] == "https://r2.example/term.webp"


@pytest.mark.asyncio
async def test_generate_concept_pending_path(authenticated_expert_client, monkeypatch):
    """Doodle pas en cache → status='pending' + cap décrémenté."""

    async def fake_get_url(term, pool=None):
        return None

    monkeypatch.setattr("tutor.concepts_router.get_doodle_url", fake_get_url)

    # Évite l'appel réel à generate_doodle_image dans la task
    async def fake_gen(term, definition, category=None, pool=None):
        return None

    monkeypatch.setattr("tutor.concepts_router.generate_doodle_image", fake_gen)

    resp = await authenticated_expert_client.post(
        "/api/tutor/concepts/generate",
        json={"term": "NewTerm"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "pending"
    assert data["image_url"] is None
    assert data["cap_remaining"] >= 0


@pytest.mark.asyncio
async def test_generate_concept_throttled(authenticated_expert_client, monkeypatch):
    """Si cap atteint → status='throttled', cap_remaining=0."""

    async def fake_get_url(term, pool=None):
        return None

    monkeypatch.setattr("tutor.concepts_router.get_doodle_url", fake_get_url)

    async def fake_consume(n=1):
        return False, 0

    monkeypatch.setattr("tutor.concepts_router.consume_daily_cap", fake_consume)

    resp = await authenticated_expert_client.post(
        "/api/tutor/concepts/generate",
        json={"term": "X"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "throttled"
    assert data["image_url"] is None
    assert data["cap_remaining"] == 0


@pytest.mark.asyncio
async def test_generate_concept_free_user_403(authenticated_free_client):
    resp = await authenticated_free_client.post(
        "/api/tutor/concepts/generate", json={"term": "X"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_generate_concept_validation_empty_term(authenticated_expert_client):
    """term="" → 422 (Pydantic validation)."""
    resp = await authenticated_expert_client.post(
        "/api/tutor/concepts/generate", json={"term": ""}
    )
    assert resp.status_code == 422


# --- POST /api/tutor/concepts/refresh ---


@pytest.mark.asyncio
async def test_refresh_concepts_expert(authenticated_expert_client):
    resp = await authenticated_expert_client.post("/api/tutor/concepts/refresh")
    assert resp.status_code == 200
    assert resp.json() == {"refreshed": True}


@pytest.mark.asyncio
async def test_refresh_concepts_free_403(authenticated_free_client):
    resp = await authenticated_free_client.post("/api/tutor/concepts/refresh")
    assert resp.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════════
# enqueue_top_concepts_doodles (post-analyse hook)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_enqueue_top_concepts_no_gemini_returns_zero(monkeypatch):
    """is_gemini_available()=False → 0 doodles enqueue."""
    monkeypatch.setattr("tutor.concepts_service.is_gemini_available", lambda: False)
    from tutor.concepts_service import enqueue_top_concepts_doodles

    n = await enqueue_top_concepts_doodles(summary_id=1, user_id=1, top_n=3)
    assert n == 0


@pytest.mark.asyncio
async def test_enqueue_top_concepts_picks_top_n(monkeypatch, fake_redis_in_cache):
    """Avec 5 concepts disponibles, top_n=2 → 2 doodles enqueue."""
    monkeypatch.setattr("tutor.concepts_service.is_gemini_available", lambda: True)

    # Mock async_session_maker -> retourne un fake context manager
    class FakeDB:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def execute(self, stmt):
            exec_result = MagicMock()
            exec_result.first.return_value = (
                "## C1\n## C2\n## C3\n## C4\n## C5\n",
                None,
            )
            return exec_result

    monkeypatch.setattr("db.database.async_session_maker", lambda: FakeDB())

    # Mock le pool DB (recherche existence) → aucun concept déjà existant
    class FakePool:
        async def acquire(self):
            return FakeConn()

    class FakeConn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def fetch(self, query, *args):
            return []

    pool = MagicMock()

    async def fake_acquire():
        return FakeConn()

    pool.acquire = lambda: _AsyncContextManager(FakeConn())

    class _AsyncContextManager:
        def __init__(self, inner):
            self.inner = inner

        async def __aenter__(self):
            return self.inner

        async def __aexit__(self, *args):
            return None

    async def fake_get_pool():
        return pool

    monkeypatch.setattr("tutor.concepts_service._get_image_pool", fake_get_pool)

    # Mock generate_doodle_image pour ne pas réellement appeler Gemini
    async def fake_gen(term, definition, category=None, pool=None):
        return None

    monkeypatch.setattr("tutor.concepts_service.generate_doodle_image", fake_gen)

    from tutor.concepts_service import enqueue_top_concepts_doodles

    n = await enqueue_top_concepts_doodles(summary_id=42, user_id=1, top_n=2)
    assert n == 2


@pytest.mark.asyncio
async def test_enqueue_top_concepts_skips_existing(monkeypatch, fake_redis_in_cache):
    """Si tous les hashes sont déjà existants → 0 enqueue."""
    import hashlib

    monkeypatch.setattr("tutor.concepts_service.is_gemini_available", lambda: True)

    class FakeDB:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def execute(self, stmt):
            r = MagicMock()
            r.first.return_value = ("## OnlyConcept\n", None)
            return r

    monkeypatch.setattr("db.database.async_session_maker", lambda: FakeDB())

    # Hash existant simulé
    existing_hash = hashlib.sha256("tutor_doodle:onlyconcept".encode()).hexdigest()

    class FakeConn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def fetch(self, query, *args):
            return [{"term_hash": existing_hash}]

    class _Cm:
        def __init__(self, inner):
            self.inner = inner

        async def __aenter__(self):
            return self.inner

        async def __aexit__(self, *args):
            return None

    pool = MagicMock()
    pool.acquire = lambda: _Cm(FakeConn())

    async def fake_get_pool():
        return pool

    monkeypatch.setattr("tutor.concepts_service._get_image_pool", fake_get_pool)

    async def fake_gen(*args, **kwargs):
        return None

    monkeypatch.setattr("tutor.concepts_service.generate_doodle_image", fake_gen)

    from tutor.concepts_service import enqueue_top_concepts_doodles

    n = await enqueue_top_concepts_doodles(summary_id=42, user_id=1, top_n=3)
    assert n == 0
