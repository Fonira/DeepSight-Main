/**
 * VoiceOverlay.test.tsx — Tests for the Spec #5 floating voice chat overlay.
 *
 * Covers:
 *  - Render / hidden behaviour
 *  - Slide-in animation container
 *  - Auto-start of the voice chat hook on open
 *  - onMessage forwarding to the parent
 *  - Persistance via voiceApi.appendTranscript with graceful fallback (404)
 *  - Controller ref exposes sendUserMessage + voiceSessionId
 *  - End-call control closes + stops the hook
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock voiceApi.appendTranscript so we can verify persistence calls.
const appendTranscriptMock = vi.fn();
vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../../../services/api",
  );
  return {
    ...actual,
    voiceApi: {
      ...((actual.voiceApi as Record<string, unknown>) ?? {}),
      appendTranscript: (...args: unknown[]) => appendTranscriptMock(...args),
    },
  };
});

// Mock useVoiceChat — we drive the messages/state from the test.
type Listener = () => void;
let mockState: {
  messages: { text: string; source: "user" | "ai" }[];
  status: "idle" | "connecting" | "listening" | "speaking" | "thinking" | "error" | "quota_exceeded";
  voiceSessionId: string | null;
  sessionStartedAt: number | null;
  isMuted: boolean;
  elapsedSeconds: number;
  remainingMinutes: number;
  error: string | null;
};

const startMock = vi.fn().mockResolvedValue(undefined);
const stopMock = vi.fn().mockResolvedValue(undefined);
const sendUserMessageMock = vi.fn();
const toggleMuteMock = vi.fn();

// We need to allow tests to mutate state and re-render. We use a small bus.
const listeners: Listener[] = [];
const notify = () => listeners.forEach((l) => l());

vi.mock("../useVoiceChat", () => ({
  useVoiceChat: () => {
    // Subscribe a force-update mechanism so consumers re-render when state changes.
    const [, setTick] = React.useState(0);
    React.useEffect(() => {
      const l = () => setTick((x) => x + 1);
      listeners.push(l);
      return () => {
        const idx = listeners.indexOf(l);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }, []);
    return {
      start: startMock,
      stop: stopMock,
      prewarm: vi.fn(),
      restart: vi.fn(),
      toggleMute: toggleMuteMock,
      startTalking: vi.fn(),
      stopTalking: vi.fn(),
      sendUserMessage: sendUserMessageMock,
      status: mockState.status,
      isSpeaking: mockState.status === "speaking",
      isMuted: mockState.isMuted,
      isTalking: false,
      inputMode: "vad" as const,
      pttKey: " ",
      activeTool: null,
      messages: mockState.messages,
      elapsedSeconds: mockState.elapsedSeconds,
      remainingMinutes: mockState.remainingMinutes,
      error: mockState.error,
      playbackRate: 1.0,
      micStream: { current: null },
      voiceSessionId: mockState.voiceSessionId,
      sessionStartedAt: mockState.sessionStartedAt,
    };
  },
}));

import { VoiceOverlay, type VoiceOverlayController } from "../VoiceOverlay";

// ─── Helpers ────────────────────────────────────────────────────────────────

const resetMockState = () => {
  mockState = {
    messages: [],
    status: "idle",
    voiceSessionId: null,
    sessionStartedAt: null,
    isMuted: false,
    elapsedSeconds: 0,
    remainingMinutes: 5,
    error: null,
  };
};

const updateMockState = (patch: Partial<typeof mockState>) => {
  mockState = { ...mockState, ...patch };
  notify();
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("VoiceOverlay", () => {
  beforeEach(() => {
    appendTranscriptMock.mockReset();
    appendTranscriptMock.mockResolvedValue({ ok: true });
    startMock.mockClear();
    stopMock.mockClear();
    sendUserMessageMock.mockClear();
    toggleMuteMock.mockClear();
    resetMockState();
  });

  it("ne rend rien quand isOpen=false", () => {
    const { queryByTestId } = render(
      <VoiceOverlay isOpen={false} onClose={() => {}} />,
    );
    expect(queryByTestId("voice-overlay")).toBeNull();
  });

  it("rend l'overlay fixé bottom-right avec z-index 1000 quand isOpen=true", async () => {
    render(<VoiceOverlay isOpen={true} onClose={() => {}} title="Ma vidéo" />);
    const overlay = await screen.findByTestId("voice-overlay");
    expect(overlay).toBeDefined();
    expect(overlay.className).toContain("fixed");
    expect(overlay.className).toContain("bottom-6");
    expect(overlay.className).toContain("right-6");
    expect(overlay.className).toContain("w-[380px]");
    expect(overlay.className).toContain("h-[600px]");
    const inlineStyle = (overlay as HTMLElement).style.zIndex;
    expect(inlineStyle).toBe("1000");
  });

  it("auto-start le voice chat quand l'overlay s'ouvre", async () => {
    render(<VoiceOverlay isOpen={true} onClose={() => {}} />);
    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1));
  });

  it("ne démarre pas automatiquement si autoStart=false", () => {
    render(
      <VoiceOverlay isOpen={true} onClose={() => {}} autoStart={false} />,
    );
    expect(startMock).not.toHaveBeenCalled();
  });

  it("forward chaque transcript user/ai au callback onVoiceMessage", async () => {
    const onVoiceMessage = vi.fn();
    render(
      <VoiceOverlay isOpen={true} onClose={() => {}} onVoiceMessage={onVoiceMessage} />,
    );
    // Simulate the call connecting and producing two turns.
    act(() => {
      updateMockState({
        status: "listening",
        voiceSessionId: "sess-abc",
        sessionStartedAt: Date.now() - 2000,
      });
    });
    act(() => {
      updateMockState({
        messages: [
          { text: "Salut", source: "user" },
          { text: "Bonjour !", source: "ai" },
        ],
      });
    });

    await waitFor(() => expect(onVoiceMessage).toHaveBeenCalledTimes(2));
    const firstCall = onVoiceMessage.mock.calls[0][0];
    const secondCall = onVoiceMessage.mock.calls[1][0];
    expect(firstCall.text).toBe("Salut");
    expect(firstCall.source).toBe("user");
    expect(firstCall.voiceSessionId).toBe("sess-abc");
    expect(typeof firstCall.timeInCallSecs).toBe("number");
    expect(secondCall.source).toBe("ai");
  });

  it("persiste chaque transcript via voiceApi.appendTranscript avec voice_session_id", async () => {
    render(<VoiceOverlay isOpen={true} onClose={() => {}} />);
    act(() => {
      updateMockState({
        status: "listening",
        voiceSessionId: "sess-xyz",
        sessionStartedAt: Date.now() - 1000,
      });
    });
    act(() => {
      updateMockState({
        messages: [{ text: "Une question", source: "user" }],
      });
    });

    await waitFor(() => expect(appendTranscriptMock).toHaveBeenCalledTimes(1));
    const arg = appendTranscriptMock.mock.calls[0][0];
    expect(arg.voice_session_id).toBe("sess-xyz");
    expect(arg.speaker).toBe("user");
    expect(arg.content).toBe("Une question");
    expect(typeof arg.time_in_call_secs).toBe("number");
  });

  it("fallback gracieux si appendTranscript échoue (B1 pas live)", async () => {
    appendTranscriptMock.mockRejectedValue(
      Object.assign(new Error("HTTP 404"), { status: 404 }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<VoiceOverlay isOpen={true} onClose={() => {}} />);
    act(() => {
      updateMockState({
        status: "listening",
        voiceSessionId: "sess-1",
        sessionStartedAt: Date.now(),
      });
    });
    act(() => {
      updateMockState({ messages: [{ text: "hi", source: "user" }] });
    });

    await waitFor(() => expect(appendTranscriptMock).toHaveBeenCalled());
    await waitFor(() => expect(warnSpy).toHaveBeenCalled());
    warnSpy.mockRestore();
  });

  it("ne tente pas de persister si voiceSessionId est null", async () => {
    render(<VoiceOverlay isOpen={true} onClose={() => {}} />);
    act(() => {
      updateMockState({
        status: "listening",
        voiceSessionId: null,
        messages: [{ text: "hello", source: "user" }],
      });
    });
    // Allow effects to flush
    await waitFor(() => {
      expect(appendTranscriptMock).not.toHaveBeenCalled();
    });
  });

  it("expose un controller via controllerRef pour sendUserMessage", async () => {
    const ref: React.MutableRefObject<VoiceOverlayController | null> = {
      current: null,
    };
    render(
      <VoiceOverlay isOpen={true} onClose={() => {}} controllerRef={ref} />,
    );
    act(() => {
      updateMockState({
        status: "listening",
        voiceSessionId: "sess-42",
        sessionStartedAt: Date.now(),
      });
    });
    await waitFor(() => expect(ref.current?.isActive).toBe(true));
    expect(ref.current?.voiceSessionId).toBe("sess-42");
    ref.current?.sendUserMessage("from text input");
    expect(sendUserMessageMock).toHaveBeenCalledWith("from text input");
  });

  it("le bouton End ferme l'overlay et stop le hook voice", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<VoiceOverlay isOpen={true} onClose={onClose} />);
    const endBtn = await screen.findByTestId("voice-overlay-end");
    await user.click(endBtn);
    await waitFor(() => expect(stopMock).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
