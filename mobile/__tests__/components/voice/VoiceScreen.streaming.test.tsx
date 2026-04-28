/**
 * VoiceScreen.streaming.test.tsx — Quick Voice Call mobile V3
 *
 * Tests de la variante streaming (props `streaming`, `contextProgress`,
 * `contextComplete`) — affichage conditionnel de la barre de progression.
 */

import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("../../../src/contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: "#0a0a0f",
      bgSecondary: "#1a1a2e",
      bgTertiary: "#2a2a3e",
      textPrimary: "#ffffff",
      textSecondary: "#888888",
      textTertiary: "#666666",
      accentPrimary: "#6366f1",
      accentWarning: "#f59e0b",
      border: "#333333",
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock("../../../src/theme/spacing", () => ({
  sp: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32 },
  borderRadius: { sm: 4, md: 8, lg: 12, full: 9999 },
}));

jest.mock("../../../src/theme/typography", () => ({
  fontFamily: {
    body: "System",
    bodyMedium: "System",
    bodySemiBold: "System",
    mono: "Courier",
  },
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18 },
}));

jest.mock("../../../src/theme/colors", () => ({
  palette: {
    gold: "#f59e0b",
    white: "#ffffff",
    red: "#ef4444",
  },
}));

jest.mock("../../../src/theme/animations", () => ({
  duration: { slow: 300, slower: 500 },
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const AnimatedView = View;
  const Animated = {
    View: AnimatedView,
    createAnimatedComponent: (c: React.ComponentType) => c,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useAnimatedStyle: () => ({}),
    useSharedValue: (val: number) => ({ value: val }),
    withRepeat: (val: unknown) => val,
    withSpring: (val: unknown) => val,
    withTiming: (val: unknown) => val,
    withSequence: (...args: unknown[]) => args[0],
    withDelay: (_: number, val: unknown) => val,
    FadeIn: { duration: () => ({ springify: () => ({}) }) },
    SlideInDown: { duration: () => ({ springify: () => ({}) }) },
    Easing: {
      inOut: (fn: unknown) => fn,
      out: (fn: unknown) => fn,
      in: (fn: unknown) => fn,
      ease: {},
    },
  };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

import { VoiceScreen } from "../../../src/components/voice/VoiceScreen";

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  videoTitle: "Test",
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
  test("does NOT show progress bar when streaming=false", () => {
    const { queryByTestId } = render(
      <VoiceScreen {...baseProps} streaming={false} />,
    );
    expect(queryByTestId("context-progress-bar")).toBeNull();
  });

  test("does NOT show progress bar when streaming prop omitted", () => {
    const { queryByTestId } = render(<VoiceScreen {...baseProps} />);
    expect(queryByTestId("context-progress-bar")).toBeNull();
  });

  test("shows progress bar with percent when streaming=true and contextProgress=60", () => {
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
    expect(getByText(/Analyse en cours/i)).toBeTruthy();
  });

  test("shows 'contexte complet' label when contextComplete=true", () => {
    const { getByText, queryByText } = render(
      <VoiceScreen
        {...baseProps}
        streaming={true}
        contextProgress={100}
        contextComplete={true}
      />,
    );
    expect(getByText(/contexte.*complet/i)).toBeTruthy();
    // Plus de pourcentage visible quand complet
    expect(queryByText(/Analyse en cours/i)).toBeNull();
  });
});
