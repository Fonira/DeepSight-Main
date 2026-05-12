"""
Tests for --proxy injection in `videos/youtube_storyboard._ytdlp_info_sync`.

Sprint 2026-05-12 follow-up to PR #469. Prior to this fix, `_ytdlp_info_sync`
explicitly passed `include_proxy=False` to `_yt_dlp_extra_args`, causing the
yt-dlp metadata fetch to bot-challenge from Hetzner. When the call returned
None, `extract_storyboard_frames` exited early at L298 — BEFORE any of the
4 duration fallbacks (yt-dlp top-level / sb fragments / Supadata / transcript
timestamps) or the 5th `duration_hint` fallback added by PR #468 could fire.

This was the hidden root cause of Summary 209 `visual_analysis=null` for
zjkBMFhNj_g (Karpathy 1h LLM intro) — PR #469 fixed video_duration metadata,
but storyboards stayed inaccessible here without the proxy.

Tests :
1. proxy injected when YOUTUBE_PROXY is set
2. no proxy injected when YOUTUBE_PROXY is empty
3. source-level smoke : no `include_proxy=False` left in the file
"""

import os
import sys
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


PROXY_URL = "http://sp9fsc9l2p:Hj046a=vHnDabt8fUj@gate.decodo.com:7000"


def _make_fake_run(stdout: str = "{}", returncode: int = 0):
    """Capture subprocess.run cmd and return canned output."""
    captured = {"cmd": None}

    def fake_run(cmd, *args, **kwargs):
        captured["cmd"] = list(cmd)
        result = MagicMock()
        result.returncode = returncode
        result.stdout = stdout
        result.stderr = ""
        return result

    return fake_run, captured


class TestYtdlpInfoSyncProxy:
    def test_proxy_injected_when_set(self, monkeypatch):
        """`include_proxy=True` (default) routes yt-dlp -j via Decodo."""
        from videos import youtube_storyboard as yts
        from transcripts import audio_utils

        fake_run, captured = _make_fake_run()
        monkeypatch.setattr(yts.subprocess, "run", fake_run)
        # _yt_dlp_extra_args reads from audio_utils.get_youtube_proxy()
        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: PROXY_URL)
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        yts._ytdlp_info_sync("zjkBMFhNj_g", "TEST")

        cmd = captured["cmd"]
        assert cmd is not None, "subprocess.run was not called"
        assert "--proxy" in cmd, f"--proxy missing from cmd. Got: {cmd}"
        idx = cmd.index("--proxy")
        assert cmd[idx + 1] == PROXY_URL

    def test_no_proxy_when_unset(self, monkeypatch):
        """When YOUTUBE_PROXY is empty, cmd has no --proxy (no regression)."""
        from videos import youtube_storyboard as yts
        from transcripts import audio_utils

        fake_run, captured = _make_fake_run()
        monkeypatch.setattr(yts.subprocess, "run", fake_run)
        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        yts._ytdlp_info_sync("zjkBMFhNj_g", "TEST")

        cmd = captured["cmd"]
        assert cmd is not None
        assert "--proxy" not in cmd

    def test_should_bypass_proxy_skips_injection(self, monkeypatch):
        """When `should_bypass_proxy()` is True (hard-stop > 950MB MTD or
        PROXY_DISABLED=true), no --proxy is injected even with YOUTUBE_PROXY set.
        Locks the budget guard behaviour preserved through this fix."""
        from videos import youtube_storyboard as yts
        from transcripts import audio_utils
        from middleware import proxy_telemetry

        fake_run, captured = _make_fake_run()
        monkeypatch.setattr(yts.subprocess, "run", fake_run)
        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: PROXY_URL)
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")
        monkeypatch.setattr(proxy_telemetry, "should_bypass_proxy", lambda: True)

        yts._ytdlp_info_sync("zjkBMFhNj_g", "TEST")

        cmd = captured["cmd"]
        assert cmd is not None
        assert "--proxy" not in cmd

    def test_cmd_structure_preserved(self, monkeypatch):
        """Other flags (-j, --skip-download, --ignore-no-formats-error,
        --no-warnings, --no-playlist) must still be present."""
        from videos import youtube_storyboard as yts
        from transcripts import audio_utils

        fake_run, captured = _make_fake_run()
        monkeypatch.setattr(yts.subprocess, "run", fake_run)
        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: PROXY_URL)
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        yts._ytdlp_info_sync("dQw4w9WgXcQ", "TEST")

        cmd = captured["cmd"]
        assert cmd[0] == "yt-dlp"
        for flag in ("-j", "--skip-download", "--ignore-no-formats-error",
                     "--no-warnings", "--no-playlist"):
            assert flag in cmd, f"{flag} missing from cmd"
        assert cmd[-1] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


class TestSourceLevelLock:
    """Source-level smoke : ensure include_proxy=False doesn't sneak back in."""

    def test_no_include_proxy_false_in_youtube_storyboard(self):
        import inspect

        from videos import youtube_storyboard

        src = inspect.getsource(youtube_storyboard)
        assert "include_proxy=False" not in src, (
            "include_proxy=False has reappeared in youtube_storyboard.py — "
            "this caused Summary 209 visual_analysis=null. The yt-dlp -j call "
            "MUST go through Decodo proxy from Hetzner."
        )
