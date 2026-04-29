import { useCallback, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { validateVideoURL } from "../utils/validateVideoURL";

export interface UseClipboardURLDetectorReturn {
  clipboardURL: string | null;
  dismiss: () => void;
  refresh: () => Promise<void>;
}

/**
 * Scan the clipboard on Home focus. If it contains a valid YouTube/TikTok
 * URL, expose it via `clipboardURL` so the UI can show a "📋 Lien détecté"
 * banner with a one-tap "Voice Call" action.
 *
 * iOS shows a transient "DeepSight a collé depuis votre presse-papier"
 * banner when reading clipboard (iOS 14+) — acceptable UX trade-off.
 */
export function useClipboardURLDetector(): UseClipboardURLDetectorReturn {
  const [clipboardURL, setClipboardURL] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && validateVideoURL(text)) {
        setClipboardURL(text);
      } else {
        setClipboardURL(null);
      }
    } catch {
      setClipboardURL(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const text = await Clipboard.getStringAsync();
          if (cancelled) return;
          if (text && validateVideoURL(text)) {
            setClipboardURL(text);
          }
        } catch {
          /* ignore — fail silently */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const dismiss = useCallback(() => setClipboardURL(null), []);

  return { clipboardURL, dismiss, refresh };
}
