"""URL validator for voice sessions — accepts YouTube + TikTok only."""
import re

YOUTUBE_RE = re.compile(
    r"^https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)"
    r"([a-zA-Z0-9_-]{11})"
)

# TikTok : @user/video/<long_id>, vm.tiktok.com/<short>, m.tiktok.com/v/<id>, t/<short>
TIKTOK_RE = re.compile(
    r"^https?://(?:www\.|vm\.|m\.)?tiktok\.com/"
    r"(?:@[\w.-]+/video/(\d+)|t/([A-Za-z0-9]+)|v/(\d+)|([A-Za-z0-9]+)/?)"
)


def parse_video_url(url: str) -> tuple[str, str]:
    """Parse a YouTube or TikTok URL.

    Args:
        url: Raw URL string from user input or share extension.

    Returns:
        Tuple of (platform, video_id) where platform is "youtube" or "tiktok".

    Raises:
        ValueError: If URL doesn't match either platform.
    """
    if m := YOUTUBE_RE.match(url):
        return ("youtube", m.group(1))
    if m := TIKTOK_RE.match(url):
        # Group 1=video/, 2=t/, 3=v/, 4=plain (vm.tiktok.com/<short>)
        video_id = next((g for g in m.groups() if g is not None), None)
        if video_id:
            return ("tiktok", video_id)
    raise ValueError(f"URL non supportée: {url[:80]}")
