import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { authApi, ApiError } from '../services/api';
import { tokenStorage, userStorage } from '../utils/storage';
import type { User } from '../types';

// Complete any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client ID (same as web)
const GOOGLE_CLIENT_ID_WEB = '763654536492-8hkdd3n31tqeodnhcak6ef8asu4v287j.apps.googleusercontent.com';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<{ requiresVerification: boolean }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  refreshUser: (force?: boolean) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = user !== null;

  // Configure Google Auth redirect URI
  const redirectUri = makeRedirectUri({
    scheme: 'deepsight',
    path: 'auth/callback',
  });

  console.log('Google Auth redirect URI:', redirectUri);

  // Use Google auth request hook
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_ID_WEB,
    redirectUri,
  });

  // Handle Google auth response
  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type === 'success' && response.authentication?.accessToken) {
        setIsLoading(true);
        setError(null);
        try {
          console.log('Got Google access token, exchanging with backend...');
          // Send the Google access token to our backend
          const result = await authApi.googleTokenLogin(response.authentication.accessToken);
          setUser(result.user);
          await userStorage.setUser(result.user);
          console.log('Google login successful');
        } catch (err) {
          console.error('Google token exchange error:', err);
          const message = err instanceof ApiError ? err.message : 'Google login failed';
          setError(message);
        } finally {
          setIsLoading(false);
        }
      } else if (response?.type === 'error') {
        console.error('Google auth error:', response.error);
        setError(response.error?.message || 'Google authentication failed');
        setIsLoading(false);
      } else if (response?.type === 'cancel') {
        console.log('User cancelled Google login');
        setIsLoading(false);
      }
    };

    handleGoogleResponse();
  }, [response]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const hasTokens = await tokenStorage.hasTokens();
        if (hasTokens) {
          const userData = await authApi.getMe();
          setUser(userData);
          await userStorage.setUser(userData);
        }
      } catch (err) {
        console.error('Auth init error:', err);
        await tokenStorage.clearTokens();
        await userStorage.clearUser();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);
      setUser(response.user);
      await userStorage.setUser(response.user);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!request) {
      console.error('Google auth request not ready');
      setError('Google authentication is not ready. Please try again.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      console.log('Starting Google OAuth flow...');
      const result = await promptAsync();
      console.log('Google OAuth prompt result:', result.type);

      // The response will be handled by the useEffect above
      if (result.type !== 'success') {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Google login error:', err);
      const message = err instanceof Error ? err.message : 'Google login failed';
      setError(message);
      setIsLoading(false);
    }
  }, [request, promptAsync]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.register(username, email, password);
      return { requiresVerification: true };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.verifyEmail(email, code);
      setUser(response.user);
      await userStorage.setUser(response.user);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Email verification failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      await tokenStorage.clearTokens();
      await userStorage.clearUser();
      setIsLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Password reset failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async (force = false) => {
    if (!isAuthenticated && !force) return;

    try {
      const userData = await authApi.getMe();
      setUser(userData);
      await userStorage.setUser(userData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        await tokenStorage.clearTokens();
        await userStorage.clearUser();
      }
      console.error('Refresh user error:', err);
    }
  }, [isAuthenticated]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    loginWithGoogle,
    register,
    verifyEmail,
    logout,
    forgotPassword,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
