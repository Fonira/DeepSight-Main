import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { authApi, notificationsApi, ApiError } from '../services/api';
import { tokenStorage, userStorage } from '../utils/storage';
import { initializeNotifications, getPushToken } from '../services/notifications';
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
    // Google Sign-In not available (running in Expo Go)
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  pendingVerificationEmail: string | null;  // Email awaiting verification
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<{ requiresVerification: boolean }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  refreshUser: (force?: boolean) => Promise<void>;
  clearError: () => void;
  clearPendingVerification: () => void;
  resendVerificationCode: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);

  const isAuthenticated = user !== null;

  // Register push token with backend (non-blocking)
  const registerPushToken = useCallback(async () => {
    try {
      const { permissionGranted, pushToken } = await initializeNotifications();
      if (permissionGranted && pushToken) {
        pushTokenRef.current = pushToken;
        await notificationsApi.registerPushToken(pushToken, Platform.OS);
        if (__DEV__) { console.log('[Auth] Push token registered:', pushToken.slice(0, 30) + '...'); }
      }
    } catch (err) {
      if (__DEV__) { console.warn('[Auth] Push token registration failed:', err); }
    }
  }, []);

  // Exchange Google token with backend
  const handleGoogleToken = async (googleAccessToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.googleTokenLogin(googleAccessToken);
      setUser(response.user);
      await userStorage.setUser(response.user);
      // Register push token (non-blocking)
      registerPushToken();
    } catch (err) {
      if (__DEV__) { console.error('Google token exchange failed:', err); }
      if (err instanceof ApiError && err.status === 404) {
        setError('Connexion Google non disponible. Utilisez email/mot de passe.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Échec de la connexion Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize auth state - restore session from stored tokens
  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const init = async () => {
      try {
        const hasTokens = await tokenStorage.hasTokens();

        if (cancelled) return;

        if (!hasTokens) {
          setIsLoading(false);
          return;
        }

        const userData = await authApi.getMe();

        if (!cancelled) {
          setUser(userData);
          await userStorage.setUser(userData).catch(() => {});
          // Register push token on session restore (non-blocking)
          registerPushToken();
        }
      } catch (error) {
        if (__DEV__) { console.warn('[Auth] Init error:', error); }
        if (!cancelled) {
          // Only clear tokens on explicit 401 (server confirmed tokens are invalid)
          // Network errors, timeouts, etc. should NOT log the user out
          const isAuthError = error instanceof ApiError && error.status === 401;
          if (isAuthError) {
            await tokenStorage.clearTokens().catch(() => {});
            await userStorage.clearUser().catch(() => {});
          }
        }
      } finally {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setIsLoading(false);
        }
      }
    };

    // Safety timeout: ensure loading ends after 5 seconds max
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        if (__DEV__) { console.warn('[Auth] Init timeout (5s) - forcing loading complete'); }
        cancelled = true;
        setIsLoading(false);
      }
    }, 5000);

    init().catch((error) => {
      if (__DEV__) { console.error('[Auth] Init fatal error:', error); }
      if (!cancelled) {
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true; // Prevent stale async ops from clearing tokens (StrictMode safe)
      clearTimeout(timeoutId);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    setPendingVerificationEmail(null);
    try {
      const response = await authApi.login(email, password);

      // Validate response before setting user
      if (!response.user) {
        if (__DEV__) { console.error('[Auth] Login response missing user object'); }
        throw new Error('Réponse serveur invalide: utilisateur manquant');
      }

      setUser(response.user);

      // Save user to storage (non-blocking, errors logged but not thrown)
      try {
        await userStorage.setUser(response.user);
      } catch (storageError) {
        if (__DEV__) { console.warn('[Auth] Failed to save user to storage:', storageError); }
        // Continue anyway - user is already in state
      }

      // Register push token (non-blocking)
      registerPushToken();
    } catch (err) {
      if (__DEV__) { console.error('[Auth] Login failed:', err); }
      // Check for email verification required error
      if (err instanceof ApiError && err.isEmailNotVerified) {
        setPendingVerificationEmail(email);
        setError('Votre email n\'est pas encore vérifié. Veuillez vérifier votre boîte mail.');
        throw err;
      }
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
      if (__DEV__) { console.error('Google login error:', err); }

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
    // Unregister push token before logging out
    if (pushTokenRef.current) {
      try {
        await notificationsApi.unregisterPushToken(pushTokenRef.current, Platform.OS);
      } catch {
        // Ignore — best effort cleanup
      }
      pushTokenRef.current = null;
    }
    try {
      await authApi.logout();
    } catch {
      // Server logout may fail (expired token, network), continue with local cleanup
    }
    try {
      setUser(null);
      await tokenStorage.clearTokens();
      await userStorage.clearUser();
    } catch (cleanupError) {
      if (__DEV__) { console.warn('[Auth] Logout cleanup error:', cleanupError); }
      // Ensure user is still cleared even if storage fails
      setUser(null);
    } finally {
      setIsLoading(false);
    }
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

  const clearPendingVerification = useCallback(() => {
    setPendingVerificationEmail(null);
  }, []);

  const resendVerificationCode = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.resendVerification(email);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Échec du renvoi';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoading, error, pendingVerificationEmail,
      login, loginWithGoogle, register, verifyEmail,
      logout, forgotPassword, refreshUser, clearError,
      clearPendingVerification, resendVerificationCode,
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
