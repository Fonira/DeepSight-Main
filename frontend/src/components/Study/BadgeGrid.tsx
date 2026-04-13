/**
 * DEEP SIGHT — BadgeGrid
 * Grille de badges groupés par rareté.
 */
import React, { useMemo } from "react";
import type { BadgeItem } from "../../types/gamification";
import { RARITY_COLORS } from "../../types/gamification";
import { BadgeCard } from "./BadgeCard";

interface BadgeGridProps {
  earned: BadgeItem[];
  locked: BadgeItem[];
}

type Rarity = "legendary" | "epic" | "rare" | "common";
const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "common"];
const RARITY_LABELS: Record<Rarity, string> = {
  legendary: "Légendaire",
  epic: "Épique",
  rare: "Rare",
  common: "Commun",
};

export const BadgeGrid: React.FC<BadgeGridProps> = ({ earned, locked }) => {
  const total = (earned?.length ?? 0) + (locked?.length ?? 0);

  const grouped = useMemo(() => {
    const all = [
      ...(earned ?? []).map((b) => ({ badge: b, isEarned: true })),
      ...(locked ?? []).map((b) => ({ badge: b, isEarned: false })),
    ];

    const groups: Record<Rarity, { badge: BadgeItem; isEarned: boolean }[]> = {
      legendary: [],
      epic: [],
      rare: [],
      common: [],
    };

    all.forEach((item) => {
      const r = (item.badge.rarity ?? "common") as Rarity;
      if (r in groups) groups[r].push(item);
    });

    return groups;
  }, [earned, locked]);

  return (
    <div className="space-y-6">
      {/* Counter */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">Badges</h3>
        <span className="text-xs text-white/40">
          {earned?.length ?? 0}/{total} débloqués
        </span>
      </div>

      {/* Sections by rarity */}
      {RARITY_ORDER.map((rarity) => {
        const items = grouped[rarity];
        if (items.length === 0) return null;
        const colors = RARITY_COLORS[rarity];

        return (
          <div key={rarity}>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors?.text ?? "#6366f1" }}
              />
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: colors?.text ?? "#6366f1" }}
              >
                {RARITY_LABELS[rarity]}
              </span>
              <span className="text-[10px] text-white/30">
                ({items.length})
              </span>
            </div>
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              }}
            >
              {items.map((item) => (
                <BadgeCard
                  key={item.badge.code}
                  badge={item.badge}
                  isEarned={item.isEarned}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
