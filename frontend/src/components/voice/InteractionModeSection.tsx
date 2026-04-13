/**
 * InteractionModeSection — Section 1 : Mode d'interaction (PTT / VAD)
 * Segmented control PTT/VAD + slider eagerness (VAD) + toggle interruptions.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toggle } from "../ui/Toggle";
import type { VoicePreferences } from "../../services/api";

interface InteractionModeSectionProps {
  preferences: VoicePreferences;
  saving: boolean;
  onSave: (updates: Partial<VoicePreferences>) => void;
  onLocalUpdate: (updates: Partial<VoicePreferences>) => void;
}

const modes = [
  {
    id: "ptt" as const,
    label: "Appuyer pour parler",
    description:
      "Maintenez le bouton pour parler. Plus de contrôle, moins de faux positifs.",
  },
  {
    id: "vad" as const,
    label: "Détection vocale",
    description:
      "Micro toujours ouvert. Le système détecte automatiquement quand vous parlez.",
  },
];

export const InteractionModeSection: React.FC<InteractionModeSectionProps> = ({
  preferences,
  saving,
  onSave,
  onLocalUpdate,
}) => {
  return (
    <div className="space-y-5">
      {/* PTT / VAD segmented control */}
      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSave({ input_mode: mode.id })}
            disabled={saving}
            className={`text-left p-4 rounded-xl transition-all duration-200 ${
              preferences.input_mode === mode.id
                ? "bg-indigo-500/20 border-2 border-indigo-400 text-indigo-300"
                : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20"
            }`}
          >
            <span className="font-semibold text-sm block">{mode.label}</span>
            <span className="text-xs text-white/40 mt-1 block">
              {mode.description}
            </span>
          </button>
        ))}
      </div>

      {/* Turn eagerness slider — VAD only */}
      <AnimatePresence initial={false}>
        {preferences.input_mode === "vad" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-white/70 text-sm font-medium">
                  Réactivité
                  <span className="ml-2 text-white/40 text-xs">
                    (patience ← → réactivité)
                  </span>
                </label>
                <span className="text-indigo-400 font-mono text-sm">
                  {preferences.turn_eagerness.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={preferences.turn_eagerness}
                onChange={(e) =>
                  onLocalUpdate({ turn_eagerness: parseFloat(e.target.value) })
                }
                onMouseUp={() =>
                  onSave({ turn_eagerness: preferences.turn_eagerness })
                }
                onTouchEnd={() =>
                  onSave({ turn_eagerness: preferences.turn_eagerness })
                }
                className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
              />
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>Patient — attend que vous finissiez</span>
                <span>Réactif — répond vite</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interruptions toggle */}
      <div className="pt-2 border-t border-white/10">
        <Toggle
          checked={preferences.interruptions_enabled}
          onChange={(v) => onSave({ interruptions_enabled: v })}
          label="Interruptions"
          description="Permet de couper la parole à l'agent en parlant"
          disabled={saving}
        />
      </div>
    </div>
  );
};
