/**
 * AmbientLightDevPanel — Debug overlay pour QA visuelle de l'éclairage.
 *
 * Affiche un mini-panel flottant en bas à droite avec :
 *   - Slider 0..24h pour scrubber l'heure en temps réel
 *   - Affichage du mood courant + RGB + angle + opacité du beam
 *   - Boutons preset (00:00, 06:00, 12:00, 18:00, 22:00)
 *
 * ⚠️ Activation :
 *   - Dev only : visible si `import.meta.env.DEV === true`
 *   - OU param URL `?debug-light=1`
 *
 * Utilise `?debug-time=HH:MM` pour figer l'heure (consommé par useAmbientPreset).
 *
 * Usage : monter dans App.tsx (au-dessus de Router) :
 *   <AmbientLightDevPanel />
 */

import React, { useEffect, useState } from "react";
import {
  getAmbientPreset,
  type AmbientPreset,
} from "@deepsight/lighting-engine";

const PRESET_TIMES = [
  { label: "Minuit", value: "00:00" },
  { label: "Aube", value: "06:00" },
  { label: "Midi", value: "12:00" },
  { label: "Crépuscule", value: "18:00" },
  { label: "Soir", value: "22:00" },
];

function isDevMode(): boolean {
  // Vite : import.meta.env.DEV
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) return true;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    return params.get("debug-light") === "1";
  }
  return false;
}

function readUrlDebugTime(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("debug-time") ?? "";
}

function setUrlDebugTime(time: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (time) {
    url.searchParams.set("debug-time", time);
  } else {
    url.searchParams.delete("debug-time");
  }
  window.history.replaceState({}, "", url.toString());
  // Reload pour appliquer le nouveau debug-time (le hook ne le re-watch pas)
  window.location.reload();
}

function timeToMinutes(time: string): number {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const AmbientLightDevPanel: React.FC = () => {
  const [open, setOpen] = useState(true);
  const [scrubMinutes, setScrubMinutes] = useState<number>(() => {
    const initial = readUrlDebugTime();
    return initial
      ? timeToMinutes(initial)
      : new Date().getHours() * 60 + new Date().getMinutes();
  });
  const [livePreset, setLivePreset] = useState<AmbientPreset | null>(null);

  // Recompute live preset on slider change (sans reload — preview only)
  useEffect(() => {
    const date = new Date();
    date.setHours(
      Math.floor(scrubMinutes / 60),
      Math.floor(scrubMinutes % 60),
      0,
      0,
    );
    setLivePreset(getAmbientPreset(date));
  }, [scrubMinutes]);

  if (!isDevMode()) return null;

  const currentDebugTime = readUrlDebugTime();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: "rgba(15, 18, 28, 0.92)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(99, 102, 241, 0.4)",
        borderRadius: 12,
        padding: open ? 16 : 8,
        color: "#e5e7eb",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: 12,
        minWidth: open ? 320 : 60,
        maxWidth: 360,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        transition: "min-width 200ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: open ? 12 : 0,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            background: "transparent",
            border: "none",
            color: "#a5b4fc",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            padding: 0,
          }}
        >
          {open ? "🌗 Lumière" : "🌗"}
        </button>
        {open && (
          <span style={{ color: "#6b7280", fontSize: 10 }}>v2 dev panel</span>
        )}
      </div>

      {open && livePreset && (
        <>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: "#c7d2fe" }}>
              {minutesToTime(scrubMinutes)}
            </strong>{" "}
            <span style={{ color: "#9ca3af" }}>—</span>{" "}
            <span style={{ color: "#fbbf24" }}>{livePreset.mood}</span>
          </div>

          <input
            type="range"
            min={0}
            max={1439}
            step={1}
            value={scrubMinutes}
            onChange={(e) => setScrubMinutes(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#6366f1" }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "4px 8px",
              marginTop: 12,
              fontSize: 11,
            }}
          >
            <span style={{ color: "#9ca3af" }}>Beam type</span>
            <span style={{ color: "#fbbf24" }}>
              {livePreset.centralBeam.type}
            </span>

            <span style={{ color: "#9ca3af" }}>RGB</span>
            <span>[{livePreset.centralBeam.rgb.join(", ")}]</span>

            <span style={{ color: "#9ca3af" }}>Angle</span>
            <span>{livePreset.centralBeam.angleDeg.toFixed(1)}°</span>

            <span style={{ color: "#9ca3af" }}>Opacity</span>
            <span>{livePreset.centralBeam.opacity.toFixed(3)}</span>

            <span style={{ color: "#9ca3af" }}>Stars</span>
            <span>density={livePreset.stars.density.toFixed(2)}</span>

            <span style={{ color: "#9ca3af" }}>Moon</span>
            <span>
              {livePreset.moon.visible
                ? `${livePreset.moon.xPercent.toFixed(0)}%, ${livePreset.moon.yPercent.toFixed(0)}%`
                : "—"}
            </span>

            <span style={{ color: "#9ca3af" }}>Sun</span>
            <span>
              {livePreset.sun.visible
                ? `${livePreset.sun.xPercent.toFixed(0)}%, ${livePreset.sun.yPercent.toFixed(0)}%`
                : "—"}
            </span>

            <span style={{ color: "#9ca3af" }}>Compute</span>
            <span>{livePreset._debug.computeTimeMs.toFixed(2)}ms</span>
          </div>

          <div
            style={{ marginTop: 12, display: "flex", gap: 4, flexWrap: "wrap" }}
          >
            {PRESET_TIMES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setScrubMinutes(timeToMinutes(p.value))}
                style={{
                  background: "rgba(99, 102, 241, 0.2)",
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                  borderRadius: 6,
                  color: "#c7d2fe",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontFamily: "inherit",
                  fontSize: 11,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setUrlDebugTime(minutesToTime(scrubMinutes))}
              style={{
                flex: 1,
                background: "#6366f1",
                border: "none",
                borderRadius: 6,
                color: "white",
                cursor: "pointer",
                padding: "6px 10px",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Apply (reload)
            </button>
            {currentDebugTime && (
              <button
                type="button"
                onClick={() => setUrlDebugTime("")}
                style={{
                  background: "rgba(248, 113, 113, 0.2)",
                  border: "1px solid rgba(248, 113, 113, 0.4)",
                  borderRadius: 6,
                  color: "#fca5a5",
                  cursor: "pointer",
                  padding: "6px 10px",
                  fontFamily: "inherit",
                  fontSize: 11,
                }}
              >
                Reset
              </button>
            )}
          </div>

          {currentDebugTime && (
            <div style={{ marginTop: 8, color: "#fca5a5", fontSize: 10 }}>
              ⚠️ Debug-time actif : {currentDebugTime}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AmbientLightDevPanel;
