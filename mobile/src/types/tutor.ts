// mobile/src/types/tutor.ts
//
// Le Tuteur V2 mobile lite — types portés depuis frontend/src/types/tutor.ts.
// Mobile V2 lite : mode TEXT only (pas de voice → pas d'audio_url côté request).
// TutorPhase simplifié : "idle" | "active" (pas de prompting/deep-session sur mobile lite).

export type TutorMode = "text" | "voice";
export type TutorLang = "fr" | "en";

/**
 * Mobile V2 lite : phase simplifiée.
 * - "idle"   : pas de session active
 * - "active" : session démarrée (équivalent de "mini-chat" web)
 */
export type TutorPhase = "idle" | "active";

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
  /** V2 lite mobile : toujours null côté text-only — l'API peut renvoyer un URL si voice. */
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
