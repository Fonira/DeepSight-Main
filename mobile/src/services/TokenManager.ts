/**
 * TokenManager - Proactive token refresh management
 *
 * Handles automatic token refresh before expiry, background refresh,
 * and session state management.
 */

import { API_BASE_URL } from '../constants/config';
import { tokenStorage } from '../utils/storage';

// Base64 decode function compatible with React Native
const base64Decode = (str: string): string => {
  try {
    // Try native atob first (available in some RN environments)
    if (typeof atob === 'function') {
      return atob(str);
    }
  } catch {
    // Fall through to manual decode
  }

  // Manual base64 decode for React Native
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';

  // Remove padding and fix URL-safe base64
  str = str.replace(/-/g, '+').replace(/_/g, '/');

  for (let i = 0; i < str.length; i += 4) {
    const enc1 = chars.indexOf(str.charAt(i));
    const enc2 = chars.indexOf(str.charAt(i + 1));
    const enc3 = chars.indexOf(str.charAt(i + 2));
    const enc4 = chars.indexOf(str.charAt(i + 3));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }

  return output;
};

// Token expiry buffer (refresh 2 minutes before expiry)
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

// Minimum interval between refresh attempts
const MIN_REFRESH_INTERVAL_MS = 30 * 1000;

// Session state
interface TokenState {
  accessToken: string | null;
  accessTokenExpiry: number | null;
  refreshToken: string | null;
  lastRefreshAttempt: number;
  isRefreshing: boolean;
}

// Singleton class for token management
class TokenManager {
  private state: TokenState = {
    accessToken: null,
    accessTokenExpiry: null,
    refreshToken: null,
    lastRefreshAttempt: 0,
    isRefreshing: false,
  };

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private sessionExpiredCallbacks: (() => void)[] = [];

  /**
   * Initialize token manager with stored tokens
   */
  async initialize(): Promise<void> {
    const accessToken = await tokenStorage.getAccessToken();
    const refreshToken = await tokenStorage.getRefreshToken();

    if (accessToken) {
      this.state.accessToken = accessToken;
      this.state.accessTokenExpiry = this.parseTokenExpiry(accessToken);
      this.state.refreshToken = refreshToken;
      this.scheduleRefresh();
    }
  }

  /**
   * Parse JWT token to get expiry time
   */
  private parseTokenExpiry(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      // Use our base64Decode function for React Native compatibility
      const payload = JSON.parse(base64Decode(parts[1]));
      if (payload.exp) {
        return payload.exp * 1000; // Convert to milliseconds
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Set new tokens after login
   */
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await tokenStorage.setTokens(accessToken, refreshToken);

    this.state.accessToken = accessToken;
    this.state.accessTokenExpiry = this.parseTokenExpiry(accessToken);
    this.state.refreshToken = refreshToken;

    this.scheduleRefresh();
  }

  /**
   * Clear tokens on logout
   */
  async clearTokens(): Promise<void> {
    this.cancelScheduledRefresh();

    this.state.accessToken = null;
    this.state.accessTokenExpiry = null;
    this.state.refreshToken = null;
    this.state.isRefreshing = false;
    this.refreshPromise = null;

    await tokenStorage.clearTokens();
  }

  /**
   * Get current access token, refreshing if needed
   */
  async getAccessToken(): Promise<string | null> {
    // If currently refreshing, wait for that to complete
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Check if token needs refresh
    if (this.shouldRefresh()) {
      return this.refresh();
    }

    // Return cached token
    if (this.state.accessToken) {
      return this.state.accessToken;
    }

    // Try to get from storage
    return tokenStorage.getAccessToken();
  }

  /**
   * Check if token should be refreshed
   */
  private shouldRefresh(): boolean {
    if (!this.state.accessToken || !this.state.accessTokenExpiry) {
      return false;
    }

    const now = Date.now();
    const timeUntilExpiry = this.state.accessTokenExpiry - now;

    return timeUntilExpiry <= REFRESH_BUFFER_MS;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    if (!this.state.accessTokenExpiry) {
      return true;
    }
    return Date.now() >= this.state.accessTokenExpiry;
  }

  /**
   * Schedule proactive token refresh
   */
  private scheduleRefresh(): void {
    this.cancelScheduledRefresh();

    if (!this.state.accessTokenExpiry) return;

    const now = Date.now();
    const timeUntilRefresh = this.state.accessTokenExpiry - now - REFRESH_BUFFER_MS;

    if (timeUntilRefresh <= 0) {
      // Token already needs refresh
      this.refresh();
      return;
    }

    if (__DEV__) {
      console.log(`[TokenManager] Scheduling refresh in ${Math.round(timeUntilRefresh / 1000)}s`);
    }

    this.refreshTimer = setTimeout(() => {
      this.refresh();
    }, timeUntilRefresh);
  }

  /**
   * Cancel scheduled refresh
   */
  private cancelScheduledRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Refresh access token
   */
  async refresh(): Promise<string | null> {
    // Prevent concurrent refresh
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Rate limit refresh attempts
    const now = Date.now();
    if (now - this.state.lastRefreshAttempt < MIN_REFRESH_INTERVAL_MS) {
      return this.state.accessToken;
    }

    this.state.lastRefreshAttempt = now;
    this.state.isRefreshing = true;

    this.refreshPromise = this.performRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
      this.state.isRefreshing = false;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performRefresh(): Promise<string | null> {
    const refreshToken = this.state.refreshToken || (await tokenStorage.getRefreshToken());

    if (!refreshToken) {
      this.handleSessionExpired();
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.handleSessionExpired();
        }
        return null;
      }

      const data = await response.json();

      // Update state and storage
      await this.setTokens(data.access_token, data.refresh_token);

      if (__DEV__) {
        console.log('[TokenManager] Token refreshed successfully');
      }

      return data.access_token;
    } catch (error) {
      if (__DEV__) { console.error('[TokenManager] Refresh failed:', error); }
      return null;
    }
  }

  /**
   * Handle session expiration
   */
  private handleSessionExpired(): void {
    this.clearTokens();

    // Notify all registered callbacks
    this.sessionExpiredCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        if (__DEV__) { console.error('[TokenManager] Session expired callback error:', error); }
      }
    });
  }

  /**
   * Register callback for session expiration
   */
  onSessionExpired(callback: () => void): () => void {
    this.sessionExpiredCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.sessionExpiredCallbacks.indexOf(callback);
      if (index !== -1) {
        this.sessionExpiredCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Retourne un access token valide. Refresh proactivement si expiry < 2min.
   * Utilisé par api.ts request() pour éviter les 401 réactifs.
   */
  async getValidToken(): Promise<string | null> {
    const token = this.state.accessToken;
    if (!token) return null;

    const now = Date.now();
    if (this.state.accessTokenExpiry && (this.state.accessTokenExpiry - now) < REFRESH_BUFFER_MS) {
      try {
        const newToken = await this.refresh();
        return newToken;
      } catch {
        return token;
      }
    }

    return token;
  }

  /**
   * Get current session state (for debugging)
   */
  getState(): Readonly<TokenState> {
    return { ...this.state };
  }

  /**
   * Check if user has valid session
   */
  hasValidSession(): boolean {
    return !!(this.state.accessToken && !this.isTokenExpired());
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();

// Helper hook for session expiry handling
export function useSessionExpiry(onExpired: () => void): void {
  // This should be called in a useEffect
  // The caller is responsible for managing the subscription
}

export default tokenManager;
