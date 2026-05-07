/**
 * useWebNotification — wrapper minimaliste sur l'API Web Notification.
 *
 * - Permission demandée *lazy* (au premier `sendNotification`, pas au mount).
 * - Si `denied` : silencieusement ignoré (l'app a d'autres canaux : toast,
 *   FAB, badge nav).
 * - SSR-safe : retourne des no-ops si `window`/`Notification` indisponibles.
 */

import { useCallback, useRef } from "react";

interface SendParams {
  title: string;
  body?: string;
  /** Identifiant unique pour dédupliquer (replace une notif précédente). */
  tag?: string;
  /** Click handler → focus tab + custom action. */
  onClick?: () => void;
}

const isSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

export function useWebNotification() {
  const requestedRef = useRef(false);

  const ensurePermission =
    useCallback(async (): Promise<NotificationPermission> => {
      if (!isSupported()) return "denied";
      if (Notification.permission === "granted") return "granted";
      if (Notification.permission === "denied") return "denied";
      // Demander une seule fois par session.
      if (requestedRef.current) return Notification.permission;
      requestedRef.current = true;
      try {
        return await Notification.requestPermission();
      } catch {
        return "denied";
      }
    }, []);

  const sendNotification = useCallback(
    async (params: SendParams): Promise<void> => {
      if (!isSupported()) return;
      const perm = await ensurePermission();
      if (perm !== "granted") return;
      try {
        const notif = new Notification(params.title, {
          body: params.body,
          icon: "/favicon.ico",
          tag: params.tag,
        });
        if (params.onClick) {
          notif.onclick = () => {
            window.focus();
            params.onClick?.();
            notif.close();
          };
        }
      } catch {
        /* Failure to instantiate Notification is non-critical. */
      }
    },
    [ensurePermission],
  );

  return { ensurePermission, sendNotification };
}

export default useWebNotification;
