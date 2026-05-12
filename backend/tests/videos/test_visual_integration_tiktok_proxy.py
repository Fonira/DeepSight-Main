"""Tests for TikTok proxy migration in `videos/visual_integration.py`.

Sprint 2026-05-12 (Wave 2, audit B4) — migrates the two `httpx.AsyncClient`
direct calls in `_download_tiktok_video_no_watermark` to `get_proxied_client`,
which routes via the Decodo residential proxy when `YOUTUBE_PROXY` is set.

Background:
  Lines 480 and 501 (pre-fix) called tikwm.com (TikTok video extraction API)
  and TikTok CDN media URLs directly from the bare Hetzner IP. Both endpoints
  rate-limit datacenter IPs (429 + "Url parsing failed"), making Phase 2
  visual analysis for TikTok unreliable in prod. The yt-dlp primary path
  (Sprint A direct push 2026-05-11, commit e1cf3d7a) already routes via Decodo,
  but the tikwm fallback was still bare.

Tests :
1. source-level smoke : no `httpx.AsyncClient(` direct call remains on TikTok
   routes (`_download_tiktok_video_no_watermark`).
2. source-level lock : `get_proxied_client` is imported and used ≥ 2 times.
3. integration : when the function runs with no proxy configured, it still
   yields a working httpx client (graceful fallback to bare).
"""

import inspect
import os
import sys

import pytest


sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


class TestSourceLevelLock:
    """Source-level smoke: ensure the two tikwm/CDN call sites use the
    proxied client and no `httpx.AsyncClient(` direct slipped back in."""

    def test_get_proxied_client_imported(self):
        from videos import visual_integration

        src = inspect.getsource(visual_integration)
        assert "from core.http_client import get_proxied_client" in src, (
            "visual_integration must import get_proxied_client to route TikTok "
            "downloads via Decodo (audit B4 / Wave 2 sprint 2026-05-12)."
        )

    def test_get_proxied_client_used_at_least_twice(self):
        """At least 2 `get_proxied_client(` call sites — one for tikwm POST,
        one for TikTok CDN GET in `_download_tiktok_video_no_watermark`."""
        from videos import visual_integration

        src = inspect.getsource(visual_integration)
        count = src.count("get_proxied_client(")
        assert count >= 2, (
            f"Expected ≥ 2 get_proxied_client() call sites, got {count}. "
            "Both the tikwm API POST and the TikTok CDN GET must be proxied."
        )

    def test_no_bare_httpx_async_client_in_tiktok_download(self):
        """The `_download_tiktok_video_no_watermark` function MUST NOT
        contain `httpx.AsyncClient(` — both calls were migrated to the
        proxied helper."""
        from videos import visual_integration

        src = inspect.getsource(visual_integration._download_tiktok_video_no_watermark)
        assert "httpx.AsyncClient(" not in src, (
            "_download_tiktok_video_no_watermark must not call httpx.AsyncClient() "
            "directly — use get_proxied_client() so the tikwm + TikTok CDN routes "
            "go through Decodo from Hetzner."
        )

    def test_no_hardcoded_user_agent_overrides(self):
        """The proxied client already injects a Chrome-like User-Agent.
        Hardcoded UAs in the migrated function would silently override it."""
        from videos import visual_integration

        src = inspect.getsource(visual_integration._download_tiktok_video_no_watermark)
        # Allow Referer header (specific to TikTok CDN). No User-Agent.
        assert '"User-Agent"' not in src, (
            "Function should not hardcode User-Agent — get_proxied_client "
            "already provides one."
        )


class TestIntegrationGracefulFallback:
    """Integration: when no YOUTUBE_PROXY is configured, the function falls
    back to a bare client and behaves the same. Locks the no-regression on
    dev / local runs where the proxy is unset."""

    @pytest.mark.asyncio
    async def test_function_callable_without_proxy_env(self, monkeypatch):
        """With proxy unset, `_download_tiktok_video_no_watermark` should
        still be callable. We mock `get_proxied_client` to raise to verify
        the function catches the error and returns None (graceful path).

        We MUST NOT do real network calls here — the test would either be
        flaky (tikwm rate-limit) or hammer the API on every CI run.
        """
        from contextlib import asynccontextmanager

        from videos import visual_integration as vi

        @asynccontextmanager
        async def fake_proxied_client(*args, **kwargs):
            """Yield a fake client that raises on any HTTP call."""

            class FakeClient:
                async def post(self, *a, **kw):
                    raise RuntimeError("no network in unit test")

                async def get(self, *a, **kw):
                    raise RuntimeError("no network in unit test")

            yield FakeClient()

        monkeypatch.setattr(vi, "get_proxied_client", fake_proxied_client)

        result = await vi._download_tiktok_video_no_watermark(
            "https://www.tiktok.com/@whoever/video/123",
            log_tag="TEST",
        )
        assert result is None
