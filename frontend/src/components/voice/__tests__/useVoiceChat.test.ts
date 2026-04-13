/**
 * useVoiceChat.test.ts — Tests pour le hook useVoiceChat (web)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock API
vi.mock("../../../services/api", () => ({
  API_URL: "https://api.test.com",
  getAccessToken: () => "test-token-123",
}));

// Mock ElevenLabs SDK
const mockEndSession = vi.fn();
const mockStartSession = vi.fn().mockResolvedValue({
  endSession: mockEndSession,
  setVolume: vi.fn(),
});

vi.mock("@elevenlabs/client", () => ({
  Conversation: {
    startSession: (...args: unknown[]) => mockStartSession(...args),
  },
}));

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, "mediaDevices", {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { useVoiceChat } from "../useVoiceChat";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useVoiceChat", () => {
  const mockMediaStream = {
    getTracks: () => [{ stop: vi.fn(), enabled: true }],
    getAudioTracks: () => [{ stop: vi.fn(), enabled: true }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetUserMedia.mockResolvedValue(mockMediaStream);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          session_id: "sess-123",
          signed_url: "wss://test.elevenlabs.io/signed",
          quota_remaining_minutes: 10,
          max_session_minutes: 10,
        }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initial state est idle", () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    expect(result.current.status).toBe("idle");
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.messages).toEqual([]);
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("start() passe en connecting puis appelle le micro", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    await act(async () => {
      await result.current.start();
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it("start() appelle l'API session avec le bon token", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    await act(async () => {
      await result.current.start();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/api/voice/session",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token-123",
        }),
        body: JSON.stringify({ summary_id: 42 }),
      }),
    );
  });

  it("gère le refus du microphone", async () => {
    const onError = vi.fn();
    mockGetUserMedia.mockRejectedValue(
      Object.assign(new Error("Permission denied"), {
        name: "NotAllowedError",
      }),
    );

    const { result } = renderHook(() =>
      useVoiceChat({ summaryId: 42, onError }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("microphone");
    expect(onError).toHaveBeenCalled();
  });

  it("gère le microphone non trouvé", async () => {
    mockGetUserMedia.mockRejectedValue(
      Object.assign(new Error("Not found"), { name: "NotFoundError" }),
    );

    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("microphone");
  });

  it("gère l'erreur quota 403", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ code: "voice_not_available" }),
    });

    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("quota_exceeded");
    expect(result.current.error).toContain("Quota");
  });

  it("gère l'erreur quota 429", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ code: "voice_quota_exceeded" }),
    });

    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("quota_exceeded");
  });

  it("gère l'erreur réseau (TypeError)", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("réseau");
  });

  it("stop() remet tout à idle", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it("empêche les démarrages multiples", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    // Start once
    await act(async () => {
      await result.current.start();
    });

    const callCount = mockFetch.mock.calls.length;

    // Try to start again while already started
    await act(async () => {
      await result.current.start();
    });

    // Should not call fetch again
    expect(mockFetch.mock.calls.length).toBe(callCount);
  });

  it("toggleMute ne fait rien sans session active", () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: 42 }));

    act(() => {
      result.current.toggleMute();
    });

    // Should remain false (no session to mute)
    expect(result.current.isMuted).toBe(false);
  });
});
