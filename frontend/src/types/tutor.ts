// frontend/src/types/tutor.ts

/**
 * Mode du Tuteur web. Voice supprimé en mai 2026 (popup text-only).
 * Le type est conservé pour compat backend (qui accepte encore "voice"
 * mais le code voice popup est retiré du frontend).
 */
export type TutorMode = "text";
export type TutorLang = "fr" | "en";
export type TutorPhase = "idle" | "prompting" | "mini-chat";

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
  timestamp_ms: number;
}

export interface SessionStartRequest {
  concept_term: string;
  concept_def: string;
  summary_id?: number;
  source_video_title?: string;
  mode: TutorMode;
  lang: TutorLang;
}

export interface SessionStartResponse {
  session_id: string;
  first_prompt: string;
  audio_url: string | null;
}

export interface SessionTurnRequest {
  user_input?: string;
  audio_blob_b64?: string;
}

export interface SessionTurnResponse {
  ai_response: string;
  audio_url: string | null;
  turn_count: number;
}

export interface SessionEndResponse {
  duration_sec: number;
  turns_count: number;
  source_summary_url: string | null;
  source_video_title: string | null;
}
