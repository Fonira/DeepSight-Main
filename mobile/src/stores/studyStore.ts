import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StudyProgress, StudyStats } from '../types/v2';

interface StudyStore {
  progress: Record<string, StudyProgress>;
  stats: StudyStats;

  // Actions
  updateProgress: (videoId: string, update: Partial<StudyProgress>) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
}

export const useStudyStore = create<StudyStore>()(
  persist(
    (set) => ({
      progress: {},
      stats: {
        totalStudied: 0,
        averageScore: 0,
        streak: 0,
        lastStudyDate: null,
      },

      updateProgress: (videoId, update) =>
        set((state) => {
          const existing = state.progress[videoId] || {
            videoId,
            flashcardsCompleted: 0,
            flashcardsTotal: 0,
            quizScore: 0,
            quizTotal: 0,
            lastStudied: new Date().toISOString(),
          };
          return {
            progress: {
              ...state.progress,
              [videoId]: { ...existing, ...update, lastStudied: new Date().toISOString() },
            },
          };
        }),

      incrementStreak: () =>
        set((state) => ({
          stats: {
            ...state.stats,
            streak: state.stats.streak + 1,
            lastStudyDate: new Date().toISOString(),
            totalStudied: state.stats.totalStudied + 1,
          },
        })),

      resetStreak: () =>
        set((state) => ({ stats: { ...state.stats, streak: 0 } })),
    }),
    {
      name: 'deepsight-study-v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
