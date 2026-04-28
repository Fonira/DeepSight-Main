"""Tests pour url_validator — regex YouTube + TikTok."""
import pytest
from voice.url_validator import parse_video_url


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
        ],
    )
    def test_parse_invalid_urls_raises(self, url):
        with pytest.raises(ValueError, match="URL non supportée"):
            parse_video_url(url)
