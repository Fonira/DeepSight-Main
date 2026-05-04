/** @jest-environment jsdom */
//
// Tests — `SEARCH_GLOBAL` and `GET_RECENT_QUERIES` handlers in background.ts
//
// Phase 4 Semantic Search V1 (extension light tier). Backend Phase 1 mergée
// via PR #292. L'extension expose deux actions :
//
//  - SEARCH_GLOBAL → POST /api/search/global { query, limit, source_types? }
//  - GET_RECENT_QUERIES → GET /api/search/recent-queries
//
// Les deux passent par `apiRequest` (refresh JWT 401 géré par le helper) ;
// on mock global.fetch pour valider le wire-format et l'agrégation.

import { handleMessage } from "../../src/background";
import { resetChromeMocks, seedLocalStorage } from "../setup/chrome-api-mock";

describe("SEARCH_GLOBAL handler", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it("calls POST /search/global with the right body and forwards the response", async () => {
    seedLocalStorage({ accessToken: "test-token" });
    const fakeResults = {
      query: "transition énergétique",
      total_results: 2,
      results: [
        {
          source_type: "summary",
          source_id: 12,
          summary_id: 12,
          score: 0.91,
          text_preview: "…la transition énergétique impose…",
          source_metadata: { summary_title: "Crise EU", video_id: "abc" },
        },
        {
          source_type: "flashcard",
          source_id: 34,
          summary_id: 12,
          score: 0.87,
          text_preview: "Q: Quels objectifs pour la transition…",
          source_metadata: { summary_title: "Crise EU" },
        },
      ],
      searched_at: "2026-05-03T10:00:00Z",
    };

    const origFetch = global.fetch;
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(fakeResults),
    });
    global.fetch = mockFetch as unknown as typeof global.fetch;

    const res = await handleMessage({
      action: "SEARCH_GLOBAL",
      data: { query: "transition énergétique", limit: 10 },
    });

    expect(res.success).toBe(true);
    expect(res.searchResults).toEqual(fakeResults);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/search/global"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          query: "transition énergétique",
          limit: 10,
        }),
      }),
    );

    global.fetch = origFetch;
  });

  it("forwards source_types filter when provided", async () => {
    seedLocalStorage({ accessToken: "test-token" });
    const origFetch = global.fetch;
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          query: "ai",
          total_results: 0,
          results: [],
          searched_at: "2026-05-03T10:00:00Z",
        }),
    });
    global.fetch = mockFetch as unknown as typeof global.fetch;

    await handleMessage({
      action: "SEARCH_GLOBAL",
      data: { query: "ai", limit: 5, source_types: ["summary"] },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/search/global"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          query: "ai",
          limit: 5,
          source_types: ["summary"],
        }),
      }),
    );

    global.fetch = origFetch;
  });

  it("defaults to limit=10 when not provided", async () => {
    seedLocalStorage({ accessToken: "test-token" });
    const origFetch = global.fetch;
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          query: "x",
          total_results: 0,
          results: [],
          searched_at: "",
        }),
    });
    global.fetch = mockFetch as unknown as typeof global.fetch;

    await handleMessage({
      action: "SEARCH_GLOBAL",
      data: { query: "x" },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.limit).toBe(10);

    global.fetch = origFetch;
  });

  it("returns success:false with error message when fetch fails", async () => {
    seedLocalStorage({ accessToken: "test-token" });
    const origFetch = global.fetch;
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: "Server explosion" }),
    });
    global.fetch = mockFetch as unknown as typeof global.fetch;

    const res = await handleMessage({
      action: "SEARCH_GLOBAL",
      data: { query: "test" },
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Server explosion");

    global.fetch = origFetch;
  });
});

describe("GET_RECENT_QUERIES handler", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it("calls GET /search/recent-queries and returns the queries array", async () => {
    seedLocalStorage({ accessToken: "test-token" });
    const origFetch = global.fetch;
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ queries: ["énergie", "europe", "ia mistral"] }),
    });
    global.fetch = mockFetch as unknown as typeof global.fetch;

    const res = await handleMessage({
      action: "GET_RECENT_QUERIES",
    });

    expect(res.success).toBe(true);
    expect(res.recentQueries).toEqual(["énergie", "europe", "ia mistral"]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/search/recent-queries"),
      expect.objectContaining({}),
    );

    global.fetch = origFetch;
  });

  it("returns success:false on network error", async () => {
    seedLocalStorage({ accessToken: "test-token" });
    const origFetch = global.fetch;
    const mockFetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    global.fetch = mockFetch as unknown as typeof global.fetch;

    const res = await handleMessage({
      action: "GET_RECENT_QUERIES",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("ECONNREFUSED");

    global.fetch = origFetch;
  });
});
