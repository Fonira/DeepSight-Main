import type {
  AuthTokens,
  User,
  RecentAnalysis,
  ExtensionSettings,
} from "../types";

// ── Token Storage ──

export async function getStoredTokens(): Promise<AuthTokens> {
  try {
    const data = await chrome.storage.local.get([
      "accessToken",
      "refreshToken",
    ]);
    return {
      accessToken: data.accessToken || null,
      refreshToken: data.refreshToken || null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

export async function setStoredTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  // Bug #10: guard against undefined values
  const payload: Record<string, string> = { accessToken };
  if (refreshToken) payload.refreshToken = refreshToken;
  try {
    await chrome.storage.local.set(payload);
  } catch {
    // Storage quota or permission error — fail silently
  }
}

export async function clearStoredAuth(): Promise<void> {
  try {
    await chrome.storage.local.remove(["accessToken", "refreshToken", "user"]);
  } catch {
    // Ignore errors on clear
  }
}

// ── User Storage ──

export async function getStoredUser(): Promise<User | null> {
  try {
    const data = await chrome.storage.local.get(["user"]);
    return data.user || null;
  } catch {
    return null;
  }
}

export async function setStoredUser(user: User): Promise<void> {
  try {
    await chrome.storage.local.set({ user });
  } catch {
    // Storage quota or permission error — fail silently
  }
}

// ── Settings Storage ──

export async function getStoredSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(["settings"]);
  return (
    data.settings || {
      defaultMode: "standard",
      defaultLang: "fr",
      showNotifications: true,
    }
  );
}

export async function setStoredSettings(
  settings: ExtensionSettings,
): Promise<void> {
  await chrome.storage.local.set({ settings });
}

// ── Recent Analyses Storage ──

export async function getRecentAnalyses(): Promise<RecentAnalysis[]> {
  const data = await chrome.storage.local.get(["recentAnalyses"]);
  return data.recentAnalyses || [];
}

export async function addRecentAnalysis(
  analysis: Omit<RecentAnalysis, "timestamp">,
): Promise<void> {
  const existing = await getRecentAnalyses();
  const filtered = existing.filter((a) => a.videoId !== analysis.videoId);
  filtered.unshift({ ...analysis, timestamp: Date.now() });
  await chrome.storage.local.set({ recentAnalyses: filtered.slice(0, 20) });
}

// ── Free (Guest) Analysis Counter ──

export async function getFreeAnalysisCount(): Promise<number> {
  const data = await chrome.storage.local.get(["deepsight_free_analyses"]);
  return data.deepsight_free_analyses || 0;
}

export async function incrementFreeAnalysisCount(): Promise<number> {
  const current = await getFreeAnalysisCount();
  const next = current + 1;
  await chrome.storage.local.set({ deepsight_free_analyses: next });
  return next;
}

// ── Generic Helpers ──

export async function getStorageItem<T>(key: string): Promise<T | null> {
  const data = await chrome.storage.local.get([key]);
  return (data[key] as T) ?? null;
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}
