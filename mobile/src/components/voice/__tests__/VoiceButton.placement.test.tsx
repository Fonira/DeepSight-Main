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

// Mock useTabBarFootprint — valeur déterministe 90 pour reproduire le calcul
// "ancien équivalent" (TAB_BAR_HEIGHT(56) + max(insets.bottom(34), sp.sm) + sp.md(12) = 102)
// Pour rester proche des assertions historiques on utilise 90 (valeur cohérente avec
// un footprint moyen Android sans gros notch).
jest.mock("../../../hooks/useTabBarFootprint", () => ({
  useTabBarFootprint: () => 90,
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
const flatten = (s: any): any => {
  if (!s) return {};
  if (Array.isArray(s))
    return s.flat().reduce((a, x) => ({ ...a, ...flatten(x) }), {});
  return s;
};

// Walk-down : cherche le premier View dans l'arbre (UNSAFE_root) ayant style.bottom.
// Robuste face aux changements de hiérarchie (mock reanimated, refacto props).
function getBottomOffset(tree: any): number | undefined {
  const allViews = tree.UNSAFE_root.findAllByType("View" as any);
  const container = allViews.find(
    (v: any) => flatten(v.props?.style).bottom !== undefined,
  );
  return container ? flatten(container.props?.style).bottom : undefined;
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

    const tree = render(
      <VoiceButton
        agentType="companion"
        videoTitle="Discussion libre"
        bottomOffset={offset}
      />,
    );

    expect(getBottomOffset(tree)).toBe(106);
  });

  it("Study chat context : bottomOffset = TAB_BAR(56) + insets.bottom(34) + 16 = 106", () => {
    const TAB_BAR = 56;
    const offset = TAB_BAR + mockInsetsBottom + 16;

    const tree = render(
      <VoiceButton
        summaryId="123"
        agentType="explorer"
        videoTitle="Mon analyse"
        bottomOffset={offset}
      />,
    );

    expect(getBottomOffset(tree)).toBe(106);
  });

  it("Analysis screen (default) : bottomOffset utilise useTabBarFootprint() + ACTION_BAR + FAB_GAP", () => {
    const tree = render(<VoiceButton summaryId="42" videoTitle="Analyse" />);

    // useTabBarFootprint() = 90 (mock) + ACTION_BAR_HEIGHT(72) + FAB_GAP(16) = 178
    expect(getBottomOffset(tree)).toBe(90 + 72 + 16);
  });

  it("bottomOffset explicite override le calcul par défaut", () => {
    const tree = render(
      <VoiceButton summaryId="42" videoTitle="Analyse" bottomOffset={42} />,
    );

    expect(getBottomOffset(tree)).toBe(42);
  });
});
