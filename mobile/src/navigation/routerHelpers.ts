/**
 * Helper functions for Expo Router navigation
 * Provides convenient shortcuts and type-safe navigation
 */

import { router } from 'expo-router';
import * as Linking from 'expo-linking';

/**
 * Auth navigation shortcuts
 */
export const authRoutes = {
  welcome: () => router.replace('/(auth)'),
  login: () => router.push('/(auth)/login'),
  register: () => router.push('/(auth)/register'),
  verify: (email?: string) => {
    router.push({
      pathname: '/(auth)/verify',
      params: { email },
    });
  },
  forgotPassword: () => router.push('/(auth)/forgot-password'),
};

/**
 * Tab navigation shortcuts
 */
export const tabRoutes = {
  home: () => router.replace('/(tabs)'),
  library: () => router.replace('/(tabs)/library'),
  study: () => router.replace('/(tabs)/study'),
  profile: () => router.replace('/(tabs)/profile'),
};

/**
 * Analysis navigation
 */
export const analysisRoutes = {
  detail: (id: string) => router.push(`/(tabs)/analysis/${id}`),
};

/**
 * Deep linking helper
 */
export const handleDeepLink = async (url: string) => {
  const parsed = Linking.createURL(url);
  const canOpenURL = await Linking.canOpenURL(parsed);

  if (canOpenURL) {
    Linking.openURL(parsed).catch((err) => {
      console.error('[Router] Deep link error:', err);
    });
  }
};

/**
 * Safe navigation (with fallback)
 */
export const safeNavigate = (href: string, fallback?: string) => {
  try {
    router.push(href);
  } catch (error) {
    console.error('[Router] Navigation error:', error);
    if (fallback) {
      router.push(fallback);
    }
  }
};

/**
 * Modal navigation (if using modal pattern)
 */
export const presentModal = (href: string) => {
  router.push({
    pathname: href,
  });
};

/**
 * Logout and reset to auth
 */
export const logout = () => {
  router.replace('/(auth)');
};

/**
 * Reset to home after auth
 */
export const goHome = () => {
  router.replace('/(tabs)');
};
