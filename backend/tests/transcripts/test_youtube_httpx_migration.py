"""
Source-level locks for the httpx migration of YouTube-targeted routes in
`transcripts/youtube.py` from `shared_http_client` to `get_proxied_client`.

Sprint Wave 2 (Audit B3) — follow-up to docs/audits/2026-05-11-proxy-coverage.md
and PR #459 (initial migration of the oEmbed fallback).

Context
=======
The Hetzner VPS IP is bot-challenged by YouTube / Invidious / Piped (datacenter
IP range). The audit identified 7+ `httpx.AsyncClient` (via `shared_http_client`)
calls that hit YouTube-adjacent services :
  - api.supadata.ai (Supadata serves YouTube metadata + transcripts)
  - Invidious instances (10 mirrors that proxy YouTube)
  - Piped instances (8 mirrors that proxy YouTube)
  - www.youtube.com (oEmbed — already migrated in #459)

This sprint migrates those routes to `get_proxied_client` so they route via
the Decodo residential proxy when `YOUTUBE_PROXY` is set.

Non-YouTube routes (Groq, Voxtral/Mistral, Deepgram, OpenAI, AssemblyAI,
ElevenLabs STT APIs) MUST keep `shared_http_client` — they are not blocked
on Hetzner and a residential proxy would add latency + consume quota.

Tests strategy
==============
The actual proxy plumbing of `get_proxied_client` is verified in
`tests/test_proxy_coverage.py`. Here we lock the WIRING : source-level
assertions that the migration is applied on YouTube routes and not on
STT API routes.

This mirrors the pattern of
`tests/transcripts/test_youtube_proxy_injection.py::TestProxyInjectionCoverage`.
"""

import inspect
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


def _get_youtube_module():
    """Lazy import so collection doesn't blow up if dependency tree shifts."""
    from transcripts import youtube as yt
    return yt


# ═══════════════════════════════════════════════════════════════════════════════
# Imports — both helpers are exposed at module level
# ═══════════════════════════════════════════════════════════════════════════════


class TestImports:
    """Both helpers should be importable from `transcripts.youtube`."""

    def test_imports_get_proxied_client(self):
        yt = _get_youtube_module()
        assert hasattr(yt, "get_proxied_client"), (
            "transcripts.youtube did not import get_proxied_client — "
            "Sprint Wave 2 (B3) migration not applied."
        )

    def test_still_imports_shared_http_client_for_non_youtube_routes(self):
        """`shared_http_client` is still needed for STT API calls (Groq,
        Voxtral, Deepgram, OpenAI, AssemblyAI, ElevenLabs). It must remain
        imported."""
        yt = _get_youtube_module()
        assert hasattr(yt, "shared_http_client"), (
            "shared_http_client removed from transcripts.youtube — "
            "STT API calls (Groq/Voxtral/Deepgram/OpenAI/AssemblyAI/ElevenLabs) "
            "would break."
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Migration coverage — YouTube routes must use get_proxied_client
# ═══════════════════════════════════════════════════════════════════════════════


class TestYouTubeRoutesUseProxiedClient:
    """Source-level assertion : each YouTube-adjacent service URL must be
    fetched via `get_proxied_client` (so the call routes through Decodo)."""

    def setup_method(self):
        yt = _get_youtube_module()
        self.src = inspect.getsource(yt)

    def _assert_url_uses_proxied_client(self, url_marker: str, context_lines: int = 40):
        """Slice the source around `url_marker`, look back ``context_lines`` lines
        and assert the enclosing `async with` is `get_proxied_client`, not
        `shared_http_client`.
        """
        assert url_marker in self.src, (
            f"URL marker {url_marker!r} not found in transcripts/youtube.py — "
            "route may have been removed; update this test."
        )
        # Find ALL occurrences (the marker may appear multiple times)
        positions = []
        idx = 0
        while True:
            pos = self.src.find(url_marker, idx)
            if pos == -1:
                break
            positions.append(pos)
            idx = pos + 1

        # For each occurrence, check the preceding ~80 lines for the
        # enclosing `async with` block.
        any_proxied = False
        any_shared = False
        for pos in positions:
            # Look back ~80 lines (roughly 3500 chars)
            window_start = max(0, pos - 3500)
            window = self.src[window_start:pos]
            # Find the LAST `async with` before this URL
            last_async_with = window.rfind("async with ")
            if last_async_with == -1:
                continue
            snippet = window[last_async_with : last_async_with + 200]
            if "get_proxied_client" in snippet:
                any_proxied = True
            elif "shared_http_client" in snippet:
                any_shared = True

        assert any_proxied, (
            f"URL marker {url_marker!r} is not fetched via get_proxied_client. "
            f"At least one occurrence should use the proxied client."
        )
        assert not any_shared, (
            f"URL marker {url_marker!r} is still fetched via shared_http_client "
            f"somewhere — should be migrated to get_proxied_client (audit B3)."
        )

    def test_supadata_metadata_uses_proxied_client(self):
        """api.supadata.ai/v1/metadata fetches YouTube video metadata."""
        self._assert_url_uses_proxied_client("api.supadata.ai/v1/metadata")

    def test_supadata_transcript_uses_proxied_client(self):
        """api.supadata.ai/v1/youtube/transcript fetches YouTube transcripts."""
        self._assert_url_uses_proxied_client("api.supadata.ai/v1/youtube/transcript")

    def test_supadata_unified_transcript_uses_proxied_client(self):
        """api.supadata.ai/v1/transcript (unified endpoint for YouTube)."""
        self._assert_url_uses_proxied_client("api.supadata.ai/v1/transcript")

    def test_invidious_videos_endpoint_uses_proxied_client(self):
        """{instance}/api/v1/videos/{id} — Invidious metadata + audio formats."""
        self._assert_url_uses_proxied_client("/api/v1/videos/{video_id}")

    def test_invidious_captions_endpoint_uses_proxied_client(self):
        """{instance}/api/v1/captions/{id} — Invidious captions list."""
        self._assert_url_uses_proxied_client("/api/v1/captions/{video_id}")

    def test_invidious_playlists_endpoint_uses_proxied_client(self):
        """{instance}/api/v1/playlists/{id} — Invidious playlist videos."""
        self._assert_url_uses_proxied_client("/api/v1/playlists/{playlist_id}")

    def test_piped_streams_endpoint_uses_proxied_client(self):
        """{instance}/streams/{id} — Piped streams endpoint (subtitles incl.)."""
        self._assert_url_uses_proxied_client("/streams/{video_id}")

    def test_youtube_oembed_uses_proxied_client(self):
        """www.youtube.com/oembed — already migrated in PR #459."""
        self._assert_url_uses_proxied_client("www.youtube.com/oembed")


# ═══════════════════════════════════════════════════════════════════════════════
# Non-YouTube routes — STT APIs must NOT use get_proxied_client
# ═══════════════════════════════════════════════════════════════════════════════


class TestSTTRoutesKeepSharedClient:
    """STT API endpoints (Groq Whisper, Mistral Voxtral, Deepgram Nova-2,
    OpenAI Whisper, AssemblyAI, ElevenLabs Scribe) must keep
    `shared_http_client` — they're not blocked on Hetzner, and routing them
    via Decodo would add latency + bandwidth cost."""

    def setup_method(self):
        yt = _get_youtube_module()
        self.src = inspect.getsource(yt)

    def _assert_url_does_not_use_proxied_client(self, url_marker: str):
        """Each STT URL must be fetched via `shared_http_client`, not the
        proxied one (cost + latency)."""
        assert url_marker in self.src, (
            f"URL marker {url_marker!r} not found — test may need update."
        )
        positions = []
        idx = 0
        while True:
            pos = self.src.find(url_marker, idx)
            if pos == -1:
                break
            positions.append(pos)
            idx = pos + 1

        for pos in positions:
            window_start = max(0, pos - 3500)
            window = self.src[window_start:pos]
            last_async_with = window.rfind("async with ")
            if last_async_with == -1:
                continue
            snippet = window[last_async_with : last_async_with + 200]
            assert "get_proxied_client" not in snippet, (
                f"STT URL {url_marker!r} is fetched via get_proxied_client — "
                f"should be shared_http_client (non-YouTube, no proxy needed)."
            )

    def test_groq_whisper_keeps_shared_client(self):
        """api.groq.com/openai/v1/audio/transcriptions = Groq Whisper STT."""
        self._assert_url_does_not_use_proxied_client(
            "api.groq.com/openai/v1/audio/transcriptions"
        )

    def test_deepgram_keeps_shared_client(self):
        """api.deepgram.com/v1/listen = Deepgram Nova-2 STT."""
        self._assert_url_does_not_use_proxied_client("api.deepgram.com/v1/listen")

    def test_openai_whisper_keeps_shared_client(self):
        """api.openai.com/v1/audio/transcriptions = OpenAI Whisper STT."""
        self._assert_url_does_not_use_proxied_client(
            "api.openai.com/v1/audio/transcriptions"
        )

    def test_assemblyai_keeps_shared_client(self):
        """api.assemblyai.com/v2/upload = AssemblyAI STT (audio upload)."""
        self._assert_url_does_not_use_proxied_client("api.assemblyai.com/v2/upload")

    def test_elevenlabs_keeps_shared_client(self):
        """api.elevenlabs.io/v1/speech-to-text = ElevenLabs Scribe STT."""
        self._assert_url_does_not_use_proxied_client(
            "api.elevenlabs.io/v1/speech-to-text"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Coverage smoke — lock total counts to prevent regressions
# ═══════════════════════════════════════════════════════════════════════════════


class TestProxiedClientCoverage:
    """Lock the count of `get_proxied_client` usages in transcripts/youtube.py
    to prevent silent regressions (e.g. a refactor that reverts one back to
    `shared_http_client` and changes the URL in the same diff)."""

    def test_get_proxied_client_count(self):
        """Pre-migration : 1 occurrence (oEmbed, PR #459).
        Post-migration : 8+ occurrences (Supadata×2, Invidious×5+, Piped×1, oEmbed×1).
        """
        yt = _get_youtube_module()
        src = inspect.getsource(yt)
        count = src.count("async with get_proxied_client")
        assert count >= 8, (
            f"Expected >=8 async with get_proxied_client blocks in "
            f"transcripts/youtube.py, got {count}. The Wave 2 (B3) httpx "
            f"migration may have regressed."
        )

    def test_shared_http_client_count_minimal(self):
        """Pre-migration : ~17 occurrences (most YouTube routes + STT APIs).
        Post-migration : should be <= ~7 (only STT API routes remain :
        Groq, Voxtral, Deepgram, OpenAI, AssemblyAI×2, ElevenLabs)."""
        yt = _get_youtube_module()
        src = inspect.getsource(yt)
        count = src.count("async with shared_http_client")
        # 6 STT API routes max in transcripts/youtube.py (Groq, Voxtral,
        # Deepgram, OpenAI, AssemblyAI, ElevenLabs). Allow some slack for
        # incidental usage but flag if it climbs back.
        assert count <= 8, (
            f"shared_http_client used {count} times in transcripts/youtube.py — "
            f"some YouTube routes may have regressed to shared_http_client. "
            f"Expected <=8 (STT API calls only)."
        )
