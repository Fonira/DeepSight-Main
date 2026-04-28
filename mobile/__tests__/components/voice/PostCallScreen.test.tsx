/**
 * PostCallScreen.test.tsx — Quick Voice Call mobile V3
 *
 * Couvre : titre + durée + transcript + CTA primaire (analyse) + CTA secondaire
 * (autre appel) + bandeau upgrade conditionnel.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("../../../src/contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: "#0a0a0f",
      textPrimary: "#ffffff",
      textMuted: "#888888",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return {
    LinearGradient: View,
  };
});

jest.mock("@shopify/flash-list", () => {
  const { View, Text } = require("react-native");
  return {
    FlashList: ({ data, renderItem }: { data: unknown[]; renderItem: any }) => (
      <View>
        {data.map((item, i) => (
          <View key={i}>{renderItem({ item, index: i })}</View>
        ))}
      </View>
    ),
  };
});

import { PostCallScreen } from "../../../src/components/voice/PostCallScreen";

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  videoTitle: "Le futur de l'IA",
  channelName: "AI Channel",
  summaryId: 99,
  durationSeconds: 272,
  messages: [
    { text: "Salut", source: "user" as const },
    { text: "Bonjour!", source: "ai" as const },
  ],
  quotaRemaining: 27,
  onViewAnalysis: jest.fn(),
  onCallAnother: jest.fn(),
};

describe("PostCallScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  test("renders title + duration + messages", () => {
    const { getByText } = render(<PostCallScreen {...baseProps} />);
    expect(getByText(/Le futur de l'IA/)).toBeTruthy();
    expect(getByText(/04:32/)).toBeTruthy();
    expect(getByText(/Salut/)).toBeTruthy();
    expect(getByText(/Bonjour/)).toBeTruthy();
  });

  test("primary CTA calls onViewAnalysis with summaryId", () => {
    const { getByText } = render(<PostCallScreen {...baseProps} />);
    fireEvent.press(getByText(/Voir l'analyse complète/i));
    expect(baseProps.onViewAnalysis).toHaveBeenCalledWith(99);
  });

  test("secondary CTA calls onCallAnother", () => {
    const { getByText } = render(<PostCallScreen {...baseProps} />);
    fireEvent.press(getByText(/Appeler une autre vidéo/i));
    expect(baseProps.onCallAnother).toHaveBeenCalled();
  });

  test("does NOT show upgrade banner when quotaRemaining > 0", () => {
    const { queryByText } = render(
      <PostCallScreen {...baseProps} quotaRemaining={5} />,
    );
    expect(queryByText(/Quota voice épuisé/i)).toBeNull();
  });

  test("shows upgrade banner when quotaRemaining === 0", () => {
    const { getByText } = render(
      <PostCallScreen {...baseProps} quotaRemaining={0} />,
    );
    expect(getByText(/Quota voice épuisé/i)).toBeTruthy();
  });

  test("primary CTA disabled when summaryId undefined → does NOT call onViewAnalysis", () => {
    const { getByText } = render(
      <PostCallScreen {...baseProps} summaryId={undefined} />,
    );
    fireEvent.press(getByText(/Voir l'analyse complète/i));
    expect(baseProps.onViewAnalysis).not.toHaveBeenCalled();
  });
});
