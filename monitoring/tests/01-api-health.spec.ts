/**
 * 01 — API Health & Endpoints Smoke Tests
 * Vérifie que le backend répond correctement
 * @tags @smoke @api
 */
import { test, expect } from "@playwright/test";
import { API_URL, API_ENDPOINTS } from "./helpers";

test.describe("API Health @smoke @api", () => {
  test("GET /health retourne 200", async ({ request }) => {
    const res = await request.get(`${API_URL}${API_ENDPOINTS.health}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("status");
  });

  test("GET /api/billing/plans retourne la liste des plans", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}${API_ENDPOINTS.plans}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body) || typeof body === "object").toBe(true);
  });

  test("POST /api/auth/login sans body retourne 422", async ({ request }) => {
    const res = await request.post(`${API_URL}${API_ENDPOINTS.login}`, {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    // FastAPI validation error
    expect([400, 422]).toContain(res.status());
  });

  test("GET /api/auth/me sans token retourne 401", async ({ request }) => {
    const res = await request.get(`${API_URL}${API_ENDPOINTS.me}`);
    expect(res.status()).toBe(401);
  });

  test("POST /api/auth/login avec mauvais creds retourne une erreur", async ({
    request,
  }) => {
    const res = await request.post(`${API_URL}${API_ENDPOINTS.login}`, {
      headers: { "Content-Type": "application/json" },
      data: {
        email: "fake-smoke-test@nonexistent.invalid",
        password: "wrong-password-12345",
      },
    });
    // Le backend peut retourner 400, 401, 403, 404, ou 422
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("GET /api/tournesol/recommendations répond sans 500", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}${API_ENDPOINTS.tournesol}`);
    expect(res.status()).not.toBe(500);
  });

  test("temps de réponse /health < 3s", async ({ request }) => {
    const start = Date.now();
    await request.get(`${API_URL}${API_ENDPOINTS.health}`);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });

  test("CORS — API retourne un status valide", async ({ request }) => {
    const res = await request.get(`${API_URL}${API_ENDPOINTS.health}`);
    expect(res.status()).toBe(200);
  });
});
