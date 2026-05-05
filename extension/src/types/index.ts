import type { GlobalSearchResponse } from "./search";

// ── User & Auth ──

export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  plan: "free" | "starter" | "pro" | "expert" | "student" | "team";
  credits: number;
  credits_monthly: number;
  default_lang?: string;
  default_mode?: string;
}

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

// ── Analysis ──

export interface AnalyzeOptions {
  mode?: "accessible" | "standard" | "expert";
  lang?: "fr" | "en" | "es" | "de";
  category?: string;
  model?: string;
  force_refresh?: boolean;
}

export interface AnalyzeResponse {
  task_id: string;
}

export interface TaskStatus {
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  message: string;
  result?: {
    summary_id: number;
    video_title?: string;
  };
  error?: string;
}

export interface TournesolData {
  found: boolean;
  tournesol_score: number | null; // Score brut (-100 à +100)
  n_comparisons: number;
  n_contributors: number;
  criteria_scores?: { criteria: string; score: number }[];
}

export interface Summary {
  id: number;
  video_title: string;
  video_channel: string;
  video_url: string;
  thumbnail_url: string;
  category: string;
  reliability_score: number;
  summary_content: string;
  concepts?: Concept[];
  key_points?: string[];
  facts_to_verify?: string[];
  created_at: string;
  tournesol?: TournesolData;
  // 📊 Engagement metadata
  view_count?: number;
  like_count?: number;
  content_type?: "video" | "carousel" | "short" | "live";
}

export interface Concept {
  name: string;
  definition: string;
}

export interface RecentAnalysis {
  videoId: string;
  summaryId: number;
  title: string;
  timestamp: number;
  platform?: "youtube" | "tiktok";
}

// ── Chat ──

export interface ChatMessage {
  /** Identifiant stable côté backend (ChatHistoryItem.id) — optionnel pour
   *  rétrocompat avec les bulles fabriquées localement avant ack serveur. */
  id?: string;
  role: "user" | "assistant";
  content: string;
  /** ISO 8601 timestamp from backend ChatHistoryItem.timestamp. */
  timestamp?: string;
  web_search_used?: boolean;
  /** Source du message — "text" pour un chat clavier, "voice" pour un
   *  transcript ElevenLabs persisté côté backend. Défaut "text" si omis
   *  (rétrocompat avec les payloads ChatView v1 qui n'ont pas le champ). */
  source?: "text" | "voice";
  /** Speaker du message voice (uniquement quand source="voice"). */
  voice_speaker?: "user" | "agent" | null;
  /** Identifiant de la session voice ElevenLabs liée au transcript. */
  voice_session_id?: string | null;
  /** Décalage en secondes depuis le début de la session voice. */
  time_in_call_secs?: number | null;
}

export interface ChatOptions {
  mode?: string;
  use_web_search?: boolean;
}

export interface ChatResponse {
  response: string;
  web_search_used: boolean;
}

// ── Quick Chat ──

export interface QuickChatResponse {
  summary_id: number;
  video_title: string;
  word_count: number;
  message: string;
}

// ── Plan Info ──

export interface PlanFeatures {
  analysis: boolean;
  synthesis: boolean;
  chat: boolean;
  flashcards: boolean;
  mind_maps: boolean;
  web_search: boolean;
  playlists: boolean;
  exports: boolean;
}

export interface VoiceQuotaInfo {
  /** Free : essai gratuit lifetime déjà consommé ? */
  trial_used: boolean;
  /** Expert : minutes de voice call utilisées dans le mois courant. */
  monthly_minutes_used: number;
}

export interface PlanInfo {
  plan_name: string;
  plan_id: "free" | "starter" | "pro" | "expert" | "student" | "team";
  monthly_analyses: number;
  analyses_this_month: number;
  credits: number;
  credits_monthly: number;
  features: PlanFeatures;
  /** Quick Voice Call quota (I4) — exposé par /api/billing/my-plan. */
  voice_quota?: VoiceQuotaInfo;
}

// ── Settings ──

export interface ExtensionSettings {
  defaultMode: "accessible" | "standard" | "expert";
  defaultLang: "fr" | "en" | "es" | "de";
  showNotifications: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultMode: "standard",
  defaultLang: "fr",
  showNotifications: true,
};

// ── Message Passing ──

export type MessageAction =
  | "CHECK_AUTH"
  | "GET_USER"
  | "LOGIN"
  | "GOOGLE_LOGIN"
  | "LOGOUT"
  | "START_ANALYSIS"
  | "ANALYZE_VIDEO"
  | "GET_TASK_STATUS"
  | "GET_SUMMARY"
  | "ASK_QUESTION"
  | "GET_CHAT_HISTORY"
  | "CLEAR_CHAT_HISTORY"
  | "OPEN_POPUP"
  | "SYNC_AUTH_FROM_WEBSITE"
  | "ANALYSIS_PROGRESS"
  | "GET_PLAN"
  | "START_GUEST_ANALYSIS"
  | "SHARE_ANALYSIS"
  | "QUICK_CHAT"
  | "CANCEL_ANALYSIS"
  | "OPEN_VOICE_PANEL"
  | "VOICE_CREATE_SESSION"
  | "VOICE_APPEND_TRANSCRIPT"
  | "VOICE_GET_PREFERENCES"
  | "VOICE_UPDATE_PREFERENCES"
  | "VOICE_GET_CATALOG"
  | "GET_VOICE_BUTTON_STATE"
  | "GET_AUTH_TOKEN"
  // Recherche sémantique V1 (Phase 4 extension)
  | "SEARCH_GLOBAL"
  | "GET_RECENT_QUERIES";

export interface ExtensionMessage {
  action: MessageAction;
  data?: Record<string, unknown>;
}

export interface VoiceButtonState {
  plan: "free" | "pro" | "expert";
  trialUsed: boolean;
  monthlyMinutesUsed: number;
}

export interface MessageResponse {
  success?: boolean;
  authenticated?: boolean;
  user?: User;
  status?: TaskStatus;
  summary?: Summary;
  plan?: PlanInfo;
  result?: unknown;
  error?: string;
  share_url?: string;
  state?: VoiceButtonState;
  // Phase 4 — Semantic Search V1
  searchResults?: GlobalSearchResponse;
  recentQueries?: string[];
}

// ── Category Icons ──

export const CATEGORY_ICONS: Record<string, string> = {
  tech: "\u{1F4BB}",
  science: "\u{1F52C}",
  education: "\u{1F4DA}",
  news: "\u{1F4F0}",
  entertainment: "\u{1F3AC}",
  gaming: "\u{1F3AE}",
  music: "\u{1F3B5}",
  sports: "\u26BD",
  business: "\u{1F4BC}",
  lifestyle: "\u{1F31F}",
  other: "\u{1F4CB}",
};
