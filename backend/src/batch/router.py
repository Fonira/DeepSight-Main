"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📦 BATCH ROUTER — API v2 pour analyses en lot                                     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  🆕 Features 2026:                                                                 ║
║  • Analyse de plusieurs vidéos en une seule requête                               ║
║  • Suivi du statut par batch_id                                                    ║
║  • Limites par plan (Free: 3, Pro: 10, Team: 50)                                   ║
║  • Priorisation des analyses par ordre de soumission                               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
from uuid import uuid4
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_session, User
from auth.dependencies import get_current_user, get_verified_user
from core.config import PLAN_LIMITS

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class BatchVideoItem(BaseModel):
    """Une vidéo à analyser dans un batch"""
    url: str = Field(..., description="URL de la vidéo YouTube")
    mode: str = Field(default="standard", description="Mode: accessible, standard, expert")
    category: Optional[str] = Field(default=None, description="Catégorie (auto si None)")
    lang: str = Field(default="fr", description="Langue: fr, en")


class BatchAnalyzeRequest(BaseModel):
    """Requête pour analyser plusieurs vidéos"""
    videos: List[BatchVideoItem] = Field(..., description="Liste des vidéos à analyser")
    priority: str = Field(default="normal", description="Priorité: low, normal, high (Team only)")


class BatchItemStatus(BaseModel):
    """Statut d'un item dans un batch"""
    url: str
    status: str  # pending, processing, completed, failed
    task_id: Optional[str] = None
    summary_id: Optional[int] = None
    error: Optional[str] = None


class BatchStatusResponse(BaseModel):
    """Statut d'un batch complet"""
    batch_id: str
    status: str  # pending, processing, completed, partial, failed
    total: int
    completed: int
    failed: int
    items: List[BatchItemStatus]
    created_at: datetime
    completed_at: Optional[datetime] = None


class BatchCreateResponse(BaseModel):
    """Réponse de création d'un batch"""
    batch_id: str
    status: str
    total: int
    credits_reserved: int
    message: str


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 STOCKAGE EN MÉMOIRE (pour MVP - remplacer par Redis en production)
# ═══════════════════════════════════════════════════════════════════════════════

_batch_store: dict = {}


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 LIMITES PAR PLAN
# ═══════════════════════════════════════════════════════════════════════════════

BATCH_LIMITS = {
    "free": 3,
    "student": 10,  # Legacy alias
    "starter": 10,  # Maps to pro (normalize_plan_id)
    "pro": 10,
    "expert": 10,  # Maps to pro (normalize_plan_id)
    "unlimited": 10,  # Maps to pro (normalize_plan_id)
}


def get_batch_limit(plan: str) -> int:
    """Retourne la limite de vidéos par batch selon le plan"""
    return BATCH_LIMITS.get(plan, BATCH_LIMITS["free"])


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze", response_model=BatchCreateResponse)
async def create_batch_analysis(
    request: BatchAnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Crée une analyse en lot pour plusieurs vidéos YouTube.

    - **videos**: Liste des vidéos à analyser (max selon plan)
    - **priority**: Priorité de traitement (Team only pour high)

    Retourne un batch_id pour suivre le statut des analyses.
    """
    user_plan = current_user.plan or "free"
    batch_limit = get_batch_limit(user_plan)

    # Vérifier la limite de vidéos
    if len(request.videos) > batch_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Batch limit exceeded. Your plan ({user_plan}) allows max {batch_limit} videos per batch."
        )

    if len(request.videos) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one video is required."
        )

    # Vérifier priorité (high = Pro only)
    if request.priority == "high" and user_plan not in ["pro"]:
        request.priority = "normal"

    # Calculer le coût total en crédits
    plan_limits = PLAN_LIMITS.get(user_plan, PLAN_LIMITS["free"])
    credit_cost_per_video = plan_limits.get("credit_cost", 5)
    total_credits = len(request.videos) * credit_cost_per_video

    # Vérifier les crédits disponibles
    if (current_user.credits or 0) < total_credits:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need {total_credits}, have {current_user.credits or 0}."
        )

    # Générer un batch_id
    batch_id = f"batch_{uuid4().hex[:12]}"

    # Créer les items de statut
    items = [
        BatchItemStatus(
            url=video.url,
            status="pending",
            task_id=None,
            summary_id=None,
            error=None
        )
        for video in request.videos
    ]

    # Stocker le batch
    _batch_store[batch_id] = {
        "batch_id": batch_id,
        "user_id": current_user.id,
        "status": "pending",
        "total": len(request.videos),
        "completed": 0,
        "failed": 0,
        "items": [item.model_dump() for item in items],
        "videos": [video.model_dump() for video in request.videos],
        "created_at": datetime.utcnow(),
        "completed_at": None,
        "priority": request.priority,
    }

    # Lancer le traitement en arrière-plan
    background_tasks.add_task(
        process_batch,
        batch_id=batch_id,
        user_id=current_user.id,
    )

    return BatchCreateResponse(
        batch_id=batch_id,
        status="pending",
        total=len(request.videos),
        credits_reserved=total_credits,
        message=f"Batch created. {len(request.videos)} videos queued for analysis."
    )


@router.get("/status/{batch_id}", response_model=BatchStatusResponse)
async def get_batch_status(
    batch_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Récupère le statut d'un batch d'analyses.

    Retourne le statut global et le détail de chaque vidéo.
    """
    batch = _batch_store.get(batch_id)

    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Vérifier que l'utilisateur est propriétaire du batch
    if batch["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return BatchStatusResponse(
        batch_id=batch["batch_id"],
        status=batch["status"],
        total=batch["total"],
        completed=batch["completed"],
        failed=batch["failed"],
        items=[BatchItemStatus(**item) for item in batch["items"]],
        created_at=batch["created_at"],
        completed_at=batch.get("completed_at"),
    )


@router.get("/list")
async def list_user_batches(
    current_user: User = Depends(get_current_user),
    limit: int = 10,
):
    """
    Liste les batches récents de l'utilisateur.
    """
    user_batches = [
        {
            "batch_id": b["batch_id"],
            "status": b["status"],
            "total": b["total"],
            "completed": b["completed"],
            "failed": b["failed"],
            "created_at": b["created_at"],
        }
        for b in _batch_store.values()
        if b["user_id"] == current_user.id
    ]

    # Trier par date de création décroissante
    user_batches.sort(key=lambda x: x["created_at"], reverse=True)

    return {"batches": user_batches[:limit]}


@router.delete("/{batch_id}")
async def cancel_batch(
    batch_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Annule un batch en attente (ne peut pas annuler les analyses en cours).
    """
    batch = _batch_store.get(batch_id)

    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if batch["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if batch["status"] not in ["pending", "processing"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel batch with status: {batch['status']}"
        )

    # Marquer comme annulé
    batch["status"] = "cancelled"
    batch["completed_at"] = datetime.utcnow()

    # Marquer les items pending comme cancelled
    for item in batch["items"]:
        if item["status"] == "pending":
            item["status"] = "cancelled"

    return {"success": True, "message": "Batch cancelled"}


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 TRAITEMENT EN ARRIÈRE-PLAN
# ═══════════════════════════════════════════════════════════════════════════════

async def process_batch(batch_id: str, user_id: int):
    """
    Traite un batch d'analyses en arrière-plan.
    """
    from db.database import async_session_maker
    from videos.service import create_task, update_task_status
    from videos.router import run_analysis_task

    batch = _batch_store.get(batch_id)
    if not batch:
        return

    batch["status"] = "processing"

    async with async_session_maker() as session:
        # Récupérer l'utilisateur
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            batch["status"] = "failed"
            return

        # Traiter chaque vidéo séquentiellement
        for i, video_config in enumerate(batch["videos"]):
            item = batch["items"][i]

            # Vérifier si le batch a été annulé
            if batch["status"] == "cancelled":
                break

            try:
                item["status"] = "processing"

                # Créer une tâche pour cette vidéo
                task_id = f"batch_{uuid4().hex[:12]}"
                item["task_id"] = task_id

                # Extraire video_id depuis l'URL
                from transcripts import extract_video_id
                vid = extract_video_id(video_config.url)
                if not vid:
                    raise ValueError(f"URL invalide: {video_config.url}")

                # Lancer l'analyse réelle via le pipeline v6
                from videos.router import _analyze_video_background_v6, set_task_status
                set_task_status(task_id, {
                    "status": "pending", "progress": 0,
                    "message": "Queued (batch)", "user_id": user_id,
                    "video_id": vid, "credit_cost": 1,
                })
                await _analyze_video_background_v6(
                    task_id=task_id,
                    video_id=vid,
                    url=video_config.url,
                    mode=video_config.mode,
                    category=video_config.category,
                    lang=video_config.lang,
                    model="mistral-small-2603",
                    user_id=user_id,
                    user_plan=user.plan or "free",
                    credit_cost=1,
                    deep_research=False,
                )

                # Vérifier le résultat
                from videos.router import get_task_status as _get_ts
                result = await _get_ts(task_id)
                if result and result.get("status") == "completed":
                    item["status"] = "completed"
                    item["summary_id"] = result.get("result", {}).get("summary_id")
                    batch["completed"] += 1
                else:
                    item["status"] = "failed"
                    item["error"] = (result or {}).get("message", "Analyse échouée")
                    batch["failed"] += 1

            except Exception as e:
                item["status"] = "failed"
                item["error"] = str(e)[:200]
                batch["failed"] += 1

    # Mettre à jour le statut final
    if batch["status"] != "cancelled":
        if batch["failed"] == batch["total"]:
            batch["status"] = "failed"
        elif batch["completed"] == batch["total"]:
            batch["status"] = "completed"
        else:
            batch["status"] = "partial"

    batch["completed_at"] = datetime.utcnow()
