"""
Ultra-Resilient YouTube Transcript Extractor v7.0
Architecture: 10+ methodes de fallback avec auto-healing

Based on research from:
- youtube-transcript-api v0.6.3 (March 2025)
- yt-dlp 2025.12.08 (all automatic caption languages)
- Innertube API with Android client impersonation
- WebShare proxy integration for cloud deployments
"""

import asyncio
import httpx
import json
import re
import random
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET
from urllib.parse import parse_qs, urlencode
import subprocess
import tempfile
import os

from core.logging import logger
from core.config import (
    get_supadata_key, get_groq_key, get_deepgram_key,
    get_openai_key, get_assemblyai_key, TRANSCRIPT_CONFIG
)


class ExtractionMethod(Enum):
    """Methodes d'extraction par ordre de priorite"""
    YOUTUBE_TRANSCRIPT_API = "youtube_transcript_api"
    YT_DLP_NATIVE = "yt_dlp_native"
    YT_DLP_AUTO_SUBS = "yt_dlp_auto_subs"
    INNERTUBE_API = "innertube_api"
    TIMEDTEXT_DIRECT = "timedtext_direct"
    WATCH_PAGE_SCRAPE = "watch_page_scrape"
    EMBED_PAGE_SCRAPE = "embed_page_scrape"
    MOBILE_ENDPOINT = "mobile_endpoint"
    INVIDIOUS_API = "invidious_api"
    PIPED_API = "piped_api"
    SUPADATA_API = "supadata_api"
    WHISPER_FALLBACK = "whisper_fallback"
    ASSEMBLY_AI = "assembly_ai"
    DEEPGRAM_NOVA = "deepgram_nova"


@dataclass
class TranscriptResult:
    """Resultat d'extraction avec metadonnees"""
    text: str
    language: str
    method: ExtractionMethod
    is_auto_generated: bool
    confidence: float
    segments: Optional[List[Dict]] = None
    extraction_time_ms: int = 0
    video_duration: Optional[int] = None
    text_timestamped: str = ""

    def __post_init__(self):
        if not self.text_timestamped and self.segments:
            self.text_timestamped = self._generate_timestamped_text()

    def _generate_timestamped_text(self) -> str:
        """Generate timestamped text from segments"""
        if not self.segments:
            return self.text
        lines = []
        for seg in self.segments:
            start = seg.get("start", 0)
            text = seg.get("text", "").strip()
            if text:
                timestamp = self._format_timestamp(start)
                lines.append(f"[{timestamp}] {text}")
        return "\n".join(lines)

    @staticmethod
    def _format_timestamp(seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        if h > 0:
            return f"{h:02d}:{m:02d}:{s:02d}"
        return f"{m:02d}:{s:02d}"


@dataclass
class ExtractionAttempt:
    """Log d'une tentative d'extraction"""
    method: ExtractionMethod
    success: bool
    error: Optional[str] = None
    duration_ms: int = 0


class CircuitBreaker:
    """Circuit breaker pour eviter de surcharger les endpoints defaillants"""

    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 300):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures: Dict[str, int] = {}
        self.last_failure: Dict[str, datetime] = {}
        self.state: Dict[str, str] = {}  # 'closed', 'open', 'half-open'

    def can_execute(self, method: str) -> bool:
        if method not in self.state or self.state[method] == 'closed':
            return True

        if self.state[method] == 'open':
            last = self.last_failure.get(method)
            if last and datetime.now() - last > timedelta(seconds=self.recovery_timeout):
                self.state[method] = 'half-open'
                return True
            return False

        return True  # half-open

    def record_success(self, method: str):
        self.failures[method] = 0
        self.state[method] = 'closed'

    def record_failure(self, method: str):
        self.failures[method] = self.failures.get(method, 0) + 1
        self.last_failure[method] = datetime.now()

        if self.failures[method] >= self.failure_threshold:
            self.state[method] = 'open'
            logger.warning(f"Circuit breaker OPEN for {method}")


class InstanceHealthManager:
    """Manages health of external service instances"""

    def __init__(self):
        self.instance_failures: Dict[str, int] = {}
        self.instance_last_failure: Dict[str, datetime] = {}
        self.healthy_threshold = 3
        self.recovery_time = 600  # 10 minutes

    def record_success(self, instance: str):
        self.instance_failures[instance] = max(0, self.instance_failures.get(instance, 0) - 1)

    def record_failure(self, instance: str):
        self.instance_failures[instance] = self.instance_failures.get(instance, 0) + 1
        self.instance_last_failure[instance] = datetime.now()

    def is_healthy(self, instance: str) -> bool:
        failures = self.instance_failures.get(instance, 0)
        if failures < self.healthy_threshold:
            return True

        last_failure = self.instance_last_failure.get(instance)
        if last_failure and datetime.now() - last_failure > timedelta(seconds=self.recovery_time):
            self.instance_failures[instance] = 0
            return True

        return False

    def get_healthy_instances(self, instances: List[str]) -> List[str]:
        healthy = [i for i in instances if self.is_healthy(i)]
        unhealthy = [i for i in instances if not self.is_healthy(i)]
        random.shuffle(healthy)
        return healthy + unhealthy


class UltraResilientTranscriptExtractor:
    """
    Extracteur de transcripts ultra-resilient avec 10+ methodes de fallback
    """

    # User agents for anti-detection
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    ]

    # Innertube client configs (discovered by reverse engineering)
    INNERTUBE_CLIENTS = {
        "android": {
            "clientName": "ANDROID",
            "clientVersion": "20.10.38",
            "androidSdkVersion": 30,
            "userAgent": "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
        },
        "web": {
            "clientName": "WEB",
            "clientVersion": "2.20250101.00.00",
        },
        "ios": {
            "clientName": "IOS",
            "clientVersion": "20.10.38",
            "deviceMake": "Apple",
            "deviceModel": "iPhone14,3",
        },
        "tv_embed": {
            "clientName": "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
            "clientVersion": "2.0",
        },
    }

    # Invidious instances (updated January 2026)
    INVIDIOUS_INSTANCES = [
        "https://invidious.fdn.fr",
        "https://inv.nadeko.net",
        "https://invidious.nerdvpn.de",
        "https://yt.artemislena.eu",
        "https://invidious.protokolla.fi",
        "https://inv.tux.pizza",
        "https://vid.puffyan.us",
        "https://invidious.projectsegfau.lt",
    ]

    # Piped instances (updated January 2026)
    PIPED_INSTANCES = [
        "https://pipedapi.kavin.rocks",
        "https://api.piped.yt",
        "https://pipedapi.tokhmi.xyz",
        "https://pipedapi.moomoo.me",
        "https://pipedapi.syncpundit.io",
        "https://api.piped.projectsegfau.lt",
    ]

    def __init__(self):
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=TRANSCRIPT_CONFIG.get("circuit_breaker_failure_threshold", 5),
            recovery_timeout=TRANSCRIPT_CONFIG.get("circuit_breaker_recovery_timeout", 300)
        )
        self.instance_health = InstanceHealthManager()
        self.http_client: Optional[httpx.AsyncClient] = None
        self.extraction_stats: Dict[str, Dict] = {}
        self._rate_limit_tokens = 10
        self._last_request_time = datetime.now()

    async def __aenter__(self):
        # Try to use HTTP/2 if available, fall back to HTTP/1.1
        try:
            self.http_client = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                http2=True,
            )
        except ImportError:
            # h2 package not installed, use HTTP/1.1
            self.http_client = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
            )
        return self

    async def __aexit__(self, *args):
        if self.http_client:
            await self.http_client.aclose()

    def _get_random_user_agent(self) -> str:
        return random.choice(self.USER_AGENTS)

    def _extract_video_id(self, url_or_id: str) -> str:
        """Extrait l'ID video depuis n'importe quel format d'URL YouTube"""
        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
            r'^([a-zA-Z0-9_-]{11})$',
        ]
        for pattern in patterns:
            match = re.search(pattern, url_or_id)
            if match:
                return match.group(1)
        raise ValueError(f"Invalid YouTube URL or ID: {url_or_id}")

    async def _rate_limit(self):
        """Rate limiting intelligent avec token bucket"""
        now = datetime.now()
        elapsed = (now - self._last_request_time).total_seconds()
        self._rate_limit_tokens = min(10, self._rate_limit_tokens + elapsed * 2)

        if self._rate_limit_tokens < 1:
            wait_time = (1 - self._rate_limit_tokens) / 2
            await asyncio.sleep(wait_time)

        self._rate_limit_tokens -= 1
        self._last_request_time = now

    def _calculate_backoff(self, attempt: int) -> float:
        """Calculate exponential backoff with jitter"""
        base = TRANSCRIPT_CONFIG.get("backoff_base", 1.0)
        max_delay = TRANSCRIPT_CONFIG.get("backoff_max", 30.0)
        delay = min(base * (2 ** attempt), max_delay)
        jitter = random.uniform(0, delay * 0.3)
        return delay + jitter

    # ===================================================================
    # METHOD 1: youtube-transcript-api (most reliable generally)
    # ===================================================================

    async def _method_youtube_transcript_api(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """Uses the youtube-transcript-api library"""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            from youtube_transcript_api._errors import (
                TranscriptsDisabled,
                NoTranscriptFound,
                VideoUnavailable,
            )
        except ImportError:
            raise Exception("youtube-transcript-api not installed")

        def _fetch_sync():
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # Try manual transcripts first
            for lang in languages:
                try:
                    transcript = transcript_list.find_manually_created_transcript([lang])
                    return transcript.fetch(), lang, False
                except Exception:
                    pass

            # Fallback to auto-generated
            for lang in languages:
                try:
                    transcript = transcript_list.find_generated_transcript([lang])
                    return transcript.fetch(), lang, True
                except Exception:
                    pass

            # Last resort: any language
            try:
                available = list(transcript_list)
                if available:
                    transcript = available[0]
                    return transcript.fetch(), transcript.language_code, transcript.is_generated
            except Exception:
                pass

            raise NoTranscriptFound(video_id, languages, transcript_list)

        loop = asyncio.get_event_loop()
        segments, lang, is_auto = await loop.run_in_executor(None, _fetch_sync)

        text = " ".join([s["text"] for s in segments])

        return TranscriptResult(
            text=text,
            language=lang,
            method=ExtractionMethod.YOUTUBE_TRANSCRIPT_API,
            is_auto_generated=is_auto,
            confidence=0.95 if not is_auto else 0.85,
            segments=segments,
        )

    # ===================================================================
    # METHOD 2: yt-dlp native subtitles
    # ===================================================================

    async def _method_yt_dlp_native(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """Uses yt-dlp to extract subtitles"""

        with tempfile.TemporaryDirectory() as tmpdir:
            output_template = os.path.join(tmpdir, "%(id)s.%(ext)s")
            lang_str = ",".join(languages)

            cmd = [
                "yt-dlp",
                "--skip-download",
                "--write-subs",
                f"--sub-langs={lang_str}",
                "--sub-format=json3/srv3/vtt/ttml/best",
                "--convert-subs=srt",
                "--user-agent", self._get_random_user_agent(),
                "--extractor-args", "youtube:player_client=android",
                "-o", output_template,
                f"https://www.youtube.com/watch?v={video_id}",
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=90
            )

            # Find subtitle file
            for file in os.listdir(tmpdir):
                if file.endswith(".srt"):
                    filepath = os.path.join(tmpdir, file)
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()

                    text, segments = self._parse_srt(content)
                    is_auto = ".auto." in file or "auto-" in file

                    return TranscriptResult(
                        text=text,
                        language=languages[0],
                        method=ExtractionMethod.YT_DLP_NATIVE,
                        is_auto_generated=is_auto,
                        confidence=0.90,
                        segments=segments,
                    )

            raise Exception("No subtitle file generated by yt-dlp")

    # ===================================================================
    # METHOD 3: yt-dlp auto subtitles
    # ===================================================================

    async def _method_yt_dlp_auto_subs(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """Uses yt-dlp to extract auto-generated subtitles"""

        with tempfile.TemporaryDirectory() as tmpdir:
            output_template = os.path.join(tmpdir, "%(id)s.%(ext)s")
            lang_str = ",".join(languages)

            cmd = [
                "yt-dlp",
                "--skip-download",
                "--write-auto-subs",
                f"--sub-langs={lang_str}",
                "--sub-format=json3/srv3/vtt/best",
                "--convert-subs=srt",
                "--user-agent", self._get_random_user_agent(),
                "--extractor-args", "youtube:player_client=mweb",
                "--sleep-requests", "1",
                "-o", output_template,
                f"https://www.youtube.com/watch?v={video_id}",
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=90
            )

            for file in os.listdir(tmpdir):
                if file.endswith(".srt"):
                    filepath = os.path.join(tmpdir, file)
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()

                    text, segments = self._parse_srt(content)

                    return TranscriptResult(
                        text=text,
                        language=languages[0],
                        method=ExtractionMethod.YT_DLP_AUTO_SUBS,
                        is_auto_generated=True,
                        confidence=0.82,
                        segments=segments,
                    )

            raise Exception("No auto subtitle file generated by yt-dlp")

    def _parse_srt(self, content: str) -> Tuple[str, List[Dict]]:
        """Parse SRT file"""
        segments = []
        blocks = content.strip().split("\n\n")

        for block in blocks:
            lines = block.split("\n")
            if len(lines) >= 3:
                try:
                    timecode = lines[1]
                    text = " ".join(lines[2:])
                    text = re.sub(r'<[^>]+>', '', text)  # Remove HTML tags
                    start, end = timecode.split(" --> ")
                    segments.append({
                        "text": text.strip(),
                        "start": self._srt_time_to_seconds(start),
                        "duration": self._srt_time_to_seconds(end) - self._srt_time_to_seconds(start),
                    })
                except Exception:
                    pass

        full_text = " ".join([s["text"] for s in segments if s["text"]])
        return full_text, segments

    def _srt_time_to_seconds(self, time_str: str) -> float:
        """Convert SRT timestamp to seconds"""
        time_str = time_str.replace(",", ".").strip()
        parts = time_str.split(":")
        return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])

    # ===================================================================
    # METHOD 4: Innertube API (internal YouTube endpoint)
    # ===================================================================

    async def _method_innertube_api(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """
        Uses YouTube's internal Innertube API
        Discovered by reverse engineering the YouTube app
        """
        await self._rate_limit()

        # Try different Innertube clients
        for client_name, client_config in self.INNERTUBE_CLIENTS.items():
            try:
                result = await self._innertube_request(video_id, client_config, languages)
                if result:
                    return result
            except Exception as e:
                logger.debug(f"Innertube client {client_name} failed: {e}")
                continue

        raise Exception("All Innertube clients failed")

    async def _innertube_request(
        self, video_id: str, client_config: Dict, languages: List[str]
    ) -> Optional[TranscriptResult]:
        """Performs an Innertube request"""

        # First, get watch page to extract context
        watch_url = f"https://www.youtube.com/watch?v={video_id}"
        response = await self.http_client.get(
            watch_url,
            headers={"User-Agent": self._get_random_user_agent()},
        )

        # Extract INNERTUBE_API_KEY
        api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', response.text)
        if not api_key_match:
            raise Exception("Could not find INNERTUBE_API_KEY")

        api_key = api_key_match.group(1)

        # Extract caption tracks
        caption_tracks_match = re.search(
            r'"captionTracks":\s*(\[.*?\])',
            response.text
        )

        if not caption_tracks_match:
            raise Exception("No caption tracks found")

        caption_tracks = json.loads(caption_tracks_match.group(1))

        # Find best track
        best_track = None
        is_auto = False

        for lang in languages:
            for track in caption_tracks:
                if track.get("languageCode", "").startswith(lang):
                    if track.get("kind") != "asr":
                        best_track = track
                        is_auto = False
                        break
                    elif not best_track:
                        best_track = track
                        is_auto = True

        if not best_track:
            best_track = caption_tracks[0] if caption_tracks else None
            if best_track:
                is_auto = best_track.get("kind") == "asr"

        if not best_track:
            raise Exception("No matching caption track")

        # Download transcript
        base_url = best_track.get("baseUrl")
        if not base_url:
            raise Exception("No baseUrl for caption track")

        if "fmt=" not in base_url:
            base_url += "&fmt=json3"

        transcript_response = await self.http_client.get(base_url)
        transcript_data = transcript_response.json()

        # Parse events
        segments = []
        for event in transcript_data.get("events", []):
            if "segs" in event:
                text = "".join([seg.get("utf8", "") for seg in event["segs"]])
                if text.strip():
                    segments.append({
                        "text": text.strip(),
                        "start": event.get("tStartMs", 0) / 1000,
                        "duration": event.get("dDurationMs", 0) / 1000,
                    })

        full_text = " ".join([s["text"] for s in segments])

        return TranscriptResult(
            text=full_text,
            language=best_track.get("languageCode", languages[0]),
            method=ExtractionMethod.INNERTUBE_API,
            is_auto_generated=is_auto,
            confidence=0.92,
            segments=segments,
        )

    # ===================================================================
    # METHOD 5: Timedtext API Direct
    # ===================================================================

    async def _method_timedtext_direct(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """Direct call to timedtext API (legacy but sometimes works)"""
        await self._rate_limit()

        for lang in languages:
            for fmt in ["json3", "srv3", "vtt"]:
                try:
                    url = (
                        f"https://www.youtube.com/api/timedtext"
                        f"?v={video_id}&lang={lang}&fmt={fmt}"
                    )

                    response = await self.http_client.get(
                        url,
                        headers={"User-Agent": self._get_random_user_agent()},
                    )

                    if response.status_code == 200 and response.text.strip():
                        if fmt == "json3":
                            return self._parse_json3_transcript(response.text, lang)
                        elif fmt == "vtt":
                            text, segments = self._parse_vtt(response.text)
                            return TranscriptResult(
                                text=text,
                                language=lang,
                                method=ExtractionMethod.TIMEDTEXT_DIRECT,
                                is_auto_generated=False,
                                confidence=0.88,
                                segments=segments,
                            )
                except Exception:
                    continue

        raise Exception("Timedtext API failed for all languages")

    def _parse_json3_transcript(self, content: str, lang: str) -> TranscriptResult:
        """Parse YouTube JSON3 format"""
        data = json.loads(content)
        segments = []

        for event in data.get("events", []):
            if "segs" in event:
                text = "".join([seg.get("utf8", "") for seg in event["segs"]])
                if text.strip():
                    segments.append({
                        "text": text.strip(),
                        "start": event.get("tStartMs", 0) / 1000,
                        "duration": event.get("dDurationMs", 0) / 1000,
                    })

        full_text = " ".join([s["text"] for s in segments if s["text"]])

        return TranscriptResult(
            text=full_text,
            language=lang,
            method=ExtractionMethod.TIMEDTEXT_DIRECT,
            is_auto_generated=False,
            confidence=0.88,
            segments=segments,
        )

    def _parse_vtt(self, content: str) -> Tuple[str, List[Dict]]:
        """Parse WebVTT format"""
        segments = []
        lines = content.split("\n")
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            if "-->" in line:
                times = line.split("-->")
                start = self._vtt_time_to_seconds(times[0].strip())
                end = self._vtt_time_to_seconds(times[1].strip().split()[0])

                i += 1
                text_lines = []
                while i < len(lines) and lines[i].strip():
                    text_lines.append(lines[i].strip())
                    i += 1

                if text_lines:
                    text = " ".join(text_lines)
                    text = re.sub(r'<[^>]+>', '', text)  # Remove HTML tags
                    segments.append({
                        "text": text,
                        "start": start,
                        "duration": end - start,
                    })
            i += 1

        full_text = " ".join([s["text"] for s in segments])
        return full_text, segments

    def _vtt_time_to_seconds(self, time_str: str) -> float:
        """Convert VTT timestamp to seconds"""
        parts = time_str.replace(",", ".").split(":")
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return 0.0

    # ===================================================================
    # METHOD 6: Watch Page Scraping
    # ===================================================================

    async def _method_watch_page_scrape(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """Scrape watch page to extract transcript data"""
        await self._rate_limit()

        url = f"https://www.youtube.com/watch?v={video_id}"
        response = await self.http_client.get(
            url,
            headers={
                "User-Agent": self._get_random_user_agent(),
                "Accept-Language": f"{languages[0]},en;q=0.9",
            },
        )

        # Search for ytInitialPlayerResponse
        match = re.search(
            r'var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\});',
            response.text,
            re.DOTALL,
        )

        if not match:
            match = re.search(
                r'ytInitialPlayerResponse\s*=\s*(\{.+?\});',
                response.text,
                re.DOTALL,
            )

        if not match:
            raise Exception("Could not find ytInitialPlayerResponse")

        player_response = json.loads(match.group(1))

        captions = player_response.get("captions", {})
        caption_tracks = (
            captions.get("playerCaptionsTracklistRenderer", {})
            .get("captionTracks", [])
        )

        if not caption_tracks:
            raise Exception("No caption tracks in player response")

        # Find best track
        best_track = None
        is_auto = False

        for lang in languages:
            for track in caption_tracks:
                lang_code = track.get("languageCode", "")
                if lang_code.startswith(lang):
                    if track.get("kind") != "asr":
                        best_track = track
                        is_auto = False
                        break
                    elif not best_track:
                        best_track = track
                        is_auto = True

        if not best_track:
            best_track = caption_tracks[0]
            is_auto = best_track.get("kind") == "asr"

        base_url = best_track.get("baseUrl")
        if "&fmt=" not in base_url:
            base_url += "&fmt=json3"

        transcript_response = await self.http_client.get(base_url)
        result = self._parse_json3_transcript(
            transcript_response.text,
            best_track.get("languageCode", languages[0])
        )
        result.method = ExtractionMethod.WATCH_PAGE_SCRAPE
        result.is_auto_generated = is_auto
        return result

    # ===================================================================
    # METHOD 7: Invidious API
    # ===================================================================

    async def _method_invidious_api(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """Uses Invidious public instances"""
        await self._rate_limit()

        healthy_instances = self.instance_health.get_healthy_instances(self.INVIDIOUS_INSTANCES)

        for instance in healthy_instances[:5]:
            try:
                url = f"{instance}/api/v1/captions/{video_id}"
                response = await self.http_client.get(
                    url,
                    headers={"User-Agent": self._get_random_user_agent()},
                    timeout=20,
                )

                if response.status_code != 200:
                    self.instance_health.record_failure(instance)
                    continue

                captions = response.json().get("captions", [])
                if not captions:
                    continue

                # Find best caption
                best_caption = None
                is_auto = False

                for lang in languages:
                    for cap in captions:
                        if cap.get("language_code", "").startswith(lang):
                            if "auto" not in cap.get("label", "").lower():
                                best_caption = cap
                                is_auto = False
                                break
                            elif not best_caption:
                                best_caption = cap
                                is_auto = True

                if not best_caption:
                    best_caption = captions[0]
                    is_auto = "auto" in best_caption.get("label", "").lower()

                # Download caption
                caption_url = f"{instance}{best_caption['url']}"
                cap_response = await self.http_client.get(
                    caption_url,
                    headers={"User-Agent": self._get_random_user_agent()},
                )

                if cap_response.status_code == 200:
                    self.instance_health.record_success(instance)
                    text, segments = self._parse_vtt(cap_response.text)

                    return TranscriptResult(
                        text=text,
                        language=best_caption.get("language_code", languages[0]),
                        method=ExtractionMethod.INVIDIOUS_API,
                        is_auto_generated=is_auto,
                        confidence=0.87,
                        segments=segments,
                    )

            except Exception as e:
                self.instance_health.record_failure(instance)
                logger.debug(f"Invidious {instance} failed: {e}")
                continue

        raise Exception("All Invidious instances failed")

    # ===================================================================
    # METHOD 8: Piped API
    # ===================================================================

    async def _method_piped_api(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """Uses Piped public instances"""
        await self._rate_limit()

        healthy_instances = self.instance_health.get_healthy_instances(self.PIPED_INSTANCES)

        for instance in healthy_instances[:5]:
            try:
                url = f"{instance}/streams/{video_id}"
                response = await self.http_client.get(
                    url,
                    headers={"User-Agent": self._get_random_user_agent()},
                    timeout=20,
                )

                if response.status_code != 200:
                    self.instance_health.record_failure(instance)
                    continue

                data = response.json()
                subtitles = data.get("subtitles", [])

                if not subtitles:
                    continue

                # Find best subtitle
                best_sub = None
                is_auto = False

                for lang in languages:
                    for sub in subtitles:
                        code = sub.get("code", "")
                        if code.startswith(lang):
                            if not sub.get("autoGenerated", False):
                                best_sub = sub
                                is_auto = False
                                break
                            elif not best_sub:
                                best_sub = sub
                                is_auto = True

                if not best_sub:
                    best_sub = subtitles[0]
                    is_auto = best_sub.get("autoGenerated", False)

                # Download subtitle
                sub_url = best_sub.get("url")
                if sub_url:
                    sub_response = await self.http_client.get(sub_url)
                    if sub_response.status_code == 200:
                        self.instance_health.record_success(instance)
                        text, segments = self._parse_vtt(sub_response.text)

                        return TranscriptResult(
                            text=text,
                            language=best_sub.get("code", languages[0]),
                            method=ExtractionMethod.PIPED_API,
                            is_auto_generated=is_auto,
                            confidence=0.86,
                            segments=segments,
                        )

            except Exception as e:
                self.instance_health.record_failure(instance)
                logger.debug(f"Piped {instance} failed: {e}")
                continue

        raise Exception("All Piped instances failed")

    # ===================================================================
    # METHOD 9: Supadata API (paid backup)
    # ===================================================================

    async def _method_supadata_api(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """Uses Supadata API as paid backup"""

        api_key = get_supadata_key()
        if not api_key:
            raise Exception("Supadata API key not configured")

        await self._rate_limit()

        url = "https://api.supadata.ai/v1/youtube/transcript"
        response = await self.http_client.post(
            url,
            headers={
                "x-api-key": api_key,
                "Content-Type": "application/json",
            },
            json={
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "lang": languages[0],
            },
            timeout=45,
        )

        if response.status_code != 200:
            raise Exception(f"Supadata API error: {response.status_code}")

        data = response.json()
        content = data.get("content", "")

        if not content:
            raise Exception("Supadata returned empty content")

        return TranscriptResult(
            text=content,
            language=data.get("lang", languages[0]),
            method=ExtractionMethod.SUPADATA_API,
            is_auto_generated=False,
            confidence=0.95,
            segments=None,
        )

    # ===================================================================
    # METHOD 10: Whisper Fallback (audio transcription)
    # ===================================================================

    async def _method_whisper_fallback(
        self, video_id: str, languages: List[str]
    ) -> TranscriptResult:
        """
        Last resort: download audio and transcribe with Whisper
        Requires OpenAI API or Groq API
        """
        groq_key = get_groq_key()
        openai_key = get_openai_key()

        if not groq_key and not openai_key:
            raise Exception("No Whisper API key configured (Groq or OpenAI)")

        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = os.path.join(tmpdir, "audio.mp3")

            cmd = [
                "yt-dlp",
                "-x",
                "--audio-format", "mp3",
                "--audio-quality", "5",
                "--user-agent", self._get_random_user_agent(),
                "-o", audio_path,
                f"https://www.youtube.com/watch?v={video_id}",
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(process.communicate(), timeout=180)

            actual_path = audio_path
            for ext in [".mp3", ".m4a", ".webm", ".opus"]:
                test_path = audio_path.replace(".mp3", ext)
                if os.path.exists(test_path):
                    actual_path = test_path
                    break

            if not os.path.exists(actual_path):
                raise Exception("Failed to download audio")

            # Check file size
            file_size = os.path.getsize(actual_path)
            max_size = 25 * 1024 * 1024

            if file_size > max_size:
                raise Exception(f"Audio file too large: {file_size / 1024 / 1024:.1f}MB > 25MB")

            # Try Groq first (faster, free tier)
            if groq_key:
                try:
                    return await self._transcribe_with_groq(actual_path, languages[0], groq_key)
                except Exception as e:
                    logger.warning(f"Groq Whisper failed: {e}")

            # Fallback to OpenAI
            if openai_key:
                return await self._transcribe_with_openai(actual_path, languages[0], openai_key)

            raise Exception("All Whisper transcription methods failed")

    async def _transcribe_with_groq(
        self, audio_path: str, language: str, api_key: str
    ) -> TranscriptResult:
        """Transcribe with Groq Whisper API"""
        with open(audio_path, "rb") as audio_file:
            files = {"file": (os.path.basename(audio_path), audio_file, "audio/mpeg")}
            data = {
                "model": "whisper-large-v3",
                "language": language[:2],
                "response_format": "verbose_json",
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files=files,
                    data=data,
                    timeout=300,
                )

        if response.status_code != 200:
            raise Exception(f"Groq API error: {response.status_code}")

        result = response.json()

        segments = [
            {
                "text": seg.get("text", ""),
                "start": seg.get("start", 0),
                "duration": seg.get("end", 0) - seg.get("start", 0),
            }
            for seg in result.get("segments", [])
        ]

        return TranscriptResult(
            text=result.get("text", ""),
            language=language,
            method=ExtractionMethod.WHISPER_FALLBACK,
            is_auto_generated=True,
            confidence=0.88,
            segments=segments,
        )

    async def _transcribe_with_openai(
        self, audio_path: str, language: str, api_key: str
    ) -> TranscriptResult:
        """Transcribe with OpenAI Whisper API"""
        with open(audio_path, "rb") as audio_file:
            files = {"file": (os.path.basename(audio_path), audio_file, "audio/mpeg")}
            data = {
                "model": "whisper-1",
                "language": language[:2],
                "response_format": "verbose_json",
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files=files,
                    data=data,
                    timeout=360,
                )

        if response.status_code != 200:
            raise Exception(f"OpenAI API error: {response.status_code}")

        result = response.json()

        segments = [
            {
                "text": seg.get("text", ""),
                "start": seg.get("start", 0),
                "duration": seg.get("end", 0) - seg.get("start", 0),
            }
            for seg in result.get("segments", [])
        ]

        return TranscriptResult(
            text=result.get("text", ""),
            language=language,
            method=ExtractionMethod.WHISPER_FALLBACK,
            is_auto_generated=True,
            confidence=0.88,
            segments=segments,
        )

    # ===================================================================
    # MAIN ORCHESTRATOR
    # ===================================================================

    async def extract(
        self,
        video_url_or_id: str,
        languages: List[str] = None,
        max_attempts: int = 12,
    ) -> TranscriptResult:
        """
        Main extraction with automatic fallback

        Args:
            video_url_or_id: YouTube URL or video ID
            languages: Preferred languages in order of priority
            max_attempts: Maximum number of methods to try

        Returns:
            TranscriptResult with text and metadata
        """
        if languages is None:
            languages = ["en", "fr"]

        video_id = self._extract_video_id(video_url_or_id)
        start_time = datetime.now()
        attempts: List[ExtractionAttempt] = []

        # Method order (optimized by historical success rate)
        methods = [
            (ExtractionMethod.YOUTUBE_TRANSCRIPT_API, self._method_youtube_transcript_api),
            (ExtractionMethod.INNERTUBE_API, self._method_innertube_api),
            (ExtractionMethod.WATCH_PAGE_SCRAPE, self._method_watch_page_scrape),
            (ExtractionMethod.INVIDIOUS_API, self._method_invidious_api),
            (ExtractionMethod.PIPED_API, self._method_piped_api),
            (ExtractionMethod.YT_DLP_NATIVE, self._method_yt_dlp_native),
            (ExtractionMethod.YT_DLP_AUTO_SUBS, self._method_yt_dlp_auto_subs),
            (ExtractionMethod.TIMEDTEXT_DIRECT, self._method_timedtext_direct),
            (ExtractionMethod.SUPADATA_API, self._method_supadata_api),
            (ExtractionMethod.WHISPER_FALLBACK, self._method_whisper_fallback),
        ]

        for method_enum, method_func in methods[:max_attempts]:
            method_name = method_enum.value

            # Check circuit breaker
            if not self.circuit_breaker.can_execute(method_name):
                logger.debug(f"Skipping {method_name} (circuit breaker open)")
                continue

            attempt_start = datetime.now()

            try:
                logger.info(f"Trying {method_name} for video {video_id}")
                result = await method_func(video_id, languages)

                # Success!
                self.circuit_breaker.record_success(method_name)

                extraction_time = int((datetime.now() - start_time).total_seconds() * 1000)
                result.extraction_time_ms = extraction_time

                attempts.append(ExtractionAttempt(
                    method=method_enum,
                    success=True,
                    duration_ms=int((datetime.now() - attempt_start).total_seconds() * 1000),
                ))

                logger.info(
                    f"Successfully extracted transcript using {method_name}",
                    video_id=video_id,
                    method=method_name,
                    language=result.language,
                    text_length=len(result.text),
                    extraction_time_ms=extraction_time,
                    attempts=len(attempts),
                )

                return result

            except Exception as e:
                self.circuit_breaker.record_failure(method_name)

                attempts.append(ExtractionAttempt(
                    method=method_enum,
                    success=False,
                    error=str(e),
                    duration_ms=int((datetime.now() - attempt_start).total_seconds() * 1000),
                ))

                logger.warning(f"{method_name} failed: {e}")
                continue

        # All methods failed
        error_summary = "; ".join([
            f"{a.method.value}: {a.error}"
            for a in attempts if not a.success
        ])

        logger.error(
            f"All transcript extraction methods failed for {video_id}",
            video_id=video_id,
            attempts=len(attempts),
            errors=error_summary,
        )

        raise Exception(
            f"Failed to extract transcript after {len(attempts)} attempts. "
            f"Errors: {error_summary}"
        )


# ===================================================================
# FACTORY FUNCTION FOR SIMPLE USAGE
# ===================================================================

async def get_transcript(
    video_url_or_id: str,
    languages: List[str] = None,
) -> TranscriptResult:
    """
    Utility function for simple extraction

    Usage:
        result = await get_transcript("dQw4w9WgXcQ", ["en", "fr"])
        print(result.text)
    """
    if languages is None:
        languages = ["en", "fr"]

    async with UltraResilientTranscriptExtractor() as extractor:
        return await extractor.extract(video_url_or_id, languages)


# ===================================================================
# BACKWARD COMPATIBILITY WITH EXISTING YOUTUBE.PY
# ===================================================================

async def extract_transcript_for_analysis(
    video_id: str,
    user_language: str = "en"
) -> Dict[str, Any]:
    """
    Main entry point for transcript extraction
    Compatible with existing analysis pipeline
    """
    languages = [user_language]
    if user_language != "en":
        languages.append("en")
    if user_language != "fr":
        languages.append("fr")

    try:
        result = await get_transcript(video_id, languages)

        return {
            "success": True,
            "transcript": result.text,
            "transcript_timestamped": result.text_timestamped,
            "language": result.language,
            "method": result.method.value,
            "confidence": result.confidence,
            "is_auto_generated": result.is_auto_generated,
            "segments": result.segments,
            "extraction_time_ms": result.extraction_time_ms,
        }

    except Exception as e:
        logger.error(f"Transcript extraction failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "transcript": None,
            "transcript_timestamped": None,
        }
