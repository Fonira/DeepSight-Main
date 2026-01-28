# Legacy exports from youtube.py (maintained for backward compatibility)
from .youtube import (
    extract_video_id, extract_playlist_id,
    get_video_info, get_video_info_ytdlp,
    get_transcript, get_transcript_with_timestamps,
    get_playlist_videos, get_playlist_info,
    format_seconds_to_timestamp
)

# New ultra-resilient extractor v7.0
from .ultra_resilient import (
    UltraResilientTranscriptExtractor,
    get_transcript as get_transcript_ultra,
    extract_transcript_for_analysis,
    TranscriptResult,
    ExtractionMethod,
)

# Health monitoring
from .monitor import (
    TranscriptHealthMonitor,
    health_monitor,
    record_extraction_attempt,
    get_optimized_method_order,
    get_transcript_health_report,
)

__all__ = [
    # Legacy youtube.py
    "extract_video_id",
    "extract_playlist_id",
    "get_video_info",
    "get_video_info_ytdlp",
    "get_transcript",
    "get_transcript_with_timestamps",
    "get_playlist_videos",
    "get_playlist_info",
    "format_seconds_to_timestamp",
    # Ultra-resilient v7.0
    "UltraResilientTranscriptExtractor",
    "get_transcript_ultra",
    "extract_transcript_for_analysis",
    "TranscriptResult",
    "ExtractionMethod",
    # Health monitoring
    "TranscriptHealthMonitor",
    "health_monitor",
    "record_extraction_attempt",
    "get_optimized_method_order",
    "get_transcript_health_report",
]
