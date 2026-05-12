"""Tests for TikTok proxy migration in `videos/router.py`.

Sprint 2026-05-12 (Wave 2, audit B6) — migrates the 2 TikTok-targeting
`shared_http_client` calls (Quick Chat path) to `get_proxied_client`.
The remaining `shared_http_client` calls are user webhooks (audit OK direct).

Audit said L368 + L411 but the file is 5918 LOC and numbers may shift —
we validate by call site context (TikTok URL / oEmbed presence), not line
numbers.

Pre-fix problem:
  Quick Chat (`POST /api/videos/quick-chat`) flows hit `vm.tiktok.com` HEAD
  to resolve short URLs (L368) then `www.tiktok.com/oembed` to fetch
  thumbnail/title (L411). Both ran via the bare `shared_http_client` pool
  → IP-banned by TikTok on Hetzner datacenter IPs.

Post-fix:
  Both call sites use `get_proxied_client(timeout=...)`. The other 2
  `shared_http_client` usages (lines ~1781, ~2733) remain unchanged —
  those POST a user-supplied webhook URL, NOT TikTok.

Tests :
1. source-level lock : ≥ 2 `get_proxied_client(` call sites with TikTok ctx
2. source-level lock : the remaining `shared_http_client(` calls are NOT
   in a `tiktok.com` / `vm.tiktok.com` / oembed context
3. source-level lock : `get_proxied_client` is imported alongside `shared_http_client`
"""

import inspect
import os
import re
import sys


sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


_ROUTER_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "src",
    "videos",
    "router.py",
)


def _read_router_source() -> str:
    """Read videos/router.py directly. We don't go through `inspect` because
    `from videos import router` resolves to `videos.router.router` (the
    APIRouter object) due to the package's __init__.py re-exporting it."""
    with open(_ROUTER_PATH, encoding="utf-8") as f:
        return f.read()


class TestSourceLevelLock:
    def test_get_proxied_client_imported(self):
        src = _read_router_source()
        assert "get_proxied_client" in src, (
            "videos/router.py must import get_proxied_client for the TikTok "
            "Quick Chat resolver (audit B6)."
        )
        # Must be in the http_client import line (next to shared_http_client)
        assert "from core.http_client import" in src

    def test_at_least_2_proxied_call_sites(self):
        """2 TikTok Quick Chat routes must use get_proxied_client :
        short URL HEAD + oEmbed GET."""
        src = _read_router_source()
        count = src.count("get_proxied_client(")
        assert count >= 2, (
            f"Expected ≥ 2 get_proxied_client() call sites in videos/router.py, "
            f"got {count}. Required: TikTok short URL HEAD + TikTok oEmbed GET."
        )

    def test_proxied_clients_target_tiktok(self):
        """Each `get_proxied_client(...)` block in router.py should appear
        in a 25-line window that mentions tiktok (URL, oembed, vm.tiktok, etc.)."""
        src = _read_router_source()
        lines = src.splitlines()

        proxied_indices = [
            i for i, line in enumerate(lines)
            if re.search(r"\bget_proxied_client\s*\(", line)
        ]
        assert proxied_indices, "No get_proxied_client(...) call sites found"

        for idx in proxied_indices:
            window = "\n".join(
                lines[max(0, idx - 15):min(len(lines), idx + 5)]
            ).lower()
            assert "tiktok" in window or "oembed" in window, (
                f"get_proxied_client(...) at line {idx + 1} does not appear in "
                "a TikTok context — only TikTok routes should be proxied in "
                f"router.py. Context window:\n{window}"
            )

    def test_remaining_shared_client_not_targeting_tiktok(self):
        """`shared_http_client(...)` is still used (user webhooks, etc.).
        Each remaining occurrence MUST NOT be in a `tiktok.com` context."""
        src = _read_router_source()
        lines = src.splitlines()

        shared_indices = [
            i for i, line in enumerate(lines)
            if re.search(r"\bshared_http_client\s*\(", line)
        ]

        for idx in shared_indices:
            window = "\n".join(
                lines[max(0, idx - 10):min(len(lines), idx + 10)]
            ).lower()
            assert (
                "tiktok.com" not in window
                and "tikwm.com" not in window
                and "oembed" not in window
            ), (
                f"shared_http_client(...) at line {idx + 1} appears in a "
                "TikTok / tikwm / oembed context — must use get_proxied_client "
                f"instead (audit B6). Context:\n{window}"
            )

    def test_short_url_head_uses_proxy(self):
        """The short URL HEAD logic for vm.tiktok.com MUST go through proxy."""
        src = _read_router_source()
        # Find the resolved_url logic block
        idx = src.find('"vm.tiktok.com" in url')
        assert idx > -1, (
            "Could not find Quick Chat short-URL resolver block — was the "
            "code refactored? Update this test."
        )
        # Check that the next 500 chars contain get_proxied_client
        block = src[idx:idx + 1000]
        assert "get_proxied_client" in block, (
            "Quick Chat short URL resolution does not use get_proxied_client — "
            "vm.tiktok.com / vt.tiktok.com HEAD must go via Decodo."
        )

    def test_oembed_uses_proxy(self):
        """The TikTok oEmbed thumbnail fallback MUST go through proxy."""
        src = _read_router_source()
        idx = src.find('"https://www.tiktok.com/oembed"')
        assert idx > -1, (
            "Could not find TikTok oEmbed URL string — was the code "
            "refactored? Update this test."
        )
        # Check ~500 chars BEFORE the URL for the proxied client context
        block = src[max(0, idx - 500):idx + 200]
        assert "get_proxied_client" in block, (
            "TikTok oEmbed fallback does not use get_proxied_client — TikTok "
            "rate-limits 429 on Hetzner datacenter IP."
        )
