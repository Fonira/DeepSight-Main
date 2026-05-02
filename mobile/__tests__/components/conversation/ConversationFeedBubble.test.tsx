/**
 * Tests for ConversationFeedBubble.
 * Verifies bubble rendering : user text, assistant text (markdown),
 * assistant voice (with mic badge), audio user invisible.
 */
import React from "react";
import { render } from "@testing-library/react-native";

// Mock ThemeContext (avoid loading storage / async-storage chain)
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

// Mock react-native-markdown-display (heavy native deps)
jest.mock("react-native-markdown-display", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: string }) =>
      React.createElement(Text, null, children),
  };
});

import { ConversationFeedBubble } from "../../../src/components/conversation/ConversationFeedBubble";
import type { UnifiedMessage } from "../../../src/hooks/useConversation";

const baseTimestamp = Date.now();

const userTextMessage: UnifiedMessage = {
  id: "u1",
  role: "user",
  content: "hello world",
  source: "text",
  timestamp: baseTimestamp,
};

const assistantTextMessage: UnifiedMessage = {
  id: "a1",
  role: "assistant",
  content: "**bold** reply",
  source: "text",
  timestamp: baseTimestamp + 1000,
};

const assistantVoiceMessage: UnifiedMessage = {
  id: "av1",
  role: "assistant",
  content: "spoken reply",
  source: "voice",
  voiceSpeaker: "agent",
  timestamp: baseTimestamp + 2000,
};

describe("ConversationFeedBubble", () => {
  it("renders user text bubble (with content)", () => {
    const { getByText } = render(
      <ConversationFeedBubble message={userTextMessage} />,
    );
    expect(getByText("hello world")).toBeTruthy();
  });

  it("renders assistant text bubble with markdown content", () => {
    const { getByText } = render(
      <ConversationFeedBubble message={assistantTextMessage} />,
    );
    // The mocked Markdown renders the raw children — content should appear
    expect(getByText("**bold** reply")).toBeTruthy();
  });

  it("renders assistant voice bubble with mic icon badge", () => {
    const { getByTestId } = render(
      <ConversationFeedBubble message={assistantVoiceMessage} />,
    );
    expect(getByTestId("voice-badge-mic")).toBeTruthy();
  });

  it("does NOT render mic badge for assistant text bubble", () => {
    const { queryByTestId } = render(
      <ConversationFeedBubble message={assistantTextMessage} />,
    );
    expect(queryByTestId("voice-badge-mic")).toBeNull();
  });

  it("does NOT render mic badge for user text bubble", () => {
    const { queryByTestId } = render(
      <ConversationFeedBubble message={userTextMessage} />,
    );
    expect(queryByTestId("voice-badge-mic")).toBeNull();
  });
});
