/**
 * Tests for useAuthResumeHandler hook
 *
 * Covers: AppState transitions, /api/auth/me ping, force logout on 401,
 * retry on 5xx, no-op when not authenticated.
 */
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";

// Capture AppState listener so we can fire transitions manually.
let appStateListener: ((state: AppStateStatus) => void) | null = null;
const mockRemove = jest.fn();
jest.spyOn(AppState, "addEventListener").mockImplementation(
  (_event: string, callback: (state: AppStateStatus) => void) => {
    appStateListener = callback;
    return { remove: mockRemove } as { remove: () => void };
  },
);

const mockGetMe = jest.fn();
const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();

jest.mock("../../src/services/api", () => ({
  authApi: {
    getMe: (...args: unknown[]) => mockGetMe(...args),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    detail?: string;
    constructor(
      message: string,
      status: number,
      code?: string,
      detail?: string,
    ) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.detail = detail;
    }
  },
}));

jest.mock("../../src/services/CrashReporting", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

// Import after mocks are set up.
import { useAuthResumeHandler } from "../../src/hooks/useAuthResumeHandler";
import { ApiError } from "../../src/services/api";

// Use a microtask-based flush that works with fake timers.
const flushPromises = () =>
  new Promise<void>((resolve) => {
    Promise.resolve().then(() => Promise.resolve().then(() => resolve()));
  });

describe("useAuthResumeHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = null;
  });

  it("does not ping /me on mount (no-op until AppState change)", async () => {
    const forceLogout = jest.fn();
    renderHook(() =>
      useAuthResumeHandler({ isAuthenticated: true, forceLogout }),
    );

    expect(appStateListener).not.toBeNull();
    expect(mockGetMe).not.toHaveBeenCalled();
    expect(forceLogout).not.toHaveBeenCalled();
  });

  it("pings /me on background → active transition (200 → no-op)", async () => {
    const forceLogout = jest.fn();
    mockGetMe.mockResolvedValueOnce({ id: 1, email: "test@example.com" });

    renderHook(() =>
      useAuthResumeHandler({ isAuthenticated: true, forceLogout }),
    );

    act(() => {
      // Simulate: background → active.
      appStateListener?.("background");
      appStateListener?.("active");
    });

    await flushPromises();

    expect(mockGetMe).toHaveBeenCalledTimes(1);
    expect(forceLogout).not.toHaveBeenCalled();
  });

  it("calls forceLogout when /me returns 401 on resume", async () => {
    const forceLogout = jest.fn().mockResolvedValue(undefined);
    mockGetMe.mockRejectedValueOnce(new ApiError("Unauthorized", 401));

    renderHook(() =>
      useAuthResumeHandler({ isAuthenticated: true, forceLogout }),
    );

    act(() => {
      appStateListener?.("background");
      appStateListener?.("active");
    });

    await waitFor(() => {
      expect(forceLogout).toHaveBeenCalledTimes(1);
    });
    expect(mockGetMe).toHaveBeenCalledTimes(1);
  });

  it("retries once after 2s on 5xx, then logs Sentry if still 5xx", async () => {
    jest.useFakeTimers();
    const forceLogout = jest.fn();
    mockGetMe
      .mockRejectedValueOnce(new ApiError("Server error", 503))
      .mockRejectedValueOnce(new ApiError("Server error", 503));

    renderHook(() =>
      useAuthResumeHandler({ isAuthenticated: true, forceLogout }),
    );

    act(() => {
      appStateListener?.("background");
      appStateListener?.("active");
    });

    // First call fires immediately — flush microtasks for the rejected promise.
    await flushPromises();
    expect(mockGetMe).toHaveBeenCalledTimes(1);
    expect(forceLogout).not.toHaveBeenCalled();

    // Retry scheduled for +2s.
    act(() => {
      jest.advanceTimersByTime(RETRY_DELAY_MS);
    });
    await flushPromises();
    await flushPromises();

    expect(mockGetMe).toHaveBeenCalledTimes(2);
    expect(forceLogout).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining("/me returned 5xx after retry"),
      "warning",
      expect.any(Object),
    );
    jest.useRealTimers();
  });

  it("does not ping /me when isAuthenticated is false", async () => {
    const forceLogout = jest.fn();
    renderHook(() =>
      useAuthResumeHandler({ isAuthenticated: false, forceLogout }),
    );

    act(() => {
      appStateListener?.("background");
      appStateListener?.("active");
    });

    await flushPromises();

    expect(mockGetMe).not.toHaveBeenCalled();
    expect(forceLogout).not.toHaveBeenCalled();
  });
});

// Mirror constant from implementation — exposed only via behavior.
const RETRY_DELAY_MS = 2000;
