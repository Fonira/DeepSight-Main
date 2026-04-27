import Browser, {
  type Runtime,
  type Alarms,
  type Storage,
} from "./utils/browser-polyfill";
import { API_BASE_URL, GOOGLE_CLIENT_ID, WEBAPP_URL } from "./utils/config";
import {
  getStoredTokens,
  setStoredTokens,
  setStoredUser,
  clearStoredAuth,
  getStoredUser,
  addRecentAnalysis,
  getTokenRefreshedAt,
} from "./utils/storage";
import { extractVideoId } from "./utils/video";
import { drainCrashes } from "./utils/crash-logger";
import { reportCrashes } from "./utils/sentry-reporter";
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
} from "./types";

// ─── SidePanel toggle behavior (Chrome 114+) ──────────────────────────────
// Native click-to-toggle: clicking the action icon opens the sidebar; clicking again closes it.
chrome.runtime.onInstalled.addListener(() => {
  if (typeof chrome !== "undefined" && chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) =>
        console.error("[deepsight] setPanelBehavior failed", err),
      );
  }
});

// Notify the sidebar when active tab changes (sync current video).
// The sidebar subscribes to TAB_CHANGED via chrome.runtime.onMessage.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.runtime.sendMessage({ action: "TAB_CHANGED", tabId }).catch(() => {
    // Sidebar may not be open — silently ignored.
  });
});

// ─── URL_CHANGED relay (content script → sidebar) ─────────────────────────
// Content script observes URL changes on YouTube/TikTok SPAs and emits URL_CHANGED.
// We re-emit as VIDEO_URL_UPDATED so the sidebar (separate context) can react.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "URL_CHANGED") {
    chrome.runtime
      .sendMessage({
        action: "VIDEO_URL_UPDATED",
        payload: message.payload,
      })
      .catch(() => {
        // Sidebar may not be open — silently ignored.
      });
    sendResponse?.({ ok: true });
    return false; // synchronous response
  }
  return undefined; // not our message — let other listeners handle
});

// ── Core API Request ──

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const { accessToken } = await getStoredTokens();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Bug fix: proactive refresh if access_token is older than 20min
  // to avoid 401 mid-request during long pollings.
  const refreshedAt = await getTokenRefreshedAt();
  if (accessToken && refreshedAt && Date.now() - refreshedAt > 20 * 60 * 1000) {
    await tryRefreshToken();
    const fresh = await getStoredTokens();
    if (fresh.accessToken)
      headers["Authorization"] = `Bearer ${fresh.accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const { accessToken: newToken } = await getStoredTokens();
      headers["Authorization"] = `Bearer ${newToken}`;
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
    console.warn(
      "[DeepSight] Session expired, refresh failed. User needs to re-login.",
    );
    throw new Error("SESSION_EXPIRED");
  }

  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(errorBody.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// ── Auth API ──

let inflightRefresh: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      return await doRefreshToken();
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

async function doRefreshToken(): Promise<boolean> {
  const { refreshToken } = await getStoredTokens();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => ({ detail: "Login failed" }));
    throw new Error(errorBody.detail || "Login failed");
  }

  const data: LoginResponse = await response.json();
  await setStoredTokens(data.access_token, data.refresh_token);
  await setStoredUser(data.user);
  return data.user;
}

/**
 * Generate a cryptographically random nonce for OpenID Connect id_token
 * replay protection. Google embeds this nonce in the signed id_token — if an
 * attacker replays an old token it won't match our freshly generated nonce.
 */
function generateOidcNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function loginWithGoogle(): Promise<User> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google OAuth not configured. Use email/password login.");
  }

  const redirectUrl = Browser.identity.getRedirectURL();
  const nonce = generateOidcNonce();

  // OpenID Connect hybrid flow: ask Google for a signed id_token (JWT).
  // The backend verifies the JWT signature + audience + nonce cryptographically,
  // which is more secure than trusting a bearer access_token. scope=openid is
  // required to obtain an id_token.
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
    `&response_type=${encodeURIComponent("id_token token")}` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&nonce=${encodeURIComponent(nonce)}` +
    `&prompt=select_account`;

  const responseUrl = await Browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  if (!responseUrl) throw new Error("Google login cancelled");

  const hashParams = new URLSearchParams(responseUrl.split("#")[1]);
  const idToken = hashParams.get("id_token");

  if (!idToken) throw new Error("No ID token received from Google");

  const response = await fetch(`${API_BASE_URL}/auth/google/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id_token: idToken,
      client_platform: "web",
    }),
  });

  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => ({ detail: "Google login failed" }));
    throw new Error(errorBody.detail || "Google login failed on server");
  }

  const data: LoginResponse = await response.json();
  await setStoredTokens(data.access_token, data.refresh_token);
  await setStoredUser(data.user);
  return data.user;
}

async function logout(): Promise<void> {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch {
    // Ignore errors on logout
  }
  await clearStoredAuth();
}

async function getCurrentUser(): Promise<User> {
  const user = await apiRequest<User>("/auth/me");
  await setStoredUser(user);
  return user;
}

// ── Plan API ──

async function fetchPlan(): Promise<PlanInfo> {
  return apiRequest<PlanInfo>("/billing/my-plan?platform=extension");
}

// ── Video API ──

async function analyzeVideo(
  url: string,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResponse> {
  return apiRequest<AnalyzeResponse>("/videos/analyze", {
    method: "POST",
    body: JSON.stringify({
      url,
      mode: options.mode || "standard",
      lang: options.lang || "fr",
      category: options.category || "auto",
      model: options.model,
      force_refresh: options.force_refresh || false,
    }),
  });
}

async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  return apiRequest<TaskStatus>(`/videos/status/${taskId}`);
}

async function cancelTask(
  taskId: string,
): Promise<{ status: string; task_id: string }> {
  return apiRequest<{ status: string; task_id: string }>(
    `/videos/cancel/${taskId}`,
    {
      method: "POST",
    },
  );
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

async function shareAnalysis(
  videoId: string,
): Promise<{ share_url: string; share_token: string }> {
  return apiRequest<{ share_url: string; share_token: string }>("/share", {
    method: "POST",
    body: JSON.stringify({ video_id: videoId }),
  });
}

// ── Quick Chat API ──

async function quickChat(
  url: string,
  lang: string = "fr",
): Promise<QuickChatResponse> {
  return apiRequest<QuickChatResponse>("/videos/quick-chat", {
    method: "POST",
    body: JSON.stringify({ url, lang }),
  });
}

// ── Chat API ──

async function askQuestion(
  summaryId: number,
  question: string,
  options: ChatOptions = {},
): Promise<ChatResponse> {
  return apiRequest<ChatResponse>("/chat/ask", {
    method: "POST",
    body: JSON.stringify({
      question,
      summary_id: summaryId,
      mode: options.mode || "standard",
      use_web_search: options.use_web_search || false,
    }),
  });
}

async function getChatHistory(summaryId: number): Promise<ChatMessage[]> {
  try {
    const result = await apiRequest<{ messages: ChatMessage[] }>(
      `/chat/${summaryId}/history`,
    );
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

async function pollAnalysis(
  taskId: string,
  originTabId?: number,
): Promise<unknown> {
  const MAX_DURATION_MS = 30 * 60 * 1000;
  const startTime = Date.now();
  let pollInterval = 2000;

  while (Date.now() - startTime < MAX_DURATION_MS) {
    const status = await getTaskStatus(taskId);

    if (
      status.status === "completed" ||
      status.status === "failed" ||
      status.status === "cancelled"
    ) {
      return status;
    }

    // Send progress only to the originating tab (Bug #8 fix)
    if (originTabId !== undefined) {
      Browser.tabs
        .sendMessage(originTabId, {
          action: "ANALYSIS_PROGRESS",
          data: { taskId, progress: status.progress, message: status.message },
        })
        .catch(() => {});
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 5 * 60 * 1000) pollInterval = 8000;
    else if (elapsed > 2 * 60 * 1000) pollInterval = 5000;
    else if (elapsed > 30 * 1000) pollInterval = 3000;

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("Analysis timeout — video may be too long");
}

// ── Voice (ElevenLabs) API ──

async function createVoiceSession(
  payload: Record<string, unknown>,
): Promise<unknown> {
  return apiRequest<unknown>("/voice/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function appendVoiceTranscript(
  payload: Record<string, unknown>,
): Promise<unknown> {
  return apiRequest<unknown>("/voice/transcripts/append", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Side Panel — handler d'ouverture ──
//
// Le side panel API n'existe que sur Chrome (≥114) et certains forks
// chromium. On feature-detect avant de tenter quoi que ce soit pour
// rester compatible avec un éventuel build Firefox/Safari (no-op).
async function openVoicePanel(
  tabId: number | undefined,
  context: Record<string, unknown>,
): Promise<void> {
  type SidePanelOptions = {
    tabId?: number;
    path?: string;
    enabled?: boolean;
  };
  type SidePanelOpenOptions = { tabId?: number; windowId?: number };
  const sidePanel = (
    chrome as unknown as {
      sidePanel?: {
        setOptions?: (opts: SidePanelOptions) => Promise<void> | void;
        open?: (opts: SidePanelOpenOptions) => Promise<void> | void;
      };
    }
  ).sidePanel;
  if (!sidePanel || typeof sidePanel.open !== "function") {
    throw new Error("Side panel API not available in this browser");
  }
  // Persiste le contexte AVANT d'ouvrir : la page sidepanel le lit dès mount.
  // chrome.storage.session est cleared au redémarrage de Chrome (sécurité).
  const sessionStore = (
    chrome as unknown as {
      storage?: { session?: { set?: (data: unknown) => Promise<void> } };
    }
  ).storage?.session;
  if (sessionStore?.set) {
    await sessionStore.set({ voicePanelContext: context });
  }
  if (sidePanel.setOptions) {
    await sidePanel.setOptions({
      tabId,
      path: "sidepanel.html",
      enabled: true,
    });
  }
  await sidePanel.open({ tabId });
}

// ── Message Handler ──

/**
 * Quick Voice Call dispatcher (Task 10) — handles `{ type: "OPEN_VOICE_CALL", … }`
 * messages emitted from the YouTube widget. Stores the video context in
 * `chrome.storage.session` (cleared on Chrome restart, secure for ephemeral
 * intents) then opens the side panel on the originating window.
 */
interface VoiceCallMessage {
  type: "OPEN_VOICE_CALL" | "VOICE_CALL_STARTED" | "VOICE_CALL_ENDED";
  videoId?: string;
  videoTitle?: string;
}

export async function handleMessage(
  message: ExtensionMessage | VoiceCallMessage,
  sender?: chrome.runtime.MessageSender | number,
): Promise<MessageResponse> {
  // Backwards compat: accept either a full sender object (preferred) or a
  // bare tabId (legacy callers that don't propagate sender).
  const senderTabId =
    typeof sender === "number"
      ? sender
      : (sender as chrome.runtime.MessageSender | undefined)?.tab?.id;

  // ── Quick Voice Call dispatch (type-based messages) ──
  const typed = message as VoiceCallMessage;
  if (typed?.type === "OPEN_VOICE_CALL") {
    const fullSender = sender as chrome.runtime.MessageSender | undefined;
    const windowId = fullSender?.tab?.windowId;
    if (!windowId) return { success: false, error: "No source window" };
    const sessionStore = (
      chrome as unknown as {
        storage: { session?: { set?: (data: unknown) => Promise<void> } };
      }
    ).storage.session;
    const sidePanel = (
      chrome as unknown as {
        sidePanel?: {
          open?: (opts: { windowId: number }) => Promise<void>;
        };
      }
    ).sidePanel;
    if (sessionStore?.set) {
      await sessionStore.set({
        pendingVoiceCall: {
          videoId: typed.videoId,
          videoTitle: typed.videoTitle,
        },
      });
    }
    if (sidePanel?.open) {
      await sidePanel.open({ windowId });
    }
    return { success: true };
  }
  if (typed?.type === "VOICE_CALL_STARTED") {
    if (senderTabId !== undefined) {
      try {
        await Browser.tabs.sendMessage(senderTabId, { type: "DUCK_AUDIO" });
      } catch {
        /* tab may have closed */
      }
    }
    return { success: true };
  }
  if (typed?.type === "VOICE_CALL_ENDED") {
    if (senderTabId !== undefined) {
      try {
        await Browser.tabs.sendMessage(senderTabId, { type: "RESTORE_AUDIO" });
      } catch {
        /* tab may have closed */
      }
    }
    return { success: true };
  }

  // Narrow vers le shape ExtensionMessage classique pour la suite du switch
  // (les `case` historiques utilisent `message.data`).
  return handleExtensionMessage(message as ExtensionMessage, sender);
}

async function handleExtensionMessage(
  message: ExtensionMessage,
  sender?: chrome.runtime.MessageSender | number,
): Promise<MessageResponse> {
  const senderTabId =
    typeof sender === "number"
      ? sender
      : (sender as chrome.runtime.MessageSender | undefined)?.tab?.id;
  switch (message.action) {
    case "CHECK_AUTH": {
      if (await isAuthenticated()) {
        try {
          return {
            authenticated: true,
            user: (await getStoredUser()) ?? undefined,
          };
        } catch {
          return { authenticated: false };
        }
      }
      return { authenticated: false };
    }

    case "GET_USER": {
      try {
        const user = await getCurrentUser();
        return { success: true, user };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "LOGIN": {
      const { email, password } = message.data as {
        email: string;
        password: string;
      };
      try {
        const user = await login(email, password);
        return { success: true, user };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "GOOGLE_LOGIN": {
      try {
        const user = await loginWithGoogle();
        return { success: true, user };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "START_ANALYSIS": {
      const { url, options } = message.data as {
        url: string;
        options: AnalyzeOptions;
      };
      try {
        const { task_id } = await analyzeVideo(url, options);
        return { success: true, result: { task_id } };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "ANALYZE_VIDEO": {
      const { url, options } = message.data as {
        url: string;
        options: AnalyzeOptions;
      };
      try {
        const { task_id } = await analyzeVideo(url, options);
        const result = (await pollAnalysis(task_id, senderTabId)) as {
          status: string;
          result?: { summary_id: number; video_title?: string };
        };

        if (result.status === "completed" && result.result?.summary_id) {
          const videoId = extractVideoId(url);
          if (videoId) {
            await addRecentAnalysis({
              videoId,
              summaryId: result.result.summary_id,
              title: result.result.video_title || "Unknown",
            });
          }
        }

        return { success: true, result };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "GET_TASK_STATUS": {
      const { taskId } = message.data as { taskId: string };
      try {
        const status = await getTaskStatus(taskId);
        return { success: true, status };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "CANCEL_ANALYSIS": {
      const { taskId } = message.data as { taskId: string };
      try {
        const result = await cancelTask(taskId);
        return { success: true, result };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "GET_SUMMARY": {
      const { summaryId } = message.data as { summaryId: number };
      try {
        const summary = await getSummary(summaryId);
        return { success: true, summary };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "ASK_QUESTION": {
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

    case "GET_CHAT_HISTORY": {
      const { summaryId } = message.data as { summaryId: number };
      try {
        const messages = await getChatHistory(summaryId);
        return { success: true, result: messages };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "GET_PLAN": {
      try {
        const plan = await fetchPlan();
        return { success: true, plan };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "GET_VOICE_BUTTON_STATE": {
      // Donne au content-script ce dont il a besoin pour décider quel
      // badge afficher sur le bouton 🎙️ Quick Voice Call.
      //
      // Si non authentifié → success:false → l'injector n'affiche rien.
      // [I4] : on tente fetchPlan() pour récupérer voice_quota.{trial_used,
      // monthly_minutes_used}. Best-effort : si l'appel échoue (réseau / 401),
      // on retombe sur des valeurs pessimistes (0 / false) plutôt que
      // bloquer l'injection. Backend reste SoT au POST /voice/session.
      if (!(await isAuthenticated())) {
        return { success: false };
      }
      const stored = await getStoredUser();
      if (!stored) {
        return { success: false };
      }
      const planId = stored.plan;
      const voicePlan: "free" | "pro" | "expert" =
        planId === "expert" ? "expert" : planId === "pro" ? "pro" : "free";
      let trialUsed = false;
      let monthlyMinutesUsed = 0;
      try {
        const plan = await fetchPlan();
        if (plan.voice_quota) {
          trialUsed = Boolean(plan.voice_quota.trial_used);
          monthlyMinutesUsed = Number(plan.voice_quota.monthly_minutes_used) || 0;
        }
      } catch {
        // Best-effort : on garde les défauts.
      }
      return {
        success: true,
        state: {
          plan: voicePlan,
          trialUsed,
          monthlyMinutesUsed,
        },
      };
    }

    case "SHARE_ANALYSIS": {
      const { videoId } = message.data as { videoId: string };
      try {
        const result = await shareAnalysis(videoId);
        return { success: true, share_url: result.share_url };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "QUICK_CHAT": {
      const { url, lang } = message.data as { url: string; lang?: string };
      try {
        const result = await quickChat(url, lang || "fr");
        return { success: true, result };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "LOGOUT": {
      await logout();
      return { success: true };
    }

    case "OPEN_VOICE_PANEL": {
      const { summaryId, videoId, videoTitle, platform } =
        (message.data as {
          summaryId?: number | null;
          videoId?: string | null;
          videoTitle?: string | null;
          platform?: string | null;
        }) ?? {};
      try {
        await openVoicePanel(senderTabId, {
          summaryId: summaryId ?? null,
          videoId: videoId ?? null,
          videoTitle: videoTitle ?? null,
          platform: platform ?? null,
        });
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "VOICE_CREATE_SESSION": {
      const payload = (message.data as Record<string, unknown>) ?? {};
      try {
        const result = await createVoiceSession(payload);
        return { success: true, result };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "VOICE_APPEND_TRANSCRIPT": {
      const payload = (message.data as Record<string, unknown>) ?? {};
      try {
        const result = await appendVoiceTranscript(payload);
        return { success: true, result };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "OPEN_POPUP": {
      Browser.action.setBadgeText({ text: "!" });
      Browser.action.setBadgeBackgroundColor({ color: "#6366f1" });
      return { success: true };
    }

    case "SYNC_AUTH_FROM_WEBSITE": {
      const {
        accessToken,
        refreshToken: rt,
        user,
      } = message.data as {
        accessToken: string;
        refreshToken: string;
        user: Record<string, unknown>;
      };
      // Bug #9: validate before storing
      if (!accessToken || typeof accessToken !== "string") {
        return { success: false, error: "Invalid accessToken" };
      }
      if (
        !user ||
        typeof user.id === "undefined" ||
        typeof user.plan !== "string"
      ) {
        return { success: false, error: "Invalid user data" };
      }
      try {
        await setStoredTokens(accessToken, rt);
        await setStoredUser(user as never);
        Browser.action.setBadgeText({ text: "" });
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    default:
      return { error: "Unknown action" };
  }
}

// ── Message Listener ──

Browser.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: Runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ) => {
    handleMessage(
      message as ExtensionMessage,
      sender as unknown as chrome.runtime.MessageSender,
    )
      .then(sendResponse)
      .catch((e) => sendResponse({ error: (e as Error).message }));
    return true;
  },
);

// ── Lifecycle Events ──

Browser.runtime.onInstalled.addListener(
  async (details: Runtime.OnInstalledDetailsType) => {
    try {
      const crashes = await drainCrashes();
      await reportCrashes(crashes);
    } catch {
      /* never block install on telemetry */
    }
    if (details.reason === "install") {
      Browser.tabs.create({ url: WEBAPP_URL });
      Browser.storage.local.set({ showYouTubeRecommendation: true });
    }
  },
);

Browser.runtime.onStartup.addListener(async () => {
  try {
    const crashes = await drainCrashes();
    await reportCrashes(crashes);
  } catch {
    /* swallow */
  }
  if (await isAuthenticated()) {
    await tryRefreshToken();
  }
});

// ── Side Panel — ouverture via clic toolbar (fallback) ──
//
// Avec `default_popup` configuré, `chrome.action.onClicked` ne se
// déclenche pas (le popup s'ouvre à la place). Ce handler couvre
// le cas où l'utilisateur configure setPanelBehavior pour l'icône
// toolbar, ou les builds futurs sans popup.
try {
  const action = (
    chrome as unknown as {
      action?: {
        onClicked?: {
          addListener: (cb: (tab: { id?: number }) => void) => void;
        };
      };
    }
  ).action;
  if (action?.onClicked?.addListener) {
    action.onClicked.addListener((tab: { id?: number }) => {
      void openVoicePanel(tab.id, {
        summaryId: null,
        videoId: null,
        videoTitle: null,
        platform: null,
      }).catch(() => {
        /* swallow — pas bloquant si side panel API absent */
      });
    });
  }
} catch {
  /* safari/firefox — no-op */
}

// ── Alarms ──

Browser.alarms.create("keepAlive", { periodInMinutes: 0.5 });
Browser.alarms.create("refreshToken", { periodInMinutes: 30 }); // Refresh toutes les 30min — grosse marge vs access_token 24h, + proactive refresh in-flight (20min)

Browser.alarms.onAlarm.addListener(async (alarm: Alarms.Alarm) => {
  if (alarm.name === "refreshToken" && (await isAuthenticated())) {
    await tryRefreshToken();
  }
});

// ── Badge Updates ──

Browser.storage.onChanged.addListener(
  (changes: Record<string, Storage.StorageChange>, areaName: string) => {
    if (areaName === "local" && changes.accessToken) {
      if (changes.accessToken.newValue) {
        Browser.action.setBadgeText({ text: "" });
      } else {
        Browser.action.setBadgeText({ text: "!" });
        Browser.action.setBadgeBackgroundColor({ color: "#ef4444" });
      }
    }
  },
);
