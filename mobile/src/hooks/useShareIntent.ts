/**
 * 🔗 useDeepSightShareIntent — Receive shared URLs from YouTube/TikTok
 *
 * Uses expo-share-intent to handle ACTION_SEND intents (Android) and
 * Share Extension (iOS). When a user shares a video URL from another app,
 * DeepSight receives it and navigates to a choice screen (Quick Chat vs
 * full analysis).
 *
 * Flow: YouTube/TikTok → Share → DeepSight → /share-target → user picks
 *
 * Requires: expo-share-intent (dev builds only, NOT Expo Go).
 * The root layout MUST be wrapped with <ShareIntentProvider> for the iOS
 * wake-up URL `<scheme>://dataUrl=...` to be intercepted before Expo Router
 * tries to match it as a route.
 */

import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useShareIntent as useExpoShareIntent } from "expo-share-intent";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { validateYouTubeUrl } from "../utils/formatters";
import { useAuth } from "../contexts/AuthContext";

export const PENDING_SHARE_URL_KEY = "deepsight_pending_share_url";

/**
 * Extract the first valid YouTube/TikTok URL from a free-text payload.
 * Handles "Regarde ! https://vm.tiktok.com/abc #fun" style shares.
 */
export function extractUrlFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (validateYouTubeUrl(trimmed).isValid) return trimmed;

  const urls = trimmed.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi);
  if (!urls) return null;

  for (const candidate of urls) {
    if (validateYouTubeUrl(candidate).isValid) return candidate;
  }
  return null;
}

/**
 * Hook to handle incoming shared content from YouTube/TikTok.
 * Call once in the root RootNavigator.
 *
 * Behaviour:
 * - Extract a valid YouTube/TikTok URL from the share payload.
 * - If unauthenticated: stash the URL in AsyncStorage and bounce to /(auth).
 *   The RootNavigator will resume the share-target flow after login.
 * - If authenticated: navigate to /share-target with the URL as a param.
 */
export function useDeepSightShareIntent(): void {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const { hasShareIntent, shareIntent, resetShareIntent, error } =
    useExpoShareIntent({
      debug: __DEV__,
      resetOnBackground: true,
    });

  useEffect(() => {
    if (!hasShareIntent) return;

    const url =
      extractUrlFromText(shareIntent?.webUrl) ??
      extractUrlFromText(shareIntent?.text);

    if (!url) {
      if (__DEV__) {
        console.log("[ShareIntent] No valid URL found in shared content:", {
          text: shareIntent?.text?.slice(0, 100),
          webUrl: shareIntent?.webUrl,
          type: shareIntent?.type,
        });
      }
      resetShareIntent();
      return;
    }

    if (__DEV__) {
      console.log("[ShareIntent] Received URL:", url, {
        authenticated: isAuthenticated,
      });
    }

    if (!isAuthenticated) {
      AsyncStorage.setItem(PENDING_SHARE_URL_KEY, url).catch(() => {});
      router.replace("/(auth)");
    } else {
      router.push({
        pathname: "/share-target",
        params: { url },
      } as never);
    }

    resetShareIntent();
  }, [hasShareIntent, shareIntent, isAuthenticated, resetShareIntent, router]);

  useEffect(() => {
    if (error && __DEV__) {
      console.warn("[ShareIntent] Error:", error);
    }
  }, [error]);
}

export { useDeepSightShareIntent as useShareIntent };
