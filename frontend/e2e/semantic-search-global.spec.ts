import { test, expect } from "@playwright/test";

/**
 * E2E — Semantic Search V1 / Phase 2 web (global search flow).
 *
 * Couvre le happy path :
 *   1. /search loads, input visible
 *   2. typing 2+ chars triggers /api/search/global
 *   3. results render as clickable cards
 *   4. click on a result navigates to /hub with summaryId + q + highlight params
 *
 * Auth + API are mocked. Unit tests cover useSemanticSearch logic
 * (404→featureDisabled, debounce, etc.) — this spec only verifies the
 * UI flow + URL contract that downstream highlight rendering depends on.
 */
test.describe("Semantic Search — global", () => {
  test.beforeEach(async ({ page }) => {
    // Mock /me so the page loads as authenticated user
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          username: "testuser",
          email: "test@test.com",
          plan: "pro",
          credits_remaining: 100,
        }),
      });
    });

    // Mock recent queries (empty)
    await page.route("**/api/search/recent-queries", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ queries: [] }),
      });
    });

    // Mock search/global with one synthesis result
    await page.route("**/api/search/global**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: "mistral",
          results: [
            {
              summary_id: 42,
              video_title: "Test video about Mistral AI",
              passage: "Mistral est une IA française...",
              source_type: "synthesis",
              score: 0.92,
              highlight_id: "synth-1",
              source_metadata: {
                section_id: "intro",
              },
            },
          ],
          total: 1,
        }),
      });
    });
  });

  test("global search → click result → /hub with highlight params", async ({
    page,
  }) => {
    await page.goto("/search");

    // Input visible
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Recherche" i]',
    );
    await expect(searchInput).toBeVisible();

    // Type query
    await searchInput.fill("mistral");

    // Result card appears
    const resultCard = page
      .locator('[data-testid="search-result-card"], article')
      .filter({ hasText: "Mistral" })
      .first();
    await expect(resultCard).toBeVisible({ timeout: 5000 });

    // Click result
    await resultCard.click();

    // URL should be /hub with summaryId, q, and highlight params
    await page.waitForURL(/\/hub\?.*summaryId=42/, { timeout: 5000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe("/hub");
    expect(url.searchParams.get("summaryId")).toBe("42");
    expect(url.searchParams.get("q")).toBe("mistral");
    expect(url.searchParams.get("highlight")).toBeTruthy();
  });
});
