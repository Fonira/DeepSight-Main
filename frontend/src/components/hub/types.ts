// frontend/src/components/hub/types.ts
//
// SSOT du hub conversationnel unifié (chat + voice). Volontairement
// parallèle à ChatPage.ChatMessage et analysisStore.ChatMessage : les
// pages legacy `/chat` et `/voice-call` seront supprimées J+30 (cf. plan
// docs/superpowers/plans/2026-04-30-unified-hub-chat-voice.md). Pendant
// cette fenêtre de cohabitation, NE PAS importer ces types depuis les
// pages legacy — ils restent confinés à `components/hub/*` et `pages/HubPage`.

/**
 * Mapping aplati frontend du couple backend (`source`, `voice_speaker`).
 * Backend Pydantic (PR #203) modélise voice avec deux champs séparés :
 *   { source: "text" | "voice", voice_speaker: "user" | "agent" | null }
 * Frontend aplatit en un seul champ pour faciliter switch/JSX :
 *   "voice_user"  ↔ backend { source: "voice", voice_speaker: "user" }
 *   "voice_agent" ↔ backend { source: "voice", voice_speaker: "agent" }
 *   "text"        ↔ backend { source: "text",  voice_speaker: null }
 * Le mapping est appliqué au fetch dans HubPage (cf. Task 13).
 */
export interface HubMessage {
  /** crypto.randomUUID() côté client pour éviter les collisions de clés React. */
  id: string;
  role: "user" | "assistant";
  content: string;
  source: "text" | "voice_user" | "voice_agent";
  sources?: { title: string; url: string }[];
  web_search_used?: boolean;
  voice_session_id?: string | null;
  time_in_call_secs?: number;
  /** Pour les bulles voice — durée de l'audio en secondes (pour waveform). */
  audio_duration_secs?: number;
  /** Date.now() au moment de l'append. */
  timestamp: number;
}

export interface HubConversation {
  id: number;
  /** null si free-form (pas de vidéo attachée). */
  summary_id: number | null;
  /** Titre court (= titre vidéo ou première question). */
  title: string;
  /** Source vidéo si rattachée. */
  video_source?: "youtube" | "tiktok";
  video_thumbnail_url?: string | null;
  /** Snippet de la dernière question/réponse pour la liste drawer. */
  last_snippet?: string;
  /** ISO date du dernier message. */
  updated_at: string;
}

export interface HubSummaryContext {
  summary_id: number;
  video_title: string;
  video_channel: string;
  video_duration_secs: number;
  video_source: "youtube" | "tiktok";
  video_thumbnail_url: string | null;
  /** Texte court (≤200 char) affiché dans la card collapsible. */
  short_summary: string;
  /** Citations [timestamp_secs, label] cliquables qui jump au PiP. */
  citations: { ts: number; label: string }[];
}

export type HubVoiceState =
  | "idle"
  | "ptt_recording"
  | "call_connecting"
  | "call_active"
  | "call_ending";

/**
 * Identifiant des onglets globaux du Hub. Inclut les 5 onglets d'analyse
 * (synthesis, quiz, flashcards, reliability, geo) ET l'onglet "chat" qui
 * remplace l'ancienne archi single-scroll par une nav sticky globale.
 *
 * Source de vérité : doit rester en sync avec AnalysisHub.TabType + l'ajout
 * "chat". URL deep-link via `?tab=<TabId>`.
 */
export type TabId =
  | "synthesis"
  | "quiz"
  | "flashcards"
  | "reliability"
  | "geo"
  | "chat";
