/**
 * 🧪 Tests — DevicesPage (Auth V2 Wave 1 Step 2)
 *
 * Couvre :
 *   1. fetch listSessions au mount → API appelée
 *   2. render des cards avec device_label + badge "Cette session" si current
 *   3. clic "Révoquer" sur non-current → confirm + revokeSession + refresh
 *   4. clic "Déconnecter tous les autres" → confirm + revokeAllOtherSessions + refresh
 *   5. erreur fetch → message d'erreur affiché
 *
 * Pattern emprunté à SearchPage.test.tsx (mock Sidebar/DoodleBackground/SEO).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { ThemeProvider } from "../../contexts/ThemeContext";
import DevicesPage from "../DevicesPage";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const listSessionsMock = vi.fn();
const revokeSessionMock = vi.fn();
const revokeAllOtherSessionsMock = vi.fn();

vi.mock("../../services/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../services/api")>(
      "../../services/api",
    );
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      listSessions: (...args: unknown[]) => listSessionsMock(...args),
      revokeSession: (...args: unknown[]) => revokeSessionMock(...args),
      revokeAllOtherSessions: (...args: unknown[]) =>
        revokeAllOtherSessionsMock(...args),
    },
  };
});

vi.mock("../../components/layout/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("../../components/DoodleBackground", () => ({ default: () => null }));
vi.mock("../../components/SEO", () => ({ SEO: () => null }));

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/settings/devices"]}>
        <ThemeProvider>
          <LanguageProvider>
            <DevicesPage />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SESSION_CURRENT = {
  id: "00000000-0000-4000-8000-000000000001",
  device_label: "Chrome on macOS",
  ip_hash: "abcd1234ef5678",
  user_agent: "Mozilla/5.0 Chrome/Mac",
  last_seen_at: new Date(Date.now() - 60_000).toISOString(),
  created_at: new Date(Date.now() - 3_600_000).toISOString(),
  current: true,
};

const SESSION_OTHER = {
  id: "00000000-0000-4000-8000-000000000002",
  device_label: "Safari on iPhone",
  ip_hash: "ffff9999aaaa11",
  user_agent: "Mozilla/5.0 iPhone Safari",
  last_seen_at: new Date(Date.now() - 7_200_000).toISOString(),
  created_at: new Date(Date.now() - 86_400_000).toISOString(),
  current: false,
};

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  listSessionsMock.mockReset();
  revokeSessionMock.mockReset();
  revokeAllOtherSessionsMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("DevicesPage - Fetch on mount", () => {
  it("calls authApi.listSessions on mount and renders sessions", async () => {
    listSessionsMock.mockResolvedValueOnce([SESSION_CURRENT, SESSION_OTHER]);
    renderPage();

    await waitFor(() => {
      expect(listSessionsMock).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Chrome on macOS")).toBeInTheDocument();
    expect(await screen.findByText("Safari on iPhone")).toBeInTheDocument();
    // Badge "Cette session" sur la session courante
    expect(screen.getByText(/Cette session/i)).toBeInTheDocument();
  });
});

describe("DevicesPage - Revoke single session", () => {
  it("calls revokeSession and refetches when confirming revoke", async () => {
    listSessionsMock
      .mockResolvedValueOnce([SESSION_CURRENT, SESSION_OTHER])
      .mockResolvedValueOnce([SESSION_CURRENT]);
    revokeSessionMock.mockResolvedValueOnce({
      success: true,
      message: "Session révoquée",
    });

    // window.confirm → accepter
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Safari on iPhone");

    // Click sur le bouton "Révoquer" du non-current (aria-label)
    const revokeBtn = screen.getByRole("button", {
      name: /Révoquer cette session/i,
    });
    await user.click(revokeBtn);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(revokeSessionMock).toHaveBeenCalledWith(SESSION_OTHER.id);
    });
    // Refetch
    await waitFor(() => {
      expect(listSessionsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("does NOT call revokeSession when user cancels confirm", async () => {
    listSessionsMock.mockResolvedValueOnce([SESSION_CURRENT, SESSION_OTHER]);
    vi.spyOn(window, "confirm").mockImplementation(() => false);

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Safari on iPhone");

    const revokeBtn = screen.getByRole("button", {
      name: /Révoquer cette session/i,
    });
    await user.click(revokeBtn);

    expect(revokeSessionMock).not.toHaveBeenCalled();
    // Only the initial fetch
    expect(listSessionsMock).toHaveBeenCalledTimes(1);
  });
});

describe("DevicesPage - Revoke all other sessions", () => {
  it("calls revokeAllOtherSessions and refetches", async () => {
    listSessionsMock
      .mockResolvedValueOnce([SESSION_CURRENT, SESSION_OTHER])
      .mockResolvedValueOnce([SESSION_CURRENT]);
    revokeAllOtherSessionsMock.mockResolvedValueOnce({
      success: true,
      message: "✅ 1 sessions révoquées",
    });

    vi.spyOn(window, "confirm").mockImplementation(() => true);

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Safari on iPhone");

    const allBtn = screen.getByRole("button", {
      name: /Déconnecter tous les autres appareils/i,
    });
    await user.click(allBtn);

    await waitFor(() => {
      expect(revokeAllOtherSessionsMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(listSessionsMock).toHaveBeenCalledTimes(2);
    });
  });
});

describe("DevicesPage - Error state", () => {
  it("shows error message when fetch fails", async () => {
    listSessionsMock.mockRejectedValueOnce(new Error("Network down"));
    renderPage();

    expect(await screen.findByText(/Network down/i)).toBeInTheDocument();
    // Retry button visible
    expect(
      screen.getByRole("button", { name: /Réessayer/i }),
    ).toBeInTheDocument();
  });
});
