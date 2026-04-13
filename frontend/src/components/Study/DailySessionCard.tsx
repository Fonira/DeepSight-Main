/**
 * DEEP SIGHT — DailySessionCard
 * CTA principal "Session du jour".
 */
import React from "react";
import { motion } from "framer-motion";
import { Target, Clock, Layers } from "lucide-react";

interface DailySessionCardProps {
  totalDue: number;
  totalNew: number;
  estimatedMinutes: number;
  onStart: () => void;
}

export const DailySessionCard: React.FC<DailySessionCardProps> = ({
  totalDue,
  totalNew,
  estimatedMinutes,
  onStart,
}) => {
  const hasCards = totalDue > 0 || totalNew > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 p-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/15">
          <Target className="w-5 h-5 text-indigo-400" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-white">Session du jour</h3>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-white/40" aria-hidden="true" />
          <span className="text-sm text-white/70">
            <span className="font-medium text-white">{totalDue}</span> cartes
            dues
            {totalNew > 0 && (
              <span className="text-indigo-300"> + {totalNew} nouvelles</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-white/40" aria-hidden="true" />
          <span className="text-sm text-white/50">~{estimatedMinutes} min</span>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onStart}
        disabled={!hasCards}
        className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={
          hasCards
            ? `Commencer la session — ${totalDue + totalNew} cartes`
            : "Aucune carte à réviser"
        }
      >
        {hasCards ? "Commencer" : "Tout est à jour !"}
      </button>
    </motion.div>
  );
};
