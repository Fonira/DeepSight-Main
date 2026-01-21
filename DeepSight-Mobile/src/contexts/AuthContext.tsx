import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { authApi, ApiError } from '../services/api';
import { tokenStorage, userStorage } from '../utils/storage';
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

  // Create redirect URI for the mobile app
  const redirectUri = Linking.createURL('auth/callback');

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

  // Handle deep links for OAuth callback
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      console.log('=== Deep link received ===');
      console.log('URL:', event.url);

      try {
        const url = new URL(event.url);
        console.log('Pathname:', url.pathname);
        console.log('Search params:', url.search);

        // Check if this is an auth callback
        if (url.pathname.includes('auth/callback') || url.pathname.includes('auth') || event.url.includes('auth/callback')) {
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          const errorParam = url.searchParams.get('error');

          console.log('Access token received:', !!accessToken);
          console.log('Refresh token received:', !!refreshToken);
          console.log('Error param:', errorParam);

          if (errorParam) {
            console.error('OAuth error from callback:', errorParam);
            setError('Authentification Google échouée: ' + errorParam);
            setIsLoading(false);
            return;
          }

          if (accessToken && refreshToken) {
            console.log('Saving tokens and fetching user...');
            setIsLoading(true);
            await tokenStorage.setTokens(accessToken, refreshToken);

            // Fetch user data
            const userData = await authApi.getMe();
            setUser(userData);
            await userStorage.setUser(userData);
            console.log('Google login successful! User:', userData.email);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Error handling deep link:', err);
        setIsLoading(false);
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for initial URL (app opened from deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL detected:', url);
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
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
    console.log('=== loginWithGoogle called ===');
    console.log('Mobile redirect URI:', redirectUri);

    setError(null);
    setIsLoading(true);

    try {
      // Step 1: Get the Google OAuth URL from backend
      // Backend will use its own callback URL, then redirect to our redirectUri with tokens
      console.log('Step 1: Getting auth URL from backend...');
      const { url: authUrl } = await authApi.googleLogin(redirectUri);
      console.log('Auth URL received:', authUrl?.substring(0, 100) + '...');

      if (!authUrl) {
        throw new Error('Impossible d\'obtenir l\'URL d\'authentification Google');
      }

      // Step 2: Open browser for Google OAuth
      // The flow is:
      // 1. Browser opens Google login
      // 2. User authenticates
      // 3. Google redirects to backend callback
      // 4. Backend exchanges code for tokens
      // 5. Backend redirects to our redirectUri with tokens
      console.log('Step 2: Opening browser...');
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      console.log('Browser result type:', result.type);

      if (result.type === 'success' && result.url) {
        console.log('Step 3: Processing callback URL...');
        console.log('Callback URL:', result.url);

        const callbackUrl = new URL(result.url);
        const accessToken = callbackUrl.searchParams.get('access_token');
        const refreshToken = callbackUrl.searchParams.get('refresh_token');
        const errorParam = callbackUrl.searchParams.get('error');

        if (errorParam) {
          console.error('OAuth error:', errorParam);
          setError('Authentification Google échouée: ' + errorParam);
          setIsLoading(false);
          return;
        }

        if (accessToken && refreshToken) {
          console.log('Tokens received! Saving...');
          await tokenStorage.setTokens(accessToken, refreshToken);

          const userData = await authApi.getMe();
          setUser(userData);
          await userStorage.setUser(userData);
          console.log('Google login successful! User:', userData.email);
        } else {
          console.error('No tokens in callback URL');
          console.log('URL params:', callbackUrl.search);
          setError('Erreur: tokens manquants dans la réponse');
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('User cancelled OAuth');
      } else {
        console.log('Unexpected result type:', result.type);
      }
    } catch (err) {
      console.error('Google login error:', err);
      const message = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Échec de la connexion Google';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [redirectUri]);

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
