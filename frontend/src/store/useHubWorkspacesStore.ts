/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🧩 useHubWorkspacesStore — Zustand store for Hub Miro Workspaces                  ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Spec : Sprint Hub Miro Workspace MVP — Wave 2a Agent B                            ║
 * ║  Backend : PR #335 (commit 17bf81ae) — endpoints /api/hub/workspaces               ║
 * ║                                                                                    ║
 * ║  Distinct du store `useHubStore` existant (conversations / messages / tabs).        ║
 * ║  Pas de persist — workspaces fetched fresh à chaque mount.                          ║
 * ║                                                                                    ║
 * ║  Erreurs API : on conserve le `status` dans le state via les codes friendly        ║
 * ║  pour que l'UI puisse distinguer 401 / 403 / 404 / 429 / 400 via le message ou     ║
 * ║  via les flags `isQuotaError` / `isGatingError` dérivés en lecture.                 ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  hubApi,
  ApiError,
  type HubWorkspace,
  type HubWorkspaceCreatePayload,
} from "../services/api";

// ═══════════════════════════════════════════════════════════════════════════════
// 🪪 Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface HubWorkspaceErrorState {
  status: number; // 0 si network error / non-ApiError
  message: string;
  /** True si quota cap 5/30j atteint (HTTP 429). */
  isQuotaError: boolean;
  /** True si l'utilisateur n'est pas Expert (HTTP 403). */
  isGatingError: boolean;
}

interface HubWorkspacesState {
  // ─── List ────────────────────────────────────────────────────────────────
  workspaces: HubWorkspace[];
  total: number;
  isLoadingList: boolean;
  listError: HubWorkspaceErrorState | null;

  // ─── Current ─────────────────────────────────────────────────────────────
  currentWorkspace: HubWorkspace | null;
  isLoadingCurrent: boolean;

  // ─── Mutations ───────────────────────────────────────────────────────────
  isCreating: boolean;
  createError: HubWorkspaceErrorState | null;

  // ─── Actions ─────────────────────────────────────────────────────────────
  fetchWorkspaces: (params?: {
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  fetchWorkspace: (id: number) => Promise<void>;
  createWorkspace: (
    payload: HubWorkspaceCreatePayload,
  ) => Promise<HubWorkspace>;
  deleteWorkspace: (id: number) => Promise<void>;
  clearErrors: () => void;
  reset: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function toErrorState(err: unknown, fallback: string): HubWorkspaceErrorState {
  if (err instanceof ApiError) {
    let friendly = err.message || fallback;
    const isQuota = err.status === 429;
    const isGating = err.status === 403;
    if (isQuota) {
      friendly =
        "Limite 5 workspaces atteinte sur les 30 derniers jours. " +
        "Supprimez un workspace existant pour en créer un nouveau.";
    } else if (isGating) {
      friendly =
        "Cette fonctionnalité est réservée au plan Expert. " +
        "Mettez à niveau votre abonnement pour créer des workspaces Hub.";
    }
    return {
      status: err.status,
      message: friendly,
      isQuotaError: isQuota,
      isGatingError: isGating,
    };
  }
  const message = err instanceof Error ? err.message : fallback;
  return {
    status: 0,
    message,
    isQuotaError: false,
    isGatingError: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌱 Initial state
// ═══════════════════════════════════════════════════════════════════════════════

const INITIAL: Pick<
  HubWorkspacesState,
  | "workspaces"
  | "total"
  | "isLoadingList"
  | "listError"
  | "currentWorkspace"
  | "isLoadingCurrent"
  | "isCreating"
  | "createError"
> = {
  workspaces: [],
  total: 0,
  isLoadingList: false,
  listError: null,
  currentWorkspace: null,
  isLoadingCurrent: false,
  isCreating: false,
  createError: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏪 Store
// ═══════════════════════════════════════════════════════════════════════════════

export const useHubWorkspacesStore = create<HubWorkspacesState>()(
  immer((set, get) => ({
    ...INITIAL,

    // ─── fetchWorkspaces ─────────────────────────────────────────────────
    fetchWorkspaces: async (params) => {
      set((s) => {
        s.isLoadingList = true;
        s.listError = null;
      });
      try {
        const res = await hubApi.listWorkspaces(params);
        set((s) => {
          s.workspaces = res.items;
          s.total = res.total;
          s.isLoadingList = false;
        });
      } catch (err) {
        set((s) => {
          s.listError = toErrorState(
            err,
            "Impossible de charger les workspaces.",
          );
          s.isLoadingList = false;
        });
      }
    },

    // ─── fetchWorkspace ──────────────────────────────────────────────────
    fetchWorkspace: async (id) => {
      set((s) => {
        s.isLoadingCurrent = true;
      });
      try {
        const ws = await hubApi.getWorkspace(id);
        set((s) => {
          s.currentWorkspace = ws;
          s.isLoadingCurrent = false;
        });
      } catch (err) {
        set((s) => {
          s.listError = toErrorState(
            err,
            "Impossible de charger ce workspace.",
          );
          s.isLoadingCurrent = false;
        });
      }
    },

    // ─── createWorkspace ─────────────────────────────────────────────────
    createWorkspace: async (payload) => {
      set((s) => {
        s.isCreating = true;
        s.createError = null;
      });
      try {
        const ws = await hubApi.createWorkspace(payload);
        set((s) => {
          // Push en tête de liste pour reflet immédiat dans l'UI
          s.workspaces.unshift(ws);
          s.total = s.total + 1;
          s.isCreating = false;
        });
        return ws;
      } catch (err) {
        set((s) => {
          s.createError = toErrorState(
            err,
            "Impossible de créer le workspace.",
          );
          s.isCreating = false;
        });
        // Re-throw pour que l'UI (modal, toast, redirect) puisse aussi gérer
        throw err;
      }
    },

    // ─── deleteWorkspace ─────────────────────────────────────────────────
    deleteWorkspace: async (id) => {
      // Optimistic remove — snapshot avant suppression pour rollback éventuel
      const snapshot = get().workspaces;
      const previousTotal = get().total;
      set((s) => {
        s.workspaces = s.workspaces.filter((w) => w.id !== id);
        s.total = Math.max(0, s.total - 1);
      });
      try {
        await hubApi.deleteWorkspace(id);
      } catch (err) {
        // Rollback optimistic + reload depuis serveur pour réconcilier
        set((s) => {
          s.workspaces = snapshot;
          s.total = previousTotal;
          s.listError = toErrorState(
            err,
            "Impossible de supprimer ce workspace.",
          );
        });
        // Re-fetch pour s'assurer de la source de vérité
        try {
          const res = await hubApi.listWorkspaces();
          set((s) => {
            s.workspaces = res.items;
            s.total = res.total;
          });
        } catch {
          // Si même la liste re-fetch échoue, on garde le snapshot rollback
        }
        throw err;
      }
    },

    // ─── clearErrors ─────────────────────────────────────────────────────
    clearErrors: () => {
      set((s) => {
        s.listError = null;
        s.createError = null;
      });
    },

    // ─── reset ───────────────────────────────────────────────────────────
    reset: () => {
      set((s) => {
        Object.assign(s, INITIAL);
      });
    },
  })),
);
