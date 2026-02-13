"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💬 CHAT ROUTER v4.0 — ENRICHISSEMENT PERPLEXITY PROGRESSIF                        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  NOUVEAUTÉS v4.0:                                                                  ║
║  • 🌐 Enrichissement automatique selon le plan                                     ║
║  • 📊 Sources web dans les réponses                                                ║
║  • 🎯 Niveau d'enrichissement exposé dans la réponse                               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from db.database import get_session, User, Summary
from auth.dependencies import get_current_user
from videos.service import get_summary_by_id
from core.config import PLAN_LIMITS

from .service import (
    check_chat_quota, increment_chat_quota,
    save_chat_message, get_chat_history, clear_chat_history,
    generate_chat_response, generate_chat_response_stream,
    check_web_search_quota, increment_web_search_usage, search_with_perplexity
)

# Import v4.0
try:
    from .service import generate_chat_response_v4, process_chat_message_v4
    V4_AVAILABLE = True
except ImportError:
    V4_AVAILABLE = False
    print("⚠️ [CHAT ROUTER] v4.0 functions not available, using legacy", flush=True)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS v4.0
# ═══════════════════════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    """Requête de chat v4.0"""
    question: str = Field(..., min_length=1, max_length=2000)
    summary_id: int
    mode: str = Field(default="standard", description="accessible, standard, expert")
    use_web_search: bool = Field(default=False)


class ChatRequestByPath(BaseModel):
    """Requête de chat v4.1 — summary_id dans le path"""
    question: str = Field(..., min_length=1, max_length=2000)
    mode: str = Field(default="standard", description="accessible, standard, expert")
    use_web_search: bool = Field(default=False)


class WebSource(BaseModel):
    """Source web"""
    title: str = ""
    url: str = ""
    snippet: str = ""


class ChatResponseV4(BaseModel):
    """Réponse de chat v4.0 avec enrichissement"""
    response: str
    web_search_used: bool = False
    sources: List[WebSource] = []
    enrichment_level: str = "none"  # none, light, full, deep
    quota_info: dict = {}


class ChatMessage(BaseModel):
    """Message de chat"""
    role: str
    content: str
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    """Historique de chat"""
    messages: List[ChatMessage]
    quota_info: dict


class QuotaInfoResponse(BaseModel):
    """Info quota chat v4.0"""
    can_ask: bool
    reason: str
    daily_limit: int
    daily_used: int
    per_video_limit: int
    video_used: int
    web_search_available: bool
    web_search_used: int
    web_search_limit: int
    enrichment_level: str = "none"


# ═══════════════════════════════════════════════════════════════════════════════
# 💬 ENDPOINTS CHAT v4.0
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/ask", response_model=ChatResponseV4)
async def ask_question_v4(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 v4.0: Pose une question sur une vidéo avec enrichissement Perplexity progressif.
    
    L'enrichissement dépend du plan:
    - Free: Pas d'enrichissement
    - Starter: Vérification légère des faits clés
    - Pro: Enrichissement complet avec sources
    - Expert: Analyse exhaustive multi-sources
    """
    print(f"💬 [CHAT v4.0] Question from user {current_user.id} (plan: {current_user.plan})", flush=True)
    
    # Utiliser la nouvelle fonction v4 si disponible
    if V4_AVAILABLE:
        result = await process_chat_message_v4(
            session=session,
            user_id=current_user.id,
            summary_id=request.summary_id,
            question=request.question,
            web_search=request.use_web_search,
            mode=request.mode
        )
        
        if "error" in result:
            raise HTTPException(
                status_code=429 if "limit" in result["error"] else 404,
                detail=result["error"]
            )
        
        return ChatResponseV4(
            response=result["response"],
            web_search_used=result["web_search_used"],
            sources=[WebSource(**s) for s in result.get("sources", [])],
            enrichment_level=result.get("enrichment_level", "none"),
            quota_info=result.get("quota_info", {})
        )
    
    # Fallback: utiliser l'ancienne logique
    return await _ask_question_legacy(request, current_user, session)


async def _ask_question_legacy(
    request: ChatRequest,
    current_user: User,
    session: AsyncSession
) -> ChatResponseV4:
    """Logique legacy pour compatibilité"""
    # Vérifier le quota
    can_ask, reason, quota_info = await check_chat_quota(
        session, current_user.id, request.summary_id
    )
    
    if not can_ask:
        raise HTTPException(
            status_code=429,
            detail=f"Chat limit reached: {reason}",
            headers={"X-Quota-Info": str(quota_info)}
        )
    
    # Récupérer le résumé
    summary = await get_summary_by_id(session, request.summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    # Récupérer l'historique
    history = await get_chat_history(session, request.summary_id, current_user.id)
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # 🧠 DÉTECTION INTELLIGENTE PERPLEXITY — Économise les appels API
    # ═══════════════════════════════════════════════════════════════════════════════
    web_search_result = None
    sources = []
    web_search_used = False
    web_search_suggested = False
    
    # Importer la détection intelligente
    try:
        from videos.web_enrichment import needs_web_search_for_chat
        should_search, trigger_reason = needs_web_search_for_chat(
            request.question, 
            summary.video_title
        )
    except ImportError:
        should_search = False
        trigger_reason = "detection_unavailable"
    
    # Décider si on utilise Perplexity
    use_perplexity = False
    
    if request.use_web_search:
        # L'utilisateur a explicitement demandé la recherche web
        use_perplexity = True
        print(f"🌐 [CHAT] Web search: user requested", flush=True)
    elif should_search:
        # La détection automatique suggère une recherche
        # Mais on ne l'active que si l'utilisateur est Pro/Expert ET a du quota
        plan_limits = PLAN_LIMITS.get(current_user.plan, PLAN_LIMITS["free"])
        if plan_limits.get("web_search_enabled", False):
            can_search, used, limit = await check_web_search_quota(session, current_user.id)
            if can_search:
                # Auto-enrichissement pour Pro/Expert quand c'est pertinent
                use_perplexity = True
                print(f"🌐 [CHAT] Web search: auto-triggered ({trigger_reason})", flush=True)
            else:
                web_search_suggested = True
                print(f"💡 [CHAT] Web search suggested but quota exhausted", flush=True)
        else:
            web_search_suggested = True
            print(f"💡 [CHAT] Web search suggested but not available for plan", flush=True)
    
    # Exécuter la recherche Perplexity si décidé
    if use_perplexity:
        can_search, used, limit = await check_web_search_quota(session, current_user.id)
        if can_search:
            web_search_result = await search_with_perplexity(
                request.question,
                f"{summary.video_title}: {summary.summary_content[:1000]}",
                summary.lang or "fr"
            )
            if web_search_result:
                await increment_web_search_usage(session, current_user.id)
                web_search_used = True
                print(f"✅ [CHAT] Perplexity: {len(web_search_result)} chars", flush=True)
    
    # Construire le contexte
    transcript = summary.transcript_context or ""
    if web_search_result:
        transcript = f"{transcript}\n\n🌐 INFORMATIONS WEB RÉCENTES:\n{web_search_result}"
    
    # Déterminer le modèle selon le plan
    plan_limits = PLAN_LIMITS.get(current_user.plan, PLAN_LIMITS["free"])
    model = plan_limits.get("default_model", "mistral-small-latest")
    
    response = await generate_chat_response(
        question=request.question,
        video_title=summary.video_title,
        transcript=transcript,
        summary=summary.summary_content,
        chat_history=history,
        mode=request.mode,
        lang=summary.lang or "fr",
        model=model
    )
    
    if not response:
        raise HTTPException(status_code=500, detail="Failed to generate response")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # 💡 SUGGESTION INTELLIGENTE — Ajouter un conseil si recherche web serait utile
    # ═══════════════════════════════════════════════════════════════════════════════
    if web_search_suggested and not web_search_used:
        lang = summary.lang or "fr"
        if lang == "fr":
            suggestion = "\n\n---\n💡 *Cette question pourrait bénéficier d'une recherche web pour des infos plus récentes. Activez l'option \"Recherche Web\" pour enrichir la réponse.*"
        else:
            suggestion = "\n\n---\n💡 *This question could benefit from a web search for more recent information. Enable the \"Web Search\" option to enrich the response.*"
        
        # N'ajouter la suggestion que si l'utilisateur n'est pas Pro/Expert ou a épuisé son quota
        plan_limits = PLAN_LIMITS.get(current_user.plan, PLAN_LIMITS["free"])
        if not plan_limits.get("web_search_enabled", False):
            response += suggestion
    
    # Sauvegarder les messages
    await save_chat_message(session, current_user.id, request.summary_id, "user", request.question)
    await save_chat_message(session, current_user.id, request.summary_id, "assistant", response)
    
    # Incrémenter le quota
    await increment_chat_quota(session, current_user.id)
    
    return ChatResponseV4(
        response=response,
        web_search_used=web_search_result is not None,
        sources=sources,
        enrichment_level="none",
        quota_info=quota_info
    )


@router.post("/ask/stream")
async def ask_question_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Pose une question avec réponse en streaming (Server-Sent Events).
    Note: Le streaming n'inclut pas l'enrichissement Perplexity.
    """
    # Vérifier le quota
    can_ask, reason, quota_info = await check_chat_quota(
        session, current_user.id, request.summary_id
    )
    
    if not can_ask:
        raise HTTPException(status_code=429, detail=f"Chat limit reached: {reason}")
    
    # Récupérer le résumé
    summary = await get_summary_by_id(session, request.summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    # Récupérer l'historique
    history = await get_chat_history(session, request.summary_id, current_user.id)
    
    async def generate():
        full_response = ""
        async for chunk in generate_chat_response_stream(
            question=request.question,
            video_title=summary.video_title,
            transcript=summary.transcript_context or "",
            summary=summary.summary_content,
            chat_history=history,
            mode=request.mode,
            lang=summary.lang or "fr"
        ):
            full_response += chunk
            yield f"data: {chunk}\n\n"
        
        yield "data: [DONE]\n\n"
        
        # Sauvegarder après le streaming complet
        await save_chat_message(session, current_user.id, request.summary_id, "user", request.question)
        await save_chat_message(session, current_user.id, request.summary_id, "assistant", full_response)
        await increment_chat_quota(session, current_user.id)
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📜 HISTORIQUE & QUOTA
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/history/{summary_id}", response_model=ChatHistoryResponse)
async def get_history(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Récupère l'historique de chat pour une vidéo"""
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    messages = await get_chat_history(session, summary_id, current_user.id)
    _, _, quota_info = await check_chat_quota(session, current_user.id, summary_id)
    
    return ChatHistoryResponse(
        messages=[ChatMessage(**m) for m in messages],
        quota_info=quota_info
    )


@router.delete("/history/{summary_id}")
async def clear_history(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Efface l'historique de chat pour une vidéo"""
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    count = await clear_chat_history(session, summary_id, current_user.id)
    return {"success": True, "deleted": count}


@router.get("/{summary_id}/quota", response_model=QuotaInfoResponse)
async def get_quota_info_by_path(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 v4.1: Route alternative avec summary_id dans le path.
    GET /api/chat/{summary_id}/quota
    """
    can_ask, reason, quota_info = await check_chat_quota(
        session, current_user.id, summary_id
    )
    
    can_search, web_used, web_limit = await check_web_search_quota(
        session, current_user.id
    )
    
    # Déterminer le niveau d'enrichissement
    enrichment_level = "none"
    try:
        from videos.web_enrichment import get_enrichment_level
        level = get_enrichment_level(current_user.plan)
        enrichment_level = level.value
    except:
        pass
    
    return QuotaInfoResponse(
        can_ask=can_ask,
        reason=reason,
        daily_limit=quota_info.get("daily_limit", 0),
        daily_used=quota_info.get("daily_used", 0),
        per_video_limit=quota_info.get("per_video_limit", 0),
        video_used=quota_info.get("video_used", 0),
        web_search_available=can_search,
        web_search_used=web_used,
        web_search_limit=web_limit,
        enrichment_level=enrichment_level
    )


@router.get("/quota", response_model=QuotaInfoResponse)
async def get_quota_info(
    summary_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 v4.0: Récupère les informations de quota avec niveau d'enrichissement.
    """
    can_ask, reason, quota_info = await check_chat_quota(
        session, current_user.id, summary_id
    )
    
    can_search, web_used, web_limit = await check_web_search_quota(
        session, current_user.id
    )
    
    # Déterminer le niveau d'enrichissement
    enrichment_level = "none"
    try:
        from videos.web_enrichment import get_enrichment_level
        level = get_enrichment_level(current_user.plan)
        enrichment_level = level.value
    except:
        pass
    
    return QuotaInfoResponse(
        can_ask=can_ask,
        reason=reason,
        daily_limit=quota_info.get("daily_limit", 0),
        daily_used=quota_info.get("daily_used", 0),
        per_video_limit=quota_info.get("per_video_limit", 0),
        video_used=quota_info.get("video_used", 0),
        web_search_available=can_search,
        web_search_used=web_used,
        web_search_limit=web_limit,
        enrichment_level=enrichment_level
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 ENDPOINT D'INFO ENRICHISSEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/enrichment-info")
async def get_enrichment_info(
    current_user: User = Depends(get_current_user)
):
    """
    🆕 v4.0: Retourne les infos d'enrichissement disponibles pour l'utilisateur.
    """
    try:
        from videos.web_enrichment import (
            get_enrichment_level, get_enrichment_config, 
            get_enrichment_badge, ENRICHMENT_CONFIG, EnrichmentLevel
        )
        
        level = get_enrichment_level(current_user.plan)
        config = get_enrichment_config(current_user.plan)
        badge = get_enrichment_badge(level, "fr")
        
        return {
            "plan": current_user.plan,
            "enrichment_level": level.value,
            "badge": badge,
            "enabled": config.get("enabled", False),
            "features": config.get("features", []),
            "max_sources": config.get("max_sources", 0),
            "description": {
                "none": "Pas d'enrichissement web",
                "light": "Vérification des faits clés (1-2 sources)",
                "full": "Enrichissement complet avec contexte actuel (3-5 sources)",
                "deep": "Analyse exhaustive avec fact-checking détaillé (5-8 sources)"
            }.get(level.value, "")
        }
    except ImportError:
        return {
            "plan": current_user.plan,
            "enrichment_level": "none",
            "enabled": False,
            "features": [],
            "description": "Enrichissement non disponible"
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 ROUTES COMPATIBLES FRONTEND v4.1
# ═══════════════════════════════════════════════════════════════════════════════
# Le frontend attend des routes avec le summary_id dans le path

@router.post("/{summary_id}", response_model=ChatResponseV4)
async def ask_question_by_path(
    summary_id: int,
    request_body: ChatRequestByPath,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 v4.1: Route alternative POST /api/chat/{summary_id}
    Compatible avec le frontend qui envoie {question, use_web_search, mode}
    """
    print(f"💬 [CHAT v4.1] POST /{summary_id} from user {current_user.id}", flush=True)

    question = request_body.question
    use_web_search = request_body.use_web_search
    mode = request_body.mode

    # Utiliser la logique v4 si disponible
    if V4_AVAILABLE:
        result = await process_chat_message_v4(
            session=session,
            user_id=current_user.id,
            summary_id=summary_id,
            question=question,
            web_search=use_web_search,
            mode=mode
        )

        if "error" in result:
            raise HTTPException(
                status_code=429 if "limit" in result["error"] else 404,
                detail=result["error"]
            )

        return ChatResponseV4(
            response=result["response"],
            web_search_used=result["web_search_used"],
            sources=[WebSource(**s) for s in result.get("sources", [])],
            enrichment_level=result.get("enrichment_level", "none"),
            quota_info=result.get("quota_info", {})
        )

    # Fallback legacy
    request = ChatRequest(
        question=question,
        summary_id=summary_id,
        use_web_search=use_web_search,
        mode=mode
    )
    return await _ask_question_legacy(request, current_user, session)


@router.get("/{summary_id}/history", response_model=ChatHistoryResponse)
async def get_history_by_path(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 v4.1: Route alternative GET /api/chat/{summary_id}/history
    """
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    messages = await get_chat_history(session, summary_id, current_user.id)
    _, _, quota_info = await check_chat_quota(session, current_user.id, summary_id)
    
    return ChatHistoryResponse(
        messages=[ChatMessage(**m) for m in messages],
        quota_info=quota_info
    )


@router.delete("/{summary_id}")
async def clear_history_by_path(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 v4.1: Route alternative DELETE /api/chat/{summary_id}
    """
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    count = await clear_chat_history(session, summary_id, current_user.id)
    return {"status": "ok", "message": f"Cleared {count} messages"}
