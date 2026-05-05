/**
 * DebateTimeline — frise chronologique horizontale des arguments-clés.
 *
 * SVG natif. Lignes alignées : A (haut, indigo) puis B1/B2/B3 (cyan/violet/blue).
 * Markers convergence (vert), divergence (rouge), neutre (gris).
 * Ordre logique si pas de timestamps (intro → développement → conclusion,
 * distribution équidistante).
 *
 * Wave 3 frontend — Débat IA v2 (sub-agent E).
 */

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type {
  ConvergencePoint,
  DebateArgument,
  DebatePerspective,
  DivergencePoint,
} from "../../../types/debate";

interface VideoA {
  title: string;
  arguments: DebateArgument[];
}

export interface DebateTimelineProps {
  videoA: VideoA;
  perspectives: DebatePerspective[];
  convergence_points: ConvergencePoint[];
  divergence_points: DivergencePoint[];
  height?: number;
}

interface TimelineMarker {
  laneIndex: number;
  x: number; // 0-1 normalized
  argumentIndex: number;
  argument: DebateArgument;
  alignment: "convergent" | "divergent" | "neutral";
  laneName: string;
  laneColor: string;
}

// ─── lane colors ────────────────────────────────────────────────────────────

const LANE_COLORS = [
  "#6366f1", // indigo — A
  "#8b5cf6", // violet — B1
  "#06b6d4", // cyan — B2
  "#3b82f6", // blue — B3
];

const ALIGNMENT_COLORS = {
  convergent: "#22c55e", // green-500
  divergent: "#ef4444", // red-500
  neutral: "#94a3b8", // slate-400
};

// ─── alignment heuristic ────────────────────────────────────────────────────

/**
 * Pour chaque argument, détermine s'il s'aligne avec un point de convergence
 * (vert), divergence (rouge), ou ni l'un ni l'autre (gris).
 *
 * Heuristique : matching de mots-clés entre claim/evidence et les topics
 * convergence/divergence.
 */
export const classifyArgument = (
  arg: DebateArgument,
  convergence: ConvergencePoint[],
  divergence: DivergencePoint[],
): "convergent" | "divergent" | "neutral" => {
  const text = `${arg.claim || ""} ${arg.evidence || ""}`.toLowerCase();

  const matchesAny = (sources: { topic?: string; description?: string }[]) =>
    sources.some((s) => {
      const keywords = (s.topic || s.description || "")
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);
      return keywords.some((kw) => text.includes(kw));
    });

  const isConv = matchesAny(
    convergence.map((c) => ({
      topic: typeof c === "string" ? c : c.topic,
      description: typeof c === "string" ? c : c.description,
    })),
  );
  const isDiv = matchesAny(
    divergence.map((d) => ({ topic: d.topic, description: d.position_a })),
  );

  if (isConv && !isDiv) return "convergent";
  if (isDiv && !isConv) return "divergent";
  if (isConv && isDiv) return "divergent"; // priorité divergent (signal fort)
  return "neutral";
};

// ─── component ──────────────────────────────────────────────────────────────

export const DebateTimeline: React.FC<DebateTimelineProps> = ({
  videoA,
  perspectives,
  convergence_points,
  divergence_points,
  height = 300,
}) => {
  const [hovered, setHovered] = useState<TimelineMarker | null>(null);
  const visible = perspectives.slice(0, 3);

  // Build markers
  const markers: TimelineMarker[] = useMemo(() => {
    const lanes: { args: DebateArgument[]; name: string; color: string }[] = [
      { args: videoA.arguments, name: "Vidéo A", color: LANE_COLORS[0] },
      ...visible.map((p, i) => ({
        args: p.arguments || [],
        name: `B${i + 1} — ${p.video_title?.slice(0, 24) || ""}`,
        color: LANE_COLORS[(i + 1) % LANE_COLORS.length],
      })),
    ];

    const result: TimelineMarker[] = [];
    lanes.forEach((lane, laneIndex) => {
      const n = lane.args.length;
      lane.args.forEach((arg, idx) => {
        // Equidistant distribution : intro=0.1, conclusion=0.9
        const x = n === 1 ? 0.5 : 0.1 + (idx / Math.max(1, n - 1)) * 0.8;
        result.push({
          laneIndex,
          x,
          argumentIndex: idx,
          argument: arg,
          alignment: classifyArgument(
            arg,
            convergence_points,
            divergence_points,
          ),
          laneName: lane.name,
          laneColor: lane.color,
        });
      });
    });
    return result;
  }, [videoA, visible, convergence_points, divergence_points]);

  const lanesCount = 1 + visible.length;
  const padding = { top: 24, bottom: 32, left: 110, right: 24 };
  const innerHeight = height - padding.top - padding.bottom;
  const laneSpacing = lanesCount > 1 ? innerHeight / (lanesCount - 1) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full relative"
      data-testid="debate-timeline"
    >
      <div className="relative">
        <svg
          viewBox={`0 0 1000 ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="none"
          aria-label="Frise chronologique des arguments"
          role="img"
        >
          {/* Background lanes */}
          {Array.from({ length: lanesCount }).map((_, i) => {
            const y =
              padding.top +
              (lanesCount > 1 ? i * laneSpacing : innerHeight / 2);
            const color =
              i === 0 ? LANE_COLORS[0] : LANE_COLORS[i % LANE_COLORS.length];
            return (
              <g key={`lane-${i}`}>
                <line
                  x1={padding.left}
                  x2={1000 - padding.right}
                  y1={y}
                  y2={y}
                  stroke={color}
                  strokeOpacity={0.25}
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="rgba(255,255,255,0.6)"
                  fontWeight={600}
                >
                  {i === 0 ? "A" : `B${i}`}
                </text>
              </g>
            );
          })}

          {/* x-axis labels */}
          <text
            x={padding.left}
            y={height - 8}
            fontSize="10"
            fill="rgba(255,255,255,0.4)"
          >
            Intro
          </text>
          <text
            x={500}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.4)"
          >
            Développement
          </text>
          <text
            x={1000 - padding.right}
            y={height - 8}
            textAnchor="end"
            fontSize="10"
            fill="rgba(255,255,255,0.4)"
          >
            Conclusion
          </text>

          {/* Markers */}
          {markers.map((m, i) => {
            const cx =
              padding.left + m.x * (1000 - padding.left - padding.right);
            const cy =
              padding.top +
              (lanesCount > 1 ? m.laneIndex * laneSpacing : innerHeight / 2);
            const isHovered =
              hovered?.laneIndex === m.laneIndex &&
              hovered?.argumentIndex === m.argumentIndex;
            return (
              <g
                key={`m-${i}`}
                transform={`translate(${cx}, ${cy})`}
                onMouseEnter={() => setHovered(m)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Outer halo */}
                <circle
                  r={isHovered ? 10 : 7}
                  fill={ALIGNMENT_COLORS[m.alignment]}
                  fillOpacity={isHovered ? 0.35 : 0.2}
                  style={{ transition: "r 150ms" }}
                />
                {/* Inner core */}
                <circle
                  r={isHovered ? 5 : 4}
                  fill={ALIGNMENT_COLORS[m.alignment]}
                  stroke={m.laneColor}
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 max-w-md p-3 rounded-lg bg-[#12121a] border border-white/10 shadow-xl pointer-events-none"
            data-testid="timeline-tooltip"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: hovered.laneColor }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {hovered.laneName}
              </span>
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{
                  background: `${ALIGNMENT_COLORS[hovered.alignment]}22`,
                  color: ALIGNMENT_COLORS[hovered.alignment],
                }}
              >
                {hovered.alignment === "convergent"
                  ? "convergent"
                  : hovered.alignment === "divergent"
                    ? "divergent"
                    : "neutre"}
              </span>
            </div>
            <p className="text-xs font-medium text-white leading-snug mb-1">
              {hovered.argument.claim}
            </p>
            <p className="text-[11px] text-text-secondary leading-snug line-clamp-3">
              {hovered.argument.evidence}
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-text-muted">
        <LegendDot color={ALIGNMENT_COLORS.convergent} label="Convergent" />
        <LegendDot color={ALIGNMENT_COLORS.divergent} label="Divergent" />
        <LegendDot color={ALIGNMENT_COLORS.neutral} label="Neutre" />
      </div>
    </motion.div>
  );
};

const LegendDot: React.FC<{ color: string; label: string }> = ({
  color,
  label,
}) => (
  <span className="inline-flex items-center gap-1.5">
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: color }}
    />
    {label}
  </span>
);

export default DebateTimeline;
