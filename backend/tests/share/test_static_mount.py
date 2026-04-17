import pytest
from fastapi.testclient import TestClient


def test_share_static_css_is_served(client: TestClient):
    """The share CSS file must be reachable under /static-share/share.css."""
    resp = client.get("/static-share/share.css")
    assert resp.status_code == 200
    assert "text/css" in resp.headers.get("content-type", "")
    assert ".ds-header" in resp.text  # sanity check on content
