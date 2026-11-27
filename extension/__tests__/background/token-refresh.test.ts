/** @jest-environment jsdom */
//
// Tests — refresh proactif de l'access token (background.ts).
//
// Depuis le Sprint C, l'access token vit 60 min (refresh 30 j). L'ancienne
// logique supposait 7 jours et ne rafraîchissait qu'au bout de 24 h : chaque
// requête après l'expiration partait vouée au 401, et GET_AUTH_TOKEN
// (EventSource du contexte voice) renvoyait un token expiré.

import { handleMessage, resetRateLimitsForTests } from "../../src/background";
import { resetChromeMocks, seedLocalStorage } from "../setup/chrome-api-mock";
import { makeJwt } from "../helpers/makeJwt";

const mockFetch = jest.fn();

function ok(body: unknown): unknown {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function authHeader(callIndex: number): string | undefined {
  const init = mockFetch.mock.calls[callIndex][1] as RequestInit;
  return (init.headers as Record<string, string>)?.Authorization;
}

describe("proactive access-token refresh", () => {
  const origFetch = global.fetch;
  const nowSec = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    resetChromeMocks();
    resetRateLimitsForTests();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  afterAll(() => {
    global.fetch = origFetch;
  });

  it("refreshes a token that expires within a minute before calling the API", async () => {
    const expiring = makeJwt({ sub: "1", exp: nowSec + 30 });
    const fresh = makeJwt({ sub: "1", exp: nowSec + 3600 });
    seedLocalStorage({ accessToken: expiring, refreshToken: "refresh-1" });

    mockFetch
      .mockResolvedValueOnce(
        ok({ access_token: fresh, refresh_token: "refresh-2", user: { id: 1 } }),
      )
      .mockResolvedValueOnce(ok({ task_id: "task-1" }));

    const res = (await handleMessage({
      action: "START_ANALYSIS",
      data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", options: {} },
    })) as { success: boolean };

    expect(res.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain("/auth/refresh");
    expect(mockFetch.mock.calls[1][0]).toContain("/videos/analyze");
    expect(authHeader(1)).toBe(`Bearer ${fresh}`);
  });

  it("does not refresh a token that is still valid for a while", async () => {
    const valid = makeJwt({ sub: "1", exp: nowSec + 50 * 60 });
    seedLocalStorage({ accessToken: valid, refreshToken: "refresh-1" });
    mockFetch.mockResolvedValueOnce(ok({ status: "processing", progress: 5 }));

    await handleMessage({ action: "GET_TASK_STATUS", data: { taskId: "t" } });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("/videos/status/t");
    expect(authHeader(0)).toBe(`Bearer ${valid}`);
  });

  it("GET_AUTH_TOKEN returns a refreshed token instead of an expired one", async () => {
    const expired = makeJwt({ sub: "1", exp: nowSec - 10 });
    const fresh = makeJwt({ sub: "1", exp: nowSec + 3600 });
    seedLocalStorage({ accessToken: expired, refreshToken: "refresh-1" });
    mockFetch.mockResolvedValueOnce(
      ok({ access_token: fresh, refresh_token: "refresh-2", user: { id: 1 } }),
    );

    const res = (await handleMessage({ action: "GET_AUTH_TOKEN" })) as {
      success: boolean;
      result: { token: string };
    };

    expect(res.success).toBe(true);
    expect(res.result.token).toBe(fresh);
  });

  it("GET_AUTH_TOKEN reports auth_required without a session", async () => {
    const res = (await handleMessage({ action: "GET_AUTH_TOKEN" })) as {
      success: boolean;
      errorCode: string;
    };
    expect(res).toMatchObject({ success: false, errorCode: "auth_required" });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
