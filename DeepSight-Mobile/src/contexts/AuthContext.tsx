import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Linking from 'expo-linking';
import { authApi, ApiError } from '../services/api';
import { tokenStorage, userStorage } from '../utils/storage';
import { GOOGLE_CLIENT_ID, API_BASE_URL } from '../constants/config';
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
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'deepsight',
    path: 'auth/callback',
  });

  // Google OAuth configuration using expo-auth-session/providers/google
  // This directly interacts with Google, bypassing our backend for the OAuth flow
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_ID,
    scopes: ['profile', 'email'],
    // Request both access token and ID token
    responseType: 'token',
  });

  // Handle Google OAuth response from the Google provider
  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (googleResponse?.type === 'success') {
        const { authentication } = googleResponse;
        console.log('=== Google OAuth Success ===');
        console.log('Access token received:', !!authentication?.accessToken);
        console.log('ID token received:', !!authentication?.idToken);

        if (authentication?.accessToken) {
          setIsLoading(true);
          setError(null);

          try {
            // Try to exchange the Google access token with our backend
            console.log('Sending Google access token to backend...');

            // Try the token endpoint first (preferred for mobile)
            try {
              const authResponse = await authApi.googleTokenLogin(authentication.accessToken);
              console.log('Token exchange successful via /api/auth/google/token!');

              if (authResponse?.user) {
                setUser(authResponse.user);
                await userStorage.setUser(authResponse.user);
                console.log('Google login complete! User:', authResponse.user.email);
              }
              return;
            } catch (tokenErr) {
              console.log('Token endpoint failed (might not exist):', tokenErr instanceof Error ? tokenErr.message : 'Unknown error');

              // If token endpoint doesn't exist, we need an alternative
              // The backend needs to implement /api/auth/google/token for mobile OAuth
              throw new Error(
                'L\'endpoint d\'authentification Google mobile n\'est pas disponible. ' +
                'Veuillez contacter l\'administrateur pour activer /api/auth/google/token sur le backend.'
              );
            }
          } catch (err) {
            console.error('Google auth failed:', err);
            const message = err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Échec de la connexion Google';
            setError(message);
          } finally {
            setIsLoading(false);
          }
        }
      } else if (googleResponse?.type === 'error') {
        console.error('Google OAuth error:', googleResponse.error);
        setError('Authentification Google échouée: ' + (googleResponse.error?.message || 'Erreur inconnue'));
        setIsLoading(false);
      } else if (googleResponse?.type === 'dismiss' || googleResponse?.type === 'cancel') {
        console.log('Google OAuth cancelled/dismissed by user');
        setIsLoading(false);
      }
    };

    if (googleResponse) {
      handleGoogleResponse();
    }
  }, [googleResponse]);

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

  // Handle deep links for OAuth callback (used when backend redirects to mobile)
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      console.log('Deep link received:', event.url);

      try {
        const url = new URL(event.url);

        // Check if this is an auth callback
        if (url.pathname.includes('auth/callback') || url.host === 'auth') {
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          const code = url.searchParams.get('code');
          const errorParam = url.searchParams.get('error');

          if (errorParam) {
            console.error('OAuth error from deep link:', errorParam);
            setError('Authentification Google échouée: ' + errorParam);
            setIsLoading(false);
            return;
          }

          // If we received tokens directly
          if (accessToken && refreshToken) {
            console.log('Received session tokens from deep link');
            await tokenStorage.setTokens(accessToken, refreshToken);
            const userData = await authApi.getMe();
            setUser(userData);
            await userStorage.setUser(userData);
            console.log('User authenticated via deep link:', userData.email);
            setIsLoading(false);
            return;
          }

          // If we received a code, exchange it
          if (code) {
            console.log('Received authorization code from deep link');
            setIsLoading(true);
            try {
              const authResponse = await authApi.googleCallback(code);
              setUser(authResponse.user);
              await userStorage.setUser(authResponse.user);
              console.log('Google login successful via code exchange!');
            } catch (err) {
              console.error('Code exchange failed:', err);
              setError('Échec de l\'échange du code d\'autorisation');
            } finally {
              setIsLoading(false);
            }
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
    console.log('Using Google provider directly (recommended for Expo Go)');
    console.log('Google request ready:', !!googleRequest);
    console.log('Redirect URI:', redirectUri);

    setError(null);

    // Use the Google provider which works better in Expo Go
    if (googleRequest) {
      try {
        setIsLoading(true);
        console.log('Opening Google OAuth prompt...');
        const result = await promptGoogleAsync();
        console.log('Google OAuth result type:', result?.type);
        // Response handling is done in useEffect above
      } catch (err) {
        console.error('Google OAuth prompt error:', err);
        setError(err instanceof Error ? err.message : 'Échec de la connexion Google');
        setIsLoading(false);
      }
    } else {
      // Fallback: try the backend-based OAuth flow
      console.log('Google request not ready, trying backend OAuth flow...');
      setIsLoading(true);

      try {
        // Get OAuth URL from backend
        const { url: authUrl } = await authApi.googleLogin(redirectUri);

        if (!authUrl) {
          throw new Error('Impossible d\'obtenir l\'URL d\'authentification Google');
        }

        console.log('Opening browser for OAuth:', authUrl.substring(0, 80) + '...');
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        console.log('Browser result type:', result.type);

        if (result.type === 'success' && result.url) {
          const callbackUrl = new URL(result.url);
          const code = callbackUrl.searchParams.get('code');
          const errorParam = callbackUrl.searchParams.get('error');

          if (errorParam) {
            setError('Authentification Google annulée ou échouée');
            return;
          }

          if (code) {
            console.log('Exchanging authorization code...');
            const authResponse = await authApi.googleCallback(code);
            setUser(authResponse.user);
            await userStorage.setUser(authResponse.user);
            console.log('Google login successful!');
          }
        } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
          console.log('Unexpected OAuth result:', result.type);
        }
      } catch (err) {
        console.error('Backend OAuth flow failed:', err);
        const message = err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Échec de la connexion Google';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }
  }, [googleRequest, promptGoogleAsync, redirectUri]);

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
