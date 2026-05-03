// mobile/src/components/hub/types.ts
//
// Mobile mirror of frontend/src/components/hub/types.ts.
// Doit rester aligne avec le backend (PR #203 - HubMessage Pydantic).
// Le mapping voice (voice_user / voice_agent / text) est applique au fetch dans HubScreen.
//
// Note (Hub Tab Unified, mai 2026) : les types HubMessage et HubVoiceState
// ont ete retires car les composants mock qui les utilisaient (Timeline,
// MessageBubble, VoiceBubble, CallModeFullBleed) ont ete supprimes.
// Conservent : HubConversation (ConversationsDrawer + hub.tsx),
// HubSummaryContext (SummaryCollapsible).

export interface HubConversation {
  id: number;
  /** null si free-form (pas de video attachee). */
  summary_id: number | null;
  /** Titre court (= titre video ou premiere question). */
  title: string;
  /** Source video si rattachee. */
  video_source?: "youtube" | "tiktok";
  video_thumbnail_url?: string | null;
  /** Snippet de la derniere question/reponse pour la liste drawer. */
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
  /** Texte court (<= 200 char) affiche dans la card collapsible. */
  short_summary: string;
  /** Citations [timestamp_secs, label] cliquables qui jump au PiP. */
  citations: { ts: number; label: string }[];
}
