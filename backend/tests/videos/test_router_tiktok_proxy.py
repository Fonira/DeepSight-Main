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

    def test_at_least_2_proxy_capable_call_sites(self):
        """2 TikTok Quick Chat routes must use a proxy-capable client.

        Post smart-route migration (2026-05-17), short URL HEAD + oEmbed GET
        use `smart_request` (direct-first with proxy fallback). Both still
        count as proxy-capable for regression protection.
        """
        src = _read_router_source()
        count = src.count("get_proxied_client(") + src.count("smart_request(")
        assert count >= 2, (
            f"Expected ≥ 2 proxy-capable call sites in videos/router.py "
            f"(get_proxied_client + smart_request), got {count}. "
            "Required: TikTok short URL HEAD + TikTok oEmbed GET."
        )

    def test_proxy_capable_clients_target_tiktok(self):
        """Each proxy-capable call (`get_proxied_client` or `smart_request`)
        in router.py should appear in a window that mentions tiktok."""
        src = _read_router_source()
        lines = src.splitlines()

        proxy_indices = [
            i for i, line in enumerate(lines)
            if re.search(r"\b(get_proxied_client|smart_request)\s*\(", line)
        ]
        assert proxy_indices, "No proxy-capable call sites found in router.py"

        for idx in proxy_indices:
            window = "\n".join(
                lines[max(0, idx - 5):min(len(lines), idx + 15)]
            ).lower()
            assert "tiktok" in window or "oembed" in window, (
                f"Proxy-capable call at line {idx + 1} does not appear in "
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

    def test_short_url_head_uses_proxy_capable(self):
        """The short URL HEAD for vm.tiktok.com MUST go through a proxy-capable client."""
        src = _read_router_source()
        idx = src.find('"vm.tiktok.com" in url')
        assert idx > -1, (
            "Could not find Quick Chat short-URL resolver block — was the "
            "code refactored? Update this test."
        )
        block = src[idx:idx + 1000]
        assert ("get_proxied_client" in block) or ("smart_request" in block), (
            "Quick Chat short URL resolution does not use a proxy-capable client "
            "(get_proxied_client or smart_request) — vm.tiktok.com / vt.tiktok.com "
            "HEAD must be able to route via Decodo."
        )

    def test_oembed_uses_proxy_capable(self):
        """The TikTok oEmbed thumbnail fallback MUST go through a proxy-capable client."""
        src = _read_router_source()
        idx = src.find('"https://www.tiktok.com/oembed"')
        assert idx > -1, (
            "Could not find TikTok oEmbed URL string — was the code "
            "refactored? Update this test."
        )
        block = src[max(0, idx - 500):idx + 200]
        assert ("get_proxied_client" in block) or ("smart_request" in block), (
            "TikTok oEmbed fallback does not use a proxy-capable client "
            "(get_proxied_client or smart_request) — TikTok rate-limits 429 on "
            "Hetzner datacenter IP."
        )
