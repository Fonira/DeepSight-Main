// Types pour les endpoints de recherche sémantique V1 (Phase 1 backend PR #292).
//
// Mirror du schema Pydantic backend (`backend/src/search/router.py`). Si le
// backend évolue, mettre à jour ces types ici puis re-run le typecheck.

export type SearchSourceType =
  | "summary"
  | "flashcard"
  | "quiz"
  | "chat"
  | "transcript";

export interface SearchSourceMetadata {
  summary_title?: string;
  summary_thumbnail?: string;
  video_id?: string;
  channel?: string;
  tab?: "synthesis" | "digest" | "flashcards" | "quiz" | "chat" | "transcript";
  start_ts?: number;
  end_ts?: number;
  anchor?: string;
  flashcard_id?: number;
  quiz_question_id?: number;
}

export interface SearchResult {
  source_type: SearchSourceType;
  source_id: number;
  summary_id: number | null;
  score: number;
  text_preview: string;
  source_metadata: SearchSourceMetadata;
}

export interface GlobalSearchResponse {
  query: string;
  total_results: number;
  results: SearchResult[];
  searched_at: string;
}

export interface RecentQueriesResponse {
  queries: string[];
}

export interface GlobalSearchOptions {
  query: string;
  limit?: number;
  source_types?: SearchSourceType[];
}
