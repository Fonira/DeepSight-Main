import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  StudyStats, HeatMapData, BadgesData, VideoMasteryData,
  DueCardsData, ReviewResult, SessionEndResult,
} from '../types/gamification';
import { gamificationApi } from '../services/api';

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
  activeTab: 'overview' | 'videos' | 'badges';

  // Actions
  fetchStats: () => Promise<void>;
  fetchHeatMap: (days?: number) => Promise<void>;
  fetchBadges: () => Promise<void>;
  fetchVideoMastery: () => Promise<void>;
  fetchDueCards: (summaryId: number) => Promise<void>;
  fetchAll: () => Promise<void>;

  // Session actions
  startSession: (summaryId?: number, type?: string) => Promise<void>;
  submitReview: (summaryId: number, cardIndex: number, cardFront: string, rating: number) => Promise<ReviewResult | null>;
  endSession: () => Promise<SessionEndResult | null>;

  // UI actions
  setActiveTab: (tab: 'overview' | 'videos' | 'badges') => void;
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
      activeTab: 'overview',

      fetchStats: async () => {
        try {
          const data = await gamificationApi.getStats();
          set({ stats: data });
        } catch (error) {
          console.error('[StudyStore] Failed to fetch stats:', error);
        }
      },

      fetchHeatMap: async (days = 35) => {
        try {
          const data = await gamificationApi.getHeatMap(days);
          set({ heatMap: data });
        } catch (error) {
          console.error('[StudyStore] Failed to fetch heat map:', error);
        }
      },

      fetchBadges: async () => {
        try {
          const data = await gamificationApi.getBadges();
          set({ badges: data });
        } catch (error) {
          console.error('[StudyStore] Failed to fetch badges:', error);
        }
      },

      fetchVideoMastery: async () => {
        try {
          const data = await gamificationApi.getVideoMastery();
          set({ videoMastery: data });
        } catch (error) {
          console.error('[StudyStore] Failed to fetch video mastery:', error);
        }
      },

      fetchDueCards: async (summaryId: number) => {
        try {
          set({ loading: true });
          const data = await gamificationApi.getDueCards(summaryId);
          set({ dueCards: data, loading: false });
        } catch (error) {
          console.error('[StudyStore] Failed to fetch due cards:', error);
          set({ loading: false });
        }
      },

      fetchAll: async () => {
        set({ loading: true });
        await Promise.all([
          get().fetchStats(),
          get().fetchHeatMap(),
          get().fetchBadges(),
          get().fetchVideoMastery(),
        ]);
        set({ loading: false });
      },

      startSession: async (summaryId, type = 'flashcards') => {
        try {
          const data = await gamificationApi.startSession({ summary_id: summaryId, session_type: type });
          set({
            currentSessionId: data.session_id,
            sessionXP: 0,
            sessionCards: 0,
            sessionCorrect: 0,
            sessionStartTime: Date.now(),
          });
        } catch (error) {
          console.error('[StudyStore] Failed to start session:', error);
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
            state.sessionXP += result.xp_earned;
            state.sessionCards += 1;
            if (rating >= 3) state.sessionCorrect += 1;
          });
          return result;
        } catch (error) {
          console.error('[StudyStore] Failed to submit review:', error);
          return null;
        }
      },

      endSession: async () => {
        const { currentSessionId, sessionCards, sessionCorrect, sessionStartTime } = get();
        if (!currentSessionId) return null;

        try {
          const duration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;
          const result = await gamificationApi.endSession({
            session_id: currentSessionId,
            cards_reviewed: sessionCards,
            cards_correct: sessionCorrect,
            duration_seconds: duration,
          });
          set({
            stats: result.stats,
            currentSessionId: null,
            sessionStartTime: null,
          });
          // Refresh badges after session
          get().fetchBadges();
          return result;
        } catch (error) {
          console.error('[StudyStore] Failed to end session:', error);
          return null;
        }
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      resetSession: () => set({
        currentSessionId: null,
        sessionXP: 0,
        sessionCards: 0,
        sessionCorrect: 0,
        sessionStartTime: null,
        dueCards: null,
      }),
    })),
    { name: 'StudyStore' }
  )
);
