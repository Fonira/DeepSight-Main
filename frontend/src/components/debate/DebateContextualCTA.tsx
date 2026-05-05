/**
 * CTA contextuel à placer dans la page d'analyse vidéo standard.
 * Bouton "Voir les perspectives opposées" qui pré-remplit DebateCreateForm avec l'URL.
 *
 * Sprint Débat IA v2 — Wave 4 G.
 * Spec : docs/superpowers/specs/2026-05-04-debate-ia-v2.md §10 (CTA contextuel post-analyse).
 *
 * Usage (depuis la page d'analyse vidéo) :
 *   <DebateContextualCTA videoUrl={summary.video_url} userPlan={user.plan} />
 */

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface Props {
  videoUrl: string;
  userPlan: "free" | "pro" | "expert";
  variant?: "card" | "compact";
}

export function DebateContextualCTA({
  videoUrl,
  userPlan,
  variant = "card",
}: Props) {
  const navigate = useNavigate();
  const isGated = userPlan === "free";

  const handleClick = () => {
    if (isGated) {
      navigate("/upgrade?feature=debate");
      return;
    }
    const params = new URLSearchParams({ url: videoUrl, mode: "auto" });
    navigate(`/debate?${params.toString()}`);
  };

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition"
      >
        <span>⚔️</span>
        <span>Voir les perspectives opposées</span>
        {isGated && <span className="text-amber-400 ml-1">Pro</span>}
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent p-5"
    >
      <div className="flex items-start gap-4">
        <div className="text-3xl">⚔️</div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white mb-1">
            Confronte cette vidéo à un autre point de vue
          </h3>
          <p className="text-sm text-white/60 mb-4 leading-relaxed">
            DeepSight trouve automatiquement une vidéo qui défend la position
            opposée — opposition, complément ou nuance. Idéal pour sortir de sa
            bulle de filtres.
          </p>
          <button
            onClick={handleClick}
            disabled={false}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition shadow-lg shadow-violet-500/30"
          >
            {isGated ? (
              <>
                <span>Débloquer avec Pro</span>
                <span className="text-amber-300">↑</span>
              </>
            ) : (
              <>
                <span>Lancer un débat IA</span>
                <span>→</span>
              </>
            )}
            <span className="text-xs text-white/60 ml-1">(5 crédits)</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
