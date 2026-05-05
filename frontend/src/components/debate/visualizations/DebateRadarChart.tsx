/**
 * DebateRadarChart — radar chart des forces argumentatives via Recharts.
 *
 * 5 axes : Émotion, Faits, Sources, Clarté, Audience.
 * Overlay multi-perspectives : A + B1..B3 (max 4 séries), couleurs DeepSight.
 *
 * Wave 3 frontend — Débat IA v2 (sub-agent E).
 */

import React, { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";
import type { DebateArgument, DebatePerspective } from "../../../types/debate";
import { computeArgumentStrength, countSources } from "./DebateMatrixCompare";

interface VideoA {
  title: string;
  arguments: DebateArgument[];
}

export interface DebateRadarChartProps {
  videoA: VideoA;
  perspectives: DebatePerspective[];
  height?: number;
}

// Palette DeepSight — A indigo, B1 violet, B2 cyan, B3 blue
const SERIES_COLORS = [
  { stroke: "#6366f1", fill: "rgba(99, 102, 241, 0.20)" }, // indigo
  { stroke: "#8b5cf6", fill: "rgba(139, 92, 246, 0.20)" }, // violet
  { stroke: "#06b6d4", fill: "rgba(6, 182, 212, 0.20)" }, // cyan
  { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.20)" }, // blue
];

// ─── scoring helpers ────────────────────────────────────────────────────────

/**
 * Score d'émotion (0-10) — heuristique : densité de mots émotionnels /
 * exclamations dans les claims+evidence. Si pas d'arguments → 5 (neutre).
 */
export const computeEmotionScore = (
  args: DebateArgument[] | null | undefined,
): number => {
  if (!args || args.length === 0) return 5;
  const re =
    /(!|\?|incroyable|jamais|toujours|énorme|catastrophe|révolution|exploser|exception|absolument|évidemment|choquant)/gi;
  const totalChars = args.reduce(
    (acc, a) => acc + (a.claim?.length || 0) + (a.evidence?.length || 0),
    0,
  );
  if (totalChars === 0) return 5;
  const matches = args.reduce((acc, a) => {
    const m1 = (a.claim || "").match(re);
    const m2 = (a.evidence || "").match(re);
    return acc + (m1?.length || 0) + (m2?.length || 0);
  }, 0);
  // Density per 100 chars, capped to 10
  const density = (matches / totalChars) * 100;
  return Math.min(10, Math.round(density * 5 * 10) / 10);
};

/**
 * Score de faits (0-10) — densité de claims fact-checkables (chiffres, %, dates,
 * "étude", "rapport"). Plus de chiffres = plus factuel.
 */
export const computeFactsScore = (
  args: DebateArgument[] | null | undefined,
): number => {
  if (!args || args.length === 0) return 5;
  const re =
    /(\d+\s*[%€$]|\d{4}|\d+(\.\d+)?\s*(milliard|million|millier|%)|étude|rapport|données|statistique)/gi;
  const matchCount = args.reduce((acc, a) => {
    const m = `${a.claim || ""} ${a.evidence || ""}`.match(re);
    return acc + (m?.length || 0);
  }, 0);
  // Score = matches / args, capped to 10
  return Math.min(10, Math.round((matchCount / args.length) * 5 * 10) / 10);
};

/**
 * Score de sources (0-10) — count direct (cf. countSources), normalisé.
 * 0 sources → 0, 5+ → 10.
 */
export const computeSourcesScore = (
  args: DebateArgument[] | null | undefined,
): number => {
  const count = countSources(args);
  return Math.min(10, Math.round((count / 5) * 10 * 10) / 10);
};

/**
 * Score de clarté (0-10) — inverse de la longueur moyenne des claims.
 * Phrases courtes = plus claires. <50 chars → 10, >250 → 0.
 */
export const computeClarityScore = (
  args: DebateArgument[] | null | undefined,
): number => {
  if (!args || args.length === 0) return 5;
  const avg =
    args.reduce((acc, a) => acc + (a.claim?.length || 0), 0) / args.length;
  if (avg <= 50) return 10;
  if (avg >= 250) return 0;
  return Math.round(((250 - avg) / 200) * 10 * 10) / 10;
};

/**
 * Score d'audience (0-10) — vulgarisation et expert sont valorisés (10),
 * unknown → 5 (neutre). Axe "inverse" = si quelqu'un est très technique,
 * la valeur reflète quand même la qualité du ciblage.
 */
export const computeAudienceScore = (
  level: DebatePerspective["audience_level"],
): number => {
  if (level === "vulgarisation" || level === "expert") return 10;
  return 5;
};

// ─── data shaping for Recharts ──────────────────────────────────────────────

interface RadarDatum {
  axis: string;
  [seriesKey: string]: number | string;
}

export const buildRadarData = (
  videoA: VideoA,
  perspectives: DebatePerspective[],
): { data: RadarDatum[]; series: { key: string; name: string }[] } => {
  const visible = perspectives.slice(0, 3);
  const seriesKeys = [
    { key: "A", name: "Vidéo A" },
    ...visible.map((p, i) => ({
      key: `B${i + 1}`,
      name: p.video_title
        ? `B${i + 1} — ${p.video_title.slice(0, 30)}${p.video_title.length > 30 ? "…" : ""}`
        : `B${i + 1}`,
    })),
  ];

  const axes = ["Émotion", "Faits", "Sources", "Clarté", "Audience"];

  const data: RadarDatum[] = axes.map((axis) => {
    const row: RadarDatum = { axis };
    // Series A (videoA) — videoA n'a pas d'audience_level dédié (vidéo source)
    row.A = scoreFor(axis, videoA.arguments, "unknown");
    // Series B1..B3
    visible.forEach((p, i) => {
      row[`B${i + 1}`] = scoreFor(
        axis,
        p.arguments,
        p.audience_level ?? "unknown",
      );
    });
    return row;
  });

  return { data, series: seriesKeys };
};

const scoreFor = (
  axis: string,
  args: DebateArgument[] | null | undefined,
  audience: DebatePerspective["audience_level"],
): number => {
  switch (axis) {
    case "Émotion":
      return computeEmotionScore(args);
    case "Faits":
      return computeFactsScore(args);
    case "Sources":
      return computeSourcesScore(args);
    case "Clarté":
      return computeClarityScore(args);
    case "Audience":
      return computeAudienceScore(audience);
    default:
      return 5;
  }
};

// ─── component ──────────────────────────────────────────────────────────────

export const DebateRadarChart: React.FC<DebateRadarChartProps> = ({
  videoA,
  perspectives,
  height = 400,
}) => {
  const { data, series } = useMemo(
    () => buildRadarData(videoA, perspectives),
    [videoA, perspectives],
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full"
      data-testid="debate-radar-chart"
    >
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 10]}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              stroke="rgba(255,255,255,0.1)"
              tickCount={6}
            />
            {series.map((s, i) => (
              <Radar
                key={s.key}
                name={s.name}
                dataKey={s.key}
                stroke={SERIES_COLORS[i].stroke}
                fill={SERIES_COLORS[i].fill}
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: SERIES_COLORS[i].stroke,
                  stroke: SERIES_COLORS[i].stroke,
                }}
              />
            ))}
            <Tooltip
              contentStyle={{
                backgroundColor: "#12121a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#fff" }}
              itemStyle={{ color: "rgba(255,255,255,0.85)" }}
            />
            <Legend
              wrapperStyle={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.7)",
                paddingTop: "12px",
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 px-1 text-[10px] text-text-muted">
        Axes calculés depuis les arguments structurés. Si données manquantes →
        score neutre (5/10).
      </p>
    </motion.div>
  );
};

export default DebateRadarChart;
