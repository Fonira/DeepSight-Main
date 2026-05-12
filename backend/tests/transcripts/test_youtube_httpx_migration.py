"""
Source-level locks for the httpx routing strategy in
`transcripts/youtube.py`.

REVERT POST-#472 — 2026-05-12
============================
PR #472 (audit B3) over-migrated 10 routes (Supadata, Invidious, Piped) from
`shared_http_client` to `get_proxied_client`. Production observed analyses
stuck at 20% "Extraction du transcript" after deploy.

Decision : these are INTERMEDIATE services that access YouTube with their
own infra. They do NOT need the Decodo residential proxy on the DeepSight
side. Only DIRECT calls to www.youtube.com benefit from `get_proxied_client`
(currently : oEmbed l.615, migrated separately in PR #459).

yt-dlp subprocess calls keep `--proxy` injection via
`_yt_dlp_extra_args()` (PR #469/#470/#472 ytsearch fix) — those are
unrelated to this httpx revert.

What this test file asserts now :
- oEmbed (www.youtube.com — direct call) USES `get_proxied_client` (PR #459)
- Supadata / Invidious / Piped routes USE `shared_http_client` (revert post-#472)
- STT API routes (Groq, Voxtral, Deepgram, OpenAI, AssemblyAI, ElevenLabs)
  USE `shared_http_client` (untouched, no proxy needed)

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
        """`get_proxied_client` is still needed for oEmbed (PR #459)."""
        yt = _get_youtube_module()
        assert hasattr(yt, "get_proxied_client"), (
            "transcripts.youtube did not import get_proxied_client — "
            "oEmbed (PR #459) would lose Decodo routing on direct YouTube call."
        )

    def test_imports_shared_http_client(self):
        """`shared_http_client` is the default for intermediate services
        (Supadata, Invidious, Piped) + STT API calls (Groq, Voxtral,
        Deepgram, OpenAI, AssemblyAI, ElevenLabs)."""
        yt = _get_youtube_module()
        assert hasattr(yt, "shared_http_client"), (
            "shared_http_client removed from transcripts.youtube — "
            "all intermediate + STT calls would break."
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Direct YouTube route — oEmbed MUST use get_proxied_client (PR #459)
# ═══════════════════════════════════════════════════════════════════════════════


class TestDirectYouTubeRouteUsesProxiedClient:
    """The oEmbed endpoint is the ONLY remaining direct call to www.youtube.com
    from `transcripts/youtube.py`. It must keep `get_proxied_client` (PR #459)."""

    def setup_method(self):
        yt = _get_youtube_module()
        self.src = inspect.getsource(yt)

    def test_youtube_oembed_uses_proxied_client(self):
        """www.youtube.com/oembed — direct YouTube call (PR #459).

        Note: `youtube.com/oembed` appears in the URL string ASSIGNED to a
        variable, not directly inside `async with` block. We look forward
        ~5 lines from the marker for the next `async with`.
        """
        url_marker = "www.youtube.com/oembed"
        assert url_marker in self.src, (
            f"URL marker {url_marker!r} not found — oEmbed route removed?"
        )
        pos = self.src.find(url_marker)
        # Look FORWARD a few hundred chars for the next `async with`
        window_end = min(len(self.src), pos + 500)
        window = self.src[pos:window_end]
        next_async_with = window.find("async with ")
        assert next_async_with != -1, (
            "No `async with` found after oEmbed URL — context may have changed."
        )
        snippet = window[next_async_with : next_async_with + 200]
        assert "get_proxied_client" in snippet, (
            "oEmbed (www.youtube.com direct call, PR #459) regressed from "
            "get_proxied_client — Decodo routing lost on direct YouTube call."
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Intermediate services — Supadata / Invidious / Piped MUST use shared_http_client
# ═══════════════════════════════════════════════════════════════════════════════


class TestIntermediateRoutesUseSharedClient:
    """Supadata, Invidious, Piped are INTERMEDIATE services that access
    YouTube with their own infra. They do NOT need the Decodo proxy
    (which adds latency + bandwidth cost). Routes must use
    `shared_http_client` (revert post-#472)."""

    def setup_method(self):
        yt = _get_youtube_module()
        self.src = inspect.getsource(yt)

    def _assert_url_uses_shared_client(self, url_marker: str):
        """For each occurrence of `url_marker`, the enclosing `async with`
        must be `shared_http_client`, not `get_proxied_client`."""
        assert url_marker in self.src, (
            f"URL marker {url_marker!r} not found in transcripts/youtube.py — "
            "route may have been removed; update this test."
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
                f"URL marker {url_marker!r} is fetched via get_proxied_client. "
                f"Revert post-#472 : intermediate services don't need Decodo. "
                f"Should be `shared_http_client`."
            )
            assert "shared_http_client" in snippet, (
                f"URL marker {url_marker!r} is not fetched via shared_http_client. "
                f"At least one occurrence has unexpected wiring."
            )

    def test_supadata_metadata_uses_shared_client(self):
        """api.supadata.ai/v1/metadata — intermediate, no Decodo needed."""
        self._assert_url_uses_shared_client("api.supadata.ai/v1/metadata")

    def test_supadata_transcript_uses_shared_client(self):
        """api.supadata.ai/v1/youtube/transcript — intermediate, no Decodo needed."""
        self._assert_url_uses_shared_client("api.supadata.ai/v1/youtube/transcript")

    def test_supadata_unified_transcript_uses_shared_client(self):
        """api.supadata.ai/v1/transcript — intermediate, no Decodo needed."""
        self._assert_url_uses_shared_client("api.supadata.ai/v1/transcript")

    def test_invidious_videos_endpoint_uses_shared_client(self):
        """{instance}/api/v1/videos/{id} — Invidious, intermediate, no Decodo needed."""
        self._assert_url_uses_shared_client("/api/v1/videos/{video_id}")

    def test_invidious_captions_endpoint_uses_shared_client(self):
        """{instance}/api/v1/captions/{id} — Invidious, intermediate, no Decodo needed."""
        self._assert_url_uses_shared_client("/api/v1/captions/{video_id}")

    def test_invidious_playlists_endpoint_uses_shared_client(self):
        """{instance}/api/v1/playlists/{id} — Invidious, intermediate, no Decodo needed."""
        self._assert_url_uses_shared_client("/api/v1/playlists/{playlist_id}")

    def test_piped_streams_endpoint_uses_shared_client(self):
        """{instance}/streams/{id} — Piped, intermediate, no Decodo needed."""
        self._assert_url_uses_shared_client("/streams/{video_id}")


# ═══════════════════════════════════════════════════════════════════════════════
# Non-YouTube routes — STT APIs must keep shared_http_client
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
# Coverage smoke — lock total counts post-revert
# ═══════════════════════════════════════════════════════════════════════════════


class TestProxiedClientCoverage:
    """Lock the count of `get_proxied_client` usages in transcripts/youtube.py
    to prevent silent regressions in either direction (over-migration like #472
    OR under-migration that drops oEmbed routing)."""

    def test_get_proxied_client_count_post_revert(self):
        """Post-revert (this PR) : exactly 1 occurrence — oEmbed (PR #459).
        If this climbs > 2, an over-migration like #472 likely happened
        again. If this drops to 0, oEmbed regressed to shared_http_client."""
        yt = _get_youtube_module()
        src = inspect.getsource(yt)
        count = src.count("async with get_proxied_client")
        assert count == 1, (
            f"Expected exactly 1 `async with get_proxied_client` block in "
            f"transcripts/youtube.py (oEmbed direct YouTube call, PR #459), "
            f"got {count}. Either over-migration is happening again "
            f"(post-#472 was reverted) OR oEmbed lost its proxy."
        )

    def test_shared_http_client_count_post_revert(self):
        """Post-revert : intermediate services + STT APIs = ~16 occurrences.
        Pre-revert with #472 over-migration : was ~6 (only STT).
        Pre-#472 baseline : ~17. If this drops below 12, a new over-migration
        likely happened."""
        yt = _get_youtube_module()
        src = inspect.getsource(yt)
        count = src.count("async with shared_http_client")
        assert count >= 12, (
            f"Only {count} `async with shared_http_client` blocks in "
            f"transcripts/youtube.py — expected >= 12 (Supadata + Invidious "
            f"+ Piped + 6 STT routes). A new over-migration may be happening."
        )
