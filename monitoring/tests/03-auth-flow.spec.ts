/**
 * 03 — Auth Flow Smoke Tests
 * Vérifie login mockée, redirection, et protection des routes
 * @tags @smoke @ui
 */
import { test, expect } from '@playwright/test';
import { ROUTES, MOCK_USER, dismissCookieBanner, createFakeJwt } from './helpers';

test.describe('Auth Flow @smoke @ui', () => {
  test('routes protégées redirigent vers /login sans auth', async ({ page }) => {
    const protectedRoutes = [
      ROUTES.dashboard,
      ROUTES.history,
      ROUTES.settings,
      ROUTES.playlists,
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL(/\/login/, { timeout: 15_000 });
      expect(page.url()).toContain('/login');
    }
  });

  test('login avec mock API redirige vers /dashboard', async ({ page }) => {
    // Pre-dismiss cookie banner
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', JSON.stringify({ accepted: true, timestamp: Date.now() }));
      localStorage.setItem('posthog_consent', 'true');
    });

    // Intercepter toutes les requêtes API pour le mock
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: createFakeJwt(),
          refresh_token: createFakeJwt(),
        }),
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      });
    });

    // Mock les endpoints spécifiques post-login
    await page.route('**/api/auth/quota**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ credits: 250, monthly_limit: 250, plan: 'free' }),
      });
    });

    await page.route('**/api/auth/limits**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ analysis_count: 0, analysis_limit: 5 }),
      });
    });

    await page.route('**/api/videos/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, pages: 0, limit: 20 }),
      });
    });

    await page.route('**/api/tournesol/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], recommendations: [] }),
      });
    });

    await page.route('**/api/billing/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plan: 'free' }),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto(ROUTES.login);
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Remplir le formulaire
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill('smoke@test.com');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('SmokeTest123!');

    // Submit avec Enter (plus fiable que click avec overlay)
    await passwordInput.press('Enter');

    // Doit rediriger hors de /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
    expect(page.url()).not.toContain('/login');
  });

  test('login avec mauvais creds affiche une erreur', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', JSON.stringify({ accepted: true, timestamp: Date.now() }));
    });

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Email ou mot de passe incorrect' }),
      });
    });

    await page.goto(ROUTES.login);
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill('wrong@test.com');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('wrong');

    // Submit via Enter
    await passwordInput.press('Enter');

    // Message d'erreur visible
    const errorMsg = page.locator('text=/incorrect|invalide|error|erreur|failed/i');
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });
  });

  test('formulaire login — validation champs vides', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', JSON.stringify({ accepted: true, timestamp: Date.now() }));
    });

    await page.goto(ROUTES.login);
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Click le champ email pour focus, puis Enter pour submit le formulaire
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.focus();
    await emailInput.press('Enter');

    // Erreur de validation — "Veuillez remplir tous les champs" ou "Please fill all fields"
    const errorMsg = page.locator('text=/remplir|required|champs|fill all/i');
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
  });
});
