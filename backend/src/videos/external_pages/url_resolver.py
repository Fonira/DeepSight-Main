"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔗 url_resolver — Résolution HEAD (follow_redirects + dedup par final_url)        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Étape 3 du pipeline external_pages :                                              ║
║                                                                                    ║
║    [URLs cleanées]                                                                 ║
║         │                                                                          ║
║         ▼                                                                          ║
║    resolve_urls(urls)  →  [ResolvedURL(input_url, final_url, status), ...]         ║
║                                                                                    ║
║  Pour chaque URL :                                                                 ║
║    - HEAD request via httpx, follow_redirects=True                                 ║
║    - Drop si timeout / dns error / > MAX_HOPS redirects                            ║
║    - Drop si HTTP 5xx (erreur serveur — pas utile à scraper en PR 2)               ║
║    - Garde l'URL finale (après redirects) comme clé de dédup                       ║
║                                                                                    ║
║  Note : PR 1 utilise le shared http client bare. Le proxy Decodo                   ║
║  (get_proxied_client) sera enroulé dans une factory utilisée par PR 2 pour les     ║
║  GETs qui peuvent toucher des sites bloquant les IPs datacenter.                   ║
║  Ici, on l'utilise déjà comme fallback safe pour HEAD (court, faible volume).      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

import httpx

from core.http_client import get_proxied_client

from .constants import MAX_HOPS, TIMEOUTS

logger = logging.getLogger("deepsight.external_pages.resolver")


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 Dataclass — URL résolue
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True)
class ResolvedURL:
    """URL résolue après suivi des redirects HTTP.

    Attributs :
        input_url : URL d'entrée (avant follow_redirects)
        final_url : URL finale (après tous les hops)
        status    : Code HTTP final (200, 404, etc.)
    """

    input_url: str
    final_url: str
    status: int


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 resolve_url — Résolution unitaire
# ═══════════════════════════════════════════════════════════════════════════════


async def resolve_url(
    client: httpx.AsyncClient, url: str
) -> Optional[ResolvedURL]:
    """Résout une URL via HEAD + follow_redirects.

    Args:
        client: httpx.AsyncClient déjà configuré (timeouts, follow_redirects).
                On peut passer le shared client OU un client proxy.
        url:    URL à résoudre (typiquement déjà nettoyée via clean_url).

    Returns:
        ResolvedURL si succès (HTTP 2xx/3xx/4xx hors 5xx).
        None si :
          - timeout
          - erreur DNS / connexion
          - > MAX_HOPS redirects (suspicion redirect chain)
          - HTTP 5xx
          - exception inattendue

    Note : on accepte HTTP 4xx (le client/utilisateur peut juger pertinent).
    On drop seulement 5xx (serveur down — pas de contenu à scraper en PR 2).
    """
    if not url:
        return None

    try:
        response = await client.head(
            url,
            follow_redirects=True,
            timeout=TIMEOUTS["head"],
        )
    except httpx.TimeoutException:
        logger.debug("HEAD timeout for %s", url)
        return None
    except httpx.ConnectError:
        logger.debug("HEAD connect error for %s", url)
        return None
    except httpx.HTTPError as exc:
        # Couvre RequestError, RemoteProtocolError, etc.
        logger.debug("HEAD http error for %s: %s", url, exc)
        return None
    except Exception as exc:  # noqa: BLE001 — best-effort, swallow tout
        # Toute exception inattendue : on drop sans crasher le pipeline
        logger.debug("HEAD unexpected error for %s: %s", url, exc)
        return None

    # Vérifie le nombre de hops (history contient les responses intermédiaires)
    history_count = len(response.history or [])
    if history_count > MAX_HOPS:
        logger.debug(
            "HEAD %s exceeded MAX_HOPS (%d > %d), dropping",
            url,
            history_count,
            MAX_HOPS,
        )
        return None

    status = int(response.status_code)
    # Drop 5xx (serveur down)
    if status >= 500:
        logger.debug("HEAD %s returned 5xx (%d), dropping", url, status)
        return None

    final_url = str(response.url)
    return ResolvedURL(input_url=url, final_url=final_url, status=status)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔁 resolve_urls — Batch (dedup par final_url)
# ═══════════════════════════════════════════════════════════════════════════════


async def resolve_urls(
    urls: List[str],
    *,
    use_proxy: bool = True,
) -> List[ResolvedURL]:
    """Résout un batch d'URLs en parallèle, déduplique par final_url.

    Garde l'ordre d'apparition (première occurrence de chaque final_url).

    Args:
        urls:      Liste d'URLs (typiquement la sortie de clean_and_filter_urls).
        use_proxy: Si True, route via get_proxied_client (Decodo). Si False,
                   utilise un client httpx bare (utile pour les tests / dev).

    Returns:
        Liste de ResolvedURL, dédup par final_url, ordre préservé.
    """
    if not urls:
        return []

    seen_final: set = set()
    results: List[ResolvedURL] = []

    if use_proxy:
        # get_proxied_client est un asynccontextmanager — pour les tests il est
        # patché via unittest.mock.
        async with get_proxied_client(
            timeout=TIMEOUTS["head"], follow_redirects=True
        ) as client:
            for url in urls:
                resolved = await resolve_url(client, url)
                if resolved is None:
                    continue
                if resolved.final_url in seen_final:
                    continue
                seen_final.add(resolved.final_url)
                results.append(resolved)
    else:
        async with httpx.AsyncClient(
            timeout=TIMEOUTS["head"], follow_redirects=True
        ) as client:
            for url in urls:
                resolved = await resolve_url(client, url)
                if resolved is None:
                    continue
                if resolved.final_url in seen_final:
                    continue
                seen_final.add(resolved.final_url)
                results.append(resolved)

    return results
