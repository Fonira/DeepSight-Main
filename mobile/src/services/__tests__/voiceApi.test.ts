/**
 * voiceApi.test.ts — Spec #3
 *
 * Tests de la signature étendue de voiceApi.createSession :
 *   - summary_id optionnel
 *   - agent_type paramétrable (explorer | companion | debate_moderator)
 *   - language optionnel (default "fr")
 *
 * Tests de voiceApi.appendTranscript pour la sync bidir transcripts.
 *
 * On mocke `fetch` et toutes les couches d'auth/retry pour pouvoir
 * inspecter les payloads envoyés sur les endpoints `/api/voice/*`.
 */

// ═════════════════════════════════════════════════════════════════════════
// Mocks (avant l'import de api.ts)
// ═════════════════════════════════════════════════════════════════════════

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Mock storage (chemin réel : ../utils/storage)
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
  withRetryPreset: (fn: () => Promise<unknown>, _preset: string, _endpoint: string) =>
    fn(),
}));

jest.mock("../TokenManager", () => ({
  tokenManager: {
    getValidToken: jest.fn().mockResolvedValue("test-jwt"),
    getValidAccessToken: jest.fn().mockResolvedValue("test-jwt"),
  },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: any) => obj.ios },
}));

import { voiceApi } from "../api";

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
      get: (k: string) => (k.toLowerCase() === "content-type" ? "application/json" : null),
    },
  } as any);
}

function getRequestBody(callIndex = 0): Record<string, unknown> {
  const init = mockFetch.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(init.body as string);
}

function getRequestUrl(callIndex = 0): string {
  return mockFetch.mock.calls[callIndex][0] as string;
}

// ═════════════════════════════════════════════════════════════════════════
// Tests — createSession
// ═════════════════════════════════════════════════════════════════════════

describe("voiceApi.createSession — Spec #3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const SESSION_BODY = {
    session_id: "s1",
    signed_url: "wss://x",
    agent_id: "a1",
    conversation_token: "jwt",
    expires_at: "2026-01-01",
    quota_remaining_minutes: 30,
    max_session_minutes: 5,
  };

  it("envoie summary_id + agent_type=explorer + language=fr (mode video)", async () => {
    mockOkJson(SESSION_BODY);

    await voiceApi.createSession({
      summary_id: 42,
      agent_type: "explorer",
      language: "fr",
    });

    expect(getRequestUrl()).toContain("/api/voice/session");
    expect(getRequestBody()).toEqual({
      summary_id: 42,
      agent_type: "explorer",
      language: "fr",
    });
  });

  it("envoie sans summary_id quand agent_type=companion (mode chat libre)", async () => {
    mockOkJson(SESSION_BODY);

    await voiceApi.createSession({
      agent_type: "companion",
      language: "fr",
    });

    const body = getRequestBody();
    expect(body).toEqual({ agent_type: "companion", language: "fr" });
    expect(body).not.toHaveProperty("summary_id");
  });

  it("ne sérialise pas summary_id si valeur undefined", async () => {
    mockOkJson(SESSION_BODY);

    await voiceApi.createSession({
      summary_id: undefined,
      agent_type: "companion",
    });

    expect(getRequestBody().summary_id).toBeUndefined();
  });

  it("ne sérialise pas summary_id si valeur null", async () => {
    mockOkJson(SESSION_BODY);

    await voiceApi.createSession({
      summary_id: null as unknown as undefined,
      agent_type: "companion",
    });

    expect(getRequestBody().summary_id).toBeUndefined();
  });

  it("default agent_type = explorer si summary_id présent", async () => {
    mockOkJson(SESSION_BODY);

    await voiceApi.createSession({ summary_id: 7 });

    expect(getRequestBody().agent_type).toBe("explorer");
  });

  it("default agent_type = companion si pas de summary_id", async () => {
    mockOkJson(SESSION_BODY);

    await voiceApi.createSession({});

    expect(getRequestBody().agent_type).toBe("companion");
  });

  it("default language = fr", async () => {
    mockOkJson(SESSION_BODY);

    await voiceApi.createSession({ summary_id: 1 });

    expect(getRequestBody().language).toBe("fr");
  });

  it("rétro-compat : signature positionnelle (summaryId, language)", async () => {
    mockOkJson(SESSION_BODY);

    await voiceApi.createSession(42, "en");

    expect(getRequestBody()).toEqual({
      summary_id: 42,
      agent_type: "explorer",
      language: "en",
    });
  });

  it("rétro-compat : positionnelle sans language → fr par défaut", async () => {
    mockOkJson(SESSION_BODY);

    await voiceApi.createSession(99);

    expect(getRequestBody().language).toBe("fr");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Tests — appendTranscript
// ═════════════════════════════════════════════════════════════════════════

describe("voiceApi.appendTranscript — Spec #3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /api/voice/transcripts/append avec payload conforme", async () => {
    mockOkJson({ ok: true });

    await voiceApi.appendTranscript({
      voice_session_id: "sess_abc",
      speaker: "user",
      content: "Bonjour",
      time_in_call_secs: 2.5,
    });

    expect(getRequestUrl()).toContain("/api/voice/transcripts/append");
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(getRequestBody()).toEqual({
      voice_session_id: "sess_abc",
      speaker: "user",
      content: "Bonjour",
      time_in_call_secs: 2.5,
    });
  });

  it("supporte speaker=agent", async () => {
    mockOkJson({ ok: true });

    await voiceApi.appendTranscript({
      voice_session_id: "sess_abc",
      speaker: "agent",
      content: "Réponse IA",
      time_in_call_secs: 5,
    });

    expect(getRequestBody().speaker).toBe("agent");
  });
});
