"""
Mistral Batch API — Submit, poll, and retrieve batch inference jobs.

Batch API gives 50% cost reduction for non-realtime workloads.
Used for: playlist analyses, background re-analyses, bulk operations.

Flow:
    1. Build JSONL requests (each line = one chat/completions call)
    2. Upload JSONL file via Files API
    3. Create batch job referencing the uploaded file
    4. Poll job status until SUCCESS/FAILED
    5. Download and parse results

Usage:
    from core.mistral_batch import (
        create_batch_job, poll_batch_job, get_batch_results,
        submit_and_wait, BatchRequest, BatchResult,
    )

    # Quick: submit and wait for results
    requests = [
        BatchRequest(custom_id="video_1", messages=[...], model="mistral-small-2603"),
        BatchRequest(custom_id="video_2", messages=[...], model="mistral-small-2603"),
    ]
    results = await submit_and_wait(requests, max_wait=600)
    for r in results:
        print(r.custom_id, r.content[:100])
"""

import asyncio
import io
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from core.http_client import shared_http_client
from core.config import get_mistral_key

logger = logging.getLogger(__name__)

# =============================================================================
# CONSTANTS
# =============================================================================

MISTRAL_FILES_URL = "https://api.mistral.ai/v1/files"
MISTRAL_BATCH_JOBS_URL = "https://api.mistral.ai/v1/batch/jobs"

# Poll intervals — start fast, slow down over time
POLL_INTERVALS = [2, 3, 5, 5, 10, 10, 15, 15, 30, 30]  # seconds
POLL_INTERVAL_MAX = 30  # after exhausting the list

# Job statuses
STATUS_QUEUED = "QUEUED"
STATUS_RUNNING = "RUNNING"
STATUS_SUCCESS = "SUCCESS"
STATUS_FAILED = "FAILED"
STATUS_TIMEOUT = "TIMEOUT_EXCEEDED"
STATUS_CANCELLED = "CANCELLED"

TERMINAL_STATUSES = {STATUS_SUCCESS, STATUS_FAILED, STATUS_TIMEOUT, STATUS_CANCELLED}


# =============================================================================
# DATA TYPES
# =============================================================================

@dataclass
class BatchRequest:
    """A single request within a batch."""
    custom_id: str                            # Unique ID to match request → result
    messages: List[Dict[str, str]]            # Chat messages (system + user)
    model: str = "mistral-small-2603"
    max_tokens: int = 4000
    temperature: float = 0.3


@dataclass
class BatchResult:
    """A single result from a completed batch."""
    custom_id: str
    success: bool
    content: str = ""
    tokens_input: int = 0
    tokens_output: int = 0
    tokens_total: int = 0
    error: Optional[str] = None


@dataclass
class BatchJobStatus:
    """Status of a batch job."""
    job_id: str
    status: str                               # QUEUED, RUNNING, SUCCESS, FAILED, etc.
    total_requests: int = 0
    completed_requests: int = 0
    failed_requests: int = 0
    output_file_id: Optional[str] = None
    error: Optional[str] = None
    created_at: Optional[str] = None


# =============================================================================
# INTERNAL: Build JSONL content
# =============================================================================

def _build_jsonl(requests: List[BatchRequest]) -> bytes:
    """
    Convert BatchRequests to JSONL format for Mistral Batch API.

    Each line:
    {"custom_id": "...", "body": {"model": "...", "messages": [...], ...}}
    """
    lines = []
    for req in requests:
        line = {
            "custom_id": req.custom_id,
            "body": {
                "model": req.model,
                "messages": req.messages,
                "max_tokens": req.max_tokens,
                "temperature": req.temperature,
            },
        }
        lines.append(json.dumps(line, ensure_ascii=False))

    return "\n".join(lines).encode("utf-8")


# =============================================================================
# STEP 1: Upload JSONL file
# =============================================================================

async def upload_batch_file(
    requests: List[BatchRequest],
    timeout: float = 30.0,
) -> Optional[str]:
    """
    Upload a JSONL batch file to Mistral Files API.

    Returns:
        File ID (str) or None on failure.
    """
    api_key = get_mistral_key()
    if not api_key:
        logger.error("[BATCH] No MISTRAL_API_KEY")
        return None

    jsonl_content = _build_jsonl(requests)
    file_size_kb = len(jsonl_content) / 1024

    logger.info(
        f"[BATCH] Uploading JSONL: {len(requests)} requests, "
        f"{file_size_kb:.1f} KB"
    )

    try:
        async with shared_http_client() as client:
            response = await client.post(
                MISTRAL_FILES_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                files={
                    "file": ("batch_requests.jsonl", jsonl_content, "application/jsonl"),
                },
                data={"purpose": "batch"},
                timeout=timeout
            )

            if response.status_code in (200, 201):
                data = response.json()
                file_id = data.get("id")
                logger.info(f"[BATCH] File uploaded: {file_id}")
                return file_id
            else:
                logger.error(
                    f"[BATCH] Upload failed: {response.status_code} "
                    f"{response.text[:300]}"
                )
                return None

    except Exception as e:
        logger.error(f"[BATCH] Upload exception: {e}")
        return None


# =============================================================================
# STEP 2: Create batch job
# =============================================================================

async def create_batch_job(
    file_id: str,
    model: str = "mistral-small-2603",
    endpoint: str = "/v1/chat/completions",
    metadata: Optional[Dict[str, str]] = None,
    timeout: float = 15.0,
) -> Optional[str]:
    """
    Create a batch job from an uploaded file.

    Returns:
        Job ID (str) or None on failure.
    """
    api_key = get_mistral_key()
    if not api_key:
        return None

    body: Dict = {
        "input_files": [file_id],
        "model": model,
        "endpoint": endpoint,
    }
    if metadata:
        body["metadata"] = metadata

    try:
        async with shared_http_client() as client:
            response = await client.post(
                MISTRAL_BATCH_JOBS_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=timeout
            )

            if response.status_code in (200, 201):
                data = response.json()
                job_id = data.get("id")
                logger.info(f"[BATCH] Job created: {job_id} (model={model})")
                return job_id
            else:
                logger.error(
                    f"[BATCH] Job creation failed: {response.status_code} "
                    f"{response.text[:300]}"
                )
                return None

    except Exception as e:
        logger.error(f"[BATCH] Job creation exception: {e}")
        return None


# =============================================================================
# STEP 3: Poll job status
# =============================================================================

async def poll_batch_job(
    job_id: str,
    timeout: float = 10.0,
) -> BatchJobStatus:
    """
    Get the current status of a batch job.
    """
    api_key = get_mistral_key()
    if not api_key:
        return BatchJobStatus(job_id=job_id, status="ERROR", error="No API key")

    try:
        async with shared_http_client() as client:
            response = await client.get(
                f"{MISTRAL_BATCH_JOBS_URL}/{job_id}",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=timeout
            )

            if response.status_code == 200:
                data = response.json()
                return BatchJobStatus(
                    job_id=job_id,
                    status=data.get("status", "UNKNOWN"),
                    total_requests=data.get("total_requests", 0),
                    completed_requests=data.get("completed_requests", 0),
                    failed_requests=data.get("failed_requests", 0),
                    output_file_id=data.get("output_file"),
                    created_at=data.get("created_at"),
                )
            else:
                return BatchJobStatus(
                    job_id=job_id,
                    status="ERROR",
                    error=f"HTTP {response.status_code}: {response.text[:200]}",
                )

    except Exception as e:
        return BatchJobStatus(
            job_id=job_id, status="ERROR", error=str(e),
        )


# =============================================================================
# STEP 4: Download and parse results
# =============================================================================

async def get_batch_results(
    output_file_id: str,
    timeout: float = 60.0,
) -> List[BatchResult]:
    """
    Download and parse the output JSONL file from a completed batch job.
    """
    api_key = get_mistral_key()
    if not api_key:
        return []

    try:
        async with shared_http_client() as client:
            response = await client.get(
                f"{MISTRAL_FILES_URL}/{output_file_id}/content",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=timeout
            )

            if response.status_code != 200:
                logger.error(
                    f"[BATCH] Download failed: {response.status_code} "
                    f"{response.text[:200]}"
                )
                return []

            results = []
            for line in response.text.strip().split("\n"):
                if not line.strip():
                    continue
                try:
                    entry = json.loads(line)
                    custom_id = entry.get("custom_id", "")
                    resp = entry.get("response", {})
                    error = entry.get("error")

                    if error:
                        results.append(BatchResult(
                            custom_id=custom_id,
                            success=False,
                            error=str(error),
                        ))
                        continue

                    status_code = resp.get("status_code", 0)
                    body = resp.get("body", {})

                    if status_code == 200:
                        choices = body.get("choices", [])
                        content = choices[0]["message"]["content"].strip() if choices else ""
                        usage = body.get("usage", {})
                        results.append(BatchResult(
                            custom_id=custom_id,
                            success=True,
                            content=content,
                            tokens_input=usage.get("prompt_tokens", 0),
                            tokens_output=usage.get("completion_tokens", 0),
                            tokens_total=usage.get("total_tokens", 0),
                        ))
                    else:
                        results.append(BatchResult(
                            custom_id=custom_id,
                            success=False,
                            error=f"API {status_code}: {json.dumps(body)[:200]}",
                        ))

                except json.JSONDecodeError:
                    logger.warning(f"[BATCH] Skipping malformed line: {line[:100]}")
                    continue

            logger.info(
                f"[BATCH] Parsed {len(results)} results "
                f"({sum(1 for r in results if r.success)} success, "
                f"{sum(1 for r in results if not r.success)} failed)"
            )
            return results

    except Exception as e:
        logger.error(f"[BATCH] Download exception: {e}")
        return []


# =============================================================================
# HIGH-LEVEL: Submit and wait for results
# =============================================================================

async def submit_and_wait(
    requests: List[BatchRequest],
    max_wait: float = 600.0,
    on_progress: Optional[callable] = None,
) -> List[BatchResult]:
    """
    Submit a batch job and wait for completion.

    This is the main entry point for batch processing:
    1. Upload JSONL
    2. Create job
    3. Poll until complete
    4. Download results

    Args:
        requests: List of BatchRequest items
        max_wait: Maximum wait time in seconds (default 10 min)
        on_progress: Optional callback(BatchJobStatus) for progress updates

    Returns:
        List of BatchResult items (one per request)
    """
    if not requests:
        return []

    start_time = time.time()

    # Determine the model from first request (Batch API requires single model)
    model = requests[0].model

    logger.info(
        f"[BATCH] submit_and_wait: {len(requests)} requests, "
        f"model={model}, max_wait={max_wait}s"
    )

    # Step 1: Upload
    file_id = await upload_batch_file(requests)
    if not file_id:
        logger.error("[BATCH] File upload failed")
        return [
            BatchResult(custom_id=r.custom_id, success=False, error="Batch upload failed")
            for r in requests
        ]

    # Step 2: Create job
    job_id = await create_batch_job(
        file_id=file_id,
        model=model,
        metadata={"source": "deepsight", "count": str(len(requests))},
    )
    if not job_id:
        logger.error("[BATCH] Job creation failed")
        return [
            BatchResult(custom_id=r.custom_id, success=False, error="Batch job creation failed")
            for r in requests
        ]

    # Step 3: Poll
    poll_idx = 0
    while True:
        elapsed = time.time() - start_time
        if elapsed > max_wait:
            logger.error(f"[BATCH] Timeout: {elapsed:.0f}s > {max_wait}s")
            # Try to cancel
            try:
                api_key = get_mistral_key()
                async with shared_http_client() as client:
                    await client.post(
                        f"{MISTRAL_BATCH_JOBS_URL}/{job_id}/cancel",
                        headers={"Authorization": f"Bearer {api_key}"},
                        timeout=10
                    )
            except Exception:
                pass
            return [
                BatchResult(custom_id=r.custom_id, success=False, error="Batch timeout")
                for r in requests
            ]

        status = await poll_batch_job(job_id)

        if on_progress:
            try:
                await on_progress(status)
            except Exception:
                pass

        logger.info(
            f"[BATCH] Poll: {status.status} "
            f"({status.completed_requests}/{status.total_requests}) "
            f"elapsed={elapsed:.0f}s"
        )

        if status.status in TERMINAL_STATUSES:
            break

        # Adaptive polling interval
        interval = (
            POLL_INTERVALS[poll_idx]
            if poll_idx < len(POLL_INTERVALS)
            else POLL_INTERVAL_MAX
        )
        poll_idx += 1
        await asyncio.sleep(interval)

    # Step 4: Get results
    if status.status != STATUS_SUCCESS:
        logger.error(f"[BATCH] Job ended with status: {status.status}")
        return [
            BatchResult(
                custom_id=r.custom_id, success=False,
                error=f"Batch job {status.status}: {status.error or 'unknown'}",
            )
            for r in requests
        ]

    if not status.output_file_id:
        logger.error("[BATCH] No output file ID in completed job")
        return [
            BatchResult(custom_id=r.custom_id, success=False, error="No output file")
            for r in requests
        ]

    results = await get_batch_results(status.output_file_id)

    elapsed = time.time() - start_time
    success_count = sum(1 for r in results if r.success)
    total_tokens = sum(r.tokens_total for r in results)

    logger.info(
        f"[BATCH] Complete: {success_count}/{len(results)} success, "
        f"{total_tokens:,} tokens, {elapsed:.1f}s total"
    )

    return results


# =============================================================================
# UTILITY: Create inline batch (for <10k requests, no file upload)
# =============================================================================

async def submit_inline_batch(
    requests: List[BatchRequest],
    max_wait: float = 300.0,
    on_progress: Optional[callable] = None,
) -> List[BatchResult]:
    """
    Submit a small batch inline (without file upload).
    Only works for <10k requests — uses the 'requests' parameter directly.
    """
    if not requests:
        return []

    if len(requests) > 9999:
        logger.warning("[BATCH] Too many requests for inline, falling back to file-based")
        return await submit_and_wait(requests, max_wait, on_progress)

    api_key = get_mistral_key()
    if not api_key:
        return [
            BatchResult(custom_id=r.custom_id, success=False, error="No API key")
            for r in requests
        ]

    model = requests[0].model
    start_time = time.time()

    # Build inline requests
    inline_reqs = []
    for req in requests:
        inline_reqs.append({
            "custom_id": req.custom_id,
            "body": {
                "model": req.model,
                "messages": req.messages,
                "max_tokens": req.max_tokens,
                "temperature": req.temperature,
            },
        })

    logger.info(f"[BATCH-INLINE] Submitting {len(requests)} requests (model={model})")

    try:
        async with shared_http_client() as client:
            response = await client.post(
                MISTRAL_BATCH_JOBS_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "requests": inline_reqs,
                    "model": model,
                    "endpoint": "/v1/chat/completions",
                    "metadata": {"source": "deepsight_inline", "count": str(len(requests))},
                },
                timeout=30
            )

            if response.status_code not in (200, 201):
                logger.error(f"[BATCH-INLINE] Failed: {response.status_code}")
                return [
                    BatchResult(custom_id=r.custom_id, success=False, error="Inline batch failed")
                    for r in requests
                ]

            job_id = response.json().get("id")

    except Exception as e:
        logger.error(f"[BATCH-INLINE] Exception: {e}")
        return [
            BatchResult(custom_id=r.custom_id, success=False, error=str(e))
            for r in requests
        ]

    # Poll and get results (reuse same logic)
    poll_idx = 0
    while True:
        elapsed = time.time() - start_time
        if elapsed > max_wait:
            return [
                BatchResult(custom_id=r.custom_id, success=False, error="Batch timeout")
                for r in requests
            ]

        status = await poll_batch_job(job_id)
        if on_progress:
            try:
                await on_progress(status)
            except Exception:
                pass

        if status.status in TERMINAL_STATUSES:
            break

        interval = (
            POLL_INTERVALS[poll_idx]
            if poll_idx < len(POLL_INTERVALS)
            else POLL_INTERVAL_MAX
        )
        poll_idx += 1
        await asyncio.sleep(interval)

    if status.status != STATUS_SUCCESS or not status.output_file_id:
        return [
            BatchResult(custom_id=r.custom_id, success=False,
                        error=f"Batch {status.status}")
            for r in requests
        ]

    return await get_batch_results(status.output_file_id)


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    "BatchRequest",
    "BatchResult",
    "BatchJobStatus",
    "upload_batch_file",
    "create_batch_job",
    "poll_batch_job",
    "get_batch_results",
    "submit_and_wait",
    "submit_inline_batch",
]
