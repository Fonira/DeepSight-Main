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

  // Configure redirect URI for OAuth callback
  // Uses deepsight://auth/callback for deep linking
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
    console.log('=== loginWithGoogle called (code flow) ===');
    console.log('Redirect URI:', redirectUri);

    setError(null);
    setIsLoading(true);

    try {
      // Step 1: Get the Google OAuth URL from our backend
      console.log('Getting Google OAuth URL from backend...');
      const { url: authUrl } = await authApi.googleLogin(redirectUri);
      console.log('Got auth URL:', authUrl);

      // Step 2: Open browser for Google OAuth
      console.log('Opening browser for OAuth...');
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      console.log('Browser result type:', result.type);

      if (result.type === 'success' && result.url) {
        // Step 3: Extract the authorization code from the callback URL
        console.log('Success! Callback URL:', result.url);
        const callbackUrl = new URL(result.url);
        const code = callbackUrl.searchParams.get('code');
        const errorParam = callbackUrl.searchParams.get('error');

        if (errorParam) {
          console.error('OAuth error from callback:', errorParam);
          setError('Authentification Google annulée ou échouée.');
          setIsLoading(false);
          return;
        }

        if (!code) {
          console.error('No authorization code in callback URL');
          setError('Erreur lors de l\'authentification Google: code manquant.');
          setIsLoading(false);
          return;
        }

        // Step 4: Exchange the code for tokens via our backend
        console.log('Exchanging code for tokens...');
        const authResponse = await authApi.googleCallback(code);
        console.log('Google login successful!');

        setUser(authResponse.user);
        await userStorage.setUser(authResponse.user);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('User cancelled or dismissed OAuth');
      } else {
        console.log('OAuth flow ended with type:', result.type);
      }
    } catch (err) {
      console.error('Google login exception:', err);
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
