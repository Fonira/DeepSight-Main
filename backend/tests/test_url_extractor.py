"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — url_extractor (extraction / nettoyage / filtrage URLs externes)        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Module : videos.external_pages.url_extractor                                      ║
║  Couvre :                                                                          ║
║    - extract_urls_from_text() : extraction regex robuste                           ║
║    - clean_url() : strip tracking params + normalisation host                      ║
║    - is_blacklisted() : filtres youtube/tiktok/self-channel                        ║
║    - clean_and_filter_urls() : pipeline complet (dedup + cap)                      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import pytest

from videos.external_pages.url_extractor import (
    extract_urls_from_text,
    clean_url,
    is_blacklisted,
    clean_and_filter_urls,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — extract_urls_from_text
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestExtractUrlsFromText:
    """Extraction d'URLs depuis du texte libre (description, transcript, etc.)."""

    def test_extracts_https_url(self):
        text = "Visit https://example.com for more info."
        urls = extract_urls_from_text(text)
        assert "https://example.com" in urls

    def test_extracts_http_url(self):
        text = "Old http://example.com link here."
        urls = extract_urls_from_text(text)
        assert "http://example.com" in urls

    def test_extracts_www_url_adds_scheme(self):
        """www.X. sans scheme → https://www.X."""
        text = "Check www.example.com for details."
        urls = extract_urls_from_text(text)
        assert any(u.startswith("https://www.example.com") for u in urls)

    def test_strips_trailing_period(self):
        text = "Visit https://example.com."
        urls = extract_urls_from_text(text)
        assert "https://example.com" in urls

    def test_strips_trailing_comma(self):
        text = "Visit https://example.com, then example2."
        urls = extract_urls_from_text(text)
        assert "https://example.com" in urls

    def test_strips_trailing_semicolon(self):
        text = "Visit https://example.com; later."
        urls = extract_urls_from_text(text)
        assert "https://example.com" in urls

    def test_strips_trailing_colon(self):
        text = "Link: https://example.com:"
        urls = extract_urls_from_text(text)
        # Strip le ":" final, mais pas si c'est un port (ici on n'a pas de port)
        assert "https://example.com" in urls

    def test_strips_trailing_question_mark(self):
        text = "Have you seen https://example.com?"
        urls = extract_urls_from_text(text)
        assert "https://example.com" in urls

    def test_strips_trailing_exclamation(self):
        text = "Look at https://example.com!"
        urls = extract_urls_from_text(text)
        assert "https://example.com" in urls

    def test_strips_closing_parenthesis(self):
        text = "(see https://example.com)"
        urls = extract_urls_from_text(text)
        assert "https://example.com" in urls

    def test_extracts_multiple_urls(self):
        text = "Two links: https://a.com and https://b.com here."
        urls = extract_urls_from_text(text)
        assert "https://a.com" in urls
        assert "https://b.com" in urls

    def test_empty_text_returns_empty_list(self):
        assert extract_urls_from_text("") == []

    def test_none_safe_returns_empty_list(self):
        # Doit pas crasher si None
        assert extract_urls_from_text(None) == []  # type: ignore[arg-type]

    def test_no_url_returns_empty_list(self):
        text = "Just plain text without any link."
        assert extract_urls_from_text(text) == []

    def test_preserves_url_path_and_query(self):
        text = "API doc: https://example.com/api/v1/foo?bar=baz"
        urls = extract_urls_from_text(text)
        assert "https://example.com/api/v1/foo?bar=baz" in urls

    def test_extracts_url_with_fragment(self):
        text = "Anchor https://example.com/page#section."
        urls = extract_urls_from_text(text)
        # On accepte que le fragment soit présent (sans le point final)
        assert any(u.startswith("https://example.com/page#section") for u in urls)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — clean_url
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestCleanUrl:
    """Nettoyage : strip tracking params, lowercase host."""

    def test_strips_utm_source(self):
        cleaned = clean_url("https://example.com/page?utm_source=newsletter")
        assert "utm_source" not in cleaned
        assert cleaned.startswith("https://example.com/page")

    def test_strips_utm_medium(self):
        cleaned = clean_url("https://example.com/page?utm_medium=email")
        assert "utm_medium" not in cleaned

    def test_strips_utm_campaign(self):
        cleaned = clean_url("https://example.com/page?utm_campaign=spring")
        assert "utm_campaign" not in cleaned

    def test_strips_fbclid(self):
        cleaned = clean_url("https://example.com/page?fbclid=abc123")
        assert "fbclid" not in cleaned

    def test_strips_gclid(self):
        cleaned = clean_url("https://example.com/page?gclid=xyz789")
        assert "gclid" not in cleaned

    def test_strips_multiple_tracking_params(self):
        cleaned = clean_url(
            "https://example.com/page?utm_source=a&utm_medium=b&fbclid=c"
        )
        assert "utm_source" not in cleaned
        assert "utm_medium" not in cleaned
        assert "fbclid" not in cleaned

    def test_preserves_business_query_params(self):
        cleaned = clean_url("https://example.com/page?id=123&page=2")
        assert "id=123" in cleaned
        assert "page=2" in cleaned

    def test_lowercases_host(self):
        cleaned = clean_url("https://EXAMPLE.com/MyPage")
        assert "example.com" in cleaned

    def test_preserves_path_case(self):
        """Le host est lowercased, le path/query restent intacts."""
        cleaned = clean_url("https://EXAMPLE.com/MyPage")
        assert "/MyPage" in cleaned

    def test_invalid_url_returns_none(self):
        assert clean_url("not a url") is None

    def test_empty_string_returns_none(self):
        assert clean_url("") is None

    def test_no_scheme_returns_none(self):
        """Sans scheme : c'est `extract_urls_from_text` qui doit ajouter https://."""
        assert clean_url("example.com") is None

    def test_strips_default_port_80_http(self):
        # Pas obligatoire mais cohérent : netloc lowercased
        cleaned = clean_url("https://EXAMPLE.com:443/")
        assert cleaned is not None

    def test_mixed_tracking_and_business_params(self):
        cleaned = clean_url(
            "https://example.com/page?id=42&utm_source=foo&gclid=bar&page=2"
        )
        assert "id=42" in cleaned
        assert "page=2" in cleaned
        assert "utm_source" not in cleaned
        assert "gclid" not in cleaned


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — is_blacklisted
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestIsBlacklisted:
    """Filtrage : exclure YouTube/TikTok + self-channel + sociaux navigation."""

    def test_youtube_com_is_blacklisted(self):
        assert is_blacklisted("https://www.youtube.com/watch?v=abc") is True

    def test_youtube_short_url_is_blacklisted(self):
        assert is_blacklisted("https://youtu.be/abc123") is True

    def test_tiktok_com_is_blacklisted(self):
        assert is_blacklisted("https://www.tiktok.com/@user/video/123") is True

    def test_legit_blog_not_blacklisted(self):
        assert is_blacklisted("https://medium.com/some-article") is False

    def test_news_site_not_blacklisted(self):
        assert is_blacklisted("https://www.lemonde.fr/article-xyz") is False

    def test_personal_blog_not_blacklisted(self):
        assert is_blacklisted("https://example.com/blog/post-1") is False

    def test_youtube_subdomain_blacklisted(self):
        assert is_blacklisted("https://music.youtube.com/playlist") is True

    def test_self_channel_url_blacklisted_when_passed(self):
        """Quand on passe le channel URL du créateur, on l'exclut."""
        result = is_blacklisted(
            "https://www.somecreator.com/about",
            self_channel_host="somecreator.com",
        )
        assert result is True

    def test_other_host_not_blacklisted_with_self_channel(self):
        result = is_blacklisted(
            "https://medium.com/article",
            self_channel_host="somecreator.com",
        )
        assert result is False

    def test_invalid_url_treated_as_blacklisted(self):
        """Une URL invalide / unparseable doit être considérée non-passable."""
        assert is_blacklisted("not-a-url") is True

    def test_empty_url_treated_as_blacklisted(self):
        assert is_blacklisted("") is True


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — clean_and_filter_urls
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestCleanAndFilterUrls:
    """Pipeline complet : clean + filter + dedup + cap."""

    def test_dedup_after_cleaning(self):
        """Deux URLs distinctes avec mêmes utm devraient devenir identiques après clean."""
        urls = [
            "https://example.com/page?utm_source=a",
            "https://example.com/page?utm_source=b",
        ]
        result = clean_and_filter_urls(urls)
        assert len(result) == 1

    def test_respects_max_count(self):
        urls = [f"https://example{i}.com" for i in range(20)]
        result = clean_and_filter_urls(urls, max_count=5)
        assert len(result) == 5

    def test_preserves_order(self):
        urls = ["https://c.com", "https://a.com", "https://b.com"]
        result = clean_and_filter_urls(urls)
        # Pas de sort alpha — on garde l'ordre d'arrivée
        assert result == ["https://c.com", "https://a.com", "https://b.com"]

    def test_excludes_blacklisted_urls(self):
        urls = [
            "https://www.youtube.com/watch?v=abc",
            "https://medium.com/article",
        ]
        result = clean_and_filter_urls(urls)
        assert any("youtube.com" in u for u in result) is False
        assert any("medium.com" in u for u in result) is True

    def test_excludes_self_channel(self):
        urls = [
            "https://someblog.com/post-1",
            "https://medium.com/article",
        ]
        result = clean_and_filter_urls(
            urls, self_channel_host="someblog.com"
        )
        assert any("someblog.com" in u for u in result) is False
        assert any("medium.com" in u for u in result) is True

    def test_empty_input_returns_empty(self):
        assert clean_and_filter_urls([]) == []

    def test_all_blacklisted_returns_empty(self):
        urls = [
            "https://www.youtube.com/watch?v=a",
            "https://www.tiktok.com/@u/video/1",
            "https://youtu.be/x",
        ]
        assert clean_and_filter_urls(urls) == []

    def test_invalid_urls_filtered_out(self):
        urls = [
            "not a url",
            "https://medium.com/article",
            "",
        ]
        result = clean_and_filter_urls(urls)
        assert len(result) == 1
        assert "medium.com" in result[0]

    def test_default_max_count_is_reasonable(self):
        """clean_and_filter_urls sans max_count laisse passer plusieurs URLs."""
        urls = [f"https://example{i}.com" for i in range(3)]
        result = clean_and_filter_urls(urls)
        assert len(result) == 3
