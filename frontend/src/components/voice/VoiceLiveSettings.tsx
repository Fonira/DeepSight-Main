/**
 * VoiceLiveSettings — Compact, in-call settings panel embedded inside
 * VoiceOverlay. Exposes the 5 most useful live-tweakable preferences:
 *  - Agent volume (slider 0-100, applied locally to <audio> elements)
 *  - Playback rate preset (0.75 / 1 / 1.25 / 1.5 / 1.75)
 *  - Input mode (PTT vs VAD/always-listening)
 *  - PTT key (text input, e.g. "Espace")
 *  - Language (FR/EN)
 *
 * Heavy fields (voice catalog, stability, model selection) live in the
 * full VoiceSettings page — this panel intentionally stays minimal so
 * the in-call experience does not become a wall of controls.
 *
 * Live application:
 *  - playback_rate via voicePrefsBus → useVoiceChat re-applies on the
 *    active <audio> elements without restarting the session.
 *  - volume sets HTMLAudioElement.volume directly through the bus.
 *  - input_mode / ptt_key / language are persisted via voiceApi but
 *    typically apply on next session start.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Volume2, Mic, Keyboard, Globe, Gauge } from "lucide-react";
import { voiceApi } from "../../services/api";
import type { VoicePreferences } from "../../services/api";
import { emitVoicePrefsEvent } from "./voicePrefsBus";

// ═══════════════════════════════════════════════════════════════════════════════
// I18N
// ═══════════════════════════════════════════════════════════════════════════════

const I18N = {
  fr: {
    loading: "Chargement…",
    error: "Impossible de charger les réglages.",
    volume: "Volume agent",
    rate: "Vitesse de lecture",
    mode: "Mode d'entrée",
    modePtt: "Appuyer pour parler",
    modeVad: "Toujours à l'écoute",
    pttKey: "Touche push-to-talk",
    pttHelp: "Espace, Shift, etc.",
    language: "Langue",
    needsRestart: "Le changement s'appliquera au prochain appel.",
  },
  en: {
    loading: "Loading…",
    error: "Failed to load settings.",
    volume: "Agent volume",
    rate: "Playback rate",
    mode: "Input mode",
    modePtt: "Push to talk",
    modeVad: "Always listening",
    pttKey: "Push-to-talk key",
    pttHelp: "Space, Shift, etc.",
    language: "Language",
    needsRestart: "The change will apply on the next call.",
  },
} as const;

// Playback rate presets — kept conservative (no 2x+) for in-call use,
// where extreme rates are rarely useful.
const RATE_PRESETS: { id: string; value: number }[] = [
  { id: "0.75x", value: 0.75 },
  { id: "1x", value: 1.0 },
  { id: "1.25x", value: 1.25 },
  { id: "1.5x", value: 1.5 },
  { id: "1.75x", value: 1.75 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const formatPttKey = (key: string): string => {
  if (key === " " || key === "Space" || key === "Spacebar") return "Espace";
  if (key.length === 1) return key.toUpperCase();
  return key;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export interface VoiceLiveSettingsProps {
  /** UI language (FR or EN). */
  language: "fr" | "en";
  /** Optional callback fired after a successful save. */
  onChange?: (updates: Partial<VoicePreferences>) => void;
}

export const VoiceLiveSettings: React.FC<VoiceLiveSettingsProps> = ({
  language,
  onChange,
}) => {
  const t = I18N[language];

  const [prefs, setPrefs] = useState<VoicePreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Local volume slider (0-100). Independent from prefs since volume is
  // applied client-side to <audio> elements, not persisted to the backend.
  const [volume, setVolume] = useState<number>(100);
  const [pttListening, setPttListening] = useState(false);

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const next = await voiceApi.getPreferences();
        if (!cancelled) {
          setPrefs(next);
          setError(null);
        }
      } catch {
        if (!cancelled) setError(t.error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [t.error]);

  // ── Save helper (optimistic) ────────────────────────────────────────────
  const save = useCallback(
    async (updates: Partial<VoicePreferences>) => {
      if (!prefs) return;
      const snapshot = prefs;
      setPrefs({ ...prefs, ...updates });
      setSaving(true);
      try {
        const next = await voiceApi.updatePreferences(updates);
        setPrefs(next);
        onChange?.(updates);
      } catch {
        // Rollback on failure.
        setPrefs(snapshot);
      } finally {
        setSaving(false);
      }
    },
    [prefs, onChange],
  );

  // ── Volume change → live-apply via bus + local state ────────────────────
  const handleVolume = useCallback((next: number) => {
    setVolume(next);
    // Apply directly to all live <audio> elements.
    const audioEls = Array.from(
      document.querySelectorAll<HTMLAudioElement>("audio"),
    );
    audioEls.forEach((el) => {
      el.volume = Math.max(0, Math.min(1, next / 100));
    });
  }, []);

  // ── Playback rate change → bus + persist ────────────────────────────────
  const handleRate = useCallback(
    (preset: { id: string; value: number }) => {
      emitVoicePrefsEvent({
        type: "playback_rate_changed",
        value: preset.value,
      });
      void save({ voice_chat_speed_preset: preset.id });
    },
    [save],
  );

  // ── PTT-key picker ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!pttListening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setPttListening(false);
        return;
      }
      const newKey = e.key === " " ? " " : e.key;
      void save({ ptt_key: newKey });
      setPttListening(false);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, {
        capture: true,
      } as EventListenerOptions);
  }, [pttListening, save]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        data-testid="voice-live-loading"
        className="px-4 py-3 text-[11px] text-text-muted"
      >
        {t.loading}
      </div>
    );
  }

  if (!prefs || error) {
    return (
      <div
        data-testid="voice-live-error"
        className="px-4 py-3 text-[11px] text-red-300/80"
      >
        {error ?? t.error}
      </div>
    );
  }

  return (
    <div
      data-testid="voice-live-settings"
      className="px-4 py-3 space-y-4 border-b border-white/[0.06] bg-[#0a0a0f]/60"
    >
      {/* ─── Volume ─── */}
      <div>
        <label
          htmlFor="voice-live-volume"
          className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted mb-1.5"
        >
          <Volume2 className="w-3 h-3" aria-hidden="true" />
          {t.volume}
          <span className="ml-auto text-text-muted font-mono">{volume}</span>
        </label>
        <input
          id="voice-live-volume"
          data-testid="voice-live-volume"
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(e) => handleVolume(parseInt(e.target.value, 10))}
          aria-label={t.volume}
          className="w-full accent-violet-500 h-1.5 bg-white/10 rounded-full"
        />
      </div>
      {/* ─── Playback rate presets ─── */}
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted mb-1.5">
          <Gauge className="w-3 h-3" aria-hidden="true" />
          {t.rate}
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {RATE_PRESETS.map((p) => {
            const isActive = prefs.voice_chat_speed_preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={saving}
                data-testid={`voice-live-rate-${p.id}`}
                onClick={() => handleRate(p)}
                className={`px-1 py-1 rounded text-[10px] font-medium transition-colors ${
                  isActive
                    ? "bg-violet-500/25 text-violet-200 border border-violet-400/40"
                    : "bg-white/[0.04] text-white/55 border border-white/[0.06] hover:text-white/85"
                }`}
              >
                {p.id}
              </button>
            );
          })}
        </div>
      </div>
      {/* ─── Input mode ─── */}
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted mb-1.5">
          <Mic className="w-3 h-3" aria-hidden="true" />
          {t.mode}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {(["ptt", "vad"] as const).map((mode) => {
            const isActive = prefs.input_mode === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={saving}
                data-testid={`voice-live-mode-${mode}`}
                onClick={() => save({ input_mode: mode })}
                className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
                  isActive
                    ? "bg-violet-500/25 text-violet-200 border border-violet-400/40"
                    : "bg-white/[0.04] text-white/55 border border-white/[0.06] hover:text-white/85"
                }`}
              >
                {mode === "ptt" ? t.modePtt : t.modeVad}
              </button>
            );
          })}
        </div>
      </div>
      {/* ─── PTT key ─── */}
      <div>
        <label
          htmlFor="voice-live-ptt-key"
          className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted mb-1.5"
        >
          <Keyboard className="w-3 h-3" aria-hidden="true" />
          {t.pttKey}
        </label>
        <button
          id="voice-live-ptt-key"
          type="button"
          data-testid="voice-live-ptt-key"
          disabled={saving || prefs.input_mode !== "ptt"}
          onClick={() => setPttListening(true)}
          className="w-full inline-flex items-center justify-between px-2 py-1.5 rounded text-[11px] bg-white/[0.04] border border-white/[0.06] text-text-primary hover:border-white/[0.12] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{pttListening ? "…" : formatPttKey(prefs.ptt_key)}</span>
          <span className="text-[10px] text-white/35">{t.pttHelp}</span>
        </button>
      </div>
      {/* ─── Language ─── */}
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted mb-1.5">
          <Globe className="w-3 h-3" aria-hidden="true" />
          {t.language}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {(["fr", "en"] as const).map((lang) => {
            const isActive = prefs.language === lang;
            return (
              <button
                key={lang}
                type="button"
                disabled={saving}
                data-testid={`voice-live-lang-${lang}`}
                onClick={() => save({ language: lang })}
                className={`px-2 py-1.5 rounded text-[10px] font-medium uppercase transition-colors ${
                  isActive
                    ? "bg-violet-500/25 text-violet-200 border border-violet-400/40"
                    : "bg-white/[0.04] text-white/55 border border-white/[0.06] hover:text-white/85"
                }`}
              >
                {lang === "fr" ? "Français" : "English"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VoiceLiveSettings;
