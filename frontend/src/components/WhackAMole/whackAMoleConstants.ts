/**
 * WhackAMole — Constants for timing, sizing, and safe zones.
 */

// ─── Timing (ms) ────────────────────────────────────────────────────────────

/** How long the mole stays visible before disappearing (randomized in range) */
export const MOLE_VISIBLE_MIN = 6000;
export const MOLE_VISIBLE_MAX = 8000;

/** Cooldown between mole cycles (randomized in range) */
export const COOLDOWN_MIN = 15000;
export const COOLDOWN_MAX = 25000;

/** How long the fact card stays visible before auto-dismiss */
export const FACT_DISPLAY_DURATION = 12000;

/** Initial delay before first spawn after mount */
export const INITIAL_DELAY = 5000;

// ─── Sizing ─────────────────────────────────────────────────────────────────

export const MOLE_SIZE = 56;
export const MOLE_EMOJI_SIZE = 24;

/** Padding from viewport edges */
export const EDGE_PADDING = 64;

/** Buffer around safe zones */
export const SAFE_ZONE_BUFFER = 20;

/** Number of random candidate positions to try */
export const POSITION_CANDIDATES = 20;

/** Fact card max width */
export const FACT_CARD_WIDTH = 320;

// ─── Category icons ─────────────────────────────────────────────────────────

export const CAT_ICONS: Record<string, string> = {
  cognitive_bias: '🧠', science: '🔬', philosophy: '🎭', culture: '🌍',
  misc: '✨', history: '📜', technology: '⚡', person: '👤',
  company: '🏢', concept: '💡', event: '📅', place: '📍',
  psychology: '🧩', economics: '💰', art: '🎨', nature: '🌿',
};

// ─── Particle burst ─────────────────────────────────────────────────────────

export const PARTICLE_COUNT = 8;
export const PARTICLE_SIZE = 6;
export const PARTICLE_DISTANCE = 60;
export const PARTICLE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#C8903A'];

// ─── Confetti milestones ────────────────────────────────────────────────────

export const CONFETTI_MILESTONES = [3, 5, 10, 20, 50];

// ─── localStorage keys ──────────────────────────────────────────────────────

export const LS_ENABLED = 'ds-whack-a-mole-enabled';
export const LS_DAILY_CATCHES = 'ds-whack-a-mole-daily-catches';
