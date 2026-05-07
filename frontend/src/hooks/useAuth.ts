/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🔐 USE AUTH HOOK v7.0 — Sessions Robustes & Persistantes                          ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  FEATURES v7.0:                                                                    ║
 * ║  ✅ Session unique (déconnexion auto si login ailleurs)                            ║
 * ║  ✅ Persistance robuste (reste connecté après refresh)                             ║
 * ║  ✅ Refresh automatique des tokens avant expiration                                ║
 * ║  ✅ Détection session expirée côté serveur                                         ║
 * ║  ✅ Heartbeat pour vérifier la validité de la session                              ║
 * ║  ✅ Gestion 429 avec fallback cache                                                ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  authApi,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
  ApiError,
  User,
} from "../services/api";
import { getCapturedUtm } from "../services/utmCapture";
import { setUser as setSentryUser } from "../lib/sentry";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  // Alias pour compatibilité
  loading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (force?: boolean) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const REFRESH_DEBOUNCE_MS = 3000;
const INITIAL_LOAD_DELAY_MS = 100;
const LOCAL_USER_KEY = "cached_user";
const SESSION_CHECK_INTERVAL_MS = 60000; // Vérifier la session toutes les 60 secondes
const TOKEN_REFRESH_THRESHOLD_MS = 300000; // Refresh si expire dans moins de 5 min

// ═══════════════════════════════════════════════════════════════════════════════
// 🗄️ CACHE UTILISATEUR PERSISTANT
// ═══════════════════════════════════════════════════════════════════════════════

function getCachedUser(): User | null {
  try {
    const cached = localStorage.getItem(LOCAL_USER_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    // Cache valide 24h (augmenté pour meilleure persistance)
    if (Date.now() - data.timestamp > 86400000) {
      localStorage.removeItem(LOCAL_USER_KEY);
      return null;
    }

    return data.user;
  } catch {
    return null;
  }
}

function setCachedUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(
        LOCAL_USER_KEY,
        JSON.stringify({
          user,
          timestamp: Date.now(),
        }),
      );
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
  } catch {
    /* Safari private mode */
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 FONCTIONS UTILITAIRES TOKEN
// ═══════════════════════════════════════════════════════════════════════════════

function parseJwt(token: string): { exp?: number; sub?: string } | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload?.exp) return true;

  const expiresAt = payload.exp * 1000;
  const now = Date.now();

  return expiresAt - now < TOKEN_REFRESH_THRESHOLD_MS;
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload?.exp) return true;

  return Date.now() >= payload.exp * 1000;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🪝 HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export function useAuth(): UseAuthReturn {
  const initialUser = useMemo(() => {
    const token = getAccessToken();
    if (!token) return null;
    // Ne pas utiliser un token expiré
    if (isTokenExpired(token)) {
      // Essayer le refresh token
      const refreshToken = getRefreshToken();
      if (!refreshToken || isTokenExpired(refreshToken)) {
        clearTokens();
        return null;
      }
    }
    return getCachedUser();
  }, []);

  const [state, setState] = useState<AuthState>({
    user: initialUser,
    isLoading: !initialUser && !!getAccessToken(),
    isAuthenticated: !!initialUser,
    error: null,
  });

  const lastRefreshRef = useRef<number>(0);
  const refreshInProgressRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const initializedRef = useRef<boolean>(false);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔄 REFRESH AUTOMATIQUE DES TOKENS
  // ═══════════════════════════════════════════════════════════════════════════

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await authApi.refresh(refreshToken);
      if (response.access_token) {
        setTokens(response.access_token, response.refresh_token);
        return true;
      }
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      // Si erreur SESSION_EXPIRED, déconnecter
      if (error instanceof ApiError) {
        const detail = error.message;
        if (
          detail.includes("SESSION_EXPIRED") ||
          detail.includes("session_expired")
        ) {
          clearTokens();
          setCachedUser(null);
          if (mountedRef.current) {
            setState({
              user: null,
              isLoading: false,
              isAuthenticated: false,
              error:
                "Votre session a expiré. Vous vous êtes peut-être connecté depuis un autre appareil.",
            });
          }
          window.dispatchEvent(new CustomEvent("auth:session_expired"));
        }
      }
    }
    return false;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔄 REFRESH USER
  // ═══════════════════════════════════════════════════════════════════════════

  const refreshUser = useCallback(
    async (force: boolean = false) => {
      const now = Date.now();

      // Si force=true, on bypass TOUT (debounce, inProgress, cache)
      if (force) {
        lastRefreshRef.current = 0;
        refreshInProgressRef.current = false;
        setCachedUser(null);
        try {
          localStorage.removeItem(LOCAL_USER_KEY);
        } catch {
          /* */
        }
      }

      // Check debounce seulement si pas force
      if (!force && now - lastRefreshRef.current < REFRESH_DEBOUNCE_MS) {
        return;
      }

      if (!force && refreshInProgressRef.current) {
        return;
      }

      let token = getAccessToken();
      if (!token) {
        if (mountedRef.current) {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: null,
          });
          setCachedUser(null);
        }
        return;
      }

      // 🆕 Vérifier si le token expire bientôt et le rafraîchir
      if (isTokenExpiringSoon(token)) {
        const refreshed = await refreshTokens();
        if (refreshed) {
          token = getAccessToken();
        }
      }

      // Vérifier si le token est expiré
      if (!token || isTokenExpired(token)) {
        const refreshed = await refreshTokens();
        if (!refreshed) {
          if (mountedRef.current) {
            setState({
              user: null,
              isLoading: false,
              isAuthenticated: false,
              error: null,
            });
            setCachedUser(null);
          }
          return;
        }
      }

      lastRefreshRef.current = now;
      refreshInProgressRef.current = true;

      if (!state.user && mountedRef.current) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      try {
        const user = await authApi.me(force ? { skipCache: true } : undefined);

        if (mountedRef.current) {
          setState({
            user,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          });
          setCachedUser(user);
          setSentryUser(
            user ? { id: user.id, email: user.email, plan: user.plan } : null,
          );

          window.dispatchEvent(
            new CustomEvent("user:updated", { detail: user }),
          );
        }
      } catch (error) {
        if (!mountedRef.current) return;

        // 🆕 Gérer l'erreur SESSION_EXPIRED
        if (error instanceof ApiError) {
          const errorDetail = error.message || "";
          if (
            errorDetail.includes("session_expired") ||
            errorDetail.includes("SESSION_EXPIRED")
          ) {
            clearTokens();
            setCachedUser(null);
            setState({
              user: null,
              isLoading: false,
              isAuthenticated: false,
              error:
                "Votre session a expiré. Vous vous êtes peut-être connecté depuis un autre appareil.",
            });
            window.dispatchEvent(new CustomEvent("auth:session_expired"));
            return;
          }

          if (error.isRateLimited) {
            const cached = getCachedUser();
            if (cached) {
              setState({
                user: cached,
                isLoading: false,
                isAuthenticated: true,
                error: null,
              });
              refreshInProgressRef.current = false;
              return;
            }
          }

          if (error.isUnauthorized) {
            // Essayer de refresh le token
            const refreshed = await refreshTokens();
            if (refreshed) {
              // Réessayer après refresh
              refreshInProgressRef.current = false;
              return refreshUser(false);
            }

            clearTokens();
            setCachedUser(null);
            setState({
              user: null,
              isLoading: false,
              isAuthenticated: false,
              error: "Session expirée",
            });
            return;
          }
        }

        const cached = getCachedUser();
        if (cached) {
          setState((prev) => ({
            ...prev,
            user: cached,
            isLoading: false,
            isAuthenticated: true,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "Erreur de connexion",
          }));
        }
      } finally {
        refreshInProgressRef.current = false;
      }
    },
    [state.user, refreshTokens],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔓 LOGIN EMAIL/PASSWORD
  // ═══════════════════════════════════════════════════════════════════════════

  const login = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        await authApi.login(email, password);
        await refreshUser(true); // Force refresh après login
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : "Erreur de connexion";

        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: message,
          }));
        }
        throw error;
      }
    },
    [refreshUser],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔓 LOGIN GOOGLE
  // ═══════════════════════════════════════════════════════════════════════════

  const loginWithGoogle = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await authApi.loginWithGoogle();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Erreur de connexion Google";

      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      }
      throw error;
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 📝 REGISTER
  // ═══════════════════════════════════════════════════════════════════════════

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // 🚀 Launch J0 — joindre les UTM auto-capturés (cf. utmCapture.ts).
        // Le backend persiste dans User.preferences pour PostHog cohorts.
        const utm = getCapturedUtm();
        await authApi.register(username, email, password, {
          signup_source: utm.utm_source ?? "direct",
          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium,
          utm_campaign: utm.utm_campaign,
          referrer: utm.referrer,
        });

        if (mountedRef.current) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : "Erreur d'inscription";

        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: message,
          }));
        }
        throw error;
      }
    },
    [],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ✅ VERIFY EMAIL
  // ═══════════════════════════════════════════════════════════════════════════

  const verifyEmail = useCallback(async (email: string, code: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await authApi.verifyEmail(email, code);

      if (mountedRef.current) {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Code invalide";

      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      }
      throw error;
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚪 LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    } finally {
      clearTokens();
      setCachedUser(null);
      setSentryUser(null);

      // Arrêter le heartbeat
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }

      if (mountedRef.current) {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }

      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💓 SESSION HEARTBEAT
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (state.isAuthenticated && !sessionCheckIntervalRef.current) {
      sessionCheckIntervalRef.current = setInterval(async () => {
        const token = getAccessToken();
        if (!token) return;

        // Vérifier si le token expire bientôt
        if (isTokenExpiringSoon(token)) {
          await refreshTokens();
        }
      }, SESSION_CHECK_INTERVAL_MS);
    }

    return () => {
      if (!state.isAuthenticated && sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    };
  }, [state.isAuthenticated, refreshTokens]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎬 INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    mountedRef.current = true;

    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const token = getAccessToken();
    if (token && !initialUser) {
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          refreshUser();
        }
      }, INITIAL_LOAD_DELAY_MS);

      return () => {
        clearTimeout(timer);
        mountedRef.current = false;
      };
    } else if (token && initialUser) {
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          refreshUser();
        }
      }, 1000);

      return () => {
        clearTimeout(timer);
        mountedRef.current = false;
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [refreshUser, initialUser]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 📡 EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const handleLogout = () => {
      if (mountedRef.current) {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
        setCachedUser(null);
      }
    };

    const handleSessionExpired = () => {
      handleLogout();
    };

    const handleAuthSuccess = () => {
      setTimeout(() => {
        if (mountedRef.current) {
          lastRefreshRef.current = 0;
          refreshUser(true);
        }
      }, 500);
    };

    // 🆕 Écouter les changements de localStorage (sync entre onglets)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "access_token") {
        if (!e.newValue) {
          // Token supprimé dans un autre onglet = logout
          handleLogout();
        } else if (e.newValue !== e.oldValue) {
          // Nouveau token = refresh user
          refreshUser(true);
        }
      }
    };

    // 🆕 Écouter la visibilité de la page (refresh au retour)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && state.isAuthenticated) {
        const token = getAccessToken();
        if (token && isTokenExpiringSoon(token)) {
          refreshTokens();
        }
      }
    };

    window.addEventListener("auth:logout", handleLogout);
    window.addEventListener("auth:session_expired", handleSessionExpired);
    window.addEventListener("auth:success", handleAuthSuccess);
    window.addEventListener("storage", handleStorageChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("auth:logout", handleLogout);
      window.removeEventListener("auth:session_expired", handleSessionExpired);
      window.removeEventListener("auth:success", handleAuthSuccess);
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [refreshUser, refreshTokens, state.isAuthenticated]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 📤 RETURN
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    ...state,
    loading: state.isLoading,
    login,
    loginWithGoogle,
    register,
    verifyEmail,
    logout,
    refreshUser,
  };
}

export default useAuth;
