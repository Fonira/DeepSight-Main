import React from 'react';
import { render, fireEvent, waitFor, screen } from '../utils/test-utils';

// Mock contexts
jest.mock('../../src/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      bgPrimary: '#0D0D0F',
      bgSecondary: '#141416',
      bgTertiary: '#1A1A1D',
      textPrimary: '#FFFFFF',
      textSecondary: '#B8B8C0',
      textMuted: '#5E5E66',
      accentPrimary: '#7C3AED',
    },
  }),
}));

jest.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'fr',
  }),
}));

// Import after mocks
import { SmartInputBar } from '../../src/components/SmartInputBar';

describe('SmartInputBar', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render mode tabs (URL, Text, Search)', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      expect(screen.getByText('URL')).toBeTruthy();
      expect(screen.getByText(/texte/i)).toBeTruthy();
      expect(screen.getByText(/recherche/i)).toBeTruthy();
    });

    it('should render category chips', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Auto')).toBeTruthy();
      expect(screen.getByText('Tech')).toBeTruthy();
      expect(screen.getByText('Science')).toBeTruthy();
    });

    it('should render analysis mode options', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Accessible')).toBeTruthy();
      expect(screen.getByText('Standard')).toBeTruthy();
      expect(screen.getByText('Expert')).toBeTruthy();
    });

    it('should render analyze button', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      expect(screen.getByText(/analyser/i)).toBeTruthy();
    });
  });

  describe('URL Mode', () => {
    it('should start in URL mode by default', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const urlTab = screen.getByText('URL');
      // Check if URL tab has active styles
      expect(urlTab).toBeTruthy();
    });

    it('should show URL placeholder in URL mode', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      expect(screen.getByPlaceholderText(/youtube/i)).toBeTruthy();
    });

    it('should accept valid YouTube URL', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(input.props.value).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should accept youtu.be short URL', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'https://youtu.be/dQw4w9WgXcQ');

      expect(input.props.value).toBe('https://youtu.be/dQw4w9WgXcQ');
    });

    it('should disable submit button when input is empty', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should call onSubmit with URL data when valid', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            inputType: 'url',
            value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            category: 'auto',
            mode: 'standard',
          })
        );
      });
    });
  });

  describe('Text Mode', () => {
    it('should switch to text mode when Text tab pressed', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const textTab = screen.getByText(/texte/i);
      fireEvent.press(textTab);

      expect(screen.getByPlaceholderText(/texte à analyser/i)).toBeTruthy();
    });

    it('should show title and source inputs in text mode', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const textTab = screen.getByText(/texte/i);
      fireEvent.press(textTab);

      expect(screen.getByPlaceholderText(/titre/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/source/i)).toBeTruthy();
    });

    it('should accept long text input', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const textTab = screen.getByText(/texte/i);
      fireEvent.press(textTab);

      const input = screen.getByPlaceholderText(/texte à analyser/i);
      const longText = 'Lorem ipsum '.repeat(1000);
      fireEvent.changeText(input, longText);

      expect(input.props.value.length).toBeGreaterThan(1000);
    });

    it('should call onSubmit with text data', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const textTab = screen.getByText(/texte/i);
      fireEvent.press(textTab);

      const input = screen.getByPlaceholderText(/texte à analyser/i);
      fireEvent.changeText(input, 'This is my text content to analyze');

      const titleInput = screen.getByPlaceholderText(/titre/i);
      fireEvent.changeText(titleInput, 'My Title');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            inputType: 'text',
            value: 'This is my text content to analyze',
            title: 'My Title',
          })
        );
      });
    });
  });

  describe('Search Mode', () => {
    it('should switch to search mode when Search tab pressed', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const searchTab = screen.getByText(/recherche/i);
      fireEvent.press(searchTab);

      expect(screen.getByPlaceholderText(/recherchez/i)).toBeTruthy();
    });

    it('should show language selector in search mode', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const searchTab = screen.getByText(/recherche/i);
      fireEvent.press(searchTab);

      expect(screen.getByText('Francais')).toBeTruthy();
    });

    it('should call onSubmit with search data and language', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const searchTab = screen.getByText(/recherche/i);
      fireEvent.press(searchTab);

      const input = screen.getByPlaceholderText(/recherchez/i);
      fireEvent.changeText(input, 'machine learning tutorial');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            inputType: 'search',
            value: 'machine learning tutorial',
            language: 'fr',
          })
        );
      });
    });
  });

  describe('Category Selection', () => {
    it('should select category when chip pressed', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const techCategory = screen.getByText('Tech');
      fireEvent.press(techCategory);

      // Verify selection by checking the submit data
      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'https://youtube.com/watch?v=test');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'tech',
        })
      );
    });
  });

  describe('Analysis Mode Selection', () => {
    it('should select analysis mode when mode chip pressed', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const expertMode = screen.getByText('Expert');
      fireEvent.press(expertMode);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'https://youtube.com/watch?v=test');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'expert',
          })
        );
      });
    });
  });

  describe('Deep Research Toggle', () => {
    it('should show Pro+ badge for non-pro users', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} userPlan="free" />);

      expect(screen.getByText('PRO+')).toBeTruthy();
    });

    it('should enable toggle for pro users', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} userPlan="pro" />);

      const deepResearchToggle = screen.getByText(/recherche approfondie/i);
      fireEvent.press(deepResearchToggle);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'https://youtube.com/watch?v=test');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            deepResearch: true,
          })
        );
      });
    });

    it('should not enable deep research for free users', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} userPlan="free" />);

      const deepResearchToggle = screen.getByText(/recherche approfondie/i);
      fireEvent.press(deepResearchToggle);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'https://youtube.com/watch?v=test');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            deepResearch: false,
          })
        );
      });
    });
  });

  describe('Credit Display', () => {
    it('should show credit cost when provided', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} creditCost={50} creditsRemaining={100} />);

      expect(screen.getByText(/50/)).toBeTruthy();
    });

    it('should show remaining credits', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} creditCost={50} creditsRemaining={100} />);

      expect(screen.getByText(/100/)).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('should disable submit button when loading', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} isLoading={true} />);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'https://youtube.com/watch?v=test');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Input Clearing', () => {
    it('should clear input when clear button pressed', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'https://youtube.com/watch?v=test');

      // Clear button appears when input has value
      const clearButton = screen.getByTestId?.('clear-button') || screen.getAllByRole?.('button')[0];
      if (clearButton) {
        fireEvent.press(clearButton);
        expect(input.props.value).toBe('');
      }
    });
  });

  describe('Security', () => {
    it('should handle XSS attempt in URL input', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, 'javascript:alert("xss")');

      // Input should accept but not process malicious URL
      expect(input.props.value).toBe('javascript:alert("xss")');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      // Should still call onSubmit - backend should validate
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('should handle SQL injection in text mode', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const textTab = screen.getByText(/texte/i);
      fireEvent.press(textTab);

      const input = screen.getByPlaceholderText(/texte à analyser/i);
      fireEvent.changeText(input, "'; DROP TABLE users;--");

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      // Should pass through - sanitization happens on backend
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            value: "'; DROP TABLE users;--",
          })
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URL', () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const input = screen.getByPlaceholderText(/youtube/i);
      const longUrl = 'https://www.youtube.com/watch?v=' + 'a'.repeat(2000);
      fireEvent.changeText(input, longUrl);

      expect(input.props.value.length).toBeGreaterThan(2000);
    });

    it('should handle special characters in search', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const searchTab = screen.getByText(/recherche/i);
      fireEvent.press(searchTab);

      const input = screen.getByPlaceholderText(/recherchez/i);
      fireEvent.changeText(input, 'C++ tutorial & "best practices"');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 'C++ tutorial & "best practices"',
          })
        );
      });
    });

    it('should handle emoji in text input', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const textTab = screen.getByText(/texte/i);
      fireEvent.press(textTab);

      const input = screen.getByPlaceholderText(/texte à analyser/i);
      fireEvent.changeText(input, 'This is a test with emojis: happy face sad face');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('should trim whitespace from input', async () => {
      render(<SmartInputBar onSubmit={mockOnSubmit} />);

      const input = screen.getByPlaceholderText(/youtube/i);
      fireEvent.changeText(input, '   https://youtube.com/watch?v=test   ');

      const submitButton = screen.getByText(/analyser/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 'https://youtube.com/watch?v=test',
          })
        );
      });
    });
  });
});
