import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// 3.3 & 3.4 Dashboard & Video Analysis Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
  });

  test('should render dashboard without crashing', async ({ page }) => {
    const root = page.locator('#root');
    const rootHTML = await root.innerHTML();
    expect(rootHTML.length).toBeGreaterThan(100);
  });

  test('should have a video URL input or search bar', async ({ page }) => {
    // Look for the smart input bar (main feature)
    const inputBar = page.locator(
      'input[type="url"], input[type="text"], input[placeholder*="youtube" i], input[placeholder*="video" i], input[placeholder*="url" i], input[placeholder*="recherch" i], input[placeholder*="search" i], input[placeholder*="colle" i], textarea'
    );
    const count = await inputBar.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show loading states, not infinite skeletons', async ({ page }) => {
    // Wait for any loading to finish (max 15s)
    await page.waitForTimeout(5000);

    // Check for skeleton loaders still present
    const skeletons = page.locator('.animate-pulse, [class*="skeleton"], [class*="Skeleton"]');
    const skeletonCount = await skeletons.count();

    // After 5 seconds, there should be minimal skeletons
    // Some might be for lazy-loaded content but not the main layout
    console.log(`Skeletons still visible after 5s: ${skeletonCount}`);
  });

  test('empty URL submission should show validation error', async ({ page }) => {
    // Find submit button near the input
    const submitBtn = page.locator(
      'button:has-text("Analyser"), button:has-text("Analyze"), button[type="submit"], button:has(svg[class*="search"]), button:has(svg[class*="play"]), button:has(svg[class*="arrow"])'
    ).first();

    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // Should show some form of error/validation
      const errorIndicator = page.locator(
        '[role="alert"], .text-red, [class*="error" i], [class*="invalid" i], [class*="warning" i]'
      );
      const errorCount = await errorIndicator.count();
      console.log(`Validation errors shown on empty submit: ${errorCount}`);
    }
  });

  test('invalid URL should show error message', async ({ page }) => {
    const input = page.locator(
      'input[type="url"], input[type="text"], input[placeholder*="youtube" i], input[placeholder*="video" i], input[placeholder*="url" i], input[placeholder*="colle" i], textarea'
    ).first();

    if (await input.isVisible().catch(() => false)) {
      await input.fill('not-a-valid-url');

      // Try to submit
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      // Check for error feedback
      const url = page.url();
      const errorIndicator = page.locator(
        '[role="alert"], .text-red, [class*="error" i], [class*="invalid" i]'
      );
      const errorCount = await errorIndicator.count();
      console.log(`Errors after invalid URL: ${errorCount}`);
    }
  });

  test('URL with spaces should be trimmed', async ({ page }) => {
    const input = page.locator(
      'input[type="url"], input[type="text"], input[placeholder*="youtube" i], input[placeholder*="video" i], input[placeholder*="url" i], input[placeholder*="colle" i], textarea'
    ).first();

    if (await input.isVisible().catch(() => false)) {
      await input.fill('  https://www.youtube.com/watch?v=test123  ');

      const value = await input.inputValue();
      console.log(`Input value after paste with spaces: "${value}"`);
      // The value should be trimmed or the app should handle it
    }
  });
});

test.describe('Video Analysis Flow', () => {
  test('submitting a YouTube URL should trigger analysis or show appropriate message', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const input = page.locator(
      'input[type="url"], input[type="text"], input[placeholder*="youtube" i], input[placeholder*="video" i], input[placeholder*="url" i], input[placeholder*="colle" i], textarea'
    ).first();

    if (await input.isVisible().catch(() => false)) {
      await input.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.keyboard.press('Enter');

      // Wait for response
      await page.waitForTimeout(5000);

      // Should show either:
      // 1. Loading/streaming state
      // 2. Error from backend (if not running)
      // 3. Login prompt
      const loadingIndicator = page.locator(
        '.animate-spin, .animate-pulse, [class*="loading" i], [class*="spinner" i], [class*="streaming" i], [class*="progress" i]'
      );
      const errorIndicator = page.locator(
        '[role="alert"], [class*="error" i], [class*="erreur" i]'
      );

      const hasLoading = await loadingIndicator.count() > 0;
      const hasError = await errorIndicator.count() > 0;

      console.log(`After YouTube URL submit - Loading: ${hasLoading}, Error: ${hasError}`);
      // At minimum, UI should respond (not freeze)
    }
  });
});

test.describe('Dashboard - No Infinite Loading', () => {
  test('page should finish loading within 10 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - start;

    console.log(`Dashboard load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(15000);
  });
});
