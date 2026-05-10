// frontend/src/components/Tutor/snapHelpers.ts
//
// Helpers extraits de DraggableTutorWindow pour ne pas polluer le module
// composant (sinon eslint react-refresh râle).

import {
  LS_TUTOR_CORNER,
  TUTOR_DEFAULT_CORNER,
  TUTOR_SNAP_MARGIN,
  type TutorCorner,
} from "./tutorConstants";

/**
 * Calcule les coordonnées top/left pour un coin donné, étant donné
 * la taille de la fenêtre Tuteur et celle du viewport.
 */
export function cornerToPosition(
  corner: TutorCorner,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin: number = TUTOR_SNAP_MARGIN,
): { top: number; left: number } {
  switch (corner) {
    case "TL":
      return { top: margin, left: margin };
    case "TR":
      return { top: margin, left: viewport.width - size.width - margin };
    case "BL":
      return { top: viewport.height - size.height - margin, left: margin };
    case "BR":
      return {
        top: viewport.height - size.height - margin,
        left: viewport.width - size.width - margin,
      };
  }
}

/**
 * Trouve le coin le plus proche d'un point (x,y) dans le viewport,
 * en mesurant la distance au CENTRE de chaque "zone d'attraction".
 * Pattern Discord/Skype Picture-in-Picture.
 */
export function nearestCorner(
  point: { x: number; y: number },
  viewport: { width: number; height: number },
): TutorCorner {
  const corners: Record<TutorCorner, { x: number; y: number }> = {
    TL: { x: 0, y: 0 },
    TR: { x: viewport.width, y: 0 },
    BL: { x: 0, y: viewport.height },
    BR: { x: viewport.width, y: viewport.height },
  };
  let best: TutorCorner = "TR";
  let bestDist = Infinity;
  (Object.keys(corners) as TutorCorner[]).forEach((c) => {
    const dx = point.x - corners[c].x;
    const dy = point.y - corners[c].y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  });
  return best;
}

export function readSavedCorner(): TutorCorner {
  try {
    const raw = localStorage.getItem(LS_TUTOR_CORNER);
    if (raw === "TL" || raw === "TR" || raw === "BL" || raw === "BR") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return TUTOR_DEFAULT_CORNER;
}

export function saveCorner(corner: TutorCorner) {
  try {
    localStorage.setItem(LS_TUTOR_CORNER, corner);
  } catch {
    /* ignore */
  }
}
