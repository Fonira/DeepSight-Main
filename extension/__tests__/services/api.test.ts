/**
 * Tests — Background script API client (message handler)
 * Fichier source : src/background.ts
 *
 * On teste handleMessage indirectement via le listener chrome.runtime.onMessage
 * car handleMessage n'est pas exporté. On simule via le pattern sendMessage mockée.
 */

import { resetChromeMocks, seedLocalStorage } from "../setup/chrome-api-mock";

// Mock fetch globally
const mockFetch = jest.fn();
(global as unknown as Record<string, unknown>).fetch = mockFetch;

// We need to capture the handleMessage function from background.ts
// Since it registers via chrome.runtime.onMessage.addListener, we capture it
let handleMessage: (message: {
  action: string;
  data?: Record<string, unknown>;
}) => Promise<unknown>;

beforeAll(() => {
  // Import background.ts which registers the listener
  // The chrome-api-mock is already set up via setupFiles
  const onMessageAddListener = chrome.runtime.onMessage
    .addListener as jest.Mock;

  // Reset to capture the listener
  onMessageAddListener.mockClear();

  // Import to trigger registration
  require("../../src/background");

  // Grab the registered handler
  const registeredCallback = onMessageAddListener.mock.calls[0]?.[0];
  if (registeredCallback) {
    // Wrap it to extract the Promise from the callback pattern
    handleMessage = async (message) => {
      return new Promise((resolve) => {
        registeredCallback(message, {}, resolve);
      });
    };
  }
});

beforeEach(() => {
  resetChromeMocks();
  mockFetch.mockReset();

  // Re-mock onMessage.addListener since resetChromeMocks clears it
  // but we already captured the handler
});

// ── CHECK_AUTH ──
describe("CHECK_AUTH", () => {
  it("returns authenticated: false when no token stored", async () => {
    const response = await handleMessage({ action: "CHECK_AUTH" });
    expect(response).toMatchObject({ authenticated: false });
  });

  it("returns authenticated: true with user when token exists", async () => {
    const mockUser = {
      id: 1,
      username: "alice",
      email: "alice@test.com",
      plan: "free",
    };
    seedLocalStorage({
      accessToken: "valid-token",
      user: mockUser,
    });

    const response = await handleMessage({ action: "CHECK_AUTH" });
    expect(response).toMatchObject({
      authenticated: true,
      user: mockUser,
    });
  });
});

// ── LOGIN ──
describe("LOGIN", () => {
  it("returns user on successful login", async () => {
    const mockUser = {
      id: 1,
      username: "alice",
      email: "alice@test.com",
      plan: "free",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access",
          refresh_token: "new-refresh",
          user: mockUser,
        }),
    });

    const response = (await handleMessage({
      action: "LOGIN",
      data: { email: "alice@test.com", password: "password123" },
    })) as { success: boolean; user: unknown };

    expect(response.success).toBe(true);
    expect(response.user).toEqual(mockUser);

    // Verify fetch was called with correct endpoint
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "alice@test.com",
          password: "password123",
        }),
      }),
    );
  });

  it("returns error on failed login", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: "Invalid credentials" }),
    });

    const response = (await handleMessage({
      action: "LOGIN",
      data: { email: "bad@test.com", password: "wrong" },
    })) as { success: boolean; error: string };

    expect(response.success).toBe(false);
    expect(response.error).toBe("Invalid credentials");
  });
});

// ── LOGOUT ──
describe("LOGOUT", () => {
  it("clears auth and returns success", async () => {
    seedLocalStorage({
      accessToken: "token",
      refreshToken: "refresh",
      user: { id: 1 },
    });

    // Mock the logout API call (may fail, should still succeed)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const response = (await handleMessage({ action: "LOGOUT" })) as {
      success: boolean;
    };
    expect(response.success).toBe(true);
  });
});

// ── START_ANALYSIS ──
describe("START_ANALYSIS", () => {
  it("starts analysis and returns task_id", async () => {
    seedLocalStorage({ accessToken: "valid-token" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task_id: "task-abc-123" }),
    });

    const response = (await handleMessage({
      action: "START_ANALYSIS",
      data: {
        url: "https://youtube.com/watch?v=test",
        options: { mode: "standard", lang: "fr" },
      },
    })) as { success: boolean; result: { task_id: string } };

    expect(response.success).toBe(true);
    expect(response.result.task_id).toBe("task-abc-123");
  });

  it("returns error when API fails", async () => {
    seedLocalStorage({ accessToken: "valid-token" });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: "Internal server error" }),
    });

    const response = (await handleMessage({
      action: "START_ANALYSIS",
      data: { url: "https://youtube.com/watch?v=test", options: {} },
    })) as { success: boolean; error: string };

    expect(response.success).toBe(false);
    expect(response.error).toBeTruthy();
  });
});

// ── GET_TASK_STATUS ──
describe("GET_TASK_STATUS", () => {
  it("returns task status", async () => {
    seedLocalStorage({ accessToken: "valid-token" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "processing",
          progress: 50,
          message: "Analysing transcript...",
        }),
    });

    const response = (await handleMessage({
      action: "GET_TASK_STATUS",
      data: { taskId: "task-123" },
    })) as { success: boolean; status: { status: string; progress: number } };

    expect(response.success).toBe(true);
    expect(response.status.status).toBe("processing");
    expect(response.status.progress).toBe(50);
  });
});

// ── GET_SUMMARY ──
describe("GET_SUMMARY", () => {
  it("returns summary data", async () => {
    seedLocalStorage({ accessToken: "valid-token" });

    const mockSummary = {
      id: 42,
      video_title: "Test Video",
      video_channel: "Test Channel",
      summary_content: "This is a summary",
      reliability_score: 85,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSummary),
    });

    const response = (await handleMessage({
      action: "GET_SUMMARY",
      data: { summaryId: 42 },
    })) as { success: boolean; summary: typeof mockSummary };

    expect(response.success).toBe(true);
    expect(response.summary.video_title).toBe("Test Video");
    expect(response.summary.reliability_score).toBe(85);
  });
});

// ── GET_PLAN ──
describe("GET_PLAN", () => {
  it("returns plan info", async () => {
    seedLocalStorage({ accessToken: "valid-token" });

    const mockPlan = {
      plan_name: "Pro",
      plan_id: "pro",
      monthly_analyses: 200,
      analyses_this_month: 42,
      credits: 12000,
      credits_monthly: 15000,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPlan),
    });

    const response = (await handleMessage({ action: "GET_PLAN" })) as {
      success: boolean;
      plan: typeof mockPlan;
    };

    expect(response.success).toBe(true);
    expect(response.plan.plan_id).toBe("pro");
    expect(response.plan.monthly_analyses).toBe(200);
  });
});

// ── Token refresh on 401 ──
describe("Token refresh on 401", () => {
  it("retries request after successful token refresh", async () => {
    seedLocalStorage({
      accessToken: "expired-token",
      refreshToken: "valid-refresh",
    });

    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    // Refresh call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access",
          refresh_token: "new-refresh",
          user: { id: 1, username: "alice", email: "a@b.com", plan: "free" },
        }),
    });

    // Retry call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          plan_name: "Free",
          plan_id: "free",
          monthly_analyses: 3,
          analyses_this_month: 0,
          credits: 150,
          credits_monthly: 150,
        }),
    });

    const response = (await handleMessage({ action: "GET_PLAN" })) as {
      success: boolean;
      plan: { plan_id: string };
    };

    expect(response.success).toBe(true);
    expect(response.plan.plan_id).toBe("free");
    // Should have made 3 fetch calls: original, refresh, retry
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ── Unknown action ──
describe("Unknown action", () => {
  it("returns error for unknown action", async () => {
    const response = (await handleMessage({ action: "UNKNOWN_ACTION" })) as {
      error: string;
    };
    expect(response.error).toBe("Unknown action");
  });
});
