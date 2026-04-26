/**
 * AmbientLightDevPanel — Panel de QA visuelle pour l'éclairage ambiant.
 *
 * Permet de scrubber l'heure du jour (0-24h) et d'observer les transitions
 * de moods, beam types, opacités. Affiche aussi les debug info (factor,
 * mood from→to, seed, angle variation).
 *
 * Usage : monter sur une route /dev/lighting (gated dev only).
 */

import React, { useState } from "react";
import { getAmbientPreset } from "@deepsight/lighting-engine";

const STEP_MIN = 30; // step in minutes when scrubbing

function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export const AmbientLightDevPanel: React.FC = () => {
  const [hour, setHour] = useState(12);
  const [dayOffset, setDayOffset] = useState(0);
  const [intensity, setIntensity] = useState(1);
  const [disableVariation, setDisableVariation] = useState(false);

  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  date.setHours(hh, mm, 0, 0);

  const preset = getAmbientPreset(date, {
    intensityMul: intensity,
    disableDailyVariation: disableVariation,
  });

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-black/85 text-white text-xs p-4 rounded-lg shadow-xl border border-white/10 backdrop-blur w-[340px] font-mono">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm">Ambient Lighting Dev Panel</span>
        <span
          className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300"
          title="Beam type"
        >
          {preset.beam.type.toUpperCase()}
        </span>
      </div>

      <div className="mb-2">
        <label className="block text-[10px] uppercase opacity-60 mb-1">
          Time of day — {formatHour(hour)}
        </label>
        <input
          type="range"
          min={0}
          max={23.5}
          step={STEP_MIN / 60}
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          className="w-full accent-indigo-400"
        />
      </div>

      <div className="mb-2">
        <label className="block text-[10px] uppercase opacity-60 mb-1">
          Day offset (test variation seedée) : J{dayOffset >= 0 ? "+" : ""}
          {dayOffset}
        </label>
        <input
          type="range"
          min={-7}
          max={7}
          step={1}
          value={dayOffset}
          onChange={(e) => setDayOffset(Number(e.target.value))}
          className="w-full accent-violet-400"
        />
      </div>

      <div className="mb-2">
        <label className="block text-[10px] uppercase opacity-60 mb-1">
          Intensity x{intensity.toFixed(2)}
        </label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
      </div>

      <label className="flex items-center gap-2 text-[10px] mb-3">
        <input
          type="checkbox"
          checked={disableVariation}
          onChange={(e) => setDisableVariation(e.target.checked)}
        />
        Désactiver variation seedée
      </label>

      <div className="border-t border-white/10 pt-2 text-[10px] leading-relaxed opacity-80">
        <div>
          <span className="opacity-60">Mood:</span> {preset.mood}
        </div>
        <div>
          <span className="opacity-60">Beam angle:</span>{" "}
          {preset.beam.angleDeg.toFixed(1)}° (var{" "}
          {preset.debug?.angleVariation.toFixed(1)}°)
        </div>
        <div>
          <span className="opacity-60">Beam color:</span>{" "}
          rgb({preset.beam.color.join(",")}) @{preset.beam.opacity.toFixed(2)}
        </div>
        <div>
          <span className="opacity-60">Sun:</span>{" "}
          {preset.sun.visible
            ? `visible @${preset.sun.opacity.toFixed(2)} (${preset.sun.x.toFixed(0)}%, ${preset.sun.y.toFixed(0)}%)`
            : "hidden"}
        </div>
        <div>
          <span className="opacity-60">Moon:</span>{" "}
          {preset.moon.visible
            ? `visible @${preset.moon.opacity.toFixed(2)} (${preset.moon.x.toFixed(0)}%, ${preset.moon.y.toFixed(0)}%)`
            : "hidden"}
        </div>
        <div>
          <span className="opacity-60">Stars:</span> x
          {preset.starOpacityMul.toFixed(2)} ({preset.starDensity})
        </div>
        <div>
          <span className="opacity-60">Seed:</span> {preset.debug?.seed}
        </div>
        <div>
          <span className="opacity-60">Factor:</span>{" "}
          {preset.debug?.factor.toFixed(3)}
        </div>
      </div>
    </div>
  );
};

export default AmbientLightDevPanel;
