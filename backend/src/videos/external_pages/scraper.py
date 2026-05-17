"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📰 scraper — Scraping HTML d'une page externe + extraction texte readable         ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Étape 4 du pipeline external_pages (spec 2026-05-17 §4) :                         ║
║                                                                                    ║
║    [ResolvedURL]                                                                   ║
║         │                                                                          ║
║         ▼                                                                          ║
║    scrape_page(url, final_url) ──► ScrapedPage(url, final_url, title, text,        ║
║                                                status, bytes_fetched,              ║
║                                                fetched_via_proxy)                  ║
║                                                                                    ║
║  Stratégie :                                                                       ║
║    1. Tentative directe via shared_http_client (IP Hetzner, gratuit).              ║
║    2. Sur 403 / 429 ou signal Cloudflare → retry via get_proxied_client            ║
║       (proxy résidentiel Decodo). Log telemetry sous provider                      ║
║       "external_page_scrape" (auto via record_proxy_usage).                        ║
║    3. Body tronqué à MAX_HTML_BYTES (500 KB).                                      ║
║    4. Content-Type non-HTML (pdf, zip, image, video, audio) → status="non_html"    ║
║       (spec :: skipped_content_type).                                              ║
║    5. Extraction texte via trafilatura (SoTA) → fallback readability-lxml.         ║
║    6. Détection paywall via patterns HTML (subscribers-only, réservé aux           ║
║       abonnés, etc.) → status="paywall".                                           ║
║                                                                                    ║
║  Status retournés :                                                                ║
║    "ok"            : extraction réussie, ≥ 200 chars de texte                      ║
║    "paywall"       : pattern paywall détecté dans le HTML                          ║
║    "timeout"       : timeout réseau                                                ║
║    "non_html"      : Content-Type non supporté (PDF, image, etc.)                  ║
║    "http_error"    : statut 4xx (hors 403/429 qui ont fallback) ou 5xx             ║
║    "empty"         : HTML vide ou extraction donne < 200 chars                     ║
║                                                                                    ║
║  Le module NE LÈVE JAMAIS — toute erreur retourne un ScrapedPage avec status.      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Optional, Tuple
from urllib.parse import urlparse

import httpx

from core.http_client import get_proxied_client, shared_http_client

try:
    from middleware.proxy_telemetry import record_proxy_usage
except Exception:  # pragma: no cover — defensive import (tests / minimal env)
    async def record_proxy_usage(**_kwargs):  # type: ignore
        return None


logger = logging.getLogger("deepsight.external_pages.scraper")


# ═══════════════════════════════════════════════════════════════════════════════
# 🚦 Constantes
# ═══════════════════════════════════════════════════════════════════════════════

MAX_HTML_BYTES: int = 500 * 1024  # 500 KB — au-delà on truncate
SCRAPE_TIMEOUT: float = 12.0      # spec §4 — par URL
MIN_TEXT_LEN: int = 200           # spec §4 edge cases — < 200 chars → status="empty"

# Patterns détection paywall (case-insensitive sur HTML lowered)
# Spec §4 — couvre Substack premium, Medium, Bloomberg/WSJ/NYT, Le Monde, etc.
PAYWALL_PATTERNS: Tuple[str, ...] = (
    "subscribers-only",
    "subscribe-button",
    "paywall",
    "premium-content",
    "metered-content",
    "meteredcontent",
    "subscribe to read",
    "subscribe to continue",
    "abonnés uniquement",
    "réservé aux abonnés",
    "article-paywall",
    "members-only",
    "register to continue",
    "sign in to read",
    'name="paywall"',
)

# Content-types à skip (spec §4 edge cases) — préfixes match
SKIP_CONTENT_TYPE_PREFIXES: Tuple[str, ...] = (
    "application/pdf",
    "application/zip",
    "application/octet-stream",
    "application/x-",
    "video/",
    "audio/",
    "image/",
)

# HTML content-types acceptés (préfixes)
HTML_CONTENT_TYPE_PREFIXES: Tuple[str, ...] = (
    "text/html",
    "application/xhtml+xml",
    "application/xml",
    "text/xml",
)

# Status codes signalant un block (CF/WAF) → fallback proxy
BLOCK_STATUS_CODES: Tuple[int, ...] = (403, 429)

# Signal Cloudflare dans le HTML (look-ahead sur premier 5 KB)
CLOUDFLARE_SIGNALS: Tuple[str, ...] = (
    "cloudflare",
    "_cf_chl",
    "cf-ray",
    "cf-browser-verification",
    "checking your browser before accessing",
)


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 Dataclass — ScrapedPage
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class ScrapedPage:
    """Résultat d'un scrape de page externe.

    Attributs :
        url               : URL d'origine (avant follow_redirects)
        final_url         : URL finale après redirects (input pour summarizer)
        title             : Titre extrait (None si extraction failed)
        text              : Texte readable extrait (None si paywall/error/empty)
        status            : "ok" | "paywall" | "timeout" | "non_html" |
                            "http_error" | "empty"
        bytes_fetched     : Octets téléchargés (avant truncation)
        fetched_via_proxy : True si fallback proxy déclenché
        content_type      : Content-Type brut renvoyé (debug)
        http_status       : Code HTTP final (debug)
    """

    url: str
    final_url: str
    title: Optional[str]
    text: Optional[str]
    status: str
    bytes_fetched: int
    fetched_via_proxy: bool
    content_type: Optional[str] = None
    http_status: Optional[int] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 _fetch_html — Récupère le HTML brut (avec ou sans proxy)
# ═══════════════════════════════════════════════════════════════════════════════


async def _fetch_html(
    url: str,
    *,
    use_proxy: bool,
    timeout: float = SCRAPE_TIMEOUT,
) -> Tuple[Optional[str], int, str, int]:
    """Télécharge le HTML d'une URL avec ou sans proxy.

    Returns:
        (html, bytes_read, content_type, status_code).
        html=None si erreur ou content-type non HTML.
        bytes_read=0 sur erreur connexion/timeout.
        content_type="" sur erreur réseau.
        status_code=0 sur exception (timeout, connect error).
    """
    cm = get_proxied_client(timeout=timeout) if use_proxy else shared_http_client()
    try:
        async with cm as client:
            # client.stream pour pouvoir tronquer avant lecture complète
            async with client.stream(
                "GET",
                url,
                timeout=timeout,
                follow_redirects=True,
            ) as resp:
                raw_ct = (resp.headers.get("content-type") or "").lower()
                content_type = raw_ct.split(";", 1)[0].strip()
                status = int(resp.status_code)

                # Skip non-HTML content-types tôt — pas la peine de stream
                if content_type and any(
                    content_type.startswith(prefix)
                    for prefix in SKIP_CONTENT_TYPE_PREFIXES
                ):
                    return None, 0, content_type, status

                buf = bytearray()
                async for chunk in resp.aiter_bytes():
                    if not chunk:
                        continue
                    buf.extend(chunk)
                    if len(buf) >= MAX_HTML_BYTES:
                        break

                # Décodage robuste
                try:
                    html = buf.decode("utf-8", errors="replace")
                except Exception:
                    html = buf.decode("latin-1", errors="replace")
                return html, len(buf), content_type, status
    except httpx.TimeoutException as exc:
        logger.debug("[EXTERNAL_PAGES] timeout fetching %s (proxy=%s): %s",
                     url, use_proxy, exc)
        return None, 0, "", 0
    except httpx.HTTPError as exc:
        logger.debug("[EXTERNAL_PAGES] http error fetching %s (proxy=%s): %s",
                     url, use_proxy, exc)
        return None, 0, "", 0
    except Exception as exc:  # noqa: BLE001 — best-effort
        logger.debug("[EXTERNAL_PAGES] unexpected error fetching %s (proxy=%s): %s",
                     url, use_proxy, exc)
        return None, 0, "", 0


# ═══════════════════════════════════════════════════════════════════════════════
# 🛡️ _detect_paywall — Heuristique HTML
# ═══════════════════════════════════════════════════════════════════════════════


def _detect_paywall(html: str) -> bool:
    """Détecte un paywall via patterns HTML (case-insensitive)."""
    if not html:
        return False
    lowered = html.lower()
    return any(pattern in lowered for pattern in PAYWALL_PATTERNS)


def _detect_cloudflare(html: str) -> bool:
    """Détecte un challenge Cloudflare dans les premiers 5 KB du HTML."""
    if not html:
        return False
    head = html[:5000].lower()
    return any(sig in head for sig in CLOUDFLARE_SIGNALS)


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 _extract_content — trafilatura puis fallback readability-lxml
# ═══════════════════════════════════════════════════════════════════════════════


def _extract_content(html: str, url: str) -> Tuple[Optional[str], Optional[str]]:
    """Extrait (title, text) à partir du HTML.

    Stratégie :
      1. trafilatura.extract(html, output_format="json", with_metadata=True)
      2. Fallback readability.Document → BeautifulSoup.get_text()
      3. Renvoie (None, None) si tout échoue ou si text < MIN_TEXT_LEN.
    """
    # Tentative 1 — trafilatura (SoTA, retourne JSON avec meta)
    try:
        import trafilatura  # imported lazily to keep tests / scripts fast

        extracted = trafilatura.extract(
            html,
            output_format="json",
            include_comments=False,
            include_tables=False,
            with_metadata=True,
            url=url,
        )
        if extracted:
            data = json.loads(extracted)
            title = data.get("title") or None
            text = (data.get("text") or data.get("raw_text") or "").strip()
            if text and len(text) >= MIN_TEXT_LEN:
                # Trunc défensif à 8000 chars pour Mistral
                return title, text[:8000]
    except Exception as exc:  # noqa: BLE001
        logger.debug("[EXTERNAL_PAGES] trafilatura failed: %s", exc)

    # Tentative 2 — readability-lxml fallback
    try:
        from readability import Document as ReadabilityDocument
        from bs4 import BeautifulSoup

        doc = ReadabilityDocument(html)
        title = doc.title() or None
        cleaned_html = doc.summary()
        soup = BeautifulSoup(cleaned_html, "html.parser")
        text = soup.get_text(separator=" ", strip=True)
        if text and len(text) >= MIN_TEXT_LEN:
            return title, text[:8000]
    except Exception as exc:  # noqa: BLE001
        logger.debug("[EXTERNAL_PAGES] readability fallback failed: %s", exc)

    return None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 scrape_page — Entry point
# ═══════════════════════════════════════════════════════════════════════════════


def _provider_name(final_url: str) -> str:
    """Construit l'identifiant telemetry à partir du hostname final.

    Pattern : `external_page_scrape_<hostname>` (spec contract — unique).
    """
    try:
        host = (urlparse(final_url).hostname or "unknown").lower()
        # Strip www.
        if host.startswith("www."):
            host = host[4:]
    except Exception:
        host = "unknown"
    return f"external_page_scrape_{host}"


async def scrape_page(
    url: str,
    final_url: Optional[str] = None,
    *,
    timeout: float = SCRAPE_TIMEOUT,
) -> ScrapedPage:
    """Scrape une page externe, retourne un ScrapedPage avec status structuré.

    Args:
        url:       URL d'entrée (avant follow_redirects)
        final_url: URL finale post-resolve (si omis, on utilise url).
        timeout:   Timeout réseau par tentative (default 12 s).

    Returns:
        ScrapedPage — jamais None, jamais lève.
    """
    target = final_url or url
    fetched_via_proxy = False

    # — Tentative 1 : direct (IP Hetzner)
    html, bytes_fetched, content_type, status = await _fetch_html(
        target, use_proxy=False, timeout=timeout
    )

    # — Détection d'un block : 403/429 OU signal Cloudflare dans le HTML
    cf_in_html = bool(html) and _detect_cloudflare(html)
    block_signal = status in BLOCK_STATUS_CODES or cf_in_html

    if block_signal:
        logger.info(
            "[EXTERNAL_PAGES] %s → block signal (status=%s, cf=%s), retry via proxy",
            target, status, cf_in_html,
        )
        html_p, bytes_p, ct_p, status_p = await _fetch_html(
            target, use_proxy=True, timeout=timeout
        )
        # Si le retry a réussi à tirer quelque chose, on remplace l'état
        if status_p != 0:
            html = html_p
            bytes_fetched = bytes_p
            content_type = ct_p
            status = status_p
        fetched_via_proxy = True

        # Telemetry best-effort (best-effort, jamais bloquant)
        if bytes_fetched > 0:
            try:
                await record_proxy_usage(
                    provider=_provider_name(target),
                    bytes_in=bytes_fetched,
                    bytes_out=0,
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug("[EXTERNAL_PAGES] telemetry record failed: %s", exc)

    # — Détermination du status final
    # 1) Timeout / connect error / DNS → status=0
    if status == 0:
        return ScrapedPage(
            url=url,
            final_url=target,
            title=None,
            text=None,
            status="timeout",
            bytes_fetched=bytes_fetched,
            fetched_via_proxy=fetched_via_proxy,
            content_type=content_type or None,
            http_status=status,
        )

    # 2) Content-type non-HTML rejeté tôt
    if (
        content_type
        and any(
            content_type.startswith(prefix) for prefix in SKIP_CONTENT_TYPE_PREFIXES
        )
    ):
        return ScrapedPage(
            url=url,
            final_url=target,
            title=None,
            text=None,
            status="non_html",
            bytes_fetched=bytes_fetched,
            fetched_via_proxy=fetched_via_proxy,
            content_type=content_type,
            http_status=status,
        )

    # 3) Erreurs HTTP (hors 200-299) — 4xx (autres que block réussi) et 5xx
    if status >= 400:
        return ScrapedPage(
            url=url,
            final_url=target,
            title=None,
            text=None,
            status="http_error",
            bytes_fetched=bytes_fetched,
            fetched_via_proxy=fetched_via_proxy,
            content_type=content_type or None,
            http_status=status,
        )

    # 4) Pas de HTML utile
    if not html:
        return ScrapedPage(
            url=url,
            final_url=target,
            title=None,
            text=None,
            status="empty",
            bytes_fetched=bytes_fetched,
            fetched_via_proxy=fetched_via_proxy,
            content_type=content_type or None,
            http_status=status,
        )

    # 5) Paywall détecté — on garde le titre, pas le texte
    if _detect_paywall(html):
        title, _ = _extract_content(html, target)
        return ScrapedPage(
            url=url,
            final_url=target,
            title=title,
            text=None,
            status="paywall",
            bytes_fetched=bytes_fetched,
            fetched_via_proxy=fetched_via_proxy,
            content_type=content_type or None,
            http_status=status,
        )

    # 6) Extraction texte readable
    title, text = _extract_content(html, target)
    if not text:
        return ScrapedPage(
            url=url,
            final_url=target,
            title=title,
            text=None,
            status="empty",
            bytes_fetched=bytes_fetched,
            fetched_via_proxy=fetched_via_proxy,
            content_type=content_type or None,
            http_status=status,
        )

    # 7) OK
    return ScrapedPage(
        url=url,
        final_url=target,
        title=title,
        text=text,
        status="ok",
        bytes_fetched=bytes_fetched,
        fetched_via_proxy=fetched_via_proxy,
        content_type=content_type or None,
        http_status=status,
    )
