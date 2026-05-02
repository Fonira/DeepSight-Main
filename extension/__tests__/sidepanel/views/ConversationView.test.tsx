/**
 * Tests — ConversationView (extension)
 *
 * Smoke test : la vue rend sans crash, expose les sous-composants clés
 * (header, feed, input), et active VoiceControls quand voiceMode est 'live'.
 *
 * On mock le hook `useConversation` pour pouvoir injecter des états
 * arbitraires (pas de chrome.runtime, pas de SDK ElevenLabs).
 */

import React from "react";
import { render } from "@testing-library/react";
import { ConversationView } from "../../../src/sidepanel/views/ConversationView";
import type { UseConversationResult } from "../../../src/sidepanel/hooks/useConversation";

let mockConv: UseConversationResult;

jest.mock("../../../src/sidepanel/hooks/useConversation", () => ({
  __esModule: true,
  useConversation: () => mockConv,
}));

jest.mock("../../../src/i18n/useTranslation", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: {
      common: {
        back: "Retour",
        send: "Envoyer",
        viewPlans: "Voir les plans",
      },
      synthesis: { chat: "Chat" },
      chat: {
        suggestions: ["q1", "q2", "q3"],
        welcome: "Bienvenue",
        webEnriched: "enriched",
        webSearchEnable: "Active web",
        webSearchDisable: "Coupe web",
        webSearchLocked: "Locked",
        inputPlaceholder: "Tapez...",
        expiredPlaceholder: "Expired",
        sessionExpired: "Session expirée",
        reconnect: "Reconnecter",
        clear: { buttonAriaLabel: "clear" },
      },
      voiceCall: {
        ctxBar: {
          phaseSearching: "search",
          phaseTranscriptReceived: "transcript {n}/{total}",
          phaseMistralAnalyzing: "mistral",
          phaseComplete: "done",
          ariaPhaseSearching: "search",
          ariaPhaseTranscriptReceived: "transcript",
          ariaPhaseMistralAnalyzing: "mistral",
          ariaPhaseComplete: "done",
          inProgress: "{percent}%",
          complete: "done",
          ariaInProgress: "{percent}",
          ariaComplete: "done",
        },
        errors: { callEnded: "ended" },
      },
    },
    language: "fr",
  }),
}));

const baseConv: UseConversationResult = {
  messages: [],
  voiceMode: "off",
  endedToastVisible: false,
  lastCallDurationSec: 0,
  voiceStatus: "idle",
  elapsedSec: 0,
  isMuted: false,
  loadingHistory: false,
  loading: false,
  sessionExpired: false,
  webSearchEnabled: false,
  setWebSearchEnabled: jest.fn(),
  contextProgress: 0,
  contextComplete: false,
  voiceConversationActive: false,
  resolvedSummaryId: 42,
  sendMessage: jest.fn().mockResolvedValue(undefined),
  requestStartCall: jest.fn(),
  endCall: jest.fn().mockResolvedValue(undefined),
  toggleMute: jest.fn(),
  clearHistory: jest.fn().mockResolvedValue(undefined),
};

describe("ConversationView", () => {
  beforeEach(() => {
    mockConv = { ...baseConv };
  });

  it("renders the view container with header + feed + input", () => {
    const { getByTestId } = render(
      <ConversationView
        summaryId={42}
        videoTitle="Test"
        initialMode="chat"
        onClose={jest.fn()}
      />,
    );
    expect(getByTestId("conversation-view")).toBeTruthy();
    expect(getByTestId("conversation-input")).toBeTruthy();
  });

  it("renders empty-state suggestions when messages is empty", () => {
    const { getByText } = render(
      <ConversationView
        summaryId={42}
        videoTitle="Test"
        initialMode="chat"
        onClose={jest.fn()}
      />,
    );
    expect(getByText("q1")).toBeTruthy();
    expect(getByText("q2")).toBeTruthy();
    expect(getByText("q3")).toBeTruthy();
  });

  it("renders VoiceControls when voiceMode='live'", () => {
    mockConv = { ...baseConv, voiceMode: "live", elapsedSec: 5 };
    const { getByTestId } = render(
      <ConversationView
        summaryId={42}
        videoTitle="Test"
        initialMode="chat"
        onClose={jest.fn()}
      />,
    );
    expect(getByTestId("voice-controls-live")).toBeTruthy();
    expect(getByTestId("voice-controls-mute")).toBeTruthy();
    expect(getByTestId("voice-controls-hangup")).toBeTruthy();
  });

  it("does NOT render VoiceControls when voiceMode='off'", () => {
    const { queryByTestId } = render(
      <ConversationView
        summaryId={42}
        videoTitle="Test"
        initialMode="chat"
        onClose={jest.fn()}
      />,
    );
    expect(queryByTestId("voice-controls-live")).toBeNull();
    expect(queryByTestId("voice-controls-quota")).toBeNull();
  });

  it("renders quota_exceeded controls with upgrade CTA", () => {
    mockConv = { ...baseConv, voiceMode: "quota_exceeded" };
    const { getByTestId } = render(
      <ConversationView
        summaryId={42}
        videoTitle="Test"
        initialMode="chat"
        onClose={jest.fn()}
      />,
    );
    expect(getByTestId("voice-controls-quota")).toBeTruthy();
  });

  it("renders EndedToast when endedToastVisible=true", () => {
    mockConv = {
      ...baseConv,
      voiceMode: "ended",
      endedToastVisible: true,
      lastCallDurationSec: 184,
    };
    const { getByTestId } = render(
      <ConversationView
        summaryId={42}
        videoTitle="Test"
        initialMode="chat"
        onClose={jest.fn()}
      />,
    );
    expect(getByTestId("ended-toast")).toBeTruthy();
  });

  it("renders user/assistant bubbles with voice user filter applied (already done in hook)", () => {
    mockConv = {
      ...baseConv,
      messages: [
        {
          id: "1",
          role: "user",
          content: "typed",
          source: "text",
          timestamp: 1,
        },
        {
          id: "2",
          role: "assistant",
          content: "voiced",
          source: "voice",
          voiceSpeaker: "agent",
          timestamp: 2,
        },
      ],
    };
    const { getByText, getByTestId } = render(
      <ConversationView
        summaryId={42}
        videoTitle="Test"
        initialMode="chat"
        onClose={jest.fn()}
      />,
    );
    expect(getByText("typed")).toBeTruthy();
    // assistant voice bubble has the mic badge
    expect(getByTestId("voice-badge-mic")).toBeTruthy();
  });
});
