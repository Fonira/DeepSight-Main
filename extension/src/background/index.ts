import { WEBAPP_URL } from '../utils/config';
import {
  getStoredTokens,
  getStoredUser,
  setStoredTokens,
  setStoredUser,
} from '../utils/storage';
import { extractVideoId } from '../utils/youtube';
import { addRecentAnalysis } from '../utils/storage';
import type { ExtensionMessage, MessageResponse, AnalyzeOptions } from '../types';
import {
  refreshToken,
  login,
  loginWithGoogle,
  logout,
  getCurrentUser,
  analyzeVideo,
  getTaskStatus,
  getSummary,
  askQuestion,
} from './api';

// ── Helpers ──

async function isAuthenticated(): Promise<boolean> {
  const { accessToken } = await getStoredTokens();
  return !!accessToken;
}

async function pollAnalysis(taskId: string): Promise<unknown> {
  const MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes max
  const startTime = Date.now();
  let pollInterval = 2000; // Start at 2s

  while (Date.now() - startTime < MAX_DURATION_MS) {
    const status = await getTaskStatus(taskId);

    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }

    // Send progress to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'ANALYSIS_PROGRESS',
          data: { taskId, progress: status.progress, message: status.message },
        }).catch(() => { /* tab may not exist */ });
      }
    });

    // Adaptive polling: ramp up interval as analysis takes longer
    // 0-30s: poll every 2s | 30s-2min: 3s | 2min-5min: 5s | 5min+: 8s
    const elapsed = Date.now() - startTime;
    if (elapsed > 5 * 60 * 1000) pollInterval = 8000;
    else if (elapsed > 2 * 60 * 1000) pollInterval = 5000;
    else if (elapsed > 30 * 1000) pollInterval = 3000;

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Analysis timeout — video may be too long. Check results on deepsightsynthesis.com');
}

// ── Message Handler ──

async function handleMessage(message: ExtensionMessage): Promise<MessageResponse> {
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

    case 'ANALYZE_VIDEO': {
      const { url, options } = message.data as { url: string; options: AnalyzeOptions };
      try {
        const { task_id } = await analyzeVideo(url, options);
        const result = await pollAnalysis(task_id) as { status: string; result?: { summary_id: number; video_title?: string } };

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
      const { summaryId, question } = message.data as { summaryId: number; question: string };
      try {
        const result = await askQuestion(summaryId, question);
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
  (message: ExtensionMessage, _sender, sendResponse: (response: MessageResponse) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((e) => {
        sendResponse({ error: (e as Error).message });
      });
    return true; // Keep channel open for async response
  },
);

// ── Lifecycle Events ──

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: `${WEBAPP_URL}/extension-welcome` });
  }
});

// ── Alarms ──

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });

// Auto-refresh token every 14 minutes (token expires at 15)
chrome.alarms.create('refreshToken', { periodInMinutes: 14 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refreshToken' && (await isAuthenticated())) {
    await refreshToken();
  }
  // keepAlive: no-op, just keeps service worker running
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
