/**
 * DEEP SIGHT — StreakCounter
 * Compteur de streak avec animation flamme.
 */
import React from 'react';
import { Flame } from 'lucide-react';

interface StreakCounterProps {
  streak: number;
  longestStreak?: number;
}

export const StreakCounter: React.FC<StreakCounterProps> = ({
  streak,
  longestStreak,
}) => {
  const isActive = streak > 0;

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-colors duration-200 ${
        isActive
          ? 'bg-red-500/10 border-red-500/20'
          : 'bg-white/5 border-white/5'
      }`}
      role="status"
      aria-label={`Série de ${streak} jours${longestStreak ? `, record : ${longestStreak} jours` : ''}`}
    >
      <Flame
        className={`w-5 h-5 transition-colors ${
          isActive ? 'text-orange-400 animate-pulse' : 'text-white/20'
        }`}
        aria-hidden="true"
      />
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span
            className={`text-lg font-bold ${
              isActive ? 'text-orange-300' : 'text-white/30'
            }`}
          >
            {streak}
          </span>
          <span
            className={`text-xs ${
              isActive ? 'text-orange-300/60' : 'text-white/20'
            }`}
          >
            {streak <= 1 ? 'jour' : 'jours'}
          </span>
        </div>
        {longestStreak !== undefined && longestStreak > 0 && (
          <span className="text-[10px] text-white/30">
            Record : {longestStreak}j
          </span>
        )}
      </div>
    </div>
  );
};
