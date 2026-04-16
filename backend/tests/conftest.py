"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 PYTEST CONFIGURATION — Fixtures et configuration pour les tests               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import MagicMock, AsyncMock

# Ajouter src au path en premier (AVANT tests/) pour éviter que tests/core/ shadow src/core/
_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
_tests_dir = os.path.abspath(os.path.dirname(__file__))
# tests/ en second pour conftest_enhanced etc., mais src/ doit être prioritaire
if _tests_dir in sys.path:
    sys.path.remove(_tests_dir)
if _src_dir in sys.path:
    sys.path.remove(_src_dir)
sys.path.insert(0, _tests_dir)
sys.path.insert(0, _src_dir)

# Charger les fixtures avancées de conftest_enhanced.py
pytest_plugins = ['conftest_enhanced']

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIX MODULE SHADOWING (via pytest session hook)
# Les __init__.py exportent `from .router import router` ce qui fait que
# `auth.router` pointe vers l'objet APIRouter au lieu du module router.py.
# On force les modules router à être accessibles pour que patch() fonctionne.
# Ce hook s'exécute APRÈS le chargement de tous les modules.
# ═══════════════════════════════════════════════════════════════════════════════
import importlib

def pytest_collection_modifyitems(session, config, items):
    """Fix module shadowing after all imports are resolved."""
    for pkg in ('auth', 'videos', 'billing', 'chat', 'playlists', 'tts', 'study'):
        mod_name = f'{pkg}.router'
        if mod_name in sys.modules and not isinstance(sys.modules[mod_name], type(sys)):
            # The module entry is an APIRouter object, not a module
            try:
                actual_mod = importlib.import_module(mod_name)
                sys.modules[mod_name] = actual_mod
            except ImportError:
                pass

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION ASYNCIO
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def event_loop():
    """Crée un event loop pour les tests async."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ FIXTURES BASE DE DONNÉES
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def mock_db_session():
    """Mock de la session de base de données."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def mock_user():
    """Utilisateur mock pour les tests."""
    user = MagicMock()
    user.id = 1
    user.email = "test@example.com"
    user.plan = "pro"
    user.credits = 100
    user.email_verified = True
    user.is_active = True
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# 📺 FIXTURES VIDÉO
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def sample_video_info():
    """Infos vidéo de test."""
    return {
        "video_id": "test123",
        "title": "JEAN-PIERRE PETIT : Le modèle qui va bouleverser votre conception de l'UNIVERS",
        "channel": "Biomécanique",
        "duration": 7200,  # 2 heures
        "description": "Interview avec Jean-Pierre Petit sur la physique et la cosmologie",
        "tags": ["science", "physique", "cosmologie", "univers"],
        "categories": ["Science & Technology"],
        "thumbnail_url": "https://img.youtube.com/vi/test123/mqdefault.jpg"
    }


@pytest.fixture
def sample_transcript():
    """Transcript de test."""
    return """
    Bonjour à tous et bienvenue dans cette nouvelle vidéo. Aujourd'hui nous allons parler 
    de physique et plus particulièrement du modèle cosmologique de Jean-Pierre Petit.
    Ce modèle propose une nouvelle façon de comprendre l'univers et remet en question 
    certaines théories établies. Nous allons voir comment la matière noire et l'énergie 
    noire pourraient être expliquées différemment.
    """


@pytest.fixture
def sample_transcript_with_timestamps():
    """Transcript avec vrais timestamps."""
    return """
    [00:00] Bonjour à tous et bienvenue dans cette nouvelle vidéo.
    [00:30] Aujourd'hui nous allons parler de physique et plus particulièrement du modèle cosmologique.
    [01:15] Ce modèle propose une nouvelle façon de comprendre l'univers.
    [02:00] Nous allons voir comment la matière noire et l'énergie noire pourraient être expliquées.
    [03:30] Jean-Pierre Petit a développé ce modèle sur plusieurs décennies.
    [05:00] Les implications sont considérables pour notre compréhension de l'univers.
    """


@pytest.fixture
def sample_geopolitics_video():
    """Vidéo géopolitique de test."""
    return {
        "video_id": "geo123",
        "title": "Ukraine : Les BRICS défient l'Occident",
        "channel": "Géopolitique Profonde",
        "duration": 3600,
        "description": "Analyse des relations internationales entre la Russie, la Chine et les USA",
        "tags": ["géopolitique", "ukraine", "russie", "usa", "brics"],
        "categories": ["News & Politics"],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 FIXTURES AUTH
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def valid_jwt_token():
    """Token JWT valide mock."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxOTk5OTk5OTk5fQ.test"


@pytest.fixture
def expired_jwt_token():
    """Token JWT expiré mock."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxMDAwMDAwMDAwfQ.test"


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 FIXTURES API
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def mock_mistral_response():
    """Réponse mock de l'API Mistral."""
    return {
        "choices": [{
            "message": {
                "content": """# Résumé
                
Cette vidéo présente les théories de Jean-Pierre Petit sur la cosmologie.

## Points Clés

1. **[00:30]** Introduction au modèle cosmologique alternatif
2. **[02:00]** Explication de la matière noire
3. **[05:00]** Implications pour la physique moderne

## Conclusion

Un regard novateur sur notre compréhension de l'univers."""
            }
        }]
    }


@pytest.fixture
def mock_perplexity_response():
    """Réponse mock de l'API Perplexity."""
    return {
        "choices": [{
            "message": {
                "content": "Selon les sources récentes, Jean-Pierre Petit est un astrophysicien français..."
            }
        }]
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def mock_httpx_client():
    """Client HTTPX mock pour les appels API."""
    client = AsyncMock()
    return client


# ═══════════════════════════════════════════════════════════════════════════════
# 📁 CONFIGURATION PYTEST
# ═══════════════════════════════════════════════════════════════════════════════

def pytest_configure(config):
    """Configure pytest avec des markers custom."""
    config.addinivalue_line("markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')")
    config.addinivalue_line("markers", "integration: marks tests requiring external services")
    config.addinivalue_line("markers", "unit: marks unit tests")
