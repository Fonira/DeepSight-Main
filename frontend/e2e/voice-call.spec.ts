/**
 * E2E — Voice Call Page (Coach Vocal Découverte)
 *
 * Couvre 2 flows :
 *   1. Pro user → page personnalisée avec greeting "Salut <prenom>"
 *   2. Free/Plus user → Upgrade CTA
 *
 * Requires E2E_PRO_EMAIL / E2E_PRO_PASSWORD / E2E_FREE_EMAIL / E2E_FREE_PASSWORD
 * environment variables (or test users seeded by global-setup).
 */
import { test, expect } from "@playwright/test";

test.describe("Voice Call Page — /voice-call", () => {
  test("Pro user lands on /voice-call and sees personalized greeting", async ({
    page,
  }) => {
    const email = process.env.E2E_PRO_EMAIL;
    const password = process.env.E2E_PRO_PASSWORD;
    test.skip(!email || !password, "E2E_PRO_* env vars not set");

    await page.goto("/login");
    await page.fill('input[name="email"]', email!);
    await page.fill('input[name="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto("/voice-call");

    // Greeting is "Salut <prenom>" — match heading containing "Salut"
    const heading = page.locator("h1");
    await expect(heading).toContainText(/Salut/i, { timeout: 10_000 });

    // "Appeler" button is visible
    await expect(page.getByRole("button", { name: /Appeler/i })).toBeVisible();
  });

  test("Free user sees upgrade CTA on /voice-call", async ({ page }) => {
    const email = process.env.E2E_FREE_EMAIL;
    const password = process.env.E2E_FREE_PASSWORD;
    test.skip(!email || !password, "E2E_FREE_* env vars not set");

    await page.goto("/login");
    await page.fill('input[name="email"]', email!);
    await page.fill('input[name="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto("/voice-call");

    await expect(page.getByText(/Upgrade Pro/i)).toBeVisible();
    await expect(page.getByText(/réservé au plan Pro/i)).toBeVisible();
  });

  test("Sidebar item navigates to /voice-call", async ({ page }) => {
    const email = process.env.E2E_PRO_EMAIL;
    const password = process.env.E2E_PRO_PASSWORD;
    test.skip(!email || !password, "E2E_PRO_* env vars not set");

    await page.goto("/login");
    await page.fill('input[name="email"]', email!);
    await page.fill('input[name="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // Click Sidebar item
    await page.click('a[href="/voice-call"]');
    await page.waitForURL(/\/voice-call/);

    expect(page.url()).toContain("/voice-call");
  });
});
