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
