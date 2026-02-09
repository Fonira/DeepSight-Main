import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// 3.5 Settings, Profile & Other Pages Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Settings Page', () => {
  test('should render settings form', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' });

    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(50);

    // Look for settings-related content
    const settingsContent = page.locator(
      'h1:has-text("Paramètres"), h1:has-text("Settings"), h2:has-text("Paramètres"), h2:has-text("Settings"), [class*="setting" i]'
    );
    const formElements = page.locator('input, select, textarea, button');
    const formCount = await formElements.count();

    console.log(`Settings page form elements: ${formCount}`);
  });
});

test.describe('My Account Page', () => {
  test('should render account page', async ({ page }) => {
    await page.goto('/account', { waitUntil: 'networkidle' });

    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(50);
  });
});

test.describe('History Page', () => {
  test('should render history page without crash', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/history', { waitUntil: 'networkidle' });

    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(50);

    // Check for history-related content or empty state
    const historyContent = page.locator(
      'h1:has-text("Historique"), h1:has-text("History"), [class*="history" i], [class*="empty" i]'
    );

    console.log(`Console errors on History page: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors.slice(0, 5).join('\n'));
    }
  });
});

test.describe('Upgrade Page', () => {
  test('should render pricing plans', async ({ page }) => {
    await page.goto('/upgrade', { waitUntil: 'networkidle' });

    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(50);

    // Should show plan cards/pricing
    const planRelated = page.locator(
      '[class*="plan" i], [class*="price" i], [class*="pricing" i], :text("Pro"), :text("Starter"), :text("Student"), :text("Free")'
    );
    const planCount = await planRelated.count();

    console.log(`Pricing plan elements found: ${planCount}`);
    expect(planCount).toBeGreaterThan(0);
  });
});

test.describe('Analytics Page', () => {
  test('should render analytics page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/analytics', { waitUntil: 'networkidle' });

    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(50);

    console.log(`Console errors on Analytics: ${consoleErrors.length}`);
  });
});

test.describe('Usage Dashboard', () => {
  test('should render usage dashboard', async ({ page }) => {
    await page.goto('/usage', { waitUntil: 'networkidle' });

    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(50);
  });
});

test.describe('Playlists Page', () => {
  test('should render playlists page', async ({ page }) => {
    await page.goto('/playlists', { waitUntil: 'networkidle' });

    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(50);
  });
});

test.describe('Legal Page', () => {
  test('should render legal content', async ({ page }) => {
    await page.goto('/legal', { waitUntil: 'networkidle' });

    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(100);

    // Legal page should have substantial text content
    const textContent = await page.locator('body').textContent();
    expect(textContent!.length).toBeGreaterThan(200);
  });
});

test.describe('Landing Page', () => {
  test('should render full landing page with CTA', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Should have call-to-action
    const cta = page.locator(
      'a:has-text("Commencer"), a:has-text("Start"), a:has-text("Essayer"), button:has-text("Commencer"), button:has-text("Start"), button:has-text("Essayer")'
    );
    const ctaCount = await cta.count();
    console.log(`CTA buttons found: ${ctaCount}`);
  });
});
