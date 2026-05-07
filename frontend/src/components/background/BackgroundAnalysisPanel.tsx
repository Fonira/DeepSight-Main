/**
 * BackgroundAnalysisPanel — popover déclenché par BackgroundAnalysisFAB
 * ───────────────────────────────────────────────────────────────────────────
 * Liste les analyses en cours / terminées récemment / en échec.
 * - Bouton « Voir » → navigate vers la page d'analyse correspondante.
 * - Bouton « Réessayer » sur task failed → retryTask du context.
 * - Ligne quota mensuel + lien /pricing si proche limite.
 * - Bouton « Effacer terminées » → clearCompleted du context.
 */

import React, { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Eye, RefreshCw, Trash2, X, AlertTriangle } from "lucide-react";
import {
  useBackgroundAnalysis,
  type AnalysisTask,
  type VideoAnalysisTask,
  type PlaylistAnalysisTask,
} from "../../contexts/BackgroundAnalysisContext";
import { authApi } from "../../services/api";

interface BackgroundAnalysisPanelProps {
  open: boolean;
  onClose: () => void;
}

const QUOTA_WARN_THRESHOLD = 0.2; // < 20% restant → orange

function formatEta(task: AnalysisTask): string {
  if (task.status === "completed") return "Terminée";
  if (task.status === "failed") return "Échec";
  if (task.progress <= 0) return "—";
  const elapsedMs = Date.now() - task.startedAt.getTime();
  const totalMs = (elapsedMs / task.progress) * 100;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  if (remainingMs > 30 * 60 * 1000) return "—";
  if (remainingMs < 5_000) return "< 5s";
  const m = Math.floor(remainingMs / 60_000);
  const s = Math.floor((remainingMs % 60_000) / 1_000);
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}` : `${s}s`;
}

function getViewHref(task: AnalysisTask): string | null {
  if (task.type === "video") {
    const v = task as VideoAnalysisTask;
    if (v.status === "completed" && v.result?.id) return `/hub?conv=${v.result.id}`;
    if (v.taskId) return `/hub?analyzing=${v.taskId}`;
    return null;
  }
  // Playlists : routing pas finalisé pour V1, fallback /history
  return "/history";
}

function getTitle(task: AnalysisTask): string {
  if (task.type === "video") {
    const v = task as VideoAnalysisTask;
    return v.videoTitle || v.result?.video_title || v.videoUrl;
  }
  const p = task as PlaylistAnalysisTask;
  return p.playlistTitle || p.playlistUrl;
}

const TaskRow: React.FC<{
  task: AnalysisTask;
  onView: (href: string) => void;
  onRetry: (id: string) => void;
}> = ({ task, onView, onRetry }) => {
  const href = getViewHref(task);
  const title = getTitle(task);
  const isFailed = task.status === "failed";
  const isCompleted = task.status === "completed";
  const isPlaylist = task.type === "playlist";

  return (
    <li className="py-3 border-b border-white/5 last:border-b-0">
      <div className="flex items-start gap-3">
        {(task as VideoAnalysisTask).thumbnail && task.type === "video" ? (
          <img
            src={(task as VideoAnalysisTask).thumbnail}
            alt=""
            className="w-12 h-12 rounded-md object-cover flex-shrink-0 border border-white/10"
            aria-hidden="true"
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-semibold ${
              isFailed
                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                : isCompleted
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
            }`}
            aria-hidden="true"
          >
            {isPlaylist ? "PL" : "VID"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/90 truncate" title={title}>
            {title}
          </p>
          <p className="text-xs text-white/50 truncate">{task.message}</p>
          {!isFailed && !isCompleted && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${task.progress}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-white/60 min-w-[3.5rem] text-right">
                {task.progress}% · {formatEta(task)}
              </span>
            </div>
          )}
          {isFailed && task.error && (
            <p className="mt-1 text-xs text-red-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{task.error}</span>
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {isFailed ? (
              <button
                type="button"
                onClick={() => onRetry(task.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-red-200 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Réessayer
              </button>
            ) : href ? (
              <button
                type="button"
                onClick={() => onView(href)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-indigo-200 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 transition-colors"
              >
                <Eye className="w-3 h-3" />
                Voir
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
};

export const BackgroundAnalysisPanel: React.FC<
  BackgroundAnalysisPanelProps
> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { tasks, retryTask, clearCompleted } = useBackgroundAnalysis();
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: quota } = useQuery({
    queryKey: ["auth-quota"],
    queryFn: () => authApi.quota(),
    enabled: open,
    staleTime: 30_000,
  });

  // Close on Escape + outside click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        const target = e.target as HTMLElement | null;
        // Ne ferme pas si le clic est sur le FAB lui-même
        if (target?.closest("[aria-haspopup='dialog']")) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onOutside);
    };
  }, [open, onClose]);

  const sortedTasks = useMemo(() => {
    // pending+processing en haut, puis failed, puis completed récents
    const order: Record<AnalysisTask["status"], number> = {
      processing: 0,
      pending: 1,
      failed: 2,
      completed: 3,
    };
    return [...tasks].sort((a, b) => order[a.status] - order[b.status]);
  }, [tasks]);

  const hasCompletedOrFailed = tasks.some(
    (t) => t.status === "completed" || t.status === "failed",
  );

  const quotaPct =
    quota && quota.credits_monthly > 0
      ? quota.credits_used / quota.credits_monthly
      : 0;
  const quotaRemaining =
    quota && quota.credits_monthly > 0
      ? quota.credits_monthly - quota.credits_used
      : null;
  const quotaLow =
    quota && quota.credits_monthly > 0
      ? quotaRemaining !== null &&
        quotaRemaining <= quota.credits_monthly * QUOTA_WARN_THRESHOLD
      : false;
  const quotaExhausted =
    quotaRemaining !== null && quotaRemaining <= 0;

  const handleView = (href: string) => {
    onClose();
    navigate(href);
  };

  const handleRetry = async (id: string) => {
    try {
      await retryTask(id);
    } catch (e) {
      // L'erreur est déjà visible dans la task elle-même via failed status.
      console.error("retryTask failed:", e);
    }
  };

  if (!open) return null;

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label="Analyses en cours"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed z-[59] right-4 top-40 md:right-6 md:bottom-24 md:top-auto w-[min(92vw,380px)] max-h-[70vh] flex flex-col rounded-2xl bg-[#12121a]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90">
          Analyses
          <span className="ml-2 text-xs font-normal text-white/50">
            {tasks.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="p-1 rounded-md text-white/50 hover:text-white/90 hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-4">
        {sortedTasks.length === 0 ? (
          <p className="py-6 text-center text-xs text-white/40">
            Aucune analyse en cours.
          </p>
        ) : (
          <ul className="py-1">
            {sortedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onView={handleView}
                onRetry={handleRetry}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer : quota + actions */}
      <div className="border-t border-white/5 px-4 py-2.5 space-y-1.5">
        {quota ? (
          <p
            className={`text-xs flex items-center justify-between ${
              quotaExhausted
                ? "text-red-300"
                : quotaLow
                  ? "text-orange-300"
                  : "text-white/55"
            }`}
          >
            <span>
              {quota.credits_used}/{quota.credits_monthly} analyses ·{" "}
              <span className="capitalize">{quota.plan}</span>
            </span>
            {(quotaLow || quotaExhausted) && (
              <Link
                to="/pricing"
                className="ml-2 text-orange-300 hover:text-orange-200 underline underline-offset-2"
                onClick={onClose}
              >
                Upgrade
              </Link>
            )}
          </p>
        ) : null}

        {hasCompletedOrFailed && (
          <button
            type="button"
            onClick={clearCompleted}
            className="text-xs text-white/50 hover:text-white/80 inline-flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Effacer les terminées
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default BackgroundAnalysisPanel;
