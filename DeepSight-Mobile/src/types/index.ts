import { PlanType } from '../constants/config';

// User Types
export interface User {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  plan: PlanType;
  credits: number;
  credits_monthly: number;
  is_admin: boolean;
  avatar_url?: string;
  default_lang?: string;
  default_mode?: string;
  default_model?: string;
  total_videos: number;
  total_words: number;
  total_playlists: number;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Video Analysis Types
export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channel: string;
  channelId: string;
  duration: number;
  publishedAt: string;
  viewCount: number;
  likeCount?: number;
}

export interface AnalysisSummary {
  id: string;
  videoId: string;
  videoInfo: VideoInfo;
  title: string;
  content: string;
  mode: string;
  category: string;
  model: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  wordCount: number;
}

export interface AnalysisRequest {
  url?: string;
  text?: string;
  mode: string;
  category: string;
  model: string;
  language: string;
}

export interface AnalysisStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: AnalysisSummary;
  error?: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatHistory {
  summaryId: string;
  messages: ChatMessage[];
}

// Playlist Types
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  videoCount: number;
  thumbnails: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistAnalysis {
  playlistId: string;
  name: string;
  videos: AnalysisSummary[];
  corpusSummary?: string;
  createdAt: string;
}

// History Types
export interface HistoryItem {
  id: string;
  videoInfo: VideoInfo;
  summary: AnalysisSummary;
  createdAt: string;
}

export interface HistoryFilters {
  search?: string;
  mode?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  favoritesOnly?: boolean;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Quota Types
export interface QuotaInfo {
  used: number;
  total: number;
  resetDate: string;
  plan: PlanType;
}

// Billing Types
export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  credits: number;
  features: string[];
  isPopular?: boolean;
}

export interface Subscription {
  id: string;
  plan: PlanType;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

// Navigation Types
export type RootStackParamList = {
  // Auth screens
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email: string };

  // Main tabs
  MainTabs: undefined;

  // Modal screens
  Analysis: { videoUrl?: string; summaryId?: string };
  VideoPlayer: { videoId: string; startTime?: number };
  Chat: { summaryId: string };
  StudyTools: { summaryId: string };
  Settings: undefined;
  Account: undefined;
  Upgrade: undefined;
  Usage: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Playlists: undefined;
  Profile: undefined;
};

// Concept Types
export interface Concept {
  id: string;
  name: string;
  definition: string;
  relatedConcepts?: string[];
}

export interface ConceptMap {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

export interface ConceptNode {
  id: string;
  label: string;
  type: 'main' | 'secondary' | 'tertiary';
}

export interface ConceptEdge {
  source: string;
  target: string;
  label?: string;
}

// Quiz Types
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface QuizResult {
  score: number;
  total: number;
  answers: {
    questionId: string;
    selectedAnswer: number;
    isCorrect: boolean;
  }[];
}

// Export/Citation Types
export interface ExportOptions {
  format: 'pdf' | 'markdown' | 'text';
  includeCitations: boolean;
  includeTimecodes: boolean;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// Theme Types
export type ThemeMode = 'light' | 'dark' | 'system';

// Language Types
export type LanguageCode = 'fr' | 'en';
