// ── useVoiceSettings — préférences voice + catalog ──
//
// Hook unique qui :
//  1. Fetch les préférences user (`/voice/preferences`) et le catalog
//     ElevenLabs (`/voice/catalog`) via service worker.
//  2. Expose deux scopes d'écriture :
//     • LIVE  → flush instantané au backend (params qui n'exigent pas
//       de restart de session : language, ptt_key, mode, eagerness,
//       interruptions, timeouts, gender display, etc.).
//     • HARD  → staging local uniquement (voice_id, modèles, sliders
//       sound) ; Apply explicite via `applyStaged()` ⇒ flush au backend
//       puis le caller doit redémarrer la session si elle est active.
//  3. Garde la séparation simple, alignée avec le comportement Web :
//     les hard fields nécessitent un restart de la conversation
//     ElevenLabs pour s'appliquer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Browser from "../utils/browser-polyfill";
import { VOICE_MESSAGES } from "./voiceMessages";
import type { VoicePreferencesShape, VoiceCatalogShape } from "./voiceMessages";

// Champs qui obligent à recréer la session ElevenLabs pour s'appliquer.
// Aligné avec docs/superpowers/specs/2026-04-27-voice-prefs-apply-button-design.md.
export const HARD_FIELDS = [
  "voice_id",
  "voice_name",
  "tts_model",
  "voice_chat_model",
  "stability",
  "similarity_boost",
  "style",
  "use_speaker_boost",
  "gender",
  "language",
  "speed",
  "voice_chat_speed_preset",
] as const satisfies readonly (keyof VoicePreferencesShape)[];

export type HardField = (typeof HARD_FIELDS)[number];

interface BackgroundResponse<T = unknown> {
  success?: boolean;
  error?: string;
  result?: T;
}

type SendMessage = <T>(message: unknown) => Promise<BackgroundResponse<T>>;

const defaultSend = <T>(message: unknown): Promise<BackgroundResponse<T>> =>
  Browser.runtime.sendMessage<unknown, BackgroundResponse<T>>(message);

export interface UseVoiceSettingsOptions {
  sendMessage?: SendMessage;
  /** Désactive le fetch initial — utile pour les tests. */
  autoLoad?: boolean;
}

export interface UseVoiceSettingsResult {
  prefs: VoicePreferencesShape | null;
  /** Vue cumulée prefs + staged — ce que l'UI doit afficher. */
  effectivePrefs: VoicePreferencesShape | null;
  catalog: VoiceCatalogShape | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  /** Hard fields modifiés en local et pas encore flushés. */
  stagedFields: Partial<VoicePreferencesShape>;
  stagedCount: number;
  /** Met à jour un ou plusieurs LIVE fields → PUT immédiat. */
  setLive: (updates: Partial<VoicePreferencesShape>) => Promise<void>;
  /** Stage un ou plusieurs HARD fields localement (pas de PUT). */
  setStaged: (updates: Partial<VoicePreferencesShape>) => void;
  /** Flush les staged → PUT backend ; renvoie le diff appliqué. */
  applyStaged: () => Promise<Partial<VoicePreferencesShape>>;
  /** Annule les modifs staged. */
  resetStaged: () => void;
  /** Reset complet à des valeurs par défaut (action explicite). */
  resetToDefaults: () => Promise<void>;
  reload: () => Promise<void>;
}

const DEFAULT_PREFS: Partial<VoicePreferencesShape> = {
  speed: 1.0,
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
  tts_model: "eleven_multilingual_v2",
  voice_chat_model: "eleven_flash_v2_5",
  language: "fr",
  gender: "female",
  input_mode: "ptt",
  ptt_key: " ",
  interruptions_enabled: true,
  turn_eagerness: 0.5,
  voice_chat_speed_preset: "1x",
  turn_timeout: 15,
  soft_timeout_seconds: 300,
};

function isHardField(key: string): key is HardField {
  return (HARD_FIELDS as readonly string[]).includes(key);
}

function splitUpdates(updates: Partial<VoicePreferencesShape>): {
  live: Partial<VoicePreferencesShape>;
  hard: Partial<VoicePreferencesShape>;
} {
  const live: Partial<VoicePreferencesShape> = {};
  const hard: Partial<VoicePreferencesShape> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (isHardField(key)) {
      (hard as Record<string, unknown>)[key] = value;
    } else {
      (live as Record<string, unknown>)[key] = value;
    }
  }
  return { live, hard };
}

export function useVoiceSettings(
  options: UseVoiceSettingsOptions = {},
): UseVoiceSettingsResult {
  const { sendMessage = defaultSend, autoLoad = true } = options;

  const [prefs, setPrefs] = useState<VoicePreferencesShape | null>(null);
  const [catalog, setCatalog] = useState<VoiceCatalogShape | null>(null);
  const [staged, setStaged] = useState<Partial<VoicePreferencesShape>>({});
  const [loading, setLoading] = useState(autoLoad);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prefsRes, catalogRes] = await Promise.all([
        sendMessage<VoicePreferencesShape>({
          action: VOICE_MESSAGES.VOICE_GET_PREFERENCES,
        }),
        sendMessage<VoiceCatalogShape>({
          action: VOICE_MESSAGES.VOICE_GET_CATALOG,
        }),
      ]);
      if (cancelled.current) return;
      if (!prefsRes.success || !prefsRes.result) {
        throw new Error(prefsRes.error || "Préférences indisponibles.");
      }
      if (!catalogRes.success || !catalogRes.result) {
        throw new Error(catalogRes.error || "Catalogue indisponible.");
      }
      setPrefs(prefsRes.result);
      setCatalog(catalogRes.result);
    } catch (e) {
      if (cancelled.current) return;
      setError((e as Error).message);
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, [sendMessage]);

  useEffect(() => {
    if (autoLoad) void reload();
  }, [autoLoad, reload]);

  const setLive = useCallback(
    async (updates: Partial<VoicePreferencesShape>) => {
      if (!prefs) return;
      const { live, hard } = splitUpdates(updates);
      // Garde-fou : si le caller passe un hard field via setLive, on le
      // route vers staged au lieu de PUT immédiatement.
      if (Object.keys(hard).length > 0) {
        setStaged((prev) => ({ ...prev, ...hard }));
      }
      if (Object.keys(live).length === 0) return;
      const snapshot = prefs;
      setPrefs({ ...prefs, ...live });
      setSaving(true);
      try {
        const res = await sendMessage<VoicePreferencesShape>({
          action: VOICE_MESSAGES.VOICE_UPDATE_PREFERENCES,
          data: live,
        });
        if (cancelled.current) return;
        if (!res.success || !res.result) {
          setPrefs(snapshot);
          setError(res.error || "Sauvegarde échouée.");
          return;
        }
        setPrefs(res.result);
        setError(null);
      } catch (e) {
        if (cancelled.current) return;
        setPrefs(snapshot);
        setError((e as Error).message);
      } finally {
        if (!cancelled.current) setSaving(false);
      }
    },
    [prefs, sendMessage],
  );

  const setStagedFn = useCallback((updates: Partial<VoicePreferencesShape>) => {
    setStaged((prev) => ({ ...prev, ...updates }));
  }, []);

  const applyStaged = useCallback(async (): Promise<
    Partial<VoicePreferencesShape>
  > => {
    if (!prefs || Object.keys(staged).length === 0) return {};
    const snapshot = prefs;
    const stagedSnapshot = staged;
    // Optimistic merge
    setPrefs({ ...prefs, ...staged });
    setStaged({});
    setSaving(true);
    try {
      const res = await sendMessage<VoicePreferencesShape>({
        action: VOICE_MESSAGES.VOICE_UPDATE_PREFERENCES,
        data: stagedSnapshot,
      });
      if (cancelled.current) return stagedSnapshot;
      if (!res.success || !res.result) {
        setPrefs(snapshot);
        setStaged(stagedSnapshot);
        setError(res.error || "Sauvegarde échouée.");
        return {};
      }
      setPrefs(res.result);
      setError(null);
      return stagedSnapshot;
    } catch (e) {
      if (cancelled.current) return {};
      setPrefs(snapshot);
      setStaged(stagedSnapshot);
      setError((e as Error).message);
      return {};
    } finally {
      if (!cancelled.current) setSaving(false);
    }
  }, [prefs, staged, sendMessage]);

  const resetStaged = useCallback(() => setStaged({}), []);

  const resetToDefaults = useCallback(async () => {
    setStaged({});
    await setLive(DEFAULT_PREFS as Partial<VoicePreferencesShape>);
  }, [setLive]);

  const effectivePrefs = useMemo(() => {
    if (!prefs) return null;
    return { ...prefs, ...staged };
  }, [prefs, staged]);

  const stagedCount = Object.keys(staged).length;

  return {
    prefs,
    effectivePrefs,
    catalog,
    loading,
    error,
    saving,
    stagedFields: staged,
    stagedCount,
    setLive,
    setStaged: setStagedFn,
    applyStaged,
    resetStaged,
    resetToDefaults,
    reload,
  };
}
