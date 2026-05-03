/**
 * Tests for VoiceControls — focus on testable behaviors :
 * - haptics fired on Mute / End / Upgrade taps
 * - haptics.success fired on live → ended state transition
 * - callbacks invoked
 * - rendering per voiceMode
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

jest.mock("../../../src/components/voice/VoiceAddonModal", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ visible }: { visible: boolean }) =>
      visible ? React.createElement(View, { testID: "addon-modal" }) : null,
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

import { VoiceControls } from "../../../src/components/conversation/VoiceControls";
import { haptics } from "../../../src/utils/haptics";

const baseProps = {
  isMuted: false,
  elapsedSeconds: 12,
  remainingMinutes: 5,
  onToggleMute: jest.fn(),
  onEnd: jest.fn(),
};

describe("VoiceControls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders 'off' label when voiceMode === off", () => {
    const { getByText } = render(
      <VoiceControls voiceMode="off" {...baseProps} />,
    );
    expect(getByText("Appel non démarré")).toBeTruthy();
  });

  it("renders nothing when voiceMode === ended", () => {
    const { toJSON } = render(
      <VoiceControls voiceMode="ended" {...baseProps} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders quota_exceeded card with upgrade CTA", () => {
    const { getByLabelText } = render(
      <VoiceControls voiceMode="quota_exceeded" {...baseProps} />,
    );
    expect(getByLabelText("Acheter des minutes")).toBeTruthy();
  });

  it("fires haptics.medium and onToggleMute on mute tap (live)", () => {
    const onToggleMute = jest.fn();
    const { getByLabelText } = render(
      <VoiceControls
        voiceMode="live"
        {...baseProps}
        onToggleMute={onToggleMute}
      />,
    );
    fireEvent.press(getByLabelText("Couper micro"));
    expect(haptics.medium).toHaveBeenCalled();
    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it("fires haptics.medium and onEnd on End tap (live)", () => {
    const onEnd = jest.fn();
    const { getByLabelText } = render(
      <VoiceControls voiceMode="live" {...baseProps} onEnd={onEnd} />,
    );
    fireEvent.press(getByLabelText("Terminer l'appel"));
    expect(haptics.medium).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("opens VoiceAddonModal + fires haptic on Upgrade tap (quota_exceeded)", () => {
    const { getByLabelText, getByTestId } = render(
      <VoiceControls voiceMode="quota_exceeded" {...baseProps} />,
    );
    fireEvent.press(getByLabelText("Acheter des minutes"));
    expect(haptics.medium).toHaveBeenCalled();
    expect(getByTestId("addon-modal")).toBeTruthy();
  });

  it("fires haptics.success when transitioning live → ended", () => {
    const { rerender } = render(
      <VoiceControls voiceMode="live" {...baseProps} />,
    );
    expect(haptics.success).not.toHaveBeenCalled();
    rerender(<VoiceControls voiceMode="ended" {...baseProps} />);
    expect(haptics.success).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire haptics.success when transitioning off → live", () => {
    const { rerender } = render(
      <VoiceControls voiceMode="off" {...baseProps} />,
    );
    rerender(<VoiceControls voiceMode="live" {...baseProps} />);
    expect(haptics.success).not.toHaveBeenCalled();
  });

  it("renders correct mute label when isMuted=true", () => {
    const { getByLabelText } = render(
      <VoiceControls voiceMode="live" {...baseProps} isMuted={true} />,
    );
    expect(getByLabelText("Réactiver micro")).toBeTruthy();
  });
});
