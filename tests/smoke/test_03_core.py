"""
DeepSight Smoke Tests — 03 Core Features
Vérifie l'auth API, le flow d'analyse complet, et les infos d'abonnement.
"""

import time

import pytest

from conftest import SMOKE_EMAIL, SMOKE_PASSWORD


# ─── Auth API ────────────────────────────────────────────────────────────────


def test_api_requires_auth(api_client):
    """GET /api/videos/history sans token → 401 ou 403."""
    resp = api_client.get("/api/videos/history")
    assert resp.status_code in (401, 403), (
        f"Attendu 401/403 sans auth, obtenu {resp.status_code}"
    )


def test_api_login_returns_token(api_client):
    """POST /api/auth/login avec bon credentials → retourne access_token."""
    if not SMOKE_PASSWORD:
        pytest.skip("SMOKE_TEST_PASSWORD non défini")

    resp = api_client.post(
        "/api/auth/login",
        json={"email": SMOKE_EMAIL, "password": SMOKE_PASSWORD},
    )
    assert resp.status_code == 200, f"Login échoué : {resp.status_code} — {resp.text[:200]}"

    body = resp.json()
    assert "access_token" in body, f"Pas de access_token dans la réponse : {list(body.keys())}"
    assert len(body["access_token"]) > 20, "access_token trop court"
    assert body.get("token_type", "").lower() == "bearer"


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _get_auth_token(api_client) -> str:
    """Login et retourne le token. Raise si impossible."""
    resp = api_client.post(
        "/api/auth/login",
        json={"email": SMOKE_EMAIL, "password": SMOKE_PASSWORD},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Full Analysis Flow ─────────────────────────────────────────────────────


@pytest.mark.slow
@pytest.mark.timeout(180)
def test_full_analysis_flow(api_client):
    """
    Login → POST analyse (Me at the zoo, 19s) → poll status → completed en max 120s.
    """
    if not SMOKE_PASSWORD:
        pytest.skip("SMOKE_TEST_PASSWORD non défini")

    token = _get_auth_token(api_client)
    headers = _auth_headers(token)

    # Lancer l'analyse — "Me at the zoo" (première vidéo YouTube, 19 secondes)
    resp = api_client.post(
        "/api/videos/analyze",
        json={
            "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
            "platform": "web",
        },
        headers=headers,
    )
    assert resp.status_code == 200, f"Analyse POST échoué : {resp.status_code} — {resp.text[:300]}"

    body = resp.json()
    task_id = body.get("task_id")
    assert task_id, f"Pas de task_id dans la réponse : {body}"

    # Poll status toutes les 3 secondes, max 120s
    deadline = time.time() + 120
    final_status = None

    while time.time() < deadline:
        status_resp = api_client.get(
            f"/api/videos/status/{task_id}",
            headers=headers,
        )
        assert status_resp.status_code == 200, (
            f"Status poll échoué : {status_resp.status_code}"
        )

        status_body = status_resp.json()
        current_status = status_body.get("status", "")

        if current_status == "completed":
            final_status = "completed"
            break
        elif current_status in ("failed", "error"):
            pytest.fail(
                f"Analyse échouée avec status '{current_status}' : "
                f"{status_body.get('error', 'no error message')}"
            )

        time.sleep(3)

    assert final_status == "completed", (
        f"Analyse non terminée après 120s — dernier status : {current_status}"
    )


# ─── Subscription ───────────────────────────────────────────────────────────


def test_subscription_info(api_client):
    """GET /api/billing/my-plan avec token → retourne le plan."""
    if not SMOKE_PASSWORD:
        pytest.skip("SMOKE_TEST_PASSWORD non défini")

    token = _get_auth_token(api_client)
    headers = _auth_headers(token)

    resp = api_client.get("/api/billing/my-plan", headers=headers)
    assert resp.status_code == 200, f"my-plan échoué : {resp.status_code} — {resp.text[:200]}"

    body = resp.json()
    # Doit contenir un plan_id ou plan ou name
    has_plan_info = any(
        key in body
        for key in ("plan", "plan_id", "name", "current_plan")
    )
    assert has_plan_info, f"Pas d'info plan dans la réponse : {list(body.keys())}"
