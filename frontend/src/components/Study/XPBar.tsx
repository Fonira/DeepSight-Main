/**
 * DEEP SIGHT — XPBar
 * Barre de progression XP avec niveau.
 */
import React from 'react';
import { motion } from 'framer-motion';

interface XPBarProps {
  currentXP: number;
  maxXP: number;
  level: number;
}

export const XPBar: React.FC<XPBarProps> = ({ currentXP, maxXP, level }) => {
  const progress = maxXP > 0 ? Math.min((currentXP / maxXP) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3" role="progressbar" aria-valuenow={currentXP} aria-valuemax={maxXP} aria-label={`Niveau ${level} — ${currentXP}/${maxXP} XP`}>
      {/* Level circle */}
      <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
        <span className="text-sm font-bold text-white">{level}</span>
      </div>

      {/* Bar + labels */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-white/70">Niveau {level}</span>
          <span className="text-xs font-medium text-white/50">
            {currentXP.toLocaleString()}/{maxXP.toLocaleString()} XP
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              boxShadow: '0 0 12px rgba(99,102,241,0.4), 0 0 4px rgba(139,92,246,0.3)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
