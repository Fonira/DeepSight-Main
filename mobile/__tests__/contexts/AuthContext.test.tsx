/**
 * Tests for AuthContext (contexts/AuthContext.tsx)
 * Covers: login success/fail, logout, auto-login, auto-logout on 401
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock dependencies
const mockLogin = jest.fn();
const mockGetMe = jest.fn();
const mockGoogleTokenLogin = jest.fn();
const mockLogout = jest.fn();
const mockForgotPassword = jest.fn();
const mockRegister = jest.fn();
const mockVerifyEmail = jest.fn();
const mockResendVerification = jest.fn();

jest.mock('../../src/services/api', () => ({
  authApi: {
    login: (...args: any[]) => mockLogin(...args),
    getMe: (...args: any[]) => mockGetMe(...args),
    googleTokenLogin: (...args: any[]) => mockGoogleTokenLogin(...args),
    logout: (...args: any[]) => mockLogout(...args),
    forgotPassword: (...args: any[]) => mockForgotPassword(...args),
    register: (...args: any[]) => mockRegister(...args),
    verifyEmail: (...args: any[]) => mockVerifyEmail(...args),
    resendVerification: (...args: any[]) => mockResendVerification(...args),
  },
  notificationsApi: {
    registerPushToken: jest.fn().mockResolvedValue(undefined),
    unregisterPushToken: jest.fn().mockResolvedValue(undefined),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    detail?: string;
    constructor(message: string, status: number, code?: string, detail?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.detail = detail;
    }
    get isEmailNotVerified() {
      return this.status === 403 && (this.code === 'EMAIL_NOT_VERIFIED' || this.detail === 'EMAIL_NOT_VERIFIED');
    }
  },
}));

const mockHasTokens = jest.fn();
const mockClearTokens = jest.fn();
const mockSetUser = jest.fn();
const mockClearUser = jest.fn();

jest.mock('../../src/utils/storage', () => ({
  tokenStorage: {
    hasTokens: (...args: any[]) => mockHasTokens(...args),
    clearTokens: (...args: any[]) => mockClearTokens(...args),
    setTokens: jest.fn().mockResolvedValue(undefined),
    getAccessToken: jest.fn().mockResolvedValue(null),
    getRefreshToken: jest.fn().mockResolvedValue(null),
  },
  userStorage: {
    setUser: (...args: any[]) => mockSetUser(...args),
    getUser: jest.fn().mockResolvedValue(null),
    clearUser: (...args: any[]) => mockClearUser(...args),
  },
}));

jest.mock('../../src/services/notifications', () => ({
  initializeNotifications: jest.fn().mockResolvedValue({ permissionGranted: false, pushToken: null }),
  getPushToken: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../src/services/analytics', () => ({
  analytics: {
    identify: jest.fn(),
    track: jest.fn(),
    reset: jest.fn(),
  },
}));

// Import after mocks
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@test.com',
  plan: 'free',
  credits: 100,
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasTokens.mockResolvedValue(false);
    mockClearTokens.mockResolvedValue(undefined);
    mockSetUser.mockResolvedValue(undefined);
    mockClearUser.mockResolvedValue(undefined);
  });

  describe('Initial State', () => {
    it('should start with loading=true and no user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initial state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should finish loading when no tokens stored', async () => {
      mockHasTokens.mockResolvedValue(false);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Auto-login on Startup', () => {
    it('should restore session if valid token exists', async () => {
      mockHasTokens.mockResolvedValue(true);
      mockGetMe.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });

    it('should clear tokens on 401 during auto-login', async () => {
      const { ApiError } = require('../../src/services/api');
      mockHasTokens.mockResolvedValue(true);
      mockGetMe.mockRejectedValue(new ApiError('Unauthorized', 401));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(mockClearTokens).toHaveBeenCalled();
      expect(mockClearUser).toHaveBeenCalled();
    });

    it('should NOT clear tokens on network error during init', async () => {
      mockHasTokens.mockResolvedValue(true);
      mockGetMe.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockClearTokens).not.toHaveBeenCalled();
    });
  });

  describe('Login', () => {
    it('should update user state on successful login', async () => {
      mockHasTokens.mockResolvedValue(false);
      mockLogin.mockResolvedValue({
        access_token: 'access',
        refresh_token: 'refresh',
        user: mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login('test@test.com', 'password123');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBeNull();
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });

    it('should set error state on login failure', async () => {
      const { ApiError } = require('../../src/services/api');
      mockHasTokens.mockResolvedValue(false);
      mockLogin.mockRejectedValue(new ApiError('Email ou mot de passe incorrect', 401));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.login('test@test.com', 'wrong');
        } catch {
          // Expected
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe('Email ou mot de passe incorrect');
    });

    it('should set pending verification email on EMAIL_NOT_VERIFIED', async () => {
      const { ApiError } = require('../../src/services/api');
      mockHasTokens.mockResolvedValue(false);
      const error = new ApiError('Not verified', 403, 'EMAIL_NOT_VERIFIED');
      mockLogin.mockRejectedValue(error);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.login('unverified@test.com', 'password');
        } catch {
          // Expected
        }
      });

      expect(result.current.pendingVerificationEmail).toBe('unverified@test.com');
    });
  });

  describe('Logout', () => {
    it('should reset state and clear storage on logout', async () => {
      // Setup: start logged in
      mockHasTokens.mockResolvedValue(true);
      mockGetMe.mockResolvedValue(mockUser);
      mockLogout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockClearTokens).toHaveBeenCalled();
      expect(mockClearUser).toHaveBeenCalled();
    });

    it('should still clear local state if server logout fails', async () => {
      mockHasTokens.mockResolvedValue(true);
      mockGetMe.mockResolvedValue(mockUser);
      mockLogout.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('Error Management', () => {
    it('should clear error with clearError', async () => {
      const { ApiError } = require('../../src/services/api');
      mockHasTokens.mockResolvedValue(false);
      mockLogin.mockRejectedValue(new ApiError('Bad credentials', 401));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.login('test@test.com', 'wrong');
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBeTruthy();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Register', () => {
    it('should return requiresVerification on success', async () => {
      mockHasTokens.mockResolvedValue(false);
      mockRegister.mockResolvedValue({ message: 'Verification email sent' });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let registerResult: any;
      await act(async () => {
        registerResult = await result.current.register('user', 'test@test.com', 'password123');
      });

      expect(registerResult).toEqual({ requiresVerification: true });
    });
  });

  describe('Forgot Password', () => {
    it('should call forgotPassword API', async () => {
      mockHasTokens.mockResolvedValue(false);
      mockForgotPassword.mockResolvedValue({ message: 'Email sent' });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.forgotPassword('test@test.com');
      });

      expect(mockForgotPassword).toHaveBeenCalledWith('test@test.com');
    });
  });

  describe('Refresh User', () => {
    it('should update user data when refreshUser is called', async () => {
      mockHasTokens.mockResolvedValue(true);
      mockGetMe.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      const updatedUser = { ...mockUser, credits: 50 };
      mockGetMe.mockResolvedValue(updatedUser);

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toEqual(updatedUser);
    });

    it('should logout if refreshUser gets 401', async () => {
      const { ApiError } = require('../../src/services/api');
      mockHasTokens.mockResolvedValue(true);
      mockGetMe.mockResolvedValueOnce(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      mockGetMe.mockRejectedValue(new ApiError('Unauthorized', 401));

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toBeNull();
      expect(mockClearTokens).toHaveBeenCalled();
    });
  });
});
