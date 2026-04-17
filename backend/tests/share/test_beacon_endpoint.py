import pytest
from fastapi.testclient import TestClient


def test_beacon_returns_204_on_active_token(
    client: TestClient, active_share_token: str
):
    resp = client.post(f"/api/share/{active_share_token}/beacon", json={})
    assert resp.status_code == 204


def test_beacon_returns_204_even_on_unknown_token(client: TestClient):
    """Beacons are fire-and-forget; never leak 404/401 to prevent info disclosure."""
    resp = client.post("/api/share/nonexistent1/beacon", json={})
    assert resp.status_code == 204


def test_beacon_accepts_empty_body(client: TestClient, active_share_token: str):
    resp = client.post(f"/api/share/{active_share_token}/beacon")
    assert resp.status_code == 204


def test_beacon_accepts_arbitrary_json_body(client: TestClient, active_share_token: str):
    resp = client.post(
        f"/api/share/{active_share_token}/beacon",
        json={"t": active_share_token, "r": "https://twitter.com"},
    )
    assert resp.status_code == 204
