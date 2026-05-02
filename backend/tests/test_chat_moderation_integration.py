"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🛡️ TEST CHAT MODERATION INTEGRATION — Phase 2 Mistral-First                      ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Vérifie que le hook moderation est bien câblé dans /api/chat/ask :                ║
║  • mode log_only : la requête passe (200) malgré flagged                          ║
║  • mode enforce  : la requête retourne 400 avec content_policy_violation          ║
║  • appel moderate_text bien effectué avec le bon texte                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import importlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


@pytest.mark.asyncio
async def test_chat_ask_calls_moderation_hook():
    """Vérifie que moderate_text est appelé avec request.question avant le routing v4."""
    chat_router_mod = importlib.import_module('chat.router')

    # Construire un user mock minimal
    user = MagicMock()
    user.id = 1
    user.plan = "pro"
    user.email_verified = True

    # Construire un session mock
    session = AsyncMock()

    # Construire la request
    request = chat_router_mod.ChatRequest(
        question="Bonjour, peux-tu m'expliquer cette vidéo ?",
        summary_id=42,
        mode="standard",
        use_web_search=False,
    )

    # Mock moderate_text → allowed=True
    fake_result = MagicMock()
    fake_result.allowed = True
    fake_result.flagged_categories = []
    fake_moderate = AsyncMock(return_value=fake_result)

    # Mock process_chat_message_v4 pour court-circuiter le pipeline complet
    fake_process = AsyncMock(return_value={
        "response": "Test response",
        "web_search_used": False,
        "sources": [],
        "enrichment_level": "none",
        "quota_info": {},
    })

    with patch.object(chat_router_mod, 'moderate_text', fake_moderate):
        with patch.object(chat_router_mod, 'V4_AVAILABLE', True):
            with patch.object(chat_router_mod, 'process_chat_message_v4', fake_process):
                response = await chat_router_mod.ask_question_v4(
                    request=request,
                    current_user=user,
                    session=session,
                )

    # moderate_text doit avoir été appelé avec le texte de la question
    fake_moderate.assert_awaited_once()
    call_args = fake_moderate.await_args
    assert call_args.args[0] == "Bonjour, peux-tu m'expliquer cette vidéo ?"

    # Pipeline normal doit avoir tourné
    fake_process.assert_awaited_once()
    assert response.response == "Test response"


@pytest.mark.asyncio
async def test_chat_ask_blocks_when_moderation_denies():
    """Si moderate_text renvoie allowed=False, l'endpoint raise HTTP 400."""
    from fastapi import HTTPException
    chat_router_mod = importlib.import_module('chat.router')

    user = MagicMock()
    user.id = 1
    user.plan = "pro"

    session = AsyncMock()

    request = chat_router_mod.ChatRequest(
        question="[contenu interdit mocké]",
        summary_id=42,
        mode="standard",
        use_web_search=False,
    )

    # Mock moderate_text → allowed=False
    fake_result = MagicMock()
    fake_result.allowed = False
    fake_result.flagged_categories = ["hate"]
    fake_moderate = AsyncMock(return_value=fake_result)

    fake_process = AsyncMock()  # ne doit JAMAIS être appelé

    with patch.object(chat_router_mod, 'moderate_text', fake_moderate):
        with patch.object(chat_router_mod, 'V4_AVAILABLE', True):
            with patch.object(chat_router_mod, 'process_chat_message_v4', fake_process):
                with pytest.raises(HTTPException) as exc_info:
                    await chat_router_mod.ask_question_v4(
                        request=request,
                        current_user=user,
                        session=session,
                    )

    assert exc_info.value.status_code == 400
    detail = exc_info.value.detail
    assert isinstance(detail, dict)
    assert detail["error"] == "content_policy_violation"
    assert detail["categories"] == ["hate"]
    fake_process.assert_not_awaited()
