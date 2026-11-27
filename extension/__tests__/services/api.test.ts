/**
 * Tests — Background script API client (message handler)
 * Fichier source : src/background.ts
 *
 * `handleMessage` est exporté par background.ts : on l'appelle directement.
 * (L'ancien harnais récupérait le PREMIER listener `onMessage` enregistré —
 * devenu le relais URL_CHANGED, qui ne répond jamais aux autres actions →
 * tous les tests tombaient en timeout.)
 */

import { resetChromeMocks, seedLocalStorage } from "../setup/chrome-api-mock";
import { handleMessage as backgroundHandleMessage } from "../../src/background";
import type { ExtensionMessage } from "../../src/types";

// Mock fetch globally
const mockFetch = jest.fn();
(global as unknown as Record<string, unknown>).fetch = mockFetch;

const handleMessage = (message: {
  action: string;
  data?: Record<string, unknown>;
}): Promise<unknown> =>
  backgroundHandleMessage(message as unknown as ExtensionMessage);

beforeEach(() => {
  resetChromeMocks();
  mockFetch.mockReset();
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
        url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
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
      data: { url: "https://youtube.com/watch?v=dQw4w9WgXcQ", options: {} },
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
  it("normalises the /billing/my-plan payload", async () => {
    seedLocalStorage({
      accessToken: "valid-token",
      user: { id: 1, plan: "pro", credits: 12000, credits_monthly: 15000 },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          plan: "pro",
          plan_name: "Pro",
          limits: { monthly_analyses: 30, monthly_credits: 15000 },
          usage: { analyses_this_month: 12 },
          voice_quota: { trial_used: false, monthly_minutes_used: 0 },
        }),
    });

    const response = (await handleMessage({ action: "GET_PLAN" })) as {
      success: boolean;
      plan: {
        plan_id: string;
        monthly_analyses: number;
        analyses_this_month: number;
        credits: number;
      };
    };

    expect(response.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/billing/my-plan?platform=extension"),
      expect.anything(),
    );
    expect(response.plan).toMatchObject({
      plan_id: "pro",
      monthly_analyses: 30,
      analyses_this_month: 12,
      credits: 12000,
    });
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

// ── Erreurs structurées (detail objet / tableau) ──
describe("Structured API errors", () => {
  it("LOGIN surfaces the private_mode message instead of [object Object]", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          detail: {
            code: "private_mode",
            message:
              "DeepSight est temporairement en accès privé (maintenance).",
          },
        }),
    });

    const response = (await handleMessage({
      action: "LOGIN",
      data: { email: "user@test.com", password: "secret" },
    })) as { success: boolean; error: string; errorCode: string };

    expect(response.success).toBe(false);
    expect(response.error).toBe(
      "DeepSight est temporairement en accès privé (maintenance).",
    );
    expect(response.error).not.toContain("[object Object]");
    expect(response.errorCode).toBe("private_mode");
  });

  it("START_ANALYSIS forwards the code + message of an object detail", async () => {
    seedLocalStorage({ accessToken: "valid-token" });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          detail: {
            code: "insufficient_credits",
            message: "Crédits insuffisants",
            credits: 0,
          },
        }),
    });

    const response = (await handleMessage({
      action: "START_ANALYSIS",
      data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", options: {} },
    })) as {
      success: boolean;
      error: string;
      errorCode: string;
      httpStatus: number;
      errorDetail: Record<string, unknown>;
    };

    expect(response).toMatchObject({
      success: false,
      error: "Crédits insuffisants",
      errorCode: "insufficient_credits",
      httpStatus: 403,
    });
    expect(response.errorDetail.credits).toBe(0);
  });

  it("joins 422 validation messages", async () => {
    seedLocalStorage({ accessToken: "valid-token" });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({
          detail: [
            { loc: ["body", "question"], msg: "Field required", type: "missing" },
          ],
        }),
    });

    const response = (await handleMessage({
      action: "ASK_QUESTION",
      data: { summaryId: 1, question: "" },
    })) as { success: boolean; error: string; errorCode: string };

    expect(response.success).toBe(false);
    expect(response.error).toBe("Field required");
    expect(response.errorCode).toBe("validation_error");
  });

  it("returns auth_required (not SESSION_EXPIRED) when no account is signed in", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: "Not authenticated" }),
    });

    const response = (await handleMessage({
      action: "QUICK_CHAT",
      data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    })) as { success: boolean; error: string; errorCode: string };

    expect(response.success).toBe(false);
    expect(response.errorCode).toBe("auth_required");
    // Pas de tentative de refresh sans compte.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("maps a rejected fetch to network_error", async () => {
    seedLocalStorage({ accessToken: "valid-token" });
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const response = (await handleMessage({
      action: "GET_TASK_STATUS",
      data: { taskId: "task-1" },
    })) as { success: boolean; error: string; errorCode: string };

    expect(response).toMatchObject({
      success: false,
      error: "NETWORK_ERROR",
      errorCode: "network_error",
    });
  });
});

// ── Seul l'identifiant vidéo part vers l'API ──
describe("Canonical video URL", () => {
  function sentBody(): { url: string } {
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    return JSON.parse(init.body as string) as { url: string };
  }

  it("START_ANALYSIS sends the bare YouTube watch URL", async () => {
    seedLocalStorage({ accessToken: "valid-token" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ task_id: "t" }),
    });

    await handleMessage({
      action: "START_ANALYSIS",
      data: {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1&t=42s&si=abc",
        options: {},
      },
    });

    expect(sentBody().url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("QUICK_CHAT strips TikTok tracking parameters", async () => {
    seedLocalStorage({ accessToken: "valid-token" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ summary_id: 1 }),
    });

    await handleMessage({
      action: "QUICK_CHAT",
      data: {
        url: "https://www.tiktok.com/@a/video/7234567890123456789?is_from_webapp=1",
      },
    });

    expect(sentBody().url).toBe(
      "https://www.tiktok.com/@a/video/7234567890123456789",
    );
  });

  it("refuses non-video URLs without calling the API", async () => {
    seedLocalStorage({ accessToken: "valid-token" });
    const res = (await handleMessage({
      action: "START_ANALYSIS",
      data: { url: "https://www.youtube.com/feed/trending", options: {} },
    })) as { success: boolean; errorCode: string };

    expect(res).toMatchObject({ success: false, errorCode: "invalid_url" });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
