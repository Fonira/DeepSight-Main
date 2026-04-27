/** @jest-environment jsdom */
//
// Tests — PostHog instrumentation in VoiceView (Quick Voice Call Task 19)
//
// Vérifie qu'à chaque transition de phase, on track l'event analytics
// approprié. L'instrumentation passe par `extension/src/utils/analytics.ts`
// (qui no-op si window.posthog n'est pas défini).
import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import {
  getTrackedEvents,
  resetTrackedEvents,
} from "../../src/utils/analytics";

const startSessionMock = jest.fn();
const endSessionMock = jest.fn();
const toggleMuteMock = jest.fn();

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

jest.mock("../../src/sidepanel/hooks/useStreamingVideoContext", () => ({
  useStreamingVideoContext: () => ({
    contextProgress: 0,
    contextComplete: false,
  }),
}));

import { VoiceView } from "../../src/sidepanel/VoiceView";

// Quick Voice Call (B4) — VoiceView reçoit pendingCall en prop. App.tsx est
// désormais responsable de la lecture/suppression session storage. Les tests
// passent donc directement le payload en prop.
const PENDING_CALL = { videoId: "abc", videoTitle: "Test" };

describe("VoiceView PostHog instrumentation", () => {
  beforeEach(() => {
    resetTrackedEvents();
    startSessionMock.mockReset();
    endSessionMock.mockReset();
    chrome.runtime.sendMessage = jest.fn();
  });

  it("tracks voice_call_started when session is created", async () => {
    startSessionMock.mockResolvedValue({
      session_id: "s1",
      signed_url: "wss://...",
      max_minutes: 3,
      is_trial: true,
    });

    await act(async () => {
      render(<VoiceView pendingCall={PENDING_CALL} />);
    });

    await waitFor(() => {
      const events = getTrackedEvents().map((e) => e.event);
      expect(events).toContain("voice_call_started");
    });
  });

  it("tracks voice_call_upgrade_cta_shown when 402 quota error fires", async () => {
    const err = new StubVoiceQuotaError("PaymentRequired", 402, {
      reason: "pro_no_voice",
    });
    startSessionMock.mockRejectedValue(err);

    await act(async () => {
      render(<VoiceView pendingCall={PENDING_CALL} />);
    });

    await waitFor(() => {
      const events = getTrackedEvents().map((e) => e.event);
      expect(events).toContain("voice_call_upgrade_cta_shown");
    });
  });
});
