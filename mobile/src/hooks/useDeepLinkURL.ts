import { useEffect } from "react";
import * as Linking from "expo-linking";
import { validateVideoURL } from "../utils/validateVideoURL";

type OnURL = (url: string, autostart: boolean) => void;

/**
 * Listen for deep links of the form:
 *   deepsight://voice-call?url=<encoded-yt-or-tiktok-url>&autostart=true
 *
 * Triggered by:
 *   - iOS Share Extension (PR3) → openURL(deepsight://...)
 *   - Android Intent Filter (PR3) for SEND text/plain
 *   - Manual paste of deeplink in Notes / Messages
 *
 * The hook calls `onURL(targetURL, autostart)` only if the deeplink path is
 * `voice-call` AND the embedded URL is a valid YouTube/TikTok URL.
 */
export function useDeepLinkURL(onURL: OnURL): void {
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
}
