/**
 * 🔗 useDeepSightShareIntent — Receive shared URLs from YouTube/TikTok
 *
 * Uses expo-share-intent to handle ACTION_SEND intents (Android) and
 * Share Extension (iOS). When a user shares a video URL from another app,
 * DeepSight receives it and auto-launches Quick Chat (zero credit, ~2-5s).
 *
 * Flow: YouTube/TikTok → Share → DeepSight → Quick Chat auto → Navigate to chat
 *
 * Requires: expo-share-intent (dev builds only, NOT Expo Go)
 */

import { useEffect, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useShareIntent as useExpoShareIntent } from "expo-share-intent";
import { validateYouTubeUrl } from "../utils/formatters";
import { videoApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

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
 * Hook to handle incoming shared content from YouTube/TikTok.
 * Call this once in the root RootNavigator component.
 *
 * Strategy: Quick Chat (zero credit, instant) → user can upgrade to full analysis later.
 * This is the lowest-friction path: 1 tap from share sheet → chat ready in seconds.
 */
export function useDeepSightShareIntent(): void {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const processedUrlsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);

  // expo-share-intent hook — handles both cold start and foreground shares
  const { hasShareIntent, shareIntent, resetShareIntent, error } =
    useExpoShareIntent({
      debug: __DEV__,
      resetOnBackground: true,
    });

  const handleSharedUrl = useCallback(
    async (url: string) => {
      // Deduplicate — don't process the same URL twice in quick succession
      if (processedUrlsRef.current.has(url)) return;
      if (isProcessingRef.current) return;
      processedUrlsRef.current.add(url);
      isProcessingRef.current = true;

      // Auto-clear dedup after 15s
      setTimeout(() => processedUrlsRef.current.delete(url), 15_000);

      try {
        const validation = validateYouTubeUrl(url);
        if (!validation.isValid) {
          if (__DEV__)
            console.log("[ShareIntent] URL not valid YouTube/TikTok:", url);
          return;
        }

        // If not authenticated — prompt to login
        if (!isAuthenticated) {
          Alert.alert(
            "DeepSight",
            "Connectez-vous pour analyser cette vidéo.",
            [{ text: "OK" }],
          );
          return;
        }

        // Launch Quick Chat (zero credit, ~2-5s response)
        if (__DEV__)
          console.log("[ShareIntent] Launching Quick Chat for:", url);

        const result = await videoApi.quickChat(url, "fr");

        if (!result?.summary_id) {
          throw new Error("No summary_id returned");
        }

        // Navigate directly to Quick Chat screen
        router.push({
          pathname: "/(tabs)/analysis/[id]",
          params: {
            id: String(result.summary_id),
            quickChat: "true",
          },
        } as any);
      } catch (err: any) {
        if (__DEV__) console.error("[ShareIntent] Quick Chat failed:", err);

        const status = err?.status || err?.statusCode;
        if (status === 402 || status === 403) {
          Alert.alert(
            "Quota dépassé",
            "Passez à un plan supérieur pour analyser plus de vidéos.",
            [{ text: "OK" }],
          );
        } else {
          Alert.alert(
            "Erreur",
            "Impossible de préparer le chat. Réessayez depuis l'app.",
            [{ text: "OK" }],
          );
        }
      } finally {
        isProcessingRef.current = false;
      }
    },
    [isAuthenticated, router],
  );

  // React to new share intents
  useEffect(() => {
    if (!hasShareIntent) return;

    // Extract URL from shared content
    let url: string | null = null;

    // Priority 1: webUrl (iOS share extension often provides this directly)
    if (shareIntent.webUrl) {
      url = extractUrlFromText(shareIntent.webUrl);
    }

    // Priority 2: text content (Android ACTION_SEND usually puts URL in text)
    if (!url && shareIntent.text) {
      url = extractUrlFromText(shareIntent.text);
    }

    if (url) {
      handleSharedUrl(url);
    } else if (__DEV__) {
      console.log("[ShareIntent] No valid URL found in shared content:", {
        text: shareIntent.text?.slice(0, 100),
        webUrl: shareIntent.webUrl,
        type: shareIntent.type,
      });
    }

    // Reset after processing so the same intent isn't processed again
    resetShareIntent();
  }, [hasShareIntent, shareIntent, handleSharedUrl, resetShareIntent]);

  // Log errors in dev
  useEffect(() => {
    if (error && __DEV__) {
      console.warn("[ShareIntent] Error:", error);
    }
  }, [error]);
}

// Keep backward-compatible export name
export { useDeepSightShareIntent as useShareIntent };
export { extractUrlFromText };
