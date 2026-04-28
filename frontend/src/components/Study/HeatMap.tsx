/**
 * DEEP SIGHT — HeatMap
 * Heat map style GitHub des 35 derniers jours.
 */
import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ActivityDay {
  date: string;
  cards_reviewed: number;
  xp_earned: number;
}

interface HeatMapProps {
  activities: ActivityDay[];
}

const INTENSITY_CLASSES = [
  "bg-white/5",
  "bg-indigo-500/20",
  "bg-indigo-500/40",
  "bg-indigo-500/60",
  "bg-indigo-500/90",
];

const getIntensity = (count: number, max: number): number => {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

export const HeatMap: React.FC<HeatMapProps> = ({ activities }) => {
  const [tooltip, setTooltip] = useState<{
    idx: number;
    x: number;
    y: number;
  } | null>(null);

  const { grid, maxCards } = useMemo(() => {
    const actMap = new Map<string, ActivityDay>();
    activities.forEach((a) => actMap.set(a.date, a));

    const days: (ActivityDay & { dateStr: string })[] = [];
    const today = new Date();
    for (let i = 34; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const act = actMap.get(key);
      days.push({
        dateStr: key,
        date: key,
        cards_reviewed: act?.cards_reviewed ?? 0,
        xp_earned: act?.xp_earned ?? 0,
      });
    }

    const mx = Math.max(...days.map((d) => d.cards_reviewed), 1);
    return { grid: days, maxCards: mx };
  }, [activities]);

  return (
    <div className="relative">
      {/* Grid 7×5 */}
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          gridTemplateRows: "repeat(5, 1fr)",
        }}
        role="img"
        aria-label="Carte de chaleur des 35 derniers jours d'activité"
      >
        {grid.map((day, idx) => (
          <div
            key={day.dateStr}
            className={`aspect-square rounded-sm transition-colors duration-200 cursor-pointer ${INTENSITY_CLASSES[getIntensity(day.cards_reviewed, maxCards)]}`}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ idx, x: rect.left + rect.width / 2, y: rect.top });
            }}
            onMouseLeave={() => setTooltip(null)}
            aria-label={`${formatDate(day.dateStr)} : ${day.cards_reviewed} cartes`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-2">
        <span className="text-[10px] text-text-muted">Moins</span>
        {INTENSITY_CLASSES.map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span className="text-[10px] text-text-muted">Plus</span>
      </div>
      {/* Tooltip */}
      <AnimatePresence>
        {tooltip !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed z-50 px-2.5 py-1.5 rounded-lg bg-[#1a1a2e] border border-white/10 text-xs text-white shadow-xl pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 36,
              transform: "translateX(-50%)",
            }}
          >
            <span className="font-medium">
              {formatDate(grid[tooltip.idx].dateStr)}
            </span>
            <span className="text-text-muted"> — </span>
            <span>{grid[tooltip.idx].cards_reviewed} cartes</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
