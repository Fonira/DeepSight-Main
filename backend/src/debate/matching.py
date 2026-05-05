"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎯 DEBATE MATCHING v2 — Multi-criteria perspective video search                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Refonte du legacy `_search_opposing_video` (router.py:280-359) en pipeline       ║
║  multi-critères paramétré par `relation_type` ∈ {opposite, complement, nuance}.  ║
║                                                                                    ║
║  Pipeline :                                                                        ║
║  1. Cache lookup (debate_video_b_candidates, hash topic+relation+filters, 7j)     ║
║  2. Mistral génère 2 search queries adaptées à relation_type                      ║
║  3. Brave Search YouTube (count=15) pour chaque query                             ║
║  4. Filtrage dur (excluded ids, durée tier-aware short→short, langue)            ║
║  5. Scoring composite multi-critères :                                            ║
║       0.30 duration + 0.20 channel_quality + 0.15 freshness                       ║
║       + 0.20 audience + 0.15 query_relevance                                      ║
║     duration_match_score == 0  ⇒  rejet immédiat (-inf)                           ║
║  6. Diversity rule for 'nuance' : prefer audience opposite to existing            ║
║  7. Pick top-1, persist top-5 in cache, return                                    ║
║                                                                                    ║
║  Spec : docs/superpowers/specs/2026-05-04-debate-ia-v2.md  §4.1 / §4.4 / §5      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 TYPES & CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

RelationType = Literal["opposite", "complement", "nuance"]
AudienceLevel = Literal["vulgarisation", "expert", "unknown"]
DurationBucket = Literal["short", "medium", "long"]

CACHE_TTL_SECONDS: int = 7 * 24 * 3600  # 7 days

# ── Scoring weights (cf. spec §4.1) ───────────────────────────────────────────
DEFAULT_WEIGHTS: Dict[str, float] = {
    "duration_match": 0.30,
    "channel_quality": 0.20,
    "freshness": 0.15,
    "audience": 0.20,
    "query_relevance": 0.15,
}

# ── Channel heuristics ────────────────────────────────────────────────────────
TRASH_CHANNEL_PATTERNS: List[str] = [
    r"clickbait",
    r"top \d+ shocking",
    r"\bfake\b",
    r"truth.*exposed",
    r"compilation \d{4}",
    r"reupload",
]

EDU_CHANNEL_BONUS: List[str] = [
    "ScienceEtonnante",
    "Heu?reka",
    "Mr Phi",
    "DirtyBiology",
    "Crash Course",
    "Kurzgesagt",
    "Veritasium",
    "3Blue1Brown",
    "PBS Eons",
    "Numberphile",
    "Computerphile",
]

# ── Channel-quality threshold below which candidate is dropped ────────────────
TRASH_QUALITY_FLOOR: float = 0.2


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 DATACLASSES
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class PerspectiveFilters:
    """Filtres + signaux à transmettre au pipeline matching.

    `excluded_video_ids` couvre la vidéo A et toute perspective déjà persistée.
    `excluded_audience_levels` est utilisé par la règle de diversité (relation
    `nuance` → on évite l'audience déjà couverte côté A si renseignée).
    """

    video_a_id: str
    video_a_title: str = ""
    video_a_channel: str = ""
    video_a_duration_seconds: int = 0
    excluded_video_ids: set = field(default_factory=set)
    excluded_audience_levels: set = field(default_factory=set)
    user_plan: str = "free"


@dataclass
class PerspectiveCandidate:
    """Candidat scoré renvoyé par le pipeline matching."""

    video_id: str
    platform: str
    title: str
    channel: str
    thumbnail: str
    duration_seconds: int
    published_at: Optional[str]
    audience_level: AudienceLevel
    channel_quality_score: float
    raw_query: str
    score: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ═══════════════════════════════════════════════════════════════════════════════
# 🪪 TIER MAPPING (format-aware, 3 buckets ≠ Duration Router 6 tiers)
# ═══════════════════════════════════════════════════════════════════════════════


def tier_from_duration(duration_seconds: int) -> DurationBucket:
    """Retourne le bucket strict de matching ('short'|'medium'|'long').

    Justification du mapping 3-tiers : pour le matching on veut éviter qu'une
    vidéo de 8 min soit comparée à une de 2 h. 3 buckets suffisent (cf. spec §3.3).
    """
    if not duration_seconds or duration_seconds <= 0:
        # Pas d'info → on traite comme 'medium' pour ne pas tout rejeter
        return "medium"
    if duration_seconds < 60:
        return "short"
    if duration_seconds < 1200:  # 20 min
        return "medium"
    return "long"


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 SCORING HELPERS — un par dimension
# ═══════════════════════════════════════════════════════════════════════════════


def _apply_duration_filter(
    candidate_duration: int, target_duration: int
) -> float:
    """Score 0..1 strict format-aware.

    Matching parfait (même bucket)  → 1.0
    Bucket différent                → 0.0  (rejet immédiat en aval)
    """
    target_bucket = tier_from_duration(target_duration)
    candidate_bucket = tier_from_duration(candidate_duration)
    return 1.0 if candidate_bucket == target_bucket else 0.0


def _apply_channel_quality_filter(
    channel_name: str, channel_context: Optional[Dict[str, Any]]
) -> float:
    """Score 0..1. Combine bonus éducatif, blacklist, signaux ch_ctx (cf. §3.4)."""
    name = (channel_name or "").lower()
    score = 0.5  # baseline neutre

    for trash in TRASH_CHANNEL_PATTERNS:
        if re.search(trash, name, re.I):
            score -= 0.4

    for edu in EDU_CHANNEL_BONUS:
        if edu.lower() in name:
            score += 0.3
            break  # un seul bonus pour ne pas exploser le score

    if channel_context:
        try:
            chapters_pct = float(channel_context.get("has_chapters_pct", 0) or 0)
            avg_dur = float(
                channel_context.get("avg_video_duration_seconds", 0) or 0
            )
        except (TypeError, ValueError):
            chapters_pct, avg_dur = 0.0, 0.0
        if chapters_pct > 0.6:
            score += 0.1
        if avg_dur > 600:
            score += 0.05

    return max(0.0, min(1.0, score))


def _apply_freshness_weight(published_at: Optional[str]) -> float:
    """Pondéré ±12 mois mais pas strict. Vieille vidéo OK si très pertinente."""
    if not published_at:
        return 0.5
    try:
        cleaned = published_at.replace("Z", "+00:00")
        d = datetime.fromisoformat(cleaned)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        return 0.5

    months_old = (datetime.now(timezone.utc) - d).days / 30.0
    if months_old < 0:
        # Future-dated metadata bug → treat as fresh
        return 1.0
    if months_old < 12:
        return 1.0
    if months_old < 24:
        return 0.7
    if months_old < 60:
        return 0.4
    return 0.2  # >5 ans : badge "Vidéo de YYYY" affiché côté UI


def _detect_audience(
    candidate: Dict[str, Any], channel_context: Optional[Dict[str, Any]]
) -> AudienceLevel:
    """Retourne 'vulgarisation' | 'expert' | 'unknown' (heuristique titre+ch_ctx)."""
    title_lower = (candidate.get("title") or "").lower()

    vulgar_markers = (
        "explained",
        "expliqué",
        "intro",
        "beginner",
        "débutant",
        "for dummies",
        "pour les nuls",
    )
    expert_markers = (
        "paper",
        "research",
        "deep dive",
        "advanced",
        "phd",
        "thèse",
        "conference",
        "preprint",
        "lecture",
    )

    if any(t in title_lower for t in vulgar_markers):
        return "vulgarisation"
    if any(t in title_lower for t in expert_markers):
        return "expert"

    if channel_context:
        try:
            avg_dur = float(
                channel_context.get("avg_video_duration_seconds", 0) or 0
            )
        except (TypeError, ValueError):
            avg_dur = 0.0
        if avg_dur > 1800:  # >30 min en moyenne → tendance expert
            return "expert"

    return "unknown"


def _apply_audience_filter(
    candidate_audience: AudienceLevel,
    relation_type: RelationType,
    excluded_audience_levels: Optional[set] = None,
) -> float:
    """Retourne un score 0..1 selon la règle :

    - 'opposite' : strict, aucune préférence (neutre 0.5)
    - 'complement' : neutre 0.6 (légère préférence pour des angles différents)
    - 'nuance' : diversifier — bonus si l'audience candidate diffère de celles
      déjà présentes dans `excluded_audience_levels` (ex: A=vulgar → bonus expert).
    """
    excluded = excluded_audience_levels or set()

    if relation_type == "nuance":
        # Bonus diversité quand on apporte un angle audience différent
        if candidate_audience != "unknown" and candidate_audience not in excluded:
            return 1.0
        if candidate_audience == "unknown":
            return 0.4
        return 0.5  # déjà couvert → pas pénalisé mais pas bonus

    if relation_type == "complement":
        # Légère préférence pour des angles non encore couverts
        if candidate_audience != "unknown" and candidate_audience not in excluded:
            return 0.75
        return 0.6

    # opposite : pas de préférence d'audience particulière
    return 0.5


def _query_relevance_score(rank_in_results: int, total: int) -> float:
    """Score 0..1 basé sur la position du candidat dans Brave search rank.

    Plus le résultat apparaît tôt dans la liste, plus le score est élevé.
    Décroissance douce : pos 0 → 1.0, pos 5 → ~0.66, pos 10 → ~0.45.
    """
    if total <= 0 or rank_in_results < 0:
        return 0.5
    # Decay exponentiel léger
    return float(math.exp(-rank_in_results / 8.0))


# ═══════════════════════════════════════════════════════════════════════════════
# 🧮 SCORE COMPOSITE
# ═══════════════════════════════════════════════════════════════════════════════


def score_candidate(
    candidate: Dict[str, Any],
    filters: PerspectiveFilters,
    relation_type: RelationType,
    rank_in_results: int = 0,
    total_results: int = 1,
    channel_context: Optional[Dict[str, Any]] = None,
    weights: Optional[Dict[str, float]] = None,
) -> float:
    """Compute a composite score for a candidate dict.

    `candidate` shape (post-Brave normalization) :
        {video_id, title, channel, duration_seconds, published_at, thumbnail}

    Returns:
        composite score ∈ [0..1] OR -inf if duration_match == 0 (rejet).
    """
    w = weights or DEFAULT_WEIGHTS

    duration_score = _apply_duration_filter(
        candidate.get("duration_seconds") or 0,
        filters.video_a_duration_seconds,
    )
    if duration_score == 0:
        return float("-inf")  # rejet immédiat (cf. spec §4.1)

    channel_quality = _apply_channel_quality_filter(
        candidate.get("channel") or "", channel_context
    )
    freshness = _apply_freshness_weight(candidate.get("published_at"))
    audience = _detect_audience(candidate, channel_context)
    audience_score = _apply_audience_filter(
        audience, relation_type, filters.excluded_audience_levels
    )
    relevance = _query_relevance_score(rank_in_results, total_results)

    composite = (
        duration_score * w["duration_match"]
        + channel_quality * w["channel_quality"]
        + freshness * w["freshness"]
        + audience_score * w["audience"]
        + relevance * w["query_relevance"]
    )
    return float(max(0.0, min(1.0, composite)))


# ═══════════════════════════════════════════════════════════════════════════════
# 🔎 QUERY GENERATION (Mistral, adapted to relation_type)
# ═══════════════════════════════════════════════════════════════════════════════


_RELATION_INSTRUCTIONS: Dict[str, str] = {
    "opposite": (
        "Tu cherches une vidéo qui CONTREDIT, CRITIQUE ou OPPOSE la thèse. "
        "Mots-clés antagonistes : critique, problème, limite, contre, debunked, myth, "
        "issue, vs, fake, overrated."
    ),
    "complement": (
        "Tu cherches une vidéo qui COMPLÈTE, ENRICHIT ou ÉTEND la thèse sous un autre angle. "
        "Mots-clés : approfondir, perspective, autre, complément, étude de cas, case study, "
        "deep dive, exploration, behind the scenes, insider."
    ),
    "nuance": (
        "Tu cherches une vidéo qui APPORTE DE LA NUANCE — ni totalement pour ni contre, "
        "mais conditionnelle ou contextuelle. Mots-clés : nuance, dépend, contexte, "
        "limites de, when does X work, conditions, exceptions, depends on, edge cases."
    ),
}


async def _generate_queries_for_relation(
    topic: str,
    thesis_a: str,
    relation_type: RelationType,
    title_to_avoid: str,
    lang: str,
    model: str,
    call_mistral_fn,
    extract_json_fn,
) -> List[str]:
    """Mistral génère 2 queries YouTube adaptées au type de relation.

    `call_mistral_fn` et `extract_json_fn` sont injectés pour faciliter le test
    (au lieu d'importer en dur depuis router.py et créer un cycle).
    """
    instruction = _RELATION_INSTRUCTIONS.get(
        relation_type, _RELATION_INSTRUCTIONS["opposite"]
    )
    lang_inst = (
        "Formule en français." if lang == "fr" else "Write in English."
    )
    sys_prompt = (
        "Tu es expert en recherche YouTube. Génère DEUX requêtes (5-10 mots chacune) "
        f"susceptibles de retourner une vidéo qui {instruction} "
        f"NE REPRODUIS PAS le titre original. {lang_inst} "
        'Réponds UNIQUEMENT en JSON : {"query_primary": "...", "query_alternative": "..."}'
    )
    user_prompt = (
        f"Sujet : {topic}\nThèse : {thesis_a}\nTitre à éviter : {title_to_avoid or '(inconnu)'}"
    )

    raw = await call_mistral_fn(
        [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=model,
        temperature=0.6,
        json_mode=True,
    )
    if not raw:
        return []

    parsed = extract_json_fn(raw) or {}
    queries: List[str] = []
    if isinstance(parsed, dict):
        for key in ("query_primary", "query_alternative"):
            q = parsed.get(key)
            if isinstance(q, str) and q.strip():
                queries.append(q.strip().strip('"').strip("'")[:100])
    return queries


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 CACHE — debate_video_b_candidates (TTL 7 days)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_candidates_cache_key(
    topic: str, relation_type: RelationType, lang: str, duration_a: int
) -> str:
    """Déterministe sha256 hex (cf. spec §3.5).

    Bucket `short|medium|long` au lieu de la durée brute → plus de hits cache.
    """
    bucket = tier_from_duration(duration_a)
    raw = f"v2|{(topic or '').lower().strip()[:200]}|{relation_type}|{lang}|{bucket}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _get_cached_candidates(
    cache_key: str, db: AsyncSession
) -> Optional[List[Dict[str, Any]]]:
    """Lit la table debate_video_b_candidates (PG L2). Retourne None si miss/expiré."""
    try:
        # Import lazy pour éviter un cycle si database.py n'est pas encore prêt
        from db.database import DebateVideoBCandidatesCache
    except ImportError:
        logger.debug(
            "[DEBATE-MATCH] DebateVideoBCandidatesCache model not available — skip cache"
        )
        return None

    try:
        result = await db.execute(
            select(DebateVideoBCandidatesCache).where(
                DebateVideoBCandidatesCache.cache_key == cache_key
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        # TTL check (côté app, pas de scheduler purge encore)
        expires_at = row.expires_at
        if expires_at is not None:
            now = datetime.now(timezone.utc)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= now:
                return None
        try:
            data = json.loads(row.candidates_json) if row.candidates_json else None
        except json.JSONDecodeError:
            return None
        if not isinstance(data, list):
            return None
        return data
    except Exception as exc:  # noqa: BLE001 — best-effort cache layer
        logger.warning("[DEBATE-MATCH] Cache lookup failed: %s", str(exc)[:200])
        return None


async def _put_cached_candidates(
    cache_key: str,
    candidates: List[Dict[str, Any]],
    relation_type: RelationType,
    lang: str,
    duration_bucket: DurationBucket,
    topic_normalized: str,
    db: AsyncSession,
    ttl_seconds: int = CACHE_TTL_SECONDS,
) -> None:
    """Upsert (cache_key) sur la table debate_video_b_candidates."""
    try:
        from db.database import DebateVideoBCandidatesCache
    except ImportError:
        logger.debug(
            "[DEBATE-MATCH] DebateVideoBCandidatesCache model unavailable — skip cache write"
        )
        return

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)
    try:
        # Try update first (cheap path), then insert
        result = await db.execute(
            select(DebateVideoBCandidatesCache).where(
                DebateVideoBCandidatesCache.cache_key == cache_key
            )
        )
        existing = result.scalar_one_or_none()
        candidates_json = json.dumps(candidates, ensure_ascii=False)
        if existing:
            existing.candidates_json = candidates_json
            existing.expires_at = expires_at
            existing.relation_type = relation_type
            existing.lang = lang
            existing.duration_bucket = duration_bucket
            existing.topic_normalized = topic_normalized[:255]
        else:
            db.add(
                DebateVideoBCandidatesCache(
                    cache_key=cache_key,
                    relation_type=relation_type,
                    lang=lang,
                    duration_bucket=duration_bucket,
                    candidates_json=candidates_json,
                    topic_normalized=topic_normalized[:255],
                    created_at=now,
                    expires_at=expires_at,
                )
            )
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[DEBATE-MATCH] Cache write failed: %s", str(exc)[:200])
        try:
            await db.rollback()
        except Exception:  # noqa: BLE001
            pass


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 BRAVE NORMALIZATION — extract video_id, clean title, etc.
# ═══════════════════════════════════════════════════════════════════════════════

_YT_PATTERN = re.compile(r"youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})")


def _normalize_brave_result(
    result: Dict[str, Any], query: str
) -> Optional[Dict[str, Any]]:
    """Convertit un result Brave en dict candidate normalisé.

    Returns None si pas un YouTube URL exploitable.
    """
    url = result.get("url") or ""
    match = _YT_PATTERN.search(url)
    if not match:
        return None

    video_id = match.group(1)
    raw_title = result.get("title") or ""
    try:
        fixed_title = raw_title.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        fixed_title = raw_title
    if fixed_title.endswith(" - YouTube"):
        fixed_title = fixed_title[: -len(" - YouTube")].strip()

    description = (result.get("description") or "").strip()
    # Brave parfois met la chaîne dans description ou meta_url.hostname-like
    channel = result.get("channel") or ""
    if not channel and description:
        # Best-effort : la description Brave commence souvent par "ChannelName · ..."
        # On laisse vide si pas trouvable, le scoring tolère.
        pass

    duration_seconds = 0
    raw_duration = result.get("duration_seconds") or result.get("duration") or 0
    try:
        duration_seconds = int(raw_duration) if raw_duration else 0
    except (TypeError, ValueError):
        duration_seconds = 0

    return {
        "video_id": video_id,
        "platform": "youtube",
        "title": fixed_title,
        "channel": channel,
        "thumbnail": result.get("thumbnail") or "",
        "duration_seconds": duration_seconds,
        "published_at": result.get("published_at") or result.get("page_age"),
        "url": url,
        "raw_query": query,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 PUBLIC ENTRY — _search_perspective_video
# ═══════════════════════════════════════════════════════════════════════════════


async def _search_perspective_video(
    topic: str,
    thesis_a: str,
    relation: RelationType,
    filters: PerspectiveFilters,
    lang: str = "fr",
    *,
    db: Optional[AsyncSession] = None,
    model: str = "mistral-small-2603",
    call_mistral_fn=None,
    extract_json_fn=None,
    brave_search_fn=None,
    channel_context_fn=None,
    weights: Optional[Dict[str, float]] = None,
) -> Optional[PerspectiveCandidate]:
    """Pipeline matching multi-critères pour trouver la perspective B.

    Args:
        topic: sujet détecté côté A.
        thesis_a: thèse défendue par A.
        relation: 'opposite' | 'complement' | 'nuance'.
        filters: PerspectiveFilters (durée A, excluded ids, plan, etc.).
        lang: 'fr' | 'en'.
        db: AsyncSession pour le cache (peut être None → cache désactivé).
        model: Mistral model id pour la query gen (default small).
        call_mistral_fn / extract_json_fn / brave_search_fn / channel_context_fn:
            injections pour faciliter les tests. Si None, fallbacks production
            via debate.router._call_mistral / _extract_json / _brave_youtube_search
            et services.channel_content_cache.get_or_fetch_channel_context.

    Returns:
        Top-1 PerspectiveCandidate ou None si aucun candidat acceptable trouvé.
    """
    # ── Lazy injection des fallbacks production ───────────────────────────────
    if call_mistral_fn is None or extract_json_fn is None:
        from debate.router import (  # type: ignore
            _call_mistral as _prod_call_mistral,
            _extract_json as _prod_extract_json,
        )

        call_mistral_fn = call_mistral_fn or _prod_call_mistral
        extract_json_fn = extract_json_fn or _prod_extract_json

    if brave_search_fn is None:
        from debate.router import _brave_youtube_search as _prod_brave  # type: ignore

        brave_search_fn = _prod_brave

    if channel_context_fn is None:
        try:
            from services.channel_content_cache import (  # type: ignore
                get_or_fetch_channel_context as _prod_chan_ctx,
            )

            channel_context_fn = _prod_chan_ctx
        except ImportError:
            channel_context_fn = None  # graceful: scoring tolère ch_ctx None

    duration_bucket = tier_from_duration(filters.video_a_duration_seconds)

    # ── 0) Cache lookup ───────────────────────────────────────────────────────
    cache_key = compute_candidates_cache_key(
        topic, relation, lang, filters.video_a_duration_seconds
    )
    if db is not None:
        cached = await _get_cached_candidates(cache_key, db)
        if cached:
            for cand in cached:
                if cand.get("video_id") not in filters.excluded_video_ids:
                    logger.info(
                        "[DEBATE-MATCH] cache_hit relation=%s key=%s",
                        relation,
                        cache_key[:16],
                    )
                    try:
                        return PerspectiveCandidate(**{
                            k: v for k, v in cand.items()
                            if k in PerspectiveCandidate.__dataclass_fields__
                        })
                    except TypeError:
                        # Schema drift → fallthrough to live search
                        break

    # ── 1) Brave key gating ───────────────────────────────────────────────────
    try:
        from core.config import get_brave_key  # type: ignore

        brave_key = get_brave_key()
    except Exception:  # noqa: BLE001
        brave_key = ""

    if not brave_key:
        logger.warning("[DEBATE-MATCH] No Brave key — cannot search perspective")
        return None

    # ── 2) Generate queries ──────────────────────────────────────────────────
    queries = await _generate_queries_for_relation(
        topic=topic,
        thesis_a=thesis_a,
        relation_type=relation,
        title_to_avoid=filters.video_a_title,
        lang=lang,
        model=model,
        call_mistral_fn=call_mistral_fn,
        extract_json_fn=extract_json_fn,
    )
    if not queries:
        logger.warning(
            "[DEBATE-MATCH] No queries generated relation=%s topic=%r",
            relation,
            (topic or "")[:80],
        )
        return None

    # ── 3) Brave Search → flat raw list ──────────────────────────────────────
    raw_results: List[Tuple[Dict[str, Any], str]] = []
    for q in queries:
        try:
            results = await brave_search_fn(q, brave_key, count=15)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[DEBATE-MATCH] Brave failed q=%r: %s", q[:80], str(exc)[:200]
            )
            continue
        for r in results or []:
            raw_results.append((r, q))

    if not raw_results:
        logger.warning(
            "[DEBATE-MATCH] Brave returned 0 results across %d queries", len(queries)
        )
        return None

    # ── 4) Normalize + hard filters (excluded ids, dedupe by video_id) ────────
    seen_ids: set = set()
    normalized: List[Dict[str, Any]] = []
    for idx, (r, q) in enumerate(raw_results):
        cand = _normalize_brave_result(r, q)
        if not cand:
            continue
        vid = cand["video_id"]
        if vid in filters.excluded_video_ids or vid in seen_ids:
            continue
        seen_ids.add(vid)
        cand["__rank"] = idx
        normalized.append(cand)

    if not normalized:
        logger.warning(
            "[DEBATE-MATCH] No candidate left after dedup/exclusions (excluded=%d)",
            len(filters.excluded_video_ids),
        )
        return None

    # ── 5) Enrich with channel context (cap 8 to limit fan-out) ──────────────
    enriched: List[PerspectiveCandidate] = []
    total_norm = len(normalized)
    cap = min(8, total_norm)
    for cand in normalized[:cap]:
        ch_ctx: Optional[Dict[str, Any]] = None
        ch_id = cand.get("channel") or ""
        if channel_context_fn and ch_id:
            try:
                ch_ctx = await channel_context_fn("youtube", ch_id)
            except Exception as exc:  # noqa: BLE001
                logger.debug(
                    "[DEBATE-MATCH] channel_context_fn failed channel=%r: %s",
                    ch_id[:60],
                    str(exc)[:200],
                )
                ch_ctx = None

        ch_quality = _apply_channel_quality_filter(cand.get("channel") or "", ch_ctx)
        if ch_quality < TRASH_QUALITY_FLOOR:
            continue  # trash channel filter

        composite = score_candidate(
            cand,
            filters,
            relation,
            rank_in_results=cand.get("__rank", 0),
            total_results=total_norm,
            channel_context=ch_ctx,
            weights=weights,
        )
        if composite == float("-inf"):
            continue  # duration mismatch hard reject

        audience = _detect_audience(cand, ch_ctx)
        enriched.append(
            PerspectiveCandidate(
                video_id=cand["video_id"],
                platform="youtube",
                title=(cand.get("title") or "")[:500],
                channel=(cand.get("channel") or "")[:255],
                thumbnail=cand.get("thumbnail") or "",
                duration_seconds=cand.get("duration_seconds") or 0,
                published_at=cand.get("published_at"),
                audience_level=audience,
                channel_quality_score=ch_quality,
                raw_query=cand.get("raw_query") or "",
                score=composite,
            )
        )

    if not enriched:
        logger.warning(
            "[DEBATE-MATCH] All candidates rejected post-scoring (norm=%d)", total_norm
        )
        return None

    enriched.sort(key=lambda x: x.score, reverse=True)
    chosen = enriched[0]

    # ── 6) Persist top-5 in cache (best-effort) ──────────────────────────────
    if db is not None:
        top5 = [c.to_dict() for c in enriched[:5]]
        await _put_cached_candidates(
            cache_key,
            top5,
            relation_type=relation,
            lang=lang,
            duration_bucket=duration_bucket,
            topic_normalized=(topic or "")[:200],
            db=db,
        )

    logger.info(
        "[DEBATE-MATCH] picked relation=%s vid=%s score=%.3f channel=%r audience=%s",
        relation,
        chosen.video_id,
        chosen.score,
        chosen.channel[:60],
        chosen.audience_level,
    )
    return chosen


# ═══════════════════════════════════════════════════════════════════════════════
# 🔁 BACKWARD-COMPAT WRAPPER — pour `mode=auto` legacy
# ═══════════════════════════════════════════════════════════════════════════════


async def search_opposing_video_legacy_compat(
    topic: str,
    thesis_a: str,
    video_a_id: str,
    video_a_title: Optional[str] = None,
    video_a_channel: Optional[str] = None,
    lang: str = "fr",
    model: str = "mistral-small-2603",
    *,
    video_a_duration_seconds: int = 0,
    user_plan: str = "free",
    db: Optional[AsyncSession] = None,
) -> Optional[Dict[str, str]]:
    """Wrapper drop-in pour remplacer l'ancien `_search_opposing_video`.

    Conserve la signature de retour `{url, title, channel}` afin que le code
    appelant (router.py:_run_debate_pipeline) ne casse pas.
    """
    filters = PerspectiveFilters(
        video_a_id=video_a_id,
        video_a_title=video_a_title or "",
        video_a_channel=video_a_channel or "",
        video_a_duration_seconds=video_a_duration_seconds,
        excluded_video_ids={video_a_id},
        excluded_audience_levels=set(),
        user_plan=user_plan,
    )
    chosen = await _search_perspective_video(
        topic=topic,
        thesis_a=thesis_a,
        relation="opposite",
        filters=filters,
        lang=lang,
        db=db,
        model=model,
    )
    if not chosen:
        return None
    return {
        "url": f"https://www.youtube.com/watch?v={chosen.video_id}",
        "title": chosen.title,
        "channel": chosen.channel,
    }


__all__ = [
    "RelationType",
    "AudienceLevel",
    "DurationBucket",
    "DEFAULT_WEIGHTS",
    "TRASH_CHANNEL_PATTERNS",
    "EDU_CHANNEL_BONUS",
    "TRASH_QUALITY_FLOOR",
    "PerspectiveFilters",
    "PerspectiveCandidate",
    "tier_from_duration",
    "score_candidate",
    "compute_candidates_cache_key",
    "_apply_duration_filter",
    "_apply_channel_quality_filter",
    "_apply_freshness_weight",
    "_detect_audience",
    "_apply_audience_filter",
    "_query_relevance_score",
    "_generate_queries_for_relation",
    "_search_perspective_video",
    "search_opposing_video_legacy_compat",
]
