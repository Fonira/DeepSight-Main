/**
 * playlistHistory.test.ts — conversion de /api/history/playlists (PlaylistSummaryItem).
 * Régression : le mobile lisait id/name/video_count/thumbnail_urls, absents du backend ;
 * `thumbnail_urls.slice` levait une TypeError et l'ErrorBoundary racine masquait l'app.
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

import { historyApi } from "../api";

describe("historyApi.getPlaylistHistory", () => {
  beforeEach(() => mockFetch.mockReset());

  it("convertit le format backend vers celui de la Bibliothèque", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        items: [
          {
            playlist_id: "PL123",
            playlist_title: "Cours de physique",
            playlist_url: "https://www.youtube.com/playlist?list=PL123",
            num_videos: 12,
            num_processed: 12,
            total_duration: 7200,
            total_words: 50000,
            status: "completed",
            has_meta_analysis: true,
            thumbnail_url: "https://api.deepsightsynthesis.com/api/thumbnails/abc.jpg",
            created_at: "2026-11-20T10:00:00Z",
            completed_at: "2026-11-20T10:30:00Z",
          },
          {
            playlist_id: "PL456",
            playlist_title: null,
            num_videos: 3,
            thumbnail_url: null,
            created_at: null,
          },
        ],
        total: 2,
        page: 1,
        per_page: 50,
        pages: 1,
      }),
    });

    const result = await historyApi.getPlaylistHistory(1, 50);

    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.test.com/api/history/playlists?page=1&per_page=50",
    );
    expect(result.items).toEqual([
      {
        id: "PL123",
        name: "Cours de physique",
        video_count: 12,
        created_at: "2026-11-20T10:00:00Z",
        thumbnail_urls: ["https://api.deepsightsynthesis.com/api/thumbnails/abc.jpg"],
      },
      {
        id: "PL456",
        name: "Playlist",
        video_count: 3,
        created_at: "",
        thumbnail_urls: [],
      },
    ]);
    // Le rendu de PlaylistSection appelle thumbnail_urls.slice : toujours un tableau
    result.items.forEach((item) => expect(Array.isArray(item.thumbnail_urls)).toBe(true));
    expect(result.hasMore).toBe(false);
  });
});
