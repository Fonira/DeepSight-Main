/**
 * useAmbientLightingEnabled — Hook to read the user's ambient lighting toggle.
 *
 * Reads from AsyncStorage on mount, then re-reads whenever the app comes back
 * to the foreground (catches the case where the user toggled the setting in
 * Profile then navigated back, or backgrounded the app).
 *
 * Defaults to `true` (enabled) when no preference has been persisted yet.
 */
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { storage } from "../utils/storage";
import { STORAGE_KEYS } from "../constants/config";

const DEFAULT_ENABLED = true;

export function useAmbientLightingEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(DEFAULT_ENABLED);

  useEffect(() => {
    let cancelled = false;
    const read = () => {
      storage
        .getItem(STORAGE_KEYS.AMBIENT_LIGHTING_ENABLED)
        .then((raw) => {
          if (cancelled) return;
          if (raw === null || raw === undefined) {
            setEnabled(DEFAULT_ENABLED);
          } else {
            setEnabled(raw !== "false");
          }
        })
        .catch(() => {
          /* keep current value on read error */
        });
    };

    read();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") read();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return enabled;
}
