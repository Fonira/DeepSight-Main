/**
 * tutorApi.test.ts — les champs du démarrage du Tuteur respectent les limites du
 * schéma backend (concept_term ≤ 200, source_video_title ≤ 300) : un titre TikTok
 * de 255 caractères provoquait un 422.
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

import { TUTOR_LIMITS, truncateForApi, tutorApi } from "../api";

function sentBody(): Record<string, unknown> {
  const init = mockFetch.mock.calls[0][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("tutorApi.sessionStart", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ session_id: "s1", first_prompt: "Bonjour", audio_url: null }),
    });
  });

  it("tronque un titre trop long pour le schéma backend", async () => {
    const longTitle = "T".repeat(255);
    await tutorApi.sessionStart({
      concept_term: longTitle,
      concept_def: "",
      summary_id: 3,
      source_video_title: "S".repeat(400),
      mode: "text",
      lang: "fr",
    });

    const body = sentBody();
    expect(Array.from(body.concept_term as string)).toHaveLength(TUTOR_LIMITS.conceptTerm);
    expect((body.concept_term as string).endsWith("…")).toBe(true);
    expect(Array.from(body.source_video_title as string)).toHaveLength(
      TUTOR_LIMITS.sourceVideoTitle,
    );
  });

  it("laisse intactes les valeurs courtes", async () => {
    await tutorApi.sessionStart({
      concept_term: "Photosynthèse",
      concept_def: "Conversion de la lumière",
      mode: "text",
      lang: "fr",
    });
    expect(sentBody()).toMatchObject({
      concept_term: "Photosynthèse",
      concept_def: "Conversion de la lumière",
    });
  });
});

describe("truncateForApi", () => {
  it("ne coupe pas un emoji en deux", () => {
    const text = `${"a".repeat(198)}😀😀😀`;
    const truncated = truncateForApi(text, 200);
    expect(Array.from(truncated)).toHaveLength(200);
    expect(truncated).toBe(`${"a".repeat(198)}😀…`);
  });
});
