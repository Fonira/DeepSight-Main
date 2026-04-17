import pytest
from fastapi.testclient import TestClient


def test_page_endpoint_returns_html(client: TestClient, active_share_token: str):
    resp = client.get(f"/api/share/{active_share_token}/page")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "<!DOCTYPE html>" in resp.text
    assert "DeepSight" in resp.text


def test_page_endpoint_404_on_unknown_token(client: TestClient):
    resp = client.get("/api/share/nonexistent12/page")
    assert resp.status_code == 404


def test_page_endpoint_sets_cache_headers(client: TestClient, active_share_token: str):
    resp = client.get(f"/api/share/{active_share_token}/page")
    assert "max-age" in resp.headers.get("cache-control", "")


def test_page_endpoint_renders_video_title_from_snapshot(
    client: TestClient, active_share_token: str
):
    resp = client.get(f"/api/share/{active_share_token}/page")
    assert resp.status_code == 200
    # The conftest snapshot sets video_title="Integration Test Video"
    assert "Integration Test Video" in resp.text
