/**
 * Tests Vitest pour useHubWorkspacesStore.
 * Mocks hubApi via vi.mock — pas de fetch réel.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// IMPORTANT: vi.mock doit être hoisté avant l'import du store.
// On mocke ../../services/api en gardant ApiError concret pour les instanceof checks.
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

import { hubApi, ApiError, type HubWorkspace } from "../../services/api";
import { useHubWorkspacesStore } from "../useHubWorkspacesStore";

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

describe("useHubWorkspacesStore", () => {
  beforeEach(() => {
    useHubWorkspacesStore.getState().reset();
    vi.clearAllMocks();
  });

  it("fetchWorkspaces success — populates workspaces + total", async () => {
    const items = [
      makeWorkspace({ id: 1, name: "WS A" }),
      makeWorkspace({ id: 2, name: "WS B" }),
    ];
    mockedHubApi.listWorkspaces.mockResolvedValueOnce({ items, total: 2 });

    await useHubWorkspacesStore.getState().fetchWorkspaces({ limit: 20 });

    const s = useHubWorkspacesStore.getState();
    expect(s.workspaces).toHaveLength(2);
    expect(s.workspaces[0].name).toBe("WS A");
    expect(s.total).toBe(2);
    expect(s.isLoadingList).toBe(false);
    expect(s.listError).toBeNull();
    expect(mockedHubApi.listWorkspaces).toHaveBeenCalledWith({ limit: 20 });
  });

  it("fetchWorkspaces error — sets listError + isLoadingList=false", async () => {
    mockedHubApi.listWorkspaces.mockRejectedValueOnce(
      new ApiError("Internal", 500),
    );

    await useHubWorkspacesStore.getState().fetchWorkspaces();

    const s = useHubWorkspacesStore.getState();
    expect(s.workspaces).toEqual([]);
    expect(s.isLoadingList).toBe(false);
    expect(s.listError).not.toBeNull();
    expect(s.listError?.status).toBe(500);
  });

  it("createWorkspace success — pushes new workspace at the head", async () => {
    // Préparer la liste existante
    useHubWorkspacesStore.setState({
      workspaces: [makeWorkspace({ id: 1, name: "Existing" })],
      total: 1,
    });

    const created = makeWorkspace({ id: 99, name: "Brand new" });
    mockedHubApi.createWorkspace.mockResolvedValueOnce(created);

    const result = await useHubWorkspacesStore
      .getState()
      .createWorkspace({ name: "Brand new", summary_ids: [10, 20] });

    expect(result.id).toBe(99);
    const s = useHubWorkspacesStore.getState();
    expect(s.workspaces[0].id).toBe(99);
    expect(s.workspaces).toHaveLength(2);
    expect(s.total).toBe(2);
    expect(s.isCreating).toBe(false);
    expect(s.createError).toBeNull();
  });

  it("createWorkspace gating error 403 — friendly Expert message + re-throw", async () => {
    mockedHubApi.createWorkspace.mockRejectedValueOnce(
      new ApiError("Expert plan required", 403),
    );

    await expect(
      useHubWorkspacesStore
        .getState()
        .createWorkspace({ name: "X", summary_ids: [1, 2] }),
    ).rejects.toBeInstanceOf(ApiError);

    const s = useHubWorkspacesStore.getState();
    expect(s.createError).not.toBeNull();
    expect(s.createError?.status).toBe(403);
    expect(s.createError?.isGatingError).toBe(true);
    expect(s.createError?.isQuotaError).toBe(false);
    expect(s.createError?.message.toLowerCase()).toContain("expert");
    expect(s.isCreating).toBe(false);
  });

  it("createWorkspace quota error 429 — friendly Limite 5 message", async () => {
    mockedHubApi.createWorkspace.mockRejectedValueOnce(
      new ApiError("Quota exceeded", 429),
    );

    await expect(
      useHubWorkspacesStore
        .getState()
        .createWorkspace({ name: "X", summary_ids: [1, 2] }),
    ).rejects.toBeInstanceOf(ApiError);

    const s = useHubWorkspacesStore.getState();
    expect(s.createError).not.toBeNull();
    expect(s.createError?.status).toBe(429);
    expect(s.createError?.isQuotaError).toBe(true);
    expect(s.createError?.isGatingError).toBe(false);
    expect(s.createError?.message).toContain("Limite 5");
    expect(s.isCreating).toBe(false);
  });

  it("deleteWorkspace optimistic remove — workspace disparait avant settle", async () => {
    useHubWorkspacesStore.setState({
      workspaces: [
        makeWorkspace({ id: 1, name: "Keep" }),
        makeWorkspace({ id: 2, name: "Delete me" }),
        makeWorkspace({ id: 3, name: "Keep too" }),
      ],
      total: 3,
    });

    // Resolve avec un délai pour observer l'état optimistic
    let resolveDelete: () => void = () => {};
    mockedHubApi.deleteWorkspace.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const deletePromise = useHubWorkspacesStore.getState().deleteWorkspace(2);

    // Vérifier le retrait optimistic AVANT que la promise serveur ne resolve
    const sMid = useHubWorkspacesStore.getState();
    expect(sMid.workspaces.find((w) => w.id === 2)).toBeUndefined();
    expect(sMid.workspaces).toHaveLength(2);
    expect(sMid.total).toBe(2);

    // Maintenant resolve la promise serveur
    resolveDelete();
    await deletePromise;

    const sFinal = useHubWorkspacesStore.getState();
    expect(sFinal.workspaces).toHaveLength(2);
    expect(sFinal.workspaces.map((w) => w.id)).toEqual([1, 3]);
    expect(sFinal.total).toBe(2);
  });
});
