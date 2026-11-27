/**
 * tokenRefresh.test.ts — une erreur passagère pendant le refresh (429, 5xx, réseau)
 * ne doit ni purger les jetons ni produire un 401 SESSION_EXPIRED (qui déconnecte).
 */

const mockFetch = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

const mockClearTokens = jest.fn();
const mockSetTokens = jest.fn();

jest.mock("../../utils/storage", () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue("expired-access"),
    getRefreshToken: jest.fn().mockResolvedValue("refresh-123"),
    setTokens: (...args: unknown[]) => mockSetTokens(...args),
    clearTokens: (...args: unknown[]) => mockClearTokens(...args),
  },
}));

jest.mock("../../constants/config", () => ({
  API_BASE_URL: "https://api.test.com",
  TIMEOUTS: { DEFAULT: 30000, QUICK_CHAT: 120000, ANALYSIS: 120000 },
  GOOGLE_CLIENT_ID: "x",
  GOOGLE_ANDROID_CLIENT_ID: "x",
  GOOGLE_IOS_CLIENT_ID: "x",
}));

jest.mock("../RetryService", () => ({
  withRetryPreset: (fn: () => Promise<unknown>) => fn(),
}));

jest.mock("../TokenManager", () => ({
  tokenManager: { getValidToken: jest.fn().mockResolvedValue(null) },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: { ios: unknown }) => obj.ios },
}));

import { authApi, ApiError } from "../api";

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "content-type"
          ? "application/json"
          : (headers[key] ?? null),
    },
  };
}

const unauthorized = () =>
  response(401, {
    detail: { code: "not_authenticated", message: "Authentication required." },
  });

describe("refresh du jeton sur 401", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockClearTokens.mockReset();
    mockSetTokens.mockReset();
  });

  it("refresh en 502 : jetons conservés, erreur non 401", async () => {
    mockFetch
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(response(502, undefined));

    const error = (await authApi.getMe().catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.code).not.toBe("SESSION_EXPIRED");
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it("refresh en 429 : jetons conservés, délai Retry-After transmis", async () => {
    mockFetch.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(
      response(
        429,
        { detail: "Rate limit exceeded", message: "Trop de requêtes.", retry_after: 5 },
        { "Retry-After": "5" },
      ),
    );

    const error = (await authApi.getMe().catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(429);
    expect(error.retryAfterMs).toBe(5000);
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it("refresh sans réseau : jetons conservés, NETWORK_ERROR", async () => {
    mockFetch
      .mockResolvedValueOnce(unauthorized())
      .mockRejectedValueOnce(new TypeError("Network request failed"));

    const error = (await authApi.getMe().catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(0);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it("refresh refusé (401) : jetons purgés et SESSION_EXPIRED", async () => {
    mockFetch
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(response(401, { detail: "Invalid refresh token" }));

    const error = (await authApi.getMe().catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(401);
    expect(error.code).toBe("SESSION_EXPIRED");
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });

  it("401 simultanés : un seul appel à /api/auth/refresh", async () => {
    const refreshCalls: string[] = [];
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/refresh")) {
        refreshCalls.push(url);
        return response(200, { access_token: "new-access", refresh_token: "new-refresh" });
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return auth === "Bearer new-access"
        ? response(200, { id: 1, email: "admin@example.com", plan: "unlimited" })
        : unauthorized();
    });

    await Promise.all([authApi.getMe(), authApi.getMe(), authApi.getMe()]);

    expect(refreshCalls).toHaveLength(1);
    expect(mockSetTokens).toHaveBeenCalledWith("new-access", "new-refresh");
    expect(mockClearTokens).not.toHaveBeenCalled();
  });
});
