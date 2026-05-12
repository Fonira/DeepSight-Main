"""
Tests for --proxy injection in yt-dlp subprocess calls inside transcripts/youtube.py.

Sprint 2026-05-12 follow-up to audit 2026-05-11-proxy-coverage.md : 5 yt-dlp
subprocess calls were missing the Decodo residential proxy, causing bot
challenges from Hetzner. This locks the wiring so future refactors don't
silently drop --proxy on these paths.

Spots covered :
- L654 get_video_info_ytdlp (metadata dump-json — root cause Summary 208
  visual_analysis=null, video_duration=0)
- L1419 WHISPER STT audio fallback
- L1756 DEEPGRAM STT audio fallback
- L2753 get_playlist_videos (flat-playlist metadata)
- L2820 get_playlist_info (playlist single-json metadata)
"""

import json
import os
import sys
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _make_fake_run(stdout: str = "", returncode: int = 0):
    """Return a fake subprocess.run that captures cmd and returns canned output."""
    captured = {"cmd": None}

    def fake_run(cmd, *args, **kwargs):
        captured["cmd"] = list(cmd)
        result = MagicMock()
        result.returncode = returncode
        result.stdout = stdout
        result.stderr = ""
        return result

    return fake_run, captured


def _assert_proxy_in_cmd(cmd: list, proxy_url: str):
    """Assert --proxy <url> is in cmd (anywhere, since pattern uses insert(1,2))."""
    assert "--proxy" in cmd, (
        f"--proxy missing from cmd. Got: {cmd[:8]}..."
    )
    idx = cmd.index("--proxy")
    assert cmd[idx + 1] == proxy_url, (
        f"Expected proxy {proxy_url!r} after --proxy, got {cmd[idx + 1]!r}"
    )


def _assert_no_proxy_in_cmd(cmd: list):
    assert "--proxy" not in cmd, f"Unexpected --proxy in cmd: {cmd[:8]}..."


PROXY_URL = "http://sp9fsc9l2p:Hj046a=vHnDabt8fUj@gate.decodo.com:7000"


# ═══════════════════════════════════════════════════════════════════════════════
# L654 get_video_info_ytdlp — metadata dump-json
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetVideoInfoYtdlpProxy:
    @pytest.mark.asyncio
    async def test_proxy_injected_when_set(self, monkeypatch):
        from transcripts import youtube as yt

        fake_run, captured = _make_fake_run(
            stdout=json.dumps({"title": "x", "duration": 3600})
        )
        monkeypatch.setattr(yt.subprocess, "run", fake_run)
        monkeypatch.setattr(yt, "get_youtube_proxy", lambda: PROXY_URL)

        result = await yt.get_video_info_ytdlp("zjkBMFhNj_g")

        assert result is not None
        assert result["duration"] == 3600
        _assert_proxy_in_cmd(captured["cmd"], PROXY_URL)

    @pytest.mark.asyncio
    async def test_no_proxy_when_unset(self, monkeypatch):
        from transcripts import youtube as yt

        fake_run, captured = _make_fake_run(stdout=json.dumps({"title": "x"}))
        monkeypatch.setattr(yt.subprocess, "run", fake_run)
        monkeypatch.setattr(yt, "get_youtube_proxy", lambda: "")

        await yt.get_video_info_ytdlp("zjkBMFhNj_g")

        _assert_no_proxy_in_cmd(captured["cmd"])

    @pytest.mark.asyncio
    async def test_cmd_target_url_preserved_with_proxy(self, monkeypatch):
        """Regression : proxy insertion at position 1-2 doesn't break target URL."""
        from transcripts import youtube as yt

        fake_run, captured = _make_fake_run(stdout=json.dumps({}))
        monkeypatch.setattr(yt.subprocess, "run", fake_run)
        monkeypatch.setattr(yt, "get_youtube_proxy", lambda: PROXY_URL)

        await yt.get_video_info_ytdlp("dQw4w9WgXcQ")

        assert captured["cmd"][0] == "yt-dlp"
        assert captured["cmd"][1] == "--proxy"
        assert captured["cmd"][2] == PROXY_URL
        # Target URL is always the last positional
        assert captured["cmd"][-1] == "https://youtube.com/watch?v=dQw4w9WgXcQ"


# ═══════════════════════════════════════════════════════════════════════════════
# L2753 get_playlist_videos — flat-playlist dump
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetPlaylistVideosProxy:
    @pytest.mark.asyncio
    async def test_proxy_injected_when_set(self, monkeypatch):
        from transcripts import youtube as yt

        fake_run, captured = _make_fake_run(
            stdout=json.dumps({"id": "v1", "title": "T1", "duration": 10})
        )
        monkeypatch.setattr(yt.subprocess, "run", fake_run)
        monkeypatch.setattr(yt, "get_youtube_proxy", lambda: PROXY_URL)
        # Force-skip Invidious so we hit yt-dlp fallback
        monkeypatch.setattr(yt, "INVIDIOUS_INSTANCES", [])

        await yt.get_playlist_videos("PL123")

        assert captured["cmd"] is not None, "yt-dlp fallback never called"
        _assert_proxy_in_cmd(captured["cmd"], PROXY_URL)

    @pytest.mark.asyncio
    async def test_no_proxy_when_unset(self, monkeypatch):
        from transcripts import youtube as yt

        fake_run, captured = _make_fake_run(stdout="")
        monkeypatch.setattr(yt.subprocess, "run", fake_run)
        monkeypatch.setattr(yt, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(yt, "INVIDIOUS_INSTANCES", [])

        await yt.get_playlist_videos("PL123")

        if captured["cmd"]:
            _assert_no_proxy_in_cmd(captured["cmd"])


# ═══════════════════════════════════════════════════════════════════════════════
# L2820 get_playlist_info — playlist single-json
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetPlaylistInfoProxy:
    @pytest.mark.asyncio
    async def test_proxy_injected_when_set(self, monkeypatch):
        from transcripts import youtube as yt

        fake_run, captured = _make_fake_run(
            stdout=json.dumps({"title": "Playlist", "entries": []})
        )
        monkeypatch.setattr(yt.subprocess, "run", fake_run)
        monkeypatch.setattr(yt, "get_youtube_proxy", lambda: PROXY_URL)
        monkeypatch.setattr(yt, "INVIDIOUS_INSTANCES", [])

        await yt.get_playlist_info("PL123")

        assert captured["cmd"] is not None, "yt-dlp fallback never called"
        _assert_proxy_in_cmd(captured["cmd"], PROXY_URL)

    @pytest.mark.asyncio
    async def test_no_proxy_when_unset(self, monkeypatch):
        from transcripts import youtube as yt

        fake_run, captured = _make_fake_run(stdout=json.dumps({}))
        monkeypatch.setattr(yt.subprocess, "run", fake_run)
        monkeypatch.setattr(yt, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(yt, "INVIDIOUS_INSTANCES", [])

        await yt.get_playlist_info("PL123")

        if captured["cmd"]:
            _assert_no_proxy_in_cmd(captured["cmd"])


# ═══════════════════════════════════════════════════════════════════════════════
# L1419 / L1756 — WHISPER + DEEPGRAM yt-dlp audio fallback
# Source-level check (regression lock without exercising the full STT chain)
# ═══════════════════════════════════════════════════════════════════════════════


class TestSttYtdlpProxyWiringSourceLevel:
    """
    Locking source-level proof that --proxy is injected for STT yt-dlp paths.

    These functions (transcribe_audio_whisper, transcribe_audio_deepgram) live
    inside long branching pipelines (Invidious → ytdlp → STT API) that are
    hard to drive in unit tests without a full DB+Redis+API fixture. So we
    assert the wiring at the source level — same approach as
    `test_proxy_coverage.py::test_transcripts_youtube_imports_get_proxied_client`.
    """

    def test_whisper_ytdlp_path_injects_proxy(self):
        import inspect

        from transcripts import youtube as yt

        src = inspect.getsource(yt)
        # The WHISPER block (line ~1419-1445) must contain the proxy injection
        # right after the cmd= [...] block.
        whisper_anchor = '[WHISPER] yt-dlp failed'
        assert whisper_anchor in src, "WHISPER yt-dlp block has changed"
        # Slice 1500 chars before the WHISPER anchor to find the cmd block + proxy
        idx = src.index(whisper_anchor)
        whisper_block = src[max(0, idx - 1500) : idx]
        assert "[WHISPER] Using proxy" in whisper_block, (
            "WHISPER yt-dlp cmd is missing the proxy injection block "
            "(cmd.insert + get_youtube_proxy)"
        )
        assert "cmd.insert(1, \"--proxy\")" in whisper_block

    def test_deepgram_ytdlp_path_injects_proxy(self):
        import inspect

        from transcripts import youtube as yt

        src = inspect.getsource(yt)
        deepgram_anchor = '[DEEPGRAM] Audio from yt-dlp'
        assert deepgram_anchor in src, "DEEPGRAM yt-dlp block has changed"
        idx = src.index(deepgram_anchor)
        deepgram_block = src[max(0, idx - 1500) : idx]
        assert "[DEEPGRAM] Using proxy" in deepgram_block, (
            "DEEPGRAM yt-dlp cmd is missing the proxy injection block"
        )
        assert "cmd.insert(1, \"--proxy\")" in deepgram_block


# ═══════════════════════════════════════════════════════════════════════════════
# Coverage smoke : count proxy injections to prevent regressions
# ═══════════════════════════════════════════════════════════════════════════════


class TestProxyInjectionCoverage:
    """Lock the total count of --proxy injections in transcripts/youtube.py.

    Originally only 3 yt-dlp cmds had --proxy (transcript download paths).
    Sprint 2026-05-12 added 5 more for metadata/STT/playlist paths.
    Expected count post-fix : 8 inline injections.
    """

    def test_proxy_injection_count(self):
        import inspect

        from transcripts import youtube as yt

        src = inspect.getsource(yt)
        count = src.count('cmd.insert(1, "--proxy")')
        # 3 pre-existing (ytdlp manual subs / auto subs / one more transcript path)
        # + 5 new spots from sprint 2026-05-12
        assert count >= 8, (
            f"Expected ≥8 inline --proxy injections in transcripts/youtube.py, "
            f"got {count}. A yt-dlp subprocess call may have lost proxy wiring."
        )
