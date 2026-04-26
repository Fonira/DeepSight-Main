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
const mockAppendTranscript = jest.fn();
jest.mock("../../../services/api", () => ({
  voiceApi: {
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    appendTranscript: (...args: unknown[]) => mockAppendTranscript(...args),
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
    mockAppendTranscript.mockResolvedValue({ ok: true });

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

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ summary_id: 42, language: "fr" }),
    );
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

  it("refuse de démarrer si summaryId invalide (NaN explicite)", async () => {
    const { result } = renderHook(() =>
      useVoiceChat({ summaryId: "not-a-number" }),
    );

    await act(async () => {
      await result.current.start();
    });

    // summaryId fourni mais non parseable → erreur ; sans summaryId du tout
    // → mode companion, c'est OK. Ici on teste l'invalidité explicite.
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

  // ════════════════════════════════════════════════════════════════════════
  // Spec #3 — agent_type, summaryId optionnel, sync bidir transcripts
  // ════════════════════════════════════════════════════════════════════════

  describe("Spec #3 — agent_type & summaryId optionnel", () => {
    it("transmet agent_type=companion sans summaryId au backend", async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ agentType: "companion" }),
      );

      await act(async () => {
        await result.current.start();
      });

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_type: "companion",
          summary_id: undefined,
          language: "fr",
        }),
      );
    });

    it("transmet agent_type=explorer + summary_id quand summaryId fourni", async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ summaryId: "42", agentType: "explorer" }),
      );

      await act(async () => {
        await result.current.start();
      });

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_type: "explorer",
          summary_id: 42,
          language: "fr",
        }),
      );
    });

    it("démarre en mode companion sans summaryId (FAB Library)", async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ agentType: "companion" }),
      );

      await act(async () => {
        await result.current.start();
      });

      // Pas de summaryId → ne doit PAS échouer
      expect(result.current.status).not.toBe("error");
      expect(mockCreateSession).toHaveBeenCalled();
    });

    it("default agent_type = explorer si summaryId présent", async () => {
      const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

      await act(async () => {
        await result.current.start();
      });

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ agent_type: "explorer", summary_id: 42 }),
      );
    });

    it("default agent_type = companion si summaryId absent", async () => {
      const { result } = renderHook(() => useVoiceChat({}));

      await act(async () => {
        await result.current.start();
      });

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ agent_type: "companion" }),
      );
    });
  });

  describe("Spec #3 — sync bidir onMessage → appendTranscript", () => {
    it("appelle voiceApi.appendTranscript après réception d'un message user", async () => {
      const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

      await act(async () => {
        await result.current.start();
      });

      mockAppendTranscript.mockClear();

      // Simulate user transcript from SDK
      await act(async () => {
        capturedCallbacks.onMessage?.({
          message: "Bonjour assistant",
          source: "user",
        });
      });

      // Wait for async transcript append
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockAppendTranscript).toHaveBeenCalledWith(
        expect.objectContaining({
          voice_session_id: "sess_123",
          speaker: "user",
          content: "Bonjour assistant",
          time_in_call_secs: expect.any(Number),
        }),
      );
    });

    it("appelle voiceApi.appendTranscript après réception d'un message agent", async () => {
      const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

      await act(async () => {
        await result.current.start();
      });

      mockAppendTranscript.mockClear();

      await act(async () => {
        capturedCallbacks.onMessage?.({
          message: "Bonjour, comment puis-je vous aider ?",
          source: "ai",
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockAppendTranscript).toHaveBeenCalledWith(
        expect.objectContaining({
          voice_session_id: "sess_123",
          speaker: "agent",
          content: "Bonjour, comment puis-je vous aider ?",
          time_in_call_secs: expect.any(Number),
        }),
      );
    });

    it("ne crash pas si appendTranscript échoue (fire-and-forget)", async () => {
      mockAppendTranscript.mockRejectedValueOnce(new Error("network down"));

      const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

      await act(async () => {
        await result.current.start();
      });

      await act(async () => {
        capturedCallbacks.onMessage?.({
          message: "Test",
          source: "user",
        });
        await Promise.resolve();
      });

      // L'état du hook ne doit PAS basculer en erreur juste parce que
      // l'append a échoué — c'est bestbestebest-effort.
      expect(result.current.status).not.toBe("error");
    });

    it("n'envoie pas appendTranscript si pas de session_id (avant start)", async () => {
      const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

      // Pas de start → pas de session
      await act(async () => {
        capturedCallbacks.onMessage?.({
          message: "Test",
          source: "user",
        });
        await Promise.resolve();
      });

      expect(mockAppendTranscript).not.toHaveBeenCalled();
      expect(result.current.messages).toHaveLength(1); // mais le message local est bien stocké
    });
  });

  describe("Spec #3 — sendUserMessage (injection chat texte → voix)", () => {
    it("expose sendUserMessage qui appelle conversation.sendUserMessage", async () => {
      const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

      await act(async () => {
        await result.current.start();
      });

      act(() => {
        result.current.sendUserMessage?.("Question texte injectée");
      });

      expect(mockConversation.sendUserMessage).toHaveBeenCalledWith(
        "Question texte injectée",
      );
    });

    it("sendUserMessage est no-op si pas démarré", () => {
      const { result } = renderHook(() => useVoiceChat({ summaryId: "42" }));

      // Pas de start → pas de session → no-op
      expect(() => {
        result.current.sendUserMessage?.("Texte");
      }).not.toThrow();
    });
  });
});
