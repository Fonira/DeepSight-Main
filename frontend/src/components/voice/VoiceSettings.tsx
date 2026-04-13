/**
 * VoiceSettings — Configuration des voix ElevenLabs
 * Sélection de voix, vitesse (mise en avant), paramètres avancés
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { voiceApi } from "../../services/api";
import {
  DeepSightSpinner,
  DeepSightSpinnerMicro,
} from "../ui/DeepSightSpinner";
import {
  MessageSquare,
  Zap,
  AudioLines,
  Gauge,
  Cpu,
  SlidersHorizontal,
} from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { InteractionModeSection } from "./InteractionModeSection";
import { VoiceChatSpeedSection } from "./VoiceChatSpeedSection";
import type {
  VoicePreferences,
  VoiceCatalogEntry,
  VoiceSpeedPreset,
  VoiceModel,
  VoiceCatalog,
} from "../../services/api";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface VoiceSettingsProps {
  onClose?: () => void;
  compact?: boolean; // Mode compact (dans un modal vs page complète)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  onClose,
  compact = false,
}) => {
  // ── State ──────────────────────────────────────────────────────────────
  const [preferences, setPreferences] = useState<VoicePreferences | null>(null);
  const [catalog, setCatalog] = useState<VoiceCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    interaction: true,
    chatSpeed: true,
    voiceSelection: false,
    readingSpeed: false,
    models: false,
    advanced: false,
  });
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [prefs, cat] = await Promise.all([
          voiceApi.getPreferences(),
          voiceApi.getCatalog(),
        ]);
        setPreferences(prefs);
        setCatalog(cat);
      } catch (err: unknown) {
        setError("Impossible de charger les préférences vocales.");
        console.error("VoiceSettings load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ── Save handler ───────────────────────────────────────────────────────
  const savePreferences = useCallback(
    async (updates: Partial<VoicePreferences>) => {
      if (!preferences) return;
      try {
        setSaving(true);
        setError(null);
        const updated = await voiceApi.updatePreferences(updates);
        setPreferences(updated);
        setSuccessMsg("Préférences enregistrées !");
        setTimeout(() => setSuccessMsg(null), 2000);
      } catch (err: unknown) {
        setError("Erreur lors de la sauvegarde.");
        console.error("VoiceSettings save error:", err);
      } finally {
        setSaving(false);
      }
    },
    [preferences],
  );

  // ── Voice preview ──────────────────────────────────────────────────────
  const playPreview = useCallback(
    (voiceId: string, previewUrl: string) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (playingVoice === voiceId) {
        setPlayingVoice(null);
        return;
      }
      const audio = new Audio(previewUrl);
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => setPlayingVoice(null);
      audio.play();
      audioRef.current = audio;
      setPlayingVoice(voiceId);
    },
    [playingVoice],
  );

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <DeepSightSpinner size="md" />
        <span className="ml-3 text-white/60">
          Chargement des paramètres vocaux...
        </span>
      </div>
    );
  }

  if (!preferences || !catalog) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">
          {error || "Impossible de charger les préférences."}
        </p>
      </div>
    );
  }

  const filteredVoices =
    genderFilter === "all"
      ? catalog.voices
      : catalog.voices.filter((v) => v.gender === genderFilter);

  return (
    <div className={`${compact ? "" : "max-w-4xl mx-auto"} space-y-8`}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">🎙️</span>
            Paramètres vocaux
          </h2>
          <p className="text-white/50 mt-1">
            Personnalisez la voix, la vitesse et les réglages audio
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Messages ──────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-400 text-sm flex items-center gap-2">
          <span>✓</span> {successMsg}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          Section 1 : Mode d'interaction (PTT / VAD)
          ══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        icon={MessageSquare}
        title="Mode d'interaction"
        isOpen={openSections.interaction}
        onToggle={() => toggleSection("interaction")}
      >
        <InteractionModeSection
          preferences={preferences}
          saving={saving}
          onSave={savePreferences}
          onLocalUpdate={(updates) =>
            setPreferences({ ...preferences, ...updates })
          }
        />
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════
          Section 2 : Vitesse du chat vocal
          ══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        icon={Zap}
        title="Vitesse du chat vocal"
        isOpen={openSections.chatSpeed}
        onToggle={() => toggleSection("chatSpeed")}
      >
        <VoiceChatSpeedSection
          preferences={preferences}
          presets={catalog.voice_chat_speed_presets}
          saving={saving}
          onSave={savePreferences}
        />
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════
          Section 3 : Sélection de voix
          ══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        icon={AudioLines}
        title="Sélection de voix"
        isOpen={openSections.voiceSelection}
        onToggle={() => toggleSection("voiceSelection")}
      >
        {/* Gender filter */}
        <div className="flex gap-2 mb-4">
          {[
            { id: "all", label: "Toutes" },
            { id: "female", label: "Féminines" },
            { id: "male", label: "Masculines" },
            { id: "neutral", label: "Neutres" },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setGenderFilter(filter.id)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                genderFilter === filter.id
                  ? "bg-indigo-500/30 text-indigo-300 border border-indigo-400/50"
                  : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Voice cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredVoices.map((voice: VoiceCatalogEntry) => {
            const isSelected = preferences.voice_id === voice.voice_id;
            const isPlaying = playingVoice === voice.voice_id;
            return (
              <div
                key={voice.voice_id}
                className={`
                  relative p-4 rounded-xl transition-all duration-200 cursor-pointer
                  ${
                    isSelected
                      ? "bg-indigo-500/20 border-2 border-indigo-400 shadow-lg shadow-indigo-500/10"
                      : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
                  }
                `}
                onClick={() =>
                  savePreferences({
                    voice_id: voice.voice_id,
                    voice_name: voice.name,
                  })
                }
              >
                {voice.recommended && (
                  <span className="absolute -top-2 -right-2 bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Recommandé
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {voice.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">
                        {voice.gender === "male"
                          ? "♂"
                          : voice.gender === "female"
                            ? "♀"
                            : "⚧"}
                      </span>
                      {voice.language === "fr" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                          FR natif
                        </span>
                      )}
                    </div>
                    <p className="text-white/50 text-xs mt-1">
                      {voice.description_fr}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-white/30">
                        {voice.accent}
                      </span>
                      <span className="text-white/20">·</span>
                      <span className="text-[10px] text-white/30">
                        {voice.use_case}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPreview(voice.voice_id, voice.preview_url);
                    }}
                    className={`
                      p-2 rounded-lg transition-all
                      ${
                        isPlaying
                          ? "bg-indigo-500 text-white animate-pulse"
                          : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                      }
                    `}
                    title="Écouter un aperçu"
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                </div>
                {isSelected && (
                  <div className="mt-2 flex items-center gap-1 text-indigo-400 text-xs">
                    <span>✓</span> Voix active
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════
          Section 4 : Vitesse de lecture (résumés)
          ══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        icon={Gauge}
        title="Vitesse de lecture (résumés)"
        isOpen={openSections.readingSpeed}
        onToggle={() => toggleSection("readingSpeed")}
        gradient
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="ml-auto text-3xl font-bold text-indigo-400">
            {preferences.speed}x
          </span>
        </div>
        <p className="text-white/50 text-sm mb-5">
          Ajustez la vitesse de parole — du très lent (0.25x) au maximum (4.0x)
        </p>

        {/* Speed presets grid */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4">
          {catalog.speed_presets.map((preset: VoiceSpeedPreset) => (
            <button
              key={preset.id}
              onClick={() => savePreferences({ speed: preset.value })}
              disabled={saving}
              className={`
                flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-200
                ${
                  preferences.speed === preset.value
                    ? "bg-indigo-500/30 border-2 border-indigo-400 text-indigo-300 scale-105 shadow-lg shadow-indigo-500/20"
                    : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                }
              `}
            >
              <span className="text-xl">{preset.icon}</span>
              <span className="text-xs font-medium">{preset.value}x</span>
              <span className="text-[10px] text-white/40">
                {preset.label_fr}
              </span>
            </button>
          ))}
        </div>

        {/* Custom speed slider */}
        <div className="mt-4">
          <div className="flex items-center gap-4">
            <span className="text-white/40 text-xs w-12">0.25x</span>
            <input
              type="range"
              min="0.25"
              max="4.0"
              step="0.05"
              value={preferences.speed}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  speed: parseFloat(e.target.value),
                })
              }
              onMouseUp={() => savePreferences({ speed: preferences.speed })}
              onTouchEnd={() => savePreferences({ speed: preferences.speed })}
              className="flex-1 accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
            />
            <span className="text-white/40 text-xs w-12 text-right">4.0x</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════
          Section 5 : Modèles
          ══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        icon={Cpu}
        title="Modèles"
        isOpen={openSections.models}
        onToggle={() => toggleSection("models")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* TTS Model */}
          <div>
            <p className="text-white/50 text-sm mb-2">
              Lecture TTS (résumés, synthèse)
            </p>
            <div className="space-y-2">
              {catalog.models.map((model: VoiceModel) => (
                <button
                  key={`tts-${model.id}`}
                  onClick={() => savePreferences({ tts_model: model.id })}
                  disabled={saving}
                  className={`
                    w-full text-left p-3 rounded-xl transition-all
                    ${
                      preferences.tts_model === model.id
                        ? "bg-indigo-500/20 border-2 border-indigo-400"
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">
                      {model.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        model.latency === "lowest"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : model.latency === "low"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {model.latency === "lowest"
                        ? "Ultra-rapide"
                        : model.latency === "low"
                          ? "Rapide"
                          : "Haute qualité"}
                    </span>
                  </div>
                  <p className="text-white/40 text-xs mt-1">
                    {model.description_fr}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Chat Model */}
          <div>
            <p className="text-white/50 text-sm mb-2">
              Chat vocal (temps réel)
            </p>
            <div className="space-y-2">
              {catalog.models.map((model: VoiceModel) => (
                <button
                  key={`vc-${model.id}`}
                  onClick={() =>
                    savePreferences({ voice_chat_model: model.id })
                  }
                  disabled={saving}
                  className={`
                    w-full text-left p-3 rounded-xl transition-all
                    ${
                      preferences.voice_chat_model === model.id
                        ? "bg-violet-500/20 border-2 border-violet-400"
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">
                      {model.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        model.latency === "lowest"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : model.latency === "low"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {model.latency === "lowest"
                        ? "Ultra-rapide"
                        : model.latency === "low"
                          ? "Rapide"
                          : "Haute qualité"}
                    </span>
                  </div>
                  <p className="text-white/40 text-xs mt-1">
                    {model.description_fr}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════
          Section 6 : Paramètres avancés
          ══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        icon={SlidersHorizontal}
        title="Paramètres avancés"
        isOpen={openSections.advanced}
        onToggle={() => toggleSection("advanced")}
      >
        <div className="space-y-6">
          {/* Stability */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/70 text-sm font-medium">
                Stabilité
                <span className="ml-2 text-white/40 text-xs">
                  (variable ← → stable)
                </span>
              </label>
              <span className="text-indigo-400 font-mono text-sm">
                {preferences.stability.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={preferences.stability}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  stability: parseFloat(e.target.value),
                })
              }
              onMouseUp={() =>
                savePreferences({ stability: preferences.stability })
              }
              onTouchEnd={() =>
                savePreferences({ stability: preferences.stability })
              }
              className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-1">
              <span>Plus expressif</span>
              <span>Plus constant</span>
            </div>
          </div>

          {/* Similarity Boost */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/70 text-sm font-medium">
                Fidélité de la voix
                <span className="ml-2 text-white/40 text-xs">
                  (diversifié ← → fidèle)
                </span>
              </label>
              <span className="text-indigo-400 font-mono text-sm">
                {preferences.similarity_boost.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={preferences.similarity_boost}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  similarity_boost: parseFloat(e.target.value),
                })
              }
              onMouseUp={() =>
                savePreferences({
                  similarity_boost: preferences.similarity_boost,
                })
              }
              onTouchEnd={() =>
                savePreferences({
                  similarity_boost: preferences.similarity_boost,
                })
              }
              className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-1">
              <span>Plus varié</span>
              <span>Plus fidèle à l'original</span>
            </div>
          </div>

          {/* Style */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/70 text-sm font-medium">
                Style
                <span className="ml-2 text-white/40 text-xs">
                  (neutre ← → expressif)
                </span>
              </label>
              <span className="text-indigo-400 font-mono text-sm">
                {preferences.style.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={preferences.style}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  style: parseFloat(e.target.value),
                })
              }
              onMouseUp={() => savePreferences({ style: preferences.style })}
              onTouchEnd={() => savePreferences({ style: preferences.style })}
              className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-1">
              <span>Neutre</span>
              <span>Très expressif</span>
            </div>
          </div>

          {/* Speaker Boost */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-white/70 text-sm font-medium">
                Speaker Boost
              </label>
              <p className="text-white/40 text-xs mt-0.5">
                Améliore la clarté et la qualité de la voix (consomme plus de
                crédits)
              </p>
            </div>
            <button
              onClick={() =>
                savePreferences({
                  use_speaker_boost: !preferences.use_speaker_boost,
                })
              }
              disabled={saving}
              className={`
                relative w-12 h-6 rounded-full transition-colors duration-200
                ${preferences.use_speaker_boost ? "bg-indigo-500" : "bg-white/20"}
              `}
            >
              <span
                className={`
                absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
                ${preferences.use_speaker_boost ? "translate-x-6" : "translate-x-0.5"}
              `}
              />
            </button>
          </div>

          {/* Turn timeout */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/70 text-sm font-medium">
                Délai de relance
                <span className="ml-2 text-white/40 text-xs">
                  (silence avant relance)
                </span>
              </label>
              <span className="text-indigo-400 font-mono text-sm">
                {preferences.turn_timeout}s
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={preferences.turn_timeout}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  turn_timeout: parseInt(e.target.value),
                })
              }
              onMouseUp={() =>
                savePreferences({ turn_timeout: preferences.turn_timeout })
              }
              onTouchEnd={() =>
                savePreferences({ turn_timeout: preferences.turn_timeout })
              }
              className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-1">
              <span>5s</span>
              <span>60s</span>
            </div>
            <p className="text-white/40 text-xs mt-1">
              Durée de silence avant que l'agent relance la conversation
            </p>
          </div>

          {/* Soft timeout (session) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/70 text-sm font-medium">
                Alerte de session
                <span className="ml-2 text-white/40 text-xs">
                  (avant déconnexion)
                </span>
              </label>
              <span className="text-indigo-400 font-mono text-sm">
                {Math.round(preferences.soft_timeout_seconds / 60)} min
              </span>
            </div>
            <input
              type="range"
              min="60"
              max="600"
              step="30"
              value={preferences.soft_timeout_seconds}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  soft_timeout_seconds: parseInt(e.target.value),
                })
              }
              onMouseUp={() =>
                savePreferences({
                  soft_timeout_seconds: preferences.soft_timeout_seconds,
                })
              }
              onTouchEnd={() =>
                savePreferences({
                  soft_timeout_seconds: preferences.soft_timeout_seconds,
                })
              }
              className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-1">
              <span>1 min</span>
              <span>10 min</span>
            </div>
            <p className="text-white/40 text-xs mt-1">
              Alerte avant la fin automatique de session
            </p>
          </div>

          {/* Language + Gender defaults */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <label className="text-white/70 text-sm font-medium block mb-2">
                Langue par défaut
              </label>
              <div className="flex gap-2">
                {[
                  { id: "fr", label: "🇫🇷 Français" },
                  { id: "en", label: "🇬🇧 English" },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => savePreferences({ language: lang.id })}
                    disabled={saving}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                      preferences.language === lang.id
                        ? "bg-indigo-500/20 border border-indigo-400 text-indigo-300"
                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-white/70 text-sm font-medium block mb-2">
                Genre par défaut
              </label>
              <div className="flex gap-2">
                {[
                  { id: "female", label: "♀ Féminin" },
                  { id: "male", label: "♂ Masculin" },
                ].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => savePreferences({ gender: g.id })}
                    disabled={saving}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                      preferences.gender === g.id
                        ? "bg-indigo-500/20 border border-indigo-400 text-indigo-300"
                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reset to defaults */}
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={() =>
                savePreferences({
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
                  interruptions_enabled: true,
                  turn_eagerness: 0.5,
                  voice_chat_speed_preset: "1x",
                  turn_timeout: 15,
                  soft_timeout_seconds: 300,
                })
              }
              disabled={saving}
              className="text-white/40 text-sm hover:text-white/70 transition-colors"
            >
              ↺ Réinitialiser les valeurs par défaut
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-6 right-6 bg-indigo-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
          <DeepSightSpinnerMicro />
          Enregistrement...
        </div>
      )}
    </div>
  );
};

export default VoiceSettings;
