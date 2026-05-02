"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🛡️ TEST MODERATION SERVICE — Phase 2 Mistral-First Migration                     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Tests TDD du service de modération basé sur mistral-moderation-latest.            ║
║                                                                                    ║
║  Couverture:                                                                       ║
║  • Texte safe (tous scores 0)         → allowed=True                              ║
║  • Texte unsafe en mode enforce       → allowed=False + flagged_categories        ║
║  • Texte unsafe en mode log_only      → allowed=True + flagged_categories logged  ║
║  • Modération désactivée              → pas d'appel HTTP                          ║
║  • Erreur API Mistral                 → fail open (allowed=True)                  ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import importlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Configuration env minimale pour pouvoir importer config + service
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS — Réponses Mistral mockées
# ═══════════════════════════════════════════════════════════════════════════════

# Réponse Mistral pour un texte safe (tous scores ~0)
SAFE_MISTRAL_RESPONSE = {
    "id": "mod-test-safe",
    "model": "mistral-moderation-latest",
    "results": [
        {
            "categories": {
                "sexual": False,
                "hate_and_discrimination": False,
                "violence_and_threats": False,
                "dangerous_and_criminal_content": False,
                "selfharm": False,
                "health": False,
                "financial": False,
                "law": False,
                "pii": False,
            },
            "category_scores": {
                "sexual": 0.001,
                "hate_and_discrimination": 0.002,
                "violence_and_threats": 0.001,
                "dangerous_and_criminal_content": 0.001,
                "selfharm": 0.001,
                "health": 0.001,
                "financial": 0.001,
                "law": 0.001,
                "pii": 0.001,
            },
        }
    ],
}

# Réponse Mistral pour un texte unsafe (hate=0.95)
UNSAFE_HATE_MISTRAL_RESPONSE = {
    "id": "mod-test-unsafe",
    "model": "mistral-moderation-latest",
    "results": [
        {
            "categories": {
                "sexual": False,
                "hate_and_discrimination": True,
                "violence_and_threats": False,
                "dangerous_and_criminal_content": False,
                "selfharm": False,
                "health": False,
                "financial": False,
                "law": False,
                "pii": False,
            },
            "category_scores": {
                "sexual": 0.01,
                "hate_and_discrimination": 0.95,
                "violence_and_threats": 0.05,
                "dangerous_and_criminal_content": 0.02,
                "selfharm": 0.01,
                "health": 0.01,
                "financial": 0.01,
                "law": 0.01,
                "pii": 0.01,
            },
        }
    ],
}


def _fresh_module():
    """Recharge le module pour appliquer les patches de config."""
    if 'core.moderation_service' in sys.modules:
        importlib.reload(sys.modules['core.moderation_service'])
    return importlib.import_module('core.moderation_service')


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 1 — Texte safe passe toujours
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_moderate_text_safe_passes():
    """Mistral renvoie tous scores ~0 → result.allowed is True."""
    mod = _fresh_module()

    with patch.object(mod, '_call_mistral', AsyncMock(return_value=SAFE_MISTRAL_RESPONSE)):
        with patch.object(mod, 'MODERATION_ENABLED', True):
            with patch.object(mod, 'MODERATION_MODE', 'enforce'):
                result = await mod.moderate_text("Bonjour, peux-tu m'expliquer cette vidéo ?")

    assert result.allowed is True
    assert result.flagged_categories == []
    assert isinstance(result.raw_scores, dict)


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 2 — Texte unsafe BLOQUÉ en mode enforce
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_moderate_text_unsafe_blocks_in_enforce_mode():
    """Mistral renvoie hate=0.95 → en mode enforce, allowed=False."""
    mod = _fresh_module()

    with patch.object(mod, '_call_mistral', AsyncMock(return_value=UNSAFE_HATE_MISTRAL_RESPONSE)):
        with patch.object(mod, 'MODERATION_ENABLED', True):
            with patch.object(mod, 'MODERATION_MODE', 'enforce'):
                result = await mod.moderate_text("[texte haineux mocké]")

    assert result.allowed is False
    assert "hate" in result.flagged_categories or "hate_and_discrimination" in result.flagged_categories
    assert len(result.flagged_categories) >= 1


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 3 — Mode log_only laisse passer même si flagged
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_moderate_text_unsafe_passes_in_log_only_mode():
    """Même input flagged, mode log_only → allowed=True mais flagged_categories rempli."""
    mod = _fresh_module()

    with patch.object(mod, '_call_mistral', AsyncMock(return_value=UNSAFE_HATE_MISTRAL_RESPONSE)):
        with patch.object(mod, 'MODERATION_ENABLED', True):
            with patch.object(mod, 'MODERATION_MODE', 'log_only'):
                result = await mod.moderate_text("[texte haineux mocké]")

    assert result.allowed is True  # log_only laisse passer
    assert len(result.flagged_categories) >= 1  # mais on log les catégories


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 4 — Modération désactivée → pas d'appel HTTP
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_moderation_disabled_skips_call():
    """MODERATION_ENABLED=False → pas d'appel HTTP, allowed=True direct."""
    mod = _fresh_module()

    fake_call = AsyncMock(return_value=UNSAFE_HATE_MISTRAL_RESPONSE)
    with patch.object(mod, '_call_mistral', fake_call):
        with patch.object(mod, 'MODERATION_ENABLED', False):
            with patch.object(mod, 'MODERATION_MODE', 'enforce'):
                result = await mod.moderate_text("Anything goes")

    assert result.allowed is True
    assert result.flagged_categories == []
    fake_call.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TEST 5 — Fail open : si l'API plante, on laisse passer
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_moderation_fail_open_on_api_error():
    """Mistral throw → allowed=True (fail open) pour ne pas bloquer le service."""
    mod = _fresh_module()

    with patch.object(mod, '_call_mistral', AsyncMock(side_effect=Exception("API timeout"))):
        with patch.object(mod, 'MODERATION_ENABLED', True):
            with patch.object(mod, 'MODERATION_MODE', 'enforce'):
                result = await mod.moderate_text("Question normale")

    assert result.allowed is True  # fail open : un Mistral down ne bloque pas
    assert result.flagged_categories == []
