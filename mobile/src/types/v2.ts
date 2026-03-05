/**
 * DeepSight Mobile V2 - Simplified Types
 */
import { PlanType } from '../constants/config';

// ─── Analysis Options (simplified for mobile) ───
export interface AnalysisOptionsV2 {
  mode: 'accessible' | 'standard' | 'expert';
  language: string;
}

export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptionsV2 = {
  mode: 'standard',
  language: 'fr',
};

// ─── Study Tools ───
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  lastReviewed?: string;
  nextReview?: string;
  repetitions: number;
}

export interface QuizQuestionV2 {
  id: string;
  question: string;
  options: string[];
  /**
   * Legacy single-answer index (kept for backward compatibility).
   * Always equals correctIndices[0] when correctIndices is provided.
   */
  correctIndex: number;
  /**
   * Multi-answer support: list of all correct option indices.
   * - length === 1  → single-answer question (radio-like)
   * - length >= 2   → multi-answer question (checkbox, traps possible)
   * Falls back to [correctIndex] when absent.
   */
  correctIndices?: number[];
  explanation: string;
}

export interface StudyProgress {
  videoId: string;
  flashcardsCompleted: number;
  flashcardsTotal: number;
  quizScore: number;
  quizTotal: number;
  lastStudied: string;
}

export interface StudyStats {
  totalStudied: number;
  averageScore: number;
  streak: number;
  lastStudyDate: string | null;
}

// ─── Plan Info ───
export interface PlanInfo {
  type: PlanType;
  name: string;
  creditsUsed: number;
  creditsTotal: number;
  analysesUsed: number;
  analysesTotal: number;
  resetDate: string;
}

// ─── Tab Routes ───
export type TabRoute = 'index' | 'library' | 'study' | 'profile';
