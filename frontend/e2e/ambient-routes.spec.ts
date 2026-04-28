import { test, expect } from "@playwright/test";

/**
 * E2E coverage for Tasks 9+10+11 of the readability refactor — verifies that:
 *   1. AmbientLightLayer is mounted on showcase routes (acquisition).
 *   2. AmbientLightLayer is absent on dense work routes (where readability
 *      prevails over aesthetics).
 *
 * The dense work routes (/dashboard, /history, /account, etc.) are protected
 * routes that redirect to /login when the user is not authenticated. Without
 * an auth fixture we cannot directly verify that ambient is absent on those
 * routes; the redirection itself sends the user to /login (where ambient IS
 * expected). Those checks are skipped here and covered by component tests.
 *
 * The crucial guarantee verified here is: ambient IS present on Landing /
 * Login / Legal — the showcase routes.
 *
 * Réf spec : docs/superpowers/specs/2026-04-27-readability-refactor-design.md §5
 */

const AMBIENT_ROUTES = ["/", "/login", "/legal"];
const NO_AMBIENT_ROUTES = [
  "/dashboard",
  "/history",
  "/account",
  "/admin",
  "/upgrade",
];

test.describe("AmbientLight router-aware allowlist", () => {
  for (const route of AMBIENT_ROUTES) {
    test(`AmbientLight present on ${route}`, async ({ page }) => {
      test.setTimeout(60000);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-ambient="layer"]')).toHaveCount(1);
    });
  }

  for (const route of NO_AMBIENT_ROUTES) {
    test.skip(`AmbientLight absent on ${route}`, async () => {
      // Skipped: protected routes redirect to /login when unauthenticated, so
      // we cannot verify the absence directly without an auth fixture. Covered
      // by component / integration tests where the route can be exercised.
    });
  }
});
