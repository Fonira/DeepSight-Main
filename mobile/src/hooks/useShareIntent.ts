/**
 * 🔗 useShareIntent — Receive shared URLs from other apps (TikTok, YouTube, etc.)
 *
 * Uses expo-share-intent to handle ACTION_SEND intents (Android) and
 * Share Extension (iOS). When a user shares a TikTok/YouTube URL from
 * another app, DeepSight receives it and auto-navigates to analysis.
 *
 * Requires: npm install expo-share-intent
 * Note: expo-share-intent only works in dev builds, NOT Expo Go.
 */

import { useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { validateYouTubeUrl } from '../utils/formatters';
import { videoApi } from '../services/api';

interface NavigationLike {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
}

/**
 * Extract a URL from shared text content.
 * Handles cases where TikTok shares include extra text around the URL.
 * Example: "Regarde cette vidéo ! https://vm.tiktok.com/abc123 #tiktok"
 */
function extractUrlFromText(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  // Try direct validation first (if the whole text is a URL)
  const directResult = validateYouTubeUrl(trimmed);
  if (directResult.isValid) return trimmed;

  // Extract URLs from text using regex
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const urls = trimmed.match(urlPattern);

  if (!urls) return null;

  // Find the first valid YouTube or TikTok URL
  for (const url of urls) {
    const result = validateYouTubeUrl(url);
    if (result.isValid) return url;
  }

  return null;
}

/**
 * Hook to handle incoming shared content from other apps.
 * Call this in the DeepLinkHandler component which already has navigation access.
 *
 * @param navigation - React Navigation object with navigate()
 * @param isAuthenticated - Whether the user is logged in
 */
export function useShareIntent(
  navigation: NavigationLike,
  isAuthenticated: boolean,
): void {
  const processedUrlsRef = useRef<Set<string>>(new Set());

  const handleSharedUrl = useCallback(async (url: string) => {
    // Deduplicate — don't process the same URL twice in quick succession
    if (processedUrlsRef.current.has(url)) return;
    processedUrlsRef.current.add(url);
    setTimeout(() => processedUrlsRef.current.delete(url), 10_000);

    const validation = validateYouTubeUrl(url);
    if (!validation.isValid) return;

    // If not authenticated, can't analyze — just alert
    if (!isAuthenticated) {
      Alert.alert(
        'DeepSight',
        'Connectez-vous pour analyser cette vidéo.',
      );
      return;
    }

    try {
      // Auto-start analysis
      const response = await videoApi.analyze({
        url,
        mode: 'standard',
        language: 'fr',
        model: 'mistral',
        category: 'auto',
      });

      const taskId = response.task_id;
      if (!taskId) return;

      navigation.navigate('Analysis', {
        videoUrl: url,
        summaryId: taskId,
      });
    } catch (err: any) {
      if (__DEV__) console.error('[ShareIntent] Auto-analyze failed:', err);

      if (err?.status === 402 || err?.status === 403) {
        Alert.alert(
          'Quota dépassé',
          'Passez à un plan supérieur pour analyser cette vidéo.',
        );
      } else {
        // Navigate to Dashboard — user can retry manually
        Alert.alert(
          'Erreur',
          'Impossible de lancer l\'analyse. Réessayez depuis l\'app.',
        );
      }
    }
  }, [navigation, isAuthenticated]);

  // Handle share intents via expo-share-intent (dev builds only)
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function initShareIntent() {
      try {
        // Dynamic import — only available in dev builds with expo-share-intent
        const ShareIntent = await import('expo-share-intent');

        // Handle initial share (app opened via share action)
        const initial = ShareIntent.getShareIntent?.();
        if (initial?.text) {
          const url = extractUrlFromText(initial.text);
          if (url) handleSharedUrl(url);
        } else if ((initial as any)?.webUrl) {
          const url = extractUrlFromText((initial as any).webUrl);
          if (url) handleSharedUrl(url);
        }

        // Subscribe to new shares while app is open
        const subscription = ShareIntent.addShareIntentListener?.((intent: { text?: string; webUrl?: string }) => {
          const text = intent?.text || intent?.webUrl || '';
          const url = extractUrlFromText(text);
          if (url) handleSharedUrl(url);
        });

        cleanup = () => {
          subscription?.remove?.();
        };
      } catch {
        // expo-share-intent not installed (Expo Go) — silent fail
        if (__DEV__) console.log('[ShareIntent] expo-share-intent not available (Expo Go?)');
      }
    }

    initShareIntent();

    return () => {
      cleanup?.();
    };
  }, [handleSharedUrl]);
}

export { extractUrlFromText };
