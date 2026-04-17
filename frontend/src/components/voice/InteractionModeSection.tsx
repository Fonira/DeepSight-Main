/**
 * InteractionModeSection — Section 1 : Mode d'interaction (PTT / VAD)
 * Segmented control PTT/VAD + slider eagerness (VAD) + toggle interruptions.
 */

import React, { useEffect, useState } from "react";
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

// ── PTT Key display helper ─────────────────────────────────────────────────
const formatKeyLabel = (key: string): string => {
  if (key === " " || key === "Space" || key === "Spacebar") return "Espace";
  if (key === "Shift") return "Shift";
  if (key === "Control") return "Ctrl";
  if (key === "Alt") return "Alt";
  if (key === "Meta") return "Meta";
  if (key === "Enter") return "Entrée";
  if (key.length === 1) return key.toUpperCase();
  return key;
};

interface PttKeyPickerProps {
  currentKey: string;
  saving: boolean;
  onSave: (key: string) => void;
}

const PttKeyPicker: React.FC<PttKeyPickerProps> = ({ currentKey, saving, onSave }) => {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setListening(false);
        return;
      }
      // Normalise Space to " " for compatibility with KeyboardEvent.key
      const newKey = e.key === " " ? " " : e.key;
      // Ignore pure modifier-up events without base key? Accept all including Shift/Control
      onSave(newKey);
      setListening(false);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true } as any);
  }, [listening, onSave]);

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-white/70 text-sm font-medium block">
            Touche pour parler
          </label>
          <span className="text-xs text-white/40 block mt-0.5">
            Maintenez cette touche pour activer le micro
          </span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/90 text-sm font-mono min-w-[56px] text-center">
            {listening ? "..." : formatKeyLabel(currentKey)}
          </kbd>
          <button
            type="button"
            onClick={() => setListening((v) => !v)}
            disabled={saving}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              listening
                ? "bg-red-500/20 text-red-300 border border-red-400/40 hover:bg-red-500/30"
                : "bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 hover:bg-indigo-500/30"
            }`}
          >
            {listening ? "Annuler (Échap)" : "Modifier"}
          </button>
        </div>
      </div>
      {listening && (
        <p className="text-[11px] text-indigo-300/80 mt-2">
          Appuyez sur la touche désirée…
        </p>
      )}
    </div>
  );
};

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

      {/* PTT key picker — PTT only */}
      <AnimatePresence initial={false}>
        {preferences.input_mode === "ptt" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <PttKeyPicker
              currentKey={preferences.ptt_key || " "}
              saving={saving}
              onSave={(key) => onSave({ ptt_key: key })}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
