import { API_BASE_URL, GOOGLE_CLIENT_ID, WEBAPP_URL } from './utils/config';
import {
  getStoredTokens,
  setStoredTokens,
  setStoredUser,
  clearStoredAuth,
  getStoredUser,
  addRecentAnalysis,
} from './utils/storage';
import { extractVideoId } from './utils/video';
import type {
  ExtensionMessage,
  MessageResponse,
  AnalyzeOptions,
  User,
  LoginResponse,
  AnalyzeResponse,
  TaskStatus,
  Summary,
  ChatResponse,
  ChatOptions,
  ChatMessage,
  PlanInfo,
  QuickChatResponse,
} from './types';

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
    const refreshed = await tryRefreshToken();
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

// ── Auth API ──

async function tryRefreshToken(): Promise<boolean> {
  const { refreshToken } = await getStoredTokens();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const data: LoginResponse = await response.json();
    if (!data.access_token) {
      return false;
    }
    // Bug #10: keep existing refresh_token if server doesn't send a new one
    const newRefreshToken = data.refresh_token || refreshToken;
    await setStoredTokens(data.access_token, newRefreshToken);
    await setStoredUser(data.user);
    return true;
  } catch {
    return false;
  }
}

async function login(email: string, password: string): Promise<User> {
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

async function loginWithGoogle(): Promise<User> {
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

  if (!responseUrl) throw new Error('Google login cancelled');

  const hashParams = new URLSearchParams(responseUrl.split('#')[1]);
  const googleAccessToken = hashParams.get('access_token');

  if (!googleAccessToken) throw new Error('No access token received from Google');

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

async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  }
  await clearStoredAuth();
}

async function getCurrentUser(): Promise<User> {
  const user = await apiRequest<User>('/auth/me');
  await setStoredUser(user);
  return user;
}

// ── Plan API ──

async function fetchPlan(): Promise<PlanInfo> {
  return apiRequest<PlanInfo>('/billing/my-plan?platform=extension');
}

// ── Video API ──

async function analyzeVideo(url: string, options: AnalyzeOptions = {}): Promise<AnalyzeResponse> {
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

async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  return apiRequest<TaskStatus>(`/videos/status/${taskId}`);
}

async function cancelTask(taskId: string): Promise<{ status: string; task_id: string }> {
  return apiRequest<{ status: string; task_id: string }>(`/videos/cancel/${taskId}`, {
    method: 'POST',
  });
}

async function getSummary(summaryId: number): Promise<Summary> {
  const summary = await apiRequest<Summary>(`/videos/summary/${summaryId}`);

  // Enrichir avec le score Tournesol (non-bloquant)
  if (summary.video_url && !summary.tournesol) {
    try {
      const videoIdMatch = summary.video_url.match(/[?&]v=([^&]+)/);
      const videoId = videoIdMatch?.[1];
      if (videoId) {
        const tournesolData = await apiRequest<{
          found: boolean;
          data?: {
            tournesol_score: number | null;
            n_comparisons: number;
            n_contributors: number;
            criteria_scores?: { criteria: string; score: number }[];
          };
        }>(`/tournesol/video/${videoId}`);
        if (tournesolData.found && tournesolData.data) {
          summary.tournesol = {
            found: true,
            tournesol_score: tournesolData.data.tournesol_score,
            n_comparisons: tournesolData.data.n_comparisons,
            n_contributors: tournesolData.data.n_contributors,
            criteria_scores: tournesolData.data.criteria_scores,
          };
        }
      }
    } catch {
      // Tournesol fetch failed — silently continue without score
    }
  }

  return summary;
}

// ── Share API ──

async function shareAnalysis(videoId: string): Promise<{ share_url: string; share_token: string }> {
  return apiRequest<{ share_url: string; share_token: string }>('/share', {
    method: 'POST',
    body: JSON.stringify({ video_id: videoId }),
  });
}

// ── Quick Chat API ──

async function quickChat(url: string, lang: string = 'fr'): Promise<QuickChatResponse> {
  return apiRequest<QuickChatResponse>('/videos/quick-chat', {
    method: 'POST',
    body: JSON.stringify({ url, lang }),
  });
}

// ── Chat API ──

async function askQuestion(
  summaryId: number,
  question: string,
  options: ChatOptions = {},
): Promise<ChatResponse> {
  return apiRequest<ChatResponse>('/chat/ask', {
    method: 'POST',
    body: JSON.stringify({
      question,
      summary_id: summaryId,
      mode: options.mode || 'standard',
      use_web_search: options.use_web_search || false,
    }),
  });
}

async function getChatHistory(summaryId: number): Promise<ChatMessage[]> {
  try {
    const result = await apiRequest<{ messages: ChatMessage[] }>(`/chat/${summaryId}/history`);
    return result.messages || [];
  } catch {
    return [];
  }
}

// ── Helpers ──

async function isAuthenticated(): Promise<boolean> {
  const { accessToken } = await getStoredTokens();
  return !!accessToken;
}

async function pollAnalysis(taskId: string, originTabId?: number): Promise<unknown> {
  const MAX_DURATION_MS = 30 * 60 * 1000;
  const startTime = Date.now();
  let pollInterval = 2000;

  while (Date.now() - startTime < MAX_DURATION_MS) {
    const status = await getTaskStatus(taskId);

    if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
      return status;
    }

    // Send progress only to the originating tab (Bug #8 fix)
    if (originTabId !== undefined) {
      chrome.tabs.sendMessage(originTabId, {
        action: 'ANALYSIS_PROGRESS',
        data: { taskId, progress: status.progress, message: status.message },
      }).catch(() => {});
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 5 * 60 * 1000) pollInterval = 8000;
    else if (elapsed > 2 * 60 * 1000) pollInterval = 5000;
    else if (elapsed > 30 * 1000) pollInterval = 3000;

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Analysis timeout — video may be too long');
}

// ── Message Handler ──

async function handleMessage(message: ExtensionMessage, senderTabId?: number): Promise<MessageResponse> {
  switch (message.action) {
    case 'CHECK_AUTH': {
      if (await isAuthenticated()) {
        try {
          return { authenticated: true, user: await getStoredUser() ?? undefined };
        } catch {
          return { authenticated: false };
        }
      }
      return { authenticated: false };
    }

    case 'GET_USER': {
      try {
        const user = await getCurrentUser();
        return { success: true, user };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'LOGIN': {
      const { email, password } = message.data as { email: string; password: string };
      try {
        const user = await login(email, password);
        return { success: true, user };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'GOOGLE_LOGIN': {
      try {
        const user = await loginWithGoogle();
        return { success: true, user };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'START_ANALYSIS': {
      const { url, options } = message.data as { url: string; options: AnalyzeOptions };
      try {
        const { task_id } = await analyzeVideo(url, options);
        return { success: true, result: { task_id } };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'ANALYZE_VIDEO': {
      const { url, options } = message.data as { url: string; options: AnalyzeOptions };
      try {
        const { task_id } = await analyzeVideo(url, options);
        const result = await pollAnalysis(task_id, senderTabId) as {
          status: string;
          result?: { summary_id: number; video_title?: string };
        };

        if (result.status === 'completed' && result.result?.summary_id) {
          const videoId = extractVideoId(url);
          if (videoId) {
            await addRecentAnalysis({
              videoId,
              summaryId: result.result.summary_id,
              title: result.result.video_title || 'Unknown',
            });
          }
        }

        return { success: true, result };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'GET_TASK_STATUS': {
      const { taskId } = message.data as { taskId: string };
      try {
        const status = await getTaskStatus(taskId);
        return { success: true, status };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'CANCEL_ANALYSIS': {
      const { taskId } = message.data as { taskId: string };
      try {
        const result = await cancelTask(taskId);
        return { success: true, result };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'GET_SUMMARY': {
      const { summaryId } = message.data as { summaryId: number };
      try {
        const summary = await getSummary(summaryId);
        return { success: true, summary };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'ASK_QUESTION': {
      const { summaryId, question, options } = message.data as {
        summaryId: number;
        question: string;
        options?: ChatOptions;
      };
      try {
        const result = await askQuestion(summaryId, question, options);
        return { success: true, result };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'GET_CHAT_HISTORY': {
      const { summaryId } = message.data as { summaryId: number };
      try {
        const messages = await getChatHistory(summaryId);
        return { success: true, result: messages };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'GET_PLAN': {
      try {
        const plan = await fetchPlan();
        return { success: true, plan };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'SHARE_ANALYSIS': {
      const { videoId } = message.data as { videoId: string };
      try {
        const result = await shareAnalysis(videoId);
        return { success: true, share_url: result.share_url };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'QUICK_CHAT': {
      const { url, lang } = message.data as { url: string; lang?: string };
      try {
        const result = await quickChat(url, lang || 'fr');
        return { success: true, result };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'LOGOUT': {
      await logout();
      return { success: true };
    }

    case 'OPEN_POPUP': {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
      return { success: true };
    }

    case 'SYNC_AUTH_FROM_WEBSITE': {
      const { accessToken, refreshToken: rt, user } = message.data as {
        accessToken: string;
        refreshToken: string;
        user: Record<string, unknown>;
      };
      // Bug #9: validate before storing
      if (!accessToken || typeof accessToken !== 'string') {
        return { success: false, error: 'Invalid accessToken' };
      }
      if (!user || typeof user.id === 'undefined' || typeof user.plan !== 'string') {
        return { success: false, error: 'Invalid user data' };
      }
      try {
        await setStoredTokens(accessToken, rt);
        await setStoredUser(user as never);
        chrome.action.setBadgeText({ text: '' });
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    default:
      return { error: 'Unknown action' };
  }
}

// ── Message Listener ──

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse: (response: MessageResponse) => void) => {
    const senderTabId = sender.tab?.id;
    handleMessage(message, senderTabId)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: (e as Error).message }));
    return true;
  },
);

// ── Lifecycle Events ──

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: WEBAPP_URL });
    chrome.storage.local.set({ showYouTubeRecommendation: true });
  }
});

// ── Alarms ──

chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.create('refreshToken', { periodInMinutes: 50 }); // Refresh avant expiration (access_token = 60min)

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refreshToken' && (await isAuthenticated())) {
    await tryRefreshToken();
  }
});

// ── Badge Updates ──

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.accessToken) {
    if (changes.accessToken.newValue) {
      chrome.action.setBadgeText({ text: '' });
    } else {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }
  }
});
