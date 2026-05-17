# Pages externes citées dans la vidéo

**Spec d'architecture — DeepSight feature**
**Date** : 2026-05-17
**Auteur** : Maxime Robathe / orchestrateur
**Status** : draft (à valider avant Phase 1)
**Tags** : #backend #frontend #mobile #extension #scraping #mistral #proxy-decodo
**Supersede** : aucune
**Pre-requis** :
- Pipeline analyse v6 stable (`backend/src/videos/router.py`)
- Proxy résidentiel Decodo actif (`YOUTUBE_PROXY` env, hard-stop 950 MB MTD)
- `core.http_client.get_proxied_client()` opérationnel (PR Sprint B 2026-05-11)
- `record_proxy_usage()` middleware actif (alembic 027)

---

## Sommaire

1. [Architecture haut niveau](#1-architecture-haut-niveau)
2. [Extraction des URLs](#2-extraction-des-urls)
3. [Résolution des URLs raccourcies](#3-résolution-des-urls-raccourcies)
4. [Scraping du contenu](#4-scraping-du-contenu)
5. [Résumé Mistral par URL](#5-résumé-mistral-par-url)
6. [Stockage DB](#6-stockage-db)
7. [Intégration dans pipeline v6](#7-intégration-dans-pipeline-v6)
8. [Plan gating](#8-plan-gating)
9. [UI tri-plateforme](#9-ui-tri-plateforme)
10. [Coût Decodo projeté](#10-coût-decodo-projeté)
11. [Tests](#11-tests)
12. [Risques et mitigations](#12-risques-et-mitigations)
13. [Phasage de livraison](#13-phasage-de-livraison)

---

## 1. Architecture haut niveau

### Vue d'ensemble

La feature "Pages externes citées" enrichit chaque analyse vidéo avec un mini-résumé de chaque URL externe trouvée dans la description du créateur. Tout le travail se fait **en parallèle de la pipeline principale**, sans bloquer la synthèse v6 ; le résultat se persiste sur le `Summary` à la fin de l'analyse, et reste accessible à Chat v4 comme contexte enrichi.

### Flow textuel

```
PIPELINE v6 (backend/src/videos/router.py)
  POST /api/videos/analyze
  → check_can_analyze, reserve_credits, create_task

  get_video_info(url)  ← Innertube/oEmbed/yt-dlp
  → video_info["description"]  (max 5000 chars)

  ┌── asyncio.create_task(_extract_external_pages(...)) ──┐
  │  FIRE-AND-FORGET non bloquant. Stocké dans            │
  │  _external_pages_task pour await() final.             │
  └───────────────────────────────────────────────────────┘

  EN PARALLÈLE :
  - get_transcript()
  - detect_category()
  - perplexity_enrichment()
  - get_summary_content()  ← Mistral synthèse v6 principale
  - extract_entities()

  Avant save_summary() :
  await asyncio.wait_for(_external_pages_task, timeout=60.0)
  Si timeout → external_pages = None (warning log, continue)

  save_summary(summary_content, external_pages, ...)
  → Summary.external_pages JSONB
```

### Tâche async `_extract_external_pages(video_info, user_plan, lang)`

```
STEP 1  Extract URLs from description (regex + URL parser)
        → List[str] candidats bruts

STEP 2  Clean + Filter
        ├─ Strip UTM / tracking params (utm_*, fbclid, gclid)
        ├─ Filter blacklist (youtube, tiktok, ig, discord, patreon)
        ├─ Self-channel filter
        └─ Set[str] URLs uniques

STEP 3  Resolve redirects
        ├─ HEAD requests via get_proxied_client (timeout 5s × 3)
        ├─ Skip > 5 hops
        ├─ Dedup by final_url
        └─ List[ResolvedURL]

STEP 4  Cap par plan (Free=0, Pro=5, Expert=10)
        → top N candidats

STEP 5  Scrape concurrent (asyncio.gather, max 5 in-flight via Semaphore)
        PAR URL :
          5a  GET via shared_http_client (PAS proxy par défaut)
          5b  Si 403/429/cloudflare → retry via get_proxied_client
          5c  Vérif content-type (skip PDF V1)
          5d  Tronquer body à 500 KB
          5e  trafilatura.extract(html) → texte propre + titre
          5f  Détection paywall patterns
          5g  ScrapedPage{url, final_url, title, text, status, bytes_fetched, fetched_via_proxy}

STEP 6  Mistral mini-summary parallèle (asyncio.gather)
        ├─ check cache vcache:external_page:{sha256(final_url)} (Redis)
        ├─ Si HIT → reuse
        ├─ Sinon llm_complete(model=plan_model, max_tokens=300, json_mode=True)
        ├─ Prompt FR : "Résume cette page en 2-3 phrases…"
        ├─ Save cache (TTL 7j)
        └─ List[PageSummary{url, final_url, title, summary, key_claims, status}]

STEP 7  Build final dict
        → {"extracted_at": iso8601, "pages": [...]}
```

### POST-ANALYSE

- UI Web : `<ExternalSourcesSection>` lit `summary.external_pages`
- UI Mobile : `<ExternalSourcesSection RN>` idem
- Extension : version compacte 1-2 lignes
- Chat v4 : injecté dans le system prompt comme "Contexte sources externes" si pertinent

### Décisions architecturales clés (tranchées)

| Décision | Choix | Justification |
|----------|-------|---------------|
| Stockage | Colonne `Summary.external_pages JSONB` | Évite jointure N+1, schéma flexible, lecture en un SELECT |
| Lancement | `asyncio.create_task()` fire-and-forget, awaited avant save | Non bloquant pour la synthèse principale, mais persistance atomique |
| Concurrency | `asyncio.Semaphore(5)` sur le scraping | Évite 20 connexions simultanées qui exploseraient le pool httpx |
| Proxy par défaut | Bare (shared_http_client), fallback proxy sur 403/429/CF | Économise ~90% bandwidth Decodo |
| Cache | Redis L1 only (pas de PG L2 dédié) | Pages externes changent peu, mais pas critiques au point de mériter une table |
| Format prompt | JSON mode (`json_mode=True`) | Évite parsing markdown fragile, structure stable {summary, key_claims} |
| Timeout global | 60s pour tout le bloc | Si on dépasse, on continue sans `external_pages` (gracieux) |
| Plan gating | Free=0 → CTA, Pro=5, Expert=10 | Coût Mistral × Pro=medium × Expert=large, alignement valeur perçue |

---

## 2. Extraction des URLs

### Source des descriptions

| Platform | Source de la description | Fichier source |
|----------|--------------------------|----------------|
| YouTube | `video_info["description"]` extrait par `get_video_info()` | `backend/src/videos/router.py` ligne 1413, 1683 |
| TikTok | HTML scraping → `data["description"][:2000]` | `backend/src/transcripts/tiktok.py` ligne 284, 383 |

La description est **déjà disponible dans `video_info`** au moment où la pipeline v6 commence le travail post-extraction. Aucune requête HTTP supplémentaire n'est nécessaire pour l'obtenir.

### Module à créer

**`backend/src/videos/external_pages/__init__.py`** (nouveau sous-module)

```
backend/src/videos/external_pages/
├── __init__.py
├── url_extractor.py        # Extraction + cleaning + filtering
├── url_resolver.py         # HEAD redirects resolver
├── scraper.py              # HTML fetch + readability
├── summarizer.py           # Mistral mini-summary + cache
├── orchestrator.py         # extract_external_pages() entry point
└── constants.py            # BLACKLIST, MAX_HOPS, TIMEOUT, etc.
```

### Algorithme d'extraction (`url_extractor.py`)

```python
import re
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from typing import List, Set

URL_PATTERN = re.compile(
    r'(?:'
    r'https?://[^\s<>"\'\)\]]+'
    r'|'
    r'www\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?'
    r'(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+'
    r'(?:/[^\s<>"\'\)\]]*)?'
    r')',
    re.IGNORECASE
)

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "utm_name", "utm_brand", "utm_social", "utm_social-type",
    "fbclid", "gclid", "dclid", "msclkid", "yclid",
    "mc_cid", "mc_eid", "_ga", "_gl",
    "ref", "ref_src", "ref_url", "referrer",
    "igshid", "feature", "si",
    "is_from_webapp", "sender_device", "sender_web_id",
}

BLACKLIST_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
    "tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
    "instagram.com", "www.instagram.com",
    "discord.gg", "discord.com",
    "patreon.com", "www.patreon.com",
    "facebook.com", "fb.me",
    "twitter.com", "x.com", "t.co",
    "snapchat.com",
    "linkedin.com",
    "spotify.com", "open.spotify.com",
}

SHORTENER_HOSTS = {
    "bit.ly", "buff.ly", "t.co", "lnkd.in", "ow.ly",
    "tinyurl.com", "is.gd", "goo.gl", "rb.gy",
    "tiny.cc", "shorturl.at", "cutt.ly",
}


def extract_urls_from_text(description: str) -> List[str]:
    """Extrait toutes les URLs candidates depuis une description vidéo."""
    if not description:
        return []
    raw = URL_PATTERN.findall(description)
    normalized: List[str] = []
    for u in raw:
        if u.lower().startswith("www."):
            u = "https://" + u
        u = u.rstrip(".,;:!?)")
        normalized.append(u)
    return normalized


def clean_url(url: str) -> str | None:
    """Nettoie une URL : strip tracking params, lowercase host, retire fragment."""
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return None
        kept = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=False)
                if k.lower() not in TRACKING_PARAMS]
        cleaned_query = urlencode(kept)
        netloc = parsed.netloc.lower()
        return urlunparse((parsed.scheme, netloc, parsed.path,
                           parsed.params, cleaned_query, ""))
    except Exception:
        return None


def is_blacklisted(url: str, creator_channel_url: str | None = None) -> bool:
    """True si l'URL doit être ignorée."""
    try:
        host = urlparse(url).netloc.lower().lstrip("www.")
        if host in BLACKLIST_HOSTS:
            return True
        if creator_channel_url:
            creator_host = urlparse(creator_channel_url).netloc.lower().lstrip("www.")
            if creator_host and creator_host == host:
                return True
        return False
    except Exception:
        return True


def clean_and_filter_urls(
    urls: List[str],
    creator_channel_url: str | None = None,
    max_count: int = 20,
) -> List[str]:
    """Applique clean_url + filter + dédup en préservant l'ordre."""
    seen: Set[str] = set()
    result: List[str] = []
    for u in urls:
        cleaned = clean_url(u)
        if cleaned is None:
            continue
        if is_blacklisted(cleaned, creator_channel_url):
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
        if len(result) >= max_count:
            break
    return result
```

### Limite par plan (avant resolve)

| Plan | Top N URLs distinctes après resolve |
|------|---|
| Free | 0 (feature désactivée, CTA en frontend) |
| Pro | 5 |
| Expert | 10 |

Avant resolve, on prend **max 20 candidats bruts**.

---

## 3. Résolution des URLs raccourcies

### Module : `url_resolver.py`

```python
from dataclasses import dataclass
from typing import Optional
import httpx
from core.http_client import get_proxied_client, shared_http_client
from core.logging import logger


@dataclass
class ResolvedURL:
    original_url: str
    final_url: str
    hops: int
    status_code: int
    error: Optional[str] = None


async def resolve_url(
    url: str,
    timeout: float = 5.0,
    max_hops: int = 5,
    use_proxy: bool = False,
) -> ResolvedURL:
    """Suit les redirections HEAD pour obtenir l'URL finale."""
    client_cm = get_proxied_client(timeout=timeout) if use_proxy else shared_http_client()
    try:
        async with client_cm as client:
            try:
                resp = await client.head(url, timeout=timeout, follow_redirects=True)
            except httpx.RequestError as e:
                return ResolvedURL(url, url, 0, 0, error=str(e))

            hops = len(resp.history)
            if hops > max_hops:
                return ResolvedURL(url, str(resp.url), hops, resp.status_code,
                                   error="too_many_hops")
            return ResolvedURL(
                original_url=url,
                final_url=str(resp.url),
                hops=hops,
                status_code=resp.status_code,
            )
    except Exception as e:
        logger.debug(f"[EXTERNAL_PAGES] resolve_url failed {url}: {e}")
        return ResolvedURL(url, url, 0, 0, error=str(e))


async def resolve_urls(
    urls: list[str],
    timeout: float = 5.0,
) -> list[ResolvedURL]:
    """Résout N URLs en parallèle, dédoublonne par final_url."""
    import asyncio
    tasks = [resolve_url(u, timeout=timeout) for u in urls]
    results = await asyncio.gather(*tasks, return_exceptions=False)
    seen: set[str] = set()
    deduped: list[ResolvedURL] = []
    for r in results:
        if r.final_url in seen:
            continue
        seen.add(r.final_url)
        deduped.append(r)
    return deduped
```

### Comportement edge cases

| Cas | Comportement |
|-----|--------------|
| Timeout 5s | `error="timeout"`, on garde quand même l'URL originale |
| > 5 hops | `error="too_many_hops"`, on drop |
| 4xx/5xx au HEAD | On garde l'URL et on tente le GET en §4 |
| DNS error | On drop |
| Connection refused | On drop |

---

## 4. Scraping du contenu

### Choix : `trafilatura` (PAS `readability-lxml`)

| Outil | Pour | Contre |
|-------|------|--------|
| `readability-lxml` | API simple, stable | Boilerplate higher |
| `trafilatura` | Précision SoTA sur 1000+ benchmarks, retourne meta (title, author, date), JSON natif | Dépendance lourde (~30 MB) |
| `newspaper3k` | Légère | Maintenance erratique 2024+ |

**Décision : `trafilatura==1.12.0`** (latest stable 2026-05). Fallback `readability-lxml` si trafilatura échoue.

Ajouter dans `backend/requirements.txt` :
```
trafilatura==1.12.0
readability-lxml==0.8.1
```

### Module : `scraper.py`

```python
from dataclasses import dataclass
from typing import Optional
import asyncio
import httpx
import trafilatura
from readability import Document as ReadabilityDocument
from bs4 import BeautifulSoup

from core.http_client import get_proxied_client, shared_http_client
from core.logging import logger
from middleware.proxy_telemetry import record_proxy_usage

MAX_HTML_BYTES = 500 * 1024
SCRAPE_TIMEOUT = 12.0
PAYWALL_PATTERNS = [
    "subscribers-only", "paywall", "premium-content",
    "subscribe to read", "abonnés uniquement", "réservé aux abonnés",
    "this article is exclusive to", "members-only",
]
SKIP_CONTENT_TYPES = {
    "application/pdf", "application/zip", "application/octet-stream",
    "video/", "audio/", "image/",
}


@dataclass
class ScrapedPage:
    url: str
    final_url: str
    title: Optional[str]
    text: Optional[str]
    status: str
    bytes_fetched: int
    fetched_via_proxy: bool
    error: Optional[str] = None


async def _fetch_html(
    url: str,
    use_proxy: bool,
    timeout: float = SCRAPE_TIMEOUT,
) -> tuple[Optional[str], int, str, int]:
    """Fetch raw HTML. Returns (html, bytes_read, content_type, status_code)."""
    client_cm = get_proxied_client(timeout=timeout) if use_proxy else shared_http_client()
    try:
        async with client_cm as client:
            async with client.stream("GET", url, timeout=timeout) as resp:
                content_type = resp.headers.get("content-type", "").lower().split(";")[0]
                if any(content_type.startswith(s) for s in SKIP_CONTENT_TYPES):
                    return None, 0, content_type, resp.status_code

                bytes_buf = bytearray()
                async for chunk in resp.aiter_bytes():
                    bytes_buf.extend(chunk)
                    if len(bytes_buf) >= MAX_HTML_BYTES:
                        break
                try:
                    html = bytes_buf.decode("utf-8", errors="replace")
                except Exception:
                    html = bytes_buf.decode("latin-1", errors="replace")
                return html, len(bytes_buf), content_type, resp.status_code
    except httpx.HTTPError as e:
        logger.debug(f"[EXTERNAL_PAGES] _fetch_html httpx error {url}: {e}")
        return None, 0, "", 0


def _detect_paywall(html: str) -> bool:
    """Heuristique : cherche des patterns de paywall dans le HTML."""
    if not html:
        return False
    lowered = html.lower()
    return any(p in lowered for p in PAYWALL_PATTERNS)


def _extract_content(html: str, url: str) -> tuple[Optional[str], Optional[str]]:
    """Tente trafilatura, fallback readability. Returns (title, text)."""
    try:
        extracted = trafilatura.extract(
            html,
            output_format="json",
            include_comments=False,
            include_tables=False,
            with_metadata=True,
            url=url,
        )
        if extracted:
            import json
            data = json.loads(extracted)
            title = data.get("title")
            text = data.get("text") or data.get("raw_text")
            if text and len(text.strip()) >= 200:
                return title, text.strip()[:8000]
    except Exception as e:
        logger.debug(f"[EXTERNAL_PAGES] trafilatura failed: {e}")

    try:
        doc = ReadabilityDocument(html)
        title = doc.title()
        cleaned_html = doc.summary()
        soup = BeautifulSoup(cleaned_html, "html.parser")
        text = soup.get_text(separator=" ", strip=True)
        if text and len(text) >= 200:
            return title, text[:8000]
    except Exception as e:
        logger.debug(f"[EXTERNAL_PAGES] readability fallback failed: {e}")
    return None, None


async def scrape_page(
    url: str,
    final_url: str,
    initial_status: int = 0,
) -> ScrapedPage:
    """Scrape une page externe en suivant la stratégie bare-first puis proxy fallback."""
    html, bytes_in, content_type, status = await _fetch_html(final_url, use_proxy=False)
    fetched_via_proxy = False

    cf_signal = status == 403 or status == 429 or (
        html and ("cloudflare" in html.lower()[:5000] or "_cf_chl" in html.lower()[:5000])
    )
    if cf_signal:
        logger.info(f"[EXTERNAL_PAGES] {final_url} → CF/403 detected, retry via proxy")
        html, bytes_in, content_type, status = await _fetch_html(final_url, use_proxy=True)
        fetched_via_proxy = True
        if bytes_in > 0:
            try:
                await record_proxy_usage(
                    provider="external_page_scrape",
                    bytes_in=bytes_in,
                    bytes_out=0,
                )
            except Exception:
                pass

    if status == 404:
        return ScrapedPage(url, final_url, None, None, "not_found",
                           bytes_in, fetched_via_proxy)
    if status == 0 or status >= 500:
        return ScrapedPage(url, final_url, None, None, "error",
                           bytes_in, fetched_via_proxy,
                           error=f"http_{status}")
    if html is None:
        if content_type and content_type not in ("text/html", "application/xhtml+xml"):
            return ScrapedPage(url, final_url, None, None, "skipped_content_type",
                               bytes_in, fetched_via_proxy,
                               error=f"content_type={content_type}")
        return ScrapedPage(url, final_url, None, None, "error",
                           bytes_in, fetched_via_proxy, error="empty_html")

    if _detect_paywall(html):
        title, _ = _extract_content(html, final_url)
        return ScrapedPage(url, final_url, title, None, "paywalled",
                           bytes_in, fetched_via_proxy)

    title, text = _extract_content(html, final_url)
    if not text:
        return ScrapedPage(url, final_url, title, None, "error",
                           bytes_in, fetched_via_proxy, error="extraction_failed")

    return ScrapedPage(url, final_url, title, text, "ok",
                       bytes_in, fetched_via_proxy)


async def scrape_pages_concurrent(
    resolved: list,
    max_concurrent: int = 5,
) -> list[ScrapedPage]:
    """Scrape N pages en parallèle, max_concurrent in-flight."""
    semaphore = asyncio.Semaphore(max_concurrent)

    async def _bounded(r):
        async with semaphore:
            return await scrape_page(r.original_url, r.final_url, r.status_code)

    tasks = [_bounded(r) for r in resolved]
    return await asyncio.gather(*tasks, return_exceptions=False)
```

### Détection paywall — patterns

| Site | Pattern HTML détectable |
|------|--------------------------|
| Substack premium | `subscribers-only`, `subscribe-button` |
| Medium membership | `meteredContent`, `Sign in to read` |
| Bloomberg / WSJ / NYT | `paywall`, `subscribe to continue` |
| Le Monde / Le Figaro | `réservé aux abonnés`, `article-paywall` |
| The Information | `members-only` |
| Stratechery | `subscribers-only` |

### Edge cases scraping

| Cas | Status output | Comportement UI |
|-----|--------------|----------------|
| 200 OK + texte ≥ 200 chars | `"ok"` | Carte normale avec résumé |
| 200 OK + paywall pattern | `"paywalled"` | Carte avec titre + "Article payant" |
| 404 | `"not_found"` | Carte grisée "Page introuvable" |
| 5xx | `"error"` | Carte grisée "Erreur d'accès" |
| Content-Type `application/pdf` | `"skipped_content_type"` | Carte avec "PDF non analysé en V1" |
| Timeout | `"error"` (error="timeout") | Carte grisée "Site trop lent" |
| HTML extracted text < 200 chars | `"error"` | Carte grisée "Contenu non extractible" |

---

## 5. Résumé Mistral par URL

### Module : `summarizer.py`

```python
import hashlib
import json
from dataclasses import dataclass
from typing import Optional
import asyncio

from core.llm_provider import llm_complete
from core.cache import cache_service
from core.logging import logger


@dataclass
class PageSummary:
    url: str
    final_url: str
    title: Optional[str]
    summary: Optional[str]
    key_claims: list[str]
    status: str
    fetched_via_proxy: bool
    bytes_fetched: int


def _cache_key(final_url: str) -> str:
    """Clé Redis cross-user."""
    h = hashlib.sha256(final_url.encode("utf-8")).hexdigest()[:16]
    return f"vcache:external_page:{h}"


def _build_prompt(
    page_text: str,
    page_title: Optional[str],
    creator_channel: str,
    video_title: str,
    lang: str = "fr",
) -> list[dict]:
    """Construit le prompt JSON-mode pour Mistral."""
    system = (
        "Tu es un assistant qui résume des pages web citées par des créateurs vidéo. "
        "Sois factuel, neutre, jamais promotionnel. Résume TOUJOURS en français même "
        "si la page est en anglais ou dans une autre langue. "
        "Réponds en JSON strict avec les clés 'summary' (2-3 phrases) et "
        "'key_claims' (liste de 1 à 4 affirmations clés ou faits, chacune ≤ 15 mots)."
    )
    user = (
        f"Contexte : cette page est citée dans la description de la vidéo "
        f"\"{video_title}\" par le créateur \"{creator_channel}\".\n\n"
        f"Titre de la page : {page_title or 'inconnu'}\n\n"
        f"Contenu de la page (extrait) :\n{page_text[:6000]}\n\n"
        f"Résume en JSON : {{\"summary\": \"...\", \"key_claims\": [\"...\", \"...\"]}}"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


async def summarize_page(
    scraped,
    creator_channel: str,
    video_title: str,
    user_plan: str,
    lang: str = "fr",
) -> PageSummary:
    """Résume une page via Mistral + cache cross-user."""
    if scraped.status != "ok" or not scraped.text:
        return PageSummary(
            url=scraped.url,
            final_url=scraped.final_url,
            title=scraped.title,
            summary=None,
            key_claims=[],
            status=scraped.status,
            fetched_via_proxy=scraped.fetched_via_proxy,
            bytes_fetched=scraped.bytes_fetched,
        )

    ckey = _cache_key(scraped.final_url)
    try:
        cached = await cache_service.get(ckey)
        if cached:
            cached_data = json.loads(cached) if isinstance(cached, str) else cached
            return PageSummary(
                url=scraped.url,
                final_url=scraped.final_url,
                title=cached_data.get("title") or scraped.title,
                summary=cached_data.get("summary"),
                key_claims=cached_data.get("key_claims", []),
                status="ok",
                fetched_via_proxy=scraped.fetched_via_proxy,
                bytes_fetched=scraped.bytes_fetched,
            )
    except Exception as e:
        logger.debug(f"[EXTERNAL_PAGES] cache get failed {ckey}: {e}")

    from billing.plan_config import normalize_plan_id
    plan = normalize_plan_id(user_plan)
    model = {
        "free": "mistral-small-2603",
        "pro": "mistral-medium-2508",
        "expert": "mistral-large-2512",
    }.get(plan, "mistral-small-2603")

    messages = _build_prompt(
        scraped.text, scraped.title, creator_channel, video_title, lang
    )

    try:
        result = await llm_complete(
            messages=messages,
            model=model,
            max_tokens=300,
            temperature=0.2,
            timeout=20.0,
            json_mode=True,
        )
    except Exception as e:
        logger.warning(f"[EXTERNAL_PAGES] Mistral call failed for {scraped.final_url}: {e}")
        result = None

    if not result or not result.content:
        return PageSummary(
            url=scraped.url,
            final_url=scraped.final_url,
            title=scraped.title,
            summary=None,
            key_claims=[],
            status="error",
            fetched_via_proxy=scraped.fetched_via_proxy,
            bytes_fetched=scraped.bytes_fetched,
        )

    try:
        data = json.loads(result.content)
        summary = (data.get("summary") or "").strip()
        key_claims = data.get("key_claims", [])
        if not isinstance(key_claims, list):
            key_claims = []
        key_claims = [str(c).strip() for c in key_claims if c][:4]
    except (json.JSONDecodeError, AttributeError, TypeError):
        summary = result.content.strip()[:500]
        key_claims = []

    try:
        await cache_service.set(
            ckey,
            json.dumps({
                "title": scraped.title,
                "summary": summary,
                "key_claims": key_claims,
            }),
            ttl=7 * 24 * 3600,
        )
    except Exception as e:
        logger.debug(f"[EXTERNAL_PAGES] cache set failed {ckey}: {e}")

    return PageSummary(
        url=scraped.url,
        final_url=scraped.final_url,
        title=scraped.title,
        summary=summary,
        key_claims=key_claims,
        status="ok",
        fetched_via_proxy=scraped.fetched_via_proxy,
        bytes_fetched=scraped.bytes_fetched,
    )


async def summarize_pages_concurrent(
    scraped_pages: list,
    creator_channel: str,
    video_title: str,
    user_plan: str,
    lang: str = "fr",
    max_concurrent: int = 5,
) -> list[PageSummary]:
    semaphore = asyncio.Semaphore(max_concurrent)

    async def _bounded(s):
        async with semaphore:
            return await summarize_page(s, creator_channel, video_title, user_plan, lang)

    tasks = [_bounded(s) for s in scraped_pages]
    return await asyncio.gather(*tasks, return_exceptions=False)
```

### Stratégie de cache

- **Clé** : `vcache:external_page:{sha256(final_url)[:16]}`
- **TTL** : 7 jours
- **Scope** : cross-user
- **Invalidation** : passive (TTL). Pas d'invalidation manuelle V1.

### Format de retour Mistral attendu

```json
{
  "summary": "L'article décrit la levée Series B de Mistral AI à 1 Md$ en novembre 2024, valorisée 6 Md$. Le tour est mené par General Catalyst avec Lightspeed et Andreessen Horowitz en suiveurs.",
  "key_claims": [
    "Series B de 1 Md$ levée en novembre 2024",
    "Valorisation post-money : 6 Md$",
    "Lead investor : General Catalyst"
  ]
}
```

---

## 6. Stockage DB

### Décision : colonne `Summary.external_pages JSONB`

**Pas de table dédiée** :
1. Pas de queries SQL sur le contenu (lecture en bloc)
2. Schéma évolutif
3. Pas de FK utilisée
4. Cohérence avec le pattern existant
5. Volume : ~5 KB par row
6. Read pattern : 1 SELECT ramène tout

### Schéma JSON canonique

```json
{
  "extracted_at": "2026-05-17T10:00:00Z",
  "schema_version": 1,
  "stats": {
    "candidates_found": 12,
    "after_dedup": 8,
    "after_blacklist": 6,
    "after_cap": 5,
    "successful": 4,
    "paywalled": 1,
    "errored": 0
  },
  "pages": [
    {
      "url": "https://t.co/abcdef",
      "final_url": "https://stratechery.com/2024/the-mistral-moment/",
      "title": "The Mistral Moment",
      "summary": "L'article analyse la position stratégique de Mistral AI face à OpenAI et Anthropic en 2024, en soulignant l'avantage européen sur la souveraineté.",
      "key_claims": [
        "Mistral lève 1Md$ Series B nov 2024",
        "Valorisation 6 Md$ post-money",
        "Stratégie open-weights vs closed-source"
      ],
      "status": "ok",
      "fetched_via_proxy": false,
      "bytes_fetched": 45230
    },
    {
      "url": "https://www.lemonde.fr/...",
      "final_url": "https://www.lemonde.fr/economie/article/...",
      "title": "Mistral AI lève 1 milliard",
      "summary": null,
      "key_claims": [],
      "status": "paywalled",
      "fetched_via_proxy": true,
      "bytes_fetched": 12000
    }
  ]
}
```

### Modification du modèle

**Fichier** : `backend/src/db/database.py` (classe `Summary`)

```python
# External pages citation (spec 2026-05-17)
external_pages = Column(JSON, nullable=True)
```

### Migration Alembic

**Fichier** : `backend/alembic/versions/029_summary_external_pages.py`

```python
"""summary_external_pages — column JSONB pour pages externes citées (V1)

Revision ID: 029_summary_ext_pages
Revises: 028_bot_prospection
Create Date: 2026-05-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "029_summary_ext_pages"
down_revision: Union[str, None] = "028_bot_prospection"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "external_pages" in columns:
        return

    op.add_column(
        "summaries",
        sa.Column(
            "external_pages",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "external_pages" not in columns:
        return

    op.drop_column("summaries", "external_pages")
```

### Schéma TypeScript (mirror frontend / mobile / extension)

**Fichier** : `frontend/src/types/analysis.ts`

```typescript
export interface ExternalPageCitation {
  url: string;
  final_url: string;
  title: string | null;
  summary: string | null;
  key_claims: string[];
  status: "ok" | "paywalled" | "not_found" | "skipped_content_type" | "error";
  fetched_via_proxy: boolean;
  bytes_fetched: number;
}

export interface ExternalPagesData {
  extracted_at: string;
  schema_version: 1;
  stats: {
    candidates_found: number;
    after_dedup: number;
    after_blacklist: number;
    after_cap: number;
    successful: number;
    paywalled: number;
    errored: number;
  };
  pages: ExternalPageCitation[];
}

export interface Summary {
  external_pages: ExternalPagesData | null;
}
```

---

## 7. Intégration dans pipeline v6

### Orchestrator : `external_pages/orchestrator.py`

```python
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from core.logging import logger
from billing.plan_config import normalize_plan_id

from .url_extractor import extract_urls_from_text, clean_and_filter_urls
from .url_resolver import resolve_urls
from .scraper import scrape_pages_concurrent
from .summarizer import summarize_pages_concurrent


PLAN_CAPS: Dict[str, int] = {
    "free": 0,
    "pro": 5,
    "expert": 10,
}


async def extract_external_pages(
    description: str,
    creator_channel: str,
    creator_channel_url: Optional[str],
    video_title: str,
    user_plan: str,
    lang: str = "fr",
) -> Optional[Dict[str, Any]]:
    """Pipeline complète : extract → resolve → scrape → summarize."""
    plan = normalize_plan_id(user_plan)
    cap = PLAN_CAPS.get(plan, 0)

    if cap <= 0:
        return None

    if not description:
        return None

    started_at = datetime.now(timezone.utc)

    raw_urls = extract_urls_from_text(description)
    if not raw_urls:
        return None

    cleaned = clean_and_filter_urls(
        raw_urls,
        creator_channel_url=creator_channel_url,
        max_count=20,
    )
    if not cleaned:
        return None

    resolved = await resolve_urls(cleaned, timeout=5.0)
    if not resolved:
        return None

    capped = resolved[:cap]

    scraped = await scrape_pages_concurrent(capped, max_concurrent=5)

    summarized = await summarize_pages_concurrent(
        scraped,
        creator_channel=creator_channel,
        video_title=video_title,
        user_plan=plan,
        lang=lang,
        max_concurrent=5,
    )

    stats = {
        "candidates_found": len(raw_urls),
        "after_dedup": len(cleaned),
        "after_blacklist": len(cleaned),
        "after_cap": len(capped),
        "successful": sum(1 for p in summarized if p.status == "ok"),
        "paywalled": sum(1 for p in summarized if p.status == "paywalled"),
        "errored": sum(1 for p in summarized
                       if p.status in ("error", "not_found", "skipped_content_type")),
    }

    pages_json = [
        {
            "url": p.url,
            "final_url": p.final_url,
            "title": p.title,
            "summary": p.summary,
            "key_claims": p.key_claims,
            "status": p.status,
            "fetched_via_proxy": p.fetched_via_proxy,
            "bytes_fetched": p.bytes_fetched,
        }
        for p in summarized
    ]

    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
    logger.info(
        f"[EXTERNAL_PAGES] done in {elapsed:.1f}s — stats={stats}"
    )

    return {
        "extracted_at": started_at.isoformat(),
        "schema_version": 1,
        "stats": stats,
        "pages": pages_json,
    }
```

### Intégration dans `backend/src/videos/router.py`

#### Step A — Lancement fire-and-forget

```python
from videos.external_pages.orchestrator import extract_external_pages

_external_pages_task: Optional[asyncio.Task] = None
try:
    _external_pages_task = asyncio.create_task(
        extract_external_pages(
            description=video_info.get("description", "") or "",
            creator_channel=video_info.get("channel", "") or "",
            creator_channel_url=video_info.get("channel_url"),
            video_title=video_info.get("title", "") or "",
            user_plan=user_plan,
            lang=lang or "fr",
        ),
        name=f"external_pages_{task_id}",
    )
    logger.info(f"[EXTERNAL_PAGES] task spawned for task_id={task_id}")
except Exception as e:
    logger.warning(f"[EXTERNAL_PAGES] failed to spawn task: {e}")
    _external_pages_task = None
```

#### Step B — Await avant save_summary

```python
_external_pages_data = None
if _external_pages_task is not None:
    try:
        _external_pages_data = await asyncio.wait_for(
            _external_pages_task,
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        logger.warning(f"[EXTERNAL_PAGES] timeout 60s for task_id={task_id}")
        _external_pages_task.cancel()
    except Exception as e:
        logger.warning(f"[EXTERNAL_PAGES] task failed: {e}")
```

#### Step C — Passer à `save_summary`

```python
async def save_summary(
    session: AsyncSession,
    *,
    user_id: int,
    video_id: str,
    external_pages: Optional[Dict[str, Any]] = None,
) -> int:
    summary = Summary(
        external_pages=external_pages,
    )
    session.add(summary)
    await session.commit()
    return summary.id
```

---

## 8. Plan gating

### Capability matrix

| Plan | URLs max | Modèle Mistral | Key claims détaillés | Cache cross-user |
|------|---------|----------------|----------------------|------------------|
| Free | 0 | — | — | N/A |
| Pro | 5 | mistral-medium-2508 | jusqu'à 4 par page | Oui |
| Expert | 10 | mistral-large-2512 | jusqu'à 4 par page + meilleur extraction | Oui |

Différence Pro/Expert au-delà du nombre :
- **Pro** : prompt standard, `max_tokens=300`
- **Expert** : prompt enrichi, `max_tokens=500`

### Feature flag SSOT

```python
# Free
"external_pages_max": 0,
# Pro
"external_pages_max": 5,
# Expert
"external_pages_max": 10,
```

---

## 9. UI tri-plateforme

### Layout général

**Position** : section dédiée dans la vue analyse, sous "Synthèse" et au-dessus de "Sources web". Titre : "Sources externes citées" (FR) / "External Sources Cited" (EN).

### Web : `frontend/src/components/analysis/ExternalSourcesSection.tsx`

```tsx
import React from "react";
import { ExternalPagesData, ExternalPageCitation } from "@/types/analysis";
import { useLanguage } from "@/contexts/LanguageContext";
import { ExternalSourceCard } from "./ExternalSourceCard";
import { UpgradeCTACard } from "@/components/upgrade/UpgradeCTACard";
import { useUserPlan } from "@/hooks/useUserPlan";

interface Props {
  data: ExternalPagesData | null;
}

export function ExternalSourcesSection({ data }: Props) {
  const { language, t } = useLanguage();
  const { plan } = useUserPlan();

  if (plan === "free") {
    return (
      <UpgradeCTACard
        title={t("external_sources.cta_title")}
        body={t("external_sources.cta_body")}
        cta={t("external_sources.cta_button")}
        targetPlan="pro"
        analyticsEvent="external_sources_cta_view"
      />
    );
  }

  if (!data || data.pages.length === 0) {
    return null;
  }

  return (
    <section
      className="external-sources-section mt-8"
      data-testid="external-sources-section"
    >
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-text-primary">
          {t("external_sources.title")}
        </h3>
        <span className="text-xs text-text-tertiary">
          {data.stats.successful}/{data.pages.length} {t("external_sources.processed")}
        </span>
      </header>

      <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory">
        {data.pages.map((page) => (
          <ExternalSourceCard key={page.final_url} page={page} />
        ))}
      </div>
    </section>
  );
}
```

#### `ExternalSourceCard.tsx`

```tsx
import { ExternalLink, AlertCircle, Lock, FileX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props { page: ExternalPageCitation; }

export function ExternalSourceCard({ page }: Props) {
  const { t } = useLanguage();
  const host = new URL(page.final_url).hostname.replace(/^www\./, "");
  const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=32`;

  const renderBody = () => {
    if (page.status === "paywalled") {
      return (
        <div className="flex items-center gap-2 text-amber-400">
          <Lock size={14} /> {t("external_sources.paywalled")}
        </div>
      );
    }
    if (page.status === "not_found") {
      return (
        <div className="flex items-center gap-2 text-rose-400">
          <FileX size={14} /> {t("external_sources.not_found")}
        </div>
      );
    }
    if (page.status === "error" || page.status === "skipped_content_type") {
      return (
        <div className="flex items-center gap-2 text-text-tertiary">
          <AlertCircle size={14} /> {t("external_sources.unavailable")}
        </div>
      );
    }
    return (
      <>
        <p className="text-sm text-text-secondary line-clamp-3">
          {page.summary}
        </p>
        {page.key_claims.length > 0 && (
          <ul className="mt-2 text-xs text-text-tertiary list-disc list-inside space-y-1">
            {page.key_claims.slice(0, 2).map((claim, i) => (
              <li key={i} className="line-clamp-1">{claim}</li>
            ))}
          </ul>
        )}
      </>
    );
  };

  return (
    <article
      className="snap-start flex-shrink-0 w-72 bg-surface-elevated border border-white/5 rounded-lg p-4 hover:border-white/10 transition-colors"
      data-testid={`external-source-${page.final_url}`}
    >
      <header className="flex items-center gap-2 mb-2">
        <img src={favicon} width={16} height={16} alt="" className="rounded-sm" />
        <span className="text-xs text-text-tertiary truncate">{host}</span>
      </header>

      <h4 className="text-sm font-semibold text-text-primary line-clamp-2 mb-2">
        {page.title || page.final_url}
      </h4>

      {renderBody()}

      <a
        href={page.final_url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
        onClick={() => analytics.track("external_source_click", {
          host, final_url: page.final_url,
        })}
      >
        {t("external_sources.open")} <ExternalLink size={12} />
      </a>
    </article>
  );
}
```

### Mobile : `mobile/src/components/analysis/ExternalSourcesSection.tsx`

```tsx
import { View, Text, FlatList, Linking, Pressable, Image } from "react-native";
import { ExternalLink, Lock, FileX, AlertCircle } from "lucide-react-native";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlan } from "@/contexts/PlanContext";

export function ExternalSourcesSection({ data }: Props) {
  const { t } = useTranslation();
  const { plan } = usePlan();

  if (plan === "free") {
    return <UpgradeCTACard featureKey="external_sources" />;
  }
  if (!data || data.pages.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("external_sources.title")}</Text>
        <Text style={styles.stats}>
          {data.stats.successful}/{data.pages.length}
        </Text>
      </View>
      <FlatList
        data={data.pages}
        keyExtractor={(item) => item.final_url}
        scrollEnabled={false}
        renderItem={({ item }) => <ExternalSourceCardMobile page={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}
```

### Extension : `extension/src/popup/components/ExternalSourcesCompact.tsx`

```tsx
export function ExternalSourcesCompact({ data, language }: Props) {
  if (!data || data.pages.length === 0) return null;

  const visible = data.pages.filter((p) => p.status === "ok").slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="ds-external-sources-compact">
      <span className="ds-label">
        {visible.length} {t("external_sources.cited", language)}:
      </span>
      <div className="ds-chips">
        {visible.map((p) => {
          const host = new URL(p.final_url).hostname.replace(/^www\./, "");
          return (
            <a
              key={p.final_url}
              href={p.final_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="ds-chip"
              title={p.title || ""}
            >
              {host}
            </a>
          );
        })}
      </div>
      {data.pages.length > 3 && (
        <a
          className="ds-cta-web"
          href={`https://www.deepsightsynthesis.com/analysis/${summaryId}`}
          target="_blank"
        >
          {t("external_sources.view_all_on_web", language)} →
        </a>
      )}
    </div>
  );
}
```

### i18n keys à ajouter

**FR** :

```json
{
  "external_sources": {
    "title": "Sources externes citées",
    "processed": "traitées",
    "open": "Ouvrir",
    "paywalled": "Article payant non accessible",
    "not_found": "Page introuvable",
    "unavailable": "Contenu non extractible",
    "cited": "sources citées",
    "view_all_on_web": "Voir détails sur l'app web",
    "cta_title": "Sources externes — Plan Pro",
    "cta_body": "Découvrez chaque lien cité dans la description : article, papier, produit, Substack. Mini-résumé par lien.",
    "cta_button": "Passer Pro"
  }
}
```

**EN** :

```json
{
  "external_sources": {
    "title": "External Sources Cited",
    "processed": "processed",
    "open": "Open",
    "paywalled": "Paywalled article",
    "not_found": "Page not found",
    "unavailable": "Content unavailable",
    "cited": "sources cited",
    "view_all_on_web": "View details on web app",
    "cta_title": "External Sources — Pro Plan",
    "cta_body": "See every link cited in the description: article, paper, product, Substack. Mini-summary per link.",
    "cta_button": "Upgrade to Pro"
  }
}
```

### Accessibilité

- `<a target="_blank" rel="noopener noreferrer nofollow">`
- Favicon en `<img alt="">`
- `data-testid` sur chaque card pour Playwright
- Focus visible sur les CTA card
- Aria-label sur "Ouvrir" : `${t("external_sources.open")} ${page.title}`

---

## 10. Coût Decodo projeté

### Estimation par analyse

| Variable | Valeur |
|----------|--------|
| URLs moyennes par vidéo Pro/Expert | 3-7 |
| Taille moyenne page scrapée | 30-100 KB |
| Pages nécessitant proxy (% détection CF/403) | ~10% |
| Bytes proxifiés par analyse moyenne | 5 × 60 KB × 10% = **30 KB / analyse** |

### Estimation mensuelle

| Plan | Analyses/mois | Bytes/mois proxy |
|------|---------------|------------------|
| Pro | ~300 | ~9 MB |
| Expert | ~500 | ~15 MB |
| **TOTAL** | **~800** | **~24 MB/mois** |

À comparer au budget Decodo hard-stop **950 MB/mois** → la feature consomme **~2.5%** du quota.

### Décision stratégie proxy

**Bare-first, proxy-fallback sur signal CF/403/429.**

| Stratégie | Bytes/mois | Coût Decodo |
|-----------|------------|-------------|
| Tout via proxy (worst case) | ~240 MB | ~$0.95 |
| Bare-first + fallback (ACTUEL) | ~24 MB | ~$0.10 |
| Tout bare (jamais proxy) | 0 MB | $0 mais perte 10% des pages |

### Monitoring

- Provider `external_page_scrape` apparaît dans `proxy_usage_daily.requests_by_provider`
- Dashboard PostHog 663159
- Alerte n8n si `external_page_scrape > 100 MB/mois`

---

## 11. Tests

### Backend

#### Unit : `backend/tests/test_url_extractor.py`

```python
import pytest
from videos.external_pages.url_extractor import (
    extract_urls_from_text,
    clean_url,
    is_blacklisted,
    clean_and_filter_urls,
)


class TestExtractURLsFromText:
    def test_extracts_https_urls(self):
        text = "Voir https://stratechery.com/2024/mistral-moment et ensuite."
        assert extract_urls_from_text(text) == ["https://stratechery.com/2024/mistral-moment"]

    def test_extracts_www_urls_adds_scheme(self):
        text = "Lien : www.example.com/path"
        result = extract_urls_from_text(text)
        assert result == ["https://www.example.com/path"]

    def test_strips_trailing_punctuation(self):
        text = "Voir https://example.com."
        assert extract_urls_from_text(text) == ["https://example.com"]

    def test_handles_multiple_urls(self):
        text = "A: https://a.com B: https://b.com C: www.c.com"
        result = extract_urls_from_text(text)
        assert len(result) == 3

    def test_empty_text(self):
        assert extract_urls_from_text("") == []
        assert extract_urls_from_text(None) == []


class TestCleanURL:
    def test_strips_utm_params(self):
        url = "https://blog.com/post?utm_source=twitter&utm_medium=social&id=42"
        result = clean_url(url)
        assert result == "https://blog.com/post?id=42"

    def test_strips_fbclid(self):
        url = "https://news.com/a?fbclid=abc123"
        assert clean_url(url) == "https://news.com/a"

    def test_lowercases_host(self):
        url = "https://EXAMPLE.com/Path"
        assert clean_url(url) == "https://example.com/Path"

    def test_invalid_url_returns_none(self):
        assert clean_url("not a url") is None
        assert clean_url("") is None


class TestIsBlacklisted:
    def test_youtube_blacklisted(self):
        assert is_blacklisted("https://youtube.com/watch?v=abc")
        assert is_blacklisted("https://m.youtube.com/...")

    def test_tiktok_blacklisted(self):
        assert is_blacklisted("https://www.tiktok.com/@x")

    def test_self_channel_filter(self):
        creator = "https://www.youtube.com/@mychannel"
        assert is_blacklisted("https://www.youtube.com/@mychannel", creator)

    def test_regular_blog_not_blacklisted(self):
        assert not is_blacklisted("https://stratechery.com/2024")


class TestCleanAndFilterURLs:
    def test_dedup(self):
        urls = ["https://a.com", "https://a.com/?utm_source=x", "https://a.com"]
        assert clean_and_filter_urls(urls) == ["https://a.com"]

    def test_max_count(self):
        urls = [f"https://site{i}.com" for i in range(50)]
        result = clean_and_filter_urls(urls, max_count=10)
        assert len(result) == 10

    def test_preserves_order(self):
        urls = ["https://c.com", "https://a.com", "https://b.com"]
        result = clean_and_filter_urls(urls)
        assert result == ["https://c.com", "https://a.com", "https://b.com"]
```

#### Unit : `backend/tests/test_external_page_scraper.py`

```python
import pytest
import httpx
from unittest.mock import AsyncMock, patch
from videos.external_pages.scraper import (
    _detect_paywall,
    _extract_content,
    scrape_page,
)


class TestDetectPaywall:
    def test_substack_pattern(self):
        html = '<div class="subscribers-only">Premium content</div>'
        assert _detect_paywall(html)

    def test_lemonde_pattern(self):
        html = '<p>Article réservé aux abonnés</p>'
        assert _detect_paywall(html)

    def test_normal_blog_no_paywall(self):
        html = '<article>Content libre et accessible.</article>'
        assert not _detect_paywall(html)


@pytest.mark.asyncio
class TestScrapePage:
    @pytest.fixture(autouse=True)
    def mock_record_proxy(self):
        with patch("videos.external_pages.scraper.record_proxy_usage", new=AsyncMock()):
            yield

    async def test_scrape_ok_status_with_bare_client(self, monkeypatch):
        async def _fake_fetch(url, use_proxy, timeout):
            html = "<html><body><article><p>" + "A" * 300 + "</p></article></body></html>"
            return html, len(html), "text/html", 200
        monkeypatch.setattr("videos.external_pages.scraper._fetch_html", _fake_fetch)
        result = await scrape_page("https://example.com", "https://example.com")
        assert result.status == "ok"
        assert not result.fetched_via_proxy

    async def test_scrape_fallback_proxy_on_403(self, monkeypatch):
        calls = []
        async def _fake_fetch(url, use_proxy, timeout):
            calls.append(use_proxy)
            if not use_proxy:
                return None, 0, "", 403
            html = "<html><body><article><p>" + "B" * 300 + "</p></article></body></html>"
            return html, len(html), "text/html", 200
        monkeypatch.setattr("videos.external_pages.scraper._fetch_html", _fake_fetch)
        result = await scrape_page("https://example.com", "https://example.com")
        assert result.status == "ok"
        assert result.fetched_via_proxy
        assert calls == [False, True]

    async def test_scrape_404(self, monkeypatch):
        async def _fake_fetch(url, use_proxy, timeout):
            return None, 0, "", 404
        monkeypatch.setattr("videos.external_pages.scraper._fetch_html", _fake_fetch)
        result = await scrape_page("https://example.com", "https://example.com")
        assert result.status == "not_found"

    async def test_scrape_pdf_skipped(self, monkeypatch):
        async def _fake_fetch(url, use_proxy, timeout):
            return None, 0, "application/pdf", 200
        monkeypatch.setattr("videos.external_pages.scraper._fetch_html", _fake_fetch)
        result = await scrape_page("https://example.com/file.pdf", "https://example.com/file.pdf")
        assert result.status == "skipped_content_type"

    async def test_scrape_paywall(self, monkeypatch):
        async def _fake_fetch(url, use_proxy, timeout):
            html = '<html><body><div class="paywall">Subscribe to read</div></body></html>'
            return html, len(html), "text/html", 200
        monkeypatch.setattr("videos.external_pages.scraper._fetch_html", _fake_fetch)
        result = await scrape_page("https://example.com", "https://example.com")
        assert result.status == "paywalled"
        assert result.summary is None
```

#### Unit : `backend/tests/test_external_page_summarizer.py`

```python
import pytest
import json
from unittest.mock import AsyncMock, patch
from videos.external_pages.scraper import ScrapedPage
from videos.external_pages.summarizer import summarize_page, _cache_key


@pytest.mark.asyncio
class TestSummarizePage:
    async def test_passthrough_non_ok_status(self):
        scraped = ScrapedPage(
            url="https://a.com", final_url="https://a.com",
            title="X", text=None, status="paywalled",
            bytes_fetched=100, fetched_via_proxy=False,
        )
        with patch("videos.external_pages.summarizer.cache_service") as mock_cache:
            mock_cache.get = AsyncMock(return_value=None)
            result = await summarize_page(scraped, "Channel", "Video", "pro")
        assert result.status == "paywalled"
        assert result.summary is None
        mock_cache.set.assert_not_called()

    async def test_calls_mistral_and_parses_json(self):
        scraped = ScrapedPage(
            url="https://a.com", final_url="https://a.com",
            title="Test", text="A " * 500, status="ok",
            bytes_fetched=2000, fetched_via_proxy=False,
        )
        fake_llm_result = type("R", (), {
            "content": json.dumps({
                "summary": "Une synthèse de 2 phrases.",
                "key_claims": ["claim 1", "claim 2"],
            })
        })()
        with patch("videos.external_pages.summarizer.cache_service") as mock_cache, \
             patch("videos.external_pages.summarizer.llm_complete",
                   new=AsyncMock(return_value=fake_llm_result)):
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock()
            result = await summarize_page(scraped, "Channel", "Video", "pro")
        assert result.status == "ok"
        assert result.summary == "Une synthèse de 2 phrases."
        assert result.key_claims == ["claim 1", "claim 2"]

    async def test_cache_hit_skips_mistral(self):
        scraped = ScrapedPage(
            url="https://a.com", final_url="https://a.com",
            title="Test", text="A " * 500, status="ok",
            bytes_fetched=2000, fetched_via_proxy=False,
        )
        cached_data = json.dumps({
            "title": "Cached title",
            "summary": "Cached summary",
            "key_claims": ["cached"],
        })
        with patch("videos.external_pages.summarizer.cache_service") as mock_cache, \
             patch("videos.external_pages.summarizer.llm_complete",
                   new=AsyncMock()) as mock_llm:
            mock_cache.get = AsyncMock(return_value=cached_data)
            result = await summarize_page(scraped, "Channel", "Video", "pro")
        assert result.summary == "Cached summary"
        mock_llm.assert_not_called()


def test_cache_key_deterministic():
    k1 = _cache_key("https://example.com/article")
    k2 = _cache_key("https://example.com/article")
    assert k1 == k2
    assert k1.startswith("vcache:external_page:")
```

---

## 12. Risques et mitigations

| # | Risque | Impact | Mitigation |
|---|--------|--------|-----------|
| R1 | URL maintenant 404 | Visible mais inerte | `status="not_found"` + UI grisée + bouton `Ouvrir` reste actif |
| R2 | Page paywallée | Mistral résume du HTML pauvre = output bullshit | Détection patterns paywall → `status="paywalled"`, pas d'appel Mistral, placeholder UI |
| R3 | Page non-FR (créateur FR cite blog EN) | Risque résumé en EN | Prompt système : "Résume TOUJOURS en français même si la page est en anglais ou autre langue" |
| R4 | Site lent (timeout 12s par URL) | Bloque pipeline si attendu sync | `asyncio.create_task` + `wait_for(timeout=60s)` global |
| R5 | Toxic content sur la page cible | Output Mistral peut véhiculer | `core/moderation_service.moderate_text` sur le résumé Mistral avant cache/persist |
| R6 | Coût bandwidth Decodo explose | Hard-stop 950 MB MTD | bare-first stratégie + telemetry + `should_bypass_proxy` auto |
| R7 | Mistral 429 pendant peak | Mini-résumé partiel | `llm_complete` a déjà fallback chain Mistral → DeepSeek + circuit breaker |
| R8 | Description vidéo vide | Aucune URL trouvée | `extract_external_pages` retourne None proprement |
| R9 | Description énorme (50 URLs) | Coût Mistral × 50 | Hard cap 20 candidats AVANT resolve, puis cap plan (max 10 Expert) |
| R10 | Cache empoisonné par contenu changé | Résumé obsolète 7j | TTL 7j conservé. V2 : invalidation manuelle |
| R11 | Test E2E flaky | CI rouge intermittent | Tous les tests mockent `_fetch_html` et `llm_complete` |
| R12 | URL malformée passée à `urlparse` | Crash | `try/except` sur chaque parse |
| R13 | trafilatura crash sur HTML exotique | Pipeline crashe | `try/except` autour de l'extract + fallback readability |
| R14 | Self-channel filter ne marche pas | URL self-promo passe | Acceptable V1 |
| R15 | URL pointe vers Google Docs / Notion (auth requise) | Status="error" inattendu | 401/403 sans signal CF → `status="error"`, pas de proxy retry |

---

## 13. Phasage de livraison

### PR 1 — URL extraction & filtering (backend pur, pas de scraping)

**Branche** : `feat/external-pages-pr1-extractor`

**Fichiers créés** :
- `backend/src/videos/external_pages/__init__.py`
- `backend/src/videos/external_pages/constants.py`
- `backend/src/videos/external_pages/url_extractor.py`
- `backend/src/videos/external_pages/url_resolver.py`
- `backend/tests/test_url_extractor.py`
- `backend/tests/test_url_resolver.py`

**Tests** : 30+ unit tests sur extractor + resolver (mock httpx)

### PR 2 — Scraping + readability + Mistral summarizer + storage

**Branche** : `feat/external-pages-pr2-scraper-summarizer`

**Fichiers créés** :
- `backend/src/videos/external_pages/scraper.py`
- `backend/src/videos/external_pages/summarizer.py`
- `backend/src/videos/external_pages/orchestrator.py`
- `backend/alembic/versions/029_summary_external_pages.py`
- `backend/tests/test_external_page_scraper.py`
- `backend/tests/test_external_page_summarizer.py`
- `backend/tests/test_external_pages_orchestrator.py`

**Fichiers modifiés** :
- `backend/src/db/database.py` (ajout colonne `Summary.external_pages`)
- `backend/requirements.txt` (`trafilatura`, `readability-lxml`)
- `backend/src/billing/plan_config.py` (ajout `external_pages_max`)

### PR 3 — Intégration pipeline v6 + UI web

**Branche** : `feat/external-pages-pr3-pipeline-web`

**Fichiers modifiés backend** :
- `backend/src/videos/router.py`
- `backend/src/videos/service.py`
- `backend/src/videos/schemas.py`

**Fichiers créés frontend** :
- `frontend/src/components/analysis/ExternalSourcesSection.tsx`
- `frontend/src/components/analysis/ExternalSourceCard.tsx`
- `frontend/src/components/analysis/__tests__/*.test.tsx`

### PR 4 — UI mobile + UI extension + i18n complète

**Branche** : `feat/external-pages-pr4-mobile-extension`

**Fichiers créés mobile** :
- `mobile/src/components/analysis/ExternalSourcesSection.tsx`
- `mobile/src/components/analysis/ExternalSourceCardMobile.tsx`
- `mobile/__tests__/ExternalSourcesSection.test.tsx`

**Fichiers créés extension** :
- `extension/src/popup/components/ExternalSourcesCompact.tsx`

### Calendrier estimé

| PR | Durée dev | Durée review/test | Total wall-clock |
|----|-----------|-------------------|------------------|
| PR 1 | 3 h | 2 h | 0.5 j |
| PR 2 | 6 h | 3 h | 1 j |
| PR 3 | 5 h | 3 h | 1 j |
| PR 4 | 4 h | 2 h | 0.5 j |
| **TOTAL** | **18 h** | **10 h** | **~3 jours** |

Avec sub-agents Opus 4.7 parallèles, PR3 et PR4 peuvent overlapper → **2 jours wall-clock** réaliste.

---

## Annexes

### A. Variables d'environnement

Aucune nouvelle variable d'env requise V1.

Flag optionnel :
```env
EXTERNAL_PAGES_ENABLED=true
```

### B. Compatibility avec features existantes

| Feature | Interaction | Action |
|---------|-------------|--------|
| Chat v4 | Le contexte chat peut inclure `external_pages` comme system context | Ajouter dans `chat/service.py::build_system_prompt` |
| Markdown export | Doit inclure section "Sources externes" | Modifier `exports/markdown_builder.py` |
| Pages publiques `/a/{slug}` | Idem | Pas de différence par défaut |
| Visual Analysis | Indépendant | Aucune interaction |
| Comments Analysis | Indépendant | Aucune interaction |
| Semantic Search | Pas indexé en V1 | V2 possible |
| Debate IA | Indépendant | Aucune interaction |

### C. Métriques PostHog à émettre

```python
await capture_event(
    distinct_id=str(user_id),
    event="external_pages_extracted",
    properties={
        "summary_id": summary_id,
        "platform": platform,
        "user_plan": user_plan,
        "candidates_found": stats["candidates_found"],
        "after_cap": stats["after_cap"],
        "successful": stats["successful"],
        "paywalled": stats["paywalled"],
        "errored": stats["errored"],
        "any_via_proxy": any(p.fetched_via_proxy for p in summarized),
        "total_bytes_fetched": sum(p.bytes_fetched for p in summarized),
    },
)

analytics.track("external_source_click", {
    "summary_id", "host", "final_url", "user_plan", "platform"
})

analytics.track("external_sources_cta_view", {
    "user_plan": "free", "platform": platform
})
```

### D. Sécurité

- **SSRF** : ajouter validateur pour éviter IPs privées :

```python
import ipaddress

def _is_private_url(url: str) -> bool:
    try:
        host = urlparse(url).hostname
        if not host:
            return False
        try:
            ip = ipaddress.ip_address(host)
            return ip.is_private or ip.is_loopback or ip.is_link_local
        except ValueError:
            return False
    except Exception:
        return True
```

- **XSS** : tout rendu UI passe par React qui escape par défaut
- **Open redirect** : on n'ouvre que `final_url` dans `<a target="_blank" rel="noopener noreferrer nofollow">`
- **Stored XSS** : trafilatura retourne du texte propre. Si fallback readability extrait du HTML résiduel, on `strip_tags()` via BeautifulSoup

### E. Observabilité

```
[EXTERNAL_PAGES] task spawned for task_id=abc123
[EXTERNAL_PAGES] CF/403 detected, retry via proxy → https://nyt.com/article
[EXTERNAL_PAGES] trafilatura failed: <reason>
[EXTERNAL_PAGES] done in 18.3s — stats={'candidates_found': 7, 'successful': 4, 'paywalled': 2, 'errored': 1}
[EXTERNAL_PAGES] timeout 60s for task_id=abc123, external_pages will be None
```

### F. Rollback plan

1. **Hot-fix** : env var `EXTERNAL_PAGES_ENABLED=false`
2. **Soft-rollback** : revert le commit qui ajoute le `asyncio.create_task`
3. **Hard-rollback** : `alembic downgrade -1` retire la colonne `external_pages`

La colonne `external_pages` étant nullable, **un rollback frontend ne casse rien backend**.

---

**FIN DE SPEC**
