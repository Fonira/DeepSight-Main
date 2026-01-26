import { API_BASE_URL, TIMEOUTS } from '../constants/config';
import { tokenStorage } from '../utils/storage';
import type {
  User,
  AnalysisSummary,
  AnalysisRequest,
  AnalysisStatus,
  VideoInfo,
  ChatMessage,
  Playlist,
  QuotaInfo,
  BillingPlan,
  Subscription,
  ApiResponse,
  PaginatedResponse,
  HistoryFilters,
} from '../types';

// Request configuration
interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  requiresAuth?: boolean;
}

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public detail?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  // Helper to check if this is an email verification required error
  get isEmailNotVerified(): boolean {
    return this.status === 403 && (
      this.code === 'EMAIL_NOT_VERIFIED' ||
      this.detail === 'EMAIL_NOT_VERIFIED'
    );
  }
}

// Token refresh lock
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// Refresh token function
const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      await tokenStorage.clearTokens();
      return null;
    }

    const data = await response.json();
    await tokenStorage.setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    await tokenStorage.clearTokens();
    return null;
  }
};

// Base request function with retry and token refresh
const request = async <T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> => {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = TIMEOUTS.DEFAULT,
    requiresAuth = true,
  } = config;

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add auth token if required
  if (requiresAuth) {
    const accessToken = await tokenStorage.getAccessToken();
    if (accessToken) {
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  // Build request options
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
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
    if (response.status === 401 && requiresAuth) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          onTokenRefreshed(newToken);
          // Retry the original request with new token
          requestHeaders['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...requestOptions,
            headers: requestHeaders,
          });

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            throw new ApiError(
              errorData.message || 'Request failed',
              retryResponse.status,
              errorData.code
            );
          }

          return await retryResponse.json();
        } else {
          throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');
        }
      } else {
        // Wait for token refresh
        return new Promise((resolve, reject) => {
          addRefreshSubscriber(async (token) => {
            try {
              requestHeaders['Authorization'] = `Bearer ${token}`;
              const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...requestOptions,
                headers: requestHeaders,
              });
              resolve(await retryResponse.json());
            } catch (error) {
              reject(error);
            }
          });
        });
      }
    }

    // Handle other errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.message || errorData.detail || errorData.error || 'Request failed',
        response.status,
        errorData.code || errorData.detail,
        errorData.detail
      );
    }

    // Parse response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    return {} as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408, 'TIMEOUT');
      }
      throw new ApiError(error.message, 0, 'NETWORK_ERROR');
    }

    throw new ApiError('Unknown error', 0, 'UNKNOWN');
  }
};

// ============================================
// Authentication API
// ============================================
export const authApi = {
  async register(username: string, email: string, password: string): Promise<{ message: string }> {
    return request('/api/auth/register', {
      method: 'POST',
      body: { username, email, password },
      requiresAuth: false,
    });
  },

  async login(email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const response = await request<{ access_token: string; refresh_token: string; user: User }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: { email, password },
        requiresAuth: false,
      }
    );
    await tokenStorage.setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async verifyEmail(email: string, code: string): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const response = await request<{ access_token: string; refresh_token: string; user: User }>(
      '/api/auth/verify-email',
      {
        method: 'POST',
        body: { email, code },
        requiresAuth: false,
      }
    );
    await tokenStorage.setTokens(response.access_token, response.refresh_token);
    return response;
  },

  // Google OAuth: exchange Google access token for session tokens
  async googleTokenLogin(googleAccessToken: string): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const response = await request<{ access_token: string; refresh_token: string; user: User }>(
      '/api/auth/google/token',
      {
        method: 'POST',
        body: { access_token: googleAccessToken },
        requiresAuth: false,
      }
    );
    await tokenStorage.setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async getMe(): Promise<User> {
    return request('/api/auth/me');
  },

  async getQuota(): Promise<QuotaInfo> {
    return request('/api/auth/quota');
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      await tokenStorage.clearTokens();
    }
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
      requiresAuth: false,
    });
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password },
      requiresAuth: false,
    });
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    return request('/api/auth/resend-verification', {
      method: 'POST',
      body: { email },
      requiresAuth: false,
    });
  },

  async deleteAccount(password?: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/account', {
      method: 'DELETE',
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
    return request('/api/auth/profile', {
      method: 'PUT',
      body: profile,
    });
  },

  async updatePreferences(preferences: {
    default_lang?: string;
    default_mode?: string;
    default_model?: string;
  }): Promise<User> {
    return request('/api/auth/preferences', {
      method: 'PUT',
      body: preferences,
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request('/api/auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
    });
  },
};

// ============================================
// Video Analysis API
// ============================================
export const videoApi = {
  async analyze(data: AnalysisRequest): Promise<{ task_id: string }> {
    return request('/api/videos/analyze/hybrid', {
      method: 'POST',
      body: data,
      timeout: TIMEOUTS.ANALYSIS,
    });
  },

  async getStatus(taskId: string): Promise<AnalysisStatus> {
    return request(`/api/videos/status/${taskId}`);
  },

  async getSummary(summaryId: string): Promise<AnalysisSummary> {
    return request(`/api/videos/summary/${summaryId}`);
  },

  async getConcepts(summaryId: string): Promise<{ concepts: string[] }> {
    return request(`/api/videos/concepts/${summaryId}`);
  },

  async getEnrichedConcepts(summaryId: string): Promise<{ concepts: Array<{ name: string; definition: string }> }> {
    return request(`/api/videos/concepts/${summaryId}/enriched`);
  },

  async discover(query: string, limit: number = 10): Promise<{ videos: VideoInfo[] }> {
    return request('/api/videos/discover', {
      method: 'POST',
      body: { query, limit },
    });
  },

  async factCheck(summaryId: string): Promise<{ result: string }> {
    return request(`/api/videos/summary/${summaryId}/fact-check`, {
      method: 'POST',
      timeout: TIMEOUTS.FACT_CHECK,
    });
  },

  async webEnrich(summaryId: string): Promise<{ result: string }> {
    return request(`/api/videos/summary/${summaryId}/web-enrich`, {
      method: 'POST',
      timeout: TIMEOUTS.FACT_CHECK,
    });
  },

  async getTranscript(videoId: string): Promise<{ transcript: string; segments: Array<{ start: number; text: string }> }> {
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
    return request('/api/videos/reliability/analyze', {
      method: 'POST',
      body: { summary_id: summaryId },
      timeout: TIMEOUTS.FACT_CHECK,
    });
  },

  // Freshness indicator
  async getFreshness(summaryId: string): Promise<{
    publication_date: string;
    days_since_published: number;
    freshness_level: 'fresh' | 'recent' | 'dated' | 'outdated';
    freshness_score: number;
  }> {
    return request(`/api/videos/freshness/${summaryId}`);
  },

  // Notes and tags
  async updateNotes(summaryId: string, notes: string): Promise<{ success: boolean }> {
    return request(`/api/videos/summary/${summaryId}/notes`, {
      method: 'PUT',
      body: { notes },
    });
  },

  async updateTags(summaryId: string, tags: string[]): Promise<{ success: boolean }> {
    return request(`/api/videos/summary/${summaryId}/tags`, {
      method: 'PUT',
      body: { tags },
    });
  },

  // Video discovery - best results
  async discoverBest(query: string, options?: {
    limit?: number;
    language?: string;
    sort_by?: 'quality' | 'views' | 'date' | 'academic';
  }): Promise<{
    videos: Array<VideoInfo & { quality_score: number; academic_relevance: number }>;
  }> {
    return request('/api/videos/discover/best', {
      method: 'POST',
      body: { query, ...options },
    });
  },

  // Categories
  async getCategories(): Promise<{ categories: Array<{ id: string; name: string; icon: string }> }> {
    return request('/api/videos/categories');
  },

  // Credit estimation
  async estimateCredits(params: {
    video_url?: string;
    mode?: string;
    include_study_tools?: boolean;
  }): Promise<{ credits: number; breakdown: Record<string, number> }> {
    return request('/api/videos/estimate-credits', {
      method: 'POST',
      body: params,
    });
  },

  // Delete summary
  async deleteSummary(summaryId: string): Promise<{ success: boolean }> {
    return request(`/api/videos/summary/${summaryId}`, {
      method: 'DELETE',
    });
  },

  // User stats
  async getStats(): Promise<{
    total_videos: number;
    total_words: number;
    total_minutes_saved: number;
    favorite_category: string;
  }> {
    return request('/api/videos/stats');
  },
};

// ============================================
// History API
// ============================================
export const historyApi = {
  async getHistory(
    page: number = 1,
    limit: number = 20,
    filters?: HistoryFilters
  ): Promise<PaginatedResponse<AnalysisSummary>> {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(limit),
    });

    if (filters?.search) params.append('search', filters.search);
    if (filters?.category) params.append('category', filters.category);

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
        created_at?: string;
      }>;
      total: number;
      page: number;
      per_page: number;
      pages: number;
    }>(`/api/history/videos?${params.toString()}`);

    // Transform backend response to mobile format
    const items: AnalysisSummary[] = response.items.map((item) => ({
      id: String(item.id),
      title: item.video_title || 'Sans titre',
      videoId: item.video_id,
      thumbnail: item.thumbnail_url,
      isFavorite: item.is_favorite,
      mode: item.mode || 'synthesis',
      category: item.category || 'general',
      channel: item.video_channel,
      duration: item.video_duration,
      createdAt: item.created_at,
    }));

    return {
      items,
      hasMore: response.page < response.pages,
      page: response.page,
    };
  },

  async toggleFavorite(summaryId: string): Promise<{ isFavorite: boolean }> {
    return request(`/api/history/videos/${summaryId}/favorite`, {
      method: 'POST',
    });
  },

  async deleteSummary(summaryId: string): Promise<void> {
    return request(`/api/history/videos/${summaryId}`, {
      method: 'DELETE',
    });
  },

  async getStats(): Promise<{ totalVideos: number; totalPlaylists: number; totalMinutes: number }> {
    const response = await request<{
      total_videos: number;
      total_playlists: number;
      total_minutes_watched: number;
    }>('/api/history/stats');

    return {
      totalVideos: response.total_videos,
      totalPlaylists: response.total_playlists,
      totalMinutes: response.total_minutes_watched,
    };
  },

  // Playlist history
  async getPlaylistHistory(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<{
    id: string;
    name: string;
    video_count: number;
    created_at: string;
    thumbnail_urls: string[];
  }>> {
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
      hasMore: response.page < response.pages,
      page: response.page,
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
      title: item.video_title || 'Sans titre',
      videoId: item.video_id,
      thumbnail: item.thumbnail_url,
      isFavorite: item.is_favorite,
      mode: item.mode || 'synthesis',
      category: item.category || 'general',
      createdAt: item.created_at,
    }));
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
    }>('/api/history/search/semantic', {
      method: 'POST',
      body: { query },
    });

    return response.results.map((item) => ({
      id: String(item.id),
      title: item.video_title || 'Sans titre',
      videoId: item.video_id,
      thumbnail: item.thumbnail_url,
      isFavorite: item.is_favorite,
      mode: item.mode || 'synthesis',
      category: item.category || 'general',
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
    options?: { useWebSearch?: boolean; mode?: string }
  ): Promise<{
    response: string;
    sources?: Array<{ url: string; title: string }>;
    web_search_used?: boolean;
  }> {
    return request('/api/chat/ask', {
      method: 'POST',
      body: {
        summary_id: summaryId,
        question: message,
        use_web_search: options?.useWebSearch ?? false,
        mode: options?.mode,
      },
    });
  },

  async getHistory(summaryId: string): Promise<{ messages: ChatMessage[] }> {
    const response = await request<{ messages: ChatMessage[]; quota_info?: Record<string, unknown> }>(
      `/api/chat/history/${summaryId}`
    );
    return { messages: response.messages || [] };
  },

  async getQuota(summaryId: string): Promise<{ used: number; limit: number; remaining: number }> {
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

  async clearHistory(summaryId: string): Promise<{ success: boolean }> {
    return request(`/api/chat/history/${summaryId}`, { method: 'DELETE' });
  },
};

// ============================================
// Playlist API
// ============================================
export const playlistApi = {
  async getPlaylists(): Promise<{ playlists: Playlist[] }> {
    return request('/api/playlists');
  },

  async createPlaylist(name: string, description?: string): Promise<Playlist> {
    return request('/api/playlists', {
      method: 'POST',
      body: { name, description },
    });
  },

  async getPlaylist(id: string): Promise<Playlist & { videos: Array<{ video_id: string; title: string; thumbnail_url: string }> }> {
    return request(`/api/playlists/${id}`);
  },

  async updatePlaylist(id: string, name: string, description?: string): Promise<Playlist> {
    return request(`/api/playlists/${id}`, {
      method: 'PUT',
      body: { name, description },
    });
  },

  async deletePlaylist(id: string): Promise<void> {
    return request(`/api/playlists/${id}`, {
      method: 'DELETE',
    });
  },

  async analyzePlaylist(playlistUrl: string, options: AnalysisRequest): Promise<{ task_id: string }> {
    return request('/api/playlists/analyze', {
      method: 'POST',
      body: { playlist_url: playlistUrl, ...options },
      timeout: TIMEOUTS.PLAYLIST,
    });
  },

  async analyzeCorpus(urls: string[], options: AnalysisRequest): Promise<{ task_id: string }> {
    return request('/api/playlists/analyze-corpus', {
      method: 'POST',
      body: { urls, ...options },
      timeout: TIMEOUTS.PLAYLIST,
    });
  },

  async getTaskStatus(taskId: string): Promise<{ status: string; progress: number; videos_completed: number; total_videos: number }> {
    return request(`/api/playlists/task/${taskId}`);
  },
};

// ============================================
// Billing API
// ============================================
export const billingApi = {
  async getPlans(): Promise<{ plans: BillingPlan[] }> {
    return request('/api/billing/plans', { requiresAuth: false });
  },

  async createCheckout(planId: string): Promise<{ url: string }> {
    return request('/api/billing/create-checkout', {
      method: 'POST',
      body: { plan_id: planId },
    });
  },

  async getTrialEligibility(): Promise<{ eligible: boolean; reason?: string }> {
    return request('/api/billing/trial-eligibility');
  },

  async startProTrial(): Promise<{ success: boolean }> {
    return request('/api/billing/start-pro-trial', {
      method: 'POST',
    });
  },

  async getPortalUrl(): Promise<{ url: string }> {
    return request('/api/billing/portal');
  },

  async getSubscriptionStatus(): Promise<Subscription | null> {
    return request('/api/billing/subscription-status');
  },

  async changePlan(newPlan: string): Promise<{ success: boolean; prorata?: number }> {
    return request('/api/billing/change-plan', {
      method: 'POST',
      body: { new_plan: newPlan },
    });
  },

  async cancelSubscription(): Promise<{ success: boolean }> {
    return request('/api/billing/cancel', {
      method: 'POST',
    });
  },

  async getTransactions(): Promise<{ transactions: Array<{ id: string; amount: number; date: string; description: string }> }> {
    return request('/api/billing/transactions');
  },

  async reactivateSubscription(): Promise<{ success: boolean }> {
    return request('/api/billing/reactivate', {
      method: 'POST',
    });
  },

  async confirmCheckout(sessionId: string): Promise<{ success: boolean; plan: string }> {
    return request('/api/billing/confirm-checkout', {
      method: 'POST',
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
    return request('/api/billing/api-key/status');
  },

  async generateApiKey(): Promise<{ api_key: string; message: string }> {
    return request('/api/billing/api-key/generate', {
      method: 'POST',
    });
  },

  async regenerateApiKey(): Promise<{ api_key: string; message: string }> {
    return request('/api/billing/api-key/regenerate', {
      method: 'POST',
    });
  },

  async revokeApiKey(): Promise<{ success: boolean }> {
    return request('/api/billing/api-key', {
      method: 'DELETE',
    });
  },
};

// ============================================
// Study Tools API
// ============================================
export const studyApi = {
  async generateQuiz(summaryId: string, questionCount: number = 5): Promise<{ quiz: Array<{ question: string; options: string[]; correct: number; explanation: string }> }> {
    return request(`/api/study/quiz/${summaryId}`, {
      method: 'POST',
      body: { question_count: questionCount },
    });
  },

  async generateMindmap(summaryId: string): Promise<{ mindmap: string }> {
    return request(`/api/study/mindmap/${summaryId}`, {
      method: 'POST',
    });
  },

  async generateFlashcards(summaryId: string): Promise<{ flashcards: Array<{ front: string; back: string }> }> {
    return request(`/api/study/flashcards/${summaryId}`, {
      method: 'POST',
    });
  },
};

// ============================================
// Export API
// ============================================
export const exportApi = {
  async exportSummary(summaryId: string, format: 'pdf' | 'markdown' | 'text'): Promise<Blob> {
    const makeRequest = async (token: string | null): Promise<Response> => {
      return fetch(`${API_BASE_URL}/api/exports/${format}/${summaryId}`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
    };

    let accessToken = await tokenStorage.getAccessToken();
    let response = await makeRequest(accessToken);

    // Handle 401 - try to refresh token and retry
    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await makeRequest(newToken);
      } else {
        throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');
      }
    }

    if (!response.ok) {
      throw new ApiError('Export failed', response.status);
    }

    return await response.blob();
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
    return request('/api/usage/stats');
  },

  async getDetailedUsage(period?: 'day' | 'week' | 'month'): Promise<{
    by_model: Record<string, number>;
    by_category: Record<string, number>;
    by_date: Array<{ date: string; credits: number }>;
  }> {
    const params = period ? `?period=${period}` : '';
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

  async searchRecommendations(query: string, limit: number = 10): Promise<{
    videos: Array<{
      video_id: string;
      title: string;
      channel: string;
      tournesol_score: number;
      thumbnail_url: string;
    }>;
  }> {
    return request('/api/tournesol/search', {
      method: 'POST',
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


export default {
  authApi,
  userApi,
  videoApi,
  historyApi,
  chatApi,
  playlistApi,
  billingApi,
  studyApi,
  exportApi,
  usageApi,
  tournesolApi,
  ApiError,
};
