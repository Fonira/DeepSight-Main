import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { authApi, ApiError } from '../services/api';
import { tokenStorage, userStorage } from '../utils/storage';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID
} from '../constants/config';
import type { User } from '../types';

// Check if we're running in Expo Go (native modules not available)
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import Google Sign-In (only works in development builds, not Expo Go)
let GoogleSignin: any = null;
let statusCodes: any = {};
let isSuccessResponse: any = () => false;

if (!isExpoGo) {
  try {
    const googleSignIn = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleSignIn.GoogleSignin;
    statusCodes = googleSignIn.statusCodes;
    isSuccessResponse = googleSignIn.isSuccessResponse;

    // Configure Google Sign-In on app start
    GoogleSignin.configure({
      webClientId: GOOGLE_CLIENT_ID,
      iosClientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : undefined,
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
  } catch (e) {
    console.log('Google Sign-In not available (running in Expo Go)');
  }
}

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

  // Initialize auth state with aggressive timeout protection
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let isCompleted = false;

    const completeInit = () => {
      if (!isCompleted) {
        isCompleted = true;
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    const init = async () => {
      try {
        const hasTokens = await tokenStorage.hasTokens();
        if (!hasTokens) {
          // No tokens - complete immediately
          completeInit();
          return;
        }

        // Try to get user data with a shorter timeout
        const userData = await authApi.getMe();
        if (!isCompleted) {
          setUser(userData);
          await userStorage.setUser(userData);
        }
      } catch (error) {
        console.warn('Auth init error:', error);
        if (!isCompleted) {
          await tokenStorage.clearTokens().catch(() => {});
          await userStorage.clearUser().catch(() => {});
        }
      } finally {
        completeInit();
      }
    };

    // Safety timeout: ensure loading ends after 5 seconds max
    timeoutId = setTimeout(() => {
      if (!isCompleted) {
        console.warn('Auth init timeout (5s) - forcing loading complete');
        completeInit();
      }
    }, 5000);

    // Start init but don't let it block indefinitely
    init().catch((error) => {
      console.error('Auth init fatal error:', error);
      completeInit();
    });

    return () => {
      clearTimeout(timeoutId);
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
      const message = err instanceof ApiError ? err.message : 'Échec de la connexion';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    // Check if Google Sign-In is available (not in Expo Go)
    if (!GoogleSignin || isExpoGo) {
      setError('Connexion Google non disponible dans Expo Go. Utilisez un build de développement ou connectez-vous avec email/mot de passe.');
      setIsLoading(false);
      return;
    }

    try {
      // Check if device has Play Services (Android) or is configured properly
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Sign in with Google
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        // Get the access token
        const tokens = await GoogleSignin.getTokens();

        if (tokens.accessToken) {
          // Exchange with backend
          await handleGoogleToken(tokens.accessToken);
        } else {
          throw new Error('No access token received from Google');
        }
      } else {
        // User cancelled
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Google login error:', err);

      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled - don't show error
        setIsLoading(false);
      } else if (err.code === statusCodes.IN_PROGRESS) {
        setError('Connexion Google déjà en cours...');
        setIsLoading(false);
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services non disponible. Mettez à jour votre appareil.');
        setIsLoading(false);
      } else {
        setError('Impossible de se connecter avec Google. Veuillez réessayer.');
        setIsLoading(false);
      }
    }
  }, []);

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
