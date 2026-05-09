/**
 * BackgroundAnalysisPanel — toast flottant bottom-right qui affiche en temps réel
 * la progression de chaque analyse vidéo en cours, peu importe la page.
 *
 * Source de vérité : useBackgroundAnalysis() (contexte React).
 * Rendu globalement dans App.tsx → suit l'utilisateur sur toute l'app.
 *
 * Comportement :
 * - 1 carte par tâche active OU récemment complétée
 * - Click sur carte completed → navigate /hub?conv=<summaryId>
 * - Auto-dismiss completed après 12s (sauf si user n'a pas cliqué)
 * - Failed tasks → bouton "Fermer" pour les retirer manuellement
 */
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, X, ArrowRight } from "lucide-react";
import {
  useBackgroundAnalysis,
  VideoAnalysisTask,
  PlaylistAnalysisTask,
} from "../contexts/BackgroundAnalysisContext";
import { DeepSightSpinnerSmall } from "./ui/DeepSightSpinner";

const AUTO_DISMISS_MS = 12_000;

const sanitizeTitle = (raw?: string): string => {
  if (!raw) return "Analyse en cours";
  return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
};

const VideoTaskCard: React.FC<{ task: VideoAnalysisTask }> = ({ task }) => {
  const { removeTask } = useBackgroundAnalysis();
  const navigate = useNavigate();

  // Auto-dismiss completed tasks after AUTO_DISMISS_MS — user can still click
  // before the timer fires.
  useEffect(() => {
    if (task.status !== "completed") return;
    const timer = setTimeout(() => removeTask(task.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [task.id, task.status, removeTask]);

  const isCompleted = task.status === "completed";
  const isFailed = task.status === "failed";
  const progressPct = Math.max(5, Math.min(task.progress || 5, 100));

  const handleClick = () => {
    if (isCompleted && task.summaryId !== undefined) {
      navigate(`/hub?conv=${task.summaryId}`);
      removeTask(task.id);
    }
  };

  const title = sanitizeTitle(task.videoTitle);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className={[
        "relative w-[300px] rounded-xl",
        "bg-[#0c0c14]/95 backdrop-blur-xl",
        "border border-white/10",
        "shadow-[0_12px_36px_rgba(0,0,0,0.5)]",
        "overflow-hidden",
        isCompleted && task.summaryId !== undefined ? "cursor-pointer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      role={isCompleted ? "button" : "status"}
      aria-label={
        isCompleted
          ? `Analyse terminée : ${title}. Cliquer pour ouvrir.`
          : `Analyse en cours : ${title}`
      }
    >
      {/* Close button — top-right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          removeTask(task.id);
        }}
        aria-label="Fermer"
        className="absolute top-2 right-2 w-6 h-6 grid place-items-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="px-4 py-3 flex items-start gap-3">
        {/* Spinner / status icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isCompleted ? (
            <div className="w-9 h-9 grid place-items-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          ) : isFailed ? (
            <div className="w-9 h-9 grid place-items-center rounded-full bg-red-500/15 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
          ) : (
            <DeepSightSpinnerSmall />
          )}
        </div>

        {/* Right column : title + message + progress */}
        <div className="flex-1 min-w-0 pr-5">
          <div className="text-[12px] font-medium text-white/90 truncate leading-tight">
            {title}
          </div>
          <div className="mt-0.5 text-[11px] text-white/55 truncate">
            {isCompleted
              ? "Analyse terminée — cliquer pour ouvrir"
              : isFailed
                ? task.error || "Échec de l'analyse"
                : task.message || "Analyse en cours…"}
          </div>

          {/* Progress bar — hidden when completed/failed */}
          {!isCompleted && !isFailed && (
            <div className="mt-2 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progressPct, 95)}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          )}

          {/* CTA arrow when completed */}
          {isCompleted && task.summaryId !== undefined && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-indigo-300 font-medium">
              <span>Ouvrir la conversation</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const PlaylistTaskCard: React.FC<{ task: PlaylistAnalysisTask }> = ({
  task,
}) => {
  const { removeTask } = useBackgroundAnalysis();

  useEffect(() => {
    if (task.status !== "completed") return;
    const timer = setTimeout(() => removeTask(task.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [task.id, task.status, removeTask]);

  const isCompleted = task.status === "completed";
  const isFailed = task.status === "failed";
  const progressPct = Math.max(5, Math.min(task.progress || 5, 100));
  const title = sanitizeTitle(task.playlistTitle || task.playlistUrl);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="relative w-[300px] rounded-xl bg-[#0c0c14]/95 backdrop-blur-xl border border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.5)] overflow-hidden"
      role="status"
    >
      <button
        type="button"
        onClick={() => removeTask(task.id)}
        aria-label="Fermer"
        className="absolute top-2 right-2 w-6 h-6 grid place-items-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isCompleted ? (
            <div className="w-9 h-9 grid place-items-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          ) : isFailed ? (
            <div className="w-9 h-9 grid place-items-center rounded-full bg-red-500/15 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
          ) : (
            <DeepSightSpinnerSmall />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-5">
          <div className="text-[12px] font-medium text-white/90 truncate leading-tight">
            Playlist · {title}
          </div>
          <div className="mt-0.5 text-[11px] text-white/55 truncate">
            {isCompleted
              ? `Terminé · ${task.completedVideos ?? 0}/${task.totalVideos ?? "?"} vidéos`
              : isFailed
                ? task.error || "Échec de l'analyse playlist"
                : task.message || "Analyse en cours…"}
          </div>
          {!isCompleted && !isFailed && (
            <div className="mt-2 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progressPct, 95)}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const BackgroundAnalysisPanel: React.FC = () => {
  const { tasks } = useBackgroundAnalysis();

  // Tasks sorted most-recent-first so the newest analysis sits on top.
  const visibleTasks = [...tasks].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );

  if (visibleTasks.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {visibleTasks.map((task) => (
          <div key={task.id} className="pointer-events-auto">
            {task.type === "video" ? (
              <VideoTaskCard task={task} />
            ) : (
              <PlaylistTaskCard task={task} />
            )}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default BackgroundAnalysisPanel;
