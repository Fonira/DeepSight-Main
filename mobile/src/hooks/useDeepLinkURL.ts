import { useEffect } from "react";
import * as Linking from "expo-linking";
import useShareIntent from "expo-share-intent/build/useShareIntent";
import { validateVideoURL } from "../utils/validateVideoURL";

type OnURL = (url: string, autostart: boolean) => void;

/**
 * Listen for two paths into the Quick Voice Call mobile V3 flow :
 *
 * 1. **Deep link** of the form `deepsight://voice-call?url=<encoded>&autostart=true`
 *    — manual paste in Notes/Messages, or future custom share extensions.
 *
 * 2. **Native share intent** (PR3) — user taps "Partager" in YouTube/TikTok app
 *    and selects DeepSight. `expo-share-intent` exposes the shared text/URL via
 *    `useShareIntent()`. We extract the first http(s) URL, validate it, and
 *    invoke `onURL(url, autostart=true)` (share-from-app always autostarts the
 *    voice call — that's the killer 1-tap viral flow).
 *
 * `onURL` is invoked only when the embedded URL passes `validateVideoURL`
 * (YouTube + TikTok regex mirror of the backend's `parse_video_url`).
 */
export function useDeepLinkURL(onURL: OnURL): void {
  // ── Path 1 : deepsight:// scheme via expo-linking ─────────────────────
  useEffect(() => {
    const handle = (raw: string) => {
      const parsed = Linking.parse(raw);
      if (parsed.path !== "voice-call") return;
      const target = String(parsed.queryParams?.url ?? "");
      const autostart = parsed.queryParams?.autostart === "true";
      if (target && validateVideoURL(target)) {
        onURL(target, autostart);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });

    const sub = Linking.addEventListener("url", ({ url }: { url: string }) => {
      handle(url);
    });
    return () => sub.remove();
  }, [onURL]);

  // ── Path 2 : native Share Extension (iOS) + Intent SEND (Android) ─────
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: false,
    resetOnBackground: true,
  });

  useEffect(() => {
    if (!hasShareIntent || !shareIntent) return;

    // Extract URL — prefer webUrl (iOS native), fallback to first http(s) in text.
    let candidate: string | null = shareIntent.webUrl ?? null;
    if (!candidate && shareIntent.text) {
      const match = shareIntent.text.match(/https?:\/\/[^\s]+/);
      candidate = match ? match[0] : null;
    }

    if (candidate && validateVideoURL(candidate)) {
      onURL(candidate, true); // share-from-app always autostarts
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, onURL, resetShareIntent]);
}
