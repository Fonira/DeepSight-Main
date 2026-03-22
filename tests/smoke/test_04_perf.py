"""
DeepSight Smoke Tests — 04 Performance
Vérifie les temps de chargement et la taille des bundles JS.
"""

import time

import pytest

from conftest import BASE_URL


def test_homepage_under_5s(page):
    """La page d'accueil charge en moins de 5 secondes."""
    start = time.perf_counter()
    resp = page.goto(BASE_URL, wait_until="domcontentloaded")
    elapsed = time.perf_counter() - start

    assert resp is not None
    assert resp.status < 500
    assert elapsed < 5.0, f"Page d'accueil trop lente : {elapsed:.2f}s (max 5s)"


def test_api_health_under_500ms(api_client):
    """L'endpoint /api/v1/health répond en moins de 500ms."""
    start = time.perf_counter()
    resp = api_client.get("/api/v1/health")
    elapsed = time.perf_counter() - start

    assert resp.status_code == 200
    assert elapsed < 0.5, f"Health trop lent : {elapsed * 1000:.0f}ms (max 500ms)"


def test_login_page_under_3s(page):
    """La page /login charge en moins de 3 secondes."""
    start = time.perf_counter()
    resp = page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    elapsed = time.perf_counter() - start

    assert resp is not None
    assert resp.status < 500
    assert elapsed < 3.0, f"Page login trop lente : {elapsed:.2f}s (max 3s)"


def test_no_large_bundle(page):
    """Le JS total de la page d'accueil pèse moins de 2 MB."""
    total_js_bytes = 0
    js_resources: list[dict] = []

    def on_response(response):
        nonlocal total_js_bytes
        url = response.url
        content_type = response.headers.get("content-type", "")

        is_js = (
            url.endswith(".js")
            or "javascript" in content_type
            or url.endswith(".mjs")
        )
        if not is_js:
            return

        try:
            body = response.body()
            size = len(body)
            total_js_bytes += size
            js_resources.append({"url": url.split("/")[-1][:50], "size_kb": size / 1024})
        except Exception:
            # Certaines réponses peuvent ne pas avoir de body (304, etc.)
            pass

    page.on("response", on_response)
    page.goto(BASE_URL, wait_until="networkidle")

    max_bytes = 2 * 1024 * 1024  # 2 MB
    total_kb = total_js_bytes / 1024
    total_mb = total_kb / 1024

    # Top 5 plus gros fichiers pour le debug
    top5 = sorted(js_resources, key=lambda x: x["size_kb"], reverse=True)[:5]

    assert total_js_bytes < max_bytes, (
        f"Bundle JS trop lourd : {total_mb:.2f} MB (max 2 MB). "
        f"Top fichiers : {top5}"
    )
