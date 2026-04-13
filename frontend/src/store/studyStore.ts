import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  StudyStats,
  HeatMapData,
  BadgesData,
  VideoMasteryData,
  DueCardsData,
  ReviewResult,
  SessionEndResult,
  BadgeItem,
} from "../types/gamification";
import { XP_PER_LEVEL } from "../types/gamification";
import { gamificationApi } from "../services/api";

// ── Helpers: normalize API responses ──

function normalizeStats(raw: any): StudyStats {
  const totalXp = raw?.total_xp ?? 0;
  const level = raw?.level ?? 1;
  const xpForNext = raw?.xp_for_next_level ?? XP_PER_LEVEL;
  const xpInLevel = totalXp - (level - 1) * XP_PER_LEVEL;
  return {
    ...raw,
    total_xp: totalXp,
    level,
    xp_for_next_level: xpForNext,
    xp_progress: Math.max(0, Math.min(xpInLevel, xpForNext)),
    current_streak: raw?.current_streak ?? 0,
    longest_streak: raw?.longest_streak ?? 0,
    total_cards_mastered: raw?.total_cards_mastered ?? 0,
    total_cards_reviewed: raw?.total_cards_reviewed ?? 0,
    total_sessions: raw?.total_sessions ?? 0,
    total_time_seconds: raw?.total_time_seconds ?? 0,
  };
}

function normalizeHeatMap(raw: any): HeatMapData {
  // Backend sends { days: [...] }, frontend uses activities
  const activities = raw?.days ?? raw?.activities ?? [];
  return { days: activities, activities };
}

function normalizeBadges(raw: any): BadgesData {
  // Backend sends { badges: [...flat list...], earned_count, total_count }
  // Frontend wants { earned: [...], locked: [...] }
  const allBadges: BadgeItem[] = raw?.badges ?? [];
  const earned = allBadges.filter((b: BadgeItem) => b.earned);
  const locked = allBadges.filter((b: BadgeItem) => !b.earned);
  return {
    earned,
    locked,
    earned_count: raw?.earned_count ?? earned.length,
    total_count: raw?.total_count ?? allBadges.length,
  };
}

function normalizeVideoMastery(raw: any): VideoMasteryData {
  const videos = (raw?.videos ?? []).map((v: any) => ({
    ...v,
    due_cards: v.due_cards ?? 0,
    new_cards: v.new_cards ?? 0,
    title: v.title ?? `Vidéo #${v.summary_id}`,
    channel: v.channel ?? "",
    mastery_percent: v.mastery_percent ?? 0,
    total_cards: v.total_cards ?? 0,
  }));
  return { videos };
}

interface StudyStore {
  // State
  stats: StudyStats | null;
  heatMap: HeatMapData | null;
  badges: BadgesData | null;
  videoMastery: VideoMasteryData | null;
  dueCards: DueCardsData | null;

  // Session state
  currentSessionId: number | null;
  sessionXP: number;
  sessionCards: number;
  sessionCorrect: number;
  sessionStartTime: number | null;

  // UI state
  loading: boolean;
  activeTab: "overview" | "videos" | "badges";

  // Actions
  fetchStats: () => Promise<void>;
  fetchHeatMap: (days?: number) => Promise<void>;
  fetchBadges: () => Promise<void>;
  fetchVideoMastery: () => Promise<void>;
  fetchDueCards: (summaryId: number) => Promise<void>;
  fetchAll: () => Promise<void>;

  // Session actions
  startSession: (summaryId?: number, type?: string) => Promise<void>;
  submitReview: (
    summaryId: number,
    cardIndex: number,
    cardFront: string,
    rating: number,
  ) => Promise<ReviewResult | null>;
  endSession: () => Promise<SessionEndResult | null>;

  // UI actions
  setActiveTab: (tab: "overview" | "videos" | "badges") => void;
  resetSession: () => void;
}

export const useStudyStore = create<StudyStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      stats: null,
      heatMap: null,
      badges: null,
      videoMastery: null,
      dueCards: null,
      currentSessionId: null,
      sessionXP: 0,
      sessionCards: 0,
      sessionCorrect: 0,
      sessionStartTime: null,
      loading: false,
      activeTab: "overview",

      fetchStats: async () => {
        try {
          const raw = await gamificationApi.getStats();
          set({ stats: normalizeStats(raw) });
        } catch (error) {
          console.error("[StudyStore] Failed to fetch stats:", error);
        }
      },

      fetchHeatMap: async (days = 35) => {
        try {
          const raw = await gamificationApi.getHeatMap(days);
          set({ heatMap: normalizeHeatMap(raw) });
        } catch (error) {
          console.error("[StudyStore] Failed to fetch heat map:", error);
        }
      },

      fetchBadges: async () => {
        try {
          const raw = await gamificationApi.getBadges();
          set({ badges: normalizeBadges(raw) });
        } catch (error) {
          console.error("[StudyStore] Failed to fetch badges:", error);
        }
      },

      fetchVideoMastery: async () => {
        try {
          const raw = await gamificationApi.getVideoMastery();
          set({ videoMastery: normalizeVideoMastery(raw) });
        } catch (error) {
          console.error("[StudyStore] Failed to fetch video mastery:", error);
        }
      },

      fetchDueCards: async (summaryId: number) => {
        try {
          set({ loading: true });
          const data = await gamificationApi.getDueCards(summaryId);
          set({ dueCards: data, loading: false });
        } catch (error) {
          console.error("[StudyStore] Failed to fetch due cards:", error);
          set({ loading: false });
        }
      },

      fetchAll: async () => {
        set({ loading: true });
        try {
          await Promise.allSettled([
            get().fetchStats(),
            get().fetchHeatMap(),
            get().fetchBadges(),
            get().fetchVideoMastery(),
          ]);
        } catch (error) {
          console.error("[StudyStore] fetchAll error:", error);
        }
        set({ loading: false });
      },

      startSession: async (summaryId, type = "flashcards") => {
        try {
          const data = await gamificationApi.startSession({
            summary_id: summaryId,
            session_type: type,
          });
          set({
            currentSessionId: data.session_id,
            sessionXP: 0,
            sessionCards: 0,
            sessionCorrect: 0,
            sessionStartTime: Date.now(),
          });
        } catch (error) {
          console.error("[StudyStore] Failed to start session:", error);
        }
      },

      submitReview: async (summaryId, cardIndex, cardFront, rating) => {
        try {
          const result = await gamificationApi.submitReview({
            summary_id: summaryId,
            card_index: cardIndex,
            card_front: cardFront,
            rating,
          });
          set((state) => {
            state.sessionXP += result.xp_earned ?? 0;
            state.sessionCards += 1;
            if (rating >= 3) state.sessionCorrect += 1;
          });
          return result;
        } catch (error) {
          console.error("[StudyStore] Failed to submit review:", error);
          return null;
        }
      },

      endSession: async () => {
        const {
          currentSessionId,
          sessionCards,
          sessionCorrect,
          sessionStartTime,
        } = get();
        if (!currentSessionId) return null;

        try {
          const duration = sessionStartTime
            ? Math.floor((Date.now() - sessionStartTime) / 1000)
            : 0;
          const result = await gamificationApi.endSession({
            session_id: currentSessionId,
            cards_reviewed: sessionCards,
            cards_correct: sessionCorrect,
            duration_seconds: duration,
          });
          set({
            stats: normalizeStats(result.stats),
            currentSessionId: null,
            sessionStartTime: null,
          });
          // Refresh badges after session
          get().fetchBadges();
          return result;
        } catch (error) {
          console.error("[StudyStore] Failed to end session:", error);
          return null;
        }
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      resetSession: () =>
        set({
          currentSessionId: null,
          sessionXP: 0,
          sessionCards: 0,
          sessionCorrect: 0,
          sessionStartTime: null,
          dueCards: null,
        }),
    })),
    { name: "StudyStore" },
  ),
);
