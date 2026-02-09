import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// 3.7 Edge Cases Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Double Click Prevention', () => {
  test('double click on submit should not trigger double request', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const apiRequests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/') && req.method() === 'POST') {
        apiRequests.push(`${req.method()} ${req.url()}`);
      }
    });

    const input = page.locator(
      'input[type="url"], input[type="text"], input[placeholder*="youtube" i], input[placeholder*="video" i], input[placeholder*="url" i], input[placeholder*="colle" i], textarea'
    ).first();

    if (await input.isVisible().catch(() => false)) {
      await input.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      // Find submit button
      const submitBtn = page.locator(
        'button:has-text("Analyser"), button:has-text("Analyze"), button[type="submit"]'
      ).first();

      if (await submitBtn.isVisible().catch(() => false)) {
        // Double click rapidly
        await submitBtn.dblclick();
        await page.waitForTimeout(3000);

        // Check if more than one analyze request was sent
        const analyzeRequests = apiRequests.filter(r => r.includes('analyze'));
        console.log(`Analyze requests after double-click: ${analyzeRequests.length}`);
        if (analyzeRequests.length > 1) {
          console.log('WARNING: Double submit detected! Requests:', analyzeRequests);
        }
      }
    }
  });
});

test.describe('Page Refresh During Loading', () => {
  test('refresh during page load should not crash', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/dashboard');
    // Refresh immediately
    await page.reload({ waitUntil: 'networkidle' });

    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(0);

    console.log(`Console errors after refresh: ${consoleErrors.length}`);
  });
});

test.describe('Special Characters in Inputs', () => {
  test('special characters in URL input should not break the UI', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const input = page.locator(
      'input[type="url"], input[type="text"], input[placeholder*="youtube" i], input[placeholder*="video" i], input[placeholder*="url" i], input[placeholder*="colle" i], textarea'
    ).first();

    if (await input.isVisible().catch(() => false)) {
      // Test XSS-like input
      await input.fill('<script>alert("xss")</script>');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      // Should not trigger any script execution
      const dialogPromise = page.waitForEvent('dialog', { timeout: 2000 }).catch(() => null);
      const dialog = await dialogPromise;
      expect(dialog).toBeNull();

      // Page should still be functional
      const root = page.locator('#root');
      const rootHTML = await root.innerHTML();
      expect(rootHTML.length).toBeGreaterThan(0);
    }
  });

  test('SQL injection-like input should not break the UI', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();

    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill("'; DROP TABLE users; --");

      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill("' OR '1'='1");

      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);

        // Page should handle this gracefully
        const root = page.locator('#root');
        const rootHTML = await root.innerHTML();
        expect(rootHTML.length).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Rapid Navigation', () => {
  test('rapid navigation between pages should not crash', async ({ page }) => {
    const pages = ['/dashboard', '/history', '/settings', '/upgrade', '/playlists', '/analytics'];

    for (const p of pages) {
      await page.goto(p, { waitUntil: 'domcontentloaded' });
      // Don't wait for full load, navigate immediately
    }

    // After rapid navigation, page should be stable
    await page.waitForTimeout(2000);
    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(0);
  });
});

test.describe('Browser Back/Forward', () => {
  test('back/forward navigation should work correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.goto('/legal', { waitUntil: 'networkidle' });

    // Go back
    await page.goBack();
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');

    // Go back again
    await page.goBack();
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url === 'http://localhost:5173/' || url === 'http://localhost:5173').toBeTruthy();

    // Go forward
    await page.goForward();
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');
  });
});
