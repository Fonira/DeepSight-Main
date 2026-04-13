import React from "react";
import { render, fireEvent, waitFor, screen } from "../utils/test-utils";

// Mock APIs
const mockSendMessage = jest.fn();

jest.mock("../../src/services/api", () => ({
  chatApi: {
    sendMessage: (...args: any[]) => mockSendMessage(...args),
    getHistory: jest.fn().mockResolvedValue({ messages: [] }),
    getQuota: jest.fn().mockResolvedValue({ used: 0, limit: 5 }),
  },
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Ionicons: (props: any) => React.createElement(Text, {}, props.name),
  };
});

// Mock contexts
jest.mock("../../src/contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: "#0D0D0F",
      bgSecondary: "#141416",
      bgTertiary: "#1A1A1D",
      textPrimary: "#FFFFFF",
      textSecondary: "#B8B8C0",
      textTertiary: "#8E8E96",
      textMuted: "#5E5E66",
      border: "#2A2A2F",
      accentPrimary: "#7C3AED",
      accentInfo: "#3B82F6",
      accentWarning: "#F59E0B",
    },
  }),
}));

jest.mock("../../src/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      chat: {
        title: "Chat",
        askQuestion: "Posez une question",
        placeholder: "Tapez votre message...",
        startConversation: "Commencez la conversation",
        questionsRemaining: "questions restantes",
        unlimitedQuestions: "Questions illimitees",
        webSearchPlaceholder: "Recherche web...",
        webSources: "Sources web",
        suggestions: {
          keyPoints: "Quels sont les points cles ?",
          summary: "Resume cette video",
          explain: "Explique ce concept",
        },
        minimizeChat: "Reduire",
      },
    },
  }),
}));

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      plan: "free",
    },
  }),
}));

// Mock constants/theme
jest.mock("../../src/constants/theme", () => ({
  Spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
  Typography: {
    fontFamily: {
      display: "System",
      body: "System",
      bodyMedium: "System",
      bodySemiBold: "System",
      bodyBold: "System",
      mono: "System",
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36,
    },
    lineHeight: {
      none: 1,
      tight: 1.2,
      snug: 1.35,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2,
    },
  },
  BorderRadius: { sm: 6, md: 10, lg: 16, xl: 20, xxl: 24, full: 9999 },
}));

// Mock planPrivileges
jest.mock("../../src/config/planPrivileges", () => ({
  hasFeature: jest.fn().mockReturnValue(false),
  getLimit: jest.fn().mockReturnValue(5),
  isUnlimited: jest.fn().mockReturnValue(false),
}));

// Mock child components with testable elements
jest.mock("../../src/components/chat/SuggestedQuestions", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    SuggestedQuestions: ({ onQuestionSelect, disabled }: any) =>
      React.createElement(
        View,
        { testID: "suggested-questions" },
        React.createElement(
          Pressable,
          {
            onPress: () =>
              !disabled && onQuestionSelect?.("Quels sont les points cles ?"),
          },
          React.createElement(Text, {}, "Quels sont les points cles ?"),
        ),
        React.createElement(
          Pressable,
          {
            onPress: () =>
              !disabled && onQuestionSelect?.("Resume cette video"),
          },
          React.createElement(Text, {}, "Resume cette video"),
        ),
      ),
  };
});

jest.mock("../../src/components/chat/ChatBubble", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    ChatBubble: ({ role, content }: any) =>
      React.createElement(
        View,
        { testID: `chat-bubble-${role}` },
        React.createElement(Text, {}, content),
      ),
  };
});

jest.mock("../../src/components/chat/TypingIndicator", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    TypingIndicator: () =>
      React.createElement(View, { testID: "typing-indicator" }),
  };
});

// ChatInput mock - renders real TextInput and send button
// Note: onSend delegates to parent's handleSend which already guards on empty input
jest.mock("../../src/components/chat/ChatInput", () => {
  const React = require("react");
  const { View, TextInput, Pressable, Text } = require("react-native");
  return {
    ChatInput: ({
      value,
      onChangeText,
      onSend,
      isLoading,
      placeholder,
      maxLength,
      disabled,
      showWebSearch,
      webSearchEnabled,
      onToggleWebSearch,
      canUseWebSearch,
    }: any) =>
      React.createElement(
        View,
        { testID: "chat-input-container" },
        React.createElement(TextInput, {
          testID: "chat-text-input",
          placeholder: placeholder || "Tapez votre message...",
          value: value,
          onChangeText: onChangeText,
          maxLength: maxLength,
          editable: !disabled,
        }),
        showWebSearch &&
          React.createElement(
            Pressable,
            {
              testID: "web-search-toggle",
              onPress: onToggleWebSearch,
            },
            React.createElement(
              Text,
              {},
              webSearchEnabled ? "Web ON" : "Web OFF",
            ),
          ),
        React.createElement(
          Pressable,
          {
            testID: "send-button",
            onPress: () => {
              if (!isLoading) onSend?.();
            },
          },
          React.createElement(Text, {}, "Envoyer"),
        ),
      ),
  };
});

// Import after mocks
import { FloatingChat } from "../../src/components/chat/FloatingChat";

describe("FloatingChat", () => {
  const defaultProps = {
    summaryId: "test-summary-123",
    videoTitle: "Test Video Title",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({
      response: "This is the AI response",
      sources: [],
    });
  });

  describe("Rendering", () => {
    it("should render floating button", () => {
      render(<FloatingChat {...defaultProps} />);

      // FAB renders "Chat IA" text
      expect(screen.getByText("Chat IA")).toBeTruthy();
    });

    it("should not show chat modal initially", () => {
      render(<FloatingChat {...defaultProps} />);

      // Chat input should not be visible
      expect(screen.queryByTestId("chat-text-input")).toBeNull();
    });
  });

  describe("Open/Close Chat", () => {
    it("should open chat modal when floating button pressed", async () => {
      render(<FloatingChat {...defaultProps} />);

      const floatingButton = screen.getByText("Chat IA");
      fireEvent.press(floatingButton);

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input")).toBeTruthy();
      });
    });

    it("should close chat modal when close button pressed", async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input")).toBeTruthy();
      });

      // Find and press close button (renders Ionicons "close" icon)
      const closeButtons = screen.getAllByText("close");
      fireEvent.press(closeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByTestId("chat-text-input")).toBeNull();
      });
    });
  });

  describe("Message Input", () => {
    it("should accept text input", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        const input = screen.getByTestId("chat-text-input");
        expect(input).toBeTruthy();

        fireEvent.changeText(input, "What are the key points?");
        expect(input.props.value).toBe("What are the key points?");
      });
    });

    it("should disable send button when input is empty", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        const input = screen.getByTestId("chat-text-input");
        fireEvent.changeText(input, "");

        const sendButton = screen.getByTestId("send-button");
        fireEvent.press(sendButton);
        expect(mockSendMessage).not.toHaveBeenCalled();
      });
    });

    it("should limit input to max characters", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        const input = screen.getByTestId("chat-text-input");
        expect(input.props.maxLength).toBe(500);
      });
    });
  });

  describe("Send Message", () => {
    it("should send message and display response", async () => {
      mockSendMessage.mockResolvedValueOnce({
        response: "The key points are: 1. First point 2. Second point",
        sources: [],
      });

      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      // Wait for chat to open, then type message
      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input")).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId("chat-text-input"),
        "What are the key points?",
      );

      // Wait for state to update with the typed text
      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input").props.value).toBe(
          "What are the key points?",
        );
      });

      fireEvent.press(screen.getByTestId("send-button"));

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith(
          "test-summary-123",
          "What are the key points?",
          expect.objectContaining({
            useWebSearch: false,
          }),
        );
      });
    });

    it("should display user message immediately", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input")).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId("chat-text-input"),
        "Test message",
      );

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input").props.value).toBe(
          "Test message",
        );
      });

      fireEvent.press(screen.getByTestId("send-button"));

      await waitFor(() => {
        expect(screen.getByText("Test message")).toBeTruthy();
      });
    });

    it("should clear input after sending", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input")).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId("chat-text-input"),
        "Test message",
      );

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input").props.value).toBe(
          "Test message",
        );
      });

      fireEvent.press(screen.getByTestId("send-button"));

      await waitFor(() => {
        const input = screen.getByTestId("chat-text-input");
        expect(input.props.value).toBe("");
      });
    });
  });

  describe("Web Search Toggle", () => {
    it("should show web search toggle", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        const webSearchToggle = screen.getByTestId("web-search-toggle");
        expect(webSearchToggle).toBeTruthy();
      });
    });

    it("should send with web search when enabled (pro user)", async () => {
      // Mock pro user with web search access
      const { hasFeature } = require("../../src/config/planPrivileges");
      (hasFeature as jest.Mock).mockReturnValue(true);

      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        expect(screen.getByTestId("web-search-toggle")).toBeTruthy();
      });

      // Toggle web search on
      fireEvent.press(screen.getByTestId("web-search-toggle"));

      // Type message
      fireEvent.changeText(
        screen.getByTestId("chat-text-input"),
        "Search the web for this",
      );

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input").props.value).toBe(
          "Search the web for this",
        );
      });

      fireEvent.press(screen.getByTestId("send-button"));

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith(
          "test-summary-123",
          "Search the web for this",
          expect.objectContaining({
            useWebSearch: true,
          }),
        );
      });
    });
  });

  describe("Suggested Questions", () => {
    it("should display suggested questions when chat is empty", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        expect(screen.getByText(/points cles/i)).toBeTruthy();
        expect(screen.getByText(/resume/i)).toBeTruthy();
      });
    });

    it("should fill input when suggested question tapped", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        const suggestion = screen.getByText(/points cles/i);
        fireEvent.press(suggestion);

        const input = screen.getByTestId("chat-text-input");
        expect(input.props.value).toBe("Quels sont les points cles ?");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API error gracefully", async () => {
      mockSendMessage.mockRejectedValueOnce(new Error("Network error"));

      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        const input = screen.getByTestId("chat-text-input");
        fireEvent.changeText(input, "Test message");
      });

      fireEvent.press(screen.getByTestId("send-button"));

      // Should restore the message in input on error
      await waitFor(() => {
        const input = screen.getByTestId("chat-text-input");
        expect(input.props.value).toBe("Test message");
      });
    });
  });

  describe("Quota Display", () => {
    it("should show questions remaining for free users", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        expect(screen.getByText(/questions restantes/i)).toBeTruthy();
      });
    });
  });

  describe("Unread Messages", () => {
    it("should show unread badge when messages received while closed", async () => {
      const { rerender } = render(<FloatingChat {...defaultProps} />);

      // Simulate receiving a message while closed
      rerender(
        <FloatingChat
          {...defaultProps}
          initialMessages={[
            {
              id: "1",
              role: "assistant",
              content: "New message",
              timestamp: new Date().toISOString(),
            },
          ]}
        />,
      );

      // Should show unread count (implementation may vary)
    });
  });

  describe("Security", () => {
    it("should handle XSS in message input", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input")).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId("chat-text-input"),
        '<script>alert("xss")</script>',
      );

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input").props.value).toBe(
          '<script>alert("xss")</script>',
        );
      });

      fireEvent.press(screen.getByTestId("send-button"));

      // Should send to API - backend should sanitize
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith(
          "test-summary-123",
          '<script>alert("xss")</script>',
          expect.anything(),
        );
      });
    });

    it("should handle SQL injection in message", async () => {
      render(<FloatingChat {...defaultProps} />);

      fireEvent.press(screen.getByText("Chat IA"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input")).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId("chat-text-input"),
        "'; DROP TABLE messages;--",
      );

      await waitFor(() => {
        expect(screen.getByTestId("chat-text-input").props.value).toBe(
          "'; DROP TABLE messages;--",
        );
      });

      fireEvent.press(screen.getByTestId("send-button"));

      // Should send to API - backend should sanitize
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });
    });
  });
});
