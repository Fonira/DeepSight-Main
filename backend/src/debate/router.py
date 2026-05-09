"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎭 DEBATE ROUTER — Confrontation IA de perspectives vidéo (v2 adaptatif 1-N)     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  POST   /api/debate/create                       — Lancer un débat                ║
║  POST   /api/debate/{debate_id}/add-perspective  — Ajouter complement|nuance      ║
║  GET    /api/debate/status/{debate_id}           — Poll status                    ║
║  GET    /api/debate/{debate_id}                  — Résultat complet               ║
║  GET    /api/debate/history                      — Liste des débats (paginé)      ║
║  DELETE /api/debate/{debate_id}                  — Supprimer un débat             ║
║  POST   /api/debate/chat                         — Chat avec contexte             ║
║  GET    /api/debate/chat/history/{id}            — Historique chat débat          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import logging
import re
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.http_client import shared_http_client
from auth.dependencies import get_current_user, require_credits
from core.config import PLAN_LIMITS
from core.llm_provider import llm_complete
from core.moderation_service import moderate_text
from videos.web_search_provider import web_search_and_synthesize
from core.credits import deduct_credits
from db.database import (
    DebateAnalysis,
    DebateChatMessage,
    DebatePerspective,
    User,
    async_session_maker,
    get_session,
)
from utils.video_id import extract_video_id
from transcripts.youtube import get_video_info, get_transcript_with_timestamps
from transcripts.tiktok import get_tiktok_video_info, get_tiktok_transcript

from .matching import _search_perspective_video as _real_search_perspective_video

from .schemas import (
    AddPerspectiveRequest,
    DebateChatMessageResponse,
    DebateChatRequest,
    DebateCreateRequest,
    DebateCreateResponse,
    DebateHistoryResponse,
    DebateListItem,
    DebatePerspectiveResponse,
    DebateResultResponse,
    DebateStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory task store for background progress (same pattern as playlists)
_debate_task_store: Dict[int, Dict[str, Any]] = {}

# Status messages for UI
STATUS_MESSAGES = {
    "pending": "Débat en attente de traitement...",
    "searching": "Recherche d'une vidéo avec un point de vue opposé...",
    "analyzing_b": "Analyse de la vidéo opposée...",
    "comparing": "Analyse comparative avec Mistral IA...",
    "fact_checking": "Fact-checking croisé en cours...",
    "adding_perspective": "Ajout d'une nouvelle perspective au débat...",
    "completed": "Débat terminé !",
    "failed": "Échec de l'analyse.",
}

MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
# PERPLEXITY_CHAT_URL supprimé — migré vers web_search_provider

# Magistral — modèle de raisonnement Mistral (chain-of-thought).
# Utilisé pour l'analyse comparative entre vidéo A et chaque perspective B.
# Cf. spec docs/superpowers/specs/2026-05-04-debate-ia-v2.md §5.
MAGISTRAL_MODEL = "magistral-medium-2509"

# Crédits par perspective ajoutée (sprint v2)
ADD_PERSPECTIVE_CREDITS = 3
MAX_PERSPECTIVES_PER_DEBATE = 3


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def _parse_json_field(value: Optional[str]) -> Any:
    """Parse a JSON text column, return empty list/dict on failure."""
    if not value:
        return []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []


def _normalize_fact_check(value: Optional[str]) -> list:
    """Ensure fact_check_results is always a list of FactCheckItem dicts."""
    parsed = _parse_json_field(value)
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        if "claims" in parsed and isinstance(parsed["claims"], list):
            return parsed["claims"]
        return []
    return []


def _perspective_to_response(p: DebatePerspective) -> DebatePerspectiveResponse:
    """Convert a DebatePerspective ORM row to a Pydantic response model."""
    return DebatePerspectiveResponse(
        id=p.id,
        position=p.position,
        video_id=p.video_id,
        platform=p.platform or "youtube",
        video_title=p.video_title,
        video_channel=p.video_channel,
        video_thumbnail=p.video_thumbnail,
        thesis=p.thesis,
        arguments=_parse_json_field(p.arguments) if p.arguments else None,
        relation_type=(p.relation_type or "opposite"),  # type: ignore[arg-type]
        channel_quality_score=p.channel_quality_score
        if p.channel_quality_score is not None
        else 0.5,
        audience_level=(p.audience_level or "unknown"),  # type: ignore[arg-type]
        fact_check_results=(
            _parse_json_field(p.fact_check_results) if p.fact_check_results else None
        ),
        created_at=p.created_at or datetime.utcnow(),
    )


def _debate_to_result(
    debate: DebateAnalysis,
    perspectives: Optional[List[DebatePerspective]] = None,
) -> DebateResultResponse:
    """Convert a DebateAnalysis ORM object to a DebateResultResponse.

    v2 (2026-05-04) — Backward-compat:
      - Si `perspectives` est fourni : la position=0 alimente les champs legacy
        `video_b_*` / `thesis_b` / `arguments_b` pour les clients v1, et la
        liste complète (1-N) part dans `perspectives[]`.
      - Sinon (None) : fallback sur les colonnes legacy `video_b_*` du
        DebateAnalysis (rétro-compat avant matérialisation du backfill).
    """
    persp_list = perspectives or []
    p0 = persp_list[0] if persp_list else None

    # Champs B legacy : priorité aux perspectives DB > colonnes legacy
    video_b_id = (p0.video_id if p0 else None) or debate.video_b_id
    video_b_title = (p0.video_title if p0 else None) or debate.video_b_title
    video_b_channel = (p0.video_channel if p0 else None) or debate.video_b_channel
    video_b_thumbnail = (p0.video_thumbnail if p0 else None) or debate.video_b_thumbnail
    platform_b = (p0.platform if p0 else None) or getattr(debate, "platform_b", None)
    thesis_b = (p0.thesis if p0 else None) or debate.thesis_b
    arguments_b = (
        _parse_json_field(p0.arguments) if p0 else _parse_json_field(debate.arguments_b)
    )

    return DebateResultResponse(
        id=debate.id,
        video_a_id=debate.video_a_id,
        video_b_id=video_b_id,
        platform_a=getattr(debate, "platform_a", None) or "youtube",
        platform_b=platform_b,
        video_a_title=debate.video_a_title or "Vidéo A",
        video_b_title=video_b_title,
        video_a_channel=debate.video_a_channel,
        video_b_channel=video_b_channel,
        video_a_thumbnail=debate.video_a_thumbnail,
        video_b_thumbnail=video_b_thumbnail,
        detected_topic=debate.detected_topic,
        thesis_a=debate.thesis_a,
        thesis_b=thesis_b,
        arguments_a=_parse_json_field(debate.arguments_a),
        arguments_b=arguments_b,
        convergence_points=_parse_json_field(debate.convergence_points),
        divergence_points=_parse_json_field(debate.divergence_points),
        fact_check_results=_normalize_fact_check(debate.fact_check_results),
        debate_summary=debate.debate_summary,
        status=debate.status,
        mode=debate.mode or "auto",
        model_used=debate.model_used,
        credits_used=debate.credits_used or 0,
        lang=debate.lang or "fr",
        relation_type_dominant=(
            getattr(debate, "relation_type_dominant", None) or "opposite"
        ),
        perspectives=[_perspective_to_response(p) for p in persp_list],
        created_at=debate.created_at or datetime.utcnow(),
        updated_at=debate.updated_at,
    )


async def _build_debate_response(
    db: AsyncSession, debate: DebateAnalysis
) -> DebateResultResponse:
    """Charge les perspectives + assemble le DebateResultResponse complet.

    Préférer ce helper sur `_debate_to_result` direct dès qu'on a une session
    pour bénéficier du chargement des perspectives v2.
    """
    perspectives = await _load_perspectives(db, debate.id)
    return _debate_to_result(debate, perspectives=perspectives)


async def _recompute_relation_type_dominant(
    session: AsyncSession, debate_id: int
) -> str:
    """Recalcule la relation_type dominante d'un débat à partir des perspectives.

    Stratégie : count des relation_type sur les perspectives, prendre la plus
    fréquente. En cas d'égalité ou si aucune perspective : 'opposite' (default).
    Stocké sur DebateAnalysis.relation_type_dominant pour piloter le naming UI.
    """
    result = await session.execute(
        select(DebatePerspective.relation_type).where(
            DebatePerspective.debate_id == debate_id
        )
    )
    relations = [r for r in result.scalars().all() if r]
    if not relations:
        dominant = "opposite"
    else:
        counts = Counter(relations)
        dominant = counts.most_common(1)[0][0]

    # Update sur DebateAnalysis
    debate_result = await session.execute(
        select(DebateAnalysis).where(DebateAnalysis.id == debate_id)
    )
    debate = debate_result.scalar_one_or_none()
    if debate:
        debate.relation_type_dominant = dominant
        await session.commit()
    return dominant


async def _load_perspectives(
    session: AsyncSession, debate_id: int
) -> List[DebatePerspective]:
    """Charge les perspectives d'un débat triées par position ascendante."""
    result = await session.execute(
        select(DebatePerspective)
        .where(DebatePerspective.debate_id == debate_id)
        .order_by(DebatePerspective.position.asc())
    )
    return list(result.scalars().all())


async def _persist_perspective(
    session: AsyncSession,
    debate_id: int,
    position: int,
    video_id: str,
    platform: str,
    video_title: str,
    video_channel: str,
    video_thumbnail: str,
    thesis: Optional[str],
    arguments: Optional[list],
    relation_type: str,
    channel_quality_score: float = 0.5,
    audience_level: str = "unknown",
    fact_check_results: Optional[list] = None,
) -> DebatePerspective:
    """Crée une row DebatePerspective. Caller doit await session.commit()."""
    perspective = DebatePerspective(
        debate_id=debate_id,
        position=position,
        video_id=video_id,
        platform=platform,
        video_title=(video_title or "")[:500],
        video_channel=(video_channel or "")[:255],
        video_thumbnail=video_thumbnail or "",
        thesis=thesis,
        arguments=json.dumps(arguments, ensure_ascii=False) if arguments else None,
        relation_type=relation_type,
        channel_quality_score=channel_quality_score,
        audience_level=audience_level,
        fact_check_results=(
            json.dumps(fact_check_results, ensure_ascii=False)
            if fact_check_results
            else None
        ),
    )
    session.add(perspective)
    await session.flush()
    return perspective


async def _get_debate_owned(db: AsyncSession, debate_id: int, user_id: int) -> DebateAnalysis:
    """Fetch a debate, verify ownership, raise 404/403."""
    result = await db.execute(select(DebateAnalysis).where(DebateAnalysis.id == debate_id))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Débat introuvable")
    if debate.user_id != user_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return debate


async def _call_mistral(
    messages: list,
    model: str = "mistral-small-2603",
    temperature: float = 0.4,
    max_tokens: int = 4096,
    json_mode: bool = False,
) -> Optional[str]:
    """Call LLM with automatic fallback chain (Mistral → DeepSeek)."""
    result = await llm_complete(
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=120,
        json_mode=json_mode,
    )
    if result:
        if result.fallback_used:
            logger.info("[DEBATE] Used fallback: %s:%s", result.provider, result.model_used)
        return result.content
    logger.error("[DEBATE] All LLM providers failed")
    return None


async def _call_magistral(
    messages: list,
    temperature: float = 0.3,
    max_tokens: int = 4096,
    json_mode: bool = False,
    timeout: float = 180,
) -> Optional[str]:
    """Call Magistral (raisonnement chain-of-thought) avec fallback Mistral.

    Magistral est invoqué via la même API Mistral (`magistral-medium-2509`).
    En cas d'erreur 429/5xx, llm_complete() bascule automatiquement sur la
    chaîne MISTRAL_FALLBACK_ORDER (small → medium → large → DeepSeek).

    Sprint Débat IA v2 — utilisé pour l'analyse comparative entre vidéo A
    et chaque perspective B/B'/B''.
    """
    result = await llm_complete(
        messages=messages,
        model=MAGISTRAL_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=timeout,
        json_mode=json_mode,
    )
    if result:
        if result.fallback_used:
            logger.info(
                "[DEBATE/MAGISTRAL] Used fallback: %s:%s",
                result.provider,
                result.model_used,
            )
        return result.content
    logger.error("[DEBATE/MAGISTRAL] All LLM providers failed")
    return None


async def _call_perplexity(query: str, context: str = "") -> Optional[str]:
    """Recherche web (Brave+Mistral) pour fact-checking. Nom gardé pour compat."""
    try:
        result = await web_search_and_synthesize(
            query=query, context=context, purpose="debate", lang="fr", max_sources=5, max_tokens=1500
        )
        if result.success:
            return result.content
        return None
    except Exception as e:
        logger.warning(f"[WEB_SEARCH] Debate fact-check failed: {e}")
        return None


def _extract_json(raw: str) -> Optional[dict]:
    """Extract JSON from Mistral response, handling markdown code blocks and extra text."""
    if not raw:
        return None
    clean = raw.strip()

    # Try 1: Direct JSON parse
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Try 2: Extract from ```json ... ``` code block
    json_block = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", clean, re.DOTALL)
    if json_block:
        try:
            return json.loads(json_block.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try 3: Find first { ... } block (greedy)
    brace_match = re.search(r"\{.*\}", clean, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    return None


async def _brave_youtube_search(query: str, brave_key: str, count: int = 10) -> list:
    """Run a Brave web search restricted to YouTube and return the raw results list."""
    try:
        async with shared_http_client() as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"X-Subscription-Token": brave_key, "Accept": "application/json"},
                params={"q": f"site:youtube.com {query}", "count": count},
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json().get("web", {}).get("results", [])
    except Exception as e:
        logger.warning("Brave Search failed for query %r: %s", query[:80], str(e)[:200])
        return []


def _pick_distinct_youtube(
    results: list,
    exclude_ids: set,
    exclude_channel: Optional[str] = None,
) -> Optional[Dict[str, str]]:
    """Pick the first YouTube result whose video_id is not in exclude_ids."""
    yt_pattern = re.compile(r"youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})")
    # First pass: exclude same video AND same channel
    # Second pass: only exclude same video (fallback if all results are from same channel)
    for strict in (True, False):
        for result in results:
            url = result.get("url", "")
            match = yt_pattern.search(url)
            if not match:
                continue
            video_id = match.group(1)
            if video_id in exclude_ids:
                continue

            raw_title = result.get("title", "")
            try:
                fixed_title = raw_title.encode("latin-1").decode("utf-8")
            except (UnicodeDecodeError, UnicodeEncodeError):
                fixed_title = raw_title

            # Brave often suffixes " - YouTube" — clean it up
            if fixed_title.endswith(" - YouTube"):
                fixed_title = fixed_title[: -len(" - YouTube")].strip()

            # On strict pass, skip results from same channel (description often contains channel)
            if strict and exclude_channel:
                description = (result.get("description", "") or "").lower()
                if exclude_channel.lower() in description:
                    continue

            logger.info("Opposing video candidate: %s — %s", video_id, fixed_title[:80])
            return {
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "title": fixed_title,
                "channel": "",
            }
        if not exclude_channel:
            break  # No point in second pass if we didn't filter on channel
    return None


async def _search_opposing_video(
    topic: str,
    thesis_a: str,
    video_a_id: str,
    video_a_title: Optional[str] = None,
    video_a_channel: Optional[str] = None,
    lang: str = "fr",
    model: str = "mistral-small-2603",
) -> Optional[Dict[str, str]]:
    """Find opposing YouTube video: Mistral generates search query → Brave Search finds YouTube results.

    The returned video is guaranteed to have a video_id different from video_a_id.
    """
    from core.config import get_brave_key

    brave_key = get_brave_key()
    if not brave_key:
        logger.warning("No Brave Search key for opposing video search")
        return None

    # Step 1: Ask Mistral for two distinct search queries to maximize chances of finding opposition
    lang_instruction = "Formule les requêtes en français." if lang == "fr" else "Write the queries in English."
    query_prompt = [
        {
            "role": "system",
            "content": (
                "Tu es un expert en recherche YouTube spécialisé dans l'identification de perspectives contradictoires. "
                "Ta mission : générer DEUX requêtes de recherche YouTube (5-10 mots chacune) susceptibles de retourner "
                "une vidéo qui CONTREDIT, CRITIQUE, ou OPPOSE la thèse donnée. "
                "Utilise des mots-clés antagonistes (par exemple : 'critique', 'problème', 'limite', 'contre', 'arnaque', "
                "'overrated', 'debunked', 'myth', 'issue', 'bad', 'vs') et NE REPRODUIS PAS le titre ni les mots-clés de la vidéo originale. "
                f"{lang_instruction} "
                "Réponds UNIQUEMENT en JSON valide : "
                '{"query_primary": "...", "query_alternative": "..."}'
            ),
        },
        {
            "role": "user",
            "content": (
                f"Sujet : {topic}\nThèse à contredire : {thesis_a}\nTitre à éviter : {video_a_title or '(inconnu)'}"
            ),
        },
    ]
    query_raw = await _call_mistral(query_prompt, model=model, temperature=0.6, json_mode=True)
    queries: list = []
    if query_raw:
        parsed = _extract_json(query_raw)
        if isinstance(parsed, dict):
            for key in ("query_primary", "query_alternative"):
                q = parsed.get(key)
                if isinstance(q, str) and q.strip():
                    queries.append(q.strip().strip('"').strip("'")[:100])

    # Fallback: if JSON parsing failed, treat raw as a single query
    if not queries and query_raw:
        queries.append(query_raw.strip().strip('"').strip("'")[:100])

    if not queries:
        logger.warning("Mistral failed to generate search queries for opposing video")
        return None

    exclude_ids = {video_a_id}
    logger.info("Opposing video search queries: %s", queries)

    # Step 2: Try each query in order, return the first distinct YouTube video found
    for query in queries:
        results = await _brave_youtube_search(query, brave_key, count=10)
        if not results:
            continue
        picked = _pick_distinct_youtube(results, exclude_ids, exclude_channel=video_a_channel)
        if picked:
            logger.info("Found opposing video via query %r: %s", query[:80], picked["url"])
            return picked

    logger.warning(
        "No distinct YouTube video found via Brave for queries %s (excluded=%s)",
        queries,
        exclude_ids,
    )
    return None


async def _search_perspective_video(
    topic: str,
    thesis_a: str,
    relation_type: str,
    video_a_id: str,
    video_a_title: Optional[str] = None,
    video_a_channel: Optional[str] = None,
    video_a_duration: int = 0,
    lang: str = "fr",
    excluded_video_ids: Optional[set] = None,
    user_plan: str = "free",
    db: Optional[AsyncSession] = None,
    model: str = "mistral-small-2603",
) -> Optional[Dict[str, str]]:
    """Wrapper qui route vers matching multi-critères avec fallback legacy.

    Délègue à matching.py qui fait scoring multi-critères (relation pondérée
    selon opposite/complement/nuance). Si matching renvoie None ou throw,
    fallback sur l'ancien `_search_opposing_video` pour relation='opposite'
    uniquement. Pour 'complement' / 'nuance' sans candidat → renvoie None.

    Retour : dict {url, title, channel} compatible legacy, ou None.
    """
    excluded_video_ids = excluded_video_ids or {video_a_id}

    try:
        candidate = await _real_search_perspective_video(
            topic=topic,
            thesis_a=thesis_a,
            relation_type=relation_type,
            video_a_id=video_a_id,
            video_a_title=video_a_title or "",
            video_a_channel=video_a_channel or "",
            video_a_duration=video_a_duration,
            lang=lang,
            excluded_video_ids=excluded_video_ids,
            user_plan=user_plan,
            db=db,
        )
        if candidate is None:
            return None
        return {
            "url": f"https://www.youtube.com/watch?v={candidate.video_id}",
            "title": candidate.title,
            "channel": candidate.channel,
            "platform": candidate.platform,
            "thumbnail": candidate.thumbnail,
            "channel_quality_score": candidate.channel_quality_score,
            "audience_level": candidate.audience_level,
        }
    except Exception as e:
        logger.warning(
            "[DEBATE] Real matching failed for relation=%s, falling back: %s",
            relation_type,
            e,
        )

    # Fallback legacy : seul 'opposite' est supporté par _search_opposing_video.
    if relation_type == "opposite":
        return await _search_opposing_video(
            topic=topic,
            thesis_a=thesis_a,
            video_a_id=video_a_id,
            video_a_title=video_a_title,
            video_a_channel=video_a_channel,
            lang=lang,
            model=model,
        )

    # Pas de matching réel pour complement/nuance sans matching.py
    logger.warning(
        "[DEBATE] No matching available for relation_type=%s without matching.py",
        relation_type,
    )
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 BACKGROUND TASK — Main debate analysis pipeline
# ═══════════════════════════════════════════════════════════════════════════════


async def _run_debate_pipeline(
    debate_id: int,
    video_a_id: str,
    video_b_id: Optional[str],
    platform_a: str,
    platform_b: Optional[str],
    user_id: int,
    user_plan: str,
    lang: str,
    mode: str,
):
    """
    Background task: runs the full debate analysis pipeline.

    Steps:
    1. Extract transcript for video A
    2. Detect topic + thesis A via Mistral
    3. If auto mode: search for opposing video B via Perplexity
    4. Extract transcript for video B
    5. Comparative analysis via Mistral (arguments, convergences, divergences)
    6. Fact-check via Perplexity
    7. Generate debate summary
    """
    # Select model based on plan
    plan_limits = PLAN_LIMITS.get(user_plan, PLAN_LIMITS["free"])
    model = plan_limits.get("default_model", "mistral-small-2603")

    async with async_session_maker() as session:
        try:
            # ── Step 1: Get video A info + transcript ──
            _debate_task_store[debate_id] = {"status": "pending", "message": "Extraction vidéo A..."}

            result = await session.execute(select(DebateAnalysis).where(DebateAnalysis.id == debate_id))
            debate = result.scalar_one_or_none()
            if not debate:
                logger.error("Debate %d not found in DB", debate_id)
                return

            debate.status = "pending"
            await session.commit()

            # Get video A info — YouTube or TikTok
            if platform_a == "tiktok":
                tiktok_url_a = f"https://www.tiktok.com/@user/video/{video_a_id}"
                video_a_info = await get_tiktok_video_info(tiktok_url_a)
            else:
                video_a_info = await get_video_info(video_a_id)

            if video_a_info:
                debate.video_a_title = video_a_info.get("title", "")[:500]
                debate.video_a_channel = video_a_info.get("channel", video_a_info.get("author", ""))[:255]
                thumb_a = video_a_info.get("thumbnail_url") or video_a_info.get("thumbnail") or ""
                if not thumb_a and platform_a == "youtube":
                    thumb_a = f"https://img.youtube.com/vi/{video_a_id}/maxresdefault.jpg"
                debate.video_a_thumbnail = thumb_a
                await session.commit()

            # Get transcript A — YouTube or TikTok
            if platform_a == "tiktok":
                tiktok_url_a = f"https://www.tiktok.com/@user/video/{video_a_id}"
                transcript_a_result = await get_tiktok_transcript(tiktok_url_a)
                transcript_a = (
                    transcript_a_result
                    if isinstance(transcript_a_result, str)
                    else (transcript_a_result[0] if transcript_a_result else None)
                )
                lang_a = "fr"
            else:
                transcript_a, _, lang_a = await get_transcript_with_timestamps(video_a_id)

            if not transcript_a:
                debate.status = "failed"
                debate.debate_summary = "Impossible de récupérer la transcription de la vidéo A."
                await session.commit()
                _debate_task_store[debate_id] = {"status": "failed", "message": "Transcription A échouée"}
                return

            # Truncate transcript to ~8000 chars for Mistral context
            transcript_a_short = transcript_a[:8000]

            # ── Step 2: Detect topic + thesis A via Mistral ──
            _debate_task_store[debate_id] = {"status": "pending", "message": "Détection du sujet et de la thèse A..."}

            topic_prompt = [
                {
                    "role": "system",
                    "content": (
                        "Tu es un analyste expert en argumentation. "
                        "Extrais le sujet principal et la thèse défendue dans cette transcription vidéo. "
                        "Réponds UNIQUEMENT en JSON valide avec le format : "
                        '{"topic": "...", "thesis": "...", "key_arguments": [{"claim": "...", "evidence": "...", "strength": "strong|moderate|weak"}, ...]}'
                    ),
                },
                {"role": "user", "content": f"Transcription de la vidéo :\n\n{transcript_a_short}"},
            ]

            topic_result = await _call_mistral(topic_prompt, model=model, json_mode=True)
            topic_data = _extract_json(topic_result) if topic_result else None
            if not topic_data:
                logger.warning("[DEBATE] Failed to parse topic detection, raw=%s", (topic_result or "")[:300])
                topic_data = {}

            detected_topic = topic_data.get("topic", "Sujet non détecté")
            thesis_a = topic_data.get("thesis", "Thèse non identifiée")
            arguments_a = topic_data.get("key_arguments", [])

            debate.detected_topic = detected_topic[:500]
            debate.thesis_a = thesis_a
            debate.arguments_a = json.dumps(arguments_a, ensure_ascii=False)
            await session.commit()

            # ── Step 3: Find opposing video (auto mode) ──
            actual_video_b_id = video_b_id
            actual_platform_b = platform_b

            if mode == "auto" and not video_b_id:
                _debate_task_store[debate_id] = {
                    "status": "searching",
                    "message": "Recherche d'un point de vue opposé...",
                }
                debate.status = "searching"
                await session.commit()

                # Sprint Débat IA v2 — multi-criteria matching via debate.matching.
                # Le legacy `_search_opposing_video` est remplacé par
                # `search_opposing_video_legacy_compat` (drop-in qui appelle
                # `_search_perspective_video(..., relation='opposite', ...)` sous
                # le capot, conserve le shape de retour {url, title, channel}).
                from debate.matching import search_opposing_video_legacy_compat

                opposing = await search_opposing_video_legacy_compat(
                    topic=detected_topic,
                    thesis_a=thesis_a,
                    video_a_id=video_a_id,
                    video_a_title=debate.video_a_title,
                    video_a_channel=debate.video_a_channel,
                    lang=lang,
                    model=model,
                    user_plan=user_plan,
                    db=session,
                )
                if opposing and opposing.get("url"):
                    try:
                        actual_platform_b, actual_video_b_id = extract_video_id(opposing["url"])
                        # Final safety net: never let video B equal video A
                        if actual_video_b_id == video_a_id:
                            logger.warning(
                                "Opposing video matched video A (%s), discarding",
                                video_a_id,
                            )
                            actual_video_b_id = None
                        else:
                            debate.video_b_id = actual_video_b_id
                            debate.video_b_title = opposing.get("title", "")[:500]
                            debate.video_b_channel = opposing.get("channel", "")[:255]
                            debate.platform_b = actual_platform_b
                            await session.commit()
                    except ValueError:
                        logger.warning("Invalid opposing video URL: %s", opposing.get("url"))

            if not actual_video_b_id:
                # Auto-search failed — complete with only video A analysis
                debate.status = "completed"
                debate.debate_summary = (
                    f"Analyse partielle : seule la vidéo A a pu être analysée.\n\n"
                    f"Sujet : {detected_topic}\n"
                    f"Thèse A : {thesis_a}\n\n"
                    f"Aucune vidéo opposée n'a pu être trouvée automatiquement. "
                    f"Essayez le mode manuel en fournissant deux URLs."
                )
                debate.model_used = model
                debate.credits_used = 5
                await session.commit()

                # 🎨 Fire-and-forget avatar gen (partial debate — topic is known)
                try:
                    from voice.avatar import ensure_debate_avatar

                    ensure_debate_avatar(debate)
                except Exception as _avatar_err:
                    logger.warning("Debate avatar kickoff failed: %s", _avatar_err)

                await deduct_credits(session, user_id, 5, "debate", f"Débat partiel: {detected_topic[:50]}")
                _debate_task_store[debate_id] = {"status": "completed", "message": "Analyse partielle terminée"}
                return

            # ── Step 4: Get video B transcript ──
            _debate_task_store[debate_id] = {"status": "analyzing_b", "message": "Analyse de la vidéo opposée..."}

            # Determine platform B (auto-discovered videos are always YouTube from Brave Search)
            actual_platform_b = getattr(debate, "platform_b", None) or platform_b or "youtube"

            if actual_platform_b == "tiktok":
                tiktok_url_b = f"https://www.tiktok.com/@user/video/{actual_video_b_id}"
                video_b_info = await get_tiktok_video_info(tiktok_url_b)
            else:
                video_b_info = await get_video_info(actual_video_b_id)

            if video_b_info:
                if not debate.video_b_title:
                    debate.video_b_title = video_b_info.get("title", "")[:500]
                if not debate.video_b_channel:
                    debate.video_b_channel = video_b_info.get("channel", video_b_info.get("author", ""))[:255]
                thumb_b = video_b_info.get("thumbnail_url") or video_b_info.get("thumbnail") or ""
                if not thumb_b and actual_platform_b == "youtube":
                    thumb_b = f"https://img.youtube.com/vi/{actual_video_b_id}/maxresdefault.jpg"
                debate.video_b_thumbnail = thumb_b
                await session.commit()

            # Get transcript B — YouTube or TikTok
            if actual_platform_b == "tiktok":
                tiktok_url_b = f"https://www.tiktok.com/@user/video/{actual_video_b_id}"
                transcript_b_result = await get_tiktok_transcript(tiktok_url_b)
                transcript_b = (
                    transcript_b_result
                    if isinstance(transcript_b_result, str)
                    else (transcript_b_result[0] if transcript_b_result else None)
                )
            else:
                transcript_b, _, _ = await get_transcript_with_timestamps(actual_video_b_id)

            if not transcript_b:
                debate.status = "failed"
                debate.debate_summary = "Impossible de récupérer la transcription de la vidéo B."
                await session.commit()
                _debate_task_store[debate_id] = {"status": "failed", "message": "Transcription B échouée"}
                return

            transcript_b_short = transcript_b[:8000]

            # ── Step 5: Comparative analysis via Magistral ──
            # Sprint v2 : on utilise magistral-medium-2509 (chain-of-thought reasoning)
            # au lieu de mistral-small/medium pour l'analyse comparative.
            _debate_task_store[debate_id] = {"status": "comparing", "message": "Analyse comparative (Magistral)..."}
            debate.status = "comparing"
            await session.commit()

            compare_prompt = [
                {
                    "role": "system",
                    "content": (
                        "Tu es un analyste expert en argumentation et en pensée critique. "
                        "Compare les deux vidéos ci-dessous de manière équilibrée et nuancée. "
                        f"Langue de réponse : {lang}. "
                        "Réponds UNIQUEMENT en JSON valide avec ce format :\n"
                        "{\n"
                        '  "thesis_b": "Thèse défendue par la vidéo B",\n'
                        '  "arguments_b": [{"claim": "...", "evidence": "...", "strength": "strong|moderate|weak"}, ...],\n'
                        '  "convergence_points": ["point commun 1", "point commun 2"],\n'
                        '  "divergence_points": [{"topic": "sujet du désaccord", "position_a": "position vidéo A", "position_b": "position vidéo B"}, ...],\n'
                        '  "summary": "Synthèse nuancée du débat en 3-5 paragraphes"\n'
                        "}"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"SUJET : {detected_topic}\n\n"
                        f"=== VIDÉO A : {debate.video_a_title} ===\n"
                        f"Thèse : {thesis_a}\n"
                        f"Transcription :\n{transcript_a_short}\n\n"
                        f"=== VIDÉO B : {debate.video_b_title} ===\n"
                        f"Transcription :\n{transcript_b_short}"
                    ),
                },
            ]

            # Retry up to 2 times if Magistral returns invalid JSON
            compare_data = None
            for attempt in range(2):
                compare_result = await _call_magistral(
                    compare_prompt, temperature=0.3, max_tokens=4096, json_mode=True
                )
                if not compare_result:
                    logger.warning("[DEBATE] Magistral returned None for comparison (attempt %d)", attempt + 1)
                    continue

                # With json_mode=True, should return pure JSON
                try:
                    compare_data = json.loads(compare_result)
                except json.JSONDecodeError as e:
                    logger.warning("[DEBATE] JSON decode error (attempt %d): %s", attempt + 1, str(e))
                    # Fallback to _extract_json for robustness
                    compare_data = _extract_json(compare_result)

                if compare_data and compare_data.get("thesis_b"):
                    logger.info(
                        "[DEBATE] Comparative analysis parsed OK (attempt %d), keys=%s",
                        attempt + 1,
                        list(compare_data.keys()),
                    )
                    break

                logger.warning(
                    "[DEBATE] Failed to parse comparison (attempt %d), raw response (%d chars), first 800: %s",
                    attempt + 1,
                    len(compare_result),
                    compare_result[:800],
                )
                compare_data = None

            if not compare_data:
                compare_data = {}
                logger.error("[DEBATE] All comparison attempts failed for debate_id=%d", debate_id)

            thesis_b = compare_data.get("thesis_b", "Thèse non identifiée")
            arguments_b = compare_data.get("arguments_b", [])
            convergence = compare_data.get("convergence_points", [])
            divergence_raw = compare_data.get("divergence_points", [])
            # Normalize divergence_points: ensure each item is a dict
            divergence = []
            for item in divergence_raw:
                if isinstance(item, dict):
                    divergence.append(item)
                elif isinstance(item, str):
                    divergence.append({"topic": item, "position_a": "", "position_b": ""})
            summary = compare_data.get("summary", "")

            # v2: arguments_b et thesis_b sont stockés sur DebatePerspective(position=0).
            # On garde aussi `debate.thesis_b` / `debate.arguments_b` en miroir pour
            # backward-compat (clients v1 qui lisent les colonnes legacy).
            debate.thesis_b = thesis_b
            debate.arguments_b = json.dumps(arguments_b, ensure_ascii=False)
            debate.convergence_points = json.dumps(convergence, ensure_ascii=False)
            debate.divergence_points = json.dumps(divergence, ensure_ascii=False)
            debate.debate_summary = summary
            await session.commit()

            # ── Step 6: Fact-check via Perplexity ──
            _debate_task_store[debate_id] = {"status": "fact_checking", "message": "Fact-checking croisé..."}
            debate.status = "fact_checking"
            await session.commit()

            fact_check_results = []
            from core.config import is_web_search_available

            if is_web_search_available():
                # Build a concise search query for web search (not the full JSON prompt)
                args_a_str = ", ".join(
                    a.get("claim", str(a)) if isinstance(a, dict) else str(a) for a in arguments_a[:3]
                )
                args_b_str = ", ".join(
                    a.get("claim", str(a)) if isinstance(a, dict) else str(a) for a in arguments_b[:3]
                )
                web_query = f"fact check: {detected_topic} — {thesis_a[:100]} vs {thesis_b[:100]}"
                fact_web_result = await _call_perplexity(web_query)

                # web_search_and_synthesize returns natural language, NOT JSON.
                # Use Mistral to structure the web search results into JSON format.
                structuring_prompt = [
                    {
                        "role": "system",
                        "content": (
                            "Tu es un fact-checker rigoureux. À partir du contexte de recherche web ci-dessous, "
                            "identifie 3 à 6 affirmations clés du débat et évalue leur véracité. "
                            "Le verdict DOIT être exactement : confirmed, nuanced, disputed, ou unverifiable. "
                            "Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour : "
                            '[{"claim": "...", "verdict": "confirmed|nuanced|disputed|unverifiable", "source": "...", "explanation": "..."}]'
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Sujet du débat : {detected_topic}\n"
                            f"Thèse A : {thesis_a}\n"
                            f"Thèse B : {thesis_b}\n"
                            f"Arguments A : {args_a_str}\n"
                            f"Arguments B : {args_b_str}\n\n"
                            f"Résultats de recherche web :\n{fact_web_result or 'Aucun résultat de recherche disponible.'}\n\n"
                            f"Produis le tableau JSON de fact-check."
                        ),
                    },
                ]
                structured_result = await _call_mistral(
                    structuring_prompt, model=model, temperature=0.2, json_mode=False
                )
                if structured_result:
                    parsed = _extract_json(structured_result)
                    if parsed is None:
                        # Try parsing as JSON array directly
                        array_match = re.search(r"\[.*\]", structured_result, re.DOTALL)
                        if array_match:
                            try:
                                parsed = json.loads(array_match.group(0))
                            except json.JSONDecodeError:
                                pass
                    if parsed is not None:
                        # Normalize to list
                        if isinstance(parsed, list):
                            fact_check_results = parsed
                        elif isinstance(parsed, dict) and "claims" in parsed:
                            fact_check_results = parsed["claims"]
                        elif isinstance(parsed, dict) and "fact_check" in parsed:
                            fact_check_results = parsed["fact_check"]
                        # Normalize verdicts to frontend-expected values
                        verdict_map = {
                            "vraie": "confirmed",
                            "vrai": "confirmed",
                            "confirmé": "confirmed",
                            "confirmed": "confirmed",
                            "true": "confirmed",
                            "partiellement vraie": "nuanced",
                            "nuancé": "nuanced",
                            "partially true": "nuanced",
                            "nuanced": "nuanced",
                            "fausse": "disputed",
                            "faux": "disputed",
                            "contesté": "disputed",
                            "disputed": "disputed",
                            "false": "disputed",
                            "non vérifiable": "unverifiable",
                            "invérifiable": "unverifiable",
                            "unverifiable": "unverifiable",
                            "unknown": "unverifiable",
                        }
                        for item in fact_check_results:
                            if isinstance(item, dict) and "verdict" in item:
                                v = item["verdict"].strip().lower()
                                item["verdict"] = verdict_map.get(
                                    v,
                                    v if v in ("confirmed", "nuanced", "disputed", "unverifiable") else "unverifiable",
                                )
                        logger.info(
                            "[DEBATE] Fact-check produced %d items for debate_id=%d", len(fact_check_results), debate_id
                        )
                    else:
                        logger.warning("[DEBATE] Failed to parse structured fact-check: %s", structured_result[:300])
                else:
                    logger.warning("[DEBATE] Mistral structuring call returned None for fact-check")

                # Fallback: if web search failed but Mistral is available, generate fact-check from context alone
                if not fact_check_results:
                    logger.info("[DEBATE] Fact-check fallback: generating from debate context without web search")
                    fallback_prompt = [
                        {
                            "role": "system",
                            "content": (
                                "Tu es un fact-checker. Analyse les affirmations de ce débat et évalue leur solidité "
                                "en te basant sur tes connaissances. Indique 'unverifiable' si tu n'es pas sûr. "
                                "Réponds UNIQUEMENT avec un tableau JSON : "
                                '[{"claim": "...", "verdict": "confirmed|nuanced|disputed|unverifiable", "source": "connaissances générales", "explanation": "..."}]'
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                f"Sujet : {detected_topic}\nThèse A : {thesis_a}\nThèse B : {thesis_b}\n"
                                f"Arguments A : {args_a_str}\nArguments B : {args_b_str}"
                            ),
                        },
                    ]
                    fallback_result = await _call_mistral(fallback_prompt, model=model, temperature=0.2)
                    if fallback_result:
                        fb_parsed = _extract_json(fallback_result)
                        if fb_parsed is None:
                            fb_array = re.search(r"\[.*\]", fallback_result, re.DOTALL)
                            if fb_array:
                                try:
                                    fb_parsed = json.loads(fb_array.group(0))
                                except json.JSONDecodeError:
                                    pass
                        if isinstance(fb_parsed, list):
                            fact_check_results = fb_parsed
                            for item in fact_check_results:
                                if isinstance(item, dict) and "verdict" in item:
                                    v = item["verdict"].strip().lower()
                                    item["verdict"] = verdict_map.get(
                                        v,
                                        v
                                        if v in ("confirmed", "nuanced", "disputed", "unverifiable")
                                        else "unverifiable",
                                    )
                            logger.info("[DEBATE] Fact-check fallback produced %d items", len(fact_check_results))

            debate.fact_check_results = json.dumps(fact_check_results, ensure_ascii=False)
            debate.model_used = model
            debate.credits_used = 5
            debate.status = "completed"
            await session.commit()

            # ── Step 6.5 (v2): Persist perspective B as DebatePerspective(position=0) ──
            # IDEMPOTENT : si une perspective position=0 existe déjà (par ex. backfill
            # alembic 017 sur un debate v1 qu'on retraite), on skip la création.
            existing_p0 = await session.execute(
                select(DebatePerspective).where(
                    DebatePerspective.debate_id == debate_id,
                    DebatePerspective.position == 0,
                )
            )
            if existing_p0.scalar_one_or_none() is None:
                try:
                    await _persist_perspective(
                        session=session,
                        debate_id=debate_id,
                        position=0,
                        video_id=actual_video_b_id,
                        platform=actual_platform_b,
                        video_title=debate.video_b_title or "",
                        video_channel=debate.video_b_channel or "",
                        video_thumbnail=debate.video_b_thumbnail or "",
                        thesis=thesis_b,
                        arguments=arguments_b,
                        relation_type="opposite",
                        fact_check_results=fact_check_results,
                    )
                    await session.commit()
                    logger.info(
                        "[DEBATE] Persisted perspective position=0 for debate_id=%d",
                        debate_id,
                    )
                except Exception as e:
                    logger.warning(
                        "[DEBATE] Failed to persist perspective position=0 for debate_id=%d: %s",
                        debate_id,
                        e,
                    )

            # Recalcule relation_type_dominant (avec une seule perspective opposée
            # → reste 'opposite', mais c'est l'invariant qu'on veut maintenir).
            try:
                await _recompute_relation_type_dominant(session, debate_id)
            except Exception as e:
                logger.warning("[DEBATE] Failed to recompute relation_type_dominant: %s", e)

            # 🎨 Fire-and-forget: generate dynamic avatar for the voice agent.
            # Reuses the keyword_images pipeline with cross-debate cache on topic.
            try:
                from voice.avatar import ensure_debate_avatar

                ensure_debate_avatar(debate)
            except Exception as _avatar_err:
                logger.warning("Debate avatar kickoff failed: %s", _avatar_err)

            # Deduct credits
            await deduct_credits(
                session,
                user_id,
                5,
                "debate",
                f"Débat: {detected_topic[:50]}",
                metadata={"debate_id": debate_id, "model": model},
            )

            _debate_task_store[debate_id] = {"status": "completed", "message": "Débat terminé !"}
            logger.info(
                "Debate completed",
                extra={"debate_id": debate_id, "model": model, "user_id": user_id},
            )

        except Exception as e:
            logger.exception("Debate pipeline failed for debate_id=%d", debate_id)
            try:
                debate.status = "failed"
                debate.debate_summary = f"Erreur lors de l'analyse : {str(e)[:500]}"
                await session.commit()
            except Exception:
                logger.exception("Failed to update debate status to failed")
            _debate_task_store[debate_id] = {"status": "failed", "message": str(e)[:200]}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /create — Lancer un débat IA
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/create", response_model=DebateCreateResponse)
async def create_debate(
    request: DebateCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_credits(5)),
    db: AsyncSession = Depends(get_session),
):
    """
    Lance un débat IA entre deux perspectives vidéo.

    - Mode auto : fournir url_a seulement → l'IA recherche une vidéo opposée
    - Mode manual : fournir url_a + url_b → confrontation directe
    - Coût : 5 crédits
    """
    # Extract video IDs
    try:
        platform_a, video_a_id = extract_video_id(request.url_a)
    except ValueError:
        raise HTTPException(status_code=400, detail="URL de la vidéo A invalide")

    video_b_id = None
    platform_b = None
    mode = "auto"
    if request.url_b:
        try:
            platform_b, video_b_id = extract_video_id(request.url_b)
            mode = "manual"
        except ValueError:
            raise HTTPException(status_code=400, detail="URL de la vidéo B invalide")

    logger.info(
        "Debate creation requested",
        extra={"user_id": current_user.id, "mode": mode, "video_a": video_a_id},
    )

    # Create DB record
    debate = DebateAnalysis(
        user_id=current_user.id,
        video_a_id=video_a_id,
        video_b_id=video_b_id,
        status="pending",
        mode=mode,
        platform=request.platform,
        lang=request.lang,
        created_at=datetime.utcnow(),
    )
    db.add(debate)
    await db.flush()
    debate_id = debate.id
    await db.commit()

    # Launch background task
    _debate_task_store[debate_id] = {"status": "pending", "message": "Débat en file d'attente..."}

    background_tasks.add_task(
        _run_debate_pipeline,
        debate_id=debate_id,
        video_a_id=video_a_id,
        video_b_id=video_b_id,
        platform_a=platform_a,
        platform_b=platform_b,
        user_id=current_user.id,
        user_plan=current_user.plan or "free",
        lang=request.lang,
        mode=mode,
    )

    return DebateCreateResponse(debate_id=debate_id, status="pending")


# ═══════════════════════════════════════════════════════════════════════════════
# POST /{debate_id}/add-perspective — Ajouter complement|nuance (v2)
# ═══════════════════════════════════════════════════════════════════════════════


async def _run_add_perspective_pipeline(
    debate_id: int,
    relation_type: str,
    user_id: int,
):
    """Background pipeline pour ajouter une perspective B'/B'' à un débat existant.

    Réutilise _search_perspective_video + Magistral comparison + fact-check
    + _persist_perspective. Ne touche jamais aux colonnes legacy
    `debate_analyses.video_b_*` (ce sont des données figées de la perspective
    initiale = position 0).

    Crédits déduits uniquement si la perspective est persistée avec succès.
    """
    async with async_session_maker() as session:
        try:
            # ── 1. Fetch debate + user + existing perspectives ──
            result = await session.execute(
                select(DebateAnalysis).where(DebateAnalysis.id == debate_id)
            )
            debate = result.scalar_one_or_none()
            if not debate:
                logger.error(
                    "[DEBATE/add-perspective] Debate %d not found", debate_id
                )
                return

            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            if not user:
                logger.error(
                    "[DEBATE/add-perspective] User %d not found", user_id
                )
                return

            # Re-check max perspectives (race condition safety)
            existing = await _load_perspectives(session, debate_id)
            if len(existing) >= MAX_PERSPECTIVES_PER_DEBATE:
                logger.warning(
                    "[DEBATE/add-perspective] Max perspectives reached for debate=%d",
                    debate_id,
                )
                debate.status = "completed"
                await session.commit()
                return

            new_position = len(existing)
            excluded_video_ids = {debate.video_a_id} | {
                p.video_id for p in existing if p.video_id
            }

            # Determine model based on user plan
            plan_limits = PLAN_LIMITS.get(user.plan or "free", PLAN_LIMITS["free"])
            model = plan_limits.get("default_model", "mistral-small-2603")
            lang = debate.lang or "fr"
            topic = debate.detected_topic or ""
            thesis_a = debate.thesis_a or ""

            _debate_task_store[debate_id] = {
                "status": "searching",
                "message": f"Recherche d'une perspective {relation_type}...",
            }
            debate.status = "adding_perspective"
            await session.commit()

            # ── 2. Search perspective video (delegates to matching.py if merged) ──
            candidate = await _search_perspective_video(
                topic=topic,
                thesis_a=thesis_a,
                relation_type=relation_type,
                video_a_id=debate.video_a_id,
                video_a_title=debate.video_a_title,
                video_a_channel=debate.video_a_channel,
                lang=lang,
                excluded_video_ids=excluded_video_ids,
                user_plan=user.plan or "free",
                db=session,
                model=model,
            )

            if not candidate or not candidate.get("url"):
                logger.warning(
                    "[DEBATE/add-perspective] No %s perspective found for debate=%d",
                    relation_type,
                    debate_id,
                )
                debate.status = "completed"
                await session.commit()
                _debate_task_store[debate_id] = {
                    "status": "completed",
                    "message": f"Aucune perspective {relation_type} trouvée.",
                }
                return

            # Extract IDs / metadata
            try:
                cand_platform, cand_video_id = extract_video_id(candidate["url"])
            except ValueError:
                logger.warning(
                    "[DEBATE/add-perspective] Invalid candidate URL: %s",
                    candidate.get("url"),
                )
                debate.status = "completed"
                await session.commit()
                return

            # Safety: never duplicate video A or any existing perspective
            if cand_video_id in excluded_video_ids:
                logger.warning(
                    "[DEBATE/add-perspective] Candidate %s already in debate, skipping",
                    cand_video_id,
                )
                debate.status = "completed"
                await session.commit()
                return

            cand_title = candidate.get("title", "")
            cand_channel = candidate.get("channel", "")
            cand_thumbnail = candidate.get("thumbnail", "") or (
                f"https://img.youtube.com/vi/{cand_video_id}/maxresdefault.jpg"
                if cand_platform == "youtube"
                else ""
            )
            cand_quality = candidate.get("channel_quality_score", 0.5)
            cand_audience = candidate.get("audience_level", "unknown")

            # ── 3. Fetch transcript for the new perspective ──
            _debate_task_store[debate_id] = {
                "status": "analyzing_b",
                "message": f"Analyse de la perspective {relation_type}...",
            }

            if cand_platform == "tiktok":
                tiktok_url = f"https://www.tiktok.com/@user/video/{cand_video_id}"
                transcript_result = await get_tiktok_transcript(tiktok_url)
                transcript = (
                    transcript_result
                    if isinstance(transcript_result, str)
                    else (transcript_result[0] if transcript_result else None)
                )
            else:
                transcript, _, _ = await get_transcript_with_timestamps(cand_video_id)

            if not transcript:
                logger.warning(
                    "[DEBATE/add-perspective] Could not fetch transcript for %s",
                    cand_video_id,
                )
                debate.status = "completed"
                await session.commit()
                _debate_task_store[debate_id] = {
                    "status": "completed",
                    "message": "Transcription introuvable pour la perspective.",
                }
                return

            transcript_short = transcript[:8000]

            # ── 4. Magistral comparison: A (debate) vs new perspective ──
            _debate_task_store[debate_id] = {
                "status": "comparing",
                "message": "Analyse comparative (Magistral)...",
            }

            relation_label = {
                "complement": "complète et enrichit",
                "nuance": "nuance (ni pour ni contre, conditionnel)",
            }.get(relation_type, "oppose")

            compare_prompt = [
                {
                    "role": "system",
                    "content": (
                        "Tu es un analyste expert en argumentation et en pensée critique. "
                        f"Compare la vidéo A et la vidéo B (qui {relation_label} la thèse A) "
                        "de manière équilibrée et nuancée. "
                        f"Langue de réponse : {lang}. "
                        "Réponds UNIQUEMENT en JSON valide avec ce format :\n"
                        "{\n"
                        '  "thesis_b": "Thèse défendue par la nouvelle perspective",\n'
                        '  "arguments_b": [{"claim": "...", "evidence": "...", "strength": "strong|moderate|weak"}, ...],\n'
                        '  "summary": "En 2-3 paragraphes : comment cette perspective '
                        + relation_label
                        + ' la thèse A."\n'
                        "}"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"SUJET : {topic}\n\n"
                        f"=== VIDÉO A : {debate.video_a_title} ===\n"
                        f"Thèse A : {thesis_a}\n\n"
                        f"=== NOUVELLE PERSPECTIVE ({relation_type.upper()}) : {cand_title} ===\n"
                        f"Transcription :\n{transcript_short}"
                    ),
                },
            ]

            compare_data = None
            for attempt in range(2):
                compare_result = await _call_magistral(
                    compare_prompt, temperature=0.3, max_tokens=4096, json_mode=True
                )
                if not compare_result:
                    continue
                try:
                    compare_data = json.loads(compare_result)
                except json.JSONDecodeError:
                    compare_data = _extract_json(compare_result)
                if compare_data and compare_data.get("thesis_b"):
                    break
                compare_data = None

            thesis_b = (compare_data or {}).get("thesis_b", "Thèse non identifiée")
            arguments_b = (compare_data or {}).get("arguments_b", [])

            # ── 5. Fact-check (best-effort, non-blocking) ──
            fact_check_results: List[Dict[str, Any]] = []
            try:
                from core.config import is_web_search_available

                if is_web_search_available():
                    args_str = ", ".join(
                        a.get("claim", str(a)) if isinstance(a, dict) else str(a)
                        for a in arguments_b[:3]
                    )
                    web_query = (
                        f"fact check {relation_type}: {topic} — {thesis_b[:100]}"
                    )
                    web_ctx = await _call_perplexity(web_query)
                    fc_prompt = [
                        {
                            "role": "system",
                            "content": (
                                "Tu es un fact-checker rigoureux. Analyse les affirmations "
                                "en te basant sur le contexte web. Verdict : confirmed, "
                                "nuanced, disputed, ou unverifiable. "
                                "Réponds UNIQUEMENT avec un tableau JSON valide : "
                                '[{"claim": "...", "verdict": "...", "source": "...", "explanation": "..."}]'
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                f"Sujet : {topic}\nThèse perspective : {thesis_b}\n"
                                f"Arguments : {args_str}\n\n"
                                f"Contexte web :\n{web_ctx or 'Aucun résultat.'}\n"
                            ),
                        },
                    ]
                    fc_raw = await _call_mistral(
                        fc_prompt, model=model, temperature=0.2, json_mode=False
                    )
                    if fc_raw:
                        parsed = _extract_json(fc_raw)
                        if parsed is None:
                            arr = re.search(r"\[.*\]", fc_raw, re.DOTALL)
                            if arr:
                                try:
                                    parsed = json.loads(arr.group(0))
                                except json.JSONDecodeError:
                                    pass
                        if isinstance(parsed, list):
                            fact_check_results = parsed
            except Exception as e:
                logger.warning(
                    "[DEBATE/add-perspective] Fact-check failed (non-blocking): %s", e
                )

            # ── 6. Persist perspective + deduct credits ──
            try:
                await _persist_perspective(
                    session=session,
                    debate_id=debate_id,
                    position=new_position,
                    video_id=cand_video_id,
                    platform=cand_platform,
                    video_title=cand_title,
                    video_channel=cand_channel,
                    video_thumbnail=cand_thumbnail,
                    thesis=thesis_b,
                    arguments=arguments_b,
                    relation_type=relation_type,
                    channel_quality_score=cand_quality,
                    audience_level=cand_audience,
                    fact_check_results=fact_check_results,
                )
                await session.commit()
            except Exception as e:
                logger.exception(
                    "[DEBATE/add-perspective] Persist failed for debate=%d: %s",
                    debate_id,
                    e,
                )
                debate.status = "completed"
                await session.commit()
                return

            # Deduct credits only after successful persist
            await deduct_credits(
                session,
                user_id,
                ADD_PERSPECTIVE_CREDITS,
                "debate_add_perspective",
                f"Perspective {relation_type}: {topic[:50]}",
                metadata={
                    "debate_id": debate_id,
                    "relation_type": relation_type,
                    "position": new_position,
                },
            )

            # ── 7. Recompute relation_type_dominant + finalize status ──
            try:
                await _recompute_relation_type_dominant(session, debate_id)
            except Exception as e:
                logger.warning(
                    "[DEBATE/add-perspective] recompute dominant failed: %s", e
                )

            debate.status = "completed"
            await session.commit()

            _debate_task_store[debate_id] = {
                "status": "completed",
                "message": f"Perspective {relation_type} ajoutée !",
            }
            logger.info(
                "[DEBATE/add-perspective] Persisted position=%d relation=%s for debate=%d",
                new_position,
                relation_type,
                debate_id,
            )
        except Exception as e:
            logger.exception(
                "[DEBATE/add-perspective] Pipeline failed for debate=%d: %s",
                debate_id,
                e,
            )
            try:
                # Best-effort revert status
                result = await session.execute(
                    select(DebateAnalysis).where(DebateAnalysis.id == debate_id)
                )
                d = result.scalar_one_or_none()
                if d:
                    d.status = "completed"
                    await session.commit()
            except Exception:
                pass
            _debate_task_store[debate_id] = {
                "status": "failed",
                "message": str(e)[:200],
            }


@router.post("/{debate_id}/add-perspective", response_model=DebateResultResponse)
async def add_perspective(
    debate_id: int,
    request: AddPerspectiveRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Ajoute une perspective complémentaire ou nuancée à un débat existant.

    Sprint Débat IA v2 :
      - Coût : ADD_PERSPECTIVE_CREDITS (3 crédits, déduits après persist OK)
      - Limite : MAX_PERSPECTIVES_PER_DEBATE (3 perspectives max par débat)
      - Plan : pro ou expert (free → 403)
      - relation_type : 'complement' ou 'nuance' uniquement (utiliser /create
        pour la perspective initiale 'opposite')
    """
    # 1. Validate relation_type — Pydantic Literal couvre déjà, double-check au cas où.
    if request.relation_type not in ("complement", "nuance"):
        raise HTTPException(
            status_code=400,
            detail="relation_type must be 'complement' or 'nuance' (use /create for 'opposite')",
        )

    # 2. Fetch debate + ownership
    debate = await _get_debate_owned(db, debate_id, current_user.id)

    # 3. Plan check (debate gated to pro+)
    raw_plan = (current_user.plan or "free").lower()
    if raw_plan == "free" and not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "plan_required",
                "message": "Debate add-perspective requires Pro or Expert plan",
                "required": "pro",
            },
        )

    # 4. Credits check
    credits = current_user.credits or 0
    if credits < ADD_PERSPECTIVE_CREDITS and not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "insufficient_credits",
                "message": f"Need {ADD_PERSPECTIVE_CREDITS} credits, you have {credits}",
                "credits": credits,
                "required": ADD_PERSPECTIVE_CREDITS,
            },
        )

    # 5. Max perspectives check
    perspectives = await _load_perspectives(db, debate_id)
    if len(perspectives) >= MAX_PERSPECTIVES_PER_DEBATE:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "max_perspectives_reached",
                "message": f"Max {MAX_PERSPECTIVES_PER_DEBATE} perspectives per debate reached",
                "current": len(perspectives),
                "max": MAX_PERSPECTIVES_PER_DEBATE,
            },
        )

    # 6. Mark debate as adding_perspective + launch background task
    debate.status = "adding_perspective"
    await db.commit()

    _debate_task_store[debate_id] = {
        "status": "adding_perspective",
        "message": f"Perspective {request.relation_type} en cours...",
    }

    background_tasks.add_task(
        _run_add_perspective_pipeline,
        debate_id=debate_id,
        relation_type=request.relation_type,
        user_id=current_user.id,
    )

    # 7. Return current state (perspectives reloaded)
    await db.refresh(debate)
    return await _build_debate_response(db, debate)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /status/{debate_id} — Poll status
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/status/{debate_id}", response_model=DebateStatusResponse)
async def get_debate_status(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Récupère le statut d'un débat en cours.
    Statuts : pending → searching → analyzing_b → comparing → fact_checking → completed/failed
    """
    debate = await _get_debate_owned(db, debate_id, current_user.id)

    # Check in-memory task store first (more recent status)
    task_info = _debate_task_store.get(debate_id)
    if task_info:
        status = task_info.get("status", debate.status)
        message = task_info.get("message", STATUS_MESSAGES.get(status, ""))
    else:
        status = debate.status
        message = STATUS_MESSAGES.get(status, "")

    return DebateStatusResponse(
        debate_id=debate_id,
        status=status,
        progress_message=message,
        video_a_id=debate.video_a_id,
        video_b_id=debate.video_b_id,
        video_a_title=debate.video_a_title,
        video_b_title=debate.video_b_title,
        video_a_channel=debate.video_a_channel,
        video_b_channel=debate.video_b_channel,
        video_a_thumbnail=debate.video_a_thumbnail,
        video_b_thumbnail=debate.video_b_thumbnail,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /history — Liste des débats de l'utilisateur (paginé)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/history", response_model=DebateHistoryResponse)
async def get_debate_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Liste paginée des débats de l'utilisateur, triés par date décroissante."""
    offset = (page - 1) * limit

    # Count total
    count_result = await db.execute(
        select(func.count(DebateAnalysis.id)).where(DebateAnalysis.user_id == current_user.id)
    )
    total = count_result.scalar() or 0

    # Fetch page
    result = await db.execute(
        select(DebateAnalysis)
        .where(DebateAnalysis.user_id == current_user.id)
        .order_by(DebateAnalysis.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    debates = result.scalars().all()

    items = [
        DebateListItem(
            id=d.id,
            detected_topic=d.detected_topic,
            video_a_title=d.video_a_title,
            video_b_title=d.video_b_title,
            video_a_thumbnail=d.video_a_thumbnail,
            video_b_thumbnail=d.video_b_thumbnail,
            status=d.status,
            created_at=d.created_at or datetime.utcnow(),
        )
        for d in debates
    ]

    return DebateHistoryResponse(debates=items, total=total)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /{debate_id} — Résultat complet d'un débat
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/{debate_id}", response_model=DebateResultResponse)
async def get_debate_result(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Récupère le résultat complet d'un débat terminé.

    v2: charge les perspectives 1-N. Pour rétro-compat, les champs `video_b_*`
    et `thesis_b` / `arguments_b` à la racine reflètent toujours la perspective
    `position=0` (lue depuis `debate_perspectives`).
    """
    debate = await _get_debate_owned(db, debate_id, current_user.id)
    return await _build_debate_response(db, debate)


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /{debate_id} — Supprimer un débat
# ═══════════════════════════════════════════════════════════════════════════════


@router.delete("/{debate_id}")
async def delete_debate(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Supprime un débat et ses messages de chat associés."""
    debate = await _get_debate_owned(db, debate_id, current_user.id)

    await db.execute(delete(DebateChatMessage).where(DebateChatMessage.debate_id == debate_id))
    await db.delete(debate)
    await db.commit()

    # Cleanup task store
    _debate_task_store.pop(debate_id, None)

    return {"status": "deleted", "debate_id": debate_id}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /{debate_id}/generate-miro-board — Génération board Miro (Pro+)
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/{debate_id}/generate-miro-board")
async def generate_miro_board(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Génère un board Miro pour un débat (Pro+ uniquement).

    Workflow :
      1. Ownership check.
      2. Plan check : free → 403.
      3. Si miro_board_url existe déjà → return cached (idempotent).
      4. Charge perspectives + convergence/divergence.
      5. Appelle miro_service.generate_debate_board (REST API).
      6. Persist debate.miro_board_url + miro_board_id.
      7. Return {miro_board_url, miro_board_id, cached=False}.

    Erreurs :
      - 403 si user.plan = 'free' (debate gated to pro+).
      - 503 si MIRO_API_TOKEN absent en .env.production.
      - 502 si Miro REST API fail (réseau, rate limit, etc.).
    """
    # 1. Ownership
    debate = await _get_debate_owned(db, debate_id, current_user.id)

    # 2. Plan check (debate gated to pro+, miro embed inclus)
    raw_plan = (current_user.plan or "free").lower()
    if raw_plan == "free" and not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "plan_required",
                "message": "Miro board generation requires Pro or Expert plan",
                "required": "pro",
            },
        )

    # 3. Cache : board déjà généré → retourner directement
    if debate.miro_board_url and debate.miro_board_id:
        return {
            "miro_board_url": debate.miro_board_url,
            "miro_board_id": debate.miro_board_id,
            "cached": True,
        }

    # 4. Charge données (perspectives + convergences/divergences)
    from .miro_service import (
        MiroServiceError,
        _parse_json_field,
        generate_debate_board,
    )

    perspectives = await _load_perspectives(db, debate_id)
    convergence_points = _parse_json_field(debate.convergence_points)
    divergence_points = _parse_json_field(debate.divergence_points)

    # 5. Appel service
    try:
        board = await generate_debate_board(
            debate=debate,
            perspectives=perspectives,
            convergence_points=convergence_points,
            divergence_points=divergence_points,
        )
    except MiroServiceError as exc:
        msg = str(exc)
        # Token absent → 503 (config manquante côté serveur)
        if "MIRO_API_TOKEN not configured" in msg:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "miro_not_configured",
                    "message": "Miro intégration non configurée sur le serveur",
                },
            )
        # Sinon Miro upstream fail → 502
        logger.exception("[DEBATE] Miro board generation failed: %s", msg)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "miro_upstream_error",
                "message": "Échec de la génération du board Miro",
                "upstream": msg[:300],
            },
        )

    # 6. Persist
    debate.miro_board_url = board["view_link"]
    debate.miro_board_id = board["board_id"]
    await db.commit()

    return {
        "miro_board_url": debate.miro_board_url,
        "miro_board_id": debate.miro_board_id,
        "cached": False,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /chat — Chat avec contexte des 2 vidéos
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/chat", response_model=DebateChatMessageResponse)
async def debate_chat(
    request: DebateChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Chat contextuel dans le cadre d'un débat.
    Le contexte inclut les thèses, arguments et fact-check des 2 vidéos.
    """
    # 🛡️ Phase 2 — Mistral moderation sur le message utilisateur
    moderation = await moderate_text(request.message)
    if not moderation.allowed:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "content_policy_violation",
                "categories": moderation.flagged_categories,
            },
        )

    debate = await _get_debate_owned(db, request.debate_id, current_user.id)

    if debate.status != "completed":
        raise HTTPException(status_code=400, detail="Le débat n'est pas encore terminé")

    logger.info(
        "Debate chat message",
        extra={"user_id": current_user.id, "debate_id": request.debate_id},
    )

    # Build context from debate data
    context = (
        f"Sujet du débat : {debate.detected_topic}\n\n"
        f"Vidéo A ({debate.video_a_title}) — Thèse : {debate.thesis_a}\n"
        f"Arguments A : {debate.arguments_a}\n\n"
        f"Vidéo B ({debate.video_b_title}) — Thèse : {debate.thesis_b}\n"
        f"Arguments B : {debate.arguments_b}\n\n"
        f"Points de convergence : {debate.convergence_points}\n"
        f"Points de divergence : {debate.divergence_points}\n\n"
        f"Fact-check : {debate.fact_check_results}\n\n"
        f"Synthèse : {debate.debate_summary}"
    )

    # Get recent chat history for context
    history_result = await db.execute(
        select(DebateChatMessage)
        .where(
            DebateChatMessage.debate_id == request.debate_id,
            DebateChatMessage.user_id == current_user.id,
        )
        .order_by(DebateChatMessage.created_at.desc())
        .limit(10)
    )
    recent_messages = list(reversed(history_result.scalars().all()))

    # Build messages for Mistral
    messages = [
        {
            "role": "system",
            "content": (
                "Tu es un assistant expert en analyse de débats. "
                "Tu réponds aux questions de l'utilisateur en te basant sur le contexte du débat ci-dessous. "
                "Sois équilibré, nuancé et cite les arguments des deux côtés. "
                f"Langue : {debate.lang or 'fr'}.\n\n"
                f"CONTEXTE DU DÉBAT :\n{context}"
            ),
        },
    ]
    for msg in recent_messages:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    # Select model based on plan
    plan_limits = PLAN_LIMITS.get(current_user.plan or "free", PLAN_LIMITS["free"])
    model = plan_limits.get("default_model", "mistral-small-2603")

    response_text = await _call_mistral(messages, model=model, temperature=0.5)
    if not response_text:
        response_text = "Erreur : impossible de contacter l'IA. Réessayez dans quelques instants."

    # Save user message + assistant response
    user_msg = DebateChatMessage(
        debate_id=request.debate_id,
        user_id=current_user.id,
        role="user",
        content=request.message,
        created_at=datetime.utcnow(),
    )
    assistant_msg = DebateChatMessage(
        debate_id=request.debate_id,
        user_id=current_user.id,
        role="assistant",
        content=response_text,
        created_at=datetime.utcnow(),
    )
    db.add(user_msg)
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return DebateChatMessageResponse(
        id=assistant_msg.id,
        debate_id=assistant_msg.debate_id,
        role="assistant",
        content=response_text,
        created_at=assistant_msg.created_at or datetime.utcnow(),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /chat/history/{debate_id} — Historique chat débat
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/chat/history/{debate_id}")
async def get_debate_chat_history(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Récupère l'historique des messages de chat pour un débat."""
    # Verify ownership
    await _get_debate_owned(db, debate_id, current_user.id)

    result = await db.execute(
        select(DebateChatMessage)
        .where(
            DebateChatMessage.debate_id == debate_id,
            DebateChatMessage.user_id == current_user.id,
        )
        .order_by(DebateChatMessage.created_at.asc())
    )
    messages = result.scalars().all()

    return {
        "debate_id": debate_id,
        "messages": [
            DebateChatMessageResponse(
                id=m.id,
                debate_id=m.debate_id,
                role=m.role,
                content=m.content,
                created_at=m.created_at or datetime.utcnow(),
            ).model_dump()
            for m in messages
        ],
    }
