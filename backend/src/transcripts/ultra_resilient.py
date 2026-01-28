"""
Ultra-Resilient YouTube Transcript Extractor
Priority: Reliability > Speed > Cost
Success target: 99%+ of all YouTube videos
"""

import asyncio
import aiohttp
import io
import os
import re
import random
import shutil
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


def _format_seconds_to_timestamp(seconds: float) -> str:
    """Format seconds to [MM:SS] or [HH:MM:SS] for transcript timestamps."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


class TranscriptMethod(Enum):
    SUPADATA = "supadata"
    YOUTUBE_TRANSCRIPT_API = "youtube_transcript_api"
    INVIDIOUS = "invidious"
    PIPED = "piped"
    YT_DLP_MANUAL = "yt_dlp_manual"
    YT_DLP_AUTO = "yt_dlp_auto"
    GROQ_WHISPER = "groq_whisper"
    OPENAI_WHISPER = "openai_whisper"
    DEEPGRAM = "deepgram"
    ASSEMBLYAI = "assemblyai"


@dataclass
class TranscriptResult:
    text: str
    method: TranscriptMethod
    language: str
    duration_seconds: float
    is_auto_generated: bool
    segments: Optional[List[Dict]] = None


@dataclass
class MethodStats:
    attempts: int = 0
    successes: int = 0
    failures: int = 0
    avg_latency_ms: float = 0
    last_failure: Optional[datetime] = None

    @property
    def success_rate(self) -> float:
        return self.successes / self.attempts if self.attempts > 0 else 0

    @property
    def is_healthy(self) -> bool:
        if self.last_failure and datetime.now() - self.last_failure < timedelta(minutes=5):
            return self.success_rate > 0.3
        return self.success_rate > 0.5 or self.attempts < 3


class CircuitBreaker:
    """Prevent hammering failed services"""

    def __init__(self, failure_threshold: int = 5, recovery_time: int = 300):
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        self.failures: Dict[str, List[datetime]] = {}

    def record_failure(self, service: str):
        if service not in self.failures:
            self.failures[service] = []
        self.failures[service].append(datetime.now())
        cutoff = datetime.now() - timedelta(seconds=self.recovery_time)
        self.failures[service] = [f for f in self.failures[service] if f > cutoff]

    def record_success(self, service: str):
        if service in self.failures:
            self.failures[service] = []

    def is_open(self, service: str) -> bool:
        if service not in self.failures:
            return False
        cutoff = datetime.now() - timedelta(seconds=self.recovery_time)
        recent_failures = [f for f in self.failures[service] if f > cutoff]
        return len(recent_failures) >= self.failure_threshold


class UltraResilientTranscriptExtractor:
    """
    10-method cascade with intelligent routing
    """

    INVIDIOUS_INSTANCES = [
        "https://vid.puffyan.us",
        "https://invidious.snopyta.org",
        "https://yewtu.be",
        "https://invidious.kavin.rocks",
        "https://inv.riverside.rocks",
        "https://invidious.osi.kr",
        "https://invidious.namazso.eu",
        "https://invidious.nerdvpn.de",
        "https://inv.vern.cc",
        "https://invidious.slipfox.xyz",
        "https://invidious.privacydev.net",
        "https://iv.melmac.space",
        "https://invidious.lunar.icu",
        "https://inv.zzls.xyz",
        "https://invidious.protokolla.fi",
    ]

    PIPED_INSTANCES = [
        "https://pipedapi.kavin.rocks",
        "https://pipedapi.tokhmi.xyz",
        "https://pipedapi.moomoo.me",
        "https://pipedapi.syncpundit.io",
        "https://api-piped.mha.fi",
        "https://pipedapi.r4fo.com",
        "https://pipedapi.colinslegacy.com",
        "https://pipedapi.privacy.com.de",
        "https://pipedapi.smnz.de",
        "https://pipedapi.adminforge.de",
        "https://pipedapi.qdi.fi",
    ]

    LANGUAGE_PRIORITY = [
        "fr", "en", "en-US", "en-GB", "es", "de", "pt", "it", "nl", "ru",
        "ja", "ko", "zh", "zh-CN", "zh-TW", "ar", "hi", "tr", "pl", "vi",
        "th", "id", "sv", "da", "no", "fi", "cs", "ro", "el", "he", "uk"
    ]

    def __init__(
        self,
        supadata_api_key: Optional[str] = None,
        groq_api_key: Optional[str] = None,
        deepgram_api_key: Optional[str] = None,
        assemblyai_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        preferred_language: str = "fr",
        max_audio_duration: int = 900,
    ):
        self.supadata_api_key = supadata_api_key
        self.groq_api_key = groq_api_key
        self.deepgram_api_key = deepgram_api_key
        self.assemblyai_api_key = assemblyai_api_key
        self.openai_api_key = openai_api_key
        self.preferred_language = preferred_language
        self.max_audio_duration = max_audio_duration

        self.circuit_breaker = CircuitBreaker()
        self.stats: Dict[TranscriptMethod, MethodStats] = {m: MethodStats() for m in TranscriptMethod}

        random.shuffle(self.INVIDIOUS_INSTANCES)
        random.shuffle(self.PIPED_INSTANCES)

    def _extract_video_id(self, url_or_id: str) -> str:
        patterns = [
            r'(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})',
            r'^([a-zA-Z0-9_-]{11})$'
        ]
        for pattern in patterns:
            match = re.search(pattern, url_or_id)
            if match:
                return match.group(1)
        raise ValueError(f"Invalid YouTube URL or ID: {url_or_id}")

    async def get_transcript(
        self,
        video_url_or_id: str,
        target_language: Optional[str] = None,
    ) -> TranscriptResult:
        video_id = self._extract_video_id(video_url_or_id)
        target_lang = target_language or self.preferred_language

        logger.info(f"[TRANSCRIPT] Starting extraction for {video_id}, target: {target_lang}")
        start_time = datetime.now()

        phase1_result = await self._phase1_text_extraction(video_id, target_lang)
        if phase1_result:
            return phase1_result

        phase2_result = await self._phase2_ytdlp_extraction(video_id, target_lang)
        if phase2_result:
            return phase2_result

        phase3_result = await self._phase3_audio_transcription(video_id, target_lang)
        if phase3_result:
            return phase3_result

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.error(f"[TRANSCRIPT] All methods failed for {video_id} after {elapsed:.1f}s")
        raise TranscriptNotFoundError(f"Could not extract transcript for {video_id}")

    async def _phase1_text_extraction(
        self,
        video_id: str,
        target_lang: str
    ) -> Optional[TranscriptResult]:
        logger.info(f"[PHASE1] Text extraction for {video_id}")

        methods = []

        if self.supadata_api_key and not self.circuit_breaker.is_open("supadata"):
            methods.append(self._try_supadata(video_id, target_lang))

        if not self.circuit_breaker.is_open("youtube_transcript_api"):
            methods.append(self._try_youtube_transcript_api(video_id, target_lang))

        if not self.circuit_breaker.is_open("invidious"):
            methods.append(self._try_invidious(video_id, target_lang))

        if not self.circuit_breaker.is_open("piped"):
            methods.append(self._try_piped(video_id, target_lang))

        if not methods:
            return None

        try:
            done, pending = await asyncio.wait(
                methods,
                timeout=45,
                return_when=asyncio.FIRST_COMPLETED
            )

            # Check completed tasks first; do NOT cancel pending yet — we may need them as fallback.
            for task in done:
                try:
                    result = task.result()
                    if result:
                        # Success: cancel pending and return (absorb CancelledError via gather).
                        for t in pending:
                            t.cancel()
                        if pending:
                            await asyncio.gather(*pending, return_exceptions=True)
                        logger.info(f"[PHASE1] Success with {result.method.value}")
                        return result
                except Exception as e:
                    logger.debug(f"[PHASE1] Task failed: {e}")

            # No valid result from first completed — wait for pending (they are not cancelled).
            if pending:
                done2, pending2 = await asyncio.wait(pending, timeout=15)
                for task in done2:
                    try:
                        result = task.result()
                        if result:
                            for t in pending2:
                                t.cancel()
                            if pending2:
                                await asyncio.gather(*pending2, return_exceptions=True)
                            return result
                    except Exception:
                        pass
                # No result from fallbacks: cancel any still-pending and clean up.
                for t in pending2:
                    t.cancel()
                if pending2:
                    await asyncio.gather(*pending2, return_exceptions=True)

        except asyncio.TimeoutError:
            logger.warning("[PHASE1] Timeout reached")

        return None

    async def _phase2_ytdlp_extraction(
        self,
        video_id: str,
        target_lang: str
    ) -> Optional[TranscriptResult]:
        logger.info(f"[PHASE2] yt-dlp extraction for {video_id}")

        if not self.circuit_breaker.is_open("yt_dlp_manual"):
            result = await self._try_ytdlp_subtitles(video_id, target_lang, auto_generated=False)
            if result:
                return result

        if not self.circuit_breaker.is_open("yt_dlp_auto"):
            result = await self._try_ytdlp_subtitles(video_id, target_lang, auto_generated=True)
            if result:
                return result

        return None

    async def _phase3_audio_transcription(
        self,
        video_id: str,
        target_lang: str
    ) -> Optional[TranscriptResult]:
        logger.info(f"[PHASE3] Audio transcription for {video_id}")

        audio_path = await self._download_audio(video_id)
        if not audio_path:
            return None

        try:
            duration = await self._get_audio_duration(audio_path)
            if duration > self.max_audio_duration:
                logger.warning(f"[PHASE3] Video too long: {duration}s > {self.max_audio_duration}s")
                return None

            services = [
                (self._transcribe_groq, "groq_whisper", self.groq_api_key),
                (self._transcribe_openai_whisper, "openai_whisper", self.openai_api_key),
                (self._transcribe_deepgram, "deepgram", self.deepgram_api_key),
                (self._transcribe_assemblyai, "assemblyai", self.assemblyai_api_key),
            ]

            for transcribe_fn, service_name, api_key in services:
                if not api_key or self.circuit_breaker.is_open(service_name):
                    continue

                try:
                    result = await transcribe_fn(audio_path, target_lang)
                    if result:
                        self.circuit_breaker.record_success(service_name)
                        return result
                except Exception as e:
                    logger.warning(f"[PHASE3] {service_name} failed: {e}")

        finally:
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
            if audio_path:
                parent = os.path.dirname(audio_path)
                if parent and os.path.isdir(parent):
                    try:
                        os.rmdir(parent)
                    except OSError:
                        pass

        return None

    # ===================
    # METHOD IMPLEMENTATIONS
    # ===================

    async def _try_supadata(self, video_id: str, target_lang: str) -> Optional[TranscriptResult]:
        start = datetime.now()
        self.stats[TranscriptMethod.SUPADATA].attempts += 1

        try:
            async with aiohttp.ClientSession() as session:
                for lang in [target_lang] + self.LANGUAGE_PRIORITY[:10]:
                    url = "https://api.supadata.ai/v1/youtube/transcript"
                    params = {
                        "video_id": video_id,
                        "lang": lang,
                        "format": "text",
                    }
                    headers = {"Authorization": f"Bearer {self.supadata_api_key}"}

                    for attempt in range(3):
                        try:
                            async with session.get(url, params=params, headers=headers, timeout=15) as resp:
                                if resp.status == 200:
                                    data = await resp.json()
                                    if data.get("transcript"):
                                        self._record_success(TranscriptMethod.SUPADATA, start)
                                        return TranscriptResult(
                                            text=data["transcript"],
                                            method=TranscriptMethod.SUPADATA,
                                            language=lang,
                                            duration_seconds=(datetime.now() - start).total_seconds(),
                                            is_auto_generated=data.get("auto_generated", False),
                                            segments=data.get("segments"),
                                        )
                                elif resp.status == 404:
                                    break
                                elif resp.status == 429:
                                    await asyncio.sleep(2 ** attempt)
                        except asyncio.TimeoutError:
                            await asyncio.sleep(1)

        except Exception as e:
            logger.debug(f"[SUPADATA] Error: {e}")

        self._record_failure(TranscriptMethod.SUPADATA)
        return None

    async def _try_youtube_transcript_api(self, video_id: str, target_lang: str) -> Optional[TranscriptResult]:
        start = datetime.now()
        self.stats[TranscriptMethod.YOUTUBE_TRANSCRIPT_API].attempts += 1

        try:
            from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

            loop = asyncio.get_event_loop()

            def fetch_transcript():
                try:
                    transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

                    try:
                        transcript = transcript_list.find_manually_created_transcript([target_lang])
                        return transcript.fetch(), target_lang, False
                    except Exception:
                        pass

                    try:
                        for t in transcript_list:
                            if not t.is_generated:
                                data = t.fetch()
                                if t.language_code != target_lang:
                                    try:
                                        data = t.translate(target_lang).fetch()
                                    except Exception:
                                        pass
                                return data, t.language_code, False
                    except Exception:
                        pass

                    try:
                        transcript = transcript_list.find_generated_transcript([target_lang])
                        return transcript.fetch(), target_lang, True
                    except Exception:
                        pass

                    for lang in self.LANGUAGE_PRIORITY:
                        try:
                            transcript = transcript_list.find_generated_transcript([lang])
                            data = transcript.fetch()
                            try:
                                data = transcript.translate(target_lang).fetch()
                            except Exception:
                                pass
                            return data, lang, True
                        except Exception:
                            continue

                    return None, None, None

                except (TranscriptsDisabled, NoTranscriptFound):
                    return None, None, None

            result, lang, is_auto = await loop.run_in_executor(None, fetch_transcript)

            if result:
                text = " ".join([entry["text"] for entry in result])
                self._record_success(TranscriptMethod.YOUTUBE_TRANSCRIPT_API, start)
                return TranscriptResult(
                    text=text,
                    method=TranscriptMethod.YOUTUBE_TRANSCRIPT_API,
                    language=lang,
                    duration_seconds=(datetime.now() - start).total_seconds(),
                    is_auto_generated=is_auto,
                    segments=[{"start": e["start"], "duration": e["duration"], "text": e["text"]} for e in result],
                )

        except Exception as e:
            logger.debug(f"[YOUTUBE_TRANSCRIPT_API] Error: {e}")

        self._record_failure(TranscriptMethod.YOUTUBE_TRANSCRIPT_API)
        return None

    async def _try_invidious(self, video_id: str, target_lang: str) -> Optional[TranscriptResult]:
        start = datetime.now()
        self.stats[TranscriptMethod.INVIDIOUS].attempts += 1

        instances = self.INVIDIOUS_INSTANCES.copy()
        random.shuffle(instances)

        async with aiohttp.ClientSession() as session:
            for instance in instances[:5]:
                try:
                    url = f"{instance}/api/v1/captions/{video_id}"
                    async with session.get(url, timeout=10) as resp:
                        if resp.status != 200:
                            continue

                        data = await resp.json()
                        captions = data.get("captions", [])

                        if not captions:
                            continue

                        caption = self._select_best_caption(captions, target_lang)
                        if not caption:
                            continue

                        caption_url = caption.get("url")
                        if not caption_url.startswith("http"):
                            caption_url = f"{instance}{caption_url}"

                        async with session.get(caption_url, timeout=10) as cap_resp:
                            if cap_resp.status == 200:
                                content = await cap_resp.text()
                                text = self._parse_caption_content(content)

                                if text:
                                    self._record_success(TranscriptMethod.INVIDIOUS, start)
                                    return TranscriptResult(
                                        text=text,
                                        method=TranscriptMethod.INVIDIOUS,
                                        language=caption.get("language_code", target_lang),
                                        duration_seconds=(datetime.now() - start).total_seconds(),
                                        is_auto_generated="auto" in caption.get("label", "").lower(),
                                    )

                except Exception as e:
                    logger.debug(f"[INVIDIOUS] {instance} failed: {e}")
                    continue

        self._record_failure(TranscriptMethod.INVIDIOUS)
        return None

    async def _try_piped(self, video_id: str, target_lang: str) -> Optional[TranscriptResult]:
        start = datetime.now()
        self.stats[TranscriptMethod.PIPED].attempts += 1

        instances = self.PIPED_INSTANCES.copy()
        random.shuffle(instances)

        async with aiohttp.ClientSession() as session:
            for instance in instances[:5]:
                try:
                    url = f"{instance}/streams/{video_id}"
                    async with session.get(url, timeout=10) as resp:
                        if resp.status != 200:
                            continue

                        data = await resp.json()
                        subtitles = data.get("subtitles", [])

                        if not subtitles:
                            continue

                        subtitle = self._select_best_subtitle(subtitles, target_lang)
                        if not subtitle:
                            continue

                        sub_url = subtitle.get("url")
                        async with session.get(sub_url, timeout=10) as sub_resp:
                            if sub_resp.status == 200:
                                content = await sub_resp.text()
                                text = self._parse_caption_content(content)

                                if text:
                                    self._record_success(TranscriptMethod.PIPED, start)
                                    return TranscriptResult(
                                        text=text,
                                        method=TranscriptMethod.PIPED,
                                        language=subtitle.get("code", target_lang),
                                        duration_seconds=(datetime.now() - start).total_seconds(),
                                        is_auto_generated=subtitle.get("autoGenerated", False),
                                    )

                except Exception as e:
                    logger.debug(f"[PIPED] {instance} failed: {e}")
                    continue

        self._record_failure(TranscriptMethod.PIPED)
        return None

    async def _try_ytdlp_subtitles(
        self,
        video_id: str,
        target_lang: str,
        auto_generated: bool
    ) -> Optional[TranscriptResult]:
        method = TranscriptMethod.YT_DLP_AUTO if auto_generated else TranscriptMethod.YT_DLP_MANUAL
        start = datetime.now()
        self.stats[method].attempts += 1

        try:
            import yt_dlp

            with tempfile.TemporaryDirectory() as tmpdir:
                langs = [target_lang] + [l for l in self.LANGUAGE_PRIORITY if l != target_lang]

                ydl_opts = {
                    "skip_download": True,
                    "writesubtitles": not auto_generated,
                    "writeautomaticsub": auto_generated,
                    "subtitleslangs": langs[:15],
                    "subtitlesformat": "vtt/srt/ass/best",
                    "outtmpl": f"{tmpdir}/%(id)s.%(ext)s",
                    "quiet": True,
                    "no_warnings": True,
                    "extractor_args": {
                        "youtube": {
                            "player_client": ["android", "web", "mweb", "ios"],
                            "skip": ["dash", "hls"],
                        }
                    },
                    "socket_timeout": 30,
                    "retries": 5,
                    "fragment_retries": 5,
                    "sleep_requests": 1,
                    "sleep_interval_subtitles": 1,
                    "geo_bypass": True,
                    "geo_bypass_country": "US",
                }

                cookies_path = Path.home() / ".config" / "yt-dlp" / "cookies.txt"
                if cookies_path.exists():
                    ydl_opts["cookiefile"] = str(cookies_path)

                loop = asyncio.get_event_loop()

                def extract():
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        url = f"https://www.youtube.com/watch?v={video_id}"
                        ydl.download([url])
                        return True

                await asyncio.wait_for(
                    loop.run_in_executor(None, extract),
                    timeout=60
                )

                for ext in ["vtt", "srt", "ass", "ttml"]:
                    for lang in langs[:15]:
                        pattern = f"{video_id}.{lang}*.{ext}"
                        for subfile in Path(tmpdir).glob(pattern):
                            text = self._parse_subtitle_file(subfile)
                            if text and len(text) > 50:
                                self._record_success(method, start)
                                return TranscriptResult(
                                    text=text,
                                    method=method,
                                    language=lang,
                                    duration_seconds=(datetime.now() - start).total_seconds(),
                                    is_auto_generated=auto_generated,
                                )

                for subfile in Path(tmpdir).glob(f"{video_id}*"):
                    if subfile.suffix in [".vtt", ".srt", ".ass", ".ttml"]:
                        text = self._parse_subtitle_file(subfile)
                        if text and len(text) > 50:
                            lang_match = re.search(r'\.([a-z]{2}(-[A-Z]{2})?)\.', subfile.name)
                            detected_lang = lang_match.group(1) if lang_match else "unknown"
                            self._record_success(method, start)
                            return TranscriptResult(
                                text=text,
                                method=method,
                                language=detected_lang,
                                duration_seconds=(datetime.now() - start).total_seconds(),
                                is_auto_generated=auto_generated,
                            )

        except Exception as e:
            logger.debug(f"[YT-DLP] Error: {e}")

        self._record_failure(method)
        return None

    async def _download_audio(self, video_id: str) -> Optional[str]:
        tmpdir = tempfile.mkdtemp()
        result: Optional[str] = None
        try:
            import yt_dlp

            output_path = os.path.join(tmpdir, f"{video_id}.mp3")

            ydl_opts = {
                "format": "bestaudio[ext=m4a]/bestaudio/best",
                "outtmpl": output_path.replace(".mp3", ".%(ext)s"),
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "128",
                }],
                "quiet": True,
                "no_warnings": True,
                "socket_timeout": 60,
                "retries": 3,
            }

            loop = asyncio.get_event_loop()

            def download():
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([f"https://www.youtube.com/watch?v={video_id}"])

            await asyncio.wait_for(
                loop.run_in_executor(None, download),
                timeout=120
            )

            for f in os.listdir(tmpdir):
                if f.endswith(".mp3"):
                    result = os.path.join(tmpdir, f)
                    break
        except Exception as e:
            logger.warning(f"[AUDIO] Download failed: {e}")
        finally:
            if result is None and tmpdir and os.path.exists(tmpdir):
                shutil.rmtree(tmpdir, ignore_errors=True)
        return result

    async def _get_audio_duration(self, audio_path: str) -> float:
        """
        Get audio duration in seconds via ffprobe.
        Requires ffmpeg/ffprobe on the system. Returns 0 on failure so Phase 3 can continue.
        """
        try:
            import subprocess
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
                capture_output=True, text=True, timeout=10
            )
            return float(result.stdout.strip())
        except Exception as e:
            logger.debug(f"[AUDIO] ffprobe failed (duration unknown): {e}")
        return 0

    async def _transcribe_groq(self, audio_path: str, target_lang: str) -> Optional[TranscriptResult]:
        start = datetime.now()

        try:
            from groq import Groq

            client = Groq(api_key=self.groq_api_key)

            def _run():
                with open(audio_path, "rb") as audio_file:
                    return client.audio.transcriptions.create(
                        file=(os.path.basename(audio_path), audio_file),
                        model="whisper-large-v3",
                        language=target_lang[:2] if target_lang else None,
                        response_format="verbose_json",
                    )

            loop = asyncio.get_event_loop()
            transcription = await loop.run_in_executor(None, _run)

            if transcription and getattr(transcription, "text", None):
                segments = [
                    {"start": s.get("start"), "end": s.get("end"), "text": s.get("text", "")}
                    for s in getattr(transcription, "segments", []) or []
                ]
                return TranscriptResult(
                    text=transcription.text,
                    method=TranscriptMethod.GROQ_WHISPER,
                    language=target_lang,
                    duration_seconds=(datetime.now() - start).total_seconds(),
                    is_auto_generated=True,
                    segments=segments if segments else None,
                )

        except Exception as e:
            logger.warning(f"[GROQ] Error: {e}")

        return None

    async def _transcribe_openai_whisper(self, audio_path: str, target_lang: str) -> Optional[TranscriptResult]:
        start = datetime.now()

        try:
            with open(audio_path, "rb") as f:
                audio_data = f.read()

            form = aiohttp.FormData()
            form.add_field("file", io.BytesIO(audio_data), filename=os.path.basename(audio_path), content_type="audio/mpeg")
            form.add_field("model", "whisper-1")
            form.add_field("response_format", "verbose_json")
            if target_lang and len(target_lang) >= 2:
                form.add_field("language", target_lang[:2])

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    data=form,
                    headers={"Authorization": f"Bearer {self.openai_api_key}"},
                    timeout=aiohttp.ClientTimeout(total=360),
                ) as resp:
                    if resp.status != 200:
                        logger.warning(f"[OPENAI-WHISPER] HTTP {resp.status}: {await resp.text()}")
                        return None

                    data = await resp.json()

            text = data.get("text", "")
            if not text:
                return None

            segments = [
                {"start": s.get("start"), "end": s.get("end"), "text": s.get("text", "")}
                for s in data.get("segments", []) or []
            ]

            return TranscriptResult(
                text=text,
                method=TranscriptMethod.OPENAI_WHISPER,
                language=target_lang,
                duration_seconds=(datetime.now() - start).total_seconds(),
                is_auto_generated=True,
                segments=segments if segments else None,
            )

        except Exception as e:
            logger.warning(f"[OPENAI-WHISPER] Error: {e}")

        return None

    async def _transcribe_deepgram(self, audio_path: str, target_lang: str) -> Optional[TranscriptResult]:
        start = datetime.now()

        try:
            async with aiohttp.ClientSession() as session:
                with open(audio_path, "rb") as audio_file:
                    audio_data = audio_file.read()

                url = "https://api.deepgram.com/v1/listen"
                params = {
                    "model": "nova-2",
                    "language": target_lang[:2] if target_lang else None,
                    "punctuate": "true",
                    "paragraphs": "true",
                }
                headers = {
                    "Authorization": f"Token {self.deepgram_api_key}",
                    "Content-Type": "audio/mp3",
                }

                async with session.post(url, params=params, headers=headers, data=audio_data) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]

                        if transcript:
                            return TranscriptResult(
                                text=transcript,
                                method=TranscriptMethod.DEEPGRAM,
                                language=target_lang,
                                duration_seconds=(datetime.now() - start).total_seconds(),
                                is_auto_generated=True,
                            )

        except Exception as e:
            logger.warning(f"[DEEPGRAM] Error: {e}")

        return None

    async def _transcribe_assemblyai(self, audio_path: str, target_lang: str) -> Optional[TranscriptResult]:
        start = datetime.now()

        try:
            async with aiohttp.ClientSession() as session:
                headers = {"authorization": self.assemblyai_api_key}

                with open(audio_path, "rb") as f:
                    async with session.post(
                        "https://api.assemblyai.com/v2/upload",
                        headers=headers,
                        data=f.read()
                    ) as resp:
                        upload_url = (await resp.json())["upload_url"]

                async with session.post(
                    "https://api.assemblyai.com/v2/transcript",
                    headers=headers,
                    json={"audio_url": upload_url, "language_code": target_lang[:2] if target_lang else "fr"}
                ) as resp:
                    transcript_id = (await resp.json())["id"]

                for _ in range(60):
                    async with session.get(
                        f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                        headers=headers
                    ) as resp:
                        data = await resp.json()
                        if data["status"] == "completed":
                            return TranscriptResult(
                                text=data["text"],
                                method=TranscriptMethod.ASSEMBLYAI,
                                language=target_lang,
                                duration_seconds=(datetime.now() - start).total_seconds(),
                                is_auto_generated=True,
                            )
                        elif data["status"] == "error":
                            break
                    await asyncio.sleep(5)

        except Exception as e:
            logger.warning(f"[ASSEMBLYAI] Error: {e}")

        return None

    # ===================
    # HELPER METHODS
    # ===================

    def _select_best_caption(self, captions: List[Dict], target_lang: str) -> Optional[Dict]:
        manual = [c for c in captions if "auto" not in c.get("label", "").lower()]
        auto = [c for c in captions if "auto" in c.get("label", "").lower()]

        for caption_list in [manual, auto]:
            for lang in [target_lang] + self.LANGUAGE_PRIORITY:
                for c in caption_list:
                    if c.get("language_code", "").startswith(lang):
                        return c

        return captions[0] if captions else None

    def _select_best_subtitle(self, subtitles: List[Dict], target_lang: str) -> Optional[Dict]:
        manual = [s for s in subtitles if not s.get("autoGenerated")]
        auto = [s for s in subtitles if s.get("autoGenerated")]

        for sub_list in [manual, auto]:
            for lang in [target_lang] + self.LANGUAGE_PRIORITY:
                for s in sub_list:
                    if s.get("code", "").startswith(lang):
                        return s

        return subtitles[0] if subtitles else None

    def _parse_caption_content(self, content: str) -> str:
        lines = []
        for line in content.split("\n"):
            line = line.strip()
            if not line or "-->" in line or line.isdigit() or line.startswith("WEBVTT"):
                continue
            line = re.sub(r"<[^>]+>", "", line)
            line = re.sub(r"align:.*|position:.*", "", line)
            if line:
                lines.append(line)

        unique_lines = []
        for line in lines:
            if not unique_lines or line != unique_lines[-1]:
                unique_lines.append(line)

        return " ".join(unique_lines)

    def _parse_subtitle_file(self, filepath: Path) -> str:
        try:
            content = filepath.read_text(encoding="utf-8", errors="ignore")
            return self._parse_caption_content(content)
        except Exception:
            return ""

    def _record_success(self, method: TranscriptMethod, start: datetime):
        self.stats[method].successes += 1
        latency = (datetime.now() - start).total_seconds() * 1000
        stats = self.stats[method]
        stats.avg_latency_ms = (stats.avg_latency_ms * (stats.successes - 1) + latency) / stats.successes
        self.circuit_breaker.record_success(method.value)

    def _record_failure(self, method: TranscriptMethod):
        self.stats[method].failures += 1
        self.stats[method].last_failure = datetime.now()
        self.circuit_breaker.record_failure(method.value)

    def get_stats(self) -> Dict[str, Any]:
        return {
            method.value: {
                "attempts": stats.attempts,
                "success_rate": f"{stats.success_rate:.1%}",
                "avg_latency_ms": f"{stats.avg_latency_ms:.0f}",
                "is_healthy": stats.is_healthy,
            }
            for method, stats in self.stats.items()
            if stats.attempts > 0
        }


class TranscriptNotFoundError(Exception):
    """No transcript available after all methods failed"""
    pass


# ===================
# WRAPPER: get_transcript_ultra
# ===================

async def get_transcript_ultra(
    video_id: str,
    target_language: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Wrapper compatible with get_transcript_with_timestamps.
    Returns (text, text_timestamped, lang) or (None, None, None) on failure.
    Uses core.config for API keys.
    """
    from core.config import (
        get_supadata_key,
        get_groq_key,
        get_deepgram_key,
        get_assemblyai_key,
        get_openai_key,
    )

    extractor = UltraResilientTranscriptExtractor(
        supadata_api_key=get_supadata_key() or None,
        groq_api_key=get_groq_key(),
        deepgram_api_key=get_deepgram_key(),
        assemblyai_api_key=get_assemblyai_key(),
        openai_api_key=get_openai_key(),
        preferred_language=target_language or "fr",
        max_audio_duration=900,
    )

    try:
        result = await extractor.get_transcript(video_id, target_language)
    except TranscriptNotFoundError as e:
        logger.debug(f"[get_transcript_ultra] {e}")
        return (None, None, None)
    except Exception as e:
        logger.exception(f"[get_transcript_ultra] Unexpected error: {e}")
        return (None, None, None)

    text = result.text
    lang = result.language

    if result.segments and len(result.segments) > 0:
        parts = []
        last_ts = -30.0
        for seg in result.segments:
            t = seg.get("text", "").strip()
            start = float(seg.get("start", 0))
            if not t:
                continue
            if start - last_ts >= 30:
                ts = _format_seconds_to_timestamp(start)
                parts.append(f"\n[{ts}] {t}")
                last_ts = start
            else:
                parts.append(f" {t}")
        text_timestamped = "".join(parts).strip() if parts else text
    else:
        text_timestamped = text

    return (text, text_timestamped, lang)
