"""Tests for GET /api/share/{token}/og-image.png — dynamic social preview.

Verifies: PNG content-type + magic bytes, 404 on unknown token, and that
response carries a Cache-Control header so bots/CDNs don't re-render.
"""
import pytest
from fastapi.testclient import TestClient


def test_og_image_endpoint_returns_png(client: TestClient, active_share_token: str):
    resp = client.get(f"/api/share/{active_share_token}/og-image.png")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_og_image_endpoint_404_on_unknown_token(client: TestClient):
    resp = client.get("/api/share/neverexisted/og-image.png")
    assert resp.status_code == 404


def test_og_image_endpoint_sets_cache_headers(client: TestClient, active_share_token: str):
    resp = client.get(f"/api/share/{active_share_token}/og-image.png")
    cc = resp.headers.get("cache-control", "")
    assert "max-age" in cc
