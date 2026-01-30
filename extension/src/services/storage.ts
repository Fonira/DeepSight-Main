/**
 * Chrome Storage Service
 * Handles persistent storage for the extension
 */

export interface StorageData {
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    id: number;
    username: string;
    email: string;
    plan: string;
    credits: number;
    credits_monthly: number;
    avatar_url?: string;
  } | null;
  settings: {
    defaultMode: 'accessible' | 'standard' | 'expert';
    defaultLang: string;
    autoAnalyze: boolean;
    darkMode: 'auto' | 'light' | 'dark';
    showNotifications: boolean;
  };
  recentAnalyses: Array<{
    videoId: string;
    summaryId: number;
    title: string;
    timestamp: number;
  }>;
}

const DEFAULT_SETTINGS: StorageData['settings'] = {
  defaultMode: 'standard',
  defaultLang: 'fr',
  autoAnalyze: false,
  darkMode: 'auto',
  showNotifications: true,
};

export async function getStorage<K extends keyof StorageData>(
  key: K
): Promise<StorageData[K] | null> {
  const result = await chrome.storage.local.get([key]);
  return result[key] ?? null;
}

export async function setStorage<K extends keyof StorageData>(
  key: K,
  value: StorageData[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<StorageData['settings']> {
  const settings = await getStorage('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function updateSettings(
  updates: Partial<StorageData['settings']>
): Promise<void> {
  const current = await getSettings();
  await setStorage('settings', { ...current, ...updates });
}

export async function addRecentAnalysis(analysis: {
  videoId: string;
  summaryId: number;
  title: string;
}): Promise<void> {
  const recent = (await getStorage('recentAnalyses')) || [];
  
  // Remove if already exists
  const filtered = recent.filter((a) => a.videoId !== analysis.videoId);
  
  // Add to front with timestamp
  filtered.unshift({
    ...analysis,
    timestamp: Date.now(),
  });
  
  // Keep only last 20
  await setStorage('recentAnalyses', filtered.slice(0, 20));
}

export async function getRecentAnalyses(): Promise<StorageData['recentAnalyses']> {
  return (await getStorage('recentAnalyses')) || [];
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getStorage('accessToken');
  return !!token;
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.clear();
}
