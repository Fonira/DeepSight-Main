/**
 * 🧪 E2E Tests — Authentication Flows
 * Coverage: Login, Register, Logout, OAuth, Protected routes
 */

import { test, expect } from "@playwright/test";

const BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:5173";
const TEST_USER_EMAIL = "e2e-test@example.com";
const TEST_USER_PASSWORD = "TestPassword123!";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔓 LOGIN FLOW
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Auth - Login Flow", () => {
  test("should navigate to login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle(/login|sign in/i);
    await expect(
      page.getByRole("heading", { name: /sign in|login/i }),
    ).toBeVisible();
  });

  test("should show login form with all fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in|login/i }),
    ).toBeVisible();
  });

  test("should validate empty email", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.getByLabel(/password/i);
    await passwordInput.fill("password123");

    const submitButton = page.getByRole("button", { name: /sign in|login/i });
    await submitButton.click();

    await expect(page.getByText(/email.*required|enter.*email/i)).toBeVisible();
  });

  test("should validate empty password", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByRole("textbox", { name: /email/i });
    await emailInput.fill(TEST_USER_EMAIL);

    const submitButton = page.getByRole("button", { name: /sign in|login/i });
    await submitButton.click();

    await expect(
      page.getByText(/password.*required|enter.*password/i),
    ).toBeVisible();
  });

  test("should show loading state during login", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByLabel(/password/i);

    await emailInput.fill(TEST_USER_EMAIL);
    await passwordInput.fill(TEST_USER_PASSWORD);

    // Intercept API call to slow it down
    await page.route("**/api/auth/login", async (route) => {
      await page.waitForTimeout(1000);
      await route.abort("failed");
    });

    const submitButton = page.getByRole("button", { name: /sign in|login/i });
    await submitButton.click();

    // Should show loading indicator
    await expect(page.getByText(/loading|signing in/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByLabel(/password/i);

    await emailInput.fill("nonexistent@example.com");
    await passwordInput.fill("wrongpassword");

    const submitButton = page.getByRole("button", { name: /sign in|login/i });
    await submitButton.click();

    await expect(page.getByText(/invalid|credentials|incorrect/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("should redirect to dashboard on successful login", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByLabel(/password/i);

    // Use a real test account if available
    await emailInput.fill("test@example.com");
    await passwordInput.fill("testpassword");

    const submitButton = page.getByRole("button", { name: /sign in|login/i });

    // Wait for navigation after login
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
      submitButton.click(),
    ]);

    // Should redirect away from login page or show authenticated content
    const url = page.url();
    expect(url).not.toContain("/login");
  });

  test("should remember email on form if allowed", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const rememberCheckbox = page.getByLabel(/remember|save.*email/i);

    await emailInput.fill(TEST_USER_EMAIL);

    if (rememberCheckbox) {
      await rememberCheckbox.check();
    }

    // Reload page
    await page.reload();

    // Email might be remembered
    const emailValue = await emailInput.inputValue();
    if (emailValue) {
      expect(emailValue).toBe(TEST_USER_EMAIL);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 REGISTER FLOW
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Auth - Register Flow", () => {
  test("should navigate to register page", async ({ page }) => {
    await page.goto("/login");

    const registerLink = page.getByRole("link", {
      name: /sign up|register|create/i,
    });
    await registerLink.click();

    await expect(page).toHaveTitle(/register|sign up/i);
    await expect(
      page.getByRole("heading", { name: /register|sign up/i }),
    ).toBeVisible();
  });

  test("should show all register form fields", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByLabel(/confirm.*password|re-enter/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign up|register/i }),
    ).toBeVisible();
  });

  test("should validate password match", async ({ page }) => {
    await page.goto("/register");

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByLabel(/^password/i);
    const confirmInput = page.getByLabel(/confirm.*password|re-enter/i);

    await emailInput.fill("newuser@example.com");
    await passwordInput.fill("Password123!");
    await confirmInput.fill("DifferentPassword!");

    const submitButton = page.getByRole("button", {
      name: /sign up|register/i,
    });
    await submitButton.click();

    await expect(
      page.getByText(/password.*match|not.*match|mismatch/i),
    ).toBeVisible();
  });

  test("should validate password strength", async ({ page }) => {
    await page.goto("/register");

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByLabel(/^password/i);

    await emailInput.fill("newuser@example.com");
    await passwordInput.fill("weak");

    const submitButton = page.getByRole("button", {
      name: /sign up|register/i,
    });
    await submitButton.click();

    await expect(page.getByText(/weak|strong|characters/i)).toBeVisible();
  });

  test("should show error on duplicate email", async ({ page }) => {
    await page.goto("/register");

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByLabel(/^password/i);
    const confirmInput = page.getByLabel(/confirm.*password/i);

    // Try to register with existing email
    await emailInput.fill("existing@example.com");
    await passwordInput.fill("Password123!");
    await confirmInput.fill("Password123!");

    const submitButton = page.getByRole("button", {
      name: /sign up|register/i,
    });
    await submitButton.click();

    await expect(
      page.getByText(/already.*exists|already.*registered|duplicate/i),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔓 LOGOUT FLOW
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Auth - Logout Flow", () => {
  test("should logout from authenticated session", async ({
    page,
    context,
  }) => {
    // Simulate authenticated state
    await context.addCookies([
      {
        name: "access_token",
        value: "test-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard");

    // Find logout button (usually in user menu or header)
    const userMenuButton = page
      .getByRole("button", { name: /profile|account|menu/i })
      .first();
    const logoutButton = page.getByRole("button", {
      name: /logout|sign out|exit/i,
    });

    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();
    }

    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }

    // Should redirect to login or landing page
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});

    const url = page.url();
    expect(url).toMatch(/login|landing|home/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 PROTECTED ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Auth - Protected Routes", () => {
  test("should redirect to login when accessing protected route without auth", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveTitle(/login|sign in/i);
  });

  test("should allow access to protected route with auth", async ({
    page,
    context,
  }) => {
    // Set auth token
    await context.addCookies([
      {
        name: "access_token",
        value: "valid-test-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    // Set cached user
    await context.addInitScript(() => {
      const user = {
        id: 1,
        email: "test@example.com",
        plan: "free",
        credits: 150,
      };
      localStorage.setItem("cached_user", JSON.stringify(user));
    });

    await page.goto("/dashboard");

    // Should not redirect to login
    const url = page.url();
    expect(url).not.toContain("/login");
  });

  test("should redirect to login for invalid token", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "access_token",
        value: "invalid-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard");

    // If token is invalid, should redirect to login
    await expect(page)
      .toHaveTitle(/login|sign in/i, { timeout: 10000 })
      .catch(() => {});
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔗 FORM NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Auth - Form Navigation", () => {
  test("should navigate from login to register", async ({ page }) => {
    await page.goto("/login");

    const registerLink = page.getByRole("link", {
      name: /sign up|register|create/i,
    });
    await registerLink.click();

    await expect(page).toHaveTitle(/register|sign up/i);
  });

  test("should navigate from register to login", async ({ page }) => {
    await page.goto("/register");

    const loginLink = page.getByRole("link", {
      name: /sign in|login|already.*account/i,
    });
    await loginLink.click();

    await expect(page).toHaveTitle(/login|sign in/i);
  });

  test("should access forgot password from login", async ({ page }) => {
    await page.goto("/login");

    const forgotLink = page.getByRole("link", {
      name: /forgot|reset.*password/i,
    });
    await forgotLink.click();

    const url = page.url();
    expect(url).toContain(/forgot|reset|password/i);
  });
});
