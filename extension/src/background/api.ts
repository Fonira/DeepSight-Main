import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../utils/config';
import {
  getStoredTokens,
  setStoredTokens,
  setStoredUser,
  clearStoredAuth,
} from '../utils/storage';
import type {
  User,
  LoginResponse,
  AnalyzeOptions,
  AnalyzeResponse,
  TaskStatus,
  Summary,
  ChatResponse,
  ChatOptions,
} from '../types';

// ── Core API Request ──

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = await getStoredTokens();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      const { accessToken: newToken } = await getStoredTokens();
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
      if (!retryResponse.ok) {
        throw new Error(`API Error: ${retryResponse.status}`);
      }
      return retryResponse.json();
    }
    await clearStoredAuth();
    throw new Error('SESSION_EXPIRED');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorBody.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// ── Auth ──

export async function refreshToken(): Promise<boolean> {
  const { refreshToken: token } = await getStoredTokens();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token }),
    });

    if (!response.ok) return false;

    const data: LoginResponse = await response.json();
    await setStoredTokens(data.access_token, data.refresh_token);
    await setStoredUser(data.user);
    return true;
  } catch {
    return false;
  }
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(errorBody.detail || 'Login failed');
  }

  const data: LoginResponse = await response.json();
  await setStoredTokens(data.access_token, data.refresh_token);
  await setStoredUser(data.user);
  return data.user;
}

export async function loginWithGoogle(): Promise<User> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google OAuth not configured. Use email/password login.');
  }

  const redirectUrl = chrome.identity.getRedirectURL();

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent('email profile')}` +
    `&prompt=select_account`;

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error('Google login cancelled');
  }

  // Extract access_token from the redirect URL hash
  const hashParams = new URLSearchParams(responseUrl.split('#')[1]);
  const googleAccessToken = hashParams.get('access_token');

  if (!googleAccessToken) {
    throw new Error('No access token received from Google');
  }

  // Exchange Google token with our backend
  const response = await fetch(`${API_BASE_URL}/auth/google/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: googleAccessToken }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Google login failed' }));
    throw new Error(errorBody.detail || 'Google login failed on server');
  }

  const data: LoginResponse = await response.json();
  await setStoredTokens(data.access_token, data.refresh_token);
  await setStoredUser(data.user);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors on logout API call
  }
  await clearStoredAuth();
}

export async function getCurrentUser(): Promise<User> {
  const user = await apiRequest<User>('/auth/me');
  await setStoredUser(user);
  return user;
}

// ── Videos ──

export async function analyzeVideo(url: string, options: AnalyzeOptions = {}): Promise<AnalyzeResponse> {
  return apiRequest<AnalyzeResponse>('/videos/analyze', {
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

// ── Chat ──

export async function askQuestion(
  summaryId: number,
  question: string,
  options: ChatOptions = {},
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
