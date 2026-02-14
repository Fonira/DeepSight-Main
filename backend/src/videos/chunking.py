"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📑 HIERARCHICAL DIGEST PIPELINE v1.0 — Transcript Chunking                        ║
║                                                                                    ║
║  Splits transcripts into timed chunks, summarizes each with Mistral Small,       ║
║  then assembles a comprehensive full digest with Mistral Large.                  ║
║                                                                                    ║
║  Pipeline:                                                                         ║
║  1. chunk_transcript() → Split by time/chars with intelligent boundaries          ║
║  2. digest_chunk() → Summarize each chunk (~500-800 chars) with Mistral Small    ║
║  3. build_full_digest() → Assemble from chunks (~6-10K chars) with Mistral Large ║
║  4. process_video_chunks() → Store in DB and update Summary                      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import re
import logging
from typing import Optional, List
from dataclasses import dataclass
from datetime import datetime

from mistralai import Mistral
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_mistral_key, MISTRAL_MODELS
from core.logging import logger

# ═══════════════════════════════════════════════════════════════════════════════
# ⚙️ CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

CHUNK_CONFIG = {
    "short": {
        "max_duration": 900,          # <15min: no chunking (single chunk)
        "chunk_minutes": 0,
    },
    "medium": {
        "max_duration": 3600,         # 15-60min: 10min chunks
        "chunk_minutes": 10,
    },
    "long": {
        "max_duration": 10800,        # 1-3h: 15min chunks
        "chunk_minutes": 15,
    },
    "very_long": {
        "max_duration": float("inf"), # 3h+: 20min chunks
        "chunk_minutes": 20,
    },
}

DIGEST_MODEL = "mistral-small-latest"      # Fast, cheap → chunk summaries
SYNTHESIS_MODEL = "mistral-large-latest"   # Quality → full digest assembly

MAX_CHUNK_CHARS = 15000        # Max chars per chunk before truncation
MIN_CHUNK_CHARS = 500          # Min chars for a chunk to be worth summarizing
MAX_DIGEST_CHARS = 800         # Target chars per chunk digest
MAX_FULL_DIGEST_CHARS = 10000  # Target chars for assembled full digest
MAX_CONCURRENT_DIGESTS = 5     # Parallel Mistral calls limit


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 DATA MODELS
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ChunkData:
    """Represents a transcript chunk with timing info."""
    index: int
    start_seconds: int
    end_seconds: int
    text: str
    digest: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 INTERNAL UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def _get_chunk_duration(video_duration_seconds: int) -> int:
    """
    Determine chunk duration in seconds based on video length.
    
    Returns:
        Chunk duration in seconds (0 for short videos = single chunk)
    """
    for tier, config in CHUNK_CONFIG.items():
        if video_duration_seconds <= config["max_duration"]:
            return config["chunk_minutes"] * 60
    return 20 * 60  # fallback: 20 min


def _format_time(seconds: int) -> str:
    """
    Format seconds to HH:MM:SS or MM:SS.
    
    Args:
        seconds: Time in seconds
        
    Returns:
        Formatted time string
    """
    if seconds <= 0:
        return "00:00"
    
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _parse_timestamps(transcript: str) -> list[tuple[int, str]]:
    """
    Extract timestamp-text pairs from transcript.
    
    Supports multiple formats:
    - [HH:MM:SS] text
    - [MM:SS] text
    - HH:MM:SS text
    - MM:SS text
    
    Args:
        transcript: Raw transcript text
        
    Returns:
        List of (seconds, text) tuples sorted by timestamp
    """
    # Common timestamp patterns in YouTube transcripts
    patterns = [
        r'\[(\d{1,2}):(\d{2}):(\d{2})\]\s*(.*?)(?=\[|\Z)',   # [HH:MM:SS] text
        r'\[(\d{1,2}):(\d{2})\]\s*(.*?)(?=\[|\Z)',             # [MM:SS] text
        r'(\d{1,2}):(\d{2}):(\d{2})\s+(.*?)(?=\d{1,2}:\d{2}|\Z)',  # HH:MM:SS text
        r'(\d{1,2}):(\d{2})\s+(.*?)(?=\d{1,2}:\d{2}|\Z)',          # MM:SS text
    ]
    
    segments = []
    
    for pattern in patterns:
        matches = list(re.finditer(pattern, transcript, re.DOTALL))
        # Need at least 3 matches to consider this pattern valid
        if len(matches) >= 3:
            for match in matches:
                groups = match.groups()
                
                if len(groups) == 4:  # HH:MM:SS + text
                    seconds = int(groups[0]) * 3600 + int(groups[1]) * 60 + int(groups[2])
                    text = groups[3].strip()
                elif len(groups) == 3:  # MM:SS + text
                    seconds = int(groups[0]) * 60 + int(groups[1])
                    text = groups[2].strip()
                else:
                    continue
                
                if text:
                    segments.append((seconds, text))
            
            break  # Use first matching pattern that found enough matches
    
    return sorted(segments, key=lambda x: x[0])


# ═══════════════════════════════════════════════════════════════════════════════
# 📏 CHUNKING STRATEGIES
# ═══════════════════════════════════════════════════════════════════════════════

def _chunk_by_timestamps(
    segments: list[tuple[int, str]],
    chunk_duration: int,
    video_duration: int
) -> List[ChunkData]:
    """
    Group timestamped segments into chunks of target duration.
    
    Args:
        segments: List of (timestamp_seconds, text) tuples
        chunk_duration: Target duration per chunk in seconds
        video_duration: Total video duration in seconds
        
    Returns:
        List of ChunkData with timestamps
    """
    chunks = []
    current_texts = []
    chunk_start = 0
    chunk_index = 0
    
    for seconds, text in segments:
        if current_texts and (seconds - chunk_start) >= chunk_duration:
            # Flush current chunk
            chunks.append(ChunkData(
                index=chunk_index,
                start_seconds=chunk_start,
                end_seconds=seconds,
                text=" ".join(current_texts)
            ))
            chunk_index += 1
            current_texts = []
            chunk_start = seconds
        
        current_texts.append(text)
    
    # Flush remaining
    if current_texts:
        chunks.append(ChunkData(
            index=chunk_index,
            start_seconds=chunk_start,
            end_seconds=video_duration,
            text=" ".join(current_texts)
        ))
    
    return chunks


def _chunk_by_characters(
    transcript: str,
    chunk_duration: int,
    video_duration: int
) -> List[ChunkData]:
    """
    Split transcript by characters with estimated timing.
    
    Uses chars-per-second ratio to estimate chunk boundaries.
    Tries to break at sentence boundaries for readability.
    
    Args:
        transcript: Full transcript text
        chunk_duration: Target chunk duration in seconds
        video_duration: Total video duration in seconds
        
    Returns:
        List of ChunkData with estimated timestamps
    """
    total_chars = len(transcript)
    chars_per_second = total_chars / max(video_duration, 1)
    target_chars_per_chunk = int(chars_per_second * chunk_duration)
    target_chars_per_chunk = min(target_chars_per_chunk, MAX_CHUNK_CHARS)
    target_chars_per_chunk = max(target_chars_per_chunk, MIN_CHUNK_CHARS * 2)
    
    chunks = []
    pos = 0
    chunk_index = 0
    
    while pos < total_chars:
        end = min(pos + target_chars_per_chunk, total_chars)
        
        # Try to break at sentence boundary
        if end < total_chars:
            # Look for sentence end within last 20% of chunk
            search_start = end - int(target_chars_per_chunk * 0.2)
            for punct in ['. ', '.\n', '? ', '!\n', '! ', '?\n']:
                last_punct = transcript.rfind(punct, search_start, end + 200)
                if last_punct > search_start:
                    end = last_punct + len(punct)
                    break
        
        chunk_text = transcript[pos:end].strip()
        
        if chunk_text and len(chunk_text) >= MIN_CHUNK_CHARS:
            start_seconds = int(pos / chars_per_second) if chars_per_second > 0 else 0
            end_seconds = int(end / chars_per_second) if chars_per_second > 0 else video_duration
            
            chunks.append(ChunkData(
                index=chunk_index,
                start_seconds=min(start_seconds, video_duration),
                end_seconds=min(end_seconds, video_duration),
                text=chunk_text
            ))
            chunk_index += 1
        
        pos = end
    
    return chunks


# ═══════════════════════════════════════════════════════════════════════════════
# 📑 PUBLIC CHUNKING API
# ═══════════════════════════════════════════════════════════════════════════════

def chunk_transcript(
    transcript: str,
    video_duration_seconds: int
) -> List[ChunkData]:
    """
    Split transcript into timed chunks.
    
    Strategy:
    1. If video < 15min: return single chunk (no splitting)
    2. Try timestamp-based splitting first (more accurate)
    3. Fall back to character-based splitting with estimated timing
    
    Args:
        transcript: Full transcript text
        video_duration_seconds: Video duration in seconds
        
    Returns:
        List of ChunkData with timing and text
    """
    if not transcript or len(transcript.strip()) < MIN_CHUNK_CHARS:
        return []
    
    chunk_duration = _get_chunk_duration(video_duration_seconds)
    
    if chunk_duration == 0:
        # Short video: single chunk, no splitting
        logger.info(f"Short video ({video_duration_seconds}s): single chunk")
        return [ChunkData(
            index=0,
            start_seconds=0,
            end_seconds=video_duration_seconds,
            text=transcript.strip()
        )]
    
    # Try timestamp-based chunking
    timed_segments = _parse_timestamps(transcript)
    
    if timed_segments:
        logger.info(f"Using timestamp-based chunking: {len(timed_segments)} segments")
        return _chunk_by_timestamps(timed_segments, chunk_duration, video_duration_seconds)
    else:
        logger.info(f"Using character-based chunking with {chunk_duration}s target")
        return _chunk_by_characters(transcript, chunk_duration, video_duration_seconds)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 MISTRAL INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

async def digest_chunk(
    chunk: ChunkData,
    video_title: str,
    category: str = "general"
) -> str:
    """
    Summarize a single transcript chunk using Mistral Small.
    
    Produces a concise digest of ~500-800 chars capturing:
    - Key ideas and arguments
    - Facts, figures, data
    - Important terminology
    - Speakers/sources cited
    
    Args:
        chunk: ChunkData to summarize
        video_title: Title of the video
        category: Video category (for context)
        
    Returns:
        Chunk digest string (~500-800 chars)
    """
    client = Mistral(api_key=get_mistral_key())
    
    # Truncate chunk text if excessively long
    text = chunk.text[:MAX_CHUNK_CHARS]
    time_range = _format_time(chunk.start_seconds) + " → " + _format_time(chunk.end_seconds)
    
    prompt = f"""Résume ce segment de la vidéo "{video_title}" ({time_range}).

SEGMENT:
{text}

CONSIGNES:
- Résumé DENSE en 3-6 phrases (max 800 caractères)
- Capture les idées clés, arguments, données factuelles
- Mentionne les intervenants ou sources cités si pertinent
- Conserve la terminologie technique importante
- Ne commence PAS par "Ce segment parle de..." — va droit au contenu"""

    try:
        response = await client.chat.complete_async(
            model=DIGEST_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.3,
        )
        digest = response.choices[0].message.content.strip()
        logger.info(
            f"Chunk digest complete",
            extra={"chunk_index": chunk.index, "digest_chars": len(digest)}
        )
        return digest
    except Exception as e:
        logger.error(
            f"Failed to digest chunk",
            extra={"chunk_index": chunk.index, "error": str(e)}
        )
        # Fallback: extract first and last sentences
        sentences = text.split('. ')
        if len(sentences) > 4:
            return '. '.join(sentences[:2]) + '... ' + '. '.join(sentences[-2:])
        return text[:MAX_DIGEST_CHARS]


async def build_full_digest(
    chunks: List[ChunkData],
    video_title: str,
    video_duration: int,
    category: str = "general"
) -> str:
    """
    Assemble chunk digests into a comprehensive full digest.
    
    Uses Mistral Large to synthesize chunk summaries into a cohesive,
    well-structured document that preserves all important information.
    
    Args:
        chunks: List of ChunkData with digests already populated
        video_title: Title of the video
        video_duration: Total video duration in seconds
        category: Video category (for context)
        
    Returns:
        Full digest string (~6-10K chars)
    """
    if not chunks:
        return ""
    
    # If only 1 chunk, return its digest directly
    if len(chunks) == 1 and chunks[0].digest:
        logger.info("Single chunk video: returning chunk digest as full digest")
        return chunks[0].digest
    
    # Build structured input from chunk digests
    digest_parts = []
    for chunk in chunks:
        if chunk.digest:
            time_range = (
                _format_time(chunk.start_seconds) + "-" +
                _format_time(chunk.end_seconds)
            )
            digest_parts.append(f"[{time_range}] {chunk.digest}")
    
    combined = "\n\n".join(digest_parts)
    duration_str = _format_time(video_duration)
    
    prompt = f"""Tu es un analyste de contenu expert. À partir des résumés segmentés ci-dessous,
produis une SYNTHÈSE COMPLÈTE de la vidéo "{video_title}" (durée: {duration_str}).

RÉSUMÉS SEGMENTÉS:
{combined}

CONSIGNES:
- Synthèse structurée et fluide de 1500-2500 mots (~6000-10000 caractères)
- Couvre l'INTÉGRALITÉ du contenu, du début à la fin
- Organise par thèmes/arguments principaux, pas chronologiquement
- Conserve les données chiffrées, noms propres, sources citées
- Utilise les marqueurs épistémiques: [SOLIDE], [PLAUSIBLE], [INCERTAIN], [À VÉRIFIER]
- Inclus une section "Points clés" avec 5-8 bullet points en fin
- Ne perds aucune idée importante — c'est la base pour la méta-analyse"""

    client = Mistral(api_key=get_mistral_key())
    
    try:
        response = await client.chat.complete_async(
            model=SYNTHESIS_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
            temperature=0.4,
        )
        full_digest = response.choices[0].message.content.strip()
        logger.info(
            f"Full digest built",
            extra={"chunk_count": len(chunks), "digest_chars": len(full_digest)}
        )
        return full_digest
    except Exception as e:
        logger.error(
            f"Failed to build full digest",
            extra={"chunk_count": len(chunks), "error": str(e)}
        )
        # Fallback: concatenate chunk digests
        return combined[:MAX_FULL_DIGEST_CHARS]


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

async def process_video_chunks(
    transcript: str,
    video_duration: int,
    video_title: str,
    summary_id: int,
    db: AsyncSession,
    category: str = "general"
) -> str:
    """
    Full pipeline: chunk → digest each → build full digest → store in DB.
    
    Steps:
    1. Split transcript into timed chunks
    2. Summarize each chunk with Mistral Small (parallel, max 5 concurrent)
    3. Build full digest from chunk digests with Mistral Large
    4. Store chunks and full_digest in database
    5. Return the full_digest
    
    Args:
        transcript: Full transcript text
        video_duration: Video duration in seconds
        video_title: Video title
        summary_id: ID of the Summary record to update
        db: AsyncSession for database operations
        category: Video category
        
    Returns:
        The assembled full_digest string
    """
    from db.database import VideoChunk, Summary
    
    logger.info(
        f"Starting chunking pipeline",
        extra={
            "summary_id": summary_id,
            "transcript_chars": len(transcript),
            "duration_seconds": video_duration
        }
    )
    
    # Step 1: Chunk the transcript
    chunks = chunk_transcript(transcript, video_duration)
    
    if not chunks:
        logger.warning(f"No chunks produced for summary {summary_id}")
        return ""
    
    logger.info(f"Produced {len(chunks)} chunks", extra={"summary_id": summary_id})
    
    # Step 2: Digest each chunk in parallel (with concurrency limit)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_DIGESTS)
    
    async def digest_with_semaphore(chunk: ChunkData) -> ChunkData:
        async with semaphore:
            chunk.digest = await digest_chunk(chunk, video_title, category)
            return chunk
    
    tasks = [digest_with_semaphore(c) for c in chunks]
    chunks = await asyncio.gather(*tasks)
    
    logger.info(
        f"All chunks digested",
        extra={"summary_id": summary_id, "chunk_count": len(chunks)}
    )
    
    # Step 3: Store chunks in DB
    for chunk in chunks:
        db_chunk = VideoChunk(
            summary_id=summary_id,
            chunk_index=chunk.index,
            start_seconds=chunk.start_seconds,
            end_seconds=chunk.end_seconds,
            chunk_text=chunk.text,
            chunk_digest=chunk.digest,
        )
        db.add(db_chunk)
    
    await db.flush()
    
    logger.info(
        f"Chunks stored in database",
        extra={"summary_id": summary_id, "chunk_count": len(chunks)}
    )
    
    # Step 4: Build full digest from chunk digests
    full_digest = await build_full_digest(chunks, video_title, video_duration, category)
    
    # Step 5: Update Summary with full_digest
    result = await db.execute(select(Summary).where(Summary.id == summary_id))
    summary = result.scalar_one_or_none()
    if summary:
        summary.full_digest = full_digest
    
    await db.commit()
    
    logger.info(
        f"Chunking pipeline complete",
        extra={
            "summary_id": summary_id,
            "chunk_count": len(chunks),
            "full_digest_chars": len(full_digest)
        }
    )
    
    return full_digest
