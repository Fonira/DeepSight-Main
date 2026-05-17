"""
Google Scholar Deep Crawl Client
================================
Scraping HTML de la SERP Scholar via proxy Decodo Residential.
Sans API officielle — Phase 4 conditionnelle (Pro+, opt-in deep_search).

Rate limit : 1 query / 5 s (Redis distributed lock + local fallback)
Circuit breaker : 3 failures consecutives -> open 1h
Cache : Redis L1 (TTL 7 jours, key vcache:scholar:{md5(query_normalized)})
Telemetry : record_proxy_usage(provider="scholar_scrape", bytes_in=len(html_bytes))

PR1 scope :
- Service standalone (parse + rate-limit + CB + cache + search).
- NO router integration, NO aggregator hook, NO DB writes.
- scholar_paper_to_academic() ABSENT in PR1 — depends on AcademicSource.SCHOLAR
  enum entry which is added in PR2 (schemas.py modification). The conversion
  helper will land alongside the aggregator phase-4 wiring in PR2.

Hard requirements (spec sect. 4) :
- get_proxied_client() MANDATORY (Hetzner IP blacklisted by Google).
- record_proxy_usage() best-effort after each successful fetch.
- 5s rate limit (NOT 1s, NOT 3s — Scholar bans <3s patterns).
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
SCHOLAR_RATE_INTERVAL = 5.0
SCHOLAR_RATE_LOCK_KEY = "deepsight:scholar:rate_lock"
SCHOLAR_CB_FAIL_KEY = "deepsight:scholar:cb_fail_count"
SCHOLAR_CB_OPEN_KEY = "deepsight:scholar:cb_open_until"
SCHOLAR_CB_THRESHOLD = 3
SCHOLAR_CB_OPEN_DURATION = 3600  # 1 hour
SCHOLAR_CACHE_KEY_PREFIX = "vcache:scholar:"
SCHOLAR_CACHE_TTL = 7 * 24 * 3600  # 7 days
SCHOLAR_HTTP_TIMEOUT = 15.0
SCHOLAR_MIN_HTML_BYTES = 5000

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

    Flow:
      1. Sanitize query, early-return empty batch if blank.
      2. Cache HIT -> short-circuit (no rate-limit, no CB check, no proxy).
      3. Circuit-open -> empty batch.
      4. Decodo hard-stop (MTD > 950MB) -> empty batch.
      5. Rate-limit (5s).
      6. GET via get_proxied_client() (MANDATORY).
      7. record_proxy_usage (best-effort).
      8. Detect bad HTML (429 / 503 / CAPTCHA / too short) -> record_failure + empty.
      9. parse_scholar_html(html) -> papers.
      10. record_success + cache_set (skip cache if papers empty).

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

    # 3. Decodo proxy hard-stop.
    try:
        bypass = await should_bypass_proxy_async()
    except Exception as e:
        logger.debug(f"[SCHOLAR] should_bypass_proxy_async raised: {e}")
        bypass = False
    if bypass:
        logger.warning(f"[SCHOLAR] proxy hard-stop — skip q='{query[:60]}'")
        return _empty_batch(query)

    # 4. Rate limit (5s).
    await _rate_limit()

    # 5. Build request + fire via proxy.
    url = _build_scholar_url(query, limit)
    headers = _build_headers()

    html = ""
    status_code: Optional[int] = None
    try:
        async with get_proxied_client(timeout=SCHOLAR_HTTP_TIMEOUT, headers=headers) as client:
            resp = await client.get(url)
            html = resp.text or ""
            status_code = resp.status_code
    except Exception as e:
        logger.warning(f"[SCHOLAR] HTTP error: {e}")
        await _record_failure("http_exception")
        return _empty_batch(query, raw_html_size=len(html))

    # 6. Telemetry (best-effort).
    try:
        bytes_in = len(html.encode("utf-8", errors="replace")) if html else 0
        if bytes_in > 0:
            await record_proxy_usage(provider="scholar_scrape", bytes_in=bytes_in)
    except Exception as e:
        logger.debug(f"[SCHOLAR] telemetry failed: {e}")

    # 7. Bad-response detection.
    if status_code in (429, 503):
        await _record_failure(f"http_{status_code}")
        return _empty_batch(query, raw_html_size=len(html))
    bad_reason = _is_bad_html(html)
    if bad_reason is not None:
        await _record_failure(bad_reason)
        return _empty_batch(query, raw_html_size=len(html))

    # 8. Parse + record success + cache.
    papers = parse_scholar_html(html)
    await _record_success()

    safe_limit = max(1, min(int(limit), 20))
    batch = ScholarBatch(
        query=query,
        papers=papers[:safe_limit],
        fetched_at=time.time(),
        raw_html_size=len(html),
    )
    await _cache_set(query, batch)
    logger.info(f"[SCHOLAR] OK q='{query[:60]}' ({len(papers)} papers, html={len(html)}B)")
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
    "SCHOLAR_MIN_HTML_BYTES",
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
    "search_scholar",
]
