// frontend/src/components/Tutor/snapHelpers.ts
//
// Helpers extraits de DraggableTutorWindow pour ne pas polluer le module
// composant (sinon eslint react-refresh râle).

import {
  LS_TUTOR_CORNER,
  LS_TUTOR_SIZE,
  TUTOR_DEFAULT_CORNER,
  TUTOR_MAX_SIZE,
  TUTOR_MIN_SIZE,
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

/** Clamp une dimension entre TUTOR_MIN_SIZE et TUTOR_MAX_SIZE. */
export function clampSize(size: {
  width: number;
  height: number;
}): { width: number; height: number } {
  return {
    width: Math.max(
      TUTOR_MIN_SIZE.width,
      Math.min(TUTOR_MAX_SIZE.width, Math.round(size.width)),
    ),
    height: Math.max(
      TUTOR_MIN_SIZE.height,
      Math.min(TUTOR_MAX_SIZE.height, Math.round(size.height)),
    ),
  };
}

/** Lit la taille sauvée du Tuteur (TutorMiniChat) depuis localStorage. */
export function readSavedSize(
  fallback: { width: number; height: number },
): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(LS_TUTOR_SIZE);
    if (raw) {
      const parsed = JSON.parse(raw) as { width?: number; height?: number };
      if (
        parsed &&
        typeof parsed.width === "number" &&
        typeof parsed.height === "number" &&
        Number.isFinite(parsed.width) &&
        Number.isFinite(parsed.height)
      ) {
        return clampSize({ width: parsed.width, height: parsed.height });
      }
    }
  } catch {
    /* ignore */
  }
  return clampSize(fallback);
}

/** Sauve la taille du Tuteur (TutorMiniChat) en localStorage. */
export function saveSize(size: { width: number; height: number }) {
  try {
    localStorage.setItem(
      LS_TUTOR_SIZE,
      JSON.stringify(clampSize(size)),
    );
  } catch {
    /* ignore */
  }
}
