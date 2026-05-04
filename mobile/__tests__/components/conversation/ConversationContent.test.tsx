/**
 * Tests for ConversationContent (root content component, embedded-friendly).
 *
 * Cover spec §11.2 scenarios sans Modal wrapper :
 * - empty state with suggestion chips
 * - chat bubbles user/assistant
 * - voice agent bubble with mic badge
 * - NO voice user bubble (filtered upstream)
 * - VoiceControls 'off' default
 * - VoiceControls 'live' when voice active
 * - EndedToast on hangup
 * - mic button confirm dialog when voiceMode='off'
 * - mic button toggleMute when voiceMode='live'
 * - onMenuPress callback prop accepted (Hub embedded mode)
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";

// ─── Mocks ───
const mockSendMessage = jest.fn();
const mockRequestStartCall = jest.fn();
const mockEndCall = jest.fn();
const mockToggleMute = jest.fn();
const mockUseConversation = jest.fn();

jest.mock("../../../src/hooks/useConversation", () => ({
  useConversation: (...args: any[]) => mockUseConversation(...args),
}));

// Mock ThemeContext
jest.mock("../../../src/contexts/ThemeContext", () => {
  const { darkColors } = jest.requireActual("../../../src/theme/colors");
  return {
    useTheme: () => ({
      colors: darkColors,
      isDark: true,
      theme: "dark" as const,
      setTheme: jest.fn(),
      toggleTheme: jest.fn(),
    }),
  };
});

// Mock react-native-markdown-display
jest.mock("react-native-markdown-display", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: string }) =>
      React.createElement(Text, null, children),
  };
});

// Mock VoiceAddonModal (heavy deps)
jest.mock("../../../src/components/voice/VoiceAddonModal", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => React.createElement(View, null),
  };
});

// Mock VoiceSettings (heavy bottom-sheet/native deps)
jest.mock("../../../src/components/voice/VoiceSettings", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    VoiceSettings: () => React.createElement(View, null),
  };
});

// Mock HubAnalysisSheet (uses useQuery + bottom-sheet)
jest.mock("../../../src/components/hub/HubAnalysisSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    HubAnalysisSheet: React.forwardRef(() => React.createElement(View, null)),
  };
});

jest.spyOn(Alert, "alert").mockImplementation(() => {});

import { ConversationContent } from "../../../src/components/conversation/ConversationContent";
import type { UnifiedMessage } from "../../../src/hooks/useConversation";

const baseTimestamp = Date.now();

const defaultReturn = (overrides = {}) => ({
  messages: [] as UnifiedMessage[],
  voiceMode: "off" as const,
  endedToastVisible: false,
  summaryId: "1",
  sendMessage: mockSendMessage,
  requestStartCall: mockRequestStartCall,
  endCall: mockEndCall,
  toggleMute: mockToggleMute,
  isMuted: false,
  isSpeaking: false,
  elapsedSeconds: 0,
  remainingMinutes: 30,
  isLoading: false,
  contextProgress: 0,
  contextComplete: false,
  streaming: false,
  error: null,
  ...overrides,
});

describe("ConversationContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without Modal wrapper (embedded-friendly)", () => {
    mockUseConversation.mockReturnValue(defaultReturn());
    const { getByText, queryByLabelText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    // Empty welcome state visible (proves header + feed render)
    expect(getByText("Conversation")).toBeTruthy();
    expect(getByText("Pose une question sur cette vidéo...")).toBeTruthy();
    // Pas de close button quand onClose absent (mode embedded)
    expect(queryByLabelText("Fermer")).toBeNull();
  });

  it("renders empty state with welcome message when messages.length === 0", () => {
    mockUseConversation.mockReturnValue(defaultReturn());
    const { getByText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    expect(getByText("Conversation")).toBeTruthy();
  });

  it("renders chat bubbles with user/assistant differentiation", () => {
    mockUseConversation.mockReturnValue(
      defaultReturn({
        messages: [
          {
            id: "u1",
            role: "user",
            content: "Hi",
            source: "text",
            timestamp: baseTimestamp,
          },
          {
            id: "a1",
            role: "assistant",
            content: "Hello back",
            source: "text",
            timestamp: baseTimestamp + 1000,
          },
        ] as UnifiedMessage[],
      }),
    );
    const { getByText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    expect(getByText("Hi")).toBeTruthy();
    expect(getByText("Hello back")).toBeTruthy();
  });

  it("renders voice agent bubble with mic badge", () => {
    mockUseConversation.mockReturnValue(
      defaultReturn({
        messages: [
          {
            id: "av1",
            role: "assistant",
            content: "Voiced reply",
            source: "voice",
            voiceSpeaker: "agent",
            timestamp: baseTimestamp,
          },
        ] as UnifiedMessage[],
      }),
    );
    const { getByTestId } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    expect(getByTestId("voice-badge-mic")).toBeTruthy();
  });

  it("does NOT render voice user bubble (filtered upstream by useConversation)", () => {
    mockUseConversation.mockReturnValue(
      defaultReturn({
        messages: [
          {
            id: "av1",
            role: "assistant",
            content: "Agent response",
            source: "voice",
            voiceSpeaker: "agent",
            timestamp: baseTimestamp,
          },
        ] as UnifiedMessage[],
      }),
    );
    const { queryByText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    expect(queryByText("(user voice content)")).toBeNull();
  });

  it("renders VoiceControls in 'off' state by default", () => {
    mockUseConversation.mockReturnValue(defaultReturn());
    const { getByText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    expect(getByText("Appel non démarré")).toBeTruthy();
  });

  it("renders VoiceControls in 'live' state when voiceMode='live'", () => {
    mockUseConversation.mockReturnValue(
      defaultReturn({ voiceMode: "live", elapsedSeconds: 34 }),
    );
    const { getByLabelText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    expect(getByLabelText("Couper micro")).toBeTruthy();
    expect(getByLabelText("Terminer l'appel")).toBeTruthy();
  });

  it("renders EndedToast when endedToastVisible=true", () => {
    mockUseConversation.mockReturnValue(
      defaultReturn({
        voiceMode: "ended",
        endedToastVisible: true,
        elapsedSeconds: 272,
      }),
    );
    const { getByTestId } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    expect(getByTestId("ended-toast")).toBeTruthy();
  });

  it("mic button calls requestStartCall when voiceMode='off'", () => {
    mockUseConversation.mockReturnValue(defaultReturn());
    const { getByLabelText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    const micBtn = getByLabelText("Démarrer un appel vocal");
    fireEvent.press(micBtn);
    expect(mockRequestStartCall).toHaveBeenCalled();
  });

  it("mic button calls toggleMute when voiceMode='live'", () => {
    mockUseConversation.mockReturnValue(
      defaultReturn({ voiceMode: "live", isMuted: false }),
    );
    const { getByLabelText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
      />,
    );
    const micInputBtn = getByLabelText("Couper le micro");
    fireEvent.press(micInputBtn);
    expect(mockToggleMute).toHaveBeenCalled();
  });

  it("accepts onMenuPress callback prop (Hub tab embedded mode)", () => {
    const onMenuPress = jest.fn();
    mockUseConversation.mockReturnValue(defaultReturn());
    const { getByLabelText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Some video"
        onMenuPress={onMenuPress}
      />,
    );
    // Le burger doit être rendu et fonctionnel quand onMenuPress est fourni
    const menuBtn = getByLabelText("Conversations");
    fireEvent.press(menuBtn);
    expect(onMenuPress).toHaveBeenCalled();
  });
});
