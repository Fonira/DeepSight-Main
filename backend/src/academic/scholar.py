"""
Google Scholar Deep Crawl Client
================================
Scraping de la SERP Scholar via Decodo **Web Scraping API** (Premium+JS,
output Markdown AI-optimized), suivi d'une extraction structurée par Mistral
JSON schema strict.

Pré-Phase 1.2 (legacy) : GET direct via Decodo Residential + parsing BS4.
Depuis Phase 1.2 (cette PR) : POST /v2/scrape Decodo + `parse_scholar_markdown_via_mistral`.
Le parser BS4 (`parse_scholar_html`) est CONSERVÉ en dead code pour rollback safety.

Rate limit : 1 query / 2 s (allégé depuis 5s — Decodo gère son anti-ban côté
infra, le rate limit interne sert juste à éviter d'éclater le quota Mistral
en cas d'enrichissement aggregator parallèle).
Circuit breaker : 3 failures consecutives -> open 1h
Cache : Redis L1 (TTL 7 jours, key vcache:scholar:{md5(query_normalized)})
Telemetry : record_proxy_usage(provider="scholar_scrape", bytes_in=len(markdown_bytes))
            + decodo_scraping_usage row inséré par le wrapper Phase 0.

Decision keys (spec § 5.2) :
- `markdown=true` plutôt que `output_format=raw_html` → 80-90% moins de tokens
  Mistral (validé J0 : 170KB HTML → 17KB Markdown sur transformer SERP).
- Mistral JSON extraction plutôt que BS4 → résilient aux changements de markup
  Scholar (3 refactos en 2 ans : `gs_rt`, `gs_a`, `gs_r`...).
- Rate limit 2s plutôt que 5s → on n'hit plus Scholar nous-mêmes, c'est Decodo.

Hard requirements (spec sect. 4 + sect. 5) :
- record_proxy_usage(provider="scholar_scrape") best-effort après chaque fetch OK.
- 2s rate limit (allégé depuis 5s — voir § 5.6 du spec phase 1).
- 3 failures -> open CB for 1h (NOT 30min, NOT 5min).
- 7-day cache TTL (NOT 24h — Decodo budget mitigation).
- NEVER cache an empty papers batch (poisoning anti-pattern).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import random
import re
import time
from typing import List, Optional

from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

from core.http_client import get_proxied_client
from middleware.proxy_telemetry import record_proxy_usage, should_bypass_proxy_async

logger = logging.getLogger(__name__)

# ───────────────────────────────────────────────────────────────────────────────
# Configuration constants
# ───────────────────────────────────────────────────────────────────────────────

SCHOLAR_BASE_URL = "https://scholar.google.com/scholar"
SCHOLAR_RATE_INTERVAL = 2.0  # Phase 1.2 — allégé depuis 5s (Decodo gère anti-ban)
SCHOLAR_RATE_LOCK_KEY = "deepsight:scholar:rate_lock"
SCHOLAR_CB_FAIL_KEY = "deepsight:scholar:cb_fail_count"
SCHOLAR_CB_OPEN_KEY = "deepsight:scholar:cb_open_until"
SCHOLAR_CB_THRESHOLD = 3
SCHOLAR_CB_OPEN_DURATION = 3600  # 1 hour
SCHOLAR_CACHE_KEY_PREFIX = "vcache:scholar:"
SCHOLAR_CACHE_TTL = 7 * 24 * 3600  # 7 days
SCHOLAR_HTTP_TIMEOUT = 30.0  # Phase 1.2 — Premium+JS render 3-12s typique
SCHOLAR_MIN_HTML_BYTES = 5000  # legacy parser guard
# Markdown minimum size : Scholar render Markdown typique ≥ 2KB pour 0 résultat,
# ≥ 5KB pour quelques résultats. On fixe 500B comme garde minimal contre les
# réponses vides ou tronquées par un timeout réseau partiel.
SCHOLAR_MIN_MARKDOWN_BYTES = 500
# Mistral extraction guard : tronquer le markdown au-delà pour limiter le coût.
# 30 000 chars ≈ 8 000 tokens input ≈ $0.00080 par query (mistral-small).
SCHOLAR_MARKDOWN_MAX_CHARS = 30000

# User-Agent pool (rotation random per query — spec sect. 4.2).
_UA_POOL: List[str] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
]

# CAPTCHA / sorry-page detection markers (spec sect. 4.6).
_CAPTCHA_PATTERNS: List[str] = [
    "/sorry/index",
    "<title>sorry...",
    "unusual traffic from your computer network",
    "captcha",
]

# ───────────────────────────────────────────────────────────────────────────────
# Module-level state (Redis-shared rate limit + CB, local fallback)
# ───────────────────────────────────────────────────────────────────────────────

_redis_client = None
_last_local_request_time: float = 0.0


# ───────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ───────────────────────────────────────────────────────────────────────────────


class ScholarPaper(BaseModel):
    """Single Scholar result, post-parse."""

    scholar_id: Optional[str] = None
    title: str
    authors: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    citation_count: int = 0


class ScholarBatch(BaseModel):
    """Batch returned by a single SERP fetch."""

    query: str
    papers: List[ScholarPaper] = Field(default_factory=list)
    fetched_at: float
    raw_html_size: int


# ───────────────────────────────────────────────────────────────────────────────
# Init / state helpers (test-only reset utilities exposed)
# ───────────────────────────────────────────────────────────────────────────────


async def init_scholar_redis(redis_client) -> None:
    """Connect rate limiter + circuit breaker + cache to the shared Redis client.

    Call from FastAPI startup with the shared async Redis client. If never
    called, Scholar falls back to per-process local rate limiting and disables
    circuit breaker + cache (best-effort fail-open).
    """
    global _redis_client
    _redis_client = redis_client


def _reset_state_for_tests() -> None:
    """Reset module-level state. Test-only helper."""
    global _redis_client, _last_local_request_time
    _redis_client = None
    _last_local_request_time = 0.0


# ───────────────────────────────────────────────────────────────────────────────
# Rate limit (5s, Redis-backed with local fallback)
# ───────────────────────────────────────────────────────────────────────────────


async def _rate_limit() -> None:
    """Enforce 5s minimum interval between consecutive Scholar queries.

    Distributed via Redis (cross-worker). Falls back to per-process local
    timer if Redis is unreachable. Spec sect. 4.5.
    """
    global _last_local_request_time

    if _redis_client is not None:
        try:
            now = time.time()
            last_raw = await _redis_client.get(SCHOLAR_RATE_LOCK_KEY)
            if last_raw:
                try:
                    last = float(last_raw)
                    elapsed = now - last
                    if elapsed < SCHOLAR_RATE_INTERVAL:
                        await asyncio.sleep(SCHOLAR_RATE_INTERVAL - elapsed)
                except (ValueError, TypeError):
                    pass
            await _redis_client.set(SCHOLAR_RATE_LOCK_KEY, str(time.time()), ex=15)
            return
        except Exception as e:
            logger.debug(f"[SCHOLAR] Redis rate limit failed, fallback local: {e}")

    # Local fallback
    elapsed = time.time() - _last_local_request_time
    if elapsed < SCHOLAR_RATE_INTERVAL:
        await asyncio.sleep(SCHOLAR_RATE_INTERVAL - elapsed)
    _last_local_request_time = time.time()


# ───────────────────────────────────────────────────────────────────────────────
# Circuit breaker (3 failures -> open 1h)
# ───────────────────────────────────────────────────────────────────────────────


async def is_circuit_open() -> bool:
    """Returns True if the breaker is currently open. Fail-open if Redis down."""
    if _redis_client is None:
        return False
    try:
        open_until = await _redis_client.get(SCHOLAR_CB_OPEN_KEY)
        if open_until:
            try:
                if float(open_until) > time.time():
                    return True
            except (ValueError, TypeError):
                return False
    except Exception as e:
        logger.debug(f"[SCHOLAR] CB is_circuit_open Redis failed: {e}")
    return False


async def _record_failure(reason: str) -> None:
    """Increment failure counter; open breaker if threshold reached."""
    if _redis_client is None:
        return
    try:
        count = await _redis_client.incr(SCHOLAR_CB_FAIL_KEY)
        await _redis_client.expire(SCHOLAR_CB_FAIL_KEY, 600)
        if int(count) >= SCHOLAR_CB_THRESHOLD:
            open_until = time.time() + SCHOLAR_CB_OPEN_DURATION
            await _redis_client.set(
                SCHOLAR_CB_OPEN_KEY,
                str(open_until),
                ex=SCHOLAR_CB_OPEN_DURATION,
            )
            await _redis_client.delete(SCHOLAR_CB_FAIL_KEY)
            logger.warning(f"[SCHOLAR] Circuit OPEN for {SCHOLAR_CB_OPEN_DURATION}s (reason={reason}, count={count})")
    except Exception as e:
        logger.debug(f"[SCHOLAR] CB record_failure Redis failed: {e}")


async def _record_success() -> None:
    """Reset failure counter on successful fetch."""
    if _redis_client is None:
        return
    try:
        await _redis_client.delete(SCHOLAR_CB_FAIL_KEY)
    except Exception as e:
        logger.debug(f"[SCHOLAR] CB record_success Redis failed: {e}")


def _is_bad_html(html: str) -> Optional[str]:
    """Detect CAPTCHA / error pages. Returns failure reason or None."""
    if len(html) < SCHOLAR_MIN_HTML_BYTES:
        return f"html_too_short_{len(html)}"
    lower = html.lower()
    for pattern in _CAPTCHA_PATTERNS:
        if pattern in lower:
            return f"captcha_pattern:{pattern}"
    return None


# ───────────────────────────────────────────────────────────────────────────────
# Cache (Redis L1, TTL 7 days)
# ───────────────────────────────────────────────────────────────────────────────


def _cache_key(query: str) -> str:
    """Build a normalized cache key from a query string."""
    normalized = query.lower().strip()
    h = hashlib.md5(normalized.encode("utf-8")).hexdigest()
    return f"{SCHOLAR_CACHE_KEY_PREFIX}{h}"


async def _cache_get(query: str) -> Optional[ScholarBatch]:
    """Read a cached batch from Redis. Returns None on miss or any error."""
    if _redis_client is None:
        return None
    try:
        raw = await _redis_client.get(_cache_key(query))
        if raw:
            data = json.loads(raw)
            return ScholarBatch.model_validate(data)
    except Exception as e:
        logger.debug(f"[SCHOLAR] cache get failed: {e}")
    return None


async def _cache_set(query: str, batch: ScholarBatch) -> None:
    """Persist a batch in Redis (TTL 7d). NEVER stores an empty papers batch.

    Empty-batch cache-poisoning protection — spec sect. 8.3. A 0-paper batch
    is most often the result of a transient CAPTCHA / parse error and would
    pollute the cache for a week.
    """
    if _redis_client is None:
        return
    if not batch.papers:
        logger.debug(f"[SCHOLAR] skipping cache_set: empty batch for q='{query[:60]}'")
        return
    try:
        await _redis_client.set(
            _cache_key(query),
            batch.model_dump_json(),
            ex=SCHOLAR_CACHE_TTL,
        )
    except Exception as e:
        logger.debug(f"[SCHOLAR] cache set failed: {e}")


# ───────────────────────────────────────────────────────────────────────────────
# HTML parser (BeautifulSoup, spec sect. 4.7)
# ───────────────────────────────────────────────────────────────────────────────

# Citation count patterns: EN ("Cited by 42") + FR ("Cité 13 fois").
_CITATION_REGEX_EN = re.compile(r"Cited by (\d+)", re.IGNORECASE)
_CITATION_REGEX_FR = re.compile(r"Cit[ée]?\s+(\d+)\s+fois", re.IGNORECASE)
_YEAR_REGEX = re.compile(r"\b(19\d{2}|20\d{2})\b")
_TITLE_PREFIX_REGEX = re.compile(r"^\s*\[(PDF|HTML|CITATION|BOOK|B|DOC)\]\s*", re.IGNORECASE)


def parse_scholar_html(html: str) -> List[ScholarPaper]:
    """Parse a Scholar SERP HTML into a list of ScholarPaper.

    Tolerates partial / malformed HTML — exceptions on individual results are
    swallowed and the result is skipped. Returns [] on top-level parse error.
    """
    papers: List[ScholarPaper] = []
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception as e:
        logger.warning(f"[SCHOLAR] parse_scholar_html top-level error: {e}")
        return papers

    # Match div.gs_r (with or without the gs_or / gs_scl secondary classes).
    try:
        candidates = soup.find_all("div", class_="gs_r")
    except Exception as e:
        logger.warning(f"[SCHOLAR] find_all gs_r failed: {e}")
        return papers

    for div in candidates:
        try:
            scholar_id = None
            try:
                scholar_id = div.get("data-cid") or None
            except Exception:
                scholar_id = None

            h3 = div.find("h3", class_="gs_rt")
            if h3 is None:
                continue
            a = h3.find("a")
            if a is None or not a.get_text(strip=True):
                continue
            raw_title = h3.get_text(strip=True)
            title = _TITLE_PREFIX_REGEX.sub("", raw_title).strip()
            # Sometimes there is more than one prefix like [BOOK][B] — strip until stable.
            for _ in range(3):
                stripped = _TITLE_PREFIX_REGEX.sub("", title).strip()
                if stripped == title:
                    break
                title = stripped
            if not title:
                continue

            url = a.get("href") or None

            authors: List[str] = []
            year: Optional[int] = None
            venue: Optional[str] = None
            gs_a = div.find("div", class_="gs_a")
            if gs_a is not None:
                gs_a_text = gs_a.get_text(separator=" ", strip=True)
                italic = gs_a.find("i")
                if italic is not None:
                    venue_text = italic.get_text(strip=True)
                    venue = venue_text or None
                # Split on " - " to isolate authors block (1st segment).
                parts = gs_a_text.split(" - ")
                if parts:
                    author_str = parts[0]
                    # Authors separated by ", " — keep raw names.
                    candidate_authors = [a.strip() for a in author_str.split(",") if a.strip()]
                    # Defensive: drop tokens that look like years (rare format glitches).
                    authors = [a for a in candidate_authors if not _YEAR_REGEX.fullmatch(a)]
                year_matches = _YEAR_REGEX.findall(gs_a_text)
                if year_matches:
                    try:
                        year = int(year_matches[-1])
                    except (ValueError, TypeError):
                        year = None

            abstract: Optional[str] = None
            gs_rs = div.find("div", class_="gs_rs")
            if gs_rs is not None:
                abstract_text = gs_rs.get_text(separator=" ", strip=True)
                abstract = abstract_text or None

            citation_count = 0
            gs_fl = div.find("div", class_="gs_fl")
            if gs_fl is not None:
                for link in gs_fl.find_all("a"):
                    link_text = link.get_text(strip=True)
                    m = _CITATION_REGEX_EN.search(link_text)
                    if m is None:
                        m = _CITATION_REGEX_FR.search(link_text)
                    if m is not None:
                        try:
                            citation_count = int(m.group(1))
                            break
                        except (ValueError, TypeError):
                            pass

            pdf_url: Optional[str] = None
            ggsm = div.find("div", class_="gs_or_ggsm")
            if ggsm is not None:
                pdf_a = ggsm.find("a")
                if pdf_a is not None:
                    pdf_text = pdf_a.get_text()
                    if "[PDF]" in pdf_text.upper():
                        pdf_url = pdf_a.get("href") or None
                    else:
                        # Some pages omit the [PDF] tag inline but the link is still a PDF.
                        href_candidate = pdf_a.get("href") or ""
                        if href_candidate.lower().endswith(".pdf"):
                            pdf_url = href_candidate

            papers.append(
                ScholarPaper(
                    scholar_id=scholar_id,
                    title=title,
                    authors=authors,
                    year=year,
                    venue=venue,
                    abstract=abstract,
                    url=url,
                    pdf_url=pdf_url,
                    citation_count=citation_count,
                )
            )
        except Exception as e:
            logger.debug(f"[SCHOLAR] skip item parse error: {e}")
            continue

    return papers


# ───────────────────────────────────────────────────────────────────────────────
# Phase 1.2 — Markdown extraction via Mistral JSON schema strict
# ───────────────────────────────────────────────────────────────────────────────

SCHOLAR_EXTRACT_SYSTEM_PROMPT = (
    "Tu es un extracteur de résultats Google Scholar. "
    "Entrée : Markdown brut d'une page de résultats Scholar (rendue via Decodo). "
    'Sortie : JSON strict {"papers": [...]} suivant le schéma fourni. '
    "Pas de commentaire, pas de texte hors JSON, pas de Markdown wrap."
)

SCHOLAR_EXTRACT_USER_TEMPLATE = """Extrait les {limit} premiers résultats académiques de cette page Google Scholar Markdown.

Pour chaque résultat, retourne EXACTEMENT ces champs :
- title (str, sans préfixe [PDF]/[HTML]/[BOOK]/[CITATION], titre nettoyé)
- authors (array de str, prénoms+noms tels qu'affichés, sans liens)
- year (int|null, 4 chiffres entre 1900 et 2100)
- venue (str|null, ex. "Nature", "arXiv preprint arXiv...", "Advances in neural...", "arxiv.org")
- abstract (str|null, le snippet visible sous le titre — pas la ligne d'auteurs)
- url (str|null, URL absolue ou relative `/scholar?...` du titre, pas d'auteur)
- pdf_url (str|null, URL absolue du PDF si visible avec marker `[PDF] ...`)
- citation_count (int, valeur derrière "Cited by N" ou "Cité N fois", 0 si absent)

Ignore les en-têtes de page (Cite, Advanced search, Saved to My library, etc.).
Si la page contient une CAPTCHA ou un message "no results" Scholar, retourne {{"papers": []}}.

Markdown source :
---
{markdown}
---

Réponds avec UN SEUL objet JSON : {{"papers": [...]}}"""


_SCHOLAR_EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "papers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "authors": {"type": "array", "items": {"type": "string"}},
                    "year": {"type": ["integer", "null"]},
                    "venue": {"type": ["string", "null"]},
                    "abstract": {"type": ["string", "null"]},
                    "url": {"type": ["string", "null"]},
                    "pdf_url": {"type": ["string", "null"]},
                    "citation_count": {"type": "integer"},
                },
                "required": ["title"],
            },
        }
    },
    "required": ["papers"],
}


async def parse_scholar_markdown_via_mistral(
    md_text: str,
    query: str,
    limit: int = 20,
) -> List[ScholarPaper]:
    """Extrait des `ScholarPaper` depuis le markdown Scholar rendu via Decodo.

    Remplace le parser BS4 fragile (`parse_scholar_html` — conservé en dead code
    pour rollback safety). Robuste aux changements de markup Scholar, coût Mistral
    ≈ $0.0003 par query sur small-2603 (négligeable vs. budget Phase 1).

    Args:
        md_text: Markdown rendu par Decodo Web Scraping API (`markdown=true`).
        query: Query d'origine (informationnel, pas utilisé pour le parse).
        limit: Nombre max de papers à retourner (clamp 1..20).

    Returns:
        Liste de `ScholarPaper` (peut être vide en cas d'erreur Mistral / 0 résultat
        Scholar / parse JSON KO). Ne raise jamais — fail-safe pour le pipeline.
    """
    if not md_text or len(md_text) < SCHOLAR_MIN_MARKDOWN_BYTES:
        return []

    # Guard CAPTCHA : si le markdown ressemble à une captcha-page Scholar
    # (rare car Decodo Premium+JS bypasse, mais possible si Cloudflare durcit).
    lower = md_text.lower()
    for pattern in _CAPTCHA_PATTERNS:
        if pattern in lower:
            logger.warning(f"[SCHOLAR] markdown captcha guard hit: {pattern}")
            return []

    safe_limit = max(1, min(int(limit), 20))
    truncated_md = md_text[:SCHOLAR_MARKDOWN_MAX_CHARS]

    try:
        from core.llm_provider import mistral_extract_json

        result = await mistral_extract_json(
            system_prompt=SCHOLAR_EXTRACT_SYSTEM_PROMPT,
            user_prompt=SCHOLAR_EXTRACT_USER_TEMPLATE.format(
                markdown=truncated_md,
                limit=safe_limit,
            ),
            schema=_SCHOLAR_EXTRACT_SCHEMA,
            model="mistral-small-2603",
            timeout=20.0,
            max_tokens=4000,
            temperature=0.1,
        )
    except Exception as e:
        logger.warning(f"[SCHOLAR] mistral_extract_json raised: {e}")
        return []

    if not result:
        logger.warning(f"[SCHOLAR] mistral returned None for q='{query[:40]}'")
        return []

    papers_raw = result.get("papers") if isinstance(result, dict) else None
    if not isinstance(papers_raw, list):
        logger.warning(f"[SCHOLAR] mistral result missing 'papers' array (keys={list(result.keys()) if isinstance(result, dict) else type(result).__name__})")
        return []

    parsed: List[ScholarPaper] = []
    for p in papers_raw:
        if not isinstance(p, dict):
            continue
        title = (p.get("title") or "").strip()
        if not title:
            continue
        # Defensive type coercion (Mistral peut renvoyer une str au lieu d'un int
        # sur citation_count / year quand le markdown contient des espaces ou symboles).
        year_raw = p.get("year")
        year_val: Optional[int] = None
        if isinstance(year_raw, int):
            year_val = year_raw
        elif isinstance(year_raw, str):
            try:
                year_val = int(year_raw.strip())
            except (ValueError, TypeError):
                year_val = None

        citation_raw = p.get("citation_count", 0)
        try:
            citation_val = int(citation_raw) if citation_raw is not None else 0
        except (ValueError, TypeError):
            citation_val = 0

        authors_raw = p.get("authors") or []
        if not isinstance(authors_raw, list):
            authors_raw = []
        authors_clean = [str(a).strip() for a in authors_raw if str(a).strip()]

        try:
            parsed.append(
                ScholarPaper(
                    title=title,
                    authors=authors_clean,
                    year=year_val,
                    venue=p.get("venue"),
                    abstract=p.get("abstract"),
                    url=p.get("url"),
                    pdf_url=p.get("pdf_url"),
                    citation_count=citation_val,
                )
            )
        except Exception as e:
            logger.debug(f"[SCHOLAR] skip paper validate error: {e}")
            continue

    return parsed[:safe_limit]


# ───────────────────────────────────────────────────────────────────────────────
# Public API : search_scholar()
# ───────────────────────────────────────────────────────────────────────────────


def _build_scholar_url(query: str, limit: int) -> str:
    """Build the Scholar SERP URL. URL-encode the query."""
    # Encode the query value. We use httpx-friendly manual encoding to keep
    # behaviour deterministic & avoid pulling urllib at top of module.
    from urllib.parse import quote_plus

    safe_q = quote_plus(query)
    safe_n = max(1, min(int(limit), 20))
    return f"{SCHOLAR_BASE_URL}?q={safe_q}&hl=fr&num={safe_n}&start=0"


def _build_headers() -> dict:
    """Return realistic browser headers with a randomly selected UA."""
    return {
        "User-Agent": random.choice(_UA_POOL),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
    }


def _empty_batch(query: str, raw_html_size: int = 0) -> ScholarBatch:
    """Helper for early-return empty batches (CAPTCHA, hard-stop, etc.)."""
    return ScholarBatch(
        query=query,
        papers=[],
        fetched_at=time.time(),
        raw_html_size=raw_html_size,
    )


async def search_scholar(
    query: str,
    *,
    limit: int = 20,
    use_cache: bool = True,
) -> ScholarBatch:
    """Scrape Google Scholar SERP page 1 for the given query.

    Phase 1.2 flow (Decodo Web Scraping API + Mistral markdown extraction) :
      1. Sanitize query, early-return empty batch if blank.
      2. Cache HIT -> short-circuit (no Decodo call, no rate-limit, no CB check).
      3. Circuit-open -> empty batch.
      4. Rate-limit (2s — allégé depuis 5s, Decodo gère son anti-ban).
      5. POST /v2/scrape Decodo Premium+JS + markdown=true.
      6. Bad-response detection (None / too short / CAPTCHA in markdown).
      7. record_proxy_usage(provider="scholar_scrape") (best-effort).
      8. parse_scholar_markdown_via_mistral(md, query, limit) -> papers.
      9. record_success + cache_set (skip cache if papers empty).

    Note Phase 0 → 1.2 — le hard-stop Residential `should_bypass_proxy_async()`
    a été retiré du flow Scholar : Web Scraping API a son propre budget guard
    (`DECODO_SCRAPING_MAX_MONTHLY_REQ` enforced à l'intérieur du wrapper). Le
    hard-stop Decodo Scraping est checké par `DecodoScrapingClient.scrape()`.

    Never raises — all exceptions are logged as warnings and translated
    into an empty batch. The aggregator (PR2) treats an empty batch as
    "skip phase 4" silently.
    """
    query = (query or "").strip()
    if not query:
        return _empty_batch(query)

    # 1. Cache lookup (no side effects).
    if use_cache:
        try:
            cached = await _cache_get(query)
        except Exception as e:
            logger.debug(f"[SCHOLAR] cache_get raised: {e}")
            cached = None
        if cached is not None:
            logger.info(f"[SCHOLAR] cache HIT q='{query[:60]}' ({len(cached.papers)} papers)")
            return cached

    # 2. Circuit breaker.
    try:
        circuit_open = await is_circuit_open()
    except Exception as e:
        logger.debug(f"[SCHOLAR] is_circuit_open raised: {e}")
        circuit_open = False
    if circuit_open:
        logger.warning(f"[SCHOLAR] circuit OPEN — skip q='{query[:60]}'")
        return _empty_batch(query)

    # 3. Rate limit (2s — Decodo gère son anti-ban infra).
    await _rate_limit()

    # 4. Build request + fire via Decodo Web Scraping API (Premium+JS, Markdown).
    url = _build_scholar_url(query, limit)
    md_text = ""
    try:
        from decodo import (
            DecodoBudgetExceededError,
            DecodoDisabledError,
            DecodoScrapingClient,
            DecodoScrapingError,
        )

        client = DecodoScrapingClient()
        result = await client.scrape(
            url,
            proxy_pool="premium",
            headless=True,
            output_format="markdown",
            timeout_s=SCHOLAR_HTTP_TIMEOUT,
        )
        md_text = result.content or ""
    except DecodoDisabledError:
        logger.warning(f"[SCHOLAR] decodo scraping disabled (kill-switch) — skip q='{query[:60]}'")
        return _empty_batch(query)
    except DecodoBudgetExceededError as e:
        logger.warning(f"[SCHOLAR] decodo monthly budget exceeded — skip q='{query[:60]}': {e}")
        return _empty_batch(query)
    except DecodoScrapingError as e:
        logger.warning(f"[SCHOLAR] decodo scrape error for q='{query[:60]}': {e}")
        await _record_failure("decodo_scrape_error")
        return _empty_batch(query, raw_html_size=0)
    except Exception as e:
        logger.warning(f"[SCHOLAR] decodo scrape unexpected error: {e}")
        await _record_failure("decodo_unexpected")
        return _empty_batch(query, raw_html_size=0)

    md_size = len(md_text)

    # 5. Bad-response detection (Markdown-aware).
    if not md_text or md_size < SCHOLAR_MIN_MARKDOWN_BYTES:
        await _record_failure(f"markdown_too_short_{md_size}")
        return _empty_batch(query, raw_html_size=md_size)
    lower = md_text.lower()
    for pattern in _CAPTCHA_PATTERNS:
        if pattern in lower:
            await _record_failure(f"captcha_md:{pattern}")
            return _empty_batch(query, raw_html_size=md_size)

    # 6. Telemetry (best-effort).
    try:
        bytes_in = len(md_text.encode("utf-8", errors="replace"))
        if bytes_in > 0:
            await record_proxy_usage(provider="scholar_scrape", bytes_in=bytes_in)
    except Exception as e:
        logger.debug(f"[SCHOLAR] telemetry failed: {e}")

    # 7. Parse via Mistral + record success + cache.
    papers = await parse_scholar_markdown_via_mistral(md_text, query, limit)
    if not papers:
        await _record_failure("mistral_extract_empty")
        return _empty_batch(query, raw_html_size=md_size)
    await _record_success()

    safe_limit = max(1, min(int(limit), 20))
    batch = ScholarBatch(
        query=query,
        papers=papers[:safe_limit],
        fetched_at=time.time(),
        raw_html_size=md_size,
    )
    await _cache_set(query, batch)
    logger.info(
        f"[SCHOLAR] OK q='{query[:60]}' ({len(papers)} papers via Mistral, md={md_size}B)"
    )
    return batch


__all__ = [
    "SCHOLAR_BASE_URL",
    "SCHOLAR_CACHE_KEY_PREFIX",
    "SCHOLAR_CACHE_TTL",
    "SCHOLAR_CB_FAIL_KEY",
    "SCHOLAR_CB_OPEN_DURATION",
    "SCHOLAR_CB_OPEN_KEY",
    "SCHOLAR_CB_THRESHOLD",
    "SCHOLAR_HTTP_TIMEOUT",
    "SCHOLAR_MARKDOWN_MAX_CHARS",
    "SCHOLAR_MIN_HTML_BYTES",
    "SCHOLAR_MIN_MARKDOWN_BYTES",
    "SCHOLAR_RATE_INTERVAL",
    "SCHOLAR_RATE_LOCK_KEY",
    "ScholarBatch",
    "ScholarPaper",
    "_cache_key",
    "_is_bad_html",
    "_record_failure",
    "_record_success",
    "_reset_state_for_tests",
    "init_scholar_redis",
    "is_circuit_open",
    "parse_scholar_html",
    "parse_scholar_markdown_via_mistral",
    "scholar_paper_to_academic",
    "search_scholar",
]


def scholar_paper_to_academic(sp):
    """Convert a `ScholarPaper` into an `AcademicPaper` compatible with the aggregator pipeline.

    Imports `AcademicPaper` / `Author` / `AcademicSource` lazily to avoid a
    circular import between `academic.schemas` and this module on cold start.
    """
    from .schemas import AcademicPaper, Author, AcademicSource

    external_id = (
        f"scholar_{sp.scholar_id}"
        if sp.scholar_id
        else f"scholar_{hashlib.md5(sp.title.encode('utf-8')).hexdigest()[:12]}"
    )
    return AcademicPaper(
        id=external_id,
        doi=None,
        title=sp.title,
        authors=[Author(name=a) for a in sp.authors],
        year=sp.year,
        venue=sp.venue,
        abstract=sp.abstract,
        citation_count=sp.citation_count,
        url=sp.url,
        pdf_url=sp.pdf_url,
        source=AcademicSource.SCHOLAR,
        relevance_score=0.7,
        is_open_access=sp.pdf_url is not None,
        keywords=[],
    )
