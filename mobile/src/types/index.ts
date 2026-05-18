import { PlanType } from "../constants/config";

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
} from "./analysis";
export type {
  VocabularyComplexity,
  TargetLength,
  FormalityLevel,
} from "./analysis";

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

// Visual Analysis Types (Phase 2 — Mistral Vision)
// Structure renvoyée par le backend après enrichissement frames + Vision.
// Le mobile expose ces données via le tab "Visuel" du détail d'analyse.
export interface VisualKeyMoment {
  timestamp_s: number;
  description: string;
  type: string; // hook | transition | reveal | cta | peak | demo | other
}

export interface VisualSeoIndicators {
  hook_brightness?: "low" | "medium" | "high";
  face_visible_in_hook?: boolean;
  burned_in_subtitles?: boolean;
  high_motion_intro?: boolean;
  thumbnail_quality_proxy?: "low" | "medium" | "high";
}

export interface VisualAnalysis {
  visual_hook: string;
  visual_structure: string; // talking_head | b_roll | gameplay | slides | tutorial | interview | vlog | mixed | other
  key_moments: VisualKeyMoment[];
  visible_text: string;
  visual_seo_indicators: VisualSeoIndicators;
  summary_visual: string;
  model_used: string;
  frames_analyzed: number;
  frames_downsampled: boolean;
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

export type VideoPlatform = "youtube" | "tiktok" | "text";

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
  platform?: VideoPlatform;
  video_url?: string;
  // 🔬 Deep Research (Mar 2026)
  deep_research?: boolean;
  enrichment_sources?: string; // JSON string: [{title, url, snippet}]
  enrichment_data?: string; // JSON string

  // 📊 Engagement metadata
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  channel_follower_count?: number;
  engagement_rate?: number;
  content_type?: "video" | "carousel" | "short" | "live";
  music_title?: string;
  music_author?: string;
  source_tags?: string[];
  carousel_images?: string[];

  // 👁️ Visual Analysis (Phase 2)
  // Présent uniquement quand l'analyse a été lancée avec include_visual_analysis=true
  // ET que la couche Mistral Vision a réussi (frames extraits + parse JSON).
  // null/undefined = pas de couche visuelle disponible (fallback empty state).
  visual_analysis?: VisualAnalysis | null;

  // 💬 Community analysis (Mai 2026 — alembic 029, sprint Comments PR3 mobile)
  // Verdict communauté issu du scrape commentaires + Mistral. NULL = pas
  // analysé (free plan, scrape failed, timeout, vidéo sans commentaires).
  community_analysis?: CommunityTake | null;

  // 🔗 External pages (2026-05-17 — alembic 031, PR3 backend / PR4 UI mobile).
  // Pages externes citées dans la description vidéo, scrapées + résumées par
  // Mistral. NULL = pas analysé (free plan, description vide, aucune URL
  // exploitable, toutes les pages ont échoué, etc.).
  external_pages?: ExternalPagesData | null;
}

// ─── Community Take (verdict communauté) ──────────────────────────────────────
// Mirror frontend `services/api.ts::CommunityTake` et backend
// `comments/schemas.py::CommunityTake`. Persisté JSONB dans
// `Summary.community_analysis` depuis alembic 029.

export type CommunityAgreementSignal =
  | "agree"
  | "disagree"
  | "mixed"
  | "unclear";

export type CommunityVoiceStance =
  | "agree"
  | "disagree"
  | "neutral"
  | "question";

export interface CommunityTopVoice {
  author: string;
  excerpt: string;
  stance: CommunityVoiceStance;
  like_count: number;
}

export interface CommunitySentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

export interface CommunityTake {
  agreement_signal: CommunityAgreementSignal;
  sentiment_distribution: CommunitySentimentDistribution;
  controversies: string[];
  community_summary: string;
  top_voices: CommunityTopVoice[];
  comments_analyzed: number;
  model_used: string;
  generated_at?: string;
  is_truncated?: boolean;
  disabled?: boolean;
  insufficient_data?: boolean;
}

// ─── External Pages (PR3 backend / PR4 UI mobile) ─────────────────────────────
// Mirror frontend `services/api.ts::ExternalPagesData` et backend
// `videos/external_pages/orchestrator.py`. Persisté JSONB dans
// `Summary.external_pages` depuis alembic 031.

export type ExternalPageStatus =
  | "ok"
  | "error"
  | "paywall"
  | "non_html"
  | "http_error"
  | "timeout"
  | "empty";

export interface ExternalPageCitation {
  url: string;
  final_url: string;
  title: string;
  summary: string;
  key_claims: string[];
  status: ExternalPageStatus;
  fetched_via_proxy: boolean;
  bytes_fetched: number;
}

export interface ExternalPagesStats {
  candidates_found: number;
  after_dedup: number;
  after_blacklist: number;
  after_cap: number;
  successful: number;
  paywalled: number;
  errored: number;
}

export interface ExternalPagesData {
  extracted_at: string;
  schema_version: number;
  stats: ExternalPagesStats;
  pages: ExternalPageCitation[];
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
  // Backend returns snake_case (task_id), but we also accept camelCase
  task_id?: string;
  taskId?: string;
  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "done"
    | "error"
    | "cancelled";
  progress: number;
  message?: string;
  result?: Record<string, unknown>;
  error?: string;
  summary_id?: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  web_search_used?: boolean;
  // Voice timeline fields (Spec #1 — chat+voice unified backend persistence)
  // Backend renvoie ces champs via `GET /api/chat/history/{summary_id}`.
  source?: "text" | "voice";
  voice_speaker?: "user" | "agent" | null;
  voice_session_id?: string | null;
  time_in_call_secs?: number | null;
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
  role: "user" | "assistant";
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
  status: "active" | "canceled" | "past_due" | "trialing";
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
  Analysis: {
    videoUrl?: string;
    summaryId?: string;
    videoId?: string;
    initialTab?: "summary" | "chat" | "concepts" | "tools" | "study";
  };
  VideoPlayer: { videoId: string; startTime?: number };
  Chat: { summaryId: string };
  StudyTools: { summaryId: string };
  Settings: undefined;
  Account: undefined;
  Upgrade: undefined;
  UpgradeModal: undefined;
  Usage: undefined;

  // Payment screens
  PaymentSuccess: { planName?: string; sessionId?: string };
  PaymentCancel: undefined;

  // Legal screen
  Legal: { type?: "privacy" | "terms" | "legal" | "about" } | undefined;

  // Contact
  Contact: undefined;

  // Analytics
  Analytics: undefined;

  // Playlist detail
  PlaylistDetail: { playlistId: string };

  // About
  About: undefined;
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
  type: "main" | "secondary" | "tertiary";
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
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

// Theme Types
export type ThemeMode = "light" | "dark" | "system";

// Language Types
export type LanguageCode = "fr" | "en";
