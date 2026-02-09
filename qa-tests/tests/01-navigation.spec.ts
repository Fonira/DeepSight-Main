import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// 3.1 Navigation & Routing Tests
// ═══════════════════════════════════════════════════════════════

const PUBLIC_ROUTES = [
  { path: '/', name: 'Landing/Home' },
  { path: '/login', name: 'Login' },
  { path: '/legal', name: 'Legal' },
  { path: '/payment/success', name: 'Payment Success' },
  { path: '/payment/cancel', name: 'Payment Cancel' },
];

const PROTECTED_ROUTES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/playlists', name: 'Playlists' },
  { path: '/history', name: 'History' },
  { path: '/upgrade', name: 'Upgrade' },
  { path: '/settings', name: 'Settings' },
  { path: '/account', name: 'My Account' },
  { path: '/admin', name: 'Admin' },
  { path: '/analytics', name: 'Analytics' },
  { path: '/usage', name: 'Usage Dashboard' },
  { path: '/study/test-123', name: 'Study Page' },
];

test.describe('Public Routes - No Blank Pages', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) should render content`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const response = await page.goto(route.path, { waitUntil: 'networkidle' });

      // Should not be a server error
      expect(response?.status()).toBeLessThan(500);

      // Should have visible content (not blank page)
      const body = await page.locator('body');
      await expect(body).not.toBeEmpty();

      // Check for React error overlay (white screen of death)
      const errorOverlay = page.locator('#webpack-dev-server-client-overlay, .error-overlay, [data-reactroot]');
      const reactRoot = page.locator('#root');
      const rootHTML = await reactRoot.innerHTML().catch(() => '');

      // Root should have content (not empty)
      expect(rootHTML.length).toBeGreaterThan(0);
    });
  }
});

test.describe('Protected Routes - Auth Redirect', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route.name} (${route.path}) without auth should redirect or show content (dev bypass)`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(route.path, { waitUntil: 'networkidle' });

      // Either redirected to login OR page rendered (dev bypass)
      const url = page.url();
      const isOnLogin = url.includes('/login');
      const isOnOriginal = url.includes(route.path);
      const isOnHome = url === 'http://localhost:5173/';

      // Must be somewhere valid
      expect(isOnLogin || isOnOriginal || isOnHome).toBeTruthy();

      // Should not be blank
      const rootHTML = await page.locator('#root').innerHTML().catch(() => '');
      expect(rootHTML.length).toBeGreaterThan(0);
    });
  }
});

test.describe('404 Handling', () => {
  test('Non-existent route should redirect to home', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz', { waitUntil: 'networkidle' });

    // Per App.tsx, wildcard route redirects to /
    const url = page.url();
    expect(url).toBe('http://localhost:5173/');
  });

  test('Deep non-existent route should redirect to home', async ({ page }) => {
    await page.goto('/foo/bar/baz/deep', { waitUntil: 'networkidle' });
    const url = page.url();
    expect(url).toBe('http://localhost:5173/');
  });
});

test.describe('Navigation Links', () => {
  test('Landing page should have navigation to login', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Look for login link/button
    const loginLink = page.locator('a[href*="login"], button:has-text("Connexion"), button:has-text("Login"), a:has-text("Connexion"), a:has-text("Login")');
    const count = await loginLink.count();
    expect(count).toBeGreaterThan(0);
  });
});
