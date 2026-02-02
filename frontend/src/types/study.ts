/**
 * 📚 Study Types — Flashcards & Quiz
 * Types pour les outils d'étude interactifs
 */

export interface FlashcardItem {
  id?: string;
  front: string;
  back: string;
  category?: string;
}

export interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

export interface QuizResponse {
  success: boolean;
  summary_id: number;
  quiz: QuizQuestion[];
  title: string;
  difficulty: string;
}

export interface FlashcardsResponse {
  success: boolean;
  summary_id: number;
  flashcards: FlashcardItem[];
  title: string;
}

export interface MindmapResponse {
  success: boolean;
  summary_id: number;
  mermaid_code: string;
  concepts: Array<{ name: string; children?: string[] }>;
  title: string;
}

export interface StudyMaterials {
  quiz?: QuizQuestion[];
  flashcards?: FlashcardItem[];
  mindmap?: {
    mermaid_code: string;
    concepts: Array<{ name: string; children?: string[] }>;
  };
}

export interface StudyAllResponse {
  success: boolean;
  summary_id: number;
  materials: StudyMaterials;
}

// Quiz session state
export interface QuizSessionState {
  currentIndex: number;
  answers: (number | null)[];
  score: number;
  completed: boolean;
  startTime: Date;
  endTime?: Date;
}

// Flashcard session state
export interface FlashcardSessionState {
  currentIndex: number;
  flipped: boolean;
  known: number[];
  unknown: number[];
  completed: boolean;
}

export type StudyMode = 'flashcards' | 'quiz';
