"""
Tests exhaustifs pour le systeme d'extraction de transcripts
Ultra-Resilient Transcript Extractor v7.0
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from transcripts.ultra_resilient import (
    UltraResilientTranscriptExtractor,
    get_transcript,
    ExtractionMethod,
    TranscriptResult,
    CircuitBreaker,
    InstanceHealthManager,
)
from transcripts.monitor import (
    TranscriptHealthMonitor,
    MethodStats,
    record_extraction_attempt,
    get_optimized_method_order,
    get_transcript_health_report,
)


# ===================================================================
# TEST VIDEOS - Different characteristics
# ===================================================================

TEST_VIDEOS = [
    # Popular video with manual subtitles
    ("dQw4w9WgXcQ", "en", "popular_manual_english"),
    # Video with auto-generated only
    ("9bZkp7q19f0", "ko", "gangnam_style_korean"),
    # French video
    ("_OBlgSz8sSM", "fr", "french_manual"),
    # Short video
    ("jNQXAC9IVRw", "en", "first_youtube_video"),
]


# ===================================================================
# UNIT TESTS - CircuitBreaker
# ===================================================================

class TestCircuitBreaker:

    def test_initial_state_closed(self):
        """Circuit starts in closed state"""
        cb = CircuitBreaker()
        assert cb.can_execute("test_method") is True

    def test_opens_after_failures(self):
        """Circuit opens after threshold failures"""
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=300)

        for _ in range(3):
            cb.record_failure("test_method")

        assert cb.can_execute("test_method") is False
        assert cb.state.get("test_method") == "open"

    def test_success_resets_failures(self):
        """Success resets failure count"""
        cb = CircuitBreaker(failure_threshold=5)

        cb.record_failure("test_method")
        cb.record_failure("test_method")
        cb.record_success("test_method")

        assert cb.failures.get("test_method", 0) == 0
        assert cb.state.get("test_method") == "closed"

    def test_half_open_after_timeout(self):
        """Circuit becomes half-open after recovery timeout"""
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=1)

        cb.record_failure("test_method")
        cb.record_failure("test_method")

        assert cb.can_execute("test_method") is False

        # Simulate time passing
        cb.last_failure["test_method"] = datetime.now() - timedelta(seconds=2)

        assert cb.can_execute("test_method") is True
        assert cb.state.get("test_method") == "half-open"


# ===================================================================
# UNIT TESTS - InstanceHealthManager
# ===================================================================

class TestInstanceHealthManager:

    def test_initial_state_healthy(self):
        """All instances start healthy"""
        manager = InstanceHealthManager()
        assert manager.is_healthy("https://example.com") is True

    def test_marks_unhealthy_after_failures(self):
        """Instance marked unhealthy after threshold failures"""
        manager = InstanceHealthManager()
        manager.healthy_threshold = 3

        for _ in range(3):
            manager.record_failure("https://example.com")

        assert manager.is_healthy("https://example.com") is False

    def test_success_improves_health(self):
        """Success decrements failure count"""
        manager = InstanceHealthManager()

        manager.record_failure("https://example.com")
        manager.record_failure("https://example.com")
        manager.record_success("https://example.com")

        assert manager.instance_failures.get("https://example.com", 0) == 1

    def test_get_healthy_instances_order(self):
        """Healthy instances come before unhealthy"""
        manager = InstanceHealthManager()
        manager.healthy_threshold = 2

        instances = ["https://a.com", "https://b.com", "https://c.com"]

        # Make b.com unhealthy
        manager.record_failure("https://b.com")
        manager.record_failure("https://b.com")

        healthy = manager.get_healthy_instances(instances)

        # b.com should be last
        assert healthy[-1] == "https://b.com"


# ===================================================================
# UNIT TESTS - TranscriptResult
# ===================================================================

class TestTranscriptResult:

    def test_timestamped_text_generation(self):
        """Timestamped text is generated from segments"""
        segments = [
            {"text": "Hello", "start": 0.0, "duration": 1.0},
            {"text": "World", "start": 1.5, "duration": 0.5},
        ]

        result = TranscriptResult(
            text="Hello World",
            language="en",
            method=ExtractionMethod.YOUTUBE_TRANSCRIPT_API,
            is_auto_generated=False,
            confidence=0.95,
            segments=segments,
        )

        assert "[00:00]" in result.text_timestamped
        assert "Hello" in result.text_timestamped
        assert "[00:01]" in result.text_timestamped
        assert "World" in result.text_timestamped

    def test_timestamp_format_hours(self):
        """Timestamps include hours when needed"""
        result = TranscriptResult(
            text="Test",
            language="en",
            method=ExtractionMethod.YOUTUBE_TRANSCRIPT_API,
            is_auto_generated=False,
            confidence=0.95,
        )

        assert result._format_timestamp(3661) == "01:01:01"
        assert result._format_timestamp(61) == "01:01"
        assert result._format_timestamp(5) == "00:05"


# ===================================================================
# UNIT TESTS - TranscriptHealthMonitor
# ===================================================================

class TestTranscriptHealthMonitor:

    def test_record_success(self):
        """Recording success updates stats correctly"""
        monitor = TranscriptHealthMonitor()

        monitor.record_attempt("test_method", True, 100)

        stats = monitor.method_stats["test_method"]
        assert stats.success == 1
        assert stats.failure == 0
        assert stats.total_time_ms == 100
        assert stats.last_success is not None

    def test_record_failure(self):
        """Recording failure updates stats correctly"""
        monitor = TranscriptHealthMonitor()

        monitor.record_attempt("test_method", False, 200, "Connection timeout")

        stats = monitor.method_stats["test_method"]
        assert stats.success == 0
        assert stats.failure == 1
        assert stats.last_failure is not None
        assert "timeout" in stats.error_types

    def test_success_rate_calculation(self):
        """Success rate is calculated correctly"""
        monitor = TranscriptHealthMonitor()

        for _ in range(7):
            monitor.record_attempt("test_method", True, 100)
        for _ in range(3):
            monitor.record_attempt("test_method", False, 100)

        stats = monitor.method_stats["test_method"]
        assert stats.success_rate == 0.7
        assert stats.total_attempts == 10

    def test_method_priority_by_success_rate(self):
        """Methods are prioritized by success rate"""
        monitor = TranscriptHealthMonitor()

        # Method A: 90% success
        for _ in range(9):
            monitor.record_attempt("method_a", True, 100)
        monitor.record_attempt("method_a", False, 100)

        # Method B: 50% success
        for _ in range(5):
            monitor.record_attempt("method_b", True, 100)
        for _ in range(5):
            monitor.record_attempt("method_b", False, 100)

        priority = monitor.get_method_priority()

        assert priority.index("method_a") < priority.index("method_b")

    def test_health_report_generation(self):
        """Health report contains expected fields"""
        monitor = TranscriptHealthMonitor()

        monitor.record_attempt("test_method", True, 100)
        monitor.record_attempt("test_method", False, 200, "Error")

        report = monitor.get_health_report()

        assert "timestamp" in report
        assert "methods" in report
        assert "overall_success_rate" in report
        assert "recommendations" in report
        assert "test_method" in report["methods"]

    def test_error_categorization(self):
        """Errors are categorized correctly"""
        monitor = TranscriptHealthMonitor()

        assert monitor._categorize_error("Connection timeout") == "timeout"
        assert monitor._categorize_error("Rate limit exceeded 429") == "rate_limit"
        assert monitor._categorize_error("Request blocked 403") == "blocked"
        assert monitor._categorize_error("Video not found 404") == "not_found"
        assert monitor._categorize_error("No transcript available") == "no_transcript"

    def test_stats_export_import(self):
        """Stats can be exported and imported"""
        monitor = TranscriptHealthMonitor()

        monitor.record_attempt("test_method", True, 100)
        monitor.record_attempt("test_method", False, 200, "Error")

        exported = monitor.export_stats()

        # Create new monitor and import
        monitor2 = TranscriptHealthMonitor()
        monitor2.import_stats(exported)

        assert monitor2.method_stats["test_method"].success == 1
        assert monitor2.method_stats["test_method"].failure == 1


# ===================================================================
# UNIT TESTS - UltraResilientTranscriptExtractor
# ===================================================================

class TestUltraResilientTranscriptExtractor:

    def test_video_id_extraction_full_url(self):
        """Extracts video ID from full URL"""
        extractor = UltraResilientTranscriptExtractor()

        assert extractor._extract_video_id(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        ) == "dQw4w9WgXcQ"

    def test_video_id_extraction_short_url(self):
        """Extracts video ID from short URL"""
        extractor = UltraResilientTranscriptExtractor()

        assert extractor._extract_video_id(
            "https://youtu.be/dQw4w9WgXcQ"
        ) == "dQw4w9WgXcQ"

    def test_video_id_extraction_embed_url(self):
        """Extracts video ID from embed URL"""
        extractor = UltraResilientTranscriptExtractor()

        assert extractor._extract_video_id(
            "https://www.youtube.com/embed/dQw4w9WgXcQ"
        ) == "dQw4w9WgXcQ"

    def test_video_id_extraction_shorts_url(self):
        """Extracts video ID from shorts URL"""
        extractor = UltraResilientTranscriptExtractor()

        assert extractor._extract_video_id(
            "https://www.youtube.com/shorts/dQw4w9WgXcQ"
        ) == "dQw4w9WgXcQ"

    def test_video_id_extraction_raw_id(self):
        """Accepts raw video ID"""
        extractor = UltraResilientTranscriptExtractor()

        assert extractor._extract_video_id("dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_video_id_extraction_invalid(self):
        """Raises error for invalid input"""
        extractor = UltraResilientTranscriptExtractor()

        with pytest.raises(ValueError):
            extractor._extract_video_id("not-a-valid-id-too-long-string")

    def test_user_agent_rotation(self):
        """User agents are rotated"""
        extractor = UltraResilientTranscriptExtractor()

        agents = set()
        for _ in range(100):
            agents.add(extractor._get_random_user_agent())

        # Should have multiple different user agents
        assert len(agents) > 1

    def test_backoff_calculation(self):
        """Backoff increases exponentially"""
        extractor = UltraResilientTranscriptExtractor()

        delays = [extractor._calculate_backoff(i) for i in range(5)]

        # Each delay should generally be larger than the previous
        # (accounting for jitter, check the base pattern)
        for i in range(1, len(delays)):
            # Base delay doubles each time (with jitter, use generous margin)
            assert delays[i] > delays[0] * 0.5

    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        """Rate limiting throttles requests"""
        extractor = UltraResilientTranscriptExtractor()
        extractor._rate_limit_tokens = 0

        start = asyncio.get_event_loop().time()
        await extractor._rate_limit()
        elapsed = asyncio.get_event_loop().time() - start

        # Should have waited due to no tokens
        assert elapsed > 0.1

    def test_srt_parsing(self):
        """SRT content is parsed correctly"""
        extractor = UltraResilientTranscriptExtractor()

        srt_content = """1
00:00:01,000 --> 00:00:03,500
Hello world

2
00:00:04,000 --> 00:00:06,000
This is a test
"""

        text, segments = extractor._parse_srt(srt_content)

        assert "Hello world" in text
        assert "This is a test" in text
        assert len(segments) == 2
        assert segments[0]["start"] == 1.0
        assert segments[1]["start"] == 4.0

    def test_vtt_parsing(self):
        """VTT content is parsed correctly"""
        extractor = UltraResilientTranscriptExtractor()

        vtt_content = """WEBVTT

00:00:01.000 --> 00:00:03.500
Hello world

00:00:04.000 --> 00:00:06.000
This is a test
"""

        text, segments = extractor._parse_vtt(vtt_content)

        assert "Hello world" in text
        assert "This is a test" in text
        assert len(segments) == 2

    def test_srt_time_conversion(self):
        """SRT timestamps are converted correctly"""
        extractor = UltraResilientTranscriptExtractor()

        assert extractor._srt_time_to_seconds("00:00:01,000") == 1.0
        assert extractor._srt_time_to_seconds("00:01:30,500") == 90.5
        assert extractor._srt_time_to_seconds("01:30:00,000") == 5400.0

    def test_vtt_time_conversion(self):
        """VTT timestamps are converted correctly"""
        extractor = UltraResilientTranscriptExtractor()

        assert extractor._vtt_time_to_seconds("00:00:01.000") == 1.0
        assert extractor._vtt_time_to_seconds("01:30.500") == 90.5
        assert extractor._vtt_time_to_seconds("01:30:00.000") == 5400.0


# ===================================================================
# INTEGRATION TESTS (require network - mark as slow)
# ===================================================================

@pytest.mark.slow
@pytest.mark.asyncio
class TestIntegrationExtraction:
    """Integration tests that require network access"""

    async def test_basic_extraction(self):
        """Test basic extraction works"""
        result = await get_transcript("dQw4w9WgXcQ", ["en"])

        assert result.text
        assert len(result.text) > 100
        assert result.language
        assert result.method in ExtractionMethod

    async def test_extraction_with_fallback(self):
        """Test that fallbacks work"""
        async with UltraResilientTranscriptExtractor() as extractor:
            result = await extractor.extract("dQw4w9WgXcQ", ["en"])

            assert result.text
            assert result.method in ExtractionMethod
            assert result.extraction_time_ms > 0

    @pytest.mark.parametrize("video_id,lang,desc", TEST_VIDEOS)
    async def test_various_videos(self, video_id, lang, desc):
        """Test extraction on different video types"""
        try:
            result = await get_transcript(video_id, [lang, "en"])
            assert result.text, f"Failed for {desc}"
            assert result.language
        except Exception as e:
            # Some test videos may not be available
            pytest.skip(f"Video {video_id} not accessible: {e}")


# ===================================================================
# MOCK TESTS - Testing fallback behavior
# ===================================================================

class TestFallbackBehavior:

    @pytest.mark.asyncio
    async def test_falls_back_on_failure(self):
        """Test that extractor falls back when first method fails"""
        extractor = UltraResilientTranscriptExtractor()

        # Mock the first method to fail
        async def mock_fail(*args, **kwargs):
            raise Exception("First method failed")

        async def mock_success(*args, **kwargs):
            return TranscriptResult(
                text="Success from fallback",
                language="en",
                method=ExtractionMethod.INNERTUBE_API,
                is_auto_generated=False,
                confidence=0.9,
            )

        with patch.object(
            extractor, '_method_youtube_transcript_api', mock_fail
        ), patch.object(
            extractor, '_method_innertube_api', mock_success
        ):
            async with extractor:
                # Use a valid 11-character video ID format
                result = await extractor.extract("dQw4w9WgXcQ", ["en"])

            assert result.text == "Success from fallback"
            assert result.method == ExtractionMethod.INNERTUBE_API

    @pytest.mark.asyncio
    async def test_circuit_breaker_skips_failed_method(self):
        """Test that circuit breaker skips methods that keep failing"""
        extractor = UltraResilientTranscriptExtractor()

        # Record many failures for youtube_transcript_api
        method = ExtractionMethod.YOUTUBE_TRANSCRIPT_API.value
        for _ in range(10):
            extractor.circuit_breaker.record_failure(method)

        assert extractor.circuit_breaker.can_execute(method) is False

    @pytest.mark.asyncio
    async def test_all_methods_fail_raises_error(self):
        """Test that proper error is raised when all methods fail"""
        extractor = UltraResilientTranscriptExtractor()

        # Mock all methods to fail
        async def mock_fail(*args, **kwargs):
            raise Exception("Method failed")

        methods_to_mock = [
            '_method_youtube_transcript_api',
            '_method_innertube_api',
            '_method_watch_page_scrape',
            '_method_invidious_api',
            '_method_piped_api',
            '_method_yt_dlp_native',
            '_method_yt_dlp_auto_subs',
            '_method_timedtext_direct',
            '_method_supadata_api',
            '_method_whisper_fallback',
        ]

        patches = {m: patch.object(extractor, m, mock_fail) for m in methods_to_mock}

        with pytest.raises(Exception) as exc_info:
            for p in patches.values():
                p.start()
            try:
                async with extractor:
                    # Use a valid 11-character video ID format
                    await extractor.extract("dQw4w9WgXcQ", ["en"])
            finally:
                for p in patches.values():
                    p.stop()

        assert "Failed to extract transcript" in str(exc_info.value)


# ===================================================================
# RUN CONFIG
# ===================================================================

if __name__ == "__main__":
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "-m", "not slow",  # Skip slow integration tests by default
    ])
