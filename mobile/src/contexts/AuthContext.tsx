import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { authApi, ApiError } from '../services/api';
import { tokenStorage, userStorage } from '../utils/storage';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_EXPO_CLIENT_ID
} from '../constants/config';
import type { User } from '../types';

// Required for web browser auth session
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = user !== null;

  // Google OAuth setup - gets access token directly from Google
  // Uses platform-specific client IDs for native builds
  // IMPORTANT: Use Expo auth proxy for Expo Go compatibility
  // The proxy URL must be registered in Google Cloud Console
  const EXPO_PROXY_REDIRECT_URI = 'https://auth.expo.io/@maximeadmin/deepsight';

  // Use proxy for Expo Go, native scheme for standalone builds
  const redirectUri = __DEV__
    ? EXPO_PROXY_REDIRECT_URI  // Expo Go uses proxy
    : makeRedirectUri({ scheme: 'deepsight', path: 'oauth' });  // Standalone uses native

  const [request, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    expoClientId: GOOGLE_EXPO_CLIENT_ID,
    scopes: ['profile', 'email'],
    redirectUri,
  });

  // Handle Google OAuth response
  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === 'success' && googleResponse.authentication?.accessToken) {
      handleGoogleToken(googleResponse.authentication.accessToken);
    } else if (googleResponse.type === 'cancel' || googleResponse.type === 'dismiss') {
      // User cancelled - don't show error, just reset loading
      setIsLoading(false);
    } else if (googleResponse.type === 'error') {
      console.error('Google OAuth error:', googleResponse.error);
      setError('Échec de la connexion Google. Veuillez réessayer.');
      setIsLoading(false);
    }
  }, [googleResponse]);

  // Exchange Google token with backend
  const handleGoogleToken = async (googleAccessToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.googleTokenLogin(googleAccessToken);
      setUser(response.user);
      await userStorage.setUser(response.user);
    } catch (err) {
      console.error('Google token exchange failed:', err);
      if (err instanceof ApiError && err.status === 404) {
        setError('Connexion Google non disponible. Utilisez email/mot de passe.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Échec de la connexion Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize auth state
  useEffect(() => {
    const init = async () => {
      try {
        if (await tokenStorage.hasTokens()) {
          const userData = await authApi.getMe();
          setUser(userData);
          await userStorage.setUser(userData);
        }
      } catch {
        await tokenStorage.clearTokens();
        await userStorage.clearUser();
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);
      setUser(response.user);
      await userStorage.setUser(response.user);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Échec de la connexion';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);

    // Check if Google auth request is ready
    if (!request) {
      setError('Configuration Google OAuth en cours. Veuillez réessayer.');
      return;
    }

    setIsLoading(true);
    try {
      // Use proxy in dev mode (Expo Go) for proper redirect handling
      const result = await promptGoogleAsync({ useProxy: __DEV__ });
      // If result is null or user cancelled, the useEffect will handle it
      if (!result) {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Google login error:', err);
      setError('Impossible de lancer la connexion Google. Vérifiez votre connexion.');
      setIsLoading(false);
    }
  }, [request, promptGoogleAsync]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.register(username, email, password);
      return { requiresVerification: true };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Échec de l\'inscription';
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
      const message = err instanceof ApiError ? err.message : 'Échec de la vérification';
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
    } catch {}
    setUser(null);
    await tokenStorage.clearTokens();
    await userStorage.clearUser();
    setIsLoading(false);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Échec de la réinitialisation';
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
    }
  }, [isAuthenticated]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoading, error,
      login, loginWithGoogle, register, verifyEmail,
      logout, forgotPassword, refreshUser, clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default AuthContext;
