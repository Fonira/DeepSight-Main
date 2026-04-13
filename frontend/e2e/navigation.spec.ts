import { test, expect } from "@playwright/test";

test.describe("Navigation & Route Protection", () => {
  test("protected routes redirect to /login when not authenticated", async ({
    page,
  }) => {
    // Ensure no tokens exist
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("cached_user");
    });

    // Mock /me to return 401
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    // Try accessing a protected route
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("authenticated user can navigate between pages", async ({ page }) => {
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

    // Mock history endpoint
    await page.route("**/api/videos/history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          pages: 0,
          limit: 20,
        }),
      });
    });

    // Mock quota
    await page.route("**/api/auth/quota**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          credits: 150,
          monthly_limit: 150,
          plan: "free",
        }),
      });
    });

    // Set tokens
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("access_token", "mock-token");
      localStorage.setItem("refresh_token", "mock-refresh");
    });

    // Navigate to dashboard
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/login/);

    // Navigate to history
    const historyLink = page
      .locator(
        'a[href*="history"], a[href*="historique"], button:has-text("Historique"), button:has-text("History")',
      )
      .first();
    if (await historyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await historyLink.click();
      await expect(page).toHaveURL(/\/(history|historique)/);
    }

    // Navigate to upgrade
    await page.goto("/upgrade");
    await expect(page).toHaveURL(/\/upgrade/);
  });

  test("unknown route shows 404 or redirects", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz");

    // Either a 404 page or redirect to home/login
    const is404 = await page
      .locator("text=/404|not found|page introuvable|page non trouvée/i")
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const isRedirected =
      page.url().includes("/login") || page.url().endsWith("/");

    expect(is404 || isRedirected).toBe(true);
  });
});
