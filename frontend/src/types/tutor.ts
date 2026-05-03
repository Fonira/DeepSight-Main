/**
 * 🎓 Le Tuteur — Types TypeScript pour les sessions du compagnon conversationnel
 *
 * Mirrors les schémas Pydantic backend (`backend/src/tutor/schemas.py`).
 * Source de vérité : `docs/superpowers/specs/2026-05-03-le-tuteur-companion-design.md`
 *
 * V1.0 (web only) :
 *   - mode "text" : dialogue texte uniquement (Magistral)
 *   - mode "voice" : dialogue voix (Voxtral STT + Magistral + ElevenLabs TTS)
 *   - audio_url et audio_blob_b64 sont optionnels/nullables car STT/TTS sont V1.1
 *     (divergence assumée du plan : V1.0 livre la stack texte, V1.1 ajoute la voix)
 */

// ─── Types primitifs ────────────────────────────────────────────────────────────

export type TutorSessionMode = "text" | "voice";
export type TutorLang = "fr" | "en";

/**
 * État de la state machine UI du composant `Tutor.tsx`.
 *
 * Transitions (toutes manuelles) :
 *   idle ──click widget──▶ prompting ──click mode──▶ mini-chat | deep-session
 *   mini-chat ──click "Approfondir"──▶ deep-session
 *   * ──close/end──▶ idle
 */
export type TutorState =
  | "idle"
  | "prompting"
  | "mini-chat"
  | "deep-session";

/**
 * Un message dans l'historique de session (côté client).
 * `timestamp_ms` : Date.now() au moment de l'arrivée du message.
 */
export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
  timestamp_ms: number;
}

// ─── Endpoint : POST /api/tutor/session/start ───────────────────────────────────

export interface TutorSessionStartRequest {
  concept_term: string;
  concept_def: string;
  summary_id?: number;
  source_video_title?: string;
  mode: TutorSessionMode;
  lang: TutorLang;
}

export interface TutorSessionStartResponse {
  session_id: string;
  first_prompt: string;
  /** URL audio TTS (V1.1 voice mode). null en V1.0 ou en text mode. */
  audio_url: string | null;
}

// ─── Endpoint : POST /api/tutor/session/{id}/turn ───────────────────────────────

export interface TutorSessionTurnRequest {
  /** Message texte de l'utilisateur (text mode ou fallback voice). */
  user_input?: string;
  /** Audio user encodé base64 (V1.1 voice mode, Voxtral STT). */
  audio_blob_b64?: string;
}

export interface TutorSessionTurnResponse {
  ai_response: string;
  /** URL audio TTS (V1.1 voice mode). null en V1.0 ou en text mode. */
  audio_url: string | null;
  turn_count: number;
}

// ─── Endpoint : POST /api/tutor/session/{id}/end ────────────────────────────────

export interface TutorSessionEndResponse {
  duration_sec: number;
  turns_count: number;
  /** Lien vers l'analyse vidéo source (si la session a démarré depuis un summary). */
  source_summary_url: string | null;
  source_video_title: string | null;
}
