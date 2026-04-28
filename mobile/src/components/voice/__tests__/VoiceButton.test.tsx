/**
 * VoiceButton.test.tsx — Tests pour le composant VoiceButton (React Native)
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock ThemeContext
jest.mock("../../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      background: "#0a0a0f",
      text: "#ffffff",
      primary: "#6366f1",
    },
  }),
}));

// Mock PlanContext
const mockUseVoiceChatGate = jest.fn();
jest.mock("../../../contexts/PlanContext", () => ({
  useVoiceChatGate: () => mockUseVoiceChatGate(),
}));

// Mock colors / shadows
jest.mock("../../../theme/colors", () => ({
  palette: {
    gold: "#C8903A",
    white: "#ffffff",
    black: "#000000",
  },
}));

jest.mock("../../../theme/shadows", () => ({
  shadows: {
    glow: () => ({
      shadowColor: "#C8903A",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    }),
  },
}));

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

// Mock react-native-reanimated
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
    withSequence: (...args: unknown[]) => args[0],
    withDelay: (_: number, val: unknown) => val,
    runOnJS: (fn: Function) => fn,
  };
});

// Mock Ionicons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// Mock Alert
const mockAlert = jest.fn();
jest
  .spyOn(require("react-native").Alert, "alert")
  .mockImplementation(mockAlert);

import { VoiceButton } from "../VoiceButton";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("VoiceButton (Mobile)", () => {
  const onSessionStart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rend le bouton avec accessibilité quand voice enabled", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: true,
      requiresUpgrade: false,
    });

    const { getByLabelText } = render(
      <VoiceButton
        summaryId="42"
        videoTitle="Test Vidéo"
        onSessionStart={onSessionStart}
      />,
    );

    const button = getByLabelText(/Démarrer le chat vocal/);
    expect(button).toBeTruthy();
  });

  it("affiche le label premium quand upgrade requis", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: false,
      requiresUpgrade: true,
    });

    const { getByLabelText } = render(
      <VoiceButton
        summaryId="42"
        videoTitle="Test Vidéo"
        onSessionStart={onSessionStart}
      />,
    );

    const button = getByLabelText(/premium requis/);
    expect(button).toBeTruthy();
  });

  it("appelle onSessionStart quand pressé et voice enabled", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: true,
      requiresUpgrade: false,
    });

    const { getByLabelText } = render(
      <VoiceButton
        summaryId="42"
        videoTitle="Test Vidéo"
        onSessionStart={onSessionStart}
      />,
    );

    fireEvent.press(getByLabelText(/Démarrer le chat vocal/));
    expect(onSessionStart).toHaveBeenCalledTimes(1);
  });

  it("affiche l'Alert de upgrade au lieu d'appeler onSessionStart", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: false,
      requiresUpgrade: true,
    });

    const { getByLabelText } = render(
      <VoiceButton
        summaryId="42"
        videoTitle="Test Vidéo"
        onSessionStart={onSessionStart}
      />,
    );

    fireEvent.press(getByLabelText(/premium requis/));
    expect(onSessionStart).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith(
      "Fonctionnalité Premium",
      expect.stringContaining("abonnement supérieur"),
      expect.any(Array),
    );
  });

  it("ne fait rien quand disabled=true", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: true,
      requiresUpgrade: false,
    });

    const { getByLabelText } = render(
      <VoiceButton
        summaryId="42"
        videoTitle="Test Vidéo"
        onSessionStart={onSessionStart}
        disabled
      />,
    );

    // Le bouton existe mais disabled empêche le press
    // Le Pressable a disabled={true}
    const button = getByLabelText(/Démarrer le chat vocal/);
    expect(button).toBeTruthy();
  });

  it("inclut le titre de la vidéo dans l'accessibilityLabel", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: true,
      requiresUpgrade: false,
    });

    const { getByLabelText } = render(
      <VoiceButton
        summaryId="42"
        videoTitle="Ma Super Vidéo"
        onSessionStart={onSessionStart}
      />,
    );

    expect(getByLabelText(/Ma Super Vidéo/)).toBeTruthy();
  });

  it("a le hint d'accessibilité correct", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: true,
      requiresUpgrade: false,
    });

    const { getByA11yHint } = render(
      <VoiceButton
        summaryId="42"
        videoTitle="Test"
        onSessionStart={onSessionStart}
      />,
    );

    expect(getByA11yHint(/conversation vocale/)).toBeTruthy();
  });

  // ── Spec #3 — bottomOffset ──

  it("applique le bottomOffset custom passé en prop", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: true,
      requiresUpgrade: false,
    });

    const customOffset = 150;
    const { getByLabelText } = render(
      <VoiceButton
        videoTitle="Test"
        onSessionStart={onSessionStart}
        bottomOffset={customOffset}
      />,
    );

    // On lit l'arbre rendu — le View container parent (du Pressable) doit
    // avoir bottom = 150. Structure : <View container> > <Pressable>.
    const button = getByLabelText(/Démarrer le chat vocal/);
    // Remonte les wrappers du test renderer jusqu'à trouver le style avec `bottom`.
    let node: any = button.parent;
    let bottomFound: number | undefined;
    while (node && bottomFound === undefined) {
      const style = node.props?.style;
      const flat = Array.isArray(style)
        ? style.flat().reduce((a: any, s: any) => ({ ...a, ...s }), {})
        : style;
      if (flat?.bottom !== undefined) {
        bottomFound = flat.bottom;
        break;
      }
      node = node.parent;
    }
    expect(bottomFound).toBe(customOffset);
  });

  it("rend sans summaryId quand agentType=companion (mode sans vidéo)", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: true,
      requiresUpgrade: false,
    });

    const { getByLabelText } = render(
      <VoiceButton
        videoTitle="Discussion libre"
        agentType="companion"
        onSessionStart={onSessionStart}
      />,
    );

    expect(getByLabelText(/chat vocal/i)).toBeTruthy();
  });

  it("accepte agentType='explorer' avec summaryId présent", () => {
    mockUseVoiceChatGate.mockReturnValue({
      enabled: true,
      requiresUpgrade: false,
    });

    const { getByLabelText } = render(
      <VoiceButton
        summaryId="42"
        videoTitle="Test"
        agentType="explorer"
        onSessionStart={onSessionStart}
      />,
    );

    expect(getByLabelText(/Démarrer le chat vocal/)).toBeTruthy();
  });
});
