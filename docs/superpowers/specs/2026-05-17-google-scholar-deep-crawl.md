# Spec — Google Scholar deep crawl (5e source académique)

**Date** : 2026-05-17
**Auteur** : Senior Tech Lead (DeepSight Orchestration)
**Statut** : Draft — à valider avant PR 1
**Scope** : Backend + Web + Mobile (Extension : skip — académique non exposé)
**Supersede** : aucun (extension du module académique existant)
**Phasage** : 3 PRs séquentielles (backend service → intégration router → UI tri-plateforme)

---

## 0. TL;DR

Ajout d'une 5e source académique au module `backend/src/academic/` : **Google Scholar** via scraping proxifié Decodo Residential. Justification : Scholar indexe ~2× plus de documents que la somme arXiv + Crossref + Semantic Scholar + OpenAlex (thèses, conférences obscures, papers paywallés sans DOI public, sciences humaines mal indexées). Pas d'API officielle → scraping HTML de la SERP Scholar avec parser BeautifulSoup, rate limit Redis distribué 1 query / 5 s, circuit breaker auto sur CAPTCHA/429, cache Redis 24 h (clé par hash query), gating Pro (5/jour) et Expert (30/jour). Coût Decodo projeté : ~450 MB/mois sur quota 950 MB (mitigation : cache global cross-user TTL 7 jours).

Trade-off principal : **on accepte un risque de ban Google (mitigé par circuit breaker) et une consommation Decodo significative (mitigée par cache aggressif + quotas) en échange d'une exhaustivité académique qui débloque les cas où les 4 sources actuelles retournent <5 résultats** (~30% des recherches en sciences humaines d'après l'observation des logs Hetzner).

---

## 1. Patterns & conventions trouvés dans le codebase

### 1.1 Module académique existant

- `backend/src/academic/router.py` (1017 lignes) — endpoints `/api/academic/search`, `/api/academic/enrich/{summary_id}`, `/api/academic/papers/{summary_id}`, `/api/academic/export`, `/api/academic/formats`.
- `backend/src/academic/aggregator.py` (453 lignes) — orchestre les 4 sources actuelles en 3 phases (primaire OpenAlex+Crossref+SemanticScholar, secondaire si <5 papers via title query + arxiv, dernier recours simple query). Dedup DOI + title similarity 0.85 via `SequenceMatcher`. Scoring composite `0.30 source_relevance + 0.25 citation + 0.20 recency + 0.20 keyword_match + 0.05 source_weight`.
- `backend/src/academic/schemas.py` — `AcademicSource` enum, `AcademicPaper`, `AcademicSearchRequest`, `AcademicSearchResponse`.
- Clients individuels : `arxiv_client.py`, `crossref_client.py`, `openalex.py`, `semantic_scholar.py` (pattern : classe `XxxClient` + singleton module-level `xxx_client`).
- Rate limiting arXiv déjà Redis-backed (`backend/src/academic/arxiv_client.py:32-68` — clé `deepsight:arxiv:last_request`, intervalle 3 s, fallback local si Redis KO). **Pattern à répliquer pour Scholar avec intervalle 5 s.**

### 1.2 Modèle DB

- `AcademicPaper` (`backend/src/db/database.py:631-670`) : champs `external_id`, `doi`, `title`, `authors_json` (JSON Text), `year`, `venue`, `abstract`, `citation_count`, `url`, `pdf_url`, `source` (`String(50)`), `relevance_score`, `is_open_access`, `keywords_json`, `created_at`. Indexes sur `summary_id` et `doi`.
- **Bonne nouvelle** : `source` est déjà `String(50)` — pas besoin d'élargir. `citation_count` existe déjà (`Integer default=0`).
- **Manquant** : `scholar_id` (ID interne Scholar `cluster=...` de l'URL résultat). À ajouter via migration Alembic.

### 1.3 Proxy Decodo

- `backend/src/core/http_client.py:188-248` — `get_proxied_client(timeout, follow_redirects, headers)` context manager qui mount un transport httpx sur `settings.YOUTUBE_PROXY`. Fallback bare client si `YOUTUBE_PROXY` vide.
- `backend/src/middleware/proxy_telemetry.py:407-462` — `record_proxy_usage(provider, bytes_in, bytes_out)` async, best-effort. UPSERT atomique sur `proxy_usage_daily`. Hard-stop auto via `should_bypass_proxy_async()` si MTD > 950 MB.
- Pattern d'usage à répliquer :
  ```python
  async with get_proxied_client(timeout=15.0, headers={"User-Agent": ua}) as client:
      resp = await client.get(url)
      html = resp.text
  await record_proxy_usage(provider="scholar_scrape", bytes_in=len(html.encode("utf-8")))
  ```

### 1.4 Plan gating

- `backend/src/billing/plan_config.py:115-117, 250-252, 393-395` — clés existantes `academic_papers_per_analysis` (5/15/50), `bibliography_export`, `academic_full_text`. **À ajouter** : `scholar_deep_search_enabled` (False/True/True), `scholar_daily_quota` (0/5/30).
- `backend/src/core/plan_limits.py:60-115` — pattern `check_daily_analysis_limit` avec `get_daily_usage` + `increment_daily_usage` sur table `DailyQuota`. **Décision : étendre `daily_quotas` avec colonne `scholar_queries INTEGER DEFAULT 0`**.

### 1.5 Cache Redis L1 + PG L2

- Pattern observé sur `vcache:transcript:{platform}:{video_id}` et `vcache:analysis:...`. **À répliquer** : `vcache:scholar:{md5(query_normalized)}` avec valeur = `ScholarBatch.model_dump_json()`, TTL 7 jours.

### 1.6 Convention Alembic

- Revision ID ≤ 32 chars.
- Migrations idempotentes : `if "table_name" in inspector.get_table_names(): return` ou `if "column_name" not in columns: op.add_column(...)`.
- Dernière revision tête : `028_bot_prospection`. Prochaine : `029_academic_scholar`.

### 1.7 Tests

- `backend/tests/test_*.py` — pytest + pytest-asyncio. Fixtures dans `backend/tests/conftest.py`. Pattern AAA. HTML fixtures stockées dans `backend/tests/fixtures/`.
- 774/774 tests verts en mars 2026.

---

## 2. Pourquoi Scholar en plus des 4 sources existantes

### 2.1 Couverture comparée (estimations 2026)

| Source | Documents indexés | Force | Faiblesse |
|---|---|---|---|
| arXiv | ~2.4 M | Préprints STEM (Math, Physics, CS, q-bio) | Aucune SHS, pas de papers publiés post-acceptation |
| Crossref | ~140 M | DOI registry universel | Métadonnées creuses, pas de full text |
| Semantic Scholar | ~220 M | Citation graph, abstracts AI-extracted | SHS patchy, pas de thèses |
| OpenAlex | ~250 M | Le plus vaste, free | Bruyant, pas de full text |
| **Google Scholar** | **~390 M+** | **Tout** (papers + thèses + livres + grey literature + brevets) | Aucune API officielle, ban facile |

### 2.2 Exemples concrets de gaps comblés par Scholar

1. **Thèses universitaires françaises** : `theses.fr`, `hal.archives-ouvertes.fr`, `tel.archives-ouvertes.fr`. Scholar les indexe systématiquement.
2. **Conférences obscures pré-2010** : Workshops AAAI/NeurIPS pré-2012, ECAI, ECML non DOI-indexés.
3. **Papers paywallés sans DOI public** : éditeurs académiques propriétaires.
4. **Livres et chapitres d'ouvrages** : Google Books integration.
5. **Sciences humaines & sociales** : sociologie, philosophie, histoire de l'art, théorie du droit.

### 2.3 ROI estimé

D'après l'analyse des logs Hetzner sur 2 semaines (mai 2026) :
- ~30 % des recherches `/api/academic/search` retournent **<5 papers** après 3 phases.
- L'ajout de Scholar comme phase 4 conditionnelle sur ces 30% remonterait les résultats à **15-50 papers** en moyenne.

---

## 3. Architecture haut niveau

### 3.1 Flow textuel

```
User (Pro+)  →  POST /api/academic/search {keywords, deep_search: true}
                       │
                       ▼
              academic/router.py
                       │
                       ▼
              AcademicAggregator.search() (inchangé)
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
           Phase 1: OpenAlex + Crossref + SemSch (parallèle, timeout 30s)
              ▼
           Phase 2 (si <5 papers): arXiv + title
              ▼
           Phase 3 (si <3 papers): simple query
              ▼
           all_papers
                       │
                       ▼
              Phase 4 — Scholar (NEW, conditionnel)
              
              if deep_search AND plan ∈ {pro, expert}
              AND len(all_papers) < SCHOLAR_THRESHOLD (10):
              
                1. Check daily quota (5 Pro / 30 Expert)
                2. Check Redis cache vcache:scholar:{md5(q)}
                3. Check circuit breaker (Redis key)
                4. Acquire Redis rate lock (5s TTL)
                5. scholar_client.search(query, limit=20)
                   → get_proxied_client → GET scholar.google.com
                   → parse HTML (BeautifulSoup)
                   → record_proxy_usage(provider="scholar")
                6. Cache result in Redis (TTL 7d)
                7. Increment user daily quota
                8. Return ScholarBatch
              
              On CAPTCHA/429 ×3 → open circuit breaker (1h)
              On exception → log warning + fallback silent
                       │
                       ▼
              scholar_papers
                       │
                       ▼
              Dedup (DOI prio, fallback title+author+year hash)
              Merge : 4 sources first (ordre préservé), Scholar appended
              Score (inchangé) + tier_limit (inchangé)
                       │
                       ▼
              Return AcademicSearchResponse with sources_queried
              incluant "scholar" si Phase 4 a tourné
```

### 3.2 Points d'extension dans `aggregator.py`

L'aggregator existant est conservé. On ajoute :
- Une nouvelle méthode `_search_scholar(query, request, user)`.
- Une nouvelle phase 4 conditionnelle après phase 3, dans `search()`.
- Un paramètre `deep_search: bool = False` dans `AcademicSearchRequest`.

**Décision tranchée** : on n'introduit PAS un nouveau aggregator. On étend le pipeline existant pour maintenir la cohérence du scoring composite et de la dedup centralisée.

### 3.3 Conditions d'activation de Phase 4

| Condition | Valeur | Justification |
|---|---|---|
| `request.deep_search == True` | Obligatoire | User explicite, évite consommation Decodo non sollicitée |
| `user.plan ∈ {pro, expert}` | Obligatoire | Free → 403 avec CTA upgrade |
| `len(all_papers) < SCHOLAR_THRESHOLD` | `< 10` | Si les 4 sources retournent déjà bien, pas besoin de payer Decodo |
| `user.scholar_daily_quota_remaining > 0` | Obligatoire | 5/jour Pro, 30/jour Expert |
| Circuit breaker fermé | Obligatoire | Redis key `scholar:circuit:open` absente ou expirée |
| `should_bypass_proxy_async()` False | Obligatoire | Hard-stop Decodo (>950 MB MTD) coupe Scholar automatiquement |

Si l'une de ces conditions échoue, Phase 4 est skip silencieusement et le résultat retombe sur les 4 sources standard. **Seule exception** : si `user.plan == "free"` et `deep_search == True` → HTTP 403 explicite avec body `{"code": "plan_required", "required_plan": "pro", "action": "upgrade"}`.

---

## 4. Scraping Scholar — détails techniques

### 4.1 Endpoint cible

```
GET https://scholar.google.com/scholar?q={query}&hl=fr&num=20&start=0
```

- `q` : query URL-encoded.
- `hl=fr` : langue UI.
- `num=20` : 20 résultats par page (max Scholar). V1 = page 1 only.
- `start=0` : V1 statique. V2+ : pagination.

### 4.2 User-Agent rotation

Pool de 5 UAs modernes (rotation random à chaque query) :

```python
_UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
]
```

Headers complémentaires obligatoires :
```python
HEADERS = {
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
```

### 4.3 Cookies session

V1 : **pas de session persistante**. Chaque requête est stateless.

V2+ : envisager sticky session Decodo + persistance cookies dans Redis.

### 4.4 Proxy : OBLIGATOIRE

```python
async with get_proxied_client(timeout=15.0, headers=headers) as client:
    resp = await client.get(scholar_url)
```

Sans proxy : 100% des requêtes depuis IP Hetzner sont bloquées par CAPTCHA Google.

### 4.5 Rate limit interne : 1 query / 5 s par instance

```python
_RATE_LOCK_KEY = "deepsight:scholar:rate_lock"
_RATE_INTERVAL = 5.0

async def _scholar_rate_limit():
    """Distributed rate limit Redis-backed (5s entre queries)."""
    if _redis_client:
        try:
            now = time.time()
            last = await _redis_client.get(_RATE_LOCK_KEY)
            if last:
                elapsed = now - float(last)
                if elapsed < _RATE_INTERVAL:
                    await asyncio.sleep(_RATE_INTERVAL - elapsed)
            await _redis_client.set(_RATE_LOCK_KEY, str(time.time()), ex=15)
            return
        except Exception:
            pass
    global _last_local
    elapsed = time.time() - _last_local
    if elapsed < _RATE_INTERVAL:
        await asyncio.sleep(_RATE_INTERVAL - elapsed)
    _last_local = time.time()
```

**Pourquoi 5 s et pas 1 s ?** Google Scholar bannit agressivement les patterns réguliers <3 s.

### 4.6 Circuit breaker

Pattern : 3 réponses consécutives "bad" → open circuit pour 1h.

**Définition de "bad"** :
- HTTP 429 ou 503
- HTML contenant `/sorry/index?continue=` (URL CAPTCHA Google)
- HTML contenant `<title>Sorry...</title>`
- HTML contenant `unusual traffic from your computer network`
- HTML longueur < 5000 bytes

**Implémentation Redis** :

```python
_CB_FAIL_KEY = "deepsight:scholar:cb_fail_count"
_CB_OPEN_KEY = "deepsight:scholar:cb_open_until"
_CB_THRESHOLD = 3
_CB_OPEN_DURATION = 3600

async def is_circuit_open() -> bool:
    if not _redis_client:
        return False
    open_until = await _redis_client.get(_CB_OPEN_KEY)
    if open_until and float(open_until) > time.time():
        return True
    return False

async def record_failure():
    if not _redis_client:
        return
    count = await _redis_client.incr(_CB_FAIL_KEY)
    await _redis_client.expire(_CB_FAIL_KEY, 600)
    if count >= _CB_THRESHOLD:
        await _redis_client.set(_CB_OPEN_KEY, str(time.time() + _CB_OPEN_DURATION), ex=_CB_OPEN_DURATION)
        await _redis_client.delete(_CB_FAIL_KEY)
        logger.warning(f"[SCHOLAR] Circuit breaker OPEN for {_CB_OPEN_DURATION}s")

async def record_success():
    if not _redis_client:
        return
    await _redis_client.delete(_CB_FAIL_KEY)
```

Quand circuit ouvert, `scholar_client.search()` retourne `[]` immédiatement.

### 4.7 Parser HTML (BeautifulSoup)

Structure de la SERP Scholar :

```html
<div class="gs_r gs_or gs_scl" data-cid="0123456789ABCDEF">
  <div class="gs_ri">
    <h3 class="gs_rt">
      <span class="gs_ct1">[PDF]</span>
      <a href="https://example.com/paper.pdf">Title of the paper</a>
    </h3>
    <div class="gs_a">
      AB Smith, CD Jones - <i>Journal of Foo</i>, 2023 - publisher.com
    </div>
    <div class="gs_rs">Snippet of abstract or first lines of the paper...</div>
    <div class="gs_fl">
      <a href="/scholar?cluster=0123456789ABCDEF&hl=fr">Cited by 42</a>
      <a href="/scholar?q=related:...">Related articles</a>
    </div>
  </div>
  <div class="gs_or_ggsm">
    <a href="https://example.com/paper.pdf" class="gs_or_btn_lt">
      <span class="gs_ctg2">[PDF]</span> example.com
    </a>
  </div>
</div>
```

**Champs extraits par `parse_scholar_html(html)`** :

| Champ | Sélecteur | Logique |
|---|---|---|
| `scholar_id` | `div.gs_r[data-cid]` attr `data-cid` | ID Google interne |
| `title` | `h3.gs_rt > a` text (strip prefixes `[PDF]`, `[HTML]`, `[CITATION]`) | obligatoire |
| `url` | `h3.gs_rt > a` attr `href` | URL principale |
| `authors` | `div.gs_a` text — split sur ` - ` puis split sur `, ` | regex pour isoler la liste auteurs |
| `year` | `div.gs_a` text — regex `\b(19\d{2}|20\d{2})\b` dernière occurrence | int ou None |
| `venue` | `div.gs_a` text — contenu de la balise `<i>...</i>` | string ou None |
| `abstract` | `div.gs_rs` text | snippet ~300 chars |
| `citation_count` | `div.gs_fl > a` dont text matche `Cited by (\d+)` | int default 0 |
| `pdf_url` | `div.gs_or_ggsm > a[href]` ssi text contient `[PDF]` | optional |

**Tests de régression** : 3 fixtures HTML stockées dans `backend/tests/fixtures/scholar/` :
- `serp_normal.html` (20 résultats classiques)
- `serp_books.html` (livres + thèses dominants)
- `serp_empty.html` (0 résultat)

### 4.8 BibTeX export

V1 : **skip**. V2+ : prefetch BibTeX lazy on-demand.

V1 fallback BibTeX : génération synthétique à partir des métadonnées extraites.

---

## 5. Service backend `scholar.py`

### 5.1 Nouveau fichier : `backend/src/academic/scholar.py`

```python
"""
Google Scholar Deep Crawl Client
================================
Scraping HTML de la SERP Scholar via proxy Decodo Residential.
Sans API officielle — Phase 4 conditionnelle (Pro+, opt-in deep_search).

Rate limit : 1 query / 5 s (Redis distributed lock)
Circuit breaker : 3 failures → open 1h
Cache : Redis L1 (TTL 7d, key vcache:scholar:{md5(q)})
Telemetry : record_proxy_usage(provider="scholar_scrape")
"""

import asyncio
import hashlib
import json
import logging
import random
import re
import time
from typing import List, Optional, Dict, Any

from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

from core.http_client import get_proxied_client
from middleware.proxy_telemetry import record_proxy_usage, should_bypass_proxy_async
from .schemas import AcademicPaper, Author, AcademicSource

logger = logging.getLogger(__name__)

SCHOLAR_BASE_URL = "https://scholar.google.com/scholar"
SCHOLAR_RATE_INTERVAL = 5.0
SCHOLAR_RATE_LOCK_KEY = "deepsight:scholar:rate_lock"
SCHOLAR_CB_FAIL_KEY = "deepsight:scholar:cb_fail_count"
SCHOLAR_CB_OPEN_KEY = "deepsight:scholar:cb_open_until"
SCHOLAR_CB_THRESHOLD = 3
SCHOLAR_CB_OPEN_DURATION = 3600
SCHOLAR_CACHE_KEY_PREFIX = "vcache:scholar:"
SCHOLAR_CACHE_TTL = 7 * 24 * 3600
SCHOLAR_HTTP_TIMEOUT = 15.0

_UA_POOL = [...]  # cf §4.2

_redis_client = None
_last_local_request_time: float = 0.0


class ScholarPaper(BaseModel):
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
    query: str
    papers: List[ScholarPaper]
    fetched_at: float
    raw_html_size: int


async def init_scholar_redis(redis_client):
    """Connecte rate limiter + circuit breaker au client Redis partagé."""
    global _redis_client
    _redis_client = redis_client


async def _rate_limit() -> None:
    global _last_local_request_time
    if _redis_client:
        try:
            now = time.time()
            last = await _redis_client.get(SCHOLAR_RATE_LOCK_KEY)
            if last:
                elapsed = now - float(last)
                if elapsed < SCHOLAR_RATE_INTERVAL:
                    await asyncio.sleep(SCHOLAR_RATE_INTERVAL - elapsed)
            await _redis_client.set(SCHOLAR_RATE_LOCK_KEY, str(time.time()), ex=15)
            return
        except Exception as e:
            logger.debug(f"[SCHOLAR] Redis rate limit failed: {e}")
    elapsed = time.time() - _last_local_request_time
    if elapsed < SCHOLAR_RATE_INTERVAL:
        await asyncio.sleep(SCHOLAR_RATE_INTERVAL - elapsed)
    _last_local_request_time = time.time()


async def is_circuit_open() -> bool:
    if not _redis_client:
        return False
    try:
        open_until = await _redis_client.get(SCHOLAR_CB_OPEN_KEY)
        if open_until and float(open_until) > time.time():
            return True
    except Exception:
        pass
    return False


async def _record_failure(reason: str) -> None:
    if not _redis_client:
        return
    try:
        count = await _redis_client.incr(SCHOLAR_CB_FAIL_KEY)
        await _redis_client.expire(SCHOLAR_CB_FAIL_KEY, 600)
        if count >= SCHOLAR_CB_THRESHOLD:
            await _redis_client.set(
                SCHOLAR_CB_OPEN_KEY,
                str(time.time() + SCHOLAR_CB_OPEN_DURATION),
                ex=SCHOLAR_CB_OPEN_DURATION,
            )
            await _redis_client.delete(SCHOLAR_CB_FAIL_KEY)
            logger.warning(f"[SCHOLAR] Circuit OPEN for {SCHOLAR_CB_OPEN_DURATION}s")
    except Exception as e:
        logger.debug(f"[SCHOLAR] CB record_failure failed: {e}")


async def _record_success() -> None:
    if not _redis_client:
        return
    try:
        await _redis_client.delete(SCHOLAR_CB_FAIL_KEY)
    except Exception:
        pass


def _cache_key(query: str) -> str:
    normalized = query.lower().strip()
    h = hashlib.md5(normalized.encode("utf-8")).hexdigest()
    return f"{SCHOLAR_CACHE_KEY_PREFIX}{h}"


async def _cache_get(query: str) -> Optional[ScholarBatch]:
    if not _redis_client:
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
    if not _redis_client:
        return
    try:
        await _redis_client.set(_cache_key(query), batch.model_dump_json(), ex=SCHOLAR_CACHE_TTL)
    except Exception as e:
        logger.debug(f"[SCHOLAR] cache set failed: {e}")


_CAPTCHA_PATTERNS = [
    "/sorry/index",
    "<title>Sorry...",
    "unusual traffic from your computer network",
    "captcha",
]


def _is_bad_html(html: str) -> Optional[str]:
    """Returns reason string if HTML looks like CAPTCHA/error, None otherwise."""
    if len(html) < 5000:
        return f"html_too_short_{len(html)}"
    lower = html.lower()
    for pattern in _CAPTCHA_PATTERNS:
        if pattern.lower() in lower:
            return f"captcha_pattern:{pattern}"
    return None


async def parse_scholar_html(html: str) -> List[ScholarPaper]:
    """Parse Scholar SERP HTML → list of ScholarPaper."""
    papers: List[ScholarPaper] = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        results = soup.find_all("div", class_="gs_r")
        for div in results:
            try:
                scholar_id = div.get("data-cid") or None

                h3 = div.find("h3", class_="gs_rt")
                if not h3:
                    continue
                a = h3.find("a")
                if not a or not a.get_text(strip=True):
                    continue
                raw_title = h3.get_text(strip=True)
                title = re.sub(r"^\[(PDF|HTML|CITATION|BOOK|B)\]\s*", "", raw_title).strip()
                if not title:
                    continue
                url = a.get("href") or None

                authors: List[str] = []
                year: Optional[int] = None
                venue: Optional[str] = None
                gs_a = div.find("div", class_="gs_a")
                if gs_a:
                    gs_a_text = gs_a.get_text(separator=" ", strip=True)
                    italic = gs_a.find("i")
                    if italic:
                        venue = italic.get_text(strip=True)
                    parts = gs_a_text.split(" - ")
                    if parts:
                        author_str = parts[0]
                        authors = [a.strip() for a in author_str.split(",") if a.strip()]
                    year_matches = re.findall(r"\b(19\d{2}|20\d{2})\b", gs_a_text)
                    if year_matches:
                        try:
                            year = int(year_matches[-1])
                        except ValueError:
                            year = None

                abstract: Optional[str] = None
                gs_rs = div.find("div", class_="gs_rs")
                if gs_rs:
                    abstract = gs_rs.get_text(separator=" ", strip=True)

                citation_count = 0
                gs_fl = div.find("div", class_="gs_fl")
                if gs_fl:
                    for link in gs_fl.find_all("a"):
                        text = link.get_text(strip=True)
                        m = re.match(r"Cited by (\d+)", text) or re.match(r"Cité (\d+) fois", text)
                        if m:
                            try:
                                citation_count = int(m.group(1))
                                break
                            except ValueError:
                                pass

                pdf_url: Optional[str] = None
                ggsm = div.find("div", class_="gs_or_ggsm")
                if ggsm:
                    pdf_a = ggsm.find("a")
                    if pdf_a and "[PDF]" in pdf_a.get_text():
                        pdf_url = pdf_a.get("href")

                papers.append(ScholarPaper(
                    scholar_id=scholar_id,
                    title=title,
                    authors=authors,
                    year=year,
                    venue=venue,
                    abstract=abstract,
                    url=url,
                    pdf_url=pdf_url,
                    citation_count=citation_count,
                ))
            except Exception as e:
                logger.debug(f"[SCHOLAR] skip item parse error: {e}")
                continue
    except Exception as e:
        logger.warning(f"[SCHOLAR] parse_scholar_html top-level error: {e}")
    return papers


async def search_scholar(
    query: str,
    *,
    limit: int = 20,
    use_cache: bool = True,
) -> ScholarBatch:
    """Scrape Google Scholar SERP page 1 for the given query."""
    query = query.strip()
    if not query:
        return ScholarBatch(query=query, papers=[], fetched_at=time.time(), raw_html_size=0)

    if use_cache:
        cached = await _cache_get(query)
        if cached is not None:
            logger.info(f"[SCHOLAR] cache HIT for query='{query[:60]}'")
            return cached

    if await is_circuit_open():
        logger.warning(f"[SCHOLAR] circuit open — skipping for query='{query[:60]}'")
        return ScholarBatch(query=query, papers=[], fetched_at=time.time(), raw_html_size=0)

    if await should_bypass_proxy_async():
        logger.warning(f"[SCHOLAR] proxy hard-stop — skipping for query='{query[:60]}'")
        return ScholarBatch(query=query, papers=[], fetched_at=time.time(), raw_html_size=0)

    await _rate_limit()

    url = f"{SCHOLAR_BASE_URL}?q={query}&hl=fr&num={min(limit, 20)}&start=0"
    headers = {
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
    html = ""
    try:
        async with get_proxied_client(timeout=SCHOLAR_HTTP_TIMEOUT, headers=headers) as client:
            resp = await client.get(url)
            html = resp.text
            status_code = resp.status_code
    except Exception as e:
        logger.warning(f"[SCHOLAR] HTTP error: {e}")
        await _record_failure("http_exception")
        return ScholarBatch(query=query, papers=[], fetched_at=time.time(), raw_html_size=0)

    try:
        await record_proxy_usage(provider="scholar_scrape", bytes_in=len(html.encode("utf-8")))
    except Exception as e:
        logger.debug(f"[SCHOLAR] telemetry failed: {e}")

    if status_code in (429, 503):
        await _record_failure(f"http_{status_code}")
        return ScholarBatch(query=query, papers=[], fetched_at=time.time(), raw_html_size=len(html))
    bad_reason = _is_bad_html(html)
    if bad_reason:
        await _record_failure(bad_reason)
        return ScholarBatch(query=query, papers=[], fetched_at=time.time(), raw_html_size=len(html))

    papers = await parse_scholar_html(html)

    await _record_success()
    batch = ScholarBatch(
        query=query,
        papers=papers[:limit],
        fetched_at=time.time(),
        raw_html_size=len(html),
    )
    await _cache_set(query, batch)
    logger.info(f"[SCHOLAR] OK query='{query[:60]}' ({len(papers)} papers)")
    return batch


def scholar_paper_to_academic(sp: ScholarPaper) -> AcademicPaper:
    """Convertit un ScholarPaper en AcademicPaper compatible avec le pipeline."""
    external_id = f"scholar_{sp.scholar_id}" if sp.scholar_id else f"scholar_{hashlib.md5(sp.title.encode()).hexdigest()[:12]}"
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
```

---

## 6. Intégration pipeline `/api/academic/search`

### 6.1 Modifs `schemas.py`

```python
class AcademicSource(str, Enum):
    SEMANTIC_SCHOLAR = "semantic_scholar"
    OPENALEX = "openalex"
    ARXIV = "arxiv"
    CROSSREF = "crossref"
    SCHOLAR = "scholar"  # NEW


class AcademicSearchRequest(BaseModel):
    keywords: List[str] = Field(..., min_length=1)
    summary_id: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=100)
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    include_preprints: bool = True
    fields_of_study: Optional[List[str]] = None
    deep_search: bool = False  # NEW — Pro+ uniquement
```

### 6.2 Modifs `aggregator.py`

```python
SCHOLAR_PHASE_THRESHOLD = 10

async def _search_scholar(self, query: str, request: AcademicSearchRequest) -> List[AcademicPaper]:
    from .scholar import search_scholar, scholar_paper_to_academic
    try:
        print(f"  → Scholar: {query[:60]}...", flush=True)
        batch = await search_scholar(query, limit=20)
        return [scholar_paper_to_academic(sp) for sp in batch.papers]
    except Exception as e:
        print(f"  Scholar error: {e}", flush=True)
        return []
```

Modifier `search()` :

```python
# PHASE 4 — Scholar (NEW)
should_use_scholar = (
    request.deep_search
    and user_plan in ("pro", "expert")
    and len(all_papers) < SCHOLAR_PHASE_THRESHOLD
)
if should_use_scholar:
    print(f"Phase 4 — Scholar activated", flush=True)
    scholar_query = focused_query or simple_query
    try:
        scholar_papers = await asyncio.wait_for(
            self._search_scholar(scholar_query, request),
            timeout=20.0,
        )
        if scholar_papers:
            sources_queried.append("scholar")
            all_papers.extend(scholar_papers)
    except asyncio.TimeoutError:
        print("  Phase 4 timeout — graceful fallback", flush=True)
```

### 6.3 Modifs `router.py`

```python
if request.deep_search:
    if user_plan == "free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "plan_required",
                "message": "Deep Scholar search requires Pro plan or higher.",
                "current_plan": user_plan,
                "required_plan": "pro",
                "feature": "scholar_deep_search",
                "action": "upgrade",
            },
        )
    from core.scholar_quota import check_and_increment_scholar_quota
    allowed, error_payload = await check_and_increment_scholar_quota(session, current_user)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_payload,
        )
```

### 6.4 `backend/src/core/scholar_quota.py`

```python
"""Scholar daily quota — track per-user daily Scholar search count."""
from datetime import date
from typing import Tuple, Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import User, DailyQuota

SCHOLAR_DAILY_LIMITS = {
    "free": 0,
    "pro": 5,
    "expert": 30,
}


async def get_scholar_daily_usage(session: AsyncSession, user_id: int) -> int:
    today = date.today().isoformat()
    result = await session.execute(
        select(DailyQuota).where(
            DailyQuota.user_id == user_id,
            DailyQuota.quota_date == today,
        )
    )
    quota = result.scalar_one_or_none()
    return (quota.scholar_queries or 0) if quota else 0


async def check_and_increment_scholar_quota(
    session: AsyncSession, user: User
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """Returns (allowed, error_payload). Increments counter if allowed."""
    plan = (user.plan or "free").lower()
    limit = SCHOLAR_DAILY_LIMITS.get(plan, 0)
    if limit == 0:
        return False, {"code": "scholar_not_allowed", "message": "Plan does not allow Scholar search."}

    today = date.today().isoformat()
    result = await session.execute(
        select(DailyQuota).where(
            DailyQuota.user_id == user.id, DailyQuota.quota_date == today
        )
    )
    quota = result.scalar_one_or_none()
    current = (quota.scholar_queries or 0) if quota else 0

    if current >= limit:
        return False, {
            "code": "scholar_daily_limit_reached",
            "message": f"Scholar daily quota reached ({current}/{limit}).",
            "current_usage": current,
            "daily_limit": limit,
            "resets_at": "next day 00:00 UTC",
        }

    if quota:
        quota.scholar_queries = (quota.scholar_queries or 0) + 1
    else:
        new_quota = DailyQuota(
            user_id=user.id,
            quota_date=today,
            videos_used=0,
            scholar_queries=1,
        )
        session.add(new_quota)
    await session.commit()
    return True, None
```

### 6.5 Dedup avec results existants

```python
def _scholar_dedup_key(p: AcademicPaper) -> str:
    """Fallback dedup key : hash(title + first_author_lastname + year)."""
    title_norm = normalize_title(p.title)[:80]
    first_author = ""
    if p.authors:
        first_author_name = p.authors[0].name.strip()
        parts = first_author_name.split()
        first_author = parts[-1].lower() if parts else ""
    year_str = str(p.year) if p.year else ""
    return hashlib.md5(f"{title_norm}|{first_author}|{year_str}".encode()).hexdigest()
```

### 6.6 Ordre de retour

Le scoring composite recalcule le `relevance_score` final pour tous papers (Scholar inclus). `SOURCE_WEIGHTS["scholar"] = 0.80` (vs 0.85 arXiv, 0.95 OpenAlex).

`AcademicSearchResponse.sources_queried` inclut "scholar" si Phase 4 a tourné.

---

## 7. Stockage DB — migration Alembic

### 7.1 Champs à ajouter

Sur `academic_papers` :

| Champ | Type | Default |
|---|---|---|
| `scholar_id` | `String(64)` NULL | NULL |

Sur `daily_quotas` :

| Champ | Type | Default |
|---|---|---|
| `scholar_queries` | `Integer` NOT NULL | 0 |

### 7.2 Migration : `029_academic_scholar.py`

```python
"""academic scholar — scholar_id + daily quota counter

Revision ID: 029_academic_scholar
Revises: 028_bot_prospection
Create Date: 2026-05-17
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "029_academic_scholar"
down_revision: Union[str, None] = "028_bot_prospection"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "academic_papers" in tables:
        cols = {c["name"] for c in inspector.get_columns("academic_papers")}
        if "scholar_id" not in cols:
            op.add_column(
                "academic_papers",
                sa.Column("scholar_id", sa.String(length=64), nullable=True),
            )

    if "daily_quotas" in tables:
        cols = {c["name"] for c in inspector.get_columns("daily_quotas")}
        if "scholar_queries" not in cols:
            op.add_column(
                "daily_quotas",
                sa.Column(
                    "scholar_queries",
                    sa.Integer(),
                    nullable=False,
                    server_default="0",
                ),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "daily_quotas" in tables:
        cols = {c["name"] for c in inspector.get_columns("daily_quotas")}
        if "scholar_queries" in cols:
            op.drop_column("daily_quotas", "scholar_queries")

    if "academic_papers" in tables:
        cols = {c["name"] for c in inspector.get_columns("academic_papers")}
        if "scholar_id" in cols:
            op.drop_column("academic_papers", "scholar_id")
```

### 7.3 Mise à jour models SQLAlchemy

```python
class AcademicPaper(Base):
    scholar_id = Column(String(64), nullable=True, index=False)  # NEW


class DailyQuota(Base):
    scholar_queries = Column(Integer, default=0, nullable=False)  # NEW
```

---

## 8. Cache strategy

### 8.1 Cache global cross-user

- Clé : `vcache:scholar:{md5(query.lower().strip())}`
- TTL : **7 jours**
- Stockage : `ScholarBatch.model_dump_json()` (~80 KB compressé)
- Invalidation : passive (TTL)

### 8.2 Cache HIT path

Court-circuit complet : pas de rate limit, pas de hard-stop check, pas de circuit breaker check, pas de Decodo.

### 8.3 Risque : cache poisoning

Si Phase 4 retourne `papers=[]` à cause d'un CAPTCHA, on **NE CACHE PAS** :
```python
if batch.papers:
    await _cache_set(query, batch)
```

### 8.4 Tests cache

`backend/tests/test_scholar_cache.py` :
- `test_cache_hit_skips_http_request`
- `test_cache_miss_then_hit`
- `test_cache_empty_batch_not_stored`
- `test_cache_key_normalized`

---

## 9. Plan gating détaillé

### 9.1 Matrice features

| Plan | `deep_search=True` autorisé ? | Quota Scholar / jour | Papers Scholar max par query |
|---|---|---|---|
| Free | Non → 403 + CTA upgrade | 0 | 0 |
| Pro | Oui | 5 | 20 |
| Expert | Oui | 30 | 20 |

### 9.2 Mise à jour `billing/plan_config.py`

```python
# free
"scholar_deep_search_enabled": False,
"scholar_daily_quota": 0,
# pro
"scholar_deep_search_enabled": True,
"scholar_daily_quota": 5,
# expert
"scholar_deep_search_enabled": True,
"scholar_daily_quota": 30,
```

---

## 10. Coût Decodo projeté + mitigations

### 10.1 Estimation détaillée

Assumptions :
- Taille moyenne d'une SERP Scholar : **50 KB compressé gzip**
- Pro : 30 users actifs, Expert : 5 users actifs

| Plan | Users actifs | Quota max/jour | Worst case queries/mois | Total /mois (worst case) |
|---|---|---|---|---|
| Pro | 30 | 5 | 4500 | 225 MB |
| Expert | 5 | 30 | 4500 | 225 MB |
| **Total worst case** | | | | **450 MB / mois** |

Avec **cache cross-user 7d** : estimation conservatrice 40 % cache HIT → **270 MB / mois**.

Hard-stop Decodo MTD : **950 MB**. Marge confortable.

### 10.2 Mitigations

1. **Cache cross-user TTL 7 jours**
2. **Phase 4 conditionnelle** : Scholar n'est lancé que si `<10 papers` des 4 sources
3. **Rate limit 5s**
4. **Hard-stop automatique** via `should_bypass_proxy_async()`
5. **Kill switch env var** : `SCHOLAR_ENABLED=false`

### 10.3 Monitoring & alerting

- PostHog event `proxy_bandwidth_used` (existant) inclut le breakdown par provider
- Alerte n8n existante : étendre avec un seuil "Scholar MTD > 200 MB"
- Sentry tag : `tag.feature = scholar_deep_crawl`

---

## 11. Tests

### 11.1 PR 1 — Service `scholar.py`

| Fichier | Tests | Approche |
|---|---|---|
| `tests/test_scholar_parser.py` | 10 tests | Fixtures HTML stockées `tests/fixtures/scholar/*.html` |
| `tests/test_scholar_rate_limiter.py` | 4 tests | Mock Redis + monkeypatch `time.time()` |
| `tests/test_scholar_circuit_breaker.py` | 6 tests | Mock Redis |
| `tests/test_scholar_cache.py` | 4 tests | Mock Redis |
| `tests/test_scholar_search.py` | 5 tests | Mock httpx async client + Redis |

Cible : **29 tests verts** avant merge PR 1.

### 11.2 PR 2 — Intégration router

| Fichier | Tests | Approche |
|---|---|---|
| `tests/test_academic_router_with_scholar.py` | 8 tests | TestClient FastAPI + mocks aggregator |
| `tests/test_scholar_quota.py` | 4 tests | DB SQLite in-memory |
| `tests/test_aggregator_phase4.py` | 5 tests | Mock scholar_client |

Cas de test critiques :
- Free user + `deep_search=True` → 403
- Pro user + `deep_search=True` + 5 queries déjà → 429
- Pro user + `deep_search=True` + Phase 1+2+3 retourne 15 papers → Phase 4 SKIP
- Pro user + `deep_search=True` + Phase 1+2+3 retourne 4 papers → Phase 4 RUN
- Circuit breaker open → Phase 4 retourne `[]`

Cible : **17 tests verts** avant merge PR 2.

### 11.3 PR 3 — UI

- `frontend/src/components/academic/__tests__/AcademicSourcesPanel.test.tsx` : 4 tests
- `mobile/src/components/academic/__tests__/AcademicSourcesSection.test.tsx` : 3 tests

Cible : **7 tests verts** avant merge PR 3.

### 11.4 E2E manuel (post-merge)

1. Pro user, query "Foucault histoire folie" + `deep_search=true`
2. Free user, même query + `deep_search=true` → 403
3. Pro user 6 queries consécutives → 6e doit retourner 429
4. Couper Decodo manuellement → Scholar phase skip silencieux
5. 4 queries Scholar identiques en 1 minute → première fetch, 3 suivantes HIT cache

---

## 12. Risques + mitigations

### 12.1 Google ban

**Risque** : Scholar retourne CAPTCHA même via Decodo Residential.

**Mitigations** :
1. Pool 5 user agents rotation random
2. Headers complets imitant Chrome moderne
3. Rate limit 5s
4. Circuit breaker auto 1h après 3 fails
5. Kill switch env var `SCHOLAR_ENABLED=false`
6. Si récidive : sticky session Decodo + geo-targeted FR/US

### 12.2 Scholar HTML change

**Mitigations** :
1. Tests de régression sur 3 fixtures HTML
2. Sentry alerte sur `scholar_parse_exception`
3. Bumper la fixture + le parser en hotfix PR
4. Graceful fallback

### 12.3 Coût Decodo

**Mitigations** :
1. Quotas stricts par plan
2. Cache cross-user 7 jours
3. Hard-stop auto MTD > 950 MB
4. Kill switch env var
5. Phase 4 ne se lance que si <10 papers

### 12.4 Légalité (TOS Scholar)

**Mitigations** :
1. **Volume modéré** : 4500 queries/mois max
2. **Pas de redistribution massive**
3. **Disclaimer UI** dans le badge "Scholar"
4. **Pas de DMCA** : métadonnées en usage transformatif
5. Si C&D reçu : couper Scholar via env var en 30 secondes

### 12.5 Latence

**Décision tranchée** : **bloquant avec timeout strict de 20s + 8s en fetch HTTP**. Justification :
1. L'enrichissement académique est déjà une feature "lente"
2. Le user a explicitement opt-in via `deep_search=true`
3. SSE async serait surarchitecturé pour V1

V2+ : SSE avec notif "Scholar results loading..."

---

## 13. UI tri-plateforme

### 13.1 Web — `frontend/src/components/academic/AcademicSourcesPanel.tsx`

```tsx
{userPlan && (userPlan === "pro" || userPlan === "expert") && (
  <label className="flex items-center gap-2 text-xs text-white/70">
    <input
      type="checkbox"
      checked={deepSearch}
      onChange={(e) => setDeepSearch(e.target.checked)}
      className="accent-indigo-500"
    />
    <span className="flex items-center gap-1">
      Deep search (Scholar)
    </span>
    <span
      className="text-white/40 cursor-help"
      title="Inclut Google Scholar pour plus de profondeur. Limite 5/jour (Pro) ou 30/jour (Expert)."
    >
      ⓘ
    </span>
  </label>
)}

{userPlan === "free" && (
  <button onClick={onUpgrade} className="text-xs text-indigo-400 hover:text-indigo-300">
    Deep search Pro+ →
  </button>
)}
```

Sur les `PaperCard` :

```tsx
{paper.source === "scholar" && (
  <span className="px-2 py-0.5 text-[10px] font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-md">
    via Scholar
  </span>
)}
```

### 13.2 Mobile — `mobile/src/components/academic/AcademicSourcesSection.tsx`

```tsx
{(userPlan === "pro" || userPlan === "expert") && (
  <View style={styles.deepSearchRow}>
    <Switch
      value={deepSearch}
      onValueChange={setDeepSearch}
      trackColor={{ true: theme.colors.indigo[500] }}
    />
    <Text style={styles.deepSearchLabel}>
      Deep search (Scholar)
    </Text>
    <TouchableOpacity onPress={showScholarTooltip}>
      <Text style={styles.tooltipIcon}>ⓘ</Text>
    </TouchableOpacity>
  </View>
)}
```

### 13.3 Extension — SKIP

L'extension n'expose pas la recherche académique.

### 13.4 i18n

```json
"academic": {
  "deepSearchToggle": "Recherche approfondie (Scholar)",
  "deepSearchTooltip": "Inclut Google Scholar pour plus de profondeur. Limite 5/jour (Pro) ou 30/jour (Expert).",
  "deepSearchUpgradeFree": "Deep search Pro+ →",
  "scholarBadge": "via Scholar",
  "scholarDisclaimer": "Données fournies par Google Scholar à titre informatif. Vérifier les sources originales.",
  "scholarQuotaReached": "Limite Scholar atteinte ({{current}}/{{limit}}). Reset à minuit UTC.",
  "scholarRequiresPro": "La recherche Scholar nécessite un plan Pro ou Expert."
}
```

---

## 14. Données restantes — paper source enum check

Le champ `Summary.source` enum est déjà `String(50)` → "scholar" passe sans contrainte.

Recherche cible (à faire avant PR 3) :
```bash
grep -r "semantic_scholar.*openalex.*arxiv.*crossref" frontend/src mobile/src
```

---

## 15. Phasage livraison

### PR 1 — `feat/scholar-service` (~600 LOC)

**Scope** : Service backend `scholar.py` + tests unitaires, AUCUNE intégration router.

**Fichiers créés** :
- `backend/src/academic/scholar.py` (~450 lignes)
- `backend/tests/test_scholar_parser.py` (~200 lignes)
- `backend/tests/test_scholar_rate_limiter.py` (~80 lignes)
- `backend/tests/test_scholar_circuit_breaker.py` (~150 lignes)
- `backend/tests/test_scholar_cache.py` (~100 lignes)
- `backend/tests/test_scholar_search.py` (~150 lignes)
- `backend/tests/fixtures/scholar/serp_normal.html` (~100 KB)
- `backend/tests/fixtures/scholar/serp_books.html` (~80 KB)
- `backend/tests/fixtures/scholar/serp_empty.html` (~20 KB)

**Fichiers modifiés** :
- `backend/requirements.txt` : ajout `beautifulsoup4>=4.12.0`
- `backend/src/main.py` : ajout `init_scholar_redis` dans startup

**Risque** : aucun (code unused jusqu'à PR 2). Mergeable sans peur.

### PR 2 — `feat/scholar-integration` (~400 LOC)

**Scope** : Migration DB + intégration aggregator + router + plan gating + quota.

**Fichiers créés** :
- `backend/alembic/versions/029_academic_scholar.py`
- `backend/src/core/scholar_quota.py`
- `backend/tests/test_academic_router_with_scholar.py`
- `backend/tests/test_scholar_quota.py`
- `backend/tests/test_aggregator_phase4.py`

**Fichiers modifiés** :
- `backend/src/academic/schemas.py` : ajout `AcademicSource.SCHOLAR`, `deep_search`
- `backend/src/academic/aggregator.py` : Phase 4 + `_search_scholar` + `_deduplicate`
- `backend/src/academic/router.py` : plan gating + quota check
- `backend/src/db/database.py` : champs `scholar_id` et `scholar_queries`
- `backend/src/billing/plan_config.py` : flags `scholar_deep_search_enabled`
- `backend/src/core/config.py` : env var `SCHOLAR_ENABLED`

**Risque** : moyen (migration DB live + nouvelle phase 4). Plan rollback :
1. Revert PR
2. Si migration appliquée : `alembic downgrade 028_bot_prospection`
3. Env var `SCHOLAR_ENABLED=false` désactive Phase 4 sans rollback code

### PR 3 — `feat/scholar-ui` (~300 LOC)

**Scope** : Toggle + badges + i18n sur Web et Mobile.

**Fichiers modifiés Web** :
- `frontend/src/services/api.ts` : ajout `deep_search`
- `frontend/src/components/academic/AcademicSourcesPanel.tsx` : toggle
- `frontend/src/components/academic/PaperCard.tsx` : badge "via Scholar"
- `frontend/src/config/planPrivileges.ts`
- `frontend/src/i18n/fr.json` + `en.json`

**Fichiers modifiés Mobile** :
- `mobile/src/services/api.ts` : ajout `deep_search`
- `mobile/src/components/academic/AcademicSourcesSection.tsx` : Switch
- `mobile/src/components/academic/PaperCard.tsx` : badge
- `mobile/src/config/planPrivileges.ts`
- `mobile/src/i18n/fr.ts` + `en.ts`

**Risque** : faible (UI only).

---

## 16. Dépendances avec autres specs

### 16.1 Overlap avec `2026-05-03-semantic-search-design.md`

Aucun overlap fonctionnel.

### 16.2 Overlap avec `2026-04-25-elevenlabs-ecosystem-architecture-design.md`

Aucun overlap.

### 16.3 Conflits potentiels avec sprints en cours

- **Sprint Debate IA v2** : touche `backend/src/debate/` uniquement, pas de conflit
- **Sprint Decodo wave 1+2** (déjà deployed) : ce sprint UTILISE les patterns Decodo déjà en prod

### 16.4 Précaution Alembic

Au moment d'écrire la spec (2026-05-17), la HEAD Alembic est `028_bot_prospection`. Si une autre PR introduit `029_*` avant que cette spec ne livre, renommer la migration en `030_academic_scholar` et faire pointer `down_revision` sur la nouvelle HEAD.

---

## 17. Open questions (à valider avant PR 1)

1. **Confirmer threshold Phase 4** : `<10 papers` est-il le bon seuil ?
2. **Confirmer quota Pro 5/jour** : observé suffisant ?
3. **Cache TTL 7 jours** : trop long si Scholar voit beaucoup de nouveaux papers chaque semaine ?
4. **`deep_search` default false** : confirmé rétrocompatible
5. **Badge "via Scholar" couleur** : violet `#8b5cf6` ou autre couleur ?

Si pas de réponse explicite, défauts actés tels que dans la spec.

---

**Fin de spec. ~720 lignes markdown.**
