/**
 * Tests CommunityTakeSection mobile — verdict communauté (spec PR3 mobile)
 * Spec : docs/superpowers/specs/2026-05-17-comments-community-take.md §7.2
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      background: "#0a0a0f",
      surface: "#15151f",
      surfaceSecondary: "#12121a",
      border: "rgba(255,255,255,0.06)",
      borderLight: "rgba(255,255,255,0.12)",
      textPrimary: "#ffffff",
      textSecondary: "#f1f5f9",
      textTertiary: "#cbd5e1",
      textMuted: "#94a3b8",
      accentSecondary: "#9B6B4A",
      amber: "#f59e0b",
    },
    isDark: true,
  }),
}));

const mockPlan = { value: "pro" as "free" | "pro" | "expert" };
jest.mock("../../hooks/usePlan", () => ({
  usePlan: () => ({ plan: mockPlan.value }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock("react-native-reanimated", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: { View },
    FadeIn: { duration: () => ({}) },
    useAnimatedStyle: () => ({}),
    useSharedValue: () => ({ value: 0 }),
    withRepeat: () => 0,
    withTiming: () => 0,
  };
});

import { CommunityTakeSection } from "../CommunityTakeSection";
import type { CommunityTake } from "../../types";

const baseTake: CommunityTake = {
  agreement_signal: "agree",
  sentiment_distribution: { positive: 0.6, neutral: 0.3, negative: 0.1 },
  controversies: ["Le sujet X reste contesté", "Source Y questionnée"],
  community_summary:
    "Majoritairement positif. Les commentateurs soutiennent l'analyse du créateur.",
  top_voices: [
    {
      author: "Un commentateur populaire",
      excerpt: "Très bonne analyse, je partage cet avis.",
      stance: "agree",
      like_count: 8400,
    },
    {
      author: "Un autre commentateur",
      excerpt: "Nuance importante : il manque le contexte historique.",
      stance: "neutral",
      like_count: 320,
    },
  ],
  comments_analyzed: 142,
  model_used: "mistral-medium-2508",
};

describe("CommunityTakeSection (mobile)", () => {
  beforeEach(() => {
    mockPlan.value = "pro";
    mockPush.mockClear();
  });

  it("affiche une CTA upgrade pour les users free", () => {
    mockPlan.value = "free";
    const { getByTestId, queryByTestId } = render(
      <CommunityTakeSection take={baseTake} language="fr" />,
    );
    expect(getByTestId("community-take-upgrade-cta-mobile")).toBeTruthy();
    expect(queryByTestId("community-take-section-mobile")).toBeNull();
  });

  it("ne rend rien si take est null côté Pro", () => {
    const { toJSON } = render(
      <CommunityTakeSection take={null} language="fr" />,
    );
    expect(toJSON()).toBeNull();
  });

  it("affiche la section pour Pro avec take valide", () => {
    const { getByTestId, getByText } = render(
      <CommunityTakeSection take={baseTake} language="fr" />,
    );
    expect(getByTestId("community-take-section-mobile")).toBeTruthy();
    expect(getByText("Verdict communauté")).toBeTruthy();
    expect(getByText("Analyse de 142 commentaires")).toBeTruthy();
  });

  it("affiche les Empty states (disabled / insufficient_data)", () => {
    const disabledTake: CommunityTake = {
      ...baseTake,
      disabled: true,
      community_summary: "",
      top_voices: [],
      controversies: [],
      comments_analyzed: 0,
    };
    const { getByTestId } = render(
      <CommunityTakeSection take={disabledTake} language="fr" />,
    );
    expect(getByTestId("community-take-empty-mobile")).toBeTruthy();
  });

  it("affiche le sentiment bar uniquement pour Expert", () => {
    const { queryByTestId, rerender } = render(
      <CommunityTakeSection take={baseTake} language="fr" />,
    );
    expect(queryByTestId("community-sentiment-bar-mobile")).toBeNull();

    mockPlan.value = "expert";
    rerender(<CommunityTakeSection take={baseTake} language="fr" />);
    expect(queryByTestId("community-sentiment-bar-mobile")).toBeTruthy();
  });

  it("limite à 3 voix pour Pro et 5 pour Expert", () => {
    const manyVoices: CommunityTake = {
      ...baseTake,
      top_voices: Array.from({ length: 6 }, (_, i) => ({
        author: `User-${i}`,
        excerpt: `Avis ${i}`,
        stance: "agree" as const,
        like_count: 100 - i,
      })),
    };
    const { queryAllByTestId, rerender } = render(
      <CommunityTakeSection take={manyVoices} language="fr" />,
    );
    expect(queryAllByTestId("community-top-voice-mobile")).toHaveLength(3);

    mockPlan.value = "expert";
    rerender(<CommunityTakeSection take={manyVoices} language="fr" />);
    expect(queryAllByTestId("community-top-voice-mobile")).toHaveLength(5);
  });

  it("affiche les labels EN quand language=en", () => {
    const { getByText } = render(
      <CommunityTakeSection take={baseTake} language="en" />,
    );
    expect(getByText("Community verdict")).toBeTruthy();
    expect(getByText("Analysis of 142 comments")).toBeTruthy();
  });

  it("appelle onUpgradeClick quand free user tap la CTA", () => {
    mockPlan.value = "free";
    const onUpgradeClick = jest.fn();
    const { getByTestId } = render(
      <CommunityTakeSection
        take={baseTake}
        language="fr"
        onUpgradeClick={onUpgradeClick}
      />,
    );
    fireEvent.press(getByTestId("community-take-upgrade-cta-mobile"));
    expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("appelle router.push sur /(tabs)/subscription par défaut", () => {
    mockPlan.value = "free";
    const { getByTestId } = render(
      <CommunityTakeSection take={baseTake} language="fr" />,
    );
    fireEvent.press(getByTestId("community-take-upgrade-cta-mobile"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/subscription");
  });
});
