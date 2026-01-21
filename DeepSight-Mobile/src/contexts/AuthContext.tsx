import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { authApi, ApiError } from '../services/api';
import { tokenStorage, userStorage } from '../utils/storage';
import type { User } from '../types';

// Complete any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client IDs
// Web Client ID - used for Expo Go proxy auth (configured with redirect URI: https://auth.expo.io/@maximeadmin/deepsight)
const GOOGLE_CLIENT_ID_WEB = '763654536492-8hkdd3n31tqeodnhcak6ef8asu4v287j.apps.googleusercontent.com';
// For Expo Go, the web client ID works with useProxy: true

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
  // For Expo Go: automatically uses Expo's auth proxy
  // For standalone builds: uses deepsight://auth/callback
  const redirectUri = makeRedirectUri({
    scheme: 'deepsight',
    path: 'auth/callback',
  });

  console.log('=== Google OAuth Debug ===');
  console.log('Redirect URI:', redirectUri);

  // Use Google auth request hook
  // webClientId is used for all platforms in Expo Go
  // Make sure https://auth.expo.io/@maximeadmin/deepsight is added as authorized redirect URI in Google Cloud Console
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_ID_WEB,
    redirectUri,
  });

  // Log request status for debugging
  useEffect(() => {
    console.log('=== Google Auth Request Status ===');
    console.log('Request ready:', !!request);
    if (request) {
      console.log('Auth URL:', request.url);
      console.log('Client ID:', request.clientId);
      console.log('Redirect URI from request:', request.redirectUri);
    } else {
      console.log('Request is null - Google OAuth not initialized');
    }
  }, [request]);

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
    console.log('=== loginWithGoogle called ===');
    console.log('Request object exists:', !!request);

    if (!request) {
      console.error('Google auth request not ready');
      setError('L\'authentification Google n\'est pas prête. Veuillez réessayer.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      console.log('Starting Google OAuth flow...');
      console.log('Redirect URI:', redirectUri);
      console.log('Auth URL:', request.url);

      // promptAsync will open the browser for OAuth
      const result = await promptAsync();
      console.log('Google OAuth prompt result type:', result.type);

      if (result.type === 'error') {
        console.error('OAuth error:', result.error);
        setError(result.error?.message || 'Erreur d\'authentification Google');
        setIsLoading(false);
      } else if (result.type === 'dismiss' || result.type === 'cancel') {
        console.log('User cancelled or dismissed OAuth');
        setIsLoading(false);
      }
      // Success case is handled by the useEffect watching 'response'
    } catch (err) {
      console.error('Google login exception:', err);
      const message = err instanceof Error ? err.message : 'Échec de la connexion Google';
      setError(message);
      setIsLoading(false);
    }
  }, [request, promptAsync, redirectUri]);

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
