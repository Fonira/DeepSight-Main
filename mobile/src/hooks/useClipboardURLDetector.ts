/**
 * useClipboardURLDetector — Détection auto d'URL YT/TikTok dans le presse-papier.
 *
 * Scanne le clipboard à chaque focus de l'écran (useFocusEffect). Si l'URL
 * détectée est valide (YT ou TikTok), elle est exposée via `clipboardURL`.
 * Le composant Home l'utilise pour afficher le bandeau "URL détectée".
 *
 * Privacy : aucune lecture en arrière-plan, uniquement on focus.
 */

import { useCallback, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { validateVideoURL } from "../utils/validateVideoURL";

export interface UseClipboardURLDetectorReturn {
  clipboardURL: string | null;
  dismiss: () => void;
  refresh: () => Promise<void>;
}

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
          /* ignore */
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
