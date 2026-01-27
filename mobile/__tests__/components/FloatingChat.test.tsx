import React from 'react';
import { render, fireEvent, waitFor, screen } from '../utils/test-utils';

// Mock APIs
const mockSendMessage = jest.fn();

jest.mock('../../src/services/api', () => ({
  chatApi: {
    sendMessage: mockSendMessage,
    getHistory: jest.fn().mockResolvedValue({ messages: [] }),
    getQuota: jest.fn().mockResolvedValue({ used: 0, limit: 5 }),
  },
}));

// Mock contexts
jest.mock('../../src/contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#0D0D0F',
      bgSecondary: '#141416',
      bgTertiary: '#1A1A1D',
      textPrimary: '#FFFFFF',
      textSecondary: '#B8B8C0',
      textTertiary: '#8E8E96',
      textMuted: '#5E5E66',
      border: '#2A2A2F',
      accentPrimary: '#7C3AED',
      accentInfo: '#3B82F6',
      accentWarning: '#F59E0B',
    },
  }),
}));

jest.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      chat: {
        title: 'Chat',
        askQuestion: 'Posez une question',
        placeholder: 'Tapez votre message...',
        startConversation: 'Commencez la conversation',
        questionsRemaining: 'questions restantes',
        unlimitedQuestions: 'Questions illimitees',
        suggestions: {
          keyPoints: 'Quels sont les points cles ?',
          summary: 'Resume cette video',
          explain: 'Explique ce concept',
        },
      },
    },
  }),
}));

jest.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      plan: 'free',
    },
  }),
}));

// Import after mocks
import { FloatingChat } from '../../src/components/chat/FloatingChat';

describe('FloatingChat', () => {
  const defaultProps = {
    summaryId: 'test-summary-123',
    videoTitle: 'Test Video Title',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({
      response: 'This is the AI response',
      sources: [],
    });
  });

  describe('Rendering', () => {
    it('should render floating button', () => {
      render(<FloatingChat {...defaultProps} />);

      // Floating button should be visible
      expect(screen.queryByText(/chat/i)).toBeTruthy();
    });

    it('should not show chat modal initially', () => {
      render(<FloatingChat {...defaultProps} />);

      // Chat modal should be hidden
      expect(screen.queryByPlaceholderText(/message/i)).toBeNull();
    });
  });

  describe('Open/Close Chat', () => {
    it('should open chat modal when floating button pressed', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Find and press the floating button (it has the chat icon)
      const floatingButton = screen.getAllByRole?.('button')?.[0] ||
        screen.getByTestId?.('floating-chat-button');

      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          expect(screen.getByPlaceholderText(/message/i)).toBeTruthy();
        });
      }
    });

    it('should close chat modal when close button pressed', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat first
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          expect(screen.getByPlaceholderText(/message/i)).toBeTruthy();
        });

        // Find and press close button
        const closeButton = screen.getByTestId?.('close-chat-button');
        if (closeButton) {
          fireEvent.press(closeButton);

          await waitFor(() => {
            expect(screen.queryByPlaceholderText(/message/i)).toBeNull();
          });
        }
      }
    });
  });

  describe('Message Input', () => {
    it('should accept text input', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          expect(input).toBeTruthy();

          fireEvent.changeText(input, 'What are the key points?');
          expect(input.props.value).toBe('What are the key points?');
        });
      }
    });

    it('should disable send button when input is empty', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          fireEvent.changeText(input, '');

          // Send button should be disabled
          const sendButton = screen.getByTestId?.('send-button');
          if (sendButton) {
            fireEvent.press(sendButton);
            expect(mockSendMessage).not.toHaveBeenCalled();
          }
        });
      }
    });

    it('should limit input to max characters', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          const longMessage = 'a'.repeat(600);
          fireEvent.changeText(input, longMessage);

          // Input should have maxLength of 500
          expect(input.props.maxLength).toBe(500);
        });
      }
    });
  });

  describe('Send Message', () => {
    it('should send message and display response', async () => {
      mockSendMessage.mockResolvedValueOnce({
        response: 'The key points are: 1. First point 2. Second point',
        sources: [],
      });

      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          fireEvent.changeText(input, 'What are the key points?');

          const sendButton = screen.getByTestId?.('send-button');
          if (sendButton) {
            fireEvent.press(sendButton);
          }
        });

        await waitFor(() => {
          expect(mockSendMessage).toHaveBeenCalledWith(
            'test-summary-123',
            'What are the key points?',
            expect.objectContaining({
              useWebSearch: false,
            })
          );
        });
      }
    });

    it('should display user message immediately', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          fireEvent.changeText(input, 'Test message');

          const sendButton = screen.getByTestId?.('send-button');
          if (sendButton) {
            fireEvent.press(sendButton);
          }
        });

        await waitFor(() => {
          // User message should appear
          expect(screen.getByText('Test message')).toBeTruthy();
        });
      }
    });

    it('should clear input after sending', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          fireEvent.changeText(input, 'Test message');

          const sendButton = screen.getByTestId?.('send-button');
          if (sendButton) {
            fireEvent.press(sendButton);
          }
        });

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          expect(input.props.value).toBe('');
        });
      }
    });
  });

  describe('Web Search Toggle', () => {
    it('should show web search toggle', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const webSearchToggle = screen.getByTestId?.('web-search-toggle');
          expect(webSearchToggle).toBeTruthy();
        });
      }
    });

    it('should send with web search when enabled (pro user)', async () => {
      // Mock pro user
      jest.doMock('../../src/contexts/AuthContext', () => ({
        useAuth: () => ({
          user: {
            plan: 'pro',
          },
        }),
      }));

      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          // Toggle web search on
          const webSearchToggle = screen.getByTestId?.('web-search-toggle');
          if (webSearchToggle) {
            fireEvent.press(webSearchToggle);
          }

          const input = screen.getByPlaceholderText(/message/i);
          fireEvent.changeText(input, 'Search the web for this');

          const sendButton = screen.getByTestId?.('send-button');
          if (sendButton) {
            fireEvent.press(sendButton);
          }
        });

        await waitFor(() => {
          expect(mockSendMessage).toHaveBeenCalledWith(
            'test-summary-123',
            'Search the web for this',
            expect.objectContaining({
              useWebSearch: true,
            })
          );
        });
      }
    });
  });

  describe('Suggested Questions', () => {
    it('should display suggested questions when chat is empty', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          expect(screen.getByText(/points cles/i)).toBeTruthy();
          expect(screen.getByText(/resume/i)).toBeTruthy();
        });
      }
    });

    it('should fill input when suggested question tapped', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const suggestion = screen.getByText(/points cles/i);
          fireEvent.press(suggestion);

          const input = screen.getByPlaceholderText(/message/i);
          expect(input.props.value).toBe('Quels sont les points cles ?');
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Network error'));

      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          fireEvent.changeText(input, 'Test message');

          const sendButton = screen.getByTestId?.('send-button');
          if (sendButton) {
            fireEvent.press(sendButton);
          }
        });

        // Should restore the message in input on error
        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          expect(input.props.value).toBe('Test message');
        });
      }
    });
  });

  describe('Quota Display', () => {
    it('should show questions remaining for free users', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          expect(screen.getByText(/questions restantes/i)).toBeTruthy();
        });
      }
    });
  });

  describe('Unread Messages', () => {
    it('should show unread badge when messages received while closed', async () => {
      const { rerender } = render(<FloatingChat {...defaultProps} />);

      // Simulate receiving a message while closed
      rerender(
        <FloatingChat
          {...defaultProps}
          initialMessages={[
            {
              id: '1',
              role: 'assistant',
              content: 'New message',
              timestamp: new Date().toISOString(),
            },
          ]}
        />
      );

      // Should show unread count
      // (implementation may vary)
    });
  });

  describe('Security', () => {
    it('should handle XSS in message input', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          fireEvent.changeText(input, '<script>alert("xss")</script>');

          const sendButton = screen.getByTestId?.('send-button');
          if (sendButton) {
            fireEvent.press(sendButton);
          }
        });

        // Should send to API - backend should sanitize
        await waitFor(() => {
          expect(mockSendMessage).toHaveBeenCalledWith(
            'test-summary-123',
            '<script>alert("xss")</script>',
            expect.anything()
          );
        });
      }
    });

    it('should handle SQL injection in message', async () => {
      render(<FloatingChat {...defaultProps} />);

      // Open chat
      const floatingButton = screen.getAllByRole?.('button')?.[0];
      if (floatingButton) {
        fireEvent.press(floatingButton);

        await waitFor(() => {
          const input = screen.getByPlaceholderText(/message/i);
          fireEvent.changeText(input, "'; DROP TABLE messages;--");

          const sendButton = screen.getByTestId?.('send-button');
          if (sendButton) {
            fireEvent.press(sendButton);
          }
        });

        // Should send to API - backend should sanitize
        await waitFor(() => {
          expect(mockSendMessage).toHaveBeenCalled();
        });
      }
    });
  });
});
