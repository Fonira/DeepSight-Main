/**
 * Tests for ConversationHeader.
 * Verifies callbacks + haptics on settings/close + title rendering.
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

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

jest.mock("../../../src/components/voice/VoiceQuotaBadge", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    VoiceQuotaBadge: ({ minutesRemaining }: { minutesRemaining: number }) =>
      React.createElement(View, {
        testID: "voice-quota-badge",
        accessibilityLabel: `${minutesRemaining} minutes`,
      }),
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

import { ConversationHeader } from "../../../src/components/conversation/ConversationHeader";
import { haptics } from "../../../src/utils/haptics";

const baseProps = {
  videoTitle: "Comment programmer en TypeScript",
  channelName: "Tech Channel",
  platform: "youtube" as const,
  remainingMinutes: 12,
  onOpenSettings: jest.fn(),
  onOpenAddon: jest.fn(),
  onClose: jest.fn(),
};

describe("ConversationHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title + channel", () => {
    const { getByText } = render(<ConversationHeader {...baseProps} />);
    expect(getByText("Comment programmer en TypeScript")).toBeTruthy();
    expect(getByText("Tech Channel")).toBeTruthy();
  });

  it("renders YT badge for youtube platform", () => {
    const { getByText } = render(<ConversationHeader {...baseProps} />);
    expect(getByText("YT")).toBeTruthy();
  });

  it("renders TikTok badge for tiktok platform", () => {
    const { getByText } = render(
      <ConversationHeader {...baseProps} platform="tiktok" />,
    );
    expect(getByText("TikTok")).toBeTruthy();
  });

  it("renders Live badge for live platform", () => {
    const { getByText } = render(
      <ConversationHeader {...baseProps} platform="live" />,
    );
    expect(getByText("Live")).toBeTruthy();
  });

  it("fires haptics.light + onOpenSettings on settings tap", () => {
    const onOpenSettings = jest.fn();
    const { getByTestId } = render(
      <ConversationHeader {...baseProps} onOpenSettings={onOpenSettings} />,
    );
    fireEvent.press(getByTestId("header-settings"));
    expect(haptics.light).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("fires haptics.light + onClose on close tap", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ConversationHeader {...baseProps} onClose={onClose} />,
    );
    fireEvent.press(getByTestId("header-close"));
    expect(haptics.light).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders VoiceQuotaBadge with remainingMinutes", () => {
    const { getByLabelText } = render(
      <ConversationHeader {...baseProps} remainingMinutes={42} />,
    );
    expect(getByLabelText("42 minutes")).toBeTruthy();
  });
});
