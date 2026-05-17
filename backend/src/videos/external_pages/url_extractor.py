"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔎 url_extractor — Extraction, nettoyage et filtrage d'URLs                       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pipeline d'extraction d'URLs depuis le texte (description vidéo, transcript) :    ║
║                                                                                    ║
║    extract_urls_from_text(text) ──┐                                                ║
║                                   ├─► clean_and_filter_urls(urls, self_channel) ─► ║
║    [URLs candidates]              │   [URLs propres, dédup, plafonnées]            ║
║                                   │                                                ║
║    clean_url(url)  ───────────────┘                                                ║
║    is_blacklisted(url)                                                             ║
║                                                                                    ║
║  Pas d'I/O réseau dans ce module — pure manipulation de strings.                   ║
║  La résolution HEAD (network) est dans url_resolver.py.                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import re
from typing import List, Optional
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

from .constants import BLACKLIST_HOSTS, TRACKING_PARAMS


# ═══════════════════════════════════════════════════════════════════════════════
# 🔎 Regex d'extraction
# ═══════════════════════════════════════════════════════════════════════════════
# Capture les URLs avec scheme http(s) explicite OU www.* (sans scheme).
# - groupe 1 : URL complète (scheme inclus)
# - groupe 2 : URL www. (sans scheme)
#
# La regex évite d'être trop gourmande sur les caractères de fin (`.,;:!?)]}>"\``)
# qui sont systématiquement strip post-match par _strip_trailing_punct.
_URL_REGEX = re.compile(
    r"""(?:
        (?P<full>https?://[^\s<>"'`)]+)
      |
        (?:^|[\s(<\[])(?P<www>www\.[^\s<>"'`)]+)
    )""",
    re.IGNORECASE | re.VERBOSE,
)

# Punctuation finale à strip post-match (très commun en fin de phrase)
_TRAILING_PUNCT = ".,;:!?)”’\"'>}]"


def _strip_trailing_punct(url: str) -> str:
    """Retire les caractères de ponctuation traînant en fin d'URL.

    Cas typique : "Visit https://example.com." → "https://example.com"
    On strip en boucle pour gérer "https://x.com),." par exemple.
    """
    while url and url[-1] in _TRAILING_PUNCT:
        url = url[:-1]
    return url


def extract_urls_from_text(text: Optional[str]) -> List[str]:
    """Extrait toutes les URLs candidates depuis un texte libre.

    Caractéristiques :
    - Capture http://, https://, et www.* (auquel on ajoute le scheme https://).
    - Strip la ponctuation traînante (.,;:!? etc.).
    - Préserve l'ordre d'apparition.
    - Pas de dédup ici (clean_and_filter_urls s'en occupe après nettoyage).

    Args:
        text: Texte source (description, transcript, etc.). None et "" → [].

    Returns:
        Liste des URLs trouvées, dans l'ordre. Vide si rien à extraire.
    """
    if not text:
        return []

    urls: List[str] = []
    for match in _URL_REGEX.finditer(text):
        raw = match.group("full") or match.group("www")
        if not raw:
            continue
        cleaned_raw = _strip_trailing_punct(raw)
        if not cleaned_raw:
            continue
        # Si on a matché un "www.X" sans scheme, ajouter https://
        if cleaned_raw.lower().startswith("www."):
            cleaned_raw = "https://" + cleaned_raw
        urls.append(cleaned_raw)
    return urls


# ═══════════════════════════════════════════════════════════════════════════════
# 🧹 clean_url — Strip tracking params + normalise host
# ═══════════════════════════════════════════════════════════════════════════════


def clean_url(url: str) -> Optional[str]:
    """Nettoie une URL : strip tracking params, lowercase host, valide structure.

    - Retire tous les query params listés dans TRACKING_PARAMS (utm_*, fbclid, …)
    - Lowercase le host (netloc), préserve path/query/fragment intacts
    - Retire le fragment ?  → non, on garde (anchors utiles pour reading)
    - Retourne None si URL invalide (pas de scheme http(s), pas de netloc, etc.)

    Args:
        url: URL à nettoyer.

    Returns:
        URL nettoyée (str) ou None si invalide.
    """
    if not url or not isinstance(url, str):
        return None

    try:
        parsed = urlparse(url.strip())
    except (ValueError, TypeError):
        return None

    # Scheme obligatoire (http ou https)
    if parsed.scheme.lower() not in ("http", "https"):
        return None
    # Host obligatoire
    if not parsed.netloc:
        return None

    # Lowercase le host (netloc peut contenir user:pass@host:port → on lowercase tout)
    netloc_lower = parsed.netloc.lower()

    # Strip tracking params dans la query
    if parsed.query:
        # parse_qsl conserve l'ordre des params
        kept = [
            (k, v)
            for k, v in parse_qsl(parsed.query, keep_blank_values=True)
            if k.lower() not in TRACKING_PARAMS
        ]
        new_query = urlencode(kept)
    else:
        new_query = ""

    cleaned = urlunparse(
        (
            parsed.scheme.lower(),
            netloc_lower,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment,
        )
    )
    return cleaned


# ═══════════════════════════════════════════════════════════════════════════════
# 🚫 is_blacklisted — Filtres hosts (YouTube/TikTok/self-channel)
# ═══════════════════════════════════════════════════════════════════════════════


def _normalize_host(host: str) -> str:
    """Strip 'www.' et lowercase pour comparaison cohérente."""
    host = (host or "").lower().strip()
    if host.startswith("www."):
        host = host[4:]
    return host


def is_blacklisted(
    url: str, self_channel_host: Optional[str] = None
) -> bool:
    """Détermine si une URL doit être exclue du pipeline.

    Critères :
    - URL invalide (pas de scheme/host) → blacklisted (rien à faire avec).
    - Host dans BLACKLIST_HOSTS (YouTube, TikTok, sociaux, etc.).
    - Host == self_channel_host (le créateur référence sa propre boutique
      ou son propre site — non pertinent comme "page externe citée").

    Args:
        url: URL à vérifier (typiquement déjà passée par clean_url).
        self_channel_host: Optionnel — host du créateur de la vidéo.
                           Ex : si la vidéo vient de la chaîne "TomScott", on peut
                           passer "tomscott.com" pour filtrer ses propres liens.

    Returns:
        True si l'URL doit être exclue, False sinon.
    """
    if not url or not isinstance(url, str):
        return True

    try:
        parsed = urlparse(url)
    except (ValueError, TypeError):
        return True

    if parsed.scheme.lower() not in ("http", "https"):
        return True
    if not parsed.netloc:
        return True

    host_norm = _normalize_host(parsed.netloc)
    host_with_www = "www." + host_norm

    # Blacklist directe (gère "www.X" et "X" car la liste contient les deux variantes)
    if (
        parsed.netloc.lower() in BLACKLIST_HOSTS
        or host_norm in BLACKLIST_HOSTS
        or host_with_www in BLACKLIST_HOSTS
    ):
        return True

    # Subdomain match — ex : music.youtube.com est blacklisté car suffix == youtube.com
    for blocked in BLACKLIST_HOSTS:
        blocked_norm = _normalize_host(blocked)
        if host_norm == blocked_norm or host_norm.endswith("." + blocked_norm):
            return True

    # Self-channel
    if self_channel_host:
        self_norm = _normalize_host(self_channel_host)
        if self_norm and (
            host_norm == self_norm or host_norm.endswith("." + self_norm)
        ):
            return True

    return False


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 clean_and_filter_urls — Pipeline complet
# ═══════════════════════════════════════════════════════════════════════════════


def clean_and_filter_urls(
    urls: List[str],
    self_channel_host: Optional[str] = None,
    max_count: int = 50,
) -> List[str]:
    """Pipeline complet : clean → filter → dedup → cap.

    Étapes (ordre fixe) :
      1. clean_url(u)         → strip tracking, lowercase host
      2. is_blacklisted(u)    → exclure YouTube/TikTok/self-channel
      3. dédup                → garder première occurrence, ordre préservé
      4. cap                  → tronquer à max_count

    Args:
        urls: Liste d'URLs candidates (typiquement la sortie de
              extract_urls_from_text).
        self_channel_host: Host à exclure (le créateur de la vidéo).
        max_count: Plafond sur la sortie (défaut 50, à plafonner avec
                   PLAN_CAPS en amont selon plan).

    Returns:
        Liste finale d'URLs propres, dans l'ordre d'apparition.
    """
    if not urls:
        return []

    seen: set = set()
    result: List[str] = []

    for raw in urls:
        cleaned = clean_url(raw)
        if cleaned is None:
            continue
        if is_blacklisted(cleaned, self_channel_host=self_channel_host):
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
        if len(result) >= max_count:
            break

    return result
