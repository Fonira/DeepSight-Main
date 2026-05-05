/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🧩 HUB WORKSPACES PAGE — Hub Workspace MVP (Wave 2b Agent D)                      ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Page protégée Expert-only servant DEUX modes via React Router :                   ║
 * ║                                                                                    ║
 * ║  - /hub/workspaces       → mode "list" : grid de cards workspaces                  ║
 * ║  - /hub/workspaces/:id   → mode "detail" : embed Miro + analyses                   ║
 * ║                                                                                    ║
 * ║  Backend : PR #335 (`/api/hub/workspaces`).                                        ║
 * ║  Embed   : `<MiroBoardEmbed>` (Wave 2a A).                                         ║
 * ║  Store   : `useHubWorkspacesStore` (Wave 2a B) — Zustand + Immer.                  ║
 * ║                                                                                    ║
 * ║  Polling automatique en mode detail tant que status ∈ {pending, creating}.         ║
 * ║  Gating : non-Expert → CTA full-page upgrade (pas de redirect, on convertit).      ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Crown,
  Layers,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Sidebar } from "../components/layout/Sidebar";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";
import { DoodleEmptyState } from "../components/doodles";
import { MiroBoardEmbed } from "../components/hub";
import { DeepSightSpinnerSmall } from "../components/ui/DeepSightSpinner";
import { useAuth } from "../hooks/useAuth";
import {
  useHubWorkspacesStore,
  type HubWorkspaceErrorState,
} from "../store/useHubWorkspacesStore";
import type { HubWorkspace, HubWorkspaceStatus } from "../services/api";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔁 POLLING CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const POLL_INTERVAL_MS = 3000;

// ═══════════════════════════════════════════════════════════════════════════════
// 🕒 RELATIVE DATE FORMATTER (FR — pas de dépendance date-fns externe à ajouter)
// ═══════════════════════════════════════════════════════════════════════════════

function formatRelativeDate(iso: string | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffSecs = Math.max(0, (Date.now() - t) / 1000);
  if (diffSecs < 60) return "à l'instant";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays} j`;
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} sem.`;
  if (diffDays < 365) return `il y a ${Math.floor(diffDays / 30)} mois`;
  return `il y a ${Math.floor(diffDays / 365)} an${Math.floor(diffDays / 365) > 1 ? "s" : ""}`;
}

function formatAbsoluteDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

interface StatusBadgeProps {
  status: HubWorkspaceStatus;
}

const STATUS_LABEL: Record<HubWorkspaceStatus, string> = {
  pending: "En attente",
  creating: "En création",
  ready: "Prêt",
  failed: "Échec",
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const isLoading = status === "pending" || status === "creating";
  const tone =
    status === "ready"
      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
      : status === "failed"
        ? "bg-red-500/15 border-red-500/30 text-red-300"
        : "bg-amber-500/15 border-amber-500/30 text-amber-300";

  return (
    <span
      data-testid={`hub-workspace-status-${status}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${tone} ${isLoading ? "animate-pulse" : ""}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "ready"
            ? "bg-emerald-400"
            : status === "failed"
              ? "bg-red-400"
              : "bg-amber-400"
        }`}
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🃏 WORKSPACE CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface WorkspaceCardProps {
  workspace: HubWorkspace;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
  isDeleting?: boolean;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspace,
  onOpen,
  onDelete,
  isDeleting = false,
}) => {
  const handleCardClick = () => onOpen(workspace.id);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(workspace.id);
    }
  };
  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (
      window.confirm(
        `Supprimer le workspace « ${workspace.name} » ? Cette action est irréversible.`,
      )
    ) {
      onDelete(workspace.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      aria-label={`Ouvrir le workspace ${workspace.name}`}
      data-testid={`hub-workspace-card-${workspace.id}`}
      className="group relative cursor-pointer backdrop-blur-xl bg-white/5 hover:bg-white/[0.07] border border-white/10 hover:border-white/20 rounded-2xl p-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <Layers className="w-4 h-4 text-indigo-300" />
            </div>
            <StatusBadge status={workspace.status} />
          </div>
          <h3 className="text-base font-semibold text-white truncate mb-1.5">
            {workspace.name}
          </h3>
          <p className="text-xs text-text-secondary flex items-center gap-1.5">
            <Calendar className="w-3 h-3" aria-hidden />
            {formatRelativeDate(workspace.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={isDeleting}
          aria-label={`Supprimer le workspace ${workspace.name}`}
          className="shrink-0 p-2 rounded-lg text-red-300/70 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
          data-testid={`hub-workspace-card-delete-${workspace.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
          <Sparkles className="w-3 h-3 text-indigo-300" aria-hidden />
          {workspace.summary_ids.length} analyse
          {workspace.summary_ids.length > 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-text-muted group-hover:text-white transition-colors">
          Ouvrir
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
        </span>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🦴 SKELETONS
// ═══════════════════════════════════════════════════════════════════════════════

const ListSkeleton: React.FC = () => (
  <div
    className="grid grid-cols-1 md:grid-cols-2 gap-4"
    data-testid="hub-workspaces-list-skeleton"
  >
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-white/10" />
          <div className="flex-1">
            <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
            <div className="h-3 w-1/3 bg-white/10 rounded" />
          </div>
        </div>
        <div className="h-3 w-1/2 bg-white/5 rounded" />
      </div>
    ))}
  </div>
);

const DetailSkeleton: React.FC = () => (
  <div
    className="space-y-4 animate-pulse"
    data-testid="hub-workspaces-detail-skeleton"
  >
    <div className="h-8 w-2/3 bg-white/10 rounded" />
    <div className="h-4 w-1/2 bg-white/5 rounded" />
    <div className="h-[500px] w-full bg-white/5 border border-white/10 rounded-2xl" />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 🚫 ERROR / ACCESS BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

interface ErrorBlockProps {
  error: HubWorkspaceErrorState;
  onRetry?: () => void;
}

const ErrorBlock: React.FC<ErrorBlockProps> = ({ error, onRetry }) => (
  <div
    role="alert"
    data-testid="hub-workspaces-error"
    className="backdrop-blur-xl bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center"
  >
    <p className="text-sm font-semibold text-amber-300 mb-1">
      Une erreur est survenue
    </p>
    <p className="text-xs text-amber-200/80 mb-4">{error.message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-xs font-medium text-amber-200 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        data-testid="hub-workspaces-error-retry"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Réessayer
      </button>
    )}
  </div>
);

const ExpertGate: React.FC<{ plan: string | undefined }> = ({ plan }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      role="region"
      aria-label="Fonctionnalité réservée au plan Expert"
      data-testid="hub-workspaces-expert-gate"
      className="backdrop-blur-xl bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-cyan-500/10 border border-white/10 rounded-2xl p-8 text-center max-w-2xl mx-auto"
    >
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
        <Crown className="w-7 h-7 text-white" aria-hidden />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">
        Workspaces Hub — réservé au plan Expert
      </h2>
      <p className="text-sm text-text-secondary mb-1">
        Crée des tableaux Miro pour explorer plusieurs analyses ensemble,
        cartographier tes idées, et faire émerger des connexions inattendues.
      </p>
      <p className="text-xs text-text-muted mb-6">
        Ton plan actuel : <span className="font-medium">{plan ?? "free"}</span>
      </p>
      <button
        type="button"
        onClick={() => navigate("/upgrade")}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        data-testid="hub-workspaces-upgrade-cta"
      >
        Passer au plan Expert
        <ArrowUpRight className="w-4 h-4" aria-hidden />
      </button>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 LIST MODE
// ═══════════════════════════════════════════════════════════════════════════════

interface ListModeProps {
  workspaces: HubWorkspace[];
  isLoading: boolean;
  error: HubWorkspaceErrorState | null;
  onRetry: () => void;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}

const ListMode: React.FC<ListModeProps> = ({
  workspaces,
  isLoading,
  error,
  onRetry,
  onOpen,
  onDelete,
}) => {
  if (isLoading && workspaces.length === 0) {
    return <ListSkeleton />;
  }
  if (error) {
    return <ErrorBlock error={error} onRetry={onRetry} />;
  }
  if (workspaces.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12"
        data-testid="hub-workspaces-empty"
      >
        <DoodleEmptyState type="no-playlists">
          <div className="text-center max-w-md">
            <p className="text-base font-medium text-white mb-1">
              Aucun workspace pour l'instant
            </p>
            <p className="text-sm text-text-secondary">
              Sélectionne 2 à 20 analyses depuis le drawer du Hub pour créer ton
              premier workspace.
            </p>
          </div>
        </DoodleEmptyState>
      </div>
    );
  }
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
      data-testid="hub-workspaces-grid"
    >
      <AnimatePresence mode="popLayout">
        {workspaces.map((ws) => (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 DETAIL MODE
// ═══════════════════════════════════════════════════════════════════════════════

interface DetailModeProps {
  id: number;
  workspace: HubWorkspace | null;
  isLoading: boolean;
  error: HubWorkspaceErrorState | null;
  onBack: () => void;
  onRefetch: () => void;
  onDelete: (id: number) => void;
}

const DetailMode: React.FC<DetailModeProps> = ({
  id,
  workspace,
  isLoading,
  error,
  onBack,
  onRefetch,
  onDelete,
}) => {
  if (isLoading && !workspace) {
    return <DetailSkeleton />;
  }
  if (error && error.status === 404) {
    return (
      <div
        role="alert"
        data-testid="hub-workspaces-detail-not-found"
        className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center max-w-xl mx-auto"
      >
        <p className="text-base font-semibold text-white mb-1">
          Workspace introuvable
        </p>
        <p className="text-sm text-text-secondary mb-5">
          Ce workspace n'existe pas ou ne t'appartient pas.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </button>
      </div>
    );
  }
  if (error) {
    return <ErrorBlock error={error} onRetry={onRefetch} />;
  }
  if (!workspace) {
    return <DetailSkeleton />;
  }

  const handleDelete = () => {
    if (
      window.confirm(
        `Supprimer le workspace « ${workspace.name} » ? Cette action est irréversible.`,
      )
    ) {
      onDelete(workspace.id);
    }
  };

  return (
    <div className="space-y-6" data-testid={`hub-workspaces-detail-${id}`}>
      {/* Header */}
      <header>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-text-secondary hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          data-testid="hub-workspaces-detail-back"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour aux workspaces
        </button>

        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2 break-words">
              {workspace.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              <StatusBadge status={workspace.status} />
              <span className="inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-300" aria-hidden />
                {workspace.summary_ids.length} analyse
                {workspace.summary_ids.length > 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" aria-hidden />
                Créé : {formatAbsoluteDate(workspace.created_at)}
              </span>
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" aria-hidden />
                Mise à jour : {formatRelativeDate(workspace.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Miro embed */}
      <MiroBoardEmbed
        boardId={workspace.miro_board_id}
        viewLink={workspace.miro_board_url}
        status={workspace.status}
        errorMessage={workspace.error_message}
        height={700}
        onRetry={onRefetch}
      />

      {/* Analyses du workspace */}
      <section
        className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5"
        data-testid="hub-workspaces-analyses-section"
      >
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-300" aria-hidden />
          Analyses du workspace
        </h2>
        {workspace.summary_ids.length === 0 ? (
          <p className="text-xs text-text-muted">
            Aucune analyse n'est associée à ce workspace.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {workspace.summary_ids.map((summaryId) => (
              <li key={summaryId}>
                <Link
                  to={`/analysis/${summaryId}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-text-secondary hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                  data-testid={`hub-workspaces-analysis-link-${summaryId}`}
                >
                  <span className="truncate">Analyse #{summaryId}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-medium text-red-300 hover:text-red-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
          data-testid="hub-workspaces-detail-delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Supprimer ce workspace
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const HubWorkspacesPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const detailId = useMemo(() => {
    if (!params.id) return null;
    const n = Number(params.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.id]);
  const isDetailMode = detailId !== null;

  const { user, loading: authLoading } = useAuth();
  const isExpert = user?.plan === "expert" || user?.is_admin === true;

  // Sidebar state (cohérent avec les autres pages protégées)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Store
  const workspaces = useHubWorkspacesStore((s) => s.workspaces);
  const isLoadingList = useHubWorkspacesStore((s) => s.isLoadingList);
  const listError = useHubWorkspacesStore((s) => s.listError);
  const currentWorkspace = useHubWorkspacesStore((s) => s.currentWorkspace);
  const isLoadingCurrent = useHubWorkspacesStore((s) => s.isLoadingCurrent);
  const fetchWorkspaces = useHubWorkspacesStore((s) => s.fetchWorkspaces);
  const fetchWorkspace = useHubWorkspacesStore((s) => s.fetchWorkspace);
  const deleteWorkspace = useHubWorkspacesStore((s) => s.deleteWorkspace);
  const clearErrors = useHubWorkspacesStore((s) => s.clearErrors);
  const reset = useHubWorkspacesStore((s) => s.reset);

  // ─── Initial fetch (list mode) ─────────────────────────────────────────────
  useEffect(() => {
    if (!isExpert) return;
    if (isDetailMode) return;
    clearErrors();
    fetchWorkspaces();
  }, [isExpert, isDetailMode, clearErrors, fetchWorkspaces]);

  // ─── Initial fetch (detail mode) ───────────────────────────────────────────
  useEffect(() => {
    if (!isExpert) return;
    if (!isDetailMode || detailId === null) return;
    clearErrors();
    fetchWorkspace(detailId);
  }, [isExpert, isDetailMode, detailId, clearErrors, fetchWorkspace]);

  // ─── Polling on detail mode while pending/creating ─────────────────────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isDetailMode || detailId === null) return;
    if (!currentWorkspace) return;
    const needsPolling =
      currentWorkspace.status === "pending" ||
      currentWorkspace.status === "creating";
    if (!needsPolling) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      void fetchWorkspace(detailId);
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [
    isDetailMode,
    detailId,
    currentWorkspace?.status,
    currentWorkspace,
    fetchWorkspace,
  ]);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      reset();
    };
  }, [reset]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleOpen = useCallback(
    (id: number) => navigate(`/hub/workspaces/${id}`),
    [navigate],
  );
  const handleBack = useCallback(() => navigate("/hub/workspaces"), [navigate]);
  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteWorkspace(id);
        if (isDetailMode && detailId === id) {
          navigate("/hub/workspaces");
        }
      } catch {
        // Erreur déjà capturée dans le store (listError) — pas de toast ici (Wave 2c)
      }
    },
    [deleteWorkspace, isDetailMode, detailId, navigate],
  );
  const handleRefetchList = useCallback(() => {
    clearErrors();
    fetchWorkspaces();
  }, [clearErrors, fetchWorkspaces]);
  const handleRefetchDetail = useCallback(() => {
    if (detailId === null) return;
    clearErrors();
    fetchWorkspace(detailId);
  }, [clearErrors, detailId, fetchWorkspace]);

  // ─── Render ────────────────────────────────────────────────────────────────
  const renderInner = () => {
    if (authLoading) {
      return (
        <div
          className="flex items-center justify-center py-12"
          data-testid="hub-workspaces-auth-loading"
        >
          <DeepSightSpinnerSmall />
        </div>
      );
    }
    if (!isExpert) {
      return <ExpertGate plan={user?.plan} />;
    }
    if (isDetailMode && detailId !== null) {
      return (
        <DetailMode
          id={detailId}
          workspace={currentWorkspace}
          isLoading={isLoadingCurrent}
          error={listError}
          onBack={handleBack}
          onRefetch={handleRefetchDetail}
          onDelete={handleDelete}
        />
      );
    }
    return (
      <ListMode
        workspaces={workspaces}
        isLoading={isLoadingList}
        error={listError}
        onRetry={handleRefetchList}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />
    );
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO
        title={isDetailMode ? "Workspace Hub" : "Mes Workspaces"}
        path={isDetailMode ? `/hub/workspaces/${detailId}` : "/hub/workspaces"}
        noindex
      />
      <DoodleBackground variant="video" />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <main
        className={`transition-all duration-200 ease-out relative z-10 lg:${sidebarCollapsed ? "ml-[60px]" : "ml-[240px]"}`}
      >
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pb-8 pt-14 lg:pt-8">
          <div className="max-w-5xl mx-auto">
            {!isDetailMode && (
              <header className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2">
                  Mes Workspaces
                </h1>
                <p className="text-sm text-text-secondary">
                  Tableaux Miro pour explorer plusieurs analyses ensemble.
                </p>
              </header>
            )}
            {renderInner()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HubWorkspacesPage;
