/**
 * Tests unitaires — Client API (request, tokens, erreurs)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// We need to reset modules between tests to reset the refreshPromise state
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// Import after mocking
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  ApiError,
  API_URL,
  authApi,
  videoApi,
} from "../api";

// ═══════════════════════════════════════════════════════════════════════
// TOKEN STORAGE
// ═══════════════════════════════════════════════════════════════════════

describe("Token Storage", () => {
  it("should store and retrieve access token", () => {
    setTokens("access123", "refresh456");
    expect(getAccessToken()).toBe("access123");
  });

  it("should store and retrieve refresh token", () => {
    setTokens("access123", "refresh456");
    expect(getRefreshToken()).toBe("refresh456");
  });

  it("should clear all tokens", () => {
    setTokens("access123", "refresh456");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("should clear cached_user on clearTokens", () => {
    localStorage.setItem("cached_user", JSON.stringify({ user: { id: 1 } }));
    clearTokens();
    expect(localStorage.getItem("cached_user")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ApiError
// ═══════════════════════════════════════════════════════════════════════

describe("ApiError", () => {
  it("should set status and message", () => {
    const err = new ApiError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.status).toBe(404);
    expect(err.name).toBe("ApiError");
  });

  it("isRateLimited returns true for 429", () => {
    expect(new ApiError("Too many", 429).isRateLimited).toBe(true);
    expect(new ApiError("Not found", 404).isRateLimited).toBe(false);
  });

  it("isUnauthorized returns true for 401", () => {
    expect(new ApiError("Unauth", 401).isUnauthorized).toBe(true);
  });

  it("isNotFound returns true for 404", () => {
    expect(new ApiError("Missing", 404).isNotFound).toBe(true);
  });

  it("isForbidden returns true for 403", () => {
    expect(new ApiError("Denied", 403).isForbidden).toBe(true);
  });

  it("should store additional data", () => {
    const err = new ApiError("Error", 400, { field: "email" });
    expect(err.data).toEqual({ field: "email" });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// HTTP CLIENT — via authApi/videoApi calls
// ═══════════════════════════════════════════════════════════════════════

describe("HTTP Client (request function)", () => {
  it("GET request success → data returned", async () => {
    setTokens("valid-token", "refresh-token");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: 1, email: "test@test.com", plan: "free" }),
    });

    const result = await authApi.me();
    expect(result).toEqual({ id: 1, email: "test@test.com", plan: "free" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("request with token → Authorization header present", async () => {
    setTokens("my-jwt-token", "refresh-token");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({}),
    });

    await authApi.me();

    const [, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchOptions.headers["Authorization"]).toBe("Bearer my-jwt-token");
  });

  it("request without token → no Authorization header", async () => {
    // No token set - register uses skipAuth
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, message: "ok" }),
    });

    await authApi.register("user", "test@test.com", "password");

    const [, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchOptions.headers["Authorization"]).toBeUndefined();
  });

  it("401 error → refresh token attempted", async () => {
    setTokens("expired-token", "valid-refresh");

    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Token expired" }),
    });

    // Refresh call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "new-token",
        refresh_token: "new-refresh",
      }),
    });

    // Retry call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: 1, email: "test@test.com" }),
    });

    const result = await authApi.me();
    expect(result).toEqual({ id: 1, email: "test@test.com" });
    // 3 calls: original + refresh + retry
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify refresh endpoint was called
    const refreshCall = mockFetch.mock.calls[1];
    expect(refreshCall[0]).toContain("/api/auth/refresh");
  });

  it("401 after refresh failure → dispatch logout event", async () => {
    setTokens("expired-token", "expired-refresh");

    const logoutHandler = vi.fn();
    window.addEventListener("auth:logout", logoutHandler);

    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Token expired" }),
    });

    // Refresh call: fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Refresh token invalid" }),
    });

    await expect(authApi.me()).rejects.toThrow(ApiError);
    expect(logoutHandler).toHaveBeenCalled();

    // Tokens should be cleared
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();

    window.removeEventListener("auth:logout", logoutHandler);
  });

  it("network error → throws ApiError with status 0", async () => {
    setTokens("token", "refresh");

    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    try {
      await authApi.me();
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(0);
      // translateApiError traduit "Failed to fetch" → "Erreur de connexion réseau"
      expect((error as ApiError).message).toBe("Erreur de connexion réseau");
    }
  });

  it("500 error → throw with server error message", async () => {
    setTokens("token", "refresh");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: "Internal server error" }),
    });

    try {
      await authApi.me();
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
      // translateApiError traduit "Internal server error" → "Erreur interne du serveur"
      expect((error as ApiError).message).toBe("Erreur interne du serveur");
    }
  });

  it("POST request sends JSON body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ access_token: "tok", refresh_token: "ref" }),
    });

    await authApi.login("test@test.com", "password");

    const [url, fetchOptions] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/auth/login");
    expect(fetchOptions.method).toBe("POST");
    expect(fetchOptions.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(fetchOptions.body)).toEqual({
      email: "test@test.com",
      password: "password",
    });
  });

  it("204 response → request completes without error", async () => {
    setTokens("token", "refresh");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    // logout returns void but should not throw
    await expect(authApi.logout()).resolves.not.toThrow();
  });

  it("Pydantic validation error is parsed correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [
          {
            loc: ["body", "email"],
            msg: "Invalid email format",
            type: "value_error",
          },
          { loc: ["body", "password"], msg: "Too short", type: "value_error" },
        ],
      }),
    });

    try {
      await authApi.register("user", "bad", "x");
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toContain("Invalid email format");
      expect((error as ApiError).message).toContain("Too short");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// API URL
// ═══════════════════════════════════════════════════════════════════════

describe("API Configuration", () => {
  it("API_URL has a default value", () => {
    expect(API_URL).toBeDefined();
    expect(typeof API_URL).toBe("string");
    expect(API_URL.length).toBeGreaterThan(0);
  });
});
