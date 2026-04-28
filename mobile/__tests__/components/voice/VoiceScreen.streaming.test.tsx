import React from "react";
import { render } from "@testing-library/react-native";
import { VoiceScreen } from "../../../src/components/voice/VoiceScreen";

// Minimum mocks to render VoiceScreen — depends on theme/contexts.
jest.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: "#000",
      bgSecondary: "#111",
      bgTertiary: "#222",
      textPrimary: "#fff",
      textSecondary: "#ccc",
      textTertiary: "#999",
      border: "#333",
      brandPrimary: "#f5b400",
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  videoTitle: "Test video",
  voiceStatus: "listening" as const,
  isSpeaking: false,
  messages: [],
  elapsedSeconds: 0,
  remainingMinutes: 30,
  onStart: jest.fn(),
  onStop: jest.fn(),
  onMuteToggle: jest.fn(),
  isMuted: false,
};

describe("VoiceScreen streaming variant", () => {
  test("does NOT render progress bar when streaming=false", () => {
    const { queryByTestId } = render(
      <VoiceScreen {...baseProps} streaming={false} />,
    );
    expect(queryByTestId("context-progress-bar")).toBeNull();
  });

  test("renders progress bar with percent when streaming=true and contextComplete=false", () => {
    const { getByTestId, getByText } = render(
      <VoiceScreen
        {...baseProps}
        streaming={true}
        contextProgress={60}
        contextComplete={false}
      />,
    );
    expect(getByTestId("context-progress-bar")).toBeTruthy();
    expect(getByText(/60%/)).toBeTruthy();
  });

  test("renders 'Contexte vidéo complet' when contextComplete=true", () => {
    const { getByText, queryByText } = render(
      <VoiceScreen
        {...baseProps}
        streaming={true}
        contextProgress={100}
        contextComplete={true}
      />,
    );
    expect(getByText(/Contexte.*complet/i)).toBeTruthy();
    expect(queryByText(/Analyse en cours/)).toBeNull();
  });

  test("clamps progress > 100 visually", () => {
    const { getByText } = render(
      <VoiceScreen
        {...baseProps}
        streaming={true}
        contextProgress={150}
        contextComplete={false}
      />,
    );
    // Math.floor displayed value = 150 (we don't clamp the label, only the bar width)
    expect(getByText(/150%/)).toBeTruthy();
  });
});
