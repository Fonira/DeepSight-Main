/**
 * DeepSight API Service
 * Handles all communication with the DeepSight backend
 */

const API_BASE_URL = 'https://deepsight-production.up.railway.app/api';

// Types
export interface User {
  id: number;
  username: string;
  email: string;
  plan: string;
  credits: number;
  credits_monthly: number;
  avatar_url?: string;
  is_admin: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result?: {
    summary_id?: number;
    video_title?: string;
    category?: string;
    cached?: boolean;
  };
  error?: string;
}

export interface Summary {
  id: number;
  video_id: string;
  video_title: string;
  video_channel: string;
  video_duration: number;
  thumbnail_url: string;
  category: string;
  mode: string;
  summary_content: string;
  word_count: number;
  reliability_score: number;
  is_favorite: boolean;
  created_at: string;
  transcript_context?: string;
}

export interface HistoryItem {
  id: number;
  video_id: string;
  video_title: string;
  video_channel: string;
  thumbnail_url: string;
  category: string;
  mode: string;
  created_at: string;
}

export interface ChatResponse {
  response: string;
  web_search_used: boolean;
  sources: { title: string; url: string; snippet: string }[];
  enrichment_level: string;
}

// Storage helpers
export async function getStoredTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const result = await chrome.storage.local.get(['accessToken', 'refreshToken']);
  return {
    accessToken: result.accessToken || null,
    refreshToken: result.refreshToken || null,
  };
}

export async function setStoredTokens(accessToken: string, refreshToken: string): Promise<void> {
  await chrome.storage.local.set({ accessToken, refreshToken });
}

export async function clearStoredTokens(): Promise<void> {
  await chrome.storage.local.remove(['accessToken', 'refreshToken', 'user']);
}

export async function getStoredUser(): Promise<User | null> {
  const result = await chrome.storage.local.get(['user']);
  return result.user || null;
}

export async function setStoredUser(user: User): Promise<void> {
  await chrome.storage.local.set({ user });
}

// API helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken } = await getStoredTokens();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (response.status === 401) {
    // Try to refresh token
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry with new token
      const { accessToken: newToken } = await getStoredTokens();
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
      if (!retryResponse.ok) {
        throw new Error(`API Error: ${retryResponse.status}`);
      }
      return retryResponse.json();
    } else {
      await clearStoredTokens();
      throw new Error('SESSION_EXPIRED');
    }
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }
  
  return response.json();
}

// Auth
export async function login(email: string, password: string): Promise<TokenResponse> {
  const response = await apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  await setStoredTokens(response.access_token, response.refresh_token);
  await setStoredUser(response.user);
  
  return response;
}

export async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken } = await getStoredTokens();
  if (!refreshToken) return false;
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    
    if (!response.ok) return false;
    
    const data: TokenResponse = await response.json();
    await setStoredTokens(data.access_token, data.refresh_token);
    await setStoredUser(data.user);
    
    return true;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors during logout
  }
  await clearStoredTokens();
}

export async function getCurrentUser(): Promise<User> {
  const user = await apiRequest<User>('/auth/me');
  await setStoredUser(user);
  return user;
}

// Videos
export async function analyzeVideo(
  url: string,
  options: {
    mode?: 'accessible' | 'standard' | 'expert';
    lang?: string;
    category?: string;
    model?: string;
    force_refresh?: boolean;
  } = {}
): Promise<TaskStatus> {
  return apiRequest<TaskStatus>('/videos/analyze', {
    method: 'POST',
    body: JSON.stringify({
      url,
      mode: options.mode || 'standard',
      lang: options.lang || 'fr',
      category: options.category || 'auto',
      model: options.model,
      force_refresh: options.force_refresh || false,
    }),
  });
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  return apiRequest<TaskStatus>(`/videos/status/${taskId}`);
}

export async function getSummary(summaryId: number): Promise<Summary> {
  return apiRequest<Summary>(`/videos/summary/${summaryId}`);
}

export async function getHistory(
  page: number = 1,
  perPage: number = 10
): Promise<{ items: HistoryItem[]; total: number; pages: number }> {
  return apiRequest(`/videos/history?page=${page}&per_page=${perPage}`);
}

// Chat
export async function askQuestion(
  summaryId: number,
  question: string,
  options: {
    mode?: string;
    use_web_search?: boolean;
  } = {}
): Promise<ChatResponse> {
  return apiRequest<ChatResponse>(`/chat/${summaryId}`, {
    method: 'POST',
    body: JSON.stringify({
      question,
      mode: options.mode || 'standard',
      use_web_search: options.use_web_search || false,
    }),
  });
}

export async function getChatHistory(
  summaryId: number
): Promise<{ messages: { role: string; content: string; created_at: string }[] }> {
  return apiRequest(`/chat/${summaryId}/history`);
}

// Utility
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
    /youtube\.com\/shorts\/([^&?\s]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
