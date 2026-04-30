// frontend/e2e/hub-unified.spec.ts
import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: process.env.E2E_USER ?? "e2e@deepsight.test",
  password: process.env.E2E_PASS ?? "test1234",
};

test.describe("Hub unifié /hub", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
  });

  test("legacy /chat redirects to /hub", async ({ page }) => {
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/hub/);
  });

  test("legacy /voice-call redirects to /hub", async ({ page }) => {
    await page.goto("/voice-call");
    await expect(page).toHaveURL(/\/hub/);
  });

  test("hamburger opens conversations drawer", async ({ page }) => {
    await page.goto("/hub");
    await page.click('button[aria-label="Conversations"]');
    await expect(page.getByText("Conversations").first()).toBeVisible();
    // Close by clicking the backdrop
    await page.click('button[aria-label="fermer"]');
  });

  test("typing and pressing Enter sends a text message when a conversation is active", async ({
    page,
  }) => {
    await page.goto("/hub");
    // Open drawer + select first conv (assumes user has at least one analysis)
    await page.click('button[aria-label="Conversations"]');
    const firstConv = page.locator("aside button").nth(0);
    if (await firstConv.isVisible()) {
      await firstConv.click();
      await page.fill('input[placeholder*="question"]', "Test E2E hub message");
      await page.keyboard.press("Enter");
      await expect(page.getByText("Test E2E hub message")).toBeVisible();
    } else {
      test.skip(true, "no conversation available for test user");
    }
  });
});
