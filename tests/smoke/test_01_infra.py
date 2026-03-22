"""
DeepSight Smoke Tests — 01 Infrastructure
Vérifie que le backend répond, le frontend charge, et les dépendances critiques sont OK.
"""

import pytest

from conftest import BASE_URL, HEALTH_SECRET


# ─── Backend ─────────────────────────────────────────────────────────────────


def test_backend_responds(api_client):
    """GET /api/v1/health → 200 + status healthy."""
    resp = api_client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"


def test_backend_deep_health(api_client):
    """GET /api/v1/health/deep?secret=... → DB et Stripe sont ok."""
    if not HEALTH_SECRET:
        pytest.skip("HEALTH_CHECK_SECRET non défini")

    resp = api_client.get("/api/v1/health/deep", params={"secret": HEALTH_SECRET})
    assert resp.status_code == 200

    body = resp.json()
    services = body.get("services", {})

    # DB et Stripe sont les services critiques
    assert services.get("database", {}).get("status") == "ok", (
        f"Database unhealthy: {services.get('database')}"
    )
    assert services.get("stripe", {}).get("status") == "ok", (
        f"Stripe unhealthy: {services.get('stripe')}"
    )


# ─── Frontend ────────────────────────────────────────────────────────────────


def test_frontend_loads(page):
    """La page d'accueil charge sans erreur 5xx."""
    resp = page.goto(BASE_URL, wait_until="domcontentloaded")
    assert resp is not None
    assert resp.status < 500, f"Frontend returned {resp.status}"


def test_frontend_no_js_errors(page):
    """Aucune erreur JS critique (ResizeObserver filtré)."""
    js_errors: list[str] = []

    def on_page_error(error):
        msg = str(error)
        # ResizeObserver est un faux positif fréquent
        if "ResizeObserver" in msg:
            return
        js_errors.append(msg)

    page.on("pageerror", on_page_error)
    page.goto(BASE_URL, wait_until="networkidle")
    # Laisser le temps aux scripts de s'exécuter
    page.wait_for_timeout(2000)

    assert len(js_errors) == 0, f"Erreurs JS détectées : {js_errors}"


def test_frontend_has_essential_elements(page):
    """La page d'accueil contient un titre, un CTA, et n'est pas blanche."""
    page.goto(BASE_URL, wait_until="networkidle")

    # Titre principal : "Ne regardez plus vos vidéos." ou "Stop watching..."
    h1 = page.locator("h1")
    assert h1.count() > 0, "Aucun <h1> trouvé — page blanche ?"
    h1_text = h1.first.inner_text()
    assert len(h1_text) > 5, f"<h1> trop court ou vide : '{h1_text}'"

    # CTA : bouton "Analyser" ou "Analyze" ou "Créer un compte" ou "Sign up"
    cta = page.locator(
        "button:has-text('Analyser'), "
        "button:has-text('Analyze'), "
        "button:has-text('Créer un compte'), "
        "button:has-text('Sign up'), "
        "a:has-text('Commencer gratuitement'), "
        "a:has-text('Start for free')"
    )
    assert cta.count() > 0, "Aucun CTA trouvé sur la landing page"

    # Pas de page blanche : le body a du contenu visible
    body_text = page.locator("body").inner_text()
    assert len(body_text) > 100, "La page semble blanche (moins de 100 caractères)"
