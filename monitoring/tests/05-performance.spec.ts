/**
 * 05 — Performance & Disponibilité Smoke Tests
 * Vérifie les temps de chargement et la disponibilité des services
 * @tags @smoke @api
 */
import { test, expect } from '@playwright/test';
import { API_URL, API_ENDPOINTS, ROUTES } from './helpers';

test.describe('Performance @smoke @api', () => {
  test('landing page charge en < 5s', async ({ page }) => {
    const start = Date.now();
    await page.goto(ROUTES.landing, { waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5_000);
  });

  test('login page charge en < 5s', async ({ page }) => {
    const start = Date.now();
    await page.goto(ROUTES.login, { waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5_000);
  });

  test('API /health répond en < 2s', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${API_URL}${API_ENDPOINTS.health}`);
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(2_000);
  });

  test('API /api/billing/plans répond en < 3s', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${API_URL}${API_ENDPOINTS.plans}`);
    const elapsed = Date.now() - start;

    expect(res.ok()).toBe(true);
    expect(elapsed).toBeLessThan(3_000);
  });

  test('SSL valide sur le frontend', async ({ request }) => {
    const res = await request.get('https://www.deepsightsynthesis.com/');
    expect(res.ok()).toBe(true);
  });

  test('SSL valide sur l\'API', async ({ request }) => {
    const res = await request.get(`${API_URL}${API_ENDPOINTS.health}`);
    expect(res.ok()).toBe(true);
  });

  test('pas de mixed content — les assets chargent en HTTPS', async ({ page }) => {
    const insecureRequests: string[] = [];

    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('http://') && !url.includes('localhost')) {
        insecureRequests.push(url);
      }
    });

    await page.goto(ROUTES.landing, { waitUntil: 'networkidle' });

    expect(insecureRequests).toHaveLength(0);
  });

  test('les assets critiques (CSS, JS) chargent avec succès', async ({ page }) => {
    const failedAssets: string[] = [];

    page.on('response', (res) => {
      const url = res.url();
      const status = res.status();
      if (
        (url.endsWith('.js') || url.endsWith('.css')) &&
        status >= 400
      ) {
        failedAssets.push(`${status} ${url}`);
      }
    });

    await page.goto(ROUTES.landing, { waitUntil: 'networkidle' });

    expect(failedAssets).toHaveLength(0);
  });
});
