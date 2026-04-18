import type {
  AuthTokens,
  User,
  RecentAnalysis,
  ExtensionSettings,
} from "../types";
import Browser from "./browser-polyfill";

// ── Token Storage ──

export async function getStoredTokens(): Promise<AuthTokens> {
  try {
    const data = (await Browser.storage.local.get([
      "accessToken",
      "refreshToken",
    ])) as { accessToken?: string; refreshToken?: string };
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
  const payload: Record<string, string | number> = { accessToken };
  if (refreshToken) payload.refreshToken = refreshToken;
  payload.tokenRefreshedAt = Date.now();
  try {
    await Browser.storage.local.set(payload);
  } catch {
    // Storage quota or permission error — fail silently
  }
}

export async function getTokenRefreshedAt(): Promise<number | null> {
  try {
    const data = (await Browser.storage.local.get("tokenRefreshedAt")) as {
      tokenRefreshedAt?: number;
    };
    return data.tokenRefreshedAt ?? null;
  } catch {
    return null;
  }
}

export async function clearStoredAuth(): Promise<void> {
  try {
    await Browser.storage.local.remove([
      "accessToken",
      "refreshToken",
      "user",
      "tokenRefreshedAt",
    ]);
  } catch {
    // Ignore errors on clear
  }
}

// ── User Storage ──

export async function getStoredUser(): Promise<User | null> {
  try {
    const data = (await Browser.storage.local.get(["user"])) as {
      user?: User;
    };
    return data.user || null;
  } catch {
    return null;
  }
}

export async function setStoredUser(user: User): Promise<void> {
  try {
    await Browser.storage.local.set({ user });
  } catch {
    // Storage quota or permission error — fail silently
  }
}

// ── Settings Storage ──

export async function getStoredSettings(): Promise<ExtensionSettings> {
  const data = (await Browser.storage.local.get(["settings"])) as {
    settings?: ExtensionSettings;
  };
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
  await Browser.storage.local.set({ settings });
}

// ── Recent Analyses Storage ──

export async function getRecentAnalyses(): Promise<RecentAnalysis[]> {
  const data = (await Browser.storage.local.get(["recentAnalyses"])) as {
    recentAnalyses?: RecentAnalysis[];
  };
  return data.recentAnalyses || [];
}

export async function addRecentAnalysis(
  analysis: Omit<RecentAnalysis, "timestamp">,
): Promise<void> {
  const existing = await getRecentAnalyses();
  const filtered = existing.filter((a) => a.videoId !== analysis.videoId);
  filtered.unshift({ ...analysis, timestamp: Date.now() });
  await Browser.storage.local.set({ recentAnalyses: filtered.slice(0, 20) });
}

// ── Free (Guest) Analysis Counter ──

export async function getFreeAnalysisCount(): Promise<number> {
  const data = (await Browser.storage.local.get([
    "deepsight_free_analyses",
  ])) as { deepsight_free_analyses?: number };
  return data.deepsight_free_analyses || 0;
}

export async function incrementFreeAnalysisCount(): Promise<number> {
  const current = await getFreeAnalysisCount();
  const next = current + 1;
  await Browser.storage.local.set({ deepsight_free_analyses: next });
  return next;
}

// ── Generic Helpers ──

export async function getStorageItem<T>(key: string): Promise<T | null> {
  const data = (await Browser.storage.local.get([key])) as Record<
    string,
    unknown
  >;
  return (data[key] as T) ?? null;
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  await Browser.storage.local.set({ [key]: value });
}
