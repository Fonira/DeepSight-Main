/**
 * BackgroundAnalysisFAB — Floating Action Button global
 * ───────────────────────────────────────────────────────────────────────────
 * Visible sur toutes les routes Web dès qu'au moins une analyse tourne en
 * background. États visuels : processing 1 / processing 2 / success / error.
 *
 * - Desktop : fixed bottom-right, 64px diam.
 * - Mobile (< 768px) : fixed top-right (sous le header), évite zone gestes iOS.
 * - Click → ouvre BackgroundAnalysisPanel (Phase 3).
 *
 * Décisions :
 * - State dérivé directement des tasks du context (pas de double source).
 * - Success state auto-dismiss après 10s (timer + acknowledgeCompleted).
 * - Error state persiste jusqu'à click ou clearCompleted.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check } from "lucide-react";
import {
  useBackgroundAnalysis,
  type AnalysisTask,
  type VideoAnalysisTask,
  type PlaylistAnalysisTask,
} from "../../contexts/BackgroundAnalysisContext";
import { DeepSightSpinner } from "../ui/DeepSightSpinner";
import { useWebNotification } from "../../hooks/useWebNotification";
import { BackgroundAnalysisPanel } from "./BackgroundAnalysisPanel";

function getTaskTitle(task: AnalysisTask): string {
  if (task.type === "video") {
    const v = task as VideoAnalysisTask;
    return v.videoTitle || v.result?.video_title || v.videoUrl;
  }
  const p = task as PlaylistAnalysisTask;
  return p.playlistTitle || p.playlistUrl;
}

function getTaskHref(task: AnalysisTask): string | null {
  if (task.type === "video") {
    const v = task as VideoAnalysisTask;
    if (v.status === "completed" && v.result?.id) return `/hub?conv=${v.result.id}`;
  }
  return null;
}

type FabState = "hidden" | "processing" | "success" | "error";

const STATE_COLORS: Record<Exclude<FabState, "hidden">, string> = {
  processing: "from-indigo-500/40 to-violet-500/30 border-indigo-400/40",
  success: "from-emerald-500/40 to-emerald-400/30 border-emerald-400/50",
  error: "from-red-500/40 to-red-400/30 border-red-400/50",
};

const SUCCESS_AUTODISMISS_MS = 10_000;

export const BackgroundAnalysisFAB: React.FC = () => {
  const {
    tasks,
    activeTasksCount,
    hasNewCompletedTask,
    acknowledgeCompleted,
  } = useBackgroundAnalysis();
  const [open, setOpen] = useState(false);
  const { sendNotification } = useWebNotification();
  const navigate = useNavigate();
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  // Web Notification : déclenchée uniquement si le tab est inactif au moment
  // de la complétion (sinon le toast/check anim/badge nav suffisent).
  useEffect(() => {
    for (const task of tasks) {
      if (task.status !== "completed") continue;
      if (notifiedIdsRef.current.has(task.id)) continue;
      notifiedIdsRef.current.add(task.id);
      if (typeof document !== "undefined" && document.hidden) {
        const href = getTaskHref(task);
        sendNotification({
          title: "DeepSight — Analyse terminée",
          body: getTaskTitle(task),
          tag: task.id,
          onClick: href ? () => navigate(href) : undefined,
        });
      }
    }
    // Garbage-collect les ids de tasks supprimées.
    const currentIds = new Set(tasks.map((t) => t.id));
    for (const id of Array.from(notifiedIdsRef.current)) {
      if (!currentIds.has(id)) notifiedIdsRef.current.delete(id);
    }
  }, [tasks, sendNotification, navigate]);

  const failedCount = useMemo(
    () => tasks.filter((t) => t.status === "failed").length,
    [tasks],
  );

  const fabState: FabState = useMemo(() => {
    if (activeTasksCount > 0) return "processing";
    if (failedCount > 0) return "error";
    if (hasNewCompletedTask) return "success";
    return "hidden";
  }, [activeTasksCount, failedCount, hasNewCompletedTask]);

  // Auto-dismiss success state after 10s (acknowledge so the FAB hides if
  // nothing else is going on).
  useEffect(() => {
    if (fabState !== "success") return;
    const timer = window.setTimeout(() => {
      acknowledgeCompleted();
    }, SUCCESS_AUTODISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [fabState, acknowledgeCompleted]);

  // Close panel automatically when nothing left to show.
  useEffect(() => {
    if (fabState === "hidden" && open) setOpen(false);
  }, [fabState, open]);

  const handleClick = () => {
    if (fabState === "success") {
      acknowledgeCompleted();
      return;
    }
    setOpen((v) => !v);
  };

  const badgeCount =
    fabState === "processing" && activeTasksCount > 1
      ? activeTasksCount
      : fabState === "error" && failedCount > 0
        ? failedCount
        : null;

  const ariaLabel =
    fabState === "processing"
      ? `${activeTasksCount} analyse${activeTasksCount > 1 ? "s" : ""} en cours`
      : fabState === "success"
        ? "Analyse terminée"
        : fabState === "error"
          ? `${failedCount} analyse${failedCount > 1 ? "s" : ""} en échec`
          : "";

  return (
    <>
      <AnimatePresence>
        {fabState !== "hidden" && (
          <motion.div
            key="bg-analysis-fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed z-[60] right-4 top-20 md:right-6 md:bottom-6 md:top-auto"
          >
            <motion.button
              type="button"
              onClick={handleClick}
              aria-label={ariaLabel}
              aria-expanded={open}
              aria-haspopup="dialog"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={
                fabState === "processing"
                  ? {
                      boxShadow: [
                        "0 0 0 0 rgba(99,102,241,0)",
                        "0 0 32px 8px rgba(99,102,241,0.35)",
                        "0 0 0 0 rgba(99,102,241,0)",
                      ],
                    }
                  : fabState === "error"
                    ? {
                        boxShadow: [
                          "0 0 0 0 rgba(239,68,68,0)",
                          "0 0 24px 6px rgba(239,68,68,0.4)",
                          "0 0 0 0 rgba(239,68,68,0)",
                        ],
                      }
                    : {
                        boxShadow: "0 8px 24px rgba(16,185,129,0.35)",
                      }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className={`
                relative flex items-center justify-center
                w-16 h-16 rounded-full
                bg-gradient-to-br ${STATE_COLORS[fabState]}
                border-2 backdrop-blur-xl
                outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]
                ${fabState === "processing" ? "focus-visible:ring-indigo-400" : ""}
                ${fabState === "success" ? "focus-visible:ring-emerald-400" : ""}
                ${fabState === "error" ? "focus-visible:ring-red-400" : ""}
                cursor-pointer
              `}
            >
              {fabState === "processing" && (
                <DeepSightSpinner size={44} speed="fast" />
              )}
              {fabState === "success" && (
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <Check className="w-8 h-8 text-emerald-200" strokeWidth={3} />
                </motion.div>
              )}
              {fabState === "error" && (
                <AlertTriangle
                  className="w-7 h-7 text-red-200"
                  strokeWidth={2.2}
                />
              )}

              {/* Badge count si > 1 task */}
              {badgeCount !== null && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`
                    absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5
                    rounded-full flex items-center justify-center
                    text-[11px] font-bold text-white
                    border-2 border-[#0a0a0f]
                    ${fabState === "processing" ? "bg-violet-500" : ""}
                    ${fabState === "error" ? "bg-red-600" : ""}
                  `}
                  aria-hidden="true"
                >
                  {badgeCount}
                </motion.span>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panneau étendu (Phase 3) */}
      <BackgroundAnalysisPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default BackgroundAnalysisFAB;
