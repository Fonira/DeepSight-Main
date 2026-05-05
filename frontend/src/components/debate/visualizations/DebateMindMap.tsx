/**
 * DebateMindMap — mind map convergence/divergence via Excalidraw read-only.
 *
 * Topic central + branches convergence (vert) / divergence (rouge),
 * feuilles citations A/B1/B2/B3.
 *
 * Wave 3 frontend — Débat IA v2 (sub-agent E).
 */

import React, { Suspense, lazy, useMemo } from "react";
import { motion } from "framer-motion";
import "@excalidraw/excalidraw/index.css";
import type {
  ConvergencePoint,
  DebatePerspective,
  DivergencePoint,
} from "../../../types/debate";

// Lazy-load Excalidraw (heavy dep, only loaded on demand)
const Excalidraw = lazy(() =>
  import("@excalidraw/excalidraw").then((m) => ({ default: m.Excalidraw })),
);

interface VideoA {
  title: string;
}

export interface DebateMindMapProps {
  topic: string;
  videoA: VideoA;
  perspectives: DebatePerspective[];
  convergence_points: ConvergencePoint[];
  divergence_points: DivergencePoint[];
  height?: number;
}

// ─── Excalidraw scene builder ───────────────────────────────────────────────

interface ExcalidrawElementSkel {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeStyle?: "solid" | "dashed" | "dotted";
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  fillStyle?: "solid" | "hachure" | "cross-hatch";
  roughness?: number;
  start?: { id?: string };
  end?: { id?: string };
  label?: { text: string };
  id?: string;
}

const PALETTE = {
  topic: { stroke: "#6366f1", bg: "#1e1b4b" }, // indigo
  videoA: { stroke: "#6366f1", bg: "#312e81" },
  perspectiveB: ["#8b5cf6", "#06b6d4", "#3b82f6"], // violet / cyan / blue
  perspectiveBg: ["#3b0764", "#164e63", "#1e3a8a"],
  convergence: { stroke: "#22c55e", bg: "#14532d" }, // green
  divergence: { stroke: "#ef4444", bg: "#7f1d1d" }, // red
  text: "#f8fafc",
  arrow: "#94a3b8",
};

/**
 * Construit un scene Excalidraw en arbre avec layout radial simple.
 * Centre = topic, niveau 1 = vidéo A + perspectives, niveau 2 = points
 * convergence/divergence.
 */
export const buildMindMapScene = (
  topic: string,
  videoA: VideoA,
  perspectives: DebatePerspective[],
  convergence: ConvergencePoint[],
  divergence: DivergencePoint[],
): { elements: ExcalidrawElementSkel[] } => {
  const visible = perspectives.slice(0, 3);
  const elements: ExcalidrawElementSkel[] = [];

  // Center topic
  const cx = 0;
  const cy = 0;
  const topicW = 320;
  const topicH = 80;
  const topicId = "topic";
  elements.push({
    id: topicId,
    type: "rectangle",
    x: cx - topicW / 2,
    y: cy - topicH / 2,
    width: topicW,
    height: topicH,
    strokeColor: PALETTE.topic.stroke,
    backgroundColor: PALETTE.topic.bg,
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 1,
  });
  elements.push({
    type: "text",
    x: cx - topicW / 2 + 12,
    y: cy - 14,
    width: topicW - 24,
    height: 28,
    text: truncate(topic, 80),
    fontSize: 18,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: PALETTE.text,
  });

  // Layout radial : video A à gauche, perspectives à droite
  const sourceRadius = 420;
  const sourcesY: { id: string; x: number; y: number; color: string }[] = [];

  // Vidéo A (gauche)
  const videoAId = "videoA";
  const videoAX = cx - sourceRadius;
  const videoAY = cy;
  pushBox(elements, {
    id: videoAId,
    x: videoAX,
    y: videoAY,
    label: `Vidéo A: ${truncate(videoA.title, 40)}`,
    stroke: PALETTE.videoA.stroke,
    bg: PALETTE.videoA.bg,
  });
  sourcesY.push({
    id: videoAId,
    x: videoAX,
    y: videoAY,
    color: PALETTE.videoA.stroke,
  });
  pushArrow(elements, topicId, videoAId, PALETTE.arrow);

  // Perspectives B (droite, espacement vertical)
  const verticalSpacing = 180;
  const startY = -(Math.max(0, visible.length - 1) * verticalSpacing) / 2;
  visible.forEach((p, i) => {
    const id = `B${i + 1}`;
    const x = cx + sourceRadius;
    const y = startY + i * verticalSpacing;
    const color = PALETTE.perspectiveB[i % PALETTE.perspectiveB.length];
    const bg = PALETTE.perspectiveBg[i % PALETTE.perspectiveBg.length];
    pushBox(elements, {
      id,
      x,
      y,
      label: `${id}: ${truncate(p.video_title || "", 40)}`,
      stroke: color,
      bg,
    });
    sourcesY.push({ id, x, y, color });
    pushArrow(elements, topicId, id, PALETTE.arrow);
  });

  // Convergence points (en bas du topic)
  const convStartX = cx - ((convergence.length - 1) * 320) / 2;
  convergence.slice(0, 4).forEach((c, i) => {
    const id = `conv-${i}`;
    const text = typeof c === "string" ? c : c.description || c.topic || "";
    pushLeaf(elements, {
      id,
      x: convStartX + i * 320,
      y: cy + 220,
      label: `✓ ${truncate(text, 60)}`,
      stroke: PALETTE.convergence.stroke,
      bg: PALETTE.convergence.bg,
      width: 280,
    });
    pushArrow(elements, topicId, id, PALETTE.convergence.stroke);
  });

  // Divergence points (en haut du topic)
  const divStartX = cx - ((divergence.length - 1) * 320) / 2;
  divergence.slice(0, 4).forEach((d, i) => {
    const id = `div-${i}`;
    pushLeaf(elements, {
      id,
      x: divStartX + i * 320,
      y: cy - 240,
      label: `↯ ${truncate(d.topic || "", 60)}`,
      stroke: PALETTE.divergence.stroke,
      bg: PALETTE.divergence.bg,
      width: 280,
    });
    pushArrow(elements, topicId, id, PALETTE.divergence.stroke);
  });

  return { elements };
};

const pushBox = (
  out: ExcalidrawElementSkel[],
  opts: {
    id: string;
    x: number;
    y: number;
    label: string;
    stroke: string;
    bg: string;
  },
) => {
  const w = 280;
  const h = 70;
  out.push({
    id: opts.id,
    type: "rectangle",
    x: opts.x - w / 2,
    y: opts.y - h / 2,
    width: w,
    height: h,
    strokeColor: opts.stroke,
    backgroundColor: opts.bg,
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 1,
  });
  out.push({
    type: "text",
    x: opts.x - w / 2 + 12,
    y: opts.y - 12,
    width: w - 24,
    height: 24,
    text: opts.label,
    fontSize: 14,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: PALETTE.text,
  });
};

const pushLeaf = (
  out: ExcalidrawElementSkel[],
  opts: {
    id: string;
    x: number;
    y: number;
    label: string;
    stroke: string;
    bg: string;
    width?: number;
  },
) => {
  const w = opts.width || 240;
  const h = 60;
  out.push({
    id: opts.id,
    type: "rectangle",
    x: opts.x - w / 2,
    y: opts.y - h / 2,
    width: w,
    height: h,
    strokeColor: opts.stroke,
    backgroundColor: opts.bg,
    fillStyle: "solid",
    strokeWidth: 1.5,
    roughness: 1,
  });
  out.push({
    type: "text",
    x: opts.x - w / 2 + 8,
    y: opts.y - 10,
    width: w - 16,
    height: 20,
    text: opts.label,
    fontSize: 12,
    textAlign: "left",
    verticalAlign: "middle",
    strokeColor: PALETTE.text,
  });
};

const pushArrow = (
  out: ExcalidrawElementSkel[],
  fromId: string,
  toId: string,
  color: string,
) => {
  out.push({
    type: "arrow",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    strokeColor: color,
    strokeWidth: 1.5,
    start: { id: fromId },
    end: { id: toId },
    roughness: 1,
  });
};

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max - 1)}…`;

// ─── Excalidraw scene → real elements ───────────────────────────────────────
//
// Excalidraw uses convertToExcalidrawElements() to inflate skeleton elements.
// Imported lazily inside the component to avoid SSR/test issues.

// ─── component ──────────────────────────────────────────────────────────────

export const DebateMindMap: React.FC<DebateMindMapProps> = ({
  topic,
  videoA,
  perspectives,
  convergence_points,
  divergence_points,
  height = 500,
}) => {
  const skeleton = useMemo(
    () =>
      buildMindMapScene(
        topic,
        videoA,
        perspectives,
        convergence_points,
        divergence_points,
      ),
    [topic, videoA, perspectives, convergence_points, divergence_points],
  );

  // Convert skeleton → Excalidraw elements at render time
  const elementsPromise = useMemo(
    () =>
      import("@excalidraw/excalidraw").then((m) =>
        m.convertToExcalidrawElements(skeleton.elements as never),
      ),
    [skeleton],
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full"
      data-testid="debate-mindmap"
    >
      <div
        className="w-full rounded-lg overflow-hidden border border-white/10 bg-[#0a0a0f]"
        style={{ height }}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-xs text-text-muted">
              Chargement de la carte mentale…
            </div>
          }
        >
          <MindMapInner
            elementsPromise={elementsPromise}
            scene={skeleton}
            height={height}
          />
        </Suspense>
      </div>
      <p className="mt-2 px-1 text-[10px] text-text-muted">
        Carte mentale interactive (mode lecture seule). Branches vertes =
        convergence, rouges = divergence.
      </p>
    </motion.div>
  );
};

// Inner component to allow Suspense to handle the async import
const MindMapInner: React.FC<{
  elementsPromise: Promise<unknown>;
  scene: { elements: ExcalidrawElementSkel[] };
  height: number;
}> = ({ elementsPromise }) => {
  const [elements, setElements] = React.useState<unknown[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    elementsPromise.then((els) => {
      if (!cancelled) setElements(els as unknown[]);
    });
    return () => {
      cancelled = true;
    };
  }, [elementsPromise]);

  if (!elements) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-text-muted">
        Construction de la carte…
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExcalidrawAny = Excalidraw as any;

  return (
    <ExcalidrawAny
      initialData={{
        elements,
        appState: {
          viewBackgroundColor: "#0a0a0f",
          gridModeEnabled: false,
          theme: "dark",
          zenModeEnabled: false,
          viewModeEnabled: true,
        },
        scrollToContent: true,
      }}
      viewModeEnabled
      gridModeEnabled={false}
      theme="dark"
      UIOptions={{
        canvasActions: {
          changeViewBackgroundColor: false,
          clearCanvas: false,
          export: false,
          loadScene: false,
          saveToActiveFile: false,
          toggleTheme: false,
          saveAsImage: true,
        },
      }}
    />
  );
};

export default DebateMindMap;
