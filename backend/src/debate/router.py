"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎭 DEBATE ROUTER — Confrontation IA de perspectives vidéo                        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  POST   /api/debate/create              — Lancer un débat                         ║
║  GET    /api/debate/status/{debate_id}  — Poll status                             ║
║  GET    /api/debate/{debate_id}         — Résultat complet                        ║
║  GET    /api/debate/history             — Liste des débats (paginé)               ║
║  DELETE /api/debate/{debate_id}         — Supprimer un débat                      ║
║  POST   /api/debate/chat               — Chat avec contexte des 2 vidéos         ║
║  GET    /api/debate/chat/history/{id}   — Historique chat débat                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, require_credits
from core.config import get_mistral_key, PLAN_LIMITS
from core.llm_provider import llm_complete
from videos.web_search_provider import web_search_and_synthesize, WebSearchResult
from core.credits import deduct_credits
from db.database import (
    DebateAnalysis,
    DebateChatMessage,
    User,
    async_session_maker,
    get_session,
)
from utils.video_id import extract_video_id
from transcripts.youtube import get_video_info, get_transcript_with_timestamps
from transcripts.tiktok import get_tiktok_video_info, get_tiktok_transcript

from .schemas import (
    DebateChatMessageResponse,
    DebateChatRequest,
    DebateChatResponse,
    DebateCreateRequest,
    DebateCreateResponse,
    DebateHistoryResponse,
    DebateListItem,
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
    "completed": "Débat terminé !",
    "failed": "Échec de l'analyse.",
}

MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
# PERPLEXITY_CHAT_URL supprimé — migré vers web_search_provider


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


def _debate_to_result(debate: DebateAnalysis) -> DebateResultResponse:
    """Convert a DebateAnalysis ORM object to a DebateResultResponse."""
    return DebateResultResponse(
        id=debate.id,
        video_a_id=debate.video_a_id,
        video_b_id=debate.video_b_id,
        platform_a=getattr(debate, 'platform_a', None) or "youtube",
        platform_b=getattr(debate, 'platform_b', None),
        video_a_title=debate.video_a_title or "Vidéo A",
        video_b_title=debate.video_b_title,
        video_a_channel=debate.video_a_channel,
        video_b_channel=debate.video_b_channel,
        video_a_thumbnail=debate.video_a_thumbnail,
        video_b_thumbnail=debate.video_b_thumbnail,
        detected_topic=debate.detected_topic,
        thesis_a=debate.thesis_a,
        thesis_b=debate.thesis_b,
        arguments_a=_parse_json_field(debate.arguments_a),
        arguments_b=_parse_json_field(debate.arguments_b),
        convergence_points=_parse_json_field(debate.convergence_points),
        divergence_points=_parse_json_field(debate.divergence_points),
        fact_check_results=_normalize_fact_check(debate.fact_check_results),
        debate_summary=debate.debate_summary,
        status=debate.status,
        mode=debate.mode or "auto",
        model_used=debate.model_used,
        credits_used=debate.credits_used or 0,
        lang=debate.lang or "fr",
        created_at=debate.created_at or datetime.utcnow(),
        updated_at=debate.updated_at,
    )


async def _get_debate_owned(
    db: AsyncSession, debate_id: int, user_id: int
) -> DebateAnalysis:
    """Fetch a debate, verify ownership, raise 404/403."""
    result = await db.execute(
        select(DebateAnalysis).where(DebateAnalysis.id == debate_id)
    )
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
    )
    if result:
        if result.fallback_used:
            logger.info("[DEBATE] Used fallback: %s:%s", result.provider, result.model_used)
        return result.content
    logger.error("[DEBATE] All LLM providers failed")
    return None


async def _call_perplexity(query: str, context: str = "") -> Optional[str]:
    """Recherche web (Brave+Mistral) pour fact-checking. Nom gardé pour compat."""
    try:
        result = await web_search_and_synthesize(
            query=query,
            context=context,
            purpose="debate",
            lang="fr",
            max_sources=5,
            max_tokens=1500
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


async def _search_opposing_video(
    topic: str, thesis_a: str, lang: str = "fr", model: str = "mistral-small-2603"
) -> Optional[Dict[str, str]]:
    """Find opposing YouTube video: Mistral generates search query → Brave Search finds YouTube results."""
    from core.config import get_brave_key

    brave_key = get_brave_key()
    if not brave_key:
        logger.warning("No Brave Search key for opposing video search")
        return None

    # Step 1: Ask Mistral for optimal YouTube search query
    query_prompt = [
        {"role": "system", "content": (
            "Tu es un expert en recherche YouTube. "
            "Génère une requête de recherche YouTube (5-10 mots) pour trouver une vidéo "
            "qui défend un point de vue OPPOSÉ à la thèse ci-dessous. "
            "Réponds UNIQUEMENT avec la requête, sans guillemets ni explication."
        )},
        {"role": "user", "content": f"Sujet : {topic}\nThèse à contredire : {thesis_a}"},
    ]
    search_query = await _call_mistral(query_prompt, model=model, temperature=0.5)
    if not search_query:
        logger.warning("Mistral failed to generate search query for opposing video")
        return None
    search_query = search_query.strip().strip('"').strip("'")[:100]
    logger.info("Opposing video search query: %s", search_query)

    # Step 2: Search YouTube via Brave Search API
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"X-Subscription-Token": brave_key, "Accept": "application/json"},
                params={"q": f"site:youtube.com {search_query}", "count": 5},
            )
            resp.raise_for_status()
            results = resp.json().get("web", {}).get("results", [])
    except Exception as e:
        logger.warning("Brave Search failed for opposing video: %s", str(e)[:200])
        return None

    # Step 3: Extract first YouTube video URL
    yt_pattern = re.compile(r"youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})")
    for result in results:
        url = result.get("url", "")
        match = yt_pattern.search(url)
        if match:
            video_id = match.group(1)
            # Fix UTF-8 encoding: Brave sometimes returns double-encoded strings
            raw_title = result.get("title", "")
            try:
                # Attempt to fix mojibake (e.g. "EnquÃªte" → "Enquête")
                fixed_title = raw_title.encode("latin-1").decode("utf-8")
            except (UnicodeDecodeError, UnicodeEncodeError):
                fixed_title = raw_title
            logger.info("Found opposing video: %s — %s", video_id, fixed_title)
            return {
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "title": fixed_title,
                "channel": "",
            }

    logger.warning("No YouTube video found via Brave for query: %s", search_query)
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

            result = await session.execute(
                select(DebateAnalysis).where(DebateAnalysis.id == debate_id)
            )
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
                transcript_a = transcript_a_result if isinstance(transcript_a_result, str) else (transcript_a_result[0] if transcript_a_result else None)
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
                {"role": "system", "content": (
                    "Tu es un analyste expert en argumentation. "
                    "Extrais le sujet principal et la thèse défendue dans cette transcription vidéo. "
                    "Réponds UNIQUEMENT en JSON valide avec le format : "
                    '{"topic": "...", "thesis": "...", "key_arguments": [{"claim": "...", "evidence": "...", "strength": "strong|moderate|weak"}, ...]}'
                )},
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
                _debate_task_store[debate_id] = {"status": "searching", "message": "Recherche d'un point de vue opposé..."}
                debate.status = "searching"
                await session.commit()

                opposing = await _search_opposing_video(detected_topic, thesis_a, lang)
                if opposing and opposing.get("url"):
                    try:
                        actual_platform_b, actual_video_b_id = extract_video_id(opposing["url"])
                        debate.video_b_id = actual_video_b_id
                        debate.video_b_title = opposing.get("title", "")[:500]
                        debate.video_b_channel = opposing.get("channel", "")[:255]
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

                await deduct_credits(session, user_id, 5, "debate", f"Débat partiel: {detected_topic[:50]}")
                _debate_task_store[debate_id] = {"status": "completed", "message": "Analyse partielle terminée"}
                return

            # ── Step 4: Get video B transcript ──
            _debate_task_store[debate_id] = {"status": "analyzing_b", "message": "Analyse de la vidéo opposée..."}

            # Determine platform B (auto-discovered videos are always YouTube from Brave Search)
            actual_platform_b = getattr(debate, 'platform_b', None) or platform_b or "youtube"

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
                transcript_b = transcript_b_result if isinstance(transcript_b_result, str) else (transcript_b_result[0] if transcript_b_result else None)
            else:
                transcript_b, _, _ = await get_transcript_with_timestamps(actual_video_b_id)

            if not transcript_b:
                debate.status = "failed"
                debate.debate_summary = "Impossible de récupérer la transcription de la vidéo B."
                await session.commit()
                _debate_task_store[debate_id] = {"status": "failed", "message": "Transcription B échouée"}
                return

            transcript_b_short = transcript_b[:8000]

            # ── Step 5: Comparative analysis via Mistral ──
            _debate_task_store[debate_id] = {"status": "comparing", "message": "Analyse comparative en cours..."}
            debate.status = "comparing"
            await session.commit()

            compare_prompt = [
                {"role": "system", "content": (
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
                )},
                {"role": "user", "content": (
                    f"SUJET : {detected_topic}\n\n"
                    f"=== VIDÉO A : {debate.video_a_title} ===\n"
                    f"Thèse : {thesis_a}\n"
                    f"Transcription :\n{transcript_a_short}\n\n"
                    f"=== VIDÉO B : {debate.video_b_title} ===\n"
                    f"Transcription :\n{transcript_b_short}"
                )},
            ]

            # Retry up to 2 times if Mistral returns invalid JSON
            compare_data = None
            for attempt in range(2):
                compare_result = await _call_mistral(
                    compare_prompt, model=model, temperature=0.3, max_tokens=4096, json_mode=True
                )
                if not compare_result:
                    logger.warning("[DEBATE] Mistral returned None for comparison (attempt %d)", attempt + 1)
                    continue

                # With json_mode=True, Mistral should return pure JSON
                try:
                    compare_data = json.loads(compare_result)
                except json.JSONDecodeError as e:
                    logger.warning("[DEBATE] JSON decode error (attempt %d): %s", attempt + 1, str(e))
                    # Fallback to _extract_json for robustness
                    compare_data = _extract_json(compare_result)

                if compare_data and compare_data.get("thesis_b"):
                    logger.info("[DEBATE] Comparative analysis parsed OK (attempt %d), keys=%s", attempt + 1, list(compare_data.keys()))
                    break

                logger.warning(
                    "[DEBATE] Failed to parse comparison (attempt %d), raw response (%d chars), first 800: %s",
                    attempt + 1, len(compare_result), compare_result[:800]
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
                args_a_str = ", ".join(a.get("claim", str(a)) if isinstance(a, dict) else str(a) for a in arguments_a[:3])
                args_b_str = ", ".join(a.get("claim", str(a)) if isinstance(a, dict) else str(a) for a in arguments_b[:3])
                web_query = f"fact check: {detected_topic} — {thesis_a[:100]} vs {thesis_b[:100]}"
                fact_web_result = await _call_perplexity(web_query)

                # web_search_and_synthesize returns natural language, NOT JSON.
                # Use Mistral to structure the web search results into JSON format.
                structuring_prompt = [
                    {"role": "system", "content": (
                        "Tu es un fact-checker rigoureux. À partir du contexte de recherche web ci-dessous, "
                        "identifie 3 à 6 affirmations clés du débat et évalue leur véracité. "
                        "Le verdict DOIT être exactement : confirmed, nuanced, disputed, ou unverifiable. "
                        "Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour : "
                        '[{"claim": "...", "verdict": "confirmed|nuanced|disputed|unverifiable", "source": "...", "explanation": "..."}]'
                    )},
                    {"role": "user", "content": (
                        f"Sujet du débat : {detected_topic}\n"
                        f"Thèse A : {thesis_a}\n"
                        f"Thèse B : {thesis_b}\n"
                        f"Arguments A : {args_a_str}\n"
                        f"Arguments B : {args_b_str}\n\n"
                        f"Résultats de recherche web :\n{fact_web_result or 'Aucun résultat de recherche disponible.'}\n\n"
                        f"Produis le tableau JSON de fact-check."
                    )},
                ]
                structured_result = await _call_mistral(structuring_prompt, model=model, temperature=0.2, json_mode=False)
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
                        verdict_map = {"vraie": "confirmed", "vrai": "confirmed", "confirmé": "confirmed",
                                       "confirmed": "confirmed", "true": "confirmed",
                                       "partiellement vraie": "nuanced", "nuancé": "nuanced",
                                       "partially true": "nuanced", "nuanced": "nuanced",
                                       "fausse": "disputed", "faux": "disputed", "contesté": "disputed",
                                       "disputed": "disputed", "false": "disputed",
                                       "non vérifiable": "unverifiable", "invérifiable": "unverifiable",
                                       "unverifiable": "unverifiable", "unknown": "unverifiable"}
                        for item in fact_check_results:
                            if isinstance(item, dict) and "verdict" in item:
                                v = item["verdict"].strip().lower()
                                item["verdict"] = verdict_map.get(v, v if v in ("confirmed", "nuanced", "disputed", "unverifiable") else "unverifiable")
                        logger.info("[DEBATE] Fact-check produced %d items for debate_id=%d", len(fact_check_results), debate_id)
                    else:
                        logger.warning("[DEBATE] Failed to parse structured fact-check: %s", structured_result[:300])
                else:
                    logger.warning("[DEBATE] Mistral structuring call returned None for fact-check")

                # Fallback: if web search failed but Mistral is available, generate fact-check from context alone
                if not fact_check_results:
                    logger.info("[DEBATE] Fact-check fallback: generating from debate context without web search")
                    fallback_prompt = [
                        {"role": "system", "content": (
                            "Tu es un fact-checker. Analyse les affirmations de ce débat et évalue leur solidité "
                            "en te basant sur tes connaissances. Indique 'unverifiable' si tu n'es pas sûr. "
                            "Réponds UNIQUEMENT avec un tableau JSON : "
                            '[{"claim": "...", "verdict": "confirmed|nuanced|disputed|unverifiable", "source": "connaissances générales", "explanation": "..."}]'
                        )},
                        {"role": "user", "content": (
                            f"Sujet : {detected_topic}\nThèse A : {thesis_a}\nThèse B : {thesis_b}\n"
                            f"Arguments A : {args_a_str}\nArguments B : {args_b_str}"
                        )},
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
                                    item["verdict"] = verdict_map.get(v, v if v in ("confirmed", "nuanced", "disputed", "unverifiable") else "unverifiable")
                            logger.info("[DEBATE] Fact-check fallback produced %d items", len(fact_check_results))

            debate.fact_check_results = json.dumps(fact_check_results, ensure_ascii=False)
            debate.model_used = model
            debate.credits_used = 5
            debate.status = "completed"
            await session.commit()

            # Deduct credits
            await deduct_credits(
                session, user_id, 5, "debate",
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
        select(func.count(DebateAnalysis.id)).where(
            DebateAnalysis.user_id == current_user.id
        )
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
    """Récupère le résultat complet d'un débat terminé."""
    debate = await _get_debate_owned(db, debate_id, current_user.id)
    return _debate_to_result(debate)


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

    await db.execute(
        delete(DebateChatMessage).where(DebateChatMessage.debate_id == debate_id)
    )
    await db.delete(debate)
    await db.commit()

    # Cleanup task store
    _debate_task_store.pop(debate_id, None)

    return {"status": "deleted", "debate_id": debate_id}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /chat — Chat avec contexte des 2 vidéos
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/chat", response_model=DebateChatResponse)
async def debate_chat(
    request: DebateChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Chat contextuel dans le cadre d'un débat.
    Le contexte inclut les thèses, arguments et fact-check des 2 vidéos.
    """
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
        {"role": "system", "content": (
            "Tu es un assistant expert en analyse de débats. "
            "Tu réponds aux questions de l'utilisateur en te basant sur le contexte du débat ci-dessous. "
            "Sois équilibré, nuancé et cite les arguments des deux côtés. "
            f"Langue : {debate.lang or 'fr'}.\n\n"
            f"CONTEXTE DU DÉBAT :\n{context}"
        )},
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

    return DebateChatResponse(response=response_text, sources=[])


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
