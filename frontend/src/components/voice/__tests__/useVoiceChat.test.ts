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

// Polyfill MediaStream for jsdom (production code uses `instanceof MediaStream`)
class MediaStreamPolyfill {
  getTracks() {
    return [{ stop: vi.fn(), enabled: true }];
  }
  getAudioTracks() {
    return [{ stop: vi.fn(), enabled: true }];
  }
}
{
  const g = globalThis as unknown as { MediaStream?: unknown };
  if (typeof g.MediaStream === "undefined") {
    g.MediaStream = MediaStreamPolyfill;
  }
}

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
import {
  emitVoicePrefsEvent,
  subscribeVoicePrefsEvents,
} from "../voicePrefsBus";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useVoiceChat", () => {
  const mockMediaStream = new MediaStreamPolyfill();

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
        body: expect.stringContaining('"summary_id":42'),
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

describe("useVoiceChat — call_status_changed events", () => {
  const mockMediaStream = new MediaStreamPolyfill();

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
          signed_url: "wss://test/signed",
          quota_remaining_minutes: 10,
          max_session_minutes: 30,
          input_mode: "ptt",
          ptt_key: " ",
          playback_rate: 1.0,
        }),
    });
    mockStartSession.mockImplementation(
      async (opts: { onConnect?: () => void }) => {
        opts.onConnect?.();
        return { endSession: mockEndSession, setVolume: vi.fn() };
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits call_status_changed { active: true } onConnect", async () => {
    const events: boolean[] = [];
    const unsub = subscribeVoicePrefsEvents((e) => {
      if (e.type === "call_status_changed") events.push(e.active);
    });

    const { result } = renderHook(() => useVoiceChat({ summaryId: 1 }));

    await act(async () => {
      await result.current.start();
    });

    expect(events).toContain(true);
    unsub();
  });

  it("emits call_status_changed { active: false } on stop", async () => {
    const events: boolean[] = [];
    const unsub = subscribeVoicePrefsEvents((e) => {
      if (e.type === "call_status_changed") events.push(e.active);
    });

    const { result } = renderHook(() => useVoiceChat({ summaryId: 1 }));

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(events.filter((v) => v === false)).toHaveLength(1);
    unsub();
  });
});

describe("useVoiceChat — apply_with_restart", () => {
  const mockMediaStream = new MediaStreamPolyfill();

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
          signed_url: "wss://test/signed",
          quota_remaining_minutes: 10,
          max_session_minutes: 30,
          input_mode: "ptt",
          ptt_key: " ",
          playback_rate: 1.0,
        }),
    });
    mockStartSession.mockImplementation(
      async (opts: { onConnect?: () => void }) => {
        opts.onConnect?.();
        return { endSession: mockEndSession, setVolume: vi.fn() };
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls restart (start invoked again) when active session receives apply_with_restart", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: 1 }));
    await act(async () => {
      await result.current.start();
    });
    const startCallsAfterStart = mockStartSession.mock.calls.length;
    expect(startCallsAfterStart).toBe(1);
    mockEndSession.mockClear();

    await act(async () => {
      emitVoicePrefsEvent({ type: "apply_with_restart" });
      // restart() awaits stop() (calls endSession), then a 400ms setTimeout,
      // then start(). Advance just past 400ms — runAllTimersAsync would loop
      // forever on the 1s session-elapsed interval set up by start().
      await vi.advanceTimersByTimeAsync(500);
      // Flush the microtasks introduced by the awaited start() (mocked
      // import/fetch/startSession all resolve as microtasks).
      await Promise.resolve();
      await Promise.resolve();
    });

    // restart() must call BOTH endSession (stop phase) and a fresh
    // startSession (start phase). The latter only fires if the closure trap
    // in start() is fixed.
    expect(mockEndSession).toHaveBeenCalled();
    expect(mockStartSession.mock.calls.length).toBeGreaterThan(
      startCallsAfterStart,
    );
  });

  it("is a no-op when there is no active conversation", async () => {
    renderHook(() => useVoiceChat({ summaryId: 1 }));

    await act(async () => {
      emitVoicePrefsEvent({ type: "apply_with_restart" });
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(mockStartSession).not.toHaveBeenCalled();
  });
});
