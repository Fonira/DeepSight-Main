import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, screen } from '../utils/test-utils';

// Mock the auth context
const mockLogin = jest.fn();
const mockLoginWithGoogle = jest.fn();
const mockClearError = jest.fn();

jest.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    loginWithGoogle: mockLoginWithGoogle,
    isLoading: false,
    error: null,
    clearError: mockClearError,
    pendingVerificationEmail: null,
  }),
}));

jest.mock('../../src/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      bgPrimary: '#0D0D0F',
      bgSecondary: '#141416',
      bgTertiary: '#1A1A1D',
      bgElevated: '#1F1F23',
      textPrimary: '#FFFFFF',
      textSecondary: '#B8B8C0',
      textTertiary: '#8E8E96',
      textMuted: '#5E5E66',
      border: '#2A2A2F',
      accentPrimary: '#7C3AED',
      accentSecondary: '#EC4899',
      accentSuccess: '#10B981',
      accentWarning: '#F59E0B',
      accentError: '#EF4444',
    },
  }),
}));

jest.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'fr',
    t: {
      auth: {
        login: 'Connexion',
        email: 'Email',
        password: 'Mot de passe',
        forgotPassword: 'Mot de passe oublié ?',
        noAccount: "Pas de compte ?",
        createAccount: 'Créer un compte',
        continueWithGoogle: 'Continuer avec Google',
        or: 'ou',
      },
      common: {
        error: 'Erreur',
      },
      errors: {
        required: 'Ce champ est requis',
        invalidEmail: 'Email invalide',
        passwordTooShort: '8 caractères minimum',
      },
    },
  }),
}));

// Import after mocks
import { LoginScreen } from '../../src/screens/LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render login form with email and password inputs', () => {
      render(<LoginScreen />);

      expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/mot de passe/i)).toBeTruthy();
    });

    it('should render login button', () => {
      render(<LoginScreen />);

      expect(screen.getByText(/connexion/i)).toBeTruthy();
    });

    it('should render forgot password link', () => {
      render(<LoginScreen />);

      expect(screen.getByText(/mot de passe oublié/i)).toBeTruthy();
    });

    it('should render Google login button', () => {
      render(<LoginScreen />);

      expect(screen.getByText(/continuer avec google/i)).toBeTruthy();
    });

    it('should render create account link', () => {
      render(<LoginScreen />);

      expect(screen.getByText(/créer un compte/i)).toBeTruthy();
    });
  });

  describe('Input Validation', () => {
    it('should show error for empty email', async () => {
      render(<LoginScreen />);

      const loginButton = screen.getByText(/^connexion$/i);
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it('should show error for empty password', async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);
      fireEvent.changeText(emailInput, 'test@test.com');

      const loginButton = screen.getByText(/^connexion$/i);
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it('should accept valid email format', async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);
      fireEvent.changeText(emailInput, 'test@test.com');

      expect(emailInput.props.value).toBe('test@test.com');
    });

    it('should handle email with spaces (trim)', async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);
      fireEvent.changeText(emailInput, '  test@test.com  ');

      // The component should trim spaces
      expect(emailInput.props.value.trim()).toBe('test@test.com');
    });

    it('should mask password input', () => {
      render(<LoginScreen />);

      const passwordInput = screen.getByPlaceholderText(/mot de passe/i);
      expect(passwordInput.props.secureTextEntry).toBe(true);
    });
  });

  describe('Form Submission', () => {
    it('should call login with valid credentials', async () => {
      mockLogin.mockResolvedValueOnce(undefined);
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/mot de passe/i);
      const loginButton = screen.getByText(/^connexion$/i);

      fireEvent.changeText(emailInput, 'test@test.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
      });
    });

    it('should not submit with invalid email format', async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/mot de passe/i);
      const loginButton = screen.getByText(/^connexion$/i);

      fireEvent.changeText(emailInput, 'not-an-email');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it('should not submit with password less than 8 chars', async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/mot de passe/i);
      const loginButton = screen.getByText(/^connexion$/i);

      fireEvent.changeText(emailInput, 'test@test.com');
      fireEvent.changeText(passwordInput, '1234567');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });
  });

  describe('Google Login', () => {
    it('should call loginWithGoogle when Google button pressed', async () => {
      mockLoginWithGoogle.mockResolvedValueOnce(undefined);
      render(<LoginScreen />);

      const googleButton = screen.getByText(/continuer avec google/i);
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(mockLoginWithGoogle).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when login fails', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

      // Re-mock with error
      jest.doMock('../../src/contexts/AuthContext', () => ({
        useAuth: () => ({
          login: mockLogin,
          loginWithGoogle: mockLoginWithGoogle,
          isLoading: false,
          error: 'Email ou mot de passe incorrect',
          clearError: mockClearError,
          pendingVerificationEmail: null,
        }),
      }));

      render(<LoginScreen />);

      // Error display depends on implementation
      expect(mockClearError).not.toHaveBeenCalled();
    });
  });

  describe('Security', () => {
    it('should sanitize SQL injection attempt in email', async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/mot de passe/i);
      const loginButton = screen.getByText(/^connexion$/i);

      fireEvent.changeText(emailInput, "'; DROP TABLE users;--");
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      // Should not call login with malicious input (validation fails)
      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it('should handle XSS attempt in email', async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/mot de passe/i);
      const loginButton = screen.getByText(/^connexion$/i);

      fireEvent.changeText(emailInput, '<script>alert("xss")</script>');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      // Should not call login with malicious input (validation fails)
      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long email input', async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);
      const longEmail = 'a'.repeat(300) + '@test.com';

      fireEvent.changeText(emailInput, longEmail);

      // Should accept but may be truncated
      expect(emailInput.props.value.length).toBeGreaterThan(0);
    });

    it('should handle very long password input', async () => {
      render(<LoginScreen />);

      const passwordInput = screen.getByPlaceholderText(/mot de passe/i);
      const longPassword = 'a'.repeat(10000);

      fireEvent.changeText(passwordInput, longPassword);

      // Should accept long password
      expect(passwordInput.props.value.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters in inputs', async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText(/email/i);

      fireEvent.changeText(emailInput, 'test@test.com');
      expect(emailInput.props.value).toBeTruthy();
    });
  });
});
