/**
 * DEEP SIGHT — SessionResults
 * Écran de fin de session avec stats et badges.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Zap, Target, Trophy } from "lucide-react";

interface SessionResultsProps {
  cardsReviewed: number;
  xpEarned: number;
  accuracy: number;
  newBadges: string[];
  onClose: () => void;
  onContinue?: () => void;
}

interface StatItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

export const SessionResults: React.FC<SessionResultsProps> = ({
  cardsReviewed,
  xpEarned,
  accuracy,
  newBadges,
  onClose,
  onContinue,
}) => {
  const stats: StatItem[] = [
    {
      icon: <BookOpen className="w-5 h-5" />,
      label: "Cartes révisées",
      value: String(cardsReviewed),
      color: "text-indigo-400",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      label: "XP gagnés",
      value: `+${xpEarned}`,
      color: "text-violet-400",
    },
    {
      icon: <Target className="w-5 h-5" />,
      label: "Précision",
      value: `${Math.round(accuracy)}%`,
      color: "text-green-400",
    },
  ];

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full max-w-md mx-auto rounded-2xl border border-white/10 bg-[#12121a] backdrop-blur-xl p-6 shadow-2xl"
      role="dialog"
      aria-label="Résultats de la session"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <span className="text-4xl" role="img" aria-hidden="true">
          🎉
        </span>
        <h2 className="mt-2 text-xl font-bold text-white">
          Session terminée !
        </h2>
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 border border-white/5"
          >
            <span className={stat.color}>{stat.icon}</span>
            <span className="text-lg font-bold text-white">{stat.value}</span>
            <span className="text-[10px] text-text-muted text-center leading-tight">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
      {/* Badge unlocks */}
      <AnimatePresence>
        {newBadges.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">
                {newBadges.length === 1
                  ? "Nouveau badge !"
                  : `${newBadges.length} nouveaux badges !`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {newBadges.map((badge) => (
                <motion.span
                  key={badge}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs font-medium text-yellow-300"
                >
                  {badge}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10"
        >
          Retour au hub
        </button>
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Continuer (+10 XP)
          </button>
        )}
      </div>
    </motion.div>
  );
};
