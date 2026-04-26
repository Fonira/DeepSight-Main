import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  voiceApi,
  type VoicePreferences,
  type VoiceCatalog,
} from "../../../services/api";
import {
  emitVoicePrefsEvent,
  subscribeVoicePrefsEvents,
} from "../voicePrefsBus";
import { isRestartRequired } from "./restartRequiredFields";

export interface VoicePrefsStagingContextValue {
  applied: VoicePreferences | null;
  catalog: VoiceCatalog | null;
  staged: Partial<VoicePreferences>;
  hasChanges: boolean;
  hasRestartRequired: boolean;
  callActive: boolean;
  applying: boolean;
  applyError: string | null;
  stage: (updates: Partial<VoicePreferences>) => void;
  cancel: () => void;
  apply: () => Promise<void>;
}

const VoicePrefsStagingContext =
  createContext<VoicePrefsStagingContextValue | null>(null);

export const VoicePrefsStagingProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [applied, setApplied] = useState<VoicePreferences | null>(null);
  const [catalog, setCatalog] = useState<VoiceCatalog | null>(null);
  const [staged, setStaged] = useState<Partial<VoicePreferences>>({});
  const [callActive, setCallActive] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Hydrate prefs + catalog at mount.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([voiceApi.getPreferences(), voiceApi.getCatalog()])
      .then(([prefs, cat]) => {
        if (cancelled) return;
        setApplied(prefs);
        setCatalog(cat);
      })
      .catch(() => {
        // Silent failure — provider stays in loading state until the
        // first real `apply()` retries network.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to call_status_changed.
  useEffect(() => {
    const unsubscribe = subscribeVoicePrefsEvents((event) => {
      if (event.type === "call_status_changed") {
        setCallActive(event.active);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stage = useCallback(
    (updates: Partial<VoicePreferences>) => {
      setStaged((prev) => {
        const next: Partial<VoicePreferences> = { ...prev };
        for (const key of Object.keys(updates) as (keyof VoicePreferences)[]) {
          const value = updates[key];
          // No-op detect: if value matches applied, drop the key.
          if (applied && Object.is(applied[key], value)) {
            delete next[key];
          } else {
            // @ts-expect-error — heterogeneous union write is safe at runtime
            next[key] = value;
          }
        }
        return next;
      });
    },
    [applied],
  );

  const cancel = useCallback(() => {
    setStaged({});
    setApplyError(null);
  }, []);

  const apply = useCallback(async () => {
    if (Object.keys(staged).length === 0) return;
    setApplying(true);
    setApplyError(null);
    try {
      const next = await voiceApi.updatePreferences(staged);
      if (!isMountedRef.current) return;
      setApplied(next);
      const restartNeeded =
        callActive &&
        catalog != null &&
        isRestartRequired(staged, catalog.voice_chat_speed_presets);
      setStaged({});
      if (restartNeeded) {
        emitVoicePrefsEvent({ type: "apply_with_restart" });
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setApplyError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      if (isMountedRef.current) setApplying(false);
    }
  }, [staged, callActive, catalog]);

  const hasChanges = useMemo(() => Object.keys(staged).length > 0, [staged]);
  const hasRestartRequired = useMemo(
    () =>
      hasChanges &&
      catalog != null &&
      isRestartRequired(staged, catalog.voice_chat_speed_presets),
    [hasChanges, staged, catalog],
  );

  const value = useMemo<VoicePrefsStagingContextValue>(
    () => ({
      applied,
      catalog,
      staged,
      hasChanges,
      hasRestartRequired,
      callActive,
      applying,
      applyError,
      stage,
      cancel,
      apply,
    }),
    [
      applied,
      catalog,
      staged,
      hasChanges,
      hasRestartRequired,
      callActive,
      applying,
      applyError,
      stage,
      cancel,
      apply,
    ],
  );

  return (
    <VoicePrefsStagingContext.Provider value={value}>
      {children}
    </VoicePrefsStagingContext.Provider>
  );
};

export function useVoicePrefsStaging(): VoicePrefsStagingContextValue {
  const ctx = useContext(VoicePrefsStagingContext);
  if (!ctx) {
    throw new Error(
      "useVoicePrefsStaging must be used inside <VoicePrefsStagingProvider>",
    );
  }
  return ctx;
}
