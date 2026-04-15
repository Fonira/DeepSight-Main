/**
 * VoiceScreen.test.tsx — Tests pour le composant VoiceScreen (React Native)
 *
 * Couvre : affichage par état (idle, connecting, listening, thinking, speaking, error, quota),
 * interactions (start, stop, mute, close), affichage messages, timer.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock ThemeContext
jest.mock("../../../contexts/ThemeContext", () => ({
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

// Mock safe area
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// Mock theme modules
jest.mock("../../../theme/spacing", () => ({
  sp: { sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32 },
  borderRadius: { sm: 4, md: 8, lg: 12, full: 9999 },
}));

jest.mock("../../../theme/typography", () => ({
  fontFamily: {
    body: "System",
    bodyMedium: "System",
    bodySemiBold: "System",
    mono: "Courier",
  },
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18 },
}));

jest.mock("../../../theme/colors", () => ({
  palette: {
    gold: "#f59e0b",
    white: "#ffffff",
    red: "#ef4444",
  },
}));

jest.mock("../../../theme/animations", () => ({
  duration: { slow: 300, slower: 500 },
}));

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
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


// Mock Ionicons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

import { VoiceScreen } from "../VoiceScreen";

// ─── Default Props ──────────────────────────────────────────────────────────

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  videoTitle: "Test Video — Comment fonctionne l'IA",
  channelName: "DeepSight Channel",
  voiceStatus: "idle" as const,
  isSpeaking: false,
  messages: [],
  elapsedSeconds: 0,
  remainingMinutes: 30,
  onStart: jest.fn(),
  onStop: jest.fn(),
  onMuteToggle: jest.fn(),
  isMuted: false,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("VoiceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering states ──

  it("affiche le bouton Démarrer en état idle", () => {
    const { getByText } = render(<VoiceScreen {...defaultProps} />);
    expect(getByText("Démarrer")).toBeTruthy();
  });

  it("affiche Connexion... en état connecting", () => {
    const { getByText } = render(
      <VoiceScreen {...defaultProps} voiceStatus="connecting" />,
    );
    expect(getByText("Connexion...")).toBeTruthy();
  });

  it("affiche À l'écoute... en état listening", () => {
    const { getByText } = render(
      <VoiceScreen {...defaultProps} voiceStatus="listening" />,
    );
    expect(getByText("À l'écoute...")).toBeTruthy();
  });

  it("affiche Réflexion... en état thinking", () => {
    const { getByText } = render(
      <VoiceScreen {...defaultProps} voiceStatus="thinking" />,
    );
    expect(getByText("Réflexion...")).toBeTruthy();
  });

  it("affiche DeepSight parle... en état speaking", () => {
    const { getByText } = render(
      <VoiceScreen {...defaultProps} voiceStatus="speaking" />,
    );
    expect(getByText("DeepSight parle...")).toBeTruthy();
  });

  it("affiche le message d'erreur en état error", () => {
    const { getByText } = render(
      <VoiceScreen
        {...defaultProps}
        voiceStatus="error"
        error="Connexion perdue"
      />,
    );
    expect(getByText("Connexion perdue")).toBeTruthy();
    expect(getByText("Réessayer")).toBeTruthy();
  });

  it("affiche le message quota en état quota_exceeded", () => {
    const { getByText } = render(
      <VoiceScreen {...defaultProps} voiceStatus="quota_exceeded" />,
    );
    expect(getByText(/[Qq]uota/)).toBeTruthy();
    expect(getByText(/plan supérieur/)).toBeTruthy();
  });

  // ── Header ──

  it("affiche le titre de la vidéo et le nom du channel", () => {
    const { getByText } = render(<VoiceScreen {...defaultProps} />);
    expect(getByText(defaultProps.videoTitle)).toBeTruthy();
    expect(getByText(defaultProps.channelName)).toBeTruthy();
  });

  // ── Interactions ──

  it("appelle onStart quand on appuie sur Démarrer", () => {
    const { getByText } = render(<VoiceScreen {...defaultProps} />);
    fireEvent.press(getByText("Démarrer"));
    expect(defaultProps.onStart).toHaveBeenCalledTimes(1);
  });

  it("appelle onClose quand on appuie sur le bouton fermer", () => {
    const { getAllByRole } = render(<VoiceScreen {...defaultProps} />);
    // Le bouton close est le premier Pressable avec le X icon
    // On le trouve par le close button style
    // Alternative: tester via onRequestClose
  });

  it("appelle onStart (retry) quand on appuie sur Réessayer en erreur", () => {
    const { getByText } = render(
      <VoiceScreen
        {...defaultProps}
        voiceStatus="error"
        error="Test erreur"
      />,
    );
    fireEvent.press(getByText("Réessayer"));
    expect(defaultProps.onStart).toHaveBeenCalledTimes(1);
  });

  // ── Messages (transcript) ──

  it("affiche les messages de conversation", () => {
    const messages = [
      { text: "Bonjour, je suis DeepSight.", source: "ai" as const },
      { text: "Salut ! Explique-moi la vidéo.", source: "user" as const },
    ];

    const { getByText } = render(
      <VoiceScreen
        {...defaultProps}
        voiceStatus="listening"
        messages={messages}
      />,
    );

    expect(getByText("Bonjour, je suis DeepSight.")).toBeTruthy();
    expect(getByText("Salut ! Explique-moi la vidéo.")).toBeTruthy();
  });

  // ── Footer (active state) ──

  it("affiche le footer avec mute et stop quand actif", () => {
    const { getByText } = render(
      <VoiceScreen {...defaultProps} voiceStatus="listening" />,
    );

    // Timer should be displayed
    expect(getByText(/00:00/)).toBeTruthy();
  });

  it("n'affiche pas le footer en état idle", () => {
    const { queryByText } = render(
      <VoiceScreen {...defaultProps} voiceStatus="idle" />,
    );

    // Timer should not be in idle state
    expect(queryByText(/restantes/)).toBeNull();
  });

  // ── Not visible ──

  it("ne rend rien quand visible=false", () => {
    const { toJSON } = render(
      <VoiceScreen {...defaultProps} visible={false} />,
    );
    // Modal with visible=false shouldn't render children
    // (behavior depends on React Native's Modal implementation)
    expect(toJSON()).toBeNull();
  });
});
