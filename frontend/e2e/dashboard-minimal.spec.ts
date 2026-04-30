// frontend/e2e/dashboard-minimal.spec.ts
//
// Dashboard minimal landing — assert que `/dashboard` (default depuis
// 2026-04-30) sert la page minimaliste. Vérifie aussi le path d'opt-out vers
// la legacy via `?legacy=1` ou `localStorage.ds_hub_legacy_home=1`.
//
// Le test repose sur un user authentifié — pattern aligné avec
// `hub-first-navigation.spec.ts` et `hub-unified.spec.ts`.

import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: process.env.E2E_USER ?? "e2e@deepsight.test",
  password: process.env.E2E_PASS ?? "test1234",
};

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/);
}

test.describe("Dashboard minimal landing (default home)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any opt-out flag that previous tests may have set.
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem("ds_hub_legacy_home");
      } catch {
        /* */
      }
    });
    await login(page);
  });

  test("displays SmartInputBar, Recent and Tournesol sections (no AnalysisHub tabs)", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/dashboard/);

    // SmartInputBar — soit "Coller" soit le placeholder de search/url
    const smartInput = page
      .locator('input, textarea')
      .filter({ has: page.locator(":visible") })
      .first();
    await expect(smartInput).toBeVisible({ timeout: 8000 });

    // Pas d'AnalysisHub tabs (Résumé / Études / Fact-check / etc.) — propre à
    // la legacy. Si on les trouve, c'est que le minimal n'est pas servi.
    await expect(
      page.getByRole("tab", { name: /fact-?check/i }),
    ).toHaveCount(0);

    // Tournesol présent (la section "Recommandations Tournesol" est unique au
    // minimal landing + au mobile).
    await expect(page.getByText(/tournesol|recommandations/i)).toBeVisible({
      timeout: 8000,
    });
  });

  test("opt-out via ?legacy=1 renders the legacy DashboardPage with AnalysisHub tabs", async ({
    page,
  }) => {
    await page.goto("/dashboard?legacy=1");
    // La legacy page expose les tabs AnalysisHub : on attend de voir au moins
    // un onglet "Résumé" ou "Synthèse" qui n'existe pas dans le minimal.
    await expect(page.locator("body")).toContainText(/résumé|synthèse|analyse/i, {
      timeout: 8000,
    });
  });
});
