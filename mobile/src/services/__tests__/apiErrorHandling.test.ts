/**
 * apiErrorHandling.test.ts — le client API mobile remonte un message lisible
 * quand le backend renvoie `detail` = {code, message} (au lieu de « [object Object] »).
 */

const mockFetch = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

jest.mock("../../utils/storage", () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue(null),
    getRefreshToken: jest.fn().mockResolvedValue(null),
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

jest.mock("../../constants/config", () => ({
  API_BASE_URL: "https://api.test.com",
  TIMEOUTS: { DEFAULT: 30000, ANALYSIS: 120000, PLAYLIST: 600000 },
  GOOGLE_CLIENT_ID: "x",
  GOOGLE_ANDROID_CLIENT_ID: "x",
  GOOGLE_IOS_CLIENT_ID: "x",
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
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

import { authApi, billingApi, ApiError } from "../api";

function mockJsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "content-type"
          ? "application/json"
          : (headers[key] ?? null),
    },
  });
}

describe("api.ts — erreurs avec detail objet", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("login d'un compte non admin : message private_mode lisible", async () => {
    mockJsonResponse(403, {
      detail: {
        code: "private_mode",
        message: "DeepSight est en accès privé pour le moment.",
      },
    });

    const error = await authApi
      .login("someone@example.com", "secret")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(403);
    expect(apiError.code).toBe("private_mode");
    expect(apiError.message).toBe("DeepSight est en accès privé pour le moment.");
    expect(apiError.message).not.toBe("[object Object]");
  });

  it("paiements indisponibles (503) : message et code lus dans detail", async () => {
    mockJsonResponse(503, {
      detail: {
        code: "payments_unavailable",
        message: "Les paiements sont temporairement indisponibles.",
      },
    });

    const error = (await billingApi
      .getPortalUrl()
      .catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(error.code).toBe("payments_unavailable");
    expect(error.message).toBe(
      "Les paiements sont temporairement indisponibles.",
    );
  });

  it("429 : message FR du backend et délai Retry-After exposé", async () => {
    mockJsonResponse(
      429,
      {
        detail: "Rate limit exceeded",
        retry_after: 9,
        message: "Trop de requêtes. Réessayez dans 9 secondes.",
      },
      { "Retry-After": "9" },
    );

    const error = (await authApi
      .login("admin@example.com", "secret")
      .catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(429);
    expect(error.message).toBe("Trop de requêtes. Réessayez dans 9 secondes.");
    expect(error.retryAfterMs).toBe(9000);
  });
});
