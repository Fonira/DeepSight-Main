"""URL validator for voice sessions — accepts YouTube + TikTok only."""
import re

YOUTUBE_RE = re.compile(
    r"^https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)"
    r"([a-zA-Z0-9_-]{11})"
)

# TikTok short link via vm. subdomain — single path segment is the short id
TIKTOK_VM_RE = re.compile(r"^https?://vm\.tiktok\.com/([A-Za-z0-9]+)/?")

# TikTok web/mobile : @user/video/<long_id>, t/<short>, v/<id>
TIKTOK_RE = re.compile(
    r"^https?://(?:www\.|m\.)?tiktok\.com/"
    r"(?:@[\w.-]+/video/(\d+)|t/([A-Za-z0-9]+)|v/(\d+))"
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
    if m := TIKTOK_VM_RE.match(url):
        return ("tiktok", m.group(1))
    if m := TIKTOK_RE.match(url):
        # Group 1=@user/video/, 2=t/, 3=v/
        video_id = next((g for g in m.groups() if g is not None), None)
        if video_id:
            return ("tiktok", video_id)
    raise ValueError(f"URL non supportée: {url[:80]}")
