"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🌐 Shared httpx AsyncClient — Connection Pooling global                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Client httpx partagé pour toutes les requêtes HTTP sortantes.                    ║
║  Élimine la création d'un nouveau client TCP par requête.                         ║
║  Gère le lifecycle via le lifespan FastAPI (startup/shutdown).                     ║
║                                                                                    ║
║  🔌 get_proxied_client() — depuis 2026-05-11 (Sprint B audit)                     ║
║  Factory séparée pour les appels YouTube / TikTok qui doivent router via le       ║
║  proxy résidentiel Decodo (settings.YOUTUBE_PROXY). Le shared client global       ║
║  reste bare car la majorité des appels (Mistral, Brave, Tournesol, ElevenLabs,    ║
║  arXiv, Crossref, etc.) doivent partir directement depuis l'IP Hetzner.           ║
║                                                                                    ║
║  Voir docs/audits/2026-05-11-proxy-coverage.md pour le contexte complet.          ║
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


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 Proxied client — YouTube / TikTok (Decodo residential proxy)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Le VPS Hetzner est bloqué par YouTube (bot challenge + 429) depuis 2026-04-26.
# Le proxy Decodo (settings.YOUTUBE_PROXY) résout en routant via IP résidentielle.
#
# Ce helper est SÉPARÉ du shared_http_client global parce que :
# - 95% des appels du backend (Mistral, Perplexity, Brave, Tournesol, ElevenLabs,
#   arXiv, Crossref, OpenAlex, Semantic Scholar, R2, Resend, Stripe, Sentry…)
#   doivent partir directement depuis Hetzner — proxifier détruirait la latence
#   et facturerait inutilement le quota Decodo.
# - Seules les routes YouTube / TikTok (transcripts, discovery, visual_analysis,
#   carousel images, oEmbed, short-URL resolution) ont besoin du proxy.
#
# Usage:
#     from core.http_client import get_proxied_client
#
#     async with get_proxied_client(timeout=20.0) as client:
#         resp = await client.get("https://www.youtube.com/...")
#
# Comportement :
# - Si settings.YOUTUBE_PROXY est set → client httpx avec mounts proxy
# - Si non set → client bare (équivalent httpx.AsyncClient()), pour rester
#   utilisable en dev local sans configurer le proxy.
# ═══════════════════════════════════════════════════════════════════════════════


def _get_proxy_url() -> Optional[str]:
    """Lit settings.YOUTUBE_PROXY de manière paresseuse (évite l'import circulaire).

    Retourne None si vide ou non configuré (le client doit alors être bare).
    """
    try:
        from core.config import get_youtube_proxy

        proxy = get_youtube_proxy()
        return proxy or None
    except Exception:
        # Si core.config plante à l'import (tests sans env), pas de proxy
        return None


@asynccontextmanager
async def get_proxied_client(
    timeout: float = 30.0,
    *,
    follow_redirects: bool = True,
    headers: Optional[dict] = None,
):
    """Context manager pour un client httpx routé via le proxy résidentiel.

    Le client est ÉPHÉMÈRE (créé/fermé à chaque appel) — il n'y a pas de pool
    partagé proxifié pour rester simple et éviter de doubler les ressources.
    Si le proxy n'est pas configuré (`settings.YOUTUBE_PROXY` vide), retombe
    sur un client httpx bare standard.

    Args:
        timeout: Timeout total en secondes (passé au client httpx)
        follow_redirects: Suit les redirects HTTP (default True)
        headers: Headers à appliquer au niveau client (User-Agent par défaut
                 sinon)

    Yields:
        httpx.AsyncClient configuré

    Example:
        >>> async with get_proxied_client(timeout=15.0) as client:
        ...     resp = await client.get("https://www.youtube.com/watch?v=...")
    """
    proxy_url = _get_proxy_url()

    default_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    }
    if headers:
        default_headers.update(headers)

    client_kwargs: dict = {
        "timeout": timeout,
        "follow_redirects": follow_redirects,
        "headers": default_headers,
    }

    if proxy_url:
        # httpx ≥ 0.26 : le kwarg `proxies` a été déprécié au profit de `mounts` ;
        # httpx ≥ 0.28 supprime `proxies`. On utilise `mounts` qui couvre les
        # deux versions modernes. Si httpx < 0.26 (vieilles deps), fallback
        # vers `proxies` via try/except.
        try:
            transport = httpx.AsyncHTTPTransport(proxy=httpx.Proxy(proxy_url))
            client_kwargs["mounts"] = {
                "http://": transport,
                "https://": transport,
            }
        except (AttributeError, TypeError):
            # httpx legacy fallback
            client_kwargs["proxies"] = {"http://": proxy_url, "https://": proxy_url}

    async with httpx.AsyncClient(**client_kwargs) as client:
        yield client


def is_proxy_configured() -> bool:
    """Helper de diagnostic : vrai si settings.YOUTUBE_PROXY est non-vide.

    Utile pour les logs / dashboards / health checks (savoir si une route
    YouTube partira proxifiée ou bare en prod).
    """
    return bool(_get_proxy_url())
