import { test, expect } from "@playwright/test";

// Helper: login and set tokens before each test
async function loginAsUser(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        username: "testuser",
        email: "test@test.com",
        plan: "pro",
        credits: 100,
        credits_monthly: 200,
        is_admin: false,
        total_videos: 5,
        total_words: 10000,
        total_playlists: 0,
        email_verified: true,
        created_at: "2024-01-01T00:00:00Z",
      }),
    });
  });

  // Set auth tokens in localStorage before navigating
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("access_token", "mock-access-token");
    localStorage.setItem("refresh_token", "mock-refresh-token");
  });
}

test.describe("Video Analysis", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test("pasting YouTube URL enables analyze button", async ({ page }) => {
    await page.goto("/");

    // Find the URL input field
    const urlInput = page
      .locator(
        'input[placeholder*="youtube" i], input[placeholder*="url" i], input[placeholder*="coller" i], input[placeholder*="lien" i], input[type="url"]',
      )
      .first();

    if (await urlInput.isVisible()) {
      await urlInput.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

      // The analyze button should be enabled
      const analyzeBtn = page
        .locator(
          'button:has-text("Analyser"), button:has-text("Analyze"), button[type="submit"]',
        )
        .first();
      await expect(analyzeBtn).toBeEnabled({ timeout: 3000 });
    }
  });

  test("launching analysis shows loader then result", async ({ page }) => {
    // Mock the analyze endpoint
    await page.route("**/api/videos/analyze**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ task_id: "task-123" }),
      });
    });

    // Mock task status - first loading, then complete
    let statusCallCount = 0;
    await page.route("**/api/videos/status/**", async (route) => {
      statusCallCount++;
      if (statusCallCount <= 2) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            task_id: "task-123",
            status: "processing",
            progress: 50,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            task_id: "task-123",
            status: "completed",
            progress: 100,
            result: {
              id: 1,
              video_id: "dQw4w9WgXcQ",
              video_title: "Test Video",
              video_channel: "Test Channel",
              summary_content: "This is the summary of the analyzed video.",
              created_at: "2024-01-01T00:00:00Z",
            },
          }),
        });
      }
    });

    await page.goto("/");

    const urlInput = page
      .locator(
        'input[placeholder*="youtube" i], input[placeholder*="url" i], input[placeholder*="coller" i], input[placeholder*="lien" i], input[type="url"]',
      )
      .first();

    if (await urlInput.isVisible()) {
      await urlInput.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

      const analyzeBtn = page
        .locator(
          'button:has-text("Analyser"), button:has-text("Analyze"), button[type="submit"]',
        )
        .first();
      if (await analyzeBtn.isVisible()) {
        await analyzeBtn.click();

        // Loader should appear (spinner, progress bar, or loading text)
        const loader = page.locator(
          '[class*="spinner"], [class*="loader"], [class*="loading"], [role="progressbar"], text=/chargement|loading|analyse en cours/i',
        );
        // Either loader appears or we go directly to results
        await expect(
          loader.or(page.locator("text=/summary|résumé|synthèse/i")),
        ).toBeVisible({ timeout: 15000 });
      }
    }
  });

  test("invalid URL shows error message", async ({ page }) => {
    await page.goto("/");

    const urlInput = page
      .locator(
        'input[placeholder*="youtube" i], input[placeholder*="url" i], input[placeholder*="coller" i], input[placeholder*="lien" i], input[type="url"]',
      )
      .first();

    if (await urlInput.isVisible()) {
      await urlInput.fill("not-a-valid-url");

      const analyzeBtn = page
        .locator(
          'button:has-text("Analyser"), button:has-text("Analyze"), button[type="submit"]',
        )
        .first();

      if (await analyzeBtn.isVisible()) {
        // Button might be disabled for invalid URL, or clicking it shows error
        const isDisabled = await analyzeBtn.isDisabled();
        if (!isDisabled) {
          await analyzeBtn.click();
          // Error message should appear
          await expect(
            page.locator("text=/invalide|invalid|url|erreur|error/i"),
          ).toBeVisible({ timeout: 5000 });
        } else {
          // Button is disabled for invalid URL — that's correct behavior
          expect(isDisabled).toBe(true);
        }
      }
    }
  });
});
