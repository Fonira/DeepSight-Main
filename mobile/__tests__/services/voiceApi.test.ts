/**
 * Tests for voiceApi.createSession with video_url (Quick Voice Call mobile V3).
 */

jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest
    .fn()
    .mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

jest.mock("../../src/services/RetryService", () => ({
  withRetryPreset: jest.fn(async (fn: () => Promise<unknown>) => fn()),
  withRetry: jest.fn(async (fn: () => Promise<unknown>) => fn()),
  RETRY_PRESETS: {
    standard: { maxRetries: 3, initialDelayMs: 1000 },
    patient: { maxRetries: 4, initialDelayMs: 2000 },
  },
  resetCircuitBreaker: jest.fn(),
}));

jest.mock("../../src/services/TokenManager", () => ({
  tokenManager: {
    getValidToken: jest.fn().mockResolvedValue("test-token"),
  },
}));

jest.mock("../../src/utils/storage", () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue("test-access-token"),
    getRefreshToken: jest.fn().mockResolvedValue("test-refresh-token"),
    setTokens: jest.fn().mockResolvedValue(undefined),
    clearTokens: jest.fn().mockResolvedValue(undefined),
    hasTokens: jest.fn().mockResolvedValue(true),
  },
  userStorage: {
    setUser: jest.fn().mockResolvedValue(undefined),
    getUser: jest.fn().mockResolvedValue(null),
    clearUser: jest.fn().mockResolvedValue(undefined),
  },
}));

import { voiceApi } from "../../src/services/api";

describe("voiceApi.createSession with video_url", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  test("posts video_url + agent_type=explorer_streaming + returns summary_id", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: "sess_1",
        agent_id: "agent_1",
        signed_url: "wss://elv/...",
        conversation_token: "lkjwt",
        expires_at: "2026-04-27T12:00:00Z",
        quota_remaining_minutes: 30,
        max_session_minutes: 30,
        summary_id: 99,
      }),
      headers: {
        get: (name: string) =>
          name === "content-type" ? "application/json" : null,
      },
    });

    const result = await voiceApi.createSession({
      video_url: "https://youtu.be/dQw4w9WgXcQ",
      agent_type: "explorer_streaming",
      language: "fr",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/voice/session"),
      expect.objectContaining({
        method: "POST",
      }),
    );
    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body,
    );
    expect(callBody.video_url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(callBody.agent_type).toBe("explorer_streaming");
    expect(result.summary_id).toBe(99);
  });

  test("auto-defaults agent_type=explorer_streaming when only video_url provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: "sess_2",
        agent_id: "agent_2",
        signed_url: "wss://elv/...",
        conversation_token: "lkjwt",
        expires_at: "2026-04-27T12:00:00Z",
        quota_remaining_minutes: 30,
        max_session_minutes: 30,
        summary_id: 100,
      }),
      headers: {
        get: (name: string) =>
          name === "content-type" ? "application/json" : null,
      },
    });

    await voiceApi.createSession({
      video_url: "https://youtu.be/abc12345678",
    });

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body,
    );
    expect(callBody.agent_type).toBe("explorer_streaming");
  });

  test("legacy positional createSession(id, lang) still works", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: "sess_3",
        agent_id: "agent_3",
        signed_url: "wss://elv/...",
        conversation_token: null,
        expires_at: "2026-04-27T12:00:00Z",
        quota_remaining_minutes: 30,
        max_session_minutes: 30,
      }),
      headers: {
        get: (name: string) =>
          name === "content-type" ? "application/json" : null,
      },
    });

    await voiceApi.createSession(42, "fr");

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body,
    );
    expect(callBody.summary_id).toBe(42);
    expect(callBody.agent_type).toBe("explorer");
  });
});
