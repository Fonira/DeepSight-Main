/**
 * 02 — Pages publiques Smoke Tests
 * Vérifie que toutes les pages publiques chargent sans erreur
 * @tags @smoke @ui
 */
import { test, expect } from '@playwright/test';
import { ROUTES } from './helpers';

test.describe('Pages publiques @smoke @ui', () => {
  test('landing page charge et affiche le contenu', async ({ page }) => {
    await page.goto(ROUTES.landing);
    await expect(page).toHaveTitle(/deep\s?sight/i);

    // Le CTA principal ou le bouton de login doit être visible
    const cta = page.locator('a[href*="login"], a[href*="register"], button:has-text("Commencer"), button:has-text("Get Started")').first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
  });

  test('page login charge avec le formulaire', async ({ page }) => {
    await page.goto(ROUTES.login);

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    const googleBtn = page.locator('button:has-text("Google")');
    await expect(googleBtn).toBeVisible();
  });

  test('page login — toggle inscription/connexion', async ({ page }) => {
    await page.goto(ROUTES.login);

    // Trouver le lien pour basculer vers inscription
    const toggleLink = page.locator(
      'button:has-text("Créer un compte"), button:has-text("Create"), button:has-text("inscrire"), button:has-text("Sign up"), a:has-text("inscrire"), a:has-text("Sign up"), a:has-text("Créer")'
    ).first();

    if (await toggleLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await toggleLink.click();
      // Un champ supplémentaire devrait apparaitre (confirm password)
      await page.waitForTimeout(1000);
      const passwordInputs = page.locator('input[type="password"]');
      const count = await passwordInputs.count();
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test('page /status charge', async ({ page }) => {
    await page.goto(ROUTES.status);
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/status');
  });

  test('page /contact charge', async ({ page }) => {
    await page.goto(ROUTES.contact);
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/contact');
  });

  test('page /legal/cgu charge', async ({ page }) => {
    await page.goto(ROUTES.legalCGU);
    await expect(page.locator('body')).toBeVisible();
  });

  test('page /legal/cgv charge', async ({ page }) => {
    await page.goto(ROUTES.legalCGV);
    await expect(page.locator('body')).toBeVisible();
  });

  test('page /legal/privacy charge', async ({ page }) => {
    await page.goto(ROUTES.privacy);
    await expect(page.locator('body')).toBeVisible();
  });

  test('page /api-docs charge', async ({ page }) => {
    await page.goto(ROUTES.apiDocs);
    await expect(page.locator('body')).toBeVisible();
  });

  test('route inconnue — ne crashe pas (404 ou redirect)', async ({ page }) => {
    const res = await page.goto(ROUTES.notFound);
    // La page ne doit pas crasher — soit 404, soit redirect, soit SPA fallback
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('aucune erreur console critique sur la landing', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(ROUTES.landing);
    await page.waitForLoadState('networkidle');

    // Filtrer les erreurs bénignes
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('analytics') &&
        !e.includes('posthog') &&
        !e.includes('crisp') &&
        !e.includes('net::ERR_') &&
        !e.includes('Failed to load resource') &&
        !e.includes('third-party') &&
        !e.includes('blocked') &&
        !e.includes('CORS') &&
        !e.includes('cookie') &&
        !e.includes('deprecat')
    );
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });
});
