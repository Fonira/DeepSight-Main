/**
 * Tests Vitest pour HubWorkspacesPage (Wave 2b Agent D).
 * Mocks : services/api (hubApi), useAuth, store, Sidebar/SEO/DoodleBackground.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ─── Mocks API ────────────────────────────────────────────────────────────────
vi.mock("../../services/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../services/api")>(
      "../../services/api",
    );
  return {
    ...actual,
    hubApi: {
      createWorkspace: vi.fn(),
      listWorkspaces: vi.fn(),
      getWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
    },
  };
});

// ─── Mocks layout / chrome ────────────────────────────────────────────────────
vi.mock("../../components/layout/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("../../components/DoodleBackground", () => ({ default: () => null }));
vi.mock("../../components/SEO", () => ({ SEO: () => null }));
vi.mock("../../components/doodles", () => ({
  DoodleEmptyState: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="doodle-empty-state">{children}</div>
  ),
}));

// ─── Mock auth — surchargeable par test via mockAuthState ─────────────────────
let mockAuthState: { user: any; loading: boolean } = {
  user: { plan: "expert", is_admin: false, preferences: {} },
  loading: false,
};
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockAuthState,
}));

import { hubApi, type HubWorkspace } from "../../services/api";
import { useHubWorkspacesStore } from "../../store/useHubWorkspacesStore";
import HubWorkspacesPage from "../HubWorkspacesPage";

const mockedHubApi = hubApi as unknown as {
  createWorkspace: ReturnType<typeof vi.fn>;
  listWorkspaces: ReturnType<typeof vi.fn>;
  getWorkspace: ReturnType<typeof vi.fn>;
  deleteWorkspace: ReturnType<typeof vi.fn>;
};

function makeWorkspace(overrides: Partial<HubWorkspace> = {}): HubWorkspace {
  return {
    id: 1,
    name: "Test Workspace",
    summary_ids: [10, 20],
    miro_board_id: null,
    miro_board_url: null,
    status: "pending",
    error_message: null,
    created_at: "2026-05-05T12:00:00Z",
    updated_at: "2026-05-05T12:00:00Z",
    ...overrides,
  };
}

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/hub/workspaces" element={<HubWorkspacesPage />} />
        <Route path="/hub/workspaces/:id" element={<HubWorkspacesPage />} />
        <Route path="/upgrade" element={<div>Upgrade Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HubWorkspacesPage", () => {
  beforeEach(() => {
    useHubWorkspacesStore.getState().reset();
    vi.clearAllMocks();
    mockAuthState = {
      user: { plan: "expert", is_admin: false, preferences: {} },
      loading: false,
    };
  });

  afterEach(() => {
    cleanup();
  });

  // ─── 1. Empty state ─────────────────────────────────────────────────────────
  it("renders empty state when no workspaces", async () => {
    mockedHubApi.listWorkspaces.mockResolvedValueOnce({ items: [], total: 0 });
    renderAtPath("/hub/workspaces");

    await waitFor(() => expect(mockedHubApi.listWorkspaces).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByTestId("hub-workspaces-empty")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Aucun workspace pour l'instant/i),
    ).toBeInTheDocument();
  });

  // ─── 2. Renders cards ──────────────────────────────────────────────────────
  it("renders workspace cards when list non-empty", async () => {
    const items = [
      makeWorkspace({ id: 11, name: "Workspace Alpha", status: "ready" }),
      makeWorkspace({ id: 22, name: "Workspace Beta", status: "creating" }),
    ];
    mockedHubApi.listWorkspaces.mockResolvedValueOnce({ items, total: 2 });
    renderAtPath("/hub/workspaces");

    await waitFor(() => {
      expect(screen.getByTestId("hub-workspace-card-11")).toBeInTheDocument();
      expect(screen.getByTestId("hub-workspace-card-22")).toBeInTheDocument();
    });
    expect(screen.getByText("Workspace Alpha")).toBeInTheDocument();
    expect(screen.getByText("Workspace Beta")).toBeInTheDocument();
  });

  // ─── 3. Card click navigates to detail ─────────────────────────────────────
  it("navigates to detail on card click", async () => {
    const items = [
      makeWorkspace({
        id: 42,
        name: "Workspace Click",
        status: "ready",
        miro_board_id: "miroBoard42",
      }),
    ];
    mockedHubApi.listWorkspaces.mockResolvedValueOnce({ items, total: 1 });
    mockedHubApi.getWorkspace.mockResolvedValueOnce(items[0]);

    renderAtPath("/hub/workspaces");
    const card = await screen.findByTestId("hub-workspace-card-42");

    await act(async () => {
      fireEvent.click(card);
    });

    await waitFor(() => {
      expect(mockedHubApi.getWorkspace).toHaveBeenCalledWith(42);
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("hub-workspaces-detail-42"),
      ).toBeInTheDocument();
    });
  });

  // ─── 4. Detail mode renders MiroBoardEmbed with correct props ──────────────
  it("mode détail : renders MiroBoardEmbed with correct props", async () => {
    const ws = makeWorkspace({
      id: 99,
      name: "Detail Workspace",
      status: "ready",
      miro_board_id: "myBoard99",
      miro_board_url: "https://miro.com/app/board/myBoard99/",
      summary_ids: [101, 202, 303],
    });
    mockedHubApi.getWorkspace.mockResolvedValueOnce(ws);

    renderAtPath("/hub/workspaces/99");

    await waitFor(() => {
      expect(mockedHubApi.getWorkspace).toHaveBeenCalledWith(99);
    });
    await waitFor(() => {
      expect(screen.getByTestId("miro-board-embed-iframe")).toBeInTheDocument();
    });
    const iframe = screen.getByTestId("miro-board-embed-iframe");
    expect(iframe.getAttribute("src")).toContain(
      "https://miro.com/app/embed/myBoard99/",
    );
    // 3 analyses listées
    expect(
      screen.getByTestId("hub-workspaces-analysis-link-101"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("hub-workspaces-analysis-link-202"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("hub-workspaces-analysis-link-303"),
    ).toBeInTheDocument();
  });

  // ─── 5. Polling re-fetches when status creating ────────────────────────────
  it("polling re-fetches when status creating", async () => {
    const wsCreating = makeWorkspace({
      id: 55,
      name: "Polling Test",
      status: "creating",
    });
    const wsReady = makeWorkspace({
      id: 55,
      name: "Polling Test",
      status: "ready",
      miro_board_id: "pollBoard55",
    });
    mockedHubApi.getWorkspace
      .mockResolvedValueOnce(wsCreating)
      .mockResolvedValueOnce(wsCreating)
      .mockResolvedValueOnce(wsReady);

    // Spy sur setInterval pour vérifier que le polling est armé sans dépendre des timers réels
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    renderAtPath("/hub/workspaces/55");

    // 1er fetch déclenché au mount
    await waitFor(() => {
      expect(mockedHubApi.getWorkspace).toHaveBeenCalledTimes(1);
    });

    // Le polling est armé tant que status=creating → setInterval est appelé
    // avec un délai de 3000ms (POLL_INTERVAL_MS).
    await waitFor(() => {
      const pollingCalls = setIntervalSpy.mock.calls.filter(
        (call) => call[1] === 3000,
      );
      expect(pollingCalls.length).toBeGreaterThanOrEqual(1);
    });

    setIntervalSpy.mockRestore();
  });

  // ─── 6. Gating non-Expert ──────────────────────────────────────────────────
  it("gating non-expert shows full-page upgrade CTA", async () => {
    mockAuthState = {
      user: { plan: "free", is_admin: false, preferences: {} },
      loading: false,
    };
    renderAtPath("/hub/workspaces");

    await waitFor(() => {
      expect(
        screen.getByTestId("hub-workspaces-expert-gate"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("hub-workspaces-upgrade-cta"),
    ).toBeInTheDocument();
    // Aucun appel API ne doit avoir lieu pour un non-expert
    expect(mockedHubApi.listWorkspaces).not.toHaveBeenCalled();
  });
});
