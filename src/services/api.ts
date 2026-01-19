/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🌐 DEEP SIGHT API SERVICE v7.1 — Client HTTP Complet                              ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  EXPORTS: authApi, videoApi, chatApi, reliabilityApi, billingApi, playlistApi      ║
 * ║  + Tous les types nécessaires                                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const API_URL = import.meta.env.VITE_API_URL || 'https://backend-search-v2-production.up.railway.app';

const TOKEN_KEYS = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface User {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  plan: 'free' | 'starter' | 'pro' | 'expert';
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

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user?: User;
}

export interface Summary {
  id: number;
  video_id: string;
  title: string;
  channel: string;
  channel_id?: string;
  duration?: number;
  thumbnail_url?: string;
  summary: string;
  summary_html?: string;
  analysis_type: string;
  language: string;
  created_at: string;
  updated_at?: string;
  tags?: string[];
  keywords?: string[];
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
  provider: 'mistral' | 'perplexity' | 'combined' | 'none';
}

export interface EnrichedConceptsResponse {
  summary_id: number;
  video_title: string;
  concepts: EnrichedConcept[];
  count: number;
  provider: string;
  categories: Record<string, {
    label: string;
    icon: string;
    count: number;
  }>;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  result?: {
    summary_id?: number;
    summary?: Summary;
  };
  error?: string;
}

export interface PlaylistTaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Progression (les deux noms pour compatibilité backend)
  progress?: number;
  progress_percent?: number;  // 🆕 Alias envoyé par backend corrigé
  
  // Compteurs
  current_video?: number;
  completed_videos?: number;  // 🆕 Nombre de vidéos terminées
  total_videos?: number;
  
  // Messages
  message?: string;
  current_step?: string;  // 🆕 Étape actuelle (fetching, transcript, summary, etc.)
  
  // Métadonnées
  playlist_id?: string;    // 🆕 ID de la playlist
  playlist_title?: string; // 🆕 Titre de la playlist
  
  // Estimation temps
  estimated_time_remaining?: string;  // 🆕 Ex: "~5 min"
  
  // Résultats
  results?: Summary[];
  corpus_summary?: string;
  result?: {
    playlist_id?: string;
    num_videos?: number;
    total_duration?: number;
    total_words?: number;
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
  role: 'user' | 'assistant';
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
  published_at?: string;  // 🆕 Format ISO
  description?: string;
  tournesol_score?: number;
  quality_score?: number;
  academic_score?: number;
  freshness_score?: number;
  engagement_score?: number;
  clickbait_penalty?: number;  // 🆕 Pénalité clickbait
  language?: string;  // 🆕 Langue détectée de la vidéo
  is_tournesol_pick?: boolean;  // 🆕 Flag Tournesol
  matched_query_terms?: string[];  // 🆕 Termes de recherche trouvés
  detected_sources?: number;  // 🆕 Nombre de sources détectées
  content_type?: string;  // 🆕 Type de contenu
}

export interface ReliabilityResult {
  score: number;
  level: 'high' | 'medium' | 'low' | 'unknown';
  factors: ReliabilityFactor[];
  summary?: string;
}

export interface ReliabilityFactor {
  name: string;
  score: number;
  description: string;
  weight: number;
}

export interface FactCheckResult {
  claim: string;
  verdict: 'verified' | 'disputed' | 'unverified' | 'mixed';
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
  return localStorage.getItem(TOKEN_KEYS.ACCESS);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.REFRESH);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEYS.ACCESS, accessToken);
  if (refreshToken) {
    localStorage.setItem(TOKEN_KEYS.REFRESH, refreshToken);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEYS.ACCESS);
  localStorage.removeItem(TOKEN_KEYS.REFRESH);
  localStorage.removeItem('cached_user');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ❌ ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

export class ApiError extends Error {
  status: number;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 HTTP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: Record<string, unknown> | FormData;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  timeout?: number;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    skipAuth = false,
    timeout = 30000,
  } = options;

  const url = `${API_URL}${endpoint}`;
  
  const requestHeaders: Record<string, string> = { ...headers };

  if (body && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: Record<string, unknown> = {};
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        errorData = await response.json();
        errorMessage = (errorData.detail as string) || (errorData.message as string) || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }

      // 401 = token expiré
      if (response.status === 401 && !skipAuth) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // Retry avec nouveau token
          return request(endpoint, options);
        }
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }

      throw new ApiError(errorMessage, response.status, errorData);
    }

    if (response.status === 204) {
      return {} as T;
    }

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
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408);
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  async register(username: string, email: string, password: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/register', {
      method: 'POST',
      body: { username, email, password },
      skipAuth: true,
    });
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const response = await request<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
    setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async verifyEmail(email: string, code: string): Promise<TokenResponse> {
    const response = await request<TokenResponse>('/api/auth/verify-email', {
      method: 'POST',
      body: { email, code },
      skipAuth: true,
    });
    setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/resend-verification', {
      method: 'POST',
      body: { email },
      skipAuth: true,
    });
  },

  async getGoogleAuthUrl(): Promise<{ auth_url: string }> {
    return request('/api/auth/google/login', { skipAuth: true });
  },

  /**
   * Redirige vers Google OAuth
   * Utilisé par useAuth.loginWithGoogle()
   */
  async loginWithGoogle(): Promise<void> {
    const { auth_url } = await request<{ auth_url: string }>('/api/auth/google/login', { skipAuth: true });
    window.location.href = auth_url;
  },

  async googleCallback(code: string, state?: string): Promise<TokenResponse> {
    const response = await request<TokenResponse>('/api/auth/google/callback', {
      method: 'POST',
      body: { code, state },
      skipAuth: true,
    });
    setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async me(options?: { skipCache?: boolean }): Promise<User> {
    return request('/api/auth/me');
  },

  async quota(): Promise<{ credits: number; credits_monthly: number; credits_used: number; plan: string }> {
    return request('/api/auth/quota');
  },

  async refresh(refreshToken: string): Promise<TokenResponse> {
    return request('/api/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      skipAuth: true,
    });
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
      skipAuth: true,
    });
  },

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: { email, code, new_password: newPassword },
      skipAuth: true,
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
    });
  },

  async updatePreferences(prefs: { default_lang?: string; default_mode?: string; default_model?: string }): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/preferences', {
      method: 'PUT',
      body: prefs,
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📹 VIDEO API
// ═══════════════════════════════════════════════════════════════════════════════

export const videoApi = {
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
    lang?: string
  ): Promise<{ task_id: string; status: string; result?: { summary_id: number } }> {
    return request('/api/videos/analyze', {
      method: 'POST',
      body: { 
        url, 
        category: category || 'auto',
        mode: mode || 'standard',
        model: model || 'mistral-small-latest',
        deep_research: deepResearch || false,
        lang: lang || 'fr'  // 🌐 Langue du résumé
      },
      timeout: 300000,
    });
  },

  /**
   * 🔀 Analyse hybride unifiée
   * Supporte: URL YouTube, texte brut, ou recherche intelligente
   */
  async analyzeHybrid(params: {
    // Type d'entrée
    inputType?: 'url' | 'raw_text' | 'search';
    // Pour URL mode
    url?: string;
    // Pour RAW_TEXT mode
    rawText?: string;
    textTitle?: string;
    textSource?: string;
    // Pour SEARCH mode
    searchQuery?: string;
    // Options communes
    mode?: string;
    category?: string;
    lang?: string;
    model?: string;
    deepResearch?: boolean;
  }): Promise<{ task_id: string; status: string }> {
    // Convertir camelCase → snake_case pour le backend Python
    const body: Record<string, unknown> = {};
    
    if (params.inputType) body.input_type = params.inputType;
    if (params.url) body.url = params.url;
    if (params.rawText) body.raw_text = params.rawText;
    if (params.textTitle) body.text_title = params.textTitle;
    if (params.textSource) body.text_source = params.textSource;
    if (params.searchQuery) body.search_query = params.searchQuery;
    if (params.mode) body.mode = params.mode;
    if (params.category) body.category = params.category;
    if (params.lang) body.lang = params.lang;
    if (params.model) body.model = params.model;
    if (params.deepResearch !== undefined) body.deep_research = params.deepResearch;
    
    return request('/api/videos/analyze/hybrid', {
      method: 'POST',
      body,
      timeout: 300000,
    });
  },

  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    return request(`/api/videos/status/${taskId}`);
  },

  async getSummary(summaryId: number): Promise<Summary> {
    return request(`/api/videos/summary/${summaryId}`);
  },

  async getConcepts(summaryId: number): Promise<{ concepts: Concept[]; count: number }> {
    return request(`/api/videos/concepts/${summaryId}`);
  },

  /**
   * 📚 Récupère les concepts avec définitions enrichies (Mistral + Perplexity)
   * Pro/Expert: Définitions Perplexity avec sources web
   * Starter: Définitions Mistral uniquement
   */
  async getEnrichedConcepts(summaryId: number): Promise<EnrichedConceptsResponse> {
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
      targetDuration?: 'short' | 'medium' | 'long' | 'default';
    }
  ): Promise<DiscoveryResponse> {
    return request('/api/videos/discover', {
      method: 'POST',
      body: {
        query,
        max_results: options?.limit || 30,  // 🆕 Augmenté de 20 à 30
        languages: options?.languages || ['fr', 'en'],
        min_quality: options?.minQuality || 25,  // 🆕 Réduit pour plus de résultats
        target_duration: options?.targetDuration || 'default',
      },
      timeout: 120000,  // 🆕 Augmenté de 30s à 120s pour recherches parallèles
    });
  },

  async factCheck(summaryId: number): Promise<FactCheckResult[]> {
    return request(`/api/videos/summary/${summaryId}/fact-check`, {
      method: 'POST',
      timeout: 120000,
    });
  },

  async webEnrich(summaryId: number): Promise<{ enriched: boolean; data?: unknown }> {
    return request(`/api/videos/summary/${summaryId}/web-enrich`, {
      method: 'POST',
      timeout: 60000,
    });
  },

  async getTranscript(videoId: string): Promise<{ transcript: string; segments?: TranscriptSegment[] }> {
    return request(`/api/videos/transcript/${videoId}`);
  },

  async exportSummary(summaryId: number, format: 'pdf' | 'markdown' | 'text'): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/exports/${format}/${summaryId}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!response.ok) throw new ApiError('Export failed', response.status);
    return response.blob();
  },

  async getHistory(params?: { page?: number; limit?: number; search?: string }): Promise<HistoryResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.search) queryParams.set('search', params.search);
    const query = queryParams.toString();
    return request(`/api/history${query ? `?${query}` : ''}`);
  },

  async deleteSummary(summaryId: number): Promise<{ success: boolean }> {
    return request(`/api/history/${summaryId}`, { method: 'DELETE' });
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
    useWebSearch: boolean = false
  ): Promise<{ response: string; web_search_used: boolean; sources: Array<{ title: string; url: string }> }> {
    return request('/api/chat/ask', {
      method: 'POST',
      body: {
        summary_id: summaryId,
        question: message,  // Backend attend "question" pas "message"
        use_web_search: useWebSearch,
        mode: 'standard',
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
    const response = await request<{ messages: ChatMessage[]; quota_info: Record<string, unknown> }>(
      `/api/chat/history/${summaryId}`
    );
    // Extraire et normaliser les messages
    if (response && response.messages && Array.isArray(response.messages)) {
      return response.messages.map(msg => ({
        ...msg,
        // S'assurer que content est une string
        content: typeof msg.content === 'string' ? msg.content : String(msg.content || ''),
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
    return request(`/api/chat/history/${summaryId}`, { method: 'DELETE' });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ RELIABILITY API
// ═══════════════════════════════════════════════════════════════════════════════

export const reliabilityApi = {
  async getReliability(summaryId: number): Promise<ReliabilityResult> {
    return request(`/api/videos/summary/${summaryId}/reliability`);
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

export const playlistApi = {
  async getAll(): Promise<Playlist[]> {
    return request('/api/playlists');
  },

  async create(data: { name: string; description?: string }): Promise<Playlist> {
    return request('/api/playlists', {
      method: 'POST',
      body: data,
    });
  },

  async get(id: number): Promise<Playlist> {
    return request(`/api/playlists/${id}`);
  },

  async update(id: number, data: { name?: string; description?: string }): Promise<Playlist> {
    return request(`/api/playlists/${id}`, {
      method: 'PUT',
      body: data,
    });
  },

  async delete(id: number): Promise<{ success: boolean }> {
    return request(`/api/playlists/${id}`, { method: 'DELETE' });
  },

  async analyze(
    url: string,
    options?: { lang?: string; mode?: string; category?: string; maxVideos?: number }
  ): Promise<{ task_id: string; status: string }> {
    return request('/api/playlists/analyze', {
      method: 'POST',
      body: { url, ...options },
      timeout: 600000,
    });
  },

  async analyzeCorpus(
    urls: string[],
    options?: { lang?: string; mode?: string; name?: string }
  ): Promise<{ task_id: string; status: string }> {
    return request('/api/playlists/analyze-corpus', {
      method: 'POST',
      body: { urls, ...options },
      timeout: 600000,
    });
  },

  async getStatus(taskId: string): Promise<PlaylistTaskStatus> {
    return request(`/api/playlists/task/${taskId}`);
  },

  async getHistory(params?: { limit?: number; page?: number }): Promise<{
    items: Summary[];
    total: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.page) queryParams.set('page', String(params.page));
    const query = queryParams.toString();
    return request(`/api/playlists/history${query ? `?${query}` : ''}`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💳 BILLING API
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChangePlanResponse {
  success: boolean;
  message: string;
  action: 'upgraded' | 'downgraded' | 'checkout_required' | 'no_change';
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

export const billingApi = {
  async createCheckout(plan: string): Promise<{ checkout_url: string; session_id: string }> {
    return request('/api/billing/create-checkout', {
      method: 'POST',
      body: { plan_id: plan },
    });
  },

  async getPortalUrl(): Promise<{ portal_url: string }> {
    return request('/api/billing/portal');
  },

  async createPortal(): Promise<{ portal_url: string }> {
    return request('/api/billing/portal');
  },

  async getSubscription(): Promise<{
    plan: string;
    status: string;
    current_period_end?: string;
  }> {
    return request('/api/billing/info');
  },

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    return request('/api/billing/subscription-status');
  },

  /**
   * 🔄 Change le plan d'abonnement (upgrade ou downgrade)
   */
  async changePlan(newPlan: string): Promise<ChangePlanResponse> {
    return request('/api/billing/change-plan', {
      method: 'POST',
      body: { new_plan: newPlan },
    });
  },

  /**
   * 🗑️ Annule l'abonnement (effectif à la fin de la période)
   */
  async cancelSubscription(): Promise<{ success: boolean; message: string; end_date: string }> {
    return request('/api/billing/cancel', {
      method: 'POST',
    });
  },

  /**
   * 🔄 Réactive un abonnement annulé
   */
  async reactivateSubscription(): Promise<{ success: boolean; message: string }> {
    return request('/api/billing/reactivate', {
      method: 'POST',
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
    return request('/api/billing/confirm-checkout', {
      method: 'POST',
      body: { session_id: sessionId },
    });
  },

  /**
   * 📋 Récupère les plans disponibles
   */
  async getPlans(): Promise<{
    plans: Record<string, {
      name: string;
      price: number;
      price_display: string;
      credits: number;
      features: Record<string, unknown>;
    }>;
  }> {
    return request('/api/billing/plans');
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
    return request('/api/billing/transactions');
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
    return request('/api/billing/api-key/status');
  },

  /**
   * 🔐 Génère une nouvelle clé API
   * ⚠️ La clé n'est retournée qu'une seule fois !
   */
  async generateApiKey(): Promise<{
    api_key: string;
    message: string;
  }> {
    return request('/api/billing/api-key/generate', { method: 'POST' });
  },

  /**
   * 🔄 Régénère la clé API (révoque l'ancienne)
   * ⚠️ La nouvelle clé n'est retournée qu'une seule fois !
   */
  async regenerateApiKey(): Promise<{
    api_key: string;
    message: string;
  }> {
    return request('/api/billing/api-key/regenerate', { method: 'POST' });
  },

  /**
   * 🗑️ Révoque définitivement la clé API
   */
  async revokeApiKey(): Promise<{
    success: boolean;
    message: string;
  }> {
    return request('/api/billing/api-key', { method: 'DELETE' });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS API
// ═══════════════════════════════════════════════════════════════════════════════

export const exportsApi = {
  async pdf(summaryId: number): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/exports/pdf/${summaryId}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!response.ok) throw new ApiError('Export failed', response.status);
    return response.blob();
  },

  async markdown(summaryId: number): Promise<string> {
    const data = await request<{ content: string }>(`/api/exports/markdown/${summaryId}`);
    return data.content;
  },

  async text(summaryId: number): Promise<string> {
    const data = await request<{ content: string }>(`/api/exports/text/${summaryId}`);
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
    return request('/api/usage/stats');
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌻 TOURNESOL API
// ═══════════════════════════════════════════════════════════════════════════════

export const tournesolApi = {
  async search(query: string, limit = 10): Promise<VideoCandidate[]> {
    return request(`/api/tournesol/search?q=${encodeURIComponent(query)}&limit=${limit}`);
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
    return request('/api/admin/stats');
  },

  async getUsers(params?: { page?: number; limit?: number; search?: string }): Promise<{
    items: User[];
    total: number;
    page: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.search) queryParams.set('search', params.search);
    const query = queryParams.toString();
    return request(`/api/admin/users${query ? `?${query}` : ''}`);
  },

  async updateCredits(userId: number, credits: number): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${userId}/credits`, {
      method: 'POST',
      body: { credits },
    });
  },

  async updatePlan(userId: number, plan: string): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${userId}/plan`, {
      method: 'POST',
      body: { plan },
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎙️ TTS API — Text-to-Speech pour résumés audio
// ═══════════════════════════════════════════════════════════════════════════════

export interface TTSEstimate {
  text_length: number;
  estimated_duration_seconds: number;
  estimated_cost_elevenlabs: number;
  estimated_cost_openai: number;
  is_within_limit: boolean;
  truncated_preview: string;
}

export interface TTSVoice {
  name: string;
  description: string;
  provider: string;
  recommended_for: string[];
}

export interface TTSVoices {
  fr: Record<string, TTSVoice>;
  en: Record<string, TTSVoice>;
  default_voice: { fr: string; en: string };
}

export interface TTSStatus {
  service: string;
  status: 'operational' | 'degraded';
  providers: {
    elevenlabs: { configured: boolean; status: string; quality: string };
    openai: { configured: boolean; status: string; quality: string };
  };
  fallback_enabled: boolean;
  cache_enabled: boolean;
  max_text_length: number;
}

export type VoiceStyle = 'warm' | 'calm' | 'soft' | 'narrative';
export type TTSProvider = 'auto' | 'openai' | 'elevenlabs';

export const ttsApi = {
  /**
   * 📊 Estime la durée et le coût pour un résumé
   */
  async estimateSummary(summaryId: number): Promise<TTSEstimate> {
    return request(`/api/tts/summary/${summaryId}/estimate`);
  },

  /**
   * 🎙️ Génère l'audio pour un résumé
   * 
   * @param summaryId - ID du résumé
   * @param voiceStyle - Style de voix: warm, calm, soft, narrative
   * @param provider - Provider TTS:
   *   - 'auto': ElevenLabs avec fallback OpenAI (défaut, Starter+)
   *   - 'openai': OpenAI TTS HD direct (Pro/Expert uniquement)
   *   - 'elevenlabs': ElevenLabs uniquement
   * 
   * @returns URL du blob audio
   */
  async generateSummaryAudio(
    summaryId: number,
    voiceStyle: VoiceStyle = 'warm',
    provider: TTSProvider = 'auto'
  ): Promise<string> {
    const params = new URLSearchParams({
      voice_style: voiceStyle,
      provider: provider
    });
    
    const response = await fetch(`${API_URL}/api/tts/summary/${summaryId}/audio?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'TTS generation failed' }));
      
      // Extraire le message d'erreur proprement (évite [object Object])
      let errorMessage = 'Échec de la génération audio';
      
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (errorData.detail?.message) {
        errorMessage = errorData.detail.message;
      } else if (errorData.detail?.error) {
        const errorCode = errorData.detail.error;
        if (errorCode === 'tts_generation_failed' || errorCode === 'all_providers_failed') {
          errorMessage = 'Service TTS temporairement indisponible. Veuillez réessayer plus tard.';
        } else if (errorCode === 'tts_pro_required') {
          errorMessage = 'La synthèse vocale nécessite un abonnement Starter ou Pro.';
        } else if (errorCode === 'openai_tts_pro_required') {
          errorMessage = 'OpenAI HD est réservé aux abonnés Pro et Expert.';
        } else {
          errorMessage = `Erreur: ${errorCode}`;
        }
      }
      
      throw new ApiError(errorMessage, response.status, errorData.detail?.error);
    }

    // Créer un blob URL pour le lecteur audio
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  /**
   * 📋 Génère l'audio pour une méta-analyse de playlist
   */
  async generatePlaylistAudio(
    playlistId: string,
    voiceStyle: VoiceStyle = 'narrative'
  ): Promise<string> {
    const response = await fetch(`${API_URL}/api/tts/playlist/${playlistId}/audio?voice_style=${voiceStyle}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'TTS generation failed' }));
      throw new ApiError(
        error.detail?.message || error.detail || 'Échec de la génération audio',
        response.status,
        error.detail?.error
      );
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  /**
   * 🎤 Génère l'audio à partir d'un texte libre
   */
  async generateFromText(
    text: string,
    language: 'fr' | 'en' = 'fr',
    voiceStyle: VoiceStyle = 'warm'
  ): Promise<string> {
    const response = await fetch(`${API_URL}/api/tts/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, language, voice_style: voiceStyle }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'TTS generation failed' }));
      throw new ApiError(
        error.detail?.message || error.detail || 'Échec de la génération audio',
        response.status,
        error.detail?.error
      );
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  /**
   * 📋 Liste les voix disponibles
   */
  async getVoices(): Promise<TTSVoices> {
    return request('/api/tts/voices');
  },

  /**
   * 🔍 Vérifie le statut du service TTS
   */
  async getStatus(): Promise<TTSStatus> {
    return request('/api/tts/status');
  },

  /**
   * 📊 Estime un texte libre
   */
  async estimate(text: string, language: 'fr' | 'en' = 'fr'): Promise<TTSEstimate> {
    return request('/api/tts/estimate', {
      method: 'POST',
      body: { text, language, voice_style: 'warm' },
    });
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
  tts: ttsApi,
};
