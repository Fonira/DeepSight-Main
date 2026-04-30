/**
 * NewConversationModal — modal d'entrée pour démarrer une nouvelle conversation
 * dans le Hub. L'utilisateur colle un lien YouTube ou TikTok et clique
 * "Analyser".
 *
 * Refactor 2026-04-30 (Task 4) : la logique analyze + polling a été extraite
 * dans le hook réutilisable `useAnalyzeAndOpenHub` (frontend/src/hooks/), mais
 * la modal continue à utiliser son propre pipeline avec `onSuccess(summaryId)`
 * au lieu de naviguer directement, parce que `HubPage` veut re-fetch ses
 * conversations + setActiveConv (le hook par défaut navigue, ce qui force un
 * remount complet de HubPage et un fetch — comportement OK pour la home, mais
 * inutilement coûteux quand on est déjà dans le Hub).
 *
 * Donc cette modal garde sa propre boucle, alignée sur le hook (mêmes
 * statuses, même timeout 5min). Si dans le futur on veut tout uniformiser,
 * extraire un sous-hook `useAnalyzeWithCustomCompletion` (TODO).
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, AlertCircle } from "lucide-react";
import { videoApi } from "../../services/api";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Appelé avec le summary_id résultant de l'analyse réussie. */
  onSuccess: (summaryId: number) => void;
  language?: "fr" | "en";
}

const URL_PATTERN =
  /^https?:\/\/((www\.)?(youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok\.com)|m\.tiktok\.com)\//i;

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_DURATION_MS = 5 * 60 * 1000; // 5 min

export const NewConversationModal: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  language = "fr",
}) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const progressRef = useRef(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup at unmount.
  useEffect(() => () => cleanup(), [cleanup]);

  // Reset internal state when the modal closes.
  useEffect(() => {
    if (!open) {
      setUrl("");
      setError(null);
      setAnalyzing(false);
      setProgress(0);
      setProgressMsg("");
      progressRef.current = 0;
      cleanup();
    }
  }, [open, cleanup]);

  const handleAnalyze = useCallback(async () => {
    setError(null);
    if (!URL_PATTERN.test(url.trim())) {
      setError("URL invalide. Collez un lien YouTube ou TikTok.");
      return;
    }
    setAnalyzing(true);
    setProgress(5);
    progressRef.current = 5;
    setProgressMsg("Démarrage de l'analyse…");

    try {
      const resp = await videoApi.analyze(
        url.trim(),
        "auto",
        "standard",
        undefined,
        false,
        language,
      );
      // Cache hit immédiat: l'analyse retourne déjà un summary_id.
      if (resp.result?.summary_id) {
        onSuccess(resp.result.summary_id);
        onClose();
        return;
      }
      const taskId = resp.task_id;
      pollStartRef.current = Date.now();

      pollRef.current = setInterval(async () => {
        try {
          if (Date.now() - pollStartRef.current > POLL_MAX_DURATION_MS) {
            cleanup();
            setAnalyzing(false);
            setError("L'analyse prend trop de temps. Réessayez plus tard.");
            return;
          }
          const status = await videoApi.getTaskStatus(taskId);
          if (typeof status.progress === "number") {
            const next = Math.max(progressRef.current, status.progress);
            progressRef.current = next;
            setProgress(next);
          }
          if (status.message) setProgressMsg(status.message);

          if (status.status === "completed" && status.result?.summary_id) {
            cleanup();
            setAnalyzing(false);
            onSuccess(status.result.summary_id);
            onClose();
          } else if (
            status.status === "failed" ||
            status.status === "cancelled"
          ) {
            cleanup();
            setAnalyzing(false);
            setError(status.error || "L'analyse a échoué. Veuillez réessayer.");
          }
        } catch (err) {
          cleanup();
          setAnalyzing(false);
          setError(
            err instanceof Error ? err.message : "Erreur lors du polling.",
          );
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setAnalyzing(false);
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse.");
    }
  }, [url, language, onSuccess, onClose, cleanup]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="newconv-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
        onClick={analyzing ? undefined : onClose}
      />
      <motion.div
        key="newconv-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(520px,90vw)] bg-[#0c0c14] border border-white/10 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,.6)]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white">
            Nouvelle conversation
          </h2>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            disabled={analyzing}
            className="w-7 h-7 grid place-items-center rounded-lg hover:bg-white/[0.06] text-white/55 disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-[13px] text-white/60 leading-relaxed">
            Collez un lien YouTube ou TikTok pour lancer une analyse et démarrer
            une nouvelle conversation.
          </p>

          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={analyzing}
            placeholder="https://youtube.com/watch?v=… ou https://tiktok.com/…"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white placeholder-white/30 outline-none focus:border-indigo-500/40 disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !analyzing) handleAnalyze();
            }}
          />

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-300">
              <AlertCircle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <div className="flex items-center gap-2 text-[12px] text-indigo-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{progressMsg || "Analyse en cours…"}</span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 95)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={analyzing}
            className="px-3.5 py-1.5 rounded-lg text-[13px] text-white/65 hover:bg-white/[0.04] disabled:opacity-30"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || !url.trim()}
            className="px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-[13px] font-medium hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {analyzing ? "Analyse…" : "Analyser"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
