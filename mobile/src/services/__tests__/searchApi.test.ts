/**
 * searchApi.test.ts — Phase 3 Mobile, Task 1
 *
 * Tests des nouvelles méthodes V1 de searchApi consommant les endpoints Phase 1 :
 *   - globalSearch       → POST /api/search/global
 *   - withinSearch       → POST /api/search/within/{summary_id}
 *   - getRecentQueries   → GET  /api/search/recent-queries
 *   - clearRecentQueries → DEL  /api/search/recent-queries
 *
 * Mocks identiques au pattern voiceApi.test.ts (fetch + storage + RetryService + TokenManager).
 */

// ═════════════════════════════════════════════════════════════════════════
// Mocks (avant l'import de api.ts)
// ═════════════════════════════════════════════════════════════════════════

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

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
  TIMEOUTS: { default: 30000, upload: 120000, analysis: 300000 },
  GOOGLE_CLIENT_ID: "x",
  GOOGLE_ANDROID_CLIENT_ID: "x",
  GOOGLE_IOS_CLIENT_ID: "x",
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
}));

jest.mock("../RetryService", () => ({
  withRetryPreset: (
    fn: () => Promise<unknown>,
    _preset: string,
    _endpoint: string,
  ) => fn(),
}));

jest.mock("../TokenManager", () => ({
  tokenManager: {
    getValidToken: jest.fn().mockResolvedValue("test-jwt"),
    getValidAccessToken: jest.fn().mockResolvedValue("test-jwt"),
  },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: { ios: unknown }) => obj.ios },
}));

import { searchApi } from "../api";

// ═════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════

function mockOkJson(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "content-type" ? "application/json" : null,
    },
  });
}

function getRequestUrl(callIndex = 0): string {
  return mockFetch.mock.calls[callIndex][0] as string;
}

function getRequestInit(callIndex = 0): RequestInit {
  return mockFetch.mock.calls[callIndex][1] as RequestInit;
}

function getRequestBody(callIndex = 0): Record<string, unknown> {
  const init = getRequestInit(callIndex);
  return JSON.parse(init.body as string);
}

// ═════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════

describe("searchApi V1 — Phase 3 mobile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("globalSearch", () => {
    it("envoie POST /api/search/global avec body complet", async () => {
      mockOkJson({
        query: "transition",
        total_results: 0,
        results: [],
        searched_at: "2026-05-03T10:00:00Z",
      });

      await searchApi.globalSearch({
        query: "transition",
        limit: 20,
        source_types: ["summary", "flashcard"],
      });

      expect(getRequestUrl()).toContain("/api/search/global");
      expect(getRequestInit().method).toBe("POST");
      const body = getRequestBody();
      expect(body.query).toBe("transition");
      expect(body.limit).toBe(20);
      expect(body.source_types).toEqual(["summary", "flashcard"]);
    });

    it("transmet les filtres optionnels (platform, favorites_only, date)", async () => {
      mockOkJson({
        query: "x",
        total_results: 0,
        results: [],
        searched_at: "",
      });

      await searchApi.globalSearch({
        query: "x",
        platform: "youtube",
        favorites_only: true,
        date_from: "2026-01-01",
      });

      const body = getRequestBody();
      expect(body.platform).toBe("youtube");
      expect(body.favorites_only).toBe(true);
      expect(body.date_from).toBe("2026-01-01");
    });
  });

  describe("withinSearch", () => {
    it("route correctement avec summary_id en path", async () => {
      mockOkJson({ summary_id: 42, query: "x", matches: [] });

      await searchApi.withinSearch(42, { query: "x" });

      expect(getRequestUrl()).toContain("/api/search/within/42");
      expect(getRequestInit().method).toBe("POST");
      expect(getRequestBody().query).toBe("x");
    });

    it("transmet source_types optionnel", async () => {
      mockOkJson({ summary_id: 7, query: "y", matches: [] });

      await searchApi.withinSearch(7, {
        query: "y",
        source_types: ["chat", "transcript"],
      });

      const body = getRequestBody();
      expect(body.source_types).toEqual(["chat", "transcript"]);
    });
  });

  describe("getRecentQueries", () => {
    it("fait GET /api/search/recent-queries et retourne queries", async () => {
      mockOkJson({ queries: ["a", "b", "c"] });

      const res = await searchApi.getRecentQueries();

      expect(getRequestUrl()).toContain("/api/search/recent-queries");
      // GET → no method explicit OR method="GET"
      const init = getRequestInit();
      expect(init.method === undefined || init.method === "GET").toBe(true);
      expect(res.queries).toEqual(["a", "b", "c"]);
    });
  });

  describe("clearRecentQueries", () => {
    it("fait DELETE /api/search/recent-queries", async () => {
      mockOkJson(null);

      await searchApi.clearRecentQueries();

      expect(getRequestUrl()).toContain("/api/search/recent-queries");
      expect(getRequestInit().method).toBe("DELETE");
    });
  });
});
