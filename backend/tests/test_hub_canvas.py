"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST HUB CANVAS SERVICE — pivot 2026-05-06                                     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Tests unitaires pour generate_workspace_canvas + _validate_canvas_shape.          ║
║                                                                                    ║
║  llm_complete est mocké (AsyncMock) pour éviter tout appel Mistral réel.           ║
║  On vérifie : extraction JSON valide, retry sur JSON invalide, retry sur shape     ║
║  invalide, fallback None sur Mistral down, validation summary_ids out-of-range.    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import os
import sys
import pytest
from unittest.mock import AsyncMock, patch

# ── Env defaults pour import safety ───────────────────────────────────────────
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _make_summary(sid: int, title: str = "Vidéo", content: str = "Lorem ipsum"):
    """Stub Summary — uniquement les attributs lus par canvas_service."""
    from db.database import Summary

    return Summary(
        id=sid,
        user_id=1,
        video_id=f"vid{sid}",
        video_title=title,
        video_channel="Test Channel",
        summary_content=content,
        full_digest=f"Digest hierarchique #{sid} — {content}",
    )


def _llm_result(content: str):
    """Stub minimal pour LLMResult."""
    from core.llm_provider import LLMResult

    return LLMResult(
        content=content,
        model_used="mistral-large-2512",
        provider="mistral",
        attempts=1,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# _validate_canvas_shape
# ═══════════════════════════════════════════════════════════════════════════════


def test_validate_canvas_shape_valid_minimal():
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "shared_concepts": ["concept A", "concept B"],
        "themes": [
            {
                "theme": "Thématique X",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "Position 1"},
                    {"summary_id": 2, "excerpt": "Position 2"},
                ],
            }
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    assert out["shared_concepts"] == ["concept A", "concept B"]
    assert len(out["themes"]) == 1
    assert out["themes"][0]["theme"] == "Thématique X"
    assert len(out["themes"][0]["perspectives"]) == 2


def test_validate_canvas_shape_drops_unknown_summary_ids():
    """Un perspective avec summary_id pas dans le workspace est éjecté."""
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "shared_concepts": ["c1"],
        "themes": [
            {
                "theme": "Theme",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "OK"},
                    {"summary_id": 99, "excerpt": "Hors-workspace"},  # rejeté
                    {"summary_id": 2, "excerpt": "OK"},
                ],
            }
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    perspectives = out["themes"][0]["perspectives"]
    assert {p["summary_id"] for p in perspectives} == {1, 2}


def test_validate_canvas_shape_drops_themes_with_less_than_2_perspectives():
    """Un thème avec 1 seule perspective est skip (<2 = no contrast)."""
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "shared_concepts": ["c"],
        "themes": [
            {
                "theme": "Solo",
                "perspectives": [{"summary_id": 1, "excerpt": "Solo"}],
            },
            {
                "theme": "Duo",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "A"},
                    {"summary_id": 2, "excerpt": "B"},
                ],
            },
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    assert [t["theme"] for t in out["themes"]] == ["Duo"]


def test_validate_canvas_shape_dedup_shared_concepts_case_insensitive():
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "shared_concepts": ["IA", "ia", " IA ", "Mistral", "MISTRAL"],
        "themes": [
            {
                "theme": "T",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "A"},
                    {"summary_id": 2, "excerpt": "B"},
                ],
            }
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    # On garde la première occurrence (en lower-case key) → "IA" et "Mistral"
    assert out["shared_concepts"] == ["IA", "Mistral"]


def test_validate_canvas_shape_returns_none_if_empty():
    """Si Mistral retourne shared=[] ET themes=[] → None (no value)."""
    from hub.canvas_service import _validate_canvas_shape

    raw = {"shared_concepts": [], "themes": []}
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is None


def test_validate_canvas_shape_rejects_non_dict_input():
    from hub.canvas_service import _validate_canvas_shape

    assert _validate_canvas_shape("not a dict", {1, 2}) is None
    assert _validate_canvas_shape([], {1, 2}) is None
    assert _validate_canvas_shape(None, {1, 2}) is None


def test_validate_canvas_shape_caps_themes_at_7():
    """v2 : limite dure à 7 thèmes (vs 6 en v1) pour offrir plus de richesse."""
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "shared_concepts": [],
        "themes": [
            {
                "theme": f"T{i}",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "A"},
                    {"summary_id": 2, "excerpt": "B"},
                ],
            }
            for i in range(10)
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    assert len(out["themes"]) == 7


def test_validate_canvas_shape_caps_shared_concepts_at_10():
    """v2 : cap shared_concepts à 10 (vs 8 en v1)."""
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "shared_concepts": [f"concept-{i}" for i in range(15)],
        "themes": [
            {
                "theme": "T",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "A"},
                    {"summary_id": 2, "excerpt": "B"},
                ],
            }
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    assert len(out["shared_concepts"]) == 10


# ═══════════════════════════════════════════════════════════════════════════════
# v2 — synthesis / theme.description / perspective.key_quote (champs optionnels)
# ═══════════════════════════════════════════════════════════════════════════════


def test_validate_canvas_shape_v2_extracts_synthesis_when_present():
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "synthesis": "  Overview transversal en plusieurs phrases.  ",
        "shared_concepts": ["c"],
        "themes": [
            {
                "theme": "T",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "A"},
                    {"summary_id": 2, "excerpt": "B"},
                ],
            }
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    assert out["synthesis"] == "Overview transversal en plusieurs phrases."


def test_validate_canvas_shape_v2_omits_synthesis_when_invalid():
    """Synthesis vide / non-str → champ omis (pas d'erreur)."""
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "synthesis": "",
        "shared_concepts": ["c"],
        "themes": [
            {
                "theme": "T",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "A"},
                    {"summary_id": 2, "excerpt": "B"},
                ],
            }
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    assert "synthesis" not in out


def test_validate_canvas_shape_v2_extracts_theme_description():
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "shared_concepts": ["c"],
        "themes": [
            {
                "theme": "T",
                "description": "  Pose l'enjeu en 1 phrase.  ",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "A"},
                    {"summary_id": 2, "excerpt": "B"},
                ],
            }
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    assert out["themes"][0]["description"] == "Pose l'enjeu en 1 phrase."


def test_validate_canvas_shape_v2_extracts_key_quote_when_present():
    from hub.canvas_service import _validate_canvas_shape

    raw = {
        "shared_concepts": ["c"],
        "themes": [
            {
                "theme": "T",
                "perspectives": [
                    {
                        "summary_id": 1,
                        "excerpt": "Argument complet en plusieurs phrases.",
                        "key_quote": "Citation littérale tirée du contenu.",
                    },
                    {"summary_id": 2, "excerpt": "B sans quote"},
                ],
            }
        ],
    }
    out = _validate_canvas_shape(raw, valid_summary_ids={1, 2})
    assert out is not None
    perspectives = out["themes"][0]["perspectives"]
    assert perspectives[0]["key_quote"] == "Citation littérale tirée du contenu."
    # Perspective sans key_quote → champ omis (pas null)
    assert "key_quote" not in perspectives[1]


def test_validate_canvas_shape_v2_backward_compat_v1_data():
    """Un canvas v1 (sans synthesis/description/key_quote) reste valide."""
    from hub.canvas_service import _validate_canvas_shape

    raw_v1 = {
        "shared_concepts": ["c1", "c2"],
        "themes": [
            {
                "theme": "T1",
                "perspectives": [
                    {"summary_id": 1, "excerpt": "A"},
                    {"summary_id": 2, "excerpt": "B"},
                ],
            }
        ],
    }
    out = _validate_canvas_shape(raw_v1, valid_summary_ids={1, 2})
    assert out is not None
    assert "synthesis" not in out
    assert "description" not in out["themes"][0]
    assert "key_quote" not in out["themes"][0]["perspectives"][0]


# ═══════════════════════════════════════════════════════════════════════════════
# generate_workspace_canvas (Mistral mocked)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_generate_workspace_canvas_happy_path():
    """Mistral renvoie un JSON valide → canvas_data populé."""
    summaries = [_make_summary(1), _make_summary(2)]

    valid_json = json.dumps(
        {
            "shared_concepts": ["IA française", "RGPD"],
            "themes": [
                {
                    "theme": "Confidentialité",
                    "perspectives": [
                        {"summary_id": 1, "excerpt": "Vidéo 1 dit X"},
                        {"summary_id": 2, "excerpt": "Vidéo 2 dit Y"},
                    ],
                }
            ],
        }
    )

    with patch(
        "hub.canvas_service.llm_complete",
        new_callable=AsyncMock,
        return_value=_llm_result(valid_json),
    ):
        from hub.canvas_service import generate_workspace_canvas

        result = await generate_workspace_canvas(summaries, "Mon workspace")

    assert result is not None
    assert result["shared_concepts"] == ["IA française", "RGPD"]
    assert len(result["themes"]) == 1
    assert result["themes"][0]["theme"] == "Confidentialité"


@pytest.mark.asyncio
async def test_generate_workspace_canvas_retries_on_invalid_json():
    """Mistral renvoie JSON invalide en attempt 1, valide en attempt 2."""
    summaries = [_make_summary(1), _make_summary(2)]

    valid_json = json.dumps(
        {
            "shared_concepts": ["c"],
            "themes": [
                {
                    "theme": "T",
                    "perspectives": [
                        {"summary_id": 1, "excerpt": "A"},
                        {"summary_id": 2, "excerpt": "B"},
                    ],
                }
            ],
        }
    )

    mock = AsyncMock(
        side_effect=[
            _llm_result("not json {{{"),
            _llm_result(valid_json),
        ]
    )

    with patch("hub.canvas_service.llm_complete", new=mock):
        from hub.canvas_service import generate_workspace_canvas

        result = await generate_workspace_canvas(summaries, "ws")

    assert result is not None
    assert mock.await_count == 2


@pytest.mark.asyncio
async def test_generate_workspace_canvas_returns_none_on_total_failure():
    """Si Mistral down sur tous les retries → None."""
    summaries = [_make_summary(1), _make_summary(2)]

    with patch(
        "hub.canvas_service.llm_complete",
        new_callable=AsyncMock,
        return_value=None,
    ):
        from hub.canvas_service import generate_workspace_canvas

        result = await generate_workspace_canvas(summaries, "ws")

    assert result is None


@pytest.mark.asyncio
async def test_generate_workspace_canvas_returns_none_if_no_summaries():
    """Aucun summary fourni → None immédiat (no Mistral call)."""
    with patch(
        "hub.canvas_service.llm_complete", new_callable=AsyncMock
    ) as mock:
        from hub.canvas_service import generate_workspace_canvas

        result = await generate_workspace_canvas([], "ws")
        assert result is None
        mock.assert_not_called()


@pytest.mark.asyncio
async def test_generate_workspace_canvas_filters_unknown_summary_ids():
    """Mistral hallucine summary_id=99 hors-workspace → filtré silencieusement."""
    summaries = [_make_summary(1), _make_summary(2)]

    raw_json = json.dumps(
        {
            "shared_concepts": ["c"],
            "themes": [
                {
                    "theme": "T",
                    "perspectives": [
                        {"summary_id": 1, "excerpt": "OK"},
                        {"summary_id": 99, "excerpt": "Hallu"},
                        {"summary_id": 2, "excerpt": "OK"},
                    ],
                }
            ],
        }
    )

    with patch(
        "hub.canvas_service.llm_complete",
        new_callable=AsyncMock,
        return_value=_llm_result(raw_json),
    ):
        from hub.canvas_service import generate_workspace_canvas

        result = await generate_workspace_canvas(summaries, "ws")

    assert result is not None
    perspectives = result["themes"][0]["perspectives"]
    assert {p["summary_id"] for p in perspectives} == {1, 2}
