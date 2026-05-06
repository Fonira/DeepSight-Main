import { Platform } from "react-native";
import { API_BASE_URL, TIMEOUTS } from "../constants/config";
import { tokenStorage } from "../utils/storage";
import NetInfo from "@react-native-community/netinfo";
import { withRetryPreset } from "./RetryService";
import { tokenManager } from "./TokenManager";
import type {
  User,
  AnalysisSummary,
  AnalysisRequest,
  AnalysisStatus,
  VideoInfo,
  ChatMessage,
  QuotaInfo,
  BillingPlan,
  Subscription,
  ApiResponse,
  PaginatedResponse,
  HistoryFilters,
  PlaylistFullResponse,
  PlaylistDetailsResponse,
  CorpusChatMessage,
  CorpusChatResponse,
} from "../types";

// Request configuration
interface RequestConfig {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  requiresAuth?: boolean;
  retries?: number;
}

// Offline detection
const checkConnectivity = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? true;
};

// Retry helper with exponential backoff
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  // Helper to check if this is an email verification required error
  get isEmailNotVerified(): boolean {
    return (
      this.status === 403 &&
      (this.code === "EMAIL_NOT_VERIFIED" ||
        this.detail === "EMAIL_NOT_VERIFIED")
    );
  }
}

// Token refresh lock — shared promise prevents race conditions when multiple
// requests get 401 simultaneously: all await the same refresh attempt.
let refreshPromise: Promise<string | null> | null = null;

// Refresh token function
const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      // Server explicitly rejected the refresh token - clear tokens
      await tokenStorage.clearTokens();
      return null;
    }

    const data = await response.json();
    await tokenStorage.setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch (error) {
    // Network error during refresh - do NOT clear tokens
    // The tokens may still be valid, just a temporary connectivity issue
    if (__DEV__) {
      console.warn("[Auth] Network error during token refresh:", error);
    }
    return null;
  }
};

// Base request function with offline detection and token refresh (no retry — see requestWithRetry)
const _requestRaw = async <T>(
  endpoint: string,
  config: RequestConfig = {},
): Promise<T> => {
  const {
    method = "GET",
    headers = {},
    body,
    timeout = TIMEOUTS.DEFAULT,
    requiresAuth = true,
    retries = 2,
  } = config;

  // Offline detection
  const isConnected = await checkConnectivity();
  if (!isConnected) {
    throw new ApiError("No internet connection", 0, "OFFLINE");
  }

  // Build headers
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Add auth token if required (proactive refresh via TokenManager)
  if (requiresAuth) {
    const accessToken =
      (await tokenManager.getValidToken()) ||
      (await tokenStorage.getAccessToken());
    if (accessToken) {
      requestHeaders["Authorization"] = `Bearer ${accessToken}`;
    }
  }

  // Build request options
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== "GET") {
    requestOptions.body = JSON.stringify(body);
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  requestOptions.signal = controller.signal;

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
    clearTimeout(timeoutId);

    // Handle 401 - token expired
    // All concurrent requests share the same refreshPromise to avoid parallel refresh calls.
    if (response.status === 401 && requiresAuth) {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;

      if (newToken) {
        // Retry the original request with new token
        requestHeaders["Authorization"] = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...requestOptions,
          headers: requestHeaders,
        });

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          throw new ApiError(
            errorData.message || "Request failed",
            retryResponse.status,
            errorData.code,
          );
        }

        return await retryResponse.json();
      } else {
        throw new ApiError("Session expired", 401, "SESSION_EXPIRED");
      }
    }

    // Handle other errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Handle Pydantic validation errors where detail is an array of objects
      const detail = errorData.detail;
      const errorMessage =
        errorData.message ||
        (Array.isArray(detail)
          ? detail.map((d: any) => d.msg || String(d)).join(", ")
          : detail) ||
        errorData.error ||
        "Request failed";
      const errorCode =
        errorData.code || (Array.isArray(detail) ? "VALIDATION_ERROR" : detail);
      throw new ApiError(
        errorMessage,
        response.status,
        errorCode,
        errorData.detail,
      );
    }

    // Parse response
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

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new ApiError("Request timeout", 408, "TIMEOUT");
      }
      throw new ApiError(error.message, 0, "NETWORK_ERROR");
    }

    throw new ApiError("Unknown error", 0, "UNKNOWN");
  }
};

// Public request with RetryService (exponential backoff + jitter + circuit breaker)
const request = async <T>(
  endpoint: string,
  config: RequestConfig = {},
): Promise<T> => {
  // Strip legacy retries param — RetryService handles retry logic now
  const { retries: _ignored, ...cleanConfig } = config;
  return withRetryPreset(
    () => _requestRaw<T>(endpoint, cleanConfig),
    "standard",
    endpoint,
  );
};

// Patient request for long-running operations (discover, playlists)
// Uses 120s timeout instead of 30s standard
const requestPatient = async <T>(
  endpoint: string,
  config: RequestConfig = {},
): Promise<T> => {
  const { retries: _ignored, ...cleanConfig } = config;
  return withRetryPreset(
    () => _requestRaw<T>(endpoint, cleanConfig),
    "patient",
    endpoint,
  );
};

// ============================================
// Authentication API
// ============================================
export const authApi = {
  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<{ message: string }> {
    return request("/api/auth/register", {
      method: "POST",
      body: { username, email, password },
      requiresAuth: false,
    });
  },

  async login(
    email: string,
    password: string,
  ): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const response = await request<{
      access_token: string;
      refresh_token: string;
      user: User;
    }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      requiresAuth: false,
    });
    // Store tokens with explicit error handling
    try {
      await tokenStorage.setTokens(
        response.access_token,
        response.refresh_token,
      );
    } catch (tokenError) {
      if (__DEV__) {
        console.error("[API] Failed to store tokens:", tokenError);
      }
      // Still return response - the user state will be set even if tokens fail to store
      // This prevents the login from appearing to fail when it actually succeeded
    }

    return response;
  },

  async verifyEmail(
    email: string,
    code: string,
  ): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const response = await request<{
      access_token: string;
      refresh_token: string;
      user: User;
    }>("/api/auth/verify-email", {
      method: "POST",
      body: { email, code },
      requiresAuth: false,
    });
    await tokenStorage.setTokens(response.access_token, response.refresh_token);
    return response;
  },

  // Google OAuth mobile: exchange Google id_token (JWT) for session tokens
  async googleTokenLogin(
    googleIdToken: string,
  ): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const response = await request<{
      access_token: string;
      refresh_token: string;
      user: User;
    }>("/api/auth/google/token", {
      method: "POST",
      body: {
        id_token: googleIdToken,
        client_platform: Platform.OS === "ios" ? "ios" : "android",
      },
      requiresAuth: false,
    });
    await tokenStorage.setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async getMe(): Promise<User> {
    return request("/api/auth/me");
  },

  async getQuota(): Promise<QuotaInfo> {
    return request("/api/auth/quota");
  },

  async logout(): Promise<void> {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } finally {
      await tokenStorage.clearTokens();
    }
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return request("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
      requiresAuth: false,
    });
  },

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return request("/api/auth/reset-password", {
      method: "POST",
      body: { email, code, new_password: newPassword },
      requiresAuth: false,
    });
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    return request("/api/auth/resend-verification", {
      method: "POST",
      body: { email },
      requiresAuth: false,
    });
  },

  async deleteAccount(
    password?: string,
  ): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/account", {
      method: "DELETE",
      body: password ? { password } : {},
    });
  },
};

// ============================================
// User API
// ============================================
export const userApi = {
  async updateProfile(profile: {
    username?: string;
    avatar_url?: string;
  }): Promise<User> {
    return request("/api/auth/profile", {
      method: "PUT",
      body: profile,
    });
  },

  async updatePreferences(preferences: {
    default_lang?: string;
    default_mode?: string;
    default_model?: string;
  }): Promise<User> {
    return request("/api/auth/preferences", {
      method: "PUT",
      body: preferences,
    });
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return request("/api/auth/change-password", {
      method: "POST",
      body: { current_password: currentPassword, new_password: newPassword },
    });
  },

  async uploadAvatar(imageUri: string): Promise<{ avatar_url: string }> {
    // Unified: uses withRetryPreset + tokenManager
    return withRetryPreset(
      async () => {
        const token =
          (await tokenManager.getValidToken()) ||
          (await tokenStorage.getAccessToken());

        // Create form data with the image
        const formData = new FormData();
        const filename = imageUri.split("/").pop() || "avatar.jpg";
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";

        formData.append("file", {
          uri: imageUri,
          name: filename,
          type,
        } as unknown as Blob);

        const response = await fetch(`${API_BASE_URL}/api/profile/avatar`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.status === 401) {
          // Token expired during upload — refresh and retry once
          if (!refreshPromise) {
            refreshPromise = refreshAccessToken().finally(() => {
              refreshPromise = null;
            });
          }
          const newToken = await refreshPromise;
          if (!newToken)
            throw new ApiError("Session expired", 401, "SESSION_EXPIRED");

          const retryResponse = await fetch(
            `${API_BASE_URL}/api/profile/avatar`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${newToken}` },
              body: formData,
            },
          );
          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            throw new ApiError(
              errorData.message || "Failed to upload avatar",
              retryResponse.status,
              errorData.code,
            );
          }
          return retryResponse.json();
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiError(
            errorData.message || "Failed to upload avatar",
            response.status,
            errorData.code,
          );
        }

        return response.json();
      },
      "quick",
      "upload-avatar",
    );
  },
};

// ============================================
// Video Analysis API
// ============================================
export const videoApi = {
  async analyze(data: AnalysisRequest): Promise<{ task_id: string }> {
    return request("/api/videos/analyze/hybrid", {
      method: "POST",
      body: data,
      timeout: TIMEOUTS.ANALYSIS,
    });
  },

  /**
   * V2 Analysis with advanced customization options
   * Supports Anti-AI Detection, custom prompts, writing styles, etc.
   */
  async analyzeVideoV2(data: {
    url?: string;
    raw_text?: string;
    title?: string;
    source?: string;
    mode: string;
    category: string;
    language: string;
    model?: string;
    deep_research?: boolean;
    customization?: {
      userPrompt?: string;
      antiAIDetection?: boolean;
      writingStyle?: string;
      targetLength?: string;
      formalityLevel?: number;
      vocabularyComplexity?: string;
      includeExamples?: boolean;
      personalTone?: boolean;
    };
  }): Promise<{ task_id: string }> {
    // Transform customization to backend format
    const backendData: Record<string, unknown> = {
      url: data.url,
      raw_text: data.raw_text,
      title: data.title,
      source: data.source,
      mode: data.mode,
      category: data.category,
      language: data.language,
      model: data.model,
      deep_research: data.deep_research,
    };

    // Add customization options if provided
    if (data.customization) {
      backendData.user_prompt = data.customization.userPrompt;
      backendData.anti_ai_detection = data.customization.antiAIDetection;
      backendData.writing_style = data.customization.writingStyle;
      backendData.target_length = data.customization.targetLength;
      backendData.formality_level = data.customization.formalityLevel;
      backendData.vocabulary_complexity =
        data.customization.vocabularyComplexity;
      backendData.include_examples = data.customization.includeExamples;
      backendData.personal_tone = data.customization.personalTone;
    }

    return request("/api/videos/analyze/hybrid", {
      method: "POST",
      body: backendData,
      timeout: TIMEOUTS.ANALYSIS,
    });
  },

  async cancelTask(
    taskId: string,
  ): Promise<{ status: string; task_id: string }> {
    return request<{ status: string; task_id: string }>(
      `/api/videos/cancel/${taskId}`,
      {
        method: "POST",
      },
    );
  },

  async getStatus(taskId: string): Promise<AnalysisStatus> {
    const raw = await request<Record<string, unknown>>(
      `/api/videos/status/${taskId}`,
    );
    // Normalize backend snake_case response to match AnalysisStatus interface
    return {
      task_id: (raw.task_id as string) || taskId,
      taskId: (raw.task_id as string) || taskId,
      status: (raw.status as AnalysisStatus["status"]) || "pending",
      progress: (raw.progress as number) || 0,
      message: raw.message as string | undefined,
      result: raw.result as Record<string, unknown> | undefined,
      error: raw.error as string | undefined,
      // Extract summary_id from top-level OR from result dict
      summary_id:
        (raw.summary_id as string) ||
        ((raw.result as Record<string, unknown>)?.summary_id as string) ||
        undefined,
    };
  },

  /**
   * ? Quick Chat � Pr�pare une vid�o pour le chat IA sans analyse compl�te.
   * Z�ro cr�dit, temps de r�ponse ~2-5s.
   */
  async quickChat(
    url: string,
    lang: string = "fr",
  ): Promise<{
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
  }> {
    return request("/api/videos/quick-chat", {
      method: "POST",
      body: { url, lang },
    });
  },

  /**
   * ?? Upgrade Quick Chat ? Analyse compl�te (conserve l'historique de chat)
   */
  async upgradeQuickChat(
    summaryId: number,
    mode: string = "standard",
  ): Promise<{
    task_id: string;
    status: string;
    message: string;
  }> {
    return request("/api/videos/quick-chat/upgrade", {
      method: "POST",
      body: { summary_id: summaryId, mode },
    });
  },

  async getSummary(summaryId: string): Promise<AnalysisSummary> {
    const response = await request<{
      id: number;
      video_id: string;
      video_title: string;
      video_channel?: string;
      video_duration?: number;
      video_url?: string;
      thumbnail_url?: string;
      platform?: string;
      category: string;
      lang?: string;
      mode: string;
      model_used?: string;
      summary_content: string;
      word_count?: number;
      reliability_score?: number;
      is_favorite: boolean;
      notes?: string;
      tags?: string;
      created_at?: string;
      transcript_context?: string;
      // Phase 2 — Visual Analysis (Mistral Vision)
      visual_analysis?: import("../types").VisualAnalysis | null;
    }>(`/api/videos/summary/${summaryId}`);

    // Transform backend response to mobile format
    return {
      id: String(response.id),
      videoId: response.video_id,
      title: response.video_title || "Sans titre",
      content: response.summary_content,
      mode: response.mode || "standard",
      category: response.category || "general",
      model: response.model_used,
      language: response.lang,
      createdAt: response.created_at,
      isFavorite: response.is_favorite || false,
      wordCount: response.word_count,
      thumbnail: response.thumbnail_url,
      channel: response.video_channel,
      duration: response.video_duration,
      videoInfo: {
        id: response.video_id,
        title: response.video_title || "Sans titre",
        description: "",
        thumbnail:
          response.thumbnail_url ||
          (response.platform !== "tiktok"
            ? `https://img.youtube.com/vi/${response.video_id}/mqdefault.jpg`
            : ""),
        channel: response.video_channel || "Unknown",
        channelId: "",
        duration: response.video_duration || 0,
        publishedAt: response.created_at || "",
        viewCount: 0,
      },
      // Platform (youtube / tiktok / text)
      platform:
        response.platform ||
        (response.video_url?.includes("tiktok") ? "tiktok" : "youtube"),
      video_url: response.video_url,
      // Pass through additional fields for notes/tags
      notes: response.notes,
      tags: response.tags,
      reliabilityScore: response.reliability_score,
      creditsUsed: 1, // Default value
      // 👁️ Phase 2 — Visual Analysis (peut être absent → tab affiche empty state)
      visual_analysis: response.visual_analysis ?? null,
    } as AnalysisSummary & {
      notes?: string;
      tags?: string;
      reliabilityScore?: number;
      creditsUsed?: number;
    };
  },

  async getConcepts(summaryId: string): Promise<{ concepts: string[] }> {
    return request(`/api/videos/concepts/${summaryId}`);
  },

  async getEnrichedConcepts(
    summaryId: string,
  ): Promise<{ concepts: Array<{ name: string; definition: string }> }> {
    return request(`/api/videos/concepts/${summaryId}/enriched`);
  },

  async factCheck(summaryId: string): Promise<{
    freshness?: {
      score: number;
      label: string;
      description?: string;
      days_since_upload?: number;
      last_updated?: string;
    };
    fact_check_lite?: {
      overall_confidence: number;
      risk_summary: string;
      claims_analyzed: number;
      high_risk_claims: Array<{
        claim: string;
        claim_type: string;
        confidence: number;
        risk_level: string;
        verification_hint?: string;
        suggested_search?: string;
      }>;
      medium_risk_claims: Array<{
        claim: string;
        claim_type: string;
        confidence: number;
        risk_level: string;
        verification_hint?: string;
      }>;
      verification_suggestions: string[];
      disclaimers: string[];
    };
    summary_id: number;
    video_title?: string;
    user_plan?: string;
    full_factcheck_available?: boolean;
  }> {
    return request(`/api/videos/reliability/${summaryId}`, {
      timeout: TIMEOUTS.FACT_CHECK,
    });
  },

  async webEnrich(summaryId: string): Promise<{
    summary_id: number;
    video_title?: string;
    concepts: Array<{
      term: string;
      definition: string;
      category: string;
      category_label: string;
      category_icon: string;
      context_relevance?: string;
      sources: string[];
      confidence: number;
      provider: string;
    }>;
    count: number;
    provider: string;
  }> {
    return request(`/api/videos/concepts/${summaryId}/enriched`, {
      timeout: TIMEOUTS.FACT_CHECK,
    });
  },

  async getTranscript(videoId: string): Promise<{
    transcript: string;
    segments: Array<{ start: number; text: string }>;
  }> {
    return request(`/api/videos/transcript/${videoId}`);
  },

  // Reliability analysis
  async getReliability(summaryId: string): Promise<{
    overall_score: number;
    confidence: number;
    factors: Array<{ name: string; score: number; description: string }>;
    recommendations: string[];
  }> {
    return request(`/api/videos/reliability/${summaryId}`);
  },

  async analyzeReliability(summaryId: string): Promise<{
    overall_score: number;
    confidence: number;
    factors: Array<{ name: string; score: number; description: string }>;
    recommendations: string[];
  }> {
    return request("/api/videos/reliability/analyze", {
      method: "POST",
      body: { summary_id: summaryId },
      timeout: TIMEOUTS.FACT_CHECK,
    });
  },

  // Freshness indicator
  async getFreshness(summaryId: string): Promise<{
    publication_date: string;
    days_since_published: number;
    freshness_level: "fresh" | "recent" | "dated" | "outdated";
    freshness_score: number;
  }> {
    return request(`/api/videos/freshness/${summaryId}`);
  },

  // Notes and tags
  async updateNotes(
    summaryId: string,
    notes: string,
  ): Promise<{ success: boolean }> {
    return request(`/api/videos/summary/${summaryId}/notes`, {
      method: "PUT",
      body: { notes },
    });
  },

  async updateTags(
    summaryId: string,
    tags: string[],
  ): Promise<{ success: boolean }> {
    return request(`/api/videos/summary/${summaryId}/tags`, {
      method: "PUT",
      body: { tags },
    });
  },

  // Video discovery - returns sorted list of videos
  async discoverSearch(
    query: string,
    options?: {
      limit?: number;
      language?: string;
      sort_by?: "quality" | "views" | "date" | "academic";
    },
  ): Promise<{
    videos: Array<{
      video_id: string;
      title: string;
      channel: string;
      thumbnail_url: string;
      duration: number;
      view_count: number;
      quality_score: number;
      tournesol_score: number;
      published_at: string | null;
      is_tournesol_pick: boolean;
    }>;
    total: number;
    query: string;
  }> {
    const langs = options?.language || "fr,en";
    const params = new URLSearchParams({
      query,
      languages: langs,
      limit: String(options?.limit || 20),
      sort_by: options?.sort_by || "quality",
    });
    return requestPatient(`/api/videos/discover/search?${params.toString()}`, {
      method: "POST",
      timeout: 120000,
    });
  },

  // Categories
  async getCategories(): Promise<{
    categories: Array<{ id: string; name: string; icon: string }>;
  }> {
    return request("/api/videos/categories");
  },

  // Credit estimation
  async estimateCredits(params: {
    video_url?: string;
    mode?: string;
    include_study_tools?: boolean;
  }): Promise<{ credits: number; breakdown: Record<string, number> }> {
    return request("/api/videos/estimate-credits", {
      method: "POST",
      body: params,
    });
  },

  // Delete summary
  async deleteSummary(summaryId: string): Promise<{ success: boolean }> {
    return request(`/api/videos/summary/${summaryId}`, {
      method: "DELETE",
    });
  },

  // User stats
  async getStats(): Promise<{
    total_videos: number;
    total_words: number;
    total_minutes_saved: number;
    favorite_category: string;
  }> {
    return request("/api/videos/stats");
  },
};

// ============================================
// Academic API
// ============================================
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
  // Search for academic papers by keywords
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
      timeout: TIMEOUTS.FACT_CHECK,
    });
  },

  // Enrich a summary with academic sources
  async enrich(
    summaryId: string,
    maxPapers?: number,
  ): Promise<AcademicSearchResponse> {
    return request(`/api/academic/enrich/${summaryId}`, {
      method: "POST",
      body: maxPapers ? { max_papers: maxPapers } : undefined,
      timeout: TIMEOUTS.FACT_CHECK,
    });
  },

  // Get cached academic papers for a summary
  async getPapers(summaryId: string): Promise<AcademicSearchResponse> {
    return request(`/api/academic/papers/${summaryId}`);
  },

  // Export bibliography
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

  // Get available export formats for user's plan
  async getFormats(): Promise<{
    formats: Array<{ id: string; name: string; extension: string }>;
    can_export: boolean;
    user_plan: string;
  }> {
    return request("/api/academic/formats");
  },
};

// ============================================
// History API
// ============================================
export const historyApi = {
  async getHistory(
    page: number = 1,
    limit: number = 20,
    filters?: HistoryFilters,
  ): Promise<PaginatedResponse<AnalysisSummary>> {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(limit),
    });

    if (filters?.search) params.append("search", filters.search);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.favoritesOnly) params.append("favorites_only", "true");
    if (filters?.mode) params.append("mode", filters.mode);

    // Use the correct backend endpoint: /api/history/videos
    const response = await request<{
      items: Array<{
        id: number;
        video_id: string;
        video_title: string;
        video_channel?: string;
        video_duration?: number;
        thumbnail_url?: string;
        category?: string;
        mode?: string;
        is_favorite: boolean;
        platform?: string;
        video_url?: string;
        created_at?: string;
      }>;
      total: number;
      page: number;
      per_page: number;
      pages: number;
    }>(`/api/history/videos?${params.toString()}`);

    // Transform backend response to mobile format
    const items: AnalysisSummary[] = (response.items || []).map((item) => ({
      id: String(item.id),
      title: item.video_title || "Sans titre",
      videoId: item.video_id,
      thumbnail: item.thumbnail_url,
      isFavorite: item.is_favorite,
      mode: item.mode || "synthesis",
      category: item.category || "general",
      channel: item.video_channel,
      duration: item.video_duration,
      platform: item.platform
        ? (item.platform as "youtube" | "tiktok" | "text")
        : item.video_url?.startsWith("text://")
          ? "text"
          : item.video_url?.includes("tiktok")
            ? "tiktok"
            : item.video_id?.startsWith("txt_")
              ? "text"
              : "youtube",
      video_url: item.video_url,
      createdAt: item.created_at,
    }));

    return {
      items,
      total: response.total,
      page: response.page,
      pageSize: response.per_page,
      hasMore: response.page < response.pages,
    };
  },

  async toggleFavorite(summaryId: string): Promise<{ isFavorite: boolean }> {
    const response = await request<{ is_favorite: boolean }>(
      `/api/videos/summary/${summaryId}/favorite`,
      {
        method: "POST",
      },
    );
    // Transform snake_case to camelCase
    return { isFavorite: response.is_favorite };
  },

  async deleteSummary(summaryId: string): Promise<void> {
    return request(`/api/history/videos/${summaryId}`, {
      method: "DELETE",
    });
  },

  async getStats(): Promise<{
    totalVideos: number;
    totalPlaylists: number;
    totalMinutes: number;
  }> {
    const response = await request<{
      total_videos: number;
      total_playlists: number;
      total_minutes_watched: number;
    }>("/api/history/stats");

    return {
      totalVideos: response.total_videos,
      totalPlaylists: response.total_playlists,
      totalMinutes: response.total_minutes_watched,
    };
  },

  // Playlist history
  async getPlaylistHistory(
    page: number = 1,
    limit: number = 20,
  ): Promise<
    PaginatedResponse<{
      id: string;
      name: string;
      video_count: number;
      created_at: string;
      thumbnail_urls: string[];
    }>
  > {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(limit),
    });

    const response = await request<{
      items: Array<{
        id: number;
        name: string;
        video_count: number;
        created_at: string;
        thumbnail_urls: string[];
      }>;
      total: number;
      page: number;
      per_page: number;
      pages: number;
    }>(`/api/history/playlists?${params.toString()}`);

    return {
      items: response.items.map((item) => ({
        ...item,
        id: String(item.id),
      })),
      total: response.total,
      page: response.page,
      pageSize: response.per_page,
      hasMore: response.page < response.pages,
    };
  },

  // Search history
  async searchHistory(query: string): Promise<AnalysisSummary[]> {
    const response = await request<{
      results: Array<{
        id: number;
        video_title: string;
        video_id: string;
        thumbnail_url?: string;
        is_favorite: boolean;
        mode?: string;
        category?: string;
        created_at?: string;
      }>;
    }>(`/api/history/search?q=${encodeURIComponent(query)}`);

    return response.results.map((item) => ({
      id: String(item.id),
      title: item.video_title || "Sans titre",
      videoId: item.video_id,
      thumbnail: item.thumbnail_url,
      isFavorite: item.is_favorite,
      mode: item.mode || "synthesis",
      category: item.category || "general",
      createdAt: item.created_at,
    }));
  },

  // Get user's favorites
  async getFavorites(limit: number = 5): Promise<AnalysisSummary[]> {
    const response = await this.getHistory(1, limit, { favoritesOnly: true });
    return response.items;
  },

  // Semantic search
  async semanticSearch(query: string): Promise<AnalysisSummary[]> {
    const response = await request<{
      results: Array<{
        id: number;
        video_title: string;
        video_id: string;
        thumbnail_url?: string;
        is_favorite: boolean;
        mode?: string;
        category?: string;
        created_at?: string;
        relevance_score: number;
      }>;
    }>("/api/history/search/semantic", {
      method: "POST",
      body: { query },
    });

    return response.results.map((item) => ({
      id: String(item.id),
      title: item.video_title || "Sans titre",
      videoId: item.video_id,
      thumbnail: item.thumbnail_url,
      isFavorite: item.is_favorite,
      mode: item.mode || "synthesis",
      category: item.category || "general",
      createdAt: item.created_at,
    }));
  },
};

// ============================================
// Chat API
// ============================================
export const chatApi = {
  async sendMessage(
    summaryId: string,
    message: string,
    options?: { useWebSearch?: boolean; mode?: string },
  ): Promise<{
    response: string;
    sources?: Array<{ url: string; title: string }>;
    web_search_used?: boolean;
  }> {
    return request("/api/chat/ask", {
      method: "POST",
      body: {
        summary_id: Number(summaryId),
        question: message,
        use_web_search: options?.useWebSearch ?? false,
        mode: options?.mode || "standard",
      },
      timeout: 120000,
    });
  },

  async getHistory(summaryId: string): Promise<{ messages: ChatMessage[] }> {
    const response = await request<{
      messages: Array<{
        id: number;
        role: "user" | "assistant";
        content: string;
        created_at: string;
        web_search_used?: boolean;
        sources?: Array<{ url: string; title: string }>;
        // Voice timeline fields (backend ChatHistoryItem schema)
        source?: "text" | "voice";
        voice_speaker?: "user" | "agent" | null;
        voice_session_id?: string | null;
        time_in_call_secs?: number | null;
      }>;
      quota_info?: Record<string, unknown>;
    }>(`/api/chat/history/${summaryId}`);
    // Transform backend response (created_at, numeric id) to mobile ChatMessage format
    // Passthrough voice timeline fields (source/voice_speaker/voice_session_id/time_in_call_secs)
    // pour permettre le filtrage "audio user invisible" côté UI (useConversation).
    const messages: ChatMessage[] = (response.messages || []).map(
      (m, index) => ({
        id: m.id != null ? String(m.id) : `history-${index}-${Date.now()}`,
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
        web_search_used: m.web_search_used,
        source: m.source,
        voice_speaker: m.voice_speaker,
        voice_session_id: m.voice_session_id,
        time_in_call_secs: m.time_in_call_secs,
      }),
    );
    return { messages };
  },

  async getQuota(
    summaryId: string,
  ): Promise<{ used: number; limit: number; remaining: number }> {
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

  /**
   * Clear chat history for a video. By default also wipes voice transcripts
   * (mirrors backend `include_voice=true` default — Task 7+10 unified clear).
   */
  async clearHistory(
    summaryId: string,
    options: { includeVoice?: boolean } = {},
  ): Promise<{ success: boolean; deleted?: number }> {
    const includeVoice = options.includeVoice ?? true;
    return request(
      `/api/chat/history/${summaryId}?include_voice=${includeVoice}`,
      { method: "DELETE" },
    );
  },

  /**
   * Send a message with streaming response (SSE).
   * Returns an async generator that yields response chunks.
   *
   * Usage:
   * ```
   * for await (const chunk of chatApi.sendMessageStream(summaryId, message)) {
   *   console.log(chunk); // Partial response text
   * }
   * ```
   */
  async *sendMessageStream(
    summaryId: string,
    message: string,
    options?: { useWebSearch?: boolean; mode?: string },
  ): AsyncGenerator<string, void, unknown> {
    // Use tokenManager for proactive refresh (not raw tokenStorage)
    const accessToken = await tokenManager
      .getValidToken()
      .catch(() => tokenStorage.getAccessToken());

    const body = JSON.stringify({
      summary_id: Number(summaryId),
      question: message,
      use_web_search: options?.useWebSearch ?? false,
      mode: options?.mode || "standard",
    });

    let response = await fetch(`${API_BASE_URL}/api/chat/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body,
    });

    // If 401, try refreshing token once and retry
    if (response.status === 401) {
      const refreshedToken = await tokenManager
        .getValidToken()
        .catch(() => null);
      if (refreshedToken) {
        response = await fetch(`${API_BASE_URL}/api/chat/ask/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshedToken}`,
          },
          body,
        });
      }
    }

    if (!response.ok) {
      throw new ApiError(
        `Chat stream failed: ${response.status}`,
        response.status,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ApiError("No response body", 500);
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                yield parsed.content;
              } else if (parsed.text) {
                yield parsed.text;
              } else if (typeof parsed === "string") {
                yield parsed;
              }
            } catch {
              // Not JSON, yield as-is
              if (data.trim()) {
                yield data;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};

// ============================================
// Playlist API (detail, chat, stats)
// ============================================
export const playlistApi = {
  /** Get full playlist with videos */
  async getPlaylist(playlistId: string): Promise<PlaylistFullResponse> {
    return request<PlaylistFullResponse>(`/api/playlists/${playlistId}`);
  },

  /** Get detailed stats */
  async getDetails(playlistId: string): Promise<PlaylistDetailsResponse> {
    return request<PlaylistDetailsResponse>(
      `/api/playlists/${playlistId}/details`,
    );
  },

  /** Generate or regenerate corpus summary (meta-analysis) */
  async generateCorpusSummary(
    playlistId: string,
    options?: { mode?: string; lang?: string },
  ): Promise<{ meta_analysis: string }> {
    return request(`/api/playlists/${playlistId}/corpus-summary`, {
      method: "POST",
      body: {
        mode: options?.mode || "standard",
        lang: options?.lang || "fr",
      },
      timeout: 120000,
    });
  },

  /** Chat with corpus */
  async chatWithCorpus(
    playlistId: string,
    message: string,
    options?: { web_search?: boolean; mode?: string; lang?: string },
  ): Promise<CorpusChatResponse> {
    return request(`/api/playlists/${playlistId}/chat`, {
      method: "POST",
      body: {
        message,
        web_search: options?.web_search ?? false,
        mode: options?.mode || "standard",
        lang: options?.lang || "fr",
      },
      timeout: 120000,
    });
  },

  /** Get chat history */
  async getChatHistory(
    playlistId: string,
    limit: number = 50,
  ): Promise<CorpusChatMessage[]> {
    const response = await request<{
      messages: Array<{
        id: number;
        role: "user" | "assistant";
        content: string;
        created_at: string;
        sources?: Array<{
          video_title: string;
          video_id: string;
          relevance_score: number;
        }>;
      }>;
    }>(`/api/playlists/${playlistId}/chat/history?limit=${limit}`);

    return (response.messages || []).map((m) => ({
      id: String(m.id),
      role: m.role,
      content: m.content,
      created_at: m.created_at,
      sources: m.sources,
    }));
  },

  /** Clear chat history */
  async clearChatHistory(playlistId: string): Promise<{ success: boolean }> {
    return request(`/api/playlists/${playlistId}/chat`, { method: "DELETE" });
  },
};

// ============================================
// Billing API
// ============================================

// Pricing v2 types (mirror frontend/src/services/api.ts)
export type BillingCycle = "monthly" | "yearly";
export type ApiPlanIdV2 = "free" | "pro" | "expert";

export interface TrialEligibility {
  eligible: boolean;
  reason?: string;
  trial_days: number;
  trial_plan: string;
}

export const billingApi = {
  async getPlans(): Promise<{ plans: BillingPlan[] }> {
    return request("/api/billing/plans", { requiresAuth: false });
  },

  /**
   * 🆕 Pricing v2 — Crée une session Stripe Checkout pour Pro / Expert + cycle.
   *
   * Le backend POST /api/billing/create-checkout accepte v2 `{plan, cycle}` ET
   * legacy `{plan_id}` (compat rétro). On envoie les 3 champs pour maximiser la
   * compatibilité (mobile peut être en avance/retard sur le backend déployé).
   *
   * @param plan "pro" | "expert"
   * @param cycle "monthly" | "yearly" (default monthly)
   */
  async createCheckout(
    plan: ApiPlanIdV2 | string,
    cycle: BillingCycle = "monthly",
  ): Promise<{ url: string; session_id: string }> {
    const response = await request<{
      checkout_url: string;
      session_id: string;
    }>("/api/billing/create-checkout", {
      method: "POST",
      body: { plan, cycle, plan_id: plan },
    });
    return { url: response.checkout_url, session_id: response.session_id };
  },

  /**
   * 🆓 Pricing v2 — Vérifie l'éligibilité au trial 7 j (Pro ou Expert).
   *
   * Backend : GET /api/billing/trial-eligibility?plan={pro|expert}
   *
   * @param plan "pro" | "expert" (default pro)
   */
  async checkTrialEligibility(
    plan: ApiPlanIdV2 | string = "pro",
  ): Promise<TrialEligibility> {
    return request(
      `/api/billing/trial-eligibility?plan=${encodeURIComponent(plan)}`,
    );
  },

  /**
   * @deprecated v0 — utiliser checkTrialEligibility("pro") à la place.
   * Conservé pour compat tests / clients legacy mobile.
   */
  async getTrialEligibility(): Promise<TrialEligibility> {
    return this.checkTrialEligibility("pro");
  },

  /**
   * 🆓 Pricing v2 — Démarre un essai gratuit 7 j sans CB sur Pro ou Expert.
   *
   * Crée une session Stripe Checkout avec :
   *   - trial_period_days = 7
   *   - payment_method_collection = "if_required"  (pas de CB demandée pendant le trial)
   *
   * Backend : POST /api/billing/start-trial?plan={pro|expert}&cycle={monthly|yearly}
   */
  async startTrial(
    plan: ApiPlanIdV2 | string = "pro",
    cycle: BillingCycle = "monthly",
  ): Promise<{
    checkout_url: string;
    session_id: string;
    trial_days: number;
    plan: string;
    cycle: string;
  }> {
    return request(
      `/api/billing/start-trial?plan=${encodeURIComponent(plan)}&cycle=${encodeURIComponent(cycle)}`,
      {
        method: "POST",
      },
    );
  },

  /**
   * @deprecated v0 — utiliser startTrial("pro") à la place.
   * Conservé pour compat clients legacy / tests.
   */
  async startProTrial(): Promise<{
    checkout_url: string;
    session_id: string;
    trial_days: number;
    plan: string;
    cycle: string;
  }> {
    return this.startTrial("pro", "monthly");
  },

  async getPortalUrl(): Promise<{ url: string }> {
    const response = await request<{ portal_url: string }>(
      "/api/billing/portal",
    );
    return { url: response.portal_url };
  },

  async getSubscriptionStatus(): Promise<Subscription | null> {
    return request("/api/billing/subscription-status");
  },

  async changePlan(
    newPlan: string,
  ): Promise<{ success: boolean; prorata?: number }> {
    return request("/api/billing/change-plan", {
      method: "POST",
      body: { new_plan: newPlan },
    });
  },

  async cancelSubscription(): Promise<{ success: boolean }> {
    return request("/api/billing/cancel", {
      method: "POST",
    });
  },

  async getTransactions(): Promise<{
    transactions: Array<{
      id: string;
      amount: number;
      date: string;
      description: string;
    }>;
  }> {
    return request("/api/billing/transactions");
  },

  async reactivateSubscription(): Promise<{ success: boolean }> {
    return request("/api/billing/reactivate", {
      method: "POST",
    });
  },

  async confirmCheckout(
    sessionId: string,
  ): Promise<{ success: boolean; plan: string }> {
    return request("/api/billing/confirm-checkout", {
      method: "POST",
      body: { session_id: sessionId },
    });
  },

  // API Key management (Expert plan)
  async getApiKeyStatus(): Promise<{
    has_key: boolean;
    key_prefix?: string;
    created_at?: string;
    last_used?: string;
    requests_today: number;
    daily_limit: number;
  }> {
    return request("/api/billing/api-key/status");
  },

  async generateApiKey(): Promise<{ api_key: string; message: string }> {
    return request("/api/billing/api-key/generate", {
      method: "POST",
    });
  },

  async regenerateApiKey(): Promise<{ api_key: string; message: string }> {
    return request("/api/billing/api-key/regenerate", {
      method: "POST",
    });
  },

  async revokeApiKey(): Promise<{ success: boolean }> {
    return request("/api/billing/api-key", {
      method: "DELETE",
    });
  },

  async getMyPlan(): Promise<{
    plan: string;
    name: string;
    limits: {
      monthly_analyses: number;
      chat_daily_limit: number;
      chat_questions_per_video: number;
      flashcards_enabled: boolean;
    };
    usage: {
      analyses_this_month: number;
      chat_messages_today: number;
    };
  }> {
    return request("/api/billing/my-plan?platform=mobile");
  },

  async getCreditPacks(): Promise<{
    packs: Array<{
      id: string;
      credits: number;
      price_cents: number;
      name: string;
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
};

// ============================================
// Study Tools API
// ============================================
// Study API Types
export interface StudyQuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

export interface StudyFlashcard {
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
  flashcards: StudyFlashcard[];
  title: string;
}

export interface MindmapResponse {
  success: boolean;
  summary_id: number;
  mermaid_code: string;
  concepts: Array<{ name: string; children?: string[] }>;
  title: string;
}

export const studyApi = {
  /**
   * 🎯 Génère un quiz de compréhension
   * Coût: 1 crédit
   */
  async generateQuiz(summaryId: string): Promise<QuizResponse> {
    return request(`/api/study/quiz/${summaryId}`, {
      method: "POST",
      timeout: 120000,
    });
  },

  /**
   * 📇 Génère des flashcards de révision
   * Coût: 1 crédit
   */
  async generateFlashcards(summaryId: string): Promise<FlashcardsResponse> {
    return request(`/api/study/flashcards/${summaryId}`, {
      method: "POST",
      timeout: 120000,
    });
  },

  /**
   * 🌳 Génère un mindmap (carte conceptuelle)
   * Coût: 1 crédit
   */
  async generateMindmap(summaryId: string): Promise<MindmapResponse> {
    return request(`/api/study/mindmap/${summaryId}`, {
      method: "POST",
      timeout: 120000,
    });
  },

  /**
   * 📚 Génère tous les outils d'étude en une fois
   * Coût: 2 crédits
   */
  async generateAll(summaryId: string): Promise<{
    success: boolean;
    summary_id: number;
    materials: {
      quiz?: StudyQuizQuestion[];
      flashcards?: StudyFlashcard[];
      mindmap?: MindmapResponse;
    };
  }> {
    return request(`/api/study/all/${summaryId}`, {
      method: "POST",
      timeout: 180000,
    });
  },
};

// ============================================
// Usage API
// ============================================
export const usageApi = {
  async getStats(): Promise<{
    credits_used: number;
    credits_remaining: number;
    credits_total: number;
    analyses_count: number;
    chat_messages_count: number;
    exports_count: number;
    reset_date: string;
  }> {
    return request("/api/usage/stats");
  },

  async getDetailedUsage(period?: "day" | "week" | "month"): Promise<{
    by_model: Record<string, number>;
    by_category: Record<string, number>;
    by_date: Array<{ date: string; credits: number }>;
  }> {
    const params = period ? `?period=${period}` : "";
    return request(`/api/usage/detailed${params}`);
  },
};

// ============================================
// Tournesol API
// ============================================
export const tournesolApi = {
  async getVideoScore(videoId: string): Promise<{
    tournesol_score: number | null;
    criteria_scores: Record<string, number>;
    n_comparisons: number;
    n_contributors: number;
    is_rated: boolean;
  }> {
    return request(`/api/tournesol/video/${videoId}`);
  },

  async searchRecommendations(
    query: string,
    limit: number = 10,
  ): Promise<{
    videos: Array<{
      video_id: string;
      title: string;
      channel: string;
      tournesol_score: number;
      thumbnail_url: string;
    }>;
  }> {
    return request("/api/tournesol/search", {
      method: "POST",
      body: { query, limit },
    });
  },

  async getRecommendations(limit: number = 10): Promise<{
    videos: Array<{
      video_id: string;
      title: string;
      channel: string;
      tournesol_score: number;
      thumbnail_url: string;
    }>;
  }> {
    return request(`/api/tournesol/recommendations?limit=${limit}`);
  },
};

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
    });
  },
};

// ============================================
// Push Notifications API
// ============================================
export const notificationsApi = {
  async registerPushToken(
    pushToken: string,
    platform: string,
  ): Promise<{ status: string }> {
    return request("/api/notifications/push-token", {
      method: "POST",
      body: { push_token: pushToken, platform },
    });
  },

  async unregisterPushToken(
    pushToken: string,
    platform: string,
  ): Promise<{ status: string }> {
    return request("/api/notifications/push-token", {
      method: "DELETE",
      body: { push_token: pushToken, platform },
    });
  },
};

export const shareApi = {
  async createShareLink(
    videoId: string,
  ): Promise<{ share_url: string; share_token: string }> {
    return request("/api/share", {
      method: "POST",
      body: { video_id: videoId },
    });
  },
};

// ============================================
// Voice Chat API
// ============================================
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

export const voiceApi = {
  async getQuota(): Promise<{
    plan: string;
    voice_enabled: boolean;
    seconds_used: number;
    seconds_limit: number;
    minutes_remaining: number;
    max_session_minutes: number;
    sessions_this_month: number;
    reset_date: string;
  }> {
    return request("/api/voice/quota");
  },

  /**
   * Crée une session vocale ElevenLabs.
   *
   * Spec #3 — `summary_id` est optionnel pour le mode `companion` (chat libre,
   * sans vidéo de référence). Le backend route alors vers l'agent companion qui
   * utilise systématiquement web_search pour ancrer ses réponses.
   *
   * Surcharge legacy : `createSession(summaryId, language)` est conservée pour
   * la rétro-compat avec les call-sites existants qui n'ont pas encore migré.
   */
  async createSession(
    arg1:
      | number
      | {
          summary_id?: number;
          agent_type?:
            | "explorer"
            | "companion"
            | "debate_moderator"
            | "explorer_streaming";
          language?: string;
          debate_id?: number;
          /** URL YouTube/TikTok pour mode `explorer_streaming` (Quick Voice Call mobile V3). */
          video_url?: string;
        },
    legacyLanguage?: string,
  ): Promise<{
    session_id: string;
    signed_url: string;
    agent_id: string;
    /** LiveKit JWT pour @elevenlabs/react-native (WebRTC). Peut être null si ElevenLabs n'a pas pu le générer — fallback sur agent_id côté client. */
    conversation_token: string | null;
    expires_at: string;
    quota_remaining_minutes: number;
    max_session_minutes: number;
    /** ID du Summary placeholder créé quand `video_url` était fourni (mode explorer_streaming, mobile V3). Null sinon. */
    summary_id?: number | null;
  }> {
    // Rétro-compat : appel positionnel `createSession(42, "fr")`.
    if (typeof arg1 === "number") {
      const body: Record<string, unknown> = {
        summary_id: arg1,
        agent_type: "explorer",
        language: legacyLanguage ?? "fr",
      };
      return request("/api/voice/session", { method: "POST", body });
    }

    // Nouveau format objet.
    const body: Record<string, unknown> = {
      agent_type:
        arg1.agent_type ??
        (arg1.video_url
          ? "explorer_streaming"
          : arg1.summary_id
            ? "explorer"
            : "companion"),
      language: arg1.language ?? "fr",
    };
    if (arg1.summary_id !== undefined && arg1.summary_id !== null) {
      body.summary_id = arg1.summary_id;
    }
    if (arg1.debate_id !== undefined && arg1.debate_id !== null) {
      body.debate_id = arg1.debate_id;
    }
    if (arg1.video_url !== undefined && arg1.video_url !== null) {
      body.video_url = arg1.video_url;
    }
    return request("/api/voice/session", { method: "POST", body });
  },

  /**
   * Persiste un transcript de conversation vocale dans `chat_messages`
   * pour la timeline unifiée chat texte ↔ voix (Spec #1 backend).
   *
   * Best-effort : les call-sites doivent fire-and-forget (catch silencieux)
   * pour ne pas bloquer la conversation en cours si le réseau hoquette.
   */
  async appendTranscript(payload: {
    voice_session_id: string;
    speaker: "user" | "agent";
    content: string;
    time_in_call_secs: number;
  }): Promise<{ ok: boolean }> {
    return request("/api/voice/transcripts/append", {
      method: "POST",
      body: payload,
    });
  },

  async getHistory(summaryId: number): Promise<{
    summary_id: number;
    video_title: string;
    sessions: Array<{
      session_id: string;
      started_at: string;
      ended_at: string | null;
      duration_seconds: number;
      status: string;
      has_transcript: boolean;
    }>;
    total_minutes: number;
  }> {
    return request(`/api/voice/history/${summaryId}`);
  },

  async getTranscript(
    summaryId: number,
    sessionId: string,
  ): Promise<{
    session_id: string;
    summary_id: number;
    started_at: string;
    duration_seconds: number;
    transcript: string;
  }> {
    return request(`/api/voice/history/${summaryId}/${sessionId}/transcript`);
  },

  async getCatalog(): Promise<VoiceCatalog> {
    return request("/api/voice/catalog");
  },

  async getPreferences(): Promise<VoicePreferences> {
    return request("/api/voice/preferences");
  },

  async updatePreferences(
    updates: Partial<VoicePreferences>,
  ): Promise<VoicePreferences> {
    return request("/api/voice/preferences", {
      method: "PUT",
      body: updates,
    });
  },

  async createAddonCheckout(packId: string): Promise<{ checkout_url: string }> {
    return request("/api/voice/addon/checkout", {
      method: "POST",
      body: { pack_id: packId },
    });
  },

  async getAddonPacks(): Promise<{
    packs: Array<{
      id: string;
      name: string;
      minutes: number;
      price_cents: number;
      description?: string;
    }>;
  }> {
    return request("/api/voice/addon/packs");
  },
};

// ============================================
// Exports API
// ============================================
export const exportsApi = {
  async pdf(summaryId: number): Promise<Blob> {
    const token = await tokenStorage.getAccessToken();
    const response = await fetch(
      `${API_BASE_URL}/api/exports/${summaryId}/pdf`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
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

// ============================================
// Trending API (public)
// ============================================
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
    return request(`/api/trending?${params}`, { requiresAuth: false });
  },
};

// ============================================
// Search API V1 — Semantic Search (auth required)
// ============================================

export type SearchSourceType =
  | "summary"
  | "flashcard"
  | "quiz"
  | "chat"
  | "transcript";

export interface GlobalSearchRequest {
  query: string;
  limit?: number;
  source_types?: SearchSourceType[];
  platform?: "youtube" | "tiktok" | "text";
  lang?: string;
  category?: string;
  date_from?: string; // ISO 8601
  date_to?: string;
  favorites_only?: boolean;
  playlist_id?: string;
}

export interface GlobalSearchResultItem {
  source_type: SearchSourceType;
  source_id: number;
  summary_id: number | null;
  score: number;
  text_preview: string;
  source_metadata: {
    summary_title?: string;
    summary_thumbnail?: string;
    video_id?: string;
    channel?: string;
    tab?:
      | "synthesis"
      | "digest"
      | "flashcards"
      | "quiz"
      | "chat"
      | "transcript";
    start_ts?: number;
    end_ts?: number;
    anchor?: string;
    flashcard_id?: number;
    quiz_question_id?: number;
  };
}

export interface GlobalSearchResponse {
  query: string;
  total_results: number;
  results: GlobalSearchResultItem[];
  searched_at: string;
}

export interface WithinSearchRequest {
  query: string;
  source_types?: SearchSourceType[];
}

export interface WithinMatchItem {
  source_type: SearchSourceType;
  source_id: number;
  summary_id: number;
  text: string;
  text_html: string;
  tab: "synthesis" | "digest" | "flashcards" | "quiz" | "chat" | "transcript";
  score: number;
  passage_id: string;
  metadata: Record<string, unknown>;
}

export interface WithinSearchResponse {
  summary_id: number;
  query: string;
  matches: WithinMatchItem[];
}

export interface RecentQueriesResponse {
  queries: string[];
}

// LEGACY (existant — gardé pour compat)
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
  // ───── V1 (Phase 1 backend mergée) ─────
  async globalSearch(req: GlobalSearchRequest): Promise<GlobalSearchResponse> {
    return request("/api/search/global", {
      method: "POST",
      body: req as unknown as Record<string, unknown>,
    });
  },

  async withinSearch(
    summaryId: number,
    req: WithinSearchRequest,
  ): Promise<WithinSearchResponse> {
    return request(`/api/search/within/${summaryId}`, {
      method: "POST",
      body: req as unknown as Record<string, unknown>,
    });
  },

  async getRecentQueries(): Promise<RecentQueriesResponse> {
    return request("/api/search/recent-queries");
  },

  async clearRecentQueries(): Promise<void> {
    await request("/api/search/recent-queries", { method: "DELETE" });
  },

  // ───── Legacy (gardé pour compat) ─────
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

// ============================================
// Reliability API
// ============================================
export interface ReliabilityFactor {
  name: string;
  score: number;
  description: string;
  weight: number;
}

export interface ReliabilityResult {
  score: number;
  level: "high" | "medium" | "low" | "unknown";
  factors: ReliabilityFactor[];
  summary?: string;
  freshness?: unknown;
  fact_check_lite?: unknown;
  analysis_type?: string;
  user_plan?: string;
  full_factcheck_available?: boolean;
}

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

// ============================================
// 🎓 TUTOR API — Le Tuteur conversationnel (sessions Redis TTL 1h)
// V2 mobile lite : text-only, pas de voice (pas de Voxtral/ElevenLabs côté mobile)
// ============================================
import type {
  SessionStartRequest as TutorSessionStartRequest,
  SessionStartResponse as TutorSessionStartResponse,
  SessionTurnRequest as TutorSessionTurnRequest,
  SessionTurnResponse as TutorSessionTurnResponse,
  SessionEndResponse as TutorSessionEndResponse,
} from "../types/tutor";

export const tutorApi = {
  /**
   * Démarre une session Tutor : crée la session Redis + génère le 1er prompt Magistral.
   * Endpoint: POST /api/tutor/session/start
   */
  async sessionStart(
    payload: TutorSessionStartRequest,
  ): Promise<TutorSessionStartResponse> {
    return request<TutorSessionStartResponse>("/api/tutor/session/start", {
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
      timeout: 60000,
    });
  },

  /**
   * Un tour de conversation : user input → IA response.
   * Endpoint: POST /api/tutor/session/{session_id}/turn
   */
  async sessionTurn(
    sessionId: string,
    payload: TutorSessionTurnRequest,
  ): Promise<TutorSessionTurnResponse> {
    return request<TutorSessionTurnResponse>(
      `/api/tutor/session/${sessionId}/turn`,
      {
        method: "POST",
        body: payload as unknown as Record<string, unknown>,
        timeout: 60000,
      },
    );
  },

  /**
   * Termine une session : durée, log analytics, supprime Redis.
   * Endpoint: POST /api/tutor/session/{session_id}/end
   */
  async sessionEnd(sessionId: string): Promise<TutorSessionEndResponse> {
    return request<TutorSessionEndResponse>(
      `/api/tutor/session/${sessionId}/end`,
      {
        method: "POST",
        body: {},
      },
    );
  },
};

export default {
  authApi,
  userApi,
  videoApi,
  historyApi,
  chatApi,
  billingApi,
  studyApi,
  usageApi,
  tournesolApi,
  contactApi,
  notificationsApi,
  shareApi,
  voiceApi,
  exportsApi,
  trendingApi,
  searchApi,
  reliabilityApi,
  tutorApi,
  ApiError,
};
