"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 ENHANCED PYTEST FIXTURES — Fixtures avancées pour tests complets               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import pytest
import asyncio
import json
from typing import AsyncGenerator, Dict, Any, Optional
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timedelta
from jose import jwt

# Importer depuis conftest existant
from conftest import (
    mock_db_session,
    mock_user,
    sample_video_info,
    sample_transcript,
    mock_mistral_response,
    mock_perplexity_response,
)

# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 HTTPX CLIENT & FASTAPI APP
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
async def app_client():
    """Client HTTPX asyncio pour les tests FastAPI."""
    try:
        from fastapi import FastAPI
        from httpx import AsyncClient
        from main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            yield client
    except ImportError:
        pytest.skip("FastAPI or httpx not available")


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 REDIS MOCK
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def mock_redis():
    """Mock Redis pour cache et sessions."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    redis.expire = AsyncMock(return_value=True)
    redis.ttl = AsyncMock(return_value=-1)
    redis.incr = AsyncMock(return_value=1)
    redis.lpush = AsyncMock(return_value=1)
    redis.lrange = AsyncMock(return_value=[])
    redis.flushdb = AsyncMock(return_value=True)
    return redis


# ═══════════════════════════════════════════════════════════════════════════════
# 💳 STRIPE MOCKS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def mock_stripe_client():
    """Mock client Stripe."""
    stripe = AsyncMock()

    # Checkout
    stripe.checkout.session.create = AsyncMock(return_value={
        "id": "cs_test_123",
        "url": "https://checkout.stripe.com/test",
        "client_secret": "secret_123",
        "customer": "cus_123",
        "payment_intent": "pi_123",
        "subscription": "sub_123"
    })

    # Subscriptions
    stripe.Subscription.create = AsyncMock(return_value={
        "id": "sub_123",
        "customer": "cus_123",
        "items": {
            "data": [{"price": {"id": "price_123"}}]
        },
        "status": "active",
        "current_period_start": int(datetime.now().timestamp()),
        "current_period_end": int((datetime.now() + timedelta(days=30)).timestamp())
    })

    stripe.Subscription.retrieve = AsyncMock(return_value={
        "id": "sub_123",
        "status": "active",
        "customer": "cus_123"
    })

    stripe.Subscription.modify = AsyncMock(return_value={
        "id": "sub_123",
        "status": "active"
    })

    stripe.Subscription.delete = AsyncMock(return_value={
        "id": "sub_123",
        "deleted": True
    })

    # Customer
    stripe.Customer.create = AsyncMock(return_value={
        "id": "cus_123",
        "email": "test@example.com"
    })

    stripe.Customer.retrieve = AsyncMock(return_value={
        "id": "cus_123",
        "email": "test@example.com"
    })

    # Webhook
    stripe.Webhook.construct_event = MagicMock(return_value={
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "customer": "cus_123",
                "subscription": "sub_123"
            }
        }
    })

    return stripe


# ═══════════════════════════════════════════════════════════════════════════════
# 🏭 FACTORY FUNCTIONS — Créateurs de données de test
# ═══════════════════════════════════════════════════════════════════════════════


def create_test_user(
    user_id: int = 1,
    email: str = "test@example.com",
    username: str = "testuser",
    plan: str = "free",
    credits: int = 150,
    email_verified: bool = True,
    is_admin: bool = False,
    stripe_customer_id: Optional[str] = None,
    stripe_subscription_id: Optional[str] = None,
    google_id: Optional[str] = None,
) -> MagicMock:
    """
    Crée un utilisateur mock complètement configuré.

    Args:
        user_id: ID unique
        email: Adresse email
        username: Nom d'utilisateur
        plan: Plan (free, etudiant, starter, pro, expert)
        credits: Solde de crédits
        email_verified: Email vérifié?
        is_admin: Admin?
        stripe_customer_id: ID Stripe customer
        stripe_subscription_id: ID Stripe subscription

    Returns:
        MagicMock configuré en tant qu'utilisateur
    """
    user = MagicMock()
    user.id = user_id
    user.email = email
    user.username = username
    user.plan = plan
    user.credits = credits
    user.email_verified = email_verified
    user.is_active = True
    user.is_admin = is_admin
    user.stripe_customer_id = stripe_customer_id
    user.stripe_subscription_id = stripe_subscription_id
    user.google_id = google_id
    user.default_lang = "fr"
    user.default_mode = "standard"
    user.created_at = datetime.now()
    user.last_login = datetime.now()
    user.total_videos = 0
    user.total_words = 0
    user.total_playlists = 0
    return user


def create_test_summary(
    summary_id: int = 1,
    user_id: int = 1,
    video_id: str = "test123",
    title: str = "Test Summary",
    content: str = "This is a test summary",
    duration: int = 3600,
    category: str = "science",
    reliability_score: float = 0.85,
) -> Dict[str, Any]:
    """
    Crée un dictionnaire de résumé vidéo pour les tests.

    Args:
        summary_id: ID unique
        user_id: ID utilisateur propriétaire
        video_id: ID YouTube vidéo
        title: Titre du résumé
        content: Contenu du résumé
        duration: Durée vidéo en secondes
        category: Catégorie détectée
        reliability_score: Score de fiabilité (0-1)

    Returns:
        Dictionnaire représentant un résumé
    """
    return {
        "id": summary_id,
        "user_id": user_id,
        "video_id": video_id,
        "title": title,
        "content": content,
        "duration": duration,
        "category": category,
        "reliability_score": reliability_score,
        "is_favorite": False,
        "notes": "",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "source_url": f"https://youtube.com/watch?v={video_id}",
    }


def create_test_chat_message(
    message_id: int = 1,
    summary_id: int = 1,
    role: str = "user",
    content: str = "What are the main topics?",
    has_sources: bool = False,
) -> Dict[str, Any]:
    """
    Crée un message de chat pour les tests.

    Args:
        message_id: ID unique
        summary_id: ID du résumé associé
        role: Rôle (user, assistant)
        content: Contenu du message
        has_sources: Inclure des sources?

    Returns:
        Dictionnaire représentant un message chat
    """
    msg = {
        "id": message_id,
        "summary_id": summary_id,
        "role": role,
        "content": content,
        "created_at": datetime.now().isoformat(),
    }

    if has_sources:
        msg["sources"] = [
            {
                "url": "https://example.com",
                "title": "Example Source",
                "confidence": 0.9
            }
        ]

    return msg


def create_test_playlist(
    playlist_id: int = 1,
    user_id: int = 1,
    name: str = "Test Playlist",
    description: str = "A test playlist",
    video_ids: Optional[list] = None,
) -> Dict[str, Any]:
    """
    Crée une playlist pour les tests.

    Args:
        playlist_id: ID unique
        user_id: ID utilisateur propriétaire
        name: Nom de la playlist
        description: Description
        video_ids: Liste des IDs vidéo

    Returns:
        Dictionnaire représentant une playlist
    """
    if video_ids is None:
        video_ids = ["vid1", "vid2", "vid3"]

    return {
        "id": playlist_id,
        "user_id": user_id,
        "name": name,
        "description": description,
        "video_ids": video_ids,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "total_duration": 10800,
        "summary_count": len(video_ids),
    }


def create_test_credit_transaction(
    transaction_id: int = 1,
    user_id: int = 1,
    amount: int = -10,
    reason: str = "video_analysis",
    metadata: Optional[Dict] = None,
) -> Dict[str, Any]:
    """
    Crée une transaction de crédits pour les tests.

    Args:
        transaction_id: ID unique
        user_id: ID utilisateur
        amount: Montant (négatif = débit, positif = crédit)
        reason: Raison (video_analysis, subscription_renewal, refund, etc)
        metadata: Métadonnées supplémentaires

    Returns:
        Dictionnaire représentant une transaction
    """
    if metadata is None:
        metadata = {}

    return {
        "id": transaction_id,
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "previous_balance": 150,
        "new_balance": 150 + amount,
        "metadata": metadata,
        "created_at": datetime.now().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 JWT & AUTH HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def jwt_secret():
    """Secret JWT pour les tests."""
    return "test-secret-key-minimum-32-characters-long-for-hs256"


def create_valid_jwt_token(
    user_id: int = 1,
    secret: str = "test-secret-key-minimum-32-characters-long-for-hs256",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Crée un token JWT valide pour les tests.

    Args:
        user_id: ID utilisateur à encoder
        secret: Secret de signature
        expires_delta: Délai d'expiration (par défaut: +1h)

    Returns:
        Token JWT valide
    """
    if expires_delta is None:
        expires_delta = timedelta(hours=1)

    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + expires_delta,
        "iat": datetime.utcnow(),
        "type": "access"
    }

    token = jwt.encode(payload, secret, algorithm="HS256")
    return token


def create_expired_jwt_token(
    user_id: int = 1,
    secret: str = "test-secret-key-minimum-32-characters-long-for-hs256",
) -> str:
    """
    Crée un token JWT expiré pour les tests.

    Args:
        user_id: ID utilisateur à encoder
        secret: Secret de signature

    Returns:
        Token JWT expiré
    """
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() - timedelta(hours=1),
        "iat": datetime.utcnow() - timedelta(hours=2),
        "type": "access"
    }

    token = jwt.encode(payload, secret, algorithm="HS256")
    return token


@pytest.fixture
def mock_auth_header(jwt_secret: str) -> Dict[str, str]:
    """
    Retourne un header Authorization valide pour les tests.

    Returns:
        Dict avec clé "Authorization" et token Bearer valide
    """
    token = create_valid_jwt_token(user_id=1, secret=jwt_secret)
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════════════════
# 🔒 DEPENDENCY OVERRIDES
# ═══════════════════════════════════════════════════════════════════════════════


def override_get_current_user(user: MagicMock) -> callable:
    """
    Retourne une fonction pour override la dépendance get_current_user.

    Args:
        user: Utilisateur mock à retourner

    Returns:
        Fonction compatible avec FastAPI dependency override
    """
    async def _get_current_user():
        return user

    return _get_current_user


def override_require_plan(plan: str) -> callable:
    """
    Retourne une fonction pour override la dépendance require_plan.

    Args:
        plan: Plan à vérifier (free, etudiant, starter, pro, expert)

    Returns:
        Fonction compatible avec FastAPI dependency override
    """
    async def _require_plan(user: MagicMock = None):
        if user is None:
            user = create_test_user(plan=plan)
        elif user.plan != plan and user.plan != "expert":
            # Expert a accès à tous les plans
            raise Exception(f"User plan {user.plan} does not match required {plan}")
        return user

    return _require_plan


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 EXTERNAL API MOCKS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def mock_mistral_client():
    """Mock client Mistral AI."""
    client = AsyncMock()
    client.chat.complete = AsyncMock(return_value={
        "choices": [{
            "message": {
                "content": """# Résumé Complet

## Introduction
Cette vidéo couvre des concepts fondamentaux en physique.

## Points Clés
1. **[00:00-05:00]** Concepts d'introduction
2. **[05:00-15:00]** Théories principales
3. **[15:00-30:00]** Applications pratiques

## Conclusion
Une analyse approfondie du sujet."""
            }
        }]
    })
    return client


@pytest.fixture
def mock_perplexity_client():
    """Mock client Perplexity API."""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value={
        "choices": [{
            "message": {
                "content": "Selon les sources actuelles et la recherche web, cette information est correcte avec un score de fiabilité de 0.92."
            }
        }]
    })
    return client


@pytest.fixture
def mock_youtube_api():
    """Mock YouTube Data API."""
    youtube = AsyncMock()
    youtube.videos.list = AsyncMock(return_value={
        "items": [{
            "id": "test123",
            "snippet": {
                "title": "Test Video Title",
                "description": "Test description",
                "channelTitle": "Test Channel",
                "thumbnails": {
                    "medium": {
                        "url": "https://img.youtube.com/vi/test123/mqdefault.jpg"
                    }
                }
            },
            "contentDetails": {
                "duration": "PT2H30M45S"  # 2h 30m 45s
            }
        }]
    })
    return youtube


@pytest.fixture
def mock_supadata_client():
    """Mock Supadata API pour transcripts."""
    client = AsyncMock()
    client.get_transcript = AsyncMock(return_value={
        "success": True,
        "transcript": "Full transcript content here...",
        "language": "en",
        "source": "supadata"
    })
    return client


# ═══════════════════════════════════════════════════════════════════════════════
# 🧮 PARAMETRIZED FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture(params=["free", "etudiant", "starter", "pro", "expert"])
def user_with_plan(request):
    """Utilisateur avec différents plans pour tests paramétrés."""
    plan = request.param
    credits_by_plan = {
        "free": 150,
        "etudiant": 2000,
        "starter": 3000,
        "pro": 15000,
        "expert": 999999,
    }
    return create_test_user(plan=plan, credits=credits_by_plan[plan])


@pytest.fixture(params=["web", "mobile", "extension"])
def platform(request):
    """Plateforme pour tests cross-platform."""
    return request.param


# ═══════════════════════════════════════════════════════════════════════════════
# 🧹 CLEANUP FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
async def cleanup_redis(mock_redis):
    """Cleanup Redis après chaque test."""
    yield mock_redis
    await mock_redis.flushdb()


@pytest.fixture
async def cleanup_db(mock_db_session):
    """Cleanup DB après chaque test."""
    yield mock_db_session
    await mock_db_session.rollback()


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ CONTEXT MANAGERS & HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def assert_called_with_timeout():
    """Helper pour vérifier les appels avec timeout."""
    def _assert(mock_obj, *args, timeout: float = 1.0, **kwargs):
        mock_obj.assert_called_with(*args, **kwargs)
        return True
    return _assert


@pytest.fixture
def create_mock_response():
    """Factory pour créer des réponses mock."""
    def _create(status_code: int = 200, json_data: Optional[Dict] = None):
        response = AsyncMock()
        response.status_code = status_code
        response.json = AsyncMock(return_value=json_data or {})
        response.text = json.dumps(json_data or {})
        response.raise_for_status = MagicMock()
        return response
    return _create
