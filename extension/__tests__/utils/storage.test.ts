/**
 * Tests — Chrome Storage utilities
 * Fichier source : src/utils/storage.ts
 */

import { resetChromeMocks, seedLocalStorage } from "../setup/chrome-api-mock";
import {
  getStoredTokens,
  setStoredTokens,
  clearStoredAuth,
  getStoredUser,
  setStoredUser,
  getStoredSettings,
  setStoredSettings,
  getRecentAnalyses,
  addRecentAnalysis,
  getFreeAnalysisCount,
  incrementFreeAnalysisCount,
  getStorageItem,
  setStorageItem,
} from "../../src/utils/storage";

beforeEach(() => {
  resetChromeMocks();
});

// ── Token Storage ──
describe("Token Storage", () => {
  it("returns null tokens when storage is empty", async () => {
    const tokens = await getStoredTokens();
    expect(tokens).toEqual({ accessToken: null, refreshToken: null });
  });

  it("stores and retrieves tokens", async () => {
    await setStoredTokens("access-123", "refresh-456");
    const tokens = await getStoredTokens();
    expect(tokens).toEqual({
      accessToken: "access-123",
      refreshToken: "refresh-456",
    });
  });

  it("clears auth data", async () => {
    await setStoredTokens("access", "refresh");
    await setStoredUser({
      id: 1,
      username: "test",
      email: "test@test.com",
      plan: "free",
      credits: 100,
      credits_monthly: 150,
    });
    await clearStoredAuth();

    const tokens = await getStoredTokens();
    expect(tokens).toEqual({ accessToken: null, refreshToken: null });

    const user = await getStoredUser();
    expect(user).toBeNull();
  });
});

// ── User Storage ──
describe("User Storage", () => {
  it("returns null when no user stored", async () => {
    const user = await getStoredUser();
    expect(user).toBeNull();
  });

  it("stores and retrieves user", async () => {
    const mockUser = {
      id: 1,
      username: "alice",
      email: "alice@test.com",
      plan: "pro" as const,
      credits: 500,
      credits_monthly: 1000,
    };
    await setStoredUser(mockUser);
    const user = await getStoredUser();
    expect(user).toEqual(mockUser);
  });
});

// ── Settings Storage ──
describe("Settings Storage", () => {
  it("returns defaults when no settings stored", async () => {
    const settings = await getStoredSettings();
    expect(settings).toEqual({
      defaultMode: "standard",
      defaultLang: "fr",
      showNotifications: true,
    });
  });

  it("stores and retrieves custom settings", async () => {
    const custom = {
      defaultMode: "expert" as const,
      defaultLang: "en" as const,
      showNotifications: false,
    };
    await setStoredSettings(custom);
    const settings = await getStoredSettings();
    expect(settings).toEqual(custom);
  });
});

// ── Recent Analyses ──
describe("Recent Analyses Storage", () => {
  it("returns empty array when none stored", async () => {
    const analyses = await getRecentAnalyses();
    expect(analyses).toEqual([]);
  });

  it("adds a recent analysis with timestamp", async () => {
    const beforeTime = Date.now();
    await addRecentAnalysis({
      videoId: "vid-1",
      summaryId: 100,
      title: "Test Video",
    });
    const analyses = await getRecentAnalyses();

    expect(analyses).toHaveLength(1);
    expect(analyses[0].videoId).toBe("vid-1");
    expect(analyses[0].summaryId).toBe(100);
    expect(analyses[0].title).toBe("Test Video");
    expect(analyses[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
  });

  it("deduplicates by videoId (most recent first)", async () => {
    await addRecentAnalysis({
      videoId: "vid-1",
      summaryId: 100,
      title: "Old Title",
    });
    await addRecentAnalysis({
      videoId: "vid-2",
      summaryId: 200,
      title: "Other Video",
    });
    await addRecentAnalysis({
      videoId: "vid-1",
      summaryId: 101,
      title: "New Title",
    });

    const analyses = await getRecentAnalyses();
    expect(analyses).toHaveLength(2);
    expect(analyses[0].videoId).toBe("vid-1");
    expect(analyses[0].title).toBe("New Title");
    expect(analyses[0].summaryId).toBe(101);
    expect(analyses[1].videoId).toBe("vid-2");
  });

  it("caps at 20 entries", async () => {
    for (let i = 0; i < 25; i++) {
      await addRecentAnalysis({
        videoId: `vid-${i}`,
        summaryId: i,
        title: `Video ${i}`,
      });
    }
    const analyses = await getRecentAnalyses();
    expect(analyses).toHaveLength(20);
    // Most recent should be first
    expect(analyses[0].videoId).toBe("vid-24");
  });
});

// ── Free Analysis Counter ──
describe("Free Analysis Counter", () => {
  it("returns 0 when no counter set", async () => {
    const count = await getFreeAnalysisCount();
    expect(count).toBe(0);
  });

  it("increments counter", async () => {
    const first = await incrementFreeAnalysisCount();
    expect(first).toBe(1);

    const second = await incrementFreeAnalysisCount();
    expect(second).toBe(2);

    const count = await getFreeAnalysisCount();
    expect(count).toBe(2);
  });
});

// ── Generic Helpers ──
describe("Generic Storage Helpers", () => {
  it("stores and retrieves arbitrary items", async () => {
    await setStorageItem("myKey", { foo: "bar" });
    const result = await getStorageItem<{ foo: string }>("myKey");
    expect(result).toEqual({ foo: "bar" });
  });

  it("returns null for missing key", async () => {
    const result = await getStorageItem("nonexistent");
    expect(result).toBeNull();
  });
});
