import { test, expect } from "@playwright/test";

/**
 * E2E coverage for Tasks 6+7 of the readability refactor — verifies that:
 *   1. `<main>` containers receive `isolation: isolate` to close the
 *      mix-blend-mode context of AmbientLightLayer (no text bleed-through).
 *   2. The Sidebar `<aside>` exposes `data-sidebar` and is also isolated.
 *
 * The /contact route is public and renders a `<main>` element, so it is
 * the safest target for the first test (no auth fixture required).
 *
 * The sidebar test targets the DashboardLayout, which requires an
 * authenticated session. It is skipped here and covered by component tests.
 * It can be re-enabled once an auth fixture is wired up.
 */
test.describe("isolation: isolate (readability refactor)", () => {
  test("main element has isolation: isolate", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    const mainEl = page.locator("main, [role='main']").first();
    await expect(mainEl).toHaveCSS("isolation", "isolate");
  });

  test.skip("sidebar has isolation: isolate and data-sidebar attribute", async ({
    page,
  }) => {
    // Skipped: requires authenticated session to render DashboardLayout.
    // Covered by component tests — re-enable when an auth fixture is wired.
    await page.goto("/dashboard");
    await page.waitForSelector("aside[data-sidebar]", { timeout: 5000 });
    const sidebar = page.locator("aside[data-sidebar]").first();
    await expect(sidebar).toHaveCSS("isolation", "isolate");
  });
});
