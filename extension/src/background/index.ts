/**
 * DeepSight Background Service Worker
 * Handles authentication state, API communication, and message passing
 */

import { 
  getStoredUser, 
  getCurrentUser, 
  analyzeVideo, 
  getTaskStatus, 
  getSummary,
  logout,
  refreshAccessToken,
  extractVideoId
} from '../services/api';
import { addRecentAnalysis, isLoggedIn } from '../services/storage';

// Message types
type MessageAction = 
  | 'CHECK_AUTH'
  | 'GET_USER'
  | 'ANALYZE_VIDEO'
  | 'GET_TASK_STATUS'
  | 'GET_SUMMARY'
  | 'LOGOUT'
  | 'OPEN_POPUP';

interface Message {
  action: MessageAction;
  data?: unknown;
}

// Initialize
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[DeepSight] Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Open welcome page on first install
    chrome.tabs.create({
      url: 'https://deepsight.vercel.app/extension-welcome',
    });
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  console.log('[DeepSight] Message received:', message.action);
  
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[DeepSight] Error handling message:', error);
      sendResponse({ error: error.message });
    });
  
  // Return true to indicate async response
  return true;
});

async function handleMessage(message: Message, _sender: chrome.runtime.MessageSender) {
  switch (message.action) {
    case 'CHECK_AUTH': {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        try {
          const user = await getStoredUser();
          return { authenticated: true, user };
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
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
    
    case 'ANALYZE_VIDEO': {
      const { url, options } = message.data as { url: string; options?: Record<string, unknown> };
      try {
        const task = await analyzeVideo(url, options);
        
        // Poll for completion
        const result = await pollTaskStatus(task.task_id);
        
        // Save to recent analyses if successful
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
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
    
    case 'GET_TASK_STATUS': {
      const { taskId } = message.data as { taskId: string };
      try {
        const status = await getTaskStatus(taskId);
        return { success: true, status };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
    
    case 'GET_SUMMARY': {
      const { summaryId } = message.data as { summaryId: number };
      try {
        const summary = await getSummary(summaryId);
        return { success: true, summary };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
    
    case 'LOGOUT': {
      await logout();
      return { success: true };
    }
    
    case 'OPEN_POPUP': {
      // Can't programmatically open popup, but we can set badge
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
      return { success: true };
    }
    
    default:
      return { error: 'Unknown action' };
  }
}

// Poll task status until completion
async function pollTaskStatus(taskId: string, maxAttempts = 60): Promise<ReturnType<typeof getTaskStatus>> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getTaskStatus(taskId);
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    
    // Notify content script of progress
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'ANALYSIS_PROGRESS',
          data: { taskId, progress: status.progress, message: status.message },
        }).catch(() => {
          // Tab might not have content script
        });
      }
    });
    
    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  
  throw new Error('Analysis timeout');
}

// Keep service worker alive (Manifest V3 workaround)
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[DeepSight] Keep alive ping');
  }
});

// Refresh token periodically
chrome.alarms.create('refreshToken', { periodInMinutes: 15 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refreshToken') {
    const loggedIn = await isLoggedIn();
    if (loggedIn) {
      const success = await refreshAccessToken();
      console.log('[DeepSight] Token refresh:', success ? 'success' : 'failed');
    }
  }
});

// Update badge when auth state changes
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
