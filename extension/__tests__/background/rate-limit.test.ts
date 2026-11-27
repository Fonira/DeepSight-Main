/** @jest-environment jsdom */
//
// Tests — gestion des 429 dans background.ts (apiRequest + login).
//
// L'API limite à 300 req/min par IP et 5/min sur /auth/login, avec
// `Retry-After`. Après une 429, le SW ne doit plus appeler le même endpoint
// avant l'échéance (sinon le polling du side panel bouclait sur des 429).

import {
  handleMessage,
  rateLimitKey,
  resetRateLimitsForTests,
} from "../../src/background";
import { resetChromeMocks, seedLocalStorage } from "../setup/chrome-api-mock";

type Res = {
  success?: boolean;
  error?: string;
  errorCode?: string;
  retryAfter?: number;
  status?: { status: string };
};

const mockFetch = jest.fn();

function tooManyRequests(retryAfter: string, body: unknown): unknown {
  return {
    ok: false,
    status: 429,
    headers: { get: (name: string) => (name === "Retry-After" ? retryAfter : null) },
    json: () => Promise.resolve(body),
  };
}

describe("429 handling", () => {
  const origFetch = global.fetch;
  let now = Date.parse("2026-11-27T10:00:00Z");

  beforeEach(() => {
    resetChromeMocks();
    resetRateLimitsForTests();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof global.fetch;
    now = Date.parse("2026-11-27T10:00:00Z");
    jest.spyOn(Date, "now").mockImplementation(() => now);
    seedLocalStorage({ accessToken: "test-token" });
  });

  afterEach(() => {
    global.fetch = origFetch;
    jest.restoreAllMocks();
  });

  it("keys cooldowns on the first two path segments", () => {
    expect(rateLimitKey("/videos/status/abc-123")).toBe("/videos/status");
    expect(rateLimitKey("/billing/my-plan?platform=extension")).toBe(
      "/billing/my-plan",
    );
  });

  it("returns rate_limited with Retry-After and skips the network until it expires", async () => {
    mockFetch.mockResolvedValueOnce(
      tooManyRequests("30", {
        detail: "Rate limit exceeded",
        retry_after: 30,
        message: "Trop de requêtes. Réessayez dans 30 secondes.",
      }),
    );

    const first = (await handleMessage({
      action: "GET_TASK_STATUS",
      data: { taskId: "t1" },
    })) as Res;
    expect(first).toMatchObject({
      success: false,
      errorCode: "rate_limited",
      retryAfter: 30,
      error: "Trop de requêtes. Réessayez dans 30 secondes.",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // 10 s plus tard : aucune requête, délai restant = 20 s.
    now += 10_000;
    const second = (await handleMessage({
      action: "GET_TASK_STATUS",
      data: { taskId: "t1" },
    })) as Res;
    expect(second).toMatchObject({
      success: false,
      errorCode: "rate_limited",
      retryAfter: 20,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Un autre endpoint n'est pas bloqué.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
    });
    await handleMessage({ action: "GET_USER" });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Après l'échéance, on rappelle l'API.
    now += 21_000;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "processing", progress: 10 }),
    });
    const third = (await handleMessage({
      action: "GET_TASK_STATUS",
      data: { taskId: "t1" },
    })) as Res;
    expect(third.success).toBe(true);
    expect(third.status?.status).toBe("processing");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("defaults to 60 s when the 429 carries no delay", async () => {
    mockFetch.mockResolvedValueOnce(
      tooManyRequests("", { detail: "Rate limit exceeded" }),
    );
    const res = (await handleMessage({
      action: "GET_TASK_STATUS",
      data: { taskId: "t1" },
    })) as Res;
    expect(res.retryAfter).toBe(60);
  });

  it("does not retry the login while the 5/min limit is active", async () => {
    mockFetch.mockResolvedValueOnce(
      tooManyRequests("45", {
        detail: "Rate limit exceeded",
        retry_after: 45,
        message: "Trop de requêtes. Réessayez dans 45 secondes.",
      }),
    );
    const login = { action: "LOGIN", data: { email: "a@b.c", password: "x" } };

    const first = (await handleMessage(
      login as Parameters<typeof handleMessage>[0],
    )) as Res;
    expect(first).toMatchObject({ errorCode: "rate_limited", retryAfter: 45 });

    const second = (await handleMessage(
      login as Parameters<typeof handleMessage>[0],
    )) as Res;
    expect(second).toMatchObject({ errorCode: "rate_limited" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
