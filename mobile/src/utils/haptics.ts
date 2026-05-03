/**
 * haptics — wrapper centralisé autour de `expo-haptics`.
 *
 * Toutes les méthodes sont sûres : elles avalent les rejections (web ou
 * appareils sans haptic engine) et ne tombent jamais dans le main thread.
 *
 * Préférence d'usage :
 * - `selection()` : tap sur item dans une liste / chip, intensité minimale
 * - `light()`     : tap secondaire (favori, settings, share)
 * - `medium()`    : tap principal (mute, dismiss toast, copy success)
 * - `success()`   : confirmation positive (call ended OK, message envoyé)
 * - `warning()`   : avertissement non bloquant
 * - `error()`     : action refusée / quota épuisé
 *
 * Sur web, `Platform.OS === 'web'` court-circuite — aucun appel natif.
 */

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const isWeb = Platform.OS === "web";

const safeCall = (fn: () => Promise<void> | void): Promise<void> => {
  if (isWeb) return Promise.resolve();
  try {
    const result = fn();
    if (result && typeof (result as Promise<void>).catch === "function") {
      return (result as Promise<void>).catch(() => {
        /* swallow — haptic engine may be unavailable */
      });
    }
    return Promise.resolve();
  } catch {
    /* swallow sync throw */
    return Promise.resolve();
  }
};

export const haptics = {
  selection: (): Promise<void> => safeCall(() => Haptics.selectionAsync()),
  light: (): Promise<void> =>
    safeCall(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: (): Promise<void> =>
    safeCall(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: (): Promise<void> =>
    safeCall(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: (): Promise<void> =>
    safeCall(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  warning: (): Promise<void> =>
    safeCall(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),
  error: (): Promise<void> =>
    safeCall(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),
};

export default haptics;
