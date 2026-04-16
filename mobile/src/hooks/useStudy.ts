import { useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useStudyStore } from "../stores/studyStore";
import { studyApi } from "../services/api";
import { OfflineCache, CachePriority } from "../services/OfflineCache";
import type { Flashcard, QuizQuestionV2 } from "../types/v2";

// Cache study content aggressively — flashcards/quizzes for a given summary
// rarely change, and offline review is the #1 mobile retention use case.
const STUDY_CACHE_TTL_MINUTES = 30 * 24 * 60; // 30 days

async function isOffline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !state.isConnected || state.isInternetReachable === false;
}

export function useStudy(summaryId: string) {
  const store = useStudyStore();

  const generateFlashcards = useCallback(async (): Promise<Flashcard[]> => {
    const cacheKey = `flashcards_${summaryId}`;

    // Offline: serve cache (empty fallback keeps existing "silent fail" contract)
    if (await isOffline()) {
      const cached = await OfflineCache.get<Flashcard[]>(cacheKey);
      return cached ?? [];
    }

    try {
      const response = await studyApi.generateFlashcards(summaryId);
      const raw = response as any;
      const cards = raw.flashcards || [];
      const mapped: Flashcard[] = cards
        .filter((f: any) => f && (f.front || f.question))
        .map((f: any, i: number) => ({
          id: `fc-${i}`,
          front: f.front || f.question || "",
          back: f.back || f.answer || f.definition || "",
          difficulty: f.difficulty || ("medium" as const),
          repetitions: 0,
        }));

      // Persist for offline review (only if non-empty — don't cache failures)
      if (mapped.length > 0) {
        await OfflineCache.set(cacheKey, mapped, {
          priority: CachePriority.HIGH,
          ttlMinutes: STUDY_CACHE_TTL_MINUTES,
          tags: ["study", `study_${summaryId}`],
        });
      }
      return mapped;
    } catch {
      // Network failure → fallback to cache
      const cached = await OfflineCache.get<Flashcard[]>(cacheKey);
      return cached ?? [];
    }
  }, [summaryId]);

  const generateQuiz = useCallback(async (): Promise<QuizQuestionV2[]> => {
    const cacheKey = `quiz_${summaryId}`;

    if (await isOffline()) {
      const cached = await OfflineCache.get<QuizQuestionV2[]>(cacheKey);
      return cached ?? [];
    }

    try {
      const response = await studyApi.generateQuiz(summaryId);
      const raw = response as any;
      // Backend renvoie { quiz: [...] } (QuizResponse model)
      const questions = raw.quiz || raw.questions || [];
      const mapped: QuizQuestionV2[] = questions.map((q: any, i: number) => {
        // Support both legacy single-answer and new multi-answer format from backend
        const rawIndices: number[] | undefined =
          q.correct_indices ?? q.correctIndices ?? q.correct_indexes;
        const singleIndex: number =
          q.correct_index ?? q.correctIndex ?? q.correct ?? 0;

        const correctIndices: number[] =
          rawIndices && rawIndices.length > 0 ? rawIndices : [singleIndex];

        return {
          id: `q-${i}`,
          question: q.question || "",
          options: q.options || q.choices || [],
          correctIndex: correctIndices[0],
          correctIndices,
          explanation: q.explanation || "",
        };
      });

      if (mapped.length > 0) {
        await OfflineCache.set(cacheKey, mapped, {
          priority: CachePriority.HIGH,
          ttlMinutes: STUDY_CACHE_TTL_MINUTES,
          tags: ["study", `study_${summaryId}`],
        });
      }
      return mapped;
    } catch {
      const cached = await OfflineCache.get<QuizQuestionV2[]>(cacheKey);
      return cached ?? [];
    }
  }, [summaryId]);

  const saveProgress = useCallback(
    (update: {
      flashcardsCompleted?: number;
      flashcardsTotal?: number;
      quizScore?: number;
      quizTotal?: number;
    }) => {
      store.updateProgress(summaryId, update);
      store.incrementStreak();
    },
    [summaryId, store],
  );

  return {
    progress: store.progress[summaryId],
    stats: store.stats,
    generateFlashcards,
    generateQuiz,
    saveProgress,
  };
}
