/**
 * E2E — UTM tracking → PostHog → Stripe acquisition_channel flow
 *
 * Couvre la chaîne PR #413 (Stripe `acquisition_channel`) + PR #414
 * (PostHog server-side + UTM auto-capture). Critique pour le launch J0.
 *
 * Conventions reprises de `auth.spec.ts` :
 *   - selectors par `type=email` / `type=password` (pas de `data-testid`
 *     dans Login.tsx au moment de l'écriture)
 *   - mocks Playwright `page.route` pour intercepter `/api/auth/register`
 *
 * Limites connues (anti-faux-positif) :
 *   - Le test E2E `signup → register` n'attend PAS un succès backend, on
 *     vérifie UNIQUEMENT que le body POST contient les UTM. C'est volontaire :
 *     le but est de prouver que `utmCapture.ts` → `useAuth.register()` →
 *     `authApi.register()` chaîne propre. Le serveur PostHog event est testé
 *     en backend (pytest), PAS ici.
 *   - On ne vérifie pas l'event PostHog `signup_completed` server-side car
 *     PostHog est mocké côté client (`posthog-js` n'envoie rien en dev local
 *     sans `VITE_POSTHOG_KEY`).
 *   - Les selectors textuels FR/EN sont fragiles : si la copy change, ces
 *     tests cassent. Acceptable car le refactor majeur de Login.tsx est
 *     improbable avant J0.
 *
 * Run :
 *   cd frontend && npx playwright test utm-tracking
 *   # contre prod :
 *   cd frontend && BASE_URL=https://www.deepsightsynthesis.com npx playwright test utm-tracking
 */

import { test, expect, type Request } from "@playwright/test";

const STORAGE_KEY = "deepsight_utm_v1";

// Stub minimal `/api/auth/register` pour que le flow client ne crash pas
// (on capture la request avant fulfill).
async function mockRegisterEndpoint(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/register", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Verification email sent",
      }),
    });
  });
}

test.describe("UTM tracking — PR #413 + #414 launch J0", () => {
  test.beforeEach(async ({ context }) => {
    // Clear localStorage entre chaque test (state leak entre tests).
    // ⚠️ NE PAS utiliser `addInitScript` ici : il s'exécuterait à CHAQUE
    //    page.goto() et casserait le test #5 qui dépend de la persistance
    //    UTM entre `goto("/?utm_source=...")` et `goto("/login")`.
    // On clear via `context.clearCookies()` + un goto vide initial qui
    // reset le localStorage en domaine local.
    await context.clearCookies();
  });

  test("URL params utm_source=product_hunt + utm_medium + utm_campaign capturés en localStorage", async ({
    page,
  }) => {
    await page.goto(
      "/?utm_source=product_hunt&utm_medium=test_e2e&utm_campaign=verify_pr_414",
    );

    // Wait for AppProvider mount (utmCapture appelé dans useEffect initial)
    await page.waitForFunction(
      (key) => localStorage.getItem(key) !== null,
      STORAGE_KEY,
      { timeout: 5000 },
    );

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);

    expect(stored).not.toBeNull();
    expect(stored.utm_source).toBe("product_hunt");
    expect(stored.utm_medium).toBe("test_e2e");
    expect(stored.utm_campaign).toBe("verify_pr_414");
    expect(stored.capturedAt).toBeTruthy();
    expect(stored.landing_page).toBeTruthy();
  });

  test("TTL — capturedAt récent (<60s) et timestamp ISO valide", async ({
    page,
  }) => {
    const beforeMs = Date.now();
    await page.goto("/?utm_source=twitter");

    await page.waitForFunction(
      (key) => localStorage.getItem(key) !== null,
      STORAGE_KEY,
      { timeout: 5000 },
    );

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);

    expect(stored.utm_source).toBe("twitter");

    const capturedMs = new Date(stored.capturedAt).getTime();
    expect(Number.isNaN(capturedMs)).toBe(false);
    // Capturé après le goto et il y a moins de 60s
    expect(capturedMs).toBeGreaterThanOrEqual(beforeMs - 1000);
    expect(Date.now() - capturedMs).toBeLessThan(60_000);
  });

  test("Alias normalization — ?utm_source=ph → product_hunt", async ({
    page,
  }) => {
    // `KNOWN_SOURCES` map dans utmCapture.ts : "ph" → "product_hunt"
    await page.goto("/?utm_source=ph");

    await page.waitForFunction(
      (key) => localStorage.getItem(key) !== null,
      STORAGE_KEY,
      { timeout: 5000 },
    );

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);

    expect(stored.utm_source).toBe("product_hunt");
  });

  test("No UTM, no referrer → fallback 'direct'", async ({ page }) => {
    await page.goto("/");

    await page.waitForFunction(
      (key) => localStorage.getItem(key) !== null,
      STORAGE_KEY,
      { timeout: 5000 },
    );

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);

    // Selon `inferSourceFromReferrer`, en absence de tout signal le source
    // tombe sur "direct" (fallback explicite ligne 192 de utmCapture.ts).
    expect(stored.utm_source).toBe("direct");
  });

  test("Signup → POST /api/auth/register body contient signup_source + utm_source", async ({
    page,
  }) => {
    await mockRegisterEndpoint(page);

    // 1. Visite avec UTM
    await page.goto(
      "/?utm_source=reddit&utm_medium=launch_e2e&utm_campaign=verify_chain",
    );

    // Attendre que utmCapture ait écrit localStorage
    await page.waitForFunction(
      (key) => localStorage.getItem(key) !== null,
      STORAGE_KEY,
      { timeout: 5000 },
    );

    // 2. Aller sur la page Login avec onglet register pré-sélectionné
    //    (cf. Login.tsx ligne 92 : `?tab=register` switch isRegister=true)
    await page.goto("/login?tab=register");

    // 3. Remplir le formulaire register
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInputs = page.locator('input[type="password"]');

    await emailInput.fill(`e2e-utm-${Date.now()}@example.com`);
    // Premier password input = main, le second = confirmPassword (register)
    await passwordInputs.first().fill("TestE2E123!");
    await passwordInputs.nth(1).fill("TestE2E123!");

    // 4. Intercepter le POST register avant clic
    const requestPromise = page.waitForRequest(
      (req: Request) =>
        req.url().includes("/api/auth/register") && req.method() === "POST",
      { timeout: 10_000 },
    );

    // Submit (bouton type=submit du formulaire)
    await page.locator('button[type="submit"]').first().click();

    const request = await requestPromise;
    const postData = request.postDataJSON();

    expect(postData).toBeTruthy();
    expect(postData.email).toBeTruthy();
    expect(postData.password).toBeTruthy();
    // Contract PR #414 : signup_source + utm_* dans le body
    expect(postData.signup_source).toBe("reddit");
    expect(postData.utm_source).toBe("reddit");
    expect(postData.utm_medium).toBe("launch_e2e");
    expect(postData.utm_campaign).toBe("verify_chain");
  });
});
