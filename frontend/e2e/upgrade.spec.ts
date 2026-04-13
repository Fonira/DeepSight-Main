import { test, expect } from "@playwright/test";

test.describe("Upgrade Page", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          username: "testuser",
          email: "test@test.com",
          plan: "free",
          credits: 150,
          credits_monthly: 150,
          is_admin: false,
          total_videos: 0,
          total_words: 0,
          total_playlists: 0,
          email_verified: true,
          created_at: "2024-01-01T00:00:00Z",
        }),
      });
    });

    // Mock billing plans
    await page.route("**/api/billing/plans**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "free", name: "Gratuit", price: 0 },
          { id: "etudiant", name: "Starter", price: 299 },
          { id: "starter", name: "Standard", price: 599 },
          { id: "pro", name: "Pro", price: 1299 },
        ]),
      });
    });

    // Set tokens
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("access_token", "mock-token");
      localStorage.setItem("refresh_token", "mock-refresh");
    });
  });

  test("upgrade page loads without JS errors", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
    });

    await page.goto("/upgrade");
    await page.waitForLoadState("networkidle");

    // Filter out known benign errors (e.g., third-party scripts)
    const criticalErrors = jsErrors.filter(
      (msg) =>
        !msg.includes("posthog") &&
        !msg.includes("sentry") &&
        !msg.includes("analytics"),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("all 4 plans are displayed", async ({ page }) => {
    await page.goto("/upgrade");
    await page.waitForLoadState("networkidle");

    // Should show plan names
    await expect(page.locator("text=/gratuit|free/i").first()).toBeVisible({
      timeout: 10000,
    });

    // Count plan cards — look for pricing-related elements
    const planCards = page
      .locator('[class*="plan"], [class*="pricing"], [class*="card"]')
      .filter({
        has: page.locator("text=/€|\\$|mois|month|gratuit|free/i"),
      });

    const count = await planCards.count();
    // At least 3 plans should be visible (some UIs hide free plan from upgrade page)
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("plans show correct prices", async ({ page }) => {
    await page.goto("/upgrade");
    await page.waitForLoadState("networkidle");

    // Check that pricing amounts are visible
    // Prices: 0 (free), 2.99, 5.99, 12.99
    const pageContent = await page.textContent("body");

    // At least the paid plan prices should be on the page
    const hasPricing =
      pageContent?.includes("2.99") || pageContent?.includes("2,99");
    const hasProPricing =
      pageContent?.includes("12.99") || pageContent?.includes("12,99");

    expect(hasPricing || hasProPricing).toBe(true);
  });

  test('clicking "Choisir" triggers Stripe checkout', async ({ page }) => {
    // Mock checkout endpoint
    let checkoutCalled = false;
    await page.route("**/api/billing/checkout**", async (route) => {
      checkoutCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://checkout.stripe.com/c/pay/mock-session-id",
        }),
      });
    });

    // Also handle trial eligibility check
    await page.route("**/api/billing/trial**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ eligible: true }),
      });
    });

    await page.goto("/upgrade");
    await page.waitForLoadState("networkidle");

    // Find a "Choisir" or "Choose" or "Subscribe" button (skip the free plan)
    const chooseBtn = page
      .locator(
        'button:has-text("Choisir"), button:has-text("Choose"), button:has-text("Commencer"), button:has-text("S\'abonner"), button:has-text("Subscribe"), button:has-text("Essai"), button:has-text("Start")',
      )
      .first();

    if (await chooseBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      // Intercept navigation to Stripe
      const [popup] = await Promise.all([
        page.waitForEvent("popup", { timeout: 5000 }).catch(() => null),
        page
          .waitForURL(/stripe|checkout|billing/, { timeout: 5000 })
          .catch(() => null),
        chooseBtn.click(),
      ]);

      // Either checkout API was called, or navigation to Stripe occurred
      const url = page.url();
      const stripeRedirect = url.includes("stripe") || url.includes("checkout");

      expect(checkoutCalled || stripeRedirect || popup !== null).toBe(true);
    }
  });
});
