/**
 * requestRetryPolicy.test.ts — politique de relance appliquée par api.ts (RetryService réel) :
 *   - Quick Chat : timeout 120 s et aucun rejeu du POST (doublons dans l'historique) ;
 *   - /api/chat/ask (POST) jamais rejoué sur 503 ;
 *   - un GET est rejoué sur 503 sans code (redéploiement), pas sur 503 « payments_unavailable ».
 */

const mockFetch = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

jest.mock("../../utils/storage", () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue("test-jwt"),
    getRefreshToken: jest.fn().mockResolvedValue(null),
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

jest.mock("../../constants/config", () => ({
  API_BASE_URL: "https://api.test.com",
  TIMEOUTS: {
    DEFAULT: 30000,
    QUICK_CHAT: 120000,
    ANALYSIS: 120000,
    PLAYLIST: 600000,
  },
  GOOGLE_CLIENT_ID: "x",
  GOOGLE_ANDROID_CLIENT_ID: "x",
  GOOGLE_IOS_CLIENT_ID: "x",
}));

jest.mock("../TokenManager", () => ({
  tokenManager: { getValidToken: jest.fn().mockResolvedValue("test-jwt") },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: { ios: unknown }) => obj.ios },
}));

import { billingApi, chatApi, videoApi, ApiError } from "../api";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "content-type" ? "application/json" : null,
    },
  };
}

/** fetch qui ne répond jamais et rejette en AbortError quand le signal est annulé. */
function hangingFetch(_url: string, init?: RequestInit): Promise<never> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      reject(abortError);
    });
  });
}

describe("api.ts — politique de relance", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("Quick Chat attend 120 s et ne rejoue pas le POST après un timeout", async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation(hangingFetch);

    let settled = false;
    const result = videoApi
      .quickChat("https://www.youtube.com/watch?v=abc")
      .catch((e: unknown) => e)
      .finally(() => {
        settled = true;
      });

    await jest.advanceTimersByTimeAsync(30_000);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(90_500);
    const error = (await result) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("TIMEOUT");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("POST /api/chat/ask n'est pas rejoué sur 503", async () => {
    mockFetch.mockResolvedValue(jsonResponse(503, { detail: "Service unavailable" }));

    await expect(chatApi.sendMessage("42", "Bonjour ?")).rejects.toMatchObject({
      status: 503,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("GET : 503 sans corps exploitable rejoué, puis succès", async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(503, undefined))
      .mockResolvedValueOnce(
        jsonResponse(200, { task_id: "t1", status: "processing", progress: 10 }),
      );

    const promise = videoApi.getStatus("t1");
    await jest.advanceTimersByTimeAsync(1300);
    await expect(promise).resolves.toMatchObject({ status: "processing" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("GET : 503 payments_unavailable remonte tout de suite (pas de spinner de 8 s)", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(503, {
        detail: {
          code: "payments_unavailable",
          message: "Les paiements sont temporairement indisponibles.",
        },
      }),
    );

    await expect(billingApi.getPortalUrl()).rejects.toMatchObject({
      status: 503,
      code: "payments_unavailable",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
