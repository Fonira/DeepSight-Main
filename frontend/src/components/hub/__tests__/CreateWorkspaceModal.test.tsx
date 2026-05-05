/**
 * Tests Vitest pour CreateWorkspaceModal.
 * Wave 2b Agent C — Sprint Hub Miro Workspace MVP.
 *
 * Mocks :
 *   - useHubWorkspacesStore (vi.mock du module store)
 *   - react-router-dom : on garde le vrai mais wrap dans MemoryRouter
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CreateWorkspaceModal } from "../CreateWorkspaceModal";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// State mutable utilisé pour reproduire le store Zustand côté test.
interface FakeStoreState {
  isCreating: boolean;
  createError: {
    status: number;
    message: string;
    isQuotaError: boolean;
    isGatingError: boolean;
  } | null;
  createWorkspace: ReturnType<typeof vi.fn>;
  clearErrors: ReturnType<typeof vi.fn>;
}

const fakeState: FakeStoreState = {
  isCreating: false,
  createError: null,
  createWorkspace: vi.fn(),
  clearErrors: vi.fn(),
};

vi.mock("../../../store/useHubWorkspacesStore", () => {
  // Le composant utilise le selector pattern : useStore(s => s.isCreating).
  // On expose une fonction qui prend un selector et lui passe fakeState.
  const useHubWorkspacesStore = <T,>(selector: (s: FakeStoreState) => T): T =>
    selector(fakeState);
  return { useHubWorkspacesStore };
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function renderModal(
  overrides: Partial<{
    isOpen: boolean;
    initialSummaryIds: number[];
    onClose: () => void;
    onCreated: (id: number) => void;
  }> = {},
) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    initialSummaryIds: [10, 20, 30],
    onCreated: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <MemoryRouter>
      <CreateWorkspaceModal {...props} />
    </MemoryRouter>,
  );
  return { ...utils, props };
}

function resetFakeState() {
  fakeState.isCreating = false;
  fakeState.createError = null;
  fakeState.createWorkspace = vi.fn();
  fakeState.clearErrors = vi.fn();
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("CreateWorkspaceModal", () => {
  beforeEach(() => {
    resetFakeState();
    mockNavigate.mockReset();
  });

  it("renders disabled when name empty", () => {
    renderModal();
    const submitBtn = screen.getByRole("button", { name: /^créer$/i });
    expect(submitBtn).toBeDisabled();
  });

  it("submits with correct payload to store", async () => {
    fakeState.createWorkspace = vi.fn().mockResolvedValue({
      id: 99,
      name: "Mon workspace",
      summary_ids: [10, 20, 30],
      miro_board_id: null,
      miro_board_url: null,
      status: "pending",
      error_message: null,
      created_at: "2026-05-05T12:00:00Z",
      updated_at: "2026-05-05T12:00:00Z",
    });

    const { props } = renderModal();
    const input = screen.getByLabelText(/nom du workspace/i);
    fireEvent.change(input, { target: { value: "Mon workspace" } });
    const submitBtn = screen.getByRole("button", { name: /^créer$/i });
    fireEvent.click(submitBtn);

    await waitFor(() =>
      expect(fakeState.createWorkspace).toHaveBeenCalledWith({
        name: "Mon workspace",
        summary_ids: [10, 20, 30],
      }),
    );
    await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith(99));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it("shows quota error with link to /hub/workspaces", async () => {
    fakeState.createError = {
      status: 429,
      message:
        "Limite 5 workspaces atteinte sur les 30 derniers jours. Supprimez un workspace existant pour en créer un nouveau.",
      isQuotaError: true,
      isGatingError: false,
    };
    const { props } = renderModal();
    expect(screen.getByText(/limite 5 workspaces atteinte/i)).toBeInTheDocument();
    const link = screen.getByRole("button", { name: /voir mes workspaces/i });
    fireEvent.click(link);
    expect(props.onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/hub/workspaces");
  });

  it("shows gating error with upgrade CTA", async () => {
    fakeState.createError = {
      status: 403,
      message:
        "Cette fonctionnalité est réservée au plan Expert. Mettez à niveau votre abonnement pour créer des workspaces Hub.",
      isQuotaError: false,
      isGatingError: true,
    };
    const { props } = renderModal();
    expect(screen.getByText(/réservée au plan expert/i)).toBeInTheDocument();
    const upgradeBtn = screen.getByRole("button", {
      name: /passer au plan expert/i,
    });
    fireEvent.click(upgradeBtn);
    expect(props.onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/upgrade");
  });

  it("calls onCreated and onClose on success", async () => {
    fakeState.createWorkspace = vi.fn().mockResolvedValue({
      id: 42,
      name: "WS",
      summary_ids: [1, 2],
      miro_board_id: null,
      miro_board_url: null,
      status: "pending",
      error_message: null,
      created_at: "2026-05-05T12:00:00Z",
      updated_at: "2026-05-05T12:00:00Z",
    });
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderModal({ onCreated, onClose, initialSummaryIds: [1, 2] });
    fireEvent.change(screen.getByLabelText(/nom du workspace/i), {
      target: { value: "Ok" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^créer$/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(42));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
