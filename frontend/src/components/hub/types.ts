// frontend/src/components/hub/types.ts

/**
 * Schema unifié frontend pour le hub conversationnel.
 * Reflète backend ChatMessage (PR #203) — source distingue text/voice/voice_user/voice_agent.
 */
export interface HubMessage {
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
