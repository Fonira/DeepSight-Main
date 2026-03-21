import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');

    // Page should contain login form elements
    await expect(page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    // Intercept login API call
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        }),
      });
    });

    // Intercept /me call after login
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'testuser',
          email: 'test@test.com',
          plan: 'free',
          credits: 150,
          credits_monthly: 150,
          is_admin: false,
          total_videos: 0,
          total_words: 0,
          total_playlists: 0,
          email_verified: true,
          created_at: '2024-01-01T00:00:00Z',
        }),
      });
    });

    await page.goto('/login');

    // Fill credentials
    await page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').fill('test@test.com');
    await page.locator('input[type="password"]').fill('password123');

    // Submit
    await page.locator('button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter"), button:has-text("Log in")').first().click();

    // Should redirect to dashboard (or home)
    await expect(page).toHaveURL(/\/(dashboard|app|$)/, { timeout: 10000 });
  });

  test('login with wrong password shows error message', async ({ page }) => {
    // Intercept login API with error
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Email ou mot de passe incorrect',
        }),
      });
    });

    await page.goto('/login');

    // Fill wrong credentials
    await page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').fill('test@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword');

    // Submit
    await page.locator('button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter"), button:has-text("Log in")').first().click();

    // Error message should be visible
    await expect(page.locator('text=/incorrect|invalide|error|erreur/i')).toBeVisible({ timeout: 5000 });
  });
});
