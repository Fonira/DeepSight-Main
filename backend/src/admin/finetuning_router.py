"""
ADMIN FINE-TUNING ROUTER — Manage DeepSight custom model training
v1.0 — Export data, create jobs, monitor progress

All endpoints require admin authentication.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from db.database import get_session
from auth.dependencies import get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# SCHEMAS
# =============================================================================

class FinetuneRequest(BaseModel):
    """Request to start a fine-tuning pipeline."""
    max_samples: int = 300
    base_model: str = "mistral-small-latest"
    training_steps: int = 100
    learning_rate: float = 0.0001
    auto_start: bool = False
    lang: Optional[str] = None  # None = all languages


class ExportPreviewRequest(BaseModel):
    """Request to preview exportable training data."""
    max_samples: int = 100
    lang: Optional[str] = None


# =============================================================================
# POST /api/admin/finetune/preview — Preview training data stats
# =============================================================================

@router.post("/preview")
async def preview_training_data(
    request: ExportPreviewRequest,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_session),
):
    """
    Preview training data stats without uploading or creating a job.
    Shows how many samples would be exported, category distribution, etc.
    """
    from core.finetuning import export_training_data

    export = await export_training_data(
        db=db,
        max_samples=request.max_samples,
        lang=request.lang,
    )

    return {
        "total_exportable": export.total_exported,
        "training_count": len(export.training_samples),
        "validation_count": len(export.validation_samples),
        "skipped_short": export.skipped_short,
        "skipped_no_transcript": export.skipped_no_transcript,
        "categories": export.categories,
        "languages": export.languages,
        "ready": export.total_exported >= 50,
        "recommendation": (
            "Ready for fine-tuning"
            if export.total_exported >= 200
            else f"Collect more data ({export.total_exported}/200 recommended)"
            if export.total_exported >= 50
            else f"Insufficient data ({export.total_exported}/50 minimum)"
        ),
    }


# =============================================================================
# POST /api/admin/finetune/start — Launch fine-tuning pipeline
# =============================================================================

@router.post("/start")
async def start_finetuning(
    request: FinetuneRequest,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_session),
):
    """
    Full pipeline: export data → upload to Mistral → create fine-tuning job.

    With auto_start=False (default), the job is created but not started.
    Use /start-job/{job_id} to begin training after reviewing the preview.
    """
    from core.finetuning import run_finetune_pipeline

    try:
        result = await run_finetune_pipeline(
            db=db,
            max_samples=request.max_samples,
            base_model=request.base_model,
            hyperparameters={
                "training_steps": request.training_steps,
                "learning_rate": request.learning_rate,
            },
            auto_start=request.auto_start,
            lang=request.lang,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error(f"Fine-tuning pipeline error: {e}")
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {e}")

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Unknown error"),
        )

    logger.info(f"Fine-tuning job created by admin {admin.email}: {result.get('job_id')}")

    return result


# =============================================================================
# POST /api/admin/finetune/start-job/{job_id} — Start a validated job
# =============================================================================

@router.post("/start-job/{job_id}")
async def start_finetune_job(
    job_id: str,
    admin=Depends(get_current_admin),
):
    """Start a previously created fine-tuning job (auto_start=False)."""
    from core.finetuning import start_job

    try:
        status = await start_job(job_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    logger.info(f"Fine-tuning job {job_id} started by admin {admin.email}")
    return {"job_id": status.job_id, "status": status.status}


# =============================================================================
# GET /api/admin/finetune/status/{job_id} — Get job status
# =============================================================================

@router.get("/status/{job_id}")
async def get_finetune_status(
    job_id: str,
    admin=Depends(get_current_admin),
):
    """Get current status of a fine-tuning job."""
    from core.finetuning import get_job_status

    try:
        status = await get_job_status(job_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "job_id": status.job_id,
        "status": status.status,
        "fine_tuned_model": status.fine_tuned_model,
        "training_steps": status.training_steps,
        "error": status.error,
        "created_at": status.created_at,
    }


# =============================================================================
# GET /api/admin/finetune/jobs — List all jobs
# =============================================================================

@router.get("/jobs")
async def list_finetune_jobs(
    admin=Depends(get_current_admin),
):
    """List all fine-tuning jobs."""
    from core.finetuning import list_jobs

    try:
        jobs = await list_jobs()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "jobs": [
            {
                "job_id": j.job_id,
                "status": j.status,
                "fine_tuned_model": j.fine_tuned_model,
                "created_at": j.created_at,
            }
            for j in jobs
        ],
    }


# =============================================================================
# POST /api/admin/finetune/cancel/{job_id} — Cancel a running job
# =============================================================================

@router.post("/cancel/{job_id}")
async def cancel_finetune_job(
    job_id: str,
    admin=Depends(get_current_admin),
):
    """Cancel a running fine-tuning job."""
    from core.finetuning import cancel_job

    try:
        success = await cancel_job(job_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not success:
        raise HTTPException(status_code=400, detail="Failed to cancel job")

    logger.info(f"Fine-tuning job {job_id} cancelled by admin {admin.email}")
    return {"job_id": job_id, "cancelled": True}
