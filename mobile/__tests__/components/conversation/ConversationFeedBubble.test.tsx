/**
 * Tests for ConversationFeedBubble.
 * Verifies bubble rendering : user text, assistant text (markdown),
 * assistant voice (with mic badge), audio user invisible.
 *
 * Polish (mai 2026) : long-press copy + haptic + onCopy callback.
 */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";

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

jest.mock("../../../src/utils/haptics", () => ({
  haptics: {
    selection: jest.fn(() => Promise.resolve()),
    light: jest.fn(() => Promise.resolve()),
    medium: jest.fn(() => Promise.resolve()),
    heavy: jest.fn(() => Promise.resolve()),
    success: jest.fn(() => Promise.resolve()),
    warning: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve()),
  },
}));

import { ConversationFeedBubble } from "../../../src/components/conversation/ConversationFeedBubble";
import { haptics } from "../../../src/utils/haptics";
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("long-press on user bubble copies content to clipboard + haptic success", async () => {
    const onCopy = jest.fn();
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValueOnce(true);
    const { getByLabelText } = render(
      <ConversationFeedBubble message={userTextMessage} onCopy={onCopy} />,
    );
    const bubble = getByLabelText(/Vous.*hello world/);
    await act(async () => {
      fireEvent(bubble, "longPress");
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("hello world");
    expect(haptics.success).toHaveBeenCalled();
    expect(onCopy).toHaveBeenCalledWith("hello world");
  });

  it("long-press on assistant bubble copies content + onCopy callback", async () => {
    const onCopy = jest.fn();
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValueOnce(true);
    const { getByLabelText } = render(
      <ConversationFeedBubble
        message={assistantTextMessage}
        onCopy={onCopy}
      />,
    );
    const bubble = getByLabelText(/Assistant.*bold/);
    await act(async () => {
      fireEvent(bubble, "longPress");
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("**bold** reply");
    expect(onCopy).toHaveBeenCalledWith("**bold** reply");
  });

  it("long-press fires haptics.error on clipboard failure", async () => {
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(
      new Error("clipboard unavailable"),
    );
    const { getByLabelText } = render(
      <ConversationFeedBubble message={userTextMessage} />,
    );
    const bubble = getByLabelText(/Vous/);
    await act(async () => {
      fireEvent(bubble, "longPress");
    });
    expect(haptics.error).toHaveBeenCalled();
    expect(haptics.success).not.toHaveBeenCalled();
  });

  it("accessibility label includes role + voice tag for voice agent message", () => {
    const { getByLabelText } = render(
      <ConversationFeedBubble message={assistantVoiceMessage} />,
    );
    expect(getByLabelText(/Assistant \(voix\).*spoken reply/)).toBeTruthy();
  });
});
