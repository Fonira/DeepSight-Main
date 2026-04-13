/**
 * 04 — Dashboard Smoke Tests (avec auth mockée)
 * Vérifie que le dashboard charge et affiche les éléments clés
 * @tags @smoke @ui
 */
import { test, expect, Page } from "@playwright/test";
import { ROUTES, MOCK_USER } from "./helpers";

/** Setup auth mockée pour accéder aux pages protégées */
async function setupMockAuth(page: Page) {
  // Set localStorage BEFORE any page load via addInitScript
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "smoke-mock-token");
    localStorage.setItem("refresh_token", "smoke-mock-refresh");
  });

  // Mock ALL API calls the app might make
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    });
  });

  await page.route("**/api/auth/quota**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ credits: 250, monthly_limit: 250, plan: "free" }),
    });
  });

  await page.route("**/api/auth/limits**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ analysis_count: 0, analysis_limit: 5 }),
    });
  });

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

  await page.route("**/api/videos/stats**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total_videos: 0, total_words: 0 }),
    });
  });

  await page.route("**/api/tournesol/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [], recommendations: [] }),
    });
  });

  await page.route("**/api/billing/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan: "free",
        plans: [
          { id: "free", name: "Gratuit", price: 0 },
          { id: "etudiant", name: "Étudiant", price: 2.99 },
          { id: "starter", name: "Starter", price: 5.99 },
          { id: "pro", name: "Pro", price: 12.99 },
        ],
      }),
    });
  });

  await page.route("**/api/notifications/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
}

test.describe("Dashboard @smoke @ui", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
  });

  test("dashboard charge et affiche le champ URL", async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await page.waitForLoadState("domcontentloaded");

    // Vérifier qu'on n'est PAS redirigé vers /login
    const url = page.url();
    if (url.includes("/login")) {
      test.skip(true, "Mock auth non supporté sur ce déploiement — skip");
      return;
    }

    const urlInput = page
      .locator(
        'input[placeholder*="youtube" i], input[placeholder*="url" i], input[placeholder*="coller" i], input[placeholder*="lien" i], input[type="url"]',
      )
      .first();
    await expect(urlInput).toBeVisible({ timeout: 15_000 });
  });

  test("dashboard — le bouton Analyser est présent", async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await page.waitForLoadState("domcontentloaded");

    if (page.url().includes("/login")) {
      test.skip(true, "Mock auth non supporté — skip");
      return;
    }

    const analyzeBtn = page
      .locator(
        'button:has-text("Analyser"), button:has-text("Analyze"), button[type="submit"]',
      )
      .first();
    await expect(analyzeBtn).toBeVisible({ timeout: 15_000 });
  });

  test("page history — accessible ou redirige vers login", async ({ page }) => {
    await page.goto(ROUTES.history);
    await page.waitForLoadState("domcontentloaded");

    // Soit on est sur history (mock auth OK), soit sur login (expected sur prod)
    const url = page.url();
    expect(url).toMatch(/\/(history|login)/);
  });

  test("page upgrade — accessible ou redirige vers login", async ({ page }) => {
    await page.goto(ROUTES.upgrade);
    await page.waitForLoadState("domcontentloaded");

    const url = page.url();
    expect(url).toMatch(/\/(upgrade|login)/);

    if (!url.includes("/login")) {
      const planCard = page
        .locator("text=/pro|starter|étudiant|student|free/i")
        .first();
      await expect(planCard).toBeVisible({ timeout: 10_000 });
    }
  });

  test("page settings — accessible ou redirige vers login", async ({
    page,
  }) => {
    await page.goto(ROUTES.settings);
    await page.waitForLoadState("domcontentloaded");

    const url = page.url();
    expect(url).toMatch(/\/(settings|login)/);
  });
});
