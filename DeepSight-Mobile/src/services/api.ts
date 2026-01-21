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
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
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
        errorData.message || errorData.error || 'Request failed',
        response.status,
        errorData.code
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

  async googleLogin(redirectUri?: string): Promise<{ url: string }> {
    return request('/api/auth/google/login', {
      method: 'POST',
      body: redirectUri ? { redirect_uri: redirectUri, platform: 'mobile' } : undefined,
      requiresAuth: false,
    });
  },

  async googleCallback(code: string): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const response = await request<{ access_token: string; refresh_token: string; user: User }>(
      '/api/auth/google/callback',
      {
        method: 'POST',
        body: { code },
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
      limit: String(limit),
    });

    if (filters?.search) params.append('search', filters.search);
    if (filters?.mode) params.append('mode', filters.mode);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.favoritesOnly) params.append('favorites', 'true');

    return request(`/api/history?${params.toString()}`);
  },

  async toggleFavorite(summaryId: string): Promise<{ isFavorite: boolean }> {
    return request(`/api/history/${summaryId}/favorite`, {
      method: 'POST',
    });
  },

  async deleteSummary(summaryId: string): Promise<void> {
    return request(`/api/history/${summaryId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// Chat API
// ============================================
export const chatApi = {
  async sendMessage(summaryId: string, message: string): Promise<{ response: string }> {
    return request('/api/chat/ask', {
      method: 'POST',
      body: { summary_id: summaryId, question: message },
    });
  },

  async getHistory(summaryId: string): Promise<{ messages: ChatMessage[] }> {
    return request(`/api/chat/history/${summaryId}`);
  },

  async getQuota(): Promise<{ used: number; limit: number }> {
    return request('/api/chat/quota');
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

  async changePlan(newPlanId: string): Promise<{ success: boolean; prorata?: number }> {
    return request('/api/billing/change-plan', {
      method: 'POST',
      body: { plan_id: newPlanId },
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
// TTS API
// ============================================
export const ttsApi = {
  async generateAudio(text: string, voice: string = 'alloy'): Promise<{ audio_url: string }> {
    return request('/api/tts/generate', {
      method: 'POST',
      body: { text, voice },
    });
  },

  async getVoices(): Promise<{ voices: Array<{ id: string; name: string; preview_url: string }> }> {
    return request('/api/tts/voices');
  },
};

export default {
  authApi,
  videoApi,
  historyApi,
  chatApi,
  playlistApi,
  billingApi,
  studyApi,
  exportApi,
  ttsApi,
  ApiError,
};
