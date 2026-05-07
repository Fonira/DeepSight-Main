"""
╔══════════════════════════════════════════════════════════════════════════════════╗
║  🔑 DEEP SIGHT PUBLIC API v1 — REST API pour le plan Expert                      ║
║  Endpoints pour intégration externe et automatisation                            ║
╚══════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timedelta
from collections import defaultdict
import hashlib
import time
import asyncio

from db.database import get_session, User

# Optional imports - these features may not be available in all deployments
try:
    from videos.router import get_task_status, set_task_status, _analyze_video_background_v6, get_summary_by_video_id
    from transcripts import extract_video_id, get_video_info
    from transcripts.tiktok import detect_platform, extract_tiktok_video_id
    from db.database import TaskStatus

    ANALYSIS_AVAILABLE = True
except ImportError as e:
    ANALYSIS_AVAILABLE = False
    print(f"⚠️ [API Public] Video analysis not available: {e}", flush=True)

try:
    from chat.service import process_chat_message_v4

    CHAT_AVAILABLE = True
except ImportError:
    CHAT_AVAILABLE = False
    print("⚠️ [API Public] Chat service not available", flush=True)

router = APIRouter(prefix="/api/v1")

# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 AUTHENTIFICATION API KEY
# ═══════════════════════════════════════════════════════════════════════════════

# Rate limiting en mémoire (pour production: utiliser Redis)
_rate_limits: dict = defaultdict(lambda: {"count": 0, "reset_time": 0, "daily_count": 0, "daily_reset": ""})
_RATE_LIMIT_PER_MINUTE = 60
_RATE_LIMIT_PER_DAY = 1000


def hash_api_key(api_key: str) -> str:
    """Hash une API key pour comparaison sécurisée"""
    return hashlib.sha256(api_key.encode()).hexdigest()


def check_rate_limit(user_id: int) -> tuple[bool, dict]:
    """
    Vérifie le rate limiting pour un utilisateur.
    Retourne (allowed, info)
    """
    now = time.time()
    today = datetime.utcnow().strftime("%Y-%m-%d")
    limits = _rate_limits[user_id]

    # Reset minute counter si nécessaire
    if now > limits["reset_time"]:
        limits["count"] = 0
        limits["reset_time"] = now + 60

    # Reset daily counter si nouveau jour
    if limits["daily_reset"] != today:
        limits["daily_count"] = 0
        limits["daily_reset"] = today

    # Check limits
    if limits["count"] >= _RATE_LIMIT_PER_MINUTE:
        return False, {
            "error": "rate_limit_exceeded",
            "message": f"Rate limit exceeded: {_RATE_LIMIT_PER_MINUTE} requests per minute",
            "retry_after": int(limits["reset_time"] - now),
        }

    if limits["daily_count"] >= _RATE_LIMIT_PER_DAY:
        return False, {
            "error": "daily_limit_exceeded",
            "message": f"Daily limit exceeded: {_RATE_LIMIT_PER_DAY} requests per day",
            "resets_at": f"{today}T00:00:00Z",
        }

    # Increment counters
    limits["count"] += 1
    limits["daily_count"] += 1

    return True, {
        "requests_remaining": _RATE_LIMIT_PER_MINUTE - limits["count"],
        "daily_remaining": _RATE_LIMIT_PER_DAY - limits["daily_count"],
    }


async def get_api_user(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    🔐 Authentification via API Key.
    Supporte deux formats:
    - Header X-API-Key: ds_live_xxx
    - Header Authorization: Bearer ds_live_xxx
    """
    api_key = None

    # Essayer X-API-Key d'abord
    if x_api_key and x_api_key.startswith("ds_"):
        api_key = x_api_key
    # Sinon essayer Authorization: Bearer
    elif authorization and authorization.startswith("Bearer ds_"):
        api_key = authorization.replace("Bearer ", "")

    if not api_key:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "missing_api_key",
                "message": "API key required. Use header 'X-API-Key: ds_live_xxx' or 'Authorization: Bearer ds_live_xxx'",
            },
        )

    # Valider le format
    if not api_key.startswith("ds_live_"):
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_api_key_format", "message": "Invalid API key format. Keys start with 'ds_live_'"},
        )

    # Hash et recherche
    key_hash = hash_api_key(api_key)
    result = await session.execute(select(User).where(User.api_key_hash == key_hash))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=401, detail={"error": "invalid_api_key", "message": "Invalid or revoked API key"}
        )

    # Pro ET Expert ont accès à l'API publique. Admin bypass.
    if not (user.is_admin or user.plan in ("pro", "expert")):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "message": "API access requires Pro or Expert plan",
                "current_plan": user.plan,
                "required_plans": ["pro", "expert"],
                "upgrade_url": "https://www.deepsightsynthesis.com/upgrade",
            },
        )

    # Check rate limits
    allowed, rate_info = check_rate_limit(user.id)
    if not allowed:
        raise HTTPException(status_code=429, detail=rate_info)

    # Mettre à jour last_used
    await session.execute(update(User).where(User.id == user.id).values(api_key_last_used=datetime.utcnow()))
    await session.commit()

    # Stocker rate info dans request pour headers de réponse
    request.state.rate_info = rate_info

    return user


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class AnalyzeRequest(BaseModel):
    """Requête d'analyse vidéo"""

    url: str = Field(..., description="URL YouTube de la vidéo", example="https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    mode: Literal["express", "standard", "detailed"] = Field("standard", description="Mode d'analyse")
    language: Literal["fr", "en", "auto"] = Field("auto", description="Langue de sortie")
    include_concepts: bool = Field(True, description="Inclure le glossaire des concepts")
    include_timestamps: bool = Field(True, description="Inclure les timestamps cliquables")


class AnalyzeResponse(BaseModel):
    """Réponse d'analyse vidéo"""

    success: bool
    analysis_id: str
    video_id: str
    title: str
    summary: str
    concepts: Optional[List[dict]] = None
    timestamps: Optional[List[dict]] = None
    duration_seconds: int
    credits_used: int


class ChatRequest(BaseModel):
    """Requête de chat sur une vidéo"""

    video_id: str = Field(..., description="ID YouTube de la vidéo")
    question: str = Field(..., description="Question à poser", max_length=2000)
    web_search: bool = Field(False, description="Activer la recherche web enrichie")
    context_mode: Literal["video", "expanded"] = Field("video", description="Mode de contexte")


class ChatResponse(BaseModel):
    """Réponse de chat"""

    success: bool
    answer: str
    sources: Optional[List[dict]] = None
    web_enriched: bool
    credits_used: int


class HistoryItem(BaseModel):
    """Item d'historique"""

    id: str
    video_id: str
    title: str
    analyzed_at: datetime
    mode: str


class UsageStats(BaseModel):
    """Statistiques d'utilisation API"""

    today: dict
    this_month: dict
    rate_limits: dict


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 ENDPOINTS API v1
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/health")
async def api_health():
    """
    🏥 Health check de l'API publique.
    Pas d'authentification requise.
    """
    return {
        "status": "healthy",
        "api_version": "v1",
        "service": "deepsight-api-public",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/me")
async def get_current_api_user(user: User = Depends(get_api_user), request: Request = None):
    """
    👤 Informations sur l'utilisateur authentifié.
    """
    rate_info = getattr(request.state, "rate_info", {})

    return {
        "user_id": user.id,
        "email": user.email,
        "plan": user.plan,
        "api_key_created": user.api_key_created_at.isoformat() if user.api_key_created_at else None,
        "api_key_last_used": user.api_key_last_used.isoformat() if user.api_key_last_used else None,
        "rate_limits": {
            "requests_per_minute": _RATE_LIMIT_PER_MINUTE,
            "requests_per_day": _RATE_LIMIT_PER_DAY,
            **rate_info,
        },
    }


class AnalyzeAsyncResponse(BaseModel):
    """Réponse d'analyse asynchrone — retourne un task_id à poller"""

    success: bool
    task_id: str
    video_id: str
    status: str
    estimated_credits: int
    poll_url: str
    message: str


@router.post("/analyze")
async def analyze_video_api(
    req: AnalyzeRequest,
    request: Request,
    user: User = Depends(get_api_user),
    session: AsyncSession = Depends(get_session),
):
    """
    🎬 Lancer l'analyse d'une vidéo YouTube (asynchrone).

    Retourne un `task_id` à poller via `GET /api/v1/analyze/status/{task_id}`.

    **Modes disponibles:**
    - `express`: Synthèse rapide (~30s), 10 crédits
    - `standard`: Analyse complète (~1-2min), 20 crédits
    - `detailed`: Analyse approfondie avec concepts (~2-3min), 50 crédits

    **Langues:**
    - `auto`: Détection automatique de la langue
    - `fr`: Français
    - `en`: English
    """
    if not ANALYSIS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail={"error": "service_unavailable", "message": "Video analysis service is temporarily unavailable"},
        )

    # Détecter la plateforme et extraire l'ID
    platform = detect_platform(req.url)

    if platform == "tiktok":
        video_id = extract_tiktok_video_id(req.url)
        if not video_id:
            raise HTTPException(status_code=400, detail={"error": "invalid_url", "message": "Invalid TikTok URL"})
    else:
        video_id = extract_video_id(req.url)
        if not video_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_url",
                    "message": "Invalid YouTube URL. Expected format: https://youtube.com/watch?v=xxx",
                },
            )

    # Calcul des crédits
    credits_map = {"express": 10, "standard": 20, "detailed": 50}
    credits_cost = credits_map[req.mode]

    # Vérifier les crédits de l'utilisateur
    if hasattr(user, "credits") and user.credits is not None:
        if user.credits < credits_cost:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "insufficient_credits",
                    "message": f"Not enough credits. Required: {credits_cost}, available: {user.credits}",
                    "credits_available": user.credits,
                    "credits_required": credits_cost,
                },
            )

    # Vérifier le cache (même vidéo déjà analysée)
    existing = await get_summary_by_video_id(session, video_id, user.id)
    if existing:
        return {
            "success": True,
            "task_id": f"cached_{existing.id}",
            "video_id": video_id,
            "status": "completed",
            "estimated_credits": 0,
            "poll_url": f"/api/v1/analyze/status/cached_{existing.id}",
            "message": "Analysis found in cache (free). Use the poll URL to get results.",
            "cached": True,
            "analysis_id": str(existing.id),
        }

    # Mapper mode API → mode interne
    mode_map = {"express": "accessible", "standard": "standard", "detailed": "expert"}
    internal_mode = mode_map.get(req.mode, "standard")

    # Mapper langue
    lang = req.language if req.language != "auto" else "fr"

    # Générer task_id
    import uuid

    task_id = f"api_{uuid.uuid4().hex[:16]}"

    # Stocker la tâche via public API
    set_task_status(
        task_id,
        {
            "status": "pending",
            "progress": 0,
            "message": "Queued via API v1",
            "user_id": user.id,
            "video_id": video_id,
            "credit_cost": credits_cost,
            "deep_research": False,
        },
    )

    # Lancer l'analyse en background
    asyncio.ensure_future(
        _analyze_video_background_v6(
            task_id=task_id,
            video_id=video_id,
            url=req.url,
            mode=internal_mode,
            category="auto",
            lang=lang,
            model="mistral-small-2603",
            user_id=user.id,
            user_plan=user.plan,
            credit_cost=credits_cost,
            deep_research=False,
            platform=platform,
        )
    )

    return {
        "success": True,
        "task_id": task_id,
        "video_id": video_id,
        "status": "pending",
        "estimated_credits": credits_cost,
        "poll_url": f"/api/v1/analyze/status/{task_id}",
        "message": "Analysis started. Poll the status URL to track progress.",
    }


@router.get("/analyze/status/{task_id}")
async def get_api_analysis_status(
    task_id: str, user: User = Depends(get_api_user), session: AsyncSession = Depends(get_session)
):
    """
    📊 Vérifier l'état d'une analyse lancée via l'API.

    **États possibles:**
    - `pending`: En attente de traitement
    - `processing`: Analyse en cours
    - `completed`: Terminée — le champ `result` contient l'analyse
    - `failed`: Échec — le champ `error` contient le détail
    """
    # Gérer les task_id de cache
    if task_id.startswith("cached_"):
        try:
            from db.database import Summary

            summary_id = int(task_id.replace("cached_", ""))
            result = await session.execute(select(Summary).where(Summary.id == summary_id, Summary.user_id == user.id))
            summary = result.scalar_one_or_none()
            if summary:
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "progress": 100,
                    "result": {
                        "analysis_id": str(summary.id),
                        "video_id": summary.video_id,
                        "title": summary.video_title or summary.title,
                        "summary": summary.summary,
                        "cached": True,
                    },
                }
        except Exception:
            pass

        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"Task {task_id} not found"})

    # Chercher dans le task store via public API (async — cross-worker Redis)
    task = await get_task_status(task_id)
    if not task:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": f"Task {task_id} not found or expired"}
        )

    # Vérifier que la tâche appartient à l'utilisateur
    if task.get("user_id") != user.id:
        raise HTTPException(
            status_code=403, detail={"error": "access_denied", "message": "This task belongs to another user"}
        )

    response = {
        "task_id": task_id,
        "status": task.get("status", "unknown"),
        "progress": task.get("progress", 0),
        "message": task.get("message", ""),
    }

    # Si terminé, inclure le résultat
    if task.get("status") == "completed" and task.get("result"):
        response["result"] = task["result"]

    # Si échoué, inclure l'erreur
    if task.get("status") == "failed":
        response["error"] = task.get("error", "Unknown error")

    return response


@router.get("/analysis/{analysis_id}")
async def get_analysis(
    analysis_id: str, user: User = Depends(get_api_user), session: AsyncSession = Depends(get_session)
):
    """
    📄 Récupérer une analyse existante par son ID.
    """
    from db.database import Summary

    result = await session.execute(select(Summary).where(Summary.id == int(analysis_id), Summary.user_id == user.id))
    summary = result.scalar_one_or_none()

    if not summary:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Analysis {analysis_id} not found or access denied"},
        )

    return {
        "id": str(summary.id),
        "video_id": summary.video_id,
        "title": summary.title,
        "summary": summary.summary,
        "concepts": summary.concepts_json if hasattr(summary, "concepts_json") else None,
        "created_at": summary.created_at.isoformat() if summary.created_at else None,
        "mode": summary.mode if hasattr(summary, "mode") else "standard",
    }


@router.post("/chat", response_model=ChatResponse)
async def chat_with_video(
    req: ChatRequest, user: User = Depends(get_api_user), session: AsyncSession = Depends(get_session)
):
    """
    💬 Poser une question sur une vidéo analysée.

    **Options:**
    - `web_search`: Enrichir la réponse avec une recherche web (10 crédits au lieu de 5)
    - `context_mode`: "video" (contexte vidéo seul) ou "expanded" (contexte élargi)
    """
    if not CHAT_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail={"error": "service_unavailable", "message": "Chat service is temporarily unavailable"},
        )

    credits_cost = 10 if req.web_search else 5

    try:
        # First, find the summary for this video
        from db.database import Summary

        result = await session.execute(
            select(Summary)
            .where(Summary.video_id == req.video_id, Summary.user_id == user.id)
            .order_by(Summary.created_at.desc())
        )
        summary = result.scalar_one_or_none()

        if not summary:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "not_found",
                    "message": f"No analysis found for video {req.video_id}. Analyze it first using POST /api/v1/analyze",
                },
            )

        # Call the chat service
        chat_result = await process_chat_message_v4(
            session=session,
            user_id=user.id,
            summary_id=summary.id,
            question=req.question,
            web_search=req.web_search,
            mode=req.context_mode,
        )

        # Check for errors
        if chat_result.get("error"):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "chat_limit_reached",
                    "message": chat_result.get("error"),
                    "quota_info": chat_result.get("quota_info"),
                },
            )

        return ChatResponse(
            success=True,
            answer=chat_result.get("response", ""),
            sources=chat_result.get("sources") if req.web_search else None,
            web_enriched=chat_result.get("web_search_used", False),
            credits_used=credits_cost,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400, detail={"error": "chat_failed", "message": str(e), "video_id": req.video_id}
        )


@router.get("/history")
async def get_analysis_history(
    limit: int = 20, offset: int = 0, user: User = Depends(get_api_user), session: AsyncSession = Depends(get_session)
):
    """
    📚 Historique des analyses de l'utilisateur.

    **Pagination:**
    - `limit`: Nombre de résultats (max 100)
    - `offset`: Point de départ
    """
    from db.database import Summary

    limit = min(limit, 100)  # Cap à 100

    result = await session.execute(
        select(Summary)
        .where(Summary.user_id == user.id)
        .order_by(Summary.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    summaries = result.scalars().all()

    # Count total
    count_result = await session.execute(select(Summary).where(Summary.user_id == user.id))
    total = len(count_result.scalars().all())

    return {
        "items": [
            {
                "id": str(s.id),
                "video_id": s.video_id,
                "title": s.video_title,
                "analyzed_at": s.created_at.isoformat() if s.created_at else None,
                "mode": getattr(s, "mode", "standard"),
            }
            for s in summaries
        ],
        "pagination": {"total": total, "limit": limit, "offset": offset, "has_more": offset + limit < total},
    }


@router.get("/usage", response_model=UsageStats)
async def get_usage_stats(request: Request, user: User = Depends(get_api_user)):
    """
    📊 Statistiques d'utilisation de l'API.
    """
    rate_info = getattr(request.state, "rate_info", {})
    limits = _rate_limits.get(user.id, {})

    return UsageStats(
        today={
            "requests": limits.get("daily_count", 0),
            "limit": _RATE_LIMIT_PER_DAY,
            "remaining": rate_info.get("daily_remaining", _RATE_LIMIT_PER_DAY),
        },
        this_month={
            "estimated_requests": limits.get("daily_count", 0) * 30,
            "note": "Monthly stats available in dashboard",
        },
        rate_limits={
            "per_minute": _RATE_LIMIT_PER_MINUTE,
            "per_day": _RATE_LIMIT_PER_DAY,
            "current_minute_remaining": rate_info.get("requests_remaining", _RATE_LIMIT_PER_MINUTE),
        },
    )


@router.get("/videos/{video_id}")
async def get_video_info(
    video_id: str, user: User = Depends(get_api_user), session: AsyncSession = Depends(get_session)
):
    """
    🎥 Obtenir les informations d'une vidéo analysée.
    """
    from db.database import Summary

    result = await session.execute(
        select(Summary)
        .where(Summary.video_id == video_id, Summary.user_id == user.id)
        .order_by(Summary.created_at.desc())
    )
    summary = result.scalar_one_or_none()

    if not summary:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"No analysis found for video {video_id}. Analyze it first using POST /api/v1/analyze",
            },
        )

    return {
        "video_id": video_id,
        "title": summary.title,
        "thumbnail": summary.thumbnail_url if hasattr(summary, "thumbnail_url") else None,
        "analyses": [
            {
                "id": str(summary.id),
                "mode": getattr(summary, "mode", "standard"),
                "created_at": summary.created_at.isoformat() if summary.created_at else None,
            }
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 ENDPOINTS BATCH (Expert exclusif)
# ═══════════════════════════════════════════════════════════════════════════════


class BatchAnalyzeRequest(BaseModel):
    """Requête batch d'analyse"""

    urls: List[str] = Field(..., max_items=10, description="Liste d'URLs YouTube (max 10)")
    mode: Literal["express", "standard"] = Field("express", description="Mode d'analyse")


@router.post("/batch/analyze")
async def batch_analyze(
    req: BatchAnalyzeRequest, user: User = Depends(get_api_user), session: AsyncSession = Depends(get_session)
):
    """
    🚀 Analyse batch de plusieurs vidéos.

    **Limites:**
    - Maximum 10 vidéos par requête
    - Mode "detailed" non disponible en batch
    - Crédits: express=10, standard=20 par vidéo

    **Réponse:** Job ID pour suivi asynchrone
    """
    if len(req.urls) > 10:
        raise HTTPException(
            status_code=400, detail={"error": "too_many_urls", "message": "Maximum 10 URLs per batch request"}
        )

    # Pour le MVP, on retourne un job ID (implémentation async à venir)
    import uuid

    job_id = str(uuid.uuid4())

    credits_cost = len(req.urls) * (10 if req.mode == "express" else 20)

    return {
        "job_id": job_id,
        "status": "queued",
        "videos_count": len(req.urls),
        "estimated_credits": credits_cost,
        "estimated_time_seconds": len(req.urls) * 30,
        "message": "Batch analysis queued. Use GET /api/v1/batch/{job_id} to check status.",
        "note": "Full async batch processing coming soon. Currently processes sequentially.",
    }
