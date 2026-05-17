# Analyse des commentaires + Verdict communauté — Spec 2026-05-17

**Date** : 2026-05-17
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Active — prête pour implémentation via sub-agents Opus 4.7 parallèles
**Plateformes** : Web + Mobile + Extension (tri-plateforme)
**Supersedes** : implicitement la logique opt-in `customization.analyze_comments` v2.1 (`backend/src/videos/youtube_comments.py` + flag UI Pro qui n'a jamais été branché sur le frontend principal). Ce module legacy est conservé pour rétrocompatibilité mais n'est plus le chemin par défaut.

---

## 1. Architecture haut niveau

### 1.1 Flow analyse v6 actuel (rappel — `backend/src/videos/router.py`)

```
POST /api/videos/analyze
  │
  ├─ Auth + plan + credit reservation (security)
  ├─ Cache check (Summary user×video, max 7j)
  │
  ├─ Background task v6 (asyncio)
  │   ├─ [step 1] get_video_info (YouTube oEmbed | TikTok scrape)
  │   ├─ [step 2] get_transcript_with_timestamps (7-method chain)
  │   ├─ [step 3+4+5+6 PARALLEL via asyncio.gather]
  │   │     • detect_category()
  │   │     • analyze_comments() [SI custom_opts.analyze_comments=True — legacy v2.1, jamais branché]
  │   │     • get_enriched_metadata()
  │   │     • get_pre_analysis_context() (Perplexity)
  │   ├─ [step 7]  build_customized_prompt()
  │   ├─ [step 8]  generate_summary() (Mistral, modèle par plan)
  │   ├─ [step 9]  visual_analysis si flag (Phase 2)
  │   ├─ [step 10] save_summary() + structured_index + chunks
  │   └─ [step 11] consume_reserved_credits + increment_daily_usage
  │
  └─ Notification SSE → frontend poll /status/{task_id}
```

### 1.2 Où s'insère la feature "Verdict communauté"

La branche `community_analysis` est ajoutée comme **5e tâche parallèle** dans le `asyncio.gather` existant (entre transcript et generate_summary). Si elle plante, `community_analysis = None` et le pipeline retourne quand même le résumé Mistral. Aucun `await` bloquant côté chemin critique. Timeout `asyncio.wait_for(..., 30s)` strict.

### 1.3 Stockage

```
summaries (table existante)
  ├─ summary_content (existing, prose Mistral)
  ├─ summary_extras  (existing JSONB, quotes/takeaways/themes)
  ├─ visual_analysis (existing JSONB, frames + Vision)
  └─ community_analysis (NEW JSONB nullable)  ◀──── ajouté par alembic 029
```

### 1.4 Flow UI

```
Web Hub (AnalysisHub → SynthesisTab)
  ├─ Header thumbnail + actions
  ├─ <SummaryNativeView extras={...} />
  ├─ <CommunityTakeSection take={summary.community_analysis} /> ◀──── NEW
  ├─ <AnalysisActionBar />
  └─ DeepResearchSources / ConceptsGlossary / Academic / StudyTools

Mobile (app/(tabs)/analysis/[id].tsx → tab "Résumé")
  ├─ AnalysisContentDisplay
  ├─ <CommunityTakeSection take={summary.community_analysis} /> ◀──── NEW
  └─ ActionBar

Extension (sidepanel/views/MainView.tsx → SynthesisView)
  ├─ SynthesisView (résumé compact)
  ├─ <CommunityTakeCompact take={summary.community_analysis} /> ◀──── NEW (1 ligne + CTA web)
  └─ SuggestionPills
```

---

## 2. Scraping commentaires

### 2.1 YouTube — choix : **Innertube API non officielle**

**3 méthodes évaluées** :

| Méthode | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Innertube `/youtubei/v1/next`** + continuation tokens | Pas de dépendance binaire, JSON pur, rapide (~1-2s), tout passe par httpx → traçable proxy_telemetry | Reverse-engineering du payload (`{context: {client: {clientName: "WEB", clientVersion: "2.20...", hl, gl}}, videoId, continuation}`), structure JSON volumineuse à parser | **Recommandé** |
| B. yt-dlp `--get-comments` | Battle-tested, gère les replies | Subprocess (CPU spike), pas de visibilité bytes via httpx → contournement telemetry, **bloqué IP Hetzner** sans cookies (cf [[reference_youtube-download-hetzner-blocked]]), lent (~30-60s/100 comments) | Non |
| C. Scraping HTML `/watch?v=` | Aucun reverse-engineering | Comments **ne sont pas dans le HTML initial** (lazy-loaded via Innertube) → revient à A mais en plus dégueulasse | Non |

**Implémentation A — `backend/src/comments/youtube_scraper.py`** :

```python
INNERTUBE_NEXT_URL = "https://www.youtube.com/youtubei/v1/next"
INNERTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"  # WEB public, sniffé depuis youtube.com
INNERTUBE_CONTEXT = {
    "client": {
        "clientName": "WEB",
        "clientVersion": "2.20260513.01.00",
        "hl": "en", "gl": "US",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...",
    }
}

async def _fetch_continuation(video_id: str) -> str | None:
    """Step 1 : récupère le continuation token initial pour les comments."""
    payload = {**INNERTUBE_CONTEXT, "videoId": video_id}
    async with get_proxied_client(timeout=12.0) as client:
        resp = await client.post(
            f"{INNERTUBE_NEXT_URL}?key={INNERTUBE_API_KEY}",
            json=payload,
        )
        await record_proxy_usage(provider="comments_youtube", bytes_in=len(resp.content), bytes_out=len(json.dumps(payload)))
        if resp.status_code != 200:
            return None
        data = resp.json()
    for panel in _walk(data, "engagementPanelSectionListRenderer"):
        if panel.get("targetId") == "engagement-panel-comments-section":
            content = panel["content"]["sectionListRenderer"]["contents"][0]
            return content["itemSectionRenderer"]["contents"][0]["continuationItemRenderer"]["continuationEndpoint"]["continuationCommand"]["token"]
    return None

async def _fetch_comments_page(continuation_token: str) -> tuple[list[dict], str | None]:
    """Step 2+ : suit la continuation pour paginer (≈20 comments/page)."""
    payload = {**INNERTUBE_CONTEXT, "continuation": continuation_token}
    async with get_proxied_client(timeout=12.0) as client:
        resp = await client.post(
            f"{INNERTUBE_NEXT_URL}?key={INNERTUBE_API_KEY}",
            json=payload,
        )
        await record_proxy_usage(provider="comments_youtube", bytes_in=len(resp.content), bytes_out=len(json.dumps(payload)))
        if resp.status_code != 200:
            return [], None
        data = resp.json()
    comments = list(_extract_comment_threads(data))
    next_token = _extract_next_continuation(data)
    return comments, next_token

async def fetch_youtube_comments(
    video_id: str,
    *,
    top_n: int = 100,
    random_n: int = 50,
    sort_by: str = "top",
    max_pages: int = 10,
) -> CommentsBatch:
    """Sort=top par défaut Innertube. Pour newest, suivre sub-menu Sort by."""
    ...
```

**Volume estimé** :
- Page Innertube `/next` initiale : ~150-300 KB
- Pages comments suivantes : ~25-40 KB chacune (20 comments)
- Pour 150 comments → 7-8 pages → ~200-400 KB total scrape
- **Estimation conservatrice : ~250 KB par vidéo YouTube**

**Cas dégradés** :
- **Commentaires désactivés** (`engagementPanel` absent) → `CommentsBatch(comments=[], disabled=True)`
- **Vidéo très récente** (<20 comments) → retourne ce qui existe, `random_n` clamp
- **Innertube 403/429** → 1 retry après backoff 2s puis abandon
- **Innertube key invalide** → `INNERTUBE_API_KEY` lu depuis `core/config.py` settings → env var `YOUTUBE_INNERTUBE_KEY` override. Hot-rotate sans redeploy.

### 2.2 TikTok — choix : **endpoint web `/api/comment/list/`**

**3 méthodes évaluées** :

| Méthode | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Web `https://www.tiktok.com/api/comment/list/`** | Pas de signature mobile à reproduire, JSON propre `{comments, cursor, has_more}`, déjà testé via proxy Decodo | Webapp signature `_signature` requis depuis 2025 → bypass via `msToken` cookie + `X-Bogus`/`_signature` calculés via byteEnc.js | **Recommandé V1** |
| B. Mobile API `api.tiktokv.com/aweme/v1/comment/list/` | Plus stable, retourne plus de champs | Signature **change tous les 1-3 mois** → maintenance lourde | V2 fallback |
| C. tikwm.com `/api/comment/list/` (3rd party) | Zero signature, gratuit jusqu'à ~1 req/s | **Cassé externally** depuis 2026-05, pas de SLA | Non |

**Implémentation A — `backend/src/comments/tiktok_scraper.py`** :

```python
TIKTOK_WEB_COMMENTS_URL = "https://www.tiktok.com/api/comment/list/"

async def fetch_tiktok_comments(
    video_id: str,
    *,
    top_n: int = 100,
    random_n: int = 50,
) -> CommentsBatch:
    """
    Params clés (URL encoded GET) :
      aweme_id={video_id}, count=50 (max page), cursor=0,
      WebIdLastTime, current_region, msToken={cookie}
    Headers obligatoires :
      Referer: https://www.tiktok.com/@user/video/{id}
      User-Agent: Mozilla/5.0 ... Chrome/120
    msToken : généré aléatoirement (32 chars hex) en V1.
    Pagination : count=50 par page, suivre cursor. Max 4 pages = 200 raw comments.
    """
    ...
```

**Volume estimé** : ~150 KB par vidéo TikTok (3 pages × 50 KB).

**Cas dégradés** :
- **Comments désactivés** : `status_code=10202` ou `comments_total=0` → `disabled=True`
- **Vidéo privée/supprimée** : abandon silencieux
- **Signature renforcée future** : fallback méthode B documenté

### 2.3 Proxy Decodo systématique

Les deux scrapers DOIVENT utiliser `get_proxied_client()`. L'IP datacenter Hetzner est bloquée à la fois par YouTube (Innertube renvoie 403 + "Sign in") et par TikTok (challenge JS + 403).

```python
from core.http_client import get_proxied_client
from middleware.proxy_telemetry import record_proxy_usage, should_bypass_proxy_async

# Hard-stop : si MTD > 700 MB on désactive le scrape comments (feature non critique)
COMMENTS_PROXY_SOFT_LIMIT_BYTES = 700 * 1024 * 1024

async def _should_skip_comments_due_to_quota(session) -> bool:
    from middleware.proxy_telemetry import get_mtd_bytes
    return await get_mtd_bytes(session) > COMMENTS_PROXY_SOFT_LIMIT_BYTES
```

### 2.4 Échantillonnage Top + Random

Pour 150 comments représentatifs :
1. **Top 100 par `like_count` desc**
2. **50 random** parmi les `(total - top_100)` restants

```python
def sample_top_and_random(raw: list[CommentRaw], top_n: int = 100, random_n: int = 50) -> list[CommentRaw]:
    if len(raw) <= top_n + random_n:
        return raw
    sorted_by_likes = sorted(raw, key=lambda c: c.like_count, reverse=True)
    top = sorted_by_likes[:top_n]
    remainder = sorted_by_likes[top_n:]
    import random as rng
    rng.seed(hash(raw[0].video_id))  # déterministe pour cache HIT
    sample = rng.sample(remainder, min(random_n, len(remainder)))
    return top + sample
```

Seed déterministe → mêmes 2 appels avec même liste raw → même échantillon → cache reproductible.

---

## 3. Service backend `comments_analysis`

### 3.1 Module `backend/src/comments/` — nouveau

```
backend/src/comments/
  ├─ __init__.py
  ├─ service.py         # API publique
  ├─ youtube_scraper.py # Innertube
  ├─ tiktok_scraper.py  # web /api/comment/list/
  ├─ sampler.py         # Top + Random sampling déterministe
  ├─ take_generator.py  # Prompt Mistral + appel llm_complete
  ├─ schemas.py         # Pydantic v2 models
  └─ cache.py           # Helpers cache vcache:comments + vcache:community_take
```

### 3.2 `schemas.py` — Pydantic v2

```python
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


class Comment(BaseModel):
    """Un commentaire normalisé (cross-platform)."""
    comment_id: str
    author: str
    author_id: Optional[str] = None
    text: str
    like_count: int = 0
    reply_count: int = 0
    published_at: Optional[datetime] = None
    is_reply: bool = False
    parent_id: Optional[str] = None
    is_creator_reply: bool = False
    is_pinned: bool = False


class CommentsBatch(BaseModel):
    platform: Literal["youtube", "tiktok"]
    video_id: str
    total_seen: int = 0
    sampled: list[Comment] = Field(default_factory=list)
    disabled: bool = False
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    bytes_used: int = 0


class TopVoice(BaseModel):
    author: str  # Pseudonymisé : "User-A1B2"
    excerpt: str = Field(max_length=240)
    stance: Literal["agree", "disagree", "neutral", "question"]
    like_count: int = 0


class CommunityTake(BaseModel):
    """Résultat de l'analyse Mistral des commentaires."""
    agreement_signal: Literal["agree", "disagree", "mixed", "unclear"]
    sentiment_distribution: dict[Literal["positive", "neutral", "negative"], float]
    controversies: list[str] = Field(default_factory=list, max_length=5)
    community_summary: str = Field(max_length=600)
    top_voices: list[TopVoice] = Field(default_factory=list, max_length=5)
    comments_analyzed: int = 0
    model_used: str = ""
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    is_truncated: bool = False
    disabled: bool = False
    insufficient_data: bool = False
```

### 3.3 `service.py` — orchestration

```python
import asyncio
from typing import Optional
from .schemas import CommentsBatch, CommunityTake
from .youtube_scraper import fetch_youtube_comments as _fetch_yt
from .tiktok_scraper import fetch_tiktok_comments as _fetch_tt
from .take_generator import generate_community_take
from .cache import (
    cache_get_comments_batch,
    cache_set_comments_batch,
    cache_get_take,
    cache_set_take,
)
from core.logging import logger
from middleware.proxy_telemetry import get_mtd_bytes


COMMUNITY_TAKE_TIMEOUT_S = 30.0
COMMENTS_PROXY_SOFT_LIMIT_BYTES = 700 * 1024 * 1024


async def fetch_comments(
    platform: str,
    video_id: str,
    *,
    top_n: int = 100,
    random_n: int = 50,
) -> CommentsBatch:
    """Fetch + sampling avec cache cross-user L1+L2."""
    cached = await cache_get_comments_batch(platform, video_id)
    if cached is not None:
        logger.info(f"[COMMENTS_CACHE_HIT] {platform}:{video_id}")
        return cached

    mtd = await get_mtd_bytes()
    if mtd > COMMENTS_PROXY_SOFT_LIMIT_BYTES:
        logger.warning(f"[COMMENTS] Soft quota hit ({mtd/1024/1024:.0f} MB), skip scrape")
        return CommentsBatch(platform=platform, video_id=video_id, disabled=False, total_seen=0)

    if platform == "youtube":
        batch = await _fetch_yt(video_id, top_n=top_n, random_n=random_n)
    elif platform == "tiktok":
        batch = await _fetch_tt(video_id, top_n=top_n, random_n=random_n)
    else:
        raise ValueError(f"Unsupported platform: {platform}")

    await cache_set_comments_batch(platform, video_id, batch)
    return batch


async def generate_community_analysis(
    platform: str,
    video_id: str,
    *,
    plan: str,
    video_title: str,
    video_topic_hint: str = "",
    creator_stance: str = "",
    lang: str = "fr",
) -> Optional[CommunityTake]:
    """JAMAIS bloquant : tout exception est catchée et loggée."""
    try:
        batch = await fetch_comments(platform, video_id)

        if batch.disabled:
            return CommunityTake(
                agreement_signal="unclear",
                sentiment_distribution={"positive": 0.0, "neutral": 1.0, "negative": 0.0},
                community_summary="Les commentaires sont désactivés sur cette vidéo.",
                comments_analyzed=0,
                model_used="none",
                disabled=True,
            )

        if len(batch.sampled) < 10:
            return CommunityTake(
                agreement_signal="unclear",
                sentiment_distribution={"positive": 0.34, "neutral": 0.33, "negative": 0.33},
                community_summary=f"Trop peu de commentaires ({len(batch.sampled)}) pour un verdict fiable.",
                comments_analyzed=len(batch.sampled),
                model_used="none",
                insufficient_data=True,
            )

        plan_tier = _plan_to_tier(plan)
        cached_take = await cache_get_take(platform, video_id, plan_tier)
        if cached_take is not None:
            return cached_take

        take = await generate_community_take(
            batch=batch,
            plan=plan,
            video_title=video_title,
            video_topic_hint=video_topic_hint,
            creator_stance=creator_stance,
            lang=lang,
        )

        if take is not None:
            await cache_set_take(platform, video_id, plan_tier, take)

        return take

    except Exception as e:
        logger.error(f"[COMMUNITY_ANALYSIS] Failed for {platform}:{video_id}: {e}", exc_info=True)
        return None


def _plan_to_tier(plan: str) -> str:
    return {"free": "small", "pro": "medium", "expert": "large"}.get(plan, "small")


async def generate_community_analysis_with_timeout(*args, **kwargs) -> Optional[CommunityTake]:
    """Wrapper non bloquant pour le pipeline v6 — timeout 30s strict."""
    try:
        return await asyncio.wait_for(
            generate_community_analysis(*args, **kwargs),
            timeout=COMMUNITY_TAKE_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        logger.warning(f"[COMMUNITY_ANALYSIS] Timeout {COMMUNITY_TAKE_TIMEOUT_S}s — returning None")
        return None
    except Exception as e:
        logger.error(f"[COMMUNITY_ANALYSIS] Outer error: {e}")
        return None
```

### 3.4 `take_generator.py` — Prompt complet

```python
from .schemas import CommentsBatch, CommunityTake
from core.llm_provider import llm_complete
from core.logging import logger
from core.moderation_service import moderate_text
import json
import re


_PLAN_MODEL = {
    "free": "mistral-small-2603",
    "pro": "mistral-medium-2508",
    "expert": "mistral-large-2512",
}


COMMUNITY_TAKE_SYSTEM_PROMPT_FR = """Tu es un analyste impartial qui synthétise la réaction d'une communauté en ligne aux propos d'un créateur de contenu vidéo (YouTube ou TikTok).

PRINCIPES STRICTS :
1. **Ne pas trancher artificiellement** : si la communauté est divisée, dis "mixte". Ne donne JAMAIS un verdict simpliste pour générer du clic.
2. **Pas de jugement moral** : tu rapportes ce que disent les commentateurs, pas ce que tu en penses.
3. **Anonymisation** : ne cite jamais le pseudo complet. Utilise "Un commentateur populaire", "Une réponse récente avec X likes", ou pseudonyme tronqué "@user***".
4. **Ignore le bruit** : spam, insultes pures, emoji-only, hors-sujet → exclus.
5. **Représentation équitable** : si 30% sont en désaccord, ils méritent une voix dans top_voices.
6. **Pas de prophétie** : ne dis pas "la majorité pense X" si l'échantillon est < 20 voix significatives.

FORMAT DE SORTIE : JSON strict, AUCUN texte hors JSON. Schéma :
{
  "agreement_signal": "agree" | "disagree" | "mixed" | "unclear",
  "sentiment_distribution": {"positive": 0.0-1.0, "neutral": 0.0-1.0, "negative": 0.0-1.0},
  "controversies": ["sujet de désaccord 1", ...],
  "community_summary": "2-3 phrases factuelles en français",
  "top_voices": [
    {"author": "Un commentateur (8.4k likes)", "excerpt": "extrait < 240 chars", "stance": "agree|disagree|neutral|question", "like_count": 8400},
    ...
  ]
}

RÈGLES DE STANCE :
- "agree" : commentaire soutient le propos central du créateur
- "disagree" : commentaire conteste, corrige, ou prend la position opposée
- "neutral" : observation, complément factuel sans prendre position
- "question" : demande de clarification ou point soulevé non résolu
"""


def _build_user_prompt(batch: CommentsBatch, video_title: str, video_topic_hint: str, creator_stance: str, lang: str) -> str:
    header = f"""VIDEO : "{video_title}"
PLATEFORME : {batch.platform}
SUJET (extrait de l'analyse) : {video_topic_hint[:500] if video_topic_hint else "(non fourni)"}
POSITION DU CRÉATEUR (extrait de l'analyse) : {creator_stance[:300] if creator_stance else "(non fournie)"}

COMMENTAIRES ÉCHANTILLONNÉS ({len(batch.sampled)} sur {batch.total_seen} bruts) :
"""
    lines = []
    for c in batch.sampled:
        text = c.text[:400].replace("\n", " ").strip()
        pseudo_safe = c.author[:1] + "***" if c.author else "anon"
        lines.append(f"[{c.like_count}♥] @{pseudo_safe}: {text}")
    return header + "\n".join(lines) + "\n\nGénère le JSON CommunityTake."


async def generate_community_take(
    *,
    batch: CommentsBatch,
    plan: str,
    video_title: str,
    video_topic_hint: str,
    creator_stance: str,
    lang: str = "fr",
) -> CommunityTake | None:
    model = _PLAN_MODEL.get(plan, "mistral-small-2603")
    sys_prompt = COMMUNITY_TAKE_SYSTEM_PROMPT_FR
    user_prompt = _build_user_prompt(batch, video_title, video_topic_hint, creator_stance, lang)

    try:
        flagged = await moderate_text(user_prompt[:2000])
        if flagged and flagged.severe:
            logger.warning(f"[COMMUNITY_TAKE] Severe content in batch — pseudonymized further")
    except Exception:
        pass

    result = await llm_complete(
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=model,
        max_tokens=1500,
        temperature=0.3,
        json_mode=True,
    )

    if not result or not result.content:
        return None

    try:
        cleaned = re.sub(r"```(?:json)?\s*", "", result.content).strip().rstrip("`")
        data = json.loads(cleaned)
        sd = data.get("sentiment_distribution", {})
        total = sum(sd.values()) or 1.0
        sd = {k: round(v / total, 3) for k, v in sd.items()}
        data["sentiment_distribution"] = sd

        take = CommunityTake(
            **data,
            comments_analyzed=len(batch.sampled),
            model_used=result.model_used,
        )
        return take
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"[COMMUNITY_TAKE] JSON parse failed: {e} — content: {result.content[:300]}")
        return None
```

### 3.5 Intégration dans `videos/router.py` (v6 pipeline)

**Modification 1** — Ajouter une 5e tâche au `asyncio.gather` existant (autour de la ligne 2303, fonction `_analyze_video_v21`) :

```python
async def _community_take_v21():
    if not _community_enabled_for(user_plan, platform):
        return None
    try:
        topic_hint = (category or "") + " | " + transcript[:300]
        return await generate_community_analysis_with_timeout(
            platform=platform,
            video_id=video_id,
            plan=user_plan,
            video_title=video_info["title"],
            video_topic_hint=topic_hint,
            creator_stance="",
            lang=lang,
        )
    except Exception as e:
        logger.error(f"[v2.1] Community take failed: {e}")
        return None

(
    (category, confidence),
    comments_analysis_result,  # legacy v2.1, conservé
    metadata_enriched_result,
    (_web_ctx, _enrich_src, _),
    community_take_result,  # NEW
) = await asyncio.gather(
    _detect_cat_v21(),
    _analyze_comments_v21(),
    _enrich_metadata_v21(),
    _enrich_web_v21(),
    _community_take_v21(),  # NEW
)
```

**Modification 2** — Persister dans `save_summary` (section step 10) :

```python
community_dict = community_take_result.model_dump(mode="json") if community_take_result else None

summary_id = await save_summary(
    session=session,
    # champs existants
    community_analysis=community_dict,  # NEW kwarg
)
```

**Modification 3** — Exposer dans la response :

```python
_task_store[task_id]["result"] = {
    # champs existants
    "community_analysis": community_dict,  # NEW
}
```

**Modification 4** — Helper `_community_enabled_for` :

```python
def _community_enabled_for(plan: str, platform: str) -> bool:
    """Gate la feature : V1 = Pro + Expert sur les 3 plateformes UI."""
    return plan in ("pro", "expert") and platform in ("youtube", "tiktok")
```

---

## 4. Stockage DB

### 4.1 Décision : **nouvelle colonne `Summary.community_analysis JSONB NULL`**

**Pourquoi colonne et pas table séparée** :
- 1:1 strict avec Summary, aucune query indépendante prévue
- Lecture systématique avec le Summary (zero join cost)
- Cohérent avec le pattern existant : `summary_extras JSONB`, `visual_analysis JSONB`
- Taille typique d'un payload sérialisé : 1-3 KB → ok JSONB inline

### 4.2 Modèle SQLAlchemy — modification

`backend/src/db/database.py`, classe `Summary` (autour de la ligne 254, après `summary_extras`) :

```python
# Community analysis (NEW 2026-05-17 — alembic 029)
community_analysis = Column(JSON, nullable=True)
```

### 4.3 Migration Alembic `029_summary_community_analysis.py`

```python
"""summary_community_analysis — verdict communauté (scrape + Mistral analyse)

Revision ID: 029_summary_community
Revises: 028_bot_prospection
Create Date: 2026-05-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "029_summary_community"
down_revision: Union[str, None] = "028_bot_prospection"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "community_analysis" not in columns:
        op.add_column(
            "summaries",
            sa.Column("community_analysis", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "community_analysis" in columns:
        op.drop_column("summaries", "community_analysis")
```

### 4.4 Schéma Pydantic — extension `SummaryResponse`

```python
# Community analysis
community_analysis: Optional[Dict[str, Any]] = None
```

### 4.5 Service `save_summary` — extension

```python
async def save_summary(
    session: AsyncSession,
    *,
    # params existants
    community_analysis: Optional[dict] = None,  # NEW
    **kwargs,
) -> int:
    summary = Summary(
        # champs existants
        community_analysis=community_analysis,
    )
    session.add(summary)
    await session.flush()
    await session.commit()
    return summary.id
```

---

## 5. Cache cross-user (Redis L1 + PG L2)

### 5.1 Clés Redis

```
vcache:comments:{platform}:{video_id}                    # raw scrape batch (24h)
vcache:community_take:{platform}:{video_id}:{tier}       # take Mistral par plan tier (24h)
```

Où `tier ∈ {small, medium, large}` = mapping plan utilisateur.

### 5.2 Invariants

- **CommentsBatch est cross-user** : les commentaires d'une vidéo sont identiques pour tous → cache global, pas de `user_id` dans la clé.
- **CommunityTake varie par plan** (modèle Mistral différent) → 3 versions par vidéo max.

### 5.3 Cache `cache.py`

```python
from core.cache import cache_service
from .schemas import CommentsBatch, CommunityTake
import json


COMMENTS_TTL_S = 86400  # 24h L1
TAKE_TTL_S = 86400  # 24h L1


async def cache_get_comments_batch(platform: str, video_id: str) -> CommentsBatch | None:
    key = f"vcache:comments:{platform}:{video_id}"
    raw = await cache_service.get(key)
    if not raw:
        return None
    try:
        return CommentsBatch.model_validate(raw)
    except Exception:
        return None


async def cache_set_comments_batch(platform: str, video_id: str, batch: CommentsBatch) -> None:
    key = f"vcache:comments:{platform}:{video_id}"
    await cache_service.set(key, batch.model_dump(mode="json"), ttl=COMMENTS_TTL_S)


async def cache_get_take(platform: str, video_id: str, tier: str) -> CommunityTake | None:
    key = f"vcache:community_take:{platform}:{video_id}:{tier}"
    raw = await cache_service.get(key)
    if not raw:
        return None
    try:
        return CommunityTake.model_validate(raw)
    except Exception:
        return None


async def cache_set_take(platform: str, video_id: str, tier: str, take: CommunityTake) -> None:
    key = f"vcache:community_take:{platform}:{video_id}:{tier}"
    await cache_service.set(key, take.model_dump(mode="json"), ttl=TAKE_TTL_S)


async def invalidate_community_cache(platform: str, video_id: str) -> int:
    """Admin endpoint helper : invalide comments + 3 tiers de take."""
    keys = [
        f"vcache:comments:{platform}:{video_id}",
        f"vcache:community_take:{platform}:{video_id}:small",
        f"vcache:community_take:{platform}:{video_id}:medium",
        f"vcache:community_take:{platform}:{video_id}:large",
    ]
    deleted = 0
    for k in keys:
        if await cache_service.delete(k):
            deleted += 1
    return deleted
```

### 5.4 L2 PG persistent

Pas de table dédiée en V1 — la `Summary.community_analysis` JSONB joue le rôle de L2 pour la take.

### 5.5 Endpoint admin d'invalidation

```python
@router.delete("/community-cache/{platform}/{video_id}")
async def admin_invalidate_community_cache(
    platform: str,
    video_id: str,
    user: User = Depends(get_current_admin),
):
    from comments.cache import invalidate_community_cache
    deleted = await invalidate_community_cache(platform, video_id)
    return {"platform": platform, "video_id": video_id, "deleted_keys": deleted}
```

---

## 6. Plan gating

### 6.1 Choix : **Pro + Expert uniformes** (pas de différenciation volume)

KISS pour V1, possibilité d'ajuster en V2 si data PostHog montre que Expert demande plus.

### 6.2 Matrice plan

| Plan | Scrape | Modèle Mistral take | UI | CTA upgrade |
|---|---|---|---|---|
| **Free** | Non | — | Section section "Verdict communauté" avec CTA "Disponible Pro+" + preview floutée 1 ligne | "Passez Pro pour le verdict communauté" |
| **Pro** | Top 100 + Random 50 | medium (mistral-medium-2508) | Section complète (summary 2-3 phrases + top_voices 3 + controversies 3) | — |
| **Expert** | Top 100 + Random 50 | large (mistral-large-2512) | Section complète (summary + top_voices 5 + controversies 5 + sentiment_distribution donut) | — |

### 6.3 SSOT — Ajout `community_take` à `plan_config.py`

```python
# Free
"community_take_enabled": False,
# Pro
"community_take_enabled": True,
"community_take_monthly": -1,
# Expert
"community_take_enabled": True,
"community_take_monthly": -1,
```

Et dans la section `platforms` : `"community_take": True` ou `False`.

### 6.4 Frontend SSOT mirror

`frontend/src/config/planPrivileges.ts` + `mobile/src/config/planPrivileges.ts`.

---

## 7. UI tri-plateforme

### 7.1 Web — `CommunityTakeSection.tsx`

**Fichier** : `frontend/src/components/CommunityTakeSection.tsx`

**Insertion** : dans `frontend/src/components/AnalysisHub/SynthesisTab.tsx`, après `<SummaryNativeView extras={...} />` et avant `<AnalysisActionBar />`.

```tsx
import React from "react";
import { motion } from "framer-motion";
import { Users, MessageCircle, AlertTriangle, ThumbsUp, ThumbsDown, Minus, HelpCircle, Lock } from "lucide-react";
import type { CommunityTake } from "../services/api";
import { canAccess } from "../config/planPrivileges";

interface CommunityTakeSectionProps {
  take: CommunityTake | null | undefined;
  userPlan: string;
  language?: "fr" | "en";
  onUpgradeClick?: () => void;
}

const SIGNAL_META = {
  agree:    { icon: ThumbsUp,    color: "emerald", labelFr: "Plutôt d'accord",    labelEn: "Mostly agree" },
  disagree: { icon: ThumbsDown,  color: "rose",    labelFr: "Plutôt en désaccord", labelEn: "Mostly disagree" },
  mixed:    { icon: Minus,       color: "amber",   labelFr: "Communauté divisée",  labelEn: "Mixed reactions" },
  unclear:  { icon: HelpCircle,  color: "slate",   labelFr: "Signal incertain",    labelEn: "Unclear signal" },
};

export const CommunityTakeSection: React.FC<CommunityTakeSectionProps> = ({
  take,
  userPlan,
  language = "fr",
  onUpgradeClick,
}) => {
  const isAllowed = canAccess(userPlan, "community_take", "web");
  if (!isAllowed) {
    return <CommunityTakeUpgradeCTA language={language} onClick={onUpgradeClick} />;
  }

  if (take === undefined) return <CommunityTakeSkeleton />;
  if (take === null) return null;

  if (take.disabled || take.insufficient_data) {
    return <CommunityTakeEmpty take={take} language={language} />;
  }

  const meta = SIGNAL_META[take.agreement_signal];
  const Icon = meta.icon;
  const label = language === "fr" ? meta.labelFr : meta.labelEn;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl bg-white/5 border border-violet-500/20 backdrop-blur-xl p-5"
      data-testid="community-take-section"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <Users className="w-5 h-5 text-violet-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            Verdict communauté
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {language === "fr"
              ? `Analyse de ${take.comments_analyzed} commentaires`
              : `Analysis of ${take.comments_analyzed} comments`}
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 bg-${meta.color}-500/15 text-${meta.color}-400 border border-${meta.color}-500/20`}>
          <Icon className="w-3.5 h-3.5" />
          {label}
        </span>
      </div>

      <p className="text-sm text-text-primary leading-relaxed mb-4">
        {take.community_summary}
      </p>

      {userPlan === "expert" && (
        <SentimentBar dist={take.sentiment_distribution} language={language} />
      )}

      {take.controversies.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {language === "fr" ? "Points de désaccord" : "Points of disagreement"}
          </h4>
          <ul className="space-y-1.5">
            {take.controversies.slice(0, userPlan === "expert" ? 5 : 3).map((c, i) => (
              <li key={i} className="text-sm text-text-secondary leading-relaxed pl-3 border-l border-amber-400/30">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {take.top_voices.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-violet-400" />
            {language === "fr" ? "Voix représentatives" : "Representative voices"}
          </h4>
          <ul className="space-y-2.5">
            {take.top_voices.slice(0, userPlan === "expert" ? 5 : 3).map((v, i) => (
              <TopVoiceCard key={i} voice={v} language={language} />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-text-muted">
        <span>{language === "fr" ? "Généré par" : "Generated by"} {take.model_used}</span>
        {take.is_truncated && (
          <span className="text-amber-400">
            {language === "fr" ? "Échantillon partiel" : "Partial sample"}
          </span>
        )}
      </div>
    </motion.section>
  );
};
```

**Sous-composants** : `CommunityTakeSkeleton`, `CommunityTakeEmpty`, `CommunityTakeUpgradeCTA`, `SentimentBar`, `TopVoiceCard`.

**Types côté `services/api.ts`** :

```typescript
export interface CommunityTake {
  agreement_signal: "agree" | "disagree" | "mixed" | "unclear";
  sentiment_distribution: { positive: number; neutral: number; negative: number };
  controversies: string[];
  community_summary: string;
  top_voices: Array<{
    author: string;
    excerpt: string;
    stance: "agree" | "disagree" | "neutral" | "question";
    like_count: number;
  }>;
  comments_analyzed: number;
  model_used: string;
  disabled?: boolean;
  insufficient_data?: boolean;
  is_truncated?: boolean;
}

export interface Summary {
  // champs existants
  community_analysis?: CommunityTake | null;
}
```

### 7.2 Mobile — composant analogue

**Fichier** : `mobile/src/components/CommunityTakeSection.tsx`

**Insertion** : dans `mobile/app/(tabs)/analysis/[id].tsx`, dans le tab "Résumé" (PagerView index 0), entre `AnalysisContentDisplay` et `ActionBar`.

```tsx
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import type { CommunityTake } from "@/types";
import { usePlan } from "@/contexts/PlanContext";

interface Props {
  take: CommunityTake | null | undefined;
  language?: "fr" | "en";
}

export const CommunityTakeSection: React.FC<Props> = ({ take, language = "fr" }) => {
  const { colors } = useTheme();
  const { plan } = usePlan();

  if (!take || take.disabled || take.insufficient_data) return null;
  if (plan === "free") return <CommunityTakeUpgradeCTAMobile language={language} />;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.container, { borderColor: colors.violet300 }]}>
      {/* Header + signal badge */}
      {/* Community summary */}
      {/* Top voices list */}
      {/* Controversies */}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: sp.lg,
    marginVertical: sp.md,
    padding: sp.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});
```

### 7.3 Extension — composant compact

**Fichier** : `extension/src/sidepanel/components/CommunityTakeCompact.tsx`

**Insertion** : dans `extension/src/sidepanel/views/MainView.tsx`, après `<SynthesisView />` et avant `<SuggestionPills />`.

```tsx
import React, { useState } from "react";
import type { CommunityTake } from "../../types";
import { useTranslation } from "../../i18n/useTranslation";
import { WEBAPP_URL } from "../../utils/config";
import Browser from "../../utils/browser-polyfill";

const SIGNAL_EMOJI = { agree: "OK", disagree: "NO", mixed: "MIX", unclear: "?" };

interface Props {
  take: CommunityTake | null | undefined;
  summaryId: number;
  userPlan: string;
}

export const CommunityTakeCompact: React.FC<Props> = ({ take, summaryId, userPlan }) => {
  const { t, language } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!take) return null;
  if (userPlan === "free") {
    return (
      <div className="px-3 py-2 text-xs text-amber-400 bg-amber-500/10 rounded border border-amber-500/20">
        {t("community.upgradeRequired")}
      </div>
    );
  }
  if (take.disabled || take.insufficient_data) return null;

  const emoji = SIGNAL_EMOJI[take.agreement_signal];
  const label = t(`community.signal.${take.agreement_signal}`);

  return (
    <div className="px-3 py-2 rounded bg-violet-500/8 border border-violet-500/15">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-left text-xs"
      >
        <span className="text-text-primary">
          {emoji} <strong>{t("community.verdictLabel")}</strong> : {label}
          <span className="text-text-muted ml-1">({take.comments_analyzed} {t("community.commentsAnalyzed")})</span>
        </span>
        <span className="text-text-muted">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <>
          <p className="mt-2 text-xs text-text-secondary leading-relaxed">{take.community_summary}</p>
          <button
            onClick={() => Browser.tabs.create({ url: `${WEBAPP_URL}/analysis/${summaryId}` })}
            className="mt-2 text-xs text-violet-400 hover:underline"
          >
            {t("community.openFullWeb")} →
          </button>
        </>
      )}
    </div>
  );
};
```

### 7.4 i18n — clés à ajouter

**Web** `frontend/src/i18n/fr.json` :

```json
{
  "community": {
    "verdictLabel": "Verdict communauté",
    "commentsAnalyzed": "commentaires analysés",
    "signal": {
      "agree": "Plutôt d'accord",
      "disagree": "Plutôt en désaccord",
      "mixed": "Communauté divisée",
      "unclear": "Signal incertain"
    },
    "controversies": "Points de désaccord",
    "topVoices": "Voix représentatives",
    "upgradeRequired": "Verdict communauté disponible avec Pro",
    "upgradeCta": "Passer Pro",
    "disabledNotice": "Les commentaires sont désactivés sur cette vidéo",
    "insufficientData": "Trop peu de commentaires pour un verdict fiable",
    "modelUsedSuffix": "Généré par {{model}}",
    "openFullWeb": "Lire l'analyse complète sur l'app",
    "stance": {
      "agree": "D'accord",
      "disagree": "En désaccord",
      "neutral": "Neutre",
      "question": "Question"
    }
  }
}
```

Mirror dans `en.json`, mobile, extension.

---

## 8. Coût Decodo projeté

### 8.1 Calcul

Hypothèses :
- 30 analyses/jour (volume actuel Pro+Expert combinés observé via PostHog 2026-05)
- 70% YouTube (210 KB scrape) + 30% TikTok (150 KB scrape) → moyenne **195 KB scrape/vidéo**
- Mistral take : pas via proxy (Mistral API directe Hetzner → 0 byte proxy)
- 30 jours/mois × 30 analyses × 195 KB = **~171 MB/mois côté nouvelle feature**

### 8.2 Budget total proxy actuel

- Budget MTD existant (transcripts + visual + tiktok carousel) : ~400-500 MB
- Avec community : **~570-670 MB/mois** projeté
- Hard-stop global : 950 MB
- **Marge de sécurité : ~280-380 MB/mois**

### 8.3 Quota safety dédié

Ajout d'un **soft limit spécifique** à 700 MB MTD pour cette feature :

```python
COMMENTS_PROXY_SOFT_LIMIT_BYTES = 700 * 1024 * 1024  # 700 MB

async def _should_skip_comments_due_to_quota(session) -> bool:
    from middleware.proxy_telemetry import get_mtd_bytes
    return await get_mtd_bytes(session) > COMMENTS_PROXY_SOFT_LIMIT_BYTES
```

### 8.4 Telemetry par provider

`record_proxy_usage(provider="comments_youtube", bytes_in=..., bytes_out=...)`
`record_proxy_usage(provider="comments_tiktok", bytes_in=..., bytes_out=...)`

→ Visibilité dans le dashboard PostHog 663159.

### 8.5 Coût Mistral

- Pro (medium) : ~$0.4/1M input + $2/1M output tokens
- 150 comments × ~80 chars avg = 12 000 chars ≈ 4 000 tokens input
- Output JSON ≈ 600 tokens
- **Coût par take Pro : ~$0.0028**
- À 900 analyses Pro/mois → **~$2.5/mois Mistral**
- Expert (large) : ~5× plus cher → **~$12/mois Mistral**

Total infra : **proxy ~$0.70/mois + Mistral ~$15/mois = $16/mois** pour 900 analyses/mois sur cette feature.

---

## 9. Tests

### 9.1 Unit `backend/tests/test_comments_youtube_scraper.py`

```python
import pytest
import json
import httpx
from unittest.mock import patch, AsyncMock
from comments.youtube_scraper import fetch_youtube_comments
from comments.schemas import CommentsBatch


@pytest.fixture
def mock_innertube_initial_response():
    return {
        "engagementPanels": [
            {
                "engagementPanelSectionListRenderer": {
                    "targetId": "engagement-panel-comments-section",
                    "content": {
                        "sectionListRenderer": {
                            "contents": [{
                                "itemSectionRenderer": {
                                    "contents": [{
                                        "continuationItemRenderer": {
                                            "continuationEndpoint": {
                                                "continuationCommand": {"token": "FAKE_CONTINUATION_TOKEN_INITIAL"}
                                            }
                                        }
                                    }]
                                }
                            }]
                        }
                    }
                }
            }
        ]
    }


@pytest.mark.asyncio
async def test_fetch_youtube_comments_happy_path(mock_innertube_initial_response):
    with patch("comments.youtube_scraper.get_proxied_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post.side_effect = [
            httpx.Response(200, json=mock_innertube_initial_response, request=httpx.Request("POST", "https://x")),
        ]
        mock_client_factory.return_value = mock_client

        batch = await fetch_youtube_comments("dQw4w9WgXcQ", top_n=100, random_n=50)

        assert isinstance(batch, CommentsBatch)
        assert batch.platform == "youtube"
        assert batch.video_id == "dQw4w9WgXcQ"
        assert batch.disabled is False


@pytest.mark.asyncio
async def test_fetch_youtube_comments_disabled():
    with patch("comments.youtube_scraper.get_proxied_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post.return_value = httpx.Response(
            200,
            json={"engagementPanels": []},
            request=httpx.Request("POST", "https://x"),
        )
        mock_client_factory.return_value = mock_client

        batch = await fetch_youtube_comments("disabled_video_id")
        assert batch.disabled is True
        assert len(batch.sampled) == 0


@pytest.mark.asyncio
async def test_fetch_youtube_comments_proxy_telemetry():
    with patch("comments.youtube_scraper.record_proxy_usage") as mock_record:
        # fetch
        assert mock_record.called
        call_kwargs = mock_record.call_args.kwargs
        assert call_kwargs["provider"] == "comments_youtube"
        assert call_kwargs["bytes_in"] > 0
```

### 9.2 Unit `backend/tests/test_comments_tiktok_scraper.py`

Patterns analogues. Mock httpx Response avec payload `/api/comment/list/`.

### 9.3 Unit `backend/tests/test_community_take_generator.py`

```python
import pytest
from unittest.mock import patch, AsyncMock
from comments.take_generator import generate_community_take
from comments.schemas import CommentsBatch, Comment, CommunityTake
from core.llm_provider import LLMResult


@pytest.fixture
def sample_batch():
    return CommentsBatch(
        platform="youtube",
        video_id="abc123",
        total_seen=200,
        sampled=[
            Comment(comment_id=f"c{i}", author=f"user{i}", text=f"Comment text {i}", like_count=100-i)
            for i in range(50)
        ],
    )


@pytest.mark.asyncio
async def test_generate_take_happy_path(sample_batch):
    mock_llm_response = {
        "agreement_signal": "mixed",
        "sentiment_distribution": {"positive": 0.5, "neutral": 0.3, "negative": 0.2},
        "controversies": ["Désaccord sur le point X", "Méthodologie contestée"],
        "community_summary": "La communauté est divisée. Beaucoup saluent l'effort mais critiquent le manque de sources.",
        "top_voices": [
            {"author": "Un commentateur populaire", "excerpt": "Vidéo très claire merci !", "stance": "agree", "like_count": 1200},
            {"author": "Une réponse récente", "excerpt": "Mais où sont les sources ?", "stance": "disagree", "like_count": 340},
        ],
    }

    with patch("comments.take_generator.llm_complete") as mock_complete:
        mock_complete.return_value = LLMResult(
            content=json.dumps(mock_llm_response),
            model_used="mistral-medium-2508",
            provider="mistral",
        )
        take = await generate_community_take(
            batch=sample_batch,
            plan="pro",
            video_title="Test Video",
            video_topic_hint="Tech",
            creator_stance="",
            lang="fr",
        )
        assert isinstance(take, CommunityTake)
        assert take.agreement_signal == "mixed"
        assert take.comments_analyzed == 50
        assert take.model_used == "mistral-medium-2508"
        assert len(take.top_voices) == 2


@pytest.mark.asyncio
async def test_generate_take_uses_correct_model_per_plan(sample_batch):
    for plan, expected_model in [("free", "mistral-small-2603"), ("pro", "mistral-medium-2508"), ("expert", "mistral-large-2512")]:
        with patch("comments.take_generator.llm_complete") as mock_complete:
            mock_complete.return_value = LLMResult(content="{}", model_used=expected_model, provider="mistral")
            await generate_community_take(batch=sample_batch, plan=plan, video_title="x", video_topic_hint="", creator_stance="", lang="fr")
            assert mock_complete.call_args.kwargs["model"] == expected_model
```

### 9.4 Intégration `backend/tests/test_video_router_with_comments.py`

```python
@pytest.mark.asyncio
async def test_video_analyze_v6_returns_community_analysis_for_pro_user(
    async_client, pro_user_token, monkeypatch
):
    fake_take = CommunityTake(
        agreement_signal="agree",
        sentiment_distribution={"positive": 0.6, "neutral": 0.3, "negative": 0.1},
        controversies=[],
        community_summary="La majorité approuve.",
        top_voices=[],
        comments_analyzed=120,
        model_used="mistral-medium-2508",
    )

    async def fake_generate(*args, **kwargs):
        return fake_take

    monkeypatch.setattr("comments.service.generate_community_analysis_with_timeout", fake_generate)

    response = await async_client.post(
        "/api/videos/analyze",
        json={"url": "https://youtube.com/watch?v=test123", "mode": "standard", "lang": "fr"},
        headers={"Authorization": f"Bearer {pro_user_token}"},
    )
    assert response.status_code == 200
    task_id = response.json()["task_id"]

    for _ in range(20):
        status_resp = await async_client.get(f"/api/videos/status/{task_id}")
        data = status_resp.json()
        if data["status"] == "completed":
            break
        await asyncio.sleep(0.5)

    assert data["status"] == "completed"
    community = data["result"]["community_analysis"]
    assert community is not None
    assert community["agreement_signal"] == "agree"
    assert community["comments_analyzed"] == 120


@pytest.mark.asyncio
async def test_video_analyze_v6_community_failure_does_not_block_summary(
    async_client, pro_user_token, monkeypatch
):
    async def fake_raise(*args, **kwargs):
        raise RuntimeError("Innertube 403")
    monkeypatch.setattr("comments.service.generate_community_analysis_with_timeout", fake_raise)

    # poll + assertions
    assert data["status"] == "completed"
    assert data["result"]["community_analysis"] is None
    assert data["result"]["summary_id"] is not None
```

### 9.5 Tests frontend

`frontend/src/components/__tests__/CommunityTakeSection.test.tsx` :
- Render avec take = null → null
- Render avec take = undefined → skeleton
- Render avec take.disabled → empty state
- Render avec take.insufficient_data → empty state
- Render Free plan → CTA upgrade
- Render Pro plan + take valide → section visible avec 3 top_voices max
- Render Expert plan + take valide → section visible avec 5 top_voices + sentiment bar

### 9.6 Tests mobile + extension

Patterns analogues avec Jest + Testing Library RN / jsdom.

---

## 10. Risques + mitigations

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Innertube API key rotation** par YouTube | Moyenne | Scrape YouTube KO 100% | Lire `INNERTUBE_API_KEY` depuis `core/config.py` → env var `YOUTUBE_INNERTUBE_KEY`. Hot-rotate sans redeploy. Monitoring Sentry. |
| 2 | **TikTok signature renforcée** | Haute (déjà arrivé) | Scrape TikTok KO | Méthode B (mobile API) en fallback. Feature flag `COMMUNITY_TAKE_TIKTOK_ENABLED=false`. UI affiche "Verdict communauté indisponible pour TikTok en ce moment". |
| 3 | **Bande passante explose** (>900 MB MTD) | Faible | Hard-stop coupe proxy | Soft limit dédié à 700 MB. Telemetry split par provider. |
| 4 | **Commentaires toxiques dans la take** | Moyenne | Réputation produit | Pseudonymisation auteur côté prompt + moderation Mistral + system prompt explicite. |
| 5 | **"Verdict" devient engagement bait** | Moyenne | Crédibilité fact-check | System prompt "Si divisé → mixed". Floor hard-coded : `if max(sentiment_distribution) < 0.5: signal = "mixed"`. |
| 6 | **Cache stale** sur vidéos virales | Faible | Take obsolète | TTL 24h L1. Endpoint admin d'invalidation manuel. |
| 7 | **Latence Mistral large** Expert >25s | Moyenne | Timeout 30s + None retourné | Timeout 30s strict via `asyncio.wait_for`. |
| 8 | **Pipeline v6 plus lent** | Faible | UX dégradée | La branche community a son propre `wait_for(30s)`. |

---

## 11. Phasage de livraison (5 PRs séquentielles)

### PR 1 — Backend scraping + storage + service (sans UI)

**Branche** : `feature/community-take-backend`

**Fichiers créés** :
- `backend/src/comments/__init__.py`
- `backend/src/comments/schemas.py`
- `backend/src/comments/youtube_scraper.py`
- `backend/src/comments/tiktok_scraper.py`
- `backend/src/comments/sampler.py`
- `backend/src/comments/take_generator.py`
- `backend/src/comments/cache.py`
- `backend/src/comments/service.py`
- `backend/alembic/versions/029_summary_community_analysis.py`
- `backend/tests/test_comments_youtube_scraper.py`
- `backend/tests/test_comments_tiktok_scraper.py`
- `backend/tests/test_community_take_generator.py`
- `backend/tests/test_comments_service.py`

**Fichiers modifiés** :
- `backend/src/db/database.py` : `Summary.community_analysis = Column(JSON, nullable=True)`
- `backend/src/videos/schemas.py` : `SummaryResponse.community_analysis`
- `backend/src/videos/service.py` : `save_summary(community_analysis=None, ...)`
- `backend/src/videos/router.py` : 5e tâche gather + persist + result
- `backend/src/billing/plan_config.py` : `community_take_enabled`
- `backend/src/admin/router.py` : endpoint `DELETE /admin/community-cache/...`

### PR 2 — UI Web

**Branche** : `feature/community-take-web`

**Fichiers créés** :
- `frontend/src/components/CommunityTakeSection.tsx`
- `frontend/src/components/CommunityTakeSkeleton.tsx`
- `frontend/src/components/CommunityTakeEmpty.tsx`
- `frontend/src/components/CommunityTakeUpgradeCTA.tsx`
- `frontend/src/components/SentimentBar.tsx`
- `frontend/src/components/TopVoiceCard.tsx`
- `frontend/src/components/__tests__/CommunityTakeSection.test.tsx`

**Fichiers modifiés** :
- `frontend/src/services/api.ts` : interface CommunityTake + Summary étendu
- `frontend/src/components/AnalysisHub/SynthesisTab.tsx` : insertion section
- `frontend/src/config/planPrivileges.ts` : feature `community_take`
- `frontend/src/i18n/fr.json` + `en.json` : clés `community.*`

### PR 3 — UI Mobile

**Branche** : `feature/community-take-mobile`

**Fichiers créés** :
- `mobile/src/components/CommunityTakeSection.tsx`
- `mobile/src/components/CommunityTakeSkeleton.tsx`
- `mobile/src/components/CommunityTakeUpgradeCTAMobile.tsx`
- `mobile/src/components/__tests__/CommunityTakeSection.test.tsx`

### PR 4 — UI Extension

**Branche** : `feature/community-take-extension`

**Fichiers créés** :
- `extension/src/sidepanel/components/CommunityTakeCompact.tsx`
- `extension/src/sidepanel/components/__tests__/CommunityTakeCompact.test.tsx`

### PR 5 — i18n complets + tests E2E + telemetry tuning

**Branche** : `feature/community-take-polish`

**Fichiers créés** :
- `frontend/e2e/community-take.spec.ts` (Playwright E2E)
- `docs/runbooks/community-take-monitoring.md`

---

## 12. Annexes

### 12.1 Différence avec le module legacy `videos/youtube_comments.py`

| Aspect | Legacy v2.1 | Nouveau `comments/` |
|---|---|---|
| Trigger | Opt-in via `customization.analyze_comments=True` | **Automatique** pour Pro/Expert |
| Plateforme | YouTube uniquement | YouTube **+ TikTok** |
| Scraper | `yt-dlp` subprocess | **httpx Innertube + tikwm web** via proxy Decodo |
| Modèle | Mistral séparé | **Calqué sur plan utilisateur** |
| Output | `CommentsAnalysis` | `CommunityTake` |
| Stockage | Non persistant | **DB `Summary.community_analysis JSONB`** |
| Cache | Aucun | **Redis L1** cross-user |
| Telemetry | Aucun | `record_proxy_usage(provider="comments_*")` |

### 12.2 Anti-patterns à éviter

- **Bail-early trap** : ne pas mettre la 5e tâche dans un `if SECURITY_AVAILABLE: ... else: skip` sans tester les 2 chemins.
- **Over-migration** : ne pas proxifier les appels Mistral du module `take_generator.py`.
- **Cache key conflict** : toujours préfixer avec `vcache:comments:` et `vcache:community_take:`.
- **Sycophancy take** : floor mathématique `if max(sentiment) < 0.5: signal = "mixed"`.

### 12.3 Décisions explicites verrouillées

| # | Décision | Choix retenu |
|---|---|---|
| 1 | Trigger | **Automatique** pendant l'analyse, parallèle, non bloquant timeout 30s |
| 2 | Volume scrape | **Top 100 + Random 50** (déterministe via seed = hash video_id) |
| 3 | Modèle Mistral | **Calqué sur plan** |
| 4 | UI position | **Après résumé, avant flashcards** |
| 5 | YouTube scraper | **Innertube `/youtubei/v1/next`** |
| 6 | TikTok scraper | **Web `/api/comment/list/`** |
| 7 | Storage | **Colonne `Summary.community_analysis JSONB`** |
| 8 | Cache | **Redis L1 24h** |
| 9 | Plan gating | **Free=CTA, Pro=full, Expert=full+extras** |
| 10 | Volume scrape différencié par plan | **Non** (uniforme Pro=Expert, KISS V1) |
| 11 | Anonymisation auteurs | **Pseudo tronqué `@u***`** |
| 12 | Quota safety Decodo | **Soft limit 700 MB MTD** |
| 13 | Endpoint admin | **`DELETE /admin/community-cache/{platform}/{video_id}`** |
| 14 | Sub-agents implémentation | **Opus 4.7 obligatoire** |

### 12.4 PostHog events à émettre

```python
await capture_event(
    user_id=str(user_id),
    event="community_take_generated",
    properties={
        "platform": platform,
        "video_id": video_id,
        "plan": plan,
        "agreement_signal": take.agreement_signal,
        "comments_analyzed": take.comments_analyzed,
        "model_used": take.model_used,
        "from_cache": from_cache,
        "duration_ms": duration_ms,
        "bytes_scraped": batch.bytes_used,
    },
)

await capture_event(
    user_id=str(user_id),
    event="community_take_failed",
    properties={"platform": platform, "video_id": video_id, "reason": "timeout|scrape_403|parse_error"},
)
```

---

**Fin de spec.** Prête à passer aux sub-agents Opus 4.7 pour implémentation parallèle des 5 PRs.
