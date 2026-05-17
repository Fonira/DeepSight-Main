/**
 * DEEP SIGHT — SentimentBar
 *
 * Barre horizontale 3-segments (positif / neutre / négatif). Expert-only
 * dans le contexte CommunityTake. Les segments somment toujours à 1.0 côté
 * backend ; ici on clamp défensivement.
 */

import React from "react";
import type { CommunitySentimentDistribution } from "../services/api";

interface Props {
  dist: CommunitySentimentDistribution;
  language: "fr" | "en";
}

const SEGMENTS = [
  {
    key: "positive" as const,
    bg: "bg-emerald-500/70",
    labelFr: "Positif",
    labelEn: "Positive",
  },
  {
    key: "neutral" as const,
    bg: "bg-slate-500/60",
    labelFr: "Neutre",
    labelEn: "Neutral",
  },
  {
    key: "negative" as const,
    bg: "bg-rose-500/70",
    labelFr: "Négatif",
    labelEn: "Negative",
  },
];

export const SentimentBar: React.FC<Props> = ({ dist, language }) => {
  // Clamp + normalise (defensive — backend devrait déjà normaliser).
  const positive = Math.max(0, Math.min(1, dist.positive ?? 0));
  const neutral = Math.max(0, Math.min(1, dist.neutral ?? 0));
  const negative = Math.max(0, Math.min(1, dist.negative ?? 0));
  const total = positive + neutral + negative || 1;
  const values = {
    positive: positive / total,
    neutral: neutral / total,
    negative: negative / total,
  };

  return (
    <div data-testid="community-sentiment-bar">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          {language === "fr" ? "Tonalité" : "Sentiment"}
        </span>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden flex bg-white/5">
        {SEGMENTS.map((seg) => {
          const v = values[seg.key];
          if (v <= 0.001) return null;
          return (
            <div
              key={seg.key}
              className={seg.bg}
              style={{ width: `${(v * 100).toFixed(1)}%` }}
              title={`${seg.labelFr} ${(v * 100).toFixed(0)}%`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-muted">
        {SEGMENTS.map((seg) => {
          const v = values[seg.key];
          return (
            <span key={seg.key} className="flex items-center gap-1">
              <span
                className={`inline-block w-2 h-2 rounded-sm ${seg.bg}`}
                aria-hidden
              />
              {language === "fr" ? seg.labelFr : seg.labelEn} {Math.round(v * 100)}%
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default SentimentBar;
