import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { authApi, ApiError } from '../services/api';
import { tokenStorage, userStorage } from '../utils/storage';
import { GOOGLE_CLIENT_ID } from '../constants/config';
import type { User } from '../types';

// Complete any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

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

  // Get the redirect URI for Expo
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'deepsight',
    path: 'auth/callback',
  });

  // Google OAuth configuration with Expo proxy
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
  });

  // Handle Google OAuth response
  useEffect(() => {
    const handleGoogleResponse = async () => {
      console.log('Google OAuth response:', response?.type);

      if (response?.type === 'success') {
        setIsLoading(true);
        setError(null);
        try {
          // Get the authorization code or access token
          const { authentication, params } = response;

          if (authentication?.accessToken) {
            // We got an access token - send to backend
            console.log('Got access token, sending to backend...');
            const backendResponse = await authApi.googleTokenLogin(authentication.accessToken);
            setUser(backendResponse.user);
            await userStorage.setUser(backendResponse.user);
          } else if (params?.code) {
            // We got an authorization code - exchange via backend
            console.log('Got authorization code, exchanging via backend...');
            const backendResponse = await authApi.googleCallback(params.code);
            setUser(backendResponse.user);
            await userStorage.setUser(backendResponse.user);
          } else {
            throw new Error('No authentication data received from Google');
          }
        } catch (err) {
          console.error('Google login error:', err);
          const message = err instanceof ApiError ? err.message : 'Google login failed. Please try again.';
          setError(message);
        } finally {
          setIsLoading(false);
        }
      } else if (response?.type === 'error') {
        console.error('Google OAuth error:', response.error);
        setError(response.error?.message || 'Google login failed');
        setIsLoading(false);
      } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
        // User cancelled - just reset loading state, don't show error
        setIsLoading(false);
      }
    };

    if (response) {
      handleGoogleResponse();
    }
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
    setError(null);

    if (!request) {
      setError('Google login is not available. Please try again later.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting Google OAuth with redirect URI:', redirectUri);
      const result = await promptAsync();
      console.log('promptAsync result:', result?.type);

      // If cancelled or dismissed, reset loading state
      if (result?.type === 'cancel' || result?.type === 'dismiss') {
        setIsLoading(false);
      }
      // Success/error are handled by the useEffect above
    } catch (err) {
      console.error('Google login error:', err);
      const message = err instanceof Error ? err.message : 'Google login failed';
      setError(message);
      setIsLoading(false);
    }
  }, [promptAsync, request, redirectUri]);

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
