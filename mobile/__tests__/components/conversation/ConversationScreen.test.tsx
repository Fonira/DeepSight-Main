/**
 * Tests for ConversationScreen (thin Modal wrapper around ConversationContent).
 *
 * Le contenu UI est testé dans `ConversationContent.test.tsx`. Ici on
 * vérifie uniquement le wrapper Modal :
 *   - Modal visible quand visible=true
 *   - onClose câblé à onRequestClose
 *   - contentProps transmis à ConversationContent (forwarding)
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Alert, Modal } from "react-native";

// ─── Mocks ───
const mockUseConversation = jest.fn();

jest.mock("../../../src/hooks/useConversation", () => ({
  useConversation: (...args: any[]) => mockUseConversation(...args),
}));

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

jest.mock("react-native-markdown-display", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: string }) =>
      React.createElement(Text, null, children),
  };
});

jest.mock("../../../src/components/voice/VoiceAddonModal", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => React.createElement(View, null),
  };
});

jest.mock("../../../src/components/voice/VoiceSettings", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    VoiceSettings: () => React.createElement(View, null),
  };
});

jest.spyOn(Alert, "alert").mockImplementation(() => {});

import { ConversationScreen } from "../../../src/components/conversation/ConversationScreen";
import type { UnifiedMessage } from "../../../src/hooks/useConversation";

const defaultReturn = (overrides = {}) => ({
  messages: [] as UnifiedMessage[],
  voiceMode: "off" as const,
  endedToastVisible: false,
  summaryId: "1",
  sendMessage: jest.fn(),
  requestStartCall: jest.fn(),
  endCall: jest.fn(),
  toggleMute: jest.fn(),
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

describe("ConversationScreen (wrapper Modal)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConversation.mockReturnValue(defaultReturn());
  });

  it("renders Modal with visible=true", () => {
    const { UNSAFE_getByType } = render(
      <ConversationScreen
        visible
        summaryId="1"
        initialMode="chat"
        videoTitle="Test"
        onClose={jest.fn()}
      />,
    );
    const modal = UNSAFE_getByType(Modal);
    expect(modal.props.visible).toBe(true);
  });

  it("forwards onClose to onRequestClose", () => {
    const onClose = jest.fn();
    const { UNSAFE_getByType } = render(
      <ConversationScreen
        visible
        summaryId="1"
        initialMode="chat"
        videoTitle="Test"
        onClose={onClose}
      />,
    );
    const modal = UNSAFE_getByType(Modal);
    modal.props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("passes contentProps through to ConversationContent (header close button works)", () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <ConversationScreen
        visible
        summaryId="1"
        initialMode="chat"
        videoTitle="Test"
        onClose={onClose}
      />,
    );
    // Le bouton close du header doit être câblé via l'onClose forwardé
    const closeBtn = getByLabelText("Fermer");
    fireEvent.press(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
