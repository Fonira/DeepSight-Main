/**
 * useDeepLinkURL — Listener pour les deep links Quick Voice Call.
 *
 * Cible : `deepsight://voice-call?url=<encoded>&autostart=true`
 *
 * Source des deep links :
 *   - PR3 (Native Share Extension iOS/Android) — l'utilisateur partage une
 *     vidéo YT/TikTok depuis l'app native, l'extension build l'URL et la
 *     route vers l'app via deep link.
 *   - Notifications push (futur).
 *
 * Comportement :
 *   - Au mount : check `Linking.getInitialURL()` (si l'app a été lancée par
 *     un deep link).
 *   - En live : `Linking.addEventListener("url", ...)` capture les deep
 *     links reçus quand l'app est déjà ouverte.
 *   - Ne déclenche `onURL` que si le path == `voice-call` et l'URL extraite
 *     est valide (validateVideoURL).
 */

import { useEffect } from "react";
import * as Linking from "expo-linking";
import { validateVideoURL } from "../utils/validateVideoURL";

type OnURL = (url: string, autostart: boolean) => void;

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

    const sub = Linking.addEventListener(
      "url",
      ({ url }: { url: string }) => {
        handle(url);
      },
    );
    return () => sub.remove();
  }, [onURL]);
}
