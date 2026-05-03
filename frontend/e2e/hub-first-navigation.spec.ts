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

  // Hub redesign 2026-05-03 (fix/hub-nav-redesign) — SummaryCollapsible retiré
  // du HubPage. Le paramètre URL `?open_summary=1` n'est plus géré : la synthèse
  // est désormais le contenu de l'onglet "Synthèse" de la HubTabBar globale.
  // Les 2 tests qui suivaient ce flow ont été remplacés par les tests sticky-tab
  // / tab-routing ci-dessous.

  test("HubTabBar reste sticky même après scroll dans Synthèse (F1)", async ({
    page,
  }) => {
    const summaryId = await pickFirstSummaryId(page);
    if (summaryId === null) {
      test.skip(true, "test user has no analyses");
      return;
    }

    await page.goto(`/hub?summary=${summaryId}`);
    await expect(page.getByTestId("hub-tab-synthesis")).toBeVisible();

    // Scroll dans le panel Synthèse, la tab bar doit rester visible (sticky).
    await page.evaluate(() => {
      const scrollEl = document.querySelector(
        ".flex-1.overflow-y-auto.min-h-0",
      ) as HTMLElement | null;
      scrollEl?.scrollTo({ top: 2000 });
    });
    await page.waitForTimeout(300);
    await expect(page.getByTestId("hub-tab-synthesis")).toBeVisible();
    await expect(page.getByTestId("hub-tab-chat")).toBeVisible();
  });

  test("clic sur onglet Chat affiche la Timeline (empty state ou messages)", async ({
    page,
  }) => {
    const summaryId = await pickFirstSummaryId(page);
    if (summaryId === null) {
      test.skip(true, "test user has no analyses");
      return;
    }

    await page.goto(`/hub?summary=${summaryId}`);
    await page.click('[data-testid="hub-tab-chat"]');
    // Soit l'empty state visible (conv vide), soit au moins un message rendu.
    const empty = page.getByText(/posez votre première question/i);
    const anyBubble = page.locator('[data-testid^="hub-msg-"]').first();
    await expect(empty.or(anyBubble)).toBeVisible({ timeout: 5000 });
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
