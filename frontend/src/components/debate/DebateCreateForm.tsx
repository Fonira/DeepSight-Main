/**
 * DebateCreateForm — Formulaire de création de débat (mode auto / manual)
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Link2, Swords, ArrowRight } from "lucide-react";
import { DeepSightSpinnerMicro } from "../ui/DeepSightSpinner";

interface DebateCreateFormProps {
  onSubmit: (data: {
    mode: "auto" | "manual";
    urlA: string;
    urlB?: string;
  }) => void;
  loading?: boolean;
}

export const DebateCreateForm: React.FC<DebateCreateFormProps> = ({
  onSubmit,
  loading = false,
}) => {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");

  const canSubmit =
    mode === "auto"
      ? urlA.trim().length > 0
      : urlA.trim().length > 0 && urlB.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    onSubmit({
      mode,
      urlA: urlA.trim(),
      urlB: mode === "manual" ? urlB.trim() : undefined,
    });
  };

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center border border-white/10">
          <Swords className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">
            Nouveau débat IA
          </h2>
          <p className="text-xs text-text-muted">
            Confrontez deux points de vue sur un même sujet
          </p>
        </div>
      </div>
      {/* Mode toggle */}
      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            mode === "auto"
              ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
              : "bg-white/[0.03] border-white/10 text-white/50 hover:text-white/70 hover:bg-white/5"
          }`}
        >
          <Wand2 className="w-4 h-4" />
          Auto
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            mode === "manual"
              ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
              : "bg-white/[0.03] border-white/10 text-white/50 hover:text-white/70 hover:bg-white/5"
          }`}
        >
          <Link2 className="w-4 h-4" />
          Manuel
        </button>
      </div>
      {/* Mode description */}
      <AnimatePresence mode="wait">
        <motion.p
          key={mode}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          className="text-xs text-text-muted mb-4"
        >
          {mode === "auto"
            ? "Collez une URL YouTube — DeepSight trouvera automatiquement une vidéo qui défend le point de vue opposé."
            : "Fournissez deux URL YouTube qui présentent des points de vue différents sur un même sujet."}
        </motion.p>
      </AnimatePresence>
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* URL A */}
        <div>
          <label className="text-xs font-medium text-text-muted mb-1 block">
            {mode === "auto"
              ? "URL de la vidéo"
              : "Vidéo A — Premier point de vue"}
          </label>
          <input
            type="url"
            value={urlA}
            onChange={(e) => setUrlA(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            disabled={loading}
          />
        </div>

        {/* URL B (manual mode) */}
        <AnimatePresence>
          {mode === "manual" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <label className="text-xs font-medium text-text-muted mb-1 block">
                Vidéo B — Point de vue opposé
              </label>
              <input
                type="url"
                value={urlB}
                onChange={(e) => setUrlB(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
                disabled={loading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
        >
          {loading ? (
            <>
              <DeepSightSpinnerMicro onLight />
              Analyse en cours…
            </>
          ) : (
            <>
              <Swords className="w-4 h-4" />
              Lancer le débat
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
