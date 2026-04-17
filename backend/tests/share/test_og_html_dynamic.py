import pytest
from fastapi.testclient import TestClient


def test_bot_user_agent_receives_dynamic_og_image_url(
    client: TestClient, active_share_token: str
):
    """Social bots must see the dynamic /og-image.png URL, not the raw thumbnail."""
    resp = client.get(
        f"/api/share/{active_share_token}",
        headers={"User-Agent": "facebookexternalhit/1.1"},
    )
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    # og:image must point to dynamic endpoint (branded image with verdict chip)
    assert f"/api/share/{active_share_token}/og-image.png" in resp.text
    # twitter:image should also use dynamic endpoint
    assert f'name="twitter:image"' in resp.text or f"name='twitter:image'" in resp.text


def test_bot_twitter_image_uses_dynamic_endpoint(
    client: TestClient, active_share_token: str
):
    resp = client.get(
        f"/api/share/{active_share_token}",
        headers={"User-Agent": "Twitterbot/1.0"},
    )
    assert resp.status_code == 200
    # Both meta tags point to the dynamic endpoint
    text = resp.text
    og_pos = text.find("og:image")
    tw_pos = text.find("twitter:image")
    assert og_pos != -1, "og:image meta missing"
    assert tw_pos != -1, "twitter:image meta missing"
    # Each tag's value should contain the dynamic path
    for position in (og_pos, tw_pos):
        segment = text[position : position + 400]
        assert f"/api/share/{active_share_token}/og-image.png" in segment, (
            f"Dynamic og-image.png URL not found near position {position}"
        )
