/**
 * Tests for app/(tabs)/hub.tsx — Hub tab unifié.
 *
 * Couvre spec §10.1 :
 *   - HubEmptyState quand pas de summaryId param et history vide
 *   - ConversationContent quand summaryId param présent
 *   - Auto-resolve : push 1ère conv si pas de summaryId mais history non vide
 */
import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// ─── Mocks ───
const mockSetParams = jest.fn();
const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseQuery = jest.fn();
const mockGetHistory = jest.fn();
const mockQuickChat = jest.fn();
const mockUseConversation = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: (...args: any[]) => mockUseLocalSearchParams(...args),
  useRouter: () => ({ setParams: mockSetParams, push: mockPush }),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

jest.mock("../../src/services/api", () => ({
  historyApi: {
    getHistory: (...args: any[]) => mockGetHistory(...args),
  },
  videoApi: {
    quickChat: (...args: any[]) => mockQuickChat(...args),
  },
}));

jest.mock("../../src/hooks/useConversation", () => ({
  useConversation: (...args: any[]) => mockUseConversation(...args),
}));

// Theme
jest.mock("../../src/contexts/ThemeContext", () => {
  const { darkColors } = jest.requireActual("../../src/theme/colors");
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

// Heavy native deps mocks (réutilisé pattern ConversationContent.test.tsx)
jest.mock("react-native-markdown-display", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: string }) =>
      React.createElement(Text, null, children),
  };
});

jest.mock("../../src/components/voice/VoiceAddonModal", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => React.createElement(View, null),
  };
});

jest.mock("../../src/components/voice/VoiceSettings", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    VoiceSettings: () => React.createElement(View, null),
  };
});

import HubScreen from "../../app/(tabs)/hub";

const defaultConv = {
  messages: [],
  voiceMode: "off" as const,
  endedToastVisible: false,
  summaryId: null,
  sendMessage: jest.fn(),
  requestStartCall: jest.fn(),
  endCall: jest.fn(),
  toggleMute: jest.fn(),
  isMuted: false,
  isSpeaking: false,
  elapsedSeconds: 0,
  remainingMinutes: 30,
  isLoading: false,
  contextProgress: 0,
  contextComplete: false,
  streaming: false,
  error: null,
};

describe("HubScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConversation.mockReturnValue(defaultConv);
  });

  it("renders HubEmptyState when no summaryId param and no conversations", async () => {
    mockUseLocalSearchParams.mockReturnValue({});
    mockUseQuery.mockReturnValue({ data: { items: [] } });

    const { findByText } = render(<HubScreen />);
    expect(await findByText(/aucune conversation/i)).toBeTruthy();
  });

  it("renders ConversationContent when summaryId param present", () => {
    mockUseLocalSearchParams.mockReturnValue({
      summaryId: "42",
      initialMode: "chat",
    });
    mockUseQuery.mockReturnValue({ data: { items: [] } });

    // Le rendu ne doit pas planter et HubEmptyState ne doit pas être visible
    const { queryByText } = render(<HubScreen />);
    expect(queryByText(/aucune conversation/i)).toBeNull();
  });

  it("auto-resolves first conv when no summaryId and history non-empty", async () => {
    mockUseLocalSearchParams.mockReturnValue({});
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "99",
            title: "Last",
            platform: "youtube",
            isFavorite: false,
          },
        ],
      },
    });

    render(<HubScreen />);

    await waitFor(() => {
      expect(mockSetParams).toHaveBeenCalledWith({
        summaryId: "99",
        initialMode: "chat",
      });
    });
  });
});
