import { useCallback } from 'react';
import { useStudyStore } from '../stores/studyStore';
import { studyApi } from '../services/api';
import type { Flashcard, QuizQuestionV2 } from '../types/v2';

export function useStudy(summaryId: string) {
  const store = useStudyStore();

  const generateFlashcards = useCallback(async (): Promise<Flashcard[]> => {
    try {
      const response = await studyApi.generateFlashcards(summaryId);
      const raw = response as any;
      const cards = raw.flashcards || [];
      return cards
        .filter((f: any) => f && (f.front || f.question))
        .map((f: any, i: number) => ({
          id: `fc-${i}`,
          front: f.front || f.question || '',
          back: f.back || f.answer || f.definition || '',
          difficulty: f.difficulty || ('medium' as const),
          repetitions: 0,
        }));
    } catch {
      return [];
    }
  }, [summaryId]);

  const generateQuiz = useCallback(async (): Promise<QuizQuestionV2[]> => {
    try {
      const response = await studyApi.generateQuiz(summaryId);
      const raw = response as any;
      // Backend renvoie { quiz: [...] } (QuizResponse model)
      const questions = raw.quiz || raw.questions || [];
      return questions.map((q: any, i: number) => ({
        id: `q-${i}`,
        question: q.question || '',
        options: q.options || q.choices || [],
        correctIndex: q.correct_index ?? q.correctIndex ?? q.correct ?? 0,
        explanation: q.explanation || '',
      }));
    } catch {
      return [];
    }
  }, [summaryId]);

  const saveProgress = useCallback(
    (update: { flashcardsCompleted?: number; flashcardsTotal?: number; quizScore?: number; quizTotal?: number }) => {
      store.updateProgress(summaryId, update);
      store.incrementStreak();
    },
    [summaryId, store]
  );

  return {
    progress: store.progress[summaryId],
    stats: store.stats,
    generateFlashcards,
    generateQuiz,
    saveProgress,
  };
}
