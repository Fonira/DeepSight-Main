/**
 * useVoiceChat.test.ts — Tests pour le hook useVoiceChat (React Native)
 *
 * Couvre : permissions micro, création session API, démarrage/arrêt ElevenLabs,
 * gestion quota, AppState background, timer, mute, cleanup.
 */

import { renderHook, act } from "@testing-library/react-native";
import { AppState } from "react-native";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock expo-av
const mockRequestPermissions = jest.fn();
const mockSetAudioMode = jest.fn();
jest.mock("expo-av", () => ({
  Audio: {
    requestPermissionsAsync: () => mockRequestPermissions(),
    setAudioModeAsync: (opts: unknown) => mockSetAudioMode(opts),
  },
}));

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

// Mock ElevenLabs React Native SDK
const mockStartSession = jest.fn();
const mockEndSession = jest.fn();
const mockSetMicMuted = jest.fn();
const mockConversation = {
  startSession: mockStartSession,
  endSession: mockEndSession,
  setMicMuted: mockSetMicMuted,
  status: "connected" as string,
  isSpeaking: false,
  canSendFeedback: false,
  getId: () => "test-conv-id",
  sendFeedback: jest.fn(),
  sendContextualUpdate: jest.fn(),
  sendUserMessage: jest.fn(),
  sendUserActivity: jest.fn(),
  sendMultimodalMessage: jest.fn(),
};

let capturedCallbacks: Record<string, Function> = {};

jest.mock("@elevenlabs/react-native", () => ({
  useConversation: (options?: Record<string, unknown>) => {
    // Capture callbacks for testing
    if (options) {
      capturedCallbacks = options as Record<string, Function>;
    }
    return mockConversation;
  },
  ElevenLabsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock voiceApi
const mockCreateSession = jest.fn();
jest.mock("../../../services/api", () => ({
  voiceApi: {
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    getQuota: jest.fn(),
    getHistory: jest.fn(),
    getTranscript: jest.fn(),
  },
}));

// Mock AppState
let appStateCallback: ((state: string) => void) | null = null;
const mockRemove = jest.fn();
jest.spyOn(AppState, "addEventListener").mockImplementation(((
  _type: string,
  callback: (state: string) => void,
) => {
  appStateCallback = callback;
  return { remove: mockRemove } as unknown as ReturnType<
    typeof AppState.addEventListener
  >;
}) as any);

import { useVoiceChat } from "../useVoiceChat";

// ─── Helpers ────────────────────────────────────────────────────────────────

const defaultSessionResponse = {
  session_id: "sess_123",
  signed_url: "wss://api.elevenlabs.io/test",
  agent_id: "agent_abc",
  conversation_token: "livekit-jwt-token-test",
  expires_at: "2026-04-15T12:00:00Z",
  quota_remaining_minutes: 30,
  max_session_minutes: 10,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useVoiceChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    capturedCallbacks = {};

    // Default: permissions granted
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockSetAudioMode.mockResolvedValue(undefined);

    // Default: session created OK
    mockCreateSession.mockResolvedValue(defaultSessionResponse);

    // Default: startSession resolves
    mockStartSession.mockResolvedValue(undefined);
    mockEndSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Initial state ──

  it("retourne l'état initial idle", () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    expect(result.current.status).toBe("idle");
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.messages).toEqual([]);
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.error).toBeNull();
  });

  // ── start() flow ──

  it("demande la permission micro au start", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  });

  it("passe en erreur si permission micro refusée", async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false });

    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("micro");
  });

  it("crée une session API avec le bon summaryId", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    expect(mockCreateSession).toHaveBeenCalledWith(42, "fr");
  });

  it("démarre la session ElevenLabs avec le conversation_token LiveKit du backend", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    // Quand le backend fournit un JWT LiveKit, le SDK RN doit le recevoir
    // directement (et pas l'agentId qui pointe vers l'endpoint public).
    expect(mockStartSession).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationToken: "livekit-jwt-token-test",
      }),
    );
  });

  it("retombe sur agentId quand le backend ne fournit pas de conversation_token", async () => {
    mockCreateSession.mockResolvedValueOnce({
      session_id: "sess_123",
      signed_url:
        "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_abc",
      agent_id: "agent_abc",
      conversation_token: null,
      expires_at: "2026-01-01T00:00:00Z",
      quota_remaining_minutes: 10,
      max_session_minutes: 5,
    });

    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    expect(mockStartSession).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent_abc",
      }),
    );
  });

  it("passe en quota_exceeded sur erreur 403", async () => {
    mockCreateSession.mockRejectedValue({ status: 403, message: "forbidden" });

    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("quota_exceeded");
    expect(result.current.error).toContain("Quota");
  });

  it("passe en erreur réseau sur TypeError", async () => {
    mockCreateSession.mockRejectedValue(new TypeError("Network error"));

    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("connexion internet");
  });

  it("refuse de démarrer si summaryId invalide", async () => {
    const { result } = renderHook(() =>
      useVoiceChat({ summaryId: "not-a-number" }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  // ── stop() ──

  it("appelle endSession et reset l'état au stop", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    // Start first
    await act(async () => {
      await result.current.start();
    });

    // Stop
    await act(async () => {
      await result.current.stop();
    });

    expect(mockEndSession).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.isMuted).toBe(false);
    expect(result.current.elapsedSeconds).toBe(0);
  });

  // ── toggleMute() ──

  it("toggle le mute et appelle setMicMuted du SDK", () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);
    expect(mockSetMicMuted).toHaveBeenCalledWith(true);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(false);
    expect(mockSetMicMuted).toHaveBeenCalledWith(false);
  });

  // ── Timer ──

  it("incrémente le timer chaque seconde", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.elapsedSeconds).toBe(3);
  });

  // ── AppState background ──

  it("arrête la session quand l'app passe en background", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    // Simulate app going to background
    act(() => {
      appStateCallback?.("background");
    });

    expect(result.current.error).toContain("arrière-plan");
  });

  // ── onError callback ──

  it("appelle onError callback sur erreur", async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false });
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useVoiceChat({ summaryId: "42", onError }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("micro"));
  });

  // ── SDK callbacks ──

  it("ajoute un message quand le SDK émet onMessage", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    // Simulate SDK message callback
    act(() => {
      capturedCallbacks.onMessage?.({
        message: "Bonjour !",
        source: "ai",
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual({
      text: "Bonjour !",
      source: "ai",
    });
  });

  // ── Quota remaining ──

  it("stocke les minutes restantes depuis la réponse API", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.remainingMinutes).toBe(30);
  });

  // ── Prevents double start ──

  it("empêche le double démarrage", async () => {
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

    await act(async () => {
      await result.current.start();
    });

    // Simulate SDK callback → listening
    act(() => {
      capturedCallbacks.onConnect?.();
    });

    // Try to start again while listening
    await act(async () => {
      await result.current.start();
    });

    // Should only have called createSession once
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });
});
