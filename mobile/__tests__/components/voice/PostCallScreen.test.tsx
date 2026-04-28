import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PostCallScreen } from "../../../src/components/voice/PostCallScreen";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

jest.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: "#000",
      bgTertiary: "#222",
      textPrimary: "#fff",
      textSecondary: "#ccc",
      textTertiary: "#999",
      border: "#333",
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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

  test("renders title + duration + transcript messages", () => {
    const { getByText } = render(<PostCallScreen {...baseProps} />);
    expect(getByText(/Le futur de l'IA/)).toBeTruthy();
    expect(getByText(/04:32/)).toBeTruthy();
    expect(getByText(/Salut/)).toBeTruthy();
    expect(getByText(/Bonjour/)).toBeTruthy();
    expect(getByText(/AI Channel/)).toBeTruthy();
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

  test("primary CTA disabled when summaryId is null", () => {
    const { getByLabelText } = render(
      <PostCallScreen {...baseProps} summaryId={null} />,
    );
    const cta = getByLabelText("Voir l'analyse complète");
    expect(cta.props.accessibilityState?.disabled ?? cta.props.disabled).toBe(
      true,
    );
    expect(baseProps.onViewAnalysis).not.toHaveBeenCalled();
  });

  test("primary CTA disabled when summaryId is undefined", () => {
    const { getByLabelText } = render(
      <PostCallScreen {...baseProps} summaryId={undefined} />,
    );
    const cta = getByLabelText("Voir l'analyse complète");
    expect(cta.props.accessibilityState?.disabled ?? cta.props.disabled).toBe(
      true,
    );
    expect(baseProps.onViewAnalysis).not.toHaveBeenCalled();
  });
});
