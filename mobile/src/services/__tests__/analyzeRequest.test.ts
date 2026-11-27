/**
 * analyzeRequest.test.ts — le corps envoyé à /api/videos/analyze/hybrid respecte
 * HybridAnalyzeRequest : `lang` (pas `language`), aucun `model`, catégorie "auto" non envoyée.
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
  TIMEOUTS: { DEFAULT: 30000, QUICK_CHAT: 120000, ANALYSIS: 120000 },
  GOOGLE_CLIENT_ID: "x",
  GOOGLE_ANDROID_CLIENT_ID: "x",
  GOOGLE_IOS_CLIENT_ID: "x",
}));

jest.mock("../RetryService", () => ({
  withRetryPreset: (fn: () => Promise<unknown>) => fn(),
}));

jest.mock("../TokenManager", () => ({
  tokenManager: { getValidToken: jest.fn().mockResolvedValue("test-jwt") },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: { ios: unknown }) => obj.ios },
}));

import { videoApi } from "../api";

function sentBody(): Record<string, unknown> {
  const init = mockFetch.mock.calls[0][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("videoApi.analyze — contrat HybridAnalyzeRequest", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ task_id: "task-9" }),
      headers: { get: () => "application/json" },
    });
  });

  it("envoie `lang`, ni `language` ni `model`, et omet la catégorie auto", async () => {
    const result = await videoApi.analyze({
      url: "https://www.youtube.com/watch?v=abc",
      mode: "standard",
      category: "auto",
      language: "en",
    });

    expect(result.task_id).toBe("task-9");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.test.com/api/videos/analyze/hybrid",
    );
    expect(sentBody()).toEqual({
      url: "https://www.youtube.com/watch?v=abc",
      mode: "standard",
      lang: "en",
    });
  });

  it("transmet une catégorie imposée et deep_research", async () => {
    await videoApi.analyze({
      url: "https://youtu.be/xyz",
      mode: "expert",
      category: "science",
      language: "fr",
      deep_research: true,
    });

    expect(sentBody()).toEqual({
      url: "https://youtu.be/xyz",
      mode: "expert",
      lang: "fr",
      category: "science",
      deep_research: true,
    });
  });
});
