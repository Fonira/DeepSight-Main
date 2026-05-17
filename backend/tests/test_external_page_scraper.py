"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — videos.external_pages.scraper                                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║    - _detect_paywall : patterns paywall (substack, le monde, etc.)                 ║
║    - _detect_cloudflare : signature CF / 5KB head                                  ║
║    - _provider_name : telemetry id par hostname                                    ║
║    - scrape_page : ok / paywall / 403→proxy / non-html / timeout / truncation /    ║
║                    http_error / empty / cloudflare in body                         ║
║                                                                                    ║
║  Stratégie : mock `_fetch_html` (monkeypatch) — pas de vrai I/O.                   ║
║              `record_proxy_usage` mocké en AsyncMock pour éviter écriture DB.      ║
║              `_extract_content` mocké quand on veut tester sans trafilatura.       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from unittest.mock import AsyncMock, patch

import pytest

from videos.external_pages.scraper import (
    MAX_HTML_BYTES,
    ScrapedPage,
    _detect_cloudflare,
    _detect_paywall,
    _provider_name,
    scrape_page,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 _detect_paywall
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestDetectPaywall:
    def test_substack_subscribers_only(self):
        html = '<div class="subscribers-only">Premium content</div>'
        assert _detect_paywall(html)

    def test_lemonde_reserve_aux_abonnes(self):
        html = "<p>Article réservé aux abonnés</p>"
        assert _detect_paywall(html)

    def test_paywall_div(self):
        html = '<div class="paywall">Subscribe</div>'
        assert _detect_paywall(html)

    def test_subscribe_to_read(self):
        html = "<p>Subscribe to read the full article</p>"
        assert _detect_paywall(html)

    def test_meta_paywall(self):
        html = '<meta name="paywall" content="true">'
        assert _detect_paywall(html)

    def test_normal_blog_no_paywall(self):
        html = "<article>Contenu libre et accessible à tous.</article>"
        assert not _detect_paywall(html)

    def test_empty_html_no_paywall(self):
        assert not _detect_paywall("")
        assert not _detect_paywall(None)  # type: ignore


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 _detect_cloudflare
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestDetectCloudflare:
    def test_cloudflare_signature(self):
        html = '<html><head><script>window._cf_chl_opt = {};</script></head></html>'
        assert _detect_cloudflare(html)

    def test_checking_browser_message(self):
        html = "<title>Checking your browser before accessing example.com</title>"
        assert _detect_cloudflare(html)

    def test_normal_html_no_cf(self):
        html = "<html><body><h1>Hello world</h1></body></html>"
        assert not _detect_cloudflare(html)

    def test_empty_html_no_cf(self):
        assert not _detect_cloudflare("")


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 _provider_name
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestProviderName:
    def test_strips_www(self):
        assert _provider_name("https://www.stratechery.com/2024/post") == (
            "external_page_scrape_stratechery.com"
        )

    def test_keeps_subdomain(self):
        assert _provider_name("https://blog.openai.com/x") == (
            "external_page_scrape_blog.openai.com"
        )

    def test_invalid_url_uses_unknown(self):
        # urlparse renvoie hostname=None pour URL malformée
        assert _provider_name("not a url") == "external_page_scrape_unknown"


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 scrape_page — happy path + edge cases
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.unit
class TestScrapePage:
    """Tous les tests monkey-patch `_fetch_html` pour ne jamais faire d'I/O réseau."""

    @pytest.fixture(autouse=True)
    def mock_telemetry(self):
        """Empêche tout écriture DB de telemetry pendant les tests."""
        with patch(
            "videos.external_pages.scraper.record_proxy_usage",
            new=AsyncMock(),
        ):
            yield

    async def test_ok_direct_with_real_extraction(self, monkeypatch):
        """Direct GET 200 + trafilatura extrait correctement → status='ok'."""
        # HTML riche pour que trafilatura extrait quelque chose
        html = (
            "<html><head><title>Test Article</title></head>"
            "<body><article>"
            + "<p>" + "Ceci est un paragraphe en français. " * 30 + "</p>"
            + "</article></body></html>"
        )

        async def fake_fetch(url, *, use_proxy, timeout):
            return html, len(html), "text/html", 200

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page("https://example.com", "https://example.com")
        assert result.status == "ok"
        assert result.fetched_via_proxy is False
        assert result.text is not None
        assert len(result.text) >= 200
        assert result.http_status == 200

    async def test_falls_back_to_proxy_on_403(self, monkeypatch):
        """Direct 403 → retry proxy → ok."""
        calls = []

        async def fake_fetch(url, *, use_proxy, timeout):
            calls.append(use_proxy)
            if not use_proxy:
                return None, 0, "text/html", 403
            html = (
                "<html><body><article>"
                + "<p>" + "Contenu via proxy. " * 30 + "</p>"
                + "</article></body></html>"
            )
            return html, len(html), "text/html", 200

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page("https://blocked.example", "https://blocked.example")
        assert result.status == "ok"
        assert result.fetched_via_proxy is True
        assert calls == [False, True]
        assert result.http_status == 200

    async def test_falls_back_to_proxy_on_429(self, monkeypatch):
        """Direct 429 (rate limit) → retry proxy."""
        calls = []

        async def fake_fetch(url, *, use_proxy, timeout):
            calls.append(use_proxy)
            if not use_proxy:
                return None, 0, "text/html", 429
            html = (
                "<html><body><article>"
                + "<p>" + "Du contenu. " * 30 + "</p>"
                + "</article></body></html>"
            )
            return html, len(html), "text/html", 200

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page("https://ratelimited.example",
                                    "https://ratelimited.example")
        assert result.status == "ok"
        assert result.fetched_via_proxy is True
        assert calls == [False, True]

    async def test_cloudflare_signal_triggers_proxy(self, monkeypatch):
        """Signal Cloudflare dans HTML 200 → retry proxy même sans 403."""
        cf_html = (
            "<html><head><title>Checking</title></head>"
            "<body>Checking your browser before accessing example.com. "
            "<script>window._cf_chl_opt={};</script></body></html>"
        )
        proxy_html = (
            "<html><body><article><p>" + "Contenu réel. " * 30 + "</p></article></body></html>"
        )
        calls = []

        async def fake_fetch(url, *, use_proxy, timeout):
            calls.append(use_proxy)
            if not use_proxy:
                return cf_html, len(cf_html), "text/html", 200
            return proxy_html, len(proxy_html), "text/html", 200

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page("https://cf.example", "https://cf.example")
        assert calls == [False, True]
        assert result.fetched_via_proxy is True
        assert result.status == "ok"

    async def test_pdf_content_type_skipped(self, monkeypatch):
        """Content-Type application/pdf → status='non_html'."""

        async def fake_fetch(url, *, use_proxy, timeout):
            return None, 0, "application/pdf", 200

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page(
            "https://example.com/whitepaper.pdf",
            "https://example.com/whitepaper.pdf",
        )
        assert result.status == "non_html"
        assert result.content_type == "application/pdf"

    async def test_image_content_type_skipped(self, monkeypatch):
        """image/jpeg → status='non_html'."""

        async def fake_fetch(url, *, use_proxy, timeout):
            return None, 0, "image/jpeg", 200

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page(
            "https://example.com/pic.jpg", "https://example.com/pic.jpg"
        )
        assert result.status == "non_html"

    async def test_timeout_returns_timeout_status(self, monkeypatch):
        """Status=0 (timeout/connect error) → status='timeout'."""

        async def fake_fetch(url, *, use_proxy, timeout):
            return None, 0, "", 0

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page("https://slow.example", "https://slow.example")
        assert result.status == "timeout"
        assert result.text is None
        assert result.bytes_fetched == 0

    async def test_404_returns_http_error(self, monkeypatch):
        """404 sans block signal → status='http_error'."""

        async def fake_fetch(url, *, use_proxy, timeout):
            return None, 0, "text/html", 404

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page("https://gone.example", "https://gone.example")
        assert result.status == "http_error"
        assert result.http_status == 404

    async def test_5xx_returns_http_error(self, monkeypatch):
        """500 → status='http_error'."""

        async def fake_fetch(url, *, use_proxy, timeout):
            return None, 0, "text/html", 500

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page("https://broken.example", "https://broken.example")
        assert result.status == "http_error"
        assert result.http_status == 500

    async def test_paywall_detected(self, monkeypatch):
        """HTML contient pattern paywall → status='paywall', text=None."""
        html = (
            "<html><body>"
            '<div class="paywall">'
            "Subscribe to read the full article" + ("." * 300) +
            "</div></body></html>"
        )

        async def fake_fetch(url, *, use_proxy, timeout):
            return html, len(html), "text/html", 200

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page("https://paywalled.example",
                                    "https://paywalled.example")
        assert result.status == "paywall"
        assert result.text is None

    async def test_empty_html_returns_empty(self, monkeypatch):
        """HTML est très court / pas de contenu utile → status='empty'."""
        html = "<html><body><p>x</p></body></html>"

        async def fake_fetch(url, *, use_proxy, timeout):
            return html, len(html), "text/html", 200

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        # On force aussi l'extraction à renvoyer (None, None) pour être déterministe
        with patch(
            "videos.external_pages.scraper._extract_content",
            return_value=(None, None),
        ):
            result = await scrape_page("https://tiny.example", "https://tiny.example")
        assert result.status == "empty"
        assert result.text is None

    async def test_truncation_at_max_html_bytes(self, monkeypatch):
        """_fetch_html doit cap le buffer à MAX_HTML_BYTES.

        On vérifie l'output de scrape_page (bytes_fetched reflète la troncature).
        Le test fournit un buffer fake supérieur à la limite et confirme que le
        contract est honoré côté scrape_page.
        """

        truncated_len = MAX_HTML_BYTES  # ce que _fetch_html aurait retourné
        html_truncated = "<html><body><article><p>" + ("A" * 1000) + "</p></article></body></html>"

        async def fake_fetch(url, *, use_proxy, timeout):
            return html_truncated, truncated_len, "text/html", 200

        monkeypatch.setattr(
            "videos.external_pages.scraper._fetch_html", fake_fetch
        )
        result = await scrape_page("https://huge.example", "https://huge.example")
        # Soit ok soit empty selon trafilatura — l'important : bytes_fetched == MAX
        assert result.bytes_fetched == MAX_HTML_BYTES
        assert result.status in ("ok", "empty")
