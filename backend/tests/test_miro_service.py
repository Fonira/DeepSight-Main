"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST MIRO SERVICE — Génération board Miro pour débat v2 (Wave 3 F)            ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Couverture :

  1. miro_service.generate_debate_board :
     - Erreur si MIRO_API_TOKEN absent (MiroServiceError).
     - Séquence d'appels Miro API mockée : POST /boards → POST sticky_notes (×N) → GET /boards/{id}
     - Retourne {board_id, view_link} structuré.
     - Helpers _truncate, _parse_json_field, _color_for_perspective.

  2. Endpoint POST /api/debate/{id}/generate-miro-board :
     - 200 OK avec mock service (ok_path).
     - 200 OK + cached=True quand miro_board_url déjà persisté (idempotence).
     - 403 si user.plan = 'free'.
     - 404 si debate not found.
     - 503 si MIRO_API_TOKEN absent.
     - 502 si Miro upstream error.
"""

import json
import os
import sys
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

# ── Env defaults pour import safety ──────────────────────────────────────────
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from httpx import AsyncClient, ASGITransport  # noqa: E402


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIXTURES — DB SQLite + User Pro + Debate completed
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def db_session():
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
async def pro_user(db_session):
    from db.database import User

    user = User(
        username="miro_pro_user",
        email="miro_pro@example.com",
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
    from db.database import User

    user = User(
        username="miro_free_user",
        email="miro_free@example.com",
        password_hash="hashed_pw",
        plan="free",
        credits=100,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def completed_debate(db_session, pro_user):
    """Debate completed avec une perspective B + 2 convergences + 2 divergences."""
    from db.database import DebateAnalysis, DebatePerspective

    debate = DebateAnalysis(
        user_id=pro_user.id,
        video_a_id="vidA00000ID",
        video_b_id="vidB00000ID",
        video_a_title="Vidéo A — pour le télétravail",
        video_b_title="Vidéo B — contre le télétravail",
        video_a_channel="Channel A",
        video_b_channel="Channel B",
        thesis_a="Le télétravail améliore la productivité",
        thesis_b="Le télétravail isole les employés",
        arguments_a=json.dumps(
            [{"claim": "A1", "evidence": "Étude Stanford 2023", "strength": "strong"}]
        ),
        arguments_b=json.dumps(
            [{"claim": "B1", "evidence": "Étude MIT 2024", "strength": "moderate"}]
        ),
        convergence_points=json.dumps(
            [
                {"description": "Les deux reconnaissent l'importance des outils"},
                "L'organisation reste critique",
            ]
        ),
        divergence_points=json.dumps(
            [
                {
                    "topic": "Productivité",
                    "position_a": "Hausse",
                    "position_b": "Baisse",
                },
                {
                    "topic": "Bien-être",
                    "position_a": "Mieux",
                    "position_b": "Pire",
                },
            ]
        ),
        detected_topic="Le télétravail",
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

    persp = DebatePerspective(
        debate_id=debate.id,
        position=0,
        video_id="vidB00000ID",
        platform="youtube",
        video_title="Vidéo B — contre",
        video_channel="Channel B",
        thesis="Le télétravail isole",
        arguments=json.dumps([{"claim": "B1"}]),
        relation_type="opposite",
    )
    db_session.add(persp)
    await db_session.commit()
    await db_session.refresh(debate)
    return debate


# ═══════════════════════════════════════════════════════════════════════════════
# 1. ✅ TESTS UNITAIRES — miro_service helpers
# ═══════════════════════════════════════════════════════════════════════════════


def test_truncate_short_text_unchanged():
    from debate.miro_service import _truncate

    assert _truncate("Hello", 100) == "Hello"


def test_truncate_long_text_ellipsis():
    from debate.miro_service import _truncate

    text = "a" * 500
    out = _truncate(text, 100)
    assert len(out) == 100
    assert out.endswith("…")


def test_truncate_none_returns_empty():
    from debate.miro_service import _truncate

    assert _truncate(None) == ""
    assert _truncate("") == ""


def test_color_for_perspective():
    from debate.miro_service import (
        COLOR_PERSPECTIVE_COMPLEMENT,
        COLOR_PERSPECTIVE_NUANCE,
        COLOR_PERSPECTIVE_OPPOSITE,
        _color_for_perspective,
    )

    assert _color_for_perspective("opposite") == COLOR_PERSPECTIVE_OPPOSITE
    assert _color_for_perspective("complement") == COLOR_PERSPECTIVE_COMPLEMENT
    assert _color_for_perspective("nuance") == COLOR_PERSPECTIVE_NUANCE
    assert _color_for_perspective("unknown_value") == COLOR_PERSPECTIVE_OPPOSITE


def test_parse_json_field_list_passthrough():
    from debate.miro_service import _parse_json_field

    assert _parse_json_field([1, 2, 3]) == [1, 2, 3]


def test_parse_json_field_str_to_list():
    from debate.miro_service import _parse_json_field

    assert _parse_json_field('[{"a":1}]') == [{"a": 1}]


def test_parse_json_field_invalid_returns_empty():
    from debate.miro_service import _parse_json_field

    assert _parse_json_field("not json") == []
    assert _parse_json_field(None) == []
    assert _parse_json_field("") == []
    assert _parse_json_field('{"not":"a list"}') == []


# ═══════════════════════════════════════════════════════════════════════════════
# 2. ✅ TESTS — generate_debate_board (mock httpx)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_generate_board_raises_when_no_token(db_session, completed_debate):
    """Sans MIRO_API_TOKEN → MiroServiceError."""
    from debate.miro_service import (
        MiroServiceError,
        generate_debate_board,
    )

    with patch("debate.miro_service._get_miro_token", return_value=None):
        with pytest.raises(MiroServiceError, match="MIRO_API_TOKEN"):
            await generate_debate_board(
                debate=completed_debate,
                perspectives=[],
                convergence_points=[],
                divergence_points=[],
            )


@pytest.mark.asyncio
async def test_generate_board_calls_miro_api_correctly(db_session, completed_debate):
    """Mock httpx, vérifier la séquence d'appels."""
    from db.database import DebatePerspective
    from debate.miro_service import generate_debate_board
    from sqlalchemy import select

    # Load perspectives explicitly (async, eager) — relationship lazy-load not safe here.
    res = await db_session.execute(
        select(DebatePerspective).where(
            DebatePerspective.debate_id == completed_debate.id
        )
    )
    perspectives = list(res.scalars().all())

    # Mock httpx.AsyncClient — on capture toutes les requêtes
    captured_calls = []

    class MockResponse:
        def __init__(self, status_code, json_data):
            self.status_code = status_code
            self._json = json_data
            self.text = json.dumps(json_data)

        def json(self):
            return self._json

    mock_board_id = "BOARD_ABC123"
    mock_view_link = f"https://miro.com/app/board/{mock_board_id}/view"

    async def mock_post(self, url, json=None, headers=None):
        captured_calls.append(("POST", url, json))
        if "/boards" in url and "/sticky_notes" not in url:
            # Create board
            return MockResponse(
                201,
                {
                    "id": mock_board_id,
                    "viewLink": mock_view_link,
                    "name": json.get("name") if json else "",
                },
            )
        elif "/sticky_notes" in url:
            # Sticky note creation
            return MockResponse(201, {"id": f"NOTE_{len(captured_calls)}"})
        return MockResponse(200, {})

    async def mock_get(self, url, headers=None):
        captured_calls.append(("GET", url, None))
        if f"/boards/{mock_board_id}" in url:
            return MockResponse(
                200,
                {"id": mock_board_id, "viewLink": mock_view_link},
            )
        return MockResponse(200, {})

    with patch("debate.miro_service._get_miro_token", return_value="fake-token"):
        with patch("httpx.AsyncClient.post", new=mock_post):
            with patch("httpx.AsyncClient.get", new=mock_get):
                result = await generate_debate_board(
                    debate=completed_debate,
                    perspectives=perspectives,
                    convergence_points=[
                        {"description": "Convergence 1"},
                        "Convergence 2 (str)",
                    ],
                    divergence_points=[
                        {"topic": "Topic X", "position_a": "A", "position_b": "B"},
                    ],
                )

    # ─── Asserts retour ───
    assert result["board_id"] == mock_board_id
    assert result["view_link"] == mock_view_link

    # ─── Asserts séquence d'appels ───
    methods = [c[0] for c in captured_calls]
    urls = [c[1] for c in captured_calls]

    # 1er appel = POST /boards (création)
    assert methods[0] == "POST"
    assert "/boards" in urls[0]
    assert "/sticky_notes" not in urls[0]

    # Création board avec name = "Débat IA — {topic}"
    create_body = captured_calls[0][2]
    assert create_body is not None
    assert "Débat IA" in create_body.get("name", "")
    assert "Le télétravail" in create_body.get("name", "")
    assert create_body["policy"]["sharingPolicy"]["access"] == "view"

    # Au moins 1 sticky note pour vidéo A + 1 pour la perspective + 2 conv + 1 div = 5 min
    sticky_calls = [
        c for c in captured_calls if c[0] == "POST" and "/sticky_notes" in c[1]
    ]
    assert len(sticky_calls) >= 4, (
        f"Expected at least 4 sticky notes, got {len(sticky_calls)}"
    )

    # Dernier appel = GET /boards/{id}
    assert methods[-1] == "GET"
    assert mock_board_id in urls[-1]


@pytest.mark.asyncio
async def test_generate_board_handles_miro_400_error(db_session, completed_debate):
    """Si Miro renvoie 400, MiroServiceError est levée."""
    from debate.miro_service import (
        MiroServiceError,
        generate_debate_board,
    )

    class MockResponse:
        def __init__(self):
            self.status_code = 400
            self.text = '{"error":"bad request"}'

        def json(self):
            return {"error": "bad request"}

    async def mock_post(self, url, json=None, headers=None):
        return MockResponse()

    with patch("debate.miro_service._get_miro_token", return_value="fake-token"):
        with patch("httpx.AsyncClient.post", new=mock_post):
            with pytest.raises(MiroServiceError, match="400"):
                await generate_debate_board(
                    debate=completed_debate,
                    perspectives=[],
                    convergence_points=[],
                    divergence_points=[],
                )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. ✅ TESTS ENDPOINT POST /api/debate/{id}/generate-miro-board
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def app_with_pro_user(db_session, pro_user):
    """FastAPI app avec dependency_overrides pour Pro user."""
    from auth.dependencies import (
        get_current_user,
        get_verified_user,
    )
    from db.database import get_session
    from main import app

    async def override_session():
        return db_session

    async def override_user():
        return pro_user

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_verified_user] = override_user
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_pro(app_with_pro_user):
    async with AsyncClient(
        transport=ASGITransport(app=app_with_pro_user), base_url="http://test"
    ) as c:
        yield c


@pytest.mark.asyncio
async def test_endpoint_200_ok_with_mocked_service(
    client_pro, completed_debate, db_session
):
    """200 OK avec service mocké."""
    from db.database import DebateAnalysis
    from sqlalchemy import select

    fake_result = {
        "board_id": "BOARD_OK_123",
        "view_link": "https://miro.com/app/board/BOARD_OK_123/view",
    }

    with patch(
        "debate.miro_service.generate_debate_board",
        new=AsyncMock(return_value=fake_result),
    ):
        resp = await client_pro.post(
            f"/api/debate/{completed_debate.id}/generate-miro-board"
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["miro_board_id"] == "BOARD_OK_123"
    assert body["miro_board_url"] == fake_result["view_link"]
    assert body["cached"] is False

    # Vérifier persistence
    res = await db_session.execute(
        select(DebateAnalysis).where(DebateAnalysis.id == completed_debate.id)
    )
    refreshed = res.scalar_one()
    assert refreshed.miro_board_id == "BOARD_OK_123"
    assert refreshed.miro_board_url == fake_result["view_link"]


@pytest.mark.asyncio
async def test_endpoint_returns_cached_when_already_generated(
    client_pro, completed_debate, db_session
):
    """Si miro_board_url déjà set → cached=True, pas d'appel service."""
    completed_debate.miro_board_url = "https://miro.com/app/board/CACHED/view"
    completed_debate.miro_board_id = "CACHED"
    db_session.add(completed_debate)
    await db_session.commit()

    mock_service = AsyncMock()
    with patch("debate.miro_service.generate_debate_board", new=mock_service):
        resp = await client_pro.post(
            f"/api/debate/{completed_debate.id}/generate-miro-board"
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["cached"] is True
    assert body["miro_board_id"] == "CACHED"
    # Le service n'est pas censé être appelé
    mock_service.assert_not_called()


@pytest.mark.asyncio
async def test_endpoint_403_for_free_plan(
    db_session, completed_debate, app_with_pro_user, free_user
):
    """user.plan='free' → 403 plan_required."""
    from auth.dependencies import get_current_user, get_verified_user

    completed_debate.user_id = free_user.id
    await db_session.commit()

    async def override_free():
        return free_user

    app_with_pro_user.dependency_overrides[get_current_user] = override_free
    app_with_pro_user.dependency_overrides[get_verified_user] = override_free

    async with AsyncClient(
        transport=ASGITransport(app=app_with_pro_user), base_url="http://test"
    ) as c:
        resp = await c.post(
            f"/api/debate/{completed_debate.id}/generate-miro-board"
        )

    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "plan_required"


@pytest.mark.asyncio
async def test_endpoint_404_when_not_found(client_pro):
    """Debate inexistant → 404."""
    resp = await client_pro.post("/api/debate/9999999/generate-miro-board")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_endpoint_503_when_token_missing(client_pro, completed_debate):
    """MIRO_API_TOKEN absent → 503 miro_not_configured."""
    from debate.miro_service import MiroServiceError

    with patch(
        "debate.miro_service.generate_debate_board",
        new=AsyncMock(side_effect=MiroServiceError("MIRO_API_TOKEN not configured")),
    ):
        resp = await client_pro.post(
            f"/api/debate/{completed_debate.id}/generate-miro-board"
        )

    assert resp.status_code == 503
    assert resp.json()["detail"]["code"] == "miro_not_configured"


@pytest.mark.asyncio
async def test_endpoint_502_on_upstream_failure(client_pro, completed_debate):
    """Miro upstream fail (réseau / 5xx) → 502 miro_upstream_error."""
    from debate.miro_service import MiroServiceError

    with patch(
        "debate.miro_service.generate_debate_board",
        new=AsyncMock(
            side_effect=MiroServiceError("Miro API error 500 on POST /boards: ...")
        ),
    ):
        resp = await client_pro.post(
            f"/api/debate/{completed_debate.id}/generate-miro-board"
        )

    assert resp.status_code == 502
    assert resp.json()["detail"]["code"] == "miro_upstream_error"
