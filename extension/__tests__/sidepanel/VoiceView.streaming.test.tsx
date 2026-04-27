/** @jest-environment jsdom */
//
// Tests — VoiceView state machine (Task 16)
//
// Vérifie le wiring complet :
//   1. lit `pendingVoiceCall` depuis chrome.storage.session
//   2. transitions phase: connecting → live_streaming
//   3. erreur 402 (Pro sans voice) → UpgradeCTA
//
// On mock le hook `useExtensionVoiceChat` car le SDK ElevenLabs nécessite
// une vraie WebSocket vers `wss://api.elevenlabs.io` et n'est pas
// disponible en jsdom.
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";

// Mock useExtensionVoiceChat avant l'import de VoiceView.
const startSessionMock = jest.fn();
const endSessionMock = jest.fn();
const toggleMuteMock = jest.fn();

// Mini stub class for VoiceQuotaError pour que `e instanceof VoiceQuotaError`
// fonctionne dans VoiceView (sinon TypeError écrasé silencieusement).
class StubVoiceQuotaError extends Error {
  status: number;
  detail: { reason?: string };
  constructor(
    message: string,
    status: number,
    detail: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.detail = detail as { reason?: string };
  }
}

jest.mock("../../src/sidepanel/useExtensionVoiceChat", () => ({
  useExtensionVoiceChat: () => ({
    startSession: startSessionMock,
    endSession: endSessionMock,
    toggleMute: toggleMuteMock,
    conversation: null,
    lastSessionWasTrial: true,
    status: "idle",
    error: null,
    transcripts: [],
    sessionId: null,
    isActive: false,
    start: jest.fn(),
    stop: jest.fn(),
    appendTranscript: jest.fn(),
  }),
  VoiceQuotaError: StubVoiceQuotaError,
  __setElevenLabsSdkForTests: jest.fn(),
}));

// Stub the streaming hook (its internals are tested separately).
jest.mock("../../src/sidepanel/hooks/useStreamingVideoContext", () => ({
  useStreamingVideoContext: () => ({
    contextProgress: 0,
    contextComplete: false,
  }),
}));

import { VoiceView } from "../../src/sidepanel/VoiceView";

describe("VoiceView streaming flow", () => {
  beforeEach(() => {
    startSessionMock.mockReset();
    endSessionMock.mockReset();
    toggleMuteMock.mockReset();
    const c = global as unknown as {
      chrome: {
        storage: {
          session?: { get: jest.Mock; remove: jest.Mock; set?: jest.Mock };
        };
      };
    };
    c.chrome.storage.session = {
      get: jest.fn().mockResolvedValue({
        pendingVoiceCall: { videoId: "abc", videoTitle: "Test Video" },
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    chrome.runtime.sendMessage = jest.fn();
  });

  it("starts in connecting phase and transitions to live_streaming after session created", async () => {
    startSessionMock.mockResolvedValue({
      session_id: "s1",
      signed_url: "wss://...",
      conversation_token: "tok",
      max_minutes: 3,
      is_trial: true,
    });

    await act(async () => {
      render(<VoiceView />);
    });

    // After microtask flush we should be in CallActiveView ("En appel").
    await waitFor(() => {
      expect(screen.getByText(/En appel/)).toBeInTheDocument();
    });
  });

  it("shows UpgradeCTA when startSession throws 402 with reason=pro_no_voice", async () => {
    const err = new Error("PaymentRequired") as Error & {
      status?: number;
      detail?: { reason?: string };
    };
    err.status = 402;
    err.detail = { reason: "pro_no_voice" };
    startSessionMock.mockRejectedValue(err);

    let renderResult: ReturnType<typeof render>;
    await act(async () => {
      renderResult = render(<VoiceView />);
    });

    // Confirm startSession was actually called
    await waitFor(() => expect(startSessionMock).toHaveBeenCalled());

    // Allow React to flush the state update from the catch handler.
    // act() ensures the setState runs in a stable batch.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(
      () => {
        expect(renderResult!.container.textContent ?? "").toMatch(
          /Passer en Expert/,
        );
      },
      { timeout: 3000 },
    );
  });
});
