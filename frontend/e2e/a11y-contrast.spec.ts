import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * E2E coverage for PR 4 of the readability refactor — locks in the contrast
 * quality from PR 1+2+3 (isolation + ambient routes + codemod text-white/X0).
 *
 * Public routes are scanned with axe-core for color-contrast violations.
 * Authenticated routes are skipped until an auth fixture is wired up.
 *
 * Réf spec : docs/superpowers/specs/2026-04-27-readability-refactor-design.md §6
 */

const PUBLIC_ROUTES = [
  { path: "/", name: "Landing" },
  { path: "/login", name: "Login" },
  { path: "/about", name: "About" },
];

const AUTH_ROUTES = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/history", name: "History" },
  { path: "/account", name: "MyAccount" },
  { path: "/admin", name: "Admin" },
  { path: "/upgrade", name: "Upgrade" },
];

for (const route of PUBLIC_ROUTES) {
  test(`${route.name} (${route.path}) — no critical/serious color-contrast violations`, async ({
    page,
  }) => {
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");
    // Wait for Framer Motion entrance animations to complete — otherwise
    // axe-core reads the "computed" color of elements still at opacity:0
    // and reports false-positive contrast violations.
    await page.waitForTimeout(1500);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2aa", "wcag2aaa"])
      .include("body")
      .analyze();

    const colorViolations = results.violations.filter(
      (v) =>
        v.id === "color-contrast" &&
        (v.impact === "critical" || v.impact === "serious"),
    );

    expect(
      colorViolations,
      `Violations:\n${JSON.stringify(
        colorViolations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          firstNode: v.nodes[0]?.html?.slice(0, 200),
        })),
        null,
        2,
      )}`,
    ).toEqual([]);
  });
}

for (const route of AUTH_ROUTES) {
  test(`${route.name} (${route.path}) — auth required, skip`, async () => {
    test.skip(true, "Requires auth fixture — TODO add login fixture");
  });
}
