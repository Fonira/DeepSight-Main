/**
 * VoiceButton.placement.test.tsx — Spec #3
 *
 * Vérifie le calcul du bottomOffset selon le contexte d'utilisation
 * (Library, Study chat, Analysis avec ActionBar).
 *
 * Décision verrouillée Spec #3 :
 *   - Library  → bottomOffset = TAB_BAR_HEIGHT + insets.bottom + 16
 *   - Study    → bottomOffset = TAB_BAR_HEIGHT + insets.bottom + 16
 *   - Analysis → bottomOffset (default) = TAB_BAR_HEIGHT + ACTION_BAR_HEIGHT + insets.bottom (~144px)
 */

import React from "react";
import { render } from "@testing-library/react-native";

// ─── Mocks identiques à VoiceButton.test.tsx ────────────────────────────────

jest.mock("../../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: { background: "#0a0a0f", text: "#fff", primary: "#6366f1" },
  }),
}));

const mockUseVoiceChatGate = jest.fn();
jest.mock("../../../contexts/PlanContext", () => ({
  useVoiceChatGate: () => mockUseVoiceChatGate(),
}));

jest.mock("../../../theme/colors", () => ({
  palette: { gold: "#C8903A", white: "#fff", black: "#000" },
}));

jest.mock("../../../theme/shadows", () => ({
  shadows: { glow: () => ({}) },
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const Animated = {
    View,
    createAnimatedComponent: (c: React.ComponentType) => c,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: number) => ({ value: v }),
    withRepeat: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    withSequence: (...args: unknown[]) => args[0],
  };
});

// SafeAreaContext — bottom insets at 34 (iPhone notch typical)
const mockInsetsBottom = 34;
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 47,
    bottom: mockInsetsBottom,
    left: 0,
    right: 0,
  }),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

import { VoiceButton } from "../VoiceButton";

// Helpers pour extraire le `bottom` depuis les styles
function getBottomOffset(node: any): number | undefined {
  // Container = parent direct du Pressable
  const container = node.parent?.parent;
  const styles = container?.props?.style;
  if (!styles) return undefined;
  const flat = Array.isArray(styles)
    ? styles.flat().reduce((a: any, s: any) => ({ ...a, ...s }), {})
    : styles;
  return flat.bottom;
}

describe("VoiceButton placement (Spec #3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseVoiceChatGate.mockReturnValue({
      enabled: true,
      requiresUpgrade: false,
    });
  });

  it("Library context : bottomOffset = TAB_BAR(56) + insets.bottom(34) + 16 = 106", () => {
    const TAB_BAR = 56;
    const offset = TAB_BAR + mockInsetsBottom + 16;

    const { getByLabelText } = render(
      <VoiceButton
        agentType="companion"
        videoTitle="Discussion libre"
        bottomOffset={offset}
      />,
    );

    const button = getByLabelText(/chat vocal/i);
    expect(getBottomOffset(button)).toBe(106);
  });

  it("Study chat context : bottomOffset = TAB_BAR(56) + insets.bottom(34) + 16 = 106", () => {
    const TAB_BAR = 56;
    const offset = TAB_BAR + mockInsetsBottom + 16;

    const { getByLabelText } = render(
      <VoiceButton
        summaryId="123"
        agentType="explorer"
        videoTitle="Mon analyse"
        bottomOffset={offset}
      />,
    );

    const button = getByLabelText(/chat vocal/i);
    expect(getBottomOffset(button)).toBe(106);
  });

  it("Analysis screen (default) : bottomOffset n'est pas explicite et utilise TAB_BAR + ACTION_BAR + insets", () => {
    const { getByLabelText } = render(
      <VoiceButton summaryId="42" videoTitle="Analyse" />,
    );

    const button = getByLabelText(/chat vocal/i);
    const bottom = getBottomOffset(button);
    // TAB_BAR_HEIGHT(56) + ACTION_BAR_HEIGHT(72) + FAB_GAP(16) + insets.bottom(34) = 178
    expect(bottom).toBe(56 + 72 + 16 + mockInsetsBottom);
  });

  it("bottomOffset explicite override le calcul par défaut", () => {
    const { getByLabelText } = render(
      <VoiceButton summaryId="42" videoTitle="Analyse" bottomOffset={42} />,
    );

    const button = getByLabelText(/chat vocal/i);
    expect(getBottomOffset(button)).toBe(42);
  });
});
