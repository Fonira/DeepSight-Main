/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🌐 DEEP SIGHT API SERVICE v7.1 — Client HTTP Complet                              ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  EXPORTS: authApi, videoApi, chatApi, reliabilityApi, billingApi, playlistApi      ║
 * ║  + Tous les types nécessaires                                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { translateApiError } from "../utils/errorMessages";

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const API_URL =
  import.meta.env.VITE_API_URL || "https://api.deepsightsynthesis.com";

const TOKEN_KEYS = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface User {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  plan:
    | "free"
    | "plus"
    | "pro"
    | "etudiant"
    | "starter"
    | "student"
    | "team"
    | "expert"
    | "unlimited"; // Aliases pour rétrocompat
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
  // 🆕 Champs optionnels pour limites d'analyses
  analysis_count?: number;
  analysis_limit?: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user?: User;
}

// ? Quick Chat � Response type
// ?? Upgrade Quick Chat ? Full Analysis
export interface UpgradeQuickChatResponse {
  task_id: string;
  status: string;
  message: string;
}
export interface QuickChatResponse {
  summary_id: number;
  video_id: string;
  video_title: string;
  video_channel: string;
  video_duration: number;
  thumbnail_url: string;
  platform: string;
  transcript_available: boolean;
  word_count: number;
  message: string;
}
export interface Summary {
  id: number;
  video_id: string;

  // Video info - ALIGNED WITH BACKEND SummaryResponse
  video_title: string;
  video_channel: string;
  video_duration?: number;
  video_url?: string;
  thumbnail_url?: string;

  // Analysis metadata
  category?: string;
  category_confidence?: number;
  lang?: string;
  mode?: string;
  model_used?: string;

  // Content
  summary_content: string;
  word_count?: number;
  reliability_score?: number;

  // Tags and entities
  tags?: string; // Comma-separated string from backend
  entities?: Record<string, string[]>;
  fact_check?: string;

  // User data
  is_favorite?: boolean;
  notes?: string;

  // Timestamps
  created_at: string;
  updated_at?: string;

  // 🎵 Platform (YouTube, TikTok or Text)
  platform?: "youtube" | "tiktok" | "text";

  // Optional/legacy fields for compatibility
  channel_id?: string;
  transcript?: string;
  transcript_segments?: TranscriptSegment[];
  web_enriched?: boolean;
  fact_check_results?: FactCheckResult[];
  detected_category?: string;
  content_type?: string;
  view_count?: number;
  like_count?: number;
  publish_date?: string;
  concepts?: Concept[];

  // 🔬 Deep Research (Mar 2026)
  deep_research?: boolean;
  enrichment_sources?: string; // JSON string: [{title, url, snippet}]
  enrichment_data?: string; // JSON string: {level, sources, enriched_at}
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Concept {
  term: string;
  definition: string;
  category?: string;
  importance?: number;
  wiki_url?: string | null;
  source?: string;
}

// 📚 Concept enrichi avec définitions IA
export interface EnrichedConcept {
  term: string;
  definition: string;
  category: string;
  category_label: string;
  category_icon: string;
  context_relevance: string;
  sources: string[];
  confidence: number;
  provider: "mistral" | "perplexity" | "combined" | "none";
}

export interface EnrichedConceptsResponse {
  summary_id: number;
  video_title: string;
  concepts: EnrichedConcept[];
  count: number;
  provider: string;
  categories: Record<
    string,
    {
      label: string;
      icon: string;
      count: number;
    }
  >;
}

export interface TaskStatus {
  task_id: string;
  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "redirect"
    | "screenshot_detected"
    | "cancelled";
  progress?: number;
  message?: string;
  platform?: "youtube" | "tiktok" | "text";
  result?: {
    summary_id?: number;
    summary?: Summary;
    // Screenshot redirect fields
    redirected_to_video?: boolean;
    new_task_id?: string;
    video_url?: string;
    platform?: string;
    content_type?: "video" | "short" | "tiktok_slideshow" | string;
    search_query?: string;
  };
  error?: string;
}

// 🎵 Platform detection helper
export type VideoPlatform = "youtube" | "tiktok" | "text";

const TIKTOK_URL_PATTERNS = [
  /tiktok\.com\/@[\w.-]+\/video\/\d+/i,
  /vm\.tiktok\.com\/[\w-]+/i,
  /m\.tiktok\.com\/v\/\d+/i,
  /tiktok\.com\/t\/[\w-]+/i,
  /tiktok\.com\/video\/\d+/i,
];

export function getPlatformFromUrl(url: string): VideoPlatform {
  if (!url) return "youtube";
  if (url.startsWith("text://") || url.startsWith("txt_")) return "text";
  return TIKTOK_URL_PATTERNS.some((p) => p.test(url.trim()))
    ? "tiktok"
    : "youtube";
}

export function getPlatformLabel(platform?: VideoPlatform): string {
  if (platform === "tiktok") return "TikTok";
  if (platform === "text") return "Texte";
  return "YouTube";
}

export function getVideoUrl(videoId: string, platform?: VideoPlatform): string {
  if (platform === "tiktok") {
    return `https://www.tiktok.com/video/${videoId}`;
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export interface PlaylistTaskStatus {
  task_id: string;
  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "redirect"
    | "screenshot_detected";

  // Progression (les deux noms pour compatibilité backend)
  progress?: number;
  progress_percent?: number; // 🆕 Alias envoyé par backend corrigé

  // Compteurs
  current_video?: number;
  completed_videos?: number; // 🆕 Nombre de vidéos terminées
  total_videos?: number;

  // Messages
  message?: string;
  current_step?: string; // Étape actuelle (init, transcript, chunking, summary, merge, meta, done)

  // Métadonnées
  playlist_id?: string;
  playlist_title?: string;

  // 🆕 v5.0: Progress granulaire pipeline chunked
  current_video_title?: string; // Titre de la vidéo en cours
  current_chunk?: number; // Chunk en cours de traitement
  total_chunks?: number; // Nombre total de chunks pour la vidéo en cours
  skipped_videos?: Array<{ video_id?: string; url?: string; reason: string }>;

  // Estimation temps
  estimated_time_remaining?: string;

  // Résultats
  results?: Summary[];
  corpus_summary?: string;
  result?: {
    playlist_id?: string;
    num_videos?: number;
    total_duration?: number;
    total_words?: number;
    num_skipped?: number; // 🆕 v5.0
    processing_time?: number; // 🆕 v5.0 (secondes)
  };

  // Erreur
  error?: string;
}

export interface ChatQuota {
  used: number;
  limit: number;
  remaining: number;
  reset_at?: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  web_search_used?: boolean;
  fact_checked?: boolean;
  sources?: ChatSource[];
  sources_json?: string;
}

export interface ChatSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface DiscoveryResponse {
  query: string;
  reformulated_queries: string[];
  candidates: VideoCandidate[];
  total_searched: number;
  languages_searched: string[];
  search_duration_ms: number;
  tournesol_available: boolean;
}

export interface VideoCandidate {
  video_id: string;
  title: string;
  channel: string;
  channel_id?: string;
  thumbnail_url?: string;
  duration?: number;
  duration_seconds?: number;
  view_count?: number;
  publish_date?: string;
  published_at?: string; // 🆕 Format ISO
  description?: string;
  tournesol_score?: number;
  quality_score?: number;
  academic_score?: number;
  freshness_score?: number;
  engagement_score?: number;
  clickbait_penalty?: number; // 🆕 Pénalité clickbait
  language?: string; // 🆕 Langue détectée de la vidéo
  is_tournesol_pick?: boolean; // 🆕 Flag Tournesol
  matched_query_terms?: string[]; // 🆕 Termes de recherche trouvés
  detected_sources?: number; // 🆕 Nombre de sources détectées
  content_type?: string; // 🆕 Type de contenu
}

export interface ReliabilityResult {
  score: number;
  level: "high" | "medium" | "low" | "unknown";
  factors: ReliabilityFactor[];
  summary?: string;
  freshness?: any;
  fact_check_lite?: any;
  analysis_type?: string;
  user_plan?: string;
  full_factcheck_available?: boolean;
}

export interface ReliabilityFactor {
  name: string;
  score: number;
  description: string;
  weight: number;
}

export interface FactCheckResult {
  claim: string;
  verdict: "verified" | "disputed" | "unverified" | "mixed";
  sources: FactCheckSource[];
  confidence: number;
  explanation?: string;
}

export interface FactCheckSource {
  title: string;
  url: string;
  snippet?: string;
  reliability?: number;
}

export interface Playlist {
  id: number;
  name: string;
  description?: string;
  video_ids: string[];
  summaries?: Summary[];
  corpus_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryResponse {
  items: Summary[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🗄️ TOKEN STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEYS.ACCESS);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEYS.REFRESH);
  } catch {
    return null;
  }
}

export function setTokens(accessToken: string, refreshToken: string): void {
  try {
    localStorage.setItem(TOKEN_KEYS.ACCESS, accessToken);
    if (refreshToken) {
      localStorage.setItem(TOKEN_KEYS.REFRESH, refreshToken);
    }
  } catch {
    /* Safari private mode */
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(TOKEN_KEYS.ACCESS);
    localStorage.removeItem(TOKEN_KEYS.REFRESH);
    localStorage.removeItem("cached_user");
  } catch {
    /* Safari private mode */
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ❌ ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

export class ApiError extends Error {
  status: number;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, data?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 HTTP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown> | FormData;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  skipCredentials?: boolean;
  timeout?: number;
  /** Internal flag — prevents infinite retry loop when a refreshed token still yields 401 */
  _retried?: boolean;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    skipAuth = false,
    skipCredentials = false,
    timeout = 30000,
    _retried = false,
  } = options;

  const url = `${API_URL}${endpoint}`;

  const requestHeaders: Record<string, string> = { ...headers };

  if (body && !(body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
      signal: controller.signal,
      credentials: skipCredentials ? "omit" : "include",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: Record<string, unknown> = {};
      let errorMessage = `HTTP ${response.status}`;

      try {
        errorData = await response.json();
        // FastAPI peut retourner detail comme string, tableau Pydantic [{loc, msg, type}] ou objet
        const rawDetail = errorData.detail;
        if (typeof rawDetail === "string") {
          errorMessage = rawDetail;
        } else if (Array.isArray(rawDetail)) {
          // Erreur de validation Pydantic : extraire les messages lisibles
          errorMessage = rawDetail
            .map((e: unknown) => {
              if (typeof e === "object" && e !== null && "msg" in e) {
                return String((e as Record<string, unknown>).msg);
              }
              return typeof e === "string" ? e : JSON.stringify(e);
            })
            .join(", ");
        } else if (rawDetail && typeof rawDetail === "object") {
          const detailObj = rawDetail as Record<string, unknown>;
          if (typeof detailObj.message === "string") {
            errorMessage = detailObj.message;
          } else if (typeof detailObj.error === "string") {
            errorMessage = detailObj.error;
          } else if (detailObj.error && typeof detailObj.error === "object") {
            // Nested error object: {"status": "error", "error": {"code": "...", "message": "..."}}
            const nestedError = detailObj.error as Record<string, unknown>;
            errorMessage =
              (typeof nestedError.message === "string"
                ? nestedError.message
                : null) ||
              (typeof nestedError.code === "string"
                ? nestedError.code
                : null) ||
              errorMessage;
          }
        } else if (errorData.message && typeof errorData.message === "string") {
          errorMessage = errorData.message;
        }
      } catch {
        // Ignore JSON parse errors
      }

      // Interceptor: dispatch upgrade modal for plan-restricted errors
      const _detail = errorData.detail;
      const _detailObj =
        typeof _detail === "object" && _detail !== null
          ? (_detail as Record<string, unknown>)
          : null;
      const _errorType = _detailObj?.error as string | undefined;

      if (
        (response.status === 403 &&
          (_errorType === "feature_locked" ||
            _errorType === "video_too_long")) ||
        (response.status === 429 && _errorType === "quota_exceeded")
      ) {
        window.dispatchEvent(
          new CustomEvent("show-upgrade-modal", {
            detail: { type: _errorType, ..._detailObj },
          }),
        );
      }

      // 401 = token expiré — _retried guard prevents infinite refresh loop
      if (response.status === 401 && !skipAuth && !_retried) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          return request(endpoint, { ...options, _retried: true });
        }
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }

      throw new ApiError(
        translateApiError(errorMessage),
        response.status,
        errorData,
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    return {} as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(translateApiError("Request timeout"), 408);
    }

    throw new ApiError(
      translateApiError(
        error instanceof Error ? error.message : "Network error",
      ),
      0,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 TOKEN REFRESH
// ═══════════════════════════════════════════════════════════════════════════════

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        return false;
      }

      const data: TokenResponse = await response.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 AUTH API
// ═══════════════════════════════════════════════════════════════════════════════

export const authApi = {
  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/register", {
      method: "POST",
      body: { username, email, password },
      skipAuth: true,
    });
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const response = await request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    });
    setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async verifyEmail(email: string, code: string): Promise<TokenResponse> {
    const response = await request<TokenResponse>("/api/auth/verify-email", {
      method: "POST",
      body: { email, code },
      skipAuth: true,
    });
    setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async resendVerification(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/resend-verification", {
      method: "POST",
      body: { email },
      skipAuth: true,
    });
  },

  async getGoogleAuthUrl(): Promise<{ auth_url: string }> {
    return request("/api/auth/google/login", { skipAuth: true });
  },

  /**
   * Redirige vers Google OAuth
   * Utilisé par useAuth.loginWithGoogle()
   * Stratégie: fetch auth_url puis redirect côté client
   * Fallback: navigation directe vers Railway si fetch échoue (Safari ITP)
   */
  async loginWithGoogle(): Promise<void> {
    try {
      // Fetch auth URL from API then redirect client-side
      // Works even when proxy (api.deepsightsynthesis.com/Caddy) strips query params
      const data = await request<{ auth_url: string }>(
        "/api/auth/google/login",
        { skipAuth: true },
      );
      if (data?.auth_url) {
        window.location.href = data.auth_url;
        return;
      }
    } catch {
      // Fallback: direct navigation with ?redirect=true (Safari cross-origin fetch blocked)
    }
    window.location.href = `${API_URL}/api/auth/google/login?redirect=true`;
  },

  async googleCallback(code: string, state?: string): Promise<TokenResponse> {
    const response = await request<TokenResponse>("/api/auth/google/callback", {
      method: "POST",
      body: { code, state },
      skipAuth: true,
    });
    setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async me(_options?: { skipCache?: boolean }): Promise<User> {
    // Note: skipCache non implémenté côté client, géré côté serveur
    return request("/api/auth/me");
  },

  async quota(): Promise<{
    credits: number;
    credits_monthly: number;
    credits_used: number;
    plan: string;
  }> {
    return request("/api/auth/quota");
  },

  async refresh(refreshToken: string): Promise<TokenResponse> {
    return request("/api/auth/refresh", {
      method: "POST",
      body: { refresh_token: refreshToken },
      skipAuth: true,
    });
  },

  async logout(): Promise<void> {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } finally {
      clearTokens();
    }
  },

  async forgotPassword(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
      skipAuth: true,
    });
  },

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/reset-password", {
      method: "POST",
      body: { email, code, new_password: newPassword },
      skipAuth: true,
    });
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/change-password", {
      method: "POST",
      body: { current_password: currentPassword, new_password: newPassword },
    });
  },

  async updatePreferences(prefs: {
    default_lang?: string;
    default_mode?: string;
    default_model?: string;
  }): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/preferences", {
      method: "PUT",
      body: prefs,
    });
  },

  async deleteAccount(
    password?: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await request<{ success: boolean; message: string }>(
      "/api/auth/account",
      {
        method: "DELETE",
        body: { password },
      },
    );
    clearTokens();
    return response;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📹 VIDEO API
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 🎪 DEMO API (Landing Page — No Auth)
// ═══════════════════════════════════════════════════════════════════════════════

export interface DemoAnalyzeResult {
  status: string;
  demo_session_id: string;
  video_title: string;
  video_channel: string;
  video_duration: number;
  thumbnail_url: string;
  platform: string;
  category: string;
  key_points: string[];
  conclusion: string;
  keywords: string[];
  keyword_definitions?: Record<string, string>;
  remaining_analyses: number;
}

export interface DemoChatResult {
  status: string;
  response: string;
  messages_remaining: number;
}

export interface DemoSuggestionsResult {
  status: string;
  suggestions: string[];
}

export const demoApi = {
  /** Analyse demo ultra-courte (3-5 points cles) */
  async analyze(url: string): Promise<DemoAnalyzeResult> {
    return request("/api/demo/analyze", {
      method: "POST",
      body: { url },
      skipAuth: true,
      skipCredentials: true,
      timeout: 60000,
    });
  },

  /** Chat demo (3 messages max) */
  async chat(demoSessionId: string, question: string): Promise<DemoChatResult> {
    return request("/api/demo/chat", {
      method: "POST",
      body: { demo_session_id: demoSessionId, question },
      skipAuth: true,
      skipCredentials: true,
      timeout: 30000,
    });
  },

  /** Get question suggestions for demo chat */
  async getSuggestions(demoSessionId: string): Promise<DemoSuggestionsResult> {
    return request(`/api/demo/suggestions/${demoSessionId}`, {
      method: "GET",
      skipAuth: true,
      skipCredentials: true,
      timeout: 15000,
    });
  },
};

// 🆓 Guest demo analysis result (legacy)
interface GuestAnalysisResult {
  video_title: string;
  video_channel: string;
  video_duration: number;
  thumbnail_url: string;
  summary_content: string;
  category: string;
  word_count: number;
  mode: string;
  lang: string;
}

export const videoApi = {
  /**
   * 🆓 Analyse guest (sans authentification) — 1 essai par visiteur
   */
  async analyzeGuest(url: string): Promise<GuestAnalysisResult> {
    return request("/api/videos/analyze/guest", {
      method: "POST",
      body: { url },
      skipAuth: true,
      skipCredentials: true,
      timeout: 90000,
    });
  },

  /**
   * 🎬 Analyse une vidéo YouTube
   * @param url - URL YouTube
   * @param category - Catégorie (auto, tech, science, etc.)
   * @param mode - Mode d'analyse (accessible, standard, expert)
   * @param model - Modèle IA (mistral-small, medium, large)
   * @param deepResearch - Recherche approfondie (Expert only)
   * @param lang - Langue pour le résumé (fr/en) - IMPORTANT: doit être la langue de l'interface
   */
  async analyze(
    url: string,
    category?: string,
    mode?: string,
    model?: string,
    deepResearch?: boolean,
    lang?: string,
  ): Promise<{
    task_id: string;
    status: string;
    result?: { summary_id: number };
  }> {
    return request("/api/videos/analyze", {
      method: "POST",
      body: {
        url,
        category: category || "auto",
        mode: mode || "standard",
        model: model || "mistral-small-2603",
        deep_research: deepResearch || false,
        lang: lang || "fr", // 🌐 Langue du résumé
      },
      timeout: 300000,
    });
  },

  /**
   * 🎬 Analyse vidéo v2.0 avec personnalisation avancée
   * @param url - URL YouTube
   * @param options - Options d'analyse + customization
   */
  async analyzeV2(
    url: string,
    options?: {
      category?: string;
      mode?: string;
      deepResearch?: boolean;
      lang?: string;
      // Personnalisation v3
      userPrompt?: string;
      antiAIDetection?: boolean;
      writingStyle?:
        | "default"
        | "human"
        | "academic"
        | "casual"
        | "humorous"
        | "soft";
      targetLength?: "short" | "medium" | "long" | "auto";
    },
  ): Promise<{
    task_id: string;
    status: string;
    result?: { summary_id: number };
  }> {
    const body: Record<string, unknown> = {
      url,
      category: "auto",
      mode: options?.mode || "standard",
      deep_research: options?.deepResearch || false,
      lang: options?.lang || "fr",
    };

    // Personnalisation v3 (snake_case pour backend Python)
    if (options?.userPrompt) body.user_prompt = options.userPrompt;
    if (options?.antiAIDetection !== undefined)
      body.anti_ai_detection = options.antiAIDetection;
    if (options?.writingStyle) body.writing_style = options.writingStyle;
    if (options?.targetLength) body.target_length = options.targetLength;

    return request("/api/videos/analyze/v2", {
      method: "POST",
      body,
      timeout: 300000,
    });
  },

  /**
   * 🔀 Analyse hybride unifiée
   * Supporte: URL YouTube, texte brut, ou recherche intelligente
   */
  async analyzeHybrid(params: {
    inputType?: "url" | "raw_text" | "search";
    url?: string;
    rawText?: string;
    textTitle?: string;
    textSource?: string;
    searchQuery?: string;
    mode?: string;
    lang?: string;
    deepResearch?: boolean;
  }): Promise<{ task_id: string; status: string }> {
    const body: Record<string, unknown> = {};

    if (params.inputType) body.input_type = params.inputType;
    if (params.url) body.url = params.url;
    if (params.rawText) body.raw_text = params.rawText;
    if (params.textTitle) body.text_title = params.textTitle;
    if (params.textSource) body.text_source = params.textSource;
    if (params.searchQuery) body.search_query = params.searchQuery;
    if (params.mode) body.mode = params.mode;
    if (params.lang) body.lang = params.lang;
    if (params.deepResearch !== undefined)
      body.deep_research = params.deepResearch;

    return request("/api/videos/analyze/hybrid", {
      method: "POST",
      body,
      timeout: 300000,
    });
  },

  /**
   * ? Quick Chat � Pr�pare une vid�o pour le chat IA sans analyse compl�te.
   * Extrait uniquement le transcript et cr�e un Summary l�ger.
   * Z�ro cr�dit consomm�, temps de r�ponse ~2-5s.
   *
   * Endpoint: POST /api/videos/quick-chat
   */

  /**
   * Analyse d'images collees/uploadees par l'utilisateur.
   * Utilise Mistral Vision pour OCR + description + liens entre images.
   *
   * Endpoint: POST /api/videos/analyze/images
   */
  async analyzeImages(params: {
    images: Array<{ data: string; mime_type: string; filename?: string }>;
    title?: string;
    context?: string;
    mode?: string;
    lang?: string;
    model?: string;
    category?: string;
  }): Promise<{
    task_id: string;
    status: string;
    image_count: number;
    cost: number;
  }> {
    return request("/api/videos/analyze/images", {
      method: "POST",
      body: {
        images: params.images,
        title: params.title || null,
        context: params.context || null,
        mode: params.mode || "standard",
        lang: params.lang || "fr",
        model: params.model || null,
        category: params.category || null,
      },
      timeout: 120000,
    });
  },

  async quickChat(
    url: string,
    lang: string = "fr",
  ): Promise<QuickChatResponse> {
    return request("/api/videos/quick-chat", {
      method: "POST",
      body: { url, lang },
      timeout: 30000,
    });
  },

  /**
   * ?? Upgrade Quick Chat ? Analyse compl�te.
   * Lance une analyse en background, conserve l'historique de chat.
   *
   * Endpoint: POST /api/videos/quick-chat/upgrade
   */
  async upgradeQuickChat(
    summaryId: number,
    mode: string = "standard",
    deepResearch: boolean = false,
  ): Promise<UpgradeQuickChatResponse> {
    return request("/api/videos/quick-chat/upgrade", {
      method: "POST",
      body: { summary_id: summaryId, mode, deep_research: deepResearch },
      timeout: 30000,
    });
  },

  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    return request(`/api/videos/status/${taskId}`);
  },

  async cancelTask(
    taskId: string,
  ): Promise<{ status: string; task_id: string }> {
    return request(`/api/videos/cancel/${taskId}`, { method: "POST" });
  },

  async getSummary(summaryId: number): Promise<Summary> {
    return request(`/api/videos/summary/${summaryId}`);
  },

  async getConcepts(
    summaryId: number,
  ): Promise<{ concepts: Concept[]; count: number }> {
    return request(`/api/videos/concepts/${summaryId}`);
  },

  /**
   * 📚 Récupère les concepts avec définitions enrichies (Mistral + Perplexity)
   * Pro/Expert: Définitions Perplexity avec sources web
   * Starter: Définitions Mistral uniquement
   */
  async getEnrichedConcepts(
    summaryId: number,
  ): Promise<EnrichedConceptsResponse> {
    return request(`/api/videos/concepts/${summaryId}/enriched`);
  },

  /**
   * 🔍 Découverte intelligente de vidéos YouTube v4.0
   * GRATUIT - Ne consomme pas de crédits
   * Recherche multilingue parallèle avec scoring qualité
   *
   * 🆕 v4.0: Timeout augmenté à 120s, plus de résultats (30-50)
   */
  async discover(
    query: string,
    options?: {
      limit?: number;
      languages?: string[];
      minQuality?: number;
      targetDuration?: "short" | "medium" | "long" | "default";
    },
  ): Promise<DiscoveryResponse> {
    return request("/api/videos/discover", {
      method: "POST",
      body: {
        query,
        max_results: options?.limit || 30, // 🆕 Augmenté de 20 à 30
        languages: options?.languages || ["fr", "en"],
        min_quality: options?.minQuality || 25, // 🆕 Réduit pour plus de résultats
        target_duration: options?.targetDuration || "default",
      },
      timeout: 120000, // 🆕 Augmenté de 30s à 120s pour recherches parallèles
    });
  },

  async factCheck(summaryId: number): Promise<ReliabilityResult> {
    return request(`/api/videos/reliability/${summaryId}`, {
      timeout: 120000,
    });
  },

  async webEnrich(summaryId: number): Promise<EnrichedConceptsResponse> {
    return request(`/api/videos/concepts/${summaryId}/enriched`, {
      timeout: 60000,
    });
  },

  async getTranscript(
    videoId: string,
  ): Promise<{ transcript: string; segments?: TranscriptSegment[] }> {
    return request(`/api/videos/transcript/${videoId}`);
  },

  async exportSummary(
    summaryId: number,
    format: "pdf" | "md" | "txt" | "docx" | "xlsx",
  ): Promise<Blob> {
    const response = await fetch(
      `${API_URL}/api/exports/${summaryId}/${format}`,
      {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      },
    );
    if (!response.ok) throw new ApiError("Export failed", response.status);
    return response.blob();
  },

  async exportAudio(
    summaryId: number,
    voiceId?: string,
    speed?: number,
    audioMode: "full" | "condensed" = "full",
  ): Promise<{
    audio_url: string;
    file_id: string;
    duration_estimate: number;
  }> {
    const res = await request<{
      status: string;
      data: { audio_url: string; file_id: string; duration_estimate: number };
    }>(`/api/exports/${summaryId}/audio`, {
      method: "POST",
      body: {
        voice_id: voiceId || null,
        speed: speed || 1.0,
        audio_mode: audioMode,
      },
      timeout: 120000, // ElevenLabs TTS can take 30-90s
    });
    return res.data;
  },

  async getHistory(params?: { limit?: number; page?: number }): Promise<{
    items: Summary[];
    total: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set("limit", String(params.limit));
    if (params?.page) queryParams.set("page", String(params.page));
    const query = queryParams.toString();
    try {
      return await request(`/api/history/videos${query ? `?${query}` : ""}`);
    } catch (error) {
      // Playlist history endpoint not available
      return { items: [], total: 0 };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 CHAT API
// ═══════════════════════════════════════════════════════════════════════════════

export const chatApi = {
  /**
   * 💬 Envoie une question au chat IA
   * Endpoint: POST /api/chat/ask
   */
  async send(
    summaryId: number,
    message: string,
    useWebSearch: boolean = false,
  ): Promise<{
    response: string;
    web_search_used: boolean;
    sources: Array<{ title: string; url: string }>;
    quota_info?: {
      web_search_available?: boolean;
      web_search_used?: number;
      web_search_limit?: number;
      web_search_remaining?: number;
      [key: string]: unknown;
    };
    enrichment_level?: string;
  }> {
    return request("/api/chat/ask", {
      method: "POST",
      body: {
        summary_id: summaryId,
        question: message, // Backend attend "question" pas "message"
        use_web_search: useWebSearch,
        mode: "standard",
      },
      timeout: 120000,
    });
  },

  /**
   * 📜 Récupère l'historique du chat
   * Endpoint: GET /api/chat/history/{summary_id}
   * Retourne { messages: [...], quota_info: {...} }
   */
  async getHistory(summaryId: number): Promise<ChatMessage[]> {
    const response = await request<{
      messages: ChatMessage[];
      quota_info: Record<string, unknown>;
    }>(`/api/chat/history/${summaryId}`);
    // Extraire et normaliser les messages
    if (response && response.messages && Array.isArray(response.messages)) {
      return response.messages.map((msg) => ({
        ...msg,
        // S'assurer que content est une string
        content:
          typeof msg.content === "string"
            ? msg.content
            : String(msg.content || ""),
      }));
    }
    return [];
  },

  /**
   * 📊 Récupère le quota du chat
   * Endpoint: GET /api/chat/{summary_id}/quota
   */
  async getQuota(summaryId: number): Promise<ChatQuota> {
    const response = await request<{
      can_ask: boolean;
      reason: string;
      daily_limit: number;
      daily_used: number;
      per_video_limit: number;
      per_video_used: number;
    }>(`/api/chat/${summaryId}/quota`);

    return {
      used: response.daily_used || 0,
      limit: response.daily_limit || 10,
      remaining: (response.daily_limit || 10) - (response.daily_used || 0),
    };
  },

  async clearHistory(summaryId: number): Promise<{ success: boolean }> {
    return request(`/api/chat/history/${summaryId}`, { method: "DELETE" });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ RELIABILITY API
// ═══════════════════════════════════════════════════════════════════════════════

export const reliabilityApi = {
  async getReliability(summaryId: number): Promise<ReliabilityResult> {
    return request(`/api/videos/reliability/${summaryId}`);
  },

  async checkChannel(channelId: string): Promise<{
    score: number;
    level: string;
    factors: ReliabilityFactor[];
  }> {
    return request(`/api/videos/channel/${channelId}/reliability`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📂 PLAYLIST API
// ═══════════════════════════════════════════════════════════════════════════════

// ── Types Corpus/Playlist enrichis ──────────────────────────────────────────
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
  created_at?: string;
  tags?: string;
  mode?: string;
  lang?: string;
}

export interface PlaylistDetailsResponse {
  id: number;
  playlist_id: string;
  playlist_title: string;
  playlist_url?: string;
  status: string;
  created_at: string;
  completed_at?: string;
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
  relevance_scores?: Record<string, number>;
}

export interface CorpusChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources?: Array<{
    video_title: string;
    video_id: string;
    relevance_score: number;
  }>;
}

export const playlistApi = {
  // ── CRUD ────────────────────────────────────────────────────────────────────
  async getAll(): Promise<PlaylistFullResponse[]> {
    return request("/api/playlists");
  },

  async create(data: {
    name: string;
    description?: string;
    video_ids?: number[];
  }): Promise<PlaylistFullResponse> {
    return request("/api/playlists", {
      method: "POST",
      body: data,
    });
  },

  /** Récupère une playlist complète avec toutes les vidéos + meta_analysis */
  async get(id: string): Promise<PlaylistFullResponse> {
    return request(`/api/playlists/${id}`);
  },

  /** Récupère les stats détaillées d'une playlist */
  async getDetails(id: string): Promise<PlaylistDetailsResponse> {
    return request(`/api/playlists/${id}/details`);
  },

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      add_video_ids?: number[];
      remove_video_ids?: number[];
    },
  ): Promise<PlaylistFullResponse> {
    return request(`/api/playlists/${id}`, {
      method: "PUT",
      body: data,
    });
  },

  async delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/playlists/${id}`, { method: "DELETE" });
  },

  // ── ANALYSE ─────────────────────────────────────────────────────────────────
  async analyze(
    url: string,
    options?: {
      lang?: string;
      mode?: string;
      category?: string;
      maxVideos?: number;
    },
  ): Promise<{ task_id: string; status: string }> {
    return request("/api/playlists/analyze", {
      method: "POST",
      body: { url, ...options },
      timeout: 600000,
    });
  },

  async analyzeCorpus(
    urls: string[],
    options?: { lang?: string; mode?: string; name?: string },
  ): Promise<{ task_id: string; status: string }> {
    return request("/api/playlists/analyze-corpus", {
      method: "POST",
      body: { urls, ...options },
      timeout: 600000,
    });
  },

  async getStatus(taskId: string): Promise<PlaylistTaskStatus> {
    return request(`/api/playlists/task/${taskId}`);
  },

  // ── SYNTHÈSE CORPUS (Méta-analyse) ─────────────────────────────────────────
  /** Génère/régénère la méta-analyse du corpus */
  async generateCorpusSummary(
    id: string,
    options?: { mode?: string; lang?: string },
  ): Promise<{
    success: boolean;
    playlist_id: string;
    meta_analysis: string;
    credits_remaining: number;
  }> {
    return request(`/api/playlists/${id}/corpus-summary`, {
      method: "POST",
      body: options || {},
      timeout: 300000, // 5 min max pour méta-analyse
    });
  },

  // ── CHAT IA CORPUS ──────────────────────────────────────────────────────────
  /** Pose une question à l'IA sur l'ensemble du corpus */
  async chatWithCorpus(
    id: string,
    message: string,
    options?: {
      web_search?: boolean;
      mode?: string;
      lang?: string;
    },
  ): Promise<CorpusChatResponse> {
    return request(`/api/playlists/${id}/chat`, {
      method: "POST",
      body: { message, ...options },
      timeout: 200000, // 3min20 — laisser le backend répondre avant le timeout frontend
    });
  },

  /** Récupère l'historique du chat corpus */
  async getChatHistory(
    id: string,
    limit?: number,
  ): Promise<{
    messages: CorpusChatMessage[];
  }> {
    const query = limit ? `?limit=${limit}` : "";
    return request(`/api/playlists/${id}/chat/history${query}`);
  },

  /** Supprime l'historique du chat corpus */
  async clearChatHistory(id: string): Promise<{ success: boolean }> {
    return request(`/api/playlists/${id}/chat`, { method: "DELETE" });
  },

  // ── VIDÉO INDIVIDUELLE DANS CORPUS ──────────────────────────────────────────
  /** Récupère les détails complets d'une vidéo dans le contexte d'une playlist */
  async getVideoInPlaylist(
    playlistId: string,
    summaryId: number,
  ): Promise<PlaylistVideoItem> {
    return request(`/api/playlists/${playlistId}/video/${summaryId}`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💳 BILLING API
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChangePlanResponse {
  success: boolean;
  message: string;
  action: "upgraded" | "downgraded" | "checkout_required" | "no_change";
  checkout_url?: string;
  new_plan?: string;
  effective_date?: string;
}

export interface SubscriptionStatus {
  plan: string;
  has_subscription: boolean;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  next_plan: string | null;
}

export interface TrialEligibility {
  eligible: boolean;
  reason?: string;
  trial_days: number;
  trial_plan: string;
}

// Types pour GET /api/billing/plans?platform=web
export interface ApiBillingPlanFeatureDisplay {
  text: string;
  icon: string;
  highlight?: boolean;
}

export interface ApiBillingPlanFeatureLocked {
  text: string;
  unlock_plan: string;
}

export interface ApiBillingPlan {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price_monthly_cents: number;
  color: string;
  icon: string;
  badge: { text: string; color: string } | null;
  popular: boolean;
  limits: Record<string, unknown>;
  platform_features: Record<string, boolean>;
  features_display: ApiBillingPlanFeatureDisplay[];
  features_locked: ApiBillingPlanFeatureLocked[];
  is_current: boolean;
  is_upgrade: boolean;
  is_downgrade: boolean;
}

export interface ApiBillingMyPlan {
  plan: string;
  plan_name: string;
  plan_icon: string;
  plan_color: string;
  limits: Record<string, unknown>;
  platform_features: Record<string, boolean>;
  usage: {
    analyses_this_month: number;
    chat_today: number;
    web_searches_this_month: number;
  };
  subscription: {
    status: string;
    current_period_end: string | null;
  };
}

export const billingApi = {
  async createCheckout(
    plan: string,
    trialDays?: number,
  ): Promise<{ checkout_url: string; session_id: string }> {
    return request("/api/billing/create-checkout", {
      method: "POST",
      body: { plan_id: plan, trial_days: trialDays },
    });
  },

  /**
   * 🆓 Vérifie si l'utilisateur peut bénéficier d'un essai gratuit
   */
  async checkTrialEligibility(): Promise<TrialEligibility> {
    return request("/api/billing/trial-eligibility");
  },

  /**
   * 🆓 Démarre un essai gratuit Pro de 7 jours
   */
  async startProTrial(): Promise<{ checkout_url: string; session_id: string }> {
    return request("/api/billing/create-checkout", {
      method: "POST",
      body: { plan_id: "pro", trial_days: 7 },
    });
  },

  async getPortalUrl(): Promise<{ portal_url: string }> {
    return request("/api/billing/portal");
  },

  async createPortal(): Promise<{ portal_url: string }> {
    return request("/api/billing/portal");
  },

  async getSubscription(): Promise<{
    plan: string;
    status: string;
    current_period_end?: string;
  }> {
    return request("/api/billing/info");
  },

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    return request("/api/billing/subscription-status");
  },

  /**
   * 🔄 Change le plan d'abonnement (upgrade ou downgrade)
   */
  async changePlan(newPlan: string): Promise<ChangePlanResponse> {
    return request("/api/billing/change-plan", {
      method: "POST",
      body: { new_plan: newPlan },
    });
  },

  /**
   * 🗑️ Annule l'abonnement (effectif à la fin de la période)
   */
  async cancelSubscription(): Promise<{
    success: boolean;
    message: string;
    end_date: string;
  }> {
    return request("/api/billing/cancel", {
      method: "POST",
    });
  },

  /**
   * 🔄 Réactive un abonnement annulé
   */
  async reactivateSubscription(): Promise<{
    success: boolean;
    message: string;
  }> {
    return request("/api/billing/reactivate", {
      method: "POST",
    });
  },

  /**
   * ✅ Confirme un checkout Stripe et met à jour le plan
   * Utilisé comme fallback quand les webhooks ne fonctionnent pas
   */
  async confirmCheckout(sessionId: string): Promise<{
    success: boolean;
    message: string;
    plan?: string;
    credits_added?: number;
    new_credits?: number;
    already_updated?: boolean;
    status?: string;
  }> {
    return request("/api/billing/confirm-checkout", {
      method: "POST",
      body: { session_id: sessionId },
    });
  },

  /**
   * 📋 Récupère les plans disponibles avec features_display/locked
   */
  async getPlans(
    platform: string = "web",
  ): Promise<{ plans: ApiBillingPlan[] }> {
    return request(`/api/billing/plans?platform=${platform}`);
  },

  /**
   * 📋 Récupère le plan actuel de l'utilisateur + usage
   */
  async getMyPlan(platform: string = "web"): Promise<ApiBillingMyPlan> {
    return request(`/api/billing/my-plan?platform=${platform}`);
  },

  /**
   * 📜 Récupère l'historique des transactions
   */
  async getTransactions(): Promise<{
    transactions: Array<{
      id: number;
      amount: number;
      balance_after: number;
      type: string;
      description: string;
      created_at: string;
    }>;
  }> {
    return request("/api/billing/transactions");
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 💳 CREDIT PACKS (One-time purchases)
  // ═══════════════════════════════════════════════════════════════════════════

  async getCreditPacks(): Promise<{
    packs: Array<{
      id: string;
      name: string;
      credits: number;
      price_cents: number;
      price_display: string;
      description: string;
    }>;
  }> {
    return request("/api/billing/credits/packs");
  },

  async createCreditPackCheckout(
    packId: string,
  ): Promise<{ checkout_url: string; session_id: string }> {
    return request("/api/billing/credits/checkout", {
      method: "POST",
      body: { pack_id: packId },
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔑 API KEYS MANAGEMENT (Expert Plan Only)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 📊 Vérifie le statut de la clé API
   */
  async getApiKeyStatus(): Promise<{
    has_api_key: boolean;
    created_at: string | null;
    last_used: string | null;
  }> {
    return request("/api/billing/api-key/status");
  },

  /**
   * 🔐 Génère une nouvelle clé API
   * ⚠️ La clé n'est retournée qu'une seule fois !
   */
  async generateApiKey(): Promise<{
    api_key: string;
    message: string;
  }> {
    return request("/api/billing/api-key/generate", { method: "POST" });
  },

  /**
   * 🔄 Régénère la clé API (révoque l'ancienne)
   * ⚠️ La nouvelle clé n'est retournée qu'une seule fois !
   */
  async regenerateApiKey(): Promise<{
    api_key: string;
    message: string;
  }> {
    return request("/api/billing/api-key/regenerate", { method: "POST" });
  },

  /**
   * 🗑️ Révoque définitivement la clé API
   */
  async revokeApiKey(): Promise<{
    success: boolean;
    message: string;
  }> {
    return request("/api/billing/api-key", { method: "DELETE" });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎓 ACADEMIC API — Scientific Paper Search & Bibliography Export
// ═══════════════════════════════════════════════════════════════════════════════

export interface AcademicPaper {
  id: string;
  doi?: string;
  title: string;
  authors: Array<{ name: string; affiliation?: string }>;
  year?: number;
  venue?: string;
  abstract?: string;
  citation_count: number;
  url?: string;
  pdf_url?: string;
  source: "semantic_scholar" | "openalex" | "arxiv";
  relevance_score: number;
  is_open_access: boolean;
  keywords: string[];
}

export interface AcademicSearchResponse {
  papers: AcademicPaper[];
  total_found: number;
  query_keywords: string[];
  sources_queried: string[];
  cached: boolean;
  tier_limit_reached: boolean;
  tier_limit?: number;
}

export type BibliographyFormat =
  | "bibtex"
  | "ris"
  | "apa"
  | "mla"
  | "chicago"
  | "harvard";

export const academicApi = {
  /**
   * 🔍 Search for academic papers by keywords
   */
  async search(params: {
    keywords: string[];
    summary_id?: string;
    limit?: number;
    year_from?: number;
    year_to?: number;
    include_preprints?: boolean;
  }): Promise<AcademicSearchResponse> {
    return request("/api/academic/search", {
      method: "POST",
      body: params,
      timeout: 60000,
    });
  },

  /**
   * ✨ Enrich a summary with academic sources
   * Extracts concepts from the analysis and searches for related papers
   */
  async enrich(
    summaryId: string | number,
    maxPapers?: number,
  ): Promise<AcademicSearchResponse> {
    return request(`/api/academic/enrich/${summaryId}`, {
      method: "POST",
      body: maxPapers ? { max_papers: maxPapers } : undefined,
      timeout: 120000, // Increased to 120s for multiple external API calls
    });
  },

  /**
   * 📚 Get cached academic papers for a summary
   */
  async getPapers(summaryId: string | number): Promise<AcademicSearchResponse> {
    return request(`/api/academic/papers/${summaryId}`);
  },

  /**
   * 📥 Export bibliography in various formats
   */
  async exportBibliography(params: {
    paper_ids: string[];
    format: BibliographyFormat;
    summary_id?: string;
  }): Promise<{
    content: string;
    format: BibliographyFormat;
    paper_count: number;
    filename: string;
  }> {
    return request("/api/academic/export", {
      method: "POST",
      body: params,
    });
  },

  /**
   * 📋 Get available export formats for user's plan
   */
  async getFormats(): Promise<{
    formats: Array<{ id: string; name: string; extension: string }>;
    can_export: boolean;
    user_plan: string;
  }> {
    return request("/api/academic/formats");
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS API
// ═══════════════════════════════════════════════════════════════════════════════

export const exportsApi = {
  async pdf(summaryId: number): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/exports/${summaryId}/pdf`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!response.ok) throw new ApiError("Export failed", response.status);
    return response.blob();
  },

  async markdown(summaryId: number): Promise<string> {
    const data = await request<{ content: string }>(
      `/api/exports/${summaryId}/md`,
    );
    return data.content;
  },

  async text(summaryId: number): Promise<string> {
    const data = await request<{ content: string }>(
      `/api/exports/${summaryId}/txt`,
    );
    return data.content;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 USAGE API
// ═══════════════════════════════════════════════════════════════════════════════

export const usageApi = {
  async getStats(): Promise<{
    total_analyses: number;
    total_chats: number;
    analyses_this_month: number;
    credits_used: number;
    by_day: Array<{ date: string; count: number }>;
    by_type: Array<{ type: string; count: number }>;
  }> {
    return request("/api/usage/stats");
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌻 TOURNESOL API
// ═══════════════════════════════════════════════════════════════════════════════

export const tournesolApi = {
  async search(query: string, limit = 10): Promise<VideoCandidate[]> {
    return request(
      `/api/tournesol/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },

  async recommendations(limit = 20): Promise<VideoCandidate[]> {
    return request(`/api/tournesol/recommendations?limit=${limit}`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ ADMIN API
// ═══════════════════════════════════════════════════════════════════════════════

export const adminApi = {
  async getStats(): Promise<{
    total_users: number;
    total_analyses: number;
    active_subscriptions: number;
    revenue_monthly: number;
    users_by_plan: Record<string, number>;
  }> {
    return request("/api/admin/stats");
  },

  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    items: User[];
    total: number;
    page: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set("page", String(params.page));
    if (params?.limit) queryParams.set("limit", String(params.limit));
    if (params?.search) queryParams.set("search", params.search);
    const query = queryParams.toString();
    return request(`/api/admin/users${query ? `?${query}` : ""}`);
  },

  async updateCredits(
    userId: number,
    credits: number,
  ): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${userId}/credits`, {
      method: "POST",
      body: { credits },
    });
  },

  async updatePlan(
    userId: number,
    plan: string,
  ): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${userId}/plan`, {
      method: "POST",
      body: { plan },
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📚 STUDY API — Flashcards, Quiz, Mindmap
// ═══════════════════════════════════════════════════════════════════════════════

export interface StudyQuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

export interface StudyFlashcardItem {
  front: string;
  back: string;
  category?: string;
}

export interface QuizResponse {
  success: boolean;
  summary_id: number;
  quiz: StudyQuizQuestion[];
  title: string;
  difficulty: string;
}

export interface FlashcardsResponse {
  success: boolean;
  summary_id: number;
  flashcards: StudyFlashcardItem[];
  title: string;
}

export interface MindmapResponse {
  success: boolean;
  summary_id: number;
  mermaid_code: string;
  concepts: Array<{ name: string; children?: string[] }>;
  title: string;
}

export interface StudyAllResponse {
  success: boolean;
  summary_id: number;
  materials: {
    quiz?: StudyQuizQuestion[];
    flashcards?: StudyFlashcardItem[];
    mindmap?: {
      mermaid_code: string;
      concepts: Array<{ name: string; children?: string[] }>;
    };
  };
}

export const studyApi = {
  /**
   * 🎯 Génère un quiz de compréhension
   * Coût: 1 crédit
   */
  async generateQuiz(summaryId: number): Promise<QuizResponse> {
    return request(`/api/study/quiz/${summaryId}`, {
      method: "POST",
      timeout: 120000,
    });
  },

  /**
   * 📇 Génère des flashcards de révision
   * Coût: 1 crédit
   */
  async generateFlashcards(summaryId: number): Promise<FlashcardsResponse> {
    return request(`/api/study/flashcards/${summaryId}`, {
      method: "POST",
      timeout: 120000,
    });
  },

  /**
   * 🌳 Génère un mindmap (carte conceptuelle)
   * Coût: 1 crédit
   */
  async generateMindmap(summaryId: number): Promise<MindmapResponse> {
    return request(`/api/study/mindmap/${summaryId}`, {
      method: "POST",
      timeout: 120000,
    });
  },

  /**
   * 📚 Génère tous les outils d'étude en une fois
   * Coût: 2 crédits
   */
  async generateAll(summaryId: number): Promise<StudyAllResponse> {
    return request(`/api/study/all/${summaryId}`, {
      method: "POST",
      timeout: 180000,
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🩺 STATUS API — Public monitoring endpoints
// ═══════════════════════════════════════════════════════════════════════════════

export interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  latency_ms: number | null;
  message: string | null;
  last_checked: string;
}

export interface SystemStatus {
  status: "operational" | "degraded" | "down";
  version: string;
  uptime_seconds: number | null;
  services: ServiceStatus[];
  checked_at: string;
}

export const contactApi = {
  async submit(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<{ status: string; message: string }> {
    return request("/api/contact", {
      method: "POST",
      body: data,
      skipAuth: true,
    });
  },
};

export interface MemoryUsage {
  rss_mb: number | null;
  limit_mb: number;
  usage_percent: number | null;
  status: string;
}

export interface DeepSystemStatus extends SystemStatus {
  memory?: MemoryUsage;
}

export const statusApi = {
  async getStatus(): Promise<SystemStatus> {
    return request("/api/health/status", { skipAuth: true });
  },

  async getDeepStatus(): Promise<DeepSystemStatus> {
    // Call the Vercel serverless function which proxies to backend with secret
    const resp = await fetch("/api/status");
    if (!resp.ok) {
      throw new Error(`Status check failed: ${resp.status}`);
    }
    return resp.json();
  },

  async ping(): Promise<{ status: string }> {
    return request("/api/health/ping", { skipAuth: true });
  },
};

export interface SharedAnalysisResponse {
  share_token: string;
  video_id: string;
  video_title: string;
  video_thumbnail: string;
  verdict: string;
  view_count: number;
  is_active?: boolean;
  created_at: string;
  analysis: {
    video_title?: string;
    video_id?: string;
    video_thumbnail?: string;
    channel?: string;
    duration_seconds?: number;
    synthesis_markdown?: string;
    summary_short?: string;
    platform?: string;
    sources?: unknown[];
    tags?: string[] | string;
    verdict?:
      | string
      | { tone?: string; label?: string; icon?: string; text?: string };
    video_channel?: string;
    video_url?: string;
    thumbnail_url?: string;
    category?: string;
    reliability_score?: number;
    summary_content?: string;
    mode?: string;
    lang?: string;
    video_duration?: number;
    created_at?: string;
  };
}

export const shareApi = {
  async createShareLink(
    videoId: string,
  ): Promise<{ share_url: string; share_token: string }> {
    return request("/api/share", {
      method: "POST",
      body: { video_id: videoId },
    });
  },

  async getSharedAnalysis(shareToken: string): Promise<SharedAnalysisResponse> {
    const res = await request<{ status: string; data: SharedAnalysisResponse }>(
      `/api/share/${shareToken}`,
      { skipAuth: true },
    );
    // Handle both old format (direct) and new format (wrapped in data)
    if (res && "data" in res && res.data) return res.data;
    return res as unknown as SharedAnalysisResponse;
  },

  async deleteShare(videoId: string): Promise<void> {
    await request(`/api/share/${videoId}`, { method: "DELETE" });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔥 TRENDING API — Public (no auth)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrendingVideo {
  video_id: string;
  title: string;
  channel: string;
  thumbnail_url: string | null;
  category: string | null;
  duration: number | null;
  analysis_count: number;
  unique_users: number;
  avg_reliability_score: number | null;
  latest_analyzed_at: string;
  is_cached: boolean;
}

export interface TrendingResponse {
  videos: TrendingVideo[];
  period: string;
  total_cached_videos: number;
  generated_at: string;
}

export const trendingApi = {
  async getTrending(
    period: "7d" | "30d" | "all" = "30d",
    category?: string,
    limit: number = 20,
  ): Promise<TrendingResponse> {
    const params = new URLSearchParams({ period, limit: String(limit) });
    if (category) params.set("category", category);
    return request(`/api/trending?${params}`, { skipAuth: true });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 SEARCH API — Semantic search (auth required)
// ═══════════════════════════════════════════════════════════════════════════════

export interface SemanticSearchResult {
  video_id: string;
  score: number;
  text_preview: string;
  video_title: string;
  video_channel: string;
  thumbnail_url: string | null;
  category: string | null;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  query: string;
  total_results: number;
  searched_at: string;
}

export const searchApi = {
  async semanticSearch(
    query: string,
    limit: number = 10,
    category?: string,
  ): Promise<SemanticSearchResponse> {
    return request("/api/search/semantic", {
      method: "POST",
      body: { query, limit, category },
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 VIDEO CACHE API — Public check
// ═══════════════════════════════════════════════════════════════════════════════

export interface VideoCacheInfo {
  cached: boolean;
  video_id: string;
  platform?: string;
  lang?: string;
  char_count?: number;
  video_title?: string;
  video_channel?: string;
  thumbnail_url?: string;
  video_duration?: number;
  category?: string;
  cached_at?: string;
}

export const videoCacheApi = {
  async checkCache(videoId: string): Promise<VideoCacheInfo> {
    return request(`/api/videos/check-cache/${videoId}`, { skipAuth: true });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎙️ VOICE CHAT API — Sessions vocales temps réel
// ═══════════════════════════════════════════════════════════════════════════════

export interface VoiceQuota {
  plan: string;
  voice_enabled: boolean;
  seconds_used: number;
  seconds_limit: number;
  minutes_remaining: number;
  max_session_minutes: number;
  sessions_this_month: number;
  reset_date: string;
}

export interface VoiceSession {
  session_id: string;
  signed_url: string;
  expires_at: string;
  quota_remaining_minutes: number;
  max_session_minutes: number;
  input_mode: "ptt" | "vad";
  ptt_key?: string;
  playback_rate: number;
}

export interface VoicePreferences {
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

export interface VoiceCatalogEntry {
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

export interface VoiceSpeedPreset {
  id: string;
  label_fr: string;
  label_en: string;
  value: number;
  icon: string;
}

export interface VoiceChatSpeedPreset {
  id: string;
  label_fr: string;
  label_en: string;
  api_speed: number;
  playback_rate: number;
  concise: boolean;
}

export interface VoiceModel {
  id: string;
  name: string;
  description_fr: string;
  description_en: string;
  latency: string;
  recommended_for: string;
}

export interface VoiceCatalog {
  voices: VoiceCatalogEntry[];
  speed_presets: VoiceSpeedPreset[];
  voice_chat_speed_presets: VoiceChatSpeedPreset[];
  models: VoiceModel[];
}

export interface VoiceSessionSummary {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  status: string;
  has_transcript: boolean;
}

export interface VoiceHistoryResponse {
  summary_id: number;
  video_title: string;
  sessions: VoiceSessionSummary[];
  total_minutes: number;
}

export interface VoiceTranscript {
  session_id: string;
  summary_id: number;
  started_at: string;
  duration_seconds: number;
  transcript: string;
}

export interface VoiceThumbnailGradient {
  from: string;
  via: string;
  to: string;
}

export type VoiceThumbnailSource =
  | "youtube_hd"
  | "youtube_standard"
  | "tiktok_stored"
  | "stored"
  | "generated"
  | "generating"
  | "gradient";

export interface VoiceThumbnailResponse {
  thumbnail_url: string | null;
  source: VoiceThumbnailSource;
  video_id: string;
  video_title: string | null;
  video_channel: string | null;
  platform: string;
  gradient: VoiceThumbnailGradient;
  alt_text: string;
}

export const voiceApi = {
  /**
   * 🎙️ Récupère le quota vocal de l'utilisateur
   * Endpoint: GET /api/voice/quota
   */
  async getQuota(): Promise<VoiceQuota> {
    return request("/api/voice/quota");
  },

  /**
   * 🎙️ Crée une nouvelle session vocale
   * Endpoint: POST /api/voice/session
   */
  async createSession(
    summaryId: number,
    language: string = "fr",
  ): Promise<VoiceSession> {
    return request("/api/voice/session", {
      method: "POST",
      body: { summary_id: summaryId, language },
    });
  },

  /**
   * 🎙️ Récupère l'historique des sessions vocales pour une analyse
   * Endpoint: GET /api/voice/history/{summaryId}
   */
  async getHistory(summaryId: number): Promise<VoiceHistoryResponse> {
    return request(`/api/voice/history/${summaryId}`);
  },

  /**
   * 🎙️ Récupère le transcript d'une session vocale
   * Endpoint: GET /api/voice/history/{summaryId}/{sessionId}/transcript
   */
  async getTranscript(
    summaryId: number,
    sessionId: string,
  ): Promise<VoiceTranscript> {
    return request(`/api/voice/history/${summaryId}/${sessionId}/transcript`);
  },

  /**
   * 🎙️ Crée un checkout Stripe pour un pack de minutes vocales
   * Endpoint: POST /api/voice/addon/checkout
   */
  async createAddonCheckout(packId: string): Promise<{ checkout_url: string }> {
    return request("/api/voice/addon/checkout", {
      method: "POST",
      body: { pack_id: packId },
    });
  },

  /**
   * 🖼️ Récupère la thumbnail HD d'une vidéo pour l'agent vocal.
   * Backend garantit :
   *  - YouTube → URL HD maxresdefault (1280x720)
   *  - TikTok/autres → thumbnail stockée (R2 ou locale)
   *  - Sinon → image générée ou gradient fallback
   *
   * Si `source === 'generating'`, le backend lance une génération background ;
   * le frontend peut re-fetch quelques secondes plus tard.
   *
   * Endpoint: GET /api/voice/session/{summaryId}/thumbnail
   */
  async getSessionThumbnail(
    summaryId: number | string,
  ): Promise<VoiceThumbnailResponse> {
    return request<VoiceThumbnailResponse>(
      `/api/voice/session/${summaryId}/thumbnail`,
    );
  },

  async getPreferences(): Promise<VoicePreferences> {
    return request("/api/voice/preferences");
  },

  async getCatalog(): Promise<VoiceCatalog> {
    return request("/api/voice/catalog");
  },

  async updatePreferences(
    updates: Partial<VoicePreferences>,
  ): Promise<VoicePreferences> {
    return request("/api/voice/preferences", {
      method: "PUT",
      body: updates,
    });
  },

  /**
   * 🎙️ Persiste un transcript voix (Spec #5 — sync bidir Chat IA)
   * Endpoint: POST /api/voice/transcripts/append
   *
   * Le backend insère une row dans `chat_messages` avec source='voice'.
   * Auth Bearer JWT user. Vérifie IDOR (user owns voice_session_id).
   *
   * ⚠️ Cet endpoint dépend de Spec #1 (B1) — fallback gracieux côté caller
   * (skip + console.warn) si pas encore live (404 / 405 / network).
   */
  async appendTranscript(payload: {
    voice_session_id: string;
    speaker: "user" | "agent";
    content: string;
    time_in_call_secs: number;
  }): Promise<{ ok: true }> {
    return request("/api/voice/transcripts/append", {
      method: "POST",
      body: payload,
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ⚔️ DEBATE API — Débat IA entre vidéos
// ═══════════════════════════════════════════════════════════════════════════════

import type { DebateAnalysis } from "../types/debate";

export interface DebateCreateRequest {
  url_a: string;
  url_b?: string;
  mode: "auto" | "manual";
  lang?: string;
  platform?: string;
}

export interface DebateStatusResponse {
  debate_id: number;
  status: string;
  progress_message: string;
  video_a_title?: string;
  video_b_title?: string;
}

export interface DebateChatMessage {
  id: number;
  debate_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export const debateApi = {
  async create(
    data: DebateCreateRequest,
  ): Promise<{ debate_id: number; status: string }> {
    return request("/api/debate/create", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      timeout: 60000,
    });
  },

  async getStatus(debateId: number): Promise<DebateStatusResponse> {
    return request(`/api/debate/status/${debateId}`);
  },

  async getResult(debateId: number): Promise<DebateAnalysis> {
    return request(`/api/debate/${debateId}`);
  },

  async getHistory(
    page?: number,
    limit?: number,
  ): Promise<{ debates: DebateAnalysis[]; total: number }> {
    const params = new URLSearchParams();
    if (page !== undefined) params.set("page", String(page));
    if (limit !== undefined) params.set("limit", String(limit));
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/debate/history${query}`);
  },

  async delete(debateId: number): Promise<{ success: boolean }> {
    return request(`/api/debate/${debateId}`, { method: "DELETE" });
  },

  async sendChat(data: {
    debate_id: number;
    message: string;
  }): Promise<DebateChatMessage> {
    return request("/api/debate/chat", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
    });
  },

  async getChatHistory(
    debateId: number,
  ): Promise<{ messages: DebateChatMessage[] }> {
    return request(`/api/debate/chat/history/${debateId}`);
  },

  async getVoiceAvatar(
    debateId: number,
    regenerate = false,
  ): Promise<{
    status: "ready" | "generating" | "unavailable";
    url: string | null;
    topic: string | null;
  }> {
    const qs = regenerate ? "?regenerate=true" : "";
    return request(`/api/voice/debate/${debateId}/avatar${qs}`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎮 GAMIFICATION API — XP, Badges, Streaks, FSRS Reviews
// ═══════════════════════════════════════════════════════════════════════════════

export const gamificationApi = {
  /** Get study stats (XP, level, streak) */
  async getStats(): Promise<StudyStats> {
    return request("/api/gamification/stats");
  },

  /** Get heat map data */
  async getHeatMap(days: number = 35): Promise<HeatMapData> {
    return request(`/api/gamification/heat-map?days=${days}`);
  },

  /** Get badges (earned + locked) */
  async getBadges(): Promise<BadgesData> {
    return request("/api/gamification/badges");
  },

  /** Get video mastery list */
  async getVideoMastery(): Promise<VideoMasteryData> {
    return request("/api/gamification/video-mastery");
  },

  /** Get due cards for a summary */
  async getDueCards(summaryId: number): Promise<DueCardsData> {
    return request(`/api/study/review/due/${summaryId}`);
  },

  /** Submit a card review (FSRS rating) */
  async submitReview(data: {
    summary_id: number;
    card_index: number;
    card_front: string;
    rating: number;
  }): Promise<ReviewResult> {
    return request("/api/study/review/submit", { method: "POST", body: data });
  },

  /** Start a study session */
  async startSession(data: {
    summary_id?: number;
    session_type?: string;
  }): Promise<StudySessionData> {
    return request("/api/study/review/session/start", {
      method: "POST",
      body: data,
    });
  },

  /** End a study session */
  async endSession(data: {
    session_id: number;
    cards_reviewed: number;
    cards_correct: number;
    duration_seconds: number;
  }): Promise<SessionEndResult> {
    return request("/api/study/review/session/end", {
      method: "POST",
      body: data,
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🖼️ KEYWORD IMAGES API
// ═══════════════════════════════════════════════════════════════════════════════

export interface KeywordImageResponse {
  term: string;
  image_url: string | null;
  status: "ready" | "not_found" | "pending" | "error";
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 GEO (Generative Engine Optimization)
// ═══════════════════════════════════════════════════════════════════════════════

export interface GeoCitableQuote {
  text: string;
  score: number;
  marker: string;
  has_stats: boolean;
  is_self_contained: boolean;
  improvement_hint: string | null;
}

export interface GeoScoreBreakdown {
  citability: number;
  structure: number;
  authority: number;
  coverage: number;
  freshness: number;
}

export interface GeoRecommendation {
  category: string;
  priority: string;
  message: string;
  impact_estimate: number;
}

export interface GeoScoreResponse {
  summary_id: number;
  video_id: string;
  video_title: string;
  overall_score: number;
  grade: string;
  breakdown: GeoScoreBreakdown;
  total_claims: number;
  solid_claims: number;
  citable_quotes: GeoCitableQuote[];
  recommendations: GeoRecommendation[];
}

export interface GeoReportAction {
  action: string;
  impact: string;
  effort: string;
  expected_gain: number;
}

export interface GeoReportResponse {
  summary_id: number;
  video_id: string;
  video_title: string;
  geo_score: number;
  geo_grade: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  action_plan: GeoReportAction[];
  optimized_description: string;
  suggested_chapters: string[];
  target_queries: string[];
}

export interface GeoBenchmarkEntry {
  summary_id: number;
  video_id: string;
  video_title: string;
  category: string | null;
  overall_score: number;
  grade: string;
  breakdown: GeoScoreBreakdown;
}

export interface GeoBenchmarkResponse {
  target: GeoBenchmarkEntry;
  comparisons: GeoBenchmarkEntry[];
  rank: number;
  total: number;
  percentile: number;
}

export const geoApi = {
  async getScore(summaryId: number): Promise<GeoScoreResponse> {
    return request<GeoScoreResponse>("/api/geo/score", {
      method: "POST",
      body: { summary_id: summaryId },
    });
  },

  async getReport(summaryId: number): Promise<GeoReportResponse> {
    return request<GeoReportResponse>("/api/geo/report", {
      method: "POST",
      body: { summary_id: summaryId },
      timeout: 60000,
    });
  },

  async getBenchmark(summaryId: number): Promise<GeoBenchmarkResponse> {
    return request<GeoBenchmarkResponse>("/api/geo/benchmark", {
      method: "POST",
      body: { summary_id: summaryId },
    });
  },
};

export const keywordImageApi = {
  async getKeywordImage(term: string): Promise<KeywordImageResponse> {
    try {
      return await request<KeywordImageResponse>(
        `/api/images/keyword/${encodeURIComponent(term)}`,
        { skipAuth: true, timeout: 5000 },
      );
    } catch {
      return { term, image_url: null, status: "error" };
    }
  },
};

// Export par défaut
export default {
  auth: authApi,
  video: videoApi,
  chat: chatApi,
  reliability: reliabilityApi,
  playlist: playlistApi,
  billing: billingApi,
  exports: exportsApi,
  usage: usageApi,
  tournesol: tournesolApi,
  admin: adminApi,
  academic: academicApi,
  study: studyApi,
  contact: contactApi,
  status: statusApi,
  share: shareApi,
  trending: trendingApi,
  search: searchApi,
  videoCache: videoCacheApi,
  voice: voiceApi,
  debate: debateApi,
  gamification: gamificationApi,
  keywordImage: keywordImageApi,
  geo: geoApi,
};
