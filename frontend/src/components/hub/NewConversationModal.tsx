/**
 * NewConversationModal — modal d'entrée pour démarrer une nouvelle conversation
 * dans le Hub. L'utilisateur colle un lien YouTube ou TikTok et clique
 * "Analyser".
 *
 * Refactor 2026-05-09 : la modal ne poll plus localement. Elle délègue
 * `videoApi.analyze` au `BackgroundAnalysisContext` global, ferme l'UI
 * immédiatement, et reçoit le `summary_id` via le callback `onComplete`. Le
 * toast bottom-right (`BackgroundAnalysisPanel`) prend le relais visuel
 * pendant l'analyse (~75 s sur Short typique). Plus besoin de garder la
 * modal ouverte pour suivre la progression.
 *
 * `onSuccess` reste appelé par HubPage pour rafraîchir la liste des
 * conversations + activer la nouvelle.
 */
import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useBackgroundAnalysis } from "../../contexts/BackgroundAnalysisContext";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Appelé avec le summary_id résultant de l'analyse réussie. */
  onSuccess: (summaryId: number) => void;
  language?: "fr" | "en";
}

const URL_PATTERN =
  /^https?:\/\/((www\.)?(youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok\.com)|m\.tiktok\.com)\//i;

export const NewConversationModal: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  language = "fr",
}) => {
  const { startVideoAnalysis } = useBackgroundAnalysis();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset internal state when the modal closes.
  useEffect(() => {
    if (!open) {
      setUrl("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleAnalyze = useCallback(async () => {
    setError(null);
    if (!URL_PATTERN.test(url.trim())) {
      setError("URL invalide. Collez un lien YouTube ou TikTok.");
      return;
    }
    setSubmitting(true);

    try {
      await startVideoAnalysis({
        videoUrl: url.trim(),
        language,
        onComplete: (summaryId) => {
          // Fired by the global background context once the analysis
          // pipeline reports `completed`. HubPage uses this to re-fetch
          // conversations + activate the new one.
          onSuccess(summaryId);
        },
      });
      // Analyse démarrée — on ferme la modal, le toast prend le relais.
      setSubmitting(false);
      onClose();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse.");
    }
  }, [url, language, startVideoAnalysis, onSuccess, onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="newconv-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
        onClick={submitting ? undefined : onClose}
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
            disabled={submitting}
            className="w-7 h-7 grid place-items-center rounded-lg hover:bg-white/[0.06] text-white/55 disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-[13px] text-white/60 leading-relaxed">
            Collez un lien YouTube ou TikTok pour lancer une analyse et démarrer
            une nouvelle conversation. Vous pourrez suivre la progression dans
            la carte qui apparaîtra en bas à droite.
          </p>

          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={submitting}
            placeholder="https://youtube.com/watch?v=… ou https://tiktok.com/…"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white placeholder-white/30 outline-none focus:border-indigo-500/40 disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) handleAnalyze();
            }}
          />

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-300">
              <AlertCircle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3.5 py-1.5 rounded-lg text-[13px] text-white/65 hover:bg-white/[0.04] disabled:opacity-30"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={submitting || !url.trim()}
            className="px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-[13px] font-medium hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{submitting ? "Démarrage…" : "Analyser"}</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
