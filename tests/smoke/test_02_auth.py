"""
DeepSight Smoke Tests — 02 Authentication
Vérifie les pages de login/signup, les mauvais credentials, et la protection des routes.
"""

import pytest

from conftest import BASE_URL, SMOKE_EMAIL, SMOKE_PASSWORD


def test_login_page_accessible(page):
    """La page /login charge et affiche les champs email + password."""
    resp = page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    assert resp is not None
    assert resp.status < 500

    # Champ email : input[type='email'] avec placeholder "you@example.com"
    email_input = page.locator("input[type='email']")
    assert email_input.count() > 0, "Champ email introuvable"
    assert email_input.first.is_visible(), "Champ email pas visible"

    # Champ password : input[type='password']
    password_input = page.locator("input[type='password']")
    assert password_input.count() > 0, "Champ password introuvable"
    assert password_input.first.is_visible(), "Champ password pas visible"

    # Bouton de connexion (texte traduit : "Se connecter" ou "Sign in")
    submit_btn = page.locator(
        "button[type='submit']:has-text('connecter'), "
        "button[type='submit']:has-text('Sign in'), "
        "button[type='submit']:has-text('Connexion')"
    )
    assert submit_btn.count() > 0, "Bouton de connexion introuvable"


def test_login_bad_credentials(page):
    """Un mauvais login affiche un message d'erreur (pas un crash)."""
    page.goto(f"{BASE_URL}/login", wait_until="networkidle")

    # Remplir avec des credentials invalides
    page.locator("input[type='email']").first.fill("bad-user@fake.com")
    page.locator("input[type='password']").first.fill("wrongpassword123")

    # Soumettre
    page.locator("button[type='submit']").first.click()

    # Attendre qu'un message d'erreur apparaisse (div avec texte d'erreur)
    # Le composant affiche une div avec AlertCircle + texte d'erreur
    error_msg = page.locator(
        "[class*='error'], "
        "[class*='alert'], "
        "[role='alert'], "
        "div:has(svg) p"
    )
    error_msg.first.wait_for(state="visible", timeout=10000)

    # Vérifier qu'on est toujours sur /login (pas de crash/redirection bizarre)
    assert "/login" in page.url, f"Redirigé vers {page.url} au lieu de rester sur /login"


def test_login_success(page):
    """Login avec le compte test → redirige vers /dashboard."""
    if not SMOKE_PASSWORD:
        pytest.skip("SMOKE_TEST_PASSWORD non défini — pas de compte test")

    page.goto(f"{BASE_URL}/login", wait_until="networkidle")

    page.locator("input[type='email']").first.fill(SMOKE_EMAIL)
    page.locator("input[type='password']").first.fill(SMOKE_PASSWORD)
    page.locator("button[type='submit']").first.click()

    # Attendre la redirection vers /dashboard (max 15s pour auth + load)
    page.wait_for_url("**/dashboard**", timeout=15000)
    assert "/dashboard" in page.url, f"Attendu /dashboard, obtenu {page.url}"


def test_signup_page_accessible(page):
    """La page /login?tab=register charge le formulaire d'inscription."""
    resp = page.goto(f"{BASE_URL}/login?tab=register", wait_until="networkidle")
    assert resp is not None
    assert resp.status < 500

    # En mode register, on doit voir email + password + confirm password
    email_input = page.locator("input[type='email']")
    assert email_input.count() > 0, "Champ email introuvable en mode register"

    password_inputs = page.locator("input[type='password']")
    # Au moins 2 champs password (password + confirm)
    assert password_inputs.count() >= 2, (
        f"Attendu au moins 2 champs password (pwd + confirm), trouvé {password_inputs.count()}"
    )

    # Bouton "Créer un compte" ou "Create account"
    create_btn = page.locator(
        "button[type='submit']:has-text('Créer'), "
        "button[type='submit']:has-text('Create')"
    )
    assert create_btn.count() > 0, "Bouton 'Créer un compte' introuvable"


def test_protected_routes_redirect(page):
    """Accéder à /dashboard sans être connecté → redirige vers /login."""
    page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle")

    # PrivateRoute fait Navigate to="/login"
    page.wait_for_url("**/login**", timeout=10000)
    assert "/login" in page.url, f"Attendu /login, obtenu {page.url}"
