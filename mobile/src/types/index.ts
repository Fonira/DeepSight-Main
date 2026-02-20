import { PlanType } from '../constants/config';

// Re-export analysis customization types
export {
  WritingStyle,
  AnalysisCustomization,
  AnalysisRequestV2,
  DEFAULT_CUSTOMIZATION,
  CUSTOMIZATION_STORAGE_KEY,
  WRITING_STYLE_CONFIG,
  VOCABULARY_CONFIG,
  LENGTH_CONFIG,
} from './analysis';
export type { VocabularyComplexity, TargetLength, FormalityLevel } from './analysis';

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
  analyses_this_month?: number;
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
  videoInfo?: VideoInfo;
  title: string;
  content?: string;
  mode: string;
  category: string;
  model?: string;
  language?: string;
  createdAt?: string;
  updatedAt?: string;
  isFavorite: boolean;
  wordCount?: number;
  thumbnail?: string;
  channel?: string;
  duration?: number;
}

export interface AnalysisRequest {
  url?: string;
  text?: string;
  mode: string;
  category: string;
  model: string;
  language: string;
  deep_research?: boolean;
}

export interface AnalysisStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: AnalysisSummary;
  error?: string;
  summary_id?: string;
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

// History Types
export interface HistoryItem {
  id: string;
  videoInfo: VideoInfo;
  summary: AnalysisSummary;
  createdAt: string;
}

export interface PlaylistHistoryItem {
  id: string;
  name: string;
  video_count: number;
  created_at: string;
  thumbnail_urls?: string[] | null;
}

// Playlist Detail Types
export interface PlaylistVideoItem {
  id: number;
  video_id: string;
  video_title: string;
  video_channel: string;
  video_duration?: number;
  video_url?: string;
  thumbnail_url?: string;
  category?: string;
  category_confidence?: number;
  summary_content?: string;
  transcript_context?: string;
  full_digest?: string;
  word_count?: number;
  reliability_score?: number;
  position?: number;
}

export interface PlaylistFullResponse {
  id: number;
  playlist_id: string;
  playlist_title: string;
  playlist_url?: string;
  num_videos: number;
  num_processed: number;
  total_duration?: number;
  total_words?: number;
  meta_analysis?: string;
  status: string;
  created_at: string;
  completed_at?: string;
  videos: PlaylistVideoItem[];
}

export interface PlaylistDetailsResponse {
  id: number;
  playlist_id: string;
  playlist_title: string;
  status: string;
  statistics: {
    num_videos: number;
    num_processed: number;
    total_duration: number;
    total_duration_formatted: string;
    total_words: number;
    average_duration: number;
    average_words: number;
  };
  categories: Record<string, number>;
  channels: Record<string, number>;
  has_meta_analysis: boolean;
  videos_summary: Array<{
    id: number;
    title: string;
    channel: string;
    duration: number;
    category: string;
    position: number;
  }>;
}

export interface CorpusChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources?: Array<{
    video_title: string;
    video_id: string;
    relevance_score: number;
  }>;
}

export interface CorpusChatResponse {
  response: string;
  sources?: Array<{
    video_title: string;
    video_id: string;
    relevance_score: number;
  }>;
  citations?: string[];
  model_used: string;
  tokens_used: number;
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
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email: string };

  // Main tabs
  Main: undefined;
  MainTabs: undefined;

  // Modal screens
  Analysis: { videoUrl?: string; summaryId?: string; videoId?: string };
  VideoPlayer: { videoId: string; startTime?: number };
  Chat: { summaryId: string };
  StudyTools: { summaryId: string };
  Settings: undefined;
  Account: undefined;
  Upgrade: undefined;
  Usage: undefined;

  // Payment screens
  PaymentSuccess: { planName?: string; sessionId?: string };
  PaymentCancel: undefined;

  // Legal screen
  Legal: { type?: 'privacy' | 'terms' | 'legal' | 'about' } | undefined;

  // Contact
  Contact: undefined;

  // Analytics
  Analytics: undefined;

  // Playlist detail
  PlaylistDetail: { playlistId: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Upgrade: undefined;
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

// Quiz Types (matches API response and QuizComponent)
export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
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
