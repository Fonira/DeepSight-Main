/**
 * Tests for the API client (services/api.ts)
 * Covers: auth headers, 401 refresh, timeout, offline detection
 */

// Mock dependencies BEFORE imports
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
    getValidToken: jest.fn().mockResolvedValue(null),
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

import NetInfo from "@react-native-community/netinfo";
import { tokenStorage } from "../../src/utils/storage";
import { tokenManager } from "../../src/services/TokenManager";
import { authApi, ApiError } from "../../src/services/api";

// Helper to set up fetch mock
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

describe("API Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    (tokenManager.getValidToken as jest.Mock).mockResolvedValue(null);
    (tokenStorage.getAccessToken as jest.Mock).mockResolvedValue(
      "test-access-token",
    );
  });

  describe("Auth Token Headers", () => {
    it("should include Authorization header with Bearer token", async () => {
      mockFetchResponse({
        id: 1,
        username: "test",
        email: "test@test.com",
        plan: "free",
      });

      await authApi.getMe();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/me"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-access-token",
          }),
        }),
      );
    });

    it("should use TokenManager token when available", async () => {
      (tokenManager.getValidToken as jest.Mock).mockResolvedValue(
        "managed-token",
      );
      mockFetchResponse({
        id: 1,
        username: "test",
        email: "test@test.com",
        plan: "free",
      });

      await authApi.getMe();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer managed-token",
          }),
        }),
      );
    });

    it("should not include Authorization for unauthenticated endpoints", async () => {
      mockFetchResponse({ message: "registered" });

      await authApi.register("user", "test@test.com", "password123");

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe("Login Flow", () => {
    it("should store tokens on successful login", async () => {
      const loginResponse = {
        access_token: "new-access",
        refresh_token: "new-refresh",
        user: { id: 1, username: "test", email: "test@test.com", plan: "free" },
      };
      mockFetchResponse(loginResponse);

      const result = await authApi.login("test@test.com", "password123");

      expect(result.user.email).toBe("test@test.com");
      expect(tokenStorage.setTokens).toHaveBeenCalledWith(
        "new-access",
        "new-refresh",
      );
    });

    it("should send correct body for login", async () => {
      mockFetchResponse({
        access_token: "token",
        refresh_token: "refresh",
        user: { id: 1 },
      });

      await authApi.login("test@test.com", "mypassword");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/login"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "test@test.com",
            password: "mypassword",
          }),
        }),
      );
    });
  });

  describe("Logout", () => {
    it("should clear tokens on logout", async () => {
      mockFetchResponse({});

      await authApi.logout();

      expect(tokenStorage.clearTokens).toHaveBeenCalled();
    });

    it("should clear tokens even if server logout fails", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      // logout catches server errors and still clears tokens,
      // but _requestRaw may throw before reaching logout's try/catch.
      // The important thing is clearTokens gets called.
      try {
        await authApi.logout();
      } catch {
        // Expected — the raw request throws, but clearTokens should still be called in finally
      }

      expect(tokenStorage.clearTokens).toHaveBeenCalled();
    });
  });

  describe("Offline Detection", () => {
    it("should throw OFFLINE error when no internet", async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

      await expect(authApi.getMe()).rejects.toThrow();
    });
  });

  describe("API Error Handling", () => {
    it("should throw ApiError on non-ok response", async () => {
      mockFetchResponse({ detail: "Not found" }, 404, false);

      await expect(authApi.getMe()).rejects.toThrow();
    });

    it("should handle timeout via AbortController", async () => {
      // Simulate abort
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error("Aborted"), { name: "AbortError" }),
      );

      await expect(authApi.getMe()).rejects.toThrow();
    });
  });

  describe("ApiError Class", () => {
    it("should have correct properties", () => {
      const error = new ApiError(
        "Test error",
        400,
        "BAD_REQUEST",
        "Bad request",
      );
      expect(error.message).toBe("Test error");
      expect(error.status).toBe(400);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.detail).toBe("Bad request");
      expect(error.name).toBe("ApiError");
    });

    it("should detect EMAIL_NOT_VERIFIED error", () => {
      const error = new ApiError("Not verified", 403, "EMAIL_NOT_VERIFIED");
      expect(error.isEmailNotVerified).toBe(true);
    });

    it("should not flag non-verification errors", () => {
      const error = new ApiError("Forbidden", 403, "FORBIDDEN");
      expect(error.isEmailNotVerified).toBe(false);
    });

    it("should detect verification via detail field", () => {
      const error = new ApiError(
        "Not verified",
        403,
        undefined,
        "EMAIL_NOT_VERIFIED",
      );
      expect(error.isEmailNotVerified).toBe(true);
    });
  });

  describe("Token Refresh on 401", () => {
    it("should attempt refresh when receiving 401", async () => {
      // First call returns 401
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Unauthorized" }),
        headers: { get: () => "application/json" },
      });

      // Refresh call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "refreshed-token",
          refresh_token: "new-refresh",
        }),
        headers: { get: () => "application/json" },
      });

      // Retry with new token succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 1, username: "test", plan: "free" }),
        headers: { get: () => "application/json" },
      });

      const result = await authApi.getMe();
      expect(result).toBeDefined();
      expect(tokenStorage.setTokens).toHaveBeenCalledWith(
        "refreshed-token",
        "new-refresh",
      );
    });
  });

  describe("Google OAuth", () => {
    it("should exchange Google token correctly", async () => {
      const response = {
        access_token: "session-token",
        refresh_token: "session-refresh",
        user: {
          id: 1,
          username: "googleuser",
          email: "google@test.com",
          plan: "free",
        },
      };
      mockFetchResponse(response);

      const result = await authApi.googleTokenLogin("google-id-token");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/google/token"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"id_token":"google-id-token"'),
        }),
      );
      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody.id_token).toBe("google-id-token");
      expect(["ios", "android"]).toContain(callBody.client_platform);
      expect(result.user.email).toBe("google@test.com");
      expect(tokenStorage.setTokens).toHaveBeenCalledWith(
        "session-token",
        "session-refresh",
      );
    });
  });

  describe("Forgot Password", () => {
    it("should call forgot-password endpoint", async () => {
      mockFetchResponse({ message: "Email sent" });

      await authApi.forgotPassword("test@test.com");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/forgot-password"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "test@test.com" }),
        }),
      );
    });
  });
});
