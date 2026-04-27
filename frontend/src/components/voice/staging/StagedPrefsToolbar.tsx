import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import { useVoicePrefsStaging } from "./VoicePrefsStagingProvider";

export const StagedPrefsToolbar: React.FC = () => {
  const {
    hasChanges,
    hasRestartRequired,
    callActive,
    staged,
    applying,
    applyError,
    cancel,
    apply,
  } = useVoicePrefsStaging();

  const count = Object.keys(staged).length;
  const wantsRestart = hasRestartRequired && callActive;

  const node = (
    <AnimatePresence>
      {hasChanges && (
        <motion.div
          key="staged-prefs-toolbar"
          data-testid="staged-prefs-toolbar"
          role="region"
          aria-label="Modifications en attente"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] max-w-[calc(100vw-32px)]"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#12121a]/85 backdrop-blur-xl border border-white/10 shadow-2xl shadow-indigo-500/20">
            <span
              data-testid="staged-count"
              role="status"
              aria-live="polite"
              className="text-sm text-white/80 font-medium tabular-nums"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2 align-middle" />
              {count} modification{count > 1 ? "s" : ""} en attente
            </span>

            <button
              type="button"
              data-testid="staged-cancel"
              onClick={cancel}
              disabled={applying}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <span className="inline-flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" />
                Annuler
              </span>
            </button>

            <button
              type="button"
              data-testid="staged-apply"
              onClick={apply}
              disabled={applying}
              aria-keyshortcuts="Mod+Enter"
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                wantsRestart
                  ? "bg-amber-500 text-[#0a0a0f] hover:bg-amber-400"
                  : "bg-indigo-500 text-white hover:bg-indigo-400"
              } disabled:opacity-50 disabled:cursor-wait`}
            >
              <span className="inline-flex items-center gap-1.5">
                {applying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : wantsRestart ? (
                  <RotateCcw className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {wantsRestart ? "Appliquer & redémarrer" : "Appliquer"}
              </span>
            </button>
          </div>

          {applyError && (
            <div
              data-testid="staged-error"
              className="mt-2 mx-auto flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs"
            >
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{applyError}</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined" || !document.body) return node;
  return createPortal(node, document.body);
};

export default StagedPrefsToolbar;
