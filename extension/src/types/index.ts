// ── User & Auth ──

export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  plan: 'free' | 'student' | 'starter' | 'pro';
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
  mode?: 'accessible' | 'standard' | 'expert';
  lang?: 'fr' | 'en' | 'es' | 'de';
  category?: string;
  model?: string;
  force_refresh?: boolean;
}

export interface AnalyzeResponse {
  task_id: string;
}

export interface TaskStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result?: {
    summary_id: number;
    video_title?: string;
  };
  error?: string;
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
}

// ── Chat ──

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  web_search_used?: boolean;
}

export interface ChatOptions {
  mode?: string;
  use_web_search?: boolean;
}

export interface ChatResponse {
  response: string;
  web_search_used: boolean;
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

export interface PlanInfo {
  plan_name: string;
  plan_id: 'free' | 'student' | 'starter' | 'pro';
  monthly_analyses: number;
  analyses_this_month: number;
  credits: number;
  credits_monthly: number;
  features: PlanFeatures;
}

// ── Settings ──

export interface ExtensionSettings {
  defaultMode: 'accessible' | 'standard' | 'expert';
  defaultLang: 'fr' | 'en' | 'es' | 'de';
  showNotifications: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultMode: 'standard',
  defaultLang: 'fr',
  showNotifications: true,
};

// ── Message Passing ──

export type MessageAction =
  | 'CHECK_AUTH'
  | 'GET_USER'
  | 'LOGIN'
  | 'GOOGLE_LOGIN'
  | 'LOGOUT'
  | 'START_ANALYSIS'
  | 'ANALYZE_VIDEO'
  | 'GET_TASK_STATUS'
  | 'GET_SUMMARY'
  | 'ASK_QUESTION'
  | 'GET_CHAT_HISTORY'
  | 'OPEN_POPUP'
  | 'SYNC_AUTH_FROM_WEBSITE'
  | 'ANALYSIS_PROGRESS'
  | 'GET_PLAN'
  | 'START_GUEST_ANALYSIS'
  | 'SHARE_ANALYSIS';

export interface ExtensionMessage {
  action: MessageAction;
  data?: Record<string, unknown>;
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
}

// ── Category Icons ──

export const CATEGORY_ICONS: Record<string, string> = {
  tech: '\u{1F4BB}',
  science: '\u{1F52C}',
  education: '\u{1F4DA}',
  news: '\u{1F4F0}',
  entertainment: '\u{1F3AC}',
  gaming: '\u{1F3AE}',
  music: '\u{1F3B5}',
  sports: '\u26BD',
  business: '\u{1F4BC}',
  lifestyle: '\u{1F31F}',
  other: '\u{1F4CB}',
};
