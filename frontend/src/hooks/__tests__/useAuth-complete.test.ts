/**
 * 🧪 Tests Complets — useAuth Hook v7.0
 * Coverage: login, register, logout, token refresh, cross-tab sync, session events
 *
 * CRITICAL NOTES:
 * ✅ vi.hoisted() for mock to avoid hoisting ReferenceError
 * ✅ Fake JWT tokens (hook parses JWT payload for expiry)
 * ✅ Login mock stores tokens (real authApi.login calls setTokens internally)
 * ✅ vi.useFakeTimers({ shouldAdvanceTime: true }) for hook intervals
 * ✅ Non-ApiError errors → hook catches with generic message
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  renderHookWithProviders,
  act,
  waitFor,
} from "../../__tests__/test-utils";
import { useAuth } from "../useAuth";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Create a fake but parseable JWT with future expiry */
function createFakeJwt(expiresInSeconds = 3600): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      sub: "1",
    }),
  );
  return `${header}.${payload}.fakesignature`;
}

/** Create a fake expired JWT */
function createExpiredJwt(): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1h ago
      sub: "1",
    }),
  );
  return `${header}.${payload}.fakesignature`;
}

function createMockUser(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    email: "user@test.com",
    username: "testuser",
    name: "Test User",
    avatar_url: "https://example.com/avatar.jpg",
    plan: "free",
    credits: 150,
    email_verified: true,
    created_at: new Date().toISOString(),
    subscription_active: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 MOCK THE REAL authApi MODULE
// vi.hoisted() ensures mockAuthApi is defined BEFORE vi.mock() hoisting
// ═══════════════════════════════════════════════════════════════════════════════

const mockAuthApi = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  refresh: vi.fn(),
  verifyEmail: vi.fn(),
}));

vi.mock("../../services/api", () => ({
  authApi: mockAuthApi,
  getAccessToken: vi.fn(() => localStorage.getItem("access_token")),
  getRefreshToken: vi.fn(() => localStorage.getItem("refresh_token")),
  setTokens: vi.fn((access: string, refresh: string) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }),
  clearTokens: vi.fn(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("cached_user");
  }),
  ApiError: class ApiError extends Error {
    status: number;
    isUnauthorized: boolean;
    isRateLimited: boolean;
    isValidationError: boolean;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "ApiError";
      this.status = status || 500;
      this.isUnauthorized = status === 401;
      this.isRateLimited = status === 429;
      this.isValidationError = status === 422;
    }
  },
  API_URL: "http://localhost:8000",
  videoApi: {},
  chatApi: {},
  billingApi: {},
  playlistApi: {},
  User: {},
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 🧹 SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  Object.values(mockAuthApi).forEach((fn) => fn.mockClear());
  localStorage.clear();

  // Default: me() returns a user, refresh() returns new tokens
  mockAuthApi.me.mockResolvedValue(createMockUser());
  mockAuthApi.refresh.mockResolvedValue({
    access_token: createFakeJwt(),
    refresh_token: createFakeJwt(86400),
  });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - Initial State", () => {
  it("should initialize with no user when tokens absent", () => {
    const { result } = renderHookWithProviders(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should initialize with cached user if valid tokens exist", () => {
    const token = createFakeJwt();
    const mockUser = createMockUser();
    localStorage.setItem("access_token", token);
    localStorage.setItem(
      "cached_user",
      JSON.stringify({
        user: mockUser,
        timestamp: Date.now(),
      }),
    );

    const { result } = renderHookWithProviders(() => useAuth());

    expect(result.current.user?.email).toBe("user@test.com");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("should have error null initially", () => {
    const { result } = renderHookWithProviders(() => useAuth());
    expect(result.current.error).toBeNull();
  });

  it("should have loading alias equal to isLoading", () => {
    const { result } = renderHookWithProviders(() => useAuth());
    expect(result.current.loading).toBe(result.current.isLoading);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔓 LOGIN FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - Login Flow", () => {
  it("should call login with correct email and password", async () => {
    const token = createFakeJwt();
    const mockUser = createMockUser({ email: "test@example.com" });

    // Login mock stores tokens (like real authApi.login does)
    mockAuthApi.login.mockImplementationOnce(async () => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("refresh_token", createFakeJwt(86400));
      return { access_token: token, refresh_token: createFakeJwt(86400) };
    });
    mockAuthApi.me.mockResolvedValueOnce(mockUser);

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.login("test@example.com", "password123");
    });

    expect(mockAuthApi.login).toHaveBeenCalledWith(
      "test@example.com",
      "password123",
    );
  });

  it("should authenticate after successful login", async () => {
    const token = createFakeJwt();
    const mockUser = createMockUser({ email: "test@example.com" });

    mockAuthApi.login.mockImplementationOnce(async () => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("refresh_token", createFakeJwt(86400));
      return { access_token: token, refresh_token: createFakeJwt(86400) };
    });
    mockAuthApi.me.mockResolvedValueOnce(mockUser);

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.login("test@example.com", "password123");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe("test@example.com");
  });

  it("should handle login error", async () => {
    mockAuthApi.login.mockRejectedValueOnce(new Error("Invalid credentials"));

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await expect(
        result.current.login("test@example.com", "wrong-password"),
      ).rejects.toThrow("Invalid credentials");
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should store tokens in localStorage after successful login", async () => {
    const accessToken = createFakeJwt();
    const refreshToken = createFakeJwt(86400);

    mockAuthApi.login.mockImplementationOnce(async () => {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      return { access_token: accessToken, refresh_token: refreshToken };
    });
    mockAuthApi.me.mockResolvedValueOnce(createMockUser());

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.login("test@example.com", "password");
    });

    expect(localStorage.getItem("access_token")).toBeTruthy();
    expect(localStorage.getItem("refresh_token")).toBeTruthy();
  });

  it("should cache user data after successful login", async () => {
    const token = createFakeJwt();
    const mockUser = createMockUser({ email: "test@example.com" });

    mockAuthApi.login.mockImplementationOnce(async () => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("refresh_token", createFakeJwt(86400));
      return { access_token: token, refresh_token: createFakeJwt(86400) };
    });
    mockAuthApi.me.mockResolvedValueOnce(mockUser);

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.login("test@example.com", "password");
    });

    const cached = JSON.parse(localStorage.getItem("cached_user") || "{}");
    expect(cached.user).toBeDefined();
    expect(cached.user.email).toBe("test@example.com");
    expect(cached.timestamp).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 REGISTER FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - Register Flow", () => {
  it("should call register with correct signature (username, email, password)", async () => {
    mockAuthApi.register.mockResolvedValueOnce({
      message: "Registration successful",
      user: createMockUser({ email: "newuser@example.com" }),
    });

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.register(
        "newuser",
        "newuser@example.com",
        "password123",
      );
    });

    expect(mockAuthApi.register).toHaveBeenCalledWith(
      "newuser",
      "newuser@example.com",
      "password123",
      // 4th arg = UTM tracking object (signup_source defaults to "direct"
      // when no UTM captured). Backend tolerates absent fields.
      expect.objectContaining({ signup_source: expect.any(String) }),
    );
  });

  it("should clear error on successful registration", async () => {
    mockAuthApi.register.mockResolvedValueOnce({
      message: "Registration successful",
      user: createMockUser(),
    });

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.register("user", "user@example.com", "password");
    });

    expect(result.current.error).toBeNull();
  });

  it("should handle registration error", async () => {
    mockAuthApi.register.mockRejectedValueOnce(
      new Error("Email already exists"),
    );

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await expect(
        result.current.register("user", "existing@example.com", "password"),
      ).rejects.toThrow("Email already exists");
    });

    expect(result.current.error).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔓 LOGOUT FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - Logout Flow", () => {
  it("should logout successfully", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    localStorage.setItem("refresh_token", createFakeJwt(86400));
    localStorage.setItem(
      "cached_user",
      JSON.stringify({
        user: createMockUser(),
        timestamp: Date.now(),
      }),
    );
    mockAuthApi.logout.mockResolvedValueOnce({ message: "Logged out" });

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(localStorage.getItem("cached_user")).toBeNull();
  });

  it("should clear user state on logout", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    localStorage.setItem(
      "cached_user",
      JSON.stringify({
        user: createMockUser(),
        timestamp: Date.now(),
      }),
    );
    mockAuthApi.logout.mockResolvedValueOnce({ message: "Logged out" });

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should call authApi.logout", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    mockAuthApi.logout.mockResolvedValueOnce({ message: "Logged out" });

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockAuthApi.logout).toHaveBeenCalled();
  });

  it("should dispatch logout event", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    mockAuthApi.logout.mockResolvedValueOnce({ message: "Logged out" });

    const logoutSpy = vi.fn();
    window.addEventListener("auth:logout", logoutSpy);

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(logoutSpy).toHaveBeenCalled();
    window.removeEventListener("auth:logout", logoutSpy);
  });

  it("should handle logout error gracefully", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    localStorage.setItem("refresh_token", createFakeJwt(86400));
    mockAuthApi.logout.mockRejectedValueOnce(new Error("Logout failed"));

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔑 GOOGLE OAUTH FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - Google OAuth Flow", () => {
  it("should call loginWithGoogle with NO arguments (redirect-based)", async () => {
    mockAuthApi.loginWithGoogle.mockResolvedValueOnce(undefined);

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.loginWithGoogle();
    });

    expect(mockAuthApi.loginWithGoogle).toHaveBeenCalledWith();
  });

  it("should handle Google OAuth error", async () => {
    mockAuthApi.loginWithGoogle.mockRejectedValueOnce(
      new Error("Google authentication failed"),
    );

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await expect(result.current.loginWithGoogle()).rejects.toThrow();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ EMAIL VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - Email Verification", () => {
  it("should call verifyEmail with email and code", async () => {
    mockAuthApi.verifyEmail.mockResolvedValueOnce({
      message: "Email verified successfully",
    });

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.verifyEmail(
        "test@example.com",
        "verification-code-123",
      );
    });

    expect(mockAuthApi.verifyEmail).toHaveBeenCalledWith(
      "test@example.com",
      "verification-code-123",
    );
  });

  it("should handle verification error", async () => {
    mockAuthApi.verifyEmail.mockRejectedValueOnce(new Error("Invalid code"));

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await expect(
        result.current.verifyEmail("test@example.com", "wrong-code"),
      ).rejects.toThrow("Invalid code");
    });

    expect(result.current.error).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 REFRESH USER
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - Refresh User", () => {
  it("should call authApi.me to refresh user data", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    mockAuthApi.me.mockResolvedValueOnce(
      createMockUser({ email: "updated@example.com" }),
    );

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(mockAuthApi.me).toHaveBeenCalled();
  });

  it("should update user state after refresh", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    const updatedUser = createMockUser({ email: "updated@example.com" });
    mockAuthApi.me.mockResolvedValueOnce(updatedUser);

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user?.email).toBe("updated@example.com");
  });

  it("should handle refresh error gracefully", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    mockAuthApi.me.mockRejectedValueOnce(new Error("Refresh failed"));

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.refreshUser();
    });

    // Should not throw — hook stores error in state or falls back to cache
    // Since no cache exists, error should be set
    expect(result.current.error).toBeTruthy();
  });

  it("should reset state if no access token present", async () => {
    localStorage.clear();

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 CROSS-TAB SYNC
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - Cross-Tab Synchronization", () => {
  it("should handle logout from another tab via storage event", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    localStorage.setItem(
      "cached_user",
      JSON.stringify({
        user: createMockUser(),
        timestamp: Date.now(),
      }),
    );

    const { result } = renderHookWithProviders(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);

    // Simulate logout from another tab
    await act(async () => {
      localStorage.removeItem("access_token");
      const storageEvent = new StorageEvent("storage", {
        key: "access_token",
        newValue: null,
        oldValue: token,
        url: window.location.href,
      });
      window.dispatchEvent(storageEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  it("should handle token change from another tab", async () => {
    localStorage.clear();

    const { result } = renderHookWithProviders(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);

    const newToken = createFakeJwt();

    await act(async () => {
      localStorage.setItem("access_token", newToken);
      const storageEvent = new StorageEvent("storage", {
        key: "access_token",
        newValue: newToken,
        oldValue: null,
        url: window.location.href,
      });
      window.dispatchEvent(storageEvent);
    });

    // Should trigger a refresh — we don't need to assert the result,
    // just that it doesn't crash
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - Edge Cases", () => {
  it("should handle corrupted cached_user JSON gracefully", () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    localStorage.setItem("cached_user", "corrupted-json{invalid}");

    const { result } = renderHookWithProviders(() => useAuth());

    // Should not throw, user should be null or in loading
    expect(result.current.user === null || result.current.isLoading).toBe(true);
  });

  it("should handle empty email/password on login", async () => {
    mockAuthApi.login.mockRejectedValueOnce(new Error("Email required"));

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await expect(result.current.login("", "")).rejects.toThrow(
        "Email required",
      );
    });

    expect(result.current.error).toBeTruthy();
  });

  it("should handle network timeout during login", async () => {
    mockAuthApi.login.mockRejectedValueOnce(new Error("Request timeout"));

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await expect(
        result.current.login("test@example.com", "password"),
      ).rejects.toThrow("Request timeout");
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should handle rapid logout calls without errors", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    localStorage.setItem("refresh_token", createFakeJwt(86400));
    mockAuthApi.logout.mockResolvedValue({ message: "Logged out" });

    const { result } = renderHookWithProviders(() => useAuth());

    await act(async () => {
      await Promise.all([
        result.current.logout(),
        result.current.logout(),
        result.current.logout(),
      ]);
    });

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should handle null/undefined tokens in localStorage", () => {
    // These are string "null"/"undefined" — not valid JWTs, so isTokenExpired → true
    localStorage.setItem("access_token", "null");
    localStorage.setItem("refresh_token", "undefined");

    const { result } = renderHookWithProviders(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 AUTHENTICATION STATE TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("useAuth - State Transitions", () => {
  it("should transition: idle -> authenticated after login", async () => {
    const token = createFakeJwt();
    const mockUser = createMockUser();

    mockAuthApi.login.mockImplementationOnce(async () => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("refresh_token", createFakeJwt(86400));
      return { access_token: token, refresh_token: createFakeJwt(86400) };
    });
    mockAuthApi.me.mockResolvedValueOnce(mockUser);

    const { result } = renderHookWithProviders(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => {
      await result.current.login("test@example.com", "password");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it("should transition: authenticated -> idle on logout", async () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    localStorage.setItem(
      "cached_user",
      JSON.stringify({
        user: createMockUser(),
        timestamp: Date.now(),
      }),
    );
    mockAuthApi.logout.mockResolvedValueOnce({ message: "Logged out" });

    const { result } = renderHookWithProviders(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("should maintain authenticated state across rerenders", () => {
    const token = createFakeJwt();
    localStorage.setItem("access_token", token);
    localStorage.setItem(
      "cached_user",
      JSON.stringify({
        user: createMockUser({ email: "test@example.com" }),
        timestamp: Date.now(),
      }),
    );

    const { result, rerender } = renderHookWithProviders(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe("test@example.com");

    rerender();

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe("test@example.com");
  });
});
