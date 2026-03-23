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
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, require_credits
from core.config import get_mistral_key, get_perplexity_key, PLAN_LIMITS
from core.credits import deduct_credits
from db.database import (
    DebateAnalysis,
    DebateChatMessage,
    User,
    async_session_maker,
    get_session,
)
from utils.video_id import extract_video_id

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
PERPLEXITY_CHAT_URL = "https://api.perplexity.ai/chat/completions"


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
        created_at=debate.created_at or datetime.now(timezone.utc),
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
    messages: list, model: str = "mistral-small-2603", temperature: float = 0.4
) -> Optional[str]:
    """Call Mistral AI chat completions API."""
    api_key = get_mistral_key()
    if not api_key:
        return None
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            MISTRAL_CHAT_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "top_p": 0.9,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _call_perplexity(query: str, context: str = "") -> Optional[str]:
    """Call Perplexity AI for fact-checking with web search."""
    api_key = get_perplexity_key()
    if not api_key:
        return None
    prompt = f"{query}\n\nContexte : {context}" if context else query
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            PERPLEXITY_CHAT_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "sonar",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _search_opposing_video(
    topic: str, thesis_a: str, lang: str = "fr"
) -> Optional[Dict[str, str]]:
    """Use Perplexity to find a YouTube video with an opposing viewpoint."""
    api_key = get_perplexity_key()
    if not api_key:
        return None

    search_prompt = (
        f"Trouve une vidéo YouTube qui défend un point de vue OPPOSÉ à cette thèse :\n"
        f"Sujet : {topic}\n"
        f"Thèse : {thesis_a}\n\n"
        f"Retourne UNIQUEMENT un JSON avec ce format exact (pas de texte autour) :\n"
        f'{{"url": "https://www.youtube.com/watch?v=...", "title": "...", "channel": "..."}}'
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            PERPLEXITY_CHAT_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "sonar",
                "messages": [{"role": "user", "content": search_prompt}],
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]

    # Try to parse JSON from the response
    try:
        # Handle markdown code blocks
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content.strip())
    except (json.JSONDecodeError, IndexError):
        logger.warning("Failed to parse opposing video search result: %s", content[:200])
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
    from transcripts.youtube import get_video_info, get_transcript_with_timestamps

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

            video_a_info = await get_video_info(video_a_id)
            if video_a_info:
                debate.video_a_title = video_a_info.get("title", "")[:500]
                debate.video_a_channel = video_a_info.get("channel", "")[:255]
                debate.video_a_thumbnail = video_a_info.get("thumbnail", "")
                await session.commit()

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

            topic_result = await _call_mistral(topic_prompt, model=model)
            topic_data = {}
            if topic_result:
                try:
                    clean = topic_result.strip()
                    if "```" in clean:
                        clean = clean.split("```")[1]
                        if clean.startswith("json"):
                            clean = clean[4:]
                    topic_data = json.loads(clean.strip())
                except (json.JSONDecodeError, IndexError):
                    logger.warning("Failed to parse topic detection: %s", topic_result[:200])

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
            _debate_task_store[debate_id] = {"status": "extracting", "message": "Extraction vidéo B..."}

            video_b_info = await get_video_info(actual_video_b_id)
            if video_b_info:
                if not debate.video_b_title:
                    debate.video_b_title = video_b_info.get("title", "")[:500]
                if not debate.video_b_channel:
                    debate.video_b_channel = video_b_info.get("channel", "")[:255]
                debate.video_b_thumbnail = video_b_info.get("thumbnail", "")
                await session.commit()

            transcript_b, _, _ = await get_transcript_with_timestamps(actual_video_b_id)
            if not transcript_b:
                debate.status = "failed"
                debate.debate_summary = "Impossible de récupérer la transcription de la vidéo B."
                await session.commit()
                _debate_task_store[debate_id] = {"status": "failed", "message": "Transcription B échouée"}
                return

            transcript_b_short = transcript_b[:8000]

            # ── Step 5: Comparative analysis via Mistral ──
            _debate_task_store[debate_id] = {"status": "analyzing", "message": "Analyse comparative en cours..."}
            debate.status = "analyzing"
            await session.commit()

            compare_prompt = [
                {"role": "system", "content": (
                    "Tu es un analyste expert en argumentation et en pensée critique. "
                    "Compare les deux vidéos ci-dessous de manière équilibrée et nuancée. "
                    f"Langue de réponse : {lang}. "
                    "Réponds UNIQUEMENT en JSON valide avec ce format :\n"
                    "{\n"
                    '  "thesis_b": "Thèse défendue par la vidéo B",\n'
                    '  "arguments_b": ["arg1", "arg2", "arg3"],\n'
                    '  "convergence_points": ["point commun 1", "point commun 2"],\n'
                    '  "divergence_points": ["désaccord 1", "désaccord 2", "désaccord 3"],\n'
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

            compare_result = await _call_mistral(compare_prompt, model=model, temperature=0.3)
            compare_data = {}
            if compare_result:
                try:
                    clean = compare_result.strip()
                    if "```" in clean:
                        clean = clean.split("```")[1]
                        if clean.startswith("json"):
                            clean = clean[4:]
                    compare_data = json.loads(clean.strip())
                except (json.JSONDecodeError, IndexError):
                    logger.warning("Failed to parse comparison: %s", compare_result[:300])

            thesis_b = compare_data.get("thesis_b", "Thèse non identifiée")
            arguments_b = compare_data.get("arguments_b", [])
            convergence = compare_data.get("convergence_points", [])
            divergence = compare_data.get("divergence_points", [])
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

            fact_check_results = {}
            perplexity_key = get_perplexity_key()
            if perplexity_key:
                fact_prompt = (
                    f"Fact-check les affirmations principales de ce débat.\n\n"
                    f"Sujet : {detected_topic}\n"
                    f"Thèse A : {thesis_a}\n"
                    f"Thèse B : {thesis_b}\n"
                    f"Arguments A : {', '.join(arguments_a[:3])}\n"
                    f"Arguments B : {', '.join(arguments_b[:3])}\n\n"
                    f"Pour chaque affirmation clé, indique si elle est VRAIE, PARTIELLEMENT VRAIE, "
                    f"NON VÉRIFIABLE, ou FAUSSE, avec une source. "
                    f"Réponds en JSON : "
                    f'{{"claims": [{{"claim": "...", "verdict": "...", "source": "...", "explanation": "..."}}]}}'
                )
                fact_result = await _call_perplexity(fact_prompt)
                if fact_result:
                    try:
                        clean = fact_result.strip()
                        if "```" in clean:
                            clean = clean.split("```")[1]
                            if clean.startswith("json"):
                                clean = clean[4:]
                        fact_check_results = json.loads(clean.strip())
                    except (json.JSONDecodeError, IndexError):
                        logger.warning("Failed to parse fact-check: %s", fact_result[:300])
                        fact_check_results = {"raw": fact_result[:2000]}

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
        created_at=datetime.now(timezone.utc),
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
    Statuts : pending → extracting → searching → analyzing → fact_checking → completed/failed
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
        video_a_title=debate.video_a_title,
        video_b_title=debate.video_b_title,
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
            status=d.status,
            created_at=d.created_at or datetime.now(timezone.utc),
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
        created_at=datetime.now(timezone.utc),
    )
    assistant_msg = DebateChatMessage(
        debate_id=request.debate_id,
        user_id=current_user.id,
        role="assistant",
        content=response_text,
        created_at=datetime.now(timezone.utc),
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
                created_at=m.created_at or datetime.now(timezone.utc),
            ).model_dump()
            for m in messages
        ],
    }
