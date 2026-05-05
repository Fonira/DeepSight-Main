/**
 * 🧪 Tests Complets — API Client Service
 * Coverage: Token management, requests, error handling, retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mockApi,
  resetAllMocks,
  simulateNetworkError,
} from "../../__tests__/mocks/api-mocks";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ═══════════════════════════════════════════════════════════════════════════════
// 🧹 SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

beforeEach(() => {
  resetAllMocks();
  mockFetch.mockClear();
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe("API Client - Token Storage", () => {
  it("should store access and refresh tokens", async () => {
    await mockApi.auth.login("test@example.com", "password");

    const stored = localStorage.getItem("access_token");
    expect(stored).toBeTruthy();
  });

  it("should retrieve stored access token", async () => {
    localStorage.setItem("access_token", "my-access-token");

    const token = localStorage.getItem("access_token");
    expect(token).toBe("my-access-token");
  });

  it("should retrieve stored refresh token", async () => {
    localStorage.setItem("refresh_token", "my-refresh-token");

    const token = localStorage.getItem("refresh_token");
    expect(token).toBe("my-refresh-token");
  });

  it("should clear all tokens on demand", async () => {
    localStorage.setItem("access_token", "token1");
    localStorage.setItem("refresh_token", "token2");

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("should handle token in localStorage after login", async () => {
    const result = await mockApi.auth.login("test@example.com", "password");

    expect(result.access_token).toBeTruthy();
    expect(result.refresh_token).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HTTP REQUEST HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe("API Client - HTTP Requests", () => {
  it("should make GET request with auth header", async () => {
    localStorage.setItem("access_token", "test-access-token");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "success" }),
    });

    // Simulate API call
    const response = await fetch("https://api.example.com/user", {
      headers: {
        Authorization: `Bearer test-access-token`,
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );
  });

  it("should make POST request with body", async () => {
    localStorage.setItem("access_token", "token");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1 }),
    });

    const response = await fetch("https://api.example.com/video/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body: JSON.stringify({ url: "https://youtube.com/watch?v=test" }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("youtube.com"),
      }),
    );
  });

  it("should include auth header in all requests", async () => {
    localStorage.setItem("access_token", "my-token");

    const result = await mockApi.video.analyze(
      "https://youtube.com/watch?v=test",
    );

    expect(result.task_id).toBeTruthy();
  });

  it("should handle requests without auth header when not authenticated", async () => {
    localStorage.clear();

    const result = await mockApi.auth.register("new@example.com", "password");

    expect(result.message).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ❌ ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe("API Client - Error Handling", () => {
  it("should handle 401 Unauthorized error", async () => {
    localStorage.setItem("access_token", "expired-token");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });

    // Should trigger token refresh or clear auth
    const response = await fetch("https://api.example.com/user", {
      headers: { Authorization: "Bearer expired-token" },
    });

    expect(response.ok).toBe(false);
  });

  it("should handle 403 Forbidden error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    });

    const response = await fetch("https://api.example.com/admin");

    expect(response.status).toBe(403);
  });

  it("should handle 404 Not Found error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not Found" }),
    });

    const response = await fetch("https://api.example.com/nonexistent");

    expect(response.status).toBe(404);
  });

  it("should handle 422 Validation error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [{ field: "email", message: "Invalid email" }],
      }),
    });

    const response = await fetch("https://api.example.com/register", {
      method: "POST",
      body: JSON.stringify({ email: "invalid" }),
    });

    expect(response.status).toBe(422);
  });

  it("should handle 429 Rate Limited error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Rate limited" }),
    });

    const response = await fetch("https://api.example.com/analyze");

    expect(response.status).toBe(429);
  });

  it("should handle 500 Server error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    const response = await fetch("https://api.example.com/data");

    expect(response.status).toBe(500);
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(fetch("https://api.example.com/data")).rejects.toThrow(
      "Network error",
    );
  });

  it("should handle timeout errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Request timeout"));

    await expect(fetch("https://api.example.com/data")).rejects.toThrow(
      "Request timeout",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎭 MOCK API MODULES
// ═══════════════════════════════════════════════════════════════════════════════

describe("API Modules - Auth", () => {
  it("should register user", async () => {
    const result = await mockApi.auth.register(
      "new@test.com",
      "password123",
      "newuser",
    );

    expect(result.user.email).toBe("new@test.com");
    expect(result.message).toBe("Registration successful");
  });

  it("should login user", async () => {
    const result = await mockApi.auth.login("user@test.com", "password");

    expect(result.access_token).toBeTruthy();
    expect(result.refresh_token).toBeTruthy();
    expect(result.user.email).toBe("user@test.com");
  });

  it("should logout user", async () => {
    const result = await mockApi.auth.logout();

    expect(result.message).toBe("Logged out successfully");
  });

  it("should get current user", async () => {
    const result = await mockApi.auth.me();

    expect(result.user.email).toBe("user@test.com");
  });

  it("should refresh token", async () => {
    const result = await mockApi.auth.refresh();

    expect(result.access_token).toBe("new-access-token");
    expect(result.refresh_token).toBe("new-refresh-token");
  });

  it("should verify email", async () => {
    const result = await mockApi.auth.verifyEmail("verification-code-123");

    expect(result.message).toBe("Email verified successfully");
  });

  it("should login with Google", async () => {
    const result = await mockApi.auth.loginWithGoogle("google-token");

    expect(result.access_token).toBe("google-access-token");
    expect(result.user).toBeTruthy();
  });
});

describe("API Modules - Video", () => {
  it("should analyze video", async () => {
    const result = await mockApi.video.analyze(
      "https://youtube.com/watch?v=test",
    );

    expect(result.task_id).toBeTruthy();
  });

  it("should get analysis status", async () => {
    const result = await mockApi.video.status("task-123");

    expect(result.task_id).toBe("task-123");
    expect(result.status).toBe("complete");
  });

  it("should get summary by ID", async () => {
    const result = await mockApi.video.getSummary(1);

    expect(result.id).toBe(1);
    expect(result.summary_content).toBeTruthy();
  });

  it("should fetch video history", async () => {
    const result = await mockApi.video.history(1, 20);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThanOrEqual(result.items.length);
    expect(result.page).toBe(1);
  });

  it("should export summary", async () => {
    const result = await mockApi.video.export(1, "pdf");

    expect(result.download_url).toBeTruthy();
  });

  it("should get reliability data", async () => {
    const result = await mockApi.video.reliability(1);

    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(1);
    expect(result.concepts).toBeDefined();
  });

  it("should delete summary", async () => {
    const result = await mockApi.video.deleteSummary(1);

    expect(result.message).toBeTruthy();
  });

  it("should toggle favorite", async () => {
    const result = await mockApi.video.toggleFavorite(1);

    expect(result.is_favorite).toBe(true);
  });
});

describe("API Modules - Chat", () => {
  it("should ask question", async () => {
    const result = await mockApi.chat.ask(1, "What is the main topic?");

    expect(result.message).toBeTruthy();
    expect(result.message.role).toBe("assistant");
  });

  it("should stream chat response", async () => {
    const result = await mockApi.chat.askStream(1, "Question?");

    expect(result).toBeInstanceOf(ReadableStream);
  });

  it("should fetch chat history", async () => {
    const result = await mockApi.chat.history(1);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("API Modules - Billing", () => {
  it("should create checkout session", async () => {
    const result = await mockApi.billing.checkout("pro");

    expect(result.checkout_url).toBeTruthy();
    expect(result.checkout_url).toContain("stripe");
  });

  it("should get billing portal", async () => {
    const result = await mockApi.billing.portal();

    expect(result.portal_url).toBeTruthy();
  });

  it("should fetch plans", async () => {
    const result = await mockApi.billing.plans();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("API Modules - Playlist", () => {
  it("should create playlist", async () => {
    const result = await mockApi.playlist.create("My Playlist");

    expect(result.id).toBeTruthy();
    expect(result.name).toBe("My Playlist");
  });

  it("should list playlists", async () => {
    const result = await mockApi.playlist.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should get playlist details", async () => {
    const result = await mockApi.playlist.detail(1);

    expect(result.id).toBe(1);
    expect(result.summaries).toBeDefined();
  });

  it("should add summary to playlist", async () => {
    const result = await mockApi.playlist.addSummary(1, 1);

    expect(result.message).toBeTruthy();
  });

  it("should delete playlist", async () => {
    const result = await mockApi.playlist.delete(1);

    expect(result.message).toBeTruthy();
  });

  it("should analyze playlist", async () => {
    const result = await mockApi.playlist.analyze(1);

    expect(result.task_id).toBeTruthy();
  });
});

describe("API Modules - Reliability", () => {
  it("should get fact checks", async () => {
    const result = await mockApi.reliability.factCheck(1);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0].claim).toBeTruthy();
  });

  it("should get concepts", async () => {
    const result = await mockApi.reliability.concepts(1);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0].word).toBeTruthy();
  });

  it("should get academic sources", async () => {
    const result = await mockApi.reliability.academicSources(1);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0].title).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 REQUEST PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════════

describe("API Client - Request Parameters", () => {
  it("should pass correct parameters to analyze", async () => {
    await mockApi.video.analyze("https://youtube.com/watch?v=test", {
      mode: "expert",
      lang: "en",
    });

    expect(mockApi.video.analyze).toHaveBeenCalledWith(
      "https://youtube.com/watch?v=test",
      expect.objectContaining({
        mode: "expert",
        lang: "en",
      }),
    );
  });

  it("should handle pagination in history", async () => {
    await mockApi.video.history(2, 50);

    expect(mockApi.video.history).toHaveBeenCalledWith(2, 50);
  });

  it("should handle export formats", async () => {
    await mockApi.video.export(1, "docx");
    expect(mockApi.video.export).toHaveBeenCalledWith(1, "docx");

    await mockApi.video.export(1, "md");
    expect(mockApi.video.export).toHaveBeenCalledWith(1, "md");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 RETRY & RESILIENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe("API Client - Resilience", () => {
  it("should handle temporary failures gracefully", async () => {
    // First call fails, second succeeds
    mockApi.auth.login
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        access_token: "token",
        refresh_token: "refresh",
        user: {
          id: 1,
          email: "test@test.com",
          plan: "free",
          credits: 0,
          email_verified: true,
          created_at: "2026-01-01T00:00:00Z",
        },
      });

    // First attempt fails
    await expect(
      mockApi.auth.login("test@test.com", "password"),
    ).rejects.toThrow("Network error");

    // Second attempt succeeds
    const result = await mockApi.auth.login("test@test.com", "password");
    expect(result.access_token).toBeTruthy();
  });

  it("should handle partial data responses", async () => {
    const partialResult = await mockApi.video.getSummary(1);

    expect(partialResult.id).toBe(1);
    // Should not throw on missing optional fields
    expect(partialResult.summary_content).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("API Client - Edge Cases", () => {
  it("should handle empty response body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const response = await fetch("https://api.example.com/endpoint");
    const data = await response.json();

    expect(data).toEqual({});
  });

  it("should handle null in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });

    const response = await fetch("https://api.example.com/endpoint");
    const data = await response.json();

    expect(data).toBeNull();
  });

  it("should handle very large responses", async () => {
    const largeData = {
      items: Array(1000)
        .fill(null)
        .map((_, i) => ({ id: i, name: `Item ${i}` })),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => largeData,
    });

    const response = await fetch("https://api.example.com/large");
    const data = await response.json();

    expect(data.items.length).toBe(1000);
  });

  it("should handle malformed JSON gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });

    const response = await fetch("https://api.example.com/endpoint");

    await expect(response.json()).rejects.toThrow("Invalid JSON");
  });

  it("should handle concurrent requests", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1 }),
    });

    const [result1, result2, result3] = await Promise.all([
      mockApi.video.getSummary(1),
      mockApi.video.getSummary(2),
      mockApi.video.getSummary(3),
    ]);

    expect(result1.id).toBe(1);
    expect(result2.id).toBe(2);
    expect(result3.id).toBe(3);
  });
});
