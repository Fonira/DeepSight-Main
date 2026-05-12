/**
 * Tests unitaires — voiceApi.getCompanionContext (Coach Vocal Découverte)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

import { voiceApi, setTokens } from "../api";

describe("voiceApi.getCompanionContext", () => {
  it("calls GET /api/voice/companion-context with auth header", async () => {
    setTokens("access-tok", "refresh-tok");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        profile: {
          prenom: "Test",
          plan: "pro",
          langue: "fr",
          total_analyses: 0,
          recent_titles: [],
          themes: [],
          streak_days: 0,
          flashcards_due_today: 0,
        },
        initial_recos: [],
        cache_hit: false,
      }),
    });

    const promise = voiceApi.getCompanionContext();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(mockFetch).toHaveBeenCalled();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/voice/companion-context");
    expect(options.headers.Authorization).toBe("Bearer access-tok");
    expect(result.profile.plan).toBe("pro");
  });

  it("appends ?refresh=true when refresh option set", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        profile: {
          prenom: "X",
          plan: "pro",
          langue: "fr",
          total_analyses: 0,
          recent_titles: [],
          themes: [],
          streak_days: 0,
          flashcards_due_today: 0,
        },
        initial_recos: [],
        cache_hit: false,
      }),
    });

    const promise = voiceApi.getCompanionContext({ refresh: true });
    await vi.runAllTimersAsync();
    await promise;

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("refresh=true");
  });
});
