"""Service layer pour le carrousel concepts Tuteur (sprint 2026-05-18).

Orchestrateur entre l'historique user (`## ` headings + entities.concepts), le
cache de doodles (table keyword_images style='tutor_doodle'), et le cap Redis
quotidien global 300/jour.

Pas de dépendance Celery (confirmed prod: aucun worker Celery). Génération
asynchrone via `asyncio.create_task` fire-and-forget — la task ouvre sa propre
session DB (`async_session_maker()`) car la session de requête HTTP est fermée
avant que la task ne s'exécute.
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from core.config import TUTOR_DOODLE_DAILY_CAP, is_gemini_available
from images.keyword_images import (
    _term_hash,
    batch_get_doodle_urls,
    generate_doodle_image,
    _get_pool as _get_image_pool,
)

logger = logging.getLogger(__name__)

# Regex pour extraire les "## " headings du summary_content (mirror voice/tutor_memory).
# Note: on utilise [ \t] et non \s pour ne pas faire matcher \n et confondre 2 lignes.
_HEADING_PATTERN = re.compile(r"^##[ \t]+([^\n]+?)[ \t]*$", re.MULTILINE)


def _daily_cap_key() -> str:
    """Redis key pour le compteur quotidien global de doodles Tutor."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"tutor_doodle:quota:{today}"


def _get_redis():
    """Retourne le client Redis partagé via cache_service, ou None si indisponible.

    Pattern identique à `tutor.router._get_redis` mais ne lève pas d'HTTPException
    — on retourne None et l'appelant décide (best-effort sur le cap quotidien).
    """
    try:
        from core.cache import cache_service
    except Exception:
        return None
    if cache_service is None or cache_service.backend is None:
        return None
    return getattr(cache_service.backend, "redis", None)


def _extract_key_topics(summary_content: str) -> list[str]:
    """Extrait les `## ` headings d'un markdown summary.

    Même logique que `voice/tutor_memory._extract_key_topics` (duplicat délibéré
    pour éviter un couplage cross-module qui n'apporte rien). Filtre les
    headings vides ou trop courts (<2 chars).
    """
    if not summary_content:
        return []
    matches = _HEADING_PATTERN.findall(summary_content)
    return [m.strip() for m in matches if m.strip() and len(m.strip()) >= 2]


def _extract_entities_concepts(entities_extracted) -> list[str]:
    """Extrait les concepts depuis Summary.entities_extracted (JSON ou dict).

    Formats supportés:
      - dict {"concepts": ["str1", "str2"]}
      - dict {"concepts": [{"term": "x", ...}]}
      - dict {"keywords": [...]} ou {"entities": [...]} (fallback)
      - string JSON (sérialisé en DB côté SQLite)
      - None ou liste vide → []
    """
    if not entities_extracted:
        return []
    if isinstance(entities_extracted, str):
        try:
            entities_extracted = json.loads(entities_extracted)
        except (json.JSONDecodeError, TypeError):
            return []
    out: list[str] = []
    if isinstance(entities_extracted, dict):
        for key in ("concepts", "keywords", "entities"):
            vals = entities_extracted.get(key)
            if isinstance(vals, list):
                for v in vals:
                    if isinstance(v, str) and len(v.strip()) >= 2:
                        out.append(v.strip())
                    elif isinstance(v, dict) and "term" in v and isinstance(v["term"], str):
                        if len(v["term"].strip()) >= 2:
                            out.append(v["term"].strip())
                break  # première clé non-vide gagne
    return out


def _normalize_concept(term: str) -> str:
    """Normalize a concept term for dedup (lowercase, trim, collapse whitespace)."""
    return " ".join(term.lower().strip().split())


async def collect_user_concepts(
    user_id: int,
    db,  # AsyncSession SQLAlchemy
    limit: int = 30,
) -> list[dict]:
    """Merge key_topics ∪ entities.concepts depuis les analyses récentes du user.

    Stratégie:
      - Lookup au plus 100 derniers summaries (cap pour borner la requête)
      - Pour chaque summary, extract:
          1. `## ` headings via `_extract_key_topics`
          2. concepts via `_extract_entities_concepts`
      - Dédup par SHA256(normalized term)
      - Retourne max `limit` concepts (premiers vus = plus récents)

    Returns:
      list[dict] : [{"term": str, "term_hash": str (style='tutor_doodle'),
                     "category": "concept", "source_summary_id": int}]
    """
    from sqlalchemy import select, desc
    from db.database import Summary

    stmt = (
        select(Summary.id, Summary.summary_content, Summary.entities_extracted)
        .where(Summary.user_id == user_id)
        .order_by(desc(Summary.id))
        .limit(100)
    )
    result = await db.execute(stmt)
    rows = result.all()

    seen_norms: set[str] = set()
    out: list[dict] = []
    for row in rows:
        sid = row[0]
        content = row[1] or ""
        entities = row[2]
        # 1. key_topics from "## " headings
        for term in _extract_key_topics(content):
            norm = _normalize_concept(term)
            if not norm or norm in seen_norms:
                continue
            seen_norms.add(norm)
            out.append(
                {
                    "term": term[:200],
                    "term_hash": _term_hash(term, style="tutor_doodle"),
                    "category": "concept",
                    "source_summary_id": sid,
                }
            )
            if len(out) >= limit:
                return out
        # 2. entities.concepts
        for term in _extract_entities_concepts(entities):
            norm = _normalize_concept(term)
            if not norm or norm in seen_norms:
                continue
            seen_norms.add(norm)
            out.append(
                {
                    "term": term[:200],
                    "term_hash": _term_hash(term, style="tutor_doodle"),
                    "category": "concept",
                    "source_summary_id": sid,
                }
            )
            if len(out) >= limit:
                return out
    return out


async def attach_image_urls(concepts: list[dict]) -> list[dict]:
    """Pour chaque concept, lookup `image_url` dans keyword_images (style='tutor_doodle').

    Mutate-and-return : ajoute `image_url` et `status` ("ready" si trouvé,
    "missing" sinon). `check_lookup_pending` raffinera ensuite "missing" en
    "pending"/"failed" si une row est déjà en cours.
    """
    if not concepts:
        return concepts
    terms = [c["term"] for c in concepts]
    pool = await _get_image_pool()
    url_map = await batch_get_doodle_urls(terms, pool=pool)
    # `batch_get_doodle_urls` retourne {term_hash: url} ; nos concepts ont déjà term_hash.
    for c in concepts:
        url = url_map.get(c["term_hash"])
        c["image_url"] = url
        c["status"] = "ready" if url else "missing"
    return concepts


async def check_lookup_pending(concepts: list[dict]) -> list[dict]:
    """Raffine le status des concepts "missing" en regardant la DB.

    Pour les concepts dont aucun image_url n'a été trouvé (status="missing"),
    regarde si une row keyword_images existe déjà avec status='pending' ou
    'failed' (style='tutor_doodle'). Si oui, met à jour le status.
    """
    missing_hashes = [c["term_hash"] for c in concepts if c.get("status") == "missing"]
    if not missing_hashes:
        return concepts
    pool = await _get_image_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT term_hash, status FROM keyword_images WHERE term_hash = ANY($1) AND style = 'tutor_doodle'",
            missing_hashes,
        )
    status_map = {r["term_hash"]: r["status"] for r in rows}
    for c in concepts:
        if c.get("status") == "missing":
            db_status = status_map.get(c["term_hash"])
            if db_status in ("pending", "failed"):
                c["status"] = db_status
    return concepts


async def consume_daily_cap(n: int = 1) -> tuple[bool, int]:
    """Consume atomique du cap Redis global.

    Returns:
      (allowed, remaining_after) — `allowed` False si le cap serait dépassé.
      Si dépassé, rollback du counter (DECRBY) pour ne pas pénaliser les
      tentatives suivantes.

    Comportement Redis indisponible : on autorise (best-effort, ne bloque pas
    le user). C'est volontaire — le cap est anti-abuse, pas un hard-quota
    business. Si Redis tombe, on accepte de dépasser temporairement.
    """
    redis = _get_redis()
    if redis is None:
        logger.warning("Redis indisponible pour daily cap, autorise par défaut")
        return True, TUTOR_DOODLE_DAILY_CAP

    key = _daily_cap_key()
    try:
        new_count = await redis.incrby(key, n)
        if new_count == n:
            # Première hit du jour : set TTL 25h pour résister à un skew d'horloge / DST.
            await redis.expire(key, 86400 + 3600)
        if new_count > TUTOR_DOODLE_DAILY_CAP:
            await redis.decrby(key, n)  # rollback
            return False, max(0, TUTOR_DOODLE_DAILY_CAP - (new_count - n))
        return True, max(0, TUTOR_DOODLE_DAILY_CAP - new_count)
    except Exception as e:
        logger.warning(f"Redis daily cap error: {e} — autorise par défaut")
        return True, TUTOR_DOODLE_DAILY_CAP


async def enqueue_doodle_generation(
    term: str,
    definition: str = "",
    category: Optional[str] = None,
) -> None:
    """Fire-and-forget de la génération d'un doodle via `asyncio.create_task`.

    Consomme 1 unité du cap Redis ; no-op si dépassé. La task background
    appelle `generate_doodle_image` qui handle Gemini → DALL-E fallback,
    post-process, R2 upload et DB UPSERT.
    """
    allowed, _ = await consume_daily_cap(n=1)
    if not allowed:
        logger.warning(f"Daily doodle cap reached, skipping '{term}'")
        return

    async def _bg():
        try:
            url = await generate_doodle_image(term, definition, category)
            if url:
                logger.info(f"Doodle ready: '{term}' -> {url}")
        except Exception as e:
            logger.error(f"Doodle gen failed for '{term}': {e}")

    asyncio.create_task(_bg())


async def enqueue_top_concepts_doodles(
    summary_id: int,
    user_id: int,
    top_n: int = 3,
) -> int:
    """Post-analyse hook: pré-génère les top N concepts d'un summary en doodle.

    Appelé depuis videos/router.py après une analyse réussie. Ouvre sa propre
    session DB (`async_session_maker()`) car la session HTTP est fermée avant
    que cette task ne s'exécute (cf. asyncio.create_task fire-and-forget).

    Filtre les concepts déjà présents dans keyword_images (évite re-gen).

    Returns:
      Nombre de doodles enqueue (cap quotidien peut réduire ce nombre dans
      les tasks background, mais ce return reflète seulement les concepts
      sélectionnés pour génération).
    """
    if not is_gemini_available():
        return 0
    from sqlalchemy import select
    from db.database import async_session_maker, Summary

    async with async_session_maker() as db:
        stmt = select(Summary.summary_content, Summary.entities_extracted).where(Summary.id == summary_id)
        result = await db.execute(stmt)
        row = result.first()
        if not row:
            return 0
        content = row[0] or ""
        entities = row[1]

    # Merge concepts depuis ce seul summary
    seen: set[str] = set()
    picks: list[str] = []
    for term in _extract_key_topics(content):
        norm = _normalize_concept(term)
        if norm and norm not in seen:
            seen.add(norm)
            picks.append(term[:200])
        if len(picks) >= top_n:
            break
    if len(picks) < top_n:
        for term in _extract_entities_concepts(entities):
            norm = _normalize_concept(term)
            if norm and norm not in seen:
                seen.add(norm)
                picks.append(term[:200])
            if len(picks) >= top_n:
                break

    if not picks:
        return 0

    # Filtre les concepts déjà cached ou pending dans keyword_images
    pool = await _get_image_pool()
    hashes = [_term_hash(t, style="tutor_doodle") for t in picks]
    async with pool.acquire() as conn:
        existing = await conn.fetch(
            "SELECT term_hash FROM keyword_images WHERE term_hash = ANY($1) AND style = 'tutor_doodle'",
            hashes,
        )
    existing_set = {r["term_hash"] for r in existing}

    enqueued = 0
    for term in picks:
        thash = _term_hash(term, style="tutor_doodle")
        if thash in existing_set:
            continue
        await enqueue_doodle_generation(term, definition="", category="concept")
        enqueued += 1
    logger.info(f"Pre-gen {enqueued} tutor doodles for summary {summary_id} (user={user_id})")
    return enqueued
