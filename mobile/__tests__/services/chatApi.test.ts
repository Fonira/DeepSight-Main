/**
 * Tests for chatApi.getHistory mapping (Task 1 — PR1 Quick Chat + Quick Call unified).
 * Verifies passthrough of voice timeline fields (source, voice_speaker,
 * voice_session_id, time_in_call_secs) from backend to mobile ChatMessage.
 */

// Mock dependencies BEFORE imports (mirror api.test.ts pattern)
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest
    .fn()
    .mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

jest.mock("../../src/services/RetryService", () => ({
  withRetryPreset: jest.fn(async (fn: () => Promise<any>) => fn()),
  withRetry: jest.fn(async (fn: () => Promise<any>) => fn()),
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
    getAccessToken: jest.fn().mockResolvedValue("test-token"),
    getRefreshToken: jest.fn().mockResolvedValue("test-refresh"),
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

import { chatApi } from "../../src/services/api";

const mockFetchResponse = (data: any, status = 200, ok = true) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: async () => data,
    headers: {
      get: (name: string) =>
        name === "content-type" ? "application/json" : null,
    },
  });
};

describe("chatApi.getHistory mapping (voice fields passthrough)", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it("preserves source/voice_speaker/voice_session_id/time_in_call_secs from backend response", async () => {
    mockFetchResponse({
      messages: [
        {
          id: 1,
          role: "user",
          content: "asked aloud",
          created_at: "2026-05-02T10:00:00Z",
          source: "voice",
          voice_speaker: "user",
          voice_session_id: "abc-123",
          time_in_call_secs: 1.2,
        },
        {
          id: 2,
          role: "assistant",
          content: "answered",
          created_at: "2026-05-02T10:00:05Z",
          source: "voice",
          voice_speaker: "agent",
          voice_session_id: "abc-123",
          time_in_call_secs: 6.5,
        },
        {
          id: 3,
          role: "user",
          content: "typed text",
          created_at: "2026-05-02T10:01:00Z",
          source: "text",
        },
      ],
    });

    const result = await chatApi.getHistory("123");

    expect(result.messages).toHaveLength(3);

    // Voice user message
    expect(result.messages[0].source).toBe("voice");
    expect(result.messages[0].voice_speaker).toBe("user");
    expect(result.messages[0].voice_session_id).toBe("abc-123");
    expect(result.messages[0].time_in_call_secs).toBe(1.2);

    // Voice agent message
    expect(result.messages[1].source).toBe("voice");
    expect(result.messages[1].voice_speaker).toBe("agent");
    expect(result.messages[1].voice_session_id).toBe("abc-123");
    expect(result.messages[1].time_in_call_secs).toBe(6.5);

    // Plain text message (source provided)
    expect(result.messages[2].source).toBe("text");
    expect(result.messages[2].voice_speaker).toBeUndefined();
  });

  it("handles legacy responses without voice fields (defaults to undefined)", async () => {
    mockFetchResponse({
      messages: [
        {
          id: 1,
          role: "user",
          content: "old message",
          created_at: "2026-05-02T10:00:00Z",
        },
      ],
    });

    const result = await chatApi.getHistory("123");

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].source).toBeUndefined();
    expect(result.messages[0].voice_speaker).toBeUndefined();
    expect(result.messages[0].voice_session_id).toBeUndefined();
    expect(result.messages[0].time_in_call_secs).toBeUndefined();
  });

  it("preserves id and timestamp mapping from numeric id + created_at", async () => {
    mockFetchResponse({
      messages: [
        {
          id: 42,
          role: "assistant",
          content: "hello",
          created_at: "2026-05-02T10:00:00Z",
        },
      ],
    });

    const result = await chatApi.getHistory("123");

    expect(result.messages[0].id).toBe("42");
    expect(result.messages[0].timestamp).toBe("2026-05-02T10:00:00Z");
    expect(result.messages[0].role).toBe("assistant");
  });
});
