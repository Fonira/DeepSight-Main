// frontend/src/components/Tutor/tutorConstants.ts

/**
 * localStorage keys pour le windowing du Tuteur (Phase 2 — mai 2026).
 * Le popup est draggable, snap aux 4 coins, minimisable, fermable persistant.
 * V2 ajoute la persistance de la taille (resize handles).
 */
export const LS_TUTOR_HIDDEN = "ds-tutor-hidden";
export const LS_TUTOR_MINIMIZED = "ds-tutor-minimized";
export const LS_TUTOR_CORNER = "ds-tutor-corner";
export const LS_TUTOR_SIZE = "ds-tutor-size";

/** Tailles des différentes phases (utile pour clamp/snap calculations). */
export const TUTOR_IDLE_SIZE = { width: 200, height: 140 };
export const TUTOR_PROMPTING_SIZE = { width: 220, height: 180 };
export const TUTOR_MINICHAT_SIZE = { width: 280, height: 400 };
export const TUTOR_MINIMIZED_SIZE = { width: 48, height: 48 };

/** Limites du resize (V2 — TutorMiniChat uniquement). */
export const TUTOR_MIN_SIZE = { width: 240, height: 280 };
export const TUTOR_MAX_SIZE = { width: 600, height: 800 };

/** Marge entre le bord du viewport et la fenêtre snappée. */
export const TUTOR_SNAP_MARGIN = 12;

/** Coins disponibles pour le snap. */
export type TutorCorner = "TL" | "TR" | "BL" | "BR";
export const TUTOR_DEFAULT_CORNER: TutorCorner = "TR";

export const DEFAULT_TEXT_DURATION_S = 30;
