// frontend/e2e/hub-first-navigation.spec.ts
//
// Hub-first navigation : vérifie que les chemins post-analyse / open-analysis
// convergent vers `/hub`, et que le paramètre `?open_summary=1` rend le bloc
// résumé déroulé d'emblée.
//
// Les 3 scenarios ci-dessous reposent sur l'existence d'au moins une analyse
// pour le test user. Sans ça, ils sont marqués `skipped` plutôt qu'échec —
// fidèle au pattern de `hub-unified.spec.ts`.

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

/**
 * Récupère l'id de la première analyse disponible via le drawer du hub.
 * Retourne `null` si le test user n'a aucune conversation.
 */
async function pickFirstSummaryId(
  page: import("@playwright/test").Page,
): Promise<number | null> {
  await page.goto("/hub");
  await page.click('button[aria-label="Conversations"]');
  const firstConv = page.locator("aside button[data-conv-id]").first();
  if (!(await firstConv.isVisible())) return null;
  const raw = await firstConv.getAttribute("data-conv-id");
  return raw ? Number(raw) : null;
}

test.describe("Hub-first navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("?open_summary=1 renders the summary already expanded", async ({
    page,
  }) => {
    const summaryId = await pickFirstSummaryId(page);
    if (summaryId === null) {
      test.skip(true, "test user has no analyses");
      return;
    }

    await page.goto(`/hub?summary=${summaryId}&open_summary=1`);

    // The "RÉSUMÉ" pill is always present, but the citations row only shows
    // when the panel is in the open state.
    await expect(page.getByText("RÉSUMÉ")).toBeVisible();
    // Citations are timestamps formatted MM:SS — at least one MM:SS pill
    // visible is the open-state proof.
    await expect(page.locator("text=/^\\d{2}:\\d{2}$/").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("?summary=ID without open_summary keeps the summary collapsed", async ({
    page,
  }) => {
    const summaryId = await pickFirstSummaryId(page);
    if (summaryId === null) {
      test.skip(true, "test user has no analyses");
      return;
    }

    await page.goto(`/hub?summary=${summaryId}`);
    await expect(page.getByText("RÉSUMÉ")).toBeVisible();
    // Citations should NOT be visible when collapsed.
    await expect(page.locator("text=/^\\d{2}:\\d{2}$/").first()).toBeHidden();
  });

  test("Dashboard recent-analyses click lands on /hub with summary param", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // The "Recent Analyses" section renders cards that call onOpenAnalysis on
    // click. We pick the first available card by data-summary-id; if none,
    // the test user has no recent analyses and we skip.
    const card = page.locator("[data-recent-analysis-id]").first();
    if (!(await card.isVisible())) {
      test.skip(true, "no recent analyses for test user");
      return;
    }
    const expectedId = await card.getAttribute("data-recent-analysis-id");
    await card.click();

    await expect(page).toHaveURL(
      new RegExp(`/hub\\?summary=${expectedId ?? "\\d+"}`),
    );
  });
});
