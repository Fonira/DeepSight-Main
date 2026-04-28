/**
 * VoiceChatSpeedSection — Section 2 : Vitesse du chat vocal
 * Grille de presets vitesse avec indicateur mode concis.
 */

import React from "react";
import type {
  VoicePreferences,
  VoiceChatSpeedPreset,
} from "../../services/api";
import { VoiceAnalytics } from "./voiceAnalytics";
import { emitVoicePrefsEvent } from "./voicePrefsBus";

interface VoiceChatSpeedSectionProps {
  preferences: VoicePreferences;
  presets: VoiceChatSpeedPreset[];
  saving: boolean;
  onSave: (updates: Partial<VoicePreferences>) => void;
}

export const VoiceChatSpeedSection: React.FC<VoiceChatSpeedSectionProps> = ({
  preferences,
  presets,
  saving,
  onSave,
}) => {
  return (
    <div className="space-y-4">
      <p className="text-text-muted text-sm">
        Vitesse de réponse de l'agent en conversation vocale
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {presets.map((preset) => {
          const isActive = preferences.voice_chat_speed_preset === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => {
                onSave({ voice_chat_speed_preset: preset.id });
                VoiceAnalytics.trackSpeedChanged({
                  presetId: preset.id,
                  playbackRate: preset.playback_rate,
                  concise: preset.concise,
                });
                // Live-apply playback_rate to active session (no restart needed)
                emitVoicePrefsEvent({
                  type: "playback_rate_changed",
                  value: preset.playback_rate,
                });
                if (preset.concise) {
                  emitVoicePrefsEvent({
                    type: "restart_required",
                    reason: "concise_mode",
                  });
                }
              }}
              disabled={saving}
              className={`
                flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200
                ${
                  isActive
                    ? "bg-indigo-500/30 border-2 border-indigo-400 text-indigo-300 scale-105 shadow-lg shadow-indigo-500/20"
                    : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                }
              `}
            >
              <span className="text-sm font-semibold">{preset.id}</span>
              <span className="text-[10px] text-text-muted">
                {preset.label_fr}
              </span>
              {preset.concise && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                  Concis
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Concise mode indicator */}
      {presets.find((p) => p.id === preferences.voice_chat_speed_preset)
        ?.concise && (
        <p className="text-violet-300 text-xs flex items-center gap-1.5">
          <span>⚡</span> Mode concis : réponses ultra-courtes activées
        </p>
      )}
    </div>
  );
};
