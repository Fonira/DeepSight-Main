// ── Voice messages — types partagés content/background/sidepanel ──
//
// Source unique des actions voice envoyées via chrome.runtime.sendMessage.
// Évite les drifts de string literals entre les 3 contextes
// (content/widget.ts, background.ts, sidepanel/*).

export const VOICE_MESSAGES = {
  /** Content widget → background : ouvre le side panel + persiste le contexte. */
  OPEN_VOICE_PANEL: "OPEN_VOICE_PANEL",
  /** Side panel → background : crée la session ElevenLabs côté API. */
  VOICE_CREATE_SESSION: "VOICE_CREATE_SESSION",
  /** Side panel → background : pousse un transcript user/agent au backend. */
  VOICE_APPEND_TRANSCRIPT: "VOICE_APPEND_TRANSCRIPT",
  /** Side panel → background : récupère les préférences voice de l'utilisateur. */
  VOICE_GET_PREFERENCES: "VOICE_GET_PREFERENCES",
  /** Side panel → background : update partiel des préférences voice. */
  VOICE_UPDATE_PREFERENCES: "VOICE_UPDATE_PREFERENCES",
  /** Side panel → background : récupère le catalogue ElevenLabs (voix + presets + modèles). */
  VOICE_GET_CATALOG: "VOICE_GET_CATALOG",
} as const;

export type VoiceMessageAction =
  (typeof VOICE_MESSAGES)[keyof typeof VOICE_MESSAGES];

/** Payload du message OPEN_VOICE_PANEL envoyé par le widget shadow DOM. */
export interface OpenVoicePanelPayload {
  summaryId: number | null;
  videoId: string | null;
  videoTitle: string | null;
  platform: "youtube" | "tiktok" | null;
}

/** Payload du message VOICE_CREATE_SESSION envoyé par le side panel. */
export interface VoiceCreateSessionPayload {
  summary_id?: number | null;
  agent_type: "explorer" | "companion";
  language?: "fr" | "en";
  video_id?: string | null;
  video_title?: string | null;
}

/** Payload du message VOICE_APPEND_TRANSCRIPT envoyé par le side panel. */
export interface VoiceAppendTranscriptPayload {
  voice_session_id: string;
  speaker: "user" | "agent";
  content: string;
  time_in_call_secs: number;
}

/**
 * Modèle complet des préférences voice — miroir de l'objet backend
 * `User.voice_preferences` (cf. `frontend/src/services/api.ts:VoicePreferences`).
 *
 * On le garde aligné explicitement plutôt que d'importer depuis frontend/
 * (build extension isolé du frontend).
 */
export interface VoicePreferencesShape {
  voice_id: string | null;
  voice_name: string | null;
  speed: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  tts_model: string;
  voice_chat_model: string;
  language: string;
  gender: string;
  input_mode: "ptt" | "vad";
  ptt_key: string;
  interruptions_enabled: boolean;
  turn_eagerness: number;
  voice_chat_speed_preset: string;
  turn_timeout: number;
  soft_timeout_seconds: number;
}

export interface VoiceCatalogVoice {
  voice_id: string;
  name: string;
  description_fr: string;
  description_en: string;
  gender: string;
  accent: string;
  language: string;
  use_case: string;
  recommended: boolean;
  preview_url: string;
}

export interface VoiceCatalogSpeedPreset {
  id: string;
  label_fr: string;
  label_en: string;
  value: number;
  icon: string;
}

export interface VoiceCatalogChatSpeedPreset {
  id: string;
  label_fr: string;
  label_en: string;
  api_speed: number;
  playback_rate: number;
  concise: boolean;
}

export interface VoiceCatalogModel {
  id: string;
  name: string;
  description_fr: string;
  description_en: string;
  latency: string;
  recommended_for: string;
}

export interface VoiceCatalogShape {
  voices: VoiceCatalogVoice[];
  speed_presets: VoiceCatalogSpeedPreset[];
  voice_chat_speed_presets: VoiceCatalogChatSpeedPreset[];
  models: VoiceCatalogModel[];
}
