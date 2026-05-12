"""
Tests for --proxy injection in `videos/intelligent_discovery.YouTubeSearcher.search`.

Sprint Wave 2 (Audit B1) — follow-up to docs/audits/2026-05-11-proxy-coverage.md.

Prior to this fix, the `ytsearchN:` yt-dlp command lacked `--proxy`, causing
Smart Search (used by Recherche intelligente / Tournesol-fed discovery) to
return 0 results from the Hetzner VPS because YouTube bot-challenges
datacenter IPs on `ytsearch`. This locks the wiring so future refactors
don't silently drop the proxy on this path.

Tests :
1. proxy injected when YOUTUBE_PROXY is set (via `_yt_dlp_extra_args()`)
2. no proxy injected when YOUTUBE_PROXY is empty
3. `should_bypass_proxy()` hard-stop respected (PROXY_DISABLED=true or MTD>950MB)
4. cmd structure preserved (other flags + target query still present)
5. source-level lock : assert helper import not accidentally removed
"""

import asyncio
import json
import os
import sys
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


PROXY_URL = "http://sp9fsc9l2p:Hj046a=vHnDabt8fUj@gate.decodo.com:7000"


def _make_fake_run(stdout: str = "", returncode: int = 0):
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


class TestYouTubeSearcherProxy:
    @pytest.mark.asyncio
    async def test_proxy_injected_when_set(self, monkeypatch):
        """`_yt_dlp_extra_args()` injects --proxy when YOUTUBE_PROXY is set."""
        from videos import intelligent_discovery as idsc
        from transcripts import audio_utils

        fake_run, captured = _make_fake_run(
            stdout=json.dumps({"id": "abc123", "title": "Test"}),
        )
        monkeypatch.setattr(idsc.subprocess, "run", fake_run)
        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: PROXY_URL)
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        await idsc.YouTubeSearcher.search("python tutorial", max_results=5)

        cmd = captured["cmd"]
        assert cmd is not None, "subprocess.run was not called"
        assert "--proxy" in cmd, f"--proxy missing from cmd. Got: {cmd}"
        idx = cmd.index("--proxy")
        assert cmd[idx + 1] == PROXY_URL

    @pytest.mark.asyncio
    async def test_no_proxy_when_unset(self, monkeypatch):
        """When YOUTUBE_PROXY is empty, cmd has no --proxy (no regression)."""
        from videos import intelligent_discovery as idsc
        from transcripts import audio_utils

        fake_run, captured = _make_fake_run(stdout="")
        monkeypatch.setattr(idsc.subprocess, "run", fake_run)
        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        await idsc.YouTubeSearcher.search("test query", max_results=3)

        cmd = captured["cmd"]
        assert cmd is not None
        assert "--proxy" not in cmd

    @pytest.mark.asyncio
    async def test_should_bypass_proxy_skips_injection(self, monkeypatch):
        """When `should_bypass_proxy()` is True (hard-stop > 950MB MTD or
        PROXY_DISABLED=true), no --proxy is injected even with YOUTUBE_PROXY set.
        Locks the budget guard behaviour preserved through this fix."""
        from videos import intelligent_discovery as idsc
        from transcripts import audio_utils
        from middleware import proxy_telemetry

        fake_run, captured = _make_fake_run(stdout="")
        monkeypatch.setattr(idsc.subprocess, "run", fake_run)
        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: PROXY_URL)
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")
        monkeypatch.setattr(proxy_telemetry, "should_bypass_proxy", lambda: True)

        await idsc.YouTubeSearcher.search("test", max_results=2)

        cmd = captured["cmd"]
        assert cmd is not None
        assert "--proxy" not in cmd, (
            f"--proxy should be skipped when should_bypass_proxy()=True. Got cmd={cmd}"
        )

    @pytest.mark.asyncio
    async def test_cmd_structure_preserved(self, monkeypatch):
        """Other flags (--dump-json, --flat-playlist, --no-warnings, --geo-bypass)
        and the ytsearchN: query must still be present even with --proxy injected."""
        from videos import intelligent_discovery as idsc
        from transcripts import audio_utils

        fake_run, captured = _make_fake_run(stdout="")
        monkeypatch.setattr(idsc.subprocess, "run", fake_run)
        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: PROXY_URL)
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        await idsc.YouTubeSearcher.search("foo bar", max_results=10)

        cmd = captured["cmd"]
        assert cmd[0] == "yt-dlp"
        for flag in ("--dump-json", "--flat-playlist", "--no-warnings", "--geo-bypass"):
            assert flag in cmd, f"{flag} missing from cmd: {cmd}"
        # The ytsearch query is always the last positional
        assert cmd[-1].startswith("ytsearch"), f"ytsearch query missing or not last: {cmd[-1]}"
        assert "foo bar" in cmd[-1]


class TestSourceLevelLock:
    """Source-level smoke : ensure the proxy helper import + injection
    don't accidentally regress."""

    def test_imports_yt_dlp_extra_args(self):
        """The fix relies on `_yt_dlp_extra_args` being callable from this module.
        Locking the helper usage at source level so future refactors don't
        accidentally remove it."""
        import inspect
        from videos import intelligent_discovery

        src = inspect.getsource(intelligent_discovery)
        assert "_yt_dlp_extra_args" in src, (
            "_yt_dlp_extra_args() call removed from intelligent_discovery.py — "
            "Smart Search will bot-challenge from Hetzner."
        )

    def test_ytsearch_cmd_includes_extra_args_splat(self):
        """The yt-dlp ytsearch cmd must splat *_yt_dlp_extra_args() in the args
        list, otherwise --proxy + --cookies are silently dropped."""
        import inspect
        from videos import intelligent_discovery

        src = inspect.getsource(intelligent_discovery)
        # The cmd line should look like:
        #   cmd = ["yt-dlp", *_yt_dlp_extra_args(), "--dump-json", ...]
        assert "*_yt_dlp_extra_args()" in src, (
            "*_yt_dlp_extra_args() splat missing from yt-dlp ytsearch cmd — "
            "proxy/cookies wiring lost."
        )
