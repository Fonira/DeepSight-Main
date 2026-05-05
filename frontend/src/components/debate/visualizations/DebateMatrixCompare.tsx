/**
 * DebateMatrixCompare — matrice critères × perspectives.
 *
 * Tableau dark mode glassmorphism qui confronte la vidéo A à 1-3 perspectives
 * (B1, B2, B3) sur 6 critères : thèse, force argumentative, sources, audience,
 * fraîcheur, qualité de la chaîne.
 *
 * Wave 3 frontend — Débat IA v2 (sub-agent E).
 */

import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Quote,
  TrendingUp,
  BookOpen,
  Users,
  Clock,
  Award,
} from "lucide-react";
import type { DebateArgument, DebatePerspective } from "../../../types/debate";

interface VideoA {
  title: string;
  thesis: string;
  arguments: DebateArgument[];
  channel: string;
}

export interface DebateMatrixCompareProps {
  videoA: VideoA;
  perspectives: DebatePerspective[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Score de force argumentative (0-10) calculé depuis les forces qualitatives
 * des arguments (`strong=10`, `moderate=6`, `weak=3`). Moyenne arithmétique.
 * Si pas d'arguments → score neutre 5.
 */
export const computeArgumentStrength = (
  args: DebateArgument[] | null | undefined,
): number => {
  if (!args || args.length === 0) return 5;
  const map: Record<string, number> = {
    strong: 10,
    moderate: 6,
    weak: 3,
  };
  const sum = args.reduce((acc, a) => acc + (map[a.strength] ?? 5), 0);
  return Math.round((sum / args.length) * 10) / 10;
};

/**
 * Compte les sources externes (URL, références) mentionnées dans les arguments.
 * Heuristique : occurrences de "http", DOI, "étude", "rapport".
 */
export const countSources = (
  args: DebateArgument[] | null | undefined,
): number => {
  if (!args || args.length === 0) return 0;
  const re = /(https?:\/\/|doi\.org|étude|rapport|source\s*:|cite|publi)/gi;
  return args.reduce((acc, a) => {
    const matches = (a.evidence || "").match(re);
    return acc + (matches ? matches.length : 0);
  }, 0);
};

const formatFreshness = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  // Try parse ISO date, else show raw
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const audienceLabel = (level: DebatePerspective["audience_level"]): string => {
  switch (level) {
    case "vulgarisation":
      return "Vulgarisation";
    case "expert":
      return "Expert";
    default:
      return "—";
  }
};

const PERSPECTIVE_COLORS = [
  "from-violet-500/15 to-violet-600/15 border-violet-400/30",
  "from-cyan-500/15 to-cyan-600/15 border-cyan-400/30",
  "from-blue-500/15 to-blue-600/15 border-blue-400/30",
];

const PERSPECTIVE_TEXT_COLORS = [
  "text-violet-300",
  "text-cyan-300",
  "text-blue-300",
];

// ─── row primitive ──────────────────────────────────────────────────────────

interface RowProps {
  icon: React.ReactNode;
  label: string;
  cells: React.ReactNode[];
  cellAlign?: "top" | "center";
}

const Row: React.FC<RowProps> = ({ icon, label, cells, cellAlign = "top" }) => (
  <tr className="group transition-colors hover:bg-white/[0.02]">
    <th
      scope="row"
      className="px-3 py-3 text-left align-top text-xs font-semibold text-text-tertiary border-b border-white/5"
    >
      <span className="flex items-center gap-1.5">
        <span className="text-text-muted">{icon}</span>
        {label}
      </span>
    </th>
    {cells.map((cell, i) => (
      <td
        key={i}
        className={`px-3 py-3 text-xs text-text-secondary border-b border-white/5 ${
          cellAlign === "center" ? "align-middle" : "align-top"
        }`}
      >
        {cell}
      </td>
    ))}
  </tr>
);

// ─── component ──────────────────────────────────────────────────────────────

export const DebateMatrixCompare: React.FC<DebateMatrixCompareProps> = ({
  videoA,
  perspectives,
}) => {
  // Limit to max 3 perspectives (B1, B2, B3) — beyond that, signal in console only
  const visiblePerspectives = perspectives.slice(0, 3);
  const totalCols = 1 + visiblePerspectives.length;

  // Build column headers
  const headers = [
    {
      label: "Vidéo A",
      title: videoA.title,
      channel: videoA.channel,
      colorClass: "from-indigo-500/15 to-indigo-600/15 border-indigo-400/30",
      textColor: "text-indigo-300",
    },
    ...visiblePerspectives.map((p, i) => ({
      label: `B${i + 1}`,
      title: p.video_title || `Perspective ${i + 1}`,
      channel: p.video_channel || "—",
      colorClass: PERSPECTIVE_COLORS[i % PERSPECTIVE_COLORS.length],
      textColor: PERSPECTIVE_TEXT_COLORS[i % PERSPECTIVE_TEXT_COLORS.length],
    })),
  ];

  // Build values per criterion
  const thesisCells = [
    <p key="a" className="leading-relaxed line-clamp-4">
      {videoA.thesis || "—"}
    </p>,
    ...visiblePerspectives.map((p, i) => (
      <p key={i} className="leading-relaxed line-clamp-4">
        {p.thesis || "—"}
      </p>
    )),
  ];

  const strengthA = computeArgumentStrength(videoA.arguments);
  const strengthCells = [
    <StrengthBadge key="a" value={strengthA} accent="indigo" />,
    ...visiblePerspectives.map((p, i) => (
      <StrengthBadge
        key={i}
        value={computeArgumentStrength(p.arguments)}
        accent={i === 0 ? "violet" : i === 1 ? "cyan" : "blue"}
      />
    )),
  ];

  const sourcesA = countSources(videoA.arguments);
  const sourcesCells = [
    <span key="a" className="font-mono text-text-secondary">
      {sourcesA}
    </span>,
    ...visiblePerspectives.map((p, i) => (
      <span key={i} className="font-mono text-text-secondary">
        {countSources(p.arguments)}
      </span>
    )),
  ];

  const audienceCells = [
    <span key="a" className="text-text-muted">
      —
    </span>,
    ...visiblePerspectives.map((p, i) => (
      <span key={i} className="text-text-muted">
        {audienceLabel(p.audience_level)}
      </span>
    )),
  ];

  const freshnessCells = [
    <span key="a" className="text-text-muted">
      —
    </span>,
    ...visiblePerspectives.map((p, i) => (
      <span key={i} className="text-text-muted">
        {formatFreshness(p.freshness_date)}
      </span>
    )),
  ];

  const channelQualityCells = [
    <span key="a" className="text-text-muted">
      —
    </span>,
    ...visiblePerspectives.map((p, i) => (
      <ChannelQualityBadge key={i} score={p.channel_quality_score} />
    )),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
      data-testid="debate-matrix-compare"
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted border-b border-white/10"
                style={{ width: "180px" }}
              >
                Critère
              </th>
              {headers.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className="px-3 py-2 text-left border-b border-white/10"
                  style={{ minWidth: "200px" }}
                >
                  <div
                    className={`flex flex-col gap-0.5 rounded-lg px-2 py-1.5 bg-gradient-to-br border ${h.colorClass}`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${h.textColor}`}
                    >
                      {h.label}
                    </span>
                    <span className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                      {h.title}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {h.channel}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row
              icon={<Quote className="w-3.5 h-3.5" />}
              label="Thèse"
              cells={thesisCells}
            />
            <Row
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label="Force argumentative"
              cells={strengthCells}
              cellAlign="center"
            />
            <Row
              icon={<BookOpen className="w-3.5 h-3.5" />}
              label="Sources"
              cells={sourcesCells}
              cellAlign="center"
            />
            <Row
              icon={<Users className="w-3.5 h-3.5" />}
              label="Audience"
              cells={audienceCells}
              cellAlign="center"
            />
            <Row
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Fraîcheur"
              cells={freshnessCells}
              cellAlign="center"
            />
            <Row
              icon={<Award className="w-3.5 h-3.5" />}
              label="Qualité chaîne"
              cells={channelQualityCells}
              cellAlign="center"
            />
          </tbody>
        </table>
      </div>
      <p className="mt-3 px-1 text-[10px] text-text-muted flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" />
        Vue analytique — {totalCols} sources confrontées
      </p>
    </motion.div>
  );
};

// ─── small badges ───────────────────────────────────────────────────────────

const StrengthBadge: React.FC<{
  value: number;
  accent: "indigo" | "violet" | "cyan" | "blue";
}> = ({ value, accent }) => {
  const colorMap: Record<typeof accent, string> = {
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
    violet: "bg-violet-500/15 text-violet-300 border-violet-400/30",
    cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
    blue: "bg-blue-500/15 text-blue-300 border-blue-400/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono font-semibold ${colorMap[accent]}`}
    >
      {value.toFixed(1)}
      <span className="text-[10px] text-text-muted">/10</span>
    </span>
  );
};

const ChannelQualityBadge: React.FC<{ score: number | undefined }> = ({
  score,
}) => {
  if (typeof score !== "number") {
    return <span className="text-text-muted">—</span>;
  }
  const pct = Math.round(score * 10) / 10;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs font-mono">
      {pct.toFixed(1)}
    </span>
  );
};

export default DebateMatrixCompare;
