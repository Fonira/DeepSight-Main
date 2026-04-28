// ── VoiceSettingsDrawer — drawer in-call avec toutes les options voix ──
//
// Aligné sur DeepSight Web (frontend/src/components/voice/VoiceSettings.tsx +
// VoiceLiveSettings.tsx). 19 options regroupées en sections collapsibles.
// Pattern : LIVE = flush instantané, HARD = staged + bouton Apply.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  HARD_FIELDS,
  useVoiceSettings,
  type UseVoiceSettingsResult,
} from "./useVoiceSettings";
import type {
  VoicePreferencesShape,
  VoiceCatalogVoice,
  VoiceCatalogModel,
  VoiceCatalogChatSpeedPreset,
  VoiceCatalogSpeedPreset,
} from "./voiceMessages";

// ═════════════════════════════════════════════════════════════════════════
// Composants internes
// ═════════════════════════════════════════════════════════════════════════

interface SectionProps {
  icon: string;
  title: string;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({
  icon,
  title,
  badge,
  isOpen,
  onToggle,
  children,
}) => (
  <section className={`dsp-vs-section ${isOpen ? "is-open" : ""}`}>
    <button
      type="button"
      className="dsp-vs-section-header"
      onClick={onToggle}
      aria-expanded={isOpen}
    >
      <span className="dsp-vs-section-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="dsp-vs-section-title">{title}</span>
      {badge && <span className="dsp-vs-section-badge">{badge}</span>}
      <span className={`dsp-vs-chevron ${isOpen ? "is-open" : ""}`}>›</span>
    </button>
    <div className="dsp-vs-section-body" hidden={!isOpen}>
      {children}
    </div>
  </section>
);

interface SliderProps {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (v: number) => string;
  onLiveChange?: (v: number) => void;
  onCommit: (v: number) => void;
  disabled?: boolean;
}

const Slider: React.FC<SliderProps> = ({
  label,
  hint,
  min,
  max,
  step,
  value,
  format,
  onLiveChange,
  onCommit,
  disabled,
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="dsp-vs-field">
      <div className="dsp-vs-field-row">
        <label className="dsp-vs-label">{label}</label>
        <span className="dsp-vs-value">
          {format ? format(draft) : draft.toFixed(2)}
        </span>
      </div>
      <input
        className="dsp-vs-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(e) => {
          const v = parseFloat(e.currentTarget.value);
          setDraft(v);
          onLiveChange?.(v);
        }}
        onMouseUp={() => onCommit(draft)}
        onTouchEnd={() => onCommit(draft)}
        onKeyUp={(e) => {
          if (
            e.key === "ArrowLeft" ||
            e.key === "ArrowRight" ||
            e.key === "ArrowUp" ||
            e.key === "ArrowDown"
          ) {
            onCommit(draft);
          }
        }}
      />
      {hint && <p className="dsp-vs-hint">{hint}</p>}
    </div>
  );
};

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled,
}) => (
  <div className="dsp-vs-toggle-row">
    <div className="dsp-vs-toggle-label">
      <span className="dsp-vs-label">{label}</span>
      {description && <span className="dsp-vs-hint">{description}</span>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`dsp-vs-toggle ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="dsp-vs-toggle-thumb" />
    </button>
  </div>
);

interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  description?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  cols?: number;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  cols = 2,
}: SegmentedProps<T>): JSX.Element {
  return (
    <div
      className="dsp-vs-segmented"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          className={`dsp-vs-seg ${value === opt.id ? "is-active" : ""}`}
          onClick={() => onChange(opt.id)}
        >
          <span className="dsp-vs-seg-label">{opt.label}</span>
          {opt.description && (
            <span className="dsp-vs-seg-desc">{opt.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════

function formatPttKey(key: string): string {
  if (key === " " || key === "Space" || key === "Spacebar") return "Espace";
  if (key === "Shift") return "Shift";
  if (key === "Control") return "Ctrl";
  if (key === "Alt") return "Alt";
  if (key === "Meta") return "Meta";
  if (key === "Enter") return "Entrée";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function applyVolumeToAudio(value: number): void {
  const clamped = Math.max(0, Math.min(1, value / 100));
  document.querySelectorAll<HTMLAudioElement>("audio").forEach((el) => {
    el.volume = clamped;
  });
}

// Champs effectivement modifiés vs prefs initial (pour le badge Apply).
function countDirtyHard(
  staged: Partial<VoicePreferencesShape>,
  prefs: VoicePreferencesShape | null,
): number {
  if (!prefs) return 0;
  let n = 0;
  for (const key of Object.keys(staged) as (keyof VoicePreferencesShape)[]) {
    if ((HARD_FIELDS as readonly string[]).includes(key as string)) {
      if (staged[key] !== prefs[key]) n += 1;
    }
  }
  return n;
}

// ═════════════════════════════════════════════════════════════════════════
// Sections
// ═════════════════════════════════════════════════════════════════════════

interface SectionContentProps {
  s: UseVoiceSettingsResult;
}

const VoiceCardsSection: React.FC<SectionContentProps> = ({ s }) => {
  const [genderFilter, setGenderFilter] = useState<
    "all" | "female" | "male" | "neutral"
  >("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const playPreview = (voice: VoiceCatalogVoice): void => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === voice.voice_id) {
      setPlayingId(null);
      return;
    }
    if (!voice.preview_url) return;
    const a = new Audio(voice.preview_url);
    a.onended = () => setPlayingId(null);
    a.onerror = () => setPlayingId(null);
    void a.play();
    audioRef.current = a;
    setPlayingId(voice.voice_id);
  };

  if (!s.catalog || !s.effectivePrefs) return null;
  const voices =
    genderFilter === "all"
      ? s.catalog.voices
      : s.catalog.voices.filter((v) => v.gender === genderFilter);

  return (
    <div className="dsp-vs-stack">
      <div className="dsp-vs-pill-row">
        {(
          [
            { id: "all", label: "Toutes" },
            { id: "female", label: "♀" },
            { id: "male", label: "♂" },
            { id: "neutral", label: "⚧" },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            className={`dsp-vs-pill ${genderFilter === f.id ? "is-active" : ""}`}
            onClick={() => setGenderFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="dsp-vs-voice-grid">
        {voices.map((v) => {
          const selected = s.effectivePrefs?.voice_id === v.voice_id;
          const playing = playingId === v.voice_id;
          return (
            <div
              key={v.voice_id}
              className={`dsp-vs-voice-card ${selected ? "is-selected" : ""}`}
              onClick={() =>
                s.setStaged({ voice_id: v.voice_id, voice_name: v.name })
              }
              role="button"
              tabIndex={0}
            >
              {v.recommended && <span className="dsp-vs-voice-reco">Reco</span>}
              <div className="dsp-vs-voice-head">
                <span className="dsp-vs-voice-name">{v.name}</span>
                <span className="dsp-vs-voice-tag">
                  {v.gender === "male"
                    ? "♂"
                    : v.gender === "female"
                      ? "♀"
                      : "⚧"}
                </span>
                {v.language === "fr" && (
                  <span className="dsp-vs-voice-tag is-fr">FR</span>
                )}
              </div>
              <p className="dsp-vs-voice-desc">{v.description_fr}</p>
              <div className="dsp-vs-voice-meta">
                <span>{v.accent}</span>
                <span>·</span>
                <span>{v.use_case}</span>
              </div>
              <button
                type="button"
                className={`dsp-vs-voice-play ${playing ? "is-playing" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  playPreview(v);
                }}
                aria-label={playing ? "Pause" : "Aperçu"}
              >
                {playing ? "⏸" : "▶"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ReadingSpeedSection: React.FC<SectionContentProps> = ({ s }) => {
  const prefs = s.effectivePrefs;
  if (!s.catalog || !prefs) return null;
  return (
    <div className="dsp-vs-stack">
      <div className="dsp-vs-preset-grid">
        {s.catalog.speed_presets.map((p: VoiceCatalogSpeedPreset) => (
          <button
            key={p.id}
            type="button"
            className={`dsp-vs-preset ${prefs.speed === p.value ? "is-active" : ""}`}
            onClick={() => s.setStaged({ speed: p.value })}
          >
            <span className="dsp-vs-preset-icon">{p.icon}</span>
            <span className="dsp-vs-preset-value">{p.value}x</span>
            <span className="dsp-vs-preset-label">{p.label_fr}</span>
          </button>
        ))}
      </div>
      <Slider
        label="Vitesse personnalisée"
        min={0.25}
        max={4}
        step={0.05}
        value={prefs.speed}
        format={(v) => `${v.toFixed(2)}x`}
        onLiveChange={(v) => s.setStaged({ speed: v })}
        onCommit={(v) => s.setStaged({ speed: v })}
      />
    </div>
  );
};

const ChatSpeedSection: React.FC<SectionContentProps> = ({ s }) => {
  const prefs = s.effectivePrefs;
  if (!s.catalog || !prefs) return null;
  const current = s.catalog.voice_chat_speed_presets.find(
    (p) => p.id === prefs.voice_chat_speed_preset,
  );
  return (
    <div className="dsp-vs-stack">
      <p className="dsp-vs-hint">Vitesse de réponse de l'agent en appel</p>
      <div className="dsp-vs-preset-grid is-compact">
        {s.catalog.voice_chat_speed_presets.map(
          (p: VoiceCatalogChatSpeedPreset) => {
            const active = prefs.voice_chat_speed_preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`dsp-vs-preset ${active ? "is-active" : ""}`}
                onClick={() => s.setStaged({ voice_chat_speed_preset: p.id })}
              >
                <span className="dsp-vs-preset-value">{p.id}</span>
                <span className="dsp-vs-preset-label">{p.label_fr}</span>
                {p.concise && <span className="dsp-vs-preset-tag">Concis</span>}
              </button>
            );
          },
        )}
      </div>
      {current?.concise && (
        <p className="dsp-vs-info">⚡ Mode concis — réponses ultra-courtes</p>
      )}
    </div>
  );
};

const ModelsSection: React.FC<SectionContentProps> = ({ s }) => {
  const prefs = s.effectivePrefs;
  if (!s.catalog || !prefs) return null;
  const renderModelRow = (
    selected: string,
    field: "tts_model" | "voice_chat_model",
    title: string,
  ): JSX.Element => (
    <div className="dsp-vs-model-block">
      <p className="dsp-vs-label">{title}</p>
      <div className="dsp-vs-model-list">
        {s.catalog!.models.map((m: VoiceCatalogModel) => {
          const active = selected === m.id;
          const latencyLabel =
            m.latency === "lowest"
              ? "Ultra-rapide"
              : m.latency === "low"
                ? "Rapide"
                : "Haute qualité";
          return (
            <button
              key={`${field}-${m.id}`}
              type="button"
              className={`dsp-vs-model ${active ? "is-active" : ""}`}
              onClick={() =>
                s.setStaged({ [field]: m.id } as Partial<VoicePreferencesShape>)
              }
            >
              <div className="dsp-vs-model-head">
                <span className="dsp-vs-model-name">{m.name}</span>
                <span className={`dsp-vs-model-latency lat-${m.latency}`}>
                  {latencyLabel}
                </span>
              </div>
              <p className="dsp-vs-hint">{m.description_fr}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="dsp-vs-stack">
      {renderModelRow(prefs.tts_model, "tts_model", "TTS — résumés / synthèse")}
      {renderModelRow(
        prefs.voice_chat_model,
        "voice_chat_model",
        "Chat vocal — temps réel",
      )}
    </div>
  );
};

const AdvancedSlidersSection: React.FC<SectionContentProps> = ({ s }) => {
  const prefs = s.effectivePrefs;
  if (!prefs) return null;
  return (
    <div className="dsp-vs-stack">
      <Slider
        label="Stabilité"
        hint="Variable ← → constant"
        min={0}
        max={1}
        step={0.05}
        value={prefs.stability}
        onLiveChange={(v) => s.setStaged({ stability: v })}
        onCommit={(v) => s.setStaged({ stability: v })}
      />
      <Slider
        label="Fidélité"
        hint="Diversifié ← → fidèle à l'original"
        min={0}
        max={1}
        step={0.05}
        value={prefs.similarity_boost}
        onLiveChange={(v) => s.setStaged({ similarity_boost: v })}
        onCommit={(v) => s.setStaged({ similarity_boost: v })}
      />
      <Slider
        label="Style"
        hint="Neutre ← → expressif"
        min={0}
        max={1}
        step={0.05}
        value={prefs.style}
        onLiveChange={(v) => s.setStaged({ style: v })}
        onCommit={(v) => s.setStaged({ style: v })}
      />
      <Toggle
        label="Speaker Boost"
        description="Améliore la clarté (consomme plus de crédits)"
        checked={prefs.use_speaker_boost}
        onChange={(v) => s.setStaged({ use_speaker_boost: v })}
      />
    </div>
  );
};

const InteractionSection: React.FC<SectionContentProps> = ({ s }) => {
  const prefs = s.effectivePrefs;
  const [pttListening, setPttListening] = useState(false);

  useEffect(() => {
    if (!pttListening) return;
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setPttListening(false);
        return;
      }
      const newKey = e.key === " " ? " " : e.key;
      void s.setLive({ ptt_key: newKey });
      setPttListening(false);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, {
        capture: true,
      } as EventListenerOptions);
  }, [pttListening, s]);

  if (!prefs) return null;
  return (
    <div className="dsp-vs-stack">
      <Segmented<"ptt" | "vad">
        options={[
          {
            id: "ptt",
            label: "Push-to-talk",
            description: "Maintenir une touche pour parler",
          },
          {
            id: "vad",
            label: "Détection vocale",
            description: "Micro toujours ouvert",
          },
        ]}
        value={prefs.input_mode}
        onChange={(v) => void s.setLive({ input_mode: v })}
      />

      {prefs.input_mode === "ptt" && (
        <div className="dsp-vs-field">
          <label className="dsp-vs-label">Touche pour parler</label>
          <button
            type="button"
            className={`dsp-vs-ptt-btn ${pttListening ? "is-listening" : ""}`}
            onClick={() => setPttListening((v) => !v)}
          >
            <kbd className="dsp-vs-kbd">
              {pttListening ? "…" : formatPttKey(prefs.ptt_key)}
            </kbd>
            <span className="dsp-vs-hint">
              {pttListening ? "Appuyez (Échap pour annuler)" : "Modifier"}
            </span>
          </button>
        </div>
      )}

      {prefs.input_mode === "vad" && (
        <Slider
          label="Réactivité"
          hint="Patient ← → réactif"
          min={0}
          max={1}
          step={0.05}
          value={prefs.turn_eagerness}
          onLiveChange={(v) => void s.setLive({ turn_eagerness: v })}
          onCommit={(v) => void s.setLive({ turn_eagerness: v })}
        />
      )}

      <Toggle
        label="Interruptions"
        description="Couper la parole à l'agent en parlant"
        checked={prefs.interruptions_enabled}
        onChange={(v) => void s.setLive({ interruptions_enabled: v })}
      />
    </div>
  );
};

const TimeoutsSection: React.FC<SectionContentProps> = ({ s }) => {
  const prefs = s.effectivePrefs;
  if (!prefs) return null;
  return (
    <div className="dsp-vs-stack">
      <Slider
        label="Délai de relance"
        hint="Silence avant que l'agent relance"
        min={5}
        max={60}
        step={1}
        value={prefs.turn_timeout}
        format={(v) => `${Math.round(v)}s`}
        onLiveChange={(v) => void s.setLive({ turn_timeout: Math.round(v) })}
        onCommit={(v) => void s.setLive({ turn_timeout: Math.round(v) })}
      />
      <Slider
        label="Alerte de session"
        hint="Avant déconnexion automatique"
        min={60}
        max={600}
        step={30}
        value={prefs.soft_timeout_seconds}
        format={(v) => `${Math.round(v / 60)} min`}
        onLiveChange={(v) =>
          void s.setLive({ soft_timeout_seconds: Math.round(v) })
        }
        onCommit={(v) =>
          void s.setLive({ soft_timeout_seconds: Math.round(v) })
        }
      />
    </div>
  );
};

const DefaultsSection: React.FC<SectionContentProps> = ({ s }) => {
  const prefs = s.effectivePrefs;
  if (!prefs) return null;
  return (
    <div className="dsp-vs-stack">
      <div className="dsp-vs-field">
        <label className="dsp-vs-label">Langue par défaut</label>
        <Segmented<"fr" | "en">
          options={[
            { id: "fr", label: "🇫🇷 Français" },
            { id: "en", label: "🇬🇧 English" },
          ]}
          value={prefs.language === "en" ? "en" : "fr"}
          onChange={(v) => s.setStaged({ language: v })}
        />
      </div>
      <div className="dsp-vs-field">
        <label className="dsp-vs-label">Genre par défaut</label>
        <Segmented<"female" | "male">
          options={[
            { id: "female", label: "♀ Féminin" },
            { id: "male", label: "♂ Masculin" },
          ]}
          value={prefs.gender === "male" ? "male" : "female"}
          onChange={(v) => s.setStaged({ gender: v })}
        />
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Drawer principal
// ═════════════════════════════════════════════════════════════════════════

export interface VoiceSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  /**
   * Callback fired when the user clicks Apply *and* one or more
   * hard fields actually changed. The hosting view is responsible
   * for restarting the ElevenLabs session if active.
   */
  onApplyHardChanges?: (changed: Partial<VoicePreferencesShape>) => void;
  settings?: UseVoiceSettingsResult;
}

export const VoiceSettingsDrawer: React.FC<VoiceSettingsDrawerProps> = ({
  open,
  onClose,
  onApplyHardChanges,
  settings,
}) => {
  const fallback = useVoiceSettings({ autoLoad: !settings });
  const s = settings ?? fallback;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    interaction: true,
    chatSpeed: true,
    voices: false,
    readingSpeed: false,
    models: false,
    advanced: false,
    timeouts: false,
    defaults: false,
  });
  const [volume, setVolume] = useState<number>(100);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const toggle = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const dirtyHard = countDirtyHard(s.stagedFields, s.prefs);

  const handleApply = useCallback(async () => {
    const changed = await s.applyStaged();
    const hardChanged: Partial<VoicePreferencesShape> = {};
    for (const key of Object.keys(changed) as (keyof VoicePreferencesShape)[]) {
      if ((HARD_FIELDS as readonly string[]).includes(key as string)) {
        (hardChanged as Record<string, unknown>)[key as string] = changed[key];
      }
    }
    if (Object.keys(hardChanged).length > 0) {
      onApplyHardChanges?.(hardChanged);
    }
  }, [s, onApplyHardChanges]);

  return (
    <div
      className={`dsp-vs-drawer ${open ? "is-open" : ""}`}
      role="dialog"
      aria-label="Réglages voix"
      aria-hidden={!open}
    >
      <header className="dsp-vs-drawer-header">
        <span className="dsp-vs-drawer-title">Réglages voix</span>
        <button
          type="button"
          className="dsp-vs-icon-btn"
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>
      </header>

      <div className="dsp-vs-drawer-body">
        {s.loading && <p className="dsp-vs-hint">Chargement…</p>}
        {s.error && !s.loading && (
          <p className="dsp-vs-error" role="alert">
            {s.error}
          </p>
        )}
        {!s.loading && !s.error && s.effectivePrefs && s.catalog && (
          <>
            <div className="dsp-vs-volume">
              <div className="dsp-vs-field-row">
                <label className="dsp-vs-label">🔊 Volume agent</label>
                <span className="dsp-vs-value">{volume}</span>
              </div>
              <input
                className="dsp-vs-slider"
                type="range"
                min={0}
                max={100}
                step={1}
                value={volume}
                onChange={(e) => {
                  const v = parseInt(e.currentTarget.value, 10);
                  setVolume(v);
                  applyVolumeToAudio(v);
                }}
              />
              <p className="dsp-vs-hint">
                Appliqué instantanément aux audio en cours
              </p>
            </div>

            <Section
              icon="🎙"
              title="Voix"
              badge="Hard"
              isOpen={openSections.voices}
              onToggle={() => toggle("voices")}
            >
              <VoiceCardsSection s={s} />
            </Section>

            <Section
              icon="⚡"
              title="Vitesse chat vocal"
              badge="Hard"
              isOpen={openSections.chatSpeed}
              onToggle={() => toggle("chatSpeed")}
            >
              <ChatSpeedSection s={s} />
            </Section>

            <Section
              icon="📖"
              title="Vitesse de lecture résumés"
              badge="Hard"
              isOpen={openSections.readingSpeed}
              onToggle={() => toggle("readingSpeed")}
            >
              <ReadingSpeedSection s={s} />
            </Section>

            <Section
              icon="🤖"
              title="Modèles"
              badge="Hard"
              isOpen={openSections.models}
              onToggle={() => toggle("models")}
            >
              <ModelsSection s={s} />
            </Section>

            <Section
              icon="🎚"
              title="Avancé"
              badge="Hard"
              isOpen={openSections.advanced}
              onToggle={() => toggle("advanced")}
            >
              <AdvancedSlidersSection s={s} />
            </Section>

            <Section
              icon="🎮"
              title="Mode interaction"
              badge="Live"
              isOpen={openSections.interaction}
              onToggle={() => toggle("interaction")}
            >
              <InteractionSection s={s} />
            </Section>

            <Section
              icon="⏱"
              title="Timeouts"
              badge="Live"
              isOpen={openSections.timeouts}
              onToggle={() => toggle("timeouts")}
            >
              <TimeoutsSection s={s} />
            </Section>

            <Section
              icon="🌍"
              title="Préférences par défaut"
              badge="Hard"
              isOpen={openSections.defaults}
              onToggle={() => toggle("defaults")}
            >
              <DefaultsSection s={s} />
            </Section>

            <div className="dsp-vs-reset">
              {!confirmingReset ? (
                <button
                  type="button"
                  className="dsp-vs-link-btn"
                  onClick={() => setConfirmingReset(true)}
                >
                  ↺ Réinitialiser les valeurs par défaut
                </button>
              ) : (
                <div className="dsp-vs-confirm">
                  <span className="dsp-vs-hint">Confirmer le reset ?</span>
                  <button
                    type="button"
                    className="dsp-vs-btn-secondary"
                    onClick={() => setConfirmingReset(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="dsp-vs-btn-danger"
                    onClick={async () => {
                      await s.resetToDefaults();
                      setConfirmingReset(false);
                    }}
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="dsp-vs-drawer-footer">
        {dirtyHard > 0 ? (
          <>
            <button
              type="button"
              className="dsp-vs-btn-secondary"
              onClick={() => s.resetStaged()}
              disabled={s.saving}
            >
              Annuler
            </button>
            <button
              type="button"
              className="dsp-vs-btn-primary"
              onClick={() => void handleApply()}
              disabled={s.saving}
            >
              {s.saving ? "Application…" : `Appliquer (${dirtyHard})`}
            </button>
          </>
        ) : (
          <span className="dsp-vs-footer-hint">
            Les réglages live sont sauvegardés automatiquement.
          </span>
        )}
      </footer>
    </div>
  );
};

export default VoiceSettingsDrawer;
