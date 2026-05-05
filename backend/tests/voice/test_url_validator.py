"""Tests pour url_validator — regex YouTube + TikTok + normalize_url tolerant."""
import pytest
from voice.url_validator import normalize_url, parse_video_url


class TestParseVideoURL:
    @pytest.mark.parametrize(
        "url,expected_platform,expected_id",
        [
            # YouTube standard
            ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            ("https://youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            # YouTube Shorts
            ("https://youtube.com/shorts/abc123XYZ_-", "youtube", "abc123XYZ_-"),
            # YouTube Embed
            ("https://www.youtube.com/embed/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            # youtu.be
            ("https://youtu.be/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            # TikTok web
            ("https://www.tiktok.com/@user/video/7123456789012345678", "tiktok", "7123456789012345678"),
            # TikTok short link vm
            ("https://vm.tiktok.com/ZMabc123/", "tiktok", "ZMabc123"),
            # TikTok mobile m.
            ("https://m.tiktok.com/v/7123456789012345678", "tiktok", "7123456789012345678"),
        ],
    )
    def test_parse_valid_urls(self, url, expected_platform, expected_id):
        platform, video_id = parse_video_url(url)
        assert platform == expected_platform
        assert video_id == expected_id

    @pytest.mark.parametrize(
        "url",
        [
            "https://vimeo.com/123456",
            "https://www.facebook.com/watch?v=12345",
            "https://twitter.com/user/status/12345",
            "https://example.com",
            "not a url",
            "",
            "ftp://youtube.com/watch?v=dQw4w9WgXcQ",  # mauvais scheme
            # TikTok non-video pages
            "https://www.tiktok.com/discover",
            "https://www.tiktok.com/explore",
            "https://www.tiktok.com/@user",  # profile without /video/
            "https://www.tiktok.com/foo/bar",  # random 2-segment
            # YouTube hostname must be lowercase
            "https://YouTube.com/watch?v=dQw4w9WgXcQ",
        ],
    )
    def test_parse_invalid_urls_raises(self, url):
        with pytest.raises(ValueError, match="URL non supportée"):
            parse_video_url(url)


class TestNormalizeURL:
    """Tolerant rewrite of mobile schemes / android intents / native share links."""

    @pytest.mark.parametrize(
        "raw,expected_https",
        [
            # ── YouTube — native mobile schemes (Android & iOS YouTube app share) ──
            (
                "vnd.youtube://watch?v=dQw4w9WgXcQ",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            ),
            (
                "vnd.youtube:dQw4w9WgXcQ",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            ),
            (
                "youtube://watch?v=dQw4w9WgXcQ",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            ),
            # ── YouTube — Android intent ──
            (
                "intent://www.youtube.com/watch?v=dQw4w9WgXcQ#Intent;package=com.google.android.youtube;end",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            ),
            (
                "intent://m.youtube.com/watch?v=dQw4w9WgXcQ#Intent;scheme=https;package=com.google.android.youtube;end",
                "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
            ),
            # ── TikTok — native scheme (TikTok app, ByteDance internal) ──
            (
                "snssdk1233://aweme/detail/7123456789012345678",
                "https://www.tiktok.com/@_/video/7123456789012345678",
            ),
            (
                "tiktok://aweme/detail/7123456789012345678",
                "https://www.tiktok.com/@_/video/7123456789012345678",
            ),
            (
                "tiktok://www.tiktok.com/@user/video/7123456789012345678",
                "https://www.tiktok.com/@_/video/7123456789012345678",
            ),
            # ── TikTok — Android intent ──
            (
                "intent://www.tiktok.com/@user/video/7123456789012345678#Intent;package=com.zhiliaoapp.musically;end",
                "https://www.tiktok.com/@user/video/7123456789012345678",
            ),
            (
                "intent://vm.tiktok.com/ZMabc123/#Intent;package=com.zhiliaoapp.musically;end",
                "https://vm.tiktok.com/ZMabc123/",
            ),
            # ── HTTPS canonical — passthrough ──
            (
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            ),
            (
                "https://www.tiktok.com/@user/video/7123456789012345678",
                "https://www.tiktok.com/@user/video/7123456789012345678",
            ),
        ],
    )
    def test_normalize_rewrites_mobile_schemes(self, raw, expected_https):
        assert normalize_url(raw) == expected_https

    def test_normalize_empty_string(self):
        assert normalize_url("") == ""

    def test_normalize_strips_whitespace(self):
        assert normalize_url("  https://youtu.be/abc  ") == "https://youtu.be/abc"

    def test_normalize_unknown_passthrough(self):
        # Non-recognized scheme should pass through (will fail validation downstream)
        raw = "https://example.com/foo"
        assert normalize_url(raw) == raw


class TestParseAfterNormalize:
    """End-to-end : raw mobile/intent inputs reach parse_video_url unscathed."""

    @pytest.mark.parametrize(
        "raw,expected_platform,expected_id",
        [
            # YouTube mobile/intent
            ("vnd.youtube://watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            ("youtube://watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            (
                "intent://www.youtube.com/watch?v=dQw4w9WgXcQ#Intent;package=com.google.android.youtube;end",
                "youtube",
                "dQw4w9WgXcQ",
            ),
            # TikTok mobile/intent
            (
                "snssdk1233://aweme/detail/7123456789012345678",
                "tiktok",
                "7123456789012345678",
            ),
            (
                "tiktok://aweme/detail/7123456789012345678",
                "tiktok",
                "7123456789012345678",
            ),
            (
                "intent://www.tiktok.com/@user/video/7123456789012345678#Intent;package=com.zhiliaoapp.musically;end",
                "tiktok",
                "7123456789012345678",
            ),
            (
                "intent://vm.tiktok.com/ZMabc123/#Intent;package=com.zhiliaoapp.musically;end",
                "tiktok",
                "ZMabc123",
            ),
        ],
    )
    def test_parse_after_normalize(self, raw, expected_platform, expected_id):
        platform, video_id = parse_video_url(raw)
        assert platform == expected_platform
        assert video_id == expected_id
