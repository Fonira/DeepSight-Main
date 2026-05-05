import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnalysisSummary } from "../types";
import type { AnalysisOptionsV2 } from "../types/v2";
import { DEFAULT_ANALYSIS_OPTIONS } from "../types/v2";

interface AnalysisStore {
  // Current analysis
  currentTaskId: string | null;
  status:
    | "idle"
    | "pending"
    | "processing"
    | "streaming"
    | "completed"
    | "failed";
  progress: number;
  streamingText: string;
  error: string | null;

  // Options
  options: AnalysisOptionsV2;

  // Cache
  recentSummaries: AnalysisSummary[];
  favorites: string[];

  // Actions
  startAnalysis: (taskId: string) => void;
  setProgress: (progress: number) => void;
  setStreaming: (text: string) => void;
  appendStreaming: (chunk: string) => void;
  completeAnalysis: () => void;
  failAnalysis: (error: string) => void;
  resetAnalysis: () => void;
  setOptions: (options: Partial<AnalysisOptionsV2>) => void;
  addSummary: (summary: AnalysisSummary) => void;
  toggleFavorite: (id: string) => void;
}

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set) => ({
      currentTaskId: null,
      status: "idle",
      progress: 0,
      streamingText: "",
      error: null,
      options: DEFAULT_ANALYSIS_OPTIONS,
      recentSummaries: [],
      favorites: [],

      startAnalysis: (taskId) =>
        set({
          currentTaskId: taskId,
          status: "pending",
          progress: 0,
          error: null,
          streamingText: "",
        }),

      setProgress: (progress) => set({ progress, status: "processing" }),

      setStreaming: (text) => set({ streamingText: text, status: "streaming" }),

      appendStreaming: (chunk) =>
        set((state) => ({
          streamingText: state.streamingText + chunk,
          status: "streaming",
        })),

      completeAnalysis: () => set({ status: "completed", progress: 100 }),

      failAnalysis: (error) => set({ status: "failed", error }),

      resetAnalysis: () =>
        set({
          currentTaskId: null,
          status: "idle",
          progress: 0,
          streamingText: "",
          error: null,
        }),

      setOptions: (options) =>
        set((state) => ({ options: { ...state.options, ...options } })),

      addSummary: (summary) =>
        set((state) => ({
          recentSummaries: [
            summary,
            ...state.recentSummaries.filter((s) => s.id !== summary.id),
          ].slice(0, 50),
        })),

      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((fid) => fid !== id)
            : [...state.favorites, id],
        })),
    }),
    {
      name: "analysis-store",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Only persist user preferences and cached data, not transient analysis state
      partialize: (state) => ({
        options: state.options,
        recentSummaries: state.recentSummaries,
        favorites: state.favorites,
      }),
      // First versioned schema. Bump `version` and branch on `from` when the
      // shape of persisted fields changes, otherwise AsyncStorage will replay
      // an incompatible payload at app start.
      migrate: (persistedState, _from) => persistedState as AnalysisStore,
    },
  ),
);
