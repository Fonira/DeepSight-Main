import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import {
  TUTOR_MAX_SIZE,
  TUTOR_MIN_SIZE,
  TUTOR_SNAP_MARGIN,
  type TutorCorner,
} from "./tutorConstants";
import {
  clampSize,
  cornerToPosition,
  nearestCorner,
  readSavedCorner,
  saveCorner,
} from "./snapHelpers";

interface DraggableTutorWindowProps {
  size: { width: number; height: number };
  className?: string;
  ariaLabel?: string;
  role?: string;
  /**
   * V2 — Active les 8 resize handles (4 bords + 4 coins). Défaut `false`
   * pour préserver le comportement legacy de TutorIdle / TutorPrompting
   * (taille fixe). TutorMiniChat passe `true`.
   */
  resizable?: boolean;
  /**
   * V2 — Callback déclenché à chaque tick du resize. Le parent doit clamp
   * et persister (ex. localStorage `LS_TUTOR_SIZE`). Sans `onResize`, les
   * handles sont quand même rendus si `resizable` est `true` mais le parent
   * ne sera jamais notifié — utile pour smoke-tests.
   */
  onResize?: (size: { width: number; height: number }) => void;
  children: React.ReactNode;
}

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * Wrapper draggable pour le Tuteur web (Phase 2 — mai 2026, étendu V2).
 *
 * Comportement :
 * - Drag libre via Framer Motion : toute la fenêtre est draggable
 *   (les éléments interactifs intérieurs - boutons, input - peuvent
 *   appeler `e.stopPropagation()` sur leur `onPointerDown` pour
 *   empêcher le drag init quand on clique dessus).
 * - Au lâcher : snap vers le coin le plus proche (TL/TR/BL/BR)
 * - Position persistée en localStorage (clé `ds-tutor-corner`)
 * - Recalcul automatique à chaque resize fenêtre (depuis le coin sauvé,
 *   pas une position absolue x/y → robuste au resize)
 * - V2 : si `resizable`, 8 handles (4 bords + 4 coins) permettent de
 *   redimensionner la fenêtre dans les limites TUTOR_MIN_SIZE/MAX_SIZE.
 *   Le coin actuel est conservé après resize (snap recalculé).
 *
 * Le wrapper porte le `position: fixed` ; les enfants ne doivent PAS définir
 * leur propre positionnement absolu.
 */
export const DraggableTutorWindow: React.FC<DraggableTutorWindowProps> = ({
  size,
  className,
  ariaLabel,
  role,
  resizable = false,
  onResize,
  children,
}) => {
  const [corner, setCorner] = useState<TutorCorner>(() => readSavedCorner());
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const onWinResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, []);

  const position = useMemo(
    () => cornerToPosition(corner, size, viewport),
    [corner, size, viewport],
  );

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const cx = position.left + info.offset.x + size.width / 2;
      const cy = position.top + info.offset.y + size.height / 2;
      const next = nearestCorner({ x: cx, y: cy }, viewport);
      setCorner(next);
      saveCorner(next);
    },
    [position.left, position.top, size.width, size.height, viewport],
  );

  // Constraints clampées au viewport, calculées en delta (offset) car Framer
  // applique le drag par transform sur (x,y) au-dessus du `top/left` fixe.
  const dragConstraints = useMemo(
    () => ({
      top: TUTOR_SNAP_MARGIN - position.top,
      left: TUTOR_SNAP_MARGIN - position.left,
      right: viewport.width - size.width - TUTOR_SNAP_MARGIN - position.left,
      bottom:
        viewport.height - size.height - TUTOR_SNAP_MARGIN - position.top,
    }),
    [
      position.left,
      position.top,
      viewport.width,
      viewport.height,
      size.width,
      size.height,
    ],
  );

  // ── Resize state (V2) ──
  // refs to avoid re-creating listeners on every render.
  const resizeStateRef = useRef<{
    dir: ResizeDir;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (dir: ResizeDir, e: React.PointerEvent<HTMLDivElement>) => {
      if (!resizable || !onResize) return;
      e.stopPropagation();
      e.preventDefault();
      resizeStateRef.current = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: size.width,
        startHeight: size.height,
      };

      const onMove = (ev: PointerEvent) => {
        const state = resizeStateRef.current;
        if (!state) return;
        const dx = ev.clientX - state.startX;
        const dy = ev.clientY - state.startY;
        let nextWidth = state.startWidth;
        let nextHeight = state.startHeight;

        // Each direction adjusts width/height with the appropriate sign:
        // east/west drive width, north/south drive height. Corner handles
        // combine both. We assume the window keeps its current anchor
        // (snapped corner) — so dragging the WEST handle to the LEFT grows
        // width, and to the RIGHT shrinks it; symmetric for north/south.
        if (state.dir.includes("e")) nextWidth = state.startWidth + dx;
        if (state.dir.includes("w")) nextWidth = state.startWidth - dx;
        if (state.dir.includes("s")) nextHeight = state.startHeight + dy;
        if (state.dir.includes("n")) nextHeight = state.startHeight - dy;

        const clamped = clampSize({ width: nextWidth, height: nextHeight });
        onResize(clamped);
      };

      const onUp = () => {
        resizeStateRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [resizable, onResize, size.width, size.height],
  );

  // Handle props per direction (cursor, position) — pre-computed to keep
  // the JSX tidy. 8px for edges, 12px for corners.
  const handles: Array<{
    dir: ResizeDir;
    style: React.CSSProperties;
    testId: string;
  }> = useMemo(() => {
    const EDGE = 8;
    const CORNER = 12;
    return [
      // Edges
      {
        dir: "n",
        testId: "resize-n",
        style: {
          top: 0,
          left: CORNER,
          right: CORNER,
          height: EDGE,
          cursor: "ns-resize",
        },
      },
      {
        dir: "s",
        testId: "resize-s",
        style: {
          bottom: 0,
          left: CORNER,
          right: CORNER,
          height: EDGE,
          cursor: "ns-resize",
        },
      },
      {
        dir: "e",
        testId: "resize-e",
        style: {
          top: CORNER,
          bottom: CORNER,
          right: 0,
          width: EDGE,
          cursor: "ew-resize",
        },
      },
      {
        dir: "w",
        testId: "resize-w",
        style: {
          top: CORNER,
          bottom: CORNER,
          left: 0,
          width: EDGE,
          cursor: "ew-resize",
        },
      },
      // Corners
      {
        dir: "nw",
        testId: "resize-nw",
        style: {
          top: 0,
          left: 0,
          width: CORNER,
          height: CORNER,
          cursor: "nwse-resize",
        },
      },
      {
        dir: "ne",
        testId: "resize-ne",
        style: {
          top: 0,
          right: 0,
          width: CORNER,
          height: CORNER,
          cursor: "nesw-resize",
        },
      },
      {
        dir: "sw",
        testId: "resize-sw",
        style: {
          bottom: 0,
          left: 0,
          width: CORNER,
          height: CORNER,
          cursor: "nesw-resize",
        },
      },
      {
        dir: "se",
        testId: "resize-se",
        style: {
          bottom: 0,
          right: 0,
          width: CORNER,
          height: CORNER,
          cursor: "nwse-resize",
        },
      },
    ];
  }, []);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={dragConstraints}
      onDragEnd={handleDragEnd}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: size.width,
        height: size.height,
        touchAction: "none",
      }}
      animate={{ x: 0, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 320,
        damping: 30,
      }}
      role={role}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
      {resizable &&
        handles.map((h) => (
          <div
            key={h.dir}
            data-testid={h.testId}
            onPointerDown={(e) => handleResizeStart(h.dir, e)}
            style={{
              position: "absolute",
              zIndex: 50,
              ...h.style,
            }}
            aria-hidden="true"
          />
        ))}
    </motion.div>
  );
};

export { TUTOR_MAX_SIZE, TUTOR_MIN_SIZE };
export default DraggableTutorWindow;
