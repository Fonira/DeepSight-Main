"""
MISTRAL FINE-TUNING PIPELINE — Custom DeepSight Model
v1.0 — Export training data from existing analyses + Mistral Fine-tuning API

Architecture:
    1. Export: Query DB for high-quality analyses → build JSONL training pairs
    2. Upload: Send JSONL to Mistral Files API
    3. Train:  Create fine-tuning job on mistral-small-latest
    4. Monitor: Poll job status until completion
    5. Deploy:  Update config to use fine-tuned model for Free/Étudiant plans

Training data format (JSONL):
    {"messages": [
        {"role": "system", "content": "<analysis system prompt>"},
        {"role": "user", "content": "<transcript + metadata>"},
        {"role": "assistant", "content": "<completed analysis>"}
    ]}

Quality filters:
    - Only analyses with content > 1000 chars
    - Only from videos with transcripts > 500 chars
    - Only non-guest, non-deleted analyses
    - Diverse categories and languages
"""

import asyncio
import io
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_mistral_key

logger = logging.getLogger(__name__)

# =============================================================================
# CONSTANTS
# =============================================================================

MISTRAL_FILES_URL = "https://api.mistral.ai/v1/files"
MISTRAL_FINETUNE_URL = "https://api.mistral.ai/v1/fine_tuning/jobs"

# Base model for fine-tuning (best cost/quality for DeepSight)
DEFAULT_BASE_MODEL = "mistral-small-latest"

# Quality thresholds for training data
MIN_ANALYSIS_CHARS = 1000      # Skip very short analyses
MIN_TRANSCRIPT_CHARS = 500     # Skip analyses without real transcripts
MAX_TRANSCRIPT_CHARS = 30000   # Truncate very long transcripts (token budget)
MAX_ANALYSIS_CHARS = 15000     # Truncate very long analyses
MIN_TRAINING_SAMPLES = 50      # Minimum viable training set
RECOMMENDED_SAMPLES = 200      # Ideal training set size
VALIDATION_SPLIT = 0.1         # 10% for validation

# Default hyperparameters
DEFAULT_HYPERPARAMS = {
    "training_steps": 100,
    "learning_rate": 0.0001,
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class TrainingSample:
    """A single fine-tuning training example."""
    system_prompt: str
    user_prompt: str
    assistant_response: str
    video_id: str = ""
    category: str = ""
    lang: str = "fr"


@dataclass
class ExportResult:
    """Result of the training data export."""
    training_samples: List[Dict[str, Any]] = field(default_factory=list)
    validation_samples: List[Dict[str, Any]] = field(default_factory=list)
    total_exported: int = 0
    skipped_short: int = 0
    skipped_no_transcript: int = 0
    categories: Dict[str, int] = field(default_factory=dict)
    languages: Dict[str, int] = field(default_factory=dict)


@dataclass
class FinetuneJobStatus:
    """Status of a fine-tuning job."""
    job_id: str
    status: str  # QUEUED, VALIDATED, RUNNING, SUCCEEDED, FAILED, CANCELLED
    fine_tuned_model: Optional[str] = None
    training_steps: int = 0
    error: Optional[str] = None
    created_at: Optional[str] = None


# =============================================================================
# 1. EXPORT TRAINING DATA FROM DB
# =============================================================================

async def export_training_data(
    db: AsyncSession,
    max_samples: int = 500,
    min_quality_chars: int = MIN_ANALYSIS_CHARS,
    categories: Optional[List[str]] = None,
    lang: Optional[str] = None,
) -> ExportResult:
    """
    Export high-quality analysis pairs from the database.

    Queries Summary table for analyses that meet quality thresholds,
    then builds JSONL-compatible training pairs.

    Args:
        db: Async database session
        max_samples: Maximum training examples to export
        min_quality_chars: Minimum analysis content length
        categories: Filter specific categories (None = all)
        lang: Filter language (None = all)

    Returns:
        ExportResult with training/validation splits and stats
    """
    from db.database import Summary
    from videos.analysis import build_analysis_prompt

    result = ExportResult()

    # Build query with quality filters
    query = (
        select(Summary)
        .where(
            and_(
                Summary.summary_content.isnot(None),
                func.length(Summary.summary_content) >= min_quality_chars,
                Summary.is_deleted.is_(False) if hasattr(Summary, 'is_deleted') else True,
            )
        )
        .order_by(Summary.created_at.desc())
        .limit(max_samples * 2)  # Fetch extra for filtering
    )

    if lang:
        query = query.where(Summary.lang == lang)

    db_result = await db.execute(query)
    summaries = db_result.scalars().all()

    logger.info(f"Fine-tuning export: found {len(summaries)} candidate analyses")

    samples: List[Dict[str, Any]] = []

    for summary in summaries:
        if len(samples) >= max_samples:
            break

        # ── Quality filters ──────────────────────────────────────────────
        content = summary.summary_content or ""
        if len(content) < min_quality_chars:
            result.skipped_short += 1
            continue

        # Need transcript data for the user prompt
        transcript = getattr(summary, 'transcript_text', None) or ""
        if not transcript and hasattr(summary, 'video_id'):
            # Try to get from transcript cache
            transcript = await _get_cached_transcript(db, summary.video_id)

        if len(transcript) < MIN_TRANSCRIPT_CHARS:
            result.skipped_no_transcript += 1
            continue

        # ── Build training pair ──────────────────────────────────────────
        title = getattr(summary, 'video_title', '') or getattr(summary, 'title', '') or ''
        category = getattr(summary, 'category', 'general') or 'general'
        analysis_lang = getattr(summary, 'lang', 'fr') or 'fr'
        mode = getattr(summary, 'analysis_mode', 'standard') or 'standard'
        channel = getattr(summary, 'video_channel', '') or getattr(summary, 'channel_name', '') or ''
        duration = getattr(summary, 'video_duration', 0) or 0

        # Filter by category if specified
        if categories and category not in categories:
            continue

        # Truncate for token budget
        truncated_transcript = transcript[:MAX_TRANSCRIPT_CHARS]
        truncated_content = content[:MAX_ANALYSIS_CHARS]

        try:
            system_prompt, user_prompt = build_analysis_prompt(
                title=title,
                transcript=truncated_transcript,
                category=category,
                lang=analysis_lang,
                mode=mode,
                duration=duration,
                channel=channel,
            )
        except Exception as e:
            logger.debug(f"Skipping sample (prompt build error): {e}")
            continue

        sample = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": truncated_content},
            ]
        }

        samples.append(sample)

        # Track stats
        result.categories[category] = result.categories.get(category, 0) + 1
        result.languages[analysis_lang] = result.languages.get(analysis_lang, 0) + 1

    # ── Split training / validation ──────────────────────────────────────
    split_idx = max(1, int(len(samples) * (1 - VALIDATION_SPLIT)))
    result.training_samples = samples[:split_idx]
    result.validation_samples = samples[split_idx:]
    result.total_exported = len(samples)

    logger.info(
        f"Fine-tuning export complete: {len(result.training_samples)} training, "
        f"{len(result.validation_samples)} validation, "
        f"{result.skipped_short} skipped (short), "
        f"{result.skipped_no_transcript} skipped (no transcript)"
    )

    return result


async def _get_cached_transcript(db: AsyncSession, video_id: str) -> str:
    """Try to retrieve transcript from TranscriptCache."""
    try:
        from db.database import TranscriptCache, TranscriptCacheChunk

        cache_result = await db.execute(
            select(TranscriptCache).where(TranscriptCache.video_id == video_id).limit(1)
        )
        cache = cache_result.scalar_one_or_none()
        if not cache:
            return ""

        chunks_result = await db.execute(
            select(TranscriptCacheChunk)
            .where(TranscriptCacheChunk.cache_id == cache.id)
            .order_by(TranscriptCacheChunk.chunk_index)
        )
        chunks = chunks_result.scalars().all()
        return "".join(c.content for c in chunks)
    except Exception:
        return ""


# =============================================================================
# 2. BUILD JSONL FILE
# =============================================================================

def build_jsonl(samples: List[Dict[str, Any]]) -> bytes:
    """
    Convert training samples to JSONL bytes for upload.

    Each line is a JSON object with {"messages": [...]}.
    """
    lines = []
    for sample in samples:
        lines.append(json.dumps(sample, ensure_ascii=False))
    return "\n".join(lines).encode("utf-8")


# =============================================================================
# 3. UPLOAD FILE TO MISTRAL
# =============================================================================

async def upload_training_file(
    jsonl_bytes: bytes,
    filename: str = "deepsight_training.jsonl",
    purpose: str = "fine-tune",
) -> Optional[str]:
    """
    Upload a JSONL file to Mistral Files API.

    Returns: file_id on success, None on failure.
    """
    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("Mistral API key not configured")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            MISTRAL_FILES_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (filename, jsonl_bytes, "application/jsonl")},
            data={"purpose": purpose},
        )

        if response.status_code not in (200, 201):
            error = response.text[:300]
            logger.error(f"File upload failed: {response.status_code} - {error}")
            raise RuntimeError(f"Mistral file upload failed: {response.status_code}")

        data = response.json()
        file_id = data.get("id")
        logger.info(f"Training file uploaded: {file_id} ({len(jsonl_bytes)} bytes)")
        return file_id


# =============================================================================
# 4. CREATE FINE-TUNING JOB
# =============================================================================

async def create_finetune_job(
    training_file_id: str,
    validation_file_id: Optional[str] = None,
    base_model: str = DEFAULT_BASE_MODEL,
    hyperparameters: Optional[Dict[str, Any]] = None,
    suffix: str = "deepsight",
    auto_start: bool = True,
) -> FinetuneJobStatus:
    """
    Create a fine-tuning job on Mistral.

    Args:
        training_file_id: ID of uploaded training JSONL
        validation_file_id: Optional validation file ID
        base_model: Base model to fine-tune
        hyperparameters: Training config (steps, lr)
        suffix: Model name suffix
        auto_start: Start training immediately

    Returns:
        FinetuneJobStatus with job details
    """
    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("Mistral API key not configured")

    params = hyperparameters or DEFAULT_HYPERPARAMS

    payload: Dict[str, Any] = {
        "model": base_model,
        "training_files": [{"file_id": training_file_id, "weight": 1}],
        "hyperparameters": params,
        "auto_start": auto_start,
        "suffix": suffix,
    }

    if validation_file_id:
        payload["validation_files"] = [validation_file_id]

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            MISTRAL_FINETUNE_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

        if response.status_code not in (200, 201):
            error = response.text[:300]
            logger.error(f"Fine-tuning job creation failed: {error}")
            raise RuntimeError(f"Job creation failed: {response.status_code} - {error}")

        data = response.json()

        return FinetuneJobStatus(
            job_id=data.get("id", ""),
            status=data.get("status", "UNKNOWN"),
            fine_tuned_model=data.get("fine_tuned_model"),
            created_at=data.get("created_at"),
        )


# =============================================================================
# 5. MONITOR JOB
# =============================================================================

async def get_job_status(job_id: str) -> FinetuneJobStatus:
    """Get current status of a fine-tuning job."""
    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("Mistral API key not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{MISTRAL_FINETUNE_URL}/{job_id}",
            headers={"Authorization": f"Bearer {api_key}"},
        )

        if response.status_code != 200:
            raise RuntimeError(f"Job status check failed: {response.status_code}")

        data = response.json()

        return FinetuneJobStatus(
            job_id=data.get("id", job_id),
            status=data.get("status", "UNKNOWN"),
            fine_tuned_model=data.get("fine_tuned_model"),
            training_steps=data.get("trained_tokens", 0),
            error=data.get("error"),
            created_at=data.get("created_at"),
        )


async def wait_for_job(
    job_id: str,
    max_wait: float = 7200.0,  # 2h max
    poll_interval: float = 30.0,
    on_progress: Optional[callable] = None,
) -> FinetuneJobStatus:
    """
    Poll a fine-tuning job until completion or failure.

    Args:
        job_id: The job ID to monitor
        max_wait: Maximum wait time in seconds
        poll_interval: Seconds between status checks
        on_progress: Optional callback(status) for progress updates

    Returns:
        Final FinetuneJobStatus
    """
    start = time.time()
    terminal_statuses = {"SUCCEEDED", "FAILED", "CANCELLED", "TIMEOUT_EXCEEDED"}

    while time.time() - start < max_wait:
        status = await get_job_status(job_id)

        if on_progress:
            on_progress(status)

        logger.info(f"Fine-tuning job {job_id}: {status.status}")

        if status.status in terminal_statuses:
            return status

        await asyncio.sleep(poll_interval)

    # Timeout
    return FinetuneJobStatus(
        job_id=job_id,
        status="TIMEOUT_LOCAL",
        error=f"Local timeout after {max_wait}s",
    )


async def start_job(job_id: str) -> FinetuneJobStatus:
    """Start a previously created (auto_start=False) fine-tuning job."""
    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("Mistral API key not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{MISTRAL_FINETUNE_URL}/{job_id}/start",
            headers={"Authorization": f"Bearer {api_key}"},
        )

        if response.status_code != 200:
            raise RuntimeError(f"Job start failed: {response.status_code}")

        data = response.json()
        return FinetuneJobStatus(
            job_id=data.get("id", job_id),
            status=data.get("status", "RUNNING"),
        )


async def cancel_job(job_id: str) -> bool:
    """Cancel a running fine-tuning job."""
    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("Mistral API key not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{MISTRAL_FINETUNE_URL}/{job_id}/cancel",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        return response.status_code == 200


# =============================================================================
# 6. LIST JOBS
# =============================================================================

async def list_jobs() -> List[FinetuneJobStatus]:
    """List all fine-tuning jobs."""
    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("Mistral API key not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            MISTRAL_FINETUNE_URL,
            headers={"Authorization": f"Bearer {api_key}"},
        )

        if response.status_code != 200:
            raise RuntimeError(f"List jobs failed: {response.status_code}")

        data = response.json()
        jobs = data.get("data", [])

        return [
            FinetuneJobStatus(
                job_id=j.get("id", ""),
                status=j.get("status", "UNKNOWN"),
                fine_tuned_model=j.get("fine_tuned_model"),
                created_at=j.get("created_at"),
            )
            for j in jobs
        ]


# =============================================================================
# 7. FULL PIPELINE — Export → Upload → Train
# =============================================================================

async def run_finetune_pipeline(
    db: AsyncSession,
    max_samples: int = 300,
    base_model: str = DEFAULT_BASE_MODEL,
    hyperparameters: Optional[Dict[str, Any]] = None,
    auto_start: bool = False,
    lang: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full fine-tuning pipeline: export data → upload → create job.

    This does NOT wait for the job to complete (training takes 30min-2h).
    Use get_job_status() or wait_for_job() to monitor progress.

    Args:
        db: Database session
        max_samples: Max training examples to export
        base_model: Model to fine-tune
        hyperparameters: Training config
        auto_start: Start training immediately (True) or just validate (False)
        lang: Filter exports by language

    Returns:
        Dict with export stats, file IDs, and job info
    """
    logger.info(f"Starting fine-tuning pipeline (max_samples={max_samples}, model={base_model})")

    # ── Step 1: Export training data ─────────────────────────────────────
    export = await export_training_data(db, max_samples=max_samples, lang=lang)

    if export.total_exported < MIN_TRAINING_SAMPLES:
        return {
            "success": False,
            "error": f"Insufficient training data: {export.total_exported} samples "
                     f"(minimum: {MIN_TRAINING_SAMPLES})",
            "export_stats": {
                "total": export.total_exported,
                "skipped_short": export.skipped_short,
                "skipped_no_transcript": export.skipped_no_transcript,
            },
        }

    # ── Step 2: Build JSONL files ────────────────────────────────────────
    training_jsonl = build_jsonl(export.training_samples)
    validation_jsonl = build_jsonl(export.validation_samples) if export.validation_samples else None

    logger.info(
        f"JSONL built: training={len(training_jsonl)} bytes, "
        f"validation={len(validation_jsonl) if validation_jsonl else 0} bytes"
    )

    # ── Step 3: Upload files ─────────────────────────────────────────────
    training_file_id = await upload_training_file(
        training_jsonl, filename="deepsight_training.jsonl"
    )

    validation_file_id = None
    if validation_jsonl:
        validation_file_id = await upload_training_file(
            validation_jsonl, filename="deepsight_validation.jsonl"
        )

    # ── Step 4: Create job ───────────────────────────────────────────────
    job = await create_finetune_job(
        training_file_id=training_file_id,
        validation_file_id=validation_file_id,
        base_model=base_model,
        hyperparameters=hyperparameters,
        auto_start=auto_start,
    )

    logger.info(f"Fine-tuning job created: {job.job_id} (status={job.status})")

    return {
        "success": True,
        "job_id": job.job_id,
        "job_status": job.status,
        "base_model": base_model,
        "auto_start": auto_start,
        "export_stats": {
            "total": export.total_exported,
            "training": len(export.training_samples),
            "validation": len(export.validation_samples),
            "skipped_short": export.skipped_short,
            "skipped_no_transcript": export.skipped_no_transcript,
            "categories": export.categories,
            "languages": export.languages,
        },
        "file_ids": {
            "training": training_file_id,
            "validation": validation_file_id,
        },
    }
