"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📦 PLAYLIST BATCH PIPELINE — Mistral Batch API integration (50% cheaper)         ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  • Prépare les prompts d'analyse pour toutes les vidéos d'une playlist           ║
║  • Soumet le tout en un seul batch Mistral (50% réduction de coût)               ║
║  • Fallback: si le batch échoue, retour au pipeline séquentiel classique         ║
║  • Réutilise build_analysis_prompt() de videos/analysis.py                        ║
║  • Compatible avec le cache existant (skip les vidéos déjà analysées)            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from core.llm_provider import llm_complete_batch
from videos.analysis import build_analysis_prompt, detect_category
from transcripts import extract_video_id, get_video_info, get_transcript_with_timestamps

logger = logging.getLogger("deepsight.playlists.batch")


# =============================================================================
# DATA TYPES
# =============================================================================


class BatchVideoInput:
    """Input data for one video in a batch analysis."""

    def __init__(
        self,
        video_id: str,
        title: str,
        channel: str,
        duration: int,
        transcript: str,
        category: str,
        thumbnail_url: str = "",
        description: str = "",
    ):
        self.video_id = video_id
        self.title = title
        self.channel = channel
        self.duration = duration
        self.transcript = transcript
        self.category = category
        self.thumbnail_url = thumbnail_url
        self.description = description


class BatchVideoResult:
    """Result from batch analysis of one video."""

    def __init__(
        self,
        video_id: str,
        title: str,
        success: bool,
        content: str = "",
        tokens_used: int = 0,
        error: Optional[str] = None,
    ):
        self.video_id = video_id
        self.title = title
        self.success = success
        self.content = content
        self.tokens_used = tokens_used
        self.error = error


# =============================================================================
# PHASE 1: Prepare video data (parallel transcript extraction)
# =============================================================================


async def prepare_videos_for_batch(
    urls: List[str],
    lang: str = "fr",
    max_concurrent: int = 5,
) -> Tuple[List[BatchVideoInput], List[Dict[str, str]]]:
    """
    Extract transcripts and metadata for all videos in parallel.

    Returns:
        (prepared_videos, skipped) — ready for batch submission + skip reasons
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    prepared: List[Optional[BatchVideoInput]] = [None] * len(urls)
    skipped: List[Dict[str, str]] = []

    async def _prepare_one(idx: int, url: str):
        async with semaphore:
            video_id = extract_video_id(url)
            if not video_id:
                skipped.append({"url": url, "reason": "URL invalide"})
                return

            try:
                # Get metadata
                info = await get_video_info(video_id)
                if not info:
                    skipped.append({"video_id": video_id, "reason": "Métadonnées indisponibles"})
                    return

                title = info.get("title", "")
                channel = info.get("channel", "")
                duration = int(info.get("duration", 0) or 0)
                thumbnail = info.get("thumbnail_url", info.get("thumbnail", ""))
                description = info.get("description", "")

                # Get transcript
                transcript_result = await get_transcript_with_timestamps(
                    video_id,
                    lang,
                    duration=duration,
                )

                transcript = ""
                if transcript_result is None:
                    skipped.append({"video_id": video_id, "title": title, "reason": "Transcript indisponible"})
                    return
                elif isinstance(transcript_result, tuple):
                    transcript = transcript_result[0] if transcript_result else ""
                elif isinstance(transcript_result, str):
                    transcript = transcript_result
                else:
                    transcript = str(transcript_result)

                if not transcript.strip():
                    skipped.append({"video_id": video_id, "title": title, "reason": "Transcript vide"})
                    return

                # Detect category
                cat_result = detect_category(
                    title=title,
                    description=description,
                    transcript=transcript[:2000],
                    channel=channel,
                )
                category = cat_result[0] if isinstance(cat_result, tuple) else cat_result

                prepared[idx] = BatchVideoInput(
                    video_id=video_id,
                    title=title,
                    channel=channel,
                    duration=duration,
                    transcript=transcript,
                    category=category,
                    thumbnail_url=thumbnail,
                    description=description,
                )

                logger.info(f"[BATCH-PREP] Ready: {video_id} ({title[:40]})")

            except Exception as e:
                skipped.append({"video_id": video_id, "reason": str(e)[:200]})

    tasks = [_prepare_one(i, url) for i, url in enumerate(urls)]
    await asyncio.gather(*tasks, return_exceptions=True)

    valid = [v for v in prepared if v is not None]
    logger.info(f"[BATCH-PREP] {len(valid)}/{len(urls)} videos ready, {len(skipped)} skipped")

    return valid, skipped


# =============================================================================
# PHASE 2: Build batch requests from prepared videos
# =============================================================================


def build_batch_requests(
    videos: List[BatchVideoInput],
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-2603",
) -> List[Dict]:
    """
    Build llm_complete_batch items from prepared videos.

    Returns list of dicts with "id" and "messages" keys,
    ready for llm_complete_batch().
    """
    items = []

    for video in videos:
        system_prompt, user_prompt = build_analysis_prompt(
            title=video.title,
            transcript=video.transcript,
            category=video.category,
            lang=lang,
            mode=mode,
            duration=video.duration,
            channel=video.channel,
            description=video.description,
        )

        # Calculate max_tokens (same logic as generate_summary)
        base_tokens = {"accessible": 2500, "standard": 5000, "expert": 10000}.get(mode, 5000)
        if video.duration > 1800:
            duration_multiplier = min(2.0, 1.0 + (video.duration - 1800) / 7200)
            base_tokens = int(base_tokens * duration_multiplier)
        if video.duration > 7200:
            base_tokens = int(base_tokens * 1.3)
        max_limits = {"accessible": 4000, "standard": 12000, "expert": 20000}
        max_tokens = min(base_tokens, max_limits.get(mode, 12000))

        items.append(
            {
                "id": video.video_id,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": max_tokens,
            }
        )

    logger.info(f"[BATCH-BUILD] Built {len(items)} batch requests (mode={mode})")
    return items


# =============================================================================
# PHASE 3: Submit batch and collect results
# =============================================================================


async def run_batch_analysis(
    videos: List[BatchVideoInput],
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-2603",
    max_wait: float = 600.0,
    on_progress: Optional[callable] = None,
) -> List[BatchVideoResult]:
    """
    Submit all video analyses as a single Mistral Batch job.

    Args:
        videos: Prepared video inputs from prepare_videos_for_batch()
        mode: accessible | standard | expert
        lang: fr | en
        model: Mistral model
        max_wait: Max wait for batch completion (seconds)
        on_progress: Optional progress callback

    Returns:
        List of BatchVideoResult (one per video)
    """
    if not videos:
        return []

    items = build_batch_requests(videos, mode=mode, lang=lang, model=model)

    logger.info(f"[BATCH-ANALYSIS] Submitting {len(items)} video analyses (model={model}, 50% discount)")

    # Submit via llm_complete_batch
    results = await llm_complete_batch(
        items=items,
        model=model,
        max_wait=max_wait,
        on_progress=on_progress,
    )

    # Map results back to videos
    video_map = {v.video_id: v for v in videos}
    output = []

    for item, llm_result in zip(items, results):
        video_id = item["id"]
        video = video_map.get(video_id)
        title = video.title if video else video_id

        if llm_result and llm_result.content:
            output.append(
                BatchVideoResult(
                    video_id=video_id,
                    title=title,
                    success=True,
                    content=llm_result.content,
                    tokens_used=llm_result.tokens_total,
                )
            )
        else:
            output.append(
                BatchVideoResult(
                    video_id=video_id,
                    title=title,
                    success=False,
                    error="Batch analysis failed for this video",
                )
            )

    success_count = sum(1 for r in output if r.success)
    total_tokens = sum(r.tokens_used for r in output)

    logger.info(
        f"[BATCH-ANALYSIS] Complete: {success_count}/{len(output)} success, {total_tokens:,} tokens (batch pricing)"
    )

    return output


# =============================================================================
# FULL PIPELINE: Prepare + Batch + Fallback
# =============================================================================


async def run_playlist_batch(
    urls: List[str],
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-2603",
    max_wait: float = 600.0,
    on_progress: Optional[callable] = None,
) -> Tuple[List[BatchVideoResult], List[Dict[str, str]]]:
    """
    Full batch playlist pipeline:
    1. Prepare all videos (parallel transcript extraction)
    2. Submit analyses as a single Mistral Batch job
    3. If batch fails, fall back to sequential llm_complete per video

    Args:
        urls: List of video URLs
        mode, lang, model: Analysis parameters
        max_wait: Max wait for batch (seconds)
        on_progress: Optional progress callback

    Returns:
        (results, skipped) — analysis results + skip reasons
    """
    start_time = datetime.utcnow()

    # Phase 1: Prepare
    logger.info(f"[PLAYLIST-BATCH] Starting: {len(urls)} URLs")
    videos, skipped = await prepare_videos_for_batch(urls, lang=lang)

    if not videos:
        logger.error("[PLAYLIST-BATCH] No videos prepared, all skipped")
        return [], skipped

    # Phase 2: Batch analysis
    try:
        results = await run_batch_analysis(
            videos=videos,
            mode=mode,
            lang=lang,
            model=model,
            max_wait=max_wait,
            on_progress=on_progress,
        )
    except Exception as e:
        logger.error(f"[PLAYLIST-BATCH] Batch failed: {e}, falling back to sequential")
        results = await _sequential_fallback(videos, mode, lang, model)

    elapsed = (datetime.utcnow() - start_time).total_seconds()
    success_count = sum(1 for r in results if r.success)

    logger.info(
        f"[PLAYLIST-BATCH] Pipeline complete: {success_count}/{len(videos)} success, "
        f"{len(skipped)} skipped, {elapsed:.1f}s total"
    )

    return results, skipped


async def _sequential_fallback(
    videos: List[BatchVideoInput],
    mode: str,
    lang: str,
    model: str,
) -> List[BatchVideoResult]:
    """
    Fallback: analyze each video sequentially using llm_complete().
    Used when the Batch API is unavailable or fails.
    """
    from core.llm_provider import llm_complete

    logger.info(f"[BATCH-FALLBACK] Sequential analysis of {len(videos)} videos")

    results = []
    for video in videos:
        try:
            system_prompt, user_prompt = build_analysis_prompt(
                title=video.title,
                transcript=video.transcript,
                category=video.category,
                lang=lang,
                mode=mode,
                duration=video.duration,
                channel=video.channel,
                description=video.description,
            )

            result = await llm_complete(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                model=model,
                max_tokens=5000,
                temperature=0.3,
                timeout=180,
            )

            if result and result.content:
                results.append(
                    BatchVideoResult(
                        video_id=video.video_id,
                        title=video.title,
                        success=True,
                        content=result.content,
                        tokens_used=result.tokens_total,
                    )
                )
            else:
                results.append(
                    BatchVideoResult(
                        video_id=video.video_id,
                        title=video.title,
                        success=False,
                        error="Sequential analysis failed",
                    )
                )

        except Exception as e:
            results.append(
                BatchVideoResult(
                    video_id=video.video_id,
                    title=video.title,
                    success=False,
                    error=str(e)[:200],
                )
            )

    return results


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    "BatchVideoInput",
    "BatchVideoResult",
    "prepare_videos_for_batch",
    "build_batch_requests",
    "run_batch_analysis",
    "run_playlist_batch",
]
