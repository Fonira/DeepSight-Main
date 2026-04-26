"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🌐 Shared httpx AsyncClient — Connection Pooling global                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Client httpx partagé pour toutes les requêtes HTTP sortantes.                    ║
║  Élimine la création d'un nouveau client TCP par requête.                         ║
║  Gère le lifecycle via le lifespan FastAPI (startup/shutdown).                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import httpx
from typing import Optional

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

# Limits: pool de connexions partagé
_LIMITS = httpx.Limits(
    max_connections=100,  # Total max connexions TCP ouvertes
    max_keepalive_connections=20,  # Connexions keep-alive en idle
    keepalive_expiry=30.0,  # Timeout idle keep-alive (secondes)
)

# Timeout par défaut (overridable par requête)
_DEFAULT_TIMEOUT = httpx.Timeout(
    connect=10.0,  # Connexion TCP
    read=30.0,  # Lecture réponse
    write=10.0,  # Écriture requête
    pool=10.0,  # Attente d'une connexion du pool
)

# Timeout long pour les opérations lentes (yt-dlp, STT, etc.)
LONG_TIMEOUT = httpx.Timeout(
    connect=15.0,
    read=60.0,
    write=15.0,
    pool=15.0,
)

# ═══════════════════════════════════════════════════════════════════════════════
# Client singleton
# ═══════════════════════════════════════════════════════════════════════════════

_client: Optional[httpx.AsyncClient] = None


async def init_http_client() -> httpx.AsyncClient:
    """
    Initialise le client httpx partagé.
    Appelé au startup de FastAPI (lifespan).
    """
    global _client
    if _client is not None:
        return _client

    _client = httpx.AsyncClient(
        limits=_LIMITS,
        timeout=_DEFAULT_TIMEOUT,
        follow_redirects=True,
        http2=False,  # HTTP/1.1 suffit pour YouTube APIs, plus stable
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    )
    return _client


async def close_http_client() -> None:
    """
    Ferme proprement le client httpx.
    Appelé au shutdown de FastAPI (lifespan).
    """
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def get_http_client() -> httpx.AsyncClient:
    """
    Retourne le client httpx partagé.
    Raise RuntimeError si non initialisé (= bug d'ordre de lifecycle).
    """
    if _client is None:
        raise RuntimeError("HTTP client not initialized. Call init_http_client() in FastAPI lifespan first.")
    return _client


def get_http_client_optional() -> Optional[httpx.AsyncClient]:
    """
    Retourne le client httpx partagé, ou None si pas encore initialisé.
    Utile pour les modules qui peuvent tourner sans le client (tests, scripts).
    """
    return _client


# ═══════════════════════════════════════════════════════════════════════════════
# Context Manager compatible — Drop-in replacement pour `async with httpx.AsyncClient() as client:`
# ═══════════════════════════════════════════════════════════════════════════════

from contextlib import asynccontextmanager


@asynccontextmanager
async def shared_http_client(**kwargs):
    """
    Drop-in replacement pour `async with httpx.AsyncClient(...) as client:`.

    Utilise le client partagé (connection pooling) si disponible.
    Fallback sur un nouveau client si le pool n'est pas initialisé (tests, scripts).

    Usage:
        # Avant:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)

        # Après:
        from core.http_client import shared_http_client
        async with shared_http_client() as client:
            resp = await client.get(url, timeout=15.0)  # timeout per-request

    Note: Les timeouts doivent être passés per-request, pas au constructeur.
    Le client partagé a un timeout par défaut de 30s read / 10s connect.
    """
    client = _client
    if client is not None:
        # Client partagé disponible — pas de création/fermeture
        yield client
    else:
        # Fallback: créer un client éphémère (tests, scripts, startup)
        async with httpx.AsyncClient(**kwargs) as fallback_client:
            yield fallback_client
