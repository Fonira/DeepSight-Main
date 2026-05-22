/**
 * Tests for DevicesScreen — Auth V2 Wave 1 Mobile Step 3.
 *
 * Coverage:
 *  - fetch on mount → renders sessions list
 *  - empty state when API returns []
 *  - revoke one session → API called + refetched
 *  - revoke all others → API called + refetched
 *  - error path → renders error card with retry
 */
import React from "react";
import {
  render,
  fireEvent,
  screen,
  waitFor,
  act,
} from "@testing-library/react-native";
import { Alert } from "react-native";

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Capture Alert.alert calls and auto-trigger the destructive button so we can
// assert the underlying API call without the native confirmation popup.
const alertSpy = jest
  .spyOn(Alert, "alert")
  .mockImplementation((_title, _msg, buttons) => {
    const destructive = (buttons ?? []).find(
      (b) => b.style === "destructive",
    );
    destructive?.onPress?.();
  });

const mockBack = jest.fn();
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    __esModule: true,
    Stack: { Screen: () => null },
    useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: "#0a0a0f",
      bgSecondary: "#12121a",
      bgElevated: "#1e1e2a",
      bgCard: "#15151f",
      textPrimary: "#fff",
      textSecondary: "#f1f5f9",
      textTertiary: "#cbd5e1",
      accentPrimary: "#C8903A",
      accentError: "#ef4444",
      accentWarning: "#f59e0b",
      border: "rgba(255,255,255,0.1)",
    },
  }),
}));

// Mock authApi + ApiError before importing the screen.
const mockListSessions = jest.fn();
const mockRevokeSession = jest.fn();
const mockRevokeAllOtherSessions = jest.fn();
jest.mock("@/services/api", () => ({
  authApi: {
    listSessions: (...args: unknown[]) => mockListSessions(...args),
    revokeSession: (...args: unknown[]) => mockRevokeSession(...args),
    revokeAllOtherSessions: (...args: unknown[]) =>
      mockRevokeAllOtherSessions(...args),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

// Import the screen AFTER mocks are set up.
import DevicesScreen from "../../app/devices";

const SESSIONS_FIXTURE = [
  {
    id: "sess_current",
    device_label: "Chrome on macOS",
    ip_hash: "abc123def456789",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    last_seen_at: new Date(Date.now() - 60_000).toISOString(),
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    current: true,
  },
  {
    id: "sess_other_1",
    device_label: "iPhone",
    ip_hash: "xyz987654321abc",
    user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    last_seen_at: new Date(Date.now() - 3_600_000).toISOString(),
    created_at: new Date(Date.now() - 7_200_000).toISOString(),
    current: false,
  },
];

describe("DevicesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy.mockClear();
  });

  it("fetches sessions on mount and renders the list", async () => {
    mockListSessions.mockResolvedValueOnce(SESSIONS_FIXTURE);

    render(<DevicesScreen />);

    await waitFor(() => {
      expect(mockListSessions).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("session-card-sess_current")).toBeTruthy();
      expect(screen.getByTestId("session-card-sess_other_1")).toBeTruthy();
    });
    // Banner is rendered because there is 1 non-current session.
    expect(screen.getByTestId("revoke-all-btn")).toBeTruthy();
  });

  it("renders empty state when API returns no sessions", async () => {
    mockListSessions.mockResolvedValueOnce([]);

    render(<DevicesScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("devices-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("revoke-all-btn")).toBeNull();
  });

  it("revokes one session and refetches the list", async () => {
    // First fetch — full list. Second fetch (after revoke) — only current.
    mockListSessions
      .mockResolvedValueOnce(SESSIONS_FIXTURE)
      .mockResolvedValueOnce([SESSIONS_FIXTURE[0]]);
    mockRevokeSession.mockResolvedValueOnce({
      success: true,
      message: "OK",
    });

    render(<DevicesScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("revoke-btn-sess_other_1")).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId("revoke-btn-sess_other_1"));
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
      expect(mockRevokeSession).toHaveBeenCalledWith("sess_other_1");
      // Initial + post-revoke fetch.
      expect(mockListSessions).toHaveBeenCalledTimes(2);
    });
  });

  it("revokes all other sessions and refetches", async () => {
    mockListSessions
      .mockResolvedValueOnce(SESSIONS_FIXTURE)
      .mockResolvedValueOnce([SESSIONS_FIXTURE[0]]);
    mockRevokeAllOtherSessions.mockResolvedValueOnce({
      success: true,
      message: "Toutes les autres sessions ont été révoquées.",
    });

    render(<DevicesScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("revoke-all-btn")).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId("revoke-all-btn"));
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
      expect(mockRevokeAllOtherSessions).toHaveBeenCalledTimes(1);
      expect(mockListSessions).toHaveBeenCalledTimes(2);
    });
  });

  it("renders error card when the fetch fails", async () => {
    mockListSessions.mockRejectedValueOnce(new Error("network down"));

    render(<DevicesScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("devices-error")).toBeTruthy();
      expect(screen.getByTestId("devices-retry-btn")).toBeTruthy();
    });
  });
});
