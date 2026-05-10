import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import { TUTOR_SNAP_MARGIN, type TutorCorner } from "./tutorConstants";
import {
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
  children: React.ReactNode;
}

/**
 * Wrapper draggable pour le Tuteur web (Phase 2 — mai 2026).
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
 *
 * Le wrapper porte le `position: fixed` ; les enfants ne doivent PAS définir
 * leur propre positionnement absolu.
 */
export const DraggableTutorWindow: React.FC<DraggableTutorWindowProps> = ({
  size,
  className,
  ariaLabel,
  role,
  children,
}) => {
  const [corner, setCorner] = useState<TutorCorner>(() => readSavedCorner());
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
    </motion.div>
  );
};

export default DraggableTutorWindow;
