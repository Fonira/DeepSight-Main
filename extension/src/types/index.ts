// ── User & Auth ──

export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  plan: 'free' | 'student' | 'starter' | 'pro' | 'team';
  credits: number;
  credits_monthly: number;
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
  created_at: string;
}

export interface RecentAnalysis {
  videoId: string;
  summaryId: number;
  title: string;
  timestamp: number;
}

// ── Chat ──

export interface ChatOptions {
  mode?: string;
  use_web_search?: boolean;
}

export interface ChatResponse {
  response: string;
  web_search_used: boolean;
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
  | 'ANALYZE_VIDEO'
  | 'GET_TASK_STATUS'
  | 'GET_SUMMARY'
  | 'ASK_QUESTION'
  | 'OPEN_POPUP'
  | 'SYNC_AUTH_FROM_WEBSITE'
  | 'ANALYSIS_PROGRESS';

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
  result?: unknown;
  error?: string;
}

// ── Category Icons ──

export const CATEGORY_ICONS: Record<string, string> = {
  tech: '💻',
  science: '🔬',
  education: '📚',
  news: '📰',
  entertainment: '🎬',
  gaming: '🎮',
  music: '🎵',
  sports: '⚽',
  business: '💼',
  lifestyle: '🌟',
  other: '📋',
};
