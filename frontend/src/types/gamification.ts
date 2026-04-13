// Types pour le système de gamification DeepSight
// Alignés avec les réponses réelles du backend

export enum FSRSRating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export enum FSRSState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export enum BadgeRarity {
  Common = "common",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export interface FSRSCardState {
  card_index: number;
  front: string;
  back: string;
  state: FSRSState;
  due_date: string | null;
  difficulty: number;
  stability: number;
  reps: number;
}

export interface ReviewResult {
  success: boolean;
  card_index: number;
  new_state: FSRSState;
  next_due: string;
  stability: number;
  difficulty: number;
  xp_earned: number;
  streak_updated: boolean;
  new_badges: string[];
}

export interface DueCardsData {
  success: boolean;
  summary_id: number;
  due_cards: FSRSCardState[];
  new_cards: FSRSCardState[];
  total_due: number;
  total_new: number;
}

// ── Stats (matches backend StatsResponse) ──
export interface StudyStats {
  success?: boolean;
  total_xp: number;
  level: number;
  xp_for_next_level: number;
  xp_progress?: number; // computed client-side if absent
  current_streak: number;
  longest_streak: number;
  total_cards_mastered: number;
  total_cards_reviewed: number;
  total_sessions: number;
  total_time_seconds: number;
  streak_freeze_available?: number;
}

// ── HeatMap (backend returns { days }, frontend uses activities) ──
export interface HeatMapDay {
  date: string;
  cards_reviewed: number;
  xp_earned: number;
  sessions_count?: number;
  time_seconds?: number;
}

export interface HeatMapData {
  success?: boolean;
  days?: HeatMapDay[]; // backend field name
  activities?: HeatMapDay[]; // frontend alias
}

// ── Badges (backend returns flat list, not earned/locked split) ──
export interface BadgeItem {
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  category: string;
  earned: boolean;
  earned_at: string | null;
  progress: number | null; // 0-1 for threshold badges
}

/** Raw API response from /api/gamification/badges */
export interface BadgesApiResponse {
  success?: boolean;
  badges: BadgeItem[];
  earned_count: number;
  total_count: number;
}

/** Normalized frontend format with earned/locked split */
export interface BadgesData {
  earned: BadgeItem[];
  locked: BadgeItem[];
  earned_count: number;
  total_count: number;
}

// ── Video Mastery ──
export interface VideoMastery {
  summary_id: number;
  title?: string;
  channel?: string;
  thumbnail?: string;
  mastery_percent: number;
  total_cards: number;
  mastered_cards?: number;
  due_cards?: number;
  new_cards?: number;
  last_studied?: string | null;
  xp_earned?: number;
}

export interface VideoMasteryData {
  success?: boolean;
  videos: VideoMastery[];
}

export interface StudySessionData {
  session_id: number;
}

export interface SessionEndResult {
  success: boolean;
  xp_earned: number;
  new_badges: string[];
  streak_updated: boolean;
  stats: StudyStats;
}

// Constantes
export const RARITY_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  [BadgeRarity.Common]: {
    bg: "rgba(148, 163, 184, 0.15)",
    border: "rgba(148, 163, 184, 0.3)",
    text: "#94a3b8",
  },
  [BadgeRarity.Rare]: {
    bg: "rgba(59, 130, 246, 0.15)",
    border: "rgba(59, 130, 246, 0.3)",
    text: "#3b82f6",
  },
  [BadgeRarity.Epic]: {
    bg: "rgba(139, 92, 246, 0.15)",
    border: "rgba(139, 92, 246, 0.3)",
    text: "#8b5cf6",
  },
  [BadgeRarity.Legendary]: {
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.3)",
    text: "#f59e0b",
  },
};

export const XP_PER_LEVEL = 500;

export const RATING_CONFIG: Record<
  FSRSRating,
  { label: string; sub: string; color: string; xp: number }
> = {
  [FSRSRating.Again]: {
    label: "Oublié",
    sub: "<1min",
    color: "#ef4444",
    xp: 3,
  },
  [FSRSRating.Hard]: {
    label: "Difficile",
    sub: "~6min",
    color: "#f97316",
    xp: 5,
  },
  [FSRSRating.Good]: { label: "Bien", sub: "~10min", color: "#10b981", xp: 10 },
  [FSRSRating.Easy]: { label: "Facile", sub: ">1j", color: "#3b82f6", xp: 12 },
};
