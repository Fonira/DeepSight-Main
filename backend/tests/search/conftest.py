# backend/tests/search/conftest.py
"""Fixtures partagées pour les tests search/."""

from unittest.mock import MagicMock

import pytest


@pytest.fixture
def fake_embedding_1024() -> list[float]:
    """Embedding factice de 1024 floats normalisés."""
    return [0.001 * (i + 1) for i in range(1024)]


@pytest.fixture
def fake_embedding_other_1024() -> list[float]:
    """Second embedding factice (différent du premier) pour tester cosine != 1.0."""
    return [0.002 * (i + 1) for i in range(1024)]


@pytest.fixture
def mock_mistral_embed_response(fake_embedding_1024):
    """Mock de la réponse JSON de POST /v1/embeddings."""
    return {
        "data": [{"embedding": fake_embedding_1024, "index": 0}],
        "model": "mistral-embed",
        "usage": {"prompt_tokens": 10, "total_tokens": 10},
    }


@pytest.fixture
def mock_mistral_embed_batch_response(fake_embedding_1024, fake_embedding_other_1024):
    """Mock de la réponse JSON pour un batch de 2 embeddings."""
    return {
        "data": [
            {"embedding": fake_embedding_1024, "index": 0},
            {"embedding": fake_embedding_other_1024, "index": 1},
        ],
        "model": "mistral-embed",
        "usage": {"prompt_tokens": 20, "total_tokens": 20},
    }


@pytest.fixture
def patch_httpx_post(monkeypatch, mock_mistral_embed_response):
    """Patche httpx.AsyncClient.post pour retourner un embedding factice."""
    mock_response = MagicMock()
    mock_response.json = MagicMock(return_value=mock_mistral_embed_response)
    mock_response.raise_for_status = MagicMock()
    mock_response.status_code = 200

    async def mock_post(*_args, **_kwargs):
        return mock_response

    import httpx

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr("search.embedding_service.MISTRAL_API_KEY", "sk-test-fake")
    return mock_post
