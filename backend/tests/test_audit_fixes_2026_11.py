"""Régressions corrigées après l'audit du 27/11/2026 (relance VPS netcup).

Chaque test documente un bug observé en production :
- rate limiter désactivé partout par l'exclusion de "/" ;
- Tuteur en 502 (modèle de raisonnement, contenu en blocs, pas de repli 4xx) ;
- export en 500 sur un titre hors Latin-1 ;
- statut d'une tâche figé quand le poll tombe sur un autre worker.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest


# ─── Rate limiter ──────────────────────────────────────────────────────────────


def _middleware(exclude_paths: list[str]):
    from middleware.rate_limiter import RateLimitMiddleware

    return RateLimitMiddleware(app=AsyncMock(), exclude_paths=exclude_paths)


def test_root_exclusion_only_matches_root():
    mw = _middleware(["/", "/health", "/api/health"])

    assert mw._is_excluded("/") is True
    assert mw._is_excluded("/api/auth/login") is False
    assert mw._is_excluded("/api/auth/register") is False


def test_prefix_exclusions_cover_sub_paths_only():
    mw = _middleware(["/api/health", "/docs"])

    assert mw._is_excluded("/api/health") is True
    assert mw._is_excluded("/api/health/deep") is True
    assert mw._is_excluded("/docs/oauth2-redirect") is True
    assert mw._is_excluded("/api/healthcheck-spoof") is False


# ─── LLM provider ──────────────────────────────────────────────────────────────


def test_content_to_text_keeps_only_text_blocks():
    from core.llm_provider import _content_to_text

    content = [
        {"type": "thinking", "thinking": [{"type": "text", "text": "raisonnement interne"}]},
        {"type": "text", "text": "Bonjour, "},
        {"type": "text", "text": "prêt à réviser ?"},
    ]

    assert _content_to_text(content) == "Bonjour, prêt à réviser ?"
    assert _content_to_text("texte simple") == "texte simple"
    assert _content_to_text(None) == ""


def _response(status: int, payload: dict | None = None, text: str = ""):
    return SimpleNamespace(
        status_code=status,
        json=lambda: payload or {},
        text=text or json.dumps(payload or {}),
    )


@pytest.mark.asyncio
async def test_llm_complete_falls_back_on_model_specific_400():
    from core import llm_provider

    ok = _response(200, {"choices": [{"message": {"content": "réponse"}}], "usage": {}})
    calls: list[str] = []

    async def fake_call_api(*, model, **_kwargs):
        calls.append(model)
        return _response(400, text='{"message":"Invalid model"}') if len(calls) == 1 else ok

    with (
        patch.object(llm_provider, "get_mistral_key", return_value="k"),
        patch.object(llm_provider, "get_deepseek_key", return_value=None),
        patch.object(llm_provider, "is_deepseek_available", return_value=False),
        patch.object(llm_provider, "_call_api", side_effect=fake_call_api),
    ):
        result = await llm_provider.llm_complete(
            messages=[{"role": "user", "content": "x"}], model="modele-retire-404"
        )

    assert result is not None
    assert result.content == "réponse"
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_llm_complete_does_not_retry_on_billing_error():
    from core import llm_provider

    calls: list[str] = []

    async def fake_call_api(*, model, **_kwargs):
        calls.append(model)
        return _response(402, text='{"message":"billing"}')

    with (
        patch.object(llm_provider, "get_mistral_key", return_value="k"),
        patch.object(llm_provider, "get_deepseek_key", return_value=None),
        patch.object(llm_provider, "is_deepseek_available", return_value=False),
        patch.object(llm_provider, "_call_api", side_effect=fake_call_api),
    ):
        result = await llm_provider.llm_complete(messages=[{"role": "user", "content": "x"}])

    assert result is None
    assert len(calls) == 1


# ─── Tuteur ────────────────────────────────────────────────────────────────────


def test_tutor_uses_non_reasoning_models():
    from tutor.router import _select_tutor_model

    assert _select_tutor_model("pro") == "mistral-medium-2508"
    assert _select_tutor_model("expert") == "mistral-large-2512"
    assert _select_tutor_model("unlimited") == "mistral-large-2512"
    assert _select_tutor_model(None) == "mistral-medium-2508"
    assert "magistral" not in _select_tutor_model("expert")


# ─── Exports ───────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "filename",
    ["deepsight_Œuvre_et_cœur_20261127", "deepsight_Привет_мир_20261127", "deepsight_日本語_20261127"],
)
def test_content_disposition_is_latin1_safe(filename):
    from exports.service import content_disposition

    header = content_disposition(filename + ".pdf")

    header.encode("latin-1")  # levait UnicodeEncodeError → 500
    assert header.startswith('attachment; filename="')
    assert "filename*=UTF-8''" in header


# ─── Task store multi-worker ───────────────────────────────────────────────────


class _FakeRedis:
    def __init__(self):
        self.data: dict[str, str] = {}

    async def get(self, key):
        return self.data.get(key)


@pytest.mark.asyncio
async def test_task_store_rereads_foreign_tasks_from_redis():
    from core.task_store import TaskStore

    redis = _FakeRedis()
    store = TaskStore()
    await store.init_redis(redis)
    key = f"{TaskStore.PREFIX}t1"

    redis.data[key] = json.dumps({"status": "processing", "progress": 10})
    first = await store.aget("t1")
    assert first["progress"] == 10

    # Le worker propriétaire avance la tâche dans Redis
    redis.data[key] = json.dumps({"status": "completed", "progress": 100})
    second = await store.aget("t1")
    assert second["status"] == "completed"
    assert second["progress"] == 100


@pytest.mark.asyncio
async def test_task_store_owned_tasks_use_local_copy():
    from core.task_store import TaskStore

    redis = _FakeRedis()
    store = TaskStore()
    await store.init_redis(redis)
    store["mine"] = {"status": "processing", "progress": 50}
    redis.data[f"{TaskStore.PREFIX}mine"] = json.dumps({"status": "processing", "progress": 5})

    task = await store.aget("mine")

    assert task["progress"] == 50
